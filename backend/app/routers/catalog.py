"""Academic catalog endpoints (departments, courses, instructors, classrooms, students) via Supabase PostgreSQL."""

from __future__ import annotations

import uuid
from collections import defaultdict
from typing import Any, Dict, List

from app.database.supabase import SupabaseQueryError, require_supabase_client
from app.deps import get_query_param, parse_json_body, raise_supabase_http_error, require_auth_user
from database import now_iso
from fastapi_compat import APIRouter, HTTPException, Request

router = APIRouter(tags=["catalog"])


@router.get("/api/departments")
def list_departments(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = get_query_param(request, "universityId", "") or auth_user.get("institutionId") or ""
    client = require_supabase_client()
    try:
        rows = client.select("departments", filters={"institution_id": f"eq.{uni_id}"}, order="code.asc")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    normalized = [
        {
            **r,
            "university_id": r["institution_id"],
            "faculty_group": r.get("faculty_name") or "Engineering & Computing",
        }
        for r in rows
    ]
    return {"departments": normalized}


@router.post("/api/departments", status_code=201)
async def create_department(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=["admin"])
    body = await parse_json_body(request)
    uni_id = body.get("universityId") or auth_user.get("institutionId") or ""
    code = str(body.get("code") or "").strip().upper()
    name = str(body.get("name") or "").strip()
    if not code or not name:
        raise HTTPException(status_code=400, detail={"error": "Department code and name are required."})

    dept_id = f"dept-{uuid.uuid4().hex[:8]}"
    client = require_supabase_client()
    try:
        inserted = client.insert(
            "departments",
            {
                "id": dept_id,
                "institution_id": uni_id,
                "code": code,
                "name": name,
                "faculty_name": body.get("facultyGroup") or body.get("facultyName") or "Engineering & Computing",
                "head_of_department": body.get("headOfDepartment") or "",
                "created_at": now_iso(),
            },
            upsert=True,
            on_conflict="institution_id,code",
        )
        created = inserted[0] if inserted else None
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Department created.", "department": created}


@router.get("/api/courses")
def list_courses(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = get_query_param(request, "universityId", "") or auth_user.get("institutionId") or ""
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
        is_lab = int(r.get("lab_hours_per_week") or 0) > 0 and int(r.get("lecture_hours_per_week") or 0) == 0
        ctype = sess.get("session_type") or ("Lab" if is_lab else "Theory")
        enriched.append(
            {
                **r,
                "university_id": r["institution_id"],
                "department_code": dept_code_by_id.get(r.get("department_id") or "", "BSCS"),
                "batch_id": sess.get("batch_id"),
                "instructor_id": sess.get("instructor_id"),
                "type": ctype,
                "hours_per_week": (
                    int(r.get("lab_hours_per_week") or 3)
                    if is_lab
                    else int(r.get("lecture_hours_per_week") or r.get("credit_hours") or 3)
                ),
                "student_count": sess.get("expected_students") or 60,
                "required_room_type": sess.get("required_room_type") or ("lab" if is_lab else "lecture"),
                "required_equipment": r.get("required_equipment") or [],
            }
        )
    return {"courses": enriched}


@router.post("/api/courses", status_code=201)
async def create_course(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=["admin"])
    body = await parse_json_body(request)
    uni_id = body.get("universityId") or auth_user.get("institutionId") or ""
    code = str(body.get("code") or "").strip().upper()
    title = str(body.get("title") or body.get("name") or "").strip()
    dept_code = str(body.get("departmentCode") or "BSCS").strip().upper()
    batch_id = str(body.get("batchId") or "batch-2k25-bscs").strip()
    instructor_id = str(body.get("instructorId") or "inst-turing").strip()
    ctype = str(body.get("type") or "Theory").strip()
    credit_hours = int(body.get("creditHours") or (1 if ctype.lower() == "lab" else 3))
    hours_per_week = int(body.get("hoursPerWeek") or (3 if ctype.lower() == "lab" else credit_hours))
    student_count = int(body.get("studentCount") or 60)
    raw_room_type = str(body.get("requiredRoomType") or ctype).strip().lower()
    req_room_type = "lab" if "lab" in raw_room_type else ("seminar" if "seminar" in raw_room_type else "lecture")
    req_eq = body.get("requiredEquipment") or []

    if not code or not title:
        raise HTTPException(status_code=400, detail={"error": "Course code and title are required."})

    course_id = body.get("id") or f"crs-{uuid.uuid4().hex[:8]}"
    current_iso = now_iso()
    is_lab = ctype.lower() == "lab"
    client = require_supabase_client()

    try:
        dept = client.select_one(
            "departments",
            filters={"institution_id": f"eq.{uni_id}", "code": f"ilike.{dept_code}"},
            select="id",
        )
        dept_id = dept["id"] if dept else None

        inserted_courses = client.insert(
            "courses",
            {
                "id": course_id,
                "institution_id": uni_id,
                "department_id": dept_id,
                "code": code,
                "title": title,
                "credit_hours": credit_hours,
                "lecture_hours_per_week": 0 if is_lab else hours_per_week,
                "lab_hours_per_week": hours_per_week if is_lab else 0,
                "is_compulsory": bool(body.get("isCompulsory", True)),
                "required_equipment": req_eq,
                "created_at": current_iso,
            },
            upsert=True,
            on_conflict="id",
        )
        created = inserted_courses[0] if inserted_courses else None
        actual_course_id = created["id"] if created else course_id

        session_type = "Lab" if is_lab else ("Tutorial" if ctype.lower() == "tutorial" else "Theory")
        client.insert(
            "course_sessions",
            {
                "id": f"sec-{actual_course_id}-a",
                "institution_id": uni_id,
                "course_id": actual_course_id,
                "instructor_id": instructor_id or None,
                "batch_id": batch_id,
                "section_code": str(body.get("sectionCode") or "A"),
                "session_type": session_type,
                "sessions_per_week": 1 if is_lab else max(1, min(6, hours_per_week)),
                "duration_minutes": 180 if is_lab else 50,
                "expected_students": max(1, student_count),
                "required_room_type": req_room_type,
                "required_equipment": req_eq,
                "created_at": current_iso,
            },
            upsert=True,
            on_conflict="id",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Course saved.", "course": created}


@router.get("/api/instructors")
def list_instructors(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = get_query_param(request, "universityId", "") or auth_user.get("institutionId") or ""
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
                "max_lectures_per_day": r.get("max_daily_classes", 3),
                "unavailable_slots": unavail_by_inst.get(r["id"], []),
                "preferred_slots": pref.get("preferred_days") or [],
            }
        )
    return {"instructors": enriched}


@router.post("/api/instructors", status_code=201)
async def create_instructor(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=["admin"])
    body = await parse_json_body(request)
    uni_id = body.get("universityId") or auth_user.get("institutionId") or ""
    name = str(body.get("name") or "").strip()
    dept_code = str(body.get("departmentCode") or "BSCS").strip().upper()
    if not name:
        raise HTTPException(status_code=400, detail={"error": "Instructor name is required."})

    inst_id = body.get("id") or f"inst-{uuid.uuid4().hex[:8]}"
    email = str(body.get("email") or "").strip().lower() or f"{inst_id}@smartgrid.edu"
    spec_raw = body.get("specializations") or body.get("specialization")
    if isinstance(spec_raw, list):
        specializations = [str(s) for s in spec_raw if s]
    elif isinstance(spec_raw, str) and spec_raw.strip():
        specializations = [spec_raw.strip()]
    else:
        specializations = []

    client = require_supabase_client()
    try:
        dept = client.select_one(
            "departments",
            filters={"institution_id": f"eq.{uni_id}", "code": f"ilike.{dept_code}"},
            select="id",
        )
        inserted = client.insert(
            "instructors",
            {
                "id": inst_id,
                "institution_id": uni_id,
                "user_id": body.get("userId"),
                "department_id": dept["id"] if dept else None,
                "name": name,
                "email": email,
                "designation": body.get("designation") or "Professor",
                "specializations": specializations,
                "max_weekly_hours": int(body.get("maxWeeklyHours") or 15),
                "max_daily_classes": int(body.get("maxDailyClasses") or body.get("maxLecturesPerDay") or 3),
                "created_at": now_iso(),
            },
            upsert=True,
            on_conflict="id",
        )
        created = inserted[0] if inserted else None
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Instructor saved.", "instructor": created}


@router.get("/api/classrooms")
def list_classrooms(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = get_query_param(request, "universityId", "") or auth_user.get("institutionId") or ""
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
                "equipment": equip_by_room.get(lab["id"], ["Workstations"]),
                "unavailable_slots": [],
            }
        )
    return {"classrooms": combined}


@router.post("/api/classrooms", status_code=201)
async def create_classroom(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=["admin"])
    body = await parse_json_body(request)
    uni_id = body.get("universityId") or auth_user.get("institutionId") or ""
    name = str(body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail={"error": "Classroom name is required."})

    room_id = body.get("id") or f"room-{uuid.uuid4().hex[:8]}"
    code = str(body.get("code") or name.split(" ")[0] or room_id).strip().upper()
    raw_type = str(body.get("type") or body.get("roomType") or "lecture").strip().lower()
    equipment = [str(e) for e in (body.get("equipment") or []) if e]
    current_iso = now_iso()
    client = require_supabase_client()

    try:
        if "lab" in raw_type:
            inserted = client.insert(
                "laboratories",
                {
                    "id": room_id,
                    "institution_id": uni_id,
                    "code": code,
                    "name": name,
                    "building": body.get("building") or "Engineering Lab Complex",
                    "capacity": int(body.get("capacity") or 40),
                    "lab_category": body.get("labCategory") or "Computing",
                    "is_available": bool(body.get("isAvailable", True)),
                    "created_at": current_iso,
                },
                upsert=True,
                on_conflict="id",
            )
            room_kind = "laboratory"
        else:
            room_type = "auditorium" if "auditorium" in raw_type else ("seminar" if "seminar" in raw_type else "lecture")
            inserted = client.insert(
                "classrooms",
                {
                    "id": room_id,
                    "institution_id": uni_id,
                    "code": code,
                    "name": name,
                    "building": body.get("building") or "Main Academic Block",
                    "floor": int(body.get("floor") or 1),
                    "capacity": int(body.get("capacity") or 60),
                    "room_type": room_type,
                    "is_available": bool(body.get("isAvailable", True)),
                    "created_at": current_iso,
                },
                upsert=True,
                on_conflict="id",
            )
            room_kind = "classroom"

        created = inserted[0] if inserted else None
        if equipment:
            client.delete("room_equipment_capacities", {"institution_id": f"eq.{uni_id}", "room_id": f"eq.{room_id}"})
            client.insert(
                "room_equipment_capacities",
                [
                    {
                        "institution_id": uni_id,
                        "room_id": room_id,
                        "room_kind": room_kind,
                        "equipment_name": item,
                        "quantity": 1,
                        "has_projector": "Projector" in equipment,
                        "has_smartboard": "SmartBoard" in equipment,
                        "has_high_performance_pcs": any("Workstation" in x or "Cluster" in x for x in equipment),
                    }
                    for item in equipment
                ],
            )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Classroom saved.", "classroom": created}


@router.get("/api/students")
def list_students(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = get_query_param(request, "universityId", "") or auth_user.get("institutionId") or ""
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
