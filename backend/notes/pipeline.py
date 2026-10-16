"""Scan a GoodNotes backup folder end to end.

Only pages whose image changed since the last scan are sent to the AI, and
blank pages never are, so a re-scan after one lecture costs a handful of
page reads rather than the whole semester.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from . import goodnotes
from .footprint import build_course_footprint
from .models import CourseFootprint, PageReading, PageKind, PageRecord
from .reader import PageReader
from .store import NotesStore


@dataclass
class ScanResult:
    notebooks: int = 0
    pages_seen: int = 0
    pages_read: int = 0
    pages_blank: int = 0
    pages_unchanged: int = 0
    stopped_at_limit: bool = False
    errors: list[str] = field(default_factory=list)
    footprints: list[CourseFootprint] = field(default_factory=list)


def scan_goodnotes(
    folder: Path,
    store: NotesStore,
    reader: PageReader,
    *,
    only_course: str | None = None,
    max_reads: int = 150,
    today: date | None = None,
    progress=print,
) -> ScanResult:
    result = ScanResult()
    touched_courses: set[str] = set()

    for nb in goodnotes.find_notebooks(folder):
        if only_course and nb.course_code and nb.course_code != only_course:
            continue
        result.notebooks += 1
        page_count = 0
        for page in goodnotes.iter_pages(nb):
            page_count += 1
            result.pages_seen += 1
            if store.page_hash(nb.name, page.index) == page.page_hash:
                result.pages_unchanged += 1
                continue

            if page.is_blank:
                reading = PageReading(course_code=nb.course_code, page_kind=PageKind.blank)
                result.pages_blank += 1
            else:
                if result.pages_read >= max_reads:
                    result.stopped_at_limit = True
                    break
                try:
                    png = goodnotes.render_page_png(nb, page.index)
                    reading = reader.read(png, course_code=nb.course_code,
                                          known_topics=store.known_topics(nb.course_code),
                                          text_hint=page.text_hint)
                except Exception as exc:  # one bad page shouldn't stop the scan
                    result.errors.append(f"{nb.name} p{page.index + 1}: {exc}")
                    continue
                result.pages_read += 1
                progress(f"read {nb.name} p{page.index + 1}: "
                         + (", ".join(t.topic for t in reading.topics) or "no topics"))

            code = nb.course_code or (reading.course_code or "").upper() or None
            store.save_page(PageRecord(
                notebook=nb.name, page_index=page.index, page_hash=page.page_hash,
                course_code=code, seen_on=nb.modified, reading=reading,
            ))
            if code:
                touched_courses.add(code)

        if result.stopped_at_limit:
            break
        store.prune_notebook(nb.name, page_count)
        if nb.course_code:
            touched_courses.add(nb.course_code)

    for code in sorted(touched_courses):
        fp = build_course_footprint(code, store.pages(code), store.syllabus_topics(code), today)
        store.save_footprint(fp)
        result.footprints.append(fp)
    return result
