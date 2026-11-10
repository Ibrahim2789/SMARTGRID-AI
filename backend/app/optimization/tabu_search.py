"""
Algorithm 4: Custom Tabu Search for Adaptive Timetable Rescheduling.
Repairs disruptions (instructor unavailability, room/lab unavailability, operating hours change)
while minimizing perturbations to unaffected sessions in the published timetable.

Tabu Search Components:
1. Neighborhood Generation:
   - Focuses candidate moves on disrupted sessions and their immediate 1-hop resource neighbors.
   - Evaluates room-only substitutions first (0 time-slot change for students!), then
     same-day time-slot shifts, then cross-day time-slot shifts.
2. Tabu List & Tabu Tenure:
   - Maintains a FIFO Tabu list of recent (session_id, day, start_time, room_id) moves
     for `tabu_tenure` iterations to prevent cycling.
3. Aspiration Criterion:
   - Overrides Tabu status if a move achieves zero hard violations AND strictly improves
     the global best composite stability + quality objective.
4. Minimal-Perturbation Objective:
   - Combines student-centric fitness score with a high stability bonus (+15.0 * stability_ratio)
     so unaffected classes remain untouched unless strictly necessary.
"""

from __future__ import annotations

from collections import deque
from typing import Deque, Dict, List, Optional, Set, Tuple

from .chromosome import TimetableChromosome
from .constraints import (
    RoomResource,
    SchedulingSession,
    TimeSlotConfig,
    get_compatible_rooms,
)
from .fitness import OptimizationWeights, evaluate_chromosome_fitness
from .validator import validate_timetable_assignments


def compute_stability_metrics(
    original_genes: Dict[str, Tuple[str, str, str]],
    candidate_genes: Dict[str, Tuple[str, str, str]],
) -> Tuple[int, int, float]:
    """
    Returns (changed_count, unchanged_count, stability_percentage).
    """
    if not original_genes:
        return 0, 0, 100.0
    changed = 0
    unchanged = 0
    for sid, orig_val in original_genes.items():
        cand_val = candidate_genes.get(sid)
        if cand_val == orig_val:
            unchanged += 1
        else:
            changed += 1
    total = changed + unchanged
    pct = (unchanged / total) * 100.0 if total > 0 else 100.0
    return changed, unchanged, round(pct, 2)


def run_tabu_search_reschedule(
    original_genes: Dict[str, Tuple[str, str, str]],
    affected_session_ids: Set[str],
    sessions: List[SchedulingSession],
    rooms: List[RoomResource],
    time_config: TimeSlotConfig,
    unavailable_instructor_slots: Optional[Set[Tuple[str, str, str]]] = None,
    unavailable_room_slots: Optional[Set[Tuple[str, str, str]]] = None,
    weights: Optional[OptimizationWeights] = None,
    max_iterations: int = 25,
    tabu_tenure: int = 7,
) -> TimetableChromosome:
    """
    Uses Tabu Search to repair `affected_session_ids` with minimal changes to `original_genes`.
    """
    session_map = {s.session_id: s for s in sessions}
    days = list(time_config.working_days)
    lecture_slots = time_config.generate_daily_lecture_slots()
    lab_slots = time_config.generate_valid_lab_start_slots()

    current = TimetableChromosome(genes=dict(original_genes))

    def score_candidate(chrom: TimetableChromosome) -> float:
        fb = evaluate_chromosome_fitness(
            chrom,
            sessions,
            rooms,
            time_config,
            weights=weights,
            unavailable_instructor_slots=unavailable_instructor_slots,
            unavailable_room_slots=unavailable_room_slots,
        )
        _changed, _unchanged, stability_pct = compute_stability_metrics(original_genes, chrom.genes)
        # Hard violations dominate; among feasible schedules, prioritize stability + fitness
        return fb.total_score + 0.25 * stability_pct - (fb.hard_violation_count * 40.0)

    current_obj = score_candidate(current)
    best = current.clone()
    best_obj = current_obj

    tabu_queue: Deque[Tuple[str, str, str, str]] = deque(maxlen=tabu_tenure)

    for _it in range(max_iterations):
        val_report = validate_timetable_assignments(
            current.genes,
            sessions,
            rooms,
            time_config,
            unavailable_instructor_slots=unavailable_instructor_slots,
            unavailable_room_slots=unavailable_room_slots,
        )
        if val_report.is_valid and best.hard_violations == 0:
            break

        # Collect sessions currently involved in any violation or in affected_session_ids
        violating_sids: Set[str] = set(affected_session_ids)
        for v in val_report.violations:
            for sid in v.session_ids:
                violating_sids.add(sid)

        if not violating_sids:
            break

        best_neighbor: Optional[TimetableChromosome] = None
        best_neighbor_obj = -1e9
        best_move_sig: Optional[Tuple[str, str, str, str]] = None

        for sid in sorted(violating_sids):
            sess = session_map.get(sid)
            if not sess:
                continue
            orig_gene = original_genes.get(sid, (days[0], lecture_slots[0], rooms[0].room_id if rooms else ""))
            orig_day, orig_slot, _orig_room = orig_gene
            is_lab = sess.session_type == "Lab"
            slot_pool = lab_slots if is_lab else lecture_slots
            compat_rooms = get_compatible_rooms(sess, rooms)

            # Build candidate (day, start_time, room_id) moves ordered by minimal disruption:
            # 1) Same day & same time slot, different compatible room
            # 2) Same day, different time slot, compatible room
            # 3) Different day, any valid time slot, compatible room
            candidate_Assignments: List[Tuple[str, str, str]] = []
            for r in compat_rooms:
                if orig_day in days and orig_slot in slot_pool:
                    candidate_Assignments.append((orig_day, orig_slot, r.room_id))
            for st in slot_pool:
                for r in compat_rooms[:2]:
                    if orig_day in days:
                        candidate_Assignments.append((orig_day, st, r.room_id))
            for d in days:
                for st in slot_pool:
                    for r in compat_rooms[:2]:
                        candidate_Assignments.append((d, st, r.room_id))

            for cand_day, cand_slot, cand_room in candidate_Assignments:
                if current.genes.get(sid) == (cand_day, cand_slot, cand_room):
                    continue
                move_sig = (sid, cand_day, cand_slot, cand_room)
                neighbor = current.clone()
                neighbor.genes[sid] = (cand_day, cand_slot, cand_room)
                n_obj = score_candidate(neighbor)

                is_tabu = move_sig in tabu_queue
                # Aspiration criterion: allow tabu move if it beats global best and has 0 hard violations
                aspiration = (neighbor.hard_violations == 0 and n_obj > best_obj)

                if (not is_tabu or aspiration) and n_obj > best_neighbor_obj:
                    best_neighbor = neighbor
                    best_neighbor_obj = n_obj
                    best_move_sig = move_sig

        if best_neighbor is None:
            break

        current = best_neighbor
        current_obj = best_neighbor_obj
        if best_move_sig:
            tabu_queue.append(best_move_sig)

        if (
            current.hard_violations < best.hard_violations
            or (current.hard_violations == best.hard_violations and current_obj > best_obj)
        ):
            best = current.clone()
            best_obj = current_obj

    evaluate_chromosome_fitness(
        best,
        sessions,
        rooms,
        time_config,
        weights=weights,
        unavailable_instructor_slots=unavailable_instructor_slots,
        unavailable_room_slots=unavailable_room_slots,
    )
    return best
