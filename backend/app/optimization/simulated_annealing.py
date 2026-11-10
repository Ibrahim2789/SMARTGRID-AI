"""
Algorithm 3: Custom Simulated Annealing for Local Timetable Refinement.
Refines the best Genetic Algorithm solution using probabilistic neighborhood search:
- Neighborhood operators:
  1. Move a theory session to an adjacent/compact time slot on the same or another day
  2. Swap time slots of two theory sessions belonging to the same student cohort
  3. Reassign a session to its preferred/better-fitting compatible room
  4. Swap rooms between two compatible concurrent sessions
- Metropolis acceptance criterion:
  - Always accepts improvements (delta > 0) whenever hard constraints remain satisfied.
  - Accepts slightly worse feasible moves with probability exp(delta / temperature)
    early in the search to escape local optima, cooling via T_{k+1} = alpha * T_k.
"""

from __future__ import annotations

import math
import random
from typing import List, Optional, Set, Tuple

from .chromosome import TimetableChromosome, repair_chromosome
from .constraints import (
    RoomResource,
    SchedulingSession,
    TimeSlotConfig,
    get_compatible_rooms,
)
from .fitness import OptimizationWeights, evaluate_chromosome_fitness


def generate_neighbor(
    current: TimetableChromosome,
    sessions: List[SchedulingSession],
    rooms: List[RoomResource],
    time_config: TimeSlotConfig,
    unavailable_instructor_slots: Optional[Set[Tuple[str, str, str]]],
    unavailable_room_slots: Optional[Set[Tuple[str, str, str]]],
    rng: random.Random,
) -> TimetableChromosome:
    neighbor = current.clone()
    if not sessions:
        return neighbor

    days = list(time_config.working_days)
    lecture_slots = time_config.generate_daily_lecture_slots()
    prime_slots = [st for st in lecture_slots if "09:00" <= st <= "12:30"] or lecture_slots

    theory_sessions = [s for s in sessions if s.session_type != "Lab"]
    op = rng.choice(["move_slot", "swap_sessions", "reassign_room"])

    if op == "swap_sessions" and len(theory_sessions) >= 2:
        s1, s2 = rng.sample(theory_sessions, 2)
        g1 = neighbor.genes.get(s1.session_id)
        g2 = neighbor.genes.get(s2.session_id)
        if g1 and g2:
            neighbor.genes[s1.session_id] = (g2[0], g2[1], g1[2])
            neighbor.genes[s2.session_id] = (g1[0], g1[1], g2[2])
    elif op == "reassign_room":
        sess = rng.choice(sessions)
        g = neighbor.genes.get(sess.session_id)
        if g:
            compat = get_compatible_rooms(sess, rooms)
            if compat:
                neighbor.genes[sess.session_id] = (g[0], g[1], compat[0].room_id)
    else:
        target_pool = theory_sessions or sessions
        sess = rng.choice(target_pool)
        g = neighbor.genes.get(sess.session_id)
        if g:
            new_day = rng.choice(days)
            new_slot = rng.choice(prime_slots if rng.random() < 0.75 else lecture_slots)
            neighbor.genes[sess.session_id] = (new_day, new_slot, g[2])

    return repair_chromosome(
        neighbor,
        sessions,
        rooms,
        time_config,
        unavailable_instructor_slots=unavailable_instructor_slots,
        unavailable_room_slots=unavailable_room_slots,
        rng=rng,
    )


def run_simulated_annealing(
    initial_chromosome: TimetableChromosome,
    sessions: List[SchedulingSession],
    rooms: List[RoomResource],
    time_config: TimeSlotConfig,
    weights: Optional[OptimizationWeights] = None,
    initial_temperature: float = 12.0,
    cooling_rate: float = 0.88,
    min_temperature: float = 0.25,
    iterations_per_temp: int = 3,
    unavailable_instructor_slots: Optional[Set[Tuple[str, str, str]]] = None,
    unavailable_room_slots: Optional[Set[Tuple[str, str, str]]] = None,
    random_seed: int = 101,
) -> TimetableChromosome:
    rng = random.Random(random_seed)
    current = initial_chromosome.clone()
    evaluate_chromosome_fitness(
        current,
        sessions,
        rooms,
        time_config,
        weights=weights,
        unavailable_instructor_slots=unavailable_instructor_slots,
        unavailable_room_slots=unavailable_room_slots,
    )
    best = current.clone()

    temp = initial_temperature
    while temp > min_temperature:
        for _ in range(iterations_per_temp):
            candidate = generate_neighbor(
                current,
                sessions,
                rooms,
                time_config,
                unavailable_instructor_slots=unavailable_instructor_slots,
                unavailable_room_slots=unavailable_room_slots,
                rng=rng,
            )
            evaluate_chromosome_fitness(
                candidate,
                sessions,
                rooms,
                time_config,
                weights=weights,
                unavailable_instructor_slots=unavailable_instructor_slots,
                unavailable_room_slots=unavailable_room_slots,
            )

            # Never accept a candidate with more hard violations than current
            if candidate.hard_violations > current.hard_violations:
                continue

            delta = candidate.fitness_score - current.fitness_score
            if delta >= 0 or candidate.hard_violations < current.hard_violations:
                current = candidate
                if (
                    current.hard_violations < best.hard_violations
                    or (current.hard_violations == best.hard_violations and current.fitness_score > best.fitness_score)
                ):
                    best = current.clone()
            else:
                accept_prob = math.exp(delta / max(0.001, temp))
                if rng.random() < accept_prob:
                    current = candidate

        temp *= cooling_rate

    return best
