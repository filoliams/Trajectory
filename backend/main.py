import os
from pathlib import Path

from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from supabase import create_client

try:  # works whether you start uvicorn from the Trajectory folder or backend/
    from backend import course_profiles as cp
except ImportError:
    import course_profiles as cp

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


# ------------------------------------------------------------ course profiles

@app.get("/courses/{code}/offerings")
def course_offerings(code: str):
    """Every offering of a course that has a published course profile."""
    try:
        offerings = cp.find_offerings(code)
    except cp.CourseProfileError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return {"course_code": code.upper(), "offerings": [o.to_dict() for o in offerings]}


@app.get("/courses/{code}/preview")
def course_preview(
    code: str,
    semester: Optional[str] = None,
    location: Optional[str] = None,
    profile_url: Optional[str] = None,
):
    """Read a course profile's assessments without saving anything."""
    try:
        return cp.import_course(code, semester, location, profile_url)
    except cp.CourseProfileError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.post("/courses/{code}/import")
def course_import(
    code: str,
    semester: Optional[str] = None,
    location: Optional[str] = None,
    profile_url: Optional[str] = None,
):
    """Read a course profile and save it to Supabase.

    Re-importing the same profile replaces its assessments, so it's safe to
    run again when UQ updates a profile.
    """
    try:
        data = cp.import_course(code, semester, location, profile_url)
    except cp.CourseProfileError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    offering = data["offering"]
    try:
        profile = (
            supabase.table("course_profiles")
            .upsert(
                {
                    "course_code": data["course_code"],
                    "offering": offering["label"],
                    "location": offering["location"],
                    "mode": offering["mode"],
                    "profile_url": offering["profile_url"],
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="profile_url",
            )
            .execute()
        ).data[0]

        supabase.table("assessments").delete().eq("profile_id", profile["id"]).execute()
        rows = [{**a, "profile_id": profile["id"]} for a in data["assessments"]]
        saved = supabase.table("assessments").insert(rows).execute().data
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Saving to Supabase failed: {exc}")

    return {**data, "profile_id": profile["id"], "saved": len(saved)}


@app.get("/courses/{code}/assessments")
def course_assessments(code: str):
    """Saved assessments for a course, newest import first."""
    try:
        result = (
            supabase.table("course_profiles")
            .select("*, assessments(*)")
            .eq("course_code", code.upper())
            .order("fetched_at", desc=True)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database read failed: {exc}")
    for profile in result.data:
        profile["assessments"].sort(key=lambda a: a["position"])
    return {"course_code": code.upper(), "profiles": result.data}
