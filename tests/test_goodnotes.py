"""Tests for the GoodNotes reader, using generated PDFs and a fake Claude client."""

import os
import sys
import time
from pathlib import Path
from types import SimpleNamespace

import pytest
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from notes import extract, goodnotes  # noqa: E402
from notes.ai import NotesAI  # noqa: E402
from notes.config import NotesSettings  # noqa: E402
from notes.pipeline import sync_goodnotes  # noqa: E402
from notes.store import MemoryStore  # noqa: E402

OLD = time.time() - 3600  # files "synced" an hour ago


def typed_page(c):
    c.drawString(72, 760, "Lecture 3: Kirchhoff's voltage law. The sum of voltages around a loop is zero.")
    c.showPage()


def handwritten_page(c, wiggle=0):
    # GoodNotes ink is flattened to vector paths with no text layer.
    for i in range(40):
        y = 700 - i * 12
        p = c.beginPath()
        p.moveTo(72, y)
        p.curveTo(120, y + 5 + wiggle, 160, y - 5, 200 + i, y)
        c.drawPath(p)
    c.showPage()


def blank_page(c):
    c.showPage()


def make_pdf(path: Path, pages, mtime=OLD):
    path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(path), pagesize=A4)
    for page in pages:
        page(c)
    c.save()
    os.utime(path, (mtime, mtime))


class FakeMessages:
    def __init__(self):
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        tool = kwargs["tool_choice"]["name"]
        if tool == "record_transcriptions":
            numbers = [int(b["text"].split()[1].rstrip(".")) for b in kwargs["messages"][0]["content"]
                       if b["type"] == "text" and b["text"].startswith("Page ")]
            data = {"pages": [{"page": n, "blank": False, "text": f"KVL: sum V = 0 (page {n}) [marked ?]"}
                              for n in numbers]}
        else:
            data = {
                "course_code": "ENGG1300",
                "summary": "KVL notes.",
                "note_type": "lecture",
                "topics": [{"name": "Kirchhoff's laws", "depth": "practised", "confidence": 60, "evidence": "p2"}],
                "overall_confidence": 60,
                "certainty": "medium",
                "struggle_points": ["sign convention p2"],
                "gaps": [],
                "completeness": "partial",
            }
        block = SimpleNamespace(type="tool_use", name=tool, input=data)
        return SimpleNamespace(content=[block], stop_reason="tool_use")


@pytest.fixture
def env(tmp_path):
    fake = FakeMessages()
    ai = NotesAI(None, "test-model", "test-model", client=SimpleNamespace(messages=fake))
    settings = NotesSettings(
        goodnotes_dir=tmp_path, anthropic_api_key=None, transcribe_model="test-model",
        analysis_model="test-model", min_text_chars=40, vision_mode="auto", render_scale=1.0,
        pages_per_request=8, poll_seconds=1, user_id=None,
    )
    return SimpleNamespace(root=tmp_path, fake=fake, ai=ai, settings=settings, store=MemoryStore())


def transcribe_calls(fake):
    return [c for c in fake.calls if c["tool_choice"]["name"] == "record_transcriptions"]


def test_course_code_from_folder():
    assert goodnotes.guess_course_code("ENGG1100 Intro/Week 3.pdf") == "ENGG1100"
    assert goodnotes.guess_course_code("Semester 2/csse-2002/Lecture.pdf") == "CSSE2002"
    assert goodnotes.guess_course_code("Random/Shopping list.pdf") is None


def test_extract_detects_handwriting(tmp_path):
    pdf = tmp_path / "n.pdf"
    make_pdf(pdf, [typed_page, handwritten_page, blank_page])
    pages = extract.extract_pages(pdf)
    assert [p.needs_vision for p in pages] == [False, True, False]
    assert "Kirchhoff" in pages[0].text_layer
    images = extract.render_pages(pdf, [2], scale=0.5)
    assert images[2].startswith(b"\x89PNG")


def test_sync_reads_new_then_skips_unchanged(env):
    make_pdf(env.root / "ENGG1300" / "Week 3.pdf", [typed_page, handwritten_page, blank_page])

    report = sync_goodnotes(env.settings, env.store, env.ai)
    assert report.processed == ["ENGG1300/Week 3.pdf"]
    assert report.pages_transcribed == 1

    doc = env.store.list_documents("goodnotes")[0]
    assert doc["status"] == "ready" and doc["course_code"] == "ENGG1300" and doc["page_count"] == 3
    pages = env.store.get_pages(doc["id"])
    assert pages[1]["handwriting"] is None
    assert "KVL" in pages[2]["handwriting"]
    assert env.store.latest_analysis(doc["id"])["overall_confidence"] == 60

    # Analysis prompt contains both printed and handwritten text
    analysis_prompt = env.fake.calls[-1]["messages"][0]["content"]
    assert "[Printed]" in analysis_prompt and "[Handwritten]" in analysis_prompt

    calls_before = len(env.fake.calls)
    report = sync_goodnotes(env.settings, env.store, env.ai)
    assert report.unchanged == 1 and not report.processed
    assert len(env.fake.calls) == calls_before  # no AI calls for unchanged notebooks


def test_only_changed_pages_are_retranscribed(env):
    path = env.root / "MATH1051" / "Tute.pdf"
    make_pdf(path, [handwritten_page, handwritten_page])
    sync_goodnotes(env.settings, env.store, env.ai)
    assert len(transcribe_calls(env.fake)) == 1

    # Student adds a new handwritten page in GoodNotes
    make_pdf(path, [handwritten_page, handwritten_page, lambda c: handwritten_page(c, wiggle=9)], mtime=OLD + 60)
    report = sync_goodnotes(env.settings, env.store, env.ai)
    assert report.pages_transcribed == 1
    last = transcribe_calls(env.fake)[-1]
    labels = [b["text"] for b in last["messages"][0]["content"] if b["type"] == "text" and b["text"].startswith("Page")]
    assert labels == ["Page 3."]


def test_folder_without_code_uses_ai_guess(env):
    make_pdf(env.root / "Circuits" / "Notes.pdf", [handwritten_page])
    sync_goodnotes(env.settings, env.store, env.ai)
    assert env.store.list_documents("goodnotes")[0]["course_code"] == "ENGG1300"


def test_still_syncing_files_wait_and_deleted_files_marked_missing(env):
    path = env.root / "ENGG1300" / "A.pdf"
    make_pdf(path, [handwritten_page], mtime=time.time())  # just written
    report = sync_goodnotes(env.settings, env.store, env.ai)
    assert report.processed == [] and env.fake.calls == []

    os.utime(path, (OLD, OLD))
    assert sync_goodnotes(env.settings, env.store, env.ai).processed == ["ENGG1300/A.pdf"]

    path.unlink()
    report = sync_goodnotes(env.settings, env.store, env.ai)
    assert report.missing == ["ENGG1300/A.pdf"]
    assert env.store.list_documents("goodnotes")[0]["status"] == "missing"


def test_one_bad_file_does_not_stop_others(env):
    (env.root / "Bad").mkdir()
    bad = env.root / "Bad" / "corrupt.pdf"
    bad.write_bytes(b"not a pdf")
    os.utime(bad, (OLD, OLD))
    make_pdf(env.root / "ENGG1300" / "Good.pdf", [handwritten_page])
    report = sync_goodnotes(env.settings, env.store, env.ai)
    assert report.processed == ["ENGG1300/Good.pdf"]
    assert "Bad/corrupt.pdf" in report.failed
