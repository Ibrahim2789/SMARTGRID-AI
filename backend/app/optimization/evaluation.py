"""
Algorithm Evaluation and Benchmark Comparison Module (evaluation.py).
Compares on identical academic datasets:
1. DSatur initial schedule (`dsatur_only`)
2. Genetic Algorithm (`ga_only`)
3. Genetic Algorithm + Simulated Annealing (`ga_sa`)
4. Graph-Coloring-Seeded Genetic Algorithm + Simulated Annealing (`hybrid_dsatur_ga_sa`)
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .constraints import TimeSlotConfig
from .fitness import OptimizationWeights
from .scheduler import run_hybrid_timetable_pipeline


def compare_optimization_algorithms(
    sections: List[Dict[str, Any]],
    courses: List[Dict[str, Any]],
    rooms_raw: List[Dict[str, Any]],
    student_groups: List[Dict[str, Any]],
    time_config: Optional[TimeSlotConfig] = None,
    weights: Optional[OptimizationWeights] = None,
    instructors: Optional[List[Dict[str, Any]]] = None,
    student_preferences: Optional[List[Dict[str, Any]]] = None,
    instructor_preferences: Optional[List[Dict[str, Any]]] = None,
    unavailable_instructor_slots: Optional[Any] = None,
    unavailable_room_slots: Optional[Any] = None,
    seed: int = 42,
) -> Dict[str, Any]:
    algorithms = [
        ("dsatur_only", "DSatur Graph Coloring Initial Schedule"),
        ("ga_only", "Genetic Algorithm (Unseeded)"),
        ("ga_sa", "Genetic Algorithm + Simulated Annealing"),
        ("hybrid_dsatur_ga_sa", "Hybrid DSatur-Seeded GA + Simulated Annealing"),
    ]

    comparisons: List[Dict[str, Any]] = []
    comparison_ui: List[Dict[str, Any]] = []
    baseline_score: Optional[float] = None

    for algo_id, label in algorithms:
        res = run_hybrid_timetable_pipeline(
            sections=sections,
            courses=courses,
            rooms_raw=rooms_raw,
            student_groups=student_groups,
            instructors=instructors,
            time_config=time_config,
            weights=weights,
            algorithm=algo_id,
            student_preferences=student_preferences,
            instructor_preferences=instructor_preferences,
            unavailable_instructor_slots=unavailable_instructor_slots,
            unavailable_room_slots=unavailable_room_slots,
            seed=seed,
        )
        score = float(res["fitness"]["totalScore"])
        if baseline_score is None:
            baseline_score = score
        improvement = round(score - baseline_score, 2)
        comparisons.append(
            {
                "algorithmId": algo_id,
                "algorithmLabel": label,
                "feasible": res["feasible"],
                "hardConstraintViolations": res["hardConstraintViolations"],
                "totalScore": score,
                "fitnessImprovementOverBaseline": improvement,
                "studentSatisfaction": res["fitness"]["studentSatisfaction"],
                "instructorSatisfaction": res["fitness"]["instructorSatisfaction"],
                "compactnessScore": res["fitness"]["compactnessScore"],
                "studentGapMinutesAvg": res["fitness"]["studentGapMinutesAvg"],
                "workloadBalanceScore": res["fitness"]["workloadBalanceScore"],
                "fairnessScore": res["fitness"]["fairnessScore"],
                "leastSatisfiedBatchScore": res["fitness"]["leastSatisfiedBatchScore"],
                "roomUtilization": res["fitness"]["roomUtilization"],
                "executionTimeMs": res["executionTimeMs"],
            }
        )
        comparison_ui.append(
            {
                "algorithm": algo_id,
                "label": label,
                "feasible": res["feasible"],
                "hardConstraintViolations": res["hardConstraintViolations"],
                "executionTimeMs": res["executionTimeMs"],
                "placedSessions": res["placedSessions"],
                "totalSessions": res["totalSessions"],
                "fitness": res["fitness"],
            }
        )

    best_entry = max(
        comparisons,
        key=lambda c: (c["feasible"], -c["hardConstraintViolations"], c["totalScore"]),
    )

    return {
        "recommendedAlgorithm": best_entry["algorithmId"],
        "comparisons": comparisons,
        "comparison": comparison_ui,
    }
