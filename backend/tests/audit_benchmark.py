"""
SmartGrid AI — Second-Stage Empirical Audit & Repeatable Benchmark Suite.
Verifies actual runtime behavior across all 10 audit areas and compares:
  - dsatur_only
  - ga_only
  - ga_sa
  - hybrid_dsatur_ga_sa
"""

from __future__ import annotations

import json
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Tuple

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.optimization.constraints import TimeSlotConfig, expand_sections_to_sessions
from app.optimization.evaluation import compare_optimization_algorithms
from app.optimization.fitness import OptimizationWeights
from app.optimization.rescheduler import generate_rescheduling_proposal
from app.optimization.scheduler import run_hybrid_timetable_pipeline


def build_realistic_university_dataset() -> Dict[str, Any]:
    """Repeatable multi-department, multi-batch dataset (8 sections, ~60 weekly sessions)."""
    departments = [
        {"id": "dept-cs", "code": "CS", "name": "Computer Science"},
        {"id": "dept-ee", "code": "EE", "name": "Electrical Engineering"},
        {"id": "dept-mth", "code": "MTH", "name": "Mathematics"},
    ]

    student_groups = [
        {"id": "grp-cs24-a", "code": "2K24-BSCS-A", "departmentId": "dept-cs", "departmentCode": "CS", "size": 55},
        {"id": "grp-cs24-b", "code": "2K24-BSCS-B", "departmentId": "dept-cs", "departmentCode": "CS", "size": 55},
        {"id": "grp-cs24-c", "code": "2K24-BSCS-C", "departmentId": "dept-cs", "departmentCode": "CS", "size": 50},
        {"id": "grp-cs25-a", "code": "2K25-BSCS-A", "departmentId": "dept-cs", "departmentCode": "CS", "size": 60},
        {"id": "grp-cs25-b", "code": "2K25-BSCS-B", "departmentId": "dept-cs", "departmentCode": "CS", "size": 58},
        {"id": "grp-ee24-a", "code": "2K24-BSEE-A", "departmentId": "dept-ee", "departmentCode": "EE", "size": 48},
        {"id": "grp-ee24-b", "code": "2K24-BSEE-B", "departmentId": "dept-ee", "departmentCode": "EE", "size": 46},
        {"id": "grp-mth25-a", "code": "2K25-BSMTH-A", "departmentId": "dept-mth", "departmentCode": "MTH", "size": 40},
    ]

    # Note: deliberately include BOTH dict-formatted unavailability (from UI) and token-formatted unavailability
    instructors = [
        {
            "id": "inst-turing",
            "name": "Dr. Alan Turing",
            "staffRole": "faculty",
            "departmentId": "dept-cs",
            "maxWeeklyHours": 16,
            "unavailableSlots": [{"day": "Mon", "timeSlot": "9:00 – 9:50 AM"}],
        },
        {
            "id": "inst-hopper",
            "name": "Dr. Grace Hopper",
            "staffRole": "faculty",
            "departmentId": "dept-cs",
            "maxWeeklyHours": 16,
            "unavailableSlots": [{"day": "Tue", "timeSlot": "2:00 – 2:50 PM"}],
        },
        {
            "id": "inst-lovelace",
            "name": "Dr. Ada Lovelace",
            "staffRole": "faculty",
            "departmentId": "dept-cs",
            "maxWeeklyHours": 16,
            "unavailableSlots": [],
        },
        {
            "id": "inst-dijkstra",
            "name": "Dr. Edsger Dijkstra",
            "staffRole": "faculty",
            "departmentId": "dept-cs",
            "maxWeeklyHours": 16,
            "unavailableSlots": [],
        },
        {
            "id": "inst-tesla",
            "name": "Dr. Nikola Tesla",
            "staffRole": "faculty",
            "departmentId": "dept-ee",
            "maxWeeklyHours": 16,
            "unavailableSlots": [],
        },
        {
            "id": "inst-gauss",
            "name": "Dr. Carl Gauss",
            "staffRole": "faculty",
            "departmentId": "dept-mth",
            "maxWeeklyHours": 18,
            "unavailableSlots": [],
        },
        {
            "id": "eng-zara",
            "name": "Eng. Zara Khan",
            "staffRole": "lab_engineer",
            "departmentId": "dept-cs",
            "maxWeeklyHours": 20,
            "unavailableSlots": [{"day": "Wed", "timeSlot": "9:00 – 9:50 AM"}],
        },
        {
            "id": "eng-bilal",
            "name": "Eng. Bilal Ahmed",
            "staffRole": "lab_engineer",
            "departmentId": "dept-cs",
            "maxWeeklyHours": 20,
            "unavailableSlots": [],
        },
        {
            "id": "eng-sana",
            "name": "Eng. Sana Tariq",
            "staffRole": "lab_engineer",
            "departmentId": "dept-ee",
            "maxWeeklyHours": 20,
            "unavailableSlots": [],
        },
    ]

    courses = [
        # Mixed lecture_lab courses (3 CR lec + 1 CR lab = 3x50m + 180m)
        {
            "id": "crs-ds",
            "code": "CS-201",
            "title": "Data Structures",
            "departmentId": "dept-cs",
            "courseType": "lecture_lab",
            "lectureCredits": 3,
            "labCredits": 1,
            "creditHours": 4,
            "assignedInstructorId": "inst-turing",
            "assignedLabEngineerId": "eng-zara",
            "requiredEquipment": ["Projector"],
        },
        {
            "id": "crs-os",
            "code": "CS-301",
            "title": "Operating Systems",
            "departmentId": "dept-cs",
            "courseType": "lecture_lab",
            "lectureCredits": 3,
            "labCredits": 1,
            "creditHours": 4,
            "assignedInstructorId": "inst-hopper",
            "assignedLabEngineerId": "eng-bilal",
            "requiredEquipment": ["Projector"],
        },
        {
            "id": "crs-dld",
            "code": "EE-210",
            "title": "Digital Logic Design",
            "departmentId": "dept-ee",
            "courseType": "lecture_lab",
            "lectureCredits": 2,
            "labCredits": 1,
            "creditHours": 3,
            "assignedInstructorId": "inst-tesla",
            "assignedLabEngineerId": "eng-sana",
            "requiredEquipment": ["Projector"],
        },
        # Pure lecture courses (1, 2, 3 credits)
        {
            "id": "crs-algo",
            "code": "CS-302",
            "title": "Algorithms",
            "departmentId": "dept-cs",
            "courseType": "lecture",
            "lectureCredits": 3,
            "labCredits": 0,
            "creditHours": 3,
            "assignedInstructorId": "inst-dijkstra",
            "requiredEquipment": ["Projector"],
        },
        {
            "id": "crs-ai",
            "code": "CS-310",
            "title": "Artificial Intelligence",
            "departmentId": "dept-cs",
            "courseType": "lecture",
            "lectureCredits": 3,
            "labCredits": 0,
            "creditHours": 3,
            "assignedInstructorId": "inst-lovelace",
            "requiredEquipment": ["Projector"],
        },
        {
            "id": "crs-la",
            "code": "MTH-201",
            "title": "Linear Algebra",
            "departmentId": "dept-mth",
            "courseType": "lecture",
            "lectureCredits": 3,
            "labCredits": 0,
            "creditHours": 3,
            "assignedInstructorId": "inst-gauss",
            "requiredEquipment": ["Projector"],
        },
        {
            "id": "crs-ethics",
            "code": "HUM-101",
            "title": "Professional Ethics",
            "departmentId": "dept-mth",
            "courseType": "lecture",
            "lectureCredits": 1,
            "labCredits": 0,
            "creditHours": 1,
            "assignedInstructorId": "inst-gauss",
            "requiredEquipment": [],
        },
        {
            "id": "crs-prob",
            "code": "MTH-210",
            "title": "Probability & Stats",
            "departmentId": "dept-mth",
            "courseType": "lecture",
            "lectureCredits": 2,
            "labCredits": 0,
            "creditHours": 2,
            "assignedInstructorId": "inst-gauss",
            "requiredEquipment": [],
        },
        # Cross-section shared elective
        {
            "id": "crs-nlp",
            "code": "CS-415",
            "title": "NLP Elective",
            "departmentId": "dept-cs",
            "courseType": "lecture",
            "lectureCredits": 2,
            "labCredits": 0,
            "creditHours": 2,
            "assignedInstructorId": "inst-lovelace",
            "isElective": True,
        },
    ]

    rooms_raw = [
        {"id": "rm-lh1", "code": "LH-101", "name": "LH-101", "type": "lecture", "capacity": 120, "equipment": ["Projector", "SmartBoard"], "isAvailable": True},
        {"id": "rm-lh2", "code": "LH-102", "name": "LH-102", "type": "lecture", "capacity": 80, "equipment": ["Projector"], "isAvailable": True},
        {"id": "rm-lh3", "code": "LH-103", "name": "LH-103", "type": "lecture", "capacity": 70, "equipment": ["Projector"], "isAvailable": True},
        {"id": "rm-lh4", "code": "LH-104", "name": "LH-104", "type": "lecture", "capacity": 65, "equipment": ["Projector"], "isAvailable": True},
        {"id": "rm-lh5", "code": "LH-105", "name": "LH-105", "type": "lecture", "capacity": 60, "equipment": ["Projector"], "isAvailable": True},
        {"id": "rm-lab1", "code": "CS-LAB-1", "name": "CS Lab 1", "type": "lab", "capacity": 65, "equipment": ["Workstations", "Projector"], "isAvailable": True},
        {"id": "rm-lab2", "code": "CS-LAB-2", "name": "CS Lab 2", "type": "lab", "capacity": 65, "equipment": ["Workstations", "Projector"], "isAvailable": True},
        {"id": "rm-lab3", "code": "EE-LAB-1", "name": "EE Hardware Lab", "type": "lab", "capacity": 55, "equipment": ["Oscilloscope", "Projector"], "isAvailable": True},
    ]

    sections: List[Dict[str, Any]] = []

    def add_course_for_group(crs_id: str, grp: Dict[str, Any], sec_code: str, inst_override: str = "", eng_override: str = "", shared: List[str] = None) -> None:
        crs = next(c for c in courses if c["id"] == crs_id)
        lec_cr = int(crs.get("lectureCredits") or 0)
        lab_cr = int(crs.get("labCredits") or 0)
        inst_id = inst_override or crs.get("assignedInstructorId") or ""
        eng_id = eng_override or crs.get("assignedLabEngineerId") or ""
        if lec_cr > 0:
            sections.append(
                {
                    "id": f"sec-{crs_id}-{grp['id']}-lec",
                    "courseId": crs_id,
                    "courseCode": crs["code"],
                    "departmentId": crs["departmentId"],
                    "departmentCode": "CS" if crs["departmentId"] == "dept-cs" else ("EE" if crs["departmentId"] == "dept-ee" else "MTH"),
                    "studentGroupId": grp["id"],
                    "batchCode": grp["code"],
                    "sectionCode": sec_code,
                    "instructorId": inst_id,
                    "sessionType": "Theory",
                    "componentType": "lecture",
                    "sessionsPerWeek": lec_cr,
                    "expectedStudents": grp["size"] if not shared else 110,
                    "sharedGroupIds": shared or [],
                }
            )
        if lab_cr > 0:
            sections.append(
                {
                    "id": f"sec-{crs_id}-{grp['id']}-lab",
                    "courseId": crs_id,
                    "courseCode": crs["code"] + "L",
                    "departmentId": crs["departmentId"],
                    "departmentCode": "CS" if crs["departmentId"] == "dept-cs" else "EE",
                    "studentGroupId": grp["id"],
                    "batchCode": grp["code"],
                    "sectionCode": sec_code,
                    "instructorId": inst_id,
                    "labEngineerId": eng_id,
                    "sessionType": "Lab",
                    "componentType": "lab",
                    "sessionsPerWeek": lab_cr,
                    "expectedStudents": grp["size"],
                    "requiredRoomType": "lab",
                }
            )

    grp_map = {g["id"]: g for g in student_groups}

    # 2K24-BSCS-A & B & C
    for gid, sc in [("grp-cs24-a", "A"), ("grp-cs24-b", "B"), ("grp-cs24-c", "C")]:
        add_course_for_group("crs-os", grp_map[gid], sc)
        add_course_for_group("crs-algo", grp_map[gid], sc)
        add_course_for_group("crs-ai", grp_map[gid], sc)
        add_course_for_group("crs-ethics", grp_map[gid], sc)

    # Shared elective for 2K24-BSCS-A & B
    add_course_for_group("crs-nlp", grp_map["grp-cs24-a"], "A+B", shared=["grp-cs24-b"])

    # 2K25-BSCS-A & B
    for gid, sc in [("grp-cs25-a", "A"), ("grp-cs25-b", "B")]:
        add_course_for_group("crs-ds", grp_map[gid], sc)
        add_course_for_group("crs-la", grp_map[gid], sc)
        add_course_for_group("crs-prob", grp_map[gid], sc)

    # 2K24-BSEE-A & B
    for gid, sc in [("grp-ee24-a", "A"), ("grp-ee24-b", "B")]:
        add_course_for_group("crs-dld", grp_map[gid], sc)
        add_course_for_group("crs-la", grp_map[gid], sc)
        add_course_for_group("crs-ethics", grp_map[gid], sc)

    # 2K25-BSMTH-A
    add_course_for_group("crs-la", grp_map["grp-mth25-a"], "A")
    add_course_for_group("crs-prob", grp_map["grp-mth25-a"], "A")
    add_course_for_group("crs-algo", grp_map["grp-mth25-a"], "A")

    student_preferences = [
        {"batch_id": "grp-cs24-a", "preferred_time_window": "morning", "avoid_early_8am": True, "avoid_late_after_4pm": True, "max_acceptable_gap_minutes": 45},
        {"batch_id": "grp-cs24-b", "preferred_time_window": "balanced", "avoid_early_8am": True, "avoid_late_after_4pm": True, "max_acceptable_gap_minutes": 60},
        {"batch_id": "grp-cs25-a", "preferred_time_window": "morning", "preferred_free_day": "Fri", "avoid_early_8am": True},
        {"batch_id": "grp-ee24-a", "preferred_time_window": "afternoon", "avoid_late_after_4pm": False},
    ]

    unavailable_instructor_slots = {
        "inst-dijkstra": ["Thu-09:00"],
        "eng-bilal": ["Mon-14:00"],
    }
    unavailable_room_slots = {
        "rm-lh1": ["Fri-09:00"],
    }

    return {
        "departments": departments,
        "student_groups": student_groups,
        "instructors": instructors,
        "courses": courses,
        "rooms_raw": rooms_raw,
        "sections": sections,
        "student_preferences": student_preferences,
        "unavailable_instructor_slots": unavailable_instructor_slots,
        "unavailable_room_slots": unavailable_room_slots,
    }


def compute_detailed_batch_metrics(res: Dict[str, Any], student_groups: List[Dict[str, Any]]) -> Dict[str, Any]:
    entries = res["entries"]
    by_grp_day: Dict[Tuple[str, str], List[Tuple[int, int]]] = defaultdict(list)
    for e in entries:
        gids = [e["batchId"]] + list(e.get("sharedGroupIds") or [])
        for gid in gids:
            if gid:
                by_grp_day[(gid, e["day"])].append((int(e["startMinutes"]), int(e["endMinutes"])))

    grp_spans: Dict[str, List[int]] = defaultdict(list)
    grp_days: Dict[str, int] = defaultdict(int)
    for (gid, _day), windows in by_grp_day.items():
        if windows:
            grp_days[gid] += 1
            span = max(w[1] for w in windows) - min(w[0] for w in windows)
            grp_spans[gid].append(span)

    per_batch = res["fitness"].get("batchGapBreakdown", {})
    batch_scores = res["fitness"].get("batchSatisfactionByBatch", {})
    max_idle = max((v["totalIdleMinutes"] for v in per_batch.values()), default=0)
    avg_span = (
        sum(s for spans in grp_spans.values() for s in spans)
        / max(1, sum(len(spans) for spans in grp_spans.values()))
    )
    avg_days = sum(grp_days.values()) / max(1, len(student_groups))
    spread = (max(batch_scores.values()) - min(batch_scores.values())) if batch_scores else 0.0

    return {
        "avgIdleMin": res["fitness"].get("avgIdleMinutesPerBatch", 0.0),
        "maxBatchIdleMin": max_idle,
        "longestSingleGapMin": res["fitness"].get("longestGapMinutes", 0),
        "totalGaps": res["fitness"].get("totalGapCount", 0),
        "avgDailyAttendanceMin": round(avg_span, 1),
        "avgAttendedDays": round(avg_days, 2),
        "worstBatchSat": res["fitness"].get("leastSatisfiedBatchScore", 0.0),
        "batchScoreSpread": round(spread, 2),
    }


def check_unavailability_compliance(res: Dict[str, Any], dataset: Dict[str, Any]) -> Tuple[int, List[str]]:
    """Independently check EVERY entry against BOTH dict and token unavailability (staff & rooms)."""
    from app.optimization.fitness import _parse_slot_token
    from app.optimization.constraints import parse_time_to_minutes

    inst_by_id = {i["id"]: i for i in dataset["instructors"]}
    extra_inst = dataset.get("unavailable_instructor_slots", {})
    extra_room = dataset.get("unavailable_room_slots", {})
    hits: List[str] = []

    def _matches(tok: Any, day: str, st_m: int, en_m: int, slot_idx: int, covered: List[int]) -> bool:
        if isinstance(tok, dict):
            t_day = str(tok.get("day") or "")[:3].capitalize()
            if t_day != day:
                return False
            ts = str(tok.get("timeSlot") or "")
            start_part = ts.split("–")[0].split("-")[0].strip()
            b_min = parse_time_to_minutes(start_part)
            return st_m <= b_min < en_m
        b_day, b_val = _parse_slot_token(str(tok))
        if b_day == day and b_val >= 0:
            if b_val >= 60:
                return st_m <= b_val < en_m
            return b_val in covered or b_val == slot_idx
        return False

    for e in res["entries"]:
        day = e["day"]
        st_m = int(e["startMinutes"])
        en_m = int(e["endMinutes"])
        slot_idx = int(e["slotIndex"])
        covered = list(e.get("coveredSlots") or [slot_idx])

        staff_ids = [sid for sid in [e.get("instructorId"), e.get("labEngineerId")] if sid]
        for sid in staff_ids:
            tokens = list(extra_inst.get(sid, [])) + list(inst_by_id.get(sid, {}).get("unavailableSlots") or [])
            for tok in tokens:
                if _matches(tok, day, st_m, en_m, slot_idx, covered):
                    hits.append(f"{e['courseCode']} ({e['sessionId']}) on {day} {e['startTime']}-{e['endTime']} violates staff {sid} block {tok}")

        rm_id = e["roomId"]
        for tok in extra_room.get(rm_id, []):
            if _matches(tok, day, st_m, en_m, slot_idx, covered):
                hits.append(f"{e['courseCode']} ({e['sessionId']}) in {rm_id} on {day} {e['startTime']} violates room block {tok}")

    return len(hits), hits


def run_benchmark_comparison(dataset: Dict[str, Any]) -> Dict[str, Any]:
    cfg = TimeSlotConfig(
        working_days=["Mon", "Tue", "Wed", "Thu", "Fri"],
        day_start_time="09:00",
        day_end_time="17:00",
        period_length_minutes=50,
        short_break_minutes=10,
        midday_break_enabled=True,
        midday_break_start="13:00",
        midday_break_duration=60,
        lab_duration_minutes=180,
        friday_enabled=True,
        friday_mode="jummah_break",
        friday_break_start="13:00",
        friday_break_end="14:30",
        friday_compression_scope="after_jummah",
        friday_period_length=45,
        friday_short_break=5,
    )
    weights = OptimizationWeights()

    algos = ["dsatur_only", "ga_only", "ga_sa", "hybrid_dsatur_ga_sa"]
    rows = []
    for algo in algos:
        res = run_hybrid_timetable_pipeline(
            sections=dataset["sections"],
            courses=dataset["courses"],
            rooms_raw=dataset["rooms_raw"],
            student_groups=dataset["student_groups"],
            instructors=dataset["instructors"],
            time_config=cfg,
            weights=weights,
            algorithm=algo,
            student_preferences=dataset["student_preferences"],
            unavailable_instructor_slots=dataset["unavailable_instructor_slots"],
            unavailable_room_slots=dataset["unavailable_room_slots"],
        )
        bstats = compute_detailed_batch_metrics(res, dataset["student_groups"])
        unavail_hits, unavail_msgs = check_unavailability_compliance(res, dataset)

        # Verify staff assignment invariance
        sec_by_id = {s["id"]: s for s in dataset["sections"]}
        staff_mutations = 0
        for e in res["entries"]:
            orig = sec_by_id.get(e["sectionId"], {})
            if not e["isLab"] and orig.get("instructorId") and e.get("instructorId") != orig["instructorId"]:
                staff_mutations += 1
            if e["isLab"] and orig.get("labEngineerId") and e.get("labEngineerId") != orig["labEngineerId"]:
                staff_mutations += 1

        rows.append(
            {
                "algorithm": algo,
                "feasible": res["feasible"],
                "hardViolations": res["hardConstraintViolations"],
                "placed": f"{res['placedSessions']}/{res['totalSessions']}",
                "totalScore": res["fitness"]["totalScore"],
                "studentSat": res["fitness"]["studentSatisfaction"],
                "compactness": res["fitness"]["compactnessScore"],
                "fairnessScore": res["fitness"]["fairnessScore"],
                "instSat": res["fitness"]["instructorSatisfaction"],
                "roomUtil": res["fitness"]["roomUtilization"],
                "timeMs": res["executionTimeMs"],
                "unavailViolations": unavail_hits,
                "unavailExamples": unavail_msgs[:3],
                "staffMutations": staff_mutations,
                **bstats,
            }
        )
    return {"config": cfg.to_metadata(), "rows": rows}


def run_friday_modes_audit(dataset: Dict[str, Any]) -> List[Dict[str, Any]]:
    results = []
    cases = [
        ("friday_disabled", TimeSlotConfig(working_days=["Mon", "Tue", "Wed", "Thu", "Fri"], friday_enabled=False)),
        ("jummah_break_compressed", TimeSlotConfig(friday_enabled=True, friday_mode="jummah_break", friday_compression_scope="after_jummah", friday_period_length=45)),
        ("morning_only_1300", TimeSlotConfig(friday_enabled=True, friday_mode="morning_only", friday_closing_time="13:00", friday_compression_scope="none")),
        ("standard_friday", TimeSlotConfig(friday_enabled=True, friday_mode="standard")),
        ("batch_restricted_cs24a", TimeSlotConfig(friday_enabled=True, friday_mode="jummah_break", friday_allowed_batches=["2K24-BSCS-A"])),
        ("dept_restricted_ee", TimeSlotConfig(friday_enabled=True, friday_mode="jummah_break", friday_allowed_departments=["EE"])),
    ]
    for name, cfg in cases:
        res = run_hybrid_timetable_pipeline(
            sections=dataset["sections"],
            courses=dataset["courses"],
            rooms_raw=dataset["rooms_raw"],
            student_groups=dataset["student_groups"],
            instructors=dataset["instructors"],
            time_config=cfg,
            algorithm="hybrid_dsatur_ga_sa",
        )
        fri_entries = [e for e in res["entries"] if e["day"] == "Fri"]
        bad_batches = []
        if name == "batch_restricted_cs24a":
            bad_batches = [e["batchCode"] for e in fri_entries if e["batchCode"] != "2K24-BSCS-A"]
        elif name == "dept_restricted_ee":
            bad_batches = [e["departmentCode"] for e in fri_entries if e["departmentCode"] != "EE"]
        elif name == "friday_disabled":
            bad_batches = [e["courseCode"] for e in fri_entries]
        elif name == "morning_only_1300":
            bad_batches = [f"{e['courseCode']}@{e['endTime']}" for e in fri_entries if e["endMinutes"] > 13 * 60]
        elif name == "jummah_break_compressed":
            bad_batches = [
                f"{e['courseCode']}@{e['startTime']}-{e['endTime']}"
                for e in fri_entries
                if e["startMinutes"] < 14 * 60 + 30 and e["endMinutes"] > 13 * 60
            ]

        results.append(
            {
                "mode": name,
                "feasible": res["feasible"],
                "hardViolations": res["hardConstraintViolations"],
                "placed": f"{res['placedSessions']}/{res['totalSessions']}",
                "fridayEntries": len(fri_entries),
                "policyViolations": bad_batches,
                "workingDays": cfg.working_days,
            }
        )
    return results


def run_large_scale_benchmark(multiplier: int = 2) -> Dict[str, Any]:
    """Scale dataset up to 16 cohorts (~120+ sessions) to profile latency & feasibility."""
    base = build_realistic_university_dataset()
    groups = []
    sections = []
    instructors = list(base["instructors"])
    rooms = list(base["rooms_raw"])

    for m in range(multiplier):
        suffix = f"-S{m+1}" if m > 0 else ""
        if m > 0:
            for inst in base["instructors"]:
                instructors.append({**inst, "id": inst["id"] + suffix, "name": inst["name"] + suffix})
            for rm in base["rooms_raw"]:
                rooms.append({**rm, "id": rm["id"] + suffix, "code": rm["code"] + suffix})
        for grp in base["student_groups"]:
            groups.append({**grp, "id": grp["id"] + suffix, "code": grp["code"] + suffix})
        for sec in base["sections"]:
            s_copy = {**sec, "id": sec["id"] + suffix, "studentGroupId": sec["studentGroupId"] + suffix}
            if m > 0:
                if s_copy.get("instructorId"):
                    s_copy["instructorId"] += suffix
                if s_copy.get("labEngineerId"):
                    s_copy["labEngineerId"] += suffix
                if s_copy.get("sharedGroupIds"):
                    s_copy["sharedGroupIds"] = [g + suffix for g in s_copy["sharedGroupIds"]]
            sections.append(s_copy)

    cfg = TimeSlotConfig()
    timings = {}
    for algo in ["dsatur_only", "ga_only", "ga_sa", "hybrid_dsatur_ga_sa"]:
        res = run_hybrid_timetable_pipeline(
            sections=sections,
            courses=base["courses"],
            rooms_raw=rooms,
            student_groups=groups,
            instructors=instructors,
            time_config=cfg,
            algorithm=algo,
        )
        timings[algo] = {
            "timeMs": res["executionTimeMs"],
            "feasible": res["feasible"],
            "hardViolations": res["hardConstraintViolations"],
            "placed": f"{res['placedSessions']}/{res['totalSessions']}",
            "totalScore": res["fitness"]["totalScore"],
            "avgIdleMin": res["fitness"]["avgIdleMinutesPerBatch"],
        }
    return {"cohorts": len(groups), "sections": len(sections), "results": timings}


def run_eval_api_and_rescheduler_audit(dataset: Dict[str, Any]) -> Dict[str, Any]:
    cfg = TimeSlotConfig()
    # 1. Test compare_optimization_algorithms forwarding instructors & unavailability
    comp = compare_optimization_algorithms(
        sections=dataset["sections"],
        courses=dataset["courses"],
        rooms_raw=dataset["rooms_raw"],
        student_groups=dataset["student_groups"],
        time_config=cfg,
        instructors=dataset["instructors"],
        student_preferences=dataset["student_preferences"],
        unavailable_instructor_slots=dataset["unavailable_instructor_slots"],
        unavailable_room_slots=dataset["unavailable_room_slots"],
    )
    # 2. Test credit hours fulfillment on mixed lecture_lab
    sessions = expand_sections_to_sessions(
        courses=dataset["courses"],
        sections=dataset["sections"],
        rooms=dataset["rooms_raw"],
        instructors=dataset["instructors"],
        time_config=cfg,
    )
    cs201_25a = [s for s in sessions if s.course_id == "crs-ds" and s.batch_id == "grp-cs25-a"]
    lec_mins = sum(s.duration_minutes for s in cs201_25a if not s.is_lab)
    lab_mins = sum(s.duration_minutes for s in cs201_25a if s.is_lab)

    # 3. Test rescheduling proposal on realistic pipeline result
    base_res = run_hybrid_timetable_pipeline(
        sections=dataset["sections"],
        courses=dataset["courses"],
        rooms_raw=dataset["rooms_raw"],
        student_groups=dataset["student_groups"],
        instructors=dataset["instructors"],
        time_config=cfg,
        unavailable_instructor_slots=dataset["unavailable_instructor_slots"],
        unavailable_room_slots=dataset["unavailable_room_slots"],
        algorithm="hybrid_dsatur_ga_sa",
    )
    target_entry = next(e for e in base_res["entries"] if not e["isLab"])
    try:
        resched = generate_rescheduling_proposal(
            disruption_type="instructor_unavailable",
            affected_resource_id=target_entry["instructorId"],
            affected_days=[target_entry["day"]],
            affected_start_times=[target_entry["startTime"]],
            reason="Faculty medical leave",
            current_section_assignments=base_res["assignments"],
            sections=dataset["sections"],
            courses=dataset["courses"],
            rooms_raw=dataset["rooms_raw"],
            student_groups=dataset["student_groups"],
            time_config=cfg,
            instructors=dataset["instructors"],
            unavailable_instructor_slots=dataset["unavailable_instructor_slots"],
            unavailable_room_slots=dataset["unavailable_room_slots"],
        )
        resched_summary = {
            "feasible": resched["feasible"],
            "remainingHardViolations": resched["remainingHardViolations"],
            "stabilityPct": resched["stabilityPercentage"],
            "changed": resched["changedSessionsCount"],
            "timeMs": resched["repairExecutionTimeMs"],
        }
    except Exception as exc:
        resched_summary = {"error": str(exc)}

    return {
        "compareKeys": list(comp.keys()),
        "compareItemKeys": list(comp["comparisons"][0].keys()) if comp.get("comparisons") else [],
        "uiCompareKeys": list(comp["comparison"][0].keys()) if comp.get("comparison") else [],
        "mixedCourse25a_lecMins": lec_mins,
        "mixedCourse25a_labMins": lab_mins,
        "reschedulerAudit": resched_summary,
    }


def run_rawlsian_fairness_audit(dataset: Dict[str, Any]) -> Dict[str, Any]:
    """Verify whether Rawlsian fairness improves the worst batch without ruining other batches."""
    cfg = TimeSlotConfig()
    configs = [
        ("balanced_weights", OptimizationWeights()),
        ("rawlsian_heavy_fairness", OptimizationWeights(student_gap_minimization=0.30, student_fairness=0.55, instructor_balance=0.10, room_utilization=0.10, preferences=0.10)),
    ]
    out: Dict[str, Any] = {}
    for label, w in configs:
        res = run_hybrid_timetable_pipeline(
            sections=dataset["sections"],
            courses=dataset["courses"],
            rooms_raw=dataset["rooms_raw"],
            student_groups=dataset["student_groups"],
            instructors=dataset["instructors"],
            time_config=cfg,
            weights=w,
            student_preferences=dataset["student_preferences"],
            unavailable_instructor_slots=dataset["unavailable_instructor_slots"],
            unavailable_room_slots=dataset["unavailable_room_slots"],
            algorithm="hybrid_dsatur_ga_sa",
        )
        b_scores = list(res["fitness"]["batchSatisfactionByBatch"].values())
        out[label] = {
            "feasible": res["feasible"],
            "hardViolations": res["hardConstraintViolations"],
            "totalScore": res["fitness"]["totalScore"],
            "worstBatchSat": round(min(b_scores), 2) if b_scores else 0.0,
            "bestBatchSat": round(max(b_scores), 2) if b_scores else 0.0,
            "meanBatchSat": round(sum(b_scores) / max(1, len(b_scores)), 2),
            "spread": round(max(b_scores) - min(b_scores), 2) if b_scores else 0.0,
            "avgIdleMin": res["fitness"]["avgIdleMinutesPerBatch"],
            "perBatch": res["fitness"]["batchSatisfactionByBatch"],
        }
    return out


def main() -> None:
    dataset = build_realistic_university_dataset()
    print("=== 1. ALGORITHM BENCHMARK (8 cohorts, 24 sections -> ~60 weekly sessions) ===")
    bench = run_benchmark_comparison(dataset)
    print(json.dumps(bench["rows"], indent=2))

    print("\n=== 2. FRIDAY MODES & RESTRICTIONS AUDIT ===")
    print(json.dumps(run_friday_modes_audit(dataset), indent=2))

    print("\n=== 3. EVAL API, MIXED COURSE HOURS & RESCHEDULER AUDIT ===")
    print(json.dumps(run_eval_api_and_rescheduler_audit(dataset), indent=2))

    print("\n=== 4. RAWLSIAN FAIRNESS STRESS AUDIT ===")
    print(json.dumps(run_rawlsian_fairness_audit(dataset), indent=2))

    print("\n=== 5. LARGE DATASET SCALE-UP BENCHMARK (16 cohorts, ~120 weekly sessions) ===")
    print(json.dumps(run_large_scale_benchmark(2), indent=2))


if __name__ == "__main__":
    main()
