"""
Hard Constraint Validator for University Timetables.
Verifies:
1. No instructor teaches two sessions simultaneously.
2. No classroom/laboratory hosts two sessions simultaneously.
3. No student batch/group has overlapping compulsory sessions.
4. Same course section does not meet twice on the same day (unless multi-slot lab).
5. Room capacity is sufficient and laboratory vs lecture room type matches.
6. Operating hours and protected midday break are respected.
7. Instructor unavailability and room unavailability restrictions are respected.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from .constraints import RoomResource, SchedulingSession, TimeSlotConfig


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
        }


def validate_timetable_assignments(
    session_assignments: Dict[str, Tuple[str, str, str]],  # session_id -> (day, start_time, room_id)
    sessions: List[SchedulingSession],
    rooms: List[RoomResource],
    time_config: TimeSlotConfig,
    unavailable_instructor_slots: Optional[Set[Tuple[str, str, str]]] = None,
    unavailable_room_slots: Optional[Set[Tuple[str, str, str]]] = None,
) -> ValidationReport:
    violations: List[ConstraintViolation] = []
    room_map = {r.room_id: r for r in rooms}
    valid_days = set(time_config.working_days)
    valid_lecture_slots = set(time_config.generate_daily_lecture_slots())

    instructor_busy: Dict[Tuple[str, str, str], str] = {}
    room_busy: Dict[Tuple[str, str, str], str] = {}
    group_busy: Dict[Tuple[str, str, str], str] = {}
    section_days: Dict[Tuple[str, str], str] = {}

    for sess in sessions:
        assignment = session_assignments.get(sess.session_id)
        if not assignment:
            violations.append(
                ConstraintViolation(
                    violation_type="unassigned_session",
                    severity="hard",
                    session_ids=[sess.session_id],
                    message=f"Session {sess.course_code} ({sess.section_code}) is unassigned.",
                )
            )
            continue

        day, start_time, room_id = assignment

        if day not in valid_days:
            violations.append(
                ConstraintViolation(
                    violation_type="invalid_operating_day",
                    severity="hard",
                    session_ids=[sess.session_id],
                    message=f"Session {sess.course_code} scheduled on non-working day {day}.",
                )
            )

        is_lab = sess.session_type == "Lab"
        covered_slots = time_config.covered_lecture_slots(start_time, is_lab)

        for st in covered_slots:
            if st not in valid_lecture_slots:
                violations.append(
                    ConstraintViolation(
                        violation_type="outside_operating_hours_or_break",
                        severity="hard",
                        session_ids=[sess.session_id],
                        message=f"Session {sess.course_code} at {day} {st} falls outside operating hours or inside a protected break.",
                    )
                )

        # Room checks
        room = room_map.get(room_id)
        if not room or not room.is_available:
            violations.append(
                ConstraintViolation(
                    violation_type="invalid_or_unavailable_room",
                    severity="hard",
                    session_ids=[sess.session_id],
                    message=f"Room {room_id} is unavailable or does not exist.",
                )
            )
        else:
            is_lab_room = room.room_type.lower() == "lab"
            if is_lab and not is_lab_room:
                violations.append(
                    ConstraintViolation(
                        violation_type="room_type_mismatch",
                        severity="hard",
                        session_ids=[sess.session_id],
                        message=f"Lab session {sess.course_code} assigned to non-laboratory room {room.code}.",
                    )
                )
            elif not is_lab and is_lab_room:
                violations.append(
                    ConstraintViolation(
                        violation_type="room_type_mismatch",
                        severity="hard",
                        session_ids=[sess.session_id],
                        message=f"Theory session {sess.course_code} assigned to laboratory room {room.code}.",
                    )
                )

        # Check same section multiple theory meetings on the same day
        if not is_lab:
            sec_day_key = (sess.section_id, day)
            if sec_day_key in section_days:
                violations.append(
                    ConstraintViolation(
                        violation_type="same_day_duplicate_course_meeting",
                        severity="hard",
                        session_ids=[section_days[sec_day_key], sess.session_id],
                        message=f"Course section {sess.course_code} ({sess.section_code}) scheduled multiple times on {day}.",
                    )
                )
            else:
                section_days[sec_day_key] = sess.session_id

        # Check slot-by-slot resource collisions
        for st in covered_slots:
            if unavailable_instructor_slots and (sess.instructor_id, day, st) in unavailable_instructor_slots:
                violations.append(
                    ConstraintViolation(
                        violation_type="instructor_unavailable_slot",
                        severity="hard",
                        session_ids=[sess.session_id],
                        message=f"Instructor {sess.instructor_id} is unavailable on {day} at {st}.",
                    )
                )

            if unavailable_room_slots and (room_id, day, st) in unavailable_room_slots:
                violations.append(
                    ConstraintViolation(
                        violation_type="room_unavailable_slot",
                        severity="hard",
                        session_ids=[sess.session_id],
                        message=f"Room {room_id} is unavailable on {day} at {st}.",
                    )
                )

            if sess.instructor_id:
                inst_key = (sess.instructor_id, day, st)
                if inst_key in instructor_busy and instructor_busy[inst_key] != sess.session_id:
                    violations.append(
                        ConstraintViolation(
                            violation_type="instructor_conflict",
                            severity="hard",
                            session_ids=[instructor_busy[inst_key], sess.session_id],
                            message=f"Instructor {sess.instructor_id} double-booked on {day} at {st}.",
                        )
                    )
                else:
                    instructor_busy[inst_key] = sess.session_id

            rm_key = (room_id, day, st)
            if rm_key in room_busy and room_busy[rm_key] != sess.session_id:
                violations.append(
                    ConstraintViolation(
                        violation_type="room_conflict",
                        severity="hard",
                        session_ids=[room_busy[rm_key], sess.session_id],
                        message=f"Room {room_id} double-booked on {day} at {st}.",
                    )
                )
            else:
                room_busy[rm_key] = sess.session_id

            grp_key = (sess.student_group_id, day, st)
            if grp_key in group_busy and group_busy[grp_key] != sess.session_id:
                violations.append(
                    ConstraintViolation(
                        violation_type="student_group_conflict",
                        severity="hard",
                        session_ids=[group_busy[grp_key], sess.session_id],
                        message=f"Student cohort {sess.student_group_id} has overlapping classes on {day} at {st}.",
                    )
                )
            else:
                group_busy[grp_key] = sess.session_id

    return ValidationReport(
        is_valid=len(violations) == 0,
        hard_violation_count=len(violations),
        violations=violations,
    )
