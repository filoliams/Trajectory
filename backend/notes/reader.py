"""Read a notebook page with a vision model and return structured evidence.

The model is forced to answer through a tool, so the reply is always JSON that
matches PageReading. It is given the course's known topic names so it reuses
them instead of inventing near-duplicates ("Linear regression" vs
"Simple linear regression").
"""

from __future__ import annotations

import base64
import os
from typing import Protocol

from .models import PageReading

DEFAULT_MODEL = "claude-sonnet-5-5"

SYSTEM_PROMPT = """You read a university student's handwritten study notes (exported from GoodNotes) \
and record what each page shows about each topic, so a study planner can tell which topics \
they know well and which need work.

For every distinct topic on the page, record:
- depth: heading_only (a title or copied slide heading with nothing real under it), \
brief_notes (a few lines or bullets), detailed_notes (full explanation, derivations, diagrams), \
worked_example (an example the student worked through themselves).
- practice_attempted: practice / tutorial / exam problems the student attempted on this page.
- practice_correct / practice_incorrect: only count problems that are visibly marked \
(ticks, crosses, "correct", corrections in another colour, an answer checked against a solution). \
Leave both 0 if nothing is marked.
- unfinished: true if the notes or a problem visibly stop partway through.

Rules:
- Use the course's known topic names exactly when the page covers one of them. \
Only introduce a new topic name when nothing on the list fits; keep new names short \
and at the level of a lecture topic (e.g. "Confidence intervals", not "Example 3.2").
- Judge the student's own work. Printed lecture slides imported into GoodNotes with no \
handwriting on them count as heading_only.
- If the page is blank or only a title page, return an empty topic list and page_kind "blank".
- written_date: only if a date is written on the page.
- legibility: 0-1, how confidently you could read the page."""

TOOL = {
    "name": "record_page",
    "description": "Record the structured reading of one notes page.",
    "input_schema": PageReading.model_json_schema(),
}


class PageReader(Protocol):
    def read(self, png: bytes, *, course_code: str | None, known_topics: list[str],
             text_hint: str = "") -> PageReading: ...


class ClaudePageReader:
    """Reads pages with Claude's vision via the Anthropic API."""

    def __init__(self, api_key: str | None = None, model: str | None = None):
        import anthropic  # imported here so tests don't need the package configured

        key = api_key or os.getenv("AI_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError("Set AI_API_KEY in .env to read notes with AI")
        self.client = anthropic.Anthropic(api_key=key)
        self.model = model or os.getenv("AI_MODEL", DEFAULT_MODEL)

    def read(self, png: bytes, *, course_code: str | None, known_topics: list[str],
             text_hint: str = "") -> PageReading:
        context = [f"Course: {course_code or 'unknown - infer it from the page if you can'}"]
        if known_topics:
            context.append("Known topics for this course:\n- " + "\n- ".join(known_topics))
        if text_hint:
            context.append(f"Typed text found on the page:\n{text_hint}")

        response = self.client.messages.create(
            model=self.model,
            max_tokens=1500,
            system=SYSTEM_PROMPT,
            tools=[TOOL],
            tool_choice={"type": "tool", "name": "record_page"},
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {
                        "type": "base64", "media_type": "image/png",
                        "data": base64.standard_b64encode(png).decode(),
                    }},
                    {"type": "text", "text": "\n\n".join(context)},
                ],
            }],
        )
        for block in response.content:
            if block.type == "tool_use":
                reading = PageReading.model_validate(block.input)
                if course_code and not reading.course_code:
                    reading.course_code = course_code
                return reading
        raise RuntimeError("Model did not return a page reading")
