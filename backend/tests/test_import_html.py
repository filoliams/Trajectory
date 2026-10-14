"""Tests for /import-html: the app sends a course profile page it opened itself.

Run from the backend folder:  python -m pytest
"""

import os

import pytest
from fastapi.testclient import TestClient

# main.py needs these to start; the tests never touch the database.
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SECRET_KEY", "sb_secret_test")

from main import app  # noqa: E402
from tests.test_uq_import import PROFILE_URL, SAMPLE_PROFILE  # noqa: E402

client = TestClient(app)


def post(**overrides):
    body = {"code": "stat2201", "url": PROFILE_URL, "html": SAMPLE_PROFILE, **overrides}
    return client.post("/import-html", json=body)


def test_imports_profile_page():
    resp = post()
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == "STAT2201"
    assert data["semester_start"] == "2026-07-27"
    names = [a["name"] for a in data["assessments"]]
    assert "Problem Set" in names
    assert any(a["is_hurdle"] for a in data["assessments"])


def test_rejects_non_profile_page():
    resp = post(url="https://programs-courses.uq.edu.au/course.html?course_code=STAT2201")
    assert resp.status_code == 422
    assert "isn't a UQ course profile" in resp.json()["detail"]


def test_rejects_wrong_course():
    resp = post(code="MATH2010")
    assert resp.status_code == 422
    assert "not MATH2010" in resp.json()["detail"]


@pytest.mark.parametrize("html", ["<html><body><p>Sign in</p></body></html>"])
def test_page_without_table(html):
    resp = post(html=html)
    assert resp.status_code == 422
