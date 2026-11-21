"""Adaptive Tabu Search rescheduling disruption & proposal endpoints (Supabase PostgreSQL)."""

from __future__ import annotations

import uuid
from typing import Any, Dict

from app.database.supabase import SupabaseQueryError, require_supabase_client
from app.deps import (
    ADMIN_ROLES,
    CATALOG_MANAGER_ROLES,
    assert_institution_access,
    get_query_param,
    load_university_optimization_inputs,
    parse_json_body,
    raise_supabase_http_error,
    require_auth_user,
    scoped_uni_id,
    write_audit_log,
)
from app.optimization.rescheduler import generate_rescheduling_proposal
from app.optimization.scheduler import run_hybrid_timetable_pipeline
from app.routers.optimization import _build_timetable_entries
from database import now_iso
from fastapi_compat import APIRouter, HTTPException, Request

router = APIRouter(tags=["rescheduling"])

ALLOWED_DISRUPTION_TYPES = {
    "instructor_unavailable",
    "lab_engineer_unavailable",
    "room_unavailable",
    "lab_unavailable",
    "forced_course_move",
    "operating_hours_changed",
    "capacity_or_equipment_changed",
    "admin_slot_adjustment",
}


@router.post("/api/rescheduling/disruptions")
async def report_disruption_and_reschedule(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(
        request,
        allowed_roles=[*CATALOG_MANAGER_ROLES, "faculty", "instructor", "br"],
    )
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))

    raw_type = str(body.get("type") or body.get("disruptionType") or "instructor_unavailable").strip()
    disruption_type = raw_type if raw_type in ALLOWED_DISRUPTION_TYPES else "admin_slot_adjustment"
    title = str(body.get("title") or f"Disruption: {disruption_type}").strip()
    description = str(
        body.get("description") or "Dynamic schedule disruption requiring minimal-change Tabu Search recovery."
    ).strip()
    if title and title not in description:
        full_description = f"{title}: {description}"
    else:
        full_description = description

    inputs = load_university_optimization_inputs(uni_id, body)
    client = require_supabase_client()

    current_assignments = body.get("currentAssignments")
    timetable_version_id = body.get("timetableVersionId")

    if (not isinstance(current_assignments, (dict, list))) or not current_assignments:
        try:
            latest_run = client.select_one(
                "optimization_runs",
                filters={"institution_id": f"eq.{uni_id}"},
                select="timetable_version_id,assignments_snapshot",
                order="created_at.desc",
            )
            snap = latest_run.get("assignments_snapshot") if latest_run else None
            if isinstance(snap, (dict, list)) and snap:
                current_assignments = snap
                timetable_version_id = timetable_version_id or latest_run.get("timetable_version_id")
        except SupabaseQueryError as err:
            raise_supabase_http_error(err)

        if (not isinstance(current_assignments, (dict, list))) or not current_assignments:
            initial_run = run_hybrid_timetable_pipeline(
                sections=inputs["sections"],
                courses=inputs["courses"],
                rooms_raw=inputs["rooms_raw"],
                student_groups=inputs["student_groups"],
                instructors=inputs["instructors"],
                time_config=inputs["time_config"],
                weights=inputs["weights"],
                unavailable_instructor_slots=inputs["unavailable_instructor_slots"],
                unavailable_room_slots=inputs["unavailable_room_slots"],
                algorithm="hybrid_dsatur_ga_sa",
            )
            current_assignments = initial_run["assignments"]

    affected_resource_id = str(
        body.get("affectedResourceId")
        or body.get("instructorId")
        or body.get("roomId")
        or "inst-turing"
    )
    affected_days = body.get("affectedDays") or ([body["day"]] if body.get("day") else ["Mon"])
    affected_start_times = body.get("affectedStartTimes") or body.get("slots") or ["09:00", "10:00"]

    proposal_result = generate_rescheduling_proposal(
        disruption_type=disruption_type,
        affected_resource_id=affected_resource_id,
        affected_days=affected_days,
        affected_start_times=affected_start_times,
        reason=full_description,
        current_section_assignments=current_assignments,
        sections=inputs["sections"],
        courses=inputs["courses"],
        rooms_raw=inputs["rooms_raw"],
        student_groups=inputs["student_groups"],
        time_config=inputs["time_config"],
        weights=inputs["weights"],
        instructors=inputs["instructors"],
        unavailable_instructor_slots=inputs["unavailable_instructor_slots"],
        unavailable_room_slots=inputs["unavailable_room_slots"],
    )

    disruption_id = f"disr-{uuid.uuid4().hex[:8]}"
    proposal_id = f"prop-{uuid.uuid4().hex[:8]}"
    current_iso = now_iso()

    try:
        has_sync = getattr(client, "has_column", lambda t, c: True)("timetable_entries", "slot_source")
        db_disruption_type = disruption_type
        if not has_sync:
            if disruption_type == "lab_engineer_unavailable":
                db_disruption_type = "instructor_unavailable"
            elif disruption_type == "forced_course_move":
                db_disruption_type = "admin_slot_adjustment"
        client.insert(
            "disruptions",
            {
                "id": disruption_id,
                "institution_id": uni_id,
                "disruption_type": db_disruption_type,
                "affected_resource_id": affected_resource_id,
                "affected_days": [str(d) for d in affected_days],
                "affected_start_times": [str(s) for s in affected_start_times],
                "description": full_description,
                "status": "proposal_generated",
                "reported_by": auth_user.get("userId"),
                "created_at": current_iso,
            },
        )

        client.insert(
            "rescheduling_proposals",
            {
                "id": proposal_id,
                "institution_id": uni_id,
                "disruption_id": disruption_id,
                "base_timetable_version_id": timetable_version_id,
                "status": "pending_approval",
                "algorithm_used": "tabu_search",
                "affected_sessions_count": int(proposal_result["affectedSessionsCount"]),
                "changed_sessions_count": int(proposal_result["changedSessionsCount"]),
                "unchanged_sessions_count": int(proposal_result["unchangedSessionsCount"]),
                "stability_percentage": float(proposal_result["stabilityPercentage"]),
                "remaining_hard_violations": int(proposal_result["remainingHardViolations"]),
                "original_quality_score": float(proposal_result.get("originalQualityScore") or 0),
                "proposed_quality_score": float(proposal_result["proposedQualityScore"]),
                "repair_execution_time_ms": float(proposal_result["repairExecutionTimeMs"]),
                "changes_detail": proposal_result["changes"],
                "original_assignments": current_assignments,
                "proposed_assignments": proposal_result["proposedAssignments"],
                "created_at": current_iso,
                "updated_at": current_iso,
            },
        )

        client.insert(
            "rescheduling_history",
            {
                "institution_id": uni_id,
                "proposal_id": proposal_id,
                "action": "created",
                "actor_user_id": auth_user.get("userId"),
                "actor_name": auth_user.get("name") or "User",
                "notes": full_description,
                "created_at": current_iso,
            },
        )
        write_audit_log(
            client,
            uni_id,
            auth_user,
            "create",
            "scenario",
            proposal_id,
            f"Reported disruption ({disruption_type}) and generated Tabu Search proposal {proposal_id}",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {
        "disruptionId": disruption_id,
        "proposalId": proposal_id,
        "status": "Pending",
        **proposal_result,
    }


@router.get("/api/rescheduling/disruptions")
def list_disruptions(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        disruptions = client.select(
            "disruptions",
            filters={"institution_id": f"eq.{uni_id}"},
            order="created_at.desc",
            limit=50,
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"disruptions": disruptions}


@router.get("/api/rescheduling/history")
def list_rescheduling_history(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        history = client.select(
            "rescheduling_history",
            filters={"institution_id": f"eq.{uni_id}"},
            order="created_at.desc",
            limit=50,
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"history": history}


@router.get("/api/rescheduling/proposals")
def list_rescheduling_proposals(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()

    try:
        proposals = client.select(
            "rescheduling_proposals",
            filters={"institution_id": f"eq.{uni_id}"},
            order="created_at.desc",
            limit=25,
        )
        disruptions = client.select(
            "disruptions",
            filters={"institution_id": f"eq.{uni_id}"},
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    disr_by_id = {d["id"]: d for d in disruptions}
    enriched = []
    for p in proposals:
        d = disr_by_id.get(p.get("disruption_id") or "", {})
        enriched.append(
            {
                **p,
                "university_id": p["institution_id"],
                "disruption_event_id": p.get("disruption_id"),
                "timetable_version_id": p.get("base_timetable_version_id"),
                "disruption_type": d.get("disruption_type"),
                "disruption_title": d.get("disruption_type"),
                "disruption_description": d.get("description"),
                "stability_score": p.get("stability_percentage", 100.0),
                "new_fitness_score": p.get("proposed_quality_score", 0.0),
                "moved_classes_count": p.get("changed_sessions_count", 0),
                "changes": p.get("changes_detail") or [],
                "updatedEntries": p.get("proposed_assignments") or {},
            }
        )
    return {"proposals": enriched}


@router.post("/api/rescheduling/proposals/{proposalId}/approve")
def approve_rescheduling_proposal(proposalId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=ADMIN_ROLES)
    current_iso = now_iso()
    client = require_supabase_client()

    try:
        prop = client.select_one("rescheduling_proposals", filters={"id": f"eq.{proposalId}"})
        if not prop:
            raise HTTPException(status_code=404, detail={"error": "Rescheduling proposal not found."})
        assert_institution_access(auth_user, prop.get("institution_id"))
        uni_id = prop["institution_id"]

        client.update(
            "rescheduling_proposals",
            {"id": f"eq.{proposalId}"},
            {"status": "approved", "reviewed_by": auth_user.get("userId"), "updated_at": current_iso},
        )
        if prop.get("disruption_id"):
            client.update("disruptions", {"id": f"eq.{prop['disruption_id']}"}, {"status": "resolved"})

        # Archive previously published timetable versions in the same institution
        client.update(
            "timetable_versions",
            {"institution_id": f"eq.{uni_id}", "status": "eq.published"},
            {"status": "archived", "updated_at": current_iso},
        )

        new_tt_id = f"ttv-resched-{uuid.uuid4().hex[:6]}"
        client.insert(
            "timetable_versions",
            {
                "id": new_tt_id,
                "institution_id": uni_id,
                "name": f"Adaptive Rescheduled Timetable ({current_iso[:10]})",
                "version_number": "1.1.0",
                "status": "published",
                "algorithm_used": "tabu_search",
                "hard_violations_count": int(prop.get("remaining_hard_violations") or 0),
                "overall_fitness_score": float(prop.get("proposed_quality_score") or 0.0),
                "created_by": auth_user.get("userId"),
                "approved_by": auth_user.get("userId"),
                "published_at": current_iso,
                "created_at": current_iso,
            },
        )

        proposed_assign = prop.get("proposed_assignments")
        if isinstance(proposed_assign, dict) and proposed_assign:
            inputs = load_university_optimization_inputs(uni_id)
            entries = _build_timetable_entries(
                uni_id=uni_id,
                version_id=new_tt_id,
                assignments=proposed_assign,
                sections=inputs["sections"],
                courses=inputs["courses"],
                period_len=inputs["time_config"].period_length_minutes,
                lab_len=inputs["time_config"].lab_duration_minutes,
            )
            if entries:
                client.insert("timetable_entries", entries)

            client.insert(
                "optimization_runs",
                {
                    "id": f"opt-{uuid.uuid4().hex[:8]}",
                    "institution_id": uni_id,
                    "timetable_version_id": new_tt_id,
                    "algorithm": "tabu_reschedule",
                    "status": "completed",
                    "total_sessions": len(proposed_assign),
                    "placed_sessions": len(proposed_assign),
                    "hard_constraint_violations": int(prop.get("remaining_hard_violations") or 0),
                    "execution_time_ms": float(prop.get("repair_execution_time_ms") or 0.0),
                    "parameters": {
                        "stabilityScore": prop.get("stability_percentage", 100.0),
                        "movedClasses": prop.get("changed_sessions_count", 0),
                    },
                    "assignments_snapshot": proposed_assign,
                    "created_by": auth_user.get("userId"),
                    "created_at": current_iso,
                },
            )

        client.insert(
            "rescheduling_history",
            {
                "institution_id": uni_id,
                "proposal_id": proposalId,
                "action": "approved",
                "actor_user_id": auth_user.get("userId"),
                "actor_name": auth_user.get("name") or "Administrator",
                "created_at": current_iso,
            },
        )

        changes = prop.get("changes_detail") or []
        client.insert(
            "notifications",
            {
                "institution_id": uni_id,
                "recipient_user_id": None,
                "recipient_role": None,
                "title": "Adaptive Schedule Update Approved",
                "message": (
                    f"Tabu Search adaptive rescheduling updated {len(changes)} session(s) while preserving "
                    f"{prop.get('stability_percentage', 100)}% schedule stability."
                ),
                "notification_type": "timetable_update",
                "is_read": False,
                "created_at": current_iso,
            },
        )
        write_audit_log(
            client,
            uni_id,
            auth_user,
            "publish",
            "scenario",
            new_tt_id,
            f"Approved rescheduling proposal {proposalId} and published {new_tt_id}",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {
        "message": "Rescheduling proposal approved and published.",
        "timetableVersionId": new_tt_id,
        "proposalId": proposalId,
    }


@router.post("/api/rescheduling/proposals/{proposalId}/reject")
def reject_rescheduling_proposal(proposalId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=ADMIN_ROLES)
    current_iso = now_iso()
    client = require_supabase_client()
    try:
        prop = client.select_one("rescheduling_proposals", filters={"id": f"eq.{proposalId}"})
        if not prop:
            raise HTTPException(status_code=404, detail={"error": "Rescheduling proposal not found."})
        assert_institution_access(auth_user, prop.get("institution_id"))

        client.update(
            "rescheduling_proposals",
            {"id": f"eq.{proposalId}"},
            {"status": "rejected", "reviewed_by": auth_user.get("userId"), "updated_at": current_iso},
        )
        client.insert(
            "rescheduling_history",
            {
                "institution_id": prop["institution_id"],
                "proposal_id": proposalId,
                "action": "rejected",
                "actor_user_id": auth_user.get("userId"),
                "actor_name": auth_user.get("name") or "Administrator",
                "created_at": current_iso,
            },
        )
        write_audit_log(
            client,
            prop["institution_id"],
            auth_user,
            "update",
            "scenario",
            proposalId,
            f"Rejected rescheduling proposal {proposalId}",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Rescheduling proposal rejected.", "proposalId": proposalId}
