"""Read GoodNotes notebooks from the command line.

    python backend/read_goodnotes.py                  # sync once into Supabase
    python backend/read_goodnotes.py --watch          # keep watching the folder
    python backend/read_goodnotes.py --dry-run        # read + analyse, print results, save nothing
    python backend/read_goodnotes.py --dry-run --folder "C:/Users/liam/OneDrive/Goodnotes/ENGG1100"

The server (uvicorn) also syncs automatically in the background; this script is
for trying it out and for running the reader on its own.
"""

import argparse
import json
import logging
import os
import sys
import time
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from notes.ai import NotesAI  # noqa: E402
from notes.config import load_settings  # noqa: E402
from notes.pipeline import sync_goodnotes  # noqa: E402
from notes.store import MemoryStore, SupabaseStore  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Read and analyse GoodNotes notebooks.")
    parser.add_argument("--folder", help="Override GOODNOTES_DIR for this run")
    parser.add_argument("--dry-run", action="store_true", help="Don't save to Supabase; print the analysis")
    parser.add_argument("--watch", action="store_true", help="Keep re-scanning every NOTES_POLL_SECONDS")
    parser.add_argument("--force", action="store_true", help="Re-read notebooks even if unchanged")
    parser.add_argument("--vision", choices=["auto", "always", "never"], help="Override NOTES_VISION_MODE")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    settings = load_settings()
    root = Path(args.folder).expanduser() if args.folder else settings.goodnotes_dir
    if root is None:
        sys.exit("Set GOODNOTES_DIR in .env or pass --folder")

    ai = NotesAI(settings.anthropic_api_key, settings.transcribe_model, settings.analysis_model)
    if args.dry_run:
        store = MemoryStore()
    else:
        from supabase import create_client

        store = SupabaseStore(
            create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SECRET_KEY"]), settings.user_id
        )

    while True:
        report = sync_goodnotes(settings, store, ai, root=root, force=args.force, vision_mode=args.vision)
        print(json.dumps(asdict(report), indent=2))
        if args.dry_run:
            for doc in store.list_documents("goodnotes"):
                analysis = store.latest_analysis(doc["id"])
                print(f"\n=== {doc['relative_path']}  [{doc.get('course_code') or '?'}]")
                print(json.dumps(analysis["analysis"] if analysis else None, indent=2, ensure_ascii=False))
        if not args.watch:
            break
        time.sleep(settings.poll_seconds)


if __name__ == "__main__":
    main()
