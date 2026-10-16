import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from supabase import create_client

# Let `notes` import whether uvicorn is started from backend/ or the repo root.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from notes.router import build_router  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

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

notes_router, notes_auto_sync = build_router(supabase)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Watch the GoodNotes folder in the background unless NOTES_AUTO_SYNC=0
    task = None
    if os.getenv("NOTES_AUTO_SYNC", "1") != "0":
        task = asyncio.create_task(notes_auto_sync())
    yield
    if task:
        task.cancel()


app = FastAPI(title="Trajectory backend", lifespan=lifespan)
app.include_router(notes_router)


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
