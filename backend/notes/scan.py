"""Run the GoodNotes scan from the command line, no app or database needed.

From the backend folder:

    # See what's there without calling the AI (free)
    python -m notes.scan "C:\\Users\\liams\\OneDrive\\Apps\\GoodNotes 5\\GoodNotes" --dry-run

    # Read changed pages and print each course's Strong / Okay / Weak topics
    python -m notes.scan "C:\\...\\GoodNotes" --course STAT2201 --max-reads 20

Results are cached in notes_cache.json, so running it again only reads pages
that changed.
"""

from __future__ import annotations

import argparse
import json
import os
from collections import Counter
from pathlib import Path

from dotenv import load_dotenv

from . import goodnotes
from .pipeline import scan_goodnotes
from .reader import ClaudePageReader
from .store import LocalStore

LEVEL_MARK = {"strong": "STRONG", "okay": "okay  ", "weak": "WEAK  ", "none": "-     "}


def main(argv=None) -> None:
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    ap = argparse.ArgumentParser(description="Score your GoodNotes notes by topic")
    ap.add_argument("folder", help="GoodNotes auto-backup folder")
    ap.add_argument("--course", help="only this course code, e.g. STAT2201")
    ap.add_argument("--max-reads", type=int, default=30, help="cap on AI page reads this run")
    ap.add_argument("--cache", default="notes_cache.json")
    ap.add_argument("--syllabus", help="JSON file: {\"STAT2201\": [\"Linear regression\", ...]}")
    ap.add_argument("--dry-run", action="store_true", help="list notebooks and pages, no AI")
    args = ap.parse_args(argv)

    folder = Path(args.folder).expanduser()
    store = LocalStore(Path(args.cache),
                       json.loads(Path(args.syllabus).read_text()) if args.syllabus else None)

    if args.dry_run:
        totals = Counter()
        for nb in goodnotes.find_notebooks(folder):
            if args.course and nb.course_code != args.course:
                continue
            pages = list(goodnotes.iter_pages(nb))
            changed = [p for p in pages if store.page_hash(nb.name, p.index) != p.page_hash]
            to_read = [p for p in changed if not p.is_blank]
            totals.update(pages=len(pages), to_read=len(to_read))
            print(f"{nb.course_code or '????????'}  {nb.name}: {len(pages)} pages, "
                  f"{len(to_read)} would be read (modified {nb.modified})")
        print(f"\n{totals['pages']} pages total, {totals['to_read']} need an AI read.")
        if not os.getenv("AI_API_KEY") and not os.getenv("ANTHROPIC_API_KEY"):
            print("Add AI_API_KEY to your .env before running without --dry-run.")
        return

    result = scan_goodnotes(folder, store, ClaudePageReader(),
                            only_course=args.course, max_reads=args.max_reads)
    print(f"\n{result.pages_read} pages read, {result.pages_unchanged} unchanged, "
          f"{result.pages_blank} blank.")
    if result.stopped_at_limit:
        print(f"Stopped at --max-reads {args.max_reads}; run again to continue.")
    for err in result.errors:
        print("  error:", err)

    for fp in result.footprints:
        print(f"\n{fp.course_code}  {fp.level.value.upper()}  - {fp.summary}"
              f"  (priority x{fp.weakness_multiplier})")
        for t in sorted(fp.topics, key=lambda t: -t.score):
            print(f"  {LEVEL_MARK[t.level.value]} {t.score:.2f}  {t.topic}: {t.evidence}")


if __name__ == "__main__":
    main()
