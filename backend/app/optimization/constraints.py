"""Domain models, dynamic TimeSlot matrix (with Friday/Jummah rules), and credit-hour expansion."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

STANDARD_WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def canonicalize_working_days(days: Optional[List[str]], friday_enabled: bool = True) -> List[str]:
    """Enforce Mon..Thu..Fri ordering with Friday ALWAYS rightmost among standard weekdays."""
    raw = [str(d).strip()[:3].capitalize() for d in (days or ["Mon", "Tue", "Wed", "Thu", "Fri"]) if str(d).strip()]
    unique = []
    for d in STANDARD_WEEKDAY_ORDER:
        if d in raw:
            if d == "Fri" and not friday_enabled:
                continue
            unique.append(d)
    if not unique:
        return ["Mon", "Tue", "Wed", "Thu"] if not friday_enabled else ["Mon", "Tue", "Wed", "Thu", "Fri"]
    return unique


def parse_time_to_minutes(time_str: str) -> int:
    text = (time_str or "09:00").strip().upper()
    is_pm = "PM" in text
    is_am = "AM" in text
    clean = text.replace("AM", "").replace("PM", "").strip()
    parts = clean.split(":")
    h = int(parts[0])
    m = int(parts[1]) if len(parts) > 1 else 0
    if is_pm and h < 12:
        h += 12
    if is_am and h == 12:
        h = 0
    return h * 60 + m


def format_minutes_24h(minutes: int) -> str:
    h = (minutes // 60) % 24
    m = minutes % 60
    return f"{h:02d}:{m:02d}"


def format_minutes_12h(minutes: int) -> str:
    h24 = (minutes // 60) % 24
    m = minutes % 60
    ampm = "AM" if h24 < 12 else "PM"
    h12 = h24 % 12 or 12
    return f"{h12:02d}:{m:02d} {ampm}"


@dataclass
class TimeSlot:
    day: str
    slot_index: int
    start_min: int
    end_min: int
    cycle_end_min: int
    label: str
    session: str = "Morning"  # "Morning" | "Afternoon"
    slot_source: str = "regular"  # "regular" | "friday_special"

    @property
    def start_time(self) -> str:
        return format_minutes_24h(self.start_min)

    @property
    def end_time(self) -> str:
        return format_minutes_24h(self.end_min)

    @property
    def key(self) -> Tuple[str, int]:
        return (self.day, self.slot_index)


class TimeSlotConfig:
    """Dynamic university operating hours, breaks, labs, and dedicated Friday rules."""

    def __init__(
        self,
        working_days: Optional[List[str]] = None,
        day_start_time: str = "09:00",
        day_end_time: str = "17:00",
        period_length_minutes: int = 50,
        short_break_minutes: int = 10,
        midday_break_enabled: bool = True,
        midday_break_start: str = "13:00",
        midday_break_duration: int = 60,
        lab_duration_minutes: int = 180,
        lab_split_allowed: bool = False,
        friday_enabled: bool = True,
        friday_mode: str = "jummah_break",
        friday_start_time: Optional[str] = None,
        friday_end_time: Optional[str] = None,
        friday_break_start: str = "13:00",
        friday_break_end: str = "14:30",
        friday_closing_time: str = "13:00",
        friday_compression_scope: str = "none",
        friday_period_length: int = 40,
        friday_short_break: int = 5,
        friday_allowed_batches: Optional[List[str]] = None,
        friday_allowed_departments: Optional[List[str]] = None,
    ) -> None:
        self.friday_enabled = bool(friday_enabled)
        if working_days is not None and "Fri" not in [str(d).strip()[:3].capitalize() for d in working_days]:
            if friday_enabled is True:
                # Respect explicit omission of Fri from working_days unless Friday is explicitly forced
                self.friday_enabled = False

        self.working_days = canonicalize_working_days(working_days, self.friday_enabled)
        self.day_start_time = day_start_time
        self.day_end_time = day_end_time
        self.day_start_min = parse_time_to_minutes(day_start_time)
        self.day_end_min = parse_time_to_minutes(day_end_time)
        self.period_length_minutes = max(20, int(period_length_minutes))
        self.short_break_minutes = max(0, int(short_break_minutes))
        self.step_minutes = self.period_length_minutes + self.short_break_minutes
        self.midday_break_enabled = bool(midday_break_enabled)
        self.midday_break_start = midday_break_start
        self.midday_break_start_min = parse_time_to_minutes(midday_break_start)
        self.midday_break_duration = max(0, int(midday_break_duration)) if self.midday_break_enabled else 0
        self.midday_break_end_min = self.midday_break_start_min + self.midday_break_duration
        self.lab_duration_minutes = max(self.period_length_minutes, int(lab_duration_minutes))
        self.lab_split_allowed = bool(lab_split_allowed)

        # Friday settings
        self.friday_mode = friday_mode if friday_mode in ("jummah_break", "morning_only", "standard") else "jummah_break"
        self.friday_start_time = friday_start_time or day_start_time
        self.friday_start_min = parse_time_to_minutes(self.friday_start_time)
        self.friday_closing_time = friday_closing_time or "13:00"
        self.friday_end_time = friday_end_time or (
            self.friday_closing_time if self.friday_mode == "morning_only" else day_end_time
        )
        self.friday_end_min = parse_time_to_minutes(self.friday_end_time)
        self.friday_break_start = friday_break_start or "13:00"
        self.friday_break_end = friday_break_end or "14:30"
        self.friday_break_start_min = parse_time_to_minutes(self.friday_break_start)
        self.friday_break_end_min = parse_time_to_minutes(self.friday_break_end)
        self.friday_compression_scope = friday_compression_scope or "none"
        self.friday_period_length = max(20, min(self.period_length_minutes, int(friday_period_length or 40)))
        self.friday_short_break = max(0, int(friday_short_break or 0))
        self.friday_allowed_batches = [str(b).strip().upper() for b in (friday_allowed_batches or []) if str(b).strip()]
        self.friday_allowed_departments = [
            str(d).strip().upper() for d in (friday_allowed_departments or []) if str(d).strip()
        ]

        # Build regular daily slots
        self.slots: List[TimeSlot] = []
        self.day_slots_by_day: Dict[str, List[TimeSlot]] = {}
        self.breaks_by_day: Dict[str, List[Tuple[int, int]]] = {}

        regular_slots, regular_breaks = self._build_day_slots("Mon")
        self.slots = regular_slots
        self.friday_slots: List[TimeSlot] = []

        for day in self.working_days:
            if day == "Fri":
                f_slots, f_breaks = self._build_friday_slots()
                self.day_slots_by_day["Fri"] = f_slots
                self.breaks_by_day["Fri"] = f_breaks
                self.friday_slots = f_slots
            else:
                d_slots, d_breaks = self._build_day_slots(day)
                self.day_slots_by_day[day] = d_slots
                self.breaks_by_day[day] = d_breaks

        # Standard lecture slot span for full lab duration on Mon-Thu
        self.lab_span_slots = max(1, round(self.lab_duration_minutes / max(1, self.step_minutes)))
        if self.lab_span_slots * self.period_length_minutes < self.lab_duration_minutes - 30:
            self.lab_span_slots += 1

        # Memoization caches for tight solver inner loops
        self._win_cache: Dict[Tuple[str, int, int, bool], Optional[Tuple[int, int, List[int]]]] = {}
        self._valid_slots_cache: Dict[Tuple[str, int, bool], List[int]] = {}

    @classmethod
    def from_dict(cls, raw: Optional[Dict[str, Any]]) -> "TimeSlotConfig":
        if not raw:
            return cls()
        raw_days = raw.get("workingDays") or raw.get("working_days")
        if isinstance(raw_days, str):
            raw_days = [d.strip() for d in raw_days.split(",") if d.strip()]
        friday_enabled = raw.get("fridayEnabled", raw.get("friday_enabled"))
        if friday_enabled is None:
            friday_enabled = "Fri" in (raw_days or ["Mon", "Tue", "Wed", "Thu", "Fri"])
        return cls(
            working_days=raw_days,
            day_start_time=raw.get("dayStartTime") or raw.get("day_start_time") or "09:00",
            day_end_time=raw.get("dayEndTime") or raw.get("day_end_time") or "17:00",
            period_length_minutes=int(raw.get("periodLengthMinutes") or raw.get("period_length_minutes") or 50),
            short_break_minutes=int(
                raw.get("shortBreakMinutes")
                if "shortBreakMinutes" in raw
                else raw.get("short_break_minutes", 10)
            )
            if raw.get("shortBreakEnabled", True)
            else 0,
            midday_break_enabled=bool(raw.get("middayBreakEnabled", raw.get("midday_break_enabled", True))),
            midday_break_start=raw.get("middayBreakStartTime")
            or raw.get("middayBreakStart")
            or raw.get("midday_break_start")
            or "13:00",
            midday_break_duration=int(
                raw.get("middayBreakDurationMinutes")
                or raw.get("middayBreakDuration")
                or raw.get("midday_break_duration")
                or 60
            ),
            lab_duration_minutes=int(raw.get("labDurationMinutes") or raw.get("lab_duration_minutes") or 180),
            lab_split_allowed=bool(raw.get("labSplitAllowed", raw.get("lab_split_allowed", False))),
            friday_enabled=bool(friday_enabled),
            friday_mode=raw.get("fridayMode") or raw.get("friday_mode") or "jummah_break",
            friday_start_time=raw.get("fridayStartTime") or raw.get("friday_start_time"),
            friday_end_time=raw.get("fridayEndTime") or raw.get("friday_end_time"),
            friday_break_start=raw.get("fridayBreakStartTime")
            or raw.get("friday_break_start")
            or "13:00",
            friday_break_end=raw.get("fridayBreakEndTime")
            or raw.get("fridayAfternoonStartTime")
            or raw.get("friday_break_end")
            or "14:30",
            friday_closing_time=raw.get("fridayClosingTime") or raw.get("friday_closing_time") or "13:00",
            friday_compression_scope=raw.get("fridayCompressionScope")
            or raw.get("friday_compression_scope")
            or "none",
            friday_period_length=int(raw.get("fridayPeriodLengthMinutes") or raw.get("friday_period_length") or 40),
            friday_short_break=int(
                raw.get("fridayShortBreakMinutes")
                if "fridayShortBreakMinutes" in raw
                else raw.get("friday_short_break", 5)
            ),
            friday_allowed_batches=raw.get("fridayAllowedBatches") or raw.get("friday_allowed_batches") or [],
            friday_allowed_departments=raw.get("fridayAllowedDepartments")
            or raw.get("friday_allowed_departments")
            or [],
        )

    def _build_day_slots(self, day: str) -> Tuple[List[TimeSlot], List[Tuple[int, int]]]:
        slots: List[TimeSlot] = []
        breaks: List[Tuple[int, int]] = []
        if self.midday_break_enabled and self.midday_break_duration > 0:
            breaks.append((self.midday_break_start_min, self.midday_break_end_min))

        cursor = self.day_start_min
        idx = 0
        while cursor + self.period_length_minutes <= self.day_end_min:
            if (
                self.midday_break_enabled
                and self.midday_break_duration > 0
                and cursor < self.midday_break_end_min
                and cursor + self.period_length_minutes > self.midday_break_start_min
            ):
                cursor = self.midday_break_end_min
                continue

            end_min = cursor + self.period_length_minutes
            cycle_end = min(self.day_end_min, end_min + self.short_break_minutes)
            session = (
                "Afternoon"
                if (self.midday_break_enabled and cursor >= self.midday_break_end_min) or cursor >= 13 * 60
                else "Morning"
            )
            slots.append(
                TimeSlot(
                    day=day,
                    slot_index=idx,
                    start_min=cursor,
                    end_min=end_min,
                    cycle_end_min=cycle_end,
                    label=f"{format_minutes_12h(cursor)} - {format_minutes_12h(end_min)}",
                    session=session,
                    slot_source="regular",
                )
            )
            idx += 1
            cursor += self.step_minutes
        return slots, breaks

    def _build_friday_slots(self) -> Tuple[List[TimeSlot], List[Tuple[int, int]]]:
        if self.friday_mode == "standard" and self.friday_start_min == self.day_start_min and self.friday_end_min == self.day_end_min:
            return self._build_day_slots("Fri")

        slots: List[TimeSlot] = []
        breaks: List[Tuple[int, int]] = []
        idx = 0
        start_m = self.friday_start_min

        if self.friday_mode == "morning_only":
            closing = min(self.friday_end_min, parse_time_to_minutes(self.friday_closing_time))
            compress = self.friday_compression_scope in ("before_jummah", "all_day")
            plen = self.friday_period_length if compress else self.period_length_minutes
            sbrk = min(self.short_break_minutes, self.friday_short_break) if compress else self.short_break_minutes
            cursor = start_m
            while cursor + plen <= closing:
                end_m = cursor + plen
                slots.append(
                    TimeSlot(
                        day="Fri",
                        slot_index=idx,
                        start_min=cursor,
                        end_min=end_m,
                        cycle_end_min=min(closing, end_m + sbrk),
                        label=f"{format_minutes_12h(cursor)} - {format_minutes_12h(end_m)}",
                        session="Morning",
                        slot_source="friday_special",
                    )
                )
                idx += 1
                cursor += plen + sbrk
            return slots, breaks

        # Jummah break mode (or standard with custom start/end)
        j_start = self.friday_break_start_min if self.friday_mode == "jummah_break" else self.midday_break_start_min
        j_end = self.friday_break_end_min if self.friday_mode == "jummah_break" else self.midday_break_end_min
        if j_end > j_start:
            breaks.append((j_start, j_end))

        # Morning window
        compress_am = self.friday_compression_scope in ("before_jummah", "all_day")
        plen_am = self.friday_period_length if compress_am else self.period_length_minutes
        sbrk_am = min(self.short_break_minutes, self.friday_short_break) if compress_am else self.short_break_minutes
        cursor = start_m
        while cursor + plen_am <= min(j_start, self.friday_end_min):
            end_m = cursor + plen_am
            slots.append(
                TimeSlot(
                    day="Fri",
                    slot_index=idx,
                    start_min=cursor,
                    end_min=end_m,
                    cycle_end_min=min(j_start, end_m + sbrk_am),
                    label=f"{format_minutes_12h(cursor)} - {format_minutes_12h(end_m)}",
                    session="Morning",
                    slot_source="friday_special",
                )
            )
            idx += 1
            cursor += plen_am + sbrk_am

        # Afternoon window after Jummah break
        compress_pm = self.friday_compression_scope in ("after_jummah", "all_day")
        plen_pm = self.friday_period_length if compress_pm else self.period_length_minutes
        sbrk_pm = min(self.short_break_minutes, self.friday_short_break) if compress_pm else self.short_break_minutes
        cursor = max(j_end, start_m)
        while cursor + plen_pm <= self.friday_end_min:
            end_m = cursor + plen_pm
            slots.append(
                TimeSlot(
                    day="Fri",
                    slot_index=idx,
                    start_min=cursor,
                    end_min=end_m,
                    cycle_end_min=min(self.friday_end_min, end_m + sbrk_pm),
                    label=f"{format_minutes_12h(cursor)} - {format_minutes_12h(end_m)}",
                    session="Afternoon",
                    slot_source="friday_special",
                )
            )
            idx += 1
            cursor += plen_pm + sbrk_pm

        return slots, breaks

    def get_day_slots(self, day: str) -> List[TimeSlot]:
        return self.day_slots_by_day.get(day, [])

    def get_day_breaks(self, day: str) -> List[Tuple[int, int]]:
        return self.breaks_by_day.get(day, [])

    def is_friday_eligible(
        self,
        batch_code: str = "",
        batch_id: str = "",
        department_id: str = "",
        department_code: str = "",
    ) -> bool:
        if not self.friday_enabled or "Fri" not in self.working_days:
            return False
        if self.friday_allowed_batches:
            b_candidates = {str(batch_code or "").upper(), str(batch_id or "").upper()}
            if not any(c in self.friday_allowed_batches for c in b_candidates if c):
                return False
        if self.friday_allowed_departments:
            d_candidates = {str(department_id or "").upper(), str(department_code or "").upper()}
            if not any(c in self.friday_allowed_departments for c in d_candidates if c):
                return False
        return True

    def get_slot(self, day: str, slot_index: int) -> Optional[TimeSlot]:
        day_slots = self.get_day_slots(day)
        if 0 <= slot_index < len(day_slots):
            return day_slots[slot_index]
        return None

    def get_slots_per_day(self, day: str = "Mon") -> int:
        return len(self.get_day_slots(day))

    def compute_session_window(
        self,
        day: str,
        slot_index: int,
        duration_minutes: int,
        is_lab: bool = False,
    ) -> Optional[Tuple[int, int, List[int]]]:
        """Return (start_min, end_min, covered_slot_indices) if the block fits cleanly without crossing breaks or closing time."""
        cache_key = (day, slot_index, duration_minutes, bool(is_lab))
        cached = self._win_cache.get(cache_key)
        if cached is not None or cache_key in self._win_cache:
            return cached

        res = self._compute_session_window_uncached(day, slot_index, duration_minutes, is_lab)
        self._win_cache[cache_key] = res
        return res

    def _compute_session_window_uncached(
        self,
        day: str,
        slot_index: int,
        duration_minutes: int,
        is_lab: bool = False,
    ) -> Optional[Tuple[int, int, List[int]]]:
        day_slots = self.get_day_slots(day)
        if not day_slots or slot_index < 0 or slot_index >= len(day_slots):
            return None

        anchor = day_slots[slot_index]
        start_min = anchor.start_min
        breaks = self.get_day_breaks(day)
        day_close = max(s.cycle_end_min for s in day_slots) if day_slots else self.day_end_min

        # Multi-hour / continuous Lab or 2h Lecture span
        if is_lab or duration_minutes > anchor.end_min - anchor.start_min + 15:
            needed_slots = max(1, round(duration_minutes / max(1, (anchor.cycle_end_min - anchor.start_min))))
            if needed_slots > 1 and slot_index + needed_slots <= len(day_slots):
                covered = day_slots[slot_index : slot_index + needed_slots]
                # All covered slots must belong to same morning/afternoon session (never split across break!)
                if len({s.session for s in covered}) > 1:
                    return None
                end_min = covered[-1].end_min
                # Exact continuous block clamped cleanly
                is_compressed_fri = day == "Fri" and (covered[-1].end_min - covered[-1].start_min) < self.period_length_minutes
                if is_lab and duration_minutes >= 165 and not is_compressed_fri:
                    # Preserve full configured lab end (e.g., 12:00 for 09:00 3h lab when step is 60m)
                    end_min = max(end_min, start_min + duration_minutes)
                    if end_min > day_close + 10:
                        return None
                # Ensure no break intersection
                for b_start, b_end in breaks:
                    if start_min < b_end and end_min > b_start:
                        return None
                return (start_min, end_min, [s.slot_index for s in covered])

            # What if duration fits by clock time inside a continuous morning/afternoon block without breaking?
            end_min = start_min + duration_minutes
            if end_min > day_close + 5:
                return None
            for b_start, b_end in breaks:
                if start_min < b_end and end_min > b_start:
                    return None
            covered_indices = [
                s.slot_index for s in day_slots if s.start_min < end_min and s.end_min > start_min
            ]
            return (start_min, end_min, covered_indices or [slot_index])

        # Standard single-period lecture (uses day's exact lecture slot duration)
        return (anchor.start_min, anchor.end_min, [slot_index])

    def generate_daily_lecture_slots(self, day: str = "Mon") -> List[str]:
        """Return ordered HH:MM lecture slot start times for the given operating day."""
        target_day = day if day in self.day_slots_by_day else (self.working_days[0] if self.working_days else "Mon")
        return [s.start_time for s in self.get_day_slots(target_day)]

    def generate_valid_lab_start_slots(self, day: str = "Mon") -> List[str]:
        """Return HH:MM start times on the given day where a continuous lab fits cleanly."""
        target_day = day if day in self.day_slots_by_day else (self.working_days[0] if self.working_days else "Mon")
        slots = self.get_day_slots(target_day)
        valid_starts: List[str] = []
        for idx, s in enumerate(slots):
            if self.compute_session_window(target_day, idx, self.lab_duration_minutes, is_lab=True) is not None:
                valid_starts.append(s.start_time)
        return valid_starts

    def covered_lecture_slots(self, start_time: str, is_lab: bool = False, day: str = "Mon") -> List[str]:
        """Return all HH:MM slot start times covered by a session beginning at start_time."""
        target_day = day if day in self.day_slots_by_day else (self.working_days[0] if self.working_days else "Mon")
        slots = self.get_day_slots(target_day)
        if not slots:
            return [start_time]
        target_min = parse_time_to_minutes(start_time)
        slot_idx = 0
        best_diff = 10**9
        for s in slots:
            diff = abs(s.start_min - target_min)
            if diff < best_diff:
                best_diff = diff
                slot_idx = s.slot_index
        dur = self.lab_duration_minutes if is_lab else self.period_length_minutes
        win = self.compute_session_window(target_day, slot_idx, dur, is_lab=is_lab)
        if win is None:
            return [start_time]
        _, _, covered_indices = win
        return [slots[i].start_time for i in covered_indices if 0 <= i < len(slots)] or [start_time]

    def get_valid_start_slots_for_session(self, session: "ScheduleSession", day: str) -> List[int]:
        if day == "Fri" and not session.friday_eligible:
            return []
        cache_key = (day, session.duration_minutes, bool(session.is_lab))
        cached = self._valid_slots_cache.get(cache_key)
        if cached is not None:
            return cached
        day_slots = self.get_day_slots(day)
        if not day_slots:
            self._valid_slots_cache[cache_key] = []
            return []
        valid: List[int] = []
        for idx in range(len(day_slots)):
            if self.compute_session_window(day, idx, session.duration_minutes, session.is_lab) is not None:
                valid.append(idx)
        self._valid_slots_cache[cache_key] = valid
        return valid

    def to_metadata(self) -> Dict[str, Any]:
        return {
            "workingDays": list(self.working_days),
            "dayStartTime": self.day_start_time,
            "dayEndTime": self.day_end_time,
            "periodLengthMinutes": self.period_length_minutes,
            "shortBreakMinutes": self.short_break_minutes,
            "middayBreakEnabled": self.midday_break_enabled,
            "middayBreakStart": self.midday_break_start,
            "middayBreakDuration": self.midday_break_duration,
            "labDurationMinutes": self.lab_duration_minutes,
            "labSplitAllowed": self.lab_split_allowed,
            "fridayEnabled": self.friday_enabled,
            "fridayMode": self.friday_mode,
            "fridayStartTime": self.friday_start_time,
            "fridayEndTime": self.friday_end_time,
            "fridayBreakStart": self.friday_break_start,
            "fridayBreakEnd": self.friday_break_end,
            "fridayClosingTime": self.friday_closing_time,
            "fridayCompressionScope": self.friday_compression_scope,
            "fridayPeriodLength": self.friday_period_length,
            "fridayShortBreak": self.friday_short_break,
            "fridayAllowedBatches": list(self.friday_allowed_batches),
            "fridayAllowedDepartments": list(self.friday_allowed_departments),
            "slotsPerDay": self.get_slots_per_day("Mon"),
            "slots": [
                {
                    "slotIndex": s.slot_index,
                    "startTime": s.start_time,
                    "endTime": s.end_time,
                    "label": s.label,
                    "session": s.session,
                }
                for s in self.slots
            ],
            "fridaySlots": [
                {
                    "slotIndex": s.slot_index,
                    "startTime": s.start_time,
                    "endTime": s.end_time,
                    "label": s.label,
                    "session": s.session,
                }
                for s in self.friday_slots
            ],
        }


@dataclass
class ScheduleSession:
    """Single atomic schedulable class unit (e.g., 1h Lecture, 2h Lecture, or 3h Continuous Lab)."""

    session_id: str
    section_id: str
    course_id: str
    course_code: str
    course_title: str
    session_type: str  # "Theory" | "Lab" | "Tutorial"
    component_type: str  # "lecture" | "lab" | "tutorial"
    course_type: str  # "lecture" | "lab" | "lecture_lab"
    meeting_index: int
    meetings_total: int
    duration_minutes: int
    is_lab: bool
    instructor_id: str
    instructor_name: str
    batch_id: str
    batch_code: str
    department_id: str = ""
    department_code: str = ""
    section_code: str = "A"
    expected_students: int = 45
    required_room_type: str = "lecture"
    required_equipment: List[str] = field(default_factory=list)
    shared_group_ids: List[str] = field(default_factory=list)
    lab_engineer_id: Optional[str] = None
    lab_engineer_name: Optional[str] = None
    assigned_lab_id: Optional[str] = None
    assigned_instructor_locked: bool = True
    is_split_lab: bool = False
    lecture_credit_hours: int = 3
    lab_credit_hours: int = 0
    credit_hours: int = 3
    friday_eligible: bool = True
    is_locked: bool = False
    pinned_slot: Optional[Tuple[str, int, str]] = None

    @property
    def student_group_id(self) -> str:
        return self.batch_id

    @property
    def student_group_keys(self) -> List[str]:
        keys = [self.batch_id]
        for sg in self.shared_group_ids:
            if sg and sg not in keys:
                keys.append(sg)
        return keys

    @property
    def staff_ids(self) -> List[str]:
        ids: List[str] = []
        if self.instructor_id:
            ids.append(self.instructor_id)
        if self.lab_engineer_id and self.lab_engineer_id not in ids:
            ids.append(self.lab_engineer_id)
        return ids


SchedulingSession = ScheduleSession


@dataclass
class RoomResource:
    """Room / laboratory resource descriptor compatible with both dict and dataclass callers."""

    room_id: str
    code: str
    name: str
    capacity: int = 60
    room_type: str = "lecture"
    equipment: List[str] = field(default_factory=list)
    is_available: bool = True
    assigned_lab_engineer_id: Optional[str] = None

    @property
    def id(self) -> str:
        return self.room_id

    @property
    def type(self) -> str:
        return self.room_type

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.room_id,
            "room_id": self.room_id,
            "code": self.code,
            "name": self.name,
            "capacity": self.capacity,
            "type": self.room_type,
            "room_type": self.room_type,
            "equipment": list(self.equipment),
            "isAvailable": self.is_available,
            "is_available": self.is_available,
            "assignedLabEngineerId": self.assigned_lab_engineer_id,
        }


def normalize_rooms_input(rooms_raw: List[Any]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for r in rooms_raw or []:
        if isinstance(r, RoomResource):
            normalized.append(r.to_dict())
        elif isinstance(r, dict):
            rid = str(r.get("id") or r.get("room_id") or r.get("code") or "")
            normalized.append(
                {
                    **r,
                    "id": rid,
                    "room_id": rid,
                    "code": str(r.get("code") or rid),
                    "name": str(r.get("name") or r.get("code") or rid),
                    "capacity": int(r.get("capacity") or 60),
                    "type": str(r.get("type") or r.get("room_type") or "lecture"),
                    "equipment": list(r.get("equipment") or []),
                    "isAvailable": bool(r.get("is_available", r.get("isAvailable", True))),
                    "is_available": bool(r.get("is_available", r.get("isAvailable", True))),
                }
            )
    return normalized


def get_compatible_rooms(session: ScheduleSession, rooms: List[Any]) -> List[RoomResource]:
    """Return rooms compatible with room type, capacity, availability, equipment, and admin-assigned lab, tightest capacity first."""
    dicts = normalize_rooms_input(rooms)
    if session.is_lab and session.assigned_lab_id:
        pinned = [
            RoomResource(
                room_id=r["id"],
                code=r["code"],
                name=r["name"],
                capacity=int(r["capacity"]),
                room_type=r["type"],
                equipment=list(r.get("equipment") or []),
                is_available=bool(r["is_available"]),
                assigned_lab_engineer_id=r.get("assignedLabEngineerId") or r.get("assigned_lab_engineer_id"),
            )
            for r in dicts
            if r["id"] == session.assigned_lab_id and r.get("is_available", True)
        ]
        return pinned

    compat: List[RoomResource] = []
    req_eq = {str(e).lower() for e in session.required_equipment if e}
    for r in dicts:
        if not r.get("is_available", True):
            continue
        r_type = str(r.get("type") or "lecture").lower()
        if session.is_lab and "lab" not in r_type:
            continue
        if not session.is_lab and "lab" in r_type:
            continue
        if session.expected_students > int(r.get("capacity") or 50):
            continue
        room_eq = {str(e).lower() for e in (r.get("equipment") or [])}
        if req_eq and not req_eq.issubset(room_eq):
            continue
        compat.append(
            RoomResource(
                room_id=r["id"],
                code=r["code"],
                name=r["name"],
                capacity=int(r["capacity"]),
                room_type=r["type"],
                equipment=list(r.get("equipment") or []),
                is_available=bool(r["is_available"]),
                assigned_lab_engineer_id=r.get("assignedLabEngineerId") or r.get("assigned_lab_engineer_id"),
            )
        )
    if not compat:
        for r in dicts:
            if not r.get("is_available", True):
                continue
            r_type = str(r.get("type") or "lecture").lower()
            if (session.is_lab and "lab" in r_type) or (not session.is_lab and "lab" not in r_type):
                compat.append(
                    RoomResource(
                        room_id=r["id"],
                        code=r["code"],
                        name=r["name"],
                        capacity=int(r["capacity"]),
                        room_type=r["type"],
                        equipment=list(r.get("equipment") or []),
                        is_available=bool(r["is_available"]),
                        assigned_lab_engineer_id=r.get("assignedLabEngineerId") or r.get("assigned_lab_engineer_id"),
                    )
                )
    compat.sort(key=lambda rm: (abs(rm.capacity - session.expected_students), rm.code))
    return compat


def _infer_course_components(course: Dict[str, Any]) -> Tuple[str, int, int]:
    """Derive canonical (course_type, lecture_credits, lab_credits) adhering strictly to 1 CR lec=1h, 1 CR lab=3h."""
    raw_type = str(course.get("courseType") or course.get("course_type") or "").strip().lower()
    legacy_type = str(course.get("type") or course.get("requiredRoomType") or course.get("required_room_type") or "").strip().lower()
    code = str(course.get("code") or "").upper()

    lec_cr_raw = course.get("lectureCredits", course.get("lecture_credit_hours"))
    lab_cr_raw = course.get("labCredits", course.get("lab_credit_hours"))
    lec_hrs_raw = course.get("lectureHours", course.get("lecture_hours_per_week"))
    lab_hrs_raw = course.get("labHours", course.get("lab_hours_per_week"))

    if lec_cr_raw is not None or lab_cr_raw is not None:
        lec_cr = max(0, int(lec_cr_raw or 0))
        lab_cr = max(0, int(lab_cr_raw or 0))
    elif lec_hrs_raw is not None or lab_hrs_raw is not None:
        lec_cr = max(0, int(lec_hrs_raw or 0))
        lab_h = max(0, int(lab_hrs_raw or 0))
        lab_cr = max(1, round(lab_h / 3)) if lab_h > 0 else 0
    else:
        is_pure_lab = raw_type == "lab" or legacy_type == "lab" or code.endswith("-L")
        credits = max(1, int(course.get("creditHours") or course.get("credit_hours") or (1 if is_pure_lab else 3)))
        if is_pure_lab:
            lec_cr = 0
            lab_cr = credits
        else:
            lec_cr = credits
            lab_cr = 0

    if raw_type in ("lecture", "lab", "lecture_lab"):
        ctype = raw_type
    elif lec_cr > 0 and lab_cr > 0:
        ctype = "lecture_lab"
    elif lab_cr > 0:
        ctype = "lab"
    else:
        ctype = "lecture"

    return ctype, lec_cr, lab_cr


def expand_sections_to_sessions(
    courses: List[Dict[str, Any]],
    sections: List[Dict[str, Any]],
    rooms: Optional[List[Any]] = None,
    instructors: Optional[List[Dict[str, Any]]] = None,
    time_config: Optional[TimeSlotConfig] = None,
) -> List[ScheduleSession]:
    """
    Expand sections + academic credit-hour rules into canonical ScheduleSession units.
    Supports both canonical (courses, sections, rooms, instructors, time_config)
    and legacy (sections, courses, student_groups) positional calls.
    Rules enforced:
      - Lecture 1 CR = 1h/week
      - Lab 1 CR = 3h/week (3h continuous default; split into 90m blocks only if split enabled)
      - Respects pre-expanded atomic sessions (isAtomicSession / sessionsPerWeek == 1 on singletons)
      - Never silently replaces admin-assigned Instructor or Lab Engineer.
    """
    student_groups_map: Dict[str, Dict[str, Any]] = {}
    first_looks_like_sections = bool(courses) and any(
        "courseId" in item or "course_id" in item or "studentGroupId" in item for item in courses
    )
    second_looks_like_courses = bool(sections) and any(
        ("code" in item or "title" in item or "name" in item) and "courseId" not in item and "course_id" not in item
        for item in sections
    )
    if first_looks_like_sections and second_looks_like_courses:
        legacy_sections = courses
        legacy_courses = sections
        legacy_groups = rooms or []
        courses = legacy_courses
        sections = legacy_sections
        for g in legacy_groups:
            if isinstance(g, dict) and g.get("id"):
                student_groups_map[str(g["id"])] = g
                if g.get("batchId"):
                    student_groups_map[str(g["batchId"])] = g
        rooms = []
        instructors = instructors or []

    course_by_id = {c["id"]: c for c in courses if c.get("id")}
    inst_by_id = {i["id"]: i for i in (instructors or []) if i.get("id")}
    cfg = time_config or TimeSlotConfig()

    raw_sections = list(sections) if sections else []
    if not raw_sections and courses:
        for idx, c in enumerate(courses):
            ctype, lec_cr, lab_cr = _infer_course_components(c)
            if lec_cr > 0:
                raw_sections.append(
                    {
                        "id": f"sec-{c['id']}-lec",
                        "courseId": c["id"],
                        "instructorId": c.get("assignedInstructorId") or c.get("assigned_instructor_id") or c.get("instructor_id") or "",
                        "batchId": c.get("assignedBatchId") or c.get("assigned_batch_id") or c.get("batch_id") or f"batch-default-{idx}",
                        "batchCode": c.get("batchCode") or c.get("batch_code") or "Cohort",
                        "sectionCode": "A",
                        "sessionType": "Theory",
                        "componentType": "lecture",
                        "sessionsPerWeek": lec_cr,
                        "durationMinutes": cfg.period_length_minutes,
                        "expectedStudents": c.get("studentCount") or c.get("student_count") or 45,
                        "requiredRoomType": c.get("requiredRoomType") or c.get("required_room_type") or "lecture",
                        "requiredEquipment": c.get("requiredEquipment") or c.get("required_equipment") or [],
                    }
                )
            if lab_cr > 0:
                raw_sections.append(
                    {
                        "id": f"sec-{c['id']}-lab",
                        "courseId": c["id"],
                        "instructorId": c.get("assignedInstructorId") or c.get("assigned_instructor_id") or c.get("instructor_id") or "",
                        "labEngineerId": c.get("assignedLabEngineerId") or c.get("assigned_lab_engineer_id") or c.get("lab_engineer_id") or "",
                        "batchId": c.get("assignedBatchId") or c.get("assigned_batch_id") or c.get("batch_id") or f"batch-default-{idx}",
                        "batchCode": c.get("batchCode") or c.get("batch_code") or "Cohort",
                        "sectionCode": "A",
                        "sessionType": "Lab",
                        "componentType": "lab",
                        "sessionsPerWeek": lab_cr,
                        "durationMinutes": cfg.lab_duration_minutes,
                        "expectedStudents": c.get("studentCount") or c.get("student_count") or 40,
                        "requiredRoomType": "lab",
                        "requiredEquipment": c.get("requiredEquipment") or c.get("required_equipment") or [],
                    }
                )

    expanded: List[ScheduleSession] = []
    for sec in raw_sections:
        sec_id = sec.get("id") or f"sec-{len(expanded)}"
        course_id = sec.get("courseId") or sec.get("course_id") or ""
        course = course_by_id.get(course_id, {})

        ctype, lec_cr, lab_cr = _infer_course_components(course)
        sec_type_raw = str(sec.get("sessionType") or sec.get("session_type") or "").strip().lower()
        comp_raw = str(sec.get("componentType") or sec.get("component_type") or "").strip().lower()
        is_lab = (
            comp_raw == "lab"
            or "lab" in sec_type_raw
            or str(sec.get("requiredRoomType") or sec.get("required_room_type") or "").lower() == "lab"
            or (ctype == "lab" and comp_raw != "lecture" and sec_type_raw != "theory" and sec_type_raw != "lecture")
        )
        component_type = "lab" if is_lab else ("tutorial" if "tutorial" in sec_type_raw else "lecture")

        is_atomic = bool(sec.get("isAtomicSession") or sec.get("is_atomic_session"))
        explicit_meetings = sec.get("sessionsPerWeek", sec.get("sessions_per_week", sec.get("meetingsPerWeek")))

        allow_split = bool(
            sec.get("labSplitAllowed")
            or sec.get("lab_split_allowed")
            or course.get("labSessionMode") == "split_allowed"
            or course.get("lab_session_mode") == "split_allowed"
            or cfg.lab_split_allowed
        )

        # Determine number of meetings & per-meeting duration cleanly
        if is_atomic or (explicit_meetings is not None and int(explicit_meetings) == 1):
            meetings_count = 1
            if is_lab:
                default_dur = int(sec.get("durationMinutes") or sec.get("duration_minutes") or cfg.lab_duration_minutes)
            else:
                default_dur = int(sec.get("durationMinutes") or sec.get("duration_minutes") or cfg.period_length_minutes)
            is_split_lab = bool(sec.get("isSplitLab") or (is_lab and default_dur < 150))
            durations = [default_dur]
        elif is_lab:
            total_lab_hours = int(course.get("labHours") or course.get("lab_hours_per_week") or (lab_cr * 3) or 3)
            blocks_needed = max(1, round(total_lab_hours / 3))
            if explicit_meetings is not None and int(explicit_meetings) >= blocks_needed:
                blocks_needed = int(explicit_meetings)
            if allow_split and sec.get("preferSplitLab"):
                # Split each 3h lab credit into two 90-min blocks
                meetings_count = blocks_needed * 2
                durations = [90] * meetings_count
                is_split_lab = True
            else:
                meetings_count = blocks_needed
                durations = [cfg.lab_duration_minutes] * meetings_count
                is_split_lab = False
        else:
            # Lecture: 1 credit hour = 1 scheduled lecture hour per week (or optional 2h continuous block)
            if explicit_meetings is not None:
                lec_hours = max(1, int(explicit_meetings))
            else:
                lec_hours = max(
                    1,
                    int(course.get("lectureHours") or course.get("lecture_hours_per_week") or lec_cr or 3),
                )
            allow_double = bool(sec.get("preferDoubleLecture") or course.get("preferDoubleLecture"))
            if allow_double and lec_hours >= 2:
                doubles = lec_hours // 2
                singles = lec_hours % 2
                durations = [cfg.period_length_minutes * 2 + cfg.short_break_minutes] * doubles + [
                    cfg.period_length_minutes
                ] * singles
                meetings_count = len(durations)
            else:
                meetings_count = lec_hours
                unit_dur = int(sec.get("durationMinutes") or sec.get("duration_minutes") or cfg.period_length_minutes)
                durations = [unit_dur] * meetings_count
            is_split_lab = False

        # Admin-assigned instructor / lab engineer resolution (NO random swapping!)
        assigned_course_inst = (
            sec.get("instructorId")
            or sec.get("instructor_id")
            or course.get("assignedInstructorId")
            or course.get("assigned_instructor_id")
            or course.get("instructor_id")
            or ""
        )
        assigned_course_lab_eng = (
            sec.get("labEngineerId")
            or sec.get("lab_engineer_id")
            or course.get("assignedLabEngineerId")
            or course.get("assigned_lab_engineer_id")
            or course.get("lab_engineer_id")
        )

        if is_lab:
            primary_staff_id = str(assigned_course_lab_eng or assigned_course_inst or "")
            lab_eng_id = str(assigned_course_lab_eng or primary_staff_id or "") or None
        else:
            primary_staff_id = str(assigned_course_inst or "")
            lab_eng_id = str(assigned_course_lab_eng) if assigned_course_lab_eng else None

        primary_staff_name = (
            inst_by_id.get(primary_staff_id, {}).get("name")
            or sec.get("instructorName")
            or ("Unassigned Instructor" if not primary_staff_id else primary_staff_id)
        )
        lab_eng_name = (
            (inst_by_id.get(lab_eng_id, {}).get("name") if lab_eng_id else None)
            or sec.get("labEngineerName")
            or (primary_staff_name if is_lab else None)
        )

        batch_id = str(
            sec.get("studentGroupId")
            or sec.get("batchId")
            or sec.get("batch_id")
            or course.get("assignedBatchId")
            or course.get("assigned_batch_id")
            or "cohort-default"
        )
        batch_code = str(sec.get("batchCode") or sec.get("batch_code") or sec.get("cohortCode") or batch_id)
        dept_id = str(sec.get("departmentId") or sec.get("department_id") or course.get("departmentId") or course.get("department_id") or "")
        dept_code = str(sec.get("departmentCode") or sec.get("department_code") or course.get("departmentCode") or course.get("department_code") or "")

        friday_ok = cfg.is_friday_eligible(
            batch_code=batch_code,
            batch_id=batch_id,
            department_id=dept_id,
            department_code=dept_code,
        )

        locked_flag = bool(sec.get("isLocked") or sec.get("locked") or sec.get("is_locked"))
        pinned = sec.get("pinnedSlot") or sec.get("assignedSlot")

        for m_idx in range(meetings_count):
            sess_id = sec_id if (is_atomic or meetings_count == 1) else f"{sec_id}_m{m_idx}"
            pinned_tuple: Optional[Tuple[str, int, str]] = None
            if locked_flag and isinstance(pinned, dict) and pinned.get("day") and pinned.get("roomId"):
                day_slots = cfg.get_day_slots(pinned["day"])
                target_start = pinned.get("startTime") or pinned.get("period", "").split(" - ")[0]
                slot_idx = 0
                if target_start:
                    t_min = parse_time_to_minutes(target_start)
                    best_diff = 10**9
                    for s in day_slots:
                        diff = abs(s.start_min - t_min)
                        if diff < best_diff:
                            best_diff = diff
                            slot_idx = s.slot_index
                pinned_tuple = (pinned["day"], slot_idx, pinned["roomId"])

            assigned_lab_raw = (
                str(
                    sec.get("assignedLabId")
                    or sec.get("assigned_lab_id")
                    or course.get("assignedLabId")
                    or course.get("assigned_lab_id")
                    or ""
                ).strip()
                or None
            )

            expanded.append(
                ScheduleSession(
                    session_id=sess_id,
                    section_id=sec_id,
                    course_id=course_id,
                    course_code=str(course.get("code") or sec.get("courseCode") or "COURSE"),
                    course_title=str(course.get("title") or course.get("name") or sec.get("courseTitle") or "Academic Session"),
                    session_type="Lab" if is_lab else ("Tutorial" if component_type == "tutorial" else "Theory"),
                    component_type=component_type,
                    course_type=ctype,
                    meeting_index=m_idx,
                    meetings_total=meetings_count,
                    duration_minutes=durations[m_idx],
                    is_lab=is_lab,
                    instructor_id=primary_staff_id,
                    instructor_name=primary_staff_name,
                    batch_id=batch_id,
                    batch_code=batch_code,
                    department_id=dept_id,
                    department_code=dept_code,
                    section_code=str(sec.get("sectionCode") or sec.get("sectionNumber") or "A"),
                    expected_students=max(1, int(sec.get("expectedStudents") or sec.get("expected_students") or sec.get("expectedEnrollment") or 45)),
                    required_room_type="lab" if is_lab else str(sec.get("requiredRoomType") or sec.get("required_room_type") or course.get("requiredRoomType") or "lecture").lower(),
                    required_equipment=list(
                        sec.get("requiredEquipment")
                        or sec.get("required_equipment")
                        or ((course.get("requiredEquipment") or course.get("required_equipment")) if (is_lab or ctype == "lab") else [])
                        or []
                    ),
                    shared_group_ids=list(sec.get("sharedGroupIds") or sec.get("shared_group_ids") or []),
                    lab_engineer_id=lab_eng_id,
                    lab_engineer_name=lab_eng_name,
                    assigned_lab_id=assigned_lab_raw if is_lab else None,
                    assigned_instructor_locked=True,
                    is_split_lab=is_split_lab,
                    lecture_credit_hours=lec_cr,
                    lab_credit_hours=lab_cr,
                    credit_hours=max(1, lec_cr + lab_cr),
                    friday_eligible=friday_ok,
                    is_locked=locked_flag,
                    pinned_slot=pinned_tuple,
                )
            )

    return expanded


def validate_pre_generation_inputs(
    sessions: List[ScheduleSession],
    rooms: List[Any],
    instructors: Optional[List[Dict[str, Any]]] = None,
    time_config: Optional[TimeSlotConfig] = None,
) -> Dict[str, Any]:
    """Validate academic configuration, instructor/lab-engineer presence, and resource feasibility before generation."""
    errors: List[str] = []
    warnings: List[str] = []
    cfg = time_config or TimeSlotConfig()
    norm_rooms = normalize_rooms_input(rooms)

    if not sessions:
        errors.append("No active course sessions or credit-hour blocks were provided to schedule.")
        return {"valid": False, "errors": errors, "warnings": warnings}

    avail_rooms = [r for r in norm_rooms if r.get("is_available", r.get("isAvailable", True))]
    if not avail_rooms:
        errors.append("No available classrooms or laboratories exist.")
        return {"valid": False, "errors": errors, "warnings": warnings}

    lab_rooms = [r for r in avail_rooms if "lab" in str(r.get("type") or r.get("room_type") or "").lower()]
    lec_rooms = [r for r in avail_rooms if "lab" not in str(r.get("type") or r.get("room_type") or "").lower()]

    total_slots_per_week = sum(len(cfg.get_day_slots(d)) for d in cfg.working_days)
    if total_slots_per_week == 0:
        errors.append("Zero teaching slots exist in the configured academic schedule.")

    inst_hours: Dict[str, float] = {}
    group_minutes: Dict[str, int] = {}
    inst_by_id = {i["id"]: i for i in (instructors or []) if i.get("id")}

    room_by_id = {r["id"]: r for r in norm_rooms if r.get("id")}
    for sess in sessions:
        if sess.is_lab:
            if not sess.lab_engineer_id and not sess.instructor_id:
                errors.append(
                    f"Lab session {sess.course_code} ({sess.batch_code}) has no assigned Lab Engineer."
                )
            if not lab_rooms:
                errors.append(
                    f"Lab session {sess.course_code} requires a Laboratory room, but zero laboratories are available."
                )
            if sess.assigned_lab_id:
                assigned_lab = room_by_id.get(sess.assigned_lab_id)
                if not assigned_lab or not assigned_lab.get("is_available", True):
                    errors.append(
                        f"Lab session {sess.course_code} ({sess.batch_code}) references unavailable or missing laboratory ({sess.assigned_lab_id})."
                    )
        else:
            if not sess.instructor_id:
                errors.append(
                    f"Lecture session {sess.course_code} ({sess.batch_code}) has no assigned Instructor."
                )
            if not lec_rooms and not avail_rooms:
                errors.append(
                    f"Lecture session {sess.course_code} has no available classroom."
                )

        # Room capacity + equipment feasibility check
        candidate_pool = lab_rooms if sess.is_lab else (lec_rooms or avail_rooms)
        req_eq = {e.lower() for e in sess.required_equipment if e}
        fitting_rooms = [
            r
            for r in candidate_pool
            if int(r.get("capacity") or 50) >= sess.expected_students
            and req_eq.issubset({str(eq).lower() for eq in (r.get("equipment") or [])})
        ]
        if not fitting_rooms and candidate_pool:
            max_cap = max(int(r.get("capacity") or 0) for r in candidate_pool)
            if max_cap < sess.expected_students:
                warnings.append(
                    f"{sess.course_code} ({sess.batch_code}) has {sess.expected_students} students, exceeding max room capacity ({max_cap})."
                )
            elif req_eq:
                warnings.append(
                    f"{sess.course_code} requires equipment [{', '.join(sess.required_equipment)}] not matched cleanly in candidate rooms."
                )

        # Track staff and batch load
        for staff_id in sess.staff_ids:
            inst_hours[staff_id] = inst_hours.get(staff_id, 0.0) + (sess.duration_minutes / 60.0)
        for gk in sess.student_group_keys:
            group_minutes[gk] = group_minutes.get(gk, 0) + sess.duration_minutes

        # Check Friday pinned slot conflicts
        if sess.is_locked and sess.pinned_slot:
            p_day, _, _ = sess.pinned_slot
            if p_day == "Fri" and not sess.friday_eligible:
                errors.append(
                    f"{sess.course_code} ({sess.batch_code}) is locked on Friday, but Friday scheduling is disabled/restricted for this batch."
                )

    for staff_id, req_hrs in inst_hours.items():
        inst = inst_by_id.get(staff_id)
        if inst:
            max_cap = float(inst.get("max_weekly_hours") or inst.get("maxWeeklyHours") or 40)
            if req_hrs > max_cap:
                warnings.append(
                    f"Staff member {inst.get('name', staff_id)} is assigned {req_hrs:.1f}h/week (cap: {max_cap:.0f}h/week)."
                )

    weekly_teaching_minutes = sum(
        (s.end_min - s.start_min)
        for d in cfg.working_days
        for s in cfg.get_day_slots(d)
    )
    if weekly_teaching_minutes > 0:
        overloaded_batches = [
            f"{gk} ({mins / 60.0:.1f}h)"
            for gk, mins in group_minutes.items()
            if mins > weekly_teaching_minutes
        ]
        if overloaded_batches:
            sample = ", ".join(overloaded_batches[:4])
            extra = f" (+{len(overloaded_batches) - 4} more)" if len(overloaded_batches) > 4 else ""
            warnings.append(
                f"{len(overloaded_batches)} student batch(es)/section(s) exceed weekly operating hours ({weekly_teaching_minutes / 60.0:.1f}h/week): {sample}{extra}. Ensure courses are tagged with semester or enrollments."
            )
        total_demand_minutes = sum(s.duration_minutes for s in sessions)
        total_supply_minutes = len(avail_rooms) * weekly_teaching_minutes
        if total_demand_minutes > total_supply_minutes:
            warnings.append(
                f"Total session demand ({total_demand_minutes / 60.0:.1f}h) exceeds total weekly room capacity ({total_supply_minutes / 60.0:.1f}h across {len(avail_rooms)} room(s))."
            )

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }
