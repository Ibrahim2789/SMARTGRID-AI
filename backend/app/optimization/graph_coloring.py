"""
Algorithm 1: Graph Coloring with DSatur (Degree of Saturation) Heuristic.
Constructs an initial conflict-free timetable from scratch without external solver libraries.

DSatur Algorithm Steps:
1. Represent each course meeting session as a vertex V.
2. Add an undirected conflict edge (u, v) whenever two sessions share:
   - The same instructor, OR
   - The same student group / batch section, OR
   - Belong to the same course section (different weekly meetings of the same course).
3. Treat available (day, start_time) pairs as discrete colors, ordered to spread meetings
   across distinct days and respect instructor/room availability.
4. At each step, compute for every uncolored vertex v:
   - saturation_degree(v): number of distinct colors (time slots) already assigned to adjacent vertices.
   - uncolored_degree(v): number of uncolored neighbors of v.
5. Select the uncolored vertex with the maximum saturation_degree, breaking ties by maximum
   total degree in the conflict graph (and placing multi-slot continuous labs first).
6. Assign the lowest-indexed feasible color (day, start_time) and compatible available room
   that introduces zero conflicts with already-colored neighbors.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Set, Tuple

from .constraints import (
    RoomResource,
    SchedulingSession,
    TimeSlotConfig,
    get_compatible_rooms,
)


def build_conflict_graph(sessions: List[SchedulingSession]) -> Dict[str, Set[str]]:
    adjacency: Dict[str, Set[str]] = {s.session_id: set() for s in sessions}
    n = len(sessions)
    for i in range(n):
        u = sessions[i]
        for j in range(i + 1, n):
            v = sessions[j]
            conflict = False
            if u.instructor_id and u.instructor_id == v.instructor_id:
                conflict = True
            elif u.student_group_id and u.student_group_id == v.student_group_id:
                conflict = True
            elif u.section_id == v.section_id:
                conflict = True

            if conflict:
                adjacency[u.session_id].add(v.session_id)
                adjacency[v.session_id].add(u.session_id)
    return adjacency


def run_dsatur_initial_schedule(
    sessions: List[SchedulingSession],
    rooms: List[RoomResource],
    time_config: TimeSlotConfig,
    unavailable_instructor_slots: Optional[Set[Tuple[str, str, str]]] = None,
    unavailable_room_slots: Optional[Set[Tuple[str, str, str]]] = None,
    day_permutation_seed: int = 0,
) -> Dict[str, Tuple[str, str, str]]:
    """
    Executes DSatur graph coloring + compatible room allocation.
    Returns mapping: session_id -> (day, start_time, room_id).
    """
    if not sessions:
        return {}

    adjacency = build_conflict_graph(sessions)
    session_map = {s.session_id: s for s in sessions}

    days = list(time_config.working_days)
    if day_permutation_seed > 0 and len(days) > 1:
        shift = day_permutation_seed % len(days)
        days = days[shift:] + days[:shift]

    lecture_slots = time_config.generate_daily_lecture_slots()
    lab_start_slots = time_config.generate_valid_lab_start_slots()

    # Build candidate color lists (day, start_time) interleaved by day to distribute workload evenly
    lecture_colors: List[Tuple[str, str]] = []
    for st in lecture_slots:
        for d in days:
            lecture_colors.append((d, st))

    lab_colors: List[Tuple[str, str]] = []
    for st in lab_start_slots:
        for d in days:
            lab_colors.append((d, st))

    # Track occupied resources:
    instructor_busy: Set[Tuple[str, str, str]] = set(unavailable_instructor_slots or set())
    room_busy: Set[Tuple[str, str, str]] = set(unavailable_room_slots or set())
    group_busy: Set[Tuple[str, str, str]] = set()
    section_used_days: Dict[str, Set[str]] = {s.section_id: set() for s in sessions}

    # Track assigned colors per vertex for DSatur saturation calculation
    assigned_time_color: Dict[str, Tuple[str, str]] = {}
    full_assignments: Dict[str, Tuple[str, str, str]] = {}
    uncolored: Set[str] = {s.session_id for s in sessions}

    while uncolored:
        # DSatur vertex selection:
        # Priority: (1 if Lab else 0, saturation_degree, total_conflict_degree, expected_students)
        best_vid: Optional[str] = None
        best_key: Tuple[int, int, int, int] = (-1, -1, -1, -1)

        for vid in uncolored:
            sess = session_map[vid]
            neighbor_colors = {
                assigned_time_color[nbr]
                for nbr in adjacency[vid]
                if nbr in assigned_time_color
            }
            sat_deg = len(neighbor_colors)
            tot_deg = len(adjacency[vid])
            is_lab_priority = 1 if sess.session_type == "Lab" else 0
            cand_key = (is_lab_priority, sat_deg, tot_deg, sess.expected_students)
            if cand_key > best_key:
                best_key = cand_key
                best_vid = vid

        assert best_vid is not None
        uncolored.remove(best_vid)
        sess = session_map[best_vid]
        is_lab = sess.session_type == "Lab"
        candidate_colors = lab_colors if is_lab else lecture_colors

        # Prefer alternating day patterns for multi-meeting theory courses (e.g. Mon/Wed/Fri vs Tue/Thu)
        used_days_for_sec = section_used_days[sess.section_id]
        ordered_colors = sorted(
            candidate_colors,
            key=lambda dc: (1 if dc[0] in used_days_for_sec else 0),
        )

        placed = False
        for day, start_time in ordered_colors:
            if not is_lab and day in used_days_for_sec:
                continue

            covered = time_config.covered_lecture_slots(start_time, is_lab)

            # Check instructor and student group conflicts across all covered slots
            if sess.instructor_id and any((sess.instructor_id, day, st) in instructor_busy for st in covered):
                continue
            if any((sess.student_group_id, day, st) in group_busy for st in covered):
                continue

            # Find a compatible, unoccupied room across all covered slots
            compat_rooms = get_compatible_rooms(
                sess,
                rooms,
                unavailable_room_slots=room_busy,
                day=day,
                covered_slots=covered,
            )
            if not compat_rooms:
                continue

            chosen_room = compat_rooms[0]
            assigned_time_color[best_vid] = (day, start_time)
            full_assignments[best_vid] = (day, start_time, chosen_room.room_id)
            used_days_for_sec.add(day)

            for st in covered:
                if sess.instructor_id:
                    instructor_busy.add((sess.instructor_id, day, st))
                group_busy.add((sess.student_group_id, day, st))
                room_busy.add((chosen_room.room_id, day, st))

            placed = True
            break

        # Fallback if all strict day-spread slots were exhausted
        if not placed:
            for day, start_time in candidate_colors:
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
                    assigned_time_color[best_vid] = (day, start_time)
                    full_assignments[best_vid] = (day, start_time, chosen_room.room_id)
                    used_days_for_sec.add(day)
                    for st in covered:
                        if sess.instructor_id:
                            instructor_busy.add((sess.instructor_id, day, st))
                        group_busy.add((sess.student_group_id, day, st))
                        room_busy.add((chosen_room.room_id, day, st))
                    placed = True
                    break

    return full_assignments
