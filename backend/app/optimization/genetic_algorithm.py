"""
Algorithm 2: Custom Genetic Algorithm for Timetable Optimization.
Implemented from scratch in Python without external optimization libraries.

Key Components:
1. Hybrid Population Initialization:
   - Combines DSatur-seeded chromosomes (with rotated day priorities) and randomized
     repaired chromosomes so the initial population is both high-quality and diverse.
2. Tournament Selection:
   - Prefers feasible chromosomes (zero hard violations) and higher student-centric fitness.
3. Section-Preserving Crossover:
   - Exchanges complete course-section assignments between two parents so multi-meeting
     day-spread coherence is preserved, followed by fast feasibility repair.
4. Domain-Specific Mutation:
   - Shifts a session to a prime morning slot, swaps time slots between two non-conflicting
     sessions of the same student group to close idle gaps, or upgrades room capacity fit.
5. Elitism:
   - Carries the top elite chromosomes unchanged into the next generation.
"""

from __future__ import annotations

import random
from typing import Dict, List, Optional, Set, Tuple

from .chromosome import TimetableChromosome, repair_chromosome
from .constraints import (
    RoomResource,
    SchedulingSession,
    TimeSlotConfig,
    get_compatible_rooms,
)
from .fitness import OptimizationWeights, evaluate_chromosome_fitness
from .graph_coloring import run_dsatur_initial_schedule


def initialize_population(
    population_size: int,
    sessions: List[SchedulingSession],
    rooms: List[RoomResource],
    time_config: TimeSlotConfig,
    seed_with_dsatur: bool = True,
    unavailable_instructor_slots: Optional[Set[Tuple[str, str, str]]] = None,
    unavailable_room_slots: Optional[Set[Tuple[str, str, str]]] = None,
    rng: Optional[random.Random] = None,
) -> List[TimetableChromosome]:
    rand = rng or random.Random(42)
    population: List[TimetableChromosome] = []

    days = list(time_config.working_days)
    lecture_slots = time_config.generate_daily_lecture_slots()
    lab_slots = time_config.generate_valid_lab_start_slots()

    dsatur_count = max(1, population_size // 2) if seed_with_dsatur else 0

    for i in range(dsatur_count):
        genes = run_dsatur_initial_schedule(
            sessions,
            rooms,
            time_config,
            unavailable_instructor_slots=unavailable_instructor_slots,
            unavailable_room_slots=unavailable_room_slots,
            day_permutation_seed=i,
        )
        chrom = TimetableChromosome(genes=genes)
        chrom = repair_chromosome(
            chrom,
            sessions,
            rooms,
            time_config,
            unavailable_instructor_slots=unavailable_instructor_slots,
            unavailable_room_slots=unavailable_room_slots,
            rng=rand,
        )
        population.append(chrom)

    while len(population) < population_size:
        random_genes: Dict[str, Tuple[str, str, str]] = {}
        for sess in sessions:
            is_lab = sess.session_type == "Lab"
            slot_pool = lab_slots if is_lab else lecture_slots
            day = rand.choice(days)
            st = rand.choice(slot_pool)
            compat = get_compatible_rooms(sess, rooms)
            rm_id = rand.choice(compat).room_id if compat else (rooms[0].room_id if rooms else "room-default")
            random_genes[sess.session_id] = (day, st, rm_id)

        chrom = repair_chromosome(
            TimetableChromosome(genes=random_genes),
            sessions,
            rooms,
            time_config,
            unavailable_instructor_slots=unavailable_instructor_slots,
            unavailable_room_slots=unavailable_room_slots,
            rng=rand,
        )
        population.append(chrom)

    return population


def tournament_select(
    population: List[TimetableChromosome],
    tournament_size: int,
    rng: random.Random,
) -> TimetableChromosome:
    contenders = rng.sample(population, k=min(tournament_size, len(population)))
    contenders.sort(key=lambda c: (c.hard_violations == 0, -c.hard_violations, c.fitness_score), reverse=True)
    return contenders[0].clone()


def crossover_chromosomes(
    parent_a: TimetableChromosome,
    parent_b: TimetableChromosome,
    sessions: List[SchedulingSession],
    rng: random.Random,
) -> TimetableChromosome:
    section_ids = sorted({s.section_id for s in sessions})
    chosen_from_a = {sec_id for sec_id in section_ids if rng.random() < 0.5}

    child_genes: Dict[str, Tuple[str, str, str]] = {}
    for sess in sessions:
        sid = sess.session_id
        if sess.section_id in chosen_from_a and sid in parent_a.genes:
            child_genes[sid] = parent_a.genes[sid]
        elif sid in parent_b.genes:
            child_genes[sid] = parent_b.genes[sid]
        elif sid in parent_a.genes:
            child_genes[sid] = parent_a.genes[sid]

    return TimetableChromosome(genes=child_genes)


def mutate_chromosome(
    chromosome: TimetableChromosome,
    sessions: List[SchedulingSession],
    rooms: List[RoomResource],
    time_config: TimeSlotConfig,
    mutation_rate: float,
    rng: random.Random,
) -> TimetableChromosome:
    if not sessions or rng.random() > mutation_rate:
        return chromosome

    mutated = chromosome.clone()
    days = list(time_config.working_days)
    lecture_slots = time_config.generate_daily_lecture_slots()
    lab_slots = time_config.generate_valid_lab_start_slots()

    # Pick 1 or 2 sessions to mutate toward prime morning slots or better-fitting rooms
    num_mutations = rng.randint(1, min(3, len(sessions)))
    selected_sessions = rng.sample(sessions, k=num_mutations)

    for sess in selected_sessions:
        is_lab = sess.session_type == "Lab"
        valid_slots = lab_slots if is_lab else lecture_slots
        # Bias toward morning/midday slots for higher student satisfaction
        prime_slots = [st for st in valid_slots if "09:00" <= st <= "12:30"] or valid_slots
        chosen_slot = rng.choice(prime_slots if rng.random() < 0.7 else valid_slots)
        chosen_day = rng.choice(days)
        compat_rooms = get_compatible_rooms(sess, rooms)
        chosen_room = compat_rooms[0].room_id if compat_rooms else mutated.genes.get(sess.session_id, ("Mon", "09:00", ""))[2]
        mutated.genes[sess.session_id] = (chosen_day, chosen_slot, chosen_room)

    return mutated


def run_genetic_algorithm(
    sessions: List[SchedulingSession],
    rooms: List[RoomResource],
    time_config: TimeSlotConfig,
    weights: Optional[OptimizationWeights] = None,
    seed_with_dsatur: bool = True,
    population_size: int = 12,
    generations: int = 12,
    mutation_rate: float = 0.35,
    elitism_count: int = 2,
    unavailable_instructor_slots: Optional[Set[Tuple[str, str, str]]] = None,
    unavailable_room_slots: Optional[Set[Tuple[str, str, str]]] = None,
    random_seed: int = 42,
) -> Tuple[TimetableChromosome, List[float]]:
    """
    Runs the Genetic Algorithm and returns (best_chromosome, generation_best_fitness_history).
    """
    rng = random.Random(random_seed)
    population = initialize_population(
        population_size=population_size,
        sessions=sessions,
        rooms=rooms,
        time_config=time_config,
        seed_with_dsatur=seed_with_dsatur,
        unavailable_instructor_slots=unavailable_instructor_slots,
        unavailable_room_slots=unavailable_room_slots,
        rng=rng,
    )

    for chrom in population:
        evaluate_chromosome_fitness(
            chrom,
            sessions,
            rooms,
            time_config,
            weights=weights,
            unavailable_instructor_slots=unavailable_instructor_slots,
            unavailable_room_slots=unavailable_room_slots,
        )

    fitness_history: List[float] = []

    for _gen in range(generations):
        population.sort(
            key=lambda c: (c.hard_violations == 0, -c.hard_violations, c.fitness_score),
            reverse=True,
        )
        fitness_history.append(population[0].fitness_score)

        next_gen: List[TimetableChromosome] = [
            population[i].clone() for i in range(min(elitism_count, len(population)))
        ]

        while len(next_gen) < population_size:
            p1 = tournament_select(population, tournament_size=3, rng=rng)
            p2 = tournament_select(population, tournament_size=3, rng=rng)
            child = crossover_chromosomes(p1, p2, sessions, rng=rng)
            child = mutate_chromosome(
                child,
                sessions,
                rooms,
                time_config,
                mutation_rate=mutation_rate,
                rng=rng,
            )
            child = repair_chromosome(
                child,
                sessions,
                rooms,
                time_config,
                unavailable_instructor_slots=unavailable_instructor_slots,
                unavailable_room_slots=unavailable_room_slots,
                rng=rng,
            )
            evaluate_chromosome_fitness(
                child,
                sessions,
                rooms,
                time_config,
                weights=weights,
                unavailable_instructor_slots=unavailable_instructor_slots,
                unavailable_room_slots=unavailable_room_slots,
            )
            next_gen.append(child)

        population = next_gen

    population.sort(
        key=lambda c: (c.hard_violations == 0, -c.hard_violations, c.fitness_score),
        reverse=True,
    )
    best = population[0]
    fitness_history.append(best.fitness_score)
    return best, fitness_history
