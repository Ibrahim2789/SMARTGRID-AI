"""Timetable versions listing and publishing endpoints (Supabase PostgreSQL)."""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List

from app.database.supabase import SupabaseQueryError, require_supabase_client
from app.deps import get_query_param, raise_supabase_http_error, require_auth_user
from database import now_iso
from fastapi_compat import APIRouter, HTTPException, Request

router = APIRouter(tags=["timetables"])


@router.get("/api/timetables")
def list_timetable_versions(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = get_query_param(request, "universityId", "") or auth_user.get("institutionId") or ""
    client = require_supabase_client()

    try:
        versions = client.select(
            "timetable_versions",
            filters={"institution_id": f"eq.{uni_id}"},
            order="created_at.desc",
            limit=20,
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
    auth_user = require_auth_user(request, allowed_roles=["admin"])
    uni_id = auth_user.get("institutionId") or ""
    current_iso = now_iso()
    client = require_supabase_client()

    try:
        existing = client.select_one("timetable_versions", filters={"id": f"eq.{versionId}"})
        if not existing:
            raise HTTPException(status_code=404, detail={"error": "Timetable version not found."})

        client.update(
            "timetable_versions",
            {"id": f"eq.{versionId}"},
            {"status": "published", "published_at": current_iso, "approved_by": auth_user.get("userId")},
        )
        client.insert(
            "notifications",
            {
                "institution_id": uni_id,
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
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": f"Timetable version '{existing['name']}' published."}
