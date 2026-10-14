"""Parser tests using small sample pages shaped like UQ's.

Run from the Trajectory folder:  python -m pytest backend/tests
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import course_profiles as cp  # noqa: E402

COURSE_PAGE = """
<html><body>
<h2>Current course offerings</h2>
<table>
  <tr><th>Course offerings</th><th>Location</th><th>Mode</th><th>Course Profile</th></tr>
  <tr><td>Semester 2, 2026</td><td>St Lucia</td><td>In Person</td>
      <td><a href="https://course-profiles.uq.edu.au/course-profiles/MECH2210-20602-7620">Course Profile</a></td></tr>
  <tr><td>Semester 2, 2026</td><td>External</td><td>External</td>
      <td><a href="//course-profiles.uq.edu.au/course-profiles/MECH2210-20602-7630">Course Profile</a></td></tr>
</table>
<h2>Archived offerings</h2>
<table>
  <tr><td>Semester 2, 2025</td><td>St Lucia</td><td>In Person</td>
      <td><a href="https://course-profiles.uq.edu.au/course-profiles/MECH2210-20502-7620">Course Profile</a></td></tr>
  <tr><td>Semester 1, 2025</td><td>St Lucia</td><td>In Person</td><td>Profile unavailable</td></tr>
</table>
</body></html>
"""

PROFILE_PAGE = """
<html><body>
<h2 id="assessment">Assessment</h2>
<h3>Assessment summary</h3>
<table>
  <thead><tr><th>Assessment task</th><th>Category</th><th>Weight</th><th>Due date</th></tr></thead>
  <tbody>
    <tr><td>Practical 3 Pre-work</td><td>Practical/ Demonstration</td><td>5%</td><td>16/10/2026 5:00 pm</td></tr>
    <tr><td>Weekly Online Quizzes</td><td>Quiz</td><td>19%</td><td>Weeks 2 - 12</td></tr>
    <tr><td>Hurdle lab</td><td>Practical</td><td>Pass/Fail</td><td>Fri 23 Oct 2026 16:00</td></tr>
    <tr><td>Final Exam</td><td>Examination</td><td>76%</td><td>End of Semester Exam Period</td></tr>
  </tbody>
</table>
</body></html>
"""


def test_offerings_found_in_page_order():
    offerings = cp.parse_offerings(COURSE_PAGE)
    assert [o.label for o in offerings] == ["Semester 2, 2026", "Semester 2, 2026", "Semester 2, 2025"]
    assert offerings[1].profile_url.startswith("https://")  # protocol-relative link fixed
    assert offerings[0].location == "St Lucia"


def test_pick_offering_by_semester_and_location():
    offerings = cp.parse_offerings(COURSE_PAGE)
    assert cp.pick_offering(offerings).profile_url.endswith("7620")
    assert cp.pick_offering(offerings, "sem 2 2025").label == "Semester 2, 2025"
    assert cp.pick_offering(offerings, "Semester 2, 2026", "external").profile_url.endswith("7630")
    with pytest.raises(cp.CourseProfileError):
        cp.pick_offering(offerings, "Semester 1, 2025")


def test_parse_assessments():
    items = cp.parse_assessments(PROFILE_PAGE)
    assert [a.name for a in items] == ["Practical 3 Pre-work", "Weekly Online Quizzes", "Hurdle lab", "Final Exam"]
    assert items[0].weight == 5.0
    assert items[0].due_at == "2026-10-16T17:00:00+10:00"
    assert items[1].due_at is None and items[1].due_raw == "Weeks 2 - 12"
    assert items[2].weight is None and items[2].due_at == "2026-10-23T16:00:00+10:00"
    assert items[3].category == "Examination"


def test_missing_table_raises():
    with pytest.raises(cp.CourseProfileError):
        cp.parse_assessments("<html><body><p>Profile not published</p></body></html>")


def test_bad_course_code():
    with pytest.raises(cp.CourseProfileError):
        cp.normalise_code("not a code")
    assert cp.normalise_code(" mech 2210 ") == "MECH2210"


def test_weight_warning():
    items = cp.parse_assessments(PROFILE_PAGE)
    total = sum(a.weight for a in items if a.weight is not None)
    assert total == 100
    assert not any("add up" in w for w in cp._warnings(items, total))
