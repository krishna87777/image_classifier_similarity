from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import tempfile
from PIL import Image
import pillow_heif
from task1_model import ShopClassifier
from task2_model import SimilaritySearch
import pillow_avif
from fastapi.middleware.cors import CORSMiddleware


import asyncio
from fastapi import BackgroundTasks
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=2)

# Register HEIF opener with Pillow
pillow_heif.register_heif_opener()

app = FastAPI()

# ✅ Enhanced CORS configuration
app.add_middleware(
    CORSMiddleware,

    # allow_origins=[
    #     "http://localhost:3000",
    #     "http://127.0.0.1:3000",
    #     "http://localhost:8000",
    #     "http://127.0.0.1:8000"
    # ],
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Initialize models with better error handling
task1 = None
task2 = None

try:
    print("Loading Task1 model...")
    task1 = ShopClassifier("models/deit_shopnotshop1.pth")
    print("✅ Task1 model loaded successfully")
except Exception as e:
    print(f"❌ Error loading task1 model: {e}")

try:
    print("Loading Task2 model...")
    task2 = SimilaritySearch("data/shop_index.faiss", "data/image_paths.pkl", "data/embed2img_idx.npy")
    print("✅ Task2 model loaded successfully")
except Exception as e:
    print(f"❌ Error loading task2 model: {e}")


def convert_heic_to_jpg(input_path, output_path):
    """Convert HEIC/HEIF to JPG format"""
    try:
        # Open HEIC image
        image = Image.open(input_path)

        # Convert to RGB if necessary (HEIC might be in other modes)
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # Save as JPEG
        image.save(output_path, 'JPEG', quality=95)
        return True
    except Exception as e:
        print(f"HEIC conversion error: {e}")
        return False


def process_image_file(image: UploadFile, temp_dir: str):
    """Process uploaded image file, converting HEIC if necessary"""

    # Determine if it's a HEIC file
    # Determine if it's a HEIC file
    is_heic = (
            image.content_type in ['image/heic', 'image/heif'] or
            image.filename.lower().endswith(('.heic', '.heif'))
    )

    # Determine if it's an AVIF file
    is_avif = (
            image.content_type in ['image/avif'] or
            image.filename.lower().endswith('.avif')
    )

    # Create temporary file with appropriate extension
    original_suffix = f"_{image.filename}" if image.filename else "_upload"
    temp_file = tempfile.NamedTemporaryFile(delete=False, dir=temp_dir, suffix=original_suffix)
    temp_path = temp_file.name
    temp_file.close()

    try:
        # Save uploaded file
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

        # If it's HEIC, convert to JPG
        if is_heic:
            converted_path = tempfile.NamedTemporaryFile(delete=False, dir=temp_dir, suffix=".jpg").name
            if convert_heic_to_jpg(temp_path, converted_path):
                # Clean up original and return converted path
                os.remove(temp_path)
                return converted_path
            else:
                # If conversion failed, try to process original
                print("HEIC conversion failed, trying original file")
                return temp_path
        else:
            return temp_path

    except Exception as e:
        # Clean up on error
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise e


@app.get("/")
def read_root():
    return {
        "message": "Image Classification API is running!",
        "status": "ok",
        "task1_loaded": task1 is not None,
        "task2_loaded": task2 is not None,
        "supported_formats": ["JPG", "PNG", "WEBP", "GIF", "BMP", "TIFF", "HEIC", "HEIF"]
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "task1_status": "loaded" if task1 is not None else "failed",
        "task2_status": "loaded" if task2 is not None else "failed",
        "heic_support": True
    }


@app.post("/api/task1/classify")

async def classify_image(image: UploadFile = File(...)):
    print("running")
    if task1 is None:
        raise HTTPException(status_code=500, detail="Task1 model not loaded. Check server logs.")

    if not image.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    valid_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.heic', '.heif', '.avif']
    is_valid_image = (
        (image.content_type and image.content_type.startswith('image/')) or
        any(image.filename.lower().endswith(ext) for ext in valid_extensions)
    )
    if not is_valid_image:
        raise HTTPException(
            status_code=400,
            detail=f"File must be an image. Supported formats: {', '.join(valid_extensions)}"
        )

    temp_dir = tempfile.mkdtemp()
    processed_path = None

    try:
        processed_path = process_image_file(image, temp_dir)

        # Run the heavy prediction in a separate thread
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(executor, task1.predict, processed_path)

        return {"success": True, "data": result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")
    finally:
        if processed_path and os.path.exists(processed_path):
            os.remove(processed_path)
        try:
            os.rmdir(temp_dir)
        except:
            pass

@app.post("/api/task2/search")

async def search_image(image: UploadFile = File(...)):
    if task2 is None:
        raise HTTPException(status_code=500, detail="Task2 model not loaded. Check server logs.")

    # Validate file
    if not image.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Check if it's an image file (expanded validation)
    valid_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.heic', '.heif']
    is_valid_image = (
            (image.content_type and image.content_type.startswith('image/')) or
            any(image.filename.lower().endswith(ext) for ext in valid_extensions)
    )

    if not is_valid_image:
        raise HTTPException(
            status_code=400,
            detail=f"File must be an image. Supported formats: {', '.join(valid_extensions)}"
        )

    # Create temporary directory
    temp_dir = tempfile.mkdtemp()
    processed_path = None

    try:
        print(f"Processing image for search: {image.filename} ({image.content_type})")

        # Process the image (convert HEIC if needed)
        processed_path = process_image_file(image, temp_dir)

        print(f"Image processed, running search on: {processed_path}")
        result = task2.search(processed_path)
        print(f"Search result: Found {len(result.get('results', []))} similar images")

        return {"success": True, "data": result}

    except Exception as e:
        print(f"Search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
    finally:
        # Clean up temp files
        if processed_path and os.path.exists(processed_path):
            os.remove(processed_path)
        # Clean up temp directory
        try:
            os.rmdir(temp_dir)
        except:
            pass


if __name__ == "__main__":
    import uvicorn

    print("Starting server with HEIC support...")
    print("Make sure the following files exist:")
    print("- models/deit_shopnotshop1.pth")
    print("- data/shop_index.faiss")
    print("- data/image_paths.pkl")
    print("- data/embed2img_idx.npy")
    print("\nSupported formats: JPG, PNG, WEBP, GIF, BMP, TIFF, HEIC, HEIF")
    uvicorn.run(app, host="127.0.0.1", port=8000)