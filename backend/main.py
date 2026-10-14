import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
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
