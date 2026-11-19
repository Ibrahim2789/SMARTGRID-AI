# SmartGrid AI — Final System Validation, Benchmarking & Research Evaluation Report

## 1. Abstract & Verification Scope
This report documents the empirical validation of the **SmartGrid AI** university timetable optimization and student voting integration platform. All optimization metrics, constraint validation checks, rescheduling runs, and API integration tests reported below were executed directly against the final codebase using deterministic CSP + DSatur Graph Coloring, Genetic Algorithm (GA), Simulated Annealing (SA), and Tabu Search—without Machine Learning or Google OR-Tools.

**Verification Boundaries (Honest Environment Reporting):**
- **Executed & Verified**: Python optimization algorithms, preference aggregator, unit/API integration tests (`app.dispatch` with in-memory PostgREST stub), `tsc --noEmit`, Vite `npm run build`, and Node export parity checks.
- **Not Executed Live (Sandbox Constraints)**: Live remote Supabase PostgreSQL network writes (no `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` in environment) and headless browser E2E rendering (no Chromium/Playwright binary installed); RLS and persistence are covered via static SQL migration inspection + in-memory stub API tests.
- **Datasets**: Controlled synthetic multi-cohort university benchmarks derived from `build_realistic_university_dataset()` (explicitly labeled synthetic).

---

## 2. Experiment A — Voting Influence Comparison (Disabled vs Normal vs Stronger)
Executed with identical academic dataset (8 cohorts, 75 weekly sessions), hard constraints, unavailability windows, and `seed=42`, varying voter preference influence through `compute_batch_preferences_from_records()` into `run_hybrid_timetable_pipeline()`.

| Metric | A (Disabled `0.0`) | B (Normal `0.65`) | C (Stronger `0.95`, pref wt `0.30`) |
|---|---:|---:|---:|
| Total Fitness Score | 97.91 | 94.61 | 92.68 |
| Student Satisfaction | 99.8% | 96.68% | 95.71% |
| Worst-Batch Satisfaction | 99.0% | 91.06% | 84.05% |
| Mean Batch Satisfaction | 99.8% | 96.68% | 95.71% |
| Fairness Score | 99.24% | 92.75% | 87.55% |
| Satisfaction Spread | 1.0 | 8.94 | 15.95 |
| Avg Idle Minutes / Batch | 0.0 | 0.0 | 0.0 |
| Total Schedule Gaps | 0 | 0 | 0 |
| Room Utilization | 86.76% | 86.76% | 86.76% |
| Hard Constraint Violations | 0 | 0 | 0 |
| Unplaced Sessions | 0 | 0 | 0 |
| Runtime (ms) | 1439.42 | 1306.09 | 1437.92 |
| Approved Polls Consumed | 0 | 3 | 3 |
| Preference Dimensions Affected | 0 | 3 | 3 |
| Session Placements Changed vs Config A | 0 / 75 | 72 / 75 | 75 / 75 |

*Note: Under Config A (`influence=0.0`), zero poll constraints are active so the optimizer evaluates only baseline compactness/timing heuristics (`99.8%`). Enabling competing batch poll targets under Config B (`0.65`) and Config C (`0.95`) enforces 3 preference dimensions and physically moves `72/75` session placements across morning/afternoon/free-day windows with `0` hard constraint violations.*

---

## 3. Experiment B — Participation Sensitivity & Poll Governance Filters
Verified monotonicity of confidence (`0.15 + 0.85 * part_pct/100`) and `0.45x` dampening below the 25% threshold, plus duplicate ballot deduplication and zero-vote exclusion.

| Participation Rate | Confidence | Effective Strength (`influence=0.65`) | Low-Turnout Flag | Zero-Vote Cohort Excluded |
|---:|---:|---:|:---:|:---:|
| 10% | 0.106 | 0.069 | True | True |
| 25% | 0.362 | 0.235 | False | True |
| 50% | 0.575 | 0.374 | False | True |
| 75% | 0.787 | 0.512 | False | True |
| 100% | 1.0 | 0.65 | False | True |

**Excluded Polls Verified (4 exclusion events logged):** `pending_review`, `rejected_from_optimizer`, `Published` (unclosed), and `zero_votes_in_batch` (`b-zero`) were all excluded with explicit audit reasons.

---

## 4. Experiment C — Batch Fairness & Cohort Size Normalization
### C.1 Per-Batch Normalization Across Cohort Sizes (20 vs 40 vs 80 vs 120)
Confirms small batches voting `afternoon` retain their own batch preference rather than being overridden by larger cohorts voting `morning`.

| Batch ID | Enrolled | Winning Batch Preference | Effective Strength |
|---|---:|---|---:|
| `b20` | 20 | `afternoon` | 0.539 |
| `b40` | 40 | `afternoon` | 0.512 |
| `b80` | 80 | `morning` | 0.512 |
| `b120` | 120 | `morning` | 0.539 |

### C.2 Contested Single-Room Stress Dataset (Balanced vs Rawlsian-Heavy)
| Configuration | Total Fitness | Mean Batch Sat | Worst-Batch Sat | Spread | Fairness | Hard Violations | Runtime (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Balanced Weights (`fairness=0.25`) | 99.12 | 100.0% | 100.0% | 0.0 | 100.0% | 0 | 200.96 |
| Rawlsian-Heavy (`fairness=0.65`) | 99.16 | 100.0% | 100.0% | 0.0 | 100.0% | 0 | 182.78 |

---

## 5. Experiment D — Conflicting Preference Scenarios Under Real Constraints
| Scenario | Feasible | Hard Violations | Total Fitness | Student Sat | Fairness | Avg Idle (m) | Runtime (ms) |
|---|:---:|---:|---:|---:|---:|---:|---:|
| Morning Lecture Contention (All Batches) | True | 0 | 96.74 | 99.05% | 96.55% | 0.0 | 1442.39 |
| Friday Free Day All Batches | True | 0 | 96.53 | 99.09% | 96.49% | 0.0 | 1391.83 |
| Lab Afternoon vs Morning Contention | True | 0 | 95.6 | 96.96% | 95.59% | 0.0 | 1431.59 |
| Compact Break Minimization | True | 0 | 98.12 | 99.92% | 99.76% | 0.0 | 1667.45 |

---

## 6. Experiment E — Automated Test Suite & Infeasibility Verification
- **Backend Unit & API Integration Suite**: `20/20` tests passed (Failures: `0`, Errors: `0`, Duration: `18388.1 ms`).
- **Over-Constrained Infeasibility Detection**:
  - Voting Disabled: `feasible=False`, `hardViolations=2`
  - Voting Enabled: `feasible=False`, `hardViolations=2`
  *(Hard constraints are never weakened to satisfy student voting preferences.)*

---

## 7. Experiments F & G — Multi-Scale Synthetic Benchmarks, Memory & Reproducibility
### F. Multi-Scale Synthetic Algorithm Matrix
| Workload (Synthetic) | Algorithm | Placed | Hard Viol | Fitness | Student Sat | Fairness | Avg Idle (m) | Time (ms) | Peak Mem (MB) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Small Synthetic (3 cohorts) | `dsatur_only` | 35/35 | 0 | 97.45 | 99.59% | 99.57% | 0.0 | 26.76 | 0.15 |
| Small Synthetic (3 cohorts) | `ga_only` | 35/35 | 0 | 69.37 | 66.94% | 43.15% | 73.33 | 285.89 | 0.5 |
| Small Synthetic (3 cohorts) | `ga_sa` | 35/35 | 0 | 79.05 | 72.66% | 72.99% | 40.0 | 372.94 | 0.5 |
| Small Synthetic (3 cohorts) | `hybrid_dsatur_ga_sa` | 35/35 | 0 | 97.71 | 99.87% | 99.69% | 0.0 | 625.96 | 0.57 |
| Medium Realistic Synthetic (8 cohorts) | `dsatur_only` | 75/75 | 0 | 95.86 | 98.23% | 94.99% | 0.0 | 28.99 | 0.33 |
| Medium Realistic Synthetic (8 cohorts) | `ga_only` | 75/75 | 0 | 52.8 | 44.25% | 15.01% | 149.38 | 659.54 | 1.15 |
| Medium Realistic Synthetic (8 cohorts) | `ga_sa` | 75/75 | 0 | 61.2 | 62.9% | 16.95% | 75.62 | 809.51 | 1.03 |
| Medium Realistic Synthetic (8 cohorts) | `hybrid_dsatur_ga_sa` | 75/75 | 0 | 97.72 | 99.62% | 98.91% | 0.0 | 1616.74 | 1.29 |
| University-Wide Synthetic (16 cohorts) | `dsatur_only` | 150/150 | 0 | 91.84 | 96.41% | 82.0% | 3.75 | 57.31 | 0.7 |
| University-Wide Synthetic (16 cohorts) | `ga_only` | 150/150 | 0 | 51.36 | 43.61% | 5.13% | 194.69 | 1239.78 | 2.2 |
| University-Wide Synthetic (16 cohorts) | `ga_sa` | 150/150 | 0 | 51.36 | 43.61% | 5.13% | 194.69 | 1797.87 | 2.2 |
| University-Wide Synthetic (16 cohorts) | `hybrid_dsatur_ga_sa` | 150/150 | 0 | 95.26 | 97.74% | 94.42% | 0.0 | 2946.9 | 2.51 |
| High-Contention Resource Stress (8 cohorts, -2 rooms) | `dsatur_only` | 75/75 | 2 | 60.57 | 98.32% | 94.74% | 0.0 | 27.74 | 0.33 |
| High-Contention Resource Stress (8 cohorts, -2 rooms) | `ga_only` | 75/75 | 2 | 19.83 | 57.21% | 0.0% | 150.62 | 584.73 | 1.15 |
| High-Contention Resource Stress (8 cohorts, -2 rooms) | `ga_sa` | 75/75 | 2 | 28.24 | 62.74% | 26.79% | 91.25 | 837.6 | 1.15 |
| High-Contention Resource Stress (8 cohorts, -2 rooms) | `hybrid_dsatur_ga_sa` | 75/75 | 2 | 61.81 | 99.09% | 97.63% | 0.0 | 1345.1 | 1.16 |

### G. Multi-Seed Reproducibility (Medium Realistic Synthetic Dataset)
- **Fixed Seed (`seed=42`, 5 trials)**: Scores `[97.77, 97.77, 97.77, 97.77, 97.77]` -> Mean: `97.77`, Best: `97.77`, Worst: `97.77`, StdDev: `0.0`, Feasibility: `100.0%`, Mean Runtime: `1411.71 ms`.
- **Distinct Seeds (`[42, 101, 202, 303, 404]`)**: Scores `[97.77, 97.24, 97.6, 97.57, 97.12]` -> Mean: `97.46`, Best: `97.77`, Worst: `97.12`, StdDev: `0.242`, Feasibility: `100.0%`, Mean Student Sat: `99.45%`, Mean Fairness: `98.37%`, Mean Runtime: `1535.01 ms`.

---

## 8. Experiment H — Adaptive Tabu Search Rescheduling Scenarios
| Disruption Scenario | Type | Affected | Changed | Unchanged | Stability | Remaining Hard Viol | Staff Mutations | Time (ms) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Faculty Unavailability | `instructor_unavailable` | 1 | 1 | 74 | 98.67% | 0 | 0 | 38.04 |
| Classroom Maintenance | `room_unavailable` | 1 | 1 | 74 | 98.67% | 0 | 0 | 47.01 |
| Laboratory Hardware Outage | `lab_unavailable` | 1 | 1 | 74 | 98.67% | 0 | 0 | 31.27 |
| Forced Course Slot Move | `forced_course_move` | 1 | 1 | 74 | 98.67% | 0 | 0 | 27.31 |
| Lab Engineer Conflict | `lab_engineer_unavailable` | 1 | 1 | 74 | 98.67% | 0 | 0 | 23.55 |

---

## 9. Experiment J — Supabase Schema & RLS Static Audit
- **Migrations Audited**: `20261110000001_initial_smartgrid_schema.sql, 20261117000001_timetable_engine_rework.sql, 20261117000002_voting_integration.sql`
- **RLS-Protected Tables (34)**: `academic_programs, batches, br_assignments, classrooms, course_enrollments, course_sessions, courses, departments, disruptions, feedback, institution_data, institutions, instructor_availability, instructor_preferences, instructors, laboratories, notifications, optimization_poll_traceability, optimization_runs, optimization_scores, poll_options, poll_votes, polls, rescheduling_history, rescheduling_proposals, room_equipment_capacities, scheduling_constraints, semesters, student_preferences, students, timetable_entries, timetable_feedback, timetable_versions, users`
- **Row-Level Security Policies Defined**: `14`

---

## 10. System Integrity & Toolchain Verification
- **TypeScript Type Check (`npx tsc --noEmit`)**: Verified with 0 errors.
- **Production Vite Build (`npm run build`)**: Completed with 0 errors.
- **Canonical Exports (`googleSheetsExport.ts`)**: Verified Friday rightmost placement, disabled-Friday omission, continuous lab spanning, Lab Engineer display, and CSV/Excel cell parity.
