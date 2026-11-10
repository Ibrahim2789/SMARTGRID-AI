"""
Chromosome Representation and Feasibility Repair Operator for Timetable Optimization.
Each Chromosome maps every SchedulingSession (session_id) -> (day, start_time, room_id).
"""

from __future__ import annotations

import copy
import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple

from .constraints import (
    RoomResource,
    SchedulingSession,
    TimeSlotConfig,
    get_compatible_rooms,
)


@dataclass
class TimetableChromosome:
    genes: Dict[str, Tuple[str, str, str]] = field(default_factory=dict)  # session_id -> (day, start_time, room_id)
    fitness_score: float = 0.0
    hard_violations: int = 0

    def clone(self) -> "TimetableChromosome":
        return TimetableChromosome(
            genes=dict(self.genes),
            fitness_score=self.fitness_score,
            hard_violations=self.hard_violations,
        )


def repair_chromosome(
    chromosome: TimetableChromosome,
    sessions: List[SchedulingSession],
    rooms: List[RoomResource],
    time_config: TimeSlotConfig,
    unavailable_instructor_slots: Optional[Set[Tuple[str, str, str]]] = None,
    unavailable_room_slots: Optional[Set[Tuple[str, str, str]]] = None,
    rng: Optional[random.Random] = None,
) -> TimetableChromosome:
    """
    Repairs any hard constraint collisions in a candidate chromosome by reassigning
    conflicting or unassigned sessions to conflict-free (day, start_time, room_id) tuples.
    """
    rand = rng or random
    repaired_genes: Dict[str, Tuple[str, str, str]] = {}

    instructor_busy: Set[Tuple[str, str, str]] = set(unavailable_instructor_slots or set())
    room_busy: Set[Tuple[str, str, str]] = set(unavailable_room_slots or set())
    group_busy: Set[Tuple[str, str, str]] = set()
    section_days: Dict[str, Set[str]] = {s.section_id: set() for s in sessions}

    days = list(time_config.working_days)
    lecture_slots = time_config.generate_daily_lecture_slots()
    lab_slots = time_config.generate_valid_lab_start_slots()
    room_map = {r.room_id: r for r in rooms}

    # Process labs first, then theory sessions
    ordered_sessions = sorted(
        sessions,
        key=lambda s: (0 if s.session_type == "Lab" else 1, -s.expected_students),
    )

    needs_reassignment: List[SchedulingSession] = []

    for sess in ordered_sessions:
        existing = chromosome.genes.get(sess.session_id)
        if not existing:
            needs_reassignment.append(sess)
            continue

        day, start_time, room_id = existing
        is_lab = sess.session_type == "Lab"
        valid_slots = lab_slots if is_lab else lecture_slots

        if day not in days or start_time not in valid_slots:
            needs_reassignment.append(sess)
            continue

        if not is_lab and day in section_days[sess.section_id]:
            needs_reassignment.append(sess)
            continue

        room = room_map.get(room_id)
        if not room or not room.is_available or (room.room_type.lower() == "lab") != is_lab:
            needs_reassignment.append(sess)
            continue

        covered = time_config.covered_lecture_slots(start_time, is_lab)
        has_collision = False
        for st in covered:
            if sess.instructor_id and (sess.instructor_id, day, st) in instructor_busy:
                has_collision = True
                break
            if (sess.student_group_id, day, st) in group_busy:
                has_collision = True
                break
            if (room_id, day, st) in room_busy:
                has_collision = True
                break

        if has_collision:
            needs_reassignment.append(sess)
        else:
            repaired_genes[sess.session_id] = (day, start_time, room_id)
            section_days[sess.section_id].add(day)
            for st in covered:
                if sess.instructor_id:
                    instructor_busy.add((sess.instructor_id, day, st))
                group_busy.add((sess.student_group_id, day, st))
                room_busy.add((room_id, day, st))

    # Reassign colliding sessions into valid free slots
    for sess in needs_reassignment:
        is_lab = sess.session_type == "Lab"
        candidate_slots = lab_slots if is_lab else lecture_slots
        candidate_pairs = [(d, st) for st in candidate_slots for d in days]
        rand.shuffle(candidate_pairs)

        # Prefer days not yet used by this section
        used_days = section_days[sess.section_id]
        candidate_pairs.sort(key=lambda pair: (1 if pair[0] in used_days else 0))

        for day, start_time in candidate_pairs:
            if not is_lab and day in used_days:
                continue
            covered = time_config.covered_lecture_slots(start_time, is_lab)
            if sess.instructor_id and any((sess.instructor_id, day, st) in instructor_busy for st in covered):
                continue
            if any((sess.student_group_id, day, st) in group_busy for st in covered):
                continue
            compat_rooms = get_compatible_rooms(
                sess,
                rooms,
                unavailable_room_slots=room_busy,
                day=day,
                covered_slots=covered,
            )
            if compat_rooms:
                chosen_room = compat_rooms[0]
                repaired_genes[sess.session_id] = (day, start_time, chosen_room.room_id)
                used_days.add(day)
                for st in covered:
                    if sess.instructor_id:
                        instructor_busy.add((sess.instructor_id, day, st))
                    group_busy.add((sess.student_group_id, day, st))
                    room_busy.add((chosen_room.room_id, day, st))
                break

    return TimetableChromosome(genes=repaired_genes)
