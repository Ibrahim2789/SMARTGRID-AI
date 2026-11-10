"""
Hard and Soft Scheduling Constraints & Time-Slot Geometry Utilities.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple


def parse_minutes(hhmm: str) -> int:
    parts = (hhmm or "09:00").strip().split(":")
    h = int(parts[0]) if parts and parts[0].isdigit() else 9
    m = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
    return h * 60 + m


def format_minutes(total_minutes: int) -> str:
    h = (total_minutes // 60) % 24
    m = total_minutes % 60
    return f"{h:02d}:{m:02d}"


@dataclass
class TimeSlotConfig:
    working_days: List[str] = field(default_factory=lambda: ["Mon", "Tue", "Wed", "Thu", "Fri"])
    day_start_time: str = "09:00"
    day_end_time: str = "17:00"
    period_length_minutes: int = 50
    short_break_minutes: int = 10
    midday_break_enabled: bool = True
    midday_break_start: str = "13:00"
    midday_break_duration: int = 60
    lab_duration_minutes: int = 180

    def generate_daily_lecture_slots(self) -> List[str]:
        start_min = parse_minutes(self.day_start_time)
        end_min = parse_minutes(self.day_end_time)
        break_start = parse_minutes(self.midday_break_start)
        break_end = break_start + self.midday_break_duration
        step = max(30, self.period_length_minutes + self.short_break_minutes)

        slots: List[str] = []
        cursor = start_min
        while cursor + self.period_length_minutes <= end_min:
            if self.midday_break_enabled:
                # If lecture overlaps midday break, jump to end of midday break
                if cursor < break_end and (cursor + self.period_length_minutes) > break_start:
                    cursor = break_end
                    continue
            slots.append(format_minutes(cursor))
            cursor += step
        return slots or ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00"]

    def generate_valid_lab_start_slots(self) -> List[str]:
        lecture_slots = self.generate_daily_lecture_slots()
        end_min = parse_minutes(self.day_end_time)
        break_start = parse_minutes(self.midday_break_start)
        break_end = break_start + self.midday_break_duration

        valid_starts: List[str] = []
        for s in lecture_slots:
            s_min = parse_minutes(s)
            lab_end = s_min + self.lab_duration_minutes
            if lab_end > end_min:
                continue
            if self.midday_break_enabled and s_min < break_end and lab_end > break_start:
                continue
            valid_starts.append(s)
        if not valid_starts and lecture_slots:
            return [lecture_slots[0]]
        return valid_starts

    def covered_lecture_slots(self, start_time: str, is_lab: bool) -> List[str]:
        all_slots = self.generate_daily_lecture_slots()
        if not is_lab:
            return [start_time]
        if start_time not in all_slots:
            return [start_time]
        idx = all_slots.index(start_time)
        step = max(30, self.period_length_minutes + self.short_break_minutes)
        span_count = max(1, round(self.lab_duration_minutes / step))
        return all_slots[idx : idx + span_count]


@dataclass
class SchedulingSession:
    """
    Represents an individual schedulable meeting of a course section.
    A 3-credit-hour theory section produces 3 meetings per week (or 1 meeting for a continuous lab block).
    """

    session_id: str
    section_id: str
    course_id: str
    course_code: str
    course_title: str
    instructor_id: str
    batch_id: str
    student_group_id: str
    section_code: str
    session_type: str  # 'Theory' or 'Lab'
    meeting_index: int  # 0, 1, 2 for Theory meetings; 0 for Lab
    expected_students: int
    required_room_type: str  # 'lecture' or 'lab'
    required_equipment: List[str] = field(default_factory=list)
    preferred_room_id: Optional[str] = None


@dataclass
class RoomResource:
    room_id: str
    code: str
    name: str
    capacity: int
    room_type: str  # 'lecture', 'lab', 'seminar'
    equipment: List[str] = field(default_factory=list)
    is_available: bool = True


def expand_sections_to_sessions(
    sections: List[Dict[str, Any]],
    courses: List[Dict[str, Any]],
    student_groups: List[Dict[str, Any]],
) -> List[SchedulingSession]:
    course_map = {c["id"]: c for c in courses}
    group_map = {g["id"]: g for g in student_groups}
    sessions: List[SchedulingSession] = []

    for sec in sections:
        sec_id = str(sec.get("id") or "")
        course_id = str(sec.get("courseId") or sec.get("course_id") or "")
        course = course_map.get(course_id, {})
        group_id = str(sec.get("studentGroupId") or sec.get("batch_id") or "")
        group = group_map.get(group_id, {})

        session_type = str(sec.get("sessionType") or sec.get("session_type") or "Theory")
        is_lab = session_type.lower() == "lab" or str(course.get("type") or "").lower() == "lab"
        credits = int(course.get("credits") or course.get("credit_hours") or (1 if is_lab else 3))
        meetings_count = 1 if is_lab else max(1, min(3, credits))

        instructor_id = str(sec.get("instructorId") or sec.get("instructor_id") or "")
        expected_students = int(
            sec.get("enrollment")
            or sec.get("expected_students")
            or group.get("size")
            or group.get("student_count")
            or 45
        )
        req_equip = list(course.get("requiredEquipment") or course.get("required_equipment") or [])

        for m_idx in range(meetings_count):
            sessions.append(
                SchedulingSession(
                    session_id=f"{sec_id}__m{m_idx}",
                    section_id=sec_id,
                    course_id=course_id,
                    course_code=str(course.get("code") or sec.get("courseCode") or course_id),
                    course_title=str(course.get("title") or course.get("name") or sec_id),
                    instructor_id=instructor_id,
                    batch_id=str(group.get("batchId") or group_id),
                    student_group_id=group_id,
                    section_code=str(sec.get("sectionCode") or sec.get("name") or "A"),
                    session_type="Lab" if is_lab else "Theory",
                    meeting_index=m_idx,
                    expected_students=expected_students,
                    required_room_type="lab" if is_lab else "lecture",
                    required_equipment=req_equip,
                    preferred_room_id=sec.get("preferredRoomId") or group.get("homeRoomId"),
                )
            )

    return sessions


def get_compatible_rooms(
    session: SchedulingSession,
    rooms: List[RoomResource],
    unavailable_room_slots: Optional[Set[Tuple[str, str, str]]] = None,
    day: Optional[str] = None,
    covered_slots: Optional[List[str]] = None,
) -> List[RoomResource]:
    compatible: List[RoomResource] = []
    for r in rooms:
        if not r.is_available:
            continue
        is_lab_room = r.room_type.lower() == "lab"
        if session.session_type == "Lab" and not is_lab_room:
            continue
        if session.session_type != "Lab" and is_lab_room:
            continue
        if r.capacity < session.expected_students:
            continue
        if session.required_equipment:
            room_eq_lower = {eq.lower() for eq in r.equipment}
            if not all(req.lower() in room_eq_lower for req in session.required_equipment):
                continue
        if unavailable_room_slots and day and covered_slots:
            if any((r.room_id, day, st) in unavailable_room_slots for st in covered_slots):
                continue
        compatible.append(r)

    # Fallback if strict capacity filtered out all rooms of the right type
    if not compatible:
        for r in rooms:
            if not r.is_available:
                continue
            is_lab_room = r.room_type.lower() == "lab"
            if (session.session_type == "Lab") == is_lab_room:
                if unavailable_room_slots and day and covered_slots:
                    if any((r.room_id, day, st) in unavailable_room_slots for st in covered_slots):
                        continue
                compatible.append(r)

    # Sort preferred room first, then tightest capacity fit
    compatible.sort(
        key=lambda r: (
            0 if session.preferred_room_id and r.room_id == session.preferred_room_id else 1,
            abs(r.capacity - session.expected_students),
        )
    )
    return compatible
