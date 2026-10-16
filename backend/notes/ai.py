"""Claude calls: read handwriting off page images, then analyse a notebook.

Both calls force a tool so the model returns structured JSON we can store
directly, instead of free text we'd have to parse.
"""

import base64
from dataclasses import dataclass
from typing import Any

import anthropic

TRANSCRIBE_SYSTEM = """You transcribe a university student's handwritten study notes (GoodNotes pages) into text.

Rules:
- Transcribe what is written, in reading order. Keep headings, lists and indentation.
- Write maths as LaTeX inside $...$ (inline) or $$...$$ (display).
- Replace diagrams, graphs and circuits with a one-line description in square brackets, e.g. [Diagram: RC circuit, R in series with C, Vs = 5 V].
- Keep the student's own marks that show how they're going: question marks, "???", "ask tutor", crossed-out working, ticks/crosses, stars, highlighted parts. Write them as [crossed out: ...], [highlighted: ...], [marked ?] etc.
- If a word is unreadable write [illegible]; if you are unsure write the best guess followed by [?].
- Printed text (slides, worksheets) is given to you as a text layer: don't repeat it, only add the handwriting and annotations on top of it, noting what they are attached to if it matters.
- A page with no handwriting or only a paper template (lines, grid, dots) is blank."""

TRANSCRIBE_TOOL = {
    "name": "record_transcriptions",
    "description": "Record the transcription of every page you were given.",
    "input_schema": {
        "type": "object",
        "properties": {
            "pages": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "page": {"type": "integer", "description": "Page number as labelled."},
                        "blank": {"type": "boolean"},
                        "text": {"type": "string", "description": "Transcribed handwriting; empty if blank."},
                    },
                    "required": ["page", "blank", "text"],
                },
            }
        },
        "required": ["pages"],
    },
}

ANALYSIS_SYSTEM = """You assess a university student's progress in a subject from one of their notebooks.

You get the notebook's location, its course code if known, and a page-by-page transcript (printed slide text plus their handwriting). Judge from evidence in the notes only:
- what topics are covered and how deeply (just copied from slides vs. worked examples, own explanations, connections between ideas);
- signs of confusion: question marks, "ask tutor", crossed-out or abandoned working, wrong answers that were corrected;
- signs of mastery: problems solved independently, correct worked examples, summaries in their own words;
- how complete the notes look (missing weeks, half-finished pages).

Be calibrated. Notes show effort and coverage, not everything the student knows: if there is little to go on, say so with low certainty rather than guessing high or low. Topic names should be short and reusable across notebooks (e.g. "Kirchhoff's laws", not "the KVL bit on page 3")."""

ANALYSIS_TOOL = {
    "name": "record_note_analysis",
    "description": "Record the structured assessment of this notebook.",
    "input_schema": {
        "type": "object",
        "properties": {
            "course_code": {
                "type": ["string", "null"],
                "description": "Course code like ENGG1100 if it's given or obvious from the content, else null.",
            },
            "summary": {"type": "string", "description": "2-4 sentences: what these notes cover."},
            "note_type": {
                "type": "string",
                "enum": ["lecture", "tutorial", "practical", "assignment", "revision", "reading", "mixed", "other"],
            },
            "topics": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "depth": {
                            "type": "string",
                            "enum": ["mentioned", "copied", "practised", "understood"],
                            "description": "mentioned: only named; copied: transcribed from slides; practised: worked examples/problems attempted; understood: correct own working or explanations.",
                        },
                        "confidence": {
                            "type": "integer",
                            "minimum": 0,
                            "maximum": 100,
                            "description": "Estimated student confidence in this topic, from the notes.",
                        },
                        "evidence": {"type": "string", "description": "Short pointer to what in the notes supports this, with page numbers."},
                    },
                    "required": ["name", "depth", "confidence", "evidence"],
                },
            },
            "overall_confidence": {"type": "integer", "minimum": 0, "maximum": 100},
            "certainty": {
                "type": "string",
                "enum": ["low", "medium", "high"],
                "description": "How much evidence the notes give for these estimates.",
            },
            "struggle_points": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Specific things the student seems stuck on, with page numbers.",
            },
            "gaps": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Topics that seem missing or unfinished.",
            },
            "completeness": {"type": "string", "enum": ["fragmentary", "partial", "thorough"]},
        },
        "required": [
            "course_code",
            "summary",
            "note_type",
            "topics",
            "overall_confidence",
            "certainty",
            "struggle_points",
            "gaps",
            "completeness",
        ],
    },
}

# Keep the analysis prompt a sensible size for very long notebooks.
MAX_TRANSCRIPT_CHARS = 120_000


@dataclass
class PageForVision:
    number: int
    png: bytes
    text_layer: str


def _tool_input(response: Any, tool_name: str) -> dict:
    for block in response.content:
        if block.type == "tool_use" and block.name == tool_name:
            return block.input
    raise RuntimeError(f"Model did not call {tool_name}; stop_reason={response.stop_reason}")


class NotesAI:
    def __init__(self, api_key: str | None, transcribe_model: str, analysis_model: str, client: Any = None):
        if client is None:
            if not api_key:
                raise RuntimeError("ANTHROPIC_API_KEY is not set in .env - needed to read handwriting.")
            client = anthropic.Anthropic(api_key=api_key)
        self.client = client
        self.transcribe_model = transcribe_model
        self.analysis_model = analysis_model

    def transcribe(self, pages: list[PageForVision], context: str) -> dict[int, str]:
        """Transcribe a batch of page images. Returns {page_number: text} ('' for blank)."""
        content: list[dict] = [{"type": "text", "text": f"Notebook: {context}"}]
        for page in pages:
            label = f"Page {page.number}."
            if page.text_layer:
                label += f" Printed text already on this page:\n<text_layer>\n{page.text_layer}\n</text_layer>"
            content.append({"type": "text", "text": label})
            content.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": base64.standard_b64encode(page.png).decode(),
                    },
                }
            )
        content.append({"type": "text", "text": "Transcribe every page above."})

        response = self.client.messages.create(
            model=self.transcribe_model,
            max_tokens=16000,
            system=TRANSCRIBE_SYSTEM,
            tools=[TRANSCRIBE_TOOL],
            tool_choice={"type": "tool", "name": TRANSCRIBE_TOOL["name"]},
            messages=[{"role": "user", "content": content}],
        )
        result = _tool_input(response, TRANSCRIBE_TOOL["name"])
        wanted = {p.number for p in pages}
        out = {}
        for item in result.get("pages", []):
            if item.get("page") in wanted:
                out[item["page"]] = "" if item.get("blank") else item.get("text", "").strip()
        return out

    def analyse(self, *, location: str, course_code: str | None, transcript: str) -> dict:
        if len(transcript) > MAX_TRANSCRIPT_CHARS:
            # Keep the start and the most recent pages; the middle is summarised away.
            half = MAX_TRANSCRIPT_CHARS // 2
            transcript = transcript[:half] + "\n\n[... middle pages omitted for length ...]\n\n" + transcript[-half:]

        prompt = (
            f"Notebook: {location}\n"
            f"Course code from folder: {course_code or 'unknown'}\n\n"
            f"<transcript>\n{transcript}\n</transcript>"
        )
        response = self.client.messages.create(
            model=self.analysis_model,
            max_tokens=4000,
            system=ANALYSIS_SYSTEM,
            tools=[ANALYSIS_TOOL],
            tool_choice={"type": "tool", "name": ANALYSIS_TOOL["name"]},
            messages=[{"role": "user", "content": prompt}],
        )
        return _tool_input(response, ANALYSIS_TOOL["name"])


def build_transcript(pages: list[tuple[int, str, str]]) -> str:
    """pages: (number, text_layer, handwriting). Blank pages are skipped."""
    parts = []
    for number, printed, handwriting in pages:
        if not printed and not handwriting:
            continue
        section = [f"--- Page {number} ---"]
        if printed:
            section.append(f"[Printed]\n{printed}")
        if handwriting:
            section.append(f"[Handwritten]\n{handwriting}")
        parts.append("\n".join(section))
    return "\n\n".join(parts)
