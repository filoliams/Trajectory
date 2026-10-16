"""Where page readings and footprints are kept.

LocalStore   a JSON file, for running the scanner on your PC with no database
SupabaseStore the real thing, one row per page / topic per user
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Protocol

from .models import CourseFootprint, PageRecord


class NotesStore(Protocol):
    def page_hash(self, notebook: str, index: int) -> str | None: ...
    def save_page(self, record: PageRecord) -> None: ...
    def prune_notebook(self, notebook: str, page_count: int) -> None: ...
    def pages(self, course_code: str | None = None) -> list[PageRecord]: ...
    def known_topics(self, course_code: str | None) -> list[str]: ...
    def syllabus_topics(self, course_code: str) -> list[str]: ...
    def save_footprint(self, footprint: CourseFootprint) -> None: ...


def _topics_from(records: list[PageRecord]) -> list[str]:
    seen: dict[str, str] = {}
    for r in records:
        for ev in r.reading.topics:
            seen.setdefault(ev.topic.lower(), ev.topic)
    return sorted(seen.values())


class LocalStore:
    def __init__(self, path: Path, syllabus: dict[str, list[str]] | None = None):
        self.path = Path(path)
        self.syllabus = syllabus or {}
        self.data = {"pages": {}, "footprints": {}}
        if self.path.exists():
            self.data = json.loads(self.path.read_text(encoding="utf-8"))

    def _key(self, notebook: str, index: int) -> str:
        return f"{notebook}#{index}"

    def _flush(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, indent=1, default=str), encoding="utf-8")

    def page_hash(self, notebook, index):
        rec = self.data["pages"].get(self._key(notebook, index))
        return rec["page_hash"] if rec else None

    def save_page(self, record):
        self.data["pages"][self._key(record.notebook, record.page_index)] = record.model_dump(mode="json")
        self._flush()

    def prune_notebook(self, notebook, page_count):
        prefix = f"{notebook}#"
        for key in [k for k in self.data["pages"] if k.startswith(prefix)]:
            if int(key[len(prefix):]) >= page_count:
                del self.data["pages"][key]
        self._flush()

    def pages(self, course_code=None):
        records = [PageRecord.model_validate(v) for v in self.data["pages"].values()]
        return [r for r in records if course_code is None or r.course_code == course_code]

    def known_topics(self, course_code):
        names = set(self.syllabus.get(course_code or "", []))
        return sorted(names | set(_topics_from(self.pages(course_code)))) if course_code else []

    def syllabus_topics(self, course_code):
        return self.syllabus.get(course_code, [])

    def save_footprint(self, footprint):
        self.data["footprints"][footprint.course_code] = footprint.model_dump(mode="json")
        self._flush()


class SupabaseStore:
    """Per-user storage in Supabase. Tables are created by the migration in
    supabase/migrations/*_notes_footprint.sql."""

    def __init__(self, client, user_id: str, source: str = "goodnotes"):
        self.db = client
        self.user_id = user_id
        self.source = source

    def _pages_q(self):
        return self.db.table("note_pages").select("*").eq("user_id", self.user_id)

    def page_hash(self, notebook, index):
        rows = (self._pages_q().eq("source", self.source).eq("notebook", notebook)
                .eq("page_index", index).limit(1).execute().data)
        return rows[0]["page_hash"] if rows else None

    def save_page(self, record):
        self.db.table("note_pages").upsert({
            "user_id": self.user_id, "source": self.source,
            "notebook": record.notebook, "page_index": record.page_index,
            "page_hash": record.page_hash, "course_code": record.course_code,
            "seen_on": record.seen_on.isoformat(),
            "reading": record.reading.model_dump(mode="json"),
        }, on_conflict="user_id,source,notebook,page_index").execute()

    def prune_notebook(self, notebook, page_count):
        (self.db.table("note_pages").delete().eq("user_id", self.user_id)
         .eq("source", self.source).eq("notebook", notebook)
         .gte("page_index", page_count).execute())

    def pages(self, course_code=None):
        q = self._pages_q()
        if course_code:
            q = q.eq("course_code", course_code)
        return [PageRecord(notebook=r["notebook"], page_index=r["page_index"],
                           page_hash=r["page_hash"], course_code=r["course_code"],
                           seen_on=r["seen_on"], reading=r["reading"])
                for r in q.execute().data]

    def syllabus_topics(self, course_code):
        rows = (self.db.table("course_topics").select("name").eq("user_id", self.user_id)
                .eq("course_code", course_code).execute().data)
        return [r["name"] for r in rows]

    def known_topics(self, course_code):
        if not course_code:
            return []
        return sorted(set(self.syllabus_topics(course_code)) | set(_topics_from(self.pages(course_code))))

    def save_footprint(self, fp):
        self.db.table("course_footprints").upsert({
            "user_id": self.user_id, "course_code": fp.course_code, "level": fp.level.value,
            "score": fp.score, "summary": fp.summary,
            "weakness_multiplier": fp.weakness_multiplier,
        }, on_conflict="user_id,course_code").execute()
        (self.db.table("topic_footprints").delete().eq("user_id", self.user_id)
         .eq("course_code", fp.course_code).execute())
        if fp.topics:
            self.db.table("topic_footprints").insert([
                {"user_id": self.user_id, **t.model_dump(mode="json"),
                 "level": t.level.value} for t in fp.topics
            ]).execute()
