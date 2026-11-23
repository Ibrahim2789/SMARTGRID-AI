"""Genetic Algorithm optimizer with student gap-closing mutations and conflict repair."""

from __future__ import annotations

import random
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

from .chromosome import SessionGene, TimetableChromosome
from .constraints import ScheduleSession, TimeSlotConfig
from .fitness import (
    evaluate_timetable_fitness,
    is_slot_blocked,
    normalize_unavailable_slots_map,
    preparse_unavailable_map,
)
from .graph_coloring import _is_room_compatible, build_conflict_graph, dsatur_construct_schedule


def _build_compatible_rooms_map(
    sessions: List[ScheduleSession],
    rooms: List[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    comp_map: Dict[str, List[Dict[str, Any]]] = {}
    for sess in sessions:
        comp = [r for r in rooms if _is_room_compatible(sess, r)]
        if not comp:
            if sess.is_lab and sess.assigned_lab_id:
                comp = [r for r in rooms if r.get("id") == sess.assigned_lab_id]
            else:
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


def _slot_pref_penalty(
    sess: ScheduleSession,
    day: str,
    st_m: int,
    en_m: int,
    prefs_by_batch: Dict[str, Dict[str, Any]],
) -> float:
    pref = prefs_by_batch.get(sess.batch_id)
    if not pref:
        return 0.0
    raw_strength = pref.get("preferenceStrength", pref.get("preference_strength"))
    str_mult = 1.0 if raw_strength is None else max(0.0, float(raw_strength) / 0.65)
    if str_mult <= 0.0:
        return 0.0
    cat_strengths = pref.get("categoryStrengths") or {}

    def _cm(k: str) -> float:
        return max(0.0, float(cat_strengths[k]) / 0.65) if k in cat_strengths else str_mult

    pen = 0.0
    if pref.get("avoid_early_8am", True) and st_m < 9 * 60:
        pen += 1.5 * str_mult
    if pref.get("avoid_late_after_4pm", True) and en_m > 16 * 60 + 15:
        pen += 2.2 * str_mult
    pref_free = str(pref.get("preferred_free_day") or "").strip()[:3].capitalize()
    if pref_free and day == pref_free:
        pen += 4.5 * _cm("preferred_free_day")
    if sess.is_lab:
        p_lw = str(pref.get("preferred_lab_window") or pref.get("preferredLabWindow") or "").strip().lower()
        if p_lw == "morning" and st_m >= 12 * 60:
            pen += 3.0 * _cm("lab_timing_preferences")
        elif p_lw == "afternoon" and st_m < 12 * 60:
            pen += 3.0 * _cm("lab_timing_preferences")
    else:
        p_w = str(pref.get("preferred_time_window") or "balanced")
        if p_w == "morning" and st_m >= 12 * 60 + 30:
            pen += 2.4 * _cm("preferred_lecture_timing")
        elif p_w == "afternoon" and st_m < 12 * 60:
            pen += 2.4 * _cm("preferred_lecture_timing")
    return pen


def _estimate_batch_penalties(
    chromo: TimetableChromosome,
    sessions: List[ScheduleSession],
    time_config: TimeSlotConfig,
    student_preferences: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[Dict[str, float], Dict[str, float]]:
    """Lightweight per-batch and per-session penalty proxy for fairness search operators."""
    prefs_by_batch: Dict[str, Dict[str, Any]] = {}
    for sp in student_preferences or []:
        bid = str(sp.get("batch_id") or sp.get("batchId") or "")
        if bid and bid not in prefs_by_batch:
            prefs_by_batch[bid] = sp

    batch_pen: Dict[str, float] = defaultdict(float)
    sess_pen: Dict[str, float] = defaultdict(float)
    day_items: Dict[Tuple[str, str], List[Tuple[int, int, str]]] = defaultdict(list)

    for sess in sessions:
        g = chromo.genes.get(sess.session_id)
        if not g:
            continue
        p = _slot_pref_penalty(sess, g.day, g.start_min, g.end_min, prefs_by_batch)
        sess_pen[sess.session_id] += p
        batch_pen[sess.batch_id] += p
        for gk in sess.student_group_keys:
            day_items[(gk, g.day)].append((g.start_min, g.end_min, sess.session_id))

    # Add idle gap proxy per batch-day
    for (gk, day), items in day_items.items():
        if len(items) <= 1:
            continue
        items.sort(key=lambda x: x[0])
        breaks = time_config.get_day_breaks(day)
        trans_b = time_config.friday_short_break if day == "Fri" else time_config.short_break_minutes
        for idx in range(1, len(items)):
            prev_e = items[idx - 1][1]
            curr_s, _, sid = items[idx]
            if curr_s <= prev_e:
                continue
            ov = sum(max(0, min(curr_s, be) - max(prev_e, bs)) for bs, be in breaks)
            idle = max(0, (curr_s - prev_e - ov) - trans_b)
            if idle > 5:
                gap_p = idle * 0.08
                batch_pen[gk] += gap_p
                sess_pen[sid] += gap_p * 0.5
                sess_pen[items[idx - 1][2]] += gap_p * 0.5

    return dict(batch_pen), dict(sess_pen)


def propose_fairness_swap_or_relocation(
    chromo: TimetableChromosome,
    sessions: List[ScheduleSession],
    rooms: List[Dict[str, Any]],
    time_config: TimeSlotConfig,
    rng: random.Random,
    unavail_inst: Optional[Dict[str, List[Any]]] = None,
    unavail_room: Optional[Dict[str, List[Any]]] = None,
    comp_map: Optional[Dict[str, List[Dict[str, Any]]]] = None,
    student_preferences: Optional[List[Dict[str, Any]]] = None,
) -> Optional[TimetableChromosome]:
    """
    Propose a strictly conflict-free slot swap (between a disadvantaged batch and a lower-penalty batch)
    or a valid preference/gap-improving relocation for a disadvantaged batch without changing assigned staff.
    """
    u_inst = unavail_inst or {}
    u_room = unavail_room or {}
    room_map = comp_map or _build_compatible_rooms_map(sessions, rooms)
    room_by_id = {r["id"]: r for r in rooms if r.get("id")}

    batch_pen, sess_pen = _estimate_batch_penalties(chromo, sessions, time_config, student_preferences)
    if len(batch_pen) < 2:
        return None
    min_b_pen = min(batch_pen.values())
    max_b_pen = max(batch_pen.values())
    if max_b_pen - min_b_pen <= 0.25:
        return None

    prefs_by_batch: Dict[str, Dict[str, Any]] = {}
    for sp in student_preferences or []:
        bid = str(sp.get("batch_id") or sp.get("batchId") or "")
        if bid and bid not in prefs_by_batch:
            prefs_by_batch[bid] = sp

    unlocked = [s for s in sessions if not s.is_locked and s.session_id in chromo.genes]
    if len(unlocked) < 2:
        return None

    # Sort batches descending by hardship; try worst-off batches
    ranked_batches = sorted(batch_pen.keys(), key=lambda b: batch_pen[b], reverse=True)
    worst_pool = ranked_batches[: max(1, min(2, len(ranked_batches) - 1))]
    target_batch = worst_pool[0] if rng.random() < 0.80 else rng.choice(worst_pool)

    bad_candidates = [
        s for s in unlocked
        if s.batch_id == target_batch and sess_pen.get(s.session_id, 0.0) > 0.0
    ]
    if not bad_candidates:
        bad_candidates = [s for s in unlocked if s.batch_id == target_batch]
    if not bad_candidates:
        return None

    bad_candidates.sort(key=lambda s: sess_pen.get(s.session_id, 0.0), reverse=True)
    head_pool = list(bad_candidates[: min(6, len(bad_candidates))])
    rng.shuffle(head_pool)
    tail_pool = list(bad_candidates[min(6, len(bad_candidates)):])
    ordered_bad = head_pool + tail_pool

    # Build fast occupancy tables excluding nothing first (we filter sid explicitly)
    staff_occ: Dict[Tuple[str, str], List[Tuple[str, int, int]]] = defaultdict(list)
    group_occ: Dict[Tuple[str, str], List[Tuple[str, int, int]]] = defaultdict(list)
    room_occ: Dict[Tuple[str, str], List[Tuple[str, int, int]]] = defaultdict(list)
    lecture_days: Dict[Tuple[str, str], Set[str]] = defaultdict(set)

    for s in sessions:
        g = chromo.genes.get(s.session_id)
        if not g:
            continue
        for st_id in s.staff_ids:
            staff_occ[(st_id, g.day)].append((s.session_id, g.start_min, g.end_min))
        for gk in s.student_group_keys:
            group_occ[(gk, g.day)].append((s.session_id, g.start_min, g.end_min))
        room_occ[(g.room_id, g.day)].append((s.session_id, g.start_min, g.end_min))
        if not s.is_lab and s.duration_minutes < 95:
            sec_key = f"{s.batch_id}::{s.course_id}::{s.section_code}"
            lecture_days[(sec_key, g.day)].add(s.session_id)

    def _can_place(
        sess_obj: ScheduleSession,
        day: str,
        slot_idx: int,
        pref_room_id: str,
        exclude_ids: Set[str],
        override_other_gene: Optional[Tuple[ScheduleSession, str, int, int]] = None,
    ) -> Optional[Tuple[str, int, int, List[int]]]:
        if day == "Fri" and not sess_obj.friday_eligible:
            return None
        win = time_config.compute_session_window(day, slot_idx, sess_obj.duration_minutes, sess_obj.is_lab)
        if win is None:
            return None
        st_m, en_m, cov = win

        eligible_days = [d for d in time_config.working_days if not (d == "Fri" and not sess_obj.friday_eligible)]
        if not sess_obj.is_lab and sess_obj.duration_minutes < 95 and sess_obj.meetings_total <= max(1, len(eligible_days)):
            sec_key = f"{sess_obj.batch_id}::{sess_obj.course_id}::{sess_obj.section_code}"
            if lecture_days[(sec_key, day)] - exclude_ids:
                return None

        if any(is_slot_blocked(u_inst.get(st_id, []), day, st_m, en_m, cov) for st_id in sess_obj.staff_ids):
            return None
        if any(
            oid not in exclude_ids and st_m < oe and os < en_m
            for st_id in sess_obj.staff_ids
            for oid, os, oe in staff_occ[(st_id, day)]
        ):
            return None
        if any(
            oid not in exclude_ids and st_m < oe and os < en_m
            for gk in sess_obj.student_group_keys
            for oid, os, oe in group_occ[(gk, day)]
        ):
            return None

        if override_other_gene is not None:
            o_sess, o_day, o_sm, o_em = override_other_gene
            if o_day == day and st_m < o_em and o_sm < en_m:
                if (set(sess_obj.staff_ids) & set(o_sess.staff_ids)) or (
                    set(sess_obj.student_group_keys) & set(o_sess.student_group_keys)
                ):
                    return None

        # Prefer pref_room_id if valid & free, else any compatible free room
        candidate_rms = []
        pr = room_by_id.get(pref_room_id)
        if pr and _is_room_compatible(sess_obj, pr):
            candidate_rms.append(pr)
        for r in room_map.get(sess_obj.session_id) or rooms:
            if r["id"] != pref_room_id:
                candidate_rms.append(r)

        for r in candidate_rms:
            rid = r["id"]
            if is_slot_blocked(u_room.get(rid, []), day, st_m, en_m, cov):
                continue
            if any(oid not in exclude_ids and st_m < oe and os < en_m for oid, os, oe in room_occ[(rid, day)]):
                continue
            return (rid, st_m, en_m, cov)
        return None

    def _creates_gap_when_removed(batch_id: str, day: str, excl_id: str, rem_st: int, rem_en: int) -> float:
        rem_wins = sorted((os, oe) for oid, os, oe in group_occ[(batch_id, day)] if oid != excl_id)
        if len(rem_wins) < 2:
            return 0.0
        breaks = time_config.get_day_breaks(day)
        trans_b = time_config.friday_short_break if day == "Fri" else time_config.short_break_minutes
        pen = 0.0
        for idx in range(1, len(rem_wins)):
            pe, cs = rem_wins[idx - 1][1], rem_wins[idx][0]
            if pe < rem_st and rem_en < cs:
                ov = sum(max(0, min(cs, be) - max(pe, bs)) for bs, be in breaks)
                idle = max(0, (cs - pe - ov) - trans_b)
                if idle > 5:
                    pen += 12.0 + idle * 0.25
        return pen

    def _creates_gap_when_added(batch_id: str, day: str, excl_ids: Set[str], add_st: int, add_en: int) -> float:
        day_wins = sorted((os, oe) for oid, os, oe in group_occ[(batch_id, day)] if oid not in excl_ids)
        if not day_wins:
            return 0.0
        breaks = time_config.get_day_breaks(day)
        trans_b = time_config.friday_short_break if day == "Fri" else time_config.short_break_minutes
        best_gap = 10**9
        for os, oe in day_wins:
            if add_en <= os:
                ov = sum(max(0, min(os, be) - max(add_en, bs)) for bs, be in breaks)
                g = max(0, (os - add_en - ov) - trans_b)
            elif oe <= add_st:
                ov = sum(max(0, min(add_st, be) - max(oe, bs)) for bs, be in breaks)
                g = max(0, (add_st - oe - ov) - trans_b)
            else:
                g = 0
            if g < best_gap:
                best_gap = g
        return (10.0 + best_gap * 0.22) if best_gap > 5 else 0.0

    def _best_move_for_bad(s_bad: ScheduleSession) -> Optional[Tuple[float, TimetableChromosome]]:
        g_bad = chromo.genes[s_bad.session_id]
        old_bad_pen = _slot_pref_penalty(s_bad, g_bad.day, g_bad.start_min, g_bad.end_min, prefs_by_batch)

        # Phase 1: Check cross-batch swap with a lower-hardship batch session s_good
        good_candidates = [
            s for s in unlocked
            if s.session_id != s_bad.session_id
            and batch_pen.get(s.batch_id, 0.0) < batch_pen.get(target_batch, 0.0) - 0.1
            and s.is_lab == s_bad.is_lab
            and s.duration_minutes == s_bad.duration_minutes
        ]
        if len(good_candidates) > 80:
            good_candidates = rng.sample(good_candidates, 80)
        best_swap: Optional[Tuple[float, ScheduleSession, Tuple[str, int, int, List[int]], Tuple[str, int, int, List[int]]]] = None
        if good_candidates:
            scored_goods: List[Tuple[float, ScheduleSession]] = []
            for sg in good_candidates:
                gg = chromo.genes[sg.session_id]
                new_bad_pen = _slot_pref_penalty(s_bad, gg.day, gg.start_min, gg.end_min, prefs_by_batch)
                improvement = old_bad_pen - new_bad_pen
                if improvement > 0.1:
                    split_pen = _creates_gap_when_removed(sg.batch_id, gg.day, sg.session_id, gg.start_min, gg.end_min)
                    scored_goods.append((improvement - 0.8 * split_pen + rng.uniform(0.0, 0.5), sg))
            scored_goods.sort(key=lambda x: x[0], reverse=True)
            probe_pool = [sg for _, sg in scored_goods[:24]]

            for s_good in probe_pool:
                g_good = chromo.genes[s_good.session_id]
                excl = {s_bad.session_id, s_good.session_id}
                res_bad = _can_place(
                    s_bad, g_good.day, g_good.slot_index, g_good.room_id, excl,
                    override_other_gene=(s_good, g_bad.day, g_bad.start_min, g_bad.end_min),
                )
                if res_bad is None:
                    continue
                res_good = _can_place(
                    s_good, g_bad.day, g_bad.slot_index, g_bad.room_id, excl,
                    override_other_gene=(s_bad, g_good.day, g_good.start_min, g_good.end_min),
                )
                if res_good is None:
                    continue
                if g_good.day == g_bad.day and res_bad[0] == res_good[0] and res_bad[1] < res_good[2] and res_good[1] < res_bad[2]:
                    continue

                new_bad_p = _slot_pref_penalty(s_bad, g_good.day, res_bad[1], res_bad[2], prefs_by_batch)
                old_good_p = _slot_pref_penalty(s_good, g_good.day, g_good.start_min, g_good.end_min, prefs_by_batch)
                new_good_p = _slot_pref_penalty(s_good, g_bad.day, res_good[1], res_good[2], prefs_by_batch)

                gap_cost = (
                    _creates_gap_when_removed(s_good.batch_id, g_good.day, s_good.session_id, g_good.start_min, g_good.end_min)
                    + _creates_gap_when_removed(s_bad.batch_id, g_bad.day, s_bad.session_id, g_bad.start_min, g_bad.end_min)
                    + _creates_gap_when_added(s_bad.batch_id, g_good.day, excl, res_bad[1], res_bad[2])
                    + _creates_gap_when_added(s_good.batch_id, g_bad.day, excl, res_good[1], res_good[2])
                )

                gain = (old_bad_pen - new_bad_p) - 0.30 * max(0.0, new_good_p - old_good_p) - gap_cost + rng.uniform(0.0, 0.25)
                if best_swap is None or gain > best_swap[0]:
                    best_swap = (gain, s_good, res_bad, res_good)

        # Phase 2: Try valid free-slot relocation for s_bad
        eligible_days = [d for d in time_config.working_days if not (d == "Fri" and not s_bad.friday_eligible)]
        best_reloc: Optional[Tuple[float, str, int, Tuple[str, int, int, List[int]]]] = None
        for d in eligible_days:
            for sl in time_config.get_valid_start_slots_for_session(s_bad, d):
                if d == g_bad.day and sl == g_bad.slot_index:
                    continue
                placed = _can_place(s_bad, d, sl, g_bad.room_id, {s_bad.session_id})
                if placed is None:
                    continue
                new_p = _slot_pref_penalty(s_bad, d, placed[1], placed[2], prefs_by_batch)
                gap_cost = (
                    _creates_gap_when_removed(s_bad.batch_id, g_bad.day, s_bad.session_id, g_bad.start_min, g_bad.end_min)
                    + _creates_gap_when_added(s_bad.batch_id, d, {s_bad.session_id}, placed[1], placed[2])
                )
                gain = (old_bad_pen - new_p) - gap_cost + rng.uniform(0.0, 0.15)
                if gain > 0.1 and (best_reloc is None or gain > best_reloc[0]):
                    best_reloc = (gain, d, sl, placed)

        swap_gain = best_swap[0] if (best_swap is not None and best_swap[0] > -0.5) else -10**9
        reloc_gain = best_reloc[0] if best_reloc is not None else -10**9
        if swap_gain >= reloc_gain and swap_gain > -0.5 and best_swap is not None:
            _, s_good, res_bad, res_good = best_swap
            g_good = chromo.genes[s_good.session_id]
            out = chromo.clone()
            out.genes[s_bad.session_id] = SessionGene(
                session_id=s_bad.session_id,
                day=g_good.day,
                slot_index=g_good.slot_index,
                room_id=res_bad[0],
                duration_slots=len(res_bad[3]),
                is_lab=s_bad.is_lab,
                is_locked=False,
                start_min=res_bad[1],
                end_min=res_bad[2],
                covered_slots=res_bad[3],
            )
            out.genes[s_good.session_id] = SessionGene(
                session_id=s_good.session_id,
                day=g_bad.day,
                slot_index=g_bad.slot_index,
                room_id=res_good[0],
                duration_slots=len(res_good[3]),
                is_lab=s_good.is_lab,
                is_locked=False,
                start_min=res_good[1],
                end_min=res_good[2],
                covered_slots=res_good[3],
            )
            return (swap_gain, out)

        if best_reloc is not None:
            _, d, sl, placed = best_reloc
            out = chromo.clone()
            out.genes[s_bad.session_id] = SessionGene(
                session_id=s_bad.session_id,
                day=d,
                slot_index=sl,
                room_id=placed[0],
                duration_slots=len(placed[3]),
                is_lab=s_bad.is_lab,
                is_locked=False,
                start_min=placed[1],
                end_min=placed[2],
                covered_slots=placed[3],
            )
            return (reloc_gain, out)
        return None

    best_overall: Optional[Tuple[float, TimetableChromosome]] = None
    for cand_bad in ordered_bad[:6]:
        res = _best_move_for_bad(cand_bad)
        if res is not None and (best_overall is None or res[0] > best_overall[0]):
            best_overall = res
            if res[0] >= 2.0:
                break
    return best_overall[1] if best_overall is not None else None


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
    weights: Optional[Dict[str, float]] = None,
    student_preferences: Optional[List[Dict[str, Any]]] = None,
) -> TimetableChromosome:
    """Gap- and fairness-aware mutation: performs disadvantaged-batch swaps/relocations when student_fairness > 0 plus compact block moves."""
    mutated = chromo.clone()
    u_inst = unavail_inst or {}
    u_room = unavail_room or {}
    comp_map = compatible_rooms_by_session or _build_compatible_rooms_map(sessions, rooms)

    fair_w = max(0.0, float((weights or {}).get("student_fairness", 0.25)))
    if fair_w > 0.05 and rng.random() < min(0.80, 0.20 + fair_w * 0.60):
        swapped = propose_fairness_swap_or_relocation(
            mutated,
            sessions,
            rooms,
            time_config,
            rng,
            unavail_inst=u_inst,
            unavail_room=u_room,
            comp_map=comp_map,
            student_preferences=student_preferences,
        )
        if swapped is not None:
            return swapped

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
    deadline: Optional[float] = None,
) -> Dict[str, Any]:
    rng = random.Random(seed)
    unavail_inst = normalize_unavailable_slots_map(unavailable_instructor_slots, instructors)
    unavail_room = normalize_unavailable_slots_map(unavailable_room_slots, None)
    parsed_u_inst = preparse_unavailable_map(unavail_inst)
    parsed_u_room = preparse_unavailable_map(unavail_room)
    comp_map = _build_compatible_rooms_map(sessions, rooms)

    population: List[TimetableChromosome] = []

    if initial_seed_chromo is not None:
        population.append(initial_seed_chromo.clone())

    use_dsatur_seeds = seed_with_dsatur or (initial_seed_chromo is not None)
    shared_graph = build_conflict_graph(sessions) if use_dsatur_seeds else None

    for i in range(population_size - len(population)):
        if deadline is not None and len(population) >= 1 and time.perf_counter() >= deadline:
            break
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
                conflict_graph=shared_graph,
                comp_map_override=comp_map,
                parsed_unavail_inst=parsed_u_inst,
                parsed_unavail_room=parsed_u_room,
                deadline=deadline,
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
        if deadline is not None and time.perf_counter() >= deadline:
            break
        next_gen: List[TimetableChromosome] = [population[0].clone()]
        if len(population) > 1:
            next_gen.append(population[1].clone())

        while len(next_gen) < population_size:
            if deadline is not None and time.perf_counter() >= deadline:
                break
            p1 = min(rng.sample(population, min(3, len(population))), key=lambda c: (c.hard_violations, -c.fitness_score))
            p2 = min(rng.sample(population, min(3, len(population))), key=lambda c: (c.hard_violations, -c.fitness_score))
            if rng.random() < 0.70:
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
                do_mutate = rng.random() < 0.65
            else:
                child = p1.clone()
                do_mutate = True

            if do_mutate:
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
                    weights=weights,
                    student_preferences=student_preferences,
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
