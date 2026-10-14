"""Fetch UQ course profiles and pull out their assessment items.

Flow:
1. find_offerings(code)   -> course page on programs-courses.uq.edu.au,
                             returns every offering that links to a profile
2. fetch_html(url)        -> downloads a course profile page
3. parse_assessments(html)-> reads the assessment summary table
                             (task, category, weight, due date)

The parsers look for links and table headers by their text rather than by
CSS classes, so small layout changes on UQ's side shouldn't break them.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

import httpx
from bs4 import BeautifulSoup, Tag

COURSE_PAGE_URL = "https://programs-courses.uq.edu.au/course.html"
PROFILE_HOST = "course-profiles.uq.edu.au"
BRISBANE = ZoneInfo("Australia/Brisbane")

HEADERS = {
    # A normal browser-style user agent; some university sites reject the
    # default python/httpx one.
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/130.0 Safari/537.36 Trajectory/0.1"
    ),
    "Accept-Language": "en-AU,en;q=0.9",
}

COURSE_CODE_RE = re.compile(r"^[A-Z]{4}\d{4}$")


class CourseProfileError(Exception):
    """Something went wrong fetching or reading a course profile."""


@dataclass
class Offering:
    label: str          # e.g. "Semester 2, 2026"
    location: str       # e.g. "St Lucia"
    mode: str           # e.g. "In Person"
    profile_url: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Assessment:
    name: str
    category: Optional[str]
    weight: Optional[float]       # percent, None for pass/fail or unknown
    weight_raw: str
    due_raw: str                  # exactly as written in the profile
    due_at: Optional[str]         # ISO 8601 (Brisbane time) if parseable
    position: int

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------- fetching

def normalise_code(code: str) -> str:
    code = code.strip().upper().replace(" ", "")
    if not COURSE_CODE_RE.match(code):
        raise CourseProfileError(f"'{code}' doesn't look like a UQ course code (e.g. MECH2210)")
    return code


def fetch_html(url: str, params: Optional[dict] = None) -> str:
    try:
        with httpx.Client(headers=HEADERS, timeout=20, follow_redirects=True) as client:
            resp = client.get(url, params=params)
    except httpx.HTTPError as exc:
        raise CourseProfileError(f"Couldn't reach {url}: {exc}") from exc
    if resp.status_code != 200:
        raise CourseProfileError(f"{url} returned HTTP {resp.status_code}")
    return resp.text


# ---------------------------------------------------------------- offerings

def parse_offerings(html: str) -> list[Offering]:
    """Every table row on the course page that links to a course profile.

    Rows come back in page order, which puts current offerings before
    archived ones.
    """
    soup = BeautifulSoup(html, "html.parser")
    offerings: list[Offering] = []
    seen: set[str] = set()

    for link in soup.find_all("a", href=True):
        href = link["href"].strip()
        if PROFILE_HOST not in href:
            continue
        if href.startswith("//"):
            href = "https:" + href
        if href in seen:
            continue
        seen.add(href)

        row = link.find_parent("tr")
        cells = [c.get_text(" ", strip=True) for c in row.find_all(["td", "th"])] if row else []
        label = cells[0] if cells else link.get_text(" ", strip=True)
        offerings.append(
            Offering(
                label=label,
                location=cells[1] if len(cells) > 1 else "",
                mode=cells[2] if len(cells) > 2 else "",
                profile_url=href,
            )
        )
    return offerings


def find_offerings(code: str) -> list[Offering]:
    code = normalise_code(code)
    html = fetch_html(COURSE_PAGE_URL, params={"course_code": code})
    return parse_offerings(html)


def pick_offering(
    offerings: list[Offering],
    semester: Optional[str] = None,
    location: Optional[str] = None,
) -> Offering:
    """Choose one offering. `semester` matches loosely, e.g. "Semester 2, 2026"
    or "sem 2 2026"; without it the first (most recent) offering wins."""
    candidates = offerings
    if semester:
        want = _semester_key(semester)
        candidates = [o for o in candidates if _semester_key(o.label) == want]
    if location:
        loc = location.lower()
        candidates = [o for o in candidates if loc in o.location.lower()] or candidates
    if not candidates:
        available = ", ".join(sorted({o.label for o in offerings})) or "none"
        raise CourseProfileError(
            f"No course profile found for {semester or 'any semester'}. Available: {available}"
        )
    return candidates[0]


def _semester_key(text: str) -> tuple:
    text = text.lower()
    year = re.search(r"(20\d\d)", text)
    if "summer" in text:
        term = "summer"
    else:
        m = re.search(r"(?:semester|sem|s)\s*(\d)", text)
        term = m.group(1) if m else ""
    return (term, year.group(1) if year else "")


# ---------------------------------------------------------------- assessments

def _header_index(headers: list[str], *keywords: str) -> Optional[int]:
    for i, h in enumerate(headers):
        if any(k in h for k in keywords):
            return i
    return None


def _find_assessment_table(soup: BeautifulSoup) -> Optional[Tag]:
    """The summary table is the one whose header mentions both a weight and
    a due date."""
    for table in soup.find_all("table"):
        first_row = table.find("tr")
        if not first_row:
            continue
        headers = [c.get_text(" ", strip=True).lower() for c in first_row.find_all(["th", "td"])]
        joined = " ".join(headers)
        if "weight" in joined and ("due" in joined or "date" in joined):
            return table
    return None


def parse_weight(text: str) -> Optional[float]:
    m = re.search(r"(\d+(?:\.\d+)?)\s*%", text)
    return float(m.group(1)) if m else None


_DATE_FORMATS = [
    "%d/%m/%Y %I:%M %p",
    "%d/%m/%Y %I:%M%p",
    "%d/%m/%Y %H:%M",
    "%d/%m/%Y",
    "%d %b %Y %I:%M %p",
    "%d %b %Y %H:%M",
    "%d %b %Y",
    "%d %B %Y %I:%M %p",
    "%d %B %Y %H:%M",
    "%d %B %Y",
]


def parse_due(text: str) -> Optional[str]:
    """Return ISO 8601 if the due text holds one concrete date, else None.

    Things like "Week 7", "End of semester exam period" or several dates
    stay unparsed; `due_raw` keeps the original either way.
    """
    cleaned = re.sub(r"\s+", " ", text).strip()
    # Drop a leading weekday ("Fri 16/10/2026 4:00 pm")
    cleaned = re.sub(r"^(mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+", "", cleaned, flags=re.I)

    candidates = re.findall(
        r"\d{1,2}/\d{1,2}/\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:[ap]m)?)?"
        r"|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:[ap]m)?)?",
        cleaned,
        flags=re.I,
    )
    if len(candidates) != 1:
        return None
    raw = candidates[0].strip()
    for fmt in _DATE_FORMATS:
        try:
            dt = datetime.strptime(raw.upper() if "%p" in fmt else raw, fmt)
            return dt.replace(tzinfo=BRISBANE).isoformat()
        except ValueError:
            continue
    return None


def parse_assessments(html: str) -> list[Assessment]:
    soup = BeautifulSoup(html, "html.parser")
    table = _find_assessment_table(soup)
    if table is None:
        raise CourseProfileError(
            "Couldn't find the assessment summary table in this profile "
            "(it may not be published yet, or the page layout changed)."
        )

    rows = table.find_all("tr")
    headers = [c.get_text(" ", strip=True).lower() for c in rows[0].find_all(["th", "td"])]
    i_name = _header_index(headers, "task", "assessment", "item") or 0
    i_cat = _header_index(headers, "category", "type")
    i_weight = _header_index(headers, "weight")
    i_due = _header_index(headers, "due", "date")

    results: list[Assessment] = []
    for row in rows[1:]:
        cells = row.find_all(["td", "th"])
        if not cells:
            continue

        def cell(i: Optional[int]) -> str:
            if i is None or i >= len(cells):
                return ""
            return cells[i].get_text(" ", strip=True)

        name = cell(i_name)
        if not name:
            continue
        weight_raw = cell(i_weight)
        due_raw = cell(i_due)
        results.append(
            Assessment(
                name=name,
                category=cell(i_cat) or None,
                weight=parse_weight(weight_raw),
                weight_raw=weight_raw,
                due_raw=due_raw,
                due_at=parse_due(due_raw),
                position=len(results),
            )
        )

    if not results:
        raise CourseProfileError("The assessment table was found but had no rows.")
    return results


def import_course(
    code: str,
    semester: Optional[str] = None,
    location: Optional[str] = None,
    profile_url: Optional[str] = None,
) -> dict:
    """Find, fetch and parse one course's profile. No database access."""
    code = normalise_code(code)
    if profile_url:
        offering = Offering(label=semester or "", location=location or "", mode="", profile_url=profile_url)
    else:
        offering = pick_offering(find_offerings(code), semester, location)

    assessments = parse_assessments(fetch_html(offering.profile_url))
    total = sum(a.weight for a in assessments if a.weight is not None)
    return {
        "course_code": code,
        "offering": offering.to_dict(),
        "assessments": [a.to_dict() for a in assessments],
        "total_weight": round(total, 2),
        # Flag likely parsing problems instead of failing silently
        "warnings": _warnings(assessments, total),
    }


def _warnings(assessments: list[Assessment], total: float) -> list[str]:
    out = []
    if abs(total - 100) > 0.5:
        out.append(f"Weights add up to {total:g}%, not 100%; check the profile.")
    undated = [a.name for a in assessments if a.due_at is None]
    if undated:
        out.append("No exact due date for: " + ", ".join(undated))
    return out
