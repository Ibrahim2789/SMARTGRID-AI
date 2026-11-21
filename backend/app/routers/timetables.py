"""Timetable versions listing, publishing, restoring, deleting, and entry editing endpoints (Supabase PostgreSQL)."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List

from app.database.supabase import SupabaseQueryError, require_supabase_client
from app.deps import (
    ADMIN_ROLES,
    CATALOG_MANAGER_ROLES,
    assert_institution_access,
    get_query_param,
    parse_json_body,
    raise_supabase_http_error,
    require_auth_user,
    scoped_uni_id,
    write_audit_log,
)
from database import now_iso
from fastapi_compat import APIRouter, HTTPException, Request

router = APIRouter(tags=["timetables"])


def _compute_end_time(start_hhmm: str, duration_minutes: int) -> str:
    try:
        dt = datetime.strptime(start_hhmm, "%H:%M") + timedelta(minutes=duration_minutes)
        return dt.strftime("%H:%M")
    except Exception:
        return start_hhmm


def _sync_sections_from_version_entries(client: Any, uni_id: str, entries: List[Dict[str, Any]]) -> None:
    if not entries:
        return
    sessions = client.select(
        "course_sessions",
        filters={"institution_id": f"eq.{uni_id}"},
        select="id,is_locked",
    )
    session_ids = {s["id"] for s in sessions}
    seen: set[str] = set()
    for e in entries:
        sec_id = str(e.get("course_session_id") or "")
        if not sec_id or sec_id in seen or sec_id not in session_ids:
            continue
        seen.add(sec_id)
        is_lab = str(e.get("session_type") or "").lower() == "lab" or str(e.get("component_type") or "").lower() == "lab"
        slot_json = {
            "day": e.get("day_of_week"),
            "startTime24": e.get("start_time"),
            "endTime24": e.get("end_time"),
            "timeSlot": e.get("start_time"),
            "roomId": e.get("room_id"),
            "durationMinutes": int(e.get("duration_minutes") or (180 if is_lab else 50)),
            "sessionType": "Lab" if is_lab else "Lecture",
            "spanSlots": 3 if is_lab else 1,
            "slotSource": e.get("slot_source") or "regular",
        }
        client.update(
            "course_sessions",
            {"id": f"eq.{sec_id}", "institution_id": f"eq.{uni_id}"},
            {
                "assigned_day": e.get("day_of_week"),
                "assigned_start_time": e.get("start_time"),
                "assigned_room_id": e.get("room_id"),
                "assigned_slot_json": slot_json,
            },
        )


@router.get("/api/timetables")
def list_timetable_versions(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()

    try:
        versions = client.select(
            "timetable_versions",
            filters={"institution_id": f"eq.{uni_id}"},
            order="created_at.desc",
            limit=25,
        )
        if not versions:
            return {"timetables": []}

        v_ids = f"in.({','.join(v['id'] for v in versions)})"
        entries_rows = client.select("timetable_entries", filters={"timetable_version_id": v_ids})
        opt_runs = client.select(
            "optimization_runs",
            filters={"timetable_version_id": v_ids},
            select="timetable_version_id,assignments_snapshot",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    entries_by_ver: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for e in entries_rows:
        entries_by_ver[e["timetable_version_id"]].append(e)

    snapshot_by_ver: Dict[str, Any] = {}
    for run in opt_runs:
        if run.get("timetable_version_id") and run.get("assignments_snapshot"):
            snapshot_by_ver[run["timetable_version_id"]] = run["assignments_snapshot"]

    enriched = []
    for v in versions:
        v_id = v["id"]
        entries_payload = snapshot_by_ver.get(v_id) or entries_by_ver.get(v_id, [])
        enriched.append(
            {
                **v,
                "university_id": v["institution_id"],
                "version_name": v["name"],
                "fitness_score": v.get("overall_fitness_score", 0),
                "hard_conflicts_count": v.get("hard_violations_count", 0),
                "entries": entries_payload,
                "timetableEntries": entries_by_ver.get(v_id, []),
                "metrics": {
                    "totalScore": v.get("overall_fitness_score", 0),
                    "studentSatisfaction": v.get("student_satisfaction_score", 0),
                    "instructorSatisfaction": v.get("instructor_satisfaction_score", 0),
                    "roomUtilization": v.get("room_utilization_score", 0),
                    "fairnessScore": v.get("fairness_score", 0),
                },
            }
        )
    return {"timetables": enriched}


@router.post("/api/timetables/{versionId}/publish")
def publish_timetable_version(versionId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=ADMIN_ROLES)
    current_iso = now_iso()
    client = require_supabase_client()

    try:
        existing = client.select_one("timetable_versions", filters={"id": f"eq.{versionId}"})
        if not existing:
            raise HTTPException(status_code=404, detail={"error": "Timetable version not found."})
        assert_institution_access(auth_user, existing.get("institution_id"))
        target_uni_id = str(existing.get("institution_id") or auth_user.get("institutionId") or "")

        hard_count = int(existing.get("hard_violations_count") or 0)
        if hard_count > 0:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": (
                        f"Cannot publish timetable '{existing['name']}' because it has {hard_count} "
                        "hard constraint violation(s). Resolve all conflicts before publishing."
                    ),
                    "hardViolations": hard_count,
                },
            )

        client.update(
            "timetable_versions",
            {"institution_id": f"eq.{target_uni_id}", "status": "eq.published"},
            {"status": "archived", "updated_at": current_iso},
        )
        updated = client.update(
            "timetable_versions",
            {"id": f"eq.{versionId}"},
            {
                "status": "published",
                "published_at": current_iso,
                "approved_by": auth_user.get("userId"),
                "updated_at": current_iso,
            },
        )
        entries = client.select("timetable_entries", filters={"timetable_version_id": f"eq.{versionId}"})
        _sync_sections_from_version_entries(client, target_uni_id, entries)

        client.insert(
            "notifications",
            {
                "institution_id": target_uni_id,
                "recipient_user_id": None,
                "recipient_role": None,
                "title": f"Published Timetable: {existing['name']}",
                "message": (
                    f"The official conflict-free timetable ({existing['name']}) has been published "
                    f"with fitness score {existing.get('overall_fitness_score', 0)}."
                ),
                "notification_type": "timetable_published",
                "is_read": False,
                "created_at": current_iso,
            },
        )
        write_audit_log(
            client,
            target_uni_id,
            auth_user,
            "publish",
            "scenario",
            versionId,
            f"Published timetable version '{existing['name']}'",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {
        "message": f"Timetable version '{existing['name']}' published.",
        "version": updated[0] if updated else existing,
    }


@router.post("/api/timetables/{versionId}/restore")
def restore_timetable_version(versionId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=ADMIN_ROLES)
    current_iso = now_iso()
    client = require_supabase_client()

    try:
        existing = client.select_one("timetable_versions", filters={"id": f"eq.{versionId}"})
        if not existing:
            raise HTTPException(status_code=404, detail={"error": "Timetable version not found."})
        assert_institution_access(auth_user, existing.get("institution_id"))
        target_uni_id = existing["institution_id"]

        client.update(
            "timetable_versions",
            {"institution_id": f"eq.{target_uni_id}", "status": "eq.published"},
            {"status": "archived", "updated_at": current_iso},
        )
        updated = client.update(
            "timetable_versions",
            {"id": f"eq.{versionId}"},
            {
                "status": "published",
                "published_at": current_iso,
                "approved_by": auth_user.get("userId"),
                "updated_at": current_iso,
            },
        )
        entries = client.select("timetable_entries", filters={"timetable_version_id": f"eq.{versionId}"})
        _sync_sections_from_version_entries(client, target_uni_id, entries)
        write_audit_log(
            client,
            target_uni_id,
            auth_user,
            "restore",
            "scenario",
            versionId,
            f"Restored timetable version '{existing['name']}' to active published schedule",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {
        "message": f"Timetable version '{existing['name']}' restored and published.",
        "version": updated[0] if updated else existing,
    }


@router.patch("/api/timetables/{versionId}/entries")
async def update_timetable_version_entries(versionId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    current_iso = now_iso()
    client = require_supabase_client()

    try:
        existing = client.select_one("timetable_versions", filters={"id": f"eq.{versionId}"})
        if not existing:
            raise HTTPException(status_code=404, detail={"error": "Timetable version not found."})
        assert_institution_access(auth_user, existing.get("institution_id"))
        target_uni_id = existing["institution_id"]

        updates_list: List[Dict[str, Any]] = []
        if isinstance(body.get("updates"), list):
            updates_list = [u for u in body["updates"] if isinstance(u, dict)]
        elif body.get("sectionId"):
            updates_list = [body]

        if not updates_list:
            raise HTTPException(status_code=400, detail={"error": "No entry updates supplied."})

        for item in updates_list:
            sec_id = str(item.get("sectionId") or "").strip()
            if not sec_id:
                continue
            slot = item.get("slot") or item.get("assignedSlot") or {}
            day = str(slot.get("day") or item.get("day") or "")[:3]
            start_24 = str(slot.get("startTime24") or slot.get("timeSlot") or item.get("startTime24") or "")
            room_id = str(slot.get("roomId") or item.get("roomId") or "")
            dur = int(slot.get("durationMinutes") or item.get("durationMinutes") or 50)
            end_24 = str(slot.get("endTime24") or (_compute_end_time(start_24, dur) if start_24 else ""))
            is_locked = item.get("isLocked")

            entry_patch: Dict[str, Any] = {}
            sec_patch: Dict[str, Any] = {}
            if day:
                entry_patch["day_of_week"] = day
                sec_patch["assigned_day"] = day
            if start_24:
                entry_patch["start_time"] = start_24
                sec_patch["assigned_start_time"] = start_24
            if end_24:
                entry_patch["end_time"] = end_24
            if room_id:
                entry_patch["room_id"] = room_id
                sec_patch["assigned_room_id"] = room_id
            if slot:
                sec_patch["assigned_slot_json"] = slot
            if is_locked is not None:
                entry_patch["is_locked"] = bool(is_locked)
                sec_patch["is_locked"] = bool(is_locked)

            if entry_patch:
                client.update(
                    "timetable_entries",
                    {"timetable_version_id": f"eq.{versionId}", "course_session_id": f"eq.{sec_id}"},
                    entry_patch,
                )
            if sec_patch:
                client.update(
                    "course_sessions",
                    {"id": f"eq.{sec_id}", "institution_id": f"eq.{target_uni_id}"},
                    sec_patch,
                )

        client.update("timetable_versions", {"id": f"eq.{versionId}"}, {"updated_at": current_iso})
        updated_entries = client.select("timetable_entries", filters={"timetable_version_id": f"eq.{versionId}"})
        write_audit_log(
            client,
            target_uni_id,
            auth_user,
            "update",
            "scenario",
            versionId,
            f"Updated {len(updates_list)} schedule entry slot(s) in version '{existing['name']}'",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Timetable entries updated in Supabase.", "timetableEntries": updated_entries}


@router.delete("/api/timetables/{versionId}")
def delete_timetable_version(versionId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=ADMIN_ROLES)
    client = require_supabase_client()
    try:
        existing = client.select_one("timetable_versions", filters={"id": f"eq.{versionId}"})
        if not existing:
            raise HTTPException(status_code=404, detail={"error": "Timetable version not found."})
        assert_institution_access(auth_user, existing.get("institution_id"))
        target_uni_id = existing["institution_id"]

        client.delete("timetable_entries", {"timetable_version_id": f"eq.{versionId}"})
        client.delete("timetable_versions", {"id": f"eq.{versionId}"})
        write_audit_log(
            client,
            target_uni_id,
            auth_user,
            "delete",
            "scenario",
            versionId,
            f"Deleted timetable version '{existing['name']}'",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": f"Timetable version '{existing['name']}' deleted."}
