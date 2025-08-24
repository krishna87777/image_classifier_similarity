# test_server.py - Create this as a separate file to test
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/")
def read_root():
    return {"message": "Hello World"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    print("Server will be available at:")
    print("  http://127.0.0.1:8000/")
    print("  http://localhost:8000/")
    uvicorn.run(app, host="0.0.0.0", port=8000)