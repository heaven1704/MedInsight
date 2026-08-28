"""
MedInsight OCR microservice.

POST /extract/  — upload a file, return raw OCR text.
No field extraction, classification, or patient matching.
"""

from __future__ import annotations

import io
import logging
import re
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

logger = logging.getLogger("ai-service")
logging.basicConfig(level=logging.INFO)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_PDF_PAGES = 5
ALLOWED_SUFFIXES = {".pdf", ".jpg", ".jpeg", ".png"}

_ocr = None


def parse_structured_fields(text: str) -> dict:
    """Extract a small, reviewable set of fields using deterministic rules."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    result = {
        "extracted_name": None,
        "extracted_date": None,
        "extracted_age": None,
        "extracted_medicines": [],
        "extracted_amount": None,
    }

    for index, line in enumerate(lines):
        name_match = re.match(r"(?:patient\s*)?(?:name)\s*[:#-]\s*(.+)$", line, re.I)
        if name_match:
            result["extracted_name"] = name_match.group(1).strip()
        if result["extracted_name"] is None and re.search(r"patient\s*[:#-]", line, re.I):
            result["extracted_name"] = re.split(r"[:#-]", line, maxsplit=1)[1].strip()

        date_match = re.search(r"\b(\d{1,4}[-/]\d{1,2}[-/]\d{1,4})\b", line)
        if date_match and result["extracted_date"] is None:
            raw_date = date_match.group(1).replace("/", "-")
            parts = raw_date.split("-")
            if len(parts[0]) == 4:
                result["extracted_date"] = raw_date
            else:
                result["extracted_date"] = f"{parts[2]}-{int(parts[1]):02d}-{int(parts[0]):02d}"

        age_match = re.search(r"(?:age|yrs?|years?\s*old)\s*[:#-]?\s*(\d{1,3})", line, re.I)
        if age_match:
            result["extracted_age"] = int(age_match.group(1))

        amount_match = re.search(r"(?:total|amount|grand\s*total)\s*[:#-]?\s*(?:₹|rs\.?|\$)?\s*([\d,]+(?:\.\d{1,2})?)", line, re.I)
        if amount_match:
            result["extracted_amount"] = float(amount_match.group(1).replace(",", ""))

        medicine_match = re.match(r"(?:[-*]\s*)?([A-Za-z][A-Za-z0-9 /+.-]{1,60}?)\s+(\d+(?:\.\d+)?\s*(?:mg|ml|mcg|g|tablet[s]?|capsule[s]?)\b.*)$", line, re.I)
        if medicine_match and not re.search(r"(?:total|amount|age|date|patient|name)", line, re.I):
            result["extracted_medicines"].append({
                "name": medicine_match.group(1).strip(" :-"),
                "dose": medicine_match.group(2).strip(),
            })

    return result


def get_ocr():
    """Load PaddleOCR once and reuse it across requests."""
    global _ocr
    if _ocr is None:
        from paddleocr import PaddleOCR

        try:
            _ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        except TypeError:
            # PaddleOCR 3.x dropped some 2.x constructor kwargs
            _ocr = PaddleOCR(lang="en")
        logger.info("PaddleOCR engine ready")
    return _ocr


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        get_ocr()
    except Exception:
        logger.exception("OCR engine failed to start; /extract/ will retry on first request")
    yield


app = FastAPI(title="MedInsight AI Service", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok", "ocr_ready": _ocr is not None}


def _pil_pages_from_upload(filename: str, data: bytes) -> list[Image.Image]:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        import pypdfium2 as pdfium

        pdf = pdfium.PdfDocument(data)
        pages: list[Image.Image] = []
        for i in range(min(len(pdf), MAX_PDF_PAGES)):
            pages.append(pdf[i].render(scale=2).to_pil().convert("RGB"))
        return pages

    image = Image.open(io.BytesIO(data)).convert("RGB")
    return [image]


def _lines_from_result(result) -> list[str]:
    """Normalize PaddleOCR 2.x nested lists and 3.x dict/result objects into lines."""
    lines: list[str] = []
    if result is None:
        return lines

    if isinstance(result, dict):
        texts = result.get("rec_texts") or result.get("texts") or []
        return [str(t) for t in texts if t]

    rec_texts = getattr(result, "rec_texts", None)
    if rec_texts is not None:
        return [str(t) for t in rec_texts if t]

    if not isinstance(result, (list, tuple)):
        text = str(result).strip()
        return [text] if text else []

    for item in result:
        if item is None:
            continue
        if isinstance(item, dict) or hasattr(item, "rec_texts"):
            lines.extend(_lines_from_result(item))
            continue
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            text_info = item[1]
            if isinstance(text_info, str):
                lines.append(text_info)
                continue
            if isinstance(text_info, (list, tuple)) and text_info and isinstance(text_info[0], str):
                lines.append(text_info[0])
                continue
        lines.extend(_lines_from_result(item))
    return lines


def _ocr_image(image: Image.Image) -> str:
    engine = get_ocr()
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_path = tmp.name
        image.save(tmp_path, format="PNG")

    try:
        if hasattr(engine, "ocr"):
            try:
                raw = engine.ocr(tmp_path, cls=True)
            except TypeError:
                raw = engine.ocr(tmp_path)
        else:
            raw = engine.predict(tmp_path)
        return "\n".join(_lines_from_result(raw)).strip()
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@app.post("/extract/")
async def extract(file: UploadFile = File(...)):
    filename = file.filename or "upload.bin"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, JPG, or PNG.")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File is too large. Maximum size is 10MB.")

    try:
        pages = _pil_pages_from_upload(filename, data)
        chunks = [_ocr_image(page) for page in pages]
        text = "\n\n".join(chunk for chunk in chunks if chunk)
        return JSONResponse({"text": text, **parse_structured_fields(text)})
    except HTTPException:
        raise
    except Exception:
        logger.exception("OCR failed for %s", filename)
        raise HTTPException(status_code=503, detail="OCR unavailable, try again")
