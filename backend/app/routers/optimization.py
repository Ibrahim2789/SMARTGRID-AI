"""Hybrid AI Optimization (DSatur + GA + SA) endpoints (Supabase PostgreSQL)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List

from app.database.supabase import SupabaseQueryError, require_supabase_client
from app.deps import (
    get_query_param,
    load_university_optimization_inputs,
    parse_json_body,
    raise_supabase_http_error,
    require_auth_user,
)
from app.optimization.evaluation import compare_optimization_algorithms
from app.optimization.scheduler import run_hybrid_timetable_pipeline
from database import now_iso
from fastapi_compat import APIRouter, Request

router = APIRouter(tags=["optimization"])

ALLOWED_ALGORITHMS = {"dsatur_only", "ga_only", "ga_sa", "hybrid_dsatur_ga_sa", "tabu_reschedule"}


def _compute_end_time(start_hhmm: str, duration_minutes: int) -> str:
    try:
        dt = datetime.strptime(start_hhmm, "%H:%M") + timedelta(minutes=duration_minutes)
        return dt.strftime("%H:%M")
    except Exception:
        return start_hhmm


def _build_timetable_entries(
    uni_id: str,
    version_id: str,
    assignments: Dict[str, Dict[str, Any]],
    sections: List[Dict[str, Any]],
    courses: List[Dict[str, Any]],
    period_len: int,
    lab_len: int,
) -> List[Dict[str, Any]]:
    sec_by_id = {str(s.get("id")): s for s in sections}
    course_by_id = {str(c.get("id")): c for c in courses}
    rows: List[Dict[str, Any]] = []

    for sec_id, assign in assignments.items():
        if not isinstance(assign, dict):
            continue
        sec = sec_by_id.get(str(sec_id), {})
        crs = course_by_id.get(str(sec.get("courseId") or ""), {})
        stype = str(sec.get("sessionType") or crs.get("type") or "Theory")
        dur = lab_len if stype.lower() == "lab" else period_len
        room_id = str(assign.get("roomId") or "room-lh-101")
        course_code = str(sec.get("courseCode") or crs.get("code") or sec_id)
        course_title = str(crs.get("title") or course_code)

        meetings = [
            (assign.get("day"), assign.get("startTime")),
            (assign.get("secondDay"), assign.get("secondStartTime")),
            (assign.get("thirdDay"), assign.get("thirdStartTime")),
        ]
        for day, start_t in meetings:
            if not day or not start_t:
                continue
            rows.append(
                {
                    "institution_id": uni_id,
                    "timetable_version_id": version_id,
                    "course_session_id": str(sec_id),
                    "course_code": course_code,
                    "course_title": course_title,
                    "batch_id": sec.get("studentGroupId"),
                    "section_code": str(sec.get("sectionCode") or "A"),
                    "instructor_id": sec.get("instructorId"),
                    "room_id": room_id,
                    "day_of_week": str(day)[:3],
                    "start_time": str(start_t),
                    "end_time": _compute_end_time(str(start_t), dur),
                    "duration_minutes": dur,
                    "session_type": stype,
                    "is_locked": False,
                }
            )
    return rows


@router.post("/api/optimization/run")
async def run_optimization(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=["admin", "faculty", "br", "student"])
    body = await parse_json_body(request)
    uni_id = body.get("universityId") or auth_user.get("institutionId") or "inst-western-poly"

    inputs = load_university_optimization_inputs(uni_id, body)
    hyperparams = body.get("hyperparameters") or {}
    objective_weights = body.get("weights") or {}
    requested_algo = str(body.get("algorithm") or "hybrid_dsatur_ga_sa").strip()
    algorithm = requested_algo if requested_algo in ALLOWED_ALGORITHMS else "hybrid_dsatur_ga_sa"

    pipeline_result = run_hybrid_timetable_pipeline(
        sections=inputs["sections"],
        courses=inputs["courses"],
        rooms_raw=inputs["rooms_raw"],
        student_groups=inputs["student_groups"],
        time_config=inputs["time_config"],
        weights=inputs["weights"],
        algorithm=algorithm,
    )

    run_id = f"opt-{uuid.uuid4().hex[:8]}"
    version_id = f"ttv-{uuid.uuid4().hex[:8]}"
    current_iso = now_iso()

    fb = pipeline_result["fitness"]
    hist = pipeline_result.get("fitnessHistory") or [fb["totalScore"]]
    hard_violations = int(pipeline_result["hardConstraintViolations"])
    exec_ms = float(pipeline_result["executionTimeMs"])
    version_name = body.get("versionName") or f"Hybrid AI Schedule ({current_iso[:10]})"

    client = require_supabase_client()
    try:
        # 1. Insert timetable_versions FIRST (referenced by optimization_runs.timetable_version_id)
        client.insert(
            "timetable_versions",
            {
                "id": version_id,
                "institution_id": uni_id,
                "name": version_name,
                "version_number": "1.0.0",
                "status": "published",
                "algorithm_used": algorithm,
                "hard_violations_count": hard_violations,
                "overall_fitness_score": float(fb["totalScore"]),
                "student_satisfaction_score": float(fb["studentSatisfaction"]),
                "instructor_satisfaction_score": float(fb["instructorSatisfaction"]),
                "room_utilization_score": float(fb["roomUtilization"]),
                "fairness_score": float(fb["fairnessScore"]),
                "created_by": auth_user.get("userId"),
                "published_at": current_iso,
                "created_at": current_iso,
            },
        )

        # 2. Insert normalized timetable_entries
        entries = _build_timetable_entries(
            uni_id=uni_id,
            version_id=version_id,
            assignments=pipeline_result["assignments"],
            sections=inputs["sections"],
            courses=inputs["courses"],
            period_len=inputs["time_config"].period_length_minutes,
            lab_len=inputs["time_config"].lab_duration_minutes,
        )
        if entries:
            client.insert("timetable_entries", entries)

        # 3. Insert optimization_runs
        client.insert(
            "optimization_runs",
            {
                "id": run_id,
                "institution_id": uni_id,
                "timetable_version_id": version_id,
                "algorithm": algorithm,
                "status": "completed",
                "total_sessions": int(pipeline_result.get("totalSessions") or len(inputs["sections"])),
                "placed_sessions": int(pipeline_result.get("placedSessions") or len(pipeline_result["assignments"])),
                "hard_constraint_violations": hard_violations,
                "execution_time_ms": exec_ms,
                "parameters": {
                    "hyperparameters": hyperparams,
                    "objectiveWeights": objective_weights,
                    "fitnessHistory": hist,
                    "summaryMetrics": fb,
                },
                "assignments_snapshot": pipeline_result["assignments"],
                "created_by": auth_user.get("userId"),
                "created_at": current_iso,
            },
        )

        # 4. Insert optimization_scores
        batch_breakdown = fb.get("batchSatisfactionByBatch") or {}
        least_batch = min(batch_breakdown.values()) if batch_breakdown else float(fb["studentSatisfaction"])
        client.insert(
            "optimization_scores",
            {
                "institution_id": uni_id,
                "optimization_run_id": run_id,
                "total_fitness_score": float(fb["totalScore"]),
                "student_satisfaction_score": float(fb["studentSatisfaction"]),
                "instructor_satisfaction_score": float(fb["instructorSatisfaction"]),
                "compactness_score": float(fb["compactnessScore"]),
                "student_gap_penalty": float(fb["studentGapMinutesAvg"]),
                "workload_balance_score": float(fb["workloadBalanceScore"]),
                "fairness_score": float(fb["fairnessScore"]),
                "least_satisfied_batch_score": float(least_batch),
                "room_utilization_score": float(fb["roomUtilization"]),
                "batch_satisfaction_breakdown": batch_breakdown,
                "created_at": current_iso,
            },
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {
        "runId": run_id,
        "timetableVersionId": version_id,
        **pipeline_result,
    }


@router.post("/api/optimization/compare")
async def compare_optimization(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    body = await parse_json_body(request)
    uni_id = body.get("universityId") or auth_user.get("institutionId") or "inst-western-poly"
    inputs = load_university_optimization_inputs(uni_id, body)

    comparison = compare_optimization_algorithms(
        sections=inputs["sections"],
        courses=inputs["courses"],
        rooms_raw=inputs["rooms_raw"],
        student_groups=inputs["student_groups"],
        time_config=inputs["time_config"],
        weights=inputs["weights"],
    )
    return comparison


@router.get("/api/optimization/runs")
def list_optimization_runs(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = get_query_param(request, "universityId", "") or auth_user.get("institutionId") or "inst-western-poly"
    client = require_supabase_client()
    try:
        runs = client.select(
            "optimization_runs",
            filters={"institution_id": f"eq.{uni_id}"},
            order="created_at.desc",
            limit=25,
        )
        scores = client.select(
            "optimization_scores",
            filters={"institution_id": f"eq.{uni_id}"},
            order="created_at.desc",
            limit=100,
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    enriched_runs = []
    for r in runs:
        params = r.get("parameters") if isinstance(r.get("parameters"), dict) else {}
        hist = params.get("fitnessHistory") or []
        summary = params.get("summaryMetrics") or {}
        enriched_runs.append(
            {
                **r,
                "university_id": r["institution_id"],
                "algorithm_pipeline": r["algorithm"],
                "hyperparameters": params.get("hyperparameters") or {},
                "objective_weights": params.get("objectiveWeights") or {},
                "convergence_history": hist,
                "summary_metrics": summary,
                "dsatur_initial_fitness": hist[0] if hist else summary.get("totalScore"),
                "ga_best_fitness": hist[-1] if hist else summary.get("totalScore"),
                "sa_final_fitness": summary.get("totalScore"),
            }
        )

    return {"runs": enriched_runs, "scores": scores}
