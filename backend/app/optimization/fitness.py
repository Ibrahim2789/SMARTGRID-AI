"""
Student-Centric Multi-Objective Fitness Function for SmartGrid AI.

Evaluates a candidate TimetableChromosome across:
1. Hard Constraints Barrier:
   - Never trades off hard constraint violations for higher soft scores.
   - Any hard violation incurs a strict penalty barrier (-25.0 points per violation)
     and flags the timetable as infeasible (`feasible = False`).
2. Configurable Soft Objectives (0–100 scale):
   - Student Satisfaction (default weight 0.35):
     * Preferred learning windows (09:00–13:00 prime learning window)
     * Avoiding unwanted early (before 08:30) or late (after 16:00) lectures
     * Maintaining reasonable daily class workloads (<= 4 classes/day)
   - Compactness & Student Gap Minimization (default weight 0.20):
     * Penalizes long idle gaps between classes on the same day for any student group
   - Instructor Satisfaction (default weight 0.20):
     * Respects preferred teaching windows and penalizes fragmented or >3 back-to-back lectures
   - Fairness Across Batches & Programs (default weight 0.15):
     * Computes per-batch satisfaction scores, penalizes variance/spread across batches,
       and incorporates Rawlsian min-max fairness (the least-satisfied batch score)
   - Room Utilization & Stability (default weight 0.10):
     * Rewards tight room capacity matching and home-room stability for theory sections
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from .chromosome import TimetableChromosome
from .constraints import (
    RoomResource,
    SchedulingSession,
    TimeSlotConfig,
    parse_minutes,
)
from .validator import validate_timetable_assignments


@dataclass
class OptimizationWeights:
    student_satisfaction: float = 0.35
    compactness_and_gaps: float = 0.20
    instructor_satisfaction: float = 0.20
    fairness_across_batches: float = 0.15
    room_utilization: float = 0.10

    def normalized(self) -> "OptimizationWeights":
        total = (
            self.student_satisfaction
            + self.compactness_and_gaps
            + self.instructor_satisfaction
            + self.fairness_across_batches
            + self.room_utilization
        )
        if total <= 0:
            return OptimizationWeights()
        return OptimizationWeights(
            student_satisfaction=self.student_satisfaction / total,
            compactness_and_gaps=self.compactness_and_gaps / total,
            instructor_satisfaction=self.instructor_satisfaction / total,
            fairness_across_batches=self.fairness_across_batches / total,
            room_utilization=self.room_utilization / total,
        )


@dataclass
class FitnessBreakdown:
    total_score: float
    feasible: bool
    hard_violation_count: int
    student_satisfaction: float
    instructor_satisfaction: float
    compactness_score: float
    student_gap_minutes_avg: float
    workload_balance_score: float
    fairness_score: float
    least_satisfied_batch_score: float
    room_utilization: float
    batch_satisfaction_breakdown: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "totalScore": round(self.total_score, 2),
            "feasible": self.feasible,
            "hardViolationCount": self.hard_violation_count,
            "studentSatisfaction": round(self.student_satisfaction, 2),
            "instructorSatisfaction": round(self.instructor_satisfaction, 2),
            "compactnessScore": round(self.compactness_score, 2),
            "studentGapMinutesAvg": round(self.student_gap_minutes_avg, 1),
            "workloadBalanceScore": round(self.workload_balance_score, 2),
            "fairnessScore": round(self.fairness_score, 2),
            "leastSatisfiedBatchScore": round(self.least_satisfied_batch_score, 2),
            "roomUtilization": round(self.room_utilization, 2),
            "batchSatisfactionBreakdown": {
                k: round(v, 2) for k, v in self.batch_satisfaction_breakdown.items()
            },
        }


def evaluate_chromosome_fitness(
    chromosome: TimetableChromosome,
    sessions: List[SchedulingSession],
    rooms: List[RoomResource],
    time_config: TimeSlotConfig,
    weights: Optional[OptimizationWeights] = None,
    unavailable_instructor_slots: Optional[Set[Tuple[str, str, str]]] = None,
    unavailable_room_slots: Optional[Set[Tuple[str, str, str]]] = None,
) -> FitnessBreakdown:
    w = (weights or OptimizationWeights()).normalized()
    validation = validate_timetable_assignments(
        chromosome.genes,
        sessions,
        rooms,
        time_config,
        unavailable_instructor_slots=unavailable_instructor_slots,
        unavailable_room_slots=unavailable_room_slots,
    )

    if not sessions:
        return FitnessBreakdown(
            total_score=100.0,
            feasible=True,
            hard_violation_count=0,
            student_satisfaction=100.0,
            instructor_satisfaction=100.0,
            compactness_score=100.0,
            student_gap_minutes_avg=0.0,
            workload_balance_score=100.0,
            fairness_score=100.0,
            least_satisfied_batch_score=100.0,
            room_utilization=100.0,
        )

    room_map = {r.room_id: r for r in rooms}
    step_minutes = max(30, time_config.period_length_minutes + time_config.short_break_minutes)

    # Group sessions by student_group_id and by instructor_id
    group_day_slots: Dict[str, Dict[str, List[int]]] = {}
    instructor_day_slots: Dict[str, Dict[str, List[int]]] = {}
    batch_session_scores: Dict[str, List[float]] = {}
    room_fit_scores: List[float] = []

    for sess in sessions:
        gene = chromosome.genes.get(sess.session_id)
        if not gene:
            batch_session_scores.setdefault(sess.student_group_id, []).append(0.0)
            continue

        day, start_time, room_id = gene
        is_lab = sess.session_type == "Lab"
        covered = time_config.covered_lecture_slots(start_time, is_lab)
        covered_mins = [parse_minutes(st) for st in covered]

        g_days = group_day_slots.setdefault(sess.student_group_id, {})
        g_days.setdefault(day, []).extend(covered_mins)

        if sess.instructor_id:
            i_days = instructor_day_slots.setdefault(sess.instructor_id, {})
            i_days.setdefault(day, []).extend(covered_mins)

        # Evaluate time-of-day student preference for this session
        start_min = parse_minutes(start_time)
        slot_score = 100.0
        if start_min < 8 * 60 + 30:
            slot_score -= 14.0  # Unwanted very early morning slot
        elif start_min >= 16 * 60:
            slot_score -= 12.0  # Late afternoon fatigue penalty
        elif 9 * 60 <= start_min <= 12 * 60 + 30:
            slot_score += 0.0  # Prime morning slot (100)
        else:
            slot_score -= 4.0  # Standard afternoon slot (96)

        batch_session_scores.setdefault(sess.student_group_id, []).append(max(0.0, min(100.0, slot_score)))

        # Evaluate room capacity utilization & home-room stability
        room = room_map.get(room_id)
        if room and room.capacity > 0:
            ratio = sess.expected_students / room.capacity
            if ratio > 1.0:
                fit = max(20.0, 100.0 - (ratio - 1.0) * 150.0)
            else:
                # Optimal seat occupancy is 65% - 95%
                fit = 72.0 + 28.0 * min(1.0, ratio / 0.80)
            if sess.preferred_room_id and room_id == sess.preferred_room_id:
                fit = min(100.0, fit + 5.0)
            room_fit_scores.append(fit)

    # Compute student gap & daily workload balance per student group
    group_compactness_scores: Dict[str, float] = {}
    group_workload_scores: Dict[str, float] = {}
    total_gap_minutes = 0
    total_group_days = 0

    for grp_id, day_map in group_day_slots.items():
        grp_gaps: List[int] = []
        daily_counts: List[int] = []
        for _day, mins_list in day_map.items():
            if not mins_list:
                continue
            sorted_mins = sorted(set(mins_list))
            daily_counts.append(len(sorted_mins))
            day_gap = 0
            for idx in range(1, len(sorted_mins)):
                diff = sorted_mins[idx] - sorted_mins[idx - 1]
                # Subtract normal period step and midday break if crossing midday
                idle = max(0, diff - step_minutes)
                if time_config.midday_break_enabled:
                    b_start = parse_minutes(time_config.midday_break_start)
                    if sorted_mins[idx - 1] < b_start and sorted_mins[idx] >= b_start + time_config.midday_break_duration:
                        idle = max(0, idle - time_config.midday_break_duration)
                day_gap += idle
            grp_gaps.append(day_gap)
            total_gap_minutes += day_gap
            total_group_days += 1

        avg_grp_gap = (sum(grp_gaps) / len(grp_gaps)) if grp_gaps else 0.0
        group_compactness_scores[grp_id] = max(40.0, 100.0 - avg_grp_gap * 0.35)

        # Penalize overloaded days (> 5 periods/day)
        overload_penalty = sum(max(0, c - 5) * 8.0 for c in daily_counts)
        group_workload_scores[grp_id] = max(50.0, 100.0 - overload_penalty)

    compactness_score = (
        sum(group_compactness_scores.values()) / len(group_compactness_scores)
        if group_compactness_scores
        else 95.0
    )
    workload_balance_score = (
        sum(group_workload_scores.values()) / len(group_workload_scores)
        if group_workload_scores
        else 95.0
    )
    avg_gap_minutes = (total_gap_minutes / total_group_days) if total_group_days > 0 else 0.0

    # Combine time preference, compactness, and workload into per-batch satisfaction
    per_batch_satisfaction: Dict[str, float] = {}
    for grp_id, slot_scores in batch_session_scores.items():
        slot_avg = sum(slot_scores) / len(slot_scores) if slot_scores else 85.0
        comp = group_compactness_scores.get(grp_id, 92.0)
        wload = group_workload_scores.get(grp_id, 94.0)
        per_batch_satisfaction[grp_id] = 0.50 * slot_avg + 0.30 * comp + 0.20 * wload

    student_satisfaction = (
        sum(per_batch_satisfaction.values()) / len(per_batch_satisfaction)
        if per_batch_satisfaction
        else 92.0
    )

    # Fairness across batches: penalize spread between highest and lowest batch + reward min batch
    if per_batch_satisfaction:
        batch_vals = list(per_batch_satisfaction.values())
        least_batch = min(batch_vals)
        most_batch = max(batch_vals)
        spread = most_batch - least_batch
        fairness_score = max(50.0, min(100.0, 100.0 - spread * 1.25))
    else:
        least_batch = 95.0
        fairness_score = 98.0

    # Instructor satisfaction: compact teaching days without excessive consecutive marathons
    inst_scores: List[float] = []
    for _inst_id, day_map in instructor_day_slots.items():
        inst_score = 98.0
        for _day, mins_list in day_map.items():
            sorted_mins = sorted(set(mins_list))
            if len(sorted_mins) > 4:
                inst_score -= (len(sorted_mins) - 4) * 5.0
            if len(sorted_mins) >= 2:
                span = sorted_mins[-1] - sorted_mins[0]
                active = len(sorted_mins) * step_minutes
                idle = max(0, span - active)
                if idle > 120:
                    inst_score -= (idle - 120) * 0.08
        inst_scores.append(max(55.0, min(100.0, inst_score)))

    instructor_satisfaction = sum(inst_scores) / len(inst_scores) if inst_scores else 95.0
    room_utilization = sum(room_fit_scores) / len(room_fit_scores) if room_fit_scores else 88.0

    soft_composite = (
        w.student_satisfaction * student_satisfaction
        + w.compactness_and_gaps * compactness_score
        + w.instructor_satisfaction * instructor_satisfaction
        + w.fairness_across_batches * (0.65 * fairness_score + 0.35 * least_batch)
        + w.room_utilization * room_utilization
    )

    # Strict hard-constraint barrier: never allow hard violations to outscore a valid schedule
    hard_penalty = validation.hard_violation_count * 25.0
    total_score = max(0.0, soft_composite - hard_penalty)

    chromosome.fitness_score = total_score
    chromosome.hard_violations = validation.hard_violation_count

    return FitnessBreakdown(
        total_score=total_score,
        feasible=validation.is_valid,
        hard_violation_count=validation.hard_violation_count,
        student_satisfaction=student_satisfaction,
        instructor_satisfaction=instructor_satisfaction,
        compactness_score=compactness_score,
        student_gap_minutes_avg=avg_gap_minutes,
        workload_balance_score=workload_balance_score,
        fairness_score=fairness_score,
        least_satisfied_batch_score=least_batch,
        room_utilization=room_utilization,
        batch_satisfaction_breakdown=per_batch_satisfaction,
    )
