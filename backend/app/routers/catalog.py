"""Normalized academic catalog CRUD endpoints (campuses, buildings, semesters, departments, programs, batches, courses, instructors, classrooms, sections, constraints, audit logs) via Supabase PostgreSQL."""

from __future__ import annotations

import uuid
from collections import defaultdict
from typing import Any, Dict, List, Optional

from app.database.supabase import SupabaseQueryError, require_supabase_client
from app.deps import (
    CATALOG_MANAGER_ROLES,
    assert_institution_access,
    get_query_param,
    parse_json_body,
    raise_supabase_http_error,
    require_auth_user,
    resolve_matching_batches_for_course,
    safe_json_loads,
    safe_select_optional,
    scoped_uni_id,
    write_audit_log,
)
from database import now_iso
from fastapi_compat import APIRouter, HTTPException, Request

router = APIRouter(tags=["catalog"])


def _fetch_owned_row(client: Any, table: str, row_id: str, auth_user: Dict[str, Any], label: str = "Record") -> Dict[str, Any]:
    row = client.select_one(table, filters={"id": f"eq.{row_id}"})
    if not row:
        raise HTTPException(status_code=404, detail={"error": f"{label} not found."})
    assert_institution_access(auth_user, row.get("institution_id"))
    return row


def _sync_instructor_availability(
    client: Any,
    uni_id: str,
    inst_id: str,
    unavailable_slots: List[Any],
) -> None:
    client.delete(
        "instructor_availability",
        {"institution_id": f"eq.{uni_id}", "instructor_id": f"eq.{inst_id}"},
    )
    rows: List[Dict[str, Any]] = []
    seen = set()
    for item in unavailable_slots:
        if isinstance(item, dict):
            day = str(item.get("day") or "Mon").strip()[:3].title()
            ts = str(item.get("timeSlot") or item.get("startTime") or "09:00").strip()
            reason = str(item.get("reason") or "Unavailable")
        elif isinstance(item, str) and "-" in item:
            parts = item.split("-", 1)
            day = parts[0].strip()[:3].title()
            ts = parts[1].strip()
            reason = "Unavailable"
        else:
            continue
        start_time = ts.split("-")[0].split("–")[0].strip() or "09:00"
        end_time = ts.split("-")[1].strip() if "-" in ts else (ts.split("–")[1].strip() if "–" in ts else start_time)
        key = (day, start_time)
        if key in seen:
            continue
        seen.add(key)
        rows.append(
            {
                "institution_id": uni_id,
                "instructor_id": inst_id,
                "day_of_week": day,
                "start_time": start_time,
                "end_time": end_time,
                "is_available": False,
                "reason": reason,
            }
        )
    if rows:
        client.insert("instructor_availability", rows)


# ============================================================================
# CAMPUSES & BUILDINGS
# ============================================================================

@router.get("/api/campuses")
def list_campuses(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        rows = safe_select_optional(client, "campuses", filters={"institution_id": f"eq.{uni_id}"}, order="created_at.asc")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"campuses": rows}


@router.post("/api/campuses", status_code=201)
async def create_campus(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or body.get("institutionId") or ""))
    name = str(body.get("name") or "").strip()
    code = str(body.get("code") or "").strip().upper()
    if not name or not code:
        raise HTTPException(status_code=400, detail={"error": "Campus name and code are required."})
    camp_id = str(body.get("id") or f"camp-{uuid.uuid4().hex[:8]}")
    client = require_supabase_client()
    try:
        inserted = client.insert(
            "campuses",
            {
                "id": camp_id,
                "institution_id": uni_id,
                "name": name,
                "code": code,
                "address": str(body.get("address") or ""),
                "created_at": now_iso(),
            },
            upsert=True,
            on_conflict="institution_id,code",
        )
        created = inserted[0] if inserted else None
        write_audit_log(client, uni_id, auth_user, "create", "campus", camp_id, f"Saved campus {code} ({name})")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Campus saved.", "campus": created}


@router.delete("/api/campuses/{campusId}")
def delete_campus(campusId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    client = require_supabase_client()
    try:
        row = _fetch_owned_row(client, "campuses", campusId, auth_user, "Campus")
        client.delete("campuses", {"id": f"eq.{campusId}"})
        write_audit_log(client, row["institution_id"], auth_user, "delete", "campus", campusId, f"Deleted campus {row.get('code')}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Campus deleted."}


@router.get("/api/buildings")
def list_buildings(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        rows = safe_select_optional(client, "buildings", filters={"institution_id": f"eq.{uni_id}"}, order="created_at.asc")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"buildings": rows}


@router.post("/api/buildings", status_code=201)
async def create_building(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or body.get("institutionId") or ""))
    name = str(body.get("name") or "").strip()
    code = str(body.get("code") or "").strip().upper()
    if not name or not code:
        raise HTTPException(status_code=400, detail={"error": "Building name and code are required."})
    bld_id = str(body.get("id") or f"bld-{uuid.uuid4().hex[:8]}")
    client = require_supabase_client()
    try:
        inserted = client.insert(
            "buildings",
            {
                "id": bld_id,
                "institution_id": uni_id,
                "campus_id": body.get("campusId") or None,
                "name": name,
                "code": code,
                "floors": max(1, int(body.get("floors") or 1)),
                "created_at": now_iso(),
            },
            upsert=True,
            on_conflict="institution_id,code",
        )
        created = inserted[0] if inserted else None
        write_audit_log(client, uni_id, auth_user, "create", "building", bld_id, f"Saved building {code} ({name})")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Building saved.", "building": created}


@router.delete("/api/buildings/{buildingId}")
def delete_building(buildingId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    client = require_supabase_client()
    try:
        row = _fetch_owned_row(client, "buildings", buildingId, auth_user, "Building")
        client.delete("buildings", {"id": f"eq.{buildingId}"})
        write_audit_log(client, row["institution_id"], auth_user, "delete", "building", buildingId, f"Deleted building {row.get('code')}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Building deleted."}


# ============================================================================
# SEMESTERS / ACADEMIC TERMS
# ============================================================================

@router.get("/api/semesters")
def list_semesters(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        rows = client.select("semesters", filters={"institution_id": f"eq.{uni_id}"}, order="created_at.asc")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"semesters": rows}


@router.post("/api/semesters", status_code=201)
async def create_semester(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or body.get("institutionId") or ""))
    name = str(body.get("name") or "").strip()
    code = str(body.get("code") or "").strip().upper()
    if not name or not code:
        raise HTTPException(status_code=400, detail={"error": "Semester name and code are required."})

    sem_id = str(body.get("id") or f"term-{uuid.uuid4().hex[:8]}")
    status_val = str(body.get("status") or "active")
    if status_val not in ("draft", "active", "archived"):
        status_val = "active"
    is_active = bool(body.get("isActive", status_val == "active"))
    client = require_supabase_client()
    try:
        inserted = client.insert(
            "semesters",
            {
                "id": sem_id,
                "institution_id": uni_id,
                "name": name,
                "code": code,
                "academic_year": str(body.get("academicYear") or "2026–2027"),
                "semester_number": max(1, int(body.get("semesterNumber") or 1)),
                "start_date": body.get("startDate") or "2026-09-01",
                "end_date": body.get("endDate") or "2026-12-20",
                "is_active": is_active,
                "status": status_val,
                "weeks_count": max(1, int(body.get("weeksCount") or 16)),
                "department_ids": body.get("departmentIds") if isinstance(body.get("departmentIds"), list) else [],
                "created_at": now_iso(),
            },
            upsert=True,
            on_conflict="institution_id,code",
        )
        created = inserted[0] if inserted else None
        if status_val == "active":
            inst = client.select_one("institutions", filters={"id": f"eq.{uni_id}"}, select="*")
            active_ids = safe_json_loads((inst or {}).get("active_term_ids"), [])
            if isinstance(active_ids, list) and sem_id not in active_ids:
                active_ids.append(sem_id)
                client.update("institutions", {"id": f"eq.{uni_id}"}, {"active_term_ids": active_ids})
        write_audit_log(client, uni_id, auth_user, "create", "term", sem_id, f"Created semester {name} ({code})")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Semester saved.", "semester": created}


@router.patch("/api/semesters/{semesterId}")
async def update_semester(semesterId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    client = require_supabase_client()
    try:
        existing = _fetch_owned_row(client, "semesters", semesterId, auth_user, "Semester")
        patch: Dict[str, Any] = {}
        if "name" in body:
            patch["name"] = str(body["name"]).strip()
        if "code" in body:
            patch["code"] = str(body["code"]).strip().upper()
        if "academicYear" in body:
            patch["academic_year"] = str(body["academicYear"])
        if "startDate" in body:
            patch["start_date"] = body["startDate"]
        if "endDate" in body:
            patch["end_date"] = body["endDate"]
        if "weeksCount" in body:
            patch["weeks_count"] = max(1, int(body["weeksCount"]))
        if "departmentIds" in body and isinstance(body["departmentIds"], list):
            patch["department_ids"] = body["departmentIds"]
        if "status" in body and body["status"] in ("draft", "active", "archived"):
            patch["status"] = body["status"]
            patch["is_active"] = body["status"] == "active"
        elif "isActive" in body:
            patch["is_active"] = bool(body["isActive"])
            patch["status"] = "active" if patch["is_active"] else "archived"

        updated = client.update("semesters", {"id": f"eq.{semesterId}"}, patch) if patch else [existing]
        if "status" in patch or "is_active" in patch:
            uni_id = existing["institution_id"]
            all_sems = client.select("semesters", filters={"institution_id": f"eq.{uni_id}"}, select="id,is_active")
            active_ids = [s["id"] for s in all_sems if s.get("status") == "active" or s.get("is_active")]
            client.update("institutions", {"id": f"eq.{uni_id}"}, {"active_term_ids": active_ids})
        write_audit_log(client, existing["institution_id"], auth_user, "update", "term", semesterId, f"Updated semester {existing.get('name')}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Semester updated.", "semester": updated[0] if updated else existing}


@router.delete("/api/semesters/{semesterId}")
def delete_semester(semesterId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    client = require_supabase_client()
    try:
        existing = _fetch_owned_row(client, "semesters", semesterId, auth_user, "Semester")
        client.delete("semesters", {"id": f"eq.{semesterId}"})
        uni_id = existing["institution_id"]
        inst = client.select_one("institutions", filters={"id": f"eq.{uni_id}"}, select="*")
        active_ids = safe_json_loads((inst or {}).get("active_term_ids"), [])
        if isinstance(active_ids, list) and semesterId in active_ids:
            client.update("institutions", {"id": f"eq.{uni_id}"}, {"active_term_ids": [x for x in active_ids if x != semesterId]})
        write_audit_log(client, uni_id, auth_user, "delete", "term", semesterId, f"Deleted semester {existing.get('name')}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Semester deleted."}


# ============================================================================
# DEPARTMENTS
# ============================================================================

@router.get("/api/departments")
def list_departments(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        rows = client.select("departments", filters={"institution_id": f"eq.{uni_id}"}, order="code.asc")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    normalized = [
        {
            **r,
            "university_id": r["institution_id"],
            "faculty_group": r.get("school") or r.get("faculty_name") or "Engineering & Computing",
            "school": r.get("school") or r.get("faculty_name") or "Engineering & Computing",
            "colorHex": r.get("color_hex") or "#171717",
            "subDepartments": safe_json_loads(r.get("sub_departments"), []),
        }
        for r in rows
    ]
    return {"departments": normalized}


@router.post("/api/departments", status_code=201)
async def create_department(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    code = str(body.get("code") or "").strip().upper()
    name = str(body.get("name") or "").strip()
    if not code or not name:
        raise HTTPException(status_code=400, detail={"error": "Department code and name are required."})

    dept_id = str(body.get("id") or f"dept-{uuid.uuid4().hex[:8]}")
    school = str(body.get("school") or body.get("facultyGroup") or body.get("facultyName") or "Engineering & Computing").strip()
    sub_depts = body.get("subDepartments") if isinstance(body.get("subDepartments"), list) else []
    client = require_supabase_client()
    try:
        inserted = client.insert(
            "departments",
            {
                "id": dept_id,
                "institution_id": uni_id,
                "code": code,
                "name": name,
                "school": school,
                "faculty_name": school,
                "head_of_department": body.get("headOfDepartment") or "",
                "color_hex": str(body.get("colorHex") or "#171717"),
                "sub_departments": sub_depts,
                "created_at": now_iso(),
            },
            upsert=True,
            on_conflict="institution_id,code",
        )
        created = inserted[0] if inserted else None
        write_audit_log(client, uni_id, auth_user, "create", "department", created["id"] if created else dept_id, f"Saved department {code} ({name})")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Department created.", "department": created}


@router.patch("/api/departments/{deptId}")
async def update_department(deptId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    client = require_supabase_client()
    try:
        existing = _fetch_owned_row(client, "departments", deptId, auth_user, "Department")
        patch: Dict[str, Any] = {}
        if "code" in body:
            patch["code"] = str(body["code"]).strip().upper()
        if "name" in body:
            patch["name"] = str(body["name"]).strip()
        if "school" in body or "facultyName" in body or "facultyGroup" in body:
            val = str(body.get("school") or body.get("facultyName") or body.get("facultyGroup") or "").strip()
            patch["school"] = val
            patch["faculty_name"] = val
        if "colorHex" in body:
            patch["color_hex"] = str(body["colorHex"])
        if "subDepartments" in body and isinstance(body["subDepartments"], list):
            patch["sub_departments"] = body["subDepartments"]
        if "headOfDepartment" in body:
            patch["head_of_department"] = str(body["headOfDepartment"])

        updated = client.update("departments", {"id": f"eq.{deptId}"}, patch) if patch else [existing]
        write_audit_log(client, existing["institution_id"], auth_user, "update", "department", deptId, f"Updated department {existing.get('code')}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Department updated.", "department": updated[0] if updated else existing}


@router.delete("/api/departments/{deptId}")
def delete_department(deptId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    client = require_supabase_client()
    try:
        existing = _fetch_owned_row(client, "departments", deptId, auth_user, "Department")
        client.delete("departments", {"id": f"eq.{deptId}"})
        write_audit_log(client, existing["institution_id"], auth_user, "delete", "department", deptId, f"Deleted department {existing.get('code')}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Department deleted."}


# ============================================================================
# ACADEMIC PROGRAMS
# ============================================================================

@router.get("/api/programs")
def list_programs(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        rows = client.select("academic_programs", filters={"institution_id": f"eq.{uni_id}"}, order="code.asc")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"programs": rows}


@router.post("/api/programs", status_code=201)
async def create_program(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    code = str(body.get("code") or "").strip().upper()
    name = str(body.get("name") or "").strip()
    if not code or not name:
        raise HTTPException(status_code=400, detail={"error": "Program code and name are required."})

    prog_id = str(body.get("id") or f"prog-{uuid.uuid4().hex[:8]}")
    raw_level = str(body.get("degreeLevel") or "BS").strip()
    level_map = {"Undergraduate": "BS", "Graduate": "MS", "Postgraduate": "PhD"}
    mapped_level = level_map.get(raw_level, raw_level)
    level = mapped_level if mapped_level in ("BS", "BE", "MS", "PhD", "Diploma", "Associate") else "BS"
    client = require_supabase_client()
    try:
        inserted = client.insert(
            "academic_programs",
            {
                "id": prog_id,
                "institution_id": uni_id,
                "department_id": body.get("departmentId") or None,
                "code": code,
                "name": name,
                "degree_level": level,
                "duration_years": max(1, int(body.get("durationYears") or 4)),
                "total_semesters": max(1, int(body.get("totalSemesters") or 8)),
                "created_at": now_iso(),
            },
            upsert=True,
            on_conflict="institution_id,code",
        )
        created = inserted[0] if inserted else None
        write_audit_log(client, uni_id, auth_user, "create", "program", created["id"] if created else prog_id, f"Saved program {code} ({name})")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Program saved.", "program": created}


@router.delete("/api/programs/{programId}")
def delete_program(programId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    client = require_supabase_client()
    try:
        existing = _fetch_owned_row(client, "academic_programs", programId, auth_user, "Program")
        client.delete("academic_programs", {"id": f"eq.{programId}"})
        write_audit_log(client, existing["institution_id"], auth_user, "delete", "program", programId, f"Deleted program {existing.get('code')}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Program deleted."}


# ============================================================================
# BATCHES / STUDENT GROUPS
# ============================================================================

@router.get("/api/batches")
def list_batches(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        rows = client.select("batches", filters={"institution_id": f"eq.{uni_id}"}, order="code.asc")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"batches": rows}


@router.post("/api/batches", status_code=201)
async def create_batch(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    code = str(body.get("code") or "").strip().upper()
    name = str(body.get("name") or f"{code} Cohort").strip()
    if not code:
        raise HTTPException(status_code=400, detail={"error": "Batch code is required."})

    batch_id = str(body.get("id") or f"batch-{uuid.uuid4().hex[:8]}")
    client = require_supabase_client()
    try:
        inserted = client.insert(
            "batches",
            {
                "id": batch_id,
                "institution_id": uni_id,
                "code": code,
                "name": name,
                "department_code": str(body.get("departmentCode") or "GEN").strip().upper(),
                "program_id": body.get("programId") or None,
                "term_id": body.get("termId") or None,
                "batch_code": str(body.get("batchCode") or code.split("-")[0]).strip().upper(),
                "section": str(body.get("section") or "A").strip().upper(),
                "home_room": str(body.get("homeRoom") or ""),
                "year": max(1, int(body.get("year") or 1)),
                "semester": max(1, int(body.get("semester") or 1)),
                "academic_year": int(body.get("academicYear") or 2026),
                "student_count": max(1, int(body.get("size") or body.get("studentCount") or 45)),
                "sections_list": str(body.get("section") or body.get("sectionsList") or "A"),
                "shared_course_ids": body.get("sharedCourseIds") if isinstance(body.get("sharedCourseIds"), list) else [],
                "created_at": now_iso(),
            },
            upsert=True,
            on_conflict="institution_id,code",
        )
        created = inserted[0] if inserted else None
        write_audit_log(client, uni_id, auth_user, "create", "group", created["id"] if created else batch_id, f"Saved batch/cohort {code}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Batch saved.", "batch": created}


@router.patch("/api/batches/{batchId}")
async def update_batch(batchId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    client = require_supabase_client()
    try:
        existing = _fetch_owned_row(client, "batches", batchId, auth_user, "Batch")
        patch: Dict[str, Any] = {}
        if "code" in body:
            patch["code"] = str(body["code"]).strip().upper()
        if "name" in body:
            patch["name"] = str(body["name"]).strip()
        if "departmentCode" in body:
            patch["department_code"] = str(body["departmentCode"]).strip().upper()
        if "programId" in body:
            patch["program_id"] = body["programId"] or None
        if "termId" in body:
            patch["term_id"] = body["termId"] or None
        if "batchCode" in body:
            patch["batch_code"] = str(body["batchCode"]).strip().upper()
        if "section" in body:
            patch["section"] = str(body["section"]).strip().upper()
            patch["sections_list"] = patch["section"]
        if "homeRoom" in body:
            patch["home_room"] = str(body["homeRoom"] or "")
        if "year" in body:
            patch["year"] = max(1, int(body["year"]))
        if "semester" in body:
            patch["semester"] = max(1, int(body["semester"]))
        if "size" in body or "studentCount" in body:
            patch["student_count"] = max(1, int(body.get("size") or body.get("studentCount") or 45))
        if "sharedCourseIds" in body and isinstance(body["sharedCourseIds"], list):
            patch["shared_course_ids"] = body["sharedCourseIds"]

        updated = client.update("batches", {"id": f"eq.{batchId}"}, patch) if patch else [existing]
        write_audit_log(client, existing["institution_id"], auth_user, "update", "group", batchId, f"Updated batch {existing.get('code')}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Batch updated.", "batch": updated[0] if updated else existing}


@router.delete("/api/batches/{batchId}")
def delete_batch(batchId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    client = require_supabase_client()
    try:
        existing = _fetch_owned_row(client, "batches", batchId, auth_user, "Batch")
        client.delete("batches", {"id": f"eq.{batchId}"})
        write_audit_log(client, existing["institution_id"], auth_user, "delete", "group", batchId, f"Deleted batch {existing.get('code')}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Batch deleted."}


# ============================================================================
# COURSES
# ============================================================================

@router.get("/api/courses")
def list_courses(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        rows = client.select("courses", filters={"institution_id": f"eq.{uni_id}"}, order="code.asc")
        sessions = client.select("course_sessions", filters={"institution_id": f"eq.{uni_id}"})
        depts = client.select("departments", filters={"institution_id": f"eq.{uni_id}"}, select="id,code")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    dept_code_by_id = {d["id"]: d["code"] for d in depts}
    sess_by_course: Dict[str, Dict[str, Any]] = {}
    for s in sessions:
        if s["course_id"] not in sess_by_course:
            sess_by_course[s["course_id"]] = s

    enriched = []
    for r in rows:
        sess = sess_by_course.get(r["id"], {})
        lec_hrs = int(r.get("lecture_hours_per_week") or 0)
        lab_hrs = int(r.get("lab_hours_per_week") or 0)
        lec_cr = int(r.get("lecture_credit_hours") if r.get("lecture_credit_hours") is not None else lec_hrs)
        lab_cr = int(r.get("lab_credit_hours") if r.get("lab_credit_hours") is not None else (round(lab_hrs / 3) if lab_hrs > 0 else 0))
        ct = str(r.get("course_type") or "").lower()
        if ct not in ("lecture", "lab", "lecture_lab"):
            ct = "lecture_lab" if (lec_cr > 0 and lab_cr > 0) else ("lab" if lab_cr > 0 else "lecture")
        is_lab = ct == "lab"
        ctype = sess.get("session_type") or ("Lab" if is_lab else "Theory")
        enriched.append(
            {
                **r,
                "university_id": r["institution_id"],
                "department_code": dept_code_by_id.get(r.get("department_id") or "", "BSCS"),
                "batch_id": r.get("assigned_batch_id") or sess.get("batch_id"),
                "instructor_id": r.get("assigned_instructor_id") or sess.get("instructor_id"),
                "lab_engineer_id": r.get("assigned_lab_engineer_id") or sess.get("lab_engineer_id"),
                "course_type": ct,
                "lecture_credit_hours": lec_cr,
                "lab_credit_hours": lab_cr,
                "lab_session_mode": r.get("lab_session_mode") or "continuous",
                "type": ctype,
                "hours_per_week": lec_cr + (lab_cr * 3),
                "student_count": sess.get("expected_students") or 60,
                "required_room_type": r.get("required_room_type") or sess.get("required_room_type") or ("lab" if is_lab else "lecture"),
                "required_equipment": r.get("required_equipment") or [],
                "is_elective": bool(r.get("is_elective", not r.get("is_compulsory", True))),
                "elective_pool_name": r.get("elective_pool_name") or "",
            }
        )
    return {"courses": enriched}


@router.post("/api/courses", status_code=201)
async def create_course(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    code = str(body.get("code") or "").strip().upper()
    title = str(body.get("title") or body.get("name") or "").strip()
    dept_id_input = str(body.get("departmentId") or "").strip()
    dept_code = str(body.get("departmentCode") or "BSCS").strip().upper()
    batch_id = str(body.get("assignedBatchId") or body.get("batchId") or "").strip() or None
    instructor_id = str(body.get("assignedInstructorId") or body.get("instructorId") or "").strip() or None
    lab_engineer_id = str(body.get("assignedLabEngineerId") or body.get("labEngineerId") or "").strip() or None

    raw_ct = str(body.get("courseType") or body.get("type") or "lecture").strip().lower()
    if raw_ct in ("theory", "lecture"):
        course_type = "lecture"
    elif raw_ct == "lab":
        course_type = "lab"
    elif raw_ct in ("lecture_lab", "lecture+lab", "both"):
        course_type = "lecture_lab"
    else:
        course_type = "lecture"

    if "lectureCredits" in body or "labCredits" in body:
        lec_cr = max(0, int(body.get("lectureCredits") or 0))
        lab_cr = max(0, int(body.get("labCredits") or 0))
    else:
        cr = max(1, int(body.get("creditHours") or (1 if course_type == "lab" else 3)))
        if course_type == "lab":
            lec_cr, lab_cr = 0, cr
        elif course_type == "lecture_lab":
            lec_cr = max(1, cr - 1)
            lab_cr = 1
        else:
            lec_cr, lab_cr = cr, 0

    if lec_cr > 0 and lab_cr > 0:
        course_type = "lecture_lab"
    elif lab_cr > 0 and lec_cr == 0:
        course_type = "lab"
    else:
        course_type = "lecture"

    lec_hours = int(body.get("lectureHours") or lec_cr)
    lab_hours = int(body.get("labHours") or (lab_cr * 3))
    total_credits = max(1, lec_cr + lab_cr)
    student_count = int(body.get("studentCount") or 60)
    raw_room_type = str(body.get("requiredRoomType") or ("lab" if course_type == "lab" else "lecture")).strip().lower()
    req_room_type = "lab" if "lab" in raw_room_type else ("seminar" if "seminar" in raw_room_type else "lecture")
    req_eq = body.get("requiredEquipment") or []
    lab_mode = str(body.get("labSessionMode") or "continuous")
    is_elective = bool(body.get("isElective", False))
    is_compulsory = not is_elective if "isElective" in body else bool(body.get("isCompulsory", True))

    if not code or not title:
        raise HTTPException(status_code=400, detail={"error": "Course code and title are required."})

    course_id = str(body.get("id") or f"crs-{uuid.uuid4().hex[:8]}")
    current_iso = now_iso()
    client = require_supabase_client()

    try:
        resolved_dept_id = dept_id_input or None
        if not resolved_dept_id:
            dept = client.select_one(
                "departments",
                filters={"institution_id": f"eq.{uni_id}", "code": f"ilike.{dept_code}"},
                select="id",
            )
            resolved_dept_id = dept["id"] if dept else None

        course_row = {
            "id": course_id,
            "institution_id": uni_id,
            "department_id": resolved_dept_id,
            "code": code,
            "title": title,
            "credit_hours": total_credits,
            "lecture_hours_per_week": lec_hours,
            "lab_hours_per_week": lab_hours,
            "course_type": course_type,
            "lecture_credit_hours": lec_cr,
            "lab_credit_hours": lab_cr,
            "assigned_instructor_id": instructor_id,
            "assigned_lab_engineer_id": lab_engineer_id,
            "assigned_batch_id": batch_id,
            "semester_number": int(body["semester"]) if body.get("semester") else None,
            "lab_session_mode": lab_mode,
            "sub_department": str(body.get("subDepartment") or "") or None,
            "is_compulsory": is_compulsory,
            "is_elective": is_elective,
            "elective_pool_name": str(body.get("electivePoolName") or "") or None,
            "required_room_type": req_room_type,
            "required_equipment": req_eq,
            "created_at": current_iso,
        }
        inserted_courses = client.insert("courses", course_row, upsert=True, on_conflict="institution_id,code")
        created = inserted_courses[0] if inserted_courses else None
        actual_course_id = created["id"] if created else course_id

        # Auto-create course_sessions only when a valid batch_id is explicitly provided
        if batch_id and bool(body.get("autoCreateSessions", True)):
            batch_exists = client.select_one("batches", filters={"id": f"eq.{batch_id}", "institution_id": f"eq.{uni_id}"}, select="id,student_count")
            if batch_exists:
                eff_students = max(1, int(body.get("studentCount") or batch_exists.get("student_count") or student_count))
                sessions_to_save: List[Dict[str, Any]] = []
                if lec_cr > 0:
                    sessions_to_save.append(
                        {
                            "id": f"sec-{actual_course_id}-a-lec",
                            "institution_id": uni_id,
                            "course_id": actual_course_id,
                            "instructor_id": instructor_id,
                            "batch_id": batch_id,
                            "section_code": str(body.get("sectionCode") or "A"),
                            "session_type": "Theory",
                            "component_type": "lecture",
                            "sessions_per_week": max(1, min(6, lec_cr)),
                            "duration_minutes": 50,
                            "expected_students": eff_students,
                            "required_room_type": "seminar" if req_room_type == "seminar" else "lecture",
                            "required_equipment": req_eq,
                            "created_at": current_iso,
                        }
                    )
                if lab_cr > 0:
                    sessions_to_save.append(
                        {
                            "id": f"sec-{actual_course_id}-a-lab",
                            "institution_id": uni_id,
                            "course_id": actual_course_id,
                            "instructor_id": instructor_id,
                            "lab_engineer_id": lab_engineer_id or instructor_id,
                            "batch_id": batch_id,
                            "section_code": str(body.get("sectionCode") or "A"),
                            "session_type": "Lab",
                            "component_type": "lab",
                            "sessions_per_week": max(1, min(6, lab_cr)),
                            "duration_minutes": 180,
                            "expected_students": eff_students,
                            "required_room_type": "lab",
                            "is_atomic_session": True,
                            "span_slots": 3,
                            "required_equipment": req_eq,
                            "created_at": current_iso,
                        }
                    )
                for sess_row in sessions_to_save:
                    client.insert("course_sessions", sess_row, upsert=True, on_conflict="id")

        write_audit_log(client, uni_id, auth_user, "create", "course", actual_course_id, f"Saved course {code} ({title})")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Course saved.", "course": created}


@router.patch("/api/courses/{courseId}")
async def update_course(courseId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    client = require_supabase_client()
    try:
        existing = _fetch_owned_row(client, "courses", courseId, auth_user, "Course")
        patch: Dict[str, Any] = {}
        if "code" in body:
            patch["code"] = str(body["code"]).strip().upper()
        if "title" in body:
            patch["title"] = str(body["title"]).strip()
        if "departmentId" in body:
            patch["department_id"] = body["departmentId"] or None
        if "subDepartment" in body:
            patch["sub_department"] = str(body["subDepartment"] or "") or None
        if "courseType" in body:
            patch["course_type"] = str(body["courseType"])
        if "creditHours" in body:
            patch["credit_hours"] = max(1, int(body["creditHours"]))
        if "lectureCredits" in body:
            patch["lecture_credit_hours"] = max(0, int(body["lectureCredits"]))
            patch["lecture_hours_per_week"] = max(0, int(body.get("lectureHours", body["lectureCredits"])))
        if "labCredits" in body:
            patch["lab_credit_hours"] = max(0, int(body["labCredits"]))
            patch["lab_hours_per_week"] = max(0, int(body.get("labHours", int(body["labCredits"]) * 3)))
        if "requiredRoomType" in body:
            patch["required_room_type"] = str(body["requiredRoomType"])
        if "assignedInstructorId" in body:
            patch["assigned_instructor_id"] = body["assignedInstructorId"] or None
        if "assignedLabEngineerId" in body:
            patch["assigned_lab_engineer_id"] = body["assignedLabEngineerId"] or None
        if "assignedBatchId" in body:
            patch["assigned_batch_id"] = body["assignedBatchId"] or None
        if "semester" in body:
            patch["semester_number"] = int(body["semester"]) if body["semester"] else None
        if "labSessionMode" in body:
            patch["lab_session_mode"] = str(body["labSessionMode"])
        if "isElective" in body:
            patch["is_elective"] = bool(body["isElective"])
            patch["is_compulsory"] = not bool(body["isElective"])
        if "electivePoolName" in body:
            patch["elective_pool_name"] = str(body["electivePoolName"] or "") or None

        updated = client.update("courses", {"id": f"eq.{courseId}"}, patch) if patch else [existing]
        write_audit_log(client, existing["institution_id"], auth_user, "update", "course", courseId, f"Updated course {existing.get('code')}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Course updated.", "course": updated[0] if updated else existing}


@router.delete("/api/courses/{courseId}")
def delete_course(courseId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    client = require_supabase_client()
    try:
        existing = _fetch_owned_row(client, "courses", courseId, auth_user, "Course")
        client.delete("courses", {"id": f"eq.{courseId}"})
        write_audit_log(client, existing["institution_id"], auth_user, "delete", "course", courseId, f"Deleted course {existing.get('code')}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Course deleted."}


# ============================================================================
# INSTRUCTORS & AVAILABILITY
# ============================================================================

@router.get("/api/instructors")
def list_instructors(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        rows = client.select("instructors", filters={"institution_id": f"eq.{uni_id}"}, order="name.asc")
        depts = client.select("departments", filters={"institution_id": f"eq.{uni_id}"}, select="id,code")
        prefs = client.select("instructor_preferences", filters={"institution_id": f"eq.{uni_id}"})
        avails = client.select("instructor_availability", filters={"institution_id": f"eq.{uni_id}"})
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    dept_by_id = {d["id"]: d["code"] for d in depts}
    pref_by_inst = {p["instructor_id"]: p for p in prefs}
    unavail_by_inst: Dict[str, List[str]] = defaultdict(list)
    for a in avails:
        if not a.get("is_available", True):
            unavail_by_inst[a["instructor_id"]].append(f"{a['day_of_week']}-{a['start_time']}")

    enriched = []
    for r in rows:
        pref = pref_by_inst.get(r["id"], {})
        specs = r.get("specializations") or []
        enriched.append(
            {
                **r,
                "university_id": r["institution_id"],
                "department_code": dept_by_id.get(r.get("department_id") or "", "BSCS"),
                "specialization": specs[0] if specs else "",
                "staffRole": r.get("staff_role") or "faculty",
                "subDepartment": r.get("sub_department") or "",
                "qualifiedCourseIds": safe_json_loads(r.get("qualified_course_ids"), []),
                "max_lectures_per_day": r.get("max_daily_classes", 3),
                "unavailable_slots": unavail_by_inst.get(r["id"], []),
                "preferred_slots": pref.get("preferred_days") or [],
            }
        )
    return {"instructors": enriched}


@router.post("/api/instructors", status_code=201)
async def create_instructor(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    name = str(body.get("name") or "").strip()
    dept_id_input = str(body.get("departmentId") or "").strip()
    dept_code = str(body.get("departmentCode") or "BSCS").strip().upper()
    if not name:
        raise HTTPException(status_code=400, detail={"error": "Instructor name is required."})

    inst_id = str(body.get("id") or f"inst-{uuid.uuid4().hex[:8]}")
    email = str(body.get("email") or "").strip().lower() or f"{inst_id}@smartgrid.edu"
    spec_raw = body.get("specializations") or body.get("specialization")
    if isinstance(spec_raw, list):
        specializations = [str(s) for s in spec_raw if s]
    elif isinstance(spec_raw, str) and spec_raw.strip():
        specializations = [spec_raw.strip()]
    else:
        specializations = []

    staff_role = "lab_engineer" if str(body.get("staffRole") or "").strip().lower() == "lab_engineer" else "faculty"
    qual_ids = body.get("qualifiedCourseIds") if isinstance(body.get("qualifiedCourseIds"), list) else []

    client = require_supabase_client()
    try:
        resolved_dept_id = dept_id_input or None
        if not resolved_dept_id:
            dept = client.select_one(
                "departments",
                filters={"institution_id": f"eq.{uni_id}", "code": f"ilike.{dept_code}"},
                select="id",
            )
            resolved_dept_id = dept["id"] if dept else None

        inserted = client.insert(
            "instructors",
            {
                "id": inst_id,
                "institution_id": uni_id,
                "user_id": body.get("userId"),
                "department_id": resolved_dept_id,
                "name": name,
                "email": email,
                "designation": body.get("title") or body.get("designation") or "Professor",
                "staff_role": staff_role,
                "sub_department": str(body.get("subDepartment") or "") or None,
                "qualified_course_ids": qual_ids,
                "specializations": specializations,
                "max_weekly_hours": int(body.get("maxWeeklyHours") or 15),
                "max_daily_classes": int(body.get("maxConsecutiveHours") or body.get("maxDailyClasses") or body.get("maxLecturesPerDay") or 3),
                "created_at": now_iso(),
            },
            upsert=True,
            on_conflict="institution_id,email",
        )
        created = inserted[0] if inserted else None
        actual_inst_id = created["id"] if created else inst_id

        if isinstance(body.get("preferredDays"), list):
            client.insert(
                "instructor_preferences",
                {
                    "institution_id": uni_id,
                    "instructor_id": actual_inst_id,
                    "preferred_days": body["preferredDays"],
                    "avoid_back_to_back_more_than": int(body.get("maxConsecutiveHours") or 2),
                    "updated_at": now_iso(),
                },
                upsert=True,
                on_conflict="instructor_id",
            )
        if isinstance(body.get("unavailableSlots"), list) and body["unavailableSlots"]:
            _sync_instructor_availability(client, uni_id, actual_inst_id, body["unavailableSlots"])

        write_audit_log(client, uni_id, auth_user, "create", "instructor", actual_inst_id, f"Saved instructor {name}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Instructor saved.", "instructor": created}


@router.patch("/api/instructors/{instId}")
async def update_instructor(instId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    client = require_supabase_client()
    try:
        existing = _fetch_owned_row(client, "instructors", instId, auth_user, "Instructor")
        uni_id = existing["institution_id"]
        patch: Dict[str, Any] = {}
        if "name" in body:
            patch["name"] = str(body["name"]).strip()
        if "email" in body:
            patch["email"] = str(body["email"]).strip().lower()
        if "departmentId" in body:
            patch["department_id"] = body["departmentId"] or None
        if "subDepartment" in body:
            patch["sub_department"] = str(body["subDepartment"] or "") or None
        if "staffRole" in body:
            patch["staff_role"] = "lab_engineer" if body["staffRole"] == "lab_engineer" else "faculty"
        if "title" in body or "designation" in body:
            patch["designation"] = str(body.get("title") or body.get("designation") or "Professor")
        if "maxWeeklyHours" in body:
            patch["max_weekly_hours"] = max(1, int(body["maxWeeklyHours"]))
        if "maxConsecutiveHours" in body or "maxDailyClasses" in body:
            patch["max_daily_classes"] = max(1, int(body.get("maxConsecutiveHours") or body.get("maxDailyClasses") or 3))
        if "qualifiedCourseIds" in body and isinstance(body["qualifiedCourseIds"], list):
            patch["qualified_course_ids"] = body["qualifiedCourseIds"]

        updated = client.update("instructors", {"id": f"eq.{instId}"}, patch) if patch else [existing]
        if isinstance(body.get("unavailableSlots"), list):
            _sync_instructor_availability(client, uni_id, instId, body["unavailableSlots"])
        if isinstance(body.get("preferredDays"), list):
            client.insert(
                "instructor_preferences",
                {
                    "institution_id": uni_id,
                    "instructor_id": instId,
                    "preferred_days": body["preferredDays"],
                    "avoid_back_to_back_more_than": int(body.get("maxConsecutiveHours") or existing.get("max_daily_classes") or 2),
                    "updated_at": now_iso(),
                },
                upsert=True,
                on_conflict="instructor_id",
            )
        write_audit_log(client, uni_id, auth_user, "update", "instructor", instId, f"Updated instructor {existing.get('name')}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Instructor updated.", "instructor": updated[0] if updated else existing}


@router.put("/api/instructors/{instId}/availability")
async def replace_instructor_availability(instId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=[*CATALOG_MANAGER_ROLES, "faculty", "instructor"])
    body = await parse_json_body(request)
    client = require_supabase_client()
    try:
        existing = _fetch_owned_row(client, "instructors", instId, auth_user, "Instructor")
        role = str(auth_user.get("role") or "").lower()
        if role in ("faculty", "instructor") and existing.get("user_id") != auth_user.get("userId"):
            raise HTTPException(status_code=403, detail={"error": "Faculty members can only update their own availability."})
        slots = body.get("unavailableSlots")
        if not isinstance(slots, list):
            raise HTTPException(status_code=400, detail={"error": "unavailableSlots array is required."})
        _sync_instructor_availability(client, existing["institution_id"], instId, slots)
        write_audit_log(client, existing["institution_id"], auth_user, "update", "instructor", instId, f"Updated availability matrix ({len(slots)} blocked slots)")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Instructor availability updated.", "unavailableCount": len(slots)}


@router.delete("/api/instructors/{instId}")
def delete_instructor(instId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    client = require_supabase_client()
    try:
        existing = _fetch_owned_row(client, "instructors", instId, auth_user, "Instructor")
        client.delete("instructors", {"id": f"eq.{instId}"})
        write_audit_log(client, existing["institution_id"], auth_user, "delete", "instructor", instId, f"Deleted instructor {existing.get('name')}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Instructor deleted."}


# ============================================================================
# CLASSROOMS & LABORATORIES
# ============================================================================

@router.get("/api/classrooms")
def list_classrooms(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        classrooms = client.select("classrooms", filters={"institution_id": f"eq.{uni_id}"}, order="name.asc")
        labs = client.select("laboratories", filters={"institution_id": f"eq.{uni_id}"}, order="name.asc")
        equip = client.select("room_equipment_capacities", filters={"institution_id": f"eq.{uni_id}"})
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    equip_by_room: Dict[str, List[str]] = defaultdict(list)
    for eq in equip:
        if eq.get("room_id") and eq.get("equipment_name"):
            equip_by_room[eq["room_id"]].append(eq["equipment_name"])

    combined: List[Dict[str, Any]] = []
    for r in classrooms:
        combined.append(
            {
                **r,
                "university_id": r["institution_id"],
                "type": r.get("room_type") or "lecture",
                "equipment": equip_by_room.get(r["id"], ["Projector"]),
                "unavailable_slots": [],
            }
        )
    for lab in labs:
        combined.append(
            {
                **lab,
                "university_id": lab["institution_id"],
                "floor": 1,
                "type": "lab",
                "room_type": "lab",
                "equipment": lab.get("equipment") or equip_by_room.get(lab["id"], ["Workstations"]),
                "unavailable_slots": [],
            }
        )
    return {"classrooms": combined}


@router.post("/api/classrooms", status_code=201)
async def create_classroom(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    name = str(body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail={"error": "Classroom name is required."})

    room_id = str(body.get("id") or f"room-{uuid.uuid4().hex[:8]}")
    code = str(body.get("code") or name.split(" ")[0] or room_id).strip().upper()
    raw_type = str(body.get("type") or body.get("roomType") or "lecture").strip().lower()
    equipment = [str(e) for e in (body.get("equipment") or []) if e]
    current_iso = now_iso()
    client = require_supabase_client()

    try:
        if "lab" in raw_type:
            lab_row = {
                "id": room_id,
                "institution_id": uni_id,
                "building_id": body.get("buildingId") or None,
                "code": code,
                "name": name,
                "building": body.get("building") or "Engineering Lab Complex",
                "capacity": int(body.get("capacity") or 40),
                "lab_category": body.get("labCategory") or "Computing",
                "assigned_lab_engineer_id": body.get("assignedLabEngineerId") or None,
                "equipment": equipment,
                "is_accessible": bool(body.get("isAccessible", True)),
                "is_available": bool(body.get("isAvailable", True)),
                "created_at": current_iso,
            }
            inserted = client.insert("laboratories", lab_row, upsert=True, on_conflict="institution_id,code")
            room_kind = "laboratory"
        else:
            room_type = (
                "auditorium" if "auditorium" in raw_type
                else ("seminar" if ("seminar" in raw_type or ("studio" in raw_type and not client.has_column("classrooms", "building_id"))) else ("studio" if "studio" in raw_type else "lecture"))
            )
            inserted = client.insert(
                "classrooms",
                {
                    "id": room_id,
                    "institution_id": uni_id,
                    "building_id": body.get("buildingId") or None,
                    "code": code,
                    "name": name,
                    "building": body.get("building") or "Main Academic Block",
                    "floor": int(body.get("floor") or 1),
                    "capacity": int(body.get("capacity") or 60),
                    "room_type": room_type,
                    "is_accessible": bool(body.get("isAccessible", True)),
                    "is_available": bool(body.get("isAvailable", True)),
                    "created_at": current_iso,
                },
                upsert=True,
                on_conflict="institution_id,code",
            )
            room_kind = "classroom"

        created = inserted[0] if inserted else None
        actual_id = created["id"] if created else room_id
        if equipment:
            client.delete("room_equipment_capacities", {"institution_id": f"eq.{uni_id}", "room_id": f"eq.{actual_id}"})
            client.insert(
                "room_equipment_capacities",
                [
                    {
                        "institution_id": uni_id,
                        "room_id": actual_id,
                        "room_kind": room_kind,
                        "equipment_name": item,
                        "quantity": 1,
                        "has_projector": "projector" in item.lower(),
                        "has_smartboard": "smartboard" in item.lower(),
                        "has_high_performance_pcs": any("workstation" in x.lower() or "cluster" in x.lower() for x in equipment),
                    }
                    for item in equipment
                ],
            )
        write_audit_log(client, uni_id, auth_user, "create", "room", actual_id, f"Saved {room_kind} {code} ({name})")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Classroom saved.", "classroom": created}


@router.patch("/api/classrooms/{roomId}")
async def update_classroom(roomId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    client = require_supabase_client()
    try:
        table = "classrooms"
        existing = client.select_one("classrooms", filters={"id": f"eq.{roomId}"})
        if not existing:
            table = "laboratories"
            existing = client.select_one("laboratories", filters={"id": f"eq.{roomId}"})
        if not existing:
            raise HTTPException(status_code=404, detail={"error": "Room not found."})
        assert_institution_access(auth_user, existing.get("institution_id"))

        patch: Dict[str, Any] = {}
        if "code" in body:
            patch["code"] = str(body["code"]).strip().upper()
        if "name" in body:
            patch["name"] = str(body["name"]).strip()
        if "capacity" in body:
            patch["capacity"] = max(1, int(body["capacity"]))
        if "building" in body:
            patch["building"] = str(body["building"])
        if "buildingId" in body:
            patch["building_id"] = body["buildingId"] or None
        if "isAvailable" in body:
            patch["is_available"] = bool(body["isAvailable"])
        if "isAccessible" in body:
            patch["is_accessible"] = bool(body["isAccessible"])
        if table == "classrooms" and ("type" in body or "roomType" in body):
            rt = str(body.get("type") or body.get("roomType") or "lecture").lower()
            if rt in ("lecture", "seminar", "auditorium", "studio"):
                patch["room_type"] = rt
        if table == "laboratories" and "assignedLabEngineerId" in body:
            patch["assigned_lab_engineer_id"] = body["assignedLabEngineerId"] or None
        if table == "laboratories" and isinstance(body.get("equipment"), list):
            patch["equipment"] = body["equipment"]

        updated = client.update(table, {"id": f"eq.{roomId}"}, patch) if patch else [existing]
        if isinstance(body.get("equipment"), list):
            uni_id = existing["institution_id"]
            client.delete("room_equipment_capacities", {"institution_id": f"eq.{uni_id}", "room_id": f"eq.{roomId}"})
            if body["equipment"]:
                client.insert(
                    "room_equipment_capacities",
                    [
                        {
                            "institution_id": uni_id,
                            "room_id": roomId,
                            "room_kind": "laboratory" if table == "laboratories" else "classroom",
                            "equipment_name": str(item),
                            "quantity": 1,
                        }
                        for item in body["equipment"]
                    ],
                )
        write_audit_log(client, existing["institution_id"], auth_user, "update", "room", roomId, f"Updated room {existing.get('code')}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Room updated.", "classroom": updated[0] if updated else existing}


@router.delete("/api/classrooms/{roomId}")
def delete_classroom(roomId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    client = require_supabase_client()
    try:
        table = "classrooms"
        existing = client.select_one("classrooms", filters={"id": f"eq.{roomId}"})
        if not existing:
            table = "laboratories"
            existing = client.select_one("laboratories", filters={"id": f"eq.{roomId}"})
        if not existing:
            raise HTTPException(status_code=404, detail={"error": "Room not found."})
        assert_institution_access(auth_user, existing.get("institution_id"))

        client.delete("room_equipment_capacities", {"institution_id": f"eq.{existing['institution_id']}", "room_id": f"eq.{roomId}"})
        client.delete(table, {"id": f"eq.{roomId}"})
        write_audit_log(client, existing["institution_id"], auth_user, "delete", "room", roomId, f"Deleted room {existing.get('code')}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Room deleted."}


# ============================================================================
# COURSE SESSIONS (SCHEDULING SECTIONS)
# ============================================================================

@router.get("/api/sections")
def list_sections(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        rows = client.select("course_sessions", filters={"institution_id": f"eq.{uni_id}"}, order="created_at.asc")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"sections": rows}


@router.post("/api/sections", status_code=201)
async def create_section(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    course_id = str(body.get("courseId") or "").strip()
    batch_id = str(body.get("studentGroupId") or body.get("batchId") or "").strip()
    if not course_id or not batch_id:
        raise HTTPException(status_code=400, detail={"error": "courseId and studentGroupId (batchId) are required."})

    sec_id = str(body.get("id") or f"sec-{uuid.uuid4().hex[:8]}")
    raw_type = str(body.get("sessionType") or "Lecture").strip()
    is_lab = raw_type.lower() == "lab" or str(body.get("componentType") or "").lower() == "lab"
    sess_type = "Lab" if is_lab else ("Tutorial" if raw_type.lower() == "tutorial" else "Theory")
    comp_type = "lab" if is_lab else ("tutorial" if sess_type == "Tutorial" else "lecture")

    client = require_supabase_client()
    try:
        _fetch_owned_row(client, "courses", course_id, auth_user, "Course")
        _fetch_owned_row(client, "batches", batch_id, auth_user, "Batch")
        inserted = client.insert(
            "course_sessions",
            {
                "id": sec_id,
                "institution_id": uni_id,
                "term_id": body.get("termId") or None,
                "course_id": course_id,
                "instructor_id": body.get("instructorId") or None,
                "lab_engineer_id": body.get("labEngineerId") or None,
                "batch_id": batch_id,
                "section_code": str(body.get("sectionNumber") or body.get("sectionCode") or "A"),
                "session_type": sess_type,
                "component_type": comp_type,
                "lab_split_allowed": bool(body.get("labSplitAllowed", False)),
                "sessions_per_week": max(1, min(6, int(body.get("sessionsPerWeek") or (1 if is_lab else 3)))),
                "duration_minutes": max(30, min(300, int(body.get("durationMinutes") or (180 if is_lab else 50)))),
                "expected_students": max(1, int(body.get("expectedEnrollment") or body.get("expectedStudents") or 50)),
                "required_room_type": "lab" if is_lab else "lecture",
                "shared_group_ids": body.get("sharedGroupIds") if isinstance(body.get("sharedGroupIds"), list) else [],
                "is_atomic_session": bool(body.get("isAtomicSession", is_lab)),
                "span_slots": max(1, int(body.get("spanSlots") or (3 if is_lab else 1))),
                "assigned_slot_json": body.get("assignedSlot") or None,
                "is_locked": bool(body.get("isLocked", False)),
                "created_at": now_iso(),
            },
            upsert=True,
            on_conflict="id",
        )
        created = inserted[0] if inserted else None
        write_audit_log(client, uni_id, auth_user, "create", "section", sec_id, f"Saved section {sec_id} ({sess_type})")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Section saved.", "section": created}


@router.patch("/api/sections/{sectionId}/slot")
async def update_section_slot(sectionId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    client = require_supabase_client()
    try:
        existing = _fetch_owned_row(client, "course_sessions", sectionId, auth_user, "Section")
        slot = body.get("assignedSlot") or body.get("slot")
        if slot is None:
            raise HTTPException(status_code=400, detail={"error": "assignedSlot object is required."})
        patch = {
            "assigned_day": str(slot.get("day") or "")[:3] or None,
            "assigned_start_time": str(slot.get("startTime24") or slot.get("timeSlot") or "") or None,
            "assigned_room_id": str(slot.get("roomId") or "") or None,
            "assigned_slot_json": slot,
        }
        updated = client.update("course_sessions", {"id": f"eq.{sectionId}"}, patch)
        write_audit_log(client, existing["institution_id"], auth_user, "update", "section", sectionId, f"Updated slot for section {sectionId}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Section slot updated.", "section": updated[0] if updated else existing}


@router.patch("/api/sections/{sectionId}/lock")
async def toggle_section_lock(sectionId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    client = require_supabase_client()
    try:
        existing = _fetch_owned_row(client, "course_sessions", sectionId, auth_user, "Section")
        next_locked = bool(body["isLocked"]) if "isLocked" in body else (not bool(existing.get("is_locked", False)))
        updated = client.update("course_sessions", {"id": f"eq.{sectionId}"}, {"is_locked": next_locked})
        write_audit_log(client, existing["institution_id"], auth_user, "update", "section", sectionId, f"{'Locked' if next_locked else 'Unlocked'} section {sectionId}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Section lock state updated.", "isLocked": next_locked, "section": updated[0] if updated else existing}


@router.post("/api/sections/swap")
async def swap_section_slots(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    sec_a_id = str(body.get("sectionAId") or "").strip()
    sec_b_id = str(body.get("sectionBId") or "").strip()
    if not sec_a_id or not sec_b_id:
        raise HTTPException(status_code=400, detail={"error": "sectionAId and sectionBId are required."})
    client = require_supabase_client()
    try:
        sec_a = _fetch_owned_row(client, "course_sessions", sec_a_id, auth_user, "Section A")
        sec_b = _fetch_owned_row(client, "course_sessions", sec_b_id, auth_user, "Section B")
        slot_a = sec_a.get("assigned_slot_json")
        slot_b = sec_b.get("assigned_slot_json")
        client.update("course_sessions", {"id": f"eq.{sec_a_id}"}, {
            "assigned_day": sec_b.get("assigned_day"),
            "assigned_start_time": sec_b.get("assigned_start_time"),
            "assigned_room_id": sec_b.get("assigned_room_id"),
            "assigned_slot_json": slot_b,
        })
        client.update("course_sessions", {"id": f"eq.{sec_b_id}"}, {
            "assigned_day": sec_a.get("assigned_day"),
            "assigned_start_time": sec_a.get("assigned_start_time"),
            "assigned_room_id": sec_a.get("assigned_room_id"),
            "assigned_slot_json": slot_a,
        })
        write_audit_log(client, sec_a["institution_id"], auth_user, "update", "section", sec_a_id, f"Swapped slots between {sec_a_id} and {sec_b_id}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Section slots swapped in Supabase."}


@router.post("/api/sections/auto-generate")
async def auto_generate_sections(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    term_id = body.get("termId") or None
    client = require_supabase_client()
    now = now_iso()

    try:
        courses = client.select("courses", filters={"institution_id": f"eq.{uni_id}"})
        batches = client.select("batches", filters={"institution_id": f"eq.{uni_id}"})
        departments = client.select("departments", filters={"institution_id": f"eq.{uni_id}"})
        programs = client.select("academic_programs", filters={"institution_id": f"eq.{uni_id}"})
        instructors = client.select("instructors", filters={"institution_id": f"eq.{uni_id}"})
        existing_sessions = client.select("course_sessions", filters={"institution_id": f"eq.{uni_id}"})

        if not courses or not batches:
            return {"message": "Need at least one course and one batch to generate sections.", "createdCount": 0}

        existing_keys = {
            (s.get("course_id"), s.get("batch_id"), str(s.get("component_type") or "lecture"))
            for s in existing_sessions
        }
        default_faculty = next((i["id"] for i in instructors if (i.get("staff_role") or "faculty") == "faculty"), instructors[0]["id"] if instructors else None)
        default_lab_eng = next((i["id"] for i in instructors if i.get("staff_role") == "lab_engineer"), default_faculty)

        to_insert: List[Dict[str, Any]] = []
        for c in courses:
            target_batches = resolve_matching_batches_for_course(c, batches, departments, programs)
            if not target_batches:
                continue
            lec_cr = int(c.get("lecture_credit_hours") or 0)
            lab_cr = int(c.get("lab_credit_hours") or 0)
            if lec_cr == 0 and lab_cr == 0:
                lec_cr = max(1, int(c.get("credit_hours") or 3))

            for batch_obj in target_batches:
                target_batch_id = batch_obj["id"]
                exp_students = max(1, int(batch_obj.get("student_count") or 45))
                sec_code = str(batch_obj.get("section") or "A")

                if lec_cr > 0 and (c["id"], target_batch_id, "lecture") not in existing_keys:
                    to_insert.append(
                        {
                            "id": f"sec-{uuid.uuid4().hex[:8]}",
                            "institution_id": uni_id,
                            "term_id": term_id,
                            "course_id": c["id"],
                            "instructor_id": c.get("assigned_instructor_id") or default_faculty,
                            "batch_id": target_batch_id,
                            "section_code": sec_code,
                            "session_type": "Theory",
                            "component_type": "lecture",
                            "sessions_per_week": max(1, min(6, lec_cr)),
                            "duration_minutes": 50,
                            "expected_students": exp_students,
                            "required_room_type": c.get("required_room_type") or "lecture",
                            "created_at": now,
                        }
                    )
                    existing_keys.add((c["id"], target_batch_id, "lecture"))
                if lab_cr > 0 and (c["id"], target_batch_id, "lab") not in existing_keys:
                    to_insert.append(
                        {
                            "id": f"sec-{uuid.uuid4().hex[:8]}",
                            "institution_id": uni_id,
                            "term_id": term_id,
                            "course_id": c["id"],
                            "instructor_id": c.get("assigned_instructor_id") or default_faculty,
                            "lab_engineer_id": c.get("assigned_lab_engineer_id") or default_lab_eng,
                            "batch_id": target_batch_id,
                            "section_code": f"{sec_code}-Lab",
                            "session_type": "Lab",
                            "component_type": "lab",
                            "sessions_per_week": max(1, min(6, lab_cr)),
                            "duration_minutes": 180,
                            "expected_students": exp_students,
                            "required_room_type": "lab",
                            "is_atomic_session": True,
                            "span_slots": 3,
                            "created_at": now,
                        }
                    )
                    existing_keys.add((c["id"], target_batch_id, "lab"))

        if to_insert:
            client.insert("course_sessions", to_insert)
            write_audit_log(client, uni_id, auth_user, "create", "section", "auto-gen", f"Auto-generated {len(to_insert)} course sections")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": f"Auto-generated {len(to_insert)} section(s).", "createdCount": len(to_insert), "sections": to_insert}


@router.delete("/api/sections/{sectionId}")
def delete_section(sectionId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    client = require_supabase_client()
    try:
        existing = _fetch_owned_row(client, "course_sessions", sectionId, auth_user, "Section")
        client.delete("course_sessions", {"id": f"eq.{sectionId}"})
        write_audit_log(client, existing["institution_id"], auth_user, "delete", "section", sectionId, f"Deleted section {sectionId}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Section deleted."}


# ============================================================================
# SCHEDULING CONSTRAINTS
# ============================================================================

@router.get("/api/constraints")
def list_constraints(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        rows = client.select("scheduling_constraints", filters={"institution_id": f"eq.{uni_id}"}, order="created_at.asc")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"constraints": rows}


@router.post("/api/constraints", status_code=201)
async def create_constraint(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    name = str(body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail={"error": "Constraint name is required."})
    const_id = str(body.get("id") or f"const-{uuid.uuid4().hex[:8]}")
    kind = "hard" if str(body.get("kind") or "soft").lower() == "hard" else "soft"
    raw_cat = str(body.get("category") or ("hard" if kind == "hard" else "soft_student")).strip().lower()
    cat_map = {
        "instructor": "soft_instructor",
        "room": "soft_room",
        "facility": "soft_room",
        "student": "soft_student",
        "temporal": "soft_student",
    }
    raw_cat = cat_map.get(raw_cat, raw_cat)
    if raw_cat not in ("hard", "soft_student", "soft_instructor", "soft_room", "soft_fairness"):
        raw_cat = "hard" if kind == "hard" else "soft_student"
    client = require_supabase_client()
    try:
        inserted = client.insert(
            "scheduling_constraints",
            {
                "id": const_id,
                "institution_id": uni_id,
                "code": str(body.get("code") or const_id.upper()),
                "name": name,
                "description": str(body.get("description") or ""),
                "kind": kind,
                "category": raw_cat,
                "weight": float(body.get("weight") or 50.0),
                "is_enabled": bool(body.get("enabled", body.get("isEnabled", True))),
                "parameters": body.get("parameters") if isinstance(body.get("parameters"), dict) else {},
                "created_at": now_iso(),
            },
            upsert=True,
            on_conflict="id",
        )
        created = inserted[0] if inserted else None
        write_audit_log(client, uni_id, auth_user, "create", "constraint", const_id, f"Saved constraint {name}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Constraint saved.", "constraint": created}


@router.patch("/api/constraints/{constraintId}")
async def update_constraint(constraintId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    body = await parse_json_body(request)
    client = require_supabase_client()
    try:
        existing = _fetch_owned_row(client, "scheduling_constraints", constraintId, auth_user, "Constraint")
        patch: Dict[str, Any] = {}
        if "enabled" in body or "isEnabled" in body:
            patch["is_enabled"] = bool(body.get("enabled", body.get("isEnabled")))
        if "weight" in body:
            patch["weight"] = float(body["weight"])
        if "name" in body:
            patch["name"] = str(body["name"]).strip()
        if "description" in body:
            patch["description"] = str(body["description"])
        updated = client.update("scheduling_constraints", {"id": f"eq.{constraintId}"}, patch) if patch else [existing]
        write_audit_log(client, existing["institution_id"], auth_user, "update", "constraint", constraintId, f"Updated constraint {existing.get('name')}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Constraint updated.", "constraint": updated[0] if updated else existing}


@router.delete("/api/constraints/{constraintId}")
def delete_constraint(constraintId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    client = require_supabase_client()
    try:
        existing = _fetch_owned_row(client, "scheduling_constraints", constraintId, auth_user, "Constraint")
        client.delete("scheduling_constraints", {"id": f"eq.{constraintId}"})
        write_audit_log(client, existing["institution_id"], auth_user, "delete", "constraint", constraintId, f"Deleted constraint {existing.get('name')}")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Constraint deleted."}


# ============================================================================
# AUDIT LOGS & STUDENTS
# ============================================================================

@router.get("/api/audit-logs")
def list_audit_logs(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        rows = safe_select_optional(client, "audit_logs", filters={"institution_id": f"eq.{uni_id}"}, order="created_at.desc", limit=100)
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"auditLogs": rows}


@router.post("/api/audit-logs", status_code=201)
async def append_audit_log(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    client = require_supabase_client()
    try:
        write_audit_log(
            client,
            uni_id,
            auth_user,
            str(body.get("action") or "update"),
            str(body.get("entityType") or "scenario"),
            str(body.get("entityId") or uni_id),
            str(body.get("summary") or "Activity recorded"),
            body.get("previousValue"),
            body.get("newValue"),
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"message": "Audit log recorded."}


@router.get("/api/students")
def list_students(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    batch_id = get_query_param(request, "batchId", "")
    client = require_supabase_client()

    filters: Dict[str, str] = {"institution_id": f"eq.{uni_id}", "role": "in.(student,br)"}
    if batch_id:
        filters["batch_id"] = f"eq.{batch_id}"

    try:
        rows = client.select(
            "users",
            filters=filters,
            select="id,name,email,role,batch_id,registration_number,section,is_active,created_at",
            order="name.asc",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"students": rows}
