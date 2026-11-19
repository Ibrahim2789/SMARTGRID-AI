"""DSatur conflict-graph coloring constructive solver with student-gap compaction."""

from __future__ import annotations

import random
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

from .chromosome import SessionGene, TimetableChromosome
from .constraints import ScheduleSession, TimeSlotConfig, format_minutes_24h, normalize_rooms_input
from .fitness import is_slot_blocked, normalize_unavailable_slots_map


def _is_room_compatible(session: ScheduleSession, room: Dict[str, Any]) -> bool:
    if not room.get("is_available", room.get("isAvailable", True)):
        return False
    r_type = str(room.get("type") or room.get("room_type") or "lecture").lower()
    if session.is_lab and "lab" not in r_type:
        return False
    if session.is_lab is False and "lab" in r_type:
        return False
    cap = int(room.get("capacity") or 50)
    if session.expected_students > cap:
        return False
    if session.required_equipment:
        room_eq = {str(e).lower() for e in (room.get("equipment") or [])}
        req_eq = {str(e).lower() for e in session.required_equipment if e}
        if not req_eq.issubset(room_eq):
            return False
    return True


def _is_staff_blocked(
    session: ScheduleSession,
    day: str,
    start_min: int,
    end_min: int,
    covered_slots: List[int],
    unavail_inst: Dict[str, List[Any]],
) -> bool:
    for staff_id in session.staff_ids:
        if is_slot_blocked(unavail_inst.get(staff_id, []), day, start_min, end_min, covered_slots):
            return True
    return False


def _is_room_blocked(
    room_id: str,
    day: str,
    start_min: int,
    end_min: int,
    covered_slots: List[int],
    unavail_room: Dict[str, List[Any]],
) -> bool:
    return is_slot_blocked(unavail_room.get(room_id, []), day, start_min, end_min, covered_slots)


def build_conflict_graph(sessions: List[ScheduleSession]) -> Dict[str, Set[str]]:
    """Build adjacency matrix connecting sessions sharing student cohorts, instructor, or lab engineer."""
    graph: Dict[str, Set[str]] = {s.session_id: set() for s in sessions}
    n = len(sessions)
    for i in range(n):
        a = sessions[i]
        a_staff = set(a.staff_ids)
        a_groups = set(a.student_group_keys)
        for j in range(i + 1, n):
            b = sessions[j]
            if (a_staff & set(b.staff_ids)) or (a_groups & set(b.student_group_keys)):
                graph[a.session_id].add(b.session_id)
                graph[b.session_id].add(a.session_id)
    return graph


def _interval_overlaps_any(start_min: int, end_min: int, existing: List[Tuple[int, int]]) -> bool:
    for ex_s, ex_e in existing:
        if start_min < ex_e and ex_s < end_min:
            return True
    return False


def _student_slot_heuristic_score(
    session: ScheduleSession,
    day: str,
    start_min: int,
    end_min: int,
    time_config: TimeSlotConfig,
    group_day_windows: Dict[Tuple[str, str], List[Tuple[int, int]]],
    course_day_used: Dict[Tuple[str, str], int],
    group_days_active: Dict[str, Set[str]],
    student_prefs_by_batch: Dict[str, Dict[str, Any]],
    eligible_days_count: int,
    gap_weight: float = 1.0,
    pref_weight: float = 1.0,
    fair_urgency_mult: float = 1.0,
    window_pref_scale: float = 1.0,
) -> float:
    """Lower score is better: strongly favors compact contiguous daily blocks without student gaps or duplicate course days."""
    score = 0.0

    # 1. Strictly avoid scheduling multiple single-period lectures of the exact same course section on the same day
    sec_key = f"{session.batch_id}::{session.course_id}::{session.section_code}"
    same_course_count = course_day_used.get((sec_key, day), 0)
    if same_course_count > 0:
        if not session.is_lab and session.duration_minutes < 95 and session.meetings_total <= max(1, eligible_days_count):
            score += 180.0 * same_course_count
        else:
            score += 38.0 * same_course_count

    # 2. Student gap & day consolidation logic across all cohort keys (including shared electives)
    breaks = time_config.get_day_breaks(day)
    trans_break = time_config.friday_short_break if day == "Fri" else time_config.short_break_minutes
    eff_gap_weight = gap_weight

    for gk in session.student_group_keys:
        existing = group_day_windows.get((gk, day), [])
        if not existing:
            active_days = group_days_active.get(gk, set())
            if len(active_days) >= 3 and day not in active_days:
                score += 9.0 * eff_gap_weight
            else:
                score += 3.0 * eff_gap_weight
        else:
            min_dist = min(
                min(abs(start_min - ex_e), abs(ex_s - end_min))
                for ex_s, ex_e in existing
            )
            in_break_window = any(
                (ex_e <= b_s + 15 and start_min >= b_e - 15) or (end_min <= b_s + 15 and ex_s >= b_e - 15)
                for b_s, b_e in breaks
                for ex_s, ex_e in existing
            )
            if min_dist <= trans_break + 5:
                score -= 18.0 * eff_gap_weight
            elif in_break_window and min_dist <= 95:
                score -= 10.0 * eff_gap_weight
            else:
                score += min_dist * 0.45 * eff_gap_weight

            total_day_mins = sum(e - s for s, e in existing) + (end_min - start_min)
            if total_day_mins > 300:
                score += (total_day_mins - 300) * 0.15 * eff_gap_weight

    # 3. Student preference window bias (scaled by preferenceStrength and fairness urgency when present)
    pref = student_prefs_by_batch.get(session.batch_id) or {}
    if pref:
        raw_strength = pref.get("preferenceStrength", pref.get("preference_strength"))
        str_mult = 1.0 if raw_strength is None else max(0.0, float(raw_strength) / 0.65)
        cat_strengths = pref.get("categoryStrengths") or {}

        def _cm(c_key: str) -> float:
            if c_key in cat_strengths:
                return max(0.0, float(cat_strengths[c_key]) / 0.65)
            return str_mult

        pw = pref_weight * str_mult * fair_urgency_mult
        if pw > 0.0:
            if pref.get("avoid_early_8am", True) and start_min < 9 * 60:
                score += 8.0 * pw
            if pref.get("avoid_late_after_4pm", True) and end_min > 16 * 60 + 15:
                score += 9.0 * pw

            pref_lab_win = str(pref.get("preferred_lab_window") or pref.get("preferredLabWindow") or "").strip().lower()
            if session.is_lab and pref_lab_win:
                lab_pw = pref_weight * _cm("lab_timing_preferences") * fair_urgency_mult * window_pref_scale
                if pref_lab_win == "morning":
                    if start_min >= 12 * 60:
                        score += 18.0 * lab_pw
                    else:
                        score -= 10.0 * lab_pw
                elif pref_lab_win == "afternoon":
                    if start_min < 12 * 60:
                        score += 18.0 * lab_pw
                    else:
                        score -= 10.0 * lab_pw
            else:
                pref_win = str(pref.get("preferred_time_window") or "balanced")
                win_pw = pref_weight * _cm("preferred_lecture_timing") * fair_urgency_mult * window_pref_scale
                if pref_win == "morning":
                    if start_min >= 12 * 60 + 30:
                        score += 16.0 * win_pw
                    else:
                        score -= 8.0 * win_pw
                elif pref_win == "afternoon":
                    if start_min < 12 * 60:
                        score += 16.0 * win_pw
                    else:
                        score -= 8.0 * win_pw
                elif pref_win == "balanced":
                    if start_min < 9 * 60 or end_min > 15 * 60 + 30:
                        score += 4.0 * win_pw

            pref_free = str(pref.get("preferred_free_day") or "").strip()[:3].capitalize()
            if pref_free and day == pref_free:
                score += 24.0 * pref_weight * _cm("preferred_free_day") * fair_urgency_mult

    # Slight bias against late-day slots when ties occur
    score += (start_min - time_config.day_start_min) * 0.008
    return score


def dsatur_construct_schedule(
    sessions: List[ScheduleSession],
    rooms: List[Any],
    instructors: Optional[List[Dict[str, Any]]] = None,
    time_config: Optional[TimeSlotConfig] = None,
    unavailable_instructor_slots: Optional[Any] = None,
    unavailable_room_slots: Optional[Any] = None,
    student_preferences: Optional[List[Dict[str, Any]]] = None,
    weights: Optional[Dict[str, float]] = None,
    seed: Optional[int] = None,
    randomize_ties: bool = False,
) -> TimetableChromosome:
    """Construct an initial conflict-free, student-compact timetable using DSatur ordering."""
    rng = random.Random(seed)
    chromo = TimetableChromosome()
    time_config = time_config or TimeSlotConfig()
    rooms = normalize_rooms_input(rooms)

    unavail_inst = normalize_unavailable_slots_map(unavailable_instructor_slots, instructors)
    unavail_room = normalize_unavailable_slots_map(unavailable_room_slots, None)

    w = weights or {}
    gap_w = max(0.25, float(w.get("student_gap_minimization", 0.35)) / 0.35)
    pref_w = max(0.25, float(w.get("preferences", 0.15)) / 0.15)
    raw_fair = max(0.0, float(w.get("student_fairness", 0.25)))
    fair_w = raw_fair / 0.25

    prefs_by_batch: Dict[str, Dict[str, Any]] = {}
    for sp in student_preferences or []:
        b_id = str(sp.get("batch_id") or sp.get("batchId") or "")
        if b_id and b_id not in prefs_by_batch:
            prefs_by_batch[b_id] = sp

    graph = build_conflict_graph(sessions)
    sess_by_id = {s.session_id: s for s in sessions}
    session_order = {s.session_id: idx for idx, s in enumerate(sessions)}

    # Per-batch fairness tracking during constructive placement
    batch_total_sessions: Dict[str, int] = defaultdict(int)
    for s in sessions:
        if not (s.is_locked and s.pinned_slot):
            batch_total_sessions[s.batch_id] += 1
    batch_hardship: Dict[str, float] = defaultdict(float)
    batch_pref_granted: Dict[str, float] = defaultdict(float)

    def _estimate_placement_deltas(sess_obj: ScheduleSession, day: str, st_m: int, en_m: int) -> Tuple[float, float]:
        """Return (hardship_delta, pref_granted_delta) for placing sess_obj at (day, st_m, en_m)."""
        hardship = 0.0
        granted = 0.0
        pref = prefs_by_batch.get(sess_obj.batch_id) or {}
        if pref:
            pref_free = str(pref.get("preferred_free_day") or "").strip()[:3].capitalize()
            if pref_free and day == pref_free:
                hardship += 3.0
            if pref.get("avoid_early_8am", True) and st_m < 9 * 60:
                hardship += 1.0
            if pref.get("avoid_late_after_4pm", True) and en_m > 16 * 60 + 15:
                hardship += 1.5
            if sess_obj.is_lab:
                p_lw = str(pref.get("preferred_lab_window") or pref.get("preferredLabWindow") or "").strip().lower()
                if p_lw == "morning":
                    if st_m >= 12 * 60:
                        hardship += 2.0
                    else:
                        granted += 1.0
                elif p_lw == "afternoon":
                    if st_m < 12 * 60:
                        hardship += 2.0
                    else:
                        granted += 1.0
            else:
                p_w = str(pref.get("preferred_time_window") or "balanced")
                if p_w == "morning":
                    if st_m >= 12 * 60 + 30:
                        hardship += 1.5
                    else:
                        granted += 1.0
                elif p_w == "afternoon":
                    if st_m < 12 * 60:
                        hardship += 1.5
                    else:
                        granted += 1.0
        # Also penalize idle gaps created on same day for the cohort
        breaks = time_config.get_day_breaks(day)
        trans_b = time_config.friday_short_break if day == "Fri" else time_config.short_break_minutes
        existing = group_busy.get((sess_obj.batch_id, day), [])
        if existing:
            min_d = min(min(abs(st_m - ex_e), abs(ex_s - en_m)) for ex_s, ex_e in existing)
            in_b = any(
                (ex_e <= b_s + 15 and st_m >= b_e - 15) or (en_m <= b_s + 15 and ex_s >= b_e - 15)
                for b_s, b_e in breaks
                for ex_s, ex_e in existing
            )
            if min_d > trans_b + 5 and not (in_b and min_d <= 95):
                hardship += min(3.0, min_d / 60.0)
        return hardship, granted

    # Dynamic occupancy tables
    staff_busy: Dict[Tuple[str, str], List[Tuple[int, int]]] = defaultdict(list)
    room_busy: Dict[Tuple[str, str], List[Tuple[int, int]]] = defaultdict(list)
    group_busy: Dict[Tuple[str, str], List[Tuple[int, int]]] = defaultdict(list)
    course_day_used: Dict[Tuple[str, str], int] = defaultdict(int)
    group_days_active: Dict[str, Set[str]] = defaultdict(set)

    # 1. Place locked/pinned sessions first
    remaining_ids: Set[str] = set()
    for sess in sessions:
        if sess.is_locked and sess.pinned_slot:
            p_day, p_slot_idx, p_room_id = sess.pinned_slot
            if p_day in time_config.working_days and not (p_day == "Fri" and not sess.friday_eligible):
                win = time_config.compute_session_window(p_day, p_slot_idx, sess.duration_minutes, sess.is_lab)
                if win is not None:
                    st_m, en_m, cov = win
                    gene = SessionGene(
                        session_id=sess.session_id,
                        day=p_day,
                        slot_index=p_slot_idx,
                        room_id=p_room_id,
                        duration_slots=len(cov),
                        is_lab=sess.is_lab,
                        is_locked=True,
                        start_min=st_m,
                        end_min=en_m,
                        covered_slots=cov,
                    )
                    chromo.genes[sess.session_id] = gene
                    for staff_id in sess.staff_ids:
                        staff_busy[(staff_id, p_day)].append((st_m, en_m))
                    room_busy[(p_room_id, p_day)].append((st_m, en_m))
                    for gk in sess.student_group_keys:
                        group_busy[(gk, p_day)].append((st_m, en_m))
                        group_days_active[gk].add(p_day)
                    sec_key = f"{sess.batch_id}::{sess.course_id}::{sess.section_code}"
                    course_day_used[(sec_key, p_day)] += 1
                    continue
        remaining_ids.add(sess.session_id)

    # Pre-filter compatible rooms
    compatible_rooms_by_session: Dict[str, List[Dict[str, Any]]] = {}
    for sid in sorted(remaining_ids, key=lambda x: session_order[x]):
        sess = sess_by_id[sid]
        comp = [r for r in rooms if _is_room_compatible(sess, r)]
        if not comp:
            same_kind = [
                r for r in rooms
                if r.get("is_available", r.get("isAvailable", True))
                and (("lab" in str(r.get("type") or r.get("room_type") or "").lower()) == sess.is_lab)
            ]
            comp = same_kind or [r for r in rooms if r.get("is_available", r.get("isAvailable", True))] or list(rooms)
        comp.sort(key=lambda rm: (max(0, int(rm.get("capacity") or 50) - sess.expected_students), str(rm.get("code") or rm["id"])))
        compatible_rooms_by_session[sid] = comp

    saturation: Dict[str, int] = {sid: 0 for sid in remaining_ids}
    for sid in remaining_ids:
        for nb in graph[sid]:
            if nb in chromo.genes:
                saturation[sid] += 1

    # 2. DSatur iterative placement with deterministic tie-breaking and scarcity-moderated preference quotas
    # Count per-window lecture demand vs non-free-day room-slot supply so moderation only activates on genuine contention
    lec_rooms_cnt = max(1, sum(1 for r in rooms if r.get("is_available", r.get("isAvailable", True)) and "lab" not in str(r.get("type") or r.get("room_type") or "").lower()))
    morn_demand = sum(
        1 for sid in remaining_ids
        if not sess_by_id[sid].is_lab and (prefs_by_batch.get(sess_by_id[sid].batch_id) or {}).get("preferred_time_window") == "morning"
    )
    aft_demand = sum(
        1 for sid in remaining_ids
        if not sess_by_id[sid].is_lab and (prefs_by_batch.get(sess_by_id[sid].batch_id) or {}).get("preferred_time_window") == "afternoon"
    )
    morn_slots_avail = lec_rooms_cnt * sum(
        sum(1 for sl in time_config.get_day_slots(d) if sl.start_min < 12 * 60 + 30)
        for d in time_config.working_days
    )
    aft_slots_avail = lec_rooms_cnt * sum(
        sum(1 for sl in time_config.get_day_slots(d) if sl.start_min >= 12 * 60 + 30)
        for d in time_config.working_days
    )
    morn_contested = morn_demand > int(morn_slots_avail * 0.85)
    aft_contested = aft_demand > int(aft_slots_avail * 0.85)

    while remaining_ids:
        remaining_batches = {sess_by_id[s].batch_id for s in remaining_ids}
        min_batch_hardship = min((batch_hardship[b] for b in remaining_batches), default=0.0)

        next_sid = max(
            remaining_ids,
            key=lambda sid: (
                saturation[sid],
                1 if sess_by_id[sid].is_lab else 0,
                sess_by_id[sid].duration_minutes,
                len(graph[sid]),
                -len(compatible_rooms_by_session[sid]),
                -session_order[sid],
            ),
        )
        sess = sess_by_id[next_sid]
        remaining_ids.remove(next_sid)

        excess_hardship = max(0.0, batch_hardship[sess.batch_id] - min_batch_hardship)
        fair_urgency_mult = 1.0 + (0.20 * min(1.5, raw_fair) * min(2.0, excess_hardship) if raw_fair > 0.0 else 0.0)
        tot_b = max(1, batch_total_sessions[sess.batch_id])
        my_pref_ratio = batch_pref_granted[sess.batch_id] / tot_b
        peer_min_ratio = min(
            (batch_pref_granted[b] / max(1, batch_total_sessions[b]) for b in remaining_batches if b != sess.batch_id),
            default=my_pref_ratio,
        )
        b_pref_win = (prefs_by_batch.get(sess.batch_id) or {}).get("preferred_time_window")
        sess_contested = (b_pref_win == "morning" and morn_contested) or (b_pref_win == "afternoon" and aft_contested)
        if raw_fair > 0.0 and sess_contested and my_pref_ratio >= 0.50 and my_pref_ratio > peer_min_ratio + 0.10:
            # Attenuate excess scarce window claims smoothly as student_fairness rises without disabling preference/compactness
            window_pref_scale = max(0.35, 1.0 - min(1.0, raw_fair) * (0.40 + 0.50 * (my_pref_ratio - peer_min_ratio)))
        else:
            window_pref_scale = 1.0

        candidate_rooms = list(compatible_rooms_by_session[next_sid])
        if randomize_ties:
            rng.shuffle(candidate_rooms)

        eligible_days_list = [d for d in time_config.working_days if not (d == "Fri" and not sess.friday_eligible)]
        eligible_days_count = len(eligible_days_list)
        best_choice: Optional[Tuple[float, str, int, str, int, int, List[int]]] = None

        for day in eligible_days_list:
            valid_slots = time_config.get_valid_start_slots_for_session(sess, day)
            if not valid_slots:
                continue

            for slot_idx in valid_slots:
                win = time_config.compute_session_window(day, slot_idx, sess.duration_minutes, sess.is_lab)
                if win is None:
                    continue
                st_m, en_m, cov = win

                # Check staff clashes & unavailability
                if any(_interval_overlaps_any(st_m, en_m, staff_busy[(st_id, day)]) for st_id in sess.staff_ids):
                    continue
                if _is_staff_blocked(sess, day, st_m, en_m, cov, unavail_inst):
                    continue

                # Check student cohort clashes
                if any(_interval_overlaps_any(st_m, en_m, group_busy[(gk, day)]) for gk in sess.student_group_keys):
                    continue

                # Compute slot-level heuristic ONCE outside the room loop
                slot_h = _student_slot_heuristic_score(
                    sess,
                    day,
                    st_m,
                    en_m,
                    time_config,
                    group_busy,
                    course_day_used,
                    group_days_active,
                    prefs_by_batch,
                    eligible_days_count,
                    gap_weight=gap_w,
                    pref_weight=pref_w,
                    fair_urgency_mult=fair_urgency_mult,
                    window_pref_scale=window_pref_scale,
                )

                # Pick tightest available compatible room
                for room in candidate_rooms:
                    r_id = room["id"]
                    if _interval_overlaps_any(st_m, en_m, room_busy[(r_id, day)]):
                        continue
                    if _is_room_blocked(r_id, day, st_m, en_m, cov, unavail_room):
                        continue

                    cap = int(room.get("capacity") or 50)
                    h_score = slot_h + max(0, cap - sess.expected_students) * 0.04
                    if randomize_ties:
                        h_score += rng.uniform(0.0, 1.5)

                    if best_choice is None or h_score < best_choice[0]:
                        best_choice = (h_score, day, slot_idx, r_id, st_m, en_m, cov)
                    if not randomize_ties:
                        # candidate_rooms is sorted tightest-fit first, so first free room is optimal for this slot
                        break

        if best_choice is not None:
            _, b_day, b_slot, b_room, st_m, en_m, cov = best_choice
            h_delta, g_delta = _estimate_placement_deltas(sess, b_day, st_m, en_m)
            batch_hardship[sess.batch_id] += h_delta
            batch_pref_granted[sess.batch_id] += g_delta

            gene = SessionGene(
                session_id=next_sid,
                day=b_day,
                slot_index=b_slot,
                room_id=b_room,
                duration_slots=len(cov),
                is_lab=sess.is_lab,
                is_locked=False,
                start_min=st_m,
                end_min=en_m,
                covered_slots=cov,
            )
            chromo.genes[next_sid] = gene
            for staff_id in sess.staff_ids:
                staff_busy[(staff_id, b_day)].append((st_m, en_m))
            room_busy[(b_room, b_day)].append((st_m, en_m))
            for gk in sess.student_group_keys:
                group_busy[(gk, b_day)].append((st_m, en_m))
                group_days_active[gk].add(b_day)
            sec_key = f"{sess.batch_id}::{sess.course_id}::{sess.section_code}"
            course_day_used[(sec_key, b_day)] += 1

        for nb in graph[next_sid]:
            if nb in remaining_ids:
                saturation[nb] += 1

    return chromo


def run_dsatur_initial_schedule(
    sessions: List[ScheduleSession],
    rooms: List[Any],
    time_config: Optional[TimeSlotConfig] = None,
    instructors: Optional[List[Dict[str, Any]]] = None,
    unavailable_instructor_slots: Optional[Any] = None,
    unavailable_room_slots: Optional[Any] = None,
    student_preferences: Optional[List[Dict[str, Any]]] = None,
    weights: Optional[Dict[str, float]] = None,
    seed: Optional[int] = 42,
) -> Dict[str, Tuple[str, str, str]]:
    """Compatibility wrapper returning session_id -> (day, HH:MM start_time, room_id)."""
    cfg = time_config or TimeSlotConfig()
    chromo = dsatur_construct_schedule(
        sessions=sessions,
        rooms=rooms,
        instructors=instructors,
        time_config=cfg,
        unavailable_instructor_slots=unavailable_instructor_slots,
        unavailable_room_slots=unavailable_room_slots,
        student_preferences=student_preferences,
        weights=weights,
        seed=seed,
        randomize_ties=False,
    )
    out: Dict[str, Tuple[str, str, str]] = {}
    for sid, gene in chromo.genes.items():
        out[sid] = (gene.day, format_minutes_24h(gene.start_min), gene.room_id)
    return out

