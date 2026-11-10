"""
Adaptive Rescheduling Workflow & Proposal Generator.
Identifies sessions impacted by a disruption, runs Tabu Search minimal-change repair,
validates hard constraints, and produces a transparent diff proposal for Administrator review.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Set, Tuple

from .chromosome import TimetableChromosome
from .constraints import (
    RoomResource,
    SchedulingSession,
    TimeSlotConfig,
    expand_sections_to_sessions,
)
from .fitness import OptimizationWeights, evaluate_chromosome_fitness
from .tabu_search import compute_stability_metrics, run_tabu_search_reschedule
from .validator import validate_timetable_assignments


def generate_rescheduling_proposal(
    disruption_type: str,
    affected_resource_id: str,
    affected_days: List[str],
    affected_start_times: List[str],
    reason: str,
    current_section_assignments: Dict[str, Dict[str, Any]],
    sections: List[Dict[str, Any]],
    courses: List[Dict[str, Any]],
    rooms_raw: List[Dict[str, Any]],
    student_groups: List[Dict[str, Any]],
    time_config: TimeSlotConfig,
    weights: Optional[OptimizationWeights] = None,
) -> Dict[str, Any]:
    t0 = time.perf_counter()

    sessions = expand_sections_to_sessions(sections, courses, student_groups)
    rooms = [
        RoomResource(
            room_id=str(r.get("id") or r.get("code")),
            code=str(r.get("code") or r.get("id")),
            name=str(r.get("name") or r.get("code") or ""),
            capacity=int(r.get("capacity") or 60),
            room_type=str(r.get("type") or r.get("room_type") or "lecture"),
            equipment=list(r.get("equipment") or []),
            is_available=bool(r.get("isAvailable", True)),
        )
        for r in rooms_raw
    ]

    # Convert frontend section assignments -> per-meeting session genes
    original_genes: Dict[str, Tuple[str, str, str]] = {}
    for sess in sessions:
        sec_assign = current_section_assignments.get(sess.section_id, {})
        room_id = str(sec_assign.get("roomId") or (rooms[0].room_id if rooms else "room-1"))
        if sess.meeting_index == 0:
            day = str(sec_assign.get("day") or time_config.working_days[0])
            st = str(sec_assign.get("startTime") or "09:00")
        elif sess.meeting_index == 1:
            day = str(sec_assign.get("secondDay") or sec_assign.get("day") or time_config.working_days[min(2, len(time_config.working_days) - 1)])
            st = str(sec_assign.get("secondStartTime") or sec_assign.get("startTime") or "09:00")
        else:
            day = str(sec_assign.get("thirdDay") or sec_assign.get("day") or time_config.working_days[-1])
            st = str(sec_assign.get("thirdStartTime") or sec_assign.get("startTime") or "09:00")
        original_genes[sess.session_id] = (day, st, room_id)

    # Evaluate baseline quality before disruption
    orig_chrom = TimetableChromosome(genes=dict(original_genes))
    orig_fitness = evaluate_chromosome_fitness(orig_chrom, sessions, rooms, time_config, weights=weights)

    # Build unavailability constraints from the reported disruption
    unavailable_instructor_slots: Set[Tuple[str, str, str]] = set()
    unavailable_room_slots: Set[Tuple[str, str, str]] = set()
    target_days = affected_days or list(time_config.working_days)
    target_slots = affected_start_times or time_config.generate_daily_lecture_slots()

    if disruption_type == "instructor_unavailable":
        for d in target_days:
            for st in target_slots:
                unavailable_instructor_slots.add((affected_resource_id, d, st))
    elif disruption_type in ("room_unavailable", "lab_unavailable"):
        for d in target_days:
            for st in target_slots:
                unavailable_room_slots.add((affected_resource_id, d, st))

    # Identify directly affected sessions
    affected_session_ids: Set[str] = set()
    for sess in sessions:
        day, st, rm_id = original_genes[sess.session_id]
        covered = time_config.covered_lecture_slots(st, sess.session_type == "Lab")
        if disruption_type == "instructor_unavailable" and sess.instructor_id == affected_resource_id:
            if any((sess.instructor_id, day, c_st) in unavailable_instructor_slots for c_st in covered):
                affected_session_ids.add(sess.session_id)
        elif disruption_type in ("room_unavailable", "lab_unavailable") and rm_id == affected_resource_id:
            if any((rm_id, day, c_st) in unavailable_room_slots for c_st in covered):
                affected_session_ids.add(sess.session_id)

    # Run Tabu Search repair
    repaired_chrom = run_tabu_search_reschedule(
        original_genes=original_genes,
        affected_session_ids=affected_session_ids,
        sessions=sessions,
        rooms=rooms,
        time_config=time_config,
        unavailable_instructor_slots=unavailable_instructor_slots,
        unavailable_room_slots=unavailable_room_slots,
        weights=weights,
    )

    proposed_fitness = evaluate_chromosome_fitness(
        repaired_chrom,
        sessions,
        rooms,
        time_config,
        weights=weights,
        unavailable_instructor_slots=unavailable_instructor_slots,
        unavailable_room_slots=unavailable_room_slots,
    )
    validation = validate_timetable_assignments(
        repaired_chrom.genes,
        sessions,
        rooms,
        time_config,
        unavailable_instructor_slots=unavailable_instructor_slots,
        unavailable_room_slots=unavailable_room_slots,
    )

    changed_count, unchanged_count, stability_pct = compute_stability_metrics(
        original_genes, repaired_chrom.genes
    )

    # Convert repaired session genes back to frontend section assignments + build detailed change list
    proposed_section_assignments: Dict[str, Dict[str, Any]] = {}
    for sec_id, orig_assign in current_section_assignments.items():
        proposed_section_assignments[sec_id] = dict(orig_assign)

    changes_list: List[Dict[str, Any]] = []
    affected_students_total = 0
    affected_instructors_set: Set[str] = set()

    for sess in sessions:
        before_val = original_genes.get(sess.session_id)
        after_val = repaired_chrom.genes.get(sess.session_id)
        if not before_val or not after_val:
            continue

        sec_entry = proposed_section_assignments.setdefault(sess.section_id, {})
        sec_entry["roomId"] = after_val[2]
        if sess.meeting_index == 0:
            sec_entry["day"] = after_val[0]
            sec_entry["startTime"] = after_val[1]
        elif sess.meeting_index == 1:
            sec_entry["secondDay"] = after_val[0]
            sec_entry["secondStartTime"] = after_val[1]
        else:
            sec_entry["thirdDay"] = after_val[0]
            sec_entry["thirdStartTime"] = after_val[1]

        if before_val != after_val:
            affected_students_total += sess.expected_students
            if sess.instructor_id:
                affected_instructors_set.add(sess.instructor_id)
            changes_list.append(
                {
                    "sessionId": sess.session_id,
                    "sectionId": sess.section_id,
                    "courseCode": sess.course_code,
                    "courseTitle": sess.course_title,
                    "sectionCode": sess.section_code,
                    "reason": reason or f"Resolved {disruption_type} on {affected_resource_id}",
                    "before": {
                        "day": before_val[0],
                        "startTime": before_val[1],
                        "roomId": before_val[2],
                    },
                    "after": {
                        "day": after_val[0],
                        "startTime": after_val[1],
                        "roomId": after_val[2],
                    },
                    "affectedStudentsCount": sess.expected_students,
                    "affectedInstructorId": sess.instructor_id,
                }
            )

    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)

    return {
        "algorithmUsed": "tabu_search",
        "disruptionType": disruption_type,
        "affectedResourceId": affected_resource_id,
        "affectedSessionIds": sorted(affected_session_ids),
        "affectedSessionsCount": len(affected_session_ids),
        "changedSessionsCount": changed_count,
        "unchangedSessionsCount": unchanged_count,
        "stabilityPercentage": stability_pct,
        "remainingHardViolations": validation.hard_violation_count,
        "feasible": validation.is_valid,
        "originalQualityScore": round(orig_fitness.total_score, 2),
        "proposedQualityScore": round(proposed_fitness.total_score, 2),
        "affectedStudentsTotal": affected_students_total,
        "affectedInstructors": sorted(affected_instructors_set),
        "repairExecutionTimeMs": elapsed_ms,
        "changes": changes_list,
        "originalAssignments": current_section_assignments,
        "proposedAssignments": proposed_section_assignments,
    }
