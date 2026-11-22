"""Multi-university institution, workspace relational hydration, and settings endpoints (Supabase PostgreSQL)."""

from __future__ import annotations

import re
import time
import uuid
from collections import defaultdict
from typing import Any, Dict, List

from app.database.supabase import SupabaseQueryError, require_supabase_client
from app.deps import (
    ADMIN_ROLES,
    CATALOG_MANAGER_ROLES,
    get_header,
    get_user_auth_context,
    parse_json_body,
    raise_supabase_http_error,
    require_auth_user,
    resolve_batch_department_id,
    safe_delete_optional,
    safe_insert_optional,
    safe_json_loads,
    safe_select_optional,
    scoped_uni_id,
    write_audit_log,
)
from database import hash_password, now_iso
from fastapi_compat import APIRouter, HTTPException, Request

router = APIRouter(tags=["institutions"])


def _build_time_structure_from_inst(inst: Dict[str, Any]) -> Dict[str, Any]:
    raw_days = inst.get("working_days") or "Mon,Tue,Wed,Thu,Fri"
    working_days = [d.strip() for d in str(raw_days).split(",") if d.strip()]
    if not working_days:
        working_days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    custom_breaks = safe_json_loads(inst.get("custom_breaks"), [])
    if not isinstance(custom_breaks, list) or not custom_breaks:
        mid_start = str(inst.get("midday_break_start") or "13:00")
        mid_dur = int(inst.get("midday_break_duration") or 60)
        try:
            hh, mm = [int(x) for x in mid_start.split(":")[:2]]
            end_tot = hh * 60 + mm + mid_dur
            mid_end = f"{end_tot // 60:02d}:{end_tot % 60:02d}"
        except Exception:
            mid_end = "14:00"
        custom_breaks = [
            {
                "id": "brk-lunch",
                "name": "Midday Break & Prayer Interval",
                "startTime": mid_start,
                "endTime": mid_end,
                "days": ["Mon", "Tue", "Wed", "Thu"],
            }
        ]
    return {
        "id": f"ts-{inst.get('id', 'default')}",
        "name": f"{inst.get('name', 'University')} Master Schedule Grid",
        "workingDays": working_days,
        "periodLengthMinutes": int(inst.get("period_length_minutes") or 50),
        "dayStartTime": str(inst.get("day_start_time") or "09:00"),
        "dayEndTime": str(inst.get("day_end_time") or "17:00"),
        "periods": [],
        "breaks": custom_breaks,
        "shortBreakEnabled": bool(inst.get("short_break_enabled", True)),
        "shortBreakMinutes": int(inst.get("short_break_minutes") if inst.get("short_break_minutes") is not None else 10),
        "includeBreakAfterLastSlot": bool(inst.get("include_break_after_last_slot", False)),
        "middayBreakEnabled": bool(inst.get("midday_break_enabled", True)),
        "middayBreakMode": str(inst.get("midday_break_mode") or "fixed"),
        "middayBreakStartTime": str(inst.get("midday_break_start") or "13:00"),
        "middayBreakDurationMinutes": int(inst.get("midday_break_duration") or 60),
        "labDurationMinutes": int(inst.get("lab_duration_minutes") or 180),
        "labSplitAllowed": bool(inst.get("lab_split_allowed", False)),
        "fridayEnabled": bool(inst.get("friday_enabled", "Fri" in working_days)),
        "fridayMode": str(inst.get("friday_mode") or "jummah_break"),
        "fridayStartTime": inst.get("friday_start_time") or str(inst.get("day_start_time") or "09:00"),
        "fridayEndTime": inst.get("friday_end_time") or str(inst.get("day_end_time") or "17:00"),
        "fridayBreakStartTime": str(inst.get("friday_break_start") or "13:00"),
        "fridayBreakEndTime": str(inst.get("friday_break_end") or "14:30"),
        "fridayClosingTime": str(inst.get("friday_closing_time") or "13:00"),
        "fridayCompressionScope": str(inst.get("friday_compression_scope") or "after_jummah"),
        "fridayPeriodLengthMinutes": int(inst.get("friday_period_length") or 45),
        "fridayShortBreakMinutes": int(inst.get("friday_short_break") if inst.get("friday_short_break") is not None else 5),
        "fridayAllowedBatches": safe_json_loads(inst.get("friday_allowed_batches"), []),
        "fridayAllowedDepartments": safe_json_loads(inst.get("friday_allowed_departments"), []),
        "fridayAfternoonShiftEnabled": bool(inst.get("friday_afternoon_shift_enabled", True)),
        "fridayAfternoonStartTime": str(inst.get("friday_afternoon_start_time") or inst.get("friday_break_end") or "14:30"),
    }


def _hhmm_to_12h(hhmm: str) -> str:
    try:
        hh, mm = [int(x) for x in str(hhmm).split(":")[:2]]
        suffix = "PM" if hh >= 12 else "AM"
        h12 = 12 if (hh % 12) == 0 else (hh % 12)
        return f"{h12}:{mm:02d} {suffix}"
    except Exception:
        return str(hhmm)


def _format_entry_time_slot(start_hhmm: str, end_hhmm: str) -> str:
    try:
        sh, sm = [int(x) for x in str(start_hhmm).split(":")[:2]]
        eh, em = [int(x) for x in str(end_hhmm).split(":")[:2]]
        s_suf = "PM" if sh >= 12 else "AM"
        e_suf = "PM" if eh >= 12 else "AM"
        sh12 = 12 if (sh % 12) == 0 else (sh % 12)
        eh12 = 12 if (eh % 12) == 0 else (eh % 12)
        if s_suf == e_suf:
            return f"{sh12}:{sm:02d} – {eh12}:{em:02d} {e_suf}"
        return f"{sh12}:{sm:02d} {s_suf} – {eh12}:{em:02d} {e_suf}"
    except Exception:
        return f"{start_hhmm} – {end_hhmm}"


def _build_workspace_payload(client: Any, inst_id: str) -> Dict[str, Any]:
    inst = client.select_one("institutions", filters={"id": f"eq.{inst_id}"})
    if not inst:
        raise HTTPException(status_code=404, detail={"error": "Institution not found."})

    campuses = safe_select_optional(client, "campuses", filters={"institution_id": f"eq.{inst_id}"}, order="created_at.asc")
    buildings = safe_select_optional(client, "buildings", filters={"institution_id": f"eq.{inst_id}"}, order="created_at.asc")
    semesters = client.select("semesters", filters={"institution_id": f"eq.{inst_id}"}, order="created_at.asc")
    departments = client.select("departments", filters={"institution_id": f"eq.{inst_id}"}, order="code.asc")
    programs = client.select("academic_programs", filters={"institution_id": f"eq.{inst_id}"}, order="code.asc")
    classrooms = client.select("classrooms", filters={"institution_id": f"eq.{inst_id}"}, order="code.asc")
    laboratories = client.select("laboratories", filters={"institution_id": f"eq.{inst_id}"}, order="code.asc")
    room_equip = client.select("room_equipment_capacities", filters={"institution_id": f"eq.{inst_id}"})
    courses = client.select("courses", filters={"institution_id": f"eq.{inst_id}"}, order="code.asc")
    instructors = client.select("instructors", filters={"institution_id": f"eq.{inst_id}"}, order="name.asc")
    inst_avails = client.select("instructor_availability", filters={"institution_id": f"eq.{inst_id}"})
    inst_prefs = client.select("instructor_preferences", filters={"institution_id": f"eq.{inst_id}"})
    batches = client.select("batches", filters={"institution_id": f"eq.{inst_id}"}, order="code.asc")
    sessions = client.select("course_sessions", filters={"institution_id": f"eq.{inst_id}"}, order="created_at.asc")
    constraints = client.select("scheduling_constraints", filters={"institution_id": f"eq.{inst_id}"}, order="created_at.asc")
    versions = client.select("timetable_versions", filters={"institution_id": f"eq.{inst_id}"}, order="created_at.desc", limit=25)
    opt_runs = client.select("optimization_runs", filters={"institution_id": f"eq.{inst_id}"}, order="created_at.desc", limit=25)
    proposals = client.select("rescheduling_proposals", filters={"institution_id": f"eq.{inst_id}"}, order="created_at.desc", limit=25)
    sched_proposals = safe_select_optional(client, "schedule_proposals", filters={"institution_id": f"eq.{inst_id}"}, order="created_at.desc", limit=50)
    if not sched_proposals:
        fb_rows = client.select(
            "feedback",
            filters={"institution_id": f"eq.{inst_id}", "category": "eq.schedule_proposal"},
            order="created_at.desc",
            limit=50,
        )
        for fb in fb_rows:
            parsed = safe_json_loads(fb.get("comment"), None)
            if isinstance(parsed, dict) and parsed.get("title"):
                sched_proposals.append(
                    {
                        "id": parsed.get("id") or fb["id"],
                        "title": parsed.get("title"),
                        "category": parsed.get("category") or "General",
                        "description": parsed.get("description") or "",
                        "target_slot": parsed.get("targetSlot") or "",
                        "submitted_by": parsed.get("submittedBy") or "Campus Community",
                        "created_at": parsed.get("createdAt") or fb.get("created_at"),
                        "status": parsed.get("status") or "Open",
                        "votes_approve": parsed.get("votesApprove") or 0,
                        "votes_revise": parsed.get("votesRevise") or 0,
                        "voters": parsed.get("voters") or {},
                    }
                )
    audit_logs = safe_select_optional(client, "audit_logs", filters={"institution_id": f"eq.{inst_id}"}, order="created_at.desc", limit=100)
    import_history = safe_select_optional(client, "import_history", filters={"institution_id": f"eq.{inst_id}"}, order="created_at.desc", limit=30)

    entries_by_ver: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    if versions:
        v_filter = f"in.({','.join(v['id'] for v in versions)})"
        all_entries = client.select("timetable_entries", filters={"timetable_version_id": v_filter})
        for e in all_entries:
            entries_by_ver[e["timetable_version_id"]].append(e)

    equip_by_room: Dict[str, List[str]] = defaultdict(list)
    for eq in room_equip:
        if eq.get("room_id") and eq.get("equipment_name"):
            equip_by_room[eq["room_id"]].append(eq["equipment_name"])

    bld_by_name = {str(b.get("name") or "").lower(): b["id"] for b in buildings}
    bld_by_code = {str(b.get("code") or "").lower(): b["id"] for b in buildings}
    dept_by_id = {d["id"]: d for d in departments}
    dept_by_code = {str(d.get("code") or "").upper(): d for d in departments}
    prog_by_dept: Dict[str, str] = {}
    for p in programs:
        if p.get("department_id") and p["department_id"] not in prog_by_dept:
            prog_by_dept[p["department_id"]] = p["id"]

    mapped_campuses = [
        {
            "id": c["id"],
            "name": c["name"],
            "code": c["code"],
            "address": c.get("address") or "",
        }
        for c in campuses
    ]
    if not mapped_campuses:
        mapped_campuses = [
            {
                "id": f"camp-{inst_id}",
                "name": inst.get("campus_name") or "Main Campus",
                "code": inst.get("campus_code") or "MAIN",
                "address": inst.get("campus_name") or "Main Campus",
            }
        ]
    default_campus_id = mapped_campuses[0]["id"]

    mapped_buildings = [
        {
            "id": b["id"],
            "campusId": b.get("campus_id") or default_campus_id,
            "name": b["name"],
            "code": b["code"],
            "floors": int(b.get("floors") or 1),
        }
        for b in buildings
    ]
    default_bld_id = mapped_buildings[0]["id"] if mapped_buildings else f"bld-{inst_id}"

    mapped_terms = [
        {
            "id": s["id"],
            "name": s["name"],
            "code": s["code"],
            "academicYear": s.get("academic_year") or inst.get("academic_year") or "2026–2027",
            "startDate": str(s.get("start_date") or "2026-09-01"),
            "endDate": str(s.get("end_date") or "2026-12-20"),
            "status": s.get("status") or ("active" if s.get("is_active", True) else "archived"),
            "weeksCount": int(s.get("weeks_count") or 16),
            "departmentIds": safe_json_loads(s.get("department_ids"), []),
        }
        for s in semesters
    ]

    mapped_depts = [
        {
            "id": d["id"],
            "name": d["name"],
            "code": d["code"],
            "school": d.get("school") or d.get("faculty_name") or "Engineering & Computing",
            "colorHex": d.get("color_hex") or "#171717",
            "subDepartments": safe_json_loads(d.get("sub_departments"), []),
        }
        for d in departments
    ]

    mapped_programs = [
        {
            "id": p["id"],
            "departmentId": p.get("department_id") or "",
            "name": p["name"],
            "code": p["code"],
            "degreeLevel": (
                "Undergraduate"
                if p.get("degree_level") in ("BS", "BE", "Associate", "Diploma", "Undergraduate")
                else ("Postgraduate" if p.get("degree_level") in ("PhD", "Postgraduate") else "Graduate")
            ),
            "totalSemesters": int(p.get("total_semesters") or 8),
        }
        for p in programs
    ]

    mapped_rooms: List[Dict[str, Any]] = []
    for r in classrooms:
        b_name = str(r.get("building") or "").lower()
        mapped_rooms.append(
            {
                "id": r["id"],
                "buildingId": r.get("building_id") or bld_by_name.get(b_name) or bld_by_code.get(b_name) or default_bld_id,
                "code": r["code"],
                "name": r["name"],
                "building": r.get("building") or "Main Academic Block",
                "floor": int(r.get("floor") or 1),
                "capacity": int(r.get("capacity") or 60),
                "type": r.get("room_type") or "lecture",
                "equipment": equip_by_room.get(r["id"]) or ["Projector"],
                "isAccessible": bool(r.get("is_accessible", True)),
                "isAvailable": bool(r.get("is_available", True)),
            }
        )
    for l in laboratories:
        b_name = str(l.get("building") or "").lower()
        l_eq = l.get("equipment") if isinstance(l.get("equipment"), list) and l.get("equipment") else equip_by_room.get(l["id"], ["Workstations"])
        mapped_rooms.append(
            {
                "id": l["id"],
                "buildingId": l.get("building_id") or bld_by_name.get(b_name) or bld_by_code.get(b_name) or default_bld_id,
                "code": l["code"],
                "name": l["name"],
                "building": l.get("building") or "Engineering Lab Complex",
                "floor": 1,
                "capacity": int(l.get("capacity") or 40),
                "type": "lab",
                "equipment": l_eq,
                "isAccessible": bool(l.get("is_accessible", True)),
                "isAvailable": bool(l.get("is_available", True)),
                "assignedLabEngineerId": l.get("assigned_lab_engineer_id") or undefined_to_none(),
            }
        )

    avail_by_inst: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for a in inst_avails:
        if not a.get("is_available", True):
            avail_by_inst[a["instructor_id"]].append(
                {
                    "day": a["day_of_week"],
                    "timeSlot": f"{a['start_time']} - {a['end_time']}",
                    "reason": a.get("reason") or "Unavailable",
                }
            )
    pref_by_inst = {p["instructor_id"]: p for p in inst_prefs}

    mapped_instructors = []
    for ins in instructors:
        pref = pref_by_inst.get(ins["id"], {})
        mapped_instructors.append(
            {
                "id": ins["id"],
                "departmentId": ins.get("department_id") or "",
                "subDepartment": ins.get("sub_department") or "",
                "staffRole": ins.get("staff_role") or "faculty",
                "qualifiedCourseIds": safe_json_loads(ins.get("qualified_course_ids"), []),
                "name": ins["name"],
                "email": ins["email"],
                "title": ins.get("designation") or "Assistant Professor",
                "maxWeeklyHours": int(ins.get("max_weekly_hours") or 18),
                "maxConsecutiveHours": int(pref.get("avoid_back_to_back_more_than") or ins.get("max_daily_classes") or 3),
                "preferredDays": pref.get("preferred_days") or ["Mon", "Tue", "Wed", "Thu", "Fri"],
                "unavailableSlots": avail_by_inst.get(ins["id"], []),
                "userId": ins.get("user_id"),
            }
        )

    sessions_by_course: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for s in sessions:
        if s.get("course_id"):
            sessions_by_course[s["course_id"]].append(s)

    mapped_courses = []
    for c in courses:
        c_sessions = sessions_by_course.get(c["id"], [])
        first_lec = next((s for s in c_sessions if str(s.get("session_type") or "").lower() != "lab"), None)
        first_lab = next((s for s in c_sessions if str(s.get("session_type") or "").lower() == "lab"), None)
        lec_h = int(c.get("lecture_hours_per_week") if c.get("lecture_hours_per_week") is not None else (c.get("lecture_credit_hours") or 0))
        lab_h = int(c.get("lab_hours_per_week") if c.get("lab_hours_per_week") is not None else ((c.get("lab_credit_hours") or 0) * 3))
        lec_cr = int(c.get("lecture_credit_hours") if c.get("lecture_credit_hours") is not None else lec_h)
        lab_cr = int(c.get("lab_credit_hours") if c.get("lab_credit_hours") is not None else (round(lab_h / 3) if lab_h else 0))
        raw_ct = str(c.get("course_type") or "").strip().lower()
        if raw_ct in ("lecture", "lab", "lecture_lab"):
            ct = raw_ct
        elif lec_h > 0 and lab_h > 0:
            ct = "lecture_lab"
        elif lab_h > 0:
            ct = "lab"
        else:
            ct = "lecture"
        mapped_courses.append(
            {
                "id": c["id"],
                "departmentId": c.get("department_id") or "",
                "subDepartment": c.get("sub_department") or "",
                "code": c["code"],
                "title": c["title"],
                "courseType": ct,
                "creditHours": int(c.get("credit_hours") or max(1, lec_cr + lab_cr)),
                "lectureCredits": lec_cr,
                "labCredits": lab_cr,
                "weeklyContactHours": lec_h + lab_h,
                "lectureHours": lec_h,
                "labHours": lab_h,
                "requiredRoomType": c.get("required_room_type") or ("lab" if ct == "lab" else "lecture"),
                "assignedInstructorId": c.get("assigned_instructor_id") or (first_lec or {}).get("instructor_id") or "",
                "assignedLabEngineerId": c.get("assigned_lab_engineer_id") or (first_lab or {}).get("instructor_id") or "",
                "assignedBatchId": c.get("assigned_batch_id") or "",
                "semester": c.get("semester_number"),
                "labSessionMode": c.get("lab_session_mode") or "continuous",
                "isElective": bool(c.get("is_elective", not c.get("is_compulsory", True))),
                "electivePoolName": c.get("elective_pool_name") or "",
            }
        )

    active_term_id = mapped_terms[0]["id"] if mapped_terms else "term-default"
    mapped_groups = []
    for b in batches:
        d_code = str(b.get("department_code") or "").upper()
        resolved_dept_id = resolve_batch_department_id(b, departments, programs)
        prog_id = b.get("program_id") or (prog_by_dept.get(resolved_dept_id, "") if resolved_dept_id else "")
        mapped_groups.append(
            {
                "id": b["id"],
                "programId": prog_id,
                "departmentId": resolved_dept_id,
                "termId": b.get("term_id") or active_term_id,
                "batchCode": b.get("batch_code") or (b["code"].split("-")[0] if "-" in b["code"] else b["code"]),
                "name": b["name"],
                "code": b["code"],
                "year": int(b.get("year") or 1),
                "semester": int(b.get("semester") or 1),
                "section": b.get("section") or b.get("sections_list") or "A",
                "departmentCode": d_code,
                "academicYear": int(b.get("academic_year") or 2026),
                "homeRoom": b.get("home_room") or "",
                "size": int(b.get("student_count") or 60),
                "sharedCourseIds": safe_json_loads(b.get("shared_course_ids"), []),
            }
        )

    mapped_sections = []
    for s in sessions:
        slot_json = safe_json_loads(s.get("assigned_slot_json"), None)
        if not slot_json and s.get("assigned_day") and s.get("assigned_start_time") and s.get("assigned_room_id"):
            slot_json = {
                "day": s["assigned_day"],
                "startTime24": s["assigned_start_time"],
                "timeSlot": s["assigned_start_time"],
                "roomId": s["assigned_room_id"],
                "durationMinutes": int(s.get("duration_minutes") or 50),
                "sessionType": "Lab" if str(s.get("session_type", "")).lower() == "lab" else "Lecture",
                "spanSlots": int(s.get("span_slots") or 1),
            }
        s_is_lab = str(s.get("session_type") or "").lower() == "lab" or str(s.get("component_type") or "").lower() == "lab"
        mapped_sections.append(
            {
                "id": s["id"],
                "courseId": s["course_id"],
                "termId": s.get("term_id") or active_term_id,
                "sectionNumber": s.get("section_code") or "A",
                "expectedEnrollment": int(s.get("expected_students") or 60),
                "instructorId": s.get("instructor_id") or "",
                "labEngineerId": s.get("lab_engineer_id") or "",
                "studentGroupId": s.get("batch_id") or "",
                "sharedGroupIds": safe_json_loads(s.get("shared_group_ids"), []),
                "sessionType": "Lab" if s_is_lab else "Lecture",
                "componentType": s.get("component_type") or ("lab" if s_is_lab else "lecture"),
                "isAtomicSession": bool(s.get("is_atomic_session", s_is_lab)),
                "spanSlots": int(s.get("span_slots") or (3 if s_is_lab else 1)),
                "sessionsPerWeek": int(s.get("sessions_per_week") or (1 if s_is_lab else 3)),
                "assignedSlot": slot_json,
                "isLocked": bool(s.get("is_locked", False)),
            }
        )

    mapped_constraints = [
        {
            "id": c["id"],
            "code": c.get("code") or c["id"].upper(),
            "name": c["name"],
            "description": c.get("description") or "",
            "kind": c.get("kind") or ("hard" if str(c.get("category", "")).startswith("hard") else "soft"),
            "enabled": bool(c.get("is_enabled", True)),
            "weight": float(c.get("weight") or 1.0),
            "category": (
                c.get("category")
                if c.get("category") in ("instructor", "room", "student", "facility", "temporal")
                else (
                    "instructor" if "instructor" in str(c.get("category", ""))
                    else ("room" if "room" in str(c.get("category", "")) else "student")
                )
            ),
        }
        for c in constraints
    ]

    mapped_scenarios = []
    for v in versions:
        v_id = v["id"]
        v_entries = entries_by_ver.get(v_id, [])
        assignments: Dict[str, Any] = {}
        for idx, e in enumerate(v_entries):
            sec_id = str(e.get("course_session_id") or f"entry-{idx}")
            is_lab = str(e.get("session_type", "")).lower() == "lab" or str(e.get("component_type", "")).lower() == "lab"
            dur = int(e.get("duration_minutes") or (180 if is_lab else 50))
            assignments[sec_id] = {
                "day": e["day_of_week"],
                "timeSlot": _format_entry_time_slot(e["start_time"], e["end_time"]),
                "roomId": e["room_id"],
                "durationMinutes": dur,
                "sessionType": "Lab" if is_lab else "Lecture",
                "spanSlots": 3 if is_lab else 1,
                "startTime24": e["start_time"],
                "endTime24": e["end_time"],
                "slotSource": e.get("slot_source") or "regular",
            }
        mapped_scenarios.append(
            {
                "id": v_id,
                "termId": v.get("semester_id") or active_term_id,
                "name": v["name"],
                "version": v.get("version_number") or "1.0.0",
                "status": v.get("status") if v.get("status") in ("draft", "published", "archived") else "draft",
                "createdAt": v["created_at"],
                "updatedAt": v.get("updated_at") or v["created_at"],
                "author": v.get("created_by") or "Registrar",
                "metrics": {
                    "clashCount": int(v.get("hard_violations_count") or 0),
                    "satisfactionScore": float(v.get("student_satisfaction_score") or v.get("overall_fitness_score") or 0),
                    "roomUtilizationPercent": float(v.get("room_utilization_score") or 0),
                    "instructorSatisfaction": float(v.get("instructor_satisfaction_score") or 0),
                    "studentTransitScore": float(v.get("fairness_score") or 0),
                },
                "assignments": assignments,
                "timetableEntries": v_entries,
            }
        )

    mapped_feedback_polls = [
        {
            "id": fp["id"],
            "title": fp["title"],
            "category": fp.get("category") or "General",
            "description": fp["description"],
            "targetSlot": fp.get("target_slot") or "",
            "submittedBy": fp.get("submitted_by") or "Campus Member",
            "createdAt": fp["created_at"],
            "status": fp.get("status") or "Open",
            "votesApprove": int(fp.get("votes_approve") or 0),
            "votesRevise": int(fp.get("votes_revise") or 0),
            "voters": safe_json_loads(fp.get("voters"), {}),
        }
        for fp in sched_proposals
    ]

    mapped_audit = [
        {
            "id": a["id"],
            "timestamp": a["created_at"],
            "userId": a.get("user_id") or "system",
            "userName": a.get("user_name") or "Administrator",
            "action": a["action"],
            "entityType": a["entity_type"],
            "entityId": a["entity_id"],
            "summary": a["summary"],
            "previousValue": a.get("previous_value"),
            "newValue": a.get("new_value"),
        }
        for a in audit_logs
    ]

    time_structure = _build_time_structure_from_inst(inst)
    profile = {
        "universityId": inst["id"],
        "universityName": inst["name"],
        "universityCode": inst["code"],
        "campusCode": inst.get("campus_code") or mapped_campuses[0]["code"],
        "campusName": inst.get("campus_name") or "Main Campus",
        "accreditation": inst.get("accreditation") or "Accredited University",
        "registrarName": inst.get("registrar_name") or "University Registrar",
        "registrarEmail": inst.get("registrar_email") or "registrar@university.edu",
        "autoConflictSweep": bool(inst.get("auto_conflict_sweep", True)),
        "defaultSessionMinutes": int(inst.get("default_session_minutes") or inst.get("period_length_minutes") or 50),
        "timetableManagementPolicy": inst.get("timetable_management_policy") or "whole_university",
        "activeTermIds": safe_json_loads(inst.get("active_term_ids"), [t["id"] for t in mapped_terms if t["status"] == "active"]),
        "academicYear": inst.get("academic_year") or "2026–2027",
        "currentTerm": inst.get("current_term") or "Fall Semester 2026",
    }

    return {
        "institution": profile,
        "campuses": mapped_campuses,
        "buildings": mapped_buildings,
        "terms": mapped_terms,
        "departments": mapped_depts,
        "programs": mapped_programs,
        "rooms": mapped_rooms,
        "courses": mapped_courses,
        "instructors": mapped_instructors,
        "studentGroups": mapped_groups,
        "sections": mapped_sections,
        "constraints": mapped_constraints,
        "scenarios": mapped_scenarios,
        "optimizationRuns": opt_runs,
        "reschedulingProposals": proposals,
        "feedbackPolls": mapped_feedback_polls,
        "auditLogs": mapped_audit,
        "importHistory": import_history,
        "timeStructure": time_structure,
        "activeTermIds": profile["activeTermIds"],
        "timetableManagementPolicy": profile["timetableManagementPolicy"],
    }


def undefined_to_none() -> None:
    return None


@router.get("/api/institutions")
def list_institutions(request: Request) -> Dict[str, Any]:
    client = require_supabase_client()
    auth_hdr = get_header(request, "Authorization").strip()
    try:
        if auth_hdr:
            auth_user = require_auth_user(request)
            role = str(auth_user.get("role") or "").lower()
            user_inst_id = str(auth_user.get("institutionId") or "").strip()
            if role != "super_admin" and user_inst_id:
                rows = client.select(
                    "institutions",
                    filters={"id": f"eq.{user_inst_id}"},
                    order="created_at.asc",
                )
                return {"institutions": rows}
            rows = client.select("institutions", order="created_at.asc")
            return {"institutions": rows}

        # Unauthenticated signup/registration lookup: return only minimal public identifiers
        rows = client.select(
            "institutions",
            select="id,name,code,campus_name,is_sample",
            order="created_at.asc",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"institutions": rows}


@router.post("/api/institutions/register")
async def register_institution(request: Request) -> Dict[str, Any]:
    body = await parse_json_body(request)
    name = (body.get("name") or "").strip()
    code = (body.get("code") or "").strip()
    campus_name = (body.get("campusName") or "Main Campus").strip()
    accreditation = (body.get("accreditation") or "Accredited Higher Education Institution").strip()
    admin_name = (body.get("adminName") or "University Administrator").strip()
    admin_email = (body.get("adminEmail") or "").strip().lower()
    admin_password = (body.get("adminPassword") or "").strip()
    working_days = body.get("workingDays") or "Mon,Tue,Wed,Thu,Fri"
    if isinstance(working_days, list):
        working_days = ",".join(str(d) for d in working_days)
    day_start_time = body.get("dayStartTime") or "09:00"
    day_end_time = body.get("dayEndTime") or "17:00"
    period_length_minutes = int(body.get("periodLengthMinutes") or 50)
    short_break_minutes = int(body.get("shortBreakMinutes") or 10)
    midday_break_enabled = bool(body.get("middayBreakEnabled", True))
    midday_break_start = body.get("middayBreakStart") or "13:00"
    midday_break_duration = int(body.get("middayBreakDuration") or 60)
    lab_duration_minutes = int(body.get("labDurationMinutes") or 180)

    if not name or not code or not admin_email or not admin_password:
        raise HTTPException(
            status_code=400,
            detail={"error": "University name, code, admin email, and password are required."},
        )

    clean_code = code.upper()
    slug = re.sub(r"[^a-z0-9]", "-", clean_code.lower())
    inst_id = f"inst-{slug}-{hex(int(time.time() * 1000))[2:]}"
    admin_id = f"user-admin-{int(time.time() * 1000)}"
    current_iso = now_iso()

    client = require_supabase_client()
    try:
        client.insert(
            "institutions",
            {
                "id": inst_id,
                "name": name,
                "code": clean_code,
                "campus_code": "MAIN",
                "campus_name": campus_name,
                "accreditation": accreditation,
                "registrar_name": admin_name,
                "registrar_email": admin_email,
                "academic_year": "2026–2027",
                "current_term": "Fall Semester 2026",
                "working_days": working_days,
                "day_start_time": day_start_time,
                "day_end_time": day_end_time,
                "period_length_minutes": period_length_minutes,
                "short_break_minutes": short_break_minutes,
                "midday_break_enabled": midday_break_enabled,
                "midday_break_start": midday_break_start,
                "midday_break_duration": midday_break_duration,
                "lab_duration_minutes": lab_duration_minutes,
                "timezone": "UTC",
                "is_sample": False,
                "created_at": current_iso,
            },
        )

        client.insert(
            "users",
            {
                "id": admin_id,
                "name": admin_name,
                "email": admin_email,
                "password_hash": hash_password(admin_password),
                "role": "admin",
                "gender": "male",
                "batch_id": None,
                "registration_number": None,
                "section": None,
                "is_active": True,
                "must_reset_password": False,
                "credential_hint": admin_password,
                "institution": name,
                "institution_id": inst_id,
                "created_at": current_iso,
            },
        )

        # Create default campus & active semester so relational onboarding starts clean
        safe_insert_optional(
            client,
            "campuses",
            {
                "id": f"camp-{uuid.uuid4().hex[:8]}",
                "institution_id": inst_id,
                "name": campus_name,
                "code": "MAIN",
                "address": campus_name,
                "created_at": current_iso,
            },
        )
        sem_id = f"term-{uuid.uuid4().hex[:8]}"
        client.insert(
            "semesters",
            {
                "id": sem_id,
                "institution_id": inst_id,
                "name": "Fall Semester 2026",
                "code": "FALL-2026",
                "academic_year": "2026–2027",
                "semester_number": 1,
                "start_date": "2026-09-01",
                "end_date": "2026-12-20",
                "is_active": True,
                "status": "active",
                "weeks_count": 16,
                "created_at": current_iso,
            },
        )
        client.update("institutions", {"id": f"eq.{inst_id}"}, {"active_term_ids": [sem_id]})
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    auth_context = get_user_auth_context(admin_id)
    return {
        "success": True,
        "institutionId": inst_id,
        "institutionName": name,
        "institutionCode": clean_code,
        "user": auth_context,
    }


@router.get("/api/institutions/{id}/workspace")
def get_institution_workspace(id: str, request: Request) -> Dict[str, Any]:
    auth_hdr = get_header(request, "Authorization").strip()
    client = require_supabase_client()
    if auth_hdr:
        auth_user = require_auth_user(request)
        user_inst_id = str(auth_user.get("institutionId") or "").strip()
        if str(auth_user.get("role") or "").lower() != "super_admin" and user_inst_id and id != user_inst_id:
            raise HTTPException(
                status_code=403,
                detail={"error": "Access denied: Cross-institution workspace access is prohibited."},
            )
    else:
        try:
            inst = client.select_one("institutions", filters={"id": f"eq.{id}"}, select="id,is_sample")
        except SupabaseQueryError as err:
            raise_supabase_http_error(err)
        if not inst or not bool(inst.get("is_sample")):
            raise HTTPException(
                status_code=401,
                detail={"error": "Authentication required to access university workspace."},
            )

    try:
        workspace = _build_workspace_payload(client, id)
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"workspace": workspace}


@router.get("/api/institutions/{id}/data")
def get_institution_data(id: str, request: Request) -> Dict[str, Any]:
    auth_hdr = get_header(request, "Authorization").strip()
    client = require_supabase_client()
    if auth_hdr:
        auth_user = require_auth_user(request)
        user_inst_id = str(auth_user.get("institutionId") or "").strip()
        if str(auth_user.get("role") or "").lower() != "super_admin" and user_inst_id and id != user_inst_id:
            raise HTTPException(
                status_code=403,
                detail={"error": "Access denied: Cross-institution data access is prohibited."},
            )
    else:
        try:
            inst = client.select_one("institutions", filters={"id": f"eq.{id}"}, select="id,is_sample")
        except SupabaseQueryError as err:
            raise_supabase_http_error(err)
        if not inst or not bool(inst.get("is_sample")):
            raise HTTPException(
                status_code=401,
                detail={"error": "Authentication required to access university workspace data."},
            )

    try:
        workspace = _build_workspace_payload(client, id)
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"data": workspace}


@router.post("/api/institutions/{id}/data")
async def save_institution_data(id: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    scoped_uni_id(auth_user, id)
    body = await parse_json_body(request)
    data = body.get("data")
    if data is None:
        raise HTTPException(status_code=400, detail={"error": "Missing data payload."})

    client = require_supabase_client()
    try:
        client.insert(
            "institution_data",
            {
                "institution_id": id,
                "payload": data,
                "updated_at": now_iso(),
            },
            upsert=True,
            on_conflict="institution_id",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"success": True, "message": "Institutional snapshot archived."}


@router.get("/api/universities")
def get_universities() -> Dict[str, Any]:
    client = require_supabase_client()
    try:
        rows = client.select("institutions", order="created_at.asc")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
    return {"universities": rows}


@router.patch("/api/universities/{universityId}/settings")
async def update_university_settings(universityId: str, request: Request) -> Dict[str, Any]:
    from app.optimization.constraints import canonicalize_working_days

    auth_user = require_auth_user(request, allowed_roles=ADMIN_ROLES)
    scoped_uni_id(auth_user, universityId)
    body = await parse_json_body(request)
    client = require_supabase_client()

    try:
        existing = client.select_one("institutions", filters={"id": f"eq.{universityId}"})
        if not existing:
            raise HTTPException(status_code=404, detail={"error": "University not found."})

        friday_enabled = bool(
            body["fridayEnabled"]
            if "fridayEnabled" in body
            else existing.get("friday_enabled", "Fri" in str(existing.get("working_days", "Fri")))
        )
        raw_days = body.get("workingDays") or existing["working_days"]
        if isinstance(raw_days, str):
            raw_days = [d.strip() for d in raw_days.split(",") if d.strip()]
        working_days_list = canonicalize_working_days(raw_days, friday_enabled)
        working_days = ",".join(working_days_list)

        day_start = body.get("dayStartTime") or existing["day_start_time"]
        day_end = body.get("dayEndTime") or existing["day_end_time"]
        period_len = int(body.get("periodLengthMinutes") or existing["period_length_minutes"])
        short_break = int(
            body.get("shortBreakMinutes") if "shortBreakMinutes" in body else existing["short_break_minutes"]
        )
        midday_enabled = bool(body.get("middayBreakEnabled", bool(existing["midday_break_enabled"])))
        midday_start = body.get("middayBreakStartTime") or body.get("middayBreakStart") or existing["midday_break_start"]
        midday_dur = int(
            body.get("middayBreakDurationMinutes") or body.get("middayBreakDuration") or existing["midday_break_duration"]
        )
        lab_dur = int(body.get("labDurationMinutes") or existing["lab_duration_minutes"])

        fri_break_start = (
            body.get("fridayBreakStartTime")
            or body.get("fridayBreakStart")
            or existing.get("friday_break_start")
            or "13:00"
        )
        fri_break_end = (
            body.get("fridayBreakEndTime")
            or body.get("fridayBreakEnd")
            or body.get("fridayAfternoonStartTime")
            or existing.get("friday_break_end")
            or "14:30"
        )

        patch: Dict[str, Any] = {
            "working_days": working_days,
            "day_start_time": day_start,
            "day_end_time": day_end,
            "period_length_minutes": period_len,
            "short_break_minutes": short_break,
            "short_break_enabled": bool(body.get("shortBreakEnabled", existing.get("short_break_enabled", True))),
            "include_break_after_last_slot": bool(
                body.get("includeBreakAfterLastSlot", existing.get("include_break_after_last_slot", False))
            ),
            "midday_break_enabled": midday_enabled,
            "midday_break_mode": body.get("middayBreakMode") or existing.get("midday_break_mode") or "fixed",
            "midday_break_start": midday_start,
            "midday_break_duration": midday_dur,
            "lab_duration_minutes": lab_dur,
            "lab_split_allowed": bool(body.get("labSplitAllowed", existing.get("lab_split_allowed", False))),
            "friday_enabled": friday_enabled,
            "friday_mode": body.get("fridayMode") or existing.get("friday_mode") or "jummah_break",
            "friday_start_time": body.get("fridayStartTime") if "fridayStartTime" in body else existing.get("friday_start_time"),
            "friday_end_time": body.get("fridayEndTime") if "fridayEndTime" in body else existing.get("friday_end_time"),
            "friday_break_start": fri_break_start,
            "friday_break_end": fri_break_end,
            "friday_closing_time": body.get("fridayClosingTime") or existing.get("friday_closing_time") or "13:00",
            "friday_compression_scope": body.get("fridayCompressionScope")
            or existing.get("friday_compression_scope")
            or "after_jummah",
            "friday_period_length": int(
                body.get("fridayPeriodLengthMinutes")
                or body.get("fridayPeriodLength")
                or existing.get("friday_period_length")
                or 45
            ),
            "friday_short_break": int(
                body["fridayShortBreakMinutes"]
                if "fridayShortBreakMinutes" in body
                else existing.get("friday_short_break", 5)
            ),
            "friday_allowed_batches": body.get("fridayAllowedBatches")
            if "fridayAllowedBatches" in body
            else (existing.get("friday_allowed_batches") or []),
            "friday_allowed_departments": body.get("fridayAllowedDepartments")
            if "fridayAllowedDepartments" in body
            else (existing.get("friday_allowed_departments") or []),
            "friday_afternoon_shift_enabled": bool(
                body.get("fridayAfternoonShiftEnabled", existing.get("friday_afternoon_shift_enabled", True))
            ),
            "friday_afternoon_start_time": body.get("fridayAfternoonStartTime") or fri_break_end,
        }

        if "breaks" in body and isinstance(body["breaks"], list):
            patch["custom_breaks"] = body["breaks"]
        if "universityName" in body and str(body["universityName"]).strip():
            patch["name"] = str(body["universityName"]).strip()
        if "campusCode" in body and str(body["campusCode"]).strip():
            patch["campus_code"] = str(body["campusCode"]).strip().upper()
        if "campusName" in body and str(body["campusName"]).strip():
            patch["campus_name"] = str(body["campusName"]).strip()
        if "accreditation" in body and str(body["accreditation"]).strip():
            patch["accreditation"] = str(body["accreditation"]).strip()
        if "registrarName" in body and str(body["registrarName"]).strip():
            patch["registrar_name"] = str(body["registrarName"]).strip()
        if "registrarEmail" in body and str(body["registrarEmail"]).strip():
            patch["registrar_email"] = str(body["registrarEmail"]).strip().lower()
        if "autoConflictSweep" in body:
            patch["auto_conflict_sweep"] = bool(body["autoConflictSweep"])
        if "defaultSessionMinutes" in body:
            patch["default_session_minutes"] = int(body["defaultSessionMinutes"])
        if "timetableManagementPolicy" in body and body["timetableManagementPolicy"] in ("whole_university", "department_wise"):
            patch["timetable_management_policy"] = body["timetableManagementPolicy"]
        if "activeTermIds" in body and isinstance(body["activeTermIds"], list):
            patch["active_term_ids"] = body["activeTermIds"]

        updated_rows = client.update("institutions", {"id": f"eq.{universityId}"}, patch)
        updated = updated_rows[0] if updated_rows else existing
        write_audit_log(
            client,
            universityId,
            auth_user,
            "update",
            "time",
            universityId,
            "Updated university profile, scheduling policy, and academic timing parameters",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {
        "message": "University scheduling settings updated.",
        "university": updated,
        "timeStructure": _build_time_structure_from_inst(updated),
    }


@router.post("/api/institutions/{id}/reset")
def reset_institution_workspace(id: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=ADMIN_ROLES)
    uni_id = scoped_uni_id(auth_user, id)
    client = require_supabase_client()

    optional_tables = {
        "timetable_feedback",
        "optimization_poll_traceability",
        "buildings",
        "campuses",
        "schedule_proposals",
        "audit_logs",
        "import_history",
    }
    tables_to_clear = [
        "timetable_feedback",
        "optimization_poll_traceability",
        "optimization_scores",
        "timetable_entries",
        "optimization_runs",
        "rescheduling_history",
        "rescheduling_proposals",
        "disruptions",
        "timetable_versions",
        "course_enrollments",
        "course_sessions",
        "scheduling_constraints",
        "courses",
        "batches",
        "instructor_availability",
        "instructor_preferences",
        "instructors",
        "room_equipment_capacities",
        "classrooms",
        "laboratories",
        "academic_programs",
        "departments",
        "semesters",
        "buildings",
        "campuses",
        "schedule_proposals",
        "audit_logs",
    ]
    try:
        for tbl in tables_to_clear:
            if tbl in optional_tables:
                safe_delete_optional(client, tbl, {"institution_id": f"eq.{uni_id}"})
            else:
                client.delete(tbl, {"institution_id": f"eq.{uni_id}"})
        inst_polls = client.select("polls", filters={"institution_id": f"eq.{uni_id}"}, select="id")
        if inst_polls:
            p_filter = f"in.({','.join(p['id'] for p in inst_polls)})"
            client.delete("poll_votes", {"poll_id": p_filter})
            client.delete("poll_options", {"poll_id": p_filter})
        client.delete("polls", {"institution_id": f"eq.{uni_id}"})
        inst_batches = client.select("batches", filters={"institution_id": f"eq.{uni_id}"}, select="id")
        if inst_batches:
            b_filter = f"in.({','.join(b['id'] for b in inst_batches)})"
            client.delete("br_assignments", {"batch_id": b_filter})
        client.delete("notifications", {"institution_id": f"eq.{uni_id}"})
        client.delete("student_preferences", {"institution_id": f"eq.{uni_id}"})
        client.delete("students", {"institution_id": f"eq.{uni_id}"})
        client.delete("institution_data", {"institution_id": f"eq.{uni_id}"})
        client.delete("feedback", {"institution_id": f"eq.{uni_id}"})
        client.update("institutions", {"id": f"eq.{uni_id}"}, {"active_term_ids": []})
        write_audit_log(
            client,
            uni_id,
            auth_user,
            "delete",
            "scenario",
            uni_id,
            "Reset university catalog, timetables, and constraints in Supabase",
        )
        workspace = _build_workspace_payload(client, uni_id)
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "University workspace cleared in Supabase.", "workspace": workspace}


@router.delete("/api/institutions/{id}")
def delete_institution(id: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=ADMIN_ROLES)
    uni_id = scoped_uni_id(auth_user, id)
    client = require_supabase_client()

    try:
        inst = client.select_one("institutions", filters={"id": f"eq.{uni_id}"}, select="id,is_sample,name")
        if not inst:
            raise HTTPException(status_code=404, detail={"error": "Institution not found."})
        if bool(inst.get("is_sample")):
            raise HTTPException(status_code=400, detail={"error": "Built-in sample institution cannot be deleted."})

        optional_tables = {
            "timetable_feedback",
            "optimization_poll_traceability",
            "buildings",
            "campuses",
            "schedule_proposals",
            "audit_logs",
            "import_history",
        }
        tables_to_clear = [
            "timetable_feedback",
            "optimization_poll_traceability",
            "optimization_scores",
            "timetable_entries",
            "optimization_runs",
            "rescheduling_history",
            "rescheduling_proposals",
            "disruptions",
            "timetable_versions",
            "course_enrollments",
            "course_sessions",
            "scheduling_constraints",
            "courses",
            "batches",
            "instructor_availability",
            "instructor_preferences",
            "instructors",
            "room_equipment_capacities",
            "classrooms",
            "laboratories",
            "academic_programs",
            "departments",
            "semesters",
            "buildings",
            "campuses",
            "schedule_proposals",
            "audit_logs",
        ]
        inst_polls = client.select("polls", filters={"institution_id": f"eq.{uni_id}"}, select="id")
        if inst_polls:
            p_filter = f"in.({','.join(p['id'] for p in inst_polls)})"
            client.delete("poll_votes", {"poll_id": p_filter})
            client.delete("poll_options", {"poll_id": p_filter})
        client.delete("polls", {"institution_id": f"eq.{uni_id}"})
        inst_users = client.select("users", filters={"institution_id": f"eq.{uni_id}"}, select="id")
        if inst_users:
            u_filter = f"in.({','.join(u['id'] for u in inst_users)})"
            client.delete("br_assignments", {"user_id": u_filter})
        client.delete("notifications", {"institution_id": f"eq.{uni_id}"})
        client.delete("student_preferences", {"institution_id": f"eq.{uni_id}"})
        client.delete("students", {"institution_id": f"eq.{uni_id}"})
        client.delete("institution_data", {"institution_id": f"eq.{uni_id}"})
        client.delete("feedback", {"institution_id": f"eq.{uni_id}"})
        for tbl in tables_to_clear:
            if tbl in optional_tables:
                safe_delete_optional(client, tbl, {"institution_id": f"eq.{uni_id}"})
            else:
                client.delete(tbl, {"institution_id": f"eq.{uni_id}"})
        safe_delete_optional(client, "import_history", {"institution_id": f"eq.{uni_id}"})
        client.delete("users", {"institution_id": f"eq.{uni_id}"})
        client.delete("institutions", {"id": f"eq.{uni_id}"})
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"success": True, "deletedInstitutionId": uni_id, "message": "Institution and all tenant records removed from Supabase."}


@router.post("/api/institutions/{id}/load-sample")
def load_sample_institution_catalog(id: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=CATALOG_MANAGER_ROLES)
    uni_id = scoped_uni_id(auth_user, id)
    client = require_supabase_client()
    now = now_iso()

    try:
        inst = client.select_one("institutions", filters={"id": f"eq.{uni_id}"})
        if not inst:
            raise HTTPException(status_code=404, detail={"error": "Institution not found."})

        camp_id = f"camp-{uuid.uuid4().hex[:6]}"
        bld_id = f"bld-{uuid.uuid4().hex[:6]}"
        term_id = f"term-{uuid.uuid4().hex[:6]}"
        dept_cs = f"dept-cs-{uuid.uuid4().hex[:6]}"
        dept_ee = f"dept-ee-{uuid.uuid4().hex[:6]}"
        prog_cs = f"prog-cs-{uuid.uuid4().hex[:6]}"
        prog_ee = f"prog-ee-{uuid.uuid4().hex[:6]}"

        safe_insert_optional(client, "campuses", {"id": camp_id, "institution_id": uni_id, "name": inst.get("campus_name") or "Main Campus", "code": "MAIN", "address": "University Ave", "created_at": now})
        safe_insert_optional(client, "buildings", {"id": bld_id, "institution_id": uni_id, "campus_id": camp_id, "name": "Engineering & Computing Block", "code": "ECB", "floors": 3, "created_at": now})
        client.insert("semesters", {"id": term_id, "institution_id": uni_id, "name": "Fall Semester 2026", "code": f"F26-{uuid.uuid4().hex[:3].upper()}", "academic_year": "2026–2027", "semester_number": 1, "start_date": "2026-09-01", "end_date": "2026-12-20", "is_active": True, "status": "active", "weeks_count": 16, "created_at": now})

        client.insert("departments", [
            {"id": dept_cs, "institution_id": uni_id, "code": f"CS-{uuid.uuid4().hex[:3].upper()}", "name": "Computer Science", "school": "School of Computing", "faculty_name": "School of Computing", "color_hex": "#171717", "sub_departments": ["Systems", "AI"], "created_at": now},
            {"id": dept_ee, "institution_id": uni_id, "code": f"EE-{uuid.uuid4().hex[:3].upper()}", "name": "Electrical Engineering", "school": "School of Engineering", "faculty_name": "School of Engineering", "color_hex": "#2563EB", "sub_departments": ["Power", "Digital"], "created_at": now},
        ])
        client.insert("academic_programs", [
            {"id": prog_cs, "institution_id": uni_id, "department_id": dept_cs, "code": f"BSCS-{uuid.uuid4().hex[:3].upper()}", "name": "BS Computer Science", "degree_level": "BS", "total_semesters": 8, "created_at": now},
            {"id": prog_ee, "institution_id": uni_id, "department_id": dept_ee, "code": f"BSEE-{uuid.uuid4().hex[:3].upper()}", "name": "BS Electrical Engineering", "degree_level": "BS", "total_semesters": 8, "created_at": now},
        ])

        r1, r2 = f"room-{uuid.uuid4().hex[:6]}", f"room-{uuid.uuid4().hex[:6]}"
        l1 = f"lab-{uuid.uuid4().hex[:6]}"
        client.insert("classrooms", [
            {"id": r1, "institution_id": uni_id, "building_id": bld_id, "code": f"LH-{uuid.uuid4().hex[:3].upper()}", "name": "Turing Lecture Hall", "building": "Engineering & Computing Block", "floor": 1, "capacity": 70, "room_type": "lecture", "is_available": True, "created_at": now},
            {"id": r2, "institution_id": uni_id, "building_id": bld_id, "code": f"CR-{uuid.uuid4().hex[:3].upper()}", "name": "Lovelace Seminar Room", "building": "Engineering & Computing Block", "floor": 2, "capacity": 60, "room_type": "seminar", "is_available": True, "created_at": now},
        ])

        ins1, ins2, eng1 = f"inst-{uuid.uuid4().hex[:6]}", f"inst-{uuid.uuid4().hex[:6]}", f"inst-{uuid.uuid4().hex[:6]}"
        client.insert("instructors", [
            {"id": ins1, "institution_id": uni_id, "department_id": dept_cs, "name": "Dr. Alan Turing", "email": f"turing.{uuid.uuid4().hex[:4]}@uni.edu", "designation": "Professor", "staff_role": "faculty", "max_weekly_hours": 14, "max_daily_classes": 3, "created_at": now},
            {"id": ins2, "institution_id": uni_id, "department_id": dept_ee, "name": "Dr. Nikola Tesla", "email": f"tesla.{uuid.uuid4().hex[:4]}@uni.edu", "designation": "Associate Professor", "staff_role": "faculty", "max_weekly_hours": 14, "max_daily_classes": 3, "created_at": now},
            {"id": eng1, "institution_id": uni_id, "department_id": dept_cs, "name": "Engr. Ada Lovelace", "email": f"ada.{uuid.uuid4().hex[:4]}@uni.edu", "designation": "Senior Lab Engineer", "staff_role": "lab_engineer", "max_weekly_hours": 18, "max_daily_classes": 4, "created_at": now},
        ])
        client.insert("laboratories", {
            "id": l1, "institution_id": uni_id, "building_id": bld_id, "department_id": dept_cs,
            "code": f"LAB-{uuid.uuid4().hex[:3].upper()}", "name": "Computing Systems Lab", "building": "Engineering & Computing Block",
            "capacity": 50, "lab_category": "Computing", "assigned_lab_engineer_id": eng1, "equipment": ["Workstations", "Projector"], "is_available": True, "created_at": now,
        })

        b1, b2 = f"batch-{uuid.uuid4().hex[:6]}", f"batch-{uuid.uuid4().hex[:6]}"
        client.insert("batches", [
            {"id": b1, "institution_id": uni_id, "code": f"2K25-CS-{uuid.uuid4().hex[:2].upper()}", "batch_code": "2K25", "name": "2K25 Computer Science A", "department_code": "CS", "program_id": prog_cs, "term_id": term_id, "year": 2, "semester": 3, "section": "A", "student_count": 48, "created_at": now},
            {"id": b2, "institution_id": uni_id, "code": f"2K25-EE-{uuid.uuid4().hex[:2].upper()}", "batch_code": "2K25", "name": "2K25 Electrical Eng A", "department_code": "EE", "program_id": prog_ee, "term_id": term_id, "year": 2, "semester": 3, "section": "A", "student_count": 45, "created_at": now},
        ])

        c1, c2 = f"crs-{uuid.uuid4().hex[:6]}", f"crs-{uuid.uuid4().hex[:6]}"
        client.insert("courses", [
            {"id": c1, "institution_id": uni_id, "department_id": dept_cs, "code": f"CS-{uuid.uuid4().hex[:3].upper()}", "title": "Data Structures & Algorithms", "course_type": "lecture_lab", "credit_hours": 4, "lecture_credit_hours": 3, "lab_credit_hours": 1, "lecture_hours_per_week": 3, "lab_hours_per_week": 3, "assigned_instructor_id": ins1, "assigned_lab_engineer_id": eng1, "assigned_batch_id": b1, "semester_number": 3, "is_compulsory": True, "created_at": now},
            {"id": c2, "institution_id": uni_id, "department_id": dept_ee, "code": f"EE-{uuid.uuid4().hex[:3].upper()}", "title": "Linear Circuit Analysis", "course_type": "lecture", "credit_hours": 3, "lecture_credit_hours": 3, "lab_credit_hours": 0, "lecture_hours_per_week": 3, "lab_hours_per_week": 0, "assigned_instructor_id": ins2, "assigned_batch_id": b2, "semester_number": 3, "is_compulsory": True, "created_at": now},
        ])
        client.insert("course_sessions", [
            {"id": f"sec-{uuid.uuid4().hex[:6]}", "institution_id": uni_id, "term_id": term_id, "course_id": c1, "instructor_id": ins1, "batch_id": b1, "section_code": "A", "session_type": "Theory", "component_type": "lecture", "sessions_per_week": 3, "duration_minutes": 50, "expected_students": 48, "required_room_type": "lecture", "created_at": now},
            {"id": f"sec-{uuid.uuid4().hex[:6]}", "institution_id": uni_id, "term_id": term_id, "course_id": c1, "instructor_id": ins1, "lab_engineer_id": eng1, "batch_id": b1, "section_code": "A-Lab", "session_type": "Lab", "component_type": "lab", "sessions_per_week": 1, "duration_minutes": 180, "expected_students": 48, "required_room_type": "lab", "span_slots": 3, "is_atomic_session": True, "created_at": now},
            {"id": f"sec-{uuid.uuid4().hex[:6]}", "institution_id": uni_id, "term_id": term_id, "course_id": c2, "instructor_id": ins2, "batch_id": b2, "section_code": "A", "session_type": "Theory", "component_type": "lecture", "sessions_per_week": 3, "duration_minutes": 50, "expected_students": 45, "required_room_type": "lecture", "created_at": now},
        ])
        client.insert("scheduling_constraints", [
            {"id": f"const-{uuid.uuid4().hex[:6]}", "institution_id": uni_id, "code": "HC-NO-CLASH", "name": "Zero Instructor / Room / Batch Overlap", "description": "Guarantees zero double-booking across faculty, labs, rooms, and batches.", "kind": "hard", "category": "hard", "weight": 100, "is_enabled": True, "created_at": now},
            {"id": f"const-{uuid.uuid4().hex[:6]}", "institution_id": uni_id, "code": "SC-GAP-MIN", "name": "Minimize Student Idle Gaps", "description": "Prefers compact daily schedules avoiding multi-hour gaps.", "kind": "soft", "category": "soft_student", "weight": 85, "is_enabled": True, "created_at": now},
        ])
        client.update("institutions", {"id": f"eq.{uni_id}"}, {"active_term_ids": [term_id]})
        write_audit_log(client, uni_id, auth_user, "create", "scenario", uni_id, "Loaded sample relational university catalog in Supabase")
        workspace = _build_workspace_payload(client, uni_id)
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Sample relational catalog loaded into Supabase.", "workspace": workspace}
