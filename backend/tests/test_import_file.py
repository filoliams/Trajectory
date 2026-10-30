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


# Trimmed from a real MATH2010 Assessment tab printed to PDF: the browser's header and footer
# land mid-text, and a two-column layout puts the previous task's description between the
# exam's name and its "Mode" line.
HEADER = "10/30/26, 2:44 PM MATH2010-61978-7660 - Course profiles - The University of Queensland"
FOOTER = "https://course-profiles.uq.edu.au/course-profiles/MATH2010-61978-7660#{tab} {page}/11"
MATH2010_ASSESSMENT = [
    "UQ home Course profiles MATH2010-61978-7660",
    "COURSE PROFILE",
    "Analysis of Ordinary Differential",
    "Equations (MATH2010)",
    "Study period:Sem 2 2026 Location:St Lucia Attendance mode:In Person",
    HEADER, FOOTER.format(tab="assessment", page=1),
    "Assessment details",
    "2 Assignments",
    "Mode Written",
    "Category Tutorial/ Problem Set",
    "Weight 40% equally weighted",
    "Due date Assignment 1 21/08/2026 1:00 pm",
    "Assignment 2 11/09/2026 1:00 pm",
    "Task description",
    "regardless of approved extensions.",
    "End of semester Exam",
    "The assignments will be comprised of problems derived from the lectures and applied class",
    "equally weighted.",
    HEADER, FOOTER.format(tab="assessment", page=3),
    "Mode Written",
    "Category Examination",
    "Weight 60%",
    "Due date End of Semester Exam Period",
    "7/11/2026 - 21/11/2026",
    "Other conditions Secure.",
    "Course grading",
]

# Trimmed from the real MATH2010 Learning activities tab: only classes that run over several weeks.
ACTIVITIES_HEAD = ["UQ home Course profiles MATH2010-61978-7660", "COURSE PROFILE", "Analysis of Ordinary Differential",
                   "Equations (MATH2010)", HEADER, FOOTER.format(tab="learning-activities", page=1),
                   "Learning", "period", "Activity", "type", "Topic"]
MULTI_WEEK_ROWS = [
    "Multiple", "weeks", "From", "Week 1 To", "Week 6",
    "Lecture ODEs and Laplace transform", "3 Lectures a week. Lectures will be on campus.",
    "Learning outcomes: L01, L02, L03, L04, L05",
    "Multiple", "weeks", "From", "Week 2 To", "Week 7",
    "Applied", "Class", "Problem Solving", "One Applied Class per week (from Week 2).",
    "Learning outcomes: L01, L02, L03, L04, L05",
]
# Weekly rows in the same layout (a week with two activities, a wrapped activity type).
WEEKLY_ROWS = [
    "Week 1", "(27 Jul - 02 Aug)", "Lecture Systems of linear ODEs", "Eigenvalue method.", "Learning outcomes: L01",
    "Applied", "Class", "Systems of linear ODEs", "Learning outcomes: L01",
    "Week 2", "Lecture Phase plane analysis", "Learning outcomes: L01, L02",
]


def pdf_text(monkeypatch, lines):
    monkeypatch.setattr(uq_import, "_pdf_lines", lambda data: lines)


def test_pdf_print_marks_and_two_columns(monkeypatch):
    pdf_text(monkeypatch, MATH2010_ASSESSMENT)
    resp = upload(b"%PDF-1.7 ...", "Math2010 assessment.pdf")
    assert resp.status_code == 200
    got = [(a["name"], a["weight"], a["is_hurdle"]) for a in resp.json()["assessments"]]
    assert got == [("2 Assignments (1)", 20.0, False), ("2 Assignments (2)", 20.0, False), ("End of semester Exam", 60.0, False)]
    assert resp.json()["tab"] == "assessment"


def test_topics_from_learning_activities_pdf(monkeypatch):
    pdf_text(monkeypatch, ACTIVITIES_HEAD + MULTI_WEEK_ROWS + WEEKLY_ROWS)
    resp = upload(b"%PDF-1.7 ...", "MATH2010.pdf", want="topics")
    assert resp.status_code == 200
    data = resp.json()
    assert [(t["name"], t["week"]) for t in data["topics"]] == [("Systems of linear ODEs", "Week 1"), ("Phase plane analysis", "Week 2")]
    assert data["code"] == "MATH2010"
    # From Add course, the same file brings topics and no assessments (the app keeps the course's own).
    resp = upload(b"%PDF-1.7 ...", "MATH2010.pdf")
    assert resp.status_code == 200 and resp.json()["assessments"] == []


def test_profile_without_weekly_topics(monkeypatch):
    pdf_text(monkeypatch, ACTIVITIES_HEAD + MULTI_WEEK_ROWS)
    resp = upload(b"%PDF-1.7 ...", "MATH2010.pdf", want="topics")
    assert resp.status_code == 422
    assert "don't list weekly topics" in resp.json()["detail"]
    resp = upload(b"%PDF-1.7 ...", "MATH2010.pdf")
    assert resp.status_code == 422
    assert "Assessment tab" in resp.json()["detail"]


def test_topics_wanted_from_the_wrong_tab(monkeypatch):
    pdf_text(monkeypatch, MATH2010_ASSESSMENT)
    resp = upload(b"%PDF-1.7 ...", "Math2010 assessment.pdf", want="topics")
    assert resp.status_code == 422
    assert resp.json()["detail"].startswith("This is the Assessment tab. Open the Learning activities tab")
    pdf_text(monkeypatch, ["UQ home Course profiles MATH2010-61978-7660", "COURSE PROFILE", "Learning outcomes",
                           HEADER, FOOTER.format(tab="aim-and-outcomes", page=1)])
    resp = upload(b"%PDF-1.7 ...", "aims.pdf")
    assert resp.status_code == 422
    assert resp.json()["detail"].startswith("This is the Aims and outcomes tab. Open the Assessment tab")


def test_saved_page_of_learning_activities_only():
    from tests.test_uq_import import LEARNING_ACTIVITIES

    page = f"<html><nav>Course profiles STAT2201-99999-7660</nav><h1>STAT2201</h1>{LEARNING_ACTIVITIES}</html>"
    resp = upload(page.encode(), "STAT2201.html", want="topics")
    assert resp.status_code == 200
    assert [t["name"] for t in resp.json()["topics"]] == ["Visualising and summarising data", "Random variables"]


def test_want_must_be_known():
    assert upload(b"%PDF-1.7", "x.pdf", want="everything").status_code == 422
