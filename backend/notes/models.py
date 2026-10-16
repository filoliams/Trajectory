"""Shared data shapes for the notes pipeline."""

from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, Field


class ContentDepth(str, Enum):
    """How much real content a page has on a topic."""

    heading_only = "heading_only"      # a title or copied slide heading, nothing under it
    brief_notes = "brief_notes"        # a few lines / bullet points
    detailed_notes = "detailed_notes"  # full explanation, derivations, diagrams
    worked_example = "worked_example"  # a fully worked example done by the student


class PageKind(str, Enum):
    lecture_notes = "lecture_notes"
    tutorial = "tutorial"
    practice = "practice"
    summary = "summary"
    blank = "blank"
    other = "other"


class TopicEvidence(BaseModel):
    """What one page shows about one topic."""

    topic: str = Field(description="Topic name, reusing a known topic name where it matches")
    depth: ContentDepth
    practice_attempted: int = Field(0, ge=0, description="Practice problems attempted on this page")
    practice_correct: int = Field(0, ge=0, description="Problems marked correct (ticks, 'correct', matching answer)")
    practice_incorrect: int = Field(0, ge=0, description="Problems marked wrong (crosses, corrections)")
    unfinished: bool = Field(False, description="Notes or a problem stop partway through")


class PageReading(BaseModel):
    """The vision model's reading of one notebook page."""

    course_code: str | None = None
    page_kind: PageKind = PageKind.other
    written_date: date | None = Field(None, description="Date written on the page, if any")
    legibility: float = Field(1.0, ge=0, le=1)
    topics: list[TopicEvidence] = Field(default_factory=list)


class PageRecord(BaseModel):
    """A page we have read, with where it came from and when."""

    notebook: str            # notebook file name, e.g. "STAT2201 Lectures.pdf"
    page_index: int          # 0-based page number
    page_hash: str
    course_code: str | None
    seen_on: date            # date of the backup file we read it from
    reading: PageReading

    @property
    def effective_date(self) -> date:
        """Best guess at when the page was last worked on."""
        return self.reading.written_date or self.seen_on


class Level(str, Enum):
    strong = "strong"
    okay = "okay"
    weak = "weak"
    none = "none"   # no notes connected for this course yet


class TopicFootprint(BaseModel):
    course_code: str
    topic: str
    level: Level
    score: float                 # 0..1
    coverage: float
    depth: float
    practice: float
    recency: float
    pages: int
    practice_attempted: int
    practice_correct: int
    practice_incorrect: int
    last_touched: date | None
    evidence: str                # one-line, human-readable reason


class CourseFootprint(BaseModel):
    course_code: str
    level: Level
    score: float | None
    summary: str
    topics: list[TopicFootprint]
    weakness_multiplier: float   # feeds the planner's priority formula
