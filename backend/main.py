import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client

from uq_import import ImportFailed, import_course, parse_pasted_table

# Load .env from the Trajectory folder (one level above this file),
# so the server works no matter which folder you start it from.
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise RuntimeError(
        f"SUPABASE_URL and SUPABASE_SECRET_KEY must be set in {ENV_PATH}"
    )

supabase = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

app = FastAPI(title="Trajectory backend")

# Lets the app (in Expo Go or the browser) call this server during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def hello():
    return {"status": "backend running"}


@app.get("/health/db")
def db_check():
    try:
        result = supabase.table("semester_calendar").select("*").limit(1).execute()
    except Exception as exc:
        # Show the real reason (e.g. table missing, bad key) instead of a bare 500
        raise HTTPException(status_code=500, detail=f"Database check failed: {exc}")
    return {"database": "connected", "rows": result.data}


class ImportRequest(BaseModel):
    code: str = Field(examples=["STAT2201"])
    year: int = Field(default=2026, ge=2015, le=2100)
    semester: int = Field(default=2, ge=1, le=2)
    profile_url: str | None = Field(
        default=None,
        description="Optional. A course-profiles.uq.edu.au link, if the automatic lookup fails.",
    )


@app.post("/import-course")
def import_course_endpoint(req: ImportRequest):
    """Read a UQ course profile and return its assessments.

    Nothing is saved here: the app shows the results for review, then saves
    them to Supabase under the signed-in user's account.
    """
    try:
        course = import_course(req.code, req.year, req.semester, req.profile_url)
    except ImportFailed as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return course.to_dict()


class PasteRequest(BaseModel):
    code: str = Field(examples=["STAT2201"])
    text: str = Field(description="The Assessment summary table, copied from the course profile page.")


@app.post("/import-text")
def import_text_endpoint(req: PasteRequest):
    """Read an assessment table the user copied from a course profile and pasted in.

    UQ's course-profile site blocks automated downloads, so this is the reliable path.
    """
    code = req.code.strip().upper()
    try:
        course = parse_pasted_table(req.text, code)
    except ImportFailed as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return course.to_dict()
