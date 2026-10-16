"""Sync the GoodNotes folder: find new/changed notebooks, read them, analyse them."""

import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from . import extract, goodnotes
from .ai import NotesAI, PageForVision, build_transcript
from .config import NotesSettings
from .store import NotesStore, now_iso

log = logging.getLogger("trajectory.notes")

SOURCE = "goodnotes"
_sync_lock = threading.Lock()


@dataclass
class SyncReport:
    scanned: int = 0
    unchanged: int = 0
    processed: list[str] = field(default_factory=list)
    failed: dict[str, str] = field(default_factory=dict)
    missing: list[str] = field(default_factory=list)
    pages_transcribed: int = 0
    already_running: bool = False


def _iso(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()


def process_notebook(
    notebook: goodnotes.NotebookFile,
    file_hash: str,
    store: NotesStore,
    ai: NotesAI,
    settings: NotesSettings,
    vision_mode: str | None = None,
) -> int:
    """Read one notebook end to end. Returns how many pages were sent for transcription."""
    doc = store.upsert_document(
        SOURCE,
        notebook.relative_path,
        {
            "title": notebook.title,
            "folder": notebook.folder,
            "course_code": notebook.course_code,
            "file_hash": file_hash,
            "file_size": notebook.size,
            "file_modified": _iso(notebook.modified),
            "status": "processing",
            "error": None,
        },
    )
    doc_id = doc["id"]

    pages = extract.extract_pages(
        notebook.path,
        min_text_chars=settings.min_text_chars,
        vision_mode=vision_mode or settings.vision_mode,
    )
    previous = store.get_pages(doc_id)

    # Only pages whose content changed since last time go to the vision model.
    def unchanged(page: extract.PageContent) -> bool:
        old = previous.get(page.number)
        return bool(old) and old["fingerprint"] == page.fingerprint and old.get("handwriting") is not None

    todo = [p for p in pages if p.needs_vision and not unchanged(p)]
    handwriting: dict[int, str] = {}
    location = notebook.relative_path
    for start in range(0, len(todo), settings.pages_per_request):
        batch = todo[start:start + settings.pages_per_request]
        images = extract.render_pages(notebook.path, [p.number for p in batch], settings.render_scale)
        handwriting.update(
            ai.transcribe(
                [PageForVision(p.number, images[p.number], p.text_layer) for p in batch],
                context=location,
            )
        )
        log.info("%s: transcribed pages %s", location, [p.number for p in batch])

    rows = []
    for page in pages:
        if page.needs_vision:
            text = handwriting.get(page.number)
            if text is None and unchanged(page):
                text = previous[page.number]["handwriting"]
            transcribed_at = now_iso() if page.number in handwriting else previous.get(page.number, {}).get("transcribed_at")
        else:
            text, transcribed_at = None, None
        rows.append(
            {
                "page_number": page.number,
                "fingerprint": page.fingerprint,
                "text_layer": page.text_layer,
                "handwriting": text,
                "needs_vision": page.needs_vision,
                "transcribed_at": transcribed_at,
            }
        )
    store.save_pages(doc_id, rows, page_count=len(pages))

    transcript = build_transcript([(r["page_number"], r["text_layer"], r["handwriting"] or "") for r in rows])
    fields = {"page_count": len(pages), "status": "ready", "last_synced_at": now_iso()}

    if transcript.strip():
        analysis = ai.analyse(location=location, course_code=notebook.course_code, transcript=transcript)
        store.add_analysis(
            {
                "document_id": doc_id,
                "file_hash": file_hash,
                "model": ai.analysis_model,
                "course_code": analysis.get("course_code"),
                "summary": analysis.get("summary"),
                "note_type": analysis.get("note_type"),
                "overall_confidence": analysis.get("overall_confidence"),
                "certainty": analysis.get("certainty"),
                "completeness": analysis.get("completeness"),
                "analysis": analysis,
            }
        )
        if not notebook.course_code and analysis.get("course_code"):
            fields["course_code"] = analysis["course_code"].upper()

    store.update_document(doc_id, fields)
    return len(todo)


def sync_goodnotes(
    settings: NotesSettings,
    store: NotesStore,
    ai: NotesAI,
    *,
    root: Path | None = None,
    force: bool = False,
    vision_mode: str | None = None,
) -> SyncReport:
    """Scan the backup folder once and process anything new or changed."""
    report = SyncReport()
    if not _sync_lock.acquire(blocking=False):
        report.already_running = True
        return report
    try:
        root = root or settings.goodnotes_dir
        if root is None:
            raise RuntimeError("GOODNOTES_DIR is not set in .env")

        notebooks = goodnotes.scan(root)
        report.scanned = len(notebooks)
        known = {d["relative_path"]: d for d in store.list_documents(SOURCE)}

        for notebook in notebooks:
            if not notebook.settled:
                report.unchanged += 1  # still syncing; picked up on the next scan
                continue
            existing = known.get(notebook.relative_path)
            # Cheap check first: same size + modified time as last sync means unchanged.
            if (
                not force and existing and existing.get("status") == "ready"
                and existing.get("file_size") == notebook.size
                and existing.get("file_modified") and
                abs(datetime.fromisoformat(existing["file_modified"]).timestamp() - notebook.modified) < 1
            ):
                report.unchanged += 1
                continue

            digest = goodnotes.file_hash(notebook.path)
            if not force and existing and existing.get("status") == "ready" and existing.get("file_hash") == digest:
                # Touched but identical (e.g. re-synced by OneDrive): just record the new timestamp.
                store.update_document(existing["id"], {"file_modified": _iso(notebook.modified)})
                report.unchanged += 1
                continue

            try:
                report.pages_transcribed += process_notebook(notebook, digest, store, ai, settings, vision_mode)
                report.processed.append(notebook.relative_path)
                log.info("Read %s", notebook.relative_path)
            except Exception as exc:  # one bad notebook shouldn't stop the rest
                log.exception("Failed to read %s", notebook.relative_path)
                report.failed[notebook.relative_path] = str(exc)
                doc = store.upsert_document(SOURCE, notebook.relative_path, {"title": notebook.title, "file_hash": digest})
                store.update_document(doc["id"], {"status": "error", "error": str(exc)[:2000]})

        seen = {n.relative_path for n in notebooks}
        for path, doc in known.items():
            if path not in seen and doc.get("status") != "missing":
                store.update_document(doc["id"], {"status": "missing"})
                report.missing.append(path)
        return report
    finally:
        _sync_lock.release()
