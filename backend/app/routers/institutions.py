"""Multi-university institution and scheduling settings endpoints (Supabase PostgreSQL)."""

from __future__ import annotations

import re
import time
from typing import Any, Dict

from app.database.supabase import SupabaseQueryError, require_supabase_client
from app.deps import (
    get_user_auth_context,
    parse_json_body,
    raise_supabase_http_error,
    require_auth_user,
    safe_json_loads,
)
from database import hash_password, now_iso
from fastapi_compat import APIRouter, HTTPException, Request

router = APIRouter(tags=["institutions"])


@router.get("/api/institutions")
def list_institutions() -> Dict[str, Any]:
    client = require_supabase_client()
    try:
        rows = client.select("institutions", order="created_at.asc")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"institutions": rows}


@router.post("/api/institutions/register")
async def register_institution(request: Request) -> Dict[str, Any]:
    body = await parse_json_body(request)
    name = (body.get("name") or "").strip()
    code = (body.get("code") or "").strip()
    campus_name = (body.get("campusName") or "Main Campus").strip()
    accreditation = (body.get("accreditation") or "Accredited Higher Education Institution").strip()
    admin_name = (body.get("adminName") or "University Administrator").strip()
    admin_email = (body.get("adminEmail") or "").strip().lower()
    admin_password = (body.get("adminPassword") or "").strip()
    working_days = body.get("workingDays") or "Mon,Tue,Wed,Thu,Fri"
    if isinstance(working_days, list):
        working_days = ",".join(str(d) for d in working_days)
    day_start_time = body.get("dayStartTime") or "09:00"
    day_end_time = body.get("dayEndTime") or "17:00"
    period_length_minutes = int(body.get("periodLengthMinutes") or 50)
    short_break_minutes = int(body.get("shortBreakMinutes") or 10)
    midday_break_enabled = bool(body.get("middayBreakEnabled", True))
    midday_break_start = body.get("middayBreakStart") or "13:00"
    midday_break_duration = int(body.get("middayBreakDuration") or 60)
    lab_duration_minutes = int(body.get("labDurationMinutes") or 180)

    if not name or not code or not admin_email or not admin_password:
        raise HTTPException(
            status_code=400,
            detail={"error": "University name, code, admin email, and password are required."},
        )

    clean_code = code.upper()
    slug = re.sub(r"[^a-z0-9]", "-", clean_code.lower())
    inst_id = f"inst-{slug}-{hex(int(time.time() * 1000))[2:]}"
    admin_id = f"user-admin-{int(time.time() * 1000)}"
    current_iso = now_iso()

    client = require_supabase_client()
    try:
        client.insert(
            "institutions",
            {
                "id": inst_id,
                "name": name,
                "code": clean_code,
                "campus_name": campus_name,
                "accreditation": accreditation,
                "academic_year": "2026–2027",
                "current_term": "Fall Semester 2026",
                "working_days": working_days,
                "day_start_time": day_start_time,
                "day_end_time": day_end_time,
                "period_length_minutes": period_length_minutes,
                "short_break_minutes": short_break_minutes,
                "midday_break_enabled": midday_break_enabled,
                "midday_break_start": midday_break_start,
                "midday_break_duration": midday_break_duration,
                "lab_duration_minutes": lab_duration_minutes,
                "timezone": "UTC",
                "is_sample": False,
                "created_at": current_iso,
            },
        )

        client.insert(
            "users",
            {
                "id": admin_id,
                "name": admin_name,
                "email": admin_email,
                "password_hash": hash_password(admin_password),
                "role": "admin",
                "gender": "male",
                "batch_id": None,
                "registration_number": None,
                "section": None,
                "is_active": True,
                "must_reset_password": False,
                "credential_hint": admin_password,
                "institution": name,
                "institution_id": inst_id,
                "created_at": current_iso,
            },
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    auth_context = get_user_auth_context(admin_id)
    return {
        "success": True,
        "institutionId": inst_id,
        "institutionName": name,
        "institutionCode": clean_code,
        "user": auth_context,
    }


@router.get("/api/institutions/{id}/data")
def get_institution_data(id: str) -> Dict[str, Any]:
    client = require_supabase_client()
    try:
        row = client.select_one("institution_data", filters={"institution_id": f"eq.{id}"}, select="payload")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    if row and row.get("payload") is not None:
        return {"data": safe_json_loads(row["payload"], row["payload"])}
    return {"data": None}


@router.post("/api/institutions/{id}/data")
async def save_institution_data(id: str, request: Request) -> Dict[str, Any]:
    require_auth_user(request)
    body = await parse_json_body(request)
    data = body.get("data")
    if data is None:
        raise HTTPException(status_code=400, detail={"error": "Missing data payload."})

    client = require_supabase_client()
    try:
        client.insert(
            "institution_data",
            {
                "institution_id": id,
                "payload": data,
                "updated_at": now_iso(),
            },
            upsert=True,
            on_conflict="institution_id",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"success": True, "message": "Institutional academic catalog saved."}


@router.get("/api/universities")
def get_universities() -> Dict[str, Any]:
    client = require_supabase_client()
    try:
        rows = client.select("institutions", order="created_at.asc")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"universities": rows}


@router.patch("/api/universities/{universityId}/settings")
async def update_university_settings(universityId: str, request: Request) -> Dict[str, Any]:
    require_auth_user(request, allowed_roles=["admin"])
    body = await parse_json_body(request)
    client = require_supabase_client()

    try:
        existing = client.select_one("institutions", filters={"id": f"eq.{universityId}"})
        if not existing:
            raise HTTPException(status_code=404, detail={"error": "University not found."})

        working_days = body.get("workingDays") or existing["working_days"]
        if isinstance(working_days, list):
            working_days = ",".join(str(d) for d in working_days)
        day_start = body.get("dayStartTime") or existing["day_start_time"]
        day_end = body.get("dayEndTime") or existing["day_end_time"]
        period_len = int(body.get("periodLengthMinutes") or existing["period_length_minutes"])
        short_break = int(
            body.get("shortBreakMinutes") if "shortBreakMinutes" in body else existing["short_break_minutes"]
        )
        midday_enabled = bool(body.get("middayBreakEnabled", bool(existing["midday_break_enabled"])))
        midday_start = body.get("middayBreakStart") or existing["midday_break_start"]
        midday_dur = int(body.get("middayBreakDuration") or existing["midday_break_duration"])
        lab_dur = int(body.get("labDurationMinutes") or existing["lab_duration_minutes"])

        updated_rows = client.update(
            "institutions",
            {"id": f"eq.{universityId}"},
            {
                "working_days": working_days,
                "day_start_time": day_start,
                "day_end_time": day_end,
                "period_length_minutes": period_len,
                "short_break_minutes": short_break,
                "midday_break_enabled": midday_enabled,
                "midday_break_start": midday_start,
                "midday_break_duration": midday_dur,
                "lab_duration_minutes": lab_dur,
            },
        )
        updated = updated_rows[0] if updated_rows else existing
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "University scheduling settings updated.", "university": updated}
