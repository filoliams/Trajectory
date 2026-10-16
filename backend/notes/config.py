"""Settings for the notes reader, read from the Trajectory .env file."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=ENV_PATH)


@dataclass(frozen=True)
class NotesSettings:
    # Folder GoodNotes Auto Backup writes into, synced to this PC
    # (e.g. C:\Users\liam\OneDrive\Goodnotes).
    goodnotes_dir: Path | None
    # Claude API key + models. Transcription reads handwriting from page images;
    # analysis turns the transcript into topics / confidence.
    anthropic_api_key: str | None
    transcribe_model: str
    analysis_model: str
    # Pages with fewer characters than this in the PDF text layer are treated as
    # handwritten and sent to the vision model.
    min_text_chars: int
    # "auto": vision only for handwritten pages; "always": every page; "never": text layer only.
    vision_mode: str
    # Render scale for handwriting pages (1.0 = 72 dpi). 2.0 is ~144 dpi,
    # enough for handwriting without huge images.
    render_scale: float
    # Max page images per transcription request.
    pages_per_request: int
    # How often the watcher re-scans the folder.
    poll_seconds: int
    # Supabase auth user these notes belong to (optional until auth exists).
    user_id: str | None


def load_settings() -> NotesSettings:
    folder = os.getenv("GOODNOTES_DIR")
    return NotesSettings(
        goodnotes_dir=Path(folder).expanduser() if folder else None,
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY") or os.getenv("AI_API_KEY"),
        transcribe_model=os.getenv("NOTES_TRANSCRIBE_MODEL", "claude-sonnet-5-5"),
        analysis_model=os.getenv("NOTES_ANALYSIS_MODEL", "claude-sonnet-5-5"),
        min_text_chars=int(os.getenv("NOTES_MIN_TEXT_CHARS", "40")),
        vision_mode=os.getenv("NOTES_VISION_MODE", "auto"),
        render_scale=float(os.getenv("NOTES_RENDER_SCALE", "2.0")),
        pages_per_request=int(os.getenv("NOTES_PAGES_PER_REQUEST", "8")),
        poll_seconds=int(os.getenv("NOTES_POLL_SECONDS", "300")),
        user_id=os.getenv("NOTES_USER_ID") or None,
    )
