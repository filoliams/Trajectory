import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client

from uq_import import (
    PROFILE_ID,
    PROFILE_LINK,
    ImportFailed,
    describe_term,
    import_course,
    parse_pasted_table,
    parse_profile,
    parse_uploaded_profile,
    term_code,
)

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


class HtmlRequest(BaseModel):
    code: str = Field(examples=["STAT2201"])
    url: str = Field(description="The course-profiles.uq.edu.au address the page was opened at.")
    html: str = Field(max_length=5_000_000, description="The course profile page's HTML, read in the app.")


@app.post("/import-html")
def import_html_endpoint(req: HtmlRequest):
    """Read a course profile page the user opened inside the app.

    The app shows the profile in a built-in browser, so UQ serves it like any
    other visit; the app then sends the page here for the same parsing as
    /import-course.
    """
    code = req.code.strip().upper()
    match = PROFILE_LINK.match(req.url)
    if not match:
        raise HTTPException(status_code=422, detail="That page isn't a UQ course profile.")
    if match.group(1) != code:
        raise HTTPException(
            status_code=422,
            detail=f"That profile is for {match.group(1)}, not {code}. Open {code}'s course profile instead.",
        )
    try:
        course = parse_profile(req.html, req.url)
    except ImportFailed as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    course.code = code
    return course.to_dict()


MAX_UPLOAD_BYTES = 15 * 1024 * 1024


@app.post("/import-file")
async def import_file_endpoint(
    file: UploadFile = File(description="A course profile saved as a PDF, or the page saved as HTML."),
    year: int | None = Form(default=None, ge=2015, le=2100),
    semester: int | None = Form(default=None, ge=1, le=2),
):
    """Read a course profile the user downloaded and uploaded during onboarding.

    The course code comes from the file itself. When year and semester are
    given, a profile for a different semester is turned away so its dates
    don't end up in the wrong plan.
    """
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="That file is too big. Course profiles are usually under 2 MB.")
    if not data:
        raise HTTPException(status_code=422, detail="That file is empty.")
    try:
        course = parse_uploaded_profile(data, file.filename or "")
    except ImportFailed as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if not course.code:
        raise HTTPException(status_code=422, detail="Couldn't tell which course this profile is for.")

    ident = PROFILE_ID.search(course.profile_url)
    if ident and year and semester and ident.group(3) != term_code(year, semester):
        raise HTTPException(
            status_code=422,
            detail=f"This {course.code} profile is for {describe_term(ident.group(3))}, "
            f"but you're planning {describe_term(term_code(year, semester))}. "
            "Download this semester's profile instead.",
        )
    return course.to_dict()
