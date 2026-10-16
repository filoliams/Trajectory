"""Where note data is saved: Supabase in the app, an in-memory store for tests."""

import uuid
from datetime import datetime, timezone
from typing import Any, Protocol


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class NotesStore(Protocol):
    def list_documents(self, source: str) -> list[dict]: ...
    def upsert_document(self, source: str, relative_path: str, fields: dict) -> dict: ...
    def update_document(self, document_id: str, fields: dict) -> None: ...
    def get_pages(self, document_id: str) -> dict[int, dict]: ...
    def save_pages(self, document_id: str, pages: list[dict], page_count: int) -> None: ...
    def add_analysis(self, row: dict) -> None: ...
    def latest_analysis(self, document_id: str) -> dict | None: ...


class SupabaseStore:
    def __init__(self, client: Any, user_id: str | None = None):
        self.db = client
        self.user_id = user_id

    def _docs(self):
        query = self.db.table("note_documents").select("*")
        return query.eq("user_id", self.user_id) if self.user_id else query.is_("user_id", "null")

    def list_documents(self, source: str) -> list[dict]:
        return self._docs().eq("source", source).order("relative_path").execute().data

    def upsert_document(self, source: str, relative_path: str, fields: dict) -> dict:
        row = {**fields, "user_id": self.user_id, "source": source,
               "relative_path": relative_path, "updated_at": now_iso()}
        return (
            self.db.table("note_documents")
            .upsert(row, on_conflict="user_id,source,relative_path")
            .execute()
            .data[0]
        )

    def update_document(self, document_id: str, fields: dict) -> None:
        self.db.table("note_documents").update({**fields, "updated_at": now_iso()}).eq("id", document_id).execute()

    def get_pages(self, document_id: str) -> dict[int, dict]:
        rows = self.db.table("note_pages").select("*").eq("document_id", document_id).execute().data
        return {row["page_number"]: row for row in rows}

    def save_pages(self, document_id: str, pages: list[dict], page_count: int) -> None:
        if pages:
            rows = [{**p, "document_id": document_id} for p in pages]
            self.db.table("note_pages").upsert(rows, on_conflict="document_id,page_number").execute()
        # Pages deleted in GoodNotes
        self.db.table("note_pages").delete().eq("document_id", document_id).gt("page_number", page_count).execute()

    def add_analysis(self, row: dict) -> None:
        self.db.table("note_analyses").insert(row).execute()

    def latest_analysis(self, document_id: str) -> dict | None:
        rows = (
            self.db.table("note_analyses").select("*").eq("document_id", document_id)
            .order("created_at", desc=True).limit(1).execute().data
        )
        return rows[0] if rows else None


class MemoryStore:
    """Same interface, kept in a dict. Used by tests and `--dry-run`."""

    def __init__(self):
        self.documents: dict[str, dict] = {}
        self.pages: dict[str, dict[int, dict]] = {}
        self.analyses: list[dict] = []

    def list_documents(self, source: str) -> list[dict]:
        return sorted((d for d in self.documents.values() if d["source"] == source),
                      key=lambda d: d["relative_path"])

    def upsert_document(self, source: str, relative_path: str, fields: dict) -> dict:
        for doc in self.documents.values():
            if doc["source"] == source and doc["relative_path"] == relative_path:
                doc.update(fields)
                return doc
        doc = {"id": str(uuid.uuid4()), "source": source, "relative_path": relative_path,
               "status": "pending", **fields}
        self.documents[doc["id"]] = doc
        return doc

    def update_document(self, document_id: str, fields: dict) -> None:
        self.documents[document_id].update(fields)

    def get_pages(self, document_id: str) -> dict[int, dict]:
        return dict(self.pages.get(document_id, {}))

    def save_pages(self, document_id: str, pages: list[dict], page_count: int) -> None:
        current = self.pages.setdefault(document_id, {})
        for page in pages:
            current[page["page_number"]] = {**page, "document_id": document_id}
        for number in [n for n in current if n > page_count]:
            del current[number]

    def add_analysis(self, row: dict) -> None:
        self.analyses.append({**row, "created_at": now_iso()})

    def latest_analysis(self, document_id: str) -> dict | None:
        rows = [a for a in self.analyses if a["document_id"] == document_id]
        return rows[-1] if rows else None
