"""Hybrid AI Optimization (DSatur + GA + SA) and Validation endpoints (Supabase PostgreSQL)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List

from app.database.supabase import SupabaseQueryError, require_supabase_client
from app.deps import (
    CATALOG_MANAGER_ROLES,
    get_query_param,
    load_university_optimization_inputs,
    parse_json_body,
    raise_supabase_http_error,
    require_auth_user,
    safe_insert_optional,
    scoped_uni_id,
    write_audit_log,
)
from app.optimization.constraints import expand_sections_to_sessions, normalize_rooms_input
from app.optimization.evaluation import compare_optimization_algorithms
from app.optimization.fitness import _coerce_slot_dict
from app.optimization.scheduler import run_hybrid_timetable_pipeline
from app.optimization.validator import validate_timetable_assignments
from app.services.assignment_validation import validate_sections_for_optimization
from database import now_iso
from fastapi_compat import APIRouter, HTTPException, Request

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
        is_lab = stype.lower() == "lab"
        dur = int(assign.get("durationMinutes") or (lab_len if is_lab else period_len))
        room_id = str(assign.get("roomId") or "room-lh-101")
        course_code = str(sec.get("courseCode") or crs.get("code") or sec_id)
        course_title = str(crs.get("title") or course_code)

        meetings = assign.get("meetings") if isinstance(assign.get("meetings"), list) and assign["meetings"] else [
            {"day": assign.get("day"), "startTime": assign.get("startTime"), "durationMinutes": dur, "roomId": room_id},
            {"day": assign.get("secondDay"), "startTime": assign.get("secondStartTime"), "durationMinutes": dur, "roomId": room_id},
            {"day": assign.get("thirdDay"), "startTime": assign.get("thirdStartTime"), "durationMinutes": dur, "roomId": room_id},
        ]
        for mt in meetings:
            day = mt.get("day")
            start_t = mt.get("startTime")
            if not day or not start_t:
                continue
            m_dur = int(mt.get("durationMinutes") or dur)
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
                    "lab_engineer_id": sec.get("labEngineerId"),
                    "room_id": str(mt.get("roomId") or room_id),
                    "day_of_week": str(day)[:3],
                    "start_time": str(start_t),
                    "end_time": _compute_end_time(str(start_t), m_dur),
                    "duration_minutes": m_dur,
                    "session_type": stype,
                    "component_type": "lab" if is_lab else "lecture",
                    "slot_source": "regular",
                    "is_locked": False,
                }
            )
    return rows


def _build_timetable_entries_from_canonical(
    uni_id: str,
    version_id: str,
    canonical_entries: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for e in canonical_entries:
        rows.append(
            {
                "institution_id": uni_id,
                "timetable_version_id": version_id,
                "course_session_id": str(e.get("sectionId") or e.get("sessionId") or ""),
                "course_code": str(e.get("courseCode") or ""),
                "course_title": str(e.get("courseTitle") or ""),
                "batch_id": e.get("batchId"),
                "section_code": str(e.get("sectionCode") or "A"),
                "instructor_id": e.get("instructorId") or None,
                "lab_engineer_id": e.get("labEngineerId") or None,
                "room_id": str(e.get("roomId") or "room-lh-101"),
                "day_of_week": str(e.get("day") or "Mon")[:3],
                "start_time": str(e.get("startTime") or "09:00"),
                "end_time": str(e.get("endTime") or _compute_end_time(str(e.get("startTime") or "09:00"), int(e.get("durationMinutes") or 50))),
                "duration_minutes": int(e.get("durationMinutes") or 50),
                "session_type": str(e.get("sessionType") or "Theory"),
                "component_type": str(e.get("componentType") or "lecture"),
                "slot_source": str(e.get("slotSource") or "regular"),
                "is_locked": bool(e.get("isLocked", False)),
            }
        )
    return rows


@router.post("/api/optimization/run")
async def run_optimization(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))

    inputs = load_university_optimization_inputs(uni_id, body)
    readiness = validate_sections_for_optimization(
        uni_id=uni_id,
        sections=inputs["sections"],
        courses=inputs["courses"],
        rooms_raw=inputs["rooms_raw"],
        instructors=inputs["instructors"],
    )
    if not readiness["ready"]:
        raise HTTPException(
            status_code=422,
            detail={
                "error": (
                    f"Cannot generate timetable: {readiness['blockerCount']} course offering(s) "
                    "have missing or invalid instructor, lab engineer, or laboratory assignments."
                ),
                "readiness": readiness,
            },
        )

    hyperparams = body.get("hyperparameters") or {}
    objective_weights = body.get("weights") or {}
    requested_algo = str(body.get("algorithm") or "hybrid_dsatur_ga_sa").strip()
    algorithm = requested_algo if requested_algo in ALLOWED_ALGORITHMS else "hybrid_dsatur_ga_sa"

    pipeline_result = run_hybrid_timetable_pipeline(
        sections=inputs["sections"],
        courses=inputs["courses"],
        rooms_raw=inputs["rooms_raw"],
        student_groups=inputs["student_groups"],
        instructors=inputs["instructors"],
        time_config=inputs["time_config"],
        weights=inputs["weights"],
        algorithm=algorithm,
        student_preferences=inputs["student_preferences"],
        instructor_preferences=inputs["instructor_preferences"],
        unavailable_instructor_slots=inputs["unavailable_instructor_slots"],
        unavailable_room_slots=inputs["unavailable_room_slots"],
    )

    run_id = f"opt-{uuid.uuid4().hex[:8]}"
    version_id = f"ttv-{uuid.uuid4().hex[:8]}"
    current_iso = now_iso()

    fb = pipeline_result["fitness"]
    hist = pipeline_result.get("fitnessHistory") or [fb["totalScore"]]
    hard_violations = int(pipeline_result["hardConstraintViolations"])
    is_feasible = bool(pipeline_result.get("feasible")) and hard_violations == 0
    version_status = "draft"
    exec_ms = float(pipeline_result["executionTimeMs"])
    version_name = body.get("versionName") or f"Hybrid AI Schedule ({current_iso[:10]})"

    voting_traceability = list(inputs.get("voting_traceability") or [])
    voting_config = dict(inputs.get("voting_config") or {})

    client = require_supabase_client()
    try:
        # 1. Insert timetable_versions FIRST (always as draft for administrative review; never auto-publishing or auto-archiving existing published versions)
        client.insert(
            "timetable_versions",
            {
                "id": version_id,
                "institution_id": uni_id,
                "name": version_name,
                "version_number": "1.0.0",
                "status": "draft",
                "algorithm_used": algorithm,
                "hard_violations_count": hard_violations,
                "overall_fitness_score": float(fb["totalScore"]),
                "student_satisfaction_score": float(fb["studentSatisfaction"]),
                "instructor_satisfaction_score": float(fb["instructorSatisfaction"]),
                "room_utilization_score": float(fb["roomUtilization"]),
                "fairness_score": float(fb["fairnessScore"]),
                "created_by": auth_user.get("userId"),
                "published_at": None,
                "created_at": current_iso,
            },
        )

        # 3. Validate FKs and insert normalized timetable_entries (chunked in SupabaseRestClient)
        valid_course_ids: set[str] = set()
        valid_batch_ids: set[str] = set()
        valid_instructor_ids: set[str] = set()
        course_req_room: Dict[str, str] = {}
        existing_sessions_by_id: Dict[str, Dict[str, Any]] = {}
        try:
            existing_courses = client.select("courses", filters={"institution_id": f"eq.{uni_id}"}, select="id,required_room_type")
            existing_batches = client.select("batches", filters={"institution_id": f"eq.{uni_id}"}, select="id")
            existing_instructors = client.select("instructors", filters={"institution_id": f"eq.{uni_id}"}, select="id")
            existing_sessions = client.select(
                "course_sessions",
                filters={"institution_id": f"eq.{uni_id}"},
                select="id,institution_id,course_id,batch_id,section_code,session_type,component_type,sessions_per_week,duration_minutes,expected_students,required_room_type,instructor_id,lab_engineer_id",
            )
            valid_course_ids = {c["id"] for c in existing_courses}
            course_req_room = {c["id"]: c.get("required_room_type") or "lecture" for c in existing_courses}
            valid_batch_ids = {b["id"] for b in existing_batches}
            valid_instructor_ids = {i["id"] for i in existing_instructors}
            existing_sessions_by_id = {s["id"]: s for s in existing_sessions}
        except Exception:
            pass

        entries = _build_timetable_entries_from_canonical(
            uni_id=uni_id,
            version_id=version_id,
            canonical_entries=pipeline_result.get("entries") or [],
        )
        if entries:
            for e in entries:
                if valid_batch_ids and e.get("batch_id") not in valid_batch_ids:
                    e["batch_id"] = None
                if valid_instructor_ids:
                    if e.get("instructor_id") not in valid_instructor_ids:
                        e["instructor_id"] = None
                    if e.get("lab_engineer_id") not in valid_instructor_ids:
                        e["lab_engineer_id"] = None
            client.insert("timetable_entries", entries)

        # Persist auto-generated course_sessions rows and batch-upsert assigned slots (no N+1 PATCHes!)
        try:
            first_entry_by_sec: Dict[str, Dict[str, Any]] = {}
            for e in entries:
                cs_id = str(e.get("course_session_id") or "")
                if cs_id and cs_id not in first_entry_by_sec:
                    first_entry_by_sec[cs_id] = e

            upsert_session_rows: List[Dict[str, Any]] = []
            seen_sec_ids: set[str] = set()
            for sec in inputs.get("sections") or []:
                sec_id = str(sec.get("id") or "").strip()
                if not sec_id or sec_id in seen_sec_ids:
                    continue
                seen_sec_ids.add(sec_id)
                matched_entry = first_entry_by_sec.get(sec_id)
                slot_json = None
                if matched_entry:
                    e_is_lab = str(matched_entry.get("session_type") or "").lower() == "lab" or str(matched_entry.get("component_type") or "").lower() == "lab"
                    slot_json = {
                        "day": matched_entry.get("day_of_week"),
                        "startTime24": matched_entry.get("start_time"),
                        "endTime24": matched_entry.get("end_time"),
                        "timeSlot": matched_entry.get("start_time"),
                        "roomId": matched_entry.get("room_id"),
                        "durationMinutes": int(matched_entry.get("duration_minutes") or (180 if e_is_lab else 50)),
                        "sessionType": "Lab" if e_is_lab else "Lecture",
                        "spanSlots": 3 if e_is_lab else 1,
                        "slotSource": matched_entry.get("slot_source") or "regular",
                    }

                existing_row = existing_sessions_by_id.get(sec_id)
                if existing_row is None:
                    c_id = str(sec.get("courseId") or sec.get("course_id") or "")
                    b_id = str(sec.get("studentGroupId") or sec.get("batchId") or sec.get("batch_id") or "")
                    if c_id in valid_course_ids and b_id in valid_batch_ids:
                        s_type_raw = str(sec.get("sessionType") or sec.get("session_type") or "Theory").strip()
                        is_lab = s_type_raw.lower() == "lab" or str(sec.get("componentType") or "").lower() == "lab"
                        sess_type = "Lab" if is_lab else ("Tutorial" if s_type_raw.lower() == "tutorial" else "Theory")
                        comp_type = "lab" if is_lab else ("tutorial" if sess_type == "Tutorial" else "lecture")
                        raw_req_room = str(sec.get("requiredRoomType") or course_req_room.get(c_id) or ("lab" if is_lab else "lecture")).lower()
                        req_room = "lab" if is_lab else (raw_req_room if raw_req_room in ("lecture", "lab", "seminar") else "lecture")
                        inst_id = sec.get("instructorId") or sec.get("instructor_id")
                        lab_eng_id = sec.get("labEngineerId") or sec.get("lab_engineer_id")
                        dur_min = max(30, min(300, int(sec.get("durationMinutes") or (180 if is_lab else 50))))
                        spw_val = max(1, min(6, int(sec.get("sessionsPerWeek") or 1)))
                        exp_stu = max(1, int(sec.get("enrollment") or sec.get("expectedEnrollment") or 45))
                        upsert_session_rows.append(
                            {
                                "id": sec_id,
                                "institution_id": uni_id,
                                "term_id": sec.get("termId") or body.get("termId") or None,
                                "program_id": sec.get("programId") or None,
                                "course_id": c_id,
                                "instructor_id": inst_id if inst_id in valid_instructor_ids else None,
                                "lab_engineer_id": lab_eng_id if lab_eng_id in valid_instructor_ids else None,
                                "assigned_lab_id": sec.get("assignedLabId") or None,
                                "batch_id": b_id,
                                "shared_group_ids": sec.get("sharedGroupIds") if isinstance(sec.get("sharedGroupIds"), list) else [],
                                "section_code": str(sec.get("sectionCode") or sec.get("sectionNumber") or "A"),
                                "session_type": sess_type,
                                "component_type": comp_type,
                                "is_atomic_session": bool(sec.get("isAtomicSession", True)),
                                "span_slots": max(1, int(sec.get("spanSlots") or (3 if is_lab else 1))),
                                "sessions_per_week": spw_val,
                                "duration_minutes": dur_min,
                                "expected_students": exp_stu,
                                "required_room_type": req_room,
                                "assignment_status": "assigned",
                                "assigned_day": matched_entry.get("day_of_week") if matched_entry else None,
                                "assigned_start_time": matched_entry.get("start_time") if matched_entry else None,
                                "assigned_room_id": matched_entry.get("room_id") if matched_entry else None,
                                "assigned_slot_json": slot_json,
                                "is_locked": bool(sec.get("isLocked", False)),
                                "created_at": current_iso,
                            }
                        )
                elif matched_entry and slot_json:
                    upsert_session_rows.append(
                        {
                            "id": sec_id,
                            "institution_id": uni_id,
                            "course_id": existing_row["course_id"],
                            "batch_id": existing_row["batch_id"],
                            "instructor_id": existing_row.get("instructor_id"),
                            "lab_engineer_id": existing_row.get("lab_engineer_id"),
                            "assigned_lab_id": existing_row.get("assigned_lab_id"),
                            "section_code": existing_row.get("section_code") or "A",
                            "session_type": existing_row.get("session_type") or "Theory",
                            "component_type": existing_row.get("component_type") or "lecture",
                            "sessions_per_week": int(existing_row.get("sessions_per_week") or 1),
                            "duration_minutes": int(existing_row.get("duration_minutes") or 50),
                            "expected_students": int(existing_row.get("expected_students") or 45),
                            "required_room_type": existing_row.get("required_room_type") or "lecture",
                            "assigned_day": matched_entry.get("day_of_week"),
                            "assigned_start_time": matched_entry.get("start_time"),
                            "assigned_room_id": matched_entry.get("room_id"),
                            "assigned_slot_json": slot_json,
                        }
                    )
            if upsert_session_rows:
                client.insert("course_sessions", upsert_session_rows, upsert=True, on_conflict="id")
        except Exception:
            # Never block optimization persistence if optional session sync hits a legacy schema mismatch
            pass

        # 4. Insert optimization_runs
        db_run_status = "completed" if (is_feasible or not getattr(client, "has_column", lambda t, c: True)("timetable_entries", "slot_source")) else "needs_review"
        snapshot_data = (
            pipeline_result["assignments"]
            if len(entries) > 400
            else (pipeline_result.get("entries") or pipeline_result["assignments"])
        )
        client.insert(
            "optimization_runs",
            {
                "id": run_id,
                "institution_id": uni_id,
                "timetable_version_id": version_id,
                "algorithm": algorithm,
                "status": db_run_status,
                "total_sessions": int(pipeline_result.get("totalSessions") or len(inputs["sections"])),
                "placed_sessions": int(pipeline_result.get("placedSessions") or len(pipeline_result["assignments"])),
                "hard_constraint_violations": hard_violations,
                "execution_time_ms": exec_ms,
                "parameters": {
                    "runStatus": "completed" if is_feasible else "needs_review",
                    "hyperparameters": hyperparams,
                    "objectiveWeights": objective_weights,
                    "fitnessHistory": hist,
                    "summaryMetrics": fb,
                    "timeConfig": pipeline_result.get("timeConfig"),
                    "preValidation": pipeline_result.get("preValidation"),
                    "votingConfig": voting_config,
                    "votingTraceability": voting_traceability,
                },
                "assignments_snapshot": snapshot_data,
                "created_by": auth_user.get("userId"),
                "created_at": current_iso,
            },
        )

        # 5. Insert optimization_scores
        batch_breakdown = fb.get("batchSatisfactionByBatch") or fb.get("batchBreakdown") or {}
        least_batch = fb.get("leastSatisfiedBatchScore") or (min(batch_breakdown.values()) if batch_breakdown else float(fb["studentSatisfaction"]))
        client.insert(
            "optimization_scores",
            {
                "institution_id": uni_id,
                "optimization_run_id": run_id,
                "total_fitness_score": float(fb["totalScore"]),
                "student_satisfaction_score": float(fb["studentSatisfaction"]),
                "instructor_satisfaction_score": float(fb["instructorSatisfaction"]),
                "compactness_score": float(fb["compactnessScore"]),
                "student_gap_penalty": float(fb.get("studentGapMinutesAvg", fb.get("studentGapPenalty", 0.0))),
                "workload_balance_score": float(fb.get("workloadBalanceScore", fb.get("workloadBalance", 0.0))),
                "fairness_score": float(fb["fairnessScore"]),
                "least_satisfied_batch_score": float(least_batch),
                "room_utilization_score": float(fb["roomUtilization"]),
                "batch_satisfaction_breakdown": batch_breakdown,
                "created_at": current_iso,
            },
        )

        # 6. Persist optimization_poll_traceability rows if any voting polls influenced this run
        if voting_traceability:
            trace_rows = [
                {
                    "id": f"opt-trace-{uuid.uuid4().hex[:10]}",
                    "institution_id": uni_id,
                    "optimization_run_id": run_id,
                    "timetable_version_id": version_id,
                    "poll_id": tr.get("pollId"),
                    "batch_id": tr.get("batchId"),
                    "poll_category": tr.get("pollCategory"),
                    "winning_option": tr.get("winningOption"),
                    "win_percentage": float(tr.get("winPercentage") or 0.0),
                    "participation_percentage": float(tr.get("participationPercentage") or 0.0),
                    "preference_strength": float(tr.get("preferenceStrength") or 0.0),
                    "normalized_weight": float(tr.get("normalizedWeight") or 0.0),
                    "low_participation_flag": bool(tr.get("isLowParticipation", False)),
                    "created_at": current_iso,
                }
                for tr in voting_traceability
            ]
            safe_insert_optional(client, "optimization_poll_traceability", trace_rows)

        write_audit_log(
            client,
            uni_id,
            auth_user,
            "generate",
            "scenario",
            version_id,
            f"Generated {algorithm} schedule '{version_name}' ({hard_violations} hard violations)",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {
        "runId": run_id,
        "timetableVersionId": version_id,
        "status": version_status,
        "votingConfig": voting_config,
        "votingTraceability": voting_traceability,
        **pipeline_result,
    }


@router.post("/api/optimization/validate")
async def validate_timetable_endpoint(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    inputs = load_university_optimization_inputs(uni_id, body)
    norm_rooms = normalize_rooms_input(inputs["rooms_raw"])
    sessions = expand_sections_to_sessions(
        courses=inputs["courses"],
        sections=inputs["sections"],
        rooms=norm_rooms,
        instructors=inputs["instructors"],
        time_config=inputs["time_config"],
    )

    candidate_assignments = body.get("assignments") or {}
    report = validate_timetable_assignments(
        candidate_assignments,
        sessions,
        norm_rooms,
        inputs["time_config"],
        instructors=inputs["instructors"],
        unavailable_instructor_slots=_coerce_slot_dict(inputs["unavailable_instructor_slots"]),
        unavailable_room_slots=_coerce_slot_dict(inputs["unavailable_room_slots"]),
    )
    return {
        "valid": report.is_valid,
        "validationReport": report.to_dict(),
    }


@router.post("/api/optimization/compare")
async def compare_optimization(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    inputs = load_university_optimization_inputs(uni_id, body)

    comparison = compare_optimization_algorithms(
        sections=inputs["sections"],
        courses=inputs["courses"],
        rooms_raw=inputs["rooms_raw"],
        student_groups=inputs["student_groups"],
        time_config=inputs["time_config"],
        weights=inputs["weights"],
        instructors=inputs["instructors"],
        student_preferences=inputs["student_preferences"],
        instructor_preferences=inputs["instructor_preferences"],
        unavailable_instructor_slots=inputs["unavailable_instructor_slots"],
        unavailable_room_slots=inputs["unavailable_room_slots"],
    )
    return comparison


@router.get("/api/optimization/runs")
def list_optimization_runs(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
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
