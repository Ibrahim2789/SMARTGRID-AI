"""
Adaptive Rescheduling via Tabu Search (tabu_search.py).
Repairs disruptions (instructor/lab-engineer unavailability, room/lab unavailability, Friday policy changes)
while minimizing perturbations to unaffected sessions and keeping admin staff bindings immutable.
"""

from __future__ import annotations

from collections import defaultdict, deque
from typing import Any, Deque, Dict, List, Optional, Set, Tuple

from .chromosome import SessionGene, TimetableChromosome
from .constraints import (
    ScheduleSession,
    TimeSlotConfig,
    get_compatible_rooms,
    normalize_rooms_input,
    parse_time_to_minutes,
)
from .fitness import (
    OptimizationWeights,
    evaluate_chromosome_fitness,
    is_slot_blocked,
    normalize_unavailable_slots_map,
)
from .validator import validate_timetable_assignments


def compute_stability_metrics(
    original_genes: Dict[str, Any],
    candidate_genes: Dict[str, Any],
) -> Tuple[int, int, float]:
    """Returns (changed_count, unchanged_count, stability_percentage)."""
    if not original_genes:
        return 0, 0, 100.0

    def _sig(val: Any) -> Tuple[str, str, str]:
        if isinstance(val, SessionGene):
            return (val.day, f"{val.slot_index}:{val.start_min}", val.room_id)
        if isinstance(val, tuple) and len(val) >= 3:
            return (str(val[0]), str(val[1]), str(val[2]))
        return ("", "", "")

    changed = 0
    unchanged = 0
    for sid, orig_val in original_genes.items():
        if _sig(candidate_genes.get(sid)) == _sig(orig_val):
            unchanged += 1
        else:
            changed += 1
    total = changed + unchanged
    pct = (unchanged / total) * 100.0 if total > 0 else 100.0
    return changed, unchanged, round(pct, 2)


def run_tabu_search_reschedule(
    original_genes: Dict[str, Tuple[str, str, str]],
    affected_session_ids: Set[str],
    sessions: List[ScheduleSession],
    rooms: List[Any],
    time_config: TimeSlotConfig,
    unavailable_instructor_slots: Optional[Any] = None,
    unavailable_room_slots: Optional[Any] = None,
    weights: Optional[OptimizationWeights] = None,
    instructors: Optional[List[Dict[str, Any]]] = None,
    max_iterations: int = 25,
    tabu_tenure: int = 7,
) -> TimetableChromosome:
    """Uses Tabu Search to repair `affected_session_ids` with minimal changes to `original_genes`."""
    norm_rooms = normalize_rooms_input(rooms)
    inst_list = instructors or []
    unavail_inst = normalize_unavailable_slots_map(unavailable_instructor_slots, inst_list)
    unavail_room = normalize_unavailable_slots_map(unavailable_room_slots, None)

    session_map = {s.session_id: s for s in sessions}
    days = list(time_config.working_days)
    default_slots = time_config.generate_daily_lecture_slots()

    # Pre-resolve slot index map and compatible rooms per session
    compat_rooms_map = {s.session_id: get_compatible_rooms(s, norm_rooms) for s in sessions}
    slot_idx_lookup: Dict[Tuple[str, str], int] = {
        (d, sl.start_time): sl.slot_index
        for d in days
        for sl in time_config.get_day_slots(d)
    }

    current = TimetableChromosome(genes=dict(original_genes))

    def score_candidate(chrom: TimetableChromosome) -> float:
        fb = evaluate_chromosome_fitness(
            chrom,
            sessions,
            norm_rooms,
            time_config,
            weights=weights,
            instructors=inst_list,
            unavailable_instructor_slots=unavail_inst,
            unavailable_room_slots=unavail_room,
        )
        _changed, _unchanged, stability_pct = compute_stability_metrics(original_genes, chrom.genes)
        return fb.total_score + 0.5 * stability_pct - (fb.hard_violation_count * 40.0)

    current_obj = score_candidate(current)
    best = current.clone()
    best_obj = current_obj

    tabu_queue: Deque[Tuple[str, str, str, str]] = deque(maxlen=tabu_tenure)

    for _it in range(max_iterations):
        val_report = validate_timetable_assignments(
            current.genes,
            sessions,
            norm_rooms,
            time_config,
            instructors=inst_list,
            unavailable_instructor_slots=unavail_inst,
            unavailable_room_slots=unavail_room,
        )
        if val_report.is_valid:
            best = current.clone()
            break

        violating_sids: Set[str] = set()
        for v in val_report.violations:
            for sid in v.session_ids:
                violating_sids.add(sid)
        if not violating_sids:
            violating_sids = set(affected_session_ids)
        if not violating_sids:
            break

        # Build fast interval occupancy lookup for current schedule
        staff_busy: Dict[Tuple[str, str], List[Tuple[str, int, int]]] = defaultdict(list)
        room_busy: Dict[Tuple[str, str], List[Tuple[str, int, int]]] = defaultdict(list)
        group_busy: Dict[Tuple[str, str], List[Tuple[str, int, int]]] = defaultdict(list)
        sec_day_used: Dict[Tuple[str, str], Set[str]] = defaultdict(set)

        for s in sessions:
            gene_tuple = current.genes.get(s.session_id)
            if not isinstance(gene_tuple, tuple) or len(gene_tuple) < 3:
                continue
            g_day, g_st, g_rm = str(gene_tuple[0]), str(gene_tuple[1]), str(gene_tuple[2])
            s_idx = slot_idx_lookup.get((g_day, g_st), 0)
            win = time_config.compute_session_window(g_day, s_idx, s.duration_minutes, s.is_lab)
            if win:
                st_m, en_m, _cov = win
            else:
                st_m = parse_time_to_minutes(g_st)
                en_m = st_m + s.duration_minutes
            for st_id in s.staff_ids:
                staff_busy[(st_id, g_day)].append((s.session_id, st_m, en_m))
            room_busy[(g_rm, g_day)].append((s.session_id, st_m, en_m))
            for gk in s.student_group_keys:
                group_busy[(gk, g_day)].append((s.session_id, st_m, en_m))
            if not s.is_lab and s.duration_minutes < 95:
                sec_day_used[(f"{s.batch_id}::{s.course_id}::{s.section_code}", g_day)].add(s.session_id)

        best_neighbor: Optional[TimetableChromosome] = None
        best_neighbor_obj = -1e9
        best_move_sig: Optional[Tuple[str, str, str, str]] = None

        # Prioritize directly affected sessions first
        ordered_violating = sorted(violating_sids, key=lambda x: (0 if x in affected_session_ids else 1, x))
        for sid in ordered_violating:
            sess = session_map.get(sid)
            if not sess or sess.is_locked:
                continue
            orig_gene = original_genes.get(sid, (days[0], default_slots[0] if default_slots else "09:00", norm_rooms[0]["id"] if norm_rooms else ""))
            orig_day, orig_slot, _orig_room = orig_gene
            compat_rooms = compat_rooms_map.get(sid) or []

            eligible_days = [d for d in days if not (d == "Fri" and not sess.friday_eligible)]
            sec_key = f"{sess.batch_id}::{sess.course_id}::{sess.section_code}"
            enforces_unique_day = (not sess.is_lab) and sess.duration_minutes < 95 and sess.meetings_total <= max(1, len(eligible_days))

            candidate_assignments: List[Tuple[str, str, str]] = []
            # 1) Same day & same time, alternate compatible room
            if orig_day in eligible_days:
                orig_valid_slots = time_config.get_valid_start_slots_for_session(sess, orig_day)
                orig_slot_times = [time_config.get_day_slots(orig_day)[i].start_time for i in orig_valid_slots]
                if orig_slot in orig_slot_times:
                    for r in compat_rooms:
                        candidate_assignments.append((orig_day, orig_slot, r.room_id))
                # 2) Same day, alternate valid time
                for st in orig_slot_times:
                    for r in compat_rooms[:2]:
                        candidate_assignments.append((orig_day, st, r.room_id))

            # 3) Other working days (prefer days without duplicate same-course lecture)
            for d in eligible_days:
                if d == orig_day:
                    continue
                if enforces_unique_day and (sec_day_used[(sec_key, d)] - {sid}):
                    continue
                d_valid_slots = time_config.get_valid_start_slots_for_session(sess, d)
                d_slot_times = [time_config.get_day_slots(d)[i].start_time for i in d_valid_slots]
                for st in d_slot_times:
                    for r in compat_rooms[:2]:
                        candidate_assignments.append((d, st, r.room_id))

            for cand_day, cand_slot, cand_room in candidate_assignments:
                if current.genes.get(sid) == (cand_day, cand_slot, cand_room):
                    continue
                move_sig = (sid, cand_day, cand_slot, cand_room)
                is_tabu = move_sig in tabu_queue

                # Fast exact feasibility pre-filter before expensive clone + full evaluation
                s_idx = slot_idx_lookup.get((cand_day, cand_slot), -1)
                if s_idx < 0:
                    continue
                win = time_config.compute_session_window(cand_day, s_idx, sess.duration_minutes, sess.is_lab)
                if win is None:
                    continue
                st_m, en_m, cov = win

                if any(is_slot_blocked(unavail_inst.get(st_id, []), cand_day, st_m, en_m, cov) for st_id in sess.staff_ids):
                    continue
                if is_slot_blocked(unavail_room.get(cand_room, []), cand_day, st_m, en_m, cov):
                    continue
                if any(osid != sid and st_m < ex_e and ex_s < en_m for st_id in sess.staff_ids for osid, ex_s, ex_e in staff_busy[(st_id, cand_day)]):
                    continue
                if any(osid != sid and st_m < ex_e and ex_s < en_m for gk in sess.student_group_keys for osid, ex_s, ex_e in group_busy[(gk, cand_day)]):
                    continue
                if any(osid != sid and st_m < ex_e and ex_s < en_m for osid, ex_s, ex_e in room_busy[(cand_room, cand_day)]):
                    continue

                neighbor = current.clone()
                neighbor.genes[sid] = (cand_day, cand_slot, cand_room)
                n_obj = score_candidate(neighbor)

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
        norm_rooms,
        time_config,
        weights=weights,
        instructors=inst_list,
        unavailable_instructor_slots=unavail_inst,
        unavailable_room_slots=unavail_room,
    )
    return best
