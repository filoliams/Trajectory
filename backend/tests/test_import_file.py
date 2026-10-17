"""Tests for /import-file: the user uploads a course profile they downloaded.

Run from the backend folder:  python -m pytest
"""

import os

from fastapi.testclient import TestClient

# main.py needs these to start; the tests never touch the database.
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SECRET_KEY", "sb_secret_test")

import uq_import  # noqa: E402
from main import app  # noqa: E402
from tests.test_uq_import import SAMPLE_PROFILE  # noqa: E402

client = TestClient(app)

# A saved page carries its own address, e.g. in the breadcrumb.
SAVED_PAGE = SAMPLE_PROFILE.replace("<h1>", "<nav>Course profiles STAT2201-99999-7660</nav><h1>")

# Text of a profile's Assessment tab printed to PDF, laid out as pypdf reads it
# (modelled on real UQ profiles: wrapped names, a date pushed down by a two-column layout).
PDF_LINES = """UQ home Course profiles MECH2100-60781-7660
COURSE PROFILE
Machine Element Design (MECH2100)
Assessment summary
Category Assessment
task
Weight Due date
Assessment details
Assignment 1 Structural Modelling and Failure Prediction
(Submission #1)
Mode Written
Category Tutorial/ Problem Set
Weight 15%
Due date 24/08/2026 12:00 pm
Other conditions Student specific.
Task description
Late submission
A penalty of 10% of the maximum possible mark will be deducted per 24 hours.
Assignment 2 Transmission System Design (Submissions #2
and #3)
Mode Product/ Artefact/ Multimedia, Written
Category Product/ Design, Project
Weight 20%
Due date Submission #2 14/09/2026 12:00 pm
Submission #3 6/10/2026 12:00 pm
Learning
outcomes L01, L02
Task description
Online quizzes
Mode Activity/ Performance
Category Quiz
Weight 10%
Due date 14/09/2026 - 18/09/2026
21/09/2026 - 25/09/2026
Task description
Final Exam
Mode Written
Category Examination
Weight 55%
Due date End of Semester Exam Period
code. They must also refrain from copying code from the internet.
Hurdle
Read full task description
7/11/2026 - 21/11/2026
Other conditions Secure.
Task description
Course grading
Hurdle
""".splitlines()


def upload(content: bytes, name: str, **form):
    return client.post("/import-file", files={"file": (name, content)}, data=form)


def test_saved_html_page():
    resp = upload(SAVED_PAGE.encode(), "STAT2201 course profile.html", year="2026", semester="2")
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == "STAT2201"
    assert data["profile_url"].endswith("STAT2201-99999-7660")
    assert "Problem Set" in [a["name"] for a in data["assessments"]]


def test_wrong_semester_is_turned_away():
    resp = upload(SAVED_PAGE.encode(), "profile.html", year="2026", semester="1")
    assert resp.status_code == 422
    assert "Semester 2, 2026" in resp.json()["detail"]
    assert "Semester 1, 2026" in resp.json()["detail"]


def test_not_a_profile():
    resp = upload(b"hello", "notes.txt")
    assert resp.status_code == 422
    assert "PDF" in resp.json()["detail"]


def test_pdf(monkeypatch):
    monkeypatch.setattr(uq_import, "_pdf_lines", lambda data: PDF_LINES)
    resp = upload(b"%PDF-1.7 ...", "MECH2100.pdf", year="2026", semester="2")
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == "MECH2100"
    assert data["title"] == "Machine Element Design (MECH2100)"
    got = [(a["name"], a["weight"], a["due"], a["is_hurdle"]) for a in data["assessments"]]
    assert got == [
        ("Assignment 1 Structural Modelling and Failure Prediction (Submission #1)", 15.0, "2026-08-24T12:00:00+10:00", False),
        ("Assignment 2 Transmission System Design (Submissions #2 and #3) (1)", 10.0, "2026-09-14T12:00:00+10:00", False),
        ("Assignment 2 Transmission System Design (Submissions #2 and #3) (2)", 10.0, "2026-10-06T12:00:00+10:00", False),
        # A date window is one task due at the end of the window.
        ("Online quizzes (1)", 5.0, "2026-09-18T23:59:00+10:00", False),
        ("Online quizzes (2)", 5.0, "2026-09-25T23:59:00+10:00", False),
        ("Final Exam", 55.0, "2026-11-07T09:00:00+10:00", True),
    ]


def test_pdf_of_the_wrong_tab(monkeypatch):
    lines = ["UQ home Course profiles MECH2100-60781-7660", "COURSE PROFILE", "Course overview"]
    monkeypatch.setattr(uq_import, "_pdf_lines", lambda data: lines)
    resp = upload(b"%PDF-1.7 ...", "MECH2100.pdf")
    assert resp.status_code == 422
    assert "Assessment tab" in resp.json()["detail"]
