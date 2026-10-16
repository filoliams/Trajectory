"""Pull the content out of a GoodNotes PDF, page by page.

GoodNotes PDFs mix two kinds of content:
  * a text layer - typed text boxes and the text of imported lecture slides
  * ink - handwriting and drawings, flattened into vector paths with no text

The text layer we can read directly. Ink has to be read by the vision model, so
pages that are mostly handwriting (little text, or lots of ink strokes on top
of slides) are rendered to PNG for transcription.
"""

import hashlib
import io
from dataclasses import dataclass
from pathlib import Path

import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c

# A page with at least this many vector paths is treated as having handwriting
# on it, even if it also has a text layer (e.g. annotated lecture slides).
INK_PATH_THRESHOLD = 25

# Low-res render used only to fingerprint a page, so we can tell when new ink
# was added without re-sending unchanged pages to the AI.
FINGERPRINT_SCALE = 0.4


@dataclass
class PageContent:
    number: int  # 1-based
    text_layer: str
    ink_paths: int
    fingerprint: str
    needs_vision: bool


def _page_text(page: pdfium.PdfPage) -> str:
    textpage = page.get_textpage()
    try:
        return textpage.get_text_bounded().strip()
    finally:
        textpage.close()


def _count_paths(page: pdfium.PdfPage) -> int:
    return sum(1 for _ in page.get_objects(filter=[pdfium_c.FPDF_PAGEOBJ_PATH], max_depth=3))


def _render_png(page: pdfium.PdfPage, scale: float) -> bytes:
    image = page.render(scale=scale).to_pil().convert("RGB")
    buf = io.BytesIO()
    image.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def extract_pages(
    pdf_path: Path,
    *,
    min_text_chars: int = 40,
    vision_mode: str = "auto",
) -> list[PageContent]:
    """Read every page's text layer and decide which ones need the vision model.

    vision_mode: "auto" (default), "always" (every page) or "never" (text only).
    """
    pdf = pdfium.PdfDocument(str(pdf_path))
    pages: list[PageContent] = []
    try:
        for index in range(len(pdf)):
            page = pdf[index]
            try:
                text = _page_text(page)
                ink = _count_paths(page)
                thumb = page.render(scale=FINGERPRINT_SCALE).to_pil().convert("L").tobytes()
                fingerprint = hashlib.sha256(text.encode() + thumb).hexdigest()

                if not text and ink == 0:
                    needs_vision = False  # completely empty page
                elif vision_mode == "always":
                    needs_vision = True
                elif vision_mode == "never":
                    needs_vision = False
                else:
                    needs_vision = len(text) < min_text_chars or ink >= INK_PATH_THRESHOLD

                pages.append(
                    PageContent(
                        number=index + 1,
                        text_layer=text,
                        ink_paths=ink,
                        fingerprint=fingerprint,
                        needs_vision=needs_vision,
                    )
                )
            finally:
                page.close()
    finally:
        pdf.close()
    return pages


def render_pages(pdf_path: Path, numbers: list[int], scale: float = 2.0) -> dict[int, bytes]:
    """Render just the requested pages (1-based) to PNG for the vision model."""
    pdf = pdfium.PdfDocument(str(pdf_path))
    try:
        images = {}
        for number in numbers:
            page = pdf[number - 1]
            try:
                images[number] = _render_png(page, scale)
            finally:
                page.close()
        return images
    finally:
        pdf.close()


def is_blank(page: PageContent) -> bool:
    """Empty template pages (blank, lined, grid) - nothing worth reading."""
    return not page.text_layer and page.ink_paths == 0
