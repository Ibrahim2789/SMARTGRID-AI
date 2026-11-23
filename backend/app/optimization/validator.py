"""
Hard Constraint Validator for University Timetables.
Verifies:
1. All required sessions are assigned (100% credit-hour lecture and lab fulfillment).
2. No instructor teaches two sessions simultaneously.
3. No lab engineer oversees two labs simultaneously.
4. No classroom/laboratory hosts two sessions simultaneously.
5. No student batch/cohort/shared elective group has overlapping sessions.
6. Same course section does not place multiple single-period lectures on the same day.
7. Room capacity, equipment, availability, and lecture-vs-lab room types match.
8. Working days, official midday/Jummah breaks, Friday restrictions, and closing times are strictly respected.
9. Instructor and room unavailability restrictions are respected.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from .chromosome import SessionGene, TimetableChromosome
from .constraints import (
    ScheduleSession,
    TimeSlotConfig,
    format_minutes_24h,
    normalize_rooms_input,
    parse_time_to_minutes,
)
from .fitness import _coerce_slot_dict, is_slot_blocked, normalize_unavailable_slots_map


@dataclass
class ConstraintViolation:
    violation_type: str
    severity: str  # 'hard'
    session_ids: List[str]
    message: str


@dataclass
class ValidationReport:
    is_valid: bool
    hard_violation_count: int
    violations: List[ConstraintViolation] = field(default_factory=list)
    credit_summary: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "isValid": self.is_valid,
            "hardViolationCount": self.hard_violation_count,
            "violations": [
                {
                    "type": v.violation_type,
                    "severity": v.severity,
                    "sessionIds": v.session_ids,
                    "message": v.message,
                }
                for v in self.violations
            ],
            "creditSummary": self.credit_summary,
        }


def _to_session_genes(
    session_assignments: Any,
    sessions: List[ScheduleSession],
    time_config: TimeSlotConfig,
) -> Dict[str, SessionGene]:
    raw_map = session_assignments.genes if isinstance(session_assignments, TimetableChromosome) else (session_assignments or {})
    sess_by_id = {s.session_id: s for s in sessions}
    genes: Dict[str, SessionGene] = {}

    for sid, val in raw_map.items():
        sess = sess_by_id.get(sid)
        if isinstance(val, SessionGene):
            g = SessionGene(**val.__dict__)
            if sess and (g.end_min <= g.start_min):
                g.sync_timing(sess, time_config)
            genes[sid] = g
        elif isinstance(val, tuple) and len(val) >= 3:
            day, start_t, room_id = str(val[0]), str(val[1]), str(val[2])
            day_slots = time_config.get_day_slots(day)
            t_min = parse_time_to_minutes(start_t)
            slot_idx = 0
            best_diff = 10**9
            for s in day_slots:
                diff = abs(s.start_min - t_min)
                if diff < best_diff:
                    best_diff = diff
                    slot_idx = s.slot_index
            g = SessionGene(
                session_id=sid,
                day=day,
                slot_index=slot_idx,
                room_id=room_id,
                is_lab=sess.is_lab if sess else False,
            )
            if sess:
                g.sync_timing(sess, time_config)
            genes[sid] = g
    return genes


def validate_timetable_assignments(
    session_assignments: Any,
    sessions: List[ScheduleSession],
    rooms: List[Any],
    time_config: TimeSlotConfig,
    instructors: Optional[List[Dict[str, Any]]] = None,
    unavailable_instructor_slots: Optional[Any] = None,
    unavailable_room_slots: Optional[Any] = None,
) -> ValidationReport:
    violations: List[ConstraintViolation] = []
    norm_rooms = normalize_rooms_input(rooms)
    room_map = {r["id"]: r for r in norm_rooms if r.get("id")}
    unavail_inst = normalize_unavailable_slots_map(unavailable_instructor_slots, instructors)
    unavail_room = _coerce_slot_dict(unavailable_room_slots)

    genes = _to_session_genes(session_assignments, sessions, time_config)

    # Track interval overlaps cleanly
    staff_intervals: Dict[Tuple[str, str], List[Tuple[int, int, str, bool]]] = defaultdict(list)
    room_intervals: Dict[Tuple[str, str], List[Tuple[int, int, str]]] = defaultdict(list)
    group_intervals: Dict[Tuple[str, str], List[Tuple[int, int, str]]] = defaultdict(list)
    lecture_section_days: Dict[Tuple[str, str], str] = {}

    scheduled_lecture_mins: Dict[Tuple[str, str], int] = defaultdict(int)
    scheduled_lab_mins: Dict[Tuple[str, str], int] = defaultdict(int)

    for sess in sessions:
        gene = genes.get(sess.session_id)
        if not gene:
            violations.append(
                ConstraintViolation(
                    violation_type="unassigned_session",
                    severity="hard",
                    session_ids=[sess.session_id],
                    message=f"Session {sess.course_code} ({sess.batch_code} Sec {sess.section_code}) is unassigned.",
                )
            )
            continue

        if gene.day not in time_config.working_days:
            violations.append(
                ConstraintViolation(
                    violation_type="invalid_operating_day",
                    severity="hard",
                    session_ids=[sess.session_id],
                    message=f"Session {sess.course_code} scheduled on non-working day {gene.day}.",
                )
            )
        elif gene.day == "Fri" and not sess.friday_eligible:
            violations.append(
                ConstraintViolation(
                    violation_type="friday_policy_violation",
                    severity="hard",
                    session_ids=[sess.session_id],
                    message=f"Session {sess.course_code} ({sess.batch_code}) placed on Friday despite Friday restriction/disablement.",
                )
            )

        win = time_config.compute_session_window(gene.day, gene.slot_index, sess.duration_minutes, sess.is_lab)
        if win is None:
            violations.append(
                ConstraintViolation(
                    violation_type="outside_operating_hours_or_break",
                    severity="hard",
                    session_ids=[sess.session_id],
                    message=(
                        f"Session {sess.course_code} on {gene.day} ({format_minutes_24h(gene.start_min)}–"
                        f"{format_minutes_24h(gene.end_min)}) falls outside operating hours or crosses an official break."
                    ),
                )
            )

        # Room checks
        room = room_map.get(gene.room_id)
        if not room or not room.get("is_available", True):
            violations.append(
                ConstraintViolation(
                    violation_type="invalid_or_unavailable_room",
                    severity="hard",
                    session_ids=[sess.session_id],
                    message=f"Room {gene.room_id} is unavailable or does not exist.",
                )
            )
        else:
            r_type = str(room.get("type") or room.get("room_type") or "lecture").lower()
            is_lab_room = "lab" in r_type
            if sess.is_lab and not is_lab_room:
                violations.append(
                    ConstraintViolation(
                        violation_type="room_type_mismatch",
                        severity="hard",
                        session_ids=[sess.session_id],
                        message=f"Lab session {sess.course_code} assigned to non-laboratory room {room.get('code', gene.room_id)}.",
                    )
                )
            elif not sess.is_lab and is_lab_room:
                violations.append(
                    ConstraintViolation(
                        violation_type="room_type_mismatch",
                        severity="hard",
                        session_ids=[sess.session_id],
                        message=f"Theory session {sess.course_code} assigned to laboratory room {room.get('code', gene.room_id)}.",
                    )
                )

            cap = int(room.get("capacity") or 50)
            if sess.expected_students > cap:
                violations.append(
                    ConstraintViolation(
                        violation_type="capacity_exceeded",
                        severity="hard",
                        session_ids=[sess.session_id],
                        message=(
                            f"Room {room.get('code', gene.room_id)} capacity ({cap}) is smaller than "
                            f"{sess.course_code} enrollment ({sess.expected_students})."
                        ),
                    )
                )
            if sess.is_lab and sess.assigned_lab_id and gene.room_id != sess.assigned_lab_id:
                violations.append(
                    ConstraintViolation(
                        violation_type="assigned_lab_mismatch",
                        severity="hard",
                        session_ids=[sess.session_id],
                        message=(
                            f"Lab session {sess.course_code} ({sess.batch_code}) must use administrator-assigned "
                            f"laboratory {sess.assigned_lab_id}, got {room.get('code', gene.room_id)}."
                        ),
                    )
                )
            if sess.required_equipment:
                room_eq = {str(e).lower() for e in (room.get("equipment") or [])}
                req_eq = {str(e).lower() for e in sess.required_equipment if e}
                if not req_eq.issubset(room_eq):
                    violations.append(
                        ConstraintViolation(
                            violation_type="missing_required_equipment",
                            severity="hard",
                            session_ids=[sess.session_id],
                            message=f"Room {room.get('code', gene.room_id)} lacks required equipment for {sess.course_code}.",
                        )
                    )

        # Same course section multiple lecture meetings on the same day (when distinct eligible days permit)
        if not sess.is_lab and sess.duration_minutes < 95:
            eligible_days = len([d for d in time_config.working_days if not (d == "Fri" and not sess.friday_eligible)])
            if sess.meetings_total <= max(1, eligible_days):
                sec_day_key = (f"{sess.batch_id}::{sess.course_id}::{sess.section_code}", gene.day)
                if sec_day_key in lecture_section_days and lecture_section_days[sec_day_key] != sess.session_id:
                    violations.append(
                        ConstraintViolation(
                            violation_type="same_day_duplicate_course_meeting",
                            severity="hard",
                            session_ids=[lecture_section_days[sec_day_key], sess.session_id],
                            message=f"Course {sess.course_code} (Sec {sess.section_code}) scheduled multiple lecture sessions on {gene.day}.",
                        )
                    )
                else:
                    lecture_section_days[sec_day_key] = sess.session_id

        # Track scheduled minutes for credit fulfillment reporting
        if sess.is_lab:
            scheduled_lab_mins[(sess.batch_id, sess.course_id)] += max(0, gene.end_min - gene.start_min)
        else:
            scheduled_lecture_mins[(sess.batch_id, sess.course_id)] += max(0, gene.end_min - gene.start_min)

        # Staff unavailability & overlap checks (both Lecture Instructor and Lab Engineer)
        occupied_slots = gene.get_occupied_slot_indices()
        for staff_id in sess.staff_ids:
            blocked_tokens = unavail_inst.get(staff_id, [])
            if is_slot_blocked(blocked_tokens, gene.day, gene.start_min, gene.end_min, occupied_slots):
                violations.append(
                    ConstraintViolation(
                        violation_type="instructor_unavailable_slot",
                        severity="hard",
                        session_ids=[sess.session_id],
                        message=f"Staff {staff_id} is unavailable on {gene.day} ({format_minutes_24h(gene.start_min)}).",
                    )
                )

            for ex_s, ex_e, other_sid, _ in staff_intervals[(staff_id, gene.day)]:
                if other_sid != sess.session_id and gene.start_min < ex_e and ex_s < gene.end_min:
                    is_le = sess.lab_engineer_id == staff_id and sess.is_lab
                    violations.append(
                        ConstraintViolation(
                            violation_type="lab_engineer_conflict" if is_le else "instructor_conflict",
                            severity="hard",
                            session_ids=[other_sid, sess.session_id],
                            message=(
                                f"{'Lab Engineer' if is_le else 'Instructor'} {staff_id} double-booked on {gene.day} "
                                f"at {format_minutes_24h(gene.start_min)}–{format_minutes_24h(gene.end_min)}."
                            ),
                        )
                    )
            staff_intervals[(staff_id, gene.day)].append((gene.start_min, gene.end_min, sess.session_id, sess.is_lab))

        # Room unavailability & overlap checks
        if is_slot_blocked(unavail_room.get(gene.room_id, []), gene.day, gene.start_min, gene.end_min, occupied_slots):
            violations.append(
                ConstraintViolation(
                    violation_type="room_unavailable_slot",
                    severity="hard",
                    session_ids=[sess.session_id],
                    message=f"Room {gene.room_id} is unavailable on {gene.day} ({format_minutes_24h(gene.start_min)}).",
                )
            )

        for ex_s, ex_e, other_sid in room_intervals[(gene.room_id, gene.day)]:
            if other_sid != sess.session_id and gene.start_min < ex_e and ex_s < gene.end_min:
                violations.append(
                    ConstraintViolation(
                        violation_type="room_conflict",
                        severity="hard",
                        session_ids=[other_sid, sess.session_id],
                        message=(
                            f"Room {gene.room_id} double-booked on {gene.day} at "
                            f"{format_minutes_24h(gene.start_min)}–{format_minutes_24h(gene.end_min)}."
                        ),
                    )
                )
        room_intervals[(gene.room_id, gene.day)].append((gene.start_min, gene.end_min, sess.session_id))

        # Student cohort & shared group overlap checks
        for grp_key in sess.student_group_keys:
            for ex_s, ex_e, other_sid in group_intervals[(grp_key, gene.day)]:
                if other_sid != sess.session_id and gene.start_min < ex_e and ex_s < gene.end_min:
                    violations.append(
                        ConstraintViolation(
                            violation_type="student_group_conflict",
                            severity="hard",
                            session_ids=[other_sid, sess.session_id],
                            message=(
                                f"Student cohort {grp_key} has overlapping classes on {gene.day} at "
                                f"{format_minutes_24h(gene.start_min)}–{format_minutes_24h(gene.end_min)}."
                            ),
                        )
                    )
            group_intervals[(grp_key, gene.day)].append((gene.start_min, gene.end_min, sess.session_id))

    return ValidationReport(
        is_valid=len(violations) == 0,
        hard_violation_count=len(violations),
        violations=violations,
        credit_summary={
            "totalSessions": len(sessions),
            "scheduledSessions": len(genes),
            "lectureBlocksScheduled": sum(1 for s in sessions if not s.is_lab and s.session_id in genes),
            "labBlocksScheduled": sum(1 for s in sessions if s.is_lab and s.session_id in genes),
        },
    )
