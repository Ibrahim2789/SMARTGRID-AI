"""
SmartGrid AI — Student Fairness Weight Sensitivity Audit & Multi-Seed Verification Runner.

Runs controlled multi-seed experiments (seeds = [42, 101, 202, 303, 404]) on the
contested scarce-morning dataset (36 lectures vs 24 Mon-Wed/Thu morning room-slots across
3 cohorts CONT-A, CONT-B, CONT-C) and verifies:
  1. Rebalanced weight sensitivity across student_fairness in {0.00, 0.25, 0.65, 0.95}
  2. Ceteris-paribus isolated weight sensitivity (fixed gap/inst/room/pref weights)
  3. Cross-process determinism (PYTHONHASHSEED=1 vs 2)
  4. Zero hard-constraint violations and 100% immutable instructor/staff bindings
  5. Batch-wise breakdown (preference fulfillment, idle minutes, gap counts, satisfaction)
  6. Medium realistic dataset voting & Tabu adaptive rescheduling regression checks
"""

from __future__ import annotations

import json
import os
import statistics
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.optimization.constraints import TimeSlotConfig  # noqa: E402
from app.optimization.evaluation import compare_optimization_algorithms  # noqa: E402
from app.optimization.rescheduler import generate_rescheduling_proposal  # noqa: E402
from app.optimization.scheduler import (  # noqa: E402
    OptimizationWeights,
    run_hybrid_timetable_pipeline,
)
from tests.audit_benchmark import build_realistic_university_dataset  # noqa: E402
from tests.targeted_audit_verification import independent_evaluate_schedule  # noqa: E402

SEEDS = [42, 101, 202, 303, 404]


def build_scarce_morning_fixture() -> Dict[str, Any]:
    cfg_scarce = TimeSlotConfig(working_days=["Mon", "Tue", "Wed", "Thu"], friday_enabled=False)
    c_groups = [
        {"id": "cb1", "code": "CONT-A", "size": 50},
        {"id": "cb2", "code": "CONT-B", "size": 50},
        {"id": "cb3", "code": "CONT-C", "size": 50},
    ]
    c_insts = [
        {
            "id": "ci1",
            "name": "Prof One",
            "unavailableSlots": [
                {"day": "Mon", "timeSlot": "9:00 – 9:50 AM"},
                {"day": "Tue", "timeSlot": "10:00 – 10:50 AM"},
            ],
        },
        {
            "id": "ci2",
            "name": "Prof Two",
            "unavailableSlots": [{"day": "Wed", "timeSlot": "11:00 – 11:50 AM"}],
        },
        {"id": "ci3", "name": "Prof Three"},
        {"id": "ci4", "name": "Prof Four"},
    ]
    c_courses = [
        {"id": f"cc{i}", "code": f"M{i}", "title": f"Course M{i}", "courseType": "lecture", "lectureCredits": 3, "creditHours": 3}
        for i in range(1, 5)
    ]
    c_rooms = [
        {"id": "cr1", "code": "R1", "type": "lecture", "capacity": 60, "isAvailable": True},
        {"id": "cr2", "code": "R2", "type": "lecture", "capacity": 60, "isAvailable": True},
    ]
    c_sections = [
        {
            "id": f"cs-{g['id']}-{i}",
            "courseId": f"cc{i}",
            "studentGroupId": g["id"],
            "instructorId": f"ci{i}",
            "sessionType": "Theory",
            "sessionsPerWeek": 3,
        }
        for g in c_groups
        for i in range(1, 5)
    ]
    c_prefs = [
        {"batch_id": g["id"], "preferred_time_window": "morning", "preferred_free_day": "Thu", "preferenceStrength": 0.90}
        for g in c_groups
    ]
    c_targets = {g["id"]: {"preferred_time_window": "morning", "preferred_free_day": "Thu"} for g in c_groups}
    expected_inst_by_section = {s["id"]: s["instructorId"] for s in c_sections}
    return {
        "time_config": cfg_scarce,
        "groups": c_groups,
        "instructors": c_insts,
        "courses": c_courses,
        "rooms": c_rooms,
        "sections": c_sections,
        "prefs": c_prefs,
        "targets": c_targets,
        "expected_inst_by_section": expected_inst_by_section,
    }


def _verify_staff_immutability(entries: List[Dict[str, Any]], expected_by_section: Dict[str, str]) -> int:
    mutations = 0
    for e in entries:
        sec_id = str(e.get("sectionId") or "")
        if sec_id in expected_by_section and e.get("instructorId") != expected_by_section[sec_id]:
            mutations += 1
    return mutations


def run_weight_suite(
    fixture: Dict[str, Any],
    weight_configs: List[tuple],
    algorithm: str = "hybrid_dsatur_ga_sa",
) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    cfg = fixture["time_config"]
    groups = fixture["groups"]
    targets = fixture["targets"]
    expected_inst = fixture["expected_inst_by_section"]

    for label, wobj in weight_configs:
        seed_rows: List[Dict[str, Any]] = []
        batch_accum: Dict[str, List[Dict[str, float]]] = {g["code"]: [] for g in groups}
        for sd in SEEDS:
            t0 = time.perf_counter()
            res = run_hybrid_timetable_pipeline(
                sections=fixture["sections"],
                courses=fixture["courses"],
                rooms_raw=fixture["rooms"],
                student_groups=groups,
                instructors=fixture["instructors"],
                time_config=cfg,
                weights=wobj,
                algorithm=algorithm,
                student_preferences=fixture["prefs"],
                seed=sd,
            )
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            ind = independent_evaluate_schedule(res["entries"], groups, cfg, targets)
            fit = res["fitness"]
            ob = fit["objectiveBreakdown"]
            staff_mut = _verify_staff_immutability(res["entries"], expected_inst)

            batch_row: Dict[str, Dict[str, Any]] = {}
            for grp in groups:
                gid = grp["id"]
                gcode = grp["code"]
                bw = ind["batchWise"][gid]
                opt_b = float(fit["batchSatisfactionByBatch"].get(gid, 0.0))
                b_entry = {
                    "optSatisfaction": round(opt_b, 2),
                    "commonSatisfaction": bw["commonSatisfaction"],
                    "preferenceFulfillment": bw["preferenceFulfillment"],
                    "lectureMatchPct": bw["lectureMatchPct"],
                    "freeDayCompliancePct": bw["freeDayCompliancePct"],
                    "freeDayClassesCount": bw["freeDayClassesCount"],
                    "idleMinutes": bw["idleMinutes"],
                    "gapCount": bw["gapCount"],
                }
                batch_row[gcode] = b_entry
                batch_accum[gcode].append(
                    {
                        "optSatisfaction": opt_b,
                        "commonSatisfaction": float(bw["commonSatisfaction"]),
                        "preferenceFulfillment": float(bw["preferenceFulfillment"]),
                        "idleMinutes": float(bw["idleMinutes"]),
                        "gapCount": float(bw["gapCount"]),
                    }
                )

            seed_rows.append(
                {
                    "seed": sd,
                    "totalFitness": float(fit["totalScore"]),
                    "optFairness": float(fit["fairnessScore"]),
                    "optMeanBatchSat": float(fit["studentSatisfaction"]),
                    "optWorstBatchSat": float(fit["leastSatisfiedBatchScore"]),
                    "optBestBatchSat": float(fit["bestBatchSatisfactionScore"]),
                    "optSatisfactionSpread": float(fit["satisfactionSpread"]),
                    "fairnessSharePct": float(ob["fairnessSharePct"]),
                    "rawlsianFairObjective": float(ob["rawlsianFairObjective"]),
                    "fairnessWeightedContribution": float(ob["fairnessWeightedContribution"]),
                    "studentMeanWeightedContribution": float(ob["studentMeanWeightedContribution"]),
                    "preferenceWeightedContribution": float(ob["preferenceWeightedContribution"]),
                    "commonMeanBatchSat": float(ind["overallCommonSatisfaction"]),
                    "commonWorstBatchSat": float(ind["worstBatchSatisfaction"]),
                    "commonBestBatchSat": float(ind["bestBatchSatisfaction"]),
                    "commonSpread": float(ind["satisfactionSpread"]),
                    "commonPrefFulfillment": float(ind["overallPreferenceFulfillment"]),
                    "avgIdleMinutesPerBatch": float(ind["avgIdleMinutesPerBatch"]),
                    "totalGapCount": int(ind["totalGapCount"]),
                    "hardConstraintViolations": int(res["hardConstraintViolations"]),
                    "staffMutations": staff_mut,
                    "runtimeMs": round(elapsed_ms, 2),
                    "batchWise": batch_row,
                }
            )

        batch_means: Dict[str, Dict[str, float]] = {}
        for gcode, items in batch_accum.items():
            batch_means[gcode] = {
                k: round(statistics.mean(x[k] for x in items), 2)
                for k in ("optSatisfaction", "commonSatisfaction", "preferenceFulfillment", "idleMinutes", "gapCount")
            }

        results.append(
            {
                "config": label,
                "algorithm": algorithm,
                "weights": wobj.to_dict(),
                "summary": {
                    "meanTotalFitness": round(statistics.mean(r["totalFitness"] for r in seed_rows), 2),
                    "meanOptFairness": round(statistics.mean(r["optFairness"] for r in seed_rows), 2),
                    "meanOptMeanBatchSat": round(statistics.mean(r["optMeanBatchSat"] for r in seed_rows), 2),
                    "meanOptWorstBatchSat": round(statistics.mean(r["optWorstBatchSat"] for r in seed_rows), 2),
                    "meanOptBestBatchSat": round(statistics.mean(r["optBestBatchSat"] for r in seed_rows), 2),
                    "meanOptSpread": round(statistics.mean(r["optSatisfactionSpread"] for r in seed_rows), 2),
                    "fairnessSharePct": round(statistics.mean(r["fairnessSharePct"] for r in seed_rows), 2),
                    "meanRawlsianFairObjective": round(statistics.mean(r["rawlsianFairObjective"] for r in seed_rows), 2),
                    "meanFairnessWeightedContribution": round(
                        statistics.mean(r["fairnessWeightedContribution"] for r in seed_rows), 2
                    ),
                    "meanStudentMeanWeightedContribution": round(
                        statistics.mean(r["studentMeanWeightedContribution"] for r in seed_rows), 2
                    ),
                    "meanPreferenceWeightedContribution": round(
                        statistics.mean(r["preferenceWeightedContribution"] for r in seed_rows), 2
                    ),
                    "meanCommonMeanBatchSat": round(statistics.mean(r["commonMeanBatchSat"] for r in seed_rows), 2),
                    "meanCommonWorstBatchSat": round(statistics.mean(r["commonWorstBatchSat"] for r in seed_rows), 2),
                    "meanCommonBestBatchSat": round(statistics.mean(r["commonBestBatchSat"] for r in seed_rows), 2),
                    "meanCommonSpread": round(statistics.mean(r["commonSpread"] for r in seed_rows), 2),
                    "meanCommonPrefFulfillment": round(statistics.mean(r["commonPrefFulfillment"] for r in seed_rows), 2),
                    "meanAvgIdleMinutes": round(statistics.mean(r["avgIdleMinutesPerBatch"] for r in seed_rows), 2),
                    "meanTotalGaps": round(statistics.mean(r["totalGapCount"] for r in seed_rows), 2),
                    "maxHardViolations": max(r["hardConstraintViolations"] for r in seed_rows),
                    "totalStaffMutations": sum(r["staffMutations"] for r in seed_rows),
                    "meanRuntimeMs": round(statistics.mean(r["runtimeMs"] for r in seed_rows), 2),
                },
                "batchMeans": batch_means,
                "perSeed": seed_rows,
            }
        )
    return results


def check_cross_process_determinism() -> Dict[str, Any]:
    cmd_template = (
        "import json; "
        "from tests.fairness_sensitivity_audit import build_scarce_morning_fixture; "
        "from app.optimization.scheduler import OptimizationWeights, run_hybrid_timetable_pipeline; "
        "f=build_scarce_morning_fixture(); "
        "r=run_hybrid_timetable_pipeline(sections=f['sections'], courses=f['courses'], rooms_raw=f['rooms'], "
        "student_groups=f['groups'], instructors=f['instructors'], time_config=f['time_config'], "
        "weights=OptimizationWeights(student_fairness=0.65), algorithm='hybrid_dsatur_ga_sa', "
        "student_preferences=f['prefs'], seed=42); "
        "print(json.dumps({'score': r['fitness']['totalScore'], 'fair': r['fitness']['fairnessScore'], "
        "'entries': [(e['sessionId'], e['day'], e['startTime'], e['roomId']) for e in r['entries']]}))"
    )
    outputs = {}
    for hs in ("1", "2", "999"):
        env = dict(os.environ)
        env["PYTHONHASHSEED"] = hs
        env["PYTHONPATH"] = str(BACKEND_DIR)
        proc = subprocess.run(
            [sys.executable, "-c", cmd_template],
            capture_output=True,
            text=True,
            check=True,
            cwd=str(BACKEND_DIR),
            env=env,
        )
        outputs[hs] = json.loads(proc.stdout.strip().splitlines()[-1])
    identical = (outputs["1"] == outputs["2"]) and (outputs["2"] == outputs["999"])
    return {
        "identicalAcrossHashSeeds": identical,
        "hashSeed1Score": outputs["1"]["score"],
        "hashSeed2Score": outputs["2"]["score"],
        "hashSeed999Score": outputs["999"]["score"],
    }


def run_regression_spot_checks() -> Dict[str, Any]:
    ds = build_realistic_university_dataset()
    cfg = TimeSlotConfig()
    comp = compare_optimization_algorithms(
        sections=ds["sections"],
        courses=ds["courses"],
        rooms_raw=ds["rooms_raw"],
        student_groups=ds["student_groups"],
        time_config=cfg,
        instructors=ds["instructors"],
        student_preferences=ds["student_preferences"],
        unavailable_instructor_slots=ds["unavailable_instructor_slots"],
        unavailable_room_slots=ds["unavailable_room_slots"],
        seed=42,
    )
    base = run_hybrid_timetable_pipeline(
        sections=ds["sections"],
        courses=ds["courses"],
        rooms_raw=ds["rooms_raw"],
        student_groups=ds["student_groups"],
        instructors=ds["instructors"],
        time_config=cfg,
        student_preferences=ds["student_preferences"],
        unavailable_instructor_slots=ds["unavailable_instructor_slots"],
        unavailable_room_slots=ds["unavailable_room_slots"],
        algorithm="hybrid_dsatur_ga_sa",
        seed=42,
    )
    # Full-day faculty outage Tabu rescheduling regression check on busiest faculty
    from collections import defaultdict
    inst_day_counts: Dict[tuple, int] = defaultdict(int)
    for e in base["entries"]:
        if e.get("instructorId"):
            inst_day_counts[(e["instructorId"], e["day"])] += 1
    busiest_inst, busiest_day = max(inst_day_counts.keys(), key=lambda k: inst_day_counts[k])
    tabu_prop = generate_rescheduling_proposal(
        disruption_type="instructor_unavailable",
        affected_resource_id=busiest_inst,
        affected_days=[busiest_day],
        affected_start_times=cfg.generate_daily_lecture_slots(),
        reason="Fairness audit regression check: full-day faculty outage",
        current_section_assignments=base["assignments"],
        sections=ds["sections"],
        courses=ds["courses"],
        rooms_raw=ds["rooms_raw"],
        student_groups=ds["student_groups"],
        time_config=cfg,
        instructors=ds["instructors"],
        unavailable_instructor_slots=ds["unavailable_instructor_slots"],
        unavailable_room_slots=ds["unavailable_room_slots"],
    )
    sec_by_id = {s["id"]: s for s in ds["sections"]}
    staff_mutations = 0
    for sec_id, assign in tabu_prop["proposedAssignments"].items():
        orig_sec = sec_by_id.get(sec_id, {})
        orig_assign = base["assignments"].get(sec_id, {})
        is_lab_sec = str(orig_sec.get("componentType") or orig_sec.get("sessionType") or "").lower() == "lab"
        exp_inst = (orig_sec.get("labEngineerId") if is_lab_sec else orig_sec.get("instructorId")) or orig_assign.get("instructorId")
        if exp_inst and assign.get("instructorId") and assign["instructorId"] != exp_inst:
            staff_mutations += 1
    return {
        "mediumDatasetAlgorithms": [
            {
                "algorithm": c["algorithmId"],
                "totalFitness": c["totalScore"],
                "fairnessScore": c["fairnessScore"],
                "studentSatisfaction": c["studentSatisfaction"],
                "hardViolations": c["hardConstraintViolations"],
                "feasible": c["feasible"],
                "runtimeMs": c["executionTimeMs"],
            }
            for c in comp["comparisons"]
        ],
        "tabuRescheduleOutage": {
            "disruptedFaculty": busiest_inst,
            "disruptedDay": busiest_day,
            "feasible": tabu_prop["feasible"],
            "hardViolations": tabu_prop["remainingHardViolations"],
            "affectedSessionsCount": tabu_prop["affectedSessionsCount"],
            "changedSessionsCount": tabu_prop["changedSessionsCount"],
            "stabilityPct": tabu_prop["stabilityPercentage"],
            "staffMutationsCount": staff_mutations,
            "executionTimeMs": tabu_prop["repairExecutionTimeMs"],
        },
    }


def main() -> None:
    fixture = build_scarce_morning_fixture()

    audit_weights = [
        ("Fairness_0.00", OptimizationWeights(student_gap_minimization=0.45, student_fairness=0.00, instructor_balance=0.20, room_utilization=0.10, preferences=0.25)),
        ("Fairness_0.25", OptimizationWeights(student_gap_minimization=0.35, student_fairness=0.25, instructor_balance=0.15, room_utilization=0.10, preferences=0.15)),
        ("Fairness_0.65", OptimizationWeights(student_gap_minimization=0.15, student_fairness=0.65, instructor_balance=0.05, room_utilization=0.05, preferences=0.10)),
        ("Fairness_0.95", OptimizationWeights(student_gap_minimization=0.05, student_fairness=0.95, instructor_balance=0.00, room_utilization=0.00, preferences=0.05)),
    ]
    ceteris_weights = [
        ("CP_0.00", OptimizationWeights(student_gap_minimization=0.35, student_fairness=0.00, instructor_balance=0.15, room_utilization=0.10, preferences=0.15)),
        ("CP_0.25", OptimizationWeights(student_gap_minimization=0.35, student_fairness=0.25, instructor_balance=0.15, room_utilization=0.10, preferences=0.15)),
        ("CP_0.65", OptimizationWeights(student_gap_minimization=0.35, student_fairness=0.65, instructor_balance=0.15, room_utilization=0.10, preferences=0.15)),
        ("CP_0.95", OptimizationWeights(student_gap_minimization=0.35, student_fairness=0.95, instructor_balance=0.15, room_utilization=0.10, preferences=0.15)),
    ]

    report = {
        "seeds": SEEDS,
        "rebalancedHybrid": run_weight_suite(fixture, audit_weights, algorithm="hybrid_dsatur_ga_sa"),
        "ceterisParibusHybrid": run_weight_suite(fixture, ceteris_weights, algorithm="hybrid_dsatur_ga_sa"),
        "rebalancedDsaturOnly": run_weight_suite(fixture, audit_weights, algorithm="dsatur_only"),
        "crossProcessDeterminism": check_cross_process_determinism(),
        "regressionSpotChecks": run_regression_spot_checks(),
    }

    out_path = Path(__file__).resolve().parent / "fairness_sensitivity_audit_results.json"
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("=== REBALANCED HYBRID (5-SEED MEANS) ===")
    for row in report["rebalancedHybrid"]:
        s = row["summary"]
        print(
            f"{row['config']:14s} | Fit={s['meanTotalFitness']:5.2f} | OptFair={s['meanOptFairness']:5.2f} "
            f"| OptWorst={s['meanOptWorstBatchSat']:5.2f} | OptMean={s['meanOptMeanBatchSat']:5.2f} "
            f"| OptSpread={s['meanOptSpread']:5.2f} | FairShare={s['fairnessSharePct']:5.2f}% "
            f"| FairContrib={s['meanFairnessWeightedContribution']:5.2f} | IndWorst={s['meanCommonWorstBatchSat']:5.2f} "
            f"| IndSpread={s['meanCommonSpread']:5.2f} | Pref={s['meanCommonPrefFulfillment']:5.2f} "
            f"| Idle={s['meanAvgIdleMinutes']:4.2f} | Gaps={s['meanTotalGaps']:4.2f} | HV={s['maxHardViolations']} "
            f"| t={s['meanRuntimeMs']:.1f}ms"
        )
    print("=== CETERIS PARIBUS HYBRID (5-SEED MEANS) ===")
    for row in report["ceterisParibusHybrid"]:
        s = row["summary"]
        print(
            f"{row['config']:14s} | Fit={s['meanTotalFitness']:5.2f} | OptFair={s['meanOptFairness']:5.2f} "
            f"| OptWorst={s['meanOptWorstBatchSat']:5.2f} | OptMean={s['meanOptMeanBatchSat']:5.2f} "
            f"| OptSpread={s['meanOptSpread']:5.2f} | FairShare={s['fairnessSharePct']:5.2f}% "
            f"| FairContrib={s['meanFairnessWeightedContribution']:5.2f} | IndWorst={s['meanCommonWorstBatchSat']:5.2f} "
            f"| IndSpread={s['meanCommonSpread']:5.2f} | Pref={s['meanCommonPrefFulfillment']:5.2f} "
            f"| Idle={s['meanAvgIdleMinutes']:4.2f} | Gaps={s['meanTotalGaps']:4.2f} | HV={s['maxHardViolations']} "
            f"| t={s['meanRuntimeMs']:.1f}ms"
        )
    print("Determinism:", report["crossProcessDeterminism"])
    print("Saved JSON:", out_path)


if __name__ == "__main__":
    main()
