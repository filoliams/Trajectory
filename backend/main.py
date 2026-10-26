import os
import re
import time
from collections import defaultdict, deque
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from supabase import create_client

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


@app.get("/health")
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


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Simple per-IP limit so a script can't flood the waitlist table.
# In-memory, so it resets on restart and is per-process; fine for launch.
RATE_LIMIT = 5
RATE_WINDOW_SECONDS = 60
_recent_signups: dict[str, deque] = defaultdict(deque)


class WaitlistSignup(BaseModel):
    email: str = Field(max_length=254)
    university: str | None = Field(default=None, max_length=120)
    # Honeypot: hidden on the page, so only bots fill it in
    website: str | None = None


def _rate_limited(ip: str) -> bool:
    now = time.monotonic()
    hits = _recent_signups[ip]
    while hits and now - hits[0] > RATE_WINDOW_SECONDS:
        hits.popleft()
    if len(hits) >= RATE_LIMIT:
        return True
    hits.append(now)
    return False


@app.post("/api/waitlist", status_code=201)
def join_waitlist(signup: WaitlistSignup, request: Request):
    if signup.website:
        # Pretend it worked so bots don't learn to skip the field
        return {"ok": True}

    email = signup.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Please enter a valid email address.")

    ip = request.client.host if request.client else "unknown"
    if _rate_limited(ip):
        raise HTTPException(status_code=429, detail="Too many sign-ups. Try again in a minute.")

    row = {
        "email": email,
        "university": (signup.university or "").strip() or None,
        "referrer": (request.headers.get("referer") or "")[:500] or None,
    }
    try:
        # Ignore duplicates so signing up twice is harmless and doesn't
        # reveal whether an address is already on the list
        supabase.table("waitlist").upsert(
            row, on_conflict="email", ignore_duplicates=True
        ).execute()
    except Exception as exc:
        # Public endpoint: log the real cause, show visitors a generic message
        print(f"Waitlist insert failed: {exc}")
        raise HTTPException(status_code=500, detail="Something went wrong. Please try again.")
    return {"ok": True}


# Landing page. Mounted last so the API routes above take priority.
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
