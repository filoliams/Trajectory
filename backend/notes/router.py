"""FastAPI routes for notes and footprints.

    POST /notes/goodnotes/scan        read new/changed pages, rescore courses
    GET  /notes/footprint             every course's Strong / Okay / Weak
    GET  /notes/footprint/{course}    one course, with per-topic evidence
    PUT  /notes/syllabus/{course}     set the course's topic list

All routes need the app's Supabase login token: Authorization: Bearer <token>.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from .pipeline import scan_goodnotes
from .reader import ClaudePageReader
from .store import SupabaseStore


class ScanRequest(BaseModel):
    folder: str = Field(description="GoodNotes auto-backup folder on the machine running the backend")
    course_code: str | None = None
    max_reads: int = Field(150, ge=1, le=1000)


class SyllabusRequest(BaseModel):
    topics: list[str]


def make_router(supabase) -> APIRouter:
    router = APIRouter(prefix="/notes", tags=["notes"])

    def current_user(authorization: str = Header(...)) -> str:
        token = authorization.removeprefix("Bearer ").strip()
        try:
            user = supabase.auth.get_user(token).user
        except Exception:
            user = None
        if not user:
            raise HTTPException(status_code=401, detail="Not signed in")
        return user.id

    @router.post("/goodnotes/scan")
    def scan(req: ScanRequest, user_id: str = Depends(current_user)):
        folder = Path(req.folder).expanduser()
        if not folder.is_dir():
            raise HTTPException(status_code=400, detail=f"Folder not found: {folder}")
        try:
            reader = ClaudePageReader()
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc))
        result = scan_goodnotes(folder, SupabaseStore(supabase, user_id), reader,
                                only_course=req.course_code, max_reads=req.max_reads,
                                progress=lambda _msg: None)
        return {
            "notebooks": result.notebooks, "pages_seen": result.pages_seen,
            "pages_read": result.pages_read, "pages_unchanged": result.pages_unchanged,
            "pages_blank": result.pages_blank, "stopped_at_limit": result.stopped_at_limit,
            "errors": result.errors,
            "courses": [fp.model_dump(mode="json") for fp in result.footprints],
        }

    def _course(user_id: str, code: str | None = None):
        q = supabase.table("course_footprints").select("*").eq("user_id", user_id)
        t = supabase.table("topic_footprints").select("*").eq("user_id", user_id)
        if code:
            q, t = q.eq("course_code", code), t.eq("course_code", code)
        courses = q.execute().data
        topics = t.order("score").execute().data
        for c in courses:
            c["topics"] = [x for x in topics if x["course_code"] == c["course_code"]]
        return courses

    @router.get("/footprint")
    def all_footprints(user_id: str = Depends(current_user)):
        return _course(user_id)

    @router.get("/footprint/{course_code}")
    def course_footprint(course_code: str, user_id: str = Depends(current_user)):
        rows = _course(user_id, course_code.upper())
        if not rows:
            return {"course_code": course_code.upper(), "level": "none",
                    "summary": "No notes yet", "topics": [], "weakness_multiplier": 1.0}
        return rows[0]

    @router.put("/syllabus/{course_code}")
    def set_syllabus(course_code: str, req: SyllabusRequest, user_id: str = Depends(current_user)):
        code = course_code.upper()
        supabase.table("course_topics").delete().eq("user_id", user_id).eq("course_code", code).execute()
        names = list(dict.fromkeys(t.strip() for t in req.topics if t.strip()))
        if names:
            supabase.table("course_topics").insert(
                [{"user_id": user_id, "course_code": code, "name": n} for n in names]
            ).execute()
        return {"course_code": code, "topics": names}

    return router
