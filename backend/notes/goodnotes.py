"""Find GoodNotes notebooks in the Auto Backup folder.

GoodNotes (iPad/iPhone) can back every notebook up automatically to Google
Drive, OneDrive, Dropbox or WebDAV, mirroring the folders you use in the app:

    Goodnotes/
        ENGG1100/
            Week 3 Lecture.pdf
        MATH1051 Calculus/
            Tutorial 2.pdf

With that folder synced to this PC, this module lists the notebooks and works
out which course each belongs to from its folder names.
"""

import hashlib
import re
import time
from dataclasses import dataclass
from pathlib import Path

# UQ-style course codes: four letters + four digits, e.g. ENGG1100, CSSE2002.
COURSE_CODE = re.compile(r"\b([A-Z]{4})[\s_-]?(\d{4})\b", re.IGNORECASE)

# Files still being written by the sync client are skipped until they've been
# untouched for this long, so we don't read half-downloaded PDFs.
SETTLE_SECONDS = 30

IGNORED_PREFIXES = ("~$", ".~", "._")


@dataclass(frozen=True)
class NotebookFile:
    path: Path
    relative_path: str  # e.g. "ENGG1100/Week 3 Lecture.pdf" (forward slashes)
    title: str  # file name without extension
    folder: str | None  # top-level GoodNotes folder, if any
    course_code: str | None  # e.g. "ENGG1100", if found in the path
    size: int
    modified: float
    settled: bool  # False while the sync client may still be writing it


def guess_course_code(relative_path: str) -> str | None:
    """Find a course code in the folder names first, then the file name."""
    for part in relative_path.split("/"):
        match = COURSE_CODE.search(part)
        if match:
            return (match.group(1) + match.group(2)).upper()
    return None


def scan(root: Path, now: float | None = None) -> list[NotebookFile]:
    """List every PDF notebook under the backup folder."""
    if not root.is_dir():
        raise FileNotFoundError(f"GoodNotes folder not found: {root}")

    now = time.time() if now is None else now
    notebooks: list[NotebookFile] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() != ".pdf":
            continue  # .goodnotes files are a proprietary format; we read the PDFs
        if path.name.startswith(IGNORED_PREFIXES):
            continue
        stat = path.stat()

        rel = path.relative_to(root).as_posix()
        parts = rel.split("/")
        notebooks.append(
            NotebookFile(
                path=path,
                relative_path=rel,
                title=path.stem,
                folder=parts[0] if len(parts) > 1 else None,
                course_code=guess_course_code(rel),
                size=stat.st_size,
                modified=stat.st_mtime,
                settled=now - stat.st_mtime >= SETTLE_SECONDS,
            )
        )
    return notebooks


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()
