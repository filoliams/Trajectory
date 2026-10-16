"""FastAPI routes for the notes reader, plus the background auto-sync loop."""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import asdict

from fastapi import APIRouter, BackgroundTasks, HTTPException

from .ai import NotesAI
from .config import load_settings
from .pipeline import SOURCE, sync_goodnotes
from .store import SupabaseStore

log = logging.getLogger("trajectory.notes")


def build_router(supabase_client) -> tuple[APIRouter, Callable[[], Awaitable[None]]]:
    settings = load_settings()
    store = SupabaseStore(supabase_client, settings.user_id)
    router = APIRouter(prefix="/notes", tags=["notes"])
    _ai: list[NotesAI] = []

    def ai() -> NotesAI:
        if not _ai:
            _ai.append(NotesAI(settings.anthropic_api_key, settings.transcribe_model, settings.analysis_model))
        return _ai[0]

    def run_sync(force: bool = False) -> dict:
        report = sync_goodnotes(settings, store, ai(), force=force)
        return asdict(report)

    @router.post("/goodnotes/sync")
    def sync_now(background: BackgroundTasks, force: bool = False, wait: bool = False):
        """Re-scan the GoodNotes folder. `wait=true` returns the report when done."""
        if settings.goodnotes_dir is None:
            raise HTTPException(400, "Set GOODNOTES_DIR in .env to your GoodNotes backup folder.")
        if wait:
            return run_sync(force)
        background.add_task(run_sync, force)
        return {"started": True}

    @router.get("")
    def list_notes():
        docs = store.list_documents(SOURCE)
        return [
            {k: d.get(k) for k in ("id", "title", "relative_path", "course_code", "page_count",
                                    "status", "error", "last_synced_at")}
            for d in docs
        ]

    @router.get("/{document_id}")
    def get_note(document_id: str):
        docs = [d for d in store.list_documents(SOURCE) if d["id"] == document_id]
        if not docs:
            raise HTTPException(404, "Note not found")
        pages = store.get_pages(document_id)
        return {
            "document": docs[0],
            "analysis": store.latest_analysis(document_id),
            "pages": [pages[n] for n in sorted(pages)],
        }

    async def auto_sync_loop():
        """Runs while the server is up: checks the folder every NOTES_POLL_SECONDS."""
        if settings.goodnotes_dir is None:
            log.warning("GOODNOTES_DIR not set - GoodNotes auto-sync is off")
            return
        log.info("GoodNotes auto-sync watching %s every %ss", settings.goodnotes_dir, settings.poll_seconds)
        while True:
            try:
                report = await asyncio.to_thread(run_sync)
                if report["processed"] or report["failed"]:
                    log.info("GoodNotes sync: %s", report)
            except Exception:
                log.exception("GoodNotes auto-sync failed")
            await asyncio.sleep(settings.poll_seconds)

    return router, auto_sync_loop
