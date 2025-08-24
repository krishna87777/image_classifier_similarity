import numpy as np
import pickle
import faiss
from PIL import Image
import torch
from transformers import CLIPProcessor, CLIPModel
import os
import re
from paddleocr import PaddleOCR


class SimilaritySearch:
    def __init__(self, index_path, img_paths_path, emb2img_path):
        # Check if all files exist
        for path in [index_path, img_paths_path, emb2img_path]:
            if not os.path.exists(path):
                raise FileNotFoundError(f"Required file not found: {path}")

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {self.device}")

        try:
            self.model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(self.device)
            self.processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

            self.index = faiss.read_index(index_path)

            with open(img_paths_path, "rb") as f:
                self.image_paths = pickle.load(f)

            self.embed2img_idx = np.load(emb2img_path)

            print(f"Loaded index with {self.index.ntotal} embeddings")
            print(f"Loaded {len(self.image_paths)} image paths")

        except Exception as e:
            raise RuntimeError(f"Failed to initialize similarity search: {e}")

    def _get_embedding(self, img):
        try:
            inputs = self.processor(images=[img], return_tensors="pt").to(self.device)
            with torch.no_grad():
                emb = self.model.get_image_features(**inputs)
                emb = torch.nn.functional.normalize(emb, p=2, dim=1)
            return emb.cpu().numpy().astype("float32")
        except Exception as e:
            raise RuntimeError(f"Failed to get embedding: {e}")

    def extract_shop_names(self, image_path):
        """Extract shop names using PaddleOCR and regex"""
        try:
            if not hasattr(self, 'ocr_model'):
                self.ocr_model = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)

            results = self.ocr_model.ocr(image_path)

            if not results or not results[0]:
                return []

            # Extract all text
            all_text = []
            for line in results[0]:
                text = line[1][0]
                all_text.append(text)

            # Join all text and apply regex patterns
            full_text = ' '.join(all_text)

            patterns = [
                r'\b[A-Z][a-z]+ (?:Shop|Store|Market|Cafe|Restaurant|Bar|Deli|Bakery)\b',
                r'\b(?:Shop|Store|Market|Cafe|Restaurant|Bar|Deli|Bakery) [A-Z][a-z]+\b',
                r'\b[A-Z]{2,}(?:\s+[A-Z]+)*\b',  # All caps words
                r'\b[A-Z][a-zA-Z]*\s+(?:SHOP|STORE|MARKET|CAFE|RESTAURANT|BAR)\b',
            ]

            found_names = []
            for pattern in patterns:
                matches = re.findall(pattern, full_text, re.IGNORECASE)
                found_names.extend(matches)

            # Remove duplicates and return unique names
            return list(set(found_names))

        except Exception as e:
            print(f"OCR extraction failed: {e}")
            return []

    def search(self, image_path, top_k=5, threshold=0.85):
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")

        try:
            img = Image.open(image_path).convert("RGB")
            q_emb = self._get_embedding(img)

            # Ensure we don't request more than available
            actual_k = min(top_k, self.index.ntotal)
            sims, idxs = self.index.search(q_emb, actual_k)
            sims, idxs = sims[0], idxs[0]

            results = []
            for i, (sim, idx) in enumerate(zip(sims, idxs)):
                if idx == -1:  # faiss returns -1 for invalid indices
                    continue

                if idx >= len(self.embed2img_idx):
                    print(f"Warning: Index {idx} out of bounds for embed2img_idx")
                    continue

                orig_img_idx = int(self.embed2img_idx[idx])

                if orig_img_idx >= len(self.image_paths):
                    print(f"Warning: Image index {orig_img_idx} out of bounds")
                    continue

                results.append({
                    "rank": i + 1,
                    "similarity": float(sim),
                    "image": self.image_paths[orig_img_idx]
                })

            if not results:
                return {
                    "exists": False,
                    "threshold": threshold,
                    "best_similarity": 0.0,
                    "results": []
                }

            best_sim = results[0]["similarity"]
            exists = best_sim >= threshold

            result = {
                "exists": exists,
                "threshold": threshold,
                "best_similarity": best_sim,
                "results": results
            }

            # Add OCR if shop is detected
            if exists:
                shop_names = self.extract_shop_names(image_path)
                result["shop_names"] = shop_names
            else:
                result["shop_names"] = []

            return result

        except Exception as e:
            raise RuntimeError(f"Search failed: {e}")

