"""Genetic Algorithm optimizer with student gap-closing mutations and conflict repair."""

from __future__ import annotations

import random
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from .chromosome import SessionGene, TimetableChromosome
from .constraints import ScheduleSession, TimeSlotConfig
from .fitness import evaluate_timetable_fitness, is_slot_blocked, normalize_unavailable_slots_map
from .graph_coloring import _is_room_compatible, dsatur_construct_schedule


def _build_compatible_rooms_map(
    sessions: List[ScheduleSession],
    rooms: List[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    comp_map: Dict[str, List[Dict[str, Any]]] = {}
    for sess in sessions:
        comp = [r for r in rooms if _is_room_compatible(sess, r)]
        if not comp:
            same_kind = [
                r
                for r in rooms
                if r.get("is_available", r.get("isAvailable", True))
                and (("lab" in str(r.get("type") or r.get("room_type") or "").lower()) == sess.is_lab)
            ]
            comp = same_kind or [r for r in rooms if r.get("is_available", r.get("isAvailable", True))] or list(rooms)
        comp.sort(
            key=lambda rm: (max(0, int(rm.get("capacity") or 50) - sess.expected_students), str(rm.get("code") or rm["id"]))
        )
        comp_map[sess.session_id] = comp
    return comp_map


def _repair_conflicts(
    chromo: TimetableChromosome,
    sessions: List[ScheduleSession],
    rooms: List[Dict[str, Any]],
    time_config: TimeSlotConfig,
    rng: random.Random,
    unavail_inst: Optional[Dict[str, List[Any]]] = None,
    unavail_room: Optional[Dict[str, List[Any]]] = None,
    compatible_rooms_by_session: Optional[Dict[str, List[Dict[str, Any]]]] = None,
) -> TimetableChromosome:
    """Preserve locked genes & repair colliding/blocked/duplicate-day genes without altering assigned staff."""
    repaired = chromo.clone()
    u_inst = unavail_inst or {}
    u_room = unavail_room or {}
    comp_map = compatible_rooms_by_session or _build_compatible_rooms_map(sessions, rooms)
    room_by_id = {r["id"]: r for r in rooms if r.get("id")}

    staff_busy: Dict[tuple, List[tuple]] = defaultdict(list)
    room_busy: Dict[tuple, List[tuple]] = defaultdict(list)
    group_busy: Dict[tuple, List[tuple]] = defaultdict(list)
    lecture_section_day_used: Dict[Tuple[str, str], int] = defaultdict(int)

    # First lock pinned genes, then labs (harder to place), then lectures
    ordered = sorted(sessions, key=lambda s: (0 if s.is_locked else 1, 0 if s.is_lab else 1, -s.duration_minutes))
    needs_relocation: List[ScheduleSession] = []

    for sess in ordered:
        gene = repaired.genes.get(sess.session_id)
        if not gene:
            needs_relocation.append(sess)
            continue
        if gene.day not in time_config.working_days or (gene.day == "Fri" and not sess.friday_eligible):
            if not sess.is_locked:
                needs_relocation.append(sess)
                continue
        win = time_config.compute_session_window(gene.day, gene.slot_index, sess.duration_minutes, sess.is_lab)
        if win is None and not sess.is_locked:
            needs_relocation.append(sess)
            continue
        gene.sync_timing(sess, time_config)
        st_m, en_m = gene.start_min, gene.end_min
        cov = gene.covered_slots

        rm = room_by_id.get(gene.room_id)
        room_ok = bool(rm and _is_room_compatible(sess, rm))
        sec_key = f"{sess.batch_id}::{sess.course_id}::{sess.section_code}"
        eligible_days = len([d for d in time_config.working_days if not (d == "Fri" and not sess.friday_eligible)])
        enforces_unique_day = (not sess.is_lab) and sess.duration_minutes < 95 and sess.meetings_total <= max(1, eligible_days)
        same_day_dup = enforces_unique_day and lecture_section_day_used[(sec_key, gene.day)] > 0

        staff_blocked = any(
            is_slot_blocked(u_inst.get(st_id, []), gene.day, st_m, en_m, cov) for st_id in sess.staff_ids
        )
        room_blocked = is_slot_blocked(u_room.get(gene.room_id, []), gene.day, st_m, en_m, cov)

        has_conflict = (
            not room_ok
            or staff_blocked
            or room_blocked
            or same_day_dup
            or any(st_m < e and s < en_m for st_id in sess.staff_ids for s, e in staff_busy[(st_id, gene.day)])
            or any(st_m < e and s < en_m for s, e in room_busy[(gene.room_id, gene.day)])
            or any(st_m < e and s < en_m for gk in sess.student_group_keys for s, e in group_busy[(gk, gene.day)])
        )
        if has_conflict and not sess.is_locked:
            needs_relocation.append(sess)
            continue

        for st_id in sess.staff_ids:
            staff_busy[(st_id, gene.day)].append((st_m, en_m))
        room_busy[(gene.room_id, gene.day)].append((st_m, en_m))
        for gk in sess.student_group_keys:
            group_busy[(gk, gene.day)].append((st_m, en_m))
        if not sess.is_lab and sess.duration_minutes < 95:
            lecture_section_day_used[(sec_key, gene.day)] += 1

    for sess in needs_relocation:
        comp_rooms = list(comp_map.get(sess.session_id) or rooms)
        sec_key = f"{sess.batch_id}::{sess.course_id}::{sess.section_code}"
        eligible_days = [d for d in time_config.working_days if not (d == "Fri" and not sess.friday_eligible)]
        enforces_unique_day = (not sess.is_lab) and sess.duration_minutes < 95 and sess.meetings_total <= max(1, len(eligible_days))

        # Two passes: pass 0 strictly forbids same-day duplicate lectures; pass 1 relaxes only if impossible
        placed = False
        for relax_dup in (False, True) if enforces_unique_day else (True,):
            days = list(eligible_days)
            rng.shuffle(days)
            for day in days:
                if not relax_dup and lecture_section_day_used[(sec_key, day)] > 0:
                    continue
                valid_slots = time_config.get_valid_start_slots_for_session(sess, day)
                rng.shuffle(valid_slots)
                for slot_idx in valid_slots:
                    win = time_config.compute_session_window(day, slot_idx, sess.duration_minutes, sess.is_lab)
                    if win is None:
                        continue
                    st_m, en_m, cov = win
                    if any(is_slot_blocked(u_inst.get(st_id, []), day, st_m, en_m, cov) for st_id in sess.staff_ids):
                        continue
                    if any(st_m < e and s < en_m for st_id in sess.staff_ids for s, e in staff_busy[(st_id, day)]):
                        continue
                    if any(st_m < e and s < en_m for gk in sess.student_group_keys for s, e in group_busy[(gk, day)]):
                        continue
                    for r in comp_rooms:
                        r_id = r["id"]
                        if is_slot_blocked(u_room.get(r_id, []), day, st_m, en_m, cov):
                            continue
                        if any(st_m < e and s < en_m for s, e in room_busy[(r_id, day)]):
                            continue
                        repaired.genes[sess.session_id] = SessionGene(
                            session_id=sess.session_id,
                            day=day,
                            slot_index=slot_idx,
                            room_id=r_id,
                            duration_slots=len(cov),
                            is_lab=sess.is_lab,
                            is_locked=False,
                            start_min=st_m,
                            end_min=en_m,
                            covered_slots=cov,
                        )
                        for st_id in sess.staff_ids:
                            staff_busy[(st_id, day)].append((st_m, en_m))
                        room_busy[(r_id, day)].append((st_m, en_m))
                        for gk in sess.student_group_keys:
                            group_busy[(gk, day)].append((st_m, en_m))
                        if not sess.is_lab and sess.duration_minutes < 95:
                            lecture_section_day_used[(sec_key, day)] += 1
                        placed = True
                        break
                    if placed:
                        break
                if placed:
                    break
            if placed:
                break

    return repaired


def crossover_chromosomes(
    parent_a: TimetableChromosome,
    parent_b: TimetableChromosome,
    sessions: List[ScheduleSession],
    rooms: List[Dict[str, Any]],
    time_config: TimeSlotConfig,
    rng: random.Random,
    unavail_inst: Optional[Dict[str, List[Any]]] = None,
    unavail_room: Optional[Dict[str, List[Any]]] = None,
    compatible_rooms_by_session: Optional[Dict[str, List[Dict[str, Any]]]] = None,
) -> TimetableChromosome:
    child = TimetableChromosome()
    for sess in sessions:
        sid = sess.session_id
        ga = parent_a.get_gene(sid)
        gb = parent_b.get_gene(sid)
        if ga and ga.is_locked:
            child.genes[sid] = SessionGene(**ga.__dict__)
        elif gb and gb.is_locked:
            child.genes[sid] = SessionGene(**gb.__dict__)
        else:
            chosen = ga if (rng.random() < 0.5 and ga) or not gb else gb
            if chosen:
                child.genes[sid] = SessionGene(**chosen.__dict__)
    return _repair_conflicts(
        child,
        sessions,
        rooms,
        time_config,
        rng,
        unavail_inst=unavail_inst,
        unavail_room=unavail_room,
        compatible_rooms_by_session=compatible_rooms_by_session,
    )


def mutate_chromosome(
    chromo: TimetableChromosome,
    sessions: List[ScheduleSession],
    rooms: List[Dict[str, Any]],
    time_config: TimeSlotConfig,
    rng: random.Random,
    mutation_rate: float = 0.25,
    unavail_inst: Optional[Dict[str, List[Any]]] = None,
    unavail_room: Optional[Dict[str, List[Any]]] = None,
    compatible_rooms_by_session: Optional[Dict[str, List[Dict[str, Any]]]] = None,
) -> TimetableChromosome:
    """Gap-aware mutation: tries to compact sparse/gapped student days without causing clashes or duplicate lecture days."""
    mutated = chromo.clone()
    u_inst = unavail_inst or {}
    u_room = unavail_room or {}
    comp_map = compatible_rooms_by_session or _build_compatible_rooms_map(sessions, rooms)

    unlocked = [s for s in sessions if not s.is_locked and s.session_id in mutated.genes]
    if not unlocked:
        return mutated

    group_day_genes: Dict[tuple, List[SessionGene]] = defaultdict(list)
    lecture_section_days: Dict[Tuple[str, str], Set[str]] = defaultdict(set)
    for s in sessions:
        g = mutated.genes.get(s.session_id)
        if g:
            for gk in s.student_group_keys:
                group_day_genes[(gk, g.day)].append(g)
            if not s.is_lab and s.duration_minutes < 95:
                sec_key = f"{s.batch_id}::{s.course_id}::{s.section_code}"
                lecture_section_days[(sec_key, g.day)].add(s.session_id)

    moves = max(1, int(len(unlocked) * mutation_rate))
    for sess in rng.sample(unlocked, min(len(unlocked), moves)):
        cur_gene = mutated.genes.get(sess.session_id)
        if not cur_gene:
            continue
        comp_rooms = comp_map.get(sess.session_id) or list(rooms)
        eligible_days = [d for d in time_config.working_days if not (d == "Fri" and not sess.friday_eligible)]
        if not eligible_days:
            continue

        sec_key = f"{sess.batch_id}::{sess.course_id}::{sess.section_code}"
        enforces_unique_day = (not sess.is_lab) and sess.duration_minutes < 95 and sess.meetings_total <= max(1, len(eligible_days))
        valid_days = [
            d
            for d in eligible_days
            if not enforces_unique_day
            or d == cur_gene.day
            or not (lecture_section_days[(sec_key, d)] - {sess.session_id})
        ]
        if not valid_days:
            valid_days = eligible_days

        attended_days = [d for d in valid_days if group_day_genes.get((sess.batch_id, d))]
        target_day = rng.choice(attended_days) if attended_days and rng.random() < 0.7 else rng.choice(valid_days)
        valid_slots = time_config.get_valid_start_slots_for_session(sess, target_day)
        if not valid_slots:
            continue

        # Filter out slots blocked by staff unavailability
        unblocked_slots: List[int] = []
        for sl_idx in valid_slots:
            win = time_config.compute_session_window(target_day, sl_idx, sess.duration_minutes, sess.is_lab)
            if win and not any(is_slot_blocked(u_inst.get(st_id, []), target_day, win[0], win[1], win[2]) for st_id in sess.staff_ids):
                unblocked_slots.append(sl_idx)
        if not unblocked_slots:
            continue

        existing_on_day = [
            g
            for gk in sess.student_group_keys
            for g in group_day_genes.get((gk, target_day), [])
            if g.session_id != sess.session_id
        ]
        best_slot = None
        if existing_on_day and rng.random() < 0.75:
            best_dist = 10**9
            for sl_idx in unblocked_slots:
                win = time_config.compute_session_window(target_day, sl_idx, sess.duration_minutes, sess.is_lab)
                if not win:
                    continue
                st_m, en_m, _ = win
                if any(st_m < g.end_min and g.start_min < en_m for g in existing_on_day):
                    continue
                dist = min(min(abs(st_m - g.end_min), abs(g.start_min - en_m)) for g in existing_on_day)
                if dist < best_dist:
                    best_dist = dist
                    best_slot = sl_idx
        if best_slot is None:
            best_slot = rng.choice(unblocked_slots)

        win = time_config.compute_session_window(target_day, best_slot, sess.duration_minutes, sess.is_lab)
        if not win:
            continue
        st_m, en_m, cov = win

        unblocked_rooms = [
            r for r in comp_rooms if not is_slot_blocked(u_room.get(r["id"], []), target_day, st_m, en_m, cov)
        ]
        if not unblocked_rooms:
            continue
        chosen_room = rng.choice(unblocked_rooms[: max(1, min(3, len(unblocked_rooms)))])["id"]

        old_day = cur_gene.day
        if not sess.is_lab and sess.duration_minutes < 95:
            lecture_section_days[(sec_key, old_day)].discard(sess.session_id)
            lecture_section_days[(sec_key, target_day)].add(sess.session_id)

        mutated.genes[sess.session_id] = SessionGene(
            session_id=sess.session_id,
            day=target_day,
            slot_index=best_slot,
            room_id=chosen_room,
            duration_slots=len(cov),
            is_lab=sess.is_lab,
            is_locked=False,
            start_min=st_m,
            end_min=en_m,
            covered_slots=cov,
        )

    return _repair_conflicts(
        mutated,
        sessions,
        rooms,
        time_config,
        rng,
        unavail_inst=u_inst,
        unavail_room=u_room,
        compatible_rooms_by_session=comp_map,
    )


def _construct_random_individual(
    sessions: List[ScheduleSession],
    rooms: List[Dict[str, Any]],
    time_config: TimeSlotConfig,
    rng: random.Random,
    unavail_inst: Dict[str, List[Any]],
    unavail_room: Dict[str, List[Any]],
    comp_map: Dict[str, List[Dict[str, Any]]],
) -> TimetableChromosome:
    """Create a randomized valid chromosome without DSatur ordering (for true unseeded GA baseline)."""
    chromo = TimetableChromosome()
    shuffled = list(sessions)
    rng.shuffle(shuffled)
    for sess in shuffled:
        if sess.is_locked and sess.pinned_slot:
            p_day, p_slot, p_room = sess.pinned_slot
            win = time_config.compute_session_window(p_day, p_slot, sess.duration_minutes, sess.is_lab)
            if win is not None:
                chromo.genes[sess.session_id] = SessionGene(
                    session_id=sess.session_id,
                    day=p_day,
                    slot_index=p_slot,
                    room_id=p_room,
                    duration_slots=len(win[2]),
                    is_lab=sess.is_lab,
                    is_locked=True,
                    start_min=win[0],
                    end_min=win[1],
                    covered_slots=win[2],
                )
                continue

        days = [d for d in time_config.working_days if not (d == "Fri" and not sess.friday_eligible)]
        if not days:
            continue
        day = rng.choice(days)
        valid_slots = time_config.get_valid_start_slots_for_session(sess, day)
        if not valid_slots:
            continue
        slot_idx = rng.choice(valid_slots)
        win = time_config.compute_session_window(day, slot_idx, sess.duration_minutes, sess.is_lab)
        if win is None:
            continue
        comp_rooms = comp_map.get(sess.session_id) or list(rooms)
        room_id = rng.choice(comp_rooms)["id"]
        chromo.genes[sess.session_id] = SessionGene(
            session_id=sess.session_id,
            day=day,
            slot_index=slot_idx,
            room_id=room_id,
            duration_slots=len(win[2]),
            is_lab=sess.is_lab,
            is_locked=False,
            start_min=win[0],
            end_min=win[1],
            covered_slots=win[2],
        )

    return _repair_conflicts(
        chromo,
        sessions,
        rooms,
        time_config,
        rng,
        unavail_inst=unavail_inst,
        unavail_room=u_room_val(unavail_room),
        compatible_rooms_by_session=comp_map,
    )


def u_room_val(unavail_room: Dict[str, List[Any]]) -> Dict[str, List[Any]]:
    return unavail_room


def run_genetic_algorithm(
    sessions: List[ScheduleSession],
    rooms: List[Dict[str, Any]],
    instructors: List[Dict[str, Any]],
    time_config: TimeSlotConfig,
    weights: Optional[Dict[str, float]] = None,
    student_preferences: Optional[List[Dict[str, Any]]] = None,
    instructor_preferences: Optional[List[Dict[str, Any]]] = None,
    unavailable_instructor_slots: Optional[Dict[str, List[str]]] = None,
    unavailable_room_slots: Optional[Dict[str, List[str]]] = None,
    initial_seed_chromo: Optional[TimetableChromosome] = None,
    seed_with_dsatur: bool = False,
    population_size: int = 12,
    generations: int = 12,
    seed: int = 42,
) -> Dict[str, Any]:
    rng = random.Random(seed)
    unavail_inst = normalize_unavailable_slots_map(unavailable_instructor_slots, instructors)
    unavail_room = normalize_unavailable_slots_map(unavailable_room_slots, None)
    comp_map = _build_compatible_rooms_map(sessions, rooms)

    population: List[TimetableChromosome] = []

    if initial_seed_chromo is not None:
        population.append(initial_seed_chromo.clone())

    use_dsatur_seeds = seed_with_dsatur or (initial_seed_chromo is not None)
    for i in range(population_size - len(population)):
        if use_dsatur_seeds:
            chromo = dsatur_construct_schedule(
                sessions=sessions,
                rooms=rooms,
                instructors=instructors,
                time_config=time_config,
                unavailable_instructor_slots=unavail_inst,
                unavailable_room_slots=unavail_room,
                student_preferences=student_preferences,
                weights=weights,
                seed=seed + i,
                randomize_ties=True,
            )
        else:
            chromo = _construct_random_individual(
                sessions=sessions,
                rooms=rooms,
                time_config=time_config,
                rng=rng,
                unavail_inst=unavail_inst,
                unavail_room=unavail_room,
                comp_map=comp_map,
            )
        population.append(chromo)

    for ind in population:
        evaluate_timetable_fitness(
            ind,
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

    population.sort(key=lambda c: (c.hard_violations, -c.fitness_score))
    best = population[0].clone()
    history: List[float] = [best.fitness_score]

    for _gen in range(generations):
        next_gen: List[TimetableChromosome] = [population[0].clone()]
        if len(population) > 1:
            next_gen.append(population[1].clone())

        while len(next_gen) < population_size:
            p1 = min(rng.sample(population, min(3, len(population))), key=lambda c: (c.hard_violations, -c.fitness_score))
            p2 = min(rng.sample(population, min(3, len(population))), key=lambda c: (c.hard_violations, -c.fitness_score))
            child = crossover_chromosomes(
                p1,
                p2,
                sessions,
                rooms,
                time_config,
                rng,
                unavail_inst=unavail_inst,
                unavail_room=unavail_room,
                compatible_rooms_by_session=comp_map,
            )
            if rng.random() < 0.65:
                child = mutate_chromosome(
                    child,
                    sessions,
                    rooms,
                    time_config,
                    rng,
                    mutation_rate=0.22,
                    unavail_inst=unavail_inst,
                    unavail_room=unavail_room,
                    compatible_rooms_by_session=comp_map,
                )
            evaluate_timetable_fitness(
                child,
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
            next_gen.append(child)

        population = sorted(next_gen, key=lambda c: (c.hard_violations, -c.fitness_score))
        if (population[0].hard_violations, -population[0].fitness_score) < (best.hard_violations, -best.fitness_score):
            best = population[0].clone()
        history.append(best.fitness_score)

    return {
        "chromosome": best,
        "convergence_history": history,
    }
