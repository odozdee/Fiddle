import logging
import uuid
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

import pymupdf
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from backend.score_processor import NoMusicXML, process_score
from backend.teach import generate_practice_tips

logger = logging.getLogger(__name__)

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

@app.post("/analyze/{file_id}")
def analyze_score(file_id: str):
    # Validate the file ID
    try:
        pdf_id = str(uuid.UUID(file_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    pdf_path = UPLOAD_DIR / f"{pdf_id}.pdf"

    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF not found")

    output_dir = Path("output") / pdf_id

    try:
        movements = process_score(pdf_path, output_dir)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "file_id": pdf_id,
        "movements": movements
    }

@app.post("/practice-tips/{file_id}")
def practice_tips(file_id: str):
    try:
        pdf_id = str(uuid.UUID(file_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    pdf_path = UPLOAD_DIR / f"{pdf_id}.pdf"

    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF not found")

    output_dir = Path("output") / pdf_id

    try:
        movements = process_score(pdf_path, output_dir)
        tips = generate_practice_tips(movements)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Practice analysis failed: {e}")

    return {
        "file_id": pdf_id,
        "practice_tips": tips
    }

def score_pdf_path(file_id):
    try:
        pdf_id = str(uuid.UUID(file_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file ID")
    path = UPLOAD_DIR / f"{pdf_id}.pdf"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="PDF not found")
    return path

def page_index(document, page_number):
    if not 1 <= page_number <= document.page_count:
        raise HTTPException(status_code=404, detail="Page not found")
    return page_number - 1

@app.get("/scores/{file_id}/pages/{page_number}/preview")
def page_preview(file_id: str, page_number: int):
    with pymupdf.open(score_pdf_path(file_id)) as document:
        page = document[page_index(document, page_number)]
        preview = page.get_pixmap(dpi=144).tobytes("png")
    return Response(preview, media_type="image/png")

@app.post("/scores/{file_id}/pages/{page_number}/practice-tips")
def page_practice_tips(file_id: str, page_number: int):
    with TemporaryDirectory() as directory:
        page_pdf = Path(directory) / "page.pdf"
        with pymupdf.open(score_pdf_path(file_id)) as document:
            index = page_index(document, page_number)
            page = document[index]
            zoom = min(2.0, 1568 / max(page.rect.width, page.rect.height))
            image = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom)).tobytes("jpeg", jpg_quality=60)
            with pymupdf.open() as single_page:
                single_page.insert_pdf(document, from_page=index, to_page=index)
                single_page.save(page_pdf)

        warning = ""
        try:
            try:
                movements = process_score(page_pdf, Path(directory) / "output")
            except NoMusicXML:
                movements = []
                warning = "Audiveris found no readable notation. Tips use the page image alone."
            if any(
                measure["overlapping_voices"]
                for movement in movements
                for measure in movement["measures"]
            ):
                warning = "Audiveris found overlapping voices. Compare those passages with the original notation."
            tips = generate_practice_tips(movements, page_image=image, page_number=page_number)
        except Exception as error:
            logger.exception("Could not analyze PDF page %s", page_number)
            raise HTTPException(status_code=500, detail="Page analysis failed") from error

    return {"page_number": page_number, "practice_tips": tips, "warning": warning}
