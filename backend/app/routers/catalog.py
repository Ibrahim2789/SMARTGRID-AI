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


def _scoped_uni_id(auth_user: Dict[str, Any], requested_uni_id: str) -> str:
    user_inst = str(auth_user.get("institutionId") or "").strip()
    role = str(auth_user.get("role") or "").lower()
    req = str(requested_uni_id or "").strip()
    if req and role != "super_admin" and user_inst and req != user_inst:
        raise HTTPException(
            status_code=403,
            detail={"error": "Access denied: Cross-institution catalog access is prohibited."},
        )
    return req or user_inst


@router.get("/api/departments")
def list_departments(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = _scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
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
    auth_user = require_auth_user(request, allowed_roles=["admin", "university_admin", "super_admin", "timetable_manager"])
    body = await parse_json_body(request)
    uni_id = _scoped_uni_id(auth_user, str(body.get("universityId") or ""))
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
    uni_id = _scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
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
                "batch_id": sess.get("batch_id"),
                "instructor_id": r.get("assigned_instructor_id") or sess.get("instructor_id"),
                "lab_engineer_id": r.get("assigned_lab_engineer_id") or sess.get("lab_engineer_id"),
                "course_type": ct,
                "lecture_credit_hours": lec_cr,
                "lab_credit_hours": lab_cr,
                "lab_session_mode": r.get("lab_session_mode") or "continuous",
                "type": ctype,
                "hours_per_week": lec_cr + (lab_cr * 3),
                "student_count": sess.get("expected_students") or 60,
                "required_room_type": sess.get("required_room_type") or ("lab" if is_lab else "lecture"),
                "required_equipment": r.get("required_equipment") or [],
            }
        )
    return {"courses": enriched}


@router.post("/api/courses", status_code=201)
async def create_course(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=["admin", "university_admin", "super_admin", "timetable_manager"])
    body = await parse_json_body(request)
    uni_id = _scoped_uni_id(auth_user, str(body.get("universityId") or ""))
    code = str(body.get("code") or "").strip().upper()
    title = str(body.get("title") or body.get("name") or "").strip()
    dept_code = str(body.get("departmentCode") or "BSCS").strip().upper()
    batch_id = str(body.get("batchId") or "batch-2k25-bscs").strip()
    instructor_id = str(body.get("assignedInstructorId") or body.get("instructorId") or "").strip()
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

    lec_hours = lec_cr  # 1 CR = 1 lecture hour/week
    lab_hours = lab_cr * 3  # 1 Lab CR = 3 scheduled lab hours/week
    total_credits = max(1, lec_cr + lab_cr)
    student_count = int(body.get("studentCount") or 60)
    raw_room_type = str(body.get("requiredRoomType") or ("lab" if course_type == "lab" else "lecture")).strip().lower()
    req_room_type = "lab" if "lab" in raw_room_type else ("seminar" if "seminar" in raw_room_type else "lecture")
    req_eq = body.get("requiredEquipment") or []
    lab_mode = str(body.get("labSessionMode") or "continuous")

    if not code or not title:
        raise HTTPException(status_code=400, detail={"error": "Course code and title are required."})

    course_id = body.get("id") or f"crs-{uuid.uuid4().hex[:8]}"
    current_iso = now_iso()
    client = require_supabase_client()

    try:
        dept = client.select_one(
            "departments",
            filters={"institution_id": f"eq.{uni_id}", "code": f"ilike.{dept_code}"},
            select="id",
        )
        dept_id = dept["id"] if dept else None

        course_row = {
            "id": course_id,
            "institution_id": uni_id,
            "department_id": dept_id,
            "code": code,
            "title": title,
            "credit_hours": total_credits,
            "lecture_hours_per_week": lec_hours,
            "lab_hours_per_week": lab_hours,
            "course_type": course_type,
            "lecture_credit_hours": lec_cr,
            "lab_credit_hours": lab_cr,
            "assigned_instructor_id": instructor_id or None,
            "assigned_lab_engineer_id": lab_engineer_id,
            "lab_session_mode": lab_mode,
            "is_compulsory": bool(body.get("isCompulsory", True)),
            "required_equipment": req_eq,
            "created_at": current_iso,
        }
        try:
            inserted_courses = client.insert("courses", course_row, upsert=True, on_conflict="id")
        except SupabaseQueryError:
            core_row = {
                k: course_row[k]
                for k in (
                    "id",
                    "institution_id",
                    "department_id",
                    "code",
                    "title",
                    "credit_hours",
                    "lecture_hours_per_week",
                    "lab_hours_per_week",
                    "is_compulsory",
                    "required_equipment",
                    "created_at",
                )
            }
            inserted_courses = client.insert("courses", core_row, upsert=True, on_conflict="id")

        created = inserted_courses[0] if inserted_courses else None
        actual_course_id = created["id"] if created else course_id

        sessions_to_save: List[Dict[str, Any]] = []
        if lec_cr > 0:
            sessions_to_save.append(
                {
                    "id": f"sec-{actual_course_id}-a-lec",
                    "institution_id": uni_id,
                    "course_id": actual_course_id,
                    "instructor_id": instructor_id or None,
                    "batch_id": batch_id,
                    "section_code": str(body.get("sectionCode") or "A"),
                    "session_type": "Theory",
                    "component_type": "lecture",
                    "sessions_per_week": lec_cr,
                    "duration_minutes": 50,
                    "expected_students": max(1, student_count),
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
                    "instructor_id": instructor_id or None,
                    "lab_engineer_id": lab_engineer_id or instructor_id or None,
                    "batch_id": batch_id,
                    "section_code": str(body.get("sectionCode") or "A"),
                    "session_type": "Lab",
                    "component_type": "lab",
                    "sessions_per_week": lab_cr,
                    "duration_minutes": 180,
                    "expected_students": max(1, student_count),
                    "required_room_type": "lab",
                    "required_equipment": req_eq,
                    "created_at": current_iso,
                }
            )
        for sess_row in sessions_to_save:
            try:
                client.insert("course_sessions", sess_row, upsert=True, on_conflict="id")
            except SupabaseQueryError:
                fallback_sess = {k: v for k, v in sess_row.items() if k not in ("lab_engineer_id", "component_type")}
                client.insert("course_sessions", fallback_sess, upsert=True, on_conflict="id")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Course saved.", "course": created}


@router.get("/api/instructors")
def list_instructors(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = _scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
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
    auth_user = require_auth_user(request, allowed_roles=["admin", "university_admin", "super_admin", "timetable_manager"])
    body = await parse_json_body(request)
    uni_id = _scoped_uni_id(auth_user, str(body.get("universityId") or ""))
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
    uni_id = _scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
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
    auth_user = require_auth_user(request, allowed_roles=["admin", "university_admin", "super_admin", "timetable_manager"])
    body = await parse_json_body(request)
    uni_id = _scoped_uni_id(auth_user, str(body.get("universityId") or ""))
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
            lab_row = {
                "id": room_id,
                "institution_id": uni_id,
                "code": code,
                "name": name,
                "building": body.get("building") or "Engineering Lab Complex",
                "capacity": int(body.get("capacity") or 40),
                "lab_category": body.get("labCategory") or "Computing",
                "assigned_lab_engineer_id": body.get("assignedLabEngineerId") or None,
                "is_available": bool(body.get("isAvailable", True)),
                "created_at": current_iso,
            }
            try:
                inserted = client.insert("laboratories", lab_row, upsert=True, on_conflict="id")
            except SupabaseQueryError:
                core_lab = {k: v for k, v in lab_row.items() if k != "assigned_lab_engineer_id"}
                inserted = client.insert("laboratories", core_lab, upsert=True, on_conflict="id")
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
    uni_id = _scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
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
