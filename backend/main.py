from pathlib import Path
from uuid import uuid4

import pymupdf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Project directories
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Fiddle")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["POST"],
)
app.mount("/files", StaticFiles(directory=UPLOAD_DIR), name="files")

MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB

@app.get("/")
def home():
    return {
        "message": "Welcome to Fiddle!"
    }

@app.post("/upload")
async def upload_sheet_music(file: UploadFile = File(...)):
    # Check file extension
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    # Read uploaded file
    pdf_bytes = await file.read()

    # Check file size
    if len(pdf_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File must be smaller than 15 MB.")

    # Check PDF signature
    if not pdf_bytes.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF.")

    # Open PDF
    try:
        document = pymupdf.open(stream=pdf_bytes, filetype="pdf")

        if document.page_count == 0:
            raise HTTPException(status_code=400, detail="The PDF contains no pages.")

        # Generate unique filename
        file_id = str(uuid4())

        # Save original PDF
        pdf_path = UPLOAD_DIR / f"{file_id}.pdf"
        pdf_path.write_bytes(pdf_bytes)

        # Convert first page into an image
        first_page = document[0]
        image = first_page.get_pixmap(matrix=pymupdf.Matrix(2, 2))

        image_path = UPLOAD_DIR / f"{file_id}.png"
        image.save(image_path)

        page_count = document.page_count
        document.close()

        return {
            "message": "Sheet music uploaded successfully!",
            "file_id": file_id,
            "page_count": page_count,
            "preview_url": f"/files/{file_id}.png"
        }

    except pymupdf.FileDataError:
        raise HTTPException(status_code=400, detail="Unable to read this PDF.")
