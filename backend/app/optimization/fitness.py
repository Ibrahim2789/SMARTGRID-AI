"""Student-centric multi-objective timetable fitness, gap evaluator, and Rawlsian batch fairness."""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from .chromosome import SessionGene, TimetableChromosome
from .constraints import ScheduleSession, TimeSlotConfig, parse_time_to_minutes


def _parse_slot_token(token: Any) -> Tuple[str, int]:
    """
    Parse unavailable slot token from either string ('Mon-09:00', 'Mon-0', 'Mon-9:00 AM')
    or dict ({'day': 'Mon', 'timeSlot': '9:00 – 9:50 AM'} or {'day': 'Mon', 'startTime': '09:00'}).
    Returns (day, start_minute_or_slot_index). Values >= 60 denote minutes from midnight;
    values 0..59 denote 0-based slot indices.
    """
    if isinstance(token, dict):
        day = str(token.get("day") or "").strip()[:3].capitalize()
        if not day:
            return ("", -1)
        raw_t = str(
            token.get("startTime")
            or token.get("start_time")
            or token.get("timeSlot")
            or token.get("time_slot")
            or ""
        ).strip()
        if not raw_t:
            return (day, -1)
        # Extract start time from ranges like '9:00 – 9:50 AM' or '9:00 AM - 9:50 AM'
        start_part = raw_t.replace("—", "–").replace("-", "–").split("–")[0].strip()
        if ":" in start_part:
            # Inherit AM/PM suffix from full string when start omits AM/PM (e.g. '2:00 – 2:50 PM')
            upper_full = raw_t.upper()
            upper_start = start_part.upper()
            if "AM" not in upper_start and "PM" not in upper_start:
                if "PM" in upper_full and "AM" not in upper_full:
                    start_part = f"{start_part} PM"
                elif "AM" in upper_full and "PM" not in upper_full:
                    start_part = f"{start_part} AM"
                elif "PM" in upper_full and "AM" in upper_full:
                    # e.g. '11:00 AM – 12:00 PM' -> AM already in upper_start or infer AM for <12
                    pass
            try:
                return (day, parse_time_to_minutes(start_part))
            except Exception:
                return (day, -1)
        try:
            return (day, int(start_part))
        except Exception:
            return (day, -1)

    tok_str = str(token or "").strip()
    if not tok_str or "-" not in tok_str:
        return ("", -1)
    day, rest = tok_str.split("-", 1)
    day = day.strip()[:3].capitalize()
    rest = rest.strip()
    if ":" in rest:
        try:
            return (day, parse_time_to_minutes(rest))
        except Exception:
            return (day, -1)
    try:
        return (day, int(rest))
    except Exception:
        return (day, -1)


def is_slot_blocked(
    tokens: List[Any],
    day: str,
    start_min: int,
    end_min: int,
    covered_slots: List[int],
) -> bool:
    """Return True if any unavailability token overlaps [start_min, end_min) or covered_slots on `day`."""
    for tok in tokens or []:
        b_day, b_val = _parse_slot_token(tok)
        if b_day != day or b_val < 0:
            continue
        if b_val >= 60:
            if start_min <= b_val < end_min:
                return True
        elif b_val in covered_slots:
            return True
    return False


def normalize_unavailable_slots_map(
    raw_map: Optional[Any] = None,
    instructors: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, List[Any]]:
    """Merge explicit unavailability map with per-instructor `unavailableSlots` / `unavailable_slots`."""
    merged: Dict[str, List[Any]] = defaultdict(list)
    coerced = _coerce_slot_dict(raw_map)
    for k, vals in coerced.items():
        merged[str(k)].extend(vals or [])
    for inst in instructors or []:
        iid = inst.get("id")
        if not iid:
            continue
        slots = inst.get("unavailable_slots")
        if slots is None:
            slots = inst.get("unavailableSlots")
        for tok in slots or []:
            if tok not in merged[str(iid)]:
                merged[str(iid)].append(tok)
    return dict(merged)


def _subtract_intervals(gap_start: int, gap_end: int, excluded: List[Tuple[int, int]]) -> int:
    """Compute unnecessary idle minutes in [gap_start, gap_end] minus official break intersections."""
    if gap_end <= gap_start:
        return 0
    total = gap_end - gap_start
    overlap_total = 0
    for ex_s, ex_e in excluded:
        o_s = max(gap_start, ex_s)
        o_e = min(gap_end, ex_e)
        if o_e > o_s:
            overlap_total += o_e - o_s
    return max(0, total - overlap_total)


def evaluate_student_gaps(
    sessions_by_group: Dict[str, List[Tuple[ScheduleSession, SessionGene]]],
    time_config: TimeSlotConfig,
) -> Dict[str, Any]:
    """
    Evaluate student idle gaps, daily compactness, continuous marathons, early/late classes, and attendance days.
    Excludes official midday/Jummah breaks and normal transition short breaks from gap penalties.
    """
    per_batch: Dict[str, Dict[str, Any]] = {}
    total_idle_mins_all = 0
    total_gap_count_all = 0
    longest_gap_all = 0
    compactness_ratios: List[float] = []

    for gid, pairs in sessions_by_group.items():
        day_buckets: Dict[str, List[Tuple[int, int, ScheduleSession, SessionGene]]] = defaultdict(list)
        for sess, gene in pairs:
            if gene.end_min <= gene.start_min:
                gene.sync_timing(sess, time_config)
            day_buckets[gene.day].append((gene.start_min, gene.end_min, sess, gene))

        batch_idle = 0
        batch_gap_count = 0
        batch_longest_gap = 0
        batch_overlong_runs = 0
        batch_early_count = 0
        batch_late_count = 0
        batch_days_attended = len([d for d, items in day_buckets.items() if items])
        batch_day_spans: List[float] = []

        for day, items in day_buckets.items():
            items.sort(key=lambda x: (x[0], x[1]))
            if not items:
                continue

            official_breaks = list(time_config.get_day_breaks(day))
            trans_break = time_config.friday_short_break if day == "Fri" else time_config.short_break_minutes

            first_start = items[0][0]
            last_end = max(x[1] for x in items)
            total_class_mins = sum(max(1, x[1] - x[0]) for x in items)

            # Check early (< 08:30) and late (>= 16:30)
            for s_m, e_m, _, _ in items:
                if s_m < 8 * 60 + 30:
                    batch_early_count += 1
                if e_m >= 16 * 60 + 45:
                    batch_late_count += 1

            # Continuous uninterrupted class run tracking
            run_mins = items[0][1] - items[0][0]
            day_idle = 0
            for idx in range(1, len(items)):
                prev_s, prev_e, _, _ = items[idx - 1]
                curr_s, curr_e, _, _ = items[idx]
                if curr_s <= prev_e:
                    run_mins += max(0, curr_e - prev_e)
                    continue

                raw_gap = curr_s - prev_e
                # Allow normal inter-class transition + official midday/Jummah break
                non_break_gap = _subtract_intervals(prev_e, curr_s, official_breaks)
                unnecessary_idle = max(0, non_break_gap - trans_break)

                if unnecessary_idle > 5:
                    day_idle += unnecessary_idle
                    batch_gap_count += 1
                    batch_longest_gap = max(batch_longest_gap, unnecessary_idle)
                    run_mins = curr_e - curr_s
                else:
                    # Back-to-back or separated by official break
                    if non_break_gap <= trans_break + 2:
                        run_mins += curr_e - curr_s
                    else:
                        run_mins = curr_e - curr_s

                if run_mins > 240:
                    batch_overlong_runs += 1

            if len(items) == 1 and (items[0][1] - items[0][0]) > 240:
                batch_overlong_runs += 1

            batch_idle += day_idle
            span_without_official = _subtract_intervals(first_start, last_end, official_breaks)
            expected_breaks = max(0, len(items) - 1) * trans_break
            effective_span = max(total_class_mins, span_without_official - expected_breaks)
            compactness = min(1.0, total_class_mins / max(1.0, float(effective_span)))
            batch_day_spans.append(compactness)
            compactness_ratios.append(compactness)

        total_idle_mins_all += batch_idle
        total_gap_count_all += batch_gap_count
        longest_gap_all = max(longest_gap_all, batch_longest_gap)
        mean_compactness = sum(batch_day_spans) / max(1, len(batch_day_spans))

        per_batch[gid] = {
            "totalIdleMinutes": batch_idle,
            "gapCount": batch_gap_count,
            "longestGapMinutes": batch_longest_gap,
            "attendedDays": batch_days_attended,
            "overlongRuns": batch_overlong_runs,
            "earlyCount": batch_early_count,
            "lateCount": batch_late_count,
            "compactness": round(mean_compactness * 100.0, 2),
        }

    avg_compactness = (sum(compactness_ratios) / max(1, len(compactness_ratios))) * 100.0 if compactness_ratios else 100.0
    avg_idle_per_batch = total_idle_mins_all / max(1, len(per_batch))

    return {
        "perBatch": per_batch,
        "totalIdleMinutes": total_idle_mins_all,
        "avgIdleMinutesPerBatch": round(avg_idle_per_batch, 2),
        "totalGapCount": total_gap_count_all,
        "longestGapMinutes": longest_gap_all,
        "avgCompactness": round(avg_compactness, 2),
    }


def evaluate_timetable_fitness(
    chromosome: TimetableChromosome,
    sessions: List[ScheduleSession],
    rooms: List[Dict[str, Any]],
    instructors: List[Dict[str, Any]],
    time_config: TimeSlotConfig,
    weights: Optional[Dict[str, float]] = None,
    student_preferences: Optional[List[Dict[str, Any]]] = None,
    instructor_preferences: Optional[List[Dict[str, Any]]] = None,
    unavailable_instructor_slots: Optional[Dict[str, List[str]]] = None,
    unavailable_room_slots: Optional[Dict[str, List[str]]] = None,
) -> Dict[str, Any]:
    """
    Evaluate all hard constraints + rich student-centric compactness/gap/fairness objectives.
    Never awards high score to schedules with gaps, worst-batch hardship, or hard violations.
    """
    w = weights or {}
    w_student_gap = float(w.get("student_gap_minimization", 0.35))
    w_student_fair = float(w.get("student_fairness", 0.25))
    w_inst_load = float(w.get("instructor_balance", 0.20))
    w_room_util = float(w.get("room_utilization", 0.15))
    w_pref = float(w.get("preferences", 0.15))

    room_by_id = {r["id"]: r for r in rooms if r.get("id")}
    unavail_inst = normalize_unavailable_slots_map(unavailable_instructor_slots, instructors)
    unavail_room = _coerce_slot_dict(unavailable_room_slots)

    hard_violations = 0
    violation_reasons: List[str] = []

    unplaced_count = sum(1 for s in sessions if s.session_id not in chromosome.genes)
    hard_violations += unplaced_count
    if unplaced_count > 0:
        violation_reasons.append(f"{unplaced_count} required session(s) could not be placed.")

    # Collision registries using exact time intervals
    placed_pairs: List[Tuple[ScheduleSession, SessionGene]] = []
    staff_schedule: Dict[str, List[Tuple[ScheduleSession, SessionGene]]] = defaultdict(list)
    room_schedule: Dict[str, List[Tuple[ScheduleSession, SessionGene]]] = defaultdict(list)
    group_schedule: Dict[str, List[Tuple[ScheduleSession, SessionGene]]] = defaultdict(list)
    course_day_counts: Dict[Tuple[str, str, str], int] = defaultdict(int)
    lecture_section_days: Dict[Tuple[str, str], str] = {}

    for sess in sessions:
        gene = chromosome.genes.get(sess.session_id)
        if not gene:
            continue
        gene.sync_timing(sess, time_config)
        placed_pairs.append((sess, gene))

        # 1. Working day + Friday policy check
        if gene.day not in time_config.working_days:
            hard_violations += 1
            violation_reasons.append(f"{sess.course_code} placed on non-working day {gene.day}.")
        elif gene.day == "Fri" and not sess.friday_eligible:
            hard_violations += 1
            violation_reasons.append(
                f"{sess.course_code} ({sess.batch_code}) placed on Friday despite Friday restriction/disablement."
            )

        # 2. Break / operating hours check
        if time_config.compute_session_window(gene.day, gene.slot_index, sess.duration_minutes, sess.is_lab) is None:
            hard_violations += 1
            violation_reasons.append(
                f"{sess.course_code} ({gene.day} slot {gene.slot_index}) overlaps an official break or closing time."
            )

        # 3. Room check (type, availability, capacity, equipment)
        room = room_by_id.get(gene.room_id)
        if not room:
            hard_violations += 1
            violation_reasons.append(f"{sess.course_code} references unknown room {gene.room_id}.")
        else:
            if not room.get("is_available", room.get("isAvailable", True)):
                hard_violations += 1
            r_type = str(room.get("type") or room.get("room_type") or "lecture").lower()
            is_lab_room = "lab" in r_type
            if sess.is_lab and not is_lab_room:
                hard_violations += 1
                violation_reasons.append(f"Lab {sess.course_code} placed in non-lab room {room.get('code', gene.room_id)}.")
            elif not sess.is_lab and is_lab_room:
                hard_violations += 1
                violation_reasons.append(f"Theory {sess.course_code} placed in lab room {room.get('code', gene.room_id)}.")
            cap = int(room.get("capacity") or 50)
            if sess.expected_students > cap:
                hard_violations += 1
                violation_reasons.append(
                    f"{sess.course_code} ({sess.expected_students} students) exceeds room capacity ({cap})."
                )
            if sess.required_equipment:
                room_eq = {str(e).lower() for e in (room.get("equipment") or [])}
                req_eq = {str(e).lower() for e in sess.required_equipment if e}
                if not req_eq.issubset(room_eq):
                    hard_violations += 1
                    violation_reasons.append(f"{sess.course_code} missing required equipment in {room.get('code', gene.room_id)}.")

        # 4. Instructor / Lab engineer availability check
        occupied = gene.get_occupied_slot_indices()
        for staff_id in sess.staff_ids:
            blocked_tokens = unavail_inst.get(staff_id, [])
            if is_slot_blocked(blocked_tokens, gene.day, gene.start_min, gene.end_min, occupied):
                hard_violations += 1
                violation_reasons.append(f"Staff {staff_id} unavailable on {gene.day} ({gene.start_min}).")

        # 5. Room unavailable slots check
        if is_slot_blocked(unavail_room.get(gene.room_id, []), gene.day, gene.start_min, gene.end_min, occupied):
            hard_violations += 1
            violation_reasons.append(f"Room {gene.room_id} unavailable on {gene.day}.")

        # 6. Same-course single-period lectures on the same day (hard when enough distinct eligible days exist)
        if not sess.is_lab and sess.duration_minutes < 95:
            eligible_days = len([d for d in time_config.working_days if not (d == "Fri" and not sess.friday_eligible)])
            if sess.meetings_total <= max(1, eligible_days):
                sec_day_key = (f"{sess.batch_id}::{sess.course_id}::{sess.section_code}", gene.day)
                if sec_day_key in lecture_section_days and lecture_section_days[sec_day_key] != sess.session_id:
                    hard_violations += 1
                    violation_reasons.append(
                        f"{sess.course_code} (Sec {sess.section_code}) scheduled multiple lecture meetings on {gene.day}."
                    )
                else:
                    lecture_section_days[sec_day_key] = sess.session_id

        # 6. Exact interval collisions: Instructor(s), Lab Engineer, Room, Student Group(s)
        for staff_id in sess.staff_ids:
            for _, other_gene in staff_schedule[staff_id]:
                if gene.overlaps(other_gene):
                    hard_violations += 1
            staff_schedule[staff_id].append((sess, gene))

        for _, other_gene in room_schedule[gene.room_id]:
            if gene.overlaps(other_gene):
                hard_violations += 1
        room_schedule[gene.room_id].append((sess, gene))

        for grp_key in sess.student_group_keys:
            for _, other_gene in group_schedule[grp_key]:
                if gene.overlaps(other_gene):
                    hard_violations += 1
            group_schedule[grp_key].append((sess, gene))
            course_day_counts[(grp_key, sess.course_id, gene.day)] += 1

    # --- Student-Centric Gap, Compactness & Workload Evaluation ---
    gap_report = evaluate_student_gaps(group_schedule, time_config)
    per_batch_gaps = gap_report["perBatch"]

    # Index student preferences by batch
    prefs_by_batch: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    global_student_prefs: List[Dict[str, Any]] = []
    for sp in student_preferences or []:
        b_id = str(sp.get("batch_id") or sp.get("batchId") or "")
        if b_id:
            prefs_by_batch[b_id].append(sp)
        else:
            global_student_prefs.append(sp)

    batch_scores: Dict[str, float] = {}
    same_course_bunching = sum(max(0, cnt - 1) for cnt in course_day_counts.values() if cnt > 1)

    for gid, gstats in per_batch_gaps.items():
        b_score = 100.0
        # Heavy gap penalty (idle minutes + separate gap count + longest single gap)
        b_score -= min(45.0, gstats["totalIdleMinutes"] * 0.22)
        b_score -= min(20.0, gstats["gapCount"] * 4.5)
        if gstats["longestGapMinutes"] > 90:
            b_score -= min(18.0, (gstats["longestGapMinutes"] - 90) * 0.12)
        # Marathon / early / late / compactness
        b_score -= gstats["overlongRuns"] * 7.0
        b_score -= gstats["earlyCount"] * 2.5
        b_score -= gstats["lateCount"] * 3.0
        b_score -= max(0.0, (100.0 - gstats["compactness"]) * 0.25)

        # Student submitted preferences
        batch_prefs = prefs_by_batch.get(gid) or global_student_prefs
        if batch_prefs:
            batch_items = group_schedule[gid]
            pref_pen = 0.0
            for sp in batch_prefs:
                pref_win = str(sp.get("preferred_time_window") or sp.get("preferredTimeWindow") or "balanced")
                avoid_early = bool(sp.get("avoid_early_8am", sp.get("avoidEarly8am", True)))
                avoid_late = bool(sp.get("avoid_late_after_4pm", sp.get("avoidLateAfter4pm", True)))
                max_gap_pref = int(sp.get("max_acceptable_gap_minutes") or sp.get("maxAcceptableGapMinutes") or 60)
                pref_free_day = str(sp.get("preferred_free_day") or sp.get("preferredFreeDay") or "").strip()[:3].capitalize()

                if gstats["longestGapMinutes"] > max_gap_pref:
                    pref_pen += 4.0
                if pref_free_day and any(g.day == pref_free_day for _, g in batch_items):
                    pref_pen += 3.0
                for _, g in batch_items:
                    if avoid_early and g.start_min < 9 * 60:
                        pref_pen += 1.5
                    if avoid_late and g.end_min > 16 * 60 + 15:
                        pref_pen += 1.5
                    if pref_win == "morning" and g.start_min >= 14 * 60:
                        pref_pen += 0.8
                    elif pref_win == "afternoon" and g.start_min < 12 * 60:
                        pref_pen += 0.8
            b_score -= min(18.0, pref_pen / max(1, len(batch_prefs)))

        # Reward keeping attendance days compact when weekly load is small
        weekly_session_count = len(group_schedule[gid])
        if weekly_session_count <= 8 and gstats["attendedDays"] <= 3:
            b_score += 2.0
        elif weekly_session_count <= 4 and gstats["attendedDays"] > 2:
            b_score -= (gstats["attendedDays"] - 2) * 3.0

        batch_scores[gid] = round(max(0.0, min(100.0, b_score)), 2)

    if batch_scores:
        avg_student_sat = sum(batch_scores.values()) / len(batch_scores)
        least_satisfied_batch = min(batch_scores.values())
        idle_values = [v["totalIdleMinutes"] for v in per_batch_gaps.values()]
        fairness_spread = max(idle_values) - min(idle_values) if idle_values else 0
        fairness_score = max(
            0.0,
            min(100.0, least_satisfied_batch * 0.7 + avg_student_sat * 0.3 - fairness_spread * 0.05),
        )
    else:
        avg_student_sat = 100.0
        least_satisfied_batch = 100.0
        fairness_score = 100.0

    # Same-course daily spread penalty
    avg_student_sat = max(0.0, avg_student_sat - same_course_bunching * 2.5)

    # --- Instructor Balance & Preferences ---
    inst_prefs_by_id = {p.get("instructor_id"): p for p in (instructor_preferences or []) if p.get("instructor_id")}
    inst_scores: List[float] = []
    for inst in instructors:
        i_id = inst.get("id")
        if not i_id:
            continue
        assigned = staff_schedule.get(i_id, [])
        if not assigned:
            continue
        i_score = 100.0
        by_day: Dict[str, List[Tuple[int, int]]] = defaultdict(list)
        total_hrs = 0.0
        for s, g in assigned:
            by_day[g.day].append((g.start_min, g.end_min))
            total_hrs += s.duration_minutes / 60.0

        max_weekly = float(inst.get("max_weekly_hours") or inst.get("maxWeeklyHours") or 18)
        if total_hrs > max_weekly:
            i_score -= (total_hrs - max_weekly) * 8.0

        max_daily = int(inst.get("max_daily_classes") or inst.get("maxLecturesPerDay") or 4)
        for day_slots_list in by_day.values():
            if len(day_slots_list) > max_daily:
                i_score -= (len(day_slots_list) - max_daily) * 6.0

        pref = inst_prefs_by_id.get(i_id)
        if pref:
            pref_days = {str(d)[:3].capitalize() for d in (pref.get("preferred_days") or [])}
            if pref_days:
                for day in by_day:
                    if day not in pref_days:
                        i_score -= 4.0

        inst_scores.append(max(0.0, min(100.0, i_score)))

    instructor_sat = sum(inst_scores) / max(1, len(inst_scores)) if inst_scores else 95.0

    # --- Room Utilization ---
    total_room_capacity_slots = max(1, len(rooms) * sum(len(time_config.get_day_slots(d)) for d in time_config.working_days))
    occupied_room_slot_units = sum(max(1, round(s.duration_minutes / max(1, time_config.period_length_minutes))) for s, _ in placed_pairs)
    raw_util = min(100.0, (occupied_room_slot_units / total_room_capacity_slots) * 100.0)
    room_util_score = min(100.0, 55.0 + raw_util * 0.9) if placed_pairs else 0.0

    # --- Preference Satisfaction Metric (incorporating student & instructor preference weights) ---
    pref_score = 100.0
    if batch_scores or inst_scores:
        # Student & instructor preference alignment already penalizes deviations in batch_scores / inst_scores;
        # compute standalone preference compliance index so `w_pref` directly shapes totalScore.
        pref_penalties: List[float] = []
        for gid in per_batch_gaps:
            batch_prefs = prefs_by_batch.get(gid) or global_student_prefs
            if not batch_prefs:
                continue
            batch_items = group_schedule[gid]
            gstats = per_batch_gaps[gid]
            for sp in batch_prefs:
                p_pen = 0.0
                pref_win = str(sp.get("preferred_time_window") or sp.get("preferredTimeWindow") or "balanced")
                avoid_early = bool(sp.get("avoid_early_8am", sp.get("avoidEarly8am", True)))
                avoid_late = bool(sp.get("avoid_late_after_4pm", sp.get("avoidLateAfter4pm", True)))
                max_gap_pref = int(sp.get("max_acceptable_gap_minutes") or sp.get("maxAcceptableGapMinutes") or 60)
                pref_free_day = str(sp.get("preferred_free_day") or sp.get("preferredFreeDay") or "").strip()[:3].capitalize()
                if gstats["longestGapMinutes"] > max_gap_pref:
                    p_pen += 10.0
                if pref_free_day and any(g.day == pref_free_day for _, g in batch_items):
                    p_pen += 8.0
                for _, g in batch_items:
                    if avoid_early and g.start_min < 9 * 60:
                        p_pen += 4.0
                    if avoid_late and g.end_min > 16 * 60 + 15:
                        p_pen += 4.0
                    if pref_win == "morning" and g.start_min >= 14 * 60:
                        p_pen += 2.5
                    elif pref_win == "afternoon" and g.start_min < 12 * 60:
                        p_pen += 2.5
                pref_penalties.append(min(50.0, p_pen))
        if pref_penalties:
            pref_score = max(0.0, 100.0 - (sum(pref_penalties) / len(pref_penalties)))

    # Combine Student-First Total Score
    w_gap_term = 0.42 + w_student_gap * 0.15
    w_fair_term = 0.18 + w_student_fair * 0.12
    w_inst_term = 0.10 + w_inst_load * 0.05
    w_room_term = 0.06 + w_room_util * 0.05
    w_comp_term = 0.10
    w_pref_term = max(0.02, w_pref * 0.12)

    soft_score = (
        avg_student_sat * w_gap_term
        + least_satisfied_batch * w_fair_term
        + instructor_sat * w_inst_term
        + room_util_score * w_room_term
        + gap_report["avgCompactness"] * w_comp_term
        + pref_score * w_pref_term
    )
    weight_norm = w_gap_term + w_fair_term + w_inst_term + w_room_term + w_comp_term + w_pref_term
    normalized_soft = max(0.0, min(100.0, soft_score / max(0.1, weight_norm)))

    # Hard penalty strictly dominates so any conflict drops score sharply below feasible schedules
    total_score = round(max(0.0, normalized_soft - hard_violations * 18.0), 2)

    metrics = {
        "totalScore": total_score,
        "studentSatisfaction": round(avg_student_sat, 2),
        "instructorSatisfaction": round(instructor_sat, 2),
        "compactnessScore": round(gap_report["avgCompactness"], 2),
        "preferenceScore": round(pref_score, 2),
        "studentGapPenalty": round(gap_report["avgIdleMinutesPerBatch"], 2),
        "studentGapMinutesAvg": round(gap_report["avgIdleMinutesPerBatch"], 2),
        "avgIdleMinutesPerBatch": round(gap_report["avgIdleMinutesPerBatch"], 2),
        "totalIdleMinutes": gap_report["totalIdleMinutes"],
        "totalGapCount": gap_report["totalGapCount"],
        "longestGapMinutes": gap_report["longestGapMinutes"],
        "workloadBalance": round(instructor_sat, 2),
        "workloadBalanceScore": round(instructor_sat, 2),
        "fairnessScore": round(fairness_score, 2),
        "leastSatisfiedBatchScore": round(least_satisfied_batch, 2),
        "roomUtilization": round(room_util_score, 2),
        "batchBreakdown": batch_scores,
        "batchSatisfactionByBatch": batch_scores,
        "batchGapBreakdown": per_batch_gaps,
        "hardViolations": hard_violations,
        "violationReasons": violation_reasons[:25],
    }
    chromosome.fitness_score = total_score
    chromosome.hard_violations = hard_violations
    chromosome.metrics = metrics
    return metrics


from dataclasses import dataclass, field


@dataclass
class OptimizationWeights:
    student_gap_minimization: float = 0.35
    student_fairness: float = 0.25
    instructor_balance: float = 0.20
    room_utilization: float = 0.15
    preferences: float = 0.15

    def to_dict(self) -> Dict[str, float]:
        return {
            "student_gap_minimization": self.student_gap_minimization,
            "student_fairness": self.student_fairness,
            "instructor_balance": self.instructor_balance,
            "room_utilization": self.room_utilization,
            "preferences": self.preferences,
        }


@dataclass
class FitnessBreakdown:
    total_score: float
    hard_violation_count: int
    metrics: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return dict(self.metrics)


def _coerce_slot_dict(raw: Optional[Any]) -> Dict[str, List[str]]:
    if not raw:
        return {}
    if isinstance(raw, dict):
        return raw
    out: Dict[str, List[str]] = defaultdict(list)
    for item in raw:
        if isinstance(item, tuple) and len(item) == 3:
            res_id, day, start_t = item
            out[str(res_id)].append(f"{day}-{start_t}")
    return dict(out)


def evaluate_chromosome_fitness(
    chromosome: TimetableChromosome,
    sessions: List[ScheduleSession],
    rooms: List[Any],
    time_config: TimeSlotConfig,
    weights: Optional[Any] = None,
    instructors: Optional[List[Dict[str, Any]]] = None,
    student_preferences: Optional[List[Dict[str, Any]]] = None,
    instructor_preferences: Optional[List[Dict[str, Any]]] = None,
    unavailable_instructor_slots: Optional[Any] = None,
    unavailable_room_slots: Optional[Any] = None,
) -> FitnessBreakdown:
    """Compatibility wrapper converting legacy tuple/RoomResource arguments into evaluate_timetable_fitness."""
    from .chromosome import SessionGene
    from .constraints import normalize_rooms_input, parse_time_to_minutes

    norm_rooms = normalize_rooms_input(rooms)
    w_dict = weights.to_dict() if hasattr(weights, "to_dict") else (weights if isinstance(weights, dict) else None)
    unavail_inst = _coerce_slot_dict(unavailable_instructor_slots)
    unavail_room = _coerce_slot_dict(unavailable_room_slots)

    # Coerce tuple genes (day, start_time, room_id) -> SessionGene if needed
    work_chrom = TimetableChromosome()
    sess_by_id = {s.session_id: s for s in sessions}
    for sid, val in chromosome.genes.items():
        if isinstance(val, SessionGene):
            work_chrom.genes[sid] = val
        elif isinstance(val, tuple) and len(val) >= 3:
            day, start_t, room_id = val[0], val[1], val[2]
            day_slots = time_config.get_day_slots(day)
            t_min = parse_time_to_minutes(str(start_t))
            slot_idx = 0
            best_diff = 10**9
            for s in day_slots:
                diff = abs(s.start_min - t_min)
                if diff < best_diff:
                    best_diff = diff
                    slot_idx = s.slot_index
            sess = sess_by_id.get(sid)
            gene = SessionGene(
                session_id=sid,
                day=day,
                slot_index=slot_idx,
                room_id=str(room_id),
                is_lab=sess.is_lab if sess else False,
            )
            if sess:
                gene.sync_timing(sess, time_config)
            work_chrom.genes[sid] = gene

    metrics = evaluate_timetable_fitness(
        chromosome=work_chrom,
        sessions=sessions,
        rooms=norm_rooms,
        instructors=instructors or [],
        time_config=time_config,
        weights=w_dict,
        student_preferences=student_preferences,
        instructor_preferences=instructor_preferences,
        unavailable_instructor_slots=unavail_inst,
        unavailable_room_slots=unavail_room,
    )
    chromosome.fitness_score = work_chrom.fitness_score
    chromosome.hard_violations = work_chrom.hard_violations
    chromosome.metrics = work_chrom.metrics
    return FitnessBreakdown(
        total_score=float(metrics["totalScore"]),
        hard_violation_count=int(metrics["hardViolations"]),
        metrics=metrics,
    )

