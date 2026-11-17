"""
Hybrid AI Timetable Generation Pipeline (scheduler.py).
Combines:
1. Credit-hour expansion & pre-generation input validation
2. DSatur Graph Coloring heuristic with student-gap compaction
3. Genetic Algorithm population evolution (preserving immutable instructor/lab-engineer bindings)
4. Simulated Annealing local refinement
5. Strict Hard-Constraint Validation (zero clashes, Friday/break compliance)
6. Student-Centric Multi-Objective Fitness & Canonical Time-Based Entry Generation
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from .chromosome import TimetableChromosome
from .constraints import (
    ScheduleSession,
    TimeSlotConfig,
    expand_sections_to_sessions,
    format_minutes_24h,
    normalize_rooms_input,
    validate_pre_generation_inputs,
)
from .fitness import OptimizationWeights, evaluate_timetable_fitness, normalize_unavailable_slots_map
from .genetic_algorithm import run_genetic_algorithm
from .graph_coloring import dsatur_construct_schedule
from .simulated_annealing import run_simulated_annealing
from .validator import validate_timetable_assignments


def convert_chromosome_to_canonical_entries(
    chromosome: TimetableChromosome,
    sessions: List[ScheduleSession],
    rooms: List[Dict[str, Any]],
    time_config: TimeSlotConfig,
) -> List[Dict[str, Any]]:
    """Build exact canonical time-based session entries for UI matrix, DB persistence, and exports."""
    room_by_id = {r["id"]: r for r in rooms if r.get("id")}
    entries: List[Dict[str, Any]] = []

    for sess in sessions:
        gene = chromosome.genes.get(sess.session_id)
        if not gene:
            continue
        gene.sync_timing(sess, time_config)
        room = room_by_id.get(gene.room_id, {})
        start_24 = format_minutes_24h(gene.start_min)
        end_24 = format_minutes_24h(gene.end_min)
        dur = max(1, gene.end_min - gene.start_min)
        anchor = time_config.get_slot(gene.day, gene.slot_index)

        entries.append(
            {
                "sessionId": sess.session_id,
                "sectionId": sess.section_id,
                "courseId": sess.course_id,
                "courseCode": sess.course_code,
                "courseTitle": sess.course_title,
                "sessionType": sess.session_type,
                "componentType": sess.component_type,
                "courseType": sess.course_type,
                "lectureCreditHours": sess.lecture_credit_hours,
                "labCreditHours": sess.lab_credit_hours,
                "creditHours": sess.credit_hours,
                "meetingIndex": sess.meeting_index,
                "meetingsTotal": sess.meetings_total,
                "isLab": sess.is_lab,
                "isSplitLab": sess.is_split_lab,
                "batchId": sess.batch_id,
                "batchCode": sess.batch_code,
                "departmentId": sess.department_id,
                "departmentCode": sess.department_code,
                "sectionCode": sess.section_code,
                "instructorId": sess.instructor_id,
                "instructorName": sess.instructor_name,
                "labEngineerId": sess.lab_engineer_id,
                "labEngineerName": sess.lab_engineer_name,
                "roomId": gene.room_id,
                "roomCode": room.get("code") or gene.room_id,
                "roomName": room.get("name") or room.get("code") or gene.room_id,
                "day": gene.day,
                "slotIndex": gene.slot_index,
                "coveredSlots": list(gene.covered_slots),
                "startTime": start_24,
                "endTime": end_24,
                "startMinutes": gene.start_min,
                "endMinutes": gene.end_min,
                "durationMinutes": dur,
                "isLocked": sess.is_locked or gene.is_locked,
                "slotSource": anchor.slot_source if anchor else ("friday_special" if gene.day == "Fri" else "regular"),
                "sharedGroupIds": list(sess.shared_group_ids),
            }
        )

    day_rank = {d: idx for idx, d in enumerate(time_config.working_days)}
    entries.sort(key=lambda e: (day_rank.get(e["day"], 99), e["startMinutes"], e["courseCode"], e["sectionCode"]))
    return entries


def convert_chromosome_to_section_assignments(
    chromosome: TimetableChromosome,
    sessions: List[ScheduleSession],
    time_config: Optional[TimeSlotConfig] = None,
) -> Dict[str, Dict[str, Any]]:
    cfg = time_config or TimeSlotConfig()
    section_assignments: Dict[str, Dict[str, Any]] = {}
    for sess in sessions:
        gene = chromosome.genes.get(sess.session_id)
        if not gene:
            continue
        gene.sync_timing(sess, cfg)
        start_time = format_minutes_24h(gene.start_min)
        end_time = format_minutes_24h(gene.end_min)
        entry = section_assignments.setdefault(
            sess.section_id,
            {
                "roomId": gene.room_id,
                "day": gene.day,
                "startTime": start_time,
                "endTime": end_time,
                "startMinutes": gene.start_min,
                "endMinutes": gene.end_min,
                "durationMinutes": max(1, gene.end_min - gene.start_min),
                "instructorId": sess.instructor_id,
                "labEngineerId": sess.lab_engineer_id,
                "componentType": sess.component_type,
                "meetings": [],
            },
        )
        entry["meetings"].append(
            {
                "sessionId": sess.session_id,
                "meetingIndex": sess.meeting_index,
                "day": gene.day,
                "startTime": start_time,
                "endTime": end_time,
                "durationMinutes": max(1, gene.end_min - gene.start_min),
                "roomId": gene.room_id,
            }
        )
        if sess.meeting_index == 0:
            entry["roomId"] = gene.room_id
            entry["day"] = gene.day
            entry["startTime"] = start_time
            entry["endTime"] = end_time
            entry["startMinutes"] = gene.start_min
            entry["endMinutes"] = gene.end_min
            entry["durationMinutes"] = max(1, gene.end_min - gene.start_min)
        elif sess.meeting_index == 1:
            entry["secondDay"] = gene.day
            entry["secondStartTime"] = start_time
            entry["secondEndTime"] = end_time
        elif sess.meeting_index == 2:
            entry["thirdDay"] = gene.day
            entry["thirdStartTime"] = start_time
            entry["thirdEndTime"] = end_time
    return section_assignments


def run_hybrid_timetable_pipeline(
    sections: List[Dict[str, Any]],
    courses: List[Dict[str, Any]],
    rooms_raw: List[Any],
    student_groups: Optional[List[Dict[str, Any]]] = None,
    instructors: Optional[List[Dict[str, Any]]] = None,
    time_config: Optional[TimeSlotConfig] = None,
    weights: Optional[Any] = None,
    algorithm: str = "hybrid_dsatur_ga_sa",
    student_preferences: Optional[List[Dict[str, Any]]] = None,
    instructor_preferences: Optional[List[Dict[str, Any]]] = None,
    unavailable_instructor_slots: Optional[Any] = None,
    unavailable_room_slots: Optional[Any] = None,
) -> Dict[str, Any]:
    t0 = time.perf_counter()
    cfg = time_config or TimeSlotConfig()
    norm_rooms = normalize_rooms_input(rooms_raw)
    w_dict = weights.to_dict() if hasattr(weights, "to_dict") else (weights if isinstance(weights, dict) else OptimizationWeights().to_dict())
    inst_list = instructors or []
    unavail_inst = normalize_unavailable_slots_map(unavailable_instructor_slots, inst_list)
    unavail_room = normalize_unavailable_slots_map(unavailable_room_slots, None)

    # Merge student group metadata into sections where batchCode / enrollment may be missing
    groups_by_id: Dict[str, Dict[str, Any]] = {}
    for g in student_groups or []:
        if isinstance(g, dict):
            if g.get("id"):
                groups_by_id[str(g["id"])] = g
            if g.get("batchId"):
                groups_by_id[str(g["batchId"])] = g

    enriched_sections: List[Dict[str, Any]] = []
    for sec in sections:
        s_copy = dict(sec)
        gid = str(s_copy.get("studentGroupId") or s_copy.get("batchId") or s_copy.get("batch_id") or "")
        grp = groups_by_id.get(gid)
        if grp:
            if not s_copy.get("batchCode") and grp.get("code"):
                s_copy["batchCode"] = grp["code"]
            if not s_copy.get("departmentId") and grp.get("departmentId"):
                s_copy["departmentId"] = grp["departmentId"]
            if not s_copy.get("departmentCode") and grp.get("departmentCode"):
                s_copy["departmentCode"] = grp["departmentCode"]
            if not s_copy.get("expectedStudents") and not s_copy.get("enrollment") and grp.get("size"):
                s_copy["expectedStudents"] = grp["size"]
        enriched_sections.append(s_copy)

    sessions = expand_sections_to_sessions(
        courses=courses,
        sections=enriched_sections,
        rooms=norm_rooms,
        instructors=inst_list,
        time_config=cfg,
    )
    pre_validation = validate_pre_generation_inputs(
        sessions=sessions,
        rooms=norm_rooms,
        instructors=inst_list,
        time_config=cfg,
    )

    fitness_history: List[float] = []

    if algorithm == "dsatur_only":
        best_chrom = dsatur_construct_schedule(
            sessions=sessions,
            rooms=norm_rooms,
            instructors=inst_list,
            time_config=cfg,
            unavailable_instructor_slots=unavail_inst,
            unavailable_room_slots=unavail_room,
            student_preferences=student_preferences,
            weights=w_dict,
            seed=42,
        )
        evaluate_timetable_fitness(
            best_chrom,
            sessions,
            norm_rooms,
            inst_list,
            cfg,
            weights=w_dict,
            student_preferences=student_preferences,
            instructor_preferences=instructor_preferences,
            unavailable_instructor_slots=unavail_inst,
            unavailable_room_slots=unavail_room,
        )
        fitness_history = [best_chrom.fitness_score]
    elif algorithm == "ga_only":
        ga_res = run_genetic_algorithm(
            sessions=sessions,
            rooms=norm_rooms,
            instructors=inst_list,
            time_config=cfg,
            weights=w_dict,
            student_preferences=student_preferences,
            instructor_preferences=instructor_preferences,
            unavailable_instructor_slots=unavail_inst,
            unavailable_room_slots=unavail_room,
            seed_with_dsatur=False,
            population_size=10,
            generations=10,
        )
        best_chrom = ga_res["chromosome"]
        fitness_history = ga_res["convergence_history"]
    elif algorithm == "ga_sa":
        ga_res = run_genetic_algorithm(
            sessions=sessions,
            rooms=norm_rooms,
            instructors=inst_list,
            time_config=cfg,
            weights=w_dict,
            student_preferences=student_preferences,
            instructor_preferences=instructor_preferences,
            unavailable_instructor_slots=unavail_inst,
            unavailable_room_slots=unavail_room,
            seed_with_dsatur=False,
            population_size=10,
            generations=10,
        )
        sa_res = run_simulated_annealing(
            initial_chromosome=ga_res["chromosome"],
            sessions=sessions,
            rooms=norm_rooms,
            instructors=inst_list,
            time_config=cfg,
            weights=w_dict,
            student_preferences=student_preferences,
            instructor_preferences=instructor_preferences,
            unavailable_instructor_slots=unavail_inst,
            unavailable_room_slots=unavail_room,
        )
        best_chrom = sa_res["chromosome"]
        fitness_history = ga_res["convergence_history"] + sa_res["convergence_history"]
    else:
        # Default: hybrid_dsatur_ga_sa
        seed_chrom = dsatur_construct_schedule(
            sessions=sessions,
            rooms=norm_rooms,
            instructors=inst_list,
            time_config=cfg,
            unavailable_instructor_slots=unavail_inst,
            unavailable_room_slots=unavail_room,
            student_preferences=student_preferences,
            weights=w_dict,
            seed=42,
        )
        ga_res = run_genetic_algorithm(
            sessions=sessions,
            rooms=norm_rooms,
            instructors=inst_list,
            time_config=cfg,
            weights=w_dict,
            student_preferences=student_preferences,
            instructor_preferences=instructor_preferences,
            unavailable_instructor_slots=unavail_inst,
            unavailable_room_slots=unavail_room,
            initial_seed_chromo=seed_chrom,
            seed_with_dsatur=True,
            population_size=12,
            generations=12,
        )
        sa_res = run_simulated_annealing(
            initial_chromosome=ga_res["chromosome"],
            sessions=sessions,
            rooms=norm_rooms,
            instructors=inst_list,
            time_config=cfg,
            weights=w_dict,
            student_preferences=student_preferences,
            instructor_preferences=instructor_preferences,
            unavailable_instructor_slots=unavail_inst,
            unavailable_room_slots=unavail_room,
        )
        best_chrom = sa_res["chromosome"]
        fitness_history = ga_res["convergence_history"] + sa_res["convergence_history"]

    fitness_metrics = evaluate_timetable_fitness(
        best_chrom,
        sessions,
        norm_rooms,
        inst_list,
        cfg,
        weights=w_dict,
        student_preferences=student_preferences,
        instructor_preferences=instructor_preferences,
        unavailable_instructor_slots=unavail_inst,
        unavailable_room_slots=unavail_room,
    )
    validation = validate_timetable_assignments(
        best_chrom,
        sessions,
        norm_rooms,
        cfg,
        instructors=inst_list,
        unavailable_instructor_slots=unavail_inst,
        unavailable_room_slots=unavail_room,
    )

    canonical_entries = convert_chromosome_to_canonical_entries(best_chrom, sessions, norm_rooms, cfg)
    section_assignments = convert_chromosome_to_section_assignments(best_chrom, sessions, cfg)
    placed_sections = len(section_assignments)
    total_sections = len(sections)
    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)

    return {
        "algorithm": algorithm,
        "feasible": validation.is_valid,
        "hardConstraintViolations": validation.hard_violation_count,
        "totalSessions": len(sessions),
        "placedSessions": len(best_chrom.genes),
        "placedCount": placed_sections,
        "unplacedCount": max(0, total_sections - placed_sections),
        "executionTimeMs": elapsed_ms,
        "timeConfig": cfg.to_metadata(),
        "preValidation": pre_validation,
        "fitness": fitness_metrics,
        "fitnessHistory": [round(val, 2) for val in fitness_history],
        "validationReport": validation.to_dict(),
        "entries": canonical_entries,
        "assignments": section_assignments,
    }
