"""Read GoodNotes notebooks from its auto-backup folder.

GoodNotes can't be read directly (its .goodnotes files are a private format),
but its Auto-Backup setting writes every notebook as a PDF to Google Drive,
Dropbox or OneDrive. On Windows those sync to a normal folder, e.g.
    C:\\Users\\<you>\\OneDrive\\Apps\\GoodNotes 5\\GoodNotes
This module walks that folder, renders each page to an image, and hashes it so
only pages that actually changed get sent to the AI (which keeps costs down).

Handwriting in a GoodNotes PDF is vector ink with no text layer, so reading it
needs a vision model; typed text boxes do come through as text and are passed
along as a hint.
"""

from __future__ import annotations

import hashlib
import io
import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Iterator

import pypdfium2 as pdfium

# UQ-style course codes: four letters + four digits, e.g. STAT2201, MECH2100
COURSE_CODE_RE = re.compile(r"\b([A-Z]{4})[\s_-]?(\d{4})\b", re.IGNORECASE)

# Rendering scales (1.0 = 72 dpi)
HASH_SCALE = 0.4      # tiny render, only for spotting changes
READ_SCALE = 2.0      # ~144 dpi, enough for handwriting
MAX_LONG_SIDE = 1568  # vision models downscale beyond this anyway
BLANK_INK = 0.002     # below this share of dark pixels a page counts as blank


@dataclass
class Notebook:
    path: Path
    name: str                 # path relative to the backup folder
    course_code: str | None
    modified: date


@dataclass
class Page:
    notebook: Notebook
    index: int
    page_hash: str
    text_hint: str            # any typed text on the page
    ink: float                # share of non-white pixels; ~0 means a blank page

    @property
    def is_blank(self) -> bool:
        return self.ink < BLANK_INK and not self.text_hint


def course_code_from(text: str) -> str | None:
    """Pull a course code out of a notebook or folder name."""
    match = COURSE_CODE_RE.search(text)
    return f"{match.group(1)}{match.group(2)}".upper() if match else None


def find_notebooks(folder: Path) -> list[Notebook]:
    """Every PDF in the backup folder (recursively), newest first.

    The course code is taken from the file name, or from a parent folder name
    if you keep one GoodNotes folder per course.
    """
    folder = Path(folder)
    if not folder.is_dir():
        raise FileNotFoundError(f"GoodNotes backup folder not found: {folder}")

    notebooks = []
    for pdf in folder.rglob("*.pdf"):
        rel = pdf.relative_to(folder)
        code = course_code_from(pdf.stem)
        if code is None:
            for parent in rel.parents:
                code = course_code_from(parent.name)
                if code:
                    break
        modified = datetime.fromtimestamp(pdf.stat().st_mtime).date()
        notebooks.append(Notebook(pdf, rel.as_posix(), code, modified))
    notebooks.sort(key=lambda n: n.modified, reverse=True)
    return notebooks


def _render(page: pdfium.PdfPage, scale: float):
    bitmap = page.render(scale=scale, grayscale=True)
    return bitmap.to_pil()


def iter_pages(notebook: Notebook) -> Iterator[Page]:
    """Hash every page of a notebook. Cheap: renders at low resolution."""
    pdf = pdfium.PdfDocument(str(notebook.path))
    try:
        for i in range(len(pdf)):
            page = pdf[i]
            img = _render(page, HASH_SCALE)
            raw = img.tobytes()
            page_hash = hashlib.sha256(raw).hexdigest()[:32]
            ink = sum(1 for b in raw if b < 128) / max(len(raw), 1)  # ignores light ruled/grid paper
            text = page.get_textpage().get_text_bounded().strip()
            yield Page(notebook, i, page_hash, text[:2000], ink)
    finally:
        pdf.close()


def render_page_png(notebook: Notebook, index: int) -> bytes:
    """Render one page at reading resolution as PNG bytes."""
    pdf = pdfium.PdfDocument(str(notebook.path))
    try:
        img = _render(pdf[index], READ_SCALE)
    finally:
        pdf.close()
    long_side = max(img.size)
    if long_side > MAX_LONG_SIDE:
        ratio = MAX_LONG_SIDE / long_side
        img = img.resize((round(img.width * ratio), round(img.height * ratio)))
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
