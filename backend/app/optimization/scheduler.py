"""
Complete 15-Step Hybrid AI Timetable Generation Pipeline (scheduler.py).
Combines:
1. Session expansion & conflict graph construction
2. DSatur Graph Coloring heuristic
3. Room & laboratory capacity/equipment allocation
4. Genetic Algorithm population evolution
5. Simulated Annealing local refinement
6. Strict Hard-Constraint Validation
7. Student-Centric Multi-Objective Fitness & Batch Fairness Scoring
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Set, Tuple

from .chromosome import TimetableChromosome, repair_chromosome
from .constraints import (
    RoomResource,
    SchedulingSession,
    TimeSlotConfig,
    expand_sections_to_sessions,
)
from .fitness import OptimizationWeights, evaluate_chromosome_fitness
from .genetic_algorithm import run_genetic_algorithm
from .graph_coloring import run_dsatur_initial_schedule
from .simulated_annealing import run_simulated_annealing
from .validator import validate_timetable_assignments


def convert_chromosome_to_section_assignments(
    chromosome: TimetableChromosome,
    sessions: List[SchedulingSession],
) -> Dict[str, Dict[str, Any]]:
    section_assignments: Dict[str, Dict[str, Any]] = {}
    for sess in sessions:
        gene = chromosome.genes.get(sess.session_id)
        if not gene:
            continue
        day, start_time, room_id = gene
        entry = section_assignments.setdefault(
            sess.section_id,
            {
                "roomId": room_id,
                "day": day,
                "startTime": start_time,
            },
        )
        if sess.meeting_index == 0:
            entry["roomId"] = room_id
            entry["day"] = day
            entry["startTime"] = start_time
        elif sess.meeting_index == 1:
            entry["secondDay"] = day
            entry["secondStartTime"] = start_time
        elif sess.meeting_index == 2:
            entry["thirdDay"] = day
            entry["thirdStartTime"] = start_time
    return section_assignments


def run_hybrid_timetable_pipeline(
    sections: List[Dict[str, Any]],
    courses: List[Dict[str, Any]],
    rooms_raw: List[Dict[str, Any]],
    student_groups: List[Dict[str, Any]],
    time_config: Optional[TimeSlotConfig] = None,
    weights: Optional[OptimizationWeights] = None,
    algorithm: str = "hybrid_dsatur_ga_sa",
    unavailable_instructor_slots: Optional[Set[Tuple[str, str, str]]] = None,
    unavailable_room_slots: Optional[Set[Tuple[str, str, str]]] = None,
) -> Dict[str, Any]:
    t0 = time.perf_counter()
    cfg = time_config or TimeSlotConfig()
    w = weights or OptimizationWeights()

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

    fitness_history: List[float] = []

    if algorithm == "dsatur_only":
        genes = run_dsatur_initial_schedule(
            sessions,
            rooms,
            cfg,
            unavailable_instructor_slots=unavailable_instructor_slots,
            unavailable_room_slots=unavailable_room_slots,
        )
        best_chrom = repair_chromosome(
            TimetableChromosome(genes=genes),
            sessions,
            rooms,
            cfg,
            unavailable_instructor_slots=unavailable_instructor_slots,
            unavailable_room_slots=unavailable_room_slots,
        )
    elif algorithm == "ga_only":
        best_chrom, fitness_history = run_genetic_algorithm(
            sessions=sessions,
            rooms=rooms,
            time_config=cfg,
            weights=w,
            seed_with_dsatur=False,
            population_size=10,
            generations=10,
            unavailable_instructor_slots=unavailable_instructor_slots,
            unavailable_room_slots=unavailable_room_slots,
        )
    elif algorithm == "ga_sa":
        ga_chrom, fitness_history = run_genetic_algorithm(
            sessions=sessions,
            rooms=rooms,
            time_config=cfg,
            weights=w,
            seed_with_dsatur=False,
            population_size=10,
            generations=10,
            unavailable_instructor_slots=unavailable_instructor_slots,
            unavailable_room_slots=unavailable_room_slots,
        )
        best_chrom = run_simulated_annealing(
            initial_chromosome=ga_chrom,
            sessions=sessions,
            rooms=rooms,
            time_config=cfg,
            weights=w,
            unavailable_instructor_slots=unavailable_instructor_slots,
            unavailable_room_slots=unavailable_room_slots,
        )
    else:
        # Default: hybrid_dsatur_ga_sa (Graph-Coloring-Seeded Genetic Algorithm + Simulated Annealing)
        ga_chrom, fitness_history = run_genetic_algorithm(
            sessions=sessions,
            rooms=rooms,
            time_config=cfg,
            weights=w,
            seed_with_dsatur=True,
            population_size=12,
            generations=12,
            unavailable_instructor_slots=unavailable_instructor_slots,
            unavailable_room_slots=unavailable_room_slots,
        )
        best_chrom = run_simulated_annealing(
            initial_chromosome=ga_chrom,
            sessions=sessions,
            rooms=rooms,
            time_config=cfg,
            weights=w,
            unavailable_instructor_slots=unavailable_instructor_slots,
            unavailable_room_slots=unavailable_room_slots,
        )

    fitness_breakdown = evaluate_chromosome_fitness(
        best_chrom,
        sessions,
        rooms,
        cfg,
        weights=w,
        unavailable_instructor_slots=unavailable_instructor_slots,
        unavailable_room_slots=unavailable_room_slots,
    )
    validation = validate_timetable_assignments(
        best_chrom.genes,
        sessions,
        rooms,
        cfg,
        unavailable_instructor_slots=unavailable_instructor_slots,
        unavailable_room_slots=unavailable_room_slots,
    )

    section_assignments = convert_chromosome_to_section_assignments(best_chrom, sessions)
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
        "fitness": fitness_breakdown.to_dict(),
        "fitnessHistory": [round(val, 2) for val in fitness_history],
        "validationReport": validation.to_dict(),
        "assignments": section_assignments,
    }
