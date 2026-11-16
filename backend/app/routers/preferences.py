"""Student and instructor scheduling preference endpoints (Supabase PostgreSQL)."""

from __future__ import annotations

from typing import Any, Dict

from app.database.supabase import SupabaseQueryError, require_supabase_client
from app.deps import parse_json_body, raise_supabase_http_error, require_auth_user
from database import now_iso
from fastapi_compat import APIRouter, HTTPException, Request

router = APIRouter(tags=["preferences"])


def _normalize_time_window(raw: Any) -> str:
    val = str(raw or "").strip().lower()
    if val in ("morning", "midday", "afternoon", "balanced"):
        return val
    if "08" in val or "09" in val or "10" in val or "11" in val:
        return "morning"
    if "12" in val or "13" in val:
        return "midday"
    if "14" in val or "15" in val or "16" in val:
        return "afternoon"
    return "balanced"


@router.get("/api/preferences/student")
def get_student_preferences(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = auth_user.get("institutionId") or ""
    client = require_supabase_client()
    try:
        if auth_user.get("role") == "admin":
            rows = client.select("student_preferences", filters={"institution_id": f"eq.{uni_id}"})
        else:
            rows = client.select(
                "student_preferences",
                filters={"institution_id": f"eq.{uni_id}", "user_id": f"eq.{auth_user.get('userId')}"},
            )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    enriched = [
        {
            **r,
            "student_user_id": r["user_id"],
            "avoid_early_morning": bool(r.get("avoid_early_8am")),
            "avoid_late_evening": bool(r.get("avoid_late_after_4pm")),
        }
        for r in rows
    ]
    return {"preferences": enriched}


@router.post("/api/preferences/student")
async def save_student_preference(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=["student", "br", "admin"])
    body = await parse_json_body(request)
    uni_id = auth_user.get("institutionId") or ""
    student_id = (
        body.get("studentUserId")
        if auth_user.get("role") == "admin" and body.get("studentUserId")
        else auth_user.get("userId")
    )
    batch_id = body.get("batchId") or auth_user.get("batchId")
    current_iso = now_iso()

    window = _normalize_time_window(body.get("preferredTimeWindow") or body.get("preferredStartWindow"))
    max_gap_min = int(
        body.get("maxAcceptableGapMinutes")
        if "maxAcceptableGapMinutes" in body
        else int(body.get("maxAcceptableIdleGaps", 1)) * 60
    )
    max_daily = int(body.get("maxDailyLectures", 4))

    client = require_supabase_client()
    try:
        inserted = client.insert(
            "student_preferences",
            {
                "institution_id": uni_id,
                "user_id": student_id,
                "batch_id": batch_id,
                "preferred_time_window": window,
                "avoid_early_8am": bool(body.get("avoidEarly8am", body.get("avoidEarlyMorning", True))),
                "avoid_late_after_4pm": bool(body.get("avoidLateAfter4pm", body.get("avoidLateEvening", True))),
                "max_acceptable_gap_minutes": max(0, max_gap_min),
                "max_daily_lectures": max(1, max_daily),
                "preferred_free_day": body.get("preferredFreeDay"),
                "updated_at": current_iso,
            },
            upsert=True,
            on_conflict="institution_id,user_id",
        )
        saved = inserted[0] if inserted else None
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Student scheduling preferences saved.", "preference": saved}


@router.get("/api/preferences/instructor")
def get_instructor_preferences(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = auth_user.get("institutionId") or ""
    client = require_supabase_client()
    try:
        rows = client.select("instructor_preferences", filters={"institution_id": f"eq.{uni_id}"})
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    enriched = [
        {
            **r,
            "preferred_days": r.get("preferred_days") or [],
            "max_consecutive_hours": r.get("avoid_back_to_back_more_than", 2),
        }
        for r in rows
    ]
    return {"preferences": enriched}


@router.post("/api/preferences/instructor")
async def save_instructor_preference(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=["faculty", "admin"])
    body = await parse_json_body(request)
    uni_id = auth_user.get("institutionId") or ""
    requested_inst_id = str(body.get("instructorId") or auth_user.get("userId") or "").strip()
    current_iso = now_iso()

    client = require_supabase_client()
    try:
        inst_row = client.select_one(
            "instructors",
            filters={"or": f"(id.eq.{requested_inst_id},user_id.eq.{requested_inst_id})"},
            select="id",
        )
        if not inst_row:
            inst_row = client.select_one(
                "instructors",
                filters={"institution_id": f"eq.{uni_id}"},
                select="id",
            )
        if not inst_row:
            raise HTTPException(status_code=404, detail={"error": "No instructor profile found for this university."})

        instructor_id = inst_row["id"]
        pref_days = body.get("preferredDays") or ["Mon", "Tue", "Wed", "Thu", "Fri"]
        avoid_early = bool(body.get("avoidEarlyMorning"))
        avoid_late = bool(body.get("avoidLateAfternoon"))

        inserted = client.insert(
            "instructor_preferences",
            {
                "institution_id": uni_id,
                "instructor_id": instructor_id,
                "preferred_days": pref_days,
                "preferred_start_time": body.get("preferredStartTime") or ("10:00" if avoid_early else "09:00"),
                "preferred_end_time": body.get("preferredEndTime") or ("15:00" if avoid_late else "16:00"),
                "avoid_back_to_back_more_than": int(
                    body.get("avoidBackToBackMoreThan") or body.get("maxConsecutiveHours") or 2
                ),
                "prefer_compact_schedule": bool(body.get("preferCompactSchedule", True)),
                "notes": body.get("notes") or "",
                "updated_at": current_iso,
            },
            upsert=True,
            on_conflict="instructor_id",
        )
        saved = inserted[0] if inserted else None
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Instructor scheduling preferences saved.", "preference": saved}
