"""
Academic Course, Instructor, Lab Engineer & Laboratory Assignment Validation Service.

Provides:
- Canonical Academic Hierarchy Resolution (University -> Department -> Cohort -> Program -> Section)
- Course Offering Materialization (without fake staff auto-substitution)
- Non-double-counted Weekly Staff Workload Calculation
- Full Assignment Validation Engine (eligibility, active status, workload limits, availability,
  published timetable overlap, laboratory capacity/equipment/availability)
- Timetable Version Impact & Conflict Inspection
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

from app.deps import (
    resolve_batch_department_id,
    resolve_matching_batches_for_course,
    safe_json_loads,
    safe_select_optional,
)
from app.optimization.constraints import parse_time_to_minutes
from database import now_iso


def strip_lab_suffix(section_code: str) -> str:
    raw = str(section_code or "A").strip() or "A"
    if raw.lower().endswith("-lab"):
        trimmed = raw[:-4].strip()
        return trimmed or "A"
    return raw


def _parse_hhmm_window(time_slot_or_start: str, end_time: Optional[str] = None) -> Tuple[int, int]:
    raw = str(time_slot_or_start or "").strip()
    if end_time:
        s_min = parse_time_to_minutes(raw)
        e_min = parse_time_to_minutes(str(end_time))
        if e_min <= s_min:
            e_min = s_min + 50
        return s_min, e_min
    if "-" in raw and ":" in raw:
        parts = [p.strip() for p in raw.split("-") if p.strip()]
        if len(parts) >= 2:
            s_min = parse_time_to_minutes(parts[0])
            e_min = parse_time_to_minutes(parts[1])
            if e_min <= s_min:
                e_min = s_min + 50
            return s_min, e_min
    s_min = parse_time_to_minutes(raw)
    return s_min, s_min + 50


def _infer_cohort_and_program(
    batch: Dict[str, Any],
    departments: List[Dict[str, Any]],
    programs: List[Dict[str, Any]],
) -> Dict[str, str]:
    dept_id = resolve_batch_department_id(batch, departments, programs)
    dept_by_id = {str(d.get("id") or ""): d for d in departments if d.get("id")}
    prog_by_id = {str(p.get("id") or ""): p for p in programs if p.get("id")}
    prog_by_code = {str(p.get("code") or "").strip().upper(): p for p in programs if p.get("code")}

    code_raw = str(batch.get("code") or batch.get("name") or "").strip()
    parts = [p.strip() for p in code_raw.replace("_", "-").split("-") if p.strip()]
    cohort_code = str(batch.get("batch_code") or (parts[0] if parts else code_raw) or "Cohort").strip()

    prog_id = str(batch.get("program_id") or "").strip()
    matched_prog = prog_by_id.get(prog_id) if prog_id else None
    if not matched_prog and len(parts) >= 2:
        for seg in parts[1:]:
            if seg.upper() in prog_by_code:
                matched_prog = prog_by_code[seg.upper()]
                break
    if not matched_prog and dept_id:
        dept_progs = [p for p in programs if str(p.get("department_id") or "") == dept_id]
        if len(dept_progs) == 1:
            matched_prog = dept_progs[0]
        elif dept_progs:
            b_dept_code = str(batch.get("department_code") or "").upper()
            matched_prog = next(
                (p for p in dept_progs if str(p.get("code") or "").upper() == b_dept_code),
                dept_progs[0],
            )

    dept = dept_by_id.get(dept_id, {})
    return {
        "departmentId": dept_id,
        "departmentCode": str(dept.get("code") or batch.get("department_code") or "").upper(),
        "departmentName": str(dept.get("name") or dept.get("code") or batch.get("department_code") or "Unassigned Dept"),
        "cohortCode": cohort_code,
        "programId": str((matched_prog or {}).get("id") or prog_id or ""),
        "programCode": str((matched_prog or {}).get("code") or batch.get("department_code") or (parts[1] if len(parts) > 1 else "")).upper(),
        "programName": str((matched_prog or {}).get("name") or (matched_prog or {}).get("code") or batch.get("department_code") or "General Program"),
        "sectionCode": strip_lab_suffix(str(batch.get("section") or (parts[-1] if len(parts) >= 3 else "A"))),
        "sectionLabel": code_raw or cohort_code,
    }


def _course_credit_profile(course: Dict[str, Any]) -> Tuple[str, int, int, int, int]:
    raw_ct = str(course.get("course_type") or course.get("courseType") or "").strip().lower()
    lec_cr = int(course.get("lecture_credit_hours") if course.get("lecture_credit_hours") is not None else (course.get("lecture_hours_per_week") or 0))
    lab_cr = int(course.get("lab_credit_hours") if course.get("lab_credit_hours") is not None else (round(int(course.get("lab_hours_per_week") or 0) / 3) if course.get("lab_hours_per_week") else 0))
    lec_hrs = int(course.get("lecture_hours_per_week") if course.get("lecture_hours_per_week") is not None else lec_cr)
    lab_hrs = int(course.get("lab_hours_per_week") if course.get("lab_hours_per_week") is not None else (lab_cr * 3))

    if lec_cr == 0 and lab_cr == 0 and lec_hrs == 0 and lab_hrs == 0:
        cr = max(1, int(course.get("credit_hours") or 3))
        if raw_ct == "lab":
            lab_cr = cr
            lab_hrs = cr * 3
        else:
            lec_cr = cr
            lec_hrs = cr

    if raw_ct in ("lecture", "lab", "lecture_lab"):
        ctype = raw_ct
    elif lec_cr > 0 and lab_cr > 0:
        ctype = "lecture_lab"
    elif lab_cr > 0 or lab_hrs > 0:
        ctype = "lab"
    else:
        ctype = "lecture"

    return ctype, lec_cr, lab_cr, lec_hrs, lab_hrs


def _component_hours_from_sessions(
    comp_rows: List[Dict[str, Any]],
    fallback_hours: int,
    is_lab: bool,
) -> float:
    if not comp_rows:
        return float(fallback_hours)
    total_mins = 0
    total_periods = 0
    for row in comp_rows:
        spw = max(1, int(row.get("sessions_per_week") or 1))
        dur = max(30, int(row.get("duration_minutes") or (180 if is_lab else 50)))
        total_periods += spw
        total_mins += spw * dur
    if is_lab:
        return round(total_mins / 60.0, 2)
    # Academic standard: a 50-minute lecture period equals 1 academic contact hour
    if all(int(r.get("duration_minutes") or 50) <= 65 for r in comp_rows):
        return float(max(total_periods, fallback_hours if fallback_hours > 0 and len(comp_rows) == 1 and int(comp_rows[0].get("sessions_per_week") or 1) == fallback_hours else total_periods))
    return round(total_mins / 60.0, 2)


def load_institution_assignment_context(
    client: Any,
    uni_id: str,
) -> Dict[str, Any]:
    """Load all normalized institutional tables needed for assignment management and validation."""
    inst = client.select_one("institutions", filters={"id": f"eq.{uni_id}"}) or {}
    departments = client.select("departments", filters={"institution_id": f"eq.{uni_id}"}, order="code.asc")
    programs = client.select("academic_programs", filters={"institution_id": f"eq.{uni_id}"}, order="code.asc")
    semesters = client.select("semesters", filters={"institution_id": f"eq.{uni_id}"}, order="name.asc")
    batches = client.select("batches", filters={"institution_id": f"eq.{uni_id}"}, order="code.asc")
    courses = client.select("courses", filters={"institution_id": f"eq.{uni_id}"}, order="code.asc")
    instructors = client.select("instructors", filters={"institution_id": f"eq.{uni_id}"}, order="name.asc")
    avails = client.select("instructor_availability", filters={"institution_id": f"eq.{uni_id}"})
    prefs = client.select("instructor_preferences", filters={"institution_id": f"eq.{uni_id}"})
    classrooms = client.select("classrooms", filters={"institution_id": f"eq.{uni_id}"}, order="code.asc")
    laboratories = client.select("laboratories", filters={"institution_id": f"eq.{uni_id}"}, order="code.asc")
    equip_rows = client.select("room_equipment_capacities", filters={"institution_id": f"eq.{uni_id}"})
    course_sessions = client.select("course_sessions", filters={"institution_id": f"eq.{uni_id}"}, order="created_at.asc")
    enrollments = safe_select_optional(client, "course_enrollments", filters={"institution_id": f"eq.{uni_id}"})
    versions = safe_select_optional(
        client,
        "timetable_versions",
        filters={"institution_id": f"eq.{uni_id}"},
        order="created_at.desc",
    )
    entries = safe_select_optional(
        client,
        "timetable_entries",
        filters={"institution_id": f"eq.{uni_id}"},
    )
    audit_logs = safe_select_optional(
        client,
        "audit_logs",
        filters={"institution_id": f"eq.{uni_id}"},
        order="created_at.desc",
        limit=100,
    )

    return {
        "institution": inst,
        "departments": departments,
        "programs": programs,
        "semesters": semesters,
        "batches": batches,
        "courses": courses,
        "instructors": instructors,
        "availability": avails,
        "preferences": prefs,
        "classrooms": classrooms,
        "laboratories": laboratories,
        "equipment": equip_rows,
        "course_sessions": course_sessions,
        "enrollments": enrollments,
        "timetable_versions": versions,
        "timetable_entries": entries,
        "audit_logs": audit_logs,
    }


def _build_offering_groups(
    ctx: Dict[str, Any],
) -> Tuple[List[Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    """
    Group course_sessions rows by (term_id, course_id, batch_id, base_section_code) into canonical
    Course Offering records linking lecture and lab components together cleanly.
    """
    departments = ctx["departments"]
    programs = ctx["programs"]
    semesters = ctx["semesters"]
    batches = ctx["batches"]
    courses = ctx["courses"]
    course_sessions = ctx["course_sessions"]
    versions = ctx["timetable_versions"]
    entries = ctx["timetable_entries"]

    course_by_id = {c["id"]: c for c in courses if c.get("id")}
    batch_by_id = {b["id"]: b for b in batches if b.get("id")}
    sem_by_id = {s["id"]: s for s in semesters if s.get("id")}
    default_term = semesters[0] if semesters else {"id": "term-default", "name": "Current Term"}
    version_by_id = {v["id"]: v for v in versions if v.get("id")}

    # Index scheduled timetable_entries by course_session_id for active/published impact visibility
    entries_by_session_id: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for e in entries:
        cs_id = str(e.get("course_session_id") or "")
        ver = version_by_id.get(str(e.get("timetable_version_id") or ""))
        if not cs_id or not ver:
            continue
        if ver.get("status") in ("draft", "under_review", "approved", "published"):
            entries_by_session_id[cs_id].append({**e, "_version_status": ver.get("status"), "_version_name": ver.get("name")})

    # Group course_sessions
    grouped: Dict[Tuple[str, str, str, str], Dict[str, Any]] = {}
    session_to_offering_key: Dict[str, Tuple[str, str, str, str]] = {}

    for s in course_sessions:
        c_id = str(s.get("course_id") or "")
        b_id = str(s.get("batch_id") or "")
        if not c_id or not b_id or c_id not in course_by_id or b_id not in batch_by_id:
            continue
        course = course_by_id[c_id]
        batch = batch_by_id[b_id]
        hierarchy = _infer_cohort_and_program(batch, departments, programs)
        term_id = str(s.get("term_id") or batch.get("term_id") or default_term.get("id") or "term-default")
        base_sec = strip_lab_suffix(str(s.get("section_code") or hierarchy["sectionCode"] or "A"))

        gkey = (term_id, c_id, b_id, base_sec)
        session_to_offering_key[str(s["id"])] = gkey

        if gkey not in grouped:
            ctype, lec_cr, lab_cr, lec_hrs_c, lab_hrs_c = _course_credit_profile(course)
            term_obj = sem_by_id.get(term_id, default_term)
            grouped[gkey] = {
                "offeringKey": f"{term_id}::{c_id}::{b_id}::{base_sec}",
                "course": course,
                "batch": batch,
                "hierarchy": hierarchy,
                "termId": term_id,
                "termName": str(term_obj.get("name") or term_id),
                "courseType": ctype,
                "lectureCredits": lec_cr,
                "labCredits": lab_cr,
                "courseLectureHours": lec_hrs_c,
                "courseLabHours": lab_hrs_c,
                "lectureRows": [],
                "labRows": [],
                "allRows": [],
                "timetableEntries": [],
            }

        bucket = grouped[gkey]
        bucket["allRows"].append(s)
        comp = str(s.get("component_type") or "").lower()
        stype = str(s.get("session_type") or "").lower()
        if comp == "lab" or stype == "lab":
            bucket["labRows"].append(s)
        else:
            bucket["lectureRows"].append(s)

        if s["id"] in entries_by_session_id:
            bucket["timetableEntries"].extend(entries_by_session_id[s["id"]])

    # Build normalized list + lookup dictionary supporting both offeringKey and raw course_session.id
    offerings_raw = list(grouped.values())
    lookup_by_any_id: Dict[str, Dict[str, Any]] = {}
    for g in offerings_raw:
        lookup_by_any_id[g["offeringKey"]] = g
        for row in g["allRows"]:
            lookup_by_any_id[str(row["id"])] = g
        if g["lectureRows"]:
            g["primarySessionId"] = str(g["lectureRows"][0]["id"])
        elif g["labRows"]:
            g["primarySessionId"] = str(g["labRows"][0]["id"])
        else:
            g["primarySessionId"] = g["offeringKey"]

    return offerings_raw, lookup_by_any_id


def compute_staff_workloads(
    ctx: Dict[str, Any],
    offerings_raw: Optional[List[Dict[str, Any]]] = None,
    override_offering_key: Optional[str] = None,
    override_lec_inst_id: Optional[str] = None,
    override_lab_eng_id: Optional[str] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    Calculate non-double-counted weekly hours for every instructor & lab engineer from actual offerings.
    Optionally applies a hypothetical override for one offering (used during dry-run validation).
    """
    if offerings_raw is None:
        offerings_raw, _ = _build_offering_groups(ctx)

    instructors = ctx["instructors"]
    departments = ctx["departments"]
    avails = ctx["availability"]
    entries = ctx["timetable_entries"]
    versions = ctx["timetable_versions"]

    dept_by_id = {d["id"]: d for d in departments if d.get("id")}
    published_ver_ids = {v["id"] for v in versions if v.get("status") in ("published", "approved")}

    unavail_by_staff: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for av in avails:
        if not av.get("is_available", True) and av.get("instructor_id"):
            unavail_by_staff[av["instructor_id"]].append(
                {
                    "day": av["day_of_week"],
                    "startTime": av["start_time"],
                    "endTime": av["end_time"],
                    "reason": av.get("reason") or "Unavailable",
                }
            )

    # Published / approved committed slots per staff member
    committed_slots_by_staff: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for ent in entries:
        if ent.get("timetable_version_id") not in published_ver_ids:
            continue
        slot_payload = {
            "entryId": ent.get("id"),
            "courseSessionId": ent.get("course_session_id"),
            "courseCode": ent.get("course_code"),
            "batchId": ent.get("batch_id"),
            "day": ent.get("day_of_week"),
            "startTime": ent.get("start_time"),
            "endTime": ent.get("end_time"),
            "roomId": ent.get("room_id"),
            "componentType": ent.get("component_type") or "lecture",
        }
        if ent.get("instructor_id"):
            committed_slots_by_staff[str(ent["instructor_id"])].append(slot_payload)
        if ent.get("lab_engineer_id") and ent.get("lab_engineer_id") != ent.get("instructor_id"):
            committed_slots_by_staff[str(ent["lab_engineer_id"])].append(slot_payload)

    # Accumulators keyed by staff_id with deduplication sets per component
    staff_state: Dict[str, Dict[str, Any]] = {}
    for ins in instructors:
        d_obj = dept_by_id.get(ins.get("department_id") or "", {})
        max_w = max(1, int(ins.get("max_weekly_hours") or 18))
        staff_state[ins["id"]] = {
            "id": ins["id"],
            "staffCode": ins.get("staff_code") or ins["id"][-6:].upper(),
            "name": ins.get("name") or "",
            "email": ins.get("email") or "",
            "departmentId": ins.get("department_id") or "",
            "departmentCode": d_obj.get("code") or "",
            "departmentName": d_obj.get("name") or "",
            "designation": ins.get("designation") or "Faculty",
            "staffRole": ins.get("staff_role") or "faculty",
            "isActive": bool(ins.get("is_active", True)),
            "qualifiedCourseIds": safe_json_loads(ins.get("qualified_course_ids"), []),
            "specializations": ins.get("specializations") or [],
            "maxWeeklyHours": max_w,
            "maxDailyClasses": int(ins.get("max_daily_classes") or 4),
            "currentLectureHours": 0.0,
            "currentLabHours": 0.0,
            "currentWeeklyHours": 0.0,
            "remainingCapacityHours": float(max_w),
            "utilizationPct": 0.0,
            "assignedCoursesCount": 0,
            "assignedSections": [],
            "assignedOfferings": [],
            "unavailableSlots": unavail_by_staff.get(ins["id"], []),
            "committedPublishedSlots": committed_slots_by_staff.get(ins["id"], []),
            "_seen_lec_keys": set(),
            "_seen_lab_keys": set(),
            "_seen_courses": set(),
            "_seen_sections": set(),
        }

    for grp in offerings_raw:
        okey = grp["offeringKey"]
        crs = grp["course"]
        batch = grp["batch"]
        hier = grp["hierarchy"]
        lec_rows = grp["lectureRows"]
        lab_rows = grp["labRows"]

        is_target = override_offering_key is not None and okey == override_offering_key

        # Lecture staff & hours
        if lec_rows:
            eff_inst_id = (
                (override_lec_inst_id or None)
                if is_target
                else (lec_rows[0].get("instructor_id") or None)
            )
            if eff_inst_id and eff_inst_id in staff_state:
                shared = sorted({str(x) for x in safe_json_loads(lec_rows[0].get("shared_group_ids"), []) if x})
                group_sig = f"shared:{','.join(shared)}" if shared else f"batch:{batch['id']}:{hier['sectionCode']}"
                dedup_key = (grp["termId"], crs["id"], group_sig, "lecture")
                if dedup_key not in staff_state[eff_inst_id]["_seen_lec_keys"]:
                    staff_state[eff_inst_id]["_seen_lec_keys"].add(dedup_key)
                    hrs = _component_hours_from_sessions(lec_rows, grp["courseLectureHours"], is_lab=False)
                    st = staff_state[eff_inst_id]
                    st["currentLectureHours"] = round(st["currentLectureHours"] + hrs, 2)
                    st["_seen_courses"].add(crs["code"])
                    st["_seen_sections"].add(hier["sectionLabel"])
                    st["assignedOfferings"].append(
                        {
                            "offeringId": okey,
                            "courseId": crs["id"],
                            "courseCode": crs["code"],
                            "courseTitle": crs["title"],
                            "sectionLabel": hier["sectionLabel"],
                            "role": "Lecture Instructor",
                            "hours": hrs,
                        }
                    )

        # Lab engineer & hours
        if lab_rows:
            eff_eng_id = (
                (override_lab_eng_id or None)
                if is_target
                else (lab_rows[0].get("lab_engineer_id") or lab_rows[0].get("instructor_id") or None)
            )
            if eff_eng_id and eff_eng_id in staff_state:
                shared = sorted({str(x) for x in safe_json_loads(lab_rows[0].get("shared_group_ids"), []) if x})
                group_sig = f"shared:{','.join(shared)}" if shared else f"batch:{batch['id']}:{hier['sectionCode']}"
                dedup_key = (grp["termId"], crs["id"], group_sig, "lab")
                if dedup_key not in staff_state[eff_eng_id]["_seen_lab_keys"]:
                    staff_state[eff_eng_id]["_seen_lab_keys"].add(dedup_key)
                    hrs = _component_hours_from_sessions(lab_rows, grp["courseLabHours"], is_lab=True)
                    st = staff_state[eff_eng_id]
                    st["currentLabHours"] = round(st["currentLabHours"] + hrs, 2)
                    st["_seen_courses"].add(crs["code"])
                    st["_seen_sections"].add(hier["sectionLabel"])
                    st["assignedOfferings"].append(
                        {
                            "offeringId": okey,
                            "courseId": crs["id"],
                            "courseCode": crs["code"],
                            "courseTitle": crs["title"],
                            "sectionLabel": hier["sectionLabel"],
                            "role": "Lab Engineer",
                            "hours": hrs,
                        }
                    )

    for st in staff_state.values():
        total = round(st["currentLectureHours"] + st["currentLabHours"], 2)
        max_w = float(st["maxWeeklyHours"])
        st["currentWeeklyHours"] = total
        st["remainingCapacityHours"] = round(max_w - total, 2)
        st["utilizationPct"] = round((total / max_w) * 100.0, 1) if max_w > 0 else 0.0
        st["assignedCoursesCount"] = len(st["_seen_courses"])
        st["assignedSections"] = sorted(st["_seen_sections"])
        st["assignedCourses"] = sorted(st["_seen_courses"])
        st.pop("_seen_lec_keys", None)
        st.pop("_seen_lab_keys", None)
        st.pop("_seen_courses", None)
        st.pop("_seen_sections", None)

    return staff_state


def _slots_overlap(
    day_a: str,
    start_a: str,
    end_a: Optional[str],
    day_b: str,
    start_b: str,
    end_b: Optional[str],
) -> bool:
    if str(day_a)[:3].lower() != str(day_b)[:3].lower():
        return False
    sa, ea = _parse_hhmm_window(start_a, end_a)
    sb, eb = _parse_hhmm_window(start_b, end_b)
    return sa < eb and sb < ea


def validate_offering_assignment(
    ctx: Dict[str, Any],
    offering: Dict[str, Any],
    proposed_instructor_id: Optional[str],
    proposed_lab_engineer_id: Optional[str],
    proposed_assigned_lab_id: Optional[str],
    workloads_by_staff: Optional[Dict[str, Dict[str, Any]]] = None,
    allow_workload_override: bool = False,
) -> Dict[str, Any]:
    """
    Validate an offering's staff & laboratory assignment against institutional rules.
    Returns { valid, status, errors, warnings, missingFields, timetableImpact }.
    """
    crs = offering["course"]
    batch = offering["batch"]
    hier = offering["hierarchy"]
    lec_rows = offering["lectureRows"]
    lab_rows = offering["labRows"]
    all_rows = offering["allRows"]

    requires_lecture = bool(lec_rows) or offering["lectureCredits"] > 0 or offering["courseType"] in ("lecture", "lecture_lab")
    requires_lab = bool(lab_rows) or offering["labCredits"] > 0 or offering["courseType"] in ("lab", "lecture_lab")

    instructors_by_id = {i["id"]: i for i in ctx["instructors"] if i.get("id")}
    labs_by_id = {l["id"]: l for l in ctx["laboratories"] if l.get("id")}
    equip_by_room: Dict[str, List[str]] = defaultdict(list)
    for eq in ctx["equipment"]:
        if eq.get("room_id") and eq.get("equipment_name"):
            equip_by_room[eq["room_id"]].append(eq["equipment_name"])

    errors: List[Dict[str, str]] = []
    warnings: List[Dict[str, str]] = []
    missing_fields: List[str] = []

    if workloads_by_staff is None:
        workloads_by_staff = compute_staff_workloads(
            ctx,
            override_offering_key=offering["offeringKey"],
            override_lec_inst_id=proposed_instructor_id,
            override_lab_eng_id=proposed_lab_engineer_id,
        )

    expected_students = max(
        1,
        max(
            [int(r.get("expected_students") or 0) for r in all_rows] + [int(batch.get("student_count") or 45)]
        ),
    )
    req_equip = set(
        str(e).strip().lower()
        for e in (crs.get("required_equipment") or (lab_rows[0].get("required_equipment") if lab_rows else []) or [])
        if e
    )

    inst_id = str(proposed_instructor_id or "").strip() or None
    eng_id = str(proposed_lab_engineer_id or "").strip() or None
    lab_id = str(proposed_assigned_lab_id or "").strip() or None

    # Active timetable version / locked slot impact
    ver_by_id = {v["id"]: v for v in ctx["timetable_versions"] if v.get("id")}
    published_ver_ids = {vid for vid, v in ver_by_id.items() if v.get("status") in ("published", "approved")}
    draft_ver_ids = {vid for vid, v in ver_by_id.items() if v.get("status") in ("draft", "under_review")}

    offering_entries = offering.get("timetableEntries") or []
    published_entries = [e for e in offering_entries if e.get("timetable_version_id") in published_ver_ids]
    draft_entries = [e for e in offering_entries if e.get("timetable_version_id") in draft_ver_ids]
    has_locked_slot = any(bool(r.get("is_locked")) for r in all_rows)

    def _check_staff_member(
        staff_id: str,
        role_context: str,  # "lecture" | "lab"
    ) -> None:
        staff = instructors_by_id.get(staff_id)
        if not staff:
            errors.append(
                {
                    "code": "invalid_scope_or_missing_staff",
                    "field": "instructorId" if role_context == "lecture" else "labEngineerId",
                    "message": f"Selected staff member ({staff_id}) does not exist within this university.",
                }
            )
            return

        w_info = workloads_by_staff.get(staff_id, {})
        staff_name = staff.get("name") or staff_id
        is_active = bool(staff.get("is_active", True))
        if not is_active:
            errors.append(
                {
                    "code": "inactive_staff",
                    "field": "instructorId" if role_context == "lecture" else "labEngineerId",
                    "message": f"{staff_name} is inactive and cannot receive course assignments.",
                }
            )

        staff_role = str(staff.get("staff_role") or "faculty").lower()
        if role_context == "lecture" and staff_role == "lab_engineer":
            errors.append(
                {
                    "code": "ineligible_role_for_lecture",
                    "field": "instructorId",
                    "message": f"{staff_name} is designated as Lab Engineer and is ineligible to lead theory lectures.",
                }
            )
        elif role_context == "lab" and staff_role == "faculty":
            warnings.append(
                {
                    "code": "faculty_covering_lab",
                    "field": "labEngineerId",
                    "message": f"{staff_name} holds a Faculty designation rather than dedicated Lab Engineer.",
                }
            )

        # Explicit qualified_course_ids eligibility enforcement when configured
        qual_courses = {str(x).strip().upper() for x in safe_json_loads(staff.get("qualified_course_ids"), []) if x}
        if qual_courses:
            cid_u = str(crs.get("id") or "").strip().upper()
            ccode_u = str(crs.get("code") or "").strip().upper()
            if cid_u not in qual_courses and ccode_u not in qual_courses:
                errors.append(
                    {
                        "code": "ineligible_course_qualification",
                        "field": "instructorId" if role_context == "lecture" else "labEngineerId",
                        "message": f"{staff_name} is not listed as qualified to teach {crs.get('code')} ({crs.get('title')}).",
                    }
                )

        # Weekly workload limit
        curr_w = float(w_info.get("currentWeeklyHours") or 0.0)
        max_w = float(w_info.get("maxWeeklyHours") or staff.get("max_weekly_hours") or 18)
        if curr_w > max_w:
            payload = {
                "code": "workload_exceeded",
                "field": "instructorId" if role_context == "lecture" else "labEngineerId",
                "message": f"{staff_name} weekly load ({curr_w:.1f}h) exceeds maximum capacity ({max_w:.0f}h/week).",
            }
            if allow_workload_override:
                warnings.append(payload)
            else:
                errors.append(payload)
        elif max_w > 0 and curr_w >= max_w * 0.85:
            warnings.append(
                {
                    "code": "high_workload",
                    "field": "instructorId" if role_context == "lecture" else "labEngineerId",
                    "message": f"{staff_name} is near weekly capacity ({curr_w:.1f}h / {max_w:.0f}h).",
                }
            )

        # Availability & published timetable conflict checks
        unavail_list = w_info.get("unavailableSlots") or []
        comp_rows = lec_rows if role_context == "lecture" else lab_rows
        comp_session_ids = {str(r["id"]) for r in comp_rows}

        # Check pinned/locked slot or currently scheduled published entries for this offering
        check_windows: List[Tuple[str, str, Optional[str], str]] = []
        for r in comp_rows:
            if r.get("is_locked") and r.get("assigned_day") and r.get("assigned_start_time"):
                check_windows.append((str(r["assigned_day"]), str(r["assigned_start_time"]), None, "locked timetable slot"))
        for pe in published_entries:
            if str(pe.get("course_session_id") or "") in comp_session_ids:
                check_windows.append((str(pe["day_of_week"]), str(pe["start_time"]), str(pe.get("end_time") or ""), "published timetable"))

        for w_day, w_start, w_end, src_label in check_windows:
            for av in unavail_list:
                if _slots_overlap(w_day, w_start, w_end, av["day"], av["startTime"], av.get("endTime")):
                    errors.append(
                        {
                            "code": "availability_conflict",
                            "field": "instructorId" if role_context == "lecture" else "labEngineerId",
                            "message": f"{staff_name} is marked unavailable during {src_label} on {w_day} {w_start}.",
                        }
                    )
                    break

            for committed in w_info.get("committedPublishedSlots") or []:
                if str(committed.get("courseSessionId") or "") in comp_session_ids:
                    continue
                if _slots_overlap(w_day, w_start, w_end, committed["day"], committed["startTime"], committed.get("endTime")):
                    errors.append(
                        {
                            "code": "published_schedule_overlap",
                            "field": "instructorId" if role_context == "lecture" else "labEngineerId",
                            "message": f"{staff_name} already teaches {committed.get('courseCode')} at {committed['day']} {committed['startTime']} in published schedule.",
                        }
                    )
                    break

        if not check_windows and len(unavail_list) >= 8:
            warnings.append(
                {
                    "code": "restricted_availability",
                    "field": "instructorId" if role_context == "lecture" else "labEngineerId",
                    "message": f"{staff_name} has {len(unavail_list)} blocked time slot(s); optimizer window is narrowed.",
                }
            )

    # Lecture validation
    if requires_lecture:
        if not inst_id:
            missing_fields.append("instructorId")
        else:
            _check_staff_member(inst_id, "lecture")

    # Lab validation
    if requires_lab:
        if not eng_id:
            missing_fields.append("labEngineerId")
        else:
            _check_staff_member(eng_id, "lab")

        if not lab_id:
            missing_fields.append("assignedLabId")
        else:
            lab_obj = labs_by_id.get(lab_id)
            if not lab_obj:
                errors.append(
                    {
                        "code": "invalid_laboratory",
                        "field": "assignedLabId",
                        "message": f"Selected laboratory ({lab_id}) does not belong to this university or is not a Laboratory.",
                    }
                )
            else:
                lab_name = f"{lab_obj.get('code')} ({lab_obj.get('name')})"
                if not lab_obj.get("is_available", True):
                    errors.append(
                        {
                            "code": "laboratory_unavailable",
                            "field": "assignedLabId",
                            "message": f"Laboratory {lab_name} is currently marked unavailable.",
                        }
                    )
                lab_cap = int(lab_obj.get("capacity") or 0)
                if lab_cap < expected_students:
                    errors.append(
                        {
                            "code": "insufficient_lab_capacity",
                            "field": "assignedLabId",
                            "message": f"Laboratory {lab_name} capacity ({lab_cap}) is below section enrollment ({expected_students}).",
                        }
                    )
                if req_equip:
                    raw_lab_eq = lab_obj.get("equipment") if isinstance(lab_obj.get("equipment"), list) else equip_by_room.get(lab_id, [])
                    lab_eq_set = {str(x).strip().lower() for x in (raw_lab_eq or []) if x}
                    missing_eq = sorted(req_equip - lab_eq_set)
                    if missing_eq:
                        errors.append(
                            {
                                "code": "incompatible_lab_equipment",
                                "field": "assignedLabId",
                                "message": f"Laboratory {lab_name} lacks required equipment: {', '.join(missing_eq)}.",
                            }
                        )

                # Check published room overlap on pinned/published windows for lab_rows
                lab_session_ids = {str(r["id"]) for r in lab_rows}
                for pe in published_entries:
                    if str(pe.get("course_session_id") or "") not in lab_session_ids:
                        continue
                    for other_ent in ctx["timetable_entries"]:
                        if (
                            other_ent.get("timetable_version_id") in published_ver_ids
                            and str(other_ent.get("room_id") or "") == lab_id
                            and str(other_ent.get("course_session_id") or "") not in lab_session_ids
                            and _slots_overlap(
                                pe["day_of_week"],
                                pe["start_time"],
                                pe.get("end_time"),
                                other_ent["day_of_week"],
                                other_ent["start_time"],
                                other_ent.get("end_time"),
                            )
                        ):
                            errors.append(
                                {
                                    "code": "laboratory_published_overlap",
                                    "field": "assignedLabId",
                                    "message": f"Laboratory {lab_name} is already occupied by {other_ent.get('course_code')} on {other_ent['day_of_week']} {other_ent['start_time']}.",
                                }
                            )
                            break

    # Determine canonical assignment status
    has_any_assignment = bool(inst_id or eng_id or lab_id)
    if errors:
        status = "invalid"
    elif not requires_lecture and not requires_lab:
        status = "unassigned"
    elif not has_any_assignment:
        status = "unassigned"
    elif (requires_lecture and not inst_id) or (requires_lab and (not eng_id or not lab_id)):
        status = "partial"
    else:
        status = "assigned"

    # Note: generationReadiness distinguishes whether mandatory staff assignments + zero validation errors are satisfied
    staff_ready = (
        len(errors) == 0
        and (not requires_lecture or bool(inst_id))
        and (not requires_lab or bool(eng_id))
    )

    affected_versions: List[Dict[str, Any]] = []
    seen_vers: Set[str] = set()
    for ent in offering_entries:
        vid = str(ent.get("timetable_version_id") or "")
        if vid and vid not in seen_vers:
            seen_vers.add(vid)
            vobj = ver_by_id.get(vid, {})
            affected_versions.append(
                {
                    "versionId": vid,
                    "name": vobj.get("name") or vid,
                    "status": vobj.get("status") or "draft",
                }
            )

    return {
        "valid": len(errors) == 0,
        "staffReady": staff_ready,
        "status": status,
        "errors": errors,
        "warnings": warnings,
        "missingFields": missing_fields,
        "timetableImpact": {
            "hasPublishedImpact": len(published_entries) > 0,
            "hasDraftImpact": len(draft_entries) > 0,
            "hasLockedSlot": has_locked_slot,
            "affectedEntriesCount": len(offering_entries),
            "affectedVersions": affected_versions,
        },
    }


def build_assignment_workspace_payload(
    ctx: Dict[str, Any],
    term_id: str = "",
    department_id: str = "",
    cohort_code: str = "",
    program_id: str = "",
    section_id: str = "",
    status_filter: str = "",
    component_type: str = "",
    search: str = "",
) -> Dict[str, Any]:
    """Assemble full Course Assignment Workspace response with enriched offerings, staff workloads, labs, and hierarchy."""
    offerings_raw, _ = _build_offering_groups(ctx)
    workloads = compute_staff_workloads(ctx, offerings_raw)

    instructors_by_id = {i["id"]: i for i in ctx["instructors"] if i.get("id")}
    labs_by_id = {l["id"]: l for l in ctx["laboratories"] if l.get("id")}
    depts_by_id = {d["id"]: d for d in ctx["departments"] if d.get("id")}
    equip_by_room: Dict[str, List[str]] = defaultdict(list)
    for eq in ctx["equipment"]:
        if eq.get("room_id") and eq.get("equipment_name"):
            equip_by_room[eq["room_id"]].append(eq["equipment_name"])

    enriched_offerings: List[Dict[str, Any]] = []
    # Build hierarchy filter options from ALL offerings + configured catalog so dropdowns cascade cleanly
    dept_opts: Dict[str, Dict[str, Any]] = {
        d["id"]: {"id": d["id"], "code": d["code"], "name": d["name"]}
        for d in ctx["departments"]
        if d.get("id")
    }
    term_opts: Dict[str, Dict[str, Any]] = {
        s["id"]: {"id": s["id"], "code": s.get("code") or s["id"], "name": s["name"]}
        for s in ctx["semesters"]
        if s.get("id")
    }
    cohort_opts: Set[str] = set()
    program_opts: Dict[str, Dict[str, Any]] = {
        p["id"]: {"id": p["id"], "code": p["code"], "name": p["name"], "departmentId": p.get("department_id") or ""}
        for p in ctx["programs"]
        if p.get("id")
    }
    section_opts: List[Dict[str, Any]] = []
    for b in ctx["batches"]:
        h = _infer_cohort_and_program(b, ctx["departments"], ctx["programs"])
        cohort_opts.add(h["cohortCode"])
        section_opts.append(
            {
                "id": b["id"],
                "code": b["code"],
                "name": b["name"],
                "sectionCode": h["sectionCode"],
                "departmentId": h["departmentId"],
                "cohortCode": h["cohortCode"],
                "programId": h["programId"],
                "studentCount": int(b.get("student_count") or 45),
            }
        )

    for grp in offerings_raw:
        crs = grp["course"]
        batch = grp["batch"]
        hier = grp["hierarchy"]
        lec_rows = grp["lectureRows"]
        lab_rows = grp["labRows"]

        inst_id = (lec_rows[0].get("instructor_id") if lec_rows else None) or None
        eng_id = (lab_rows[0].get("lab_engineer_id") if lab_rows else None) or None
        lab_id = (lab_rows[0].get("assigned_lab_id") if lab_rows else None) or None

        val = validate_offering_assignment(
            ctx,
            grp,
            proposed_instructor_id=inst_id,
            proposed_lab_engineer_id=eng_id,
            proposed_assigned_lab_id=lab_id,
            workloads_by_staff=workloads,
        )

        lec_hours = _component_hours_from_sessions(lec_rows, grp["courseLectureHours"], is_lab=False) if lec_rows or grp["lectureCredits"] > 0 else 0.0
        lab_hours = _component_hours_from_sessions(lab_rows, grp["courseLabHours"], is_lab=True) if lab_rows or grp["labCredits"] > 0 else 0.0
        exp_students = max(
            1,
            max(
                [int(r.get("expected_students") or 0) for r in grp["allRows"]] + [int(batch.get("student_count") or 45)]
            ),
        )

        inst_obj = instructors_by_id.get(inst_id or "", {})
        eng_obj = instructors_by_id.get(eng_id or "", {})
        lab_obj = labs_by_id.get(lab_id or "", {})

        req_lec = bool(lec_rows) or grp["lectureCredits"] > 0
        req_lab = bool(lab_rows) or grp["labCredits"] > 0

        item = {
            "id": grp["offeringKey"],
            "primarySessionId": grp["primarySessionId"],
            "lectureSessionId": lec_rows[0]["id"] if lec_rows else None,
            "labSessionId": lab_rows[0]["id"] if lab_rows else None,
            "termId": grp["termId"],
            "termName": grp["termName"],
            "departmentId": hier["departmentId"],
            "departmentCode": hier["departmentCode"],
            "departmentName": hier["departmentName"],
            "cohortCode": hier["cohortCode"],
            "programId": hier["programId"],
            "programCode": hier["programCode"],
            "programName": hier["programName"],
            "batchId": batch["id"],
            "batchCode": batch["code"],
            "sectionCode": hier["sectionCode"],
            "sectionLabel": hier["sectionLabel"],
            "courseId": crs["id"],
            "courseCode": crs["code"],
            "courseTitle": crs["title"],
            "courseType": grp["courseType"],
            "creditHours": int(crs.get("credit_hours") or max(1, grp["lectureCredits"] + grp["labCredits"])),
            "lectureCredits": grp["lectureCredits"],
            "labCredits": grp["labCredits"],
            "lectureHours": lec_hours,
            "labHours": lab_hours,
            "totalWeeklyHours": round(lec_hours + lab_hours, 2),
            "expectedStudents": exp_students,
            "requiredEquipment": crs.get("required_equipment") or [],
            "requiresLecture": req_lec,
            "requiresLab": req_lab,
            "instructorId": inst_id,
            "instructorName": inst_obj.get("name") or "",
            "instructorCode": inst_obj.get("staff_code") or (inst_id[-6:].upper() if inst_id else ""),
            "labEngineerId": eng_id,
            "labEngineerName": eng_obj.get("name") or "",
            "labEngineerCode": eng_obj.get("staff_code") or (eng_id[-6:].upper() if eng_id else ""),
            "assignedLabId": lab_id,
            "assignedLabCode": lab_obj.get("code") or "",
            "assignedLabName": lab_obj.get("name") or "",
            "assignmentStatus": val["status"],
            "staffReady": val["staffReady"],
            "valid": val["valid"],
            "validationErrors": val["errors"],
            "validationWarnings": val["warnings"],
            "missingFields": val["missingFields"],
            "timetableImpact": val["timetableImpact"],
            "isLocked": any(bool(r.get("is_locked")) for r in grp["allRows"]),
            "assignedBy": next((r.get("assigned_by") for r in grp["allRows"] if r.get("assigned_by")), None),
            "assignedAt": next((r.get("assigned_at") for r in grp["allRows"] if r.get("assigned_at")), None),
        }
        enriched_offerings.append(item)

    # Apply cascading filters
    q = search.strip().lower()
    st_f = status_filter.strip().lower()
    comp_f = component_type.strip().lower()

    scoped_offerings: List[Dict[str, Any]] = []
    for it in enriched_offerings:
        if term_id and term_id != "all" and it["termId"] != term_id:
            continue
        if department_id and department_id != "all" and it["departmentId"] != department_id:
            continue
        if cohort_code and cohort_code != "all" and it["cohortCode"].lower() != cohort_code.lower():
            continue
        if program_id and program_id != "all" and it["programId"] != program_id:
            continue
        if section_id and section_id != "all" and it["batchId"] != section_id:
            continue
        if comp_f == "lab" and not it["requiresLab"]:
            continue
        if comp_f == "lecture" and not it["requiresLecture"]:
            continue
        if comp_f == "lecture_lab" and it["courseType"] != "lecture_lab":
            continue
        if q:
            hay = " ".join(
                [
                    it["courseCode"],
                    it["courseTitle"],
                    it["sectionLabel"],
                    it["programCode"],
                    it["instructorName"],
                    it["labEngineerName"],
                    it["assignedLabName"],
                    it["assignedLabCode"],
                ]
            ).lower()
            if q not in hay:
                continue
        scoped_offerings.append(it)

    # Summary computed over scope (before status chip filter so counts remain informative)
    summary = {
        "totalOfferings": len(scoped_offerings),
        "completeCount": sum(1 for o in scoped_offerings if o["assignmentStatus"] == "assigned"),
        "generationReadyCount": sum(1 for o in scoped_offerings if o["staffReady"]),
        "missingInstructorCount": sum(1 for o in scoped_offerings if "instructorId" in o["missingFields"]),
        "missingLabEngineerCount": sum(1 for o in scoped_offerings if "labEngineerId" in o["missingFields"]),
        "missingLaboratoryCount": sum(1 for o in scoped_offerings if "assignedLabId" in o["missingFields"]),
        "invalidCount": sum(1 for o in scoped_offerings if o["assignmentStatus"] == "invalid"),
        "partialCount": sum(1 for o in scoped_offerings if o["assignmentStatus"] == "partial"),
        "unassignedCount": sum(1 for o in scoped_offerings if o["assignmentStatus"] == "unassigned"),
        "labOfferingsCount": sum(1 for o in scoped_offerings if o["requiresLab"]),
    }

    if st_f and st_f != "all":
        filtered_offerings = [
            o
            for o in scoped_offerings
            if (
                (st_f == "assigned" and o["assignmentStatus"] == "assigned")
                or (st_f == "complete" and o["assignmentStatus"] == "assigned")
                or (st_f == "unassigned" and o["assignmentStatus"] == "unassigned")
                or (st_f == "partial" and o["assignmentStatus"] == "partial")
                or (st_f == "invalid" and o["assignmentStatus"] == "invalid")
                or (st_f == "missing_instructor" and "instructorId" in o["missingFields"])
                or (st_f == "missing_lab_engineer" and "labEngineerId" in o["missingFields"])
                or (st_f == "missing_lab" and "assignedLabId" in o["missingFields"])
                or (st_f == "ready" and o["staffReady"])
            )
        ]
    else:
        filtered_offerings = scoped_offerings

    # Calculate expected unsynced offerings count (courses x matching batches without course_sessions yet)
    existing_pairs = {(s.get("course_id"), s.get("batch_id")) for s in ctx["course_sessions"]}
    enrolled_by_course: Dict[str, Set[str]] = defaultdict(set)
    for enr in ctx["enrollments"]:
        if enr.get("course_id") and enr.get("batch_id"):
            enrolled_by_course[str(enr["course_id"])].add(str(enr["batch_id"]))
    unsynced_count = 0
    for c in ctx["courses"]:
        if bool(c.get("is_elective", not c.get("is_compulsory", True))):
            continue
        matched_batches = resolve_matching_batches_for_course(
            c,
            ctx["batches"],
            ctx["departments"],
            ctx["programs"],
            enrolled_batch_ids=enrolled_by_course.get(c["id"]),
        )
        for b in matched_batches:
            if (c["id"], b["id"]) not in existing_pairs:
                unsynced_count += 1

    # Laboratories formatted cleanly
    labs_payload: List[Dict[str, Any]] = []
    for l in ctx["laboratories"]:
        dept_obj = depts_by_id.get(l.get("department_id") or "", {})
        eq = l.get("equipment") if isinstance(l.get("equipment"), list) and l.get("equipment") else equip_by_room.get(l["id"], [])
        labs_payload.append(
            {
                "id": l["id"],
                "code": l["code"],
                "name": l["name"],
                "building": l.get("building") or "Engineering Lab Complex",
                "departmentId": l.get("department_id") or "",
                "departmentCode": dept_obj.get("code") or "",
                "capacity": int(l.get("capacity") or 40),
                "labCategory": l.get("lab_category") or "Computing",
                "equipment": eq,
                "isAvailable": bool(l.get("is_available", True)),
                "isAccessible": bool(l.get("is_accessible", True)),
                "assignedLabEngineerId": l.get("assigned_lab_engineer_id") or None,
                "assignedCoursesCount": sum(1 for o in enriched_offerings if o["assignedLabId"] == l["id"]),
            }
        )

    staff_list = sorted(workloads.values(), key=lambda s: (0 if s["isActive"] else 1, s["staffRole"], s["name"]))

    return {
        "offerings": filtered_offerings,
        "summary": {**summary, "unsyncedOfferingsCount": unsynced_count},
        "staffDirectory": staff_list,
        "laboratories": labs_payload,
        "hierarchy": {
            "terms": list(term_opts.values()),
            "departments": list(dept_opts.values()),
            "cohorts": sorted(cohort_opts),
            "programs": list(program_opts.values()),
            "sections": section_opts,
        },
    }


def materialize_missing_offerings(
    client: Any,
    uni_id: str,
    term_id: Optional[str] = None,
    department_id: Optional[str] = None,
    course_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Create missing section-specific course_sessions rows for active courses and matching batches
    WITHOUT fabricating default instructors or lab engineers.
    """
    ctx = load_institution_assignment_context(client, uni_id)
    semesters = ctx["semesters"]
    eff_term = term_id or (semesters[0]["id"] if semesters else None)
    courses = ctx["courses"]
    batches = ctx["batches"]
    departments = ctx["departments"]
    programs = ctx["programs"]

    if not courses or not batches:
        return {"createdCount": 0, "sections": []}

    enrolled_by_course: Dict[str, Set[str]] = defaultdict(set)
    for enr in ctx["enrollments"]:
        if enr.get("course_id") and enr.get("batch_id"):
            enrolled_by_course[str(enr["course_id"])].add(str(enr["batch_id"]))

    existing_keys = {
        (s.get("course_id"), s.get("batch_id"), str(s.get("component_type") or "lecture").lower())
        for s in ctx["course_sessions"]
    }

    has_prog_col = client.has_column("course_sessions", "program_id")
    has_status_col = client.has_column("course_sessions", "assignment_status")
    now = now_iso()
    to_insert: List[Dict[str, Any]] = []

    for c in courses:
        if course_ids and c["id"] not in course_ids:
            continue
        if department_id and str(c.get("department_id") or "") != department_id:
            continue
        target_batches = resolve_matching_batches_for_course(
            c,
            batches,
            departments,
            programs,
            enrolled_batch_ids=enrolled_by_course.get(c["id"]),
        )
        if not target_batches:
            continue

        ctype, lec_cr, lab_cr, _, _ = _course_credit_profile(c)
        explicit_inst = c.get("assigned_instructor_id") or None
        explicit_eng = c.get("assigned_lab_engineer_id") or None

        for b in target_batches:
            hier = _infer_cohort_and_program(b, departments, programs)
            exp_students = max(1, int(b.get("student_count") or 45))
            sec_code = hier["sectionCode"]

            if lec_cr > 0 and (c["id"], b["id"], "lecture") not in existing_keys:
                row: Dict[str, Any] = {
                    "id": f"sec-{uuid.uuid4().hex[:8]}",
                    "institution_id": uni_id,
                    "term_id": eff_term,
                    "course_id": c["id"],
                    "instructor_id": explicit_inst,
                    "lab_engineer_id": None,
                    "batch_id": b["id"],
                    "section_code": sec_code,
                    "session_type": "Theory",
                    "component_type": "lecture",
                    "sessions_per_week": max(1, min(6, lec_cr)),
                    "duration_minutes": 50,
                    "expected_students": exp_students,
                    "required_room_type": c.get("required_room_type") or "lecture",
                    "created_at": now,
                }
                if has_prog_col and hier["programId"]:
                    row["program_id"] = hier["programId"]
                if has_status_col:
                    row["assignment_status"] = "assigned" if explicit_inst else "unassigned"
                to_insert.append(row)
                existing_keys.add((c["id"], b["id"], "lecture"))

            if lab_cr > 0 and (c["id"], b["id"], "lab") not in existing_keys:
                row_lab: Dict[str, Any] = {
                    "id": f"sec-{uuid.uuid4().hex[:8]}",
                    "institution_id": uni_id,
                    "term_id": eff_term,
                    "course_id": c["id"],
                    "instructor_id": explicit_inst,
                    "lab_engineer_id": explicit_eng,
                    "batch_id": b["id"],
                    "section_code": sec_code,
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
                if has_prog_col and hier["programId"]:
                    row_lab["program_id"] = hier["programId"]
                if has_status_col:
                    row_lab["assignment_status"] = "partial" if explicit_eng else "unassigned"
                to_insert.append(row_lab)
                existing_keys.add((c["id"], b["id"], "lab"))

    if to_insert:
        client.insert("course_sessions", to_insert)

    return {"createdCount": len(to_insert), "sections": to_insert}


def validate_sections_for_optimization(
    uni_id: str,
    sections: List[Dict[str, Any]],
    courses: List[Dict[str, Any]],
    rooms_raw: List[Dict[str, Any]],
    instructors: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Strict pre-optimization guard executed in /api/optimization/run before calling solvers.
    Rejects runs if any required Lecture Instructor or Lab Engineer is missing, inactive, or ineligible,
    or if an admin-assigned specific laboratory (assignedLabId) is unavailable, too small, or lacks equipment.
    """
    course_by_id = {c["id"]: c for c in courses if c.get("id")}
    inst_by_id = {i["id"]: i for i in instructors if i.get("id")}
    room_by_id = {r["id"]: r for r in rooms_raw if r.get("id")}
    blockers: List[Dict[str, Any]] = []

    for sec in sections:
        c_id = str(sec.get("courseId") or sec.get("course_id") or "")
        crs = course_by_id.get(c_id, {})
        c_code = str(sec.get("courseCode") or crs.get("code") or c_id or "COURSE")
        sec_code = str(sec.get("sectionCode") or sec.get("sectionNumber") or "A")
        batch_id = str(sec.get("studentGroupId") or sec.get("batchId") or "")
        s_type = str(sec.get("sessionType") or sec.get("componentType") or "Theory").lower()
        is_lab = "lab" in s_type

        inst_id = str(sec.get("instructorId") or sec.get("instructor_id") or "").strip()
        eng_id = str(sec.get("labEngineerId") or sec.get("lab_engineer_id") or "").strip()
        assigned_lab_id = str(sec.get("assignedLabId") or sec.get("assigned_lab_id") or "").strip()
        exp_students = max(1, int(sec.get("enrollment") or sec.get("expectedEnrollment") or sec.get("expected_students") or 45))

        if is_lab:
            staff_id = eng_id or inst_id
            if not staff_id:
                blockers.append(
                    {
                        "sectionId": sec.get("id"),
                        "courseId": c_id,
                        "courseCode": c_code,
                        "batchId": batch_id,
                        "sectionCode": sec_code,
                        "componentType": "lab",
                        "reason": "Missing assigned Lab Engineer for laboratory session.",
                        "code": "missing_lab_engineer",
                    }
                )
            else:
                st = inst_by_id.get(staff_id)
                if not st:
                    blockers.append(
                        {
                            "sectionId": sec.get("id"),
                            "courseId": c_id,
                            "courseCode": c_code,
                            "batchId": batch_id,
                            "sectionCode": sec_code,
                            "componentType": "lab",
                            "reason": f"Assigned Lab Engineer ({staff_id}) not found in university {uni_id}.",
                            "code": "invalid_staff",
                        }
                    )
                elif not bool(st.get("is_active", st.get("isActive", True))):
                    blockers.append(
                        {
                            "sectionId": sec.get("id"),
                            "courseId": c_id,
                            "courseCode": c_code,
                            "batchId": batch_id,
                            "sectionCode": sec_code,
                            "componentType": "lab",
                            "reason": f"Assigned Lab Engineer {st.get('name', staff_id)} is inactive.",
                            "code": "inactive_staff",
                        }
                    )

            if assigned_lab_id:
                lab_r = room_by_id.get(assigned_lab_id)
                if not lab_r or "lab" not in str(lab_r.get("type") or lab_r.get("room_type") or "").lower():
                    blockers.append(
                        {
                            "sectionId": sec.get("id"),
                            "courseId": c_id,
                            "courseCode": c_code,
                            "batchId": batch_id,
                            "sectionCode": sec_code,
                            "componentType": "lab",
                            "reason": f"Assigned laboratory ({assigned_lab_id}) does not exist.",
                            "code": "invalid_laboratory",
                        }
                    )
                elif not bool(lab_r.get("is_available", lab_r.get("isAvailable", True))):
                    blockers.append(
                        {
                            "sectionId": sec.get("id"),
                            "courseId": c_id,
                            "courseCode": c_code,
                            "batchId": batch_id,
                            "sectionCode": sec_code,
                            "componentType": "lab",
                            "reason": f"Assigned laboratory {lab_r.get('code', assigned_lab_id)} is unavailable.",
                            "code": "laboratory_unavailable",
                        }
                    )
                elif int(lab_r.get("capacity") or 0) < exp_students:
                    blockers.append(
                        {
                            "sectionId": sec.get("id"),
                            "courseId": c_id,
                            "courseCode": c_code,
                            "batchId": batch_id,
                            "sectionCode": sec_code,
                            "componentType": "lab",
                            "reason": f"Assigned laboratory {lab_r.get('code', assigned_lab_id)} capacity ({lab_r.get('capacity')}) < enrollment ({exp_students}).",
                            "code": "insufficient_lab_capacity",
                        }
                    )
        else:
            if not inst_id:
                blockers.append(
                    {
                        "sectionId": sec.get("id"),
                        "courseId": c_id,
                        "courseCode": c_code,
                        "batchId": batch_id,
                        "sectionCode": sec_code,
                        "componentType": "lecture",
                        "reason": "Missing assigned Lecture Instructor.",
                        "code": "missing_instructor",
                    }
                )
            else:
                st = inst_by_id.get(inst_id)
                if not st:
                    blockers.append(
                        {
                            "sectionId": sec.get("id"),
                            "courseId": c_id,
                            "courseCode": c_code,
                            "batchId": batch_id,
                            "sectionCode": sec_code,
                            "componentType": "lecture",
                            "reason": f"Assigned Instructor ({inst_id}) not found in university {uni_id}.",
                            "code": "invalid_staff",
                        }
                    )
                elif not bool(st.get("is_active", st.get("isActive", True))):
                    blockers.append(
                        {
                            "sectionId": sec.get("id"),
                            "courseId": c_id,
                            "courseCode": c_code,
                            "batchId": batch_id,
                            "sectionCode": sec_code,
                            "componentType": "lecture",
                            "reason": f"Assigned Instructor {st.get('name', inst_id)} is inactive.",
                            "code": "inactive_staff",
                        }
                    )

    return {
        "ready": len(blockers) == 0,
        "blockerCount": len(blockers),
        "missingInstructorCount": sum(1 for b in blockers if b["code"] == "missing_instructor"),
        "missingLabEngineerCount": sum(1 for b in blockers if b["code"] == "missing_lab_engineer"),
        "invalidCount": sum(1 for b in blockers if b["code"] not in ("missing_instructor", "missing_lab_engineer")),
        "blockers": blockers,
    }
