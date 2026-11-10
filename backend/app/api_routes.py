"""
SmartGrid AI — Academic, Preference, Hybrid AI Optimization, Adaptive Tabu Search Rescheduling,
Timetable Versioning, Analytics, and Notification API Routes.
"""

from __future__ import annotations

import json
import uuid
from typing import Any, Callable, Dict, List, Optional

from app.database.supabase import get_database_connection_status
from app.optimization.evaluation import compare_optimization_algorithms
from app.optimization.rescheduler import generate_rescheduling_proposal
from app.optimization.scheduler import run_hybrid_timetable_pipeline
from database import _db_lock, db_conn, now_iso, row_to_dict, rows_to_dicts
from fastapi_compat import FastAPI, HTTPException, Request


def _safe_json_loads(raw: Any, default: Any) -> Any:
    if isinstance(raw, (list, dict)):
        return raw
    if not raw or not isinstance(raw, str):
        return default
    try:
        return json.loads(raw)
    except Exception:
        return default


def _load_university_optimization_inputs(
    university_id: str,
    override_body: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Loads courses, sections, classrooms, instructors, batches/student_groups, and TimeSlotConfig
    for the given university_id from the relational database, allowing optional overrides in request body.
    """
    from app.optimization.constraints import TimeSlotConfig
    from app.optimization.fitness import OptimizationWeights

    body = override_body or {}
    with _db_lock:
        inst_row = row_to_dict(
            db_conn.execute("SELECT * FROM institutions WHERE id = ?", (university_id,)).fetchone()
        )
        if not inst_row:
            inst_row = row_to_dict(
                db_conn.execute("SELECT * FROM institutions WHERE id = 'inst-western-poly'").fetchone()
            ) or {}

        db_courses = rows_to_dicts(
            db_conn.execute("SELECT * FROM courses WHERE university_id = ? ORDER BY code ASC", (university_id,)).fetchall()
        )
        db_rooms = rows_to_dicts(
            db_conn.execute("SELECT * FROM classrooms WHERE university_id = ? ORDER BY name ASC", (university_id,)).fetchall()
        )
        db_instructors = rows_to_dicts(
            db_conn.execute("SELECT * FROM instructors WHERE university_id = ? ORDER BY name ASC", (university_id,)).fetchall()
        )
        db_batches = rows_to_dicts(
            db_conn.execute("SELECT * FROM batches WHERE institution_id = ? ORDER BY code ASC", (university_id,)).fetchall()
        )

        # Fallback to inst-western-poly catalog if a newly registered university has not added courses/rooms yet
        if not db_courses:
            db_courses = rows_to_dicts(
                db_conn.execute("SELECT * FROM courses WHERE university_id = 'inst-western-poly' ORDER BY code ASC").fetchall()
            )
        if not db_rooms:
            db_rooms = rows_to_dicts(
                db_conn.execute("SELECT * FROM classrooms WHERE university_id = 'inst-western-poly' ORDER BY name ASC").fetchall()
            )
        if not db_instructors:
            db_instructors = rows_to_dicts(
                db_conn.execute("SELECT * FROM instructors WHERE university_id = 'inst-western-poly' ORDER BY name ASC").fetchall()
            )
        if not db_batches:
            db_batches = rows_to_dicts(
                db_conn.execute("SELECT * FROM batches WHERE institution_id = 'inst-western-poly' ORDER BY code ASC").fetchall()
            )

    normalized_courses: List[Dict[str, Any]] = []
    default_sections: List[Dict[str, Any]] = []
    for c in db_courses:
        req_eq = _safe_json_loads(c.get("required_equipment"), [])
        ctype = str(c.get("type") or "Theory")
        normalized_courses.append(
            {
                **c,
                "credits": int(c.get("credit_hours") or (1 if ctype.lower() == "lab" else 3)),
                "required_equipment": req_eq,
                "requiredEquipment": req_eq,
            }
        )
        default_sections.append(
            {
                "id": f"sec-{c['id']}-a",
                "courseId": c["id"],
                "courseCode": c["code"],
                "instructorId": c["instructor_id"],
                "studentGroupId": c["batch_id"],
                "sectionCode": "A",
                "sessionType": "Lab" if ctype.lower() == "lab" else "Theory",
                "enrollment": int(c.get("student_count") or 60),
            }
        )

    normalized_rooms: List[Dict[str, Any]] = []
    for r in db_rooms:
        rtype = str(r.get("type") or "Theory").lower()
        normalized_rooms.append(
            {
                "id": r["id"],
                "code": r["id"],
                "name": r["name"],
                "capacity": int(r.get("capacity") or 60),
                "type": "lab" if "lab" in rtype else "lecture",
                "equipment": _safe_json_loads(r.get("equipment"), []),
                "isAvailable": True,
            }
        )

    normalized_groups: List[Dict[str, Any]] = []
    for b in db_batches:
        normalized_groups.append(
            {
                "id": b["id"],
                "batchId": b["id"],
                "code": b["code"],
                "name": b["name"],
                "size": int(b.get("student_count") or 60),
            }
        )

    working_days_raw = inst_row.get("working_days") or "Mon,Tue,Wed,Thu,Fri"
    working_days = [d.strip() for d in str(working_days_raw).split(",") if d.strip()]
    time_config = TimeSlotConfig(
        working_days=working_days or ["Mon", "Tue", "Wed", "Thu", "Fri"],
        day_start_time=str(inst_row.get("day_start_time") or "09:00"),
        day_end_time=str(inst_row.get("day_end_time") or "17:00"),
        period_length_minutes=int(inst_row.get("period_length_minutes") or 50),
        short_break_minutes=int(inst_row.get("short_break_minutes") or 10),
        midday_break_enabled=bool(inst_row.get("midday_break_enabled", 1)),
        midday_break_start=str(inst_row.get("midday_break_start") or "13:00"),
        midday_break_duration=int(inst_row.get("midday_break_duration") or 60),
        lab_duration_minutes=int(inst_row.get("lab_duration_minutes") or 180),
    )

    courses = body.get("courses") if isinstance(body.get("courses"), list) and body.get("courses") else normalized_courses
    sections = body.get("sections") if isinstance(body.get("sections"), list) and body.get("sections") else default_sections
    rooms_raw = body.get("classrooms") if isinstance(body.get("classrooms"), list) and body.get("classrooms") else normalized_rooms
    student_groups = body.get("studentGroups") if isinstance(body.get("studentGroups"), list) and body.get("studentGroups") else normalized_groups

    return {
        "sections": sections,
        "courses": courses,
        "rooms_raw": rooms_raw,
        "student_groups": student_groups,
        "time_config": time_config,
        "weights": OptimizationWeights(),
    }


def register_smartgrid_routes(
    app: FastAPI,
    require_auth_user: Callable[..., Dict[str, Any]],
    parse_json_body: Callable[[Request], Any],
    get_query_param: Callable[[Request, str, str], str],
) -> None:
    """Registers all Academic, Preference, Optimization, Rescheduling, Analytics, and Notification routes."""

    # =========================================================
    # DATABASE & SUPABASE CONNECTION STATUS
    # =========================================================
    @app.get("/api/database/status")
    def database_status() -> Dict[str, Any]:
        status = get_database_connection_status()
        with _db_lock:
            counts = {
                "universities": db_conn.execute("SELECT COUNT(*) as c FROM institutions").fetchone()["c"],
                "batches": db_conn.execute("SELECT COUNT(*) as c FROM batches").fetchone()["c"],
                "users": db_conn.execute("SELECT COUNT(*) as c FROM users").fetchone()["c"],
                "courses": db_conn.execute("SELECT COUNT(*) as c FROM courses").fetchone()["c"],
                "instructors": db_conn.execute("SELECT COUNT(*) as c FROM instructors").fetchone()["c"],
                "classrooms": db_conn.execute("SELECT COUNT(*) as c FROM classrooms").fetchone()["c"],
                "polls": db_conn.execute("SELECT COUNT(*) as c FROM polls").fetchone()["c"],
                "optimizationRuns": db_conn.execute("SELECT COUNT(*) as c FROM optimization_runs").fetchone()["c"],
                "timetableVersions": db_conn.execute("SELECT COUNT(*) as c FROM timetable_versions").fetchone()["c"],
                "reschedulingProposals": db_conn.execute("SELECT COUNT(*) as c FROM rescheduling_proposals").fetchone()["c"],
            }
        return {
            **status,
            "tableCounts": counts,
            "timestamp": now_iso(),
        }

    # =========================================================
    # UNIVERSITIES & SETTINGS ENDPOINTS
    # =========================================================
    @app.get("/api/universities")
    def get_universities() -> Dict[str, Any]:
        with _db_lock:
            rows = rows_to_dicts(db_conn.execute("SELECT * FROM institutions ORDER BY created_at ASC").fetchall())
        return {"universities": rows}

    @app.patch("/api/universities/{universityId}/settings")
    async def update_university_settings(universityId: str, request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request, allowed_roles=["admin"])
        body = await parse_json_body(request)
        with _db_lock:
            existing = row_to_dict(
                db_conn.execute("SELECT * FROM institutions WHERE id = ?", (universityId,)).fetchone()
            )
            if not existing:
                raise HTTPException(status_code=404, detail={"error": "University not found."})

            working_days = body.get("workingDays") or existing["working_days"]
            if isinstance(working_days, list):
                working_days = ",".join(str(d) for d in working_days)
            day_start = body.get("dayStartTime") or existing["day_start_time"]
            day_end = body.get("dayEndTime") or existing["day_end_time"]
            period_len = int(body.get("periodLengthMinutes") or existing["period_length_minutes"])
            short_break = int(body.get("shortBreakMinutes") if "shortBreakMinutes" in body else existing["short_break_minutes"])
            midday_enabled = 1 if body.get("middayBreakEnabled", bool(existing["midday_break_enabled"])) else 0
            midday_start = body.get("middayBreakStart") or existing["midday_break_start"]
            midday_dur = int(body.get("middayBreakDuration") or existing["midday_break_duration"])
            lab_dur = int(body.get("labDurationMinutes") or existing["lab_duration_minutes"])

            db_conn.execute(
                """
                UPDATE institutions
                SET working_days = ?, day_start_time = ?, day_end_time = ?,
                    period_length_minutes = ?, short_break_minutes = ?,
                    midday_break_enabled = ?, midday_break_start = ?,
                    midday_break_duration = ?, lab_duration_minutes = ?
                WHERE id = ?
                """,
                (
                    working_days,
                    day_start,
                    day_end,
                    period_len,
                    short_break,
                    midday_enabled,
                    midday_start,
                    midday_dur,
                    lab_dur,
                    universityId,
                ),
            )
            db_conn.commit()
            updated = row_to_dict(
                db_conn.execute("SELECT * FROM institutions WHERE id = ?", (universityId,)).fetchone()
            )
        return {"message": "University scheduling settings updated.", "university": updated}

    # =========================================================
    # ACADEMIC CATALOG ENDPOINTS (Departments, Courses, Instructors, Classrooms, Batches)
    # =========================================================
    @app.get("/api/departments")
    def list_departments(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request)
        uni_id = get_query_param(request, "universityId", "") or auth_user.get("institutionId") or "inst-western-poly"
        with _db_lock:
            rows = rows_to_dicts(
                db_conn.execute("SELECT * FROM departments WHERE university_id = ? ORDER BY code ASC", (uni_id,)).fetchall()
            )
        return {"departments": rows}

    @app.post("/api/departments", status_code=201)
    async def create_department(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request, allowed_roles=["admin"])
        body = await parse_json_body(request)
        uni_id = body.get("universityId") or auth_user.get("institutionId") or "inst-western-poly"
        code = str(body.get("code") or "").strip().upper()
        name = str(body.get("name") or "").strip()
        if not code or not name:
            raise HTTPException(status_code=400, detail={"error": "Department code and name are required."})
        dept_id = f"dept-{uuid.uuid4().hex[:8]}"
        current_iso = now_iso()
        with _db_lock:
            db_conn.execute(
                """
                INSERT INTO departments (id, university_id, code, name, faculty_group, head_of_department, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    dept_id,
                    uni_id,
                    code,
                    name,
                    body.get("facultyGroup") or "Engineering & Computing",
                    body.get("headOfDepartment") or "",
                    current_iso,
                ),
            )
            db_conn.commit()
            created = row_to_dict(db_conn.execute("SELECT * FROM departments WHERE id = ?", (dept_id,)).fetchone())
        return {"message": "Department created.", "department": created}

    @app.get("/api/courses")
    def list_courses(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request)
        uni_id = get_query_param(request, "universityId", "") or auth_user.get("institutionId") or "inst-western-poly"
        with _db_lock:
            rows = rows_to_dicts(
                db_conn.execute("SELECT * FROM courses WHERE university_id = ? ORDER BY code ASC", (uni_id,)).fetchall()
            )
        for r in rows:
            r["required_equipment"] = _safe_json_loads(r.get("required_equipment"), [])
        return {"courses": rows}

    @app.post("/api/courses", status_code=201)
    async def create_course(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request, allowed_roles=["admin"])
        body = await parse_json_body(request)
        uni_id = body.get("universityId") or auth_user.get("institutionId") or "inst-western-poly"
        code = str(body.get("code") or "").strip().upper()
        title = str(body.get("title") or body.get("name") or "").strip()
        dept_code = str(body.get("departmentCode") or "BSCS").strip().upper()
        batch_id = str(body.get("batchId") or "batch-2k25-bscs").strip()
        instructor_id = str(body.get("instructorId") or "inst-turing").strip()
        ctype = str(body.get("type") or "Theory").strip()
        credit_hours = int(body.get("creditHours") or (1 if ctype == "Lab" else 3))
        hours_per_week = int(body.get("hoursPerWeek") or (3 if ctype == "Lab" else credit_hours))
        student_count = int(body.get("studentCount") or 60)
        req_room_type = str(body.get("requiredRoomType") or ctype).strip()
        req_eq = body.get("requiredEquipment") or []

        if not code or not title:
            raise HTTPException(status_code=400, detail={"error": "Course code and title are required."})

        course_id = body.get("id") or f"crs-{uuid.uuid4().hex[:8]}"
        current_iso = now_iso()
        with _db_lock:
            db_conn.execute(
                """
                INSERT OR REPLACE INTO courses (
                  id, university_id, code, title, department_code, batch_id, semester,
                  type, credit_hours, hours_per_week, instructor_id, student_count,
                  required_room_type, required_equipment, sections_count, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                """,
                (
                    course_id,
                    uni_id,
                    code,
                    title,
                    dept_code,
                    batch_id,
                    int(body.get("semester") or 3),
                    ctype,
                    credit_hours,
                    hours_per_week,
                    instructor_id,
                    student_count,
                    req_room_type,
                    json.dumps(req_eq),
                    current_iso,
                ),
            )
            db_conn.commit()
            created = row_to_dict(db_conn.execute("SELECT * FROM courses WHERE id = ?", (course_id,)).fetchone())
        if created:
            created["required_equipment"] = _safe_json_loads(created.get("required_equipment"), [])
        return {"message": "Course saved.", "course": created}

    @app.get("/api/instructors")
    def list_instructors(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request)
        uni_id = get_query_param(request, "universityId", "") or auth_user.get("institutionId") or "inst-western-poly"
        with _db_lock:
            rows = rows_to_dicts(
                db_conn.execute("SELECT * FROM instructors WHERE university_id = ? ORDER BY name ASC", (uni_id,)).fetchall()
            )
        for r in rows:
            r["unavailable_slots"] = _safe_json_loads(r.get("unavailable_slots"), [])
            r["preferred_slots"] = _safe_json_loads(r.get("preferred_slots"), [])
        return {"instructors": rows}

    @app.post("/api/instructors", status_code=201)
    async def create_instructor(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request, allowed_roles=["admin"])
        body = await parse_json_body(request)
        uni_id = body.get("universityId") or auth_user.get("institutionId") or "inst-western-poly"
        name = str(body.get("name") or "").strip()
        dept_code = str(body.get("departmentCode") or "BSCS").strip().upper()
        if not name:
            raise HTTPException(status_code=400, detail={"error": "Instructor name is required."})
        inst_id = body.get("id") or f"inst-{uuid.uuid4().hex[:8]}"
        current_iso = now_iso()
        with _db_lock:
            db_conn.execute(
                """
                INSERT OR REPLACE INTO instructors (
                  id, university_id, user_id, department_code, name, email, designation, specialization,
                  max_weekly_hours, max_lectures_per_day, unavailable_slots, preferred_slots,
                  avoid_early_morning, avoid_late_afternoon, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    inst_id,
                    uni_id,
                    body.get("userId"),
                    dept_code,
                    name,
                    body.get("email") or "",
                    body.get("designation") or "Professor",
                    body.get("specialization") or "",
                    int(body.get("maxWeeklyHours") or 15),
                    int(body.get("maxLecturesPerDay") or 3),
                    json.dumps(body.get("unavailableSlots") or []),
                    json.dumps(body.get("preferredSlots") or []),
                    1 if body.get("avoidEarlyMorning") else 0,
                    1 if body.get("avoidLateAfternoon") else 0,
                    current_iso,
                ),
            )
            db_conn.commit()
            created = row_to_dict(db_conn.execute("SELECT * FROM instructors WHERE id = ?", (inst_id,)).fetchone())
        return {"message": "Instructor saved.", "instructor": created}

    @app.get("/api/classrooms")
    def list_classrooms(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request)
        uni_id = get_query_param(request, "universityId", "") or auth_user.get("institutionId") or "inst-western-poly"
        with _db_lock:
            rows = rows_to_dicts(
                db_conn.execute("SELECT * FROM classrooms WHERE university_id = ? ORDER BY name ASC", (uni_id,)).fetchall()
            )
        for r in rows:
            r["equipment"] = _safe_json_loads(r.get("equipment"), [])
            r["unavailable_slots"] = _safe_json_loads(r.get("unavailable_slots"), [])
        return {"classrooms": rows}

    @app.post("/api/classrooms", status_code=201)
    async def create_classroom(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request, allowed_roles=["admin"])
        body = await parse_json_body(request)
        uni_id = body.get("universityId") or auth_user.get("institutionId") or "inst-western-poly"
        name = str(body.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail={"error": "Classroom name is required."})
        room_id = body.get("id") or f"room-{uuid.uuid4().hex[:8]}"
        current_iso = now_iso()
        with _db_lock:
            db_conn.execute(
                """
                INSERT OR REPLACE INTO classrooms (
                  id, university_id, name, building, floor, type, capacity, equipment, unavailable_slots, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    room_id,
                    uni_id,
                    name,
                    body.get("building") or "Main Academic Block",
                    int(body.get("floor") or 1),
                    body.get("type") or "Theory",
                    int(body.get("capacity") or 60),
                    json.dumps(body.get("equipment") or []),
                    json.dumps(body.get("unavailableSlots") or []),
                    current_iso,
                ),
            )
            db_conn.commit()
            created = row_to_dict(db_conn.execute("SELECT * FROM classrooms WHERE id = ?", (room_id,)).fetchone())
        return {"message": "Classroom saved.", "classroom": created}

    @app.get("/api/students")
    def list_students(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request)
        uni_id = get_query_param(request, "universityId", "") or auth_user.get("institutionId") or "inst-western-poly"
        batch_id = get_query_param(request, "batchId", "")
        with _db_lock:
            if batch_id:
                rows = rows_to_dicts(
                    db_conn.execute(
                        """
                        SELECT id, name, email, role, batch_id, registration_number, section, is_active, created_at
                        FROM users
                        WHERE institution_id = ? AND batch_id = ? AND role IN ('student', 'br')
                        ORDER BY name ASC
                        """,
                        (uni_id, batch_id),
                    ).fetchall()
                )
            else:
                rows = rows_to_dicts(
                    db_conn.execute(
                        """
                        SELECT id, name, email, role, batch_id, registration_number, section, is_active, created_at
                        FROM users
                        WHERE institution_id = ? AND role IN ('student', 'br')
                        ORDER BY name ASC
                        """,
                        (uni_id,),
                    ).fetchall()
                )
        return {"students": rows}

    # =========================================================
    # STUDENT & INSTRUCTOR PREFERENCES ENDPOINTS
    # =========================================================
    @app.get("/api/preferences/student")
    def get_student_preferences(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request)
        uni_id = auth_user.get("institutionId") or "inst-western-poly"
        with _db_lock:
            if auth_user.get("role") == "admin":
                rows = rows_to_dicts(
                    db_conn.execute("SELECT * FROM student_preferences WHERE university_id = ?", (uni_id,)).fetchall()
                )
            else:
                rows = rows_to_dicts(
                    db_conn.execute(
                        "SELECT * FROM student_preferences WHERE student_user_id = ?",
                        (auth_user.get("userId"),),
                    ).fetchall()
                )
        for r in rows:
            r["preferred_lab_slots"] = _safe_json_loads(r.get("preferred_lab_slots"), [])
        return {"preferences": rows}

    @app.post("/api/preferences/student")
    async def save_student_preference(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request, allowed_roles=["student", "br", "admin"])
        body = await parse_json_body(request)
        uni_id = auth_user.get("institutionId") or "inst-western-poly"
        student_id = body.get("studentUserId") if auth_user.get("role") == "admin" and body.get("studentUserId") else auth_user.get("userId")
        batch_id = body.get("batchId") or auth_user.get("batchId") or "batch-2k25-bscs"
        pref_id = f"spref-{student_id}"
        current_iso = now_iso()

        with _db_lock:
            db_conn.execute(
                """
                INSERT INTO student_preferences (
                  id, university_id, student_user_id, batch_id,
                  preferred_start_window, preferred_lab_slots,
                  avoid_early_morning, avoid_late_evening,
                  max_acceptable_idle_gaps, compact_schedule_weight,
                  preferred_free_day, notes, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(student_user_id) DO UPDATE SET
                  preferred_start_window = excluded.preferred_start_window,
                  preferred_lab_slots = excluded.preferred_lab_slots,
                  avoid_early_morning = excluded.avoid_early_morning,
                  avoid_late_evening = excluded.avoid_late_evening,
                  max_acceptable_idle_gaps = excluded.max_acceptable_idle_gaps,
                  compact_schedule_weight = excluded.compact_schedule_weight,
                  preferred_free_day = excluded.preferred_free_day,
                  notes = excluded.notes,
                  updated_at = excluded.updated_at
                """,
                (
                    pref_id,
                    uni_id,
                    student_id,
                    batch_id,
                    body.get("preferredStartWindow") or "09:00-14:00",
                    json.dumps(body.get("preferredLabSlots") or []),
                    1 if body.get("avoidEarlyMorning") else 0,
                    1 if body.get("avoidLateEvening", True) else 0,
                    int(body.get("maxAcceptableIdleGaps", 1)),
                    float(body.get("compactScheduleWeight", 0.85)),
                    body.get("preferredFreeDay"),
                    body.get("notes") or "",
                    current_iso,
                ),
            )
            db_conn.commit()
            saved = row_to_dict(
                db_conn.execute("SELECT * FROM student_preferences WHERE student_user_id = ?", (student_id,)).fetchone()
            )
        return {"message": "Student scheduling preferences saved.", "preference": saved}

    @app.get("/api/preferences/instructor")
    def get_instructor_preferences(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request)
        uni_id = auth_user.get("institutionId") or "inst-western-poly"
        with _db_lock:
            rows = rows_to_dicts(
                db_conn.execute("SELECT * FROM instructor_preferences WHERE university_id = ?", (uni_id,)).fetchall()
            )
        for r in rows:
            r["preferred_days"] = _safe_json_loads(r.get("preferred_days"), [])
            r["preferred_slots"] = _safe_json_loads(r.get("preferred_slots"), [])
            r["unavailable_slots"] = _safe_json_loads(r.get("unavailable_slots"), [])
        return {"preferences": rows}

    @app.post("/api/preferences/instructor")
    async def save_instructor_preference(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request, allowed_roles=["faculty", "admin"])
        body = await parse_json_body(request)
        uni_id = auth_user.get("institutionId") or "inst-western-poly"
        instructor_id = str(body.get("instructorId") or auth_user.get("userId") or "inst-turing").strip()
        pref_id = f"ipref-{instructor_id}"
        current_iso = now_iso()

        with _db_lock:
            db_conn.execute(
                """
                INSERT INTO instructor_preferences (
                  id, university_id, instructor_id, preferred_days, preferred_slots,
                  unavailable_slots, max_consecutive_hours, avoid_early_morning,
                  avoid_late_afternoon, notes, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(instructor_id) DO UPDATE SET
                  preferred_days = excluded.preferred_days,
                  preferred_slots = excluded.preferred_slots,
                  unavailable_slots = excluded.unavailable_slots,
                  max_consecutive_hours = excluded.max_consecutive_hours,
                  avoid_early_morning = excluded.avoid_early_morning,
                  avoid_late_afternoon = excluded.avoid_late_afternoon,
                  notes = excluded.notes,
                  updated_at = excluded.updated_at
                """,
                (
                    pref_id,
                    uni_id,
                    instructor_id,
                    json.dumps(body.get("preferredDays") or ["Mon", "Tue", "Wed", "Thu", "Fri"]),
                    json.dumps(body.get("preferredSlots") or []),
                    json.dumps(body.get("unavailableSlots") or []),
                    int(body.get("maxConsecutiveHours", 2)),
                    1 if body.get("avoidEarlyMorning") else 0,
                    1 if body.get("avoidLateAfternoon") else 0,
                    body.get("notes") or "",
                    current_iso,
                ),
            )
            db_conn.commit()
            saved = row_to_dict(
                db_conn.execute("SELECT * FROM instructor_preferences WHERE instructor_id = ?", (instructor_id,)).fetchone()
            )
        return {"message": "Instructor scheduling preferences saved.", "preference": saved}

    # =========================================================
    # CUSTOM HYBRID AI OPTIMIZATION ENGINE ENDPOINTS
    # (DSatur Graph Coloring + Genetic Algorithm + Simulated Annealing)
    # =========================================================
    @app.post("/api/optimization/run")
    async def run_optimization(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request, allowed_roles=["admin", "faculty", "br", "student"])
        body = await parse_json_body(request)
        uni_id = body.get("universityId") or auth_user.get("institutionId") or "inst-western-poly"

        inputs = _load_university_optimization_inputs(uni_id, body)
        hyperparams = body.get("hyperparameters") or {}
        objective_weights = body.get("weights") or {}
        algorithm = str(body.get("algorithm") or "hybrid_dsatur_ga_sa").strip()

        pipeline_result = run_hybrid_timetable_pipeline(
            sections=inputs["sections"],
            courses=inputs["courses"],
            rooms_raw=inputs["rooms_raw"],
            student_groups=inputs["student_groups"],
            time_config=inputs["time_config"],
            weights=inputs["weights"],
            algorithm=algorithm,
        )

        run_id = f"opt-run-{uuid.uuid4().hex[:8]}"
        version_id = f"tt-ver-{uuid.uuid4().hex[:8]}"
        current_iso = now_iso()

        fb = pipeline_result["fitness"]
        hist = pipeline_result.get("fitnessHistory") or [fb["totalScore"]]
        dsatur_fit = float(hist[0]) if hist else float(fb["totalScore"])
        ga_fit = float(hist[-1]) if hist else float(fb["totalScore"])
        sa_fit = float(fb["totalScore"])
        hard_violations = int(pipeline_result["hardConstraintViolations"])
        exec_ms = int(pipeline_result["executionTimeMs"])

        with _db_lock:
            db_conn.execute(
                """
                INSERT INTO optimization_runs (
                  id, university_id, triggered_by_user_id, algorithm_pipeline, status,
                  hyperparameters, objective_weights, dsatur_initial_fitness,
                  ga_best_fitness, sa_final_fitness, hard_constraint_violations,
                  execution_time_ms, generations_executed, sa_iterations_executed,
                  convergence_history, summary_metrics, created_at
                ) VALUES (?, ?, ?, ?, 'Completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    uni_id,
                    auth_user.get("userId"),
                    algorithm,
                    json.dumps(hyperparams),
                    json.dumps(objective_weights),
                    dsatur_fit,
                    ga_fit,
                    sa_fit,
                    hard_violations,
                    exec_ms,
                    len(hist),
                    30,
                    json.dumps(hist),
                    json.dumps(fb),
                    current_iso,
                ),
            )

            # Save overall optimization score and per-batch scores
            db_conn.execute(
                """
                INSERT INTO optimization_scores (
                  id, optimization_run_id, university_id, batch_id,
                  overall_fitness_score, hard_constraint_score, student_preference_score,
                  compactness_score, workload_balance_score, instructor_preference_score,
                  batch_fairness_score, room_utilization_score, average_idle_gaps_per_day, created_at
                ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"score-{uuid.uuid4().hex[:8]}",
                    run_id,
                    uni_id,
                    fb["totalScore"],
                    100.0 if hard_violations == 0 else max(0.0, 100.0 - hard_violations * 20.0),
                    fb["studentSatisfaction"],
                    fb["compactnessScore"],
                    fb["workloadBalanceScore"],
                    fb["instructorSatisfaction"],
                    fb["fairnessScore"],
                    fb["roomUtilization"],
                    fb["studentGapMinutesAvg"],
                    current_iso,
                ),
            )

            for b_id, b_score in (fb.get("batchSatisfactionByBatch") or {}).items():
                db_conn.execute(
                    """
                    INSERT INTO optimization_scores (
                      id, optimization_run_id, university_id, batch_id,
                      overall_fitness_score, hard_constraint_score, student_preference_score,
                      compactness_score, workload_balance_score, instructor_preference_score,
                      batch_fairness_score, room_utilization_score, average_idle_gaps_per_day, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        f"score-{uuid.uuid4().hex[:8]}",
                        run_id,
                        uni_id,
                        b_id,
                        b_score,
                        100.0 if hard_violations == 0 else 0.0,
                        b_score,
                        fb["compactnessScore"],
                        fb["workloadBalanceScore"],
                        fb["instructorSatisfaction"],
                        fb["fairnessScore"],
                        fb["roomUtilization"],
                        fb["studentGapMinutesAvg"],
                        current_iso,
                    ),
                )

            version_name = body.get("versionName") or f"Hybrid AI Schedule ({current_iso[:10]})"
            db_conn.execute(
                """
                INSERT INTO timetable_versions (
                  id, university_id, optimization_run_id, version_name, status,
                  fitness_score, hard_conflicts_count, entries_json, metrics_json,
                  created_by_user_id, published_at, created_at
                ) VALUES (?, ?, ?, ?, 'Published', ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    version_id,
                    uni_id,
                    run_id,
                    version_name,
                    fb["totalScore"],
                    hard_violations,
                    json.dumps(pipeline_result["assignments"]),
                    json.dumps(fb),
                    auth_user.get("userId"),
                    current_iso,
                    current_iso,
                ),
            )
            db_conn.commit()

        return {
            "runId": run_id,
            "timetableVersionId": version_id,
            **pipeline_result,
        }

    @app.post("/api/optimization/compare")
    async def compare_optimization(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request)
        body = await parse_json_body(request)
        uni_id = body.get("universityId") or auth_user.get("institutionId") or "inst-western-poly"
        inputs = _load_university_optimization_inputs(uni_id, body)

        comparison = compare_optimization_algorithms(
            sections=inputs["sections"],
            courses=inputs["courses"],
            rooms_raw=inputs["rooms_raw"],
            student_groups=inputs["student_groups"],
            time_config=inputs["time_config"],
            weights=inputs["weights"],
        )
        return comparison

    @app.get("/api/optimization/runs")
    def list_optimization_runs(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request)
        uni_id = get_query_param(request, "universityId", "") or auth_user.get("institutionId") or "inst-western-poly"
        with _db_lock:
            runs = rows_to_dicts(
                db_conn.execute(
                    "SELECT * FROM optimization_runs WHERE university_id = ? ORDER BY created_at DESC LIMIT 25",
                    (uni_id,),
                ).fetchall()
            )
            scores = rows_to_dicts(
                db_conn.execute(
                    "SELECT * FROM optimization_scores WHERE university_id = ? ORDER BY created_at DESC LIMIT 100",
                    (uni_id,),
                ).fetchall()
            )
        for r in runs:
            r["hyperparameters"] = _safe_json_loads(r.get("hyperparameters"), {})
            r["objective_weights"] = _safe_json_loads(r.get("objective_weights"), {})
            r["convergence_history"] = _safe_json_loads(r.get("convergence_history"), [])
            r["summary_metrics"] = _safe_json_loads(r.get("summary_metrics"), {})
        return {"runs": runs, "scores": scores}

    # =========================================================
    # TIMETABLE VERSIONS & PUBLISHING ENDPOINTS
    # =========================================================
    @app.get("/api/timetables")
    def list_timetable_versions(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request)
        uni_id = get_query_param(request, "universityId", "") or auth_user.get("institutionId") or "inst-western-poly"
        with _db_lock:
            versions = rows_to_dicts(
                db_conn.execute(
                    "SELECT * FROM timetable_versions WHERE university_id = ? ORDER BY created_at DESC LIMIT 20",
                    (uni_id,),
                ).fetchall()
            )
        for v in versions:
            v["entries"] = _safe_json_loads(v.get("entries_json"), {})
            v["metrics"] = _safe_json_loads(v.get("metrics_json"), {})
        return {"timetables": versions}

    @app.post("/api/timetables/{versionId}/publish")
    def publish_timetable_version(versionId: str, request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request, allowed_roles=["admin"])
        uni_id = auth_user.get("institutionId") or "inst-western-poly"
        current_iso = now_iso()
        with _db_lock:
            existing = row_to_dict(
                db_conn.execute("SELECT * FROM timetable_versions WHERE id = ?", (versionId,)).fetchone()
            )
            if not existing:
                raise HTTPException(status_code=404, detail={"error": "Timetable version not found."})

            db_conn.execute(
                "UPDATE timetable_versions SET status = 'Published', published_at = ? WHERE id = ?",
                (current_iso, versionId),
            )
            db_conn.execute(
                """
                INSERT INTO notifications (
                  id, university_id, recipient_user_id, recipient_batch_id, recipient_role,
                  category, title, message, is_read, created_at
                ) VALUES (?, ?, NULL, NULL, NULL, 'TimetablePublished', ?, ?, 0, ?)
                """,
                (
                    f"notif-{uuid.uuid4().hex[:8]}",
                    uni_id,
                    f"Published Timetable: {existing['version_name']}",
                    f"The official conflict-free timetable ({existing['version_name']}) has been published with fitness score {existing['fitness_score']}.",
                    current_iso,
                ),
            )
            db_conn.commit()
        return {"message": f"Timetable version '{existing['version_name']}' published."}

    # =========================================================
    # ADAPTIVE TABU SEARCH RESCHEDULING ENDPOINTS
    # =========================================================
    @app.post("/api/rescheduling/disruptions")
    async def report_disruption_and_reschedule(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request, allowed_roles=["admin", "faculty", "br"])
        body = await parse_json_body(request)
        uni_id = body.get("universityId") or auth_user.get("institutionId") or "inst-western-poly"

        disruption_type = str(body.get("type") or body.get("disruptionType") or "instructor_unavailable").strip()
        title = str(body.get("title") or f"Disruption: {disruption_type}").strip()
        description = str(body.get("description") or "Dynamic schedule disruption requiring minimal-change Tabu Search recovery.").strip()

        inputs = _load_university_optimization_inputs(uni_id, body)

        current_assignments = body.get("currentAssignments")
        timetable_version_id = body.get("timetableVersionId")
        if not isinstance(current_assignments, dict) or not current_assignments:
            with _db_lock:
                latest_tt = row_to_dict(
                    db_conn.execute(
                        "SELECT id, entries_json FROM timetable_versions WHERE university_id = ? ORDER BY created_at DESC LIMIT 1",
                        (uni_id,),
                    ).fetchone()
                )
            if latest_tt and latest_tt.get("entries_json"):
                loaded = _safe_json_loads(latest_tt["entries_json"], {})
                if isinstance(loaded, dict) and loaded:
                    current_assignments = loaded
                    timetable_version_id = latest_tt["id"]
            if not isinstance(current_assignments, dict) or not current_assignments:
                initial_run = run_hybrid_timetable_pipeline(
                    sections=inputs["sections"],
                    courses=inputs["courses"],
                    rooms_raw=inputs["rooms_raw"],
                    student_groups=inputs["student_groups"],
                    time_config=inputs["time_config"],
                    weights=inputs["weights"],
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
            reason=description,
            current_section_assignments=current_assignments,
            sections=inputs["sections"],
            courses=inputs["courses"],
            rooms_raw=inputs["rooms_raw"],
            student_groups=inputs["student_groups"],
            time_config=inputs["time_config"],
            weights=inputs["weights"],
        )

        disruption_id = f"disrupt-{uuid.uuid4().hex[:8]}"
        proposal_id = f"prop-{uuid.uuid4().hex[:8]}"
        current_iso = now_iso()

        with _db_lock:
            db_conn.execute(
                """
                INSERT INTO disruption_events (
                  id, university_id, timetable_version_id, disruption_type, title, description,
                  affected_instructor_id, affected_classroom_id, affected_batch_id,
                  affected_day, affected_slots, severity, status, reported_by_user_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ProposalGenerated', ?, ?)
                """,
                (
                    disruption_id,
                    uni_id,
                    timetable_version_id,
                    disruption_type,
                    title,
                    description,
                    affected_resource_id if "instructor" in disruption_type else None,
                    affected_resource_id if "room" in disruption_type or "lab" in disruption_type else None,
                    body.get("batchId"),
                    ",".join(affected_days),
                    json.dumps(affected_start_times),
                    body.get("severity") or "High",
                    auth_user.get("userId"),
                    current_iso,
                ),
            )

            db_conn.execute(
                """
                INSERT INTO rescheduling_proposals (
                  id, university_id, disruption_event_id, timetable_version_id,
                  algorithm_used, status, affected_classes_count, moved_classes_count,
                  unchanged_classes_count, stability_score, new_fitness_score,
                  hard_conflicts_introduced, diff_payload, updated_entries_json,
                  execution_time_ms, created_at
                ) VALUES (?, ?, ?, ?, 'tabu_search_rescheduler', 'Pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    proposal_id,
                    uni_id,
                    disruption_id,
                    timetable_version_id,
                    int(proposal_result["affectedSessionsCount"]),
                    int(proposal_result["changedSessionsCount"]),
                    int(proposal_result["unchangedSessionsCount"]),
                    float(proposal_result["stabilityPercentage"]),
                    float(proposal_result["proposedQualityScore"]),
                    int(proposal_result["remainingHardViolations"]),
                    json.dumps(proposal_result["changes"]),
                    json.dumps(proposal_result["proposedAssignments"]),
                    int(proposal_result["repairExecutionTimeMs"]),
                    current_iso,
                ),
            )
            db_conn.commit()

        return {
            "disruptionId": disruption_id,
            "proposalId": proposal_id,
            "status": "Pending",
            **proposal_result,
        }

    @app.get("/api/rescheduling/proposals")
    def list_rescheduling_proposals(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request)
        uni_id = get_query_param(request, "universityId", "") or auth_user.get("institutionId") or "inst-western-poly"
        with _db_lock:
            proposals = rows_to_dicts(
                db_conn.execute(
                    """
                    SELECT rp.*, de.disruption_type, de.title as disruption_title, de.description as disruption_description
                    FROM rescheduling_proposals rp
                    LEFT JOIN disruption_events de ON de.id = rp.disruption_event_id
                    WHERE rp.university_id = ?
                    ORDER BY rp.created_at DESC
                    LIMIT 25
                    """,
                    (uni_id,),
                ).fetchall()
            )
        for p in proposals:
            p["changes"] = _safe_json_loads(p.get("diff_payload"), [])
            p["updatedEntries"] = _safe_json_loads(p.get("updated_entries_json"), [])
        return {"proposals": proposals}

    @app.post("/api/rescheduling/proposals/{proposalId}/approve")
    def approve_rescheduling_proposal(proposalId: str, request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request, allowed_roles=["admin"])
        uni_id = auth_user.get("institutionId") or "inst-western-poly"
        current_iso = now_iso()

        with _db_lock:
            prop = row_to_dict(
                db_conn.execute("SELECT * FROM rescheduling_proposals WHERE id = ?", (proposalId,)).fetchone()
            )
            if not prop:
                raise HTTPException(status_code=404, detail={"error": "Rescheduling proposal not found."})

            db_conn.execute(
                """
                UPDATE rescheduling_proposals
                SET status = 'Approved', reviewed_by_user_id = ?, reviewed_at = ?
                WHERE id = ?
                """,
                (auth_user.get("userId"), current_iso, proposalId),
            )
            db_conn.execute(
                "UPDATE disruption_events SET status = 'Resolved' WHERE id = ?",
                (prop["disruption_event_id"],),
            )

            # Create a new published timetable version from the approved rescheduling proposal
            new_tt_id = f"tt-ver-resched-{uuid.uuid4().hex[:6]}"
            db_conn.execute(
                """
                INSERT INTO timetable_versions (
                  id, university_id, optimization_run_id, version_name, status,
                  fitness_score, hard_conflicts_count, entries_json, metrics_json,
                  created_by_user_id, published_at, created_at
                ) VALUES (?, ?, NULL, ?, 'Published', ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_tt_id,
                    uni_id,
                    f"Adaptive Rescheduled Timetable ({current_iso[:10]})",
                    prop["new_fitness_score"],
                    prop["hard_conflicts_introduced"],
                    prop["updated_entries_json"],
                    json.dumps({"stabilityScore": prop["stability_score"], "movedClasses": prop["moved_classes_count"]}),
                    auth_user.get("userId"),
                    current_iso,
                    current_iso,
                ),
            )

            # Notify affected batches
            changes = _safe_json_loads(prop.get("diff_payload"), [])
            db_conn.execute(
                """
                INSERT INTO notifications (
                  id, university_id, recipient_user_id, recipient_batch_id, recipient_role,
                  category, title, message, is_read, created_at
                ) VALUES (?, ?, NULL, NULL, NULL, 'AdaptiveReschedule', ?, ?, 0, ?)
                """,
                (
                    f"notif-{uuid.uuid4().hex[:8]}",
                    uni_id,
                    "Adaptive Schedule Update Approved",
                    f"Tabu Search adaptive rescheduling updated {len(changes)} session(s) while preserving {prop['stability_score']}% schedule stability.",
                    current_iso,
                ),
            )
            db_conn.commit()

        return {
            "message": "Rescheduling proposal approved and published.",
            "timetableVersionId": new_tt_id,
            "proposalId": proposalId,
        }

    @app.post("/api/rescheduling/proposals/{proposalId}/reject")
    def reject_rescheduling_proposal(proposalId: str, request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request, allowed_roles=["admin"])
        current_iso = now_iso()
        with _db_lock:
            prop = row_to_dict(
                db_conn.execute("SELECT * FROM rescheduling_proposals WHERE id = ?", (proposalId,)).fetchone()
            )
            if not prop:
                raise HTTPException(status_code=404, detail={"error": "Rescheduling proposal not found."})

            db_conn.execute(
                """
                UPDATE rescheduling_proposals
                SET status = 'Rejected', reviewed_by_user_id = ?, reviewed_at = ?
                WHERE id = ?
                """,
                (auth_user.get("userId"), current_iso, proposalId),
            )
            db_conn.commit()
        return {"message": "Rescheduling proposal rejected.", "proposalId": proposalId}

    # =========================================================
    # ANALYTICS & NOTIFICATIONS ENDPOINTS
    # =========================================================
    @app.get("/api/analytics/overview")
    def get_analytics_overview(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request)
        uni_id = get_query_param(request, "universityId", "") or auth_user.get("institutionId") or "inst-western-poly"

        with _db_lock:
            latest_run = row_to_dict(
                db_conn.execute(
                    "SELECT * FROM optimization_runs WHERE university_id = ? ORDER BY created_at DESC LIMIT 1",
                    (uni_id,),
                ).fetchone()
            )
            total_batches = db_conn.execute(
                "SELECT COUNT(*) as c FROM batches WHERE institution_id = ?", (uni_id,)
            ).fetchone()["c"]
            total_courses = db_conn.execute(
                "SELECT COUNT(*) as c FROM courses WHERE university_id = ?", (uni_id,)
            ).fetchone()["c"]
            total_rooms = db_conn.execute(
                "SELECT COUNT(*) as c FROM classrooms WHERE university_id = ?", (uni_id,)
            ).fetchone()["c"]
            total_instructors = db_conn.execute(
                "SELECT COUNT(*) as c FROM instructors WHERE university_id = ?", (uni_id,)
            ).fetchone()["c"]
            total_votes = db_conn.execute("SELECT COUNT(*) as c FROM poll_votes").fetchone()["c"]

        summary_metrics = _safe_json_loads(latest_run.get("summary_metrics") if latest_run else None, {})
        return {
            "universityId": uni_id,
            "catalogSummary": {
                "batches": total_batches,
                "courses": total_courses,
                "classrooms": total_rooms,
                "instructors": total_instructors,
                "studentVotesCast": total_votes,
            },
            "latestOptimizationRun": {
                "id": latest_run["id"] if latest_run else None,
                "algorithmPipeline": latest_run["algorithm_pipeline"] if latest_run else "hybrid_dsatur_ga_sa",
                "dsaturInitialFitness": latest_run["dsatur_initial_fitness"] if latest_run else None,
                "gaBestFitness": latest_run["ga_best_fitness"] if latest_run else None,
                "saFinalFitness": latest_run["sa_final_fitness"] if latest_run else None,
                "hardConstraintViolations": latest_run["hard_constraint_violations"] if latest_run else 0,
                "executionTimeMs": latest_run["execution_time_ms"] if latest_run else 0,
                "metrics": summary_metrics,
            },
        }

    @app.get("/api/notifications")
    def list_notifications(request: Request) -> Dict[str, Any]:
        auth_user = require_auth_user(request)
        uni_id = auth_user.get("institutionId") or "inst-western-poly"
        user_id = auth_user.get("userId")
        batch_id = auth_user.get("batchId")
        role = auth_user.get("role")

        with _db_lock:
            rows = rows_to_dicts(
                db_conn.execute(
                    """
                    SELECT * FROM notifications
                    WHERE university_id = ?
                      AND (recipient_user_id IS NULL OR recipient_user_id = ?)
                      AND (recipient_batch_id IS NULL OR recipient_batch_id = ?)
                      AND (recipient_role IS NULL OR recipient_role = ?)
                    ORDER BY created_at DESC
                    LIMIT 50
                    """,
                    (uni_id, user_id, batch_id, role),
                ).fetchall()
            )
        return {"notifications": rows}

    @app.patch("/api/notifications/{notificationId}/read")
    def mark_notification_read(notificationId: str, request: Request) -> Dict[str, Any]:
        require_auth_user(request)
        with _db_lock:
            db_conn.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notificationId,))
            db_conn.commit()
        return {"message": "Notification marked as read."}
