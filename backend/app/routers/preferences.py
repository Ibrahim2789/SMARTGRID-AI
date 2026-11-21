"""Student and instructor scheduling preference endpoints (Supabase PostgreSQL)."""

from __future__ import annotations

import uuid
from typing import Any, Dict, List

from app.database.supabase import SupabaseQueryError, require_supabase_client
from app.deps import (
    CATALOG_MANAGER_ROLES,
    assert_institution_access,
    parse_json_body,
    raise_supabase_http_error,
    require_auth_user,
    safe_json_loads,
    write_audit_log,
)
from app.routers.catalog import _sync_instructor_availability
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
    role = str(auth_user.get("role") or "").lower()
    client = require_supabase_client()
    try:
        if role in CATALOG_MANAGER_ROLES:
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
            "uiPreferences": safe_json_loads(r.get("ui_preferences"), {}),
        }
        for r in rows
    ]
    return {"preferences": enriched}


@router.post("/api/preferences/student")
async def save_student_preference(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=["student", "br", *CATALOG_MANAGER_ROLES])
    body = await parse_json_body(request)
    uni_id = auth_user.get("institutionId") or ""
    role = str(auth_user.get("role") or "").lower()
    student_id = (
        body.get("studentUserId")
        if role in CATALOG_MANAGER_ROLES and body.get("studentUserId")
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
    ui_prefs = body.get("uiPreferences") if isinstance(body.get("uiPreferences"), dict) else {}

    client = require_supabase_client()
    try:
        if batch_id:
            b_row = client.select_one("batches", filters={"id": f"eq.{batch_id}"}, select="id,institution_id")
            if b_row:
                assert_institution_access(auth_user, b_row.get("institution_id"))

        existing = client.select_one(
            "student_preferences",
            filters={"institution_id": f"eq.{uni_id}", "user_id": f"eq.{student_id}"},
        )
        merged_ui = {
            **safe_json_loads((existing or {}).get("ui_preferences"), {}),
            **ui_prefs,
        }

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
                "ui_preferences": merged_ui,
                "updated_at": current_iso,
            },
            upsert=True,
            on_conflict="institution_id,user_id",
        )
        saved = inserted[0] if inserted else None
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {
        "message": "Student scheduling preferences saved.",
        "preference": {
            **(saved or {}),
            "uiPreferences": merged_ui,
        },
    }


@router.get("/api/preferences/instructor")
def get_instructor_preferences(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = auth_user.get("institutionId") or ""
    role = str(auth_user.get("role") or "").lower()
    user_id = auth_user.get("userId")
    client = require_supabase_client()
    try:
        rows = client.select("instructor_preferences", filters={"institution_id": f"eq.{uni_id}"})
        instructors = client.select("instructors", filters={"institution_id": f"eq.{uni_id}"})
        avails = client.select("instructor_availability", filters={"institution_id": f"eq.{uni_id}"})
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    inst_by_id = {i["id"]: i for i in instructors}
    if role in ("faculty", "instructor"):
        my_inst = next(
            (
                i
                for i in instructors
                if i.get("user_id") == user_id
                or str(i.get("email") or "").lower() == str(auth_user.get("email") or "").lower()
            ),
            None,
        )
        if my_inst:
            rows = [r for r in rows if r["instructor_id"] == my_inst["id"]]
        else:
            rows = []

    enriched = []
    for r in rows:
        ins = inst_by_id.get(r["instructor_id"], {})
        unavail = [
            f"{a['day_of_week']}-{a['start_time']}"
            for a in avails
            if a.get("instructor_id") == r["instructor_id"] and not a.get("is_available", True)
        ]
        enriched.append(
            {
                **r,
                "preferred_days": r.get("preferred_days") or [],
                "max_consecutive_hours": r.get("avoid_back_to_back_more_than", 2),
                "max_weekly_hours": r.get("max_weekly_hours") or ins.get("max_weekly_hours") or 14,
                "unavailable_slots": unavail,
            }
        )
    return {"preferences": enriched}


@router.post("/api/preferences/instructor")
async def save_instructor_preference(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=["faculty", "instructor", *CATALOG_MANAGER_ROLES])
    body = await parse_json_body(request)
    uni_id = auth_user.get("institutionId") or ""
    role = str(auth_user.get("role") or "").lower()
    user_id = str(auth_user.get("userId") or "").strip()
    user_email = str(auth_user.get("email") or "").strip().lower()
    requested_inst_id = str(body.get("instructorId") or "").strip()
    current_iso = now_iso()

    client = require_supabase_client()
    try:
        inst_row = None
        if requested_inst_id:
            inst_row = client.select_one(
                "instructors",
                filters={"institution_id": f"eq.{uni_id}", "or": f"(id.eq.{requested_inst_id},user_id.eq.{requested_inst_id})"},
            )
            if inst_row:
                assert_institution_access(auth_user, inst_row.get("institution_id"))
        elif role in ("faculty", "instructor"):
            inst_row = client.select_one(
                "instructors",
                filters={"institution_id": f"eq.{uni_id}", "user_id": f"eq.{user_id}"},
            )
            if not inst_row and user_email:
                inst_row = client.select_one(
                    "instructors",
                    filters={"institution_id": f"eq.{uni_id}", "email": f"ilike.{user_email}"},
                )
                if inst_row and not inst_row.get("user_id"):
                    client.update("instructors", {"id": f"eq.{inst_row['id']}"}, {"user_id": user_id})

        if role in ("faculty", "instructor"):
            if inst_row and inst_row.get("user_id") and inst_row["user_id"] != user_id:
                raise HTTPException(
                    status_code=403,
                    detail={"error": "Faculty members can only modify their own instructor preferences."},
                )
            if not inst_row:
                # Auto-provision instructor profile bound to this authenticated faculty user
                new_inst_id = f"inst-fac-{uuid.uuid4().hex[:8]}"
                inserted_inst = client.insert(
                    "instructors",
                    {
                        "id": new_inst_id,
                        "user_id": user_id,
                        "institution_id": uni_id,
                        "name": auth_user.get("name") or "Faculty Member",
                        "email": user_email or f"{new_inst_id}@university.edu",
                        "designation": "Faculty Member",
                        "staff_role": "faculty",
                        "max_weekly_hours": int(body.get("maxWeeklyHours") or 14),
                        "max_daily_classes": int(body.get("maxDailyClasses") or body.get("maxConsecutiveHours") or 3),
                        "created_at": current_iso,
                    },
                )
                inst_row = inserted_inst[0]

        if not inst_row:
            raise HTTPException(
                status_code=404,
                detail={"error": f"Instructor profile '{requested_inst_id}' not found in this university."},
            )

        instructor_id = inst_row["id"]
        pref_days = body.get("preferredDays") or ["Mon", "Tue", "Wed", "Thu", "Fri"]
        avoid_early = bool(body.get("avoidEarlyMorning"))
        avoid_late = bool(body.get("avoidLateAfternoon"))
        max_weekly = int(body.get("maxWeeklyHours") or inst_row.get("max_weekly_hours") or 14)
        max_consec = int(body.get("avoidBackToBackMoreThan") or body.get("maxConsecutiveHours") or 2)

        client.update(
            "instructors",
            {"id": f"eq.{instructor_id}"},
            {"max_weekly_hours": max(1, max_weekly)},
        )

        inserted = client.insert(
            "instructor_preferences",
            {
                "institution_id": uni_id,
                "instructor_id": instructor_id,
                "preferred_days": pref_days,
                "preferred_start_time": body.get("preferredStartTime") or ("10:00" if avoid_early else "09:00"),
                "preferred_end_time": body.get("preferredEndTime") or ("15:00" if avoid_late else "16:00"),
                "avoid_back_to_back_more_than": max_consec,
                "max_weekly_hours": max(1, max_weekly),
                "prefer_compact_schedule": bool(body.get("preferCompactSchedule", True)),
                "notes": body.get("notes") or "",
                "updated_at": current_iso,
            },
            upsert=True,
            on_conflict="instructor_id",
        )
        saved = inserted[0] if inserted else None

        unavail_slots: List[Any] = body.get("unavailableSlots") if isinstance(body.get("unavailableSlots"), list) else None
        if unavail_slots is not None:
            _sync_instructor_availability(client, uni_id, instructor_id, unavail_slots)

        write_audit_log(
            client,
            uni_id,
            auth_user,
            "update",
            "instructor",
            instructor_id,
            f"Updated preferences & workload caps for instructor {inst_row.get('name', instructor_id)}",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Instructor scheduling preferences saved.", "preference": saved, "instructorId": instructor_id}
