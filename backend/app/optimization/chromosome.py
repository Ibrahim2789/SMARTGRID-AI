"""Chromosome representation and exact clock-interval helper methods."""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from .constraints import ScheduleSession, TimeSlotConfig


@dataclass
class SessionGene:
    """Represents one scheduled session assignment in the timetable chromosome."""

    session_id: str
    day: str
    slot_index: int
    room_id: str
    duration_slots: int = 1
    is_lab: bool = False
    is_locked: bool = False
    start_min: int = 0
    end_min: int = 0
    covered_slots: List[int] = field(default_factory=list)

    def sync_timing(self, session: ScheduleSession, time_config: TimeSlotConfig) -> None:
        win = time_config.compute_session_window(
            self.day,
            self.slot_index,
            session.duration_minutes,
            session.is_lab,
        )
        if win is not None:
            self.start_min, self.end_min, self.covered_slots = win
            self.duration_slots = max(1, len(self.covered_slots))
        else:
            anchor = time_config.get_slot(self.day, self.slot_index)
            base_start = anchor.start_min if anchor else time_config.day_start_min
            self.start_min = base_start
            self.end_min = base_start + session.duration_minutes
            self.covered_slots = [self.slot_index + i for i in range(max(1, self.duration_slots))]

    def get_occupied_slot_indices(self) -> List[int]:
        if self.covered_slots:
            return list(self.covered_slots)
        return [self.slot_index + i for i in range(max(1, self.duration_slots))]

    def overlaps(self, other: "SessionGene") -> bool:
        if self.day != other.day:
            return False
        if self.start_min > 0 and self.end_min > self.start_min and other.start_min > 0 and other.end_min > other.start_min:
            return self.start_min < other.end_min and other.start_min < self.end_min
        return bool(set(self.get_occupied_slot_indices()) & set(other.get_occupied_slot_indices()))


class TimetableChromosome:
    """
    Hybrid schedule encoding mapping session_id -> SessionGene(day, slot_index, room_id).
    Note: Instructor and Lab Engineer IDs live strictly on ScheduleSession and are NEVER mutated here.
    """

    def __init__(self, genes: Optional[Dict[str, SessionGene]] = None) -> None:
        self.genes: Dict[str, SessionGene] = genes or {}
        self.fitness_score: float = 0.0
        self.hard_violations: int = 0
        self.metrics: Dict[str, object] = {}

    def clone(self) -> "TimetableChromosome":
        cloned = TimetableChromosome(copy.deepcopy(self.genes))
        cloned.fitness_score = self.fitness_score
        cloned.hard_violations = self.hard_violations
        cloned.metrics = copy.deepcopy(self.metrics)
        return cloned

    def get_gene(self, session_id: str) -> Optional[SessionGene]:
        return self.genes.get(session_id)

    def set_gene(
        self,
        session_id: str,
        gene: SessionGene,
        session: Optional[ScheduleSession] = None,
        time_config: Optional[TimeSlotConfig] = None,
    ) -> None:
        if session is not None and time_config is not None:
            gene.sync_timing(session, time_config)
        self.genes[session_id] = gene

    def is_complete(self, sessions: List[ScheduleSession]) -> bool:
        return all(s.session_id in self.genes for s in sessions)


def compute_session_time_window(
    day: str,
    slot_index: int,
    session: ScheduleSession,
    time_config: TimeSlotConfig,
) -> Optional[Tuple[int, int, List[int]]]:
    return time_config.compute_session_window(
        day,
        slot_index,
        session.duration_minutes,
        session.is_lab,
    )


def repair_chromosome(
    chromosome: TimetableChromosome,
    sessions: List[ScheduleSession],
    rooms: List[object],
    time_config: TimeSlotConfig,
    unavailable_instructor_slots: Optional[object] = None,
    unavailable_room_slots: Optional[object] = None,
) -> TimetableChromosome:
    """Repair any hard violations or unplaced sessions without altering assigned staff."""
    import random
    from .constraints import normalize_rooms_input
    from .fitness import normalize_unavailable_slots_map
    from .genetic_algorithm import _repair_conflicts

    norm_rooms = normalize_rooms_input(rooms)
    unavail_inst = normalize_unavailable_slots_map(unavailable_instructor_slots, None)
    unavail_room = normalize_unavailable_slots_map(unavailable_room_slots, None)
    return _repair_conflicts(
        chromosome,
        sessions,
        norm_rooms,
        time_config,
        random.Random(42),
        unavail_inst=unavail_inst,
        unavail_room=unavail_room,
    )

