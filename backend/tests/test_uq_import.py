"""Tests for the UQ course profile importer, using a saved sample page.

Run from the backend folder:  python -m pytest
"""

import httpx
import pytest

from uq_import import ImportFailed, import_course, parse_profile, term_code

PROFILE_URL = "https://course-profiles.uq.edu.au/course-profiles/STAT2201-99999-7660"

SAMPLE_PROFILE = """
<html><body>
<h1>STAT2201 Analysis of Engineering and Scientific Data</h1>
<p>Semester 2, 2026 (27/07/2026 - 21/11/2026)</p>
<section id="assessment">
  <h2>Assessment</h2>
  <h3>Assessment summary</h3>
  <table>
    <thead><tr><th>Category</th><th>Assessment task</th><th>Weight</th><th>Due date</th></tr></thead>
    <tbody>
      <tr>
        <td>Participation/ Student contribution, Quiz</td>
        <td><a href="#assessment-detail-0">Online Quizzes</a></td>
        <td>7.5%</td>
        <td><p>16/10/2026 4:00 pm<br>23/10/2026 4:00 pm<br>30/10/2026 4:00 pm</p>
            <p>Individual questions are due by 4:00pm Fridays.</p></td>
      </tr>
      <tr>
        <td>Computer Code, Tutorial/ Problem Set</td>
        <td><a href="#assessment-detail-1">Problem Set</a></td>
        <td>25%</td>
        <td>26/10/2026 4:00 pm</td>
      </tr>
      <tr>
        <td>Practical/ Demonstration</td>
        <td>Lab Report</td>
        <td>10%</td>
        <td>Week 9</td>
      </tr>
      <tr>
        <td>Examination</td>
        <td><a href="#assessment-detail-2">End of Semester Examination</a>
            <span>Hurdle</span><span>Identity Verified</span><span>In-person</span></td>
        <td>60%</td>
        <td>End of Semester Exam Period<br>7/11/2026 - 21/11/2026</td>
      </tr>
    </tbody>
  </table>
</section>
</body></html>
"""

COURSE_PAGE = """
<html><body><table>
<tr><td>Semester 1, 2026</td><td><a href="https://course-profiles.uq.edu.au/course-profiles/STAT2201-11111-7620">Course Profile</a></td></tr>
<tr><td>Semester 2, 2026</td><td><a href="https://course-profiles.uq.edu.au/course-profiles/STAT2201-99999-7660">Course Profile</a></td></tr>
</table></body></html>
"""


def test_term_codes():
    assert term_code(2026, 1) == "7620"
    assert term_code(2026, 2) == "7660"
    assert term_code(2025, 2) == "7560"


def test_parse_profile():
    course = parse_profile(SAMPLE_PROFILE, PROFILE_URL)
    assert course.code == "STAT2201"
    assert course.semester_start == "2026-07-27"
    names = [a.name for a in course.assessments]
    assert names == [
        "Online Quizzes (1)", "Online Quizzes (2)", "Online Quizzes (3)",
        "Problem Set", "Lab Report", "End of Semester Examination",
    ]

    quiz = course.assessments[0]
    assert quiz.weight == 2.5
    assert quiz.due == "2026-10-16T16:00:00+10:00"
    assert quiz.type == "quiz"
    assert not quiz.needs_review

    ps = course.assessments[3]
    assert ps.weight == 25
    assert ps.due == "2026-10-26T16:00:00+10:00"

    lab = course.assessments[4]
    assert lab.needs_review
    assert lab.due == "2026-09-25T16:00:00+10:00"  # Friday of week 9

    exam = course.assessments[5]
    assert exam.type == "exam"
    assert exam.is_hurdle
    assert exam.needs_review
    assert exam.due == "2026-11-07T09:00:00+10:00"
    assert sum(a.weight for a in course.assessments) == pytest.approx(102.5)


def _client() -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        if "programs-courses" in str(request.url):
            return httpx.Response(200, text=COURSE_PAGE)
        if "STAT2201-99999-7660" in str(request.url):
            return httpx.Response(200, text=SAMPLE_PROFILE)
        return httpx.Response(404)
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_import_finds_semester_2_profile():
    course = import_course("stat2201", 2026, 2, client=_client())
    assert course.profile_url.endswith("-7660")
    assert len(course.assessments) == 6


def test_import_rejects_bad_code():
    with pytest.raises(ImportFailed):
        import_course("STAT22", 2026, 2, client=_client())


def test_import_missing_semester():
    with pytest.raises(ImportFailed, match="No Semester 1, 2025"):
        import_course("STAT2201", 2025, 1, client=_client())


def test_profile_without_table():
    with pytest.raises(ImportFailed):
        parse_profile("<html><h1>Nothing</h1></html>", PROFILE_URL)


# What a browser gives you when you copy the table: one cell per line.
PASTED_LINES = """Category	Assessment task	Weight	Due date
Participation/ Student contribution, Quiz
Online Quizzes
15%
24/04/2026 4:00 pm
1/05/2026 4:00 pm
8/05/2026 4:00 pm
Individual questions are due by 4:00pm Fridays.
Computer Code, Tutorial/ Problem Set
Problem Set
25%
25/05/2026 4:00 pm
Examination
End of Semester Examination
Hurdle
Identity Verified
In-person
60%
End of Semester Exam Period
6/06/2026 - 20/06/2026
"""

# Same table copied as tab-separated rows (cells with line breaks spill onto following lines).
PASTED_TABS = (
    "Category\tAssessment task\tWeight\tDue date\n"
    "Participation/ Student contribution, Quiz\tOnline Quizzes\t15%\t24/04/2026 4:00 pm\n"
    "1/05/2026 4:00 pm\n"
    "8/05/2026 4:00 pm\n"
    "Computer Code, Tutorial/ Problem Set\tProblem Set\t25%\t25/05/2026 4:00 pm\n"
    "Examination\tEnd of Semester ExaminationHurdleIdentity VerifiedIn-person\t60%\tEnd of Semester Exam Period\n"
    "6/06/2026 - 20/06/2026\n"
)


@pytest.mark.parametrize("text", [PASTED_LINES, PASTED_TABS])
def test_parse_pasted_table(text):
    from uq_import import parse_pasted_table
    course = parse_pasted_table(text, "STAT2201")
    names = [a.name for a in course.assessments]
    assert names == ["Online Quizzes (1)", "Online Quizzes (2)", "Online Quizzes (3)",
                     "Problem Set", "End of Semester Examination"]
    assert course.assessments[0].weight == 5
    assert course.assessments[0].due == "2026-04-24T16:00:00+10:00"
    assert course.assessments[3].due == "2026-05-25T16:00:00+10:00"
    exam = course.assessments[4]
    assert exam.type == "exam" and exam.is_hurdle and exam.needs_review
    assert exam.due == "2026-06-06T09:00:00+10:00"


def test_pasted_garbage():
    from uq_import import parse_pasted_table
    with pytest.raises(ImportFailed):
        parse_pasted_table("hello world", "STAT2201")
