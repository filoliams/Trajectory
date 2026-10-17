"""Read a UQ course profile and turn its assessment table into assessments.

Flow:
1. Find the profile URL for a course code and semester (from the course's
   programs-courses page), unless the caller already has the URL.
2. Download the profile and read the "Assessment summary" table.
3. Turn each row's due-date text into real dates. Rows with several dates
   (e.g. weekly quizzes) become one assessment per date, with the weighting
   split evenly. Anything vague is flagged `needs_review`.
"""

from __future__ import annotations

import io
import re
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta, timezone

import httpx
from bs4 import BeautifulSoup, Tag

# Queensland has no daylight saving, so a fixed +10:00 is exact (and needs no
# timezone database, which Windows Python doesn't include).
BRISBANE = timezone(timedelta(hours=10))
HEADERS = {"User-Agent": "Trajectory study planner (personal use)"}
COURSE_PAGE = "https://programs-courses.uq.edu.au/course.html?course_code={code}"
PROFILE_LINK = re.compile(
    r"https?://course-profiles\.uq\.edu\.au/course-profiles/([A-Z]{4}\d{4})-(\d+)-(\d{4})"
)

DATE_TIME = re.compile(
    r"(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*([ap]m))?", re.IGNORECASE
)
DATE_RANGE = re.compile(r"(\d{1,2}/\d{1,2}/\d{4})\s*[-–]\s*(\d{1,2}/\d{1,2}/\d{4})")
WEEK = re.compile(r"\bweek\s*(\d{1,2})\b", re.IGNORECASE)
WEIGHT = re.compile(r"(\d+(?:\.\d+)?)\s*%")
BADGES = ("Hurdle", "Identity Verified", "In-person", "Online", "Team or group-based")


class ImportFailed(Exception):
    """Raised with a message that is safe to show the user."""


@dataclass
class ImportedAssessment:
    name: str
    weight: float
    due: str | None  # ISO 8601 with +10:00 offset, or None if unknown
    type: str  # "exam" | "assignment" | "quiz" | "other"
    is_hurdle: bool = False
    needs_review: bool = False
    note: str | None = None
    raw_due_text: str = ""


@dataclass
class ImportedCourse:
    code: str
    title: str | None
    profile_url: str
    semester_start: str | None
    semester_end: str | None
    assessments: list[ImportedAssessment] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


# ---------- finding the profile ----------

def term_code(year: int, semester: int) -> str:
    """UQ term codes: 2026 Semester 1 = 7620, Semester 2 = 7660."""
    if semester not in (1, 2):
        raise ImportFailed("Semester must be 1 or 2.")
    return f"{year - 1950}{'20' if semester == 1 else '60'}"


def find_profile_url(code: str, year: int, semester: int, client: httpx.Client) -> str:
    resp = client.get(COURSE_PAGE.format(code=code))
    if resp.status_code != 200:
        raise ImportFailed(f"Couldn't open the UQ course page for {code}.")
    wanted = term_code(year, semester)
    for match in PROFILE_LINK.finditer(resp.text):
        if match.group(1) == code and match.group(3) == wanted:
            return match.group(0)
    raise ImportFailed(
        f"No Semester {semester}, {year} course profile found for {code}. "
        "Check the code, or paste the profile link instead."
    )


# ---------- parsing ----------

def _parse_date(text: str) -> date | None:
    m = DATE_TIME.search(text)
    if not m:
        return None
    day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return date(year, month, day)


def _all_datetimes(text: str) -> list[datetime]:
    out = []
    for m in DATE_TIME.finditer(text):
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if m.group(4):
            hour = int(m.group(4)) % 12 + (12 if m.group(6).lower() == "pm" else 0)
            minute = int(m.group(5))
        else:
            hour, minute = 23, 59
        out.append(datetime(year, month, day, hour, minute, tzinfo=BRISBANE))
    return out


def _semester_dates(soup: BeautifulSoup) -> tuple[date | None, date | None]:
    """The profile header shows e.g. '(23/02/2026 - 20/06/2026)'."""
    m = DATE_RANGE.search(soup.get_text(" ", strip=True))
    if not m:
        return None, None
    return _parse_date(m.group(1)), _parse_date(m.group(2))


def _cell_lines(cell: Tag) -> list[str]:
    return [line.strip() for line in cell.get_text("\n").split("\n") if line.strip()]


def _clean_name(cell: Tag) -> tuple[str, bool]:
    lines = _cell_lines(cell)
    text = " ".join(lines)
    is_hurdle = "hurdle" in text.lower()
    name = lines[0] if lines else "Assessment"
    # Badges like "Hurdle" sometimes run on the end of the name with no space.
    stripped = True
    while stripped:
        stripped = False
        for badge in BADGES:
            if name.endswith(badge) and name != badge:
                name = name[: -len(badge)].strip()
                stripped = True
    return name or "Assessment", is_hurdle


def _guess_type(category: str, name: str) -> str:
    text = f"{category} {name}".lower()
    if "exam" in text:
        return "exam"
    if "quiz" in text:
        return "quiz"
    if any(w in text for w in ("assignment", "report", "problem set", "project", "homework", "practical", "essay")):
        return "assignment"
    return "other"


def _find_summary_table(soup: BeautifulSoup) -> Tag | None:
    section = soup.find(id="assessment")
    tables = section.find_all("table") if section else []
    if not tables:
        tables = soup.find_all("table")
    for table in tables:
        header = table.get_text(" ", strip=True).lower()
        if "weight" in header and "due" in header:
            return table
    return None


def _week_to_datetime(week: int, sem_start: date) -> datetime:
    """Friday 4pm of the given teaching week (approximate: ignores the mid-semester break)."""
    friday = sem_start + timedelta(days=(week - 1) * 7 + 4)
    return datetime(friday.year, friday.month, friday.day, 16, 0, tzinfo=BRISBANE)


def _expand_row(name: str, category: str, weight: float, due_text: str, is_hurdle: bool,
                sem_start: date | None) -> list[ImportedAssessment]:
    kind = _guess_type(category, name)
    base = dict(type=kind, is_hurdle=is_hurdle, raw_due_text=due_text)

    # Exam period: a date range rather than a set date.
    rng = DATE_RANGE.search(due_text)
    if rng and (kind == "exam" or "exam period" in due_text.lower()):
        start = _parse_date(rng.group(1))
        due = datetime(start.year, start.month, start.day, 9, 0, tzinfo=BRISBANE) if start else None
        return [ImportedAssessment(
            name=name, weight=weight, due=due.isoformat() if due else None, needs_review=True,
            note=f"Exam period {rng.group(1)} – {rng.group(2)}. Set your exact date once the exam timetable is out.",
            **base,
        )]

    # A window like "14/09/2026 - 18/09/2026" is one task due at the end of the window, not two.
    stamps = _all_datetimes(DATE_RANGE.sub(lambda m: m.group(2), due_text))
    if len(stamps) == 1:
        return [ImportedAssessment(name=name, weight=weight, due=stamps[0].isoformat(), **base)]
    if len(stamps) > 1:
        share = round(weight / len(stamps), 2)
        return [
            ImportedAssessment(name=f"{name} ({i + 1})", weight=share, due=s.isoformat(), **base)
            for i, s in enumerate(stamps)
        ]

    weeks = [int(w) for w in WEEK.findall(due_text)]
    if weeks and sem_start:
        share = round(weight / len(weeks), 2)
        return [
            ImportedAssessment(
                name=name if len(weeks) == 1 else f"{name} (Wk {w})", weight=share,
                due=_week_to_datetime(w, sem_start).isoformat(), needs_review=True,
                note=f'Profile says "Week {w}". Date estimated; check it.', **base,
            )
            for w in weeks
        ]

    return [ImportedAssessment(
        name=name, weight=weight, due=None, needs_review=True,
        note="No date found in the profile. Add it yourself.", **base,
    )]


def parse_profile(html: str, url: str) -> ImportedCourse:
    soup = BeautifulSoup(html, "html.parser")
    code_match = PROFILE_LINK.search(url)
    code = code_match.group(1) if code_match else ""

    title_el = soup.find("h1")
    title = title_el.get_text(" ", strip=True) if title_el else None
    sem_start, sem_end = _semester_dates(soup)

    table = _find_summary_table(soup)
    if table is None:
        raise ImportFailed("Couldn't find the assessment table in this course profile.")

    rows = table.find_all("tr")
    header_cells = [c.get_text(" ", strip=True).lower() for c in rows[0].find_all(["th", "td"])] if rows else []

    def col(*names: str, default: int) -> int:
        for i, h in enumerate(header_cells):
            if any(n in h for n in names):
                return i
        return default

    i_cat, i_task, i_weight, i_due = col("category", default=0), col("task", default=1), col("weight", default=2), col("due", default=3)

    assessments: list[ImportedAssessment] = []
    for row in rows[1:]:
        cells = row.find_all(["td", "th"])
        if len(cells) <= max(i_task, i_weight, i_due):
            continue
        category = cells[i_cat].get_text(" ", strip=True) if i_cat < len(cells) else ""
        name, is_hurdle = _clean_name(cells[i_task])
        weight_text = cells[i_weight].get_text(" ", strip=True)
        wm = WEIGHT.search(weight_text)
        weight = float(wm.group(1)) if wm else 0.0
        due_text = " ".join(_cell_lines(cells[i_due]))
        assessments.extend(_expand_row(name, category, weight, due_text, is_hurdle, sem_start))

    if not assessments:
        raise ImportFailed("The assessment table in this profile was empty.")

    return ImportedCourse(
        code=code,
        title=title,
        profile_url=url,
        semester_start=sem_start.isoformat() if sem_start else None,
        semester_end=sem_end.isoformat() if sem_end else None,
        assessments=assessments,
    )


def import_course(code: str, year: int, semester: int, profile_url: str | None = None,
                  client: httpx.Client | None = None) -> ImportedCourse:
    code = code.strip().upper()
    if not re.fullmatch(r"[A-Z]{4}\d{4}", code):
        raise ImportFailed("Course codes look like STAT2201: four letters then four digits.")
    own_client = client is None
    client = client or httpx.Client(headers=HEADERS, timeout=20, follow_redirects=True)
    try:
        url = profile_url or find_profile_url(code, year, semester, client)
        if not PROFILE_LINK.match(url):
            raise ImportFailed("That isn't a course-profiles.uq.edu.au link.")
        resp = client.get(url)
        if resp.status_code in (401, 403):
            raise ImportFailed(
                "UQ's course profile site doesn't allow automatic downloads. "
                "Copy the Assessment summary table from the profile and paste it instead."
            )
        if resp.status_code != 200:
            raise ImportFailed(f"Couldn't open the course profile (status {resp.status_code}).")
        course = parse_profile(resp.text, url)
        course.code = course.code or code
        return course
    except httpx.HTTPError as exc:
        raise ImportFailed(f"Couldn't reach UQ's website: {exc.__class__.__name__}.") from exc
    finally:
        if own_client:
            client.close()


# ---------- pasted text ----------

WEIGHT_ONLY = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*%\s*$")
BADGE_LINES = {b.lower() for b in BADGES} | {"identity verified", "in-person", "hurdle"}


def _is_badge(line: str) -> bool:
    return line.strip().lower() in BADGE_LINES


def parse_pasted_table(text: str, code: str, sem_start: date | None = None) -> ImportedCourse:
    """Read an "Assessment summary" table that was copied from a course profile and pasted as text.

    Handles both shapes browsers produce when copying a table:
    - one cell per line ("Problem Set", "25%", "26/10/2026 4:00 pm", ...)
    - one row per line, cells separated by tabs.
    The weighting ("25%") anchors each row: the task name is just before it and
    the due date(s) come after it, up to the next row.
    """
    lines: list[str] = []
    for raw in text.replace("\r", "").split("\n"):
        # Split tab-separated rows into one cell per line so both shapes look the same.
        for cell in raw.split("\t"):
            cell = cell.strip()
            if cell:
                lines.append(cell)

    weight_idx = [i for i, line in enumerate(lines) if WEIGHT_ONLY.match(line)]
    if not weight_idx:
        raise ImportFailed(
            "Couldn't find any weightings (like 25%) in the pasted text. "
            "Copy the whole Assessment summary table, from 'Category' to the last due date."
        )

    rows = []
    for w in weight_idx:
        j = w - 1
        is_hurdle = False
        while j >= 0 and _is_badge(lines[j]):
            is_hurdle = is_hurdle or lines[j].strip().lower() == "hurdle"
            j -= 1
        if j < 0:
            continue
        name_line = lines[j]
        name, hurdle_inline = name_line, False
        stripped = True
        while stripped:  # badges run onto the name with no space sometimes
            stripped = False
            for badge in BADGES:
                if name.endswith(badge) and name != badge:
                    name = name[: -len(badge)].strip()
                    hurdle_inline = hurdle_inline or badge == "Hurdle"
                    stripped = True
        category = lines[j - 1] if j >= 1 else ""
        rows.append({"name_idx": j, "w": w, "name": name, "category": category,
                     "weight": float(WEIGHT_ONLY.match(lines[w]).group(1)),
                     "hurdle": is_hurdle or hurdle_inline})

    assessments: list[ImportedAssessment] = []
    for k, row in enumerate(rows):
        end = rows[k + 1]["name_idx"] if k + 1 < len(rows) else len(lines)
        due_text = " ".join(lines[row["w"] + 1:end])
        assessments.extend(_expand_row(row["name"], row["category"], row["weight"], due_text,
                                       row["hurdle"], sem_start))

    return ImportedCourse(code=code, title=None, profile_url="", semester_start=None,
                          semester_end=None, assessments=assessments)


# ---------- uploaded files ----------

# A profile names itself like "STAT2201-62023-7660" (course, offering, term).
PROFILE_ID = re.compile(r"\b([A-Z]{4}\d{4})-(\d+)-(\d{4})\b")
PROFILE_BASE = "https://course-profiles.uq.edu.au/course-profiles/"
STUDY_PERIOD = re.compile(
    r"Semester\s+(\d),\s*(\d{4})\s*\(\s*(\d{1,2}/\d{1,2}/\d{4})\s*[-–]\s*(\d{1,2}/\d{1,2}/\d{4})\s*\)"
)
DETAIL_WEIGHT = re.compile(r"^Weight\s+(.*)$")


def describe_term(term: str) -> str:
    """'7660' → 'Semester 2, 2026'. Summer and other terms fall back to the code."""
    year, kind = int(term[:2]) + 1950, term[2:]
    return {"20": f"Semester 1, {year}", "60": f"Semester 2, {year}"}.get(kind, f"term {term}")


def _pdf_lines(data: bytes) -> list[str]:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(data))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    except (PdfReadError, ValueError) as exc:
        raise ImportFailed("Couldn't open that PDF. Try saving the course profile again.") from exc
    return [line.replace("\xa0", " ").strip() for line in text.split("\n") if line.strip()]


def _pdf_title(lines: list[str], code: str) -> str | None:
    """The heading is 'COURSE PROFILE', then the name, ending '(STAT2201)'; it may wrap."""
    for i, line in enumerate(lines):
        if line.endswith(f"({code})"):
            start = i
            while start > 0 and lines[start - 1] != "COURSE PROFILE" and i - start < 3:
                start -= 1
            return " ".join(lines[start:i + 1])
    return None


def _pdf_name_start(lines: list[str], mode: int) -> int:
    """Where a task's name starts: the line above "Mode", plus the line before
    that when the name wrapped (it then starts lowercase or with "(", or the
    line above leaves a bracket open)."""
    start = mode - 1
    while start > 0 and mode - start < 3:
        name, above = lines[start], lines[start - 1]
        wrapped = name[:1].islower() or name.startswith("(") or above.count("(") > above.count(")")
        if not wrapped or above == "Assessment details":
            break
        start -= 1
    return start


DUE_STOPS = ("Other conditions", "Learning", "Task description", "Assessment security", "Hurdle requirements")


def _pdf_due_text(lines: list[str]) -> str:
    """The "Due date" field, which ends at the next field label. If it holds no
    date (a two-column layout can push it further down), the first dated lines
    before "Other conditions" are added."""
    due, rest = [], []
    for i, line in enumerate(lines):
        if line.startswith(DUE_STOPS):
            rest = lines[i:]
            break
        due.append(line)
    text = " ".join(due).removeprefix("Due date").strip()
    if not DATE_TIME.search(text):
        for line in rest:
            if line.startswith("Other conditions"):
                break
            if DATE_TIME.search(line):
                text += " " + line
    return text


def parse_profile_pdf(data: bytes) -> ImportedCourse:
    """Read a course profile saved as a PDF from the browser.

    The summary table's columns get jumbled when a PDF is turned back into
    text, so this reads the "Assessment details" section instead, where each
    task is laid out as:
        <task name> / Mode … / Category … / Weight 25% / Due date … / Task description
    """
    lines = _pdf_lines(data)
    if not lines:
        raise ImportFailed("That PDF has no readable text. Save the course profile from your browser as a PDF instead of scanning it.")
    text = "\n".join(lines)

    ident = PROFILE_ID.search(text)
    code_match = ident or re.search(r"\(([A-Z]{4}\d{4})\)", text)
    code = code_match.group(1) if code_match else ""
    url = PROFILE_BASE + ident.group(0) if ident else ""

    period = STUDY_PERIOD.search(text)
    sem_start = _parse_date(period.group(3)) if period else None
    sem_end = _parse_date(period.group(4)) if period else None

    # Each task's block runs from its "Mode" line to the next task's name.
    modes = [
        i for i in range(1, len(lines) - 2)
        if lines[i].startswith("Mode") and lines[i + 1].startswith("Category") and DETAIL_WEIGHT.match(lines[i + 2])
    ]
    starts = [_pdf_name_start(lines, i) for i in modes]
    assessments: list[ImportedAssessment] = []
    for k, mode in enumerate(modes):
        end = starts[k + 1] if k + 1 < len(starts) else len(lines)
        block = lines[mode:end]
        if "Course grading" in block:  # the last task's block stops where the grading section starts
            block = block[:block.index("Course grading")]
        name = " ".join(lines[starts[k]:mode])
        category = block[1].removeprefix("Category").strip()
        wm = WEIGHT.search(block[2])
        weight = float(wm.group(1)) if wm else 0.0
        due_text = _pdf_due_text(block[3:])
        is_hurdle = any(line == "Hurdle" or line.startswith("Hurdle requirements") for line in block)
        assessments.extend(_expand_row(name, category, weight, due_text, is_hurdle, sem_start))

    if not assessments:
        if "COURSE PROFILE" in text or code:
            raise ImportFailed(
                "This PDF doesn't include the assessments. Open the Assessment tab on the course profile, "
                "then save it as a PDF again."
            )
        raise ImportFailed("This doesn't look like a UQ course profile.")

    return ImportedCourse(
        code=code,
        title=_pdf_title(lines, code) if code else None,
        profile_url=url,
        semester_start=sem_start.isoformat() if sem_start else None,
        semester_end=sem_end.isoformat() if sem_end else None,
        assessments=assessments,
    )


def parse_uploaded_profile(data: bytes, filename: str = "") -> ImportedCourse:
    """Read a course profile the user downloaded: a PDF, or the page saved as HTML."""
    if data[:5] == b"%PDF-":
        return parse_profile_pdf(data)
    if filename.lower().endswith((".htm", ".html")) or b"<html" in data[:4096].lower():
        html = data.decode("utf-8", errors="replace")
        ident = PROFILE_ID.search(html)
        url = PROFILE_BASE + ident.group(0) if ident else ""
        course = parse_profile(html, url)
        if not course.code:
            title_code = re.search(r"\(([A-Z]{4}\d{4})\)", course.title or "")
            course.code = title_code.group(1) if title_code else ""
        return course
    raise ImportFailed("Upload the course profile as a PDF or a saved web page (.html).")
