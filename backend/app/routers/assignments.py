"""
Academic Course, Instructor, Lab Engineer & Laboratory Assignment API Router (Supabase PostgreSQL).

All write routes require CATALOG_MANAGER_ROLES and enforce institution_id isolation.
Faculty / Lab Engineers have read-only access to their own assignments via /api/assignments/my-load.
Students and Batch Representatives (BR) are strictly denied access.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional, Tuple

from app.database.supabase import SupabaseQueryError, require_supabase_client
from app.deps import (
    CATALOG_MANAGER_ROLES,
    assert_institution_access,
    get_query_param,
    parse_json_body,
    raise_supabase_http_error,
    require_auth_user,
    safe_json_loads,
    scoped_uni_id,
    write_audit_log,
)
from app.services.assignment_validation import (
    _build_offering_groups,
    build_assignment_workspace_payload,
    compute_staff_workloads,
    load_institution_assignment_context,
    materialize_missing_offerings,
    validate_offering_assignment,
)
from database import now_iso
from fastapi_compat import APIRouter, HTTPException, Request

router = APIRouter(tags=["assignments"])

STAFF_VIEW_ROLES = [*CATALOG_MANAGER_ROLES, "faculty", "instructor"]


def _resolve_offering_or_404(
    ctx: Dict[str, Any],
    offering_id: str,
) -> Dict[str, Any]:
    _, lookup = _build_offering_groups(ctx)
    target = lookup.get(offering_id)
    if not target:
        raise HTTPException(
            status_code=404,
            detail={"error": f"Course offering '{offering_id}' was not found in this university."},
        )
    return target


def _persist_offering_change(
    client: Any,
    uni_id: str,
    auth_user: Dict[str, Any],
    offering: Dict[str, Any],
    next_inst_id: Optional[str],
    next_eng_id: Optional[str],
    next_lab_id: Optional[str],
    validation: Dict[str, Any],
    set_instructor: bool = True,
    set_lab_engineer: bool = True,
    set_assigned_lab: bool = True,
) -> List[Tuple[str, str, Optional[Dict[str, Any]]]]:
    """
    Persist changes for one grouped offering onto its course_sessions rows and return rollback log
    tuples: [(action: 'update'|'insert', session_id, previous_row_or_none)].
    """
    rollback_records: List[Tuple[str, str, Optional[Dict[str, Any]]]] = []
    now = now_iso()
    user_ref = str(auth_user.get("userId") or auth_user.get("email") or "admin")
    lec_rows = offering["lectureRows"]
    lab_rows = offering["labRows"]
    crs = offering["course"]
    batch = offering["batch"]
    hier = offering["hierarchy"]

    def _apply_patch(rows: List[Dict[str, Any]], patch_fields: Dict[str, Any]) -> None:
        for row in rows:
            sid = str(row["id"])
            snapshot = {k: row.get(k) for k in patch_fields.keys()}
            rollback_records.append(("update", sid, snapshot))
            client.update("course_sessions", {"id": f"eq.{sid}"}, patch_fields)

    # Lecture rows update
    if lec_rows and (set_instructor or set_lab_engineer or set_assigned_lab):
        lec_patch: Dict[str, Any] = {
            "assignment_status": validation["status"],
            "validation_errors": validation["errors"],
            "assigned_by": user_ref,
            "assigned_at": now,
        }
        if set_instructor:
            lec_patch["instructor_id"] = next_inst_id or None
        _apply_patch(lec_rows, lec_patch)

    # Lab rows update or materialize if course requires lab but lab session row was not yet materialized
    if lab_rows and (set_lab_engineer or set_assigned_lab or set_instructor):
        lab_patch: Dict[str, Any] = {
            "assignment_status": validation["status"],
            "validation_errors": validation["errors"],
            "assigned_by": user_ref,
            "assigned_at": now,
        }
        if set_instructor:
            lab_patch["instructor_id"] = next_inst_id or None
        if set_lab_engineer:
            lab_patch["lab_engineer_id"] = next_eng_id or None
        if set_assigned_lab:
            lab_patch["assigned_lab_id"] = next_lab_id or None
        _apply_patch(lab_rows, lab_patch)
    elif not lab_rows and offering["labCredits"] > 0 and (set_lab_engineer or set_assigned_lab):
        new_lab_id = f"sec-{uuid.uuid4().hex[:8]}"
        new_lab_row = {
            "id": new_lab_id,
            "institution_id": uni_id,
            "term_id": offering["termId"],
            "program_id": hier["programId"] or None,
            "course_id": crs["id"],
            "instructor_id": next_inst_id or None,
            "lab_engineer_id": next_eng_id or None,
            "assigned_lab_id": next_lab_id or None,
            "batch_id": batch["id"],
            "section_code": hier["sectionCode"],
            "session_type": "Lab",
            "component_type": "lab",
            "sessions_per_week": max(1, min(6, offering["labCredits"])),
            "duration_minutes": 180,
            "expected_students": max(1, int(batch.get("student_count") or 45)),
            "required_room_type": "lab",
            "is_atomic_session": True,
            "span_slots": 3,
            "assignment_status": validation["status"],
            "validation_errors": validation["errors"],
            "assigned_by": user_ref,
            "assigned_at": now,
            "created_at": now,
        }
        rollback_records.append(("insert", new_lab_id, None))
        client.insert("course_sessions", new_lab_row)

    return rollback_records


def _rollback_offering_changes(client: Any, rollback_records: List[Tuple[str, str, Optional[Dict[str, Any]]]]) -> None:
    for action, sid, snapshot in reversed(rollback_records):
        try:
            if action == "update" and snapshot is not None:
                client.update("course_sessions", {"id": f"eq.{sid}"}, snapshot)
            elif action == "insert":
                client.delete("course_sessions", {"id": f"eq.{sid}"})
        except Exception:
            pass


@router.get("/api/assignments/workspace")
def get_assignment_workspace(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    term_id = get_query_param(request, "termId", "")
    department_id = get_query_param(request, "departmentId", "")
    cohort_code = get_query_param(request, "cohortCode", "")
    program_id = get_query_param(request, "programId", "")
    section_id = get_query_param(request, "sectionId", "") or get_query_param(request, "batchId", "")
    status_filter = get_query_param(request, "status", "")
    component_type = get_query_param(request, "componentType", "")
    search = get_query_param(request, "search", "")

    client = require_supabase_client()
    try:
        ctx = load_institution_assignment_context(client, uni_id)
        payload = build_assignment_workspace_payload(
            ctx,
            term_id=term_id,
            department_id=department_id,
            cohort_code=cohort_code,
            program_id=program_id,
            section_id=section_id,
            status_filter=status_filter,
            component_type=component_type,
            search=search,
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"universityId": uni_id, **payload}


@router.post("/api/assignments/sync-offerings")
async def sync_course_offerings(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    term_id = str(body.get("termId") or "").strip() or None
    dept_id = str(body.get("departmentId") or "").strip() or None
    course_ids = body.get("courseIds") if isinstance(body.get("courseIds"), list) else None

    client = require_supabase_client()
    try:
        res = materialize_missing_offerings(
            client,
            uni_id,
            term_id=term_id,
            department_id=dept_id,
            course_ids=course_ids,
        )
        if res["createdCount"] > 0:
            write_audit_log(
                client,
                uni_id,
                auth_user,
                "create",
                "assignment",
                "sync-offerings",
                f"Materialized {res['createdCount']} course offering section component(s) without auto-assigning fake staff",
            )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {
        "message": f"Synchronized {res['createdCount']} missing section course offering(s).",
        "createdCount": res["createdCount"],
    }


@router.post("/api/assignments/validate")
async def validate_offering_dry_run(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    offering_id = str(body.get("offeringId") or "").strip()
    if not offering_id:
        raise HTTPException(status_code=400, detail={"error": "offeringId is required."})

    client = require_supabase_client()
    try:
        ctx = load_institution_assignment_context(client, uni_id)
        offering = _resolve_offering_or_404(ctx, offering_id)

        lec_rows = offering["lectureRows"]
        lab_rows = offering["labRows"]
        next_inst = body["instructorId"] if "instructorId" in body else (lec_rows[0].get("instructor_id") if lec_rows else None)
        next_eng = body["labEngineerId"] if "labEngineerId" in body else (lab_rows[0].get("lab_engineer_id") if lab_rows else None)
        next_lab = body["assignedLabId"] if "assignedLabId" in body else (lab_rows[0].get("assigned_lab_id") if lab_rows else None)
        allow_override = bool(body.get("allowWorkloadOverride", False))

        offerings_raw, _ = _build_offering_groups(ctx)
        workloads = compute_staff_workloads(
            ctx,
            offerings_raw=offerings_raw,
            override_offering_key=offering["offeringKey"],
            override_lec_inst_id=next_inst,
            override_lab_eng_id=next_eng,
        )
        val = validate_offering_assignment(
            ctx,
            offering,
            proposed_instructor_id=next_inst,
            proposed_lab_engineer_id=next_eng,
            proposed_assigned_lab_id=next_lab,
            workloads_by_staff=workloads,
            allow_workload_override=allow_override,
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {
        "offeringId": offering["offeringKey"],
        **val,
        "updatedWorkloadPreview": {
            "instructor": workloads.get(str(next_inst or "")) if next_inst else None,
            "labEngineer": workloads.get(str(next_eng or "")) if next_eng else None,
        },
    }


@router.put("/api/assignments/offerings/{offeringId}")
async def update_single_offering_assignment(offeringId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    confirm_impact = bool(body.get("confirmTimetableImpact", False))
    allow_override = bool(body.get("allowWorkloadOverride", False))

    client = require_supabase_client()
    try:
        ctx = load_institution_assignment_context(client, uni_id)
        offering = _resolve_offering_or_404(ctx, offeringId)
        lec_rows = offering["lectureRows"]
        lab_rows = offering["labRows"]

        prev_inst = (lec_rows[0].get("instructor_id") if lec_rows else None) or None
        prev_eng = (lab_rows[0].get("lab_engineer_id") if lab_rows else None) or None
        prev_lab = (lab_rows[0].get("assigned_lab_id") if lab_rows else None) or None

        has_inst_key = "instructorId" in body
        has_eng_key = "labEngineerId" in body
        has_lab_key = "assignedLabId" in body

        next_inst = (str(body.get("instructorId") or "").strip() or None) if has_inst_key else prev_inst
        next_eng = (str(body.get("labEngineerId") or "").strip() or None) if has_eng_key else prev_eng
        next_lab = (str(body.get("assignedLabId") or "").strip() or None) if has_lab_key else prev_lab

        offerings_raw, _ = _build_offering_groups(ctx)
        workloads = compute_staff_workloads(
            ctx,
            offerings_raw=offerings_raw,
            override_offering_key=offering["offeringKey"],
            override_lec_inst_id=next_inst,
            override_lab_eng_id=next_eng,
        )
        val = validate_offering_assignment(
            ctx,
            offering,
            proposed_instructor_id=next_inst,
            proposed_lab_engineer_id=next_eng,
            proposed_assigned_lab_id=next_lab,
            workloads_by_staff=workloads,
            allow_workload_override=allow_override,
        )

        if not val["valid"]:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": val["errors"][0]["message"] if val["errors"] else "Assignment failed validation.",
                    "validation": val,
                },
            )

        staff_or_lab_changed = (next_inst != prev_inst) or (next_eng != prev_eng) or (next_lab != prev_lab)
        impact = val["timetableImpact"]
        if staff_or_lab_changed and (impact["hasPublishedImpact"] or impact["hasLockedSlot"]) and not confirm_impact:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "This offering is referenced in an active/published or locked timetable. Confirm impact before saving; published timetable versions will remain preserved until regenerated.",
                    "requiresConfirmation": True,
                    "timetableImpact": impact,
                },
            )

        _persist_offering_change(
            client,
            uni_id,
            auth_user,
            offering,
            next_inst_id=next_inst,
            next_eng_id=next_eng,
            next_lab_id=next_lab,
            validation=val,
            set_instructor=has_inst_key,
            set_lab_engineer=has_eng_key,
            set_assigned_lab=has_lab_key,
        )

        crs = offering["course"]
        hier = offering["hierarchy"]
        write_audit_log(
            client,
            uni_id,
            auth_user,
            "update",
            "assignment",
            offering["offeringKey"],
            f"Updated assignment for {crs.get('code')} ({hier['sectionLabel']})",
            previous_value=f"inst={prev_inst or 'none'},eng={prev_eng or 'none'},lab={prev_lab or 'none'}",
            new_value=f"inst={next_inst or 'none'},eng={next_eng or 'none'},lab={next_lab or 'none'}",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {
        "message": "Course offering assignment saved.",
        "offeringId": offering["offeringKey"],
        "validation": val,
    }


def _evaluate_bulk_plan(
    ctx: Dict[str, Any],
    offering_ids: List[str],
    proposed_inst_id: Optional[str],
    proposed_eng_id: Optional[str],
    proposed_lab_id: Optional[str],
    apply_instructor: bool,
    apply_lab_engineer: bool,
    apply_assigned_lab: bool,
    overwrite_existing: bool,
    allow_workload_override: bool,
) -> Dict[str, Any]:
    offerings_raw, lookup = _build_offering_groups(ctx)
    instructors_by_id = {i["id"]: i for i in ctx["instructors"] if i.get("id")}
    labs_by_id = {l["id"]: l for l in ctx["laboratories"] if l.get("id")}

    seen_keys: set[str] = set()
    targets: List[Dict[str, Any]] = []
    missing_ids: List[str] = []
    for oid in offering_ids:
        grp = lookup.get(oid)
        if not grp:
            missing_ids.append(oid)
            continue
        if grp["offeringKey"] in seen_keys:
            continue
        seen_keys.add(grp["offeringKey"])
        targets.append(grp)

    # First compute per-target effective final staff for cumulative workload simulation
    planned_changes: List[Dict[str, Any]] = []
    overrides_by_key: Dict[str, Tuple[Optional[str], Optional[str]]] = {}

    for grp in targets:
        lec_rows = grp["lectureRows"]
        lab_rows = grp["labRows"]
        cur_inst = (lec_rows[0].get("instructor_id") if lec_rows else None) or None
        cur_eng = (lab_rows[0].get("lab_engineer_id") if lab_rows else None) or None
        cur_lab = (lab_rows[0].get("assigned_lab_id") if lab_rows else None) or None

        req_lec = bool(lec_rows) or grp["lectureCredits"] > 0
        req_lab = bool(lab_rows) or grp["labCredits"] > 0

        eff_inst = cur_inst
        eff_eng = cur_eng
        eff_lab = cur_lab
        will_change_fields: List[str] = []
        will_overwrite_fields: List[str] = []
        skipped_reasons: List[str] = []

        if apply_instructor and req_lec and proposed_inst_id:
            if cur_inst and cur_inst != proposed_inst_id and not overwrite_existing:
                skipped_reasons.append("instructor_already_assigned")
                will_overwrite_fields.append("instructorId")
            else:
                if cur_inst and cur_inst != proposed_inst_id:
                    will_overwrite_fields.append("instructorId")
                if cur_inst != proposed_inst_id:
                    will_change_fields.append("instructorId")
                    eff_inst = proposed_inst_id

        if apply_lab_engineer and req_lab and proposed_eng_id:
            if cur_eng and cur_eng != proposed_eng_id and not overwrite_existing:
                skipped_reasons.append("lab_engineer_already_assigned")
                will_overwrite_fields.append("labEngineerId")
            else:
                if cur_eng and cur_eng != proposed_eng_id:
                    will_overwrite_fields.append("labEngineerId")
                if cur_eng != proposed_eng_id:
                    will_change_fields.append("labEngineerId")
                    eff_eng = proposed_eng_id

        if apply_assigned_lab and req_lab and proposed_lab_id:
            if cur_lab and cur_lab != proposed_lab_id and not overwrite_existing:
                skipped_reasons.append("laboratory_already_assigned")
                will_overwrite_fields.append("assignedLabId")
            else:
                if cur_lab and cur_lab != proposed_lab_id:
                    will_overwrite_fields.append("assignedLabId")
                if cur_lab != proposed_lab_id:
                    will_change_fields.append("assignedLabId")
                    eff_lab = proposed_lab_id

        overrides_by_key[grp["offeringKey"]] = (eff_inst, eff_eng)
        planned_changes.append(
            {
                "grp": grp,
                "curInst": cur_inst,
                "curEng": cur_eng,
                "curLab": cur_lab,
                "effInst": eff_inst,
                "effEng": eff_eng,
                "effLab": eff_lab,
                "willChangeFields": will_change_fields,
                "willOverwriteFields": will_overwrite_fields,
                "skippedReasons": skipped_reasons,
            }
        )

    # Simulate cumulative workloads across ALL modified targets simultaneously
    from copy import deepcopy

    sim_ctx = deepcopy(ctx)
    # Apply hypothetical staff IDs into sim_ctx course_sessions so compute_staff_workloads sums cumulatively
    sim_offering_raw, sim_lookup = _build_offering_groups(sim_ctx)
    for pc in planned_changes:
        okey = pc["grp"]["offeringKey"]
        sgrp = sim_lookup.get(okey)
        if not sgrp:
            continue
        for r in sgrp["lectureRows"]:
            r["instructor_id"] = pc["effInst"]
        for r in sgrp["labRows"]:
            r["lab_engineer_id"] = pc["effEng"]
            r["assigned_lab_id"] = pc["effLab"]
    cumulative_workloads = compute_staff_workloads(sim_ctx, offerings_raw=sim_offering_raw)

    preview_rows: List[Dict[str, Any]] = []
    invalid_targets: List[Dict[str, Any]] = []
    overwrite_targets: List[Dict[str, Any]] = []
    published_impact_targets: List[Dict[str, Any]] = []
    applicable_targets: List[Dict[str, Any]] = []

    for pc in planned_changes:
        grp = pc["grp"]
        val = validate_offering_assignment(
            ctx,
            grp,
            proposed_instructor_id=pc["effInst"],
            proposed_lab_engineer_id=pc["effEng"],
            proposed_assigned_lab_id=pc["effLab"],
            workloads_by_staff=cumulative_workloads,
            allow_workload_override=allow_workload_override,
        )
        crs = grp["course"]
        hier = grp["hierarchy"]
        row_summary = {
            "offeringId": grp["offeringKey"],
            "courseCode": crs["code"],
            "courseTitle": crs["title"],
            "sectionLabel": hier["sectionLabel"],
            "previousInstructorName": instructors_by_id.get(pc["curInst"] or "", {}).get("name") or "",
            "nextInstructorName": instructors_by_id.get(pc["effInst"] or "", {}).get("name") or "",
            "previousLabEngineerName": instructors_by_id.get(pc["curEng"] or "", {}).get("name") or "",
            "nextLabEngineerName": instructors_by_id.get(pc["effEng"] or "", {}).get("name") or "",
            "previousLabName": labs_by_id.get(pc["curLab"] or "", {}).get("code") or "",
            "nextLabName": labs_by_id.get(pc["effLab"] or "", {}).get("code") or "",
            "changedFields": pc["willChangeFields"],
            "overwriteFields": pc["willOverwriteFields"],
            "skippedReasons": pc["skippedReasons"],
            "valid": val["valid"],
            "errors": val["errors"],
            "warnings": val["warnings"],
            "timetableImpact": val["timetableImpact"],
            "_internal": {**pc, "validation": val},
        }
        preview_rows.append(row_summary)

        if pc["willOverwriteFields"]:
            overwrite_targets.append(row_summary)
        if not val["valid"] and pc["willChangeFields"]:
            invalid_targets.append(row_summary)
        if pc["willChangeFields"] and (val["timetableImpact"]["hasPublishedImpact"] or val["timetableImpact"]["hasLockedSlot"]):
            published_impact_targets.append(row_summary)
        if pc["willChangeFields"] and val["valid"]:
            applicable_targets.append(row_summary)

    return {
        "missingIds": missing_ids,
        "previewRows": [{k: v for k, v in r.items() if k != "_internal"} for r in preview_rows],
        "applicableCount": len(applicable_targets),
        "overwriteCount": len(overwrite_targets),
        "invalidCount": len(invalid_targets),
        "publishedImpactCount": len(published_impact_targets),
        "staffWorkloadAfterBulk": {
            sid: cumulative_workloads.get(sid)
            for sid in (proposed_inst_id, proposed_eng_id)
            if sid and sid in cumulative_workloads
        },
        "_internal_rows": preview_rows,
    }


@router.post("/api/assignments/bulk/preview")
async def preview_bulk_assignment(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    offering_ids = body.get("offeringIds") if isinstance(body.get("offeringIds"), list) else []
    if not offering_ids:
        raise HTTPException(status_code=400, detail={"error": "Select at least one course offering."})

    prop_inst = str(body.get("instructorId") or "").strip() or None
    prop_eng = str(body.get("labEngineerId") or "").strip() or None
    prop_lab = str(body.get("assignedLabId") or "").strip() or None
    overwrite_existing = bool(body.get("overwriteExisting", False))
    allow_override = bool(body.get("allowWorkloadOverride", False))

    client = require_supabase_client()
    try:
        ctx = load_institution_assignment_context(client, uni_id)
        plan = _evaluate_bulk_plan(
            ctx,
            offering_ids=[str(x) for x in offering_ids],
            proposed_inst_id=prop_inst,
            proposed_eng_id=prop_eng,
            proposed_lab_id=prop_lab,
            apply_instructor=bool(prop_inst),
            apply_lab_engineer=bool(prop_eng),
            apply_assigned_lab=bool(prop_lab),
            overwrite_existing=overwrite_existing,
            allow_workload_override=allow_override,
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    plan.pop("_internal_rows", None)
    return {"universityId": uni_id, **plan}


@router.post("/api/assignments/bulk/apply")
async def apply_bulk_assignment(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    offering_ids = body.get("offeringIds") if isinstance(body.get("offeringIds"), list) else []
    if not offering_ids:
        raise HTTPException(status_code=400, detail={"error": "offeringIds array is required."})

    prop_inst = str(body.get("instructorId") or "").strip() or None
    prop_eng = str(body.get("labEngineerId") or "").strip() or None
    prop_lab = str(body.get("assignedLabId") or "").strip() or None
    if not prop_inst and not prop_eng and not prop_lab:
        raise HTTPException(status_code=400, detail={"error": "Specify at least one staff member or laboratory to assign."})

    overwrite_existing = bool(body.get("overwriteExisting", False))
    allow_override = bool(body.get("allowWorkloadOverride", False))
    confirm_impact = bool(body.get("confirmTimetableImpact", False))

    client = require_supabase_client()
    rollback_log: List[Tuple[str, str, Optional[Dict[str, Any]]]] = []
    applied_count = 0

    try:
        ctx = load_institution_assignment_context(client, uni_id)
        plan = _evaluate_bulk_plan(
            ctx,
            offering_ids=[str(x) for x in offering_ids],
            proposed_inst_id=prop_inst,
            proposed_eng_id=prop_eng,
            proposed_lab_id=prop_lab,
            apply_instructor=bool(prop_inst),
            apply_lab_engineer=bool(prop_eng),
            apply_assigned_lab=bool(prop_lab),
            overwrite_existing=overwrite_existing,
            allow_workload_override=allow_override,
        )
        if plan["missingIds"]:
            raise HTTPException(
                status_code=404,
                detail={"error": f"Unknown or cross-institution offerings: {', '.join(plan['missingIds'])}"},
            )
        if plan["invalidCount"] > 0:
            invalid_details = [r for r in plan["previewRows"] if not r["valid"] and r["changedFields"]]
            raise HTTPException(
                status_code=422,
                detail={
                    "error": f"Bulk assignment blocked: {plan['invalidCount']} offering(s) failed validation.",
                    "invalidTargets": invalid_details,
                    "plan": {k: v for k, v in plan.items() if k != "_internal_rows"},
                },
            )
        if plan["publishedImpactCount"] > 0 and not confirm_impact:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": f"{plan['publishedImpactCount']} offering(s) appear in published/locked schedules. Confirm timetable impact before committing.",
                    "requiresConfirmation": True,
                    "publishedImpactCount": plan["publishedImpactCount"],
                },
            )

        for row in plan["_internal_rows"]:
            internal = row["_internal"]
            if not internal["willChangeFields"]:
                continue
            grp = internal["grp"]
            val = internal["validation"]
            changes = _persist_offering_change(
                client,
                uni_id,
                auth_user,
                grp,
                next_inst_id=internal["effInst"],
                next_eng_id=internal["effEng"],
                next_lab_id=internal["effLab"],
                validation=val,
                set_instructor="instructorId" in internal["willChangeFields"],
                set_lab_engineer="labEngineerId" in internal["willChangeFields"],
                set_assigned_lab="assignedLabId" in internal["willChangeFields"],
            )
            rollback_log.extend(changes)
            applied_count += 1

        write_audit_log(
            client,
            uni_id,
            auth_user,
            "bulk_update",
            "assignment",
            "bulk",
            f"Bulk updated {applied_count} course offering assignment(s)",
        )
    except HTTPException:
        if rollback_log:
            _rollback_offering_changes(client, rollback_log)
        raise
    except SupabaseQueryError as err:
        if rollback_log:
            _rollback_offering_changes(client, rollback_log)
        raise_supabase_http_error(err)
    except Exception:
        if rollback_log:
            _rollback_offering_changes(client, rollback_log)
        raise

    return {
        "message": f"Bulk updated {applied_count} course offering(s).",
        "appliedCount": applied_count,
        "skippedOverwriteCount": plan["overwriteCount"] if not overwrite_existing else 0,
    }


@router.post("/api/assignments/copy-section")
async def copy_section_assignments(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    source_batch_id = str(body.get("sourceSectionId") or body.get("sourceBatchId") or "").strip()
    target_batch_ids = [
        str(x).strip()
        for x in (body.get("targetSectionIds") or body.get("targetBatchIds") or [])
        if str(x).strip() and str(x).strip() != source_batch_id
    ]
    preview_only = bool(body.get("previewOnly", False))
    overwrite_existing = bool(body.get("overwriteExisting", False))
    allow_override = bool(body.get("allowWorkloadOverride", False))
    confirm_impact = bool(body.get("confirmTimetableImpact", False))

    if not source_batch_id or not target_batch_ids:
        raise HTTPException(
            status_code=400,
            detail={"error": "sourceSectionId and at least one targetSectionIds entry are required."},
        )

    client = require_supabase_client()
    rollback_log: List[Tuple[str, str, Optional[Dict[str, Any]]]] = []
    copied_count = 0

    try:
        ctx = load_institution_assignment_context(client, uni_id)
        batch_ids_in_uni = {b["id"] for b in ctx["batches"]}
        if source_batch_id not in batch_ids_in_uni or any(tb not in batch_ids_in_uni for tb in target_batch_ids):
            raise HTTPException(status_code=403, detail={"error": "All source and target sections must belong to this university."})

        offerings_raw, _ = _build_offering_groups(ctx)
        source_by_course: Dict[str, Dict[str, Any]] = {}
        for grp in offerings_raw:
            if grp["batch"]["id"] == source_batch_id:
                source_by_course[grp["course"]["id"]] = grp

        if not source_by_course:
            raise HTTPException(status_code=400, detail={"error": "Source section has no course offerings to copy."})

        # Pair matching courses on target batches and evaluate cumulative workload + validation
        from copy import deepcopy

        sim_ctx = deepcopy(ctx)
        sim_offerings, _ = _build_offering_groups(sim_ctx)
        planned: List[Dict[str, Any]] = []

        for grp, sim_grp in zip(offerings_raw, sim_offerings):
            if grp["batch"]["id"] not in target_batch_ids:
                continue
            src = source_by_course.get(grp["course"]["id"])
            if not src:
                continue

            src_inst = (src["lectureRows"][0].get("instructor_id") if src["lectureRows"] else None) or None
            src_eng = (src["labRows"][0].get("lab_engineer_id") if src["labRows"] else None) or None
            src_lab = (src["labRows"][0].get("assigned_lab_id") if src["labRows"] else None) or None
            if not src_inst and not src_eng and not src_lab:
                continue

            cur_inst = (grp["lectureRows"][0].get("instructor_id") if grp["lectureRows"] else None) or None
            cur_eng = (grp["labRows"][0].get("lab_engineer_id") if grp["labRows"] else None) or None
            cur_lab = (grp["labRows"][0].get("assigned_lab_id") if grp["labRows"] else None) or None

            eff_inst = cur_inst
            eff_eng = cur_eng
            eff_lab = cur_lab
            overwrites: List[str] = []
            changes: List[str] = []

            if src_inst and (not cur_inst or overwrite_existing):
                if cur_inst and cur_inst != src_inst:
                    overwrites.append("instructorId")
                if cur_inst != src_inst:
                    eff_inst = src_inst
                    changes.append("instructorId")
            elif src_inst and cur_inst != src_inst:
                overwrites.append("instructorId")

            if src_eng and (not cur_eng or overwrite_existing):
                if cur_eng and cur_eng != src_eng:
                    overwrites.append("labEngineerId")
                if cur_eng != src_eng:
                    eff_eng = src_eng
                    changes.append("labEngineerId")
            elif src_eng and cur_eng != src_eng:
                overwrites.append("labEngineerId")

            if src_lab and (not cur_lab or overwrite_existing):
                if cur_lab and cur_lab != src_lab:
                    overwrites.append("assignedLabId")
                if cur_lab != src_lab:
                    eff_lab = src_lab
                    changes.append("assignedLabId")
            elif src_lab and cur_lab != src_lab:
                overwrites.append("assignedLabId")

            for r in sim_grp["lectureRows"]:
                r["instructor_id"] = eff_inst
            for r in sim_grp["labRows"]:
                r["lab_engineer_id"] = eff_eng
                r["assigned_lab_id"] = eff_lab

            planned.append(
                {
                    "grp": grp,
                    "effInst": eff_inst,
                    "effEng": eff_eng,
                    "effLab": eff_lab,
                    "changes": changes,
                    "overwrites": overwrites,
                }
            )

        cum_workloads = compute_staff_workloads(sim_ctx, offerings_raw=sim_offerings)
        preview_items: List[Dict[str, Any]] = []
        invalid_items: List[Dict[str, Any]] = []
        impact_count = 0

        for item in planned:
            val = validate_offering_assignment(
                ctx,
                item["grp"],
                proposed_instructor_id=item["effInst"],
                proposed_lab_engineer_id=item["effEng"],
                proposed_assigned_lab_id=item["effLab"],
                workloads_by_staff=cum_workloads,
                allow_workload_override=allow_override,
            )
            item["validation"] = val
            row_info = {
                "offeringId": item["grp"]["offeringKey"],
                "courseCode": item["grp"]["course"]["code"],
                "sectionLabel": item["grp"]["hierarchy"]["sectionLabel"],
                "changedFields": item["changes"],
                "overwriteFields": item["overwrites"],
                "valid": val["valid"],
                "errors": val["errors"],
                "timetableImpact": val["timetableImpact"],
            }
            preview_items.append(row_info)
            if not val["valid"] and item["changes"]:
                invalid_items.append(row_info)
            if item["changes"] and (val["timetableImpact"]["hasPublishedImpact"] or val["timetableImpact"]["hasLockedSlot"]):
                impact_count += 1

        if preview_only:
            return {
                "previewOnly": True,
                "matchedOfferings": len(preview_items),
                "willApplyCount": sum(1 for i in preview_items if i["changedFields"] and i["valid"]),
                "overwriteCount": sum(1 for i in preview_items if i["overwriteFields"]),
                "invalidCount": len(invalid_items),
                "publishedImpactCount": impact_count,
                "items": preview_items,
            }

        if invalid_items:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": f"Cannot copy section assignments: {len(invalid_items)} target offering(s) failed validation.",
                    "invalidTargets": invalid_items,
                },
            )
        if impact_count > 0 and not confirm_impact:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": f"{impact_count} target offering(s) appear in published/locked schedules. Confirm impact before overwriting.",
                    "requiresConfirmation": True,
                    "publishedImpactCount": impact_count,
                },
            )

        for item in planned:
            if not item["changes"]:
                continue
            changes = _persist_offering_change(
                client,
                uni_id,
                auth_user,
                item["grp"],
                next_inst_id=item["effInst"],
                next_eng_id=item["effEng"],
                next_lab_id=item["effLab"],
                validation=item["validation"],
                set_instructor="instructorId" in item["changes"],
                set_lab_engineer="labEngineerId" in item["changes"],
                set_assigned_lab="assignedLabId" in item["changes"],
            )
            rollback_log.extend(changes)
            copied_count += 1

        if copied_count > 0:
            write_audit_log(
                client,
                uni_id,
                auth_user,
                "copy",
                "assignment",
                source_batch_id,
                f"Copied course assignments from section {source_batch_id} to {len(target_batch_ids)} section(s) ({copied_count} updated)",
            )
    except HTTPException:
        if rollback_log:
            _rollback_offering_changes(client, rollback_log)
        raise
    except SupabaseQueryError as err:
        if rollback_log:
            _rollback_offering_changes(client, rollback_log)
        raise_supabase_http_error(err)
    except Exception:
        if rollback_log:
            _rollback_offering_changes(client, rollback_log)
        raise

    return {
        "message": f"Copied assignments onto {copied_count} course offering(s).",
        "copiedCount": copied_count,
    }


@router.post("/api/assignments/clear")
async def clear_offering_assignments(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    offering_ids = [str(x).strip() for x in (body.get("offeringIds") or ([body.get("offeringId")] if body.get("offeringId") else [])) if x]
    fields = body.get("fields") if isinstance(body.get("fields"), list) else ["instructorId", "labEngineerId", "assignedLabId"]
    confirm_impact = bool(body.get("confirmTimetableImpact", False))

    if not offering_ids:
        raise HTTPException(status_code=400, detail={"error": "offeringId or offeringIds is required."})

    client = require_supabase_client()
    rollback_log: List[Tuple[str, str, Optional[Dict[str, Any]]]] = []
    cleared_count = 0

    try:
        ctx = load_institution_assignment_context(client, uni_id)
        offerings_raw, lookup = _build_offering_groups(ctx)
        targets = []
        seen: set[str] = set()
        for oid in offering_ids:
            grp = lookup.get(oid)
            if grp and grp["offeringKey"] not in seen:
                seen.add(grp["offeringKey"])
                targets.append(grp)
        if not targets:
            raise HTTPException(status_code=404, detail={"error": "No matching course offerings found."})

        workloads = compute_staff_workloads(ctx, offerings_raw)
        planned: List[Tuple[Dict[str, Any], Optional[str], Optional[str], Optional[str], Dict[str, Any]]] = []
        impact_count = 0

        for grp in targets:
            cur_inst = (grp["lectureRows"][0].get("instructor_id") if grp["lectureRows"] else None) or None
            cur_eng = (grp["labRows"][0].get("lab_engineer_id") if grp["labRows"] else None) or None
            cur_lab = (grp["labRows"][0].get("assigned_lab_id") if grp["labRows"] else None) or None
            n_inst = None if "instructorId" in fields else cur_inst
            n_eng = None if "labEngineerId" in fields else cur_eng
            n_lab = None if "assignedLabId" in fields else cur_lab
            val = validate_offering_assignment(
                ctx,
                grp,
                proposed_instructor_id=n_inst,
                proposed_lab_engineer_id=n_eng,
                proposed_assigned_lab_id=n_lab,
                workloads_by_staff=workloads,
                allow_workload_override=True,
            )
            if val["timetableImpact"]["hasPublishedImpact"] or val["timetableImpact"]["hasLockedSlot"]:
                impact_count += 1
            planned.append((grp, n_inst, n_eng, n_lab, val))

        if impact_count > 0 and not confirm_impact:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": f"{impact_count} offering(s) belong to published/locked schedules. Confirm clearing before proceeding.",
                    "requiresConfirmation": True,
                    "publishedImpactCount": impact_count,
                },
            )

        for grp, n_inst, n_eng, n_lab, val in planned:
            changes = _persist_offering_change(
                client,
                uni_id,
                auth_user,
                grp,
                next_inst_id=n_inst,
                next_eng_id=n_eng,
                next_lab_id=n_lab,
                validation=val,
                set_instructor="instructorId" in fields,
                set_lab_engineer="labEngineerId" in fields,
                set_assigned_lab="assignedLabId" in fields,
            )
            rollback_log.extend(changes)
            cleared_count += 1

        write_audit_log(
            client,
            uni_id,
            auth_user,
            "clear",
            "assignment",
            ",".join(offering_ids[:3]),
            f"Cleared [{', '.join(fields)}] across {cleared_count} course offering(s)",
        )
    except HTTPException:
        if rollback_log:
            _rollback_offering_changes(client, rollback_log)
        raise
    except SupabaseQueryError as err:
        if rollback_log:
            _rollback_offering_changes(client, rollback_log)
        raise_supabase_http_error(err)

    return {"message": f"Cleared assignments on {cleared_count} course offering(s).", "clearedCount": cleared_count}


@router.get("/api/assignments/workload")
def get_staff_workload_overview(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    department_id = get_query_param(request, "departmentId", "")
    staff_role = get_query_param(request, "staffRole", "")
    search = get_query_param(request, "search", "").strip().lower()

    client = require_supabase_client()
    try:
        ctx = load_institution_assignment_context(client, uni_id)
        workloads = compute_staff_workloads(ctx)
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    staff = list(workloads.values())
    if department_id and department_id != "all":
        staff = [s for s in staff if s["departmentId"] == department_id]
    if staff_role and staff_role != "all":
        staff = [s for s in staff if s["staffRole"] == staff_role]
    if search:
        staff = [
            s
            for s in staff
            if search in s["name"].lower() or search in s["email"].lower() or search in str(s["staffCode"]).lower()
        ]

    return {
        "universityId": uni_id,
        "staff": sorted(staff, key=lambda s: (-s["utilizationPct"], s["name"])),
        "totals": {
            "totalStaff": len(staff),
            "activeStaff": sum(1 for s in staff if s["isActive"]),
            "overloadedCount": sum(1 for s in staff if s["currentWeeklyHours"] > s["maxWeeklyHours"]),
            "unassignedStaffCount": sum(1 for s in staff if s["currentWeeklyHours"] == 0),
        },
    }


@router.get("/api/assignments/history")
def get_assignment_history(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        ctx = load_institution_assignment_context(client, uni_id)
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    logs = [
        log
        for log in (ctx.get("audit_logs") or [])
        if log.get("entity_type") in ("assignment", "section", "instructor", "course")
    ]
    return {"universityId": uni_id, "history": logs[:60]}


@router.get("/api/assignments/my-load")
def get_my_staff_assignments(request: Request) -> Dict[str, Any]:
    """Read-only endpoint allowing authenticated Faculty Instructors & Lab Engineers to view ONLY their own assignments."""
    auth_user = require_auth_user(request, allowed_roles=STAFF_VIEW_ROLES)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()

    try:
        ctx = load_institution_assignment_context(client, uni_id)
        user_id = str(auth_user.get("userId") or "")
        user_email = str(auth_user.get("email") or "").strip().lower()
        matched_inst = next(
            (
                i
                for i in ctx["instructors"]
                if (i.get("user_id") and str(i["user_id"]) == user_id)
                or (user_email and str(i.get("email") or "").strip().lower() == user_email)
            ),
            None,
        )
        if not matched_inst:
            return {"universityId": uni_id, "instructor": None, "offerings": [], "workload": None}

        assert_institution_access(auth_user, matched_inst.get("institution_id"))
        workspace = build_assignment_workspace_payload(ctx)
        inst_id = matched_inst["id"]
        my_offerings = [
            o
            for o in workspace["offerings"]
            if o.get("instructorId") == inst_id or o.get("labEngineerId") == inst_id
        ]
        my_workload = next((s for s in workspace["staffDirectory"] if s["id"] == inst_id), None)
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {
        "universityId": uni_id,
        "instructor": my_workload,
        "offerings": my_offerings,
    }
