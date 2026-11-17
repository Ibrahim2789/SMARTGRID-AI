"""Simulated Annealing local refinement targeting zero student gaps and Friday/break compliance."""

from __future__ import annotations

import math
import random
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

from .chromosome import SessionGene, TimetableChromosome
from .constraints import ScheduleSession, TimeSlotConfig
from .fitness import evaluate_timetable_fitness, is_slot_blocked, normalize_unavailable_slots_map
from .genetic_algorithm import _build_compatible_rooms_map


def _generate_gap_aware_neighbor(
    chromo: TimetableChromosome,
    sessions: List[ScheduleSession],
    rooms: List[Dict[str, Any]],
    time_config: TimeSlotConfig,
    rng: random.Random,
    unavail_inst: Optional[Dict[str, List[Any]]] = None,
    unavail_room: Optional[Dict[str, List[Any]]] = None,
    comp_map: Optional[Dict[str, List[Dict[str, Any]]]] = None,
) -> Optional[TimetableChromosome]:
    """Propose a valid single-session move, biased toward closing student gaps without changing staff."""
    unlocked = [s for s in sessions if not s.is_locked and s.session_id in chromo.genes]
    if not unlocked:
        return None

    u_inst = unavail_inst or {}
    u_room = unavail_room or {}
    room_map = comp_map or _build_compatible_rooms_map(sessions, rooms)

    group_day_windows: Dict[tuple, List[tuple]] = defaultdict(list)
    staff_day_windows: Dict[tuple, List[tuple]] = defaultdict(list)
    room_day_windows: Dict[tuple, List[tuple]] = defaultdict(list)
    lecture_section_days: Dict[Tuple[str, str], Set[str]] = defaultdict(set)

    for s in sessions:
        g = chromo.genes.get(s.session_id)
        if not g:
            continue
        for gk in s.student_group_keys:
            group_day_windows[(gk, g.day)].append((g.session_id, g.start_min, g.end_min))
        for st_id in s.staff_ids:
            staff_day_windows[(st_id, g.day)].append((g.session_id, g.start_min, g.end_min))
        room_day_windows[(g.room_id, g.day)].append((g.session_id, g.start_min, g.end_min))
        if not s.is_lab and s.duration_minutes < 95:
            sec_key = f"{s.batch_id}::{s.course_id}::{s.section_code}"
            lecture_section_days[(sec_key, g.day)].add(s.session_id)

    sess = rng.choice(unlocked)
    cur_gene = chromo.genes[sess.session_id]
    eligible_days = [d for d in time_config.working_days if not (d == "Fri" and not sess.friday_eligible)]
    if not eligible_days:
        return None

    sec_key = f"{sess.batch_id}::{sess.course_id}::{sess.section_code}"
    enforces_unique_day = (not sess.is_lab) and sess.duration_minutes < 95 and sess.meetings_total <= max(1, len(eligible_days))
    candidate_days = [
        d
        for d in eligible_days
        if not enforces_unique_day
        or d == cur_gene.day
        or not (lecture_section_days[(sec_key, d)] - {sess.session_id})
    ]
    if not candidate_days:
        return None

    attended = [d for d in candidate_days if group_day_windows.get((sess.batch_id, d))]
    target_day = rng.choice(attended) if attended and rng.random() < 0.7 else rng.choice(candidate_days)
    valid_slots = time_config.get_valid_start_slots_for_session(sess, target_day)
    if not valid_slots:
        return None

    comp_rooms = list(room_map.get(sess.session_id) or rooms)
    rng.shuffle(valid_slots)
    rng.shuffle(comp_rooms)

    best_move = None
    best_local_cost = 10**9
    cohort_items = [
        (st, en)
        for gk in sess.student_group_keys
        for sid, st, en in group_day_windows.get((gk, target_day), [])
        if sid != sess.session_id
    ]

    for sl_idx in valid_slots[:8]:
        win = time_config.compute_session_window(target_day, sl_idx, sess.duration_minutes, sess.is_lab)
        if not win:
            continue
        st_m, en_m, cov = win

        if any(is_slot_blocked(u_inst.get(st_id, []), target_day, st_m, en_m, cov) for st_id in sess.staff_ids):
            continue
        if any(
            sid != sess.session_id and st_m < ex_e and ex_s < en_m
            for st_id in sess.staff_ids
            for sid, ex_s, ex_e in staff_day_windows[(st_id, target_day)]
        ):
            continue
        if any(
            sid != sess.session_id and st_m < ex_e and ex_s < en_m
            for gk in sess.student_group_keys
            for sid, ex_s, ex_e in group_day_windows[(gk, target_day)]
        ):
            continue

        for room in comp_rooms[:6]:
            r_id = room["id"]
            if is_slot_blocked(u_room.get(r_id, []), target_day, st_m, en_m, cov):
                continue
            if any(
                sid != sess.session_id and st_m < ex_e and ex_s < en_m
                for sid, ex_s, ex_e in room_day_windows[(r_id, target_day)]
            ):
                continue

            if cohort_items:
                local_cost = float(min(min(abs(st_m - ex_e), abs(ex_s - en_m)) for ex_s, ex_e in cohort_items))
            else:
                local_cost = 15.0 + (st_m - time_config.day_start_min) * 0.05

            if local_cost < best_local_cost:
                best_local_cost = local_cost
                best_move = (target_day, sl_idx, r_id, st_m, en_m, cov)

    if best_move is None:
        return None

    m_day, m_slot, m_room, st_m, en_m, cov = best_move
    neighbor = chromo.clone()
    neighbor.genes[sess.session_id] = SessionGene(
        session_id=sess.session_id,
        day=m_day,
        slot_index=m_slot,
        room_id=m_room,
        duration_slots=len(cov),
        is_lab=sess.is_lab,
        is_locked=False,
        start_min=st_m,
        end_min=en_m,
        covered_slots=cov,
    )
    return neighbor


def run_simulated_annealing(
    initial_chromosome: TimetableChromosome,
    sessions: List[ScheduleSession],
    rooms: List[Dict[str, Any]],
    instructors: List[Dict[str, Any]],
    time_config: TimeSlotConfig,
    weights: Optional[Dict[str, float]] = None,
    student_preferences: Optional[List[Dict[str, Any]]] = None,
    instructor_preferences: Optional[List[Dict[str, Any]]] = None,
    unavailable_instructor_slots: Optional[Dict[str, List[str]]] = None,
    unavailable_room_slots: Optional[Dict[str, List[str]]] = None,
    initial_temp: float = 18.0,
    cooling_rate: float = 0.94,
    max_iterations: int = 70,
    seed: int = 42,
) -> Dict[str, Any]:
    rng = random.Random(seed)
    unavail_inst = normalize_unavailable_slots_map(unavailable_instructor_slots, instructors)
    unavail_room = normalize_unavailable_slots_map(unavailable_room_slots, None)
    comp_map = _build_compatible_rooms_map(sessions, rooms)

    current = initial_chromosome.clone()
    evaluate_timetable_fitness(
        current,
        sessions,
        rooms,
        instructors,
        time_config,
        weights=weights,
        student_preferences=student_preferences,
        instructor_preferences=instructor_preferences,
        unavailable_instructor_slots=unavail_inst,
        unavailable_room_slots=unavail_room,
    )
    best = current.clone()
    temp = initial_temp
    history: List[float] = [best.fitness_score]

    for _ in range(max_iterations):
        neighbor = _generate_gap_aware_neighbor(
            current,
            sessions,
            rooms,
            time_config,
            rng,
            unavail_inst=unavail_inst,
            unavail_room=unavail_room,
            comp_map=comp_map,
        )
        if neighbor is None:
            temp *= cooling_rate
            history.append(best.fitness_score)
            continue

        evaluate_timetable_fitness(
            neighbor,
            sessions,
            rooms,
            instructors,
            time_config,
            weights=weights,
            student_preferences=student_preferences,
            instructor_preferences=instructor_preferences,
            unavailable_instructor_slots=unavail_inst,
            unavailable_room_slots=unavail_room,
        )

        # Never accept an increase in hard violations over feasible current
        if neighbor.hard_violations > current.hard_violations:
            temp *= cooling_rate
            history.append(best.fitness_score)
            continue

        delta = neighbor.fitness_score - current.fitness_score
        if delta >= 0 or (temp > 0.05 and rng.random() < math.exp(delta / temp)):
            current = neighbor
            if (current.hard_violations, -current.fitness_score) < (best.hard_violations, -best.fitness_score):
                best = current.clone()

        temp *= cooling_rate
        history.append(best.fitness_score)

    return {
        "chromosome": best,
        "convergence_history": history,
    }
