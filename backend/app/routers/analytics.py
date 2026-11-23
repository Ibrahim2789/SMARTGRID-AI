"""Analytics overview and user notifications endpoints (Supabase PostgreSQL)."""

from __future__ import annotations

from typing import Any, Dict

from app.database.supabase import SupabaseQueryError, require_supabase_client
from app.deps import (
    assert_institution_access,
    get_query_param,
    raise_supabase_http_error,
    require_auth_user,
    scoped_uni_id,
)
from fastapi_compat import APIRouter, HTTPException, Request

router = APIRouter(tags=["analytics"])


@router.get("/api/analytics/overview")
def get_analytics_overview(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()

    try:
        latest_run = client.select_one(
            "optimization_runs",
            filters={"institution_id": f"eq.{uni_id}"},
            order="created_at.desc",
        )
        total_batches = client.count("batches", filters={"institution_id": f"eq.{uni_id}"})
        total_courses = client.count("courses", filters={"institution_id": f"eq.{uni_id}"})
        total_rooms = client.count("classrooms", filters={"institution_id": f"eq.{uni_id}"}) + client.count(
            "laboratories", filters={"institution_id": f"eq.{uni_id}"}
        )
        total_instructors = client.count("instructors", filters={"institution_id": f"eq.{uni_id}"})
        inst_polls = client.select("polls", filters={"institution_id": f"eq.{uni_id}"}, select="id")
        total_votes = (
            client.count("poll_votes", filters={"poll_id": f"in.({','.join(p['id'] for p in inst_polls)})"})
            if inst_polls
            else 0
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    params = (latest_run.get("parameters") if latest_run and isinstance(latest_run.get("parameters"), dict) else {}) or {}
    summary_metrics = params.get("summaryMetrics") or {}
    hist = params.get("fitnessHistory") or []

    assignment_readiness: Dict[str, Any] = {}
    staff_workload_summary: list[Dict[str, Any]] = []
    try:
        from app.services.assignment_validation import (
            build_assignment_workspace_payload,
            load_institution_assignment_context,
        )

        ctx = load_institution_assignment_context(client, uni_id)
        ws = build_assignment_workspace_payload(ctx)
        assignment_readiness = ws.get("summary") or {}
        staff_workload_summary = [
            {
                "id": s["id"],
                "name": s["name"],
                "staffRole": s["staffRole"],
                "departmentCode": s["departmentCode"],
                "currentWeeklyHours": s["currentWeeklyHours"],
                "maxWeeklyHours": s["maxWeeklyHours"],
                "utilizationPct": s["utilizationPct"],
                "assignedCoursesCount": s["assignedCoursesCount"],
            }
            for s in (ws.get("staffDirectory") or [])
        ]
    except Exception:
        assignment_readiness = {}
        staff_workload_summary = []

    return {
        "universityId": uni_id,
        "catalogSummary": {
            "batches": total_batches,
            "courses": total_courses,
            "classrooms": total_rooms,
            "instructors": total_instructors,
            "studentVotesCast": total_votes,
        },
        "assignmentReadiness": assignment_readiness,
        "staffWorkloadSummary": staff_workload_summary,
        "latestOptimizationRun": {
            "id": latest_run["id"] if latest_run else None,
            "algorithmPipeline": latest_run["algorithm"] if latest_run else "hybrid_dsatur_ga_sa",
            "dsaturInitialFitness": hist[0] if hist else summary_metrics.get("totalScore"),
            "gaBestFitness": hist[-1] if hist else summary_metrics.get("totalScore"),
            "saFinalFitness": summary_metrics.get("totalScore"),
            "hardConstraintViolations": latest_run["hard_constraint_violations"] if latest_run else 0,
            "executionTimeMs": latest_run["execution_time_ms"] if latest_run else 0,
            "metrics": summary_metrics,
        },
    }


@router.get("/api/notifications")
def list_notifications(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = auth_user.get("institutionId") or ""
    user_id = auth_user.get("userId")
    role = auth_user.get("role")
    client = require_supabase_client()

    try:
        all_rows = client.select(
            "notifications",
            filters={"institution_id": f"eq.{uni_id}"},
            order="created_at.desc",
            limit=50,
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    filtered = [
        r
        for r in all_rows
        if (r.get("recipient_user_id") is None or r.get("recipient_user_id") == user_id)
        and (r.get("recipient_role") is None or r.get("recipient_role") == role)
    ]
    return {"notifications": filtered}


@router.patch("/api/notifications/{notificationId}/read")
def mark_notification_read(notificationId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    client = require_supabase_client()
    try:
        existing = client.select_one("notifications", filters={"id": f"eq.{notificationId}"})
        if not existing:
            raise HTTPException(status_code=404, detail={"error": "Notification not found."})
        assert_institution_access(auth_user, existing.get("institution_id"))
        rec_user = existing.get("recipient_user_id")
        if rec_user and rec_user != auth_user.get("userId"):
            raise HTTPException(
                status_code=403,
                detail={"error": "Access denied: Notification belongs to another user."},
            )
        client.update("notifications", {"id": f"eq.{notificationId}"}, {"is_read": True})
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Notification marked as read."}
