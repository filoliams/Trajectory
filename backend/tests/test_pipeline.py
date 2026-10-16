"""End to end: generated GoodNotes-style PDFs, a stand-in AI reader, local store."""

from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw

from notes import goodnotes
from notes.models import ContentDepth, Level, PageReading, TopicEvidence
from notes.pipeline import scan_goodnotes
from notes.store import LocalStore

TODAY = date(2026, 10, 16)


def make_notebook(path: Path, pages: list[str]) -> None:
    """A PDF where each page has some 'ink' (or nothing, for blank pages)."""
    images = []
    for text in pages:
        img = Image.new("RGB", (595, 842), "white")
        if text:
            d = ImageDraw.Draw(img)
            for row in range(12):
                d.text((40, 60 + row * 40), f"{text} line {row}", fill="black")
            d.rectangle((40, 600, 400, 760), outline="black", width=6)
        images.append(img)
    path.parent.mkdir(parents=True, exist_ok=True)
    images[0].save(path, save_all=True, append_images=images[1:])


class FakeReader:
    """Pretends to be the vision model: topic = first word drawn on the page."""

    def __init__(self, script):
        self.script = script
        self.calls = []

    def read(self, png, *, course_code, known_topics, text_hint=""):
        self.calls.append(course_code)
        topic, depth, attempted, correct = self.script[len(self.calls) - 1]
        return PageReading(course_code=course_code, topics=[TopicEvidence(
            topic=topic, depth=depth, practice_attempted=attempted,
            practice_correct=correct)])


def test_course_code_detection(tmp_path):
    make_notebook(tmp_path / "STAT2201 Lectures.pdf", ["a"])
    make_notebook(tmp_path / "MATH 2010" / "Week 3.pdf", ["a"])
    make_notebook(tmp_path / "Misc.pdf", ["a"])
    codes = {nb.name: nb.course_code for nb in goodnotes.find_notebooks(tmp_path)}
    assert codes == {"STAT2201 Lectures.pdf": "STAT2201",
                     "MATH 2010/Week 3.pdf": "MATH2010", "Misc.pdf": None}


def test_scan_reads_only_changed_pages(tmp_path):
    backup = tmp_path / "GoodNotes"
    nb = backup / "STAT2201 Lectures.pdf"
    make_notebook(nb, ["regression", "", "hypothesis"])   # middle page blank
    store = LocalStore(tmp_path / "cache.json")

    reader = FakeReader([
        ("Linear regression", ContentDepth.brief_notes, 0, 0),
        ("Hypothesis testing", ContentDepth.worked_example, 10, 9),
    ])
    r1 = scan_goodnotes(backup, store, reader, today=TODAY, progress=lambda m: None)
    assert (r1.pages_seen, r1.pages_read, r1.pages_blank) == (3, 2, 1)
    assert reader.calls == ["STAT2201", "STAT2201"]

    # Nothing changed: no AI calls at all
    r2 = scan_goodnotes(backup, LocalStore(tmp_path / "cache.json"), reader,
                        today=TODAY, progress=lambda m: None)
    assert (r2.pages_read, r2.pages_unchanged) == (0, 3)

    # Add a page to the notebook: only that page is read
    make_notebook(nb, ["regression", "", "hypothesis", "regression practice"])
    reader.script.append(("Linear regression", ContentDepth.worked_example, 4, 2))
    r3 = scan_goodnotes(backup, store, reader, today=TODAY, progress=lambda m: None)
    assert r3.pages_read == 1 and len(reader.calls) == 3

    fp = r3.footprints[0]
    levels = {t.topic: t.level for t in fp.topics}
    assert levels["Hypothesis testing"] in (Level.strong, Level.okay)
    assert fp.course_code == "STAT2201" and fp.level != Level.none


def test_read_limit_resumes_next_scan(tmp_path):
    backup = tmp_path / "GoodNotes"
    make_notebook(backup / "ELEC2004.pdf", ["a", "b", "c"])
    store = LocalStore(tmp_path / "cache.json")
    script = [("Op-amps", ContentDepth.brief_notes, 0, 0)] * 3
    reader = FakeReader(script)
    r1 = scan_goodnotes(backup, store, reader, max_reads=2, today=TODAY, progress=lambda m: None)
    assert r1.stopped_at_limit and r1.pages_read == 2
    r2 = scan_goodnotes(backup, store, reader, max_reads=2, today=TODAY, progress=lambda m: None)
    assert r2.pages_read == 1 and not r2.stopped_at_limit


def test_render_page_is_png_under_size_cap(tmp_path):
    make_notebook(tmp_path / "STAT2201.pdf", ["x"])
    nb = goodnotes.find_notebooks(tmp_path)[0]
    png = goodnotes.render_page_png(nb, 0)
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    img = Image.open(__import__("io").BytesIO(png))
    assert max(img.size) <= goodnotes.MAX_LONG_SIDE
