# SmartGrid AI — Supplementary Experimental Results Audit & Verification Report

## 1. Audit Mandate & Scope
This supplementary audit report directly examines and verifies five methodological and evidentiary questions raised against `/FINAL_RESEARCH_EVALUATION_REPORT.md`, without rebuilding the architecture, altering core algorithms, weakening hard constraints, or introducing Machine Learning or Google OR-Tools. Every table and conclusion below was executed directly against the live Python optimization codebase via `/backend/tests/targeted_audit_verification.py` and `/backend/tests/test_*.py`.

---

## 2. Audit 1 — Voting Satisfaction Comparability (Configs A vs B vs C)

### 2.1 Root-Cause Finding: Why the Original Comparison Was Not Directly Valid
Inspection of `/backend/app/optimization/preference_aggregator.py` and `/backend/app/optimization/fitness.py` confirms that Configurations **A** (`99.8%`), **B** (`96.68%`), and **C** (`95.71%`) in the original report did **not** share the same formula, penalty scale, denominator, or objective weights:

1. **Disabled Voting Omitted the Preference Penalty Denominator (`Config A`)**: In `preference_aggregator.py` (`lines 90–97`), setting `weights_influence <= 0.0` produces an empty `batchPreferences = {}` (`[]`). In `evaluate_timetable_fitness()` (`fitness.py` `lines 419–473` & `547–608`), `if batch_prefs:` is skipped entirely (`pref_pen = 0.0`, `pref_score = 100.0`). Config A therefore evaluated **only** gap, early/late, and compactness penalties while vacuously assuming 100% preference fulfillment.
2. **Strength Scaling Inflated Penalties Under Config C (`Config B vs C`)**: When voting is enabled, `fitness.py` (`lines 425, 432`) divides each category's aggregated strength by `0.65` (`base_mult = raw_strength / 0.65`). Thus `influence=0.65` gives multiplier `0.691x` (for 65% participation in `experiment_a`), whereas `influence=0.95` gives multiplier `1.009x` — subtracting strictly larger penalties from `b_score` for the exact same timetable slot assignment.
3. **Mutated Objective Weights in Config C (`generate_final_report.py` `line 205`)**: Original Config A and Config B used default `OptimizationWeights(gap=0.35, fairness=0.25, inst=0.20, room=0.15, pref=0.15)`, whereas Config C simultaneously altered weights to `(gap=0.25, fairness=0.20, inst=0.15, room=0.10, pref=0.30)`.

### 2.2 Recalculation Under One Independent Common Evaluation Function
To establish an apples-to-apples comparison, `independent_evaluate_schedule()` in `/backend/tests/targeted_audit_verification.py` evaluates **every generated schedule independently of `fitness.py`** against the **exact same fixed ground-truth student poll targets** (`preferred_time_window`, `preferred_lab_window`, `preferred_free_day`) and identical physical metrics (`compactness`, `idle_minutes`, `gap_count`), using zero `weights_influence` penalty scaling:

$$\text{CommonBatchSatisfaction} = 0.50 \times \text{GapHealth} + 0.50 \times \text{PreferenceFulfillment}$$

Four controlled configurations were executed on `build_realistic_university_dataset()` (`8` cohorts, `75` sessions, `seed=42`):
- **A**: `influence=0.0`, default weights `(0.35, 0.25, 0.20, 0.15, 0.15)`
- **B**: `influence=0.65`, default weights `(0.35, 0.25, 0.20, 0.15, 0.15)`
- **C1**: `influence=0.95`, default weights `(0.35, 0.25, 0.20, 0.15, 0.15)` *(isolates voting influence cleanly)*
- **C2**: `influence=0.95`, report weights `(0.25, 0.20, 0.15, 0.10, 0.30)` *(reproduces original Config C)*

#### Table 1.1 — Aggregate Comparison (Internal Optimizer Metric vs Independent Common Evaluator)

| Metric | A (`0.0`, default wt) | B (`0.65`, default wt) | C1 (`0.95`, default wt) | C2 (`0.95`, pref wt `0.30`) |
|---|---:|---:|---:|---:|
| *Internal Optimizer `studentSatisfaction`* *(biased denom.)* | 99.59% | 97.36% | 97.00% | 95.47% |
| *Internal Optimizer `totalScore`* | 97.79 | 95.39 | 94.82 | 91.74 |
| **Common Overall Satisfaction** *(same formula)* | **73.45%** | **87.67%** | **89.22%** | **89.38%** |
| **Common Worst-Batch Satisfaction** | **66.47%** | **77.78%** | **77.78%** | **73.59%** |
| **Common Best-Batch Satisfaction** | 88.89% | 100.00% | 99.85% | 100.00% |
| **Common Satisfaction Spread** | 22.42 | 22.22 | 22.07 | 26.41 |
| **Common Preference Fulfillment** | **47.05%** | **75.40%** | **78.56%** | **81.25%** |
| **Common Gap Health Score** | 99.84% | 99.95% | 99.88% | 97.52% |
| **Avg Compactness (%)** | 99.31% | 99.86% | 99.57% | 98.94% |
| **Avg Idle Minutes / Batch** *(Total)* | 0.0 (0) | 0.0 (0) | 0.0 (0) | 7.5 (60) |
| **Total Schedule Gap Count** | 0 | 0 | 0 | 1 |
| Hard Constraint Violations | 0 | 0 | 0 | 0 |
| Placements Changed vs Config A | 0 / 75 | 75 / 75 | 70 / 75 | 70 / 75 |

#### Table 1.2 — Batch-Wise Independent Evaluation Breakdown (All 8 Cohorts)

| Batch (`Target: Lec / Lab / Free`) | Metric | A (`0.0`) | B (`0.65`) | C1 (`0.95`, def) | C2 (`0.95`, 0.30) |
|---|---|---:|---:|---:|---:|
| `2K24-BSCS-A` *(Morn / Aft / Fri)* | Common Sat / Pref Fulfill | 72.10% / 44.45% | 77.78% / 55.56% | 77.78% / 55.56% | 77.78% / 55.56% |
| | Lec / Lab / Free / Idle / Gaps | 100 / 0 / 33.34 / 0m / 0 | 100 / 0 / 66.67 / 0m / 0 | 100 / 0 / 66.67 / 0m / 0 | 100 / 0 / 66.67 / 0m / 0 |
| `2K24-BSCS-B` *(Aft / Morn / Wed)* | Common Sat / Pref Fulfill | 70.68% / 41.67% | 91.67% / 83.33% | 97.22% / 94.44% | 97.22% / 94.44% |
| | Lec / Lab / Free / Idle / Gaps | 25 / 100 / 0.01 / 0m / 0 | 83.3 / 100 / 66.7 / 0m / 0 | 83.3 / 100 / 100 / 0m / 0 | 83.3 / 100 / 100 / 0m / 0 |
| `2K24-BSCS-C` *(Morn / Aft / Fri)* | Common Sat / Pref Fulfill | 66.47% / 33.34% | 78.33% / 56.67% | 83.33% / 66.67% | 83.33% / 66.67% |
| | Lec / Lab / Free / Idle / Gaps | 100 / 0 / 0.01 / 0m / 0 | 70 / 0 / 100 / 0m / 0 | 100 / 0 / 100 / 0m / 0 | 100 / 0 / 100 / 0m / 0 |
| `2K25-BSCS-A` *(Aft / Morn / Wed)* | Common Sat / Pref Fulfill | 84.03% / 68.06% | 95.83% / 91.67% | 97.77% / 95.83% | 99.80% / 100.00% |
| | Lec / Lab / Free / Idle / Gaps | 37.5 / 100 / 66.7 / 0m / 0 | 75 / 100 / 100 / 0m / 0 | 87.5 / 100 / 100 / 0m / 0 | 100 / 100 / 100 / 0m / 0 |
| `2K25-BSCS-B` *(Morn / Aft / Fri)* | Common Sat / Pref Fulfill | 66.51% / 33.34% | 83.33% / 66.67% | 77.78% / 55.56% | 73.59% / 66.67% |
| | Lec / Lab / Free / Idle / Gaps | 100 / 0 / 0.01 / 0m / 0 | 100 / 0 / 100 / 0m / 0 | 100 / 0 / 66.7 / 0m / 0 | 100 / 0 / 100 / **60m / 1** |
| `2K24-BSEE-A` *(Aft / Morn / Wed)* | Common Sat / Pref Fulfill | 88.89% / 77.78% | 100.00% / 100.00% | 99.85% / 100.00% | 100.00% / 100.00% |
| | Lec / Lab / Free / Idle / Gaps | 100 / 100 / 33.3 / 0m / 0 | 100 / 100 / 100 / 0m / 0 | 100 / 100 / 100 / 0m / 0 | 100 / 100 / 100 / 0m / 0 |
| `2K24-BSEE-B` *(Morn / Aft / Fri)* | Common Sat / Pref Fulfill | 72.22% / 44.44% | 77.78% / 55.56% | 83.33% / 66.67% | 83.33% / 66.67% |
| | Lec / Lab / Free / Idle / Gaps | 33.3 / 0 / 100 / 0m / 0 | 100 / 0 / 66.7 / 0m / 0 | 100 / 0 / 100 / 0m / 0 | 100 / 0 / 100 / 0m / 0 |
| `2K25-BSMTH-A` *(Aft / None / Wed)* | Common Sat / Pref Fulfill | 66.67% / 33.34% | 96.68% / 93.75% | 96.68% / 93.75% | 100.00% / 100.00% |
| | Lec / Lab / Free / Idle / Gaps | 0.0 / N/A / 66.7 / 0m / 0 | 87.5 / N/A / 100 / 0m / 0 | 87.5 / N/A / 100 / 0m / 0 | 100 / N/A / 100 / 0m / 0 |

**Interpretation:**
- Under an identical evaluation formula, enabling voting preferences raises **Preference Fulfillment from 47.05% (A) → 75.40% (B) → 78.56% (C1) → 81.25% (C2)** and **Overall Common Satisfaction from 73.45% → 87.67% → 89.22% → 89.38%**.
- Note also why `labMatchPct` stays `0.0%` for cohorts requesting *afternoon* 3-hour labs when labs cannot span the 13:00–14:00 midday break cleanly or collide with preferred afternoon lecture/free-day choices; and in **C2**, boosting `preferences` weight from `0.15 → 0.30` while lowering `student_gap_minimization` (`0.35 → 0.25`) produced higher mean preference fulfillment (`81.25%`) at the real trade-off of introducing `1` 60-minute gap in `2K25-BSCS-B` (dropping worst-batch common satisfaction from `77.78%` to `73.59%`).

---

## 3. Audit 2 — Fairness Verification

### 3.1 Cohort-Size Fairness Run Through the Actual Timetable Optimizer (20 vs 40 vs 80 vs 120)
The original `experiment_c_fairness_and_batch_size` only verified preference *aggregation* for cohorts of sizes `20, 40, 80, 120`. Here we execute a **complete end-to-end optimization run** (`32` weekly sessions across `4` shared lecture rooms and shared faculty `i-shared-1`, `i-shared-2`, `seed=42`, `influence=0.65`) where small cohorts (`20`, `40`) vote `afternoon` and large cohorts (`80`, `120`) vote `morning`.

#### Table 2.1 — End-to-End Cohort Size Fairness (`hardViolations = 0`, `feasible = True`)

| Cohort | Size | Original Vote Majority | Aggregated Preference | Preference Influence | Actual Pref Fulfillment | Optimizer Sat | Common Sat | Idle (m) | Gaps | Compactness |
|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|
| `b20` | 20 | `afternoon` (16/20 = 80%) | `afternoon` | 0.539 | **87.50%** *(7/8)* | 100.00% | 93.55% | 0 | 0 | 98.41% |
| `b40` | 40 | `afternoon` (30/40 = 75%) | `afternoon` | 0.512 | **100.00%** *(8/8)* | 100.00% | 100.00% | 0 | 0 | 100.00% |
| `b80` | 80 | `morning` (60/80 = 75%) | `morning` | 0.512 | **100.00%** *(8/8)* | 100.00% | 100.00% | 0 | 0 | 100.00% |
| `b120` | 120 | `morning` (96/120 = 80%) | `morning` | 0.539 | **100.00%** *(8/8)* | 100.00% | 100.00% | 0 | 0 | 100.00% |

**Verified Conclusion:** Large cohorts (`80, 120`) do **not** drown out small cohorts (`20, 40`) either during preference aggregation (`b20` retains strength `0.539` matching `b120` at equal 80% participation/majority) or in actual scheduled timetables (`b20` receives `7/8 = 87.5%` afternoon sessions and `b40` receives `8/8 = 100%` afternoon sessions, both with `0` idle minutes and `0` gaps).

### 3.2 Fairness Weight Sensitivity Audit (`student_fairness` on Genuinely Scarce Contention)
First, our audit confirms that the original Report Experiment C.2 (`12` sessions in `35` room-slots) had excess slack (every batch scored `100.0%` regardless of fairness weight). Even a 27-lecture / 30-morning-slot variant remained under-saturated (`99.69%` across all weights).

Therefore, we constructed an **over-subscribed scarce-morning stress dataset** (`friday_enabled=False`, Mon–Thu only = `2 rooms × 4 days × 3 morning slots = 24` morning room-slots vs **`36` lectures** across 3 cohorts all demanding `morning` + `Thu` free, plus faculty morning unavailability). At least `12/36` sessions are mathematically forced into afternoon or crowded slots. We evaluated across `5` seeds (`[42, 101, 202, 303, 404]`) under both (a) rebalanced weights and (b) *ceteris paribus* fixed gap/preference weights:

#### Table 2.2 — Scarce-Morning Contention (36 Lectures vs 24 Morning Slots, 5-Seed Means)

| Mode & Weight Config | `student_fairness` Wt | Fitness Term `0.18+0.12w` | Mean Opt Fairness | Mean Opt Worst-Batch | Mean Common Worst-Batch | Mean Common Spread | Mean Pref Fulfill | Mean Idle (m) | Mean Gaps | Hard Viol |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **(a) Rebalanced Weights** *(varying gap/pref wt too)* | | | | | | | | | | |
| `Fairness_0.00` (`gap=0.45, pref=0.25`) | 0.00 | 0.180 | 60.50% | 58.68% | 57.52% | 28.60 | 55.56% | 40.0 | 1.6 | 0 |
| `Fairness_0.25` (`gap=0.35, pref=0.15`) | 0.25 | 0.210 | **72.56%** | **72.47%** | **66.42%** | **8.47** | 51.39% | 32.0 | 1.6 | 0 |
| `Fairness_0.65` (`gap=0.15, pref=0.10`) | 0.65 | 0.258 | 60.32% | 58.82% | 59.35% | 32.45 | **60.84%** | 40.0 | 1.6 | 0 |
| `Fairness_0.95` (`gap=0.05, pref=0.05`) | 0.95 | 0.294 | 63.92% | 61.78% | 57.62% | 36.54 | 54.72% | **24.0** | **1.0** | 0 |
| **(b) Isolated *Ceteris Paribus*** *(fixed `gap=0.35, pref=0.15`)* | | | | | | | | | | |
| `sf = 0.00` | 0.00 | 0.180 | 79.65% | 75.04% | 60.83% | 39.17 | — | 0.0 | 0 | 0 |
| `sf = 0.25` | 0.25 | 0.210 | 79.65% | 75.04% | 60.83% | 39.17 | — | 0.0 | 0 | 0 |
| `sf = 0.65` | 0.65 | 0.258 | 79.65% | 75.04% | 60.83% | 39.17 | — | 0.0 | 0 | 0 |
| `sf = 0.95` | 0.95 | 0.294 | 79.65% | 75.04% | 60.83% | 39.17 | — | 0.0 | 0 | 0 |

**Honest Code-Level Audit Finding (Limitation Identified):**
- Rawlsian fairness is genuinely enforced in the baseline objective (`fitness.py` line 612 always weights `least_satisfied_batch` by at least `0.18`, plus `avg_student_sat`).
- However, **sensitivity to changing the user-facing `student_fairness` weight parameter alone is flat/non-monotonic** for two code-verified reasons:
  1. `fitness.py` (`line 612`) compresses `student_fairness` via `w_fair_term = 0.18 + w_student_fair * 0.12`, giving a narrow `[0.180 .. 0.294]` range regardless of whether `w_student_fair` is `0.0` or `0.95`.
  2. `graph_coloring.py` (`lines 219–221`) uses only `gap_w` and `pref_w` (not `w_student_fair`) during DSatur construction, so when gap/preference weights are held fixed (`(b)`), DSatur emits the same initial seed and `12` GA generations + `70` SA iterations did not jump out of that basin across `0.18..0.294`; conversely, aggressively lowering `gap` weight to boost `fairness` (`Fairness_0.65`, `0.95` in `(a)`) weakens DSatur's `gap_w`, degrading worst-batch quality compared to balanced `Fairness_0.25`.

---

## 4. Audit 3 — Adaptive Rescheduling Verification (Detailed Pre/Post Conflict Traces)

### 4.1 Why All 5 Original Scenarios Moved Exactly `1/75` Sessions
In `/backend/tests/generate_final_report.py` (`lines 506–518`), each scenario extracted **one single already-scheduled session entry** and blocked **only 1 day and 1 start time** (`affected_days=[e["day"]]`, `affected_start_times=[e["startTime"]]`). Because the valid baseline schedule (`seed=42`, `75` sessions) already prohibited double-booking any instructor, lab engineer, or room in a single time slot, **at most 1 session** could physically exist in that `(resource, day, startTime)` tuple. Since alternate conflict-free slots/rooms existed in the medium schedule and `tabu_search.py` (`lines 119–121`) exits as soon as `validate_timetable_assignments(...).is_valid` becomes `True`, each repair required exactly `1` move (`74/75 = 98.67%` stability).

### 4.2 Full Before/After Trace of All 5 Single-Slot Scenarios + 3 Multi-Session / Cascading Outages
Using `validate_timetable_assignments()` **prior** to calling `generate_rescheduling_proposal()`, we verified that every scenario genuinely injects live hard constraint violations into the schedule before Tabu Search executes:

#### Table 3.1 — Verified Pre-Repair Conflict Injection, Assignment Trace, and Post-Repair Resolution

| # | Scenario (`Disruption Type` / `Resource` / `Blocked Window`) | Pre-Repair Hard Viol (`Validator`) | Affected Session(s) | Exact Assignment Before → After | Post-Repair Hard Viol | Stability | Staff Mut | Time (ms) |
|---|---|---:|---|---|---:|---:|---:|---:|
| **1** | Faculty Unavail (`instructor_unavailable` / `inst-dijkstra` / `Mon 09:00`) | **1** *(Staff `inst-dijkstra` unavail on `Mon 09:00`)* | `sec-crs-algo-grp-mth25-a-lec_m2` (`CS-302`, `2K25-BSMTH-A`) | `Mon 09:00–09:50 @ rm-lh3` → **`Fri 14:30 @ rm-lh5`** | **0** | 98.67% (`74/75`) | 0 | 33.84 |
| **2** | Classroom Maint (`room_unavailable` / `rm-lh3` / `Mon 09:00`) | **1** *(Room `rm-lh3` unavail on `Mon 09:00`)* | `sec-crs-algo-grp-mth25-a-lec_m2` (`CS-302`, `2K25-BSMTH-A`) | `Mon 09:00–09:50 @ rm-lh3` → **`Fri 14:30 @ rm-lh5`** | **0** | 98.67% (`74/75`) | 0 | 53.18 |
| **3** | Lab Outage (`lab_unavailable` / `rm-lab3` / `Mon 09:00`) | **1** *(Room `rm-lab3` unavail on `Mon 09:00`)* | `sec-crs-os-grp-cs24-c-lab` (`CS-301`, `2K24-BSCS-C`) | `Mon 09:00–12:00 @ rm-lab3` → **`Mon 09:00 @ rm-lab2`** | **0** | 98.67% (`74/75`) | 0 | 25.58 |
| **4** | Forced Course Move (`forced_course_move` / `sec-crs-prob-grp-cs25-b-lec` / `Fri 12:00`) | **1** *(Staff `inst-gauss` block on `Fri 12:00`)* | `sec-crs-prob-grp-cs25-b-lec_m0` (`MTH-210`, `2K25-BSCS-B`) | `Fri 12:00–12:50 @ rm-lh5` → **`Fri 14:30 @ rm-lh5`** | **0** | 98.67% (`74/75`) | 0 | 44.51 |
| **5** | Lab Engineer Conflict (`lab_engineer_unavailable` / `eng-bilal` / `Mon 09:00`) | **1** *(Staff `eng-bilal` unavail on `Mon 09:00`)* | `sec-crs-os-grp-cs24-c-lab` (`CS-301`, `2K24-BSCS-C`) | `Mon 09:00–12:00 @ rm-lab3` → **`Thu 14:00 @ rm-lab3`** | **0** | 98.67% (`74/75`) | 0 | 24.42 |
| **6** | **Full-Day Faculty Outage** (`instructor_unavailable` / `inst-gauss` / `Mon` all 7 slots) | **6** *(6 `inst-gauss` Mon lectures blocked)* | `HUM-101` (`EE24-A`), `MTH-201` (`CS25-A`, `EE24-A`, `EE24-B`, `MTH25-A`), `MTH-210` (`MTH25-A`) | All 6 `Mon` sessions relocated across `Tue`/`Wed`/`Thu`/`Fri` (`14:30–16:00`) | **0** | **92.00%** (`69/75`) | 0 | 297.88 |
| **7** | **Full-Day Classroom Outage** (`room_unavailable` / `rm-lh5` / `Mon` all 7 slots) | **5** *(5 `rm-lh5` Mon lectures blocked)* | `CS-310` (`CS24-A`), `CS-302` (`CS24-A`, `CS24-C`), `CS-201` (`CS25-B`), `MTH-201` (`EE24-A`) | 4 shifted to `rm-lh1/2/3/4` same slot; `CS-302` (`CS24-C`) moved to `Thu 14:00 @ rm-lh4` | **0** | **93.33%** (`70/75`) | 0 | 375.70 |
| **8** | **High-Contention 3-Room Full-Day Outage** (`room_unavailable` / `rm-lh3` / `Mon`, only 3 lecture rooms total) | **7** *(7 `rm-lh3` Mon lectures blocked)* | `CS-302` (`CS24-A`, `CS24-C`), `HUM-101` (`CS24-B`), `CS-301` (`CS24-C`), `CS-201`, `MTH-201`, `MTH-210` (`CS25-B`) | 4 shifted same-day (`rm-lh1/2`); 3 shifted to `Mon 15/16` or `Fri 15:30 @ rm-lh2` | **0** | **90.67%** (`68/75`) | 0 | 310.77 |

*(Code note for audit completeness: `rescheduler.py` lines 186–196 implement `forced_course_move` by blocking `sess.staff_ids` on the target slot; for any staffed course section as above, this works cleanly, whereas an unstaffed section with `staff_ids == []` would rely on `affected_session_ids` fallback rather than an unavailability constraint. Documented without modifying algorithm code.)*

---

## 5. Audit 4 — Multi-Seed Algorithm Benchmark Evidence & Hyperparameters

### 5.1 Exact Algorithm Hyperparameters & Seed Progression (Verified from Codebase)

| Component | Exact Implemented Configuration | Source |
|---|---|---|
| **DSatur (`dsatur_only`)** | Deterministic saturation order: `(saturation_deg, is_lab, duration_min, graph_deg, -compat_rooms_len)`, `randomize_ties=False` (all seeds yield identical deterministic result); tightest-fit room ordering; `gap_w = max(0.25, w_gap / 0.35)`, `pref_w = max(0.25, w_pref / 0.15)` | `graph_coloring.py` `lines 219–370`, `scheduler.py` `lines 226–250` |
| **Unseeded GA (`ga_only`)** | `population_size=10`, `generations=10`, `seed_with_dsatur=False` (shuffled random placement + greedy `_repair_conflicts`), tournament `k=3`, elitism `top 2`, uniform crossover (`rate=1.0` + conflict repair), gap-aware mutation (`chromo_prob=0.65`, `gene_frac=0.22`) | `genetic_algorithm.py` `lines 355–540`, `scheduler.py` `lines 251–268` |
| **GA + SA (`ga_sa`)** | Unseeded GA (`pop=10, gen=10, seed=seed`) followed by SA (`initial_temp=18.0`, `cooling_rate=0.94`, `max_iterations=70`, Boltzmann acceptance `exp(delta/T)` for `T > 0.05`, strict non-increasing `hard_violations`, `seed=seed+1`) | `simulated_annealing.py` `lines 150–235`, `scheduler.py` `lines 269–299` |
| **Hybrid (`hybrid_dsatur_ga_sa`)** | Deterministic DSatur seed (`seed=seed`) + `11` randomized-tie DSatur chromosomes (`seed+1+i`), evolved by GA (`pop=12, gen=12, k=3, elite=2, mut=0.65/0.22`, `seed=seed+1`), refined by SA (`T0=18.0, alpha=0.94, iters=70`, `seed=seed+2`) | `scheduler.py` `lines 300–344`, `genetic_algorithm.py` `lines 444–461` |
| **Tabu Search (`tabu_reschedule`)** | `max_iterations=25`, `tabu_tenure=7`, objective `total_score + 0.5*stability_pct - 40.0*hard_violations`, aspiration `(hard_violations==0 and n_obj > best_obj)`, early exit on first zero-violation state | `tabu_search.py` `lines 56–262` |

### 5.2 Multi-Seed Comparative Benchmark Results (`seeds = [42, 101, 202, 303, 404]`, 80 Pipeline Runs)

| Workload (Synthetic) | Algorithm | Mean Fit | Best Fit | Worst Fit | StdDev | Mean Sat | Mean Fair | Mean Time (ms) | Feas % | Mean / Max Hard Viol |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **Small (3 cohorts, 35 sess)** | `dsatur_only` | 97.45 | 97.45 | 97.45 | 0.000 | 99.59% | 99.57% | 11.70 | 100.0% | 0 / 0 |
| Small (3 cohorts, 35 sess) | `ga_only` | 67.20 | 76.46 | 56.65 | 6.435 | 63.00% | 41.93% | 277.87 | 100.0% | 0 / 0 |
| Small (3 cohorts, 35 sess) | `ga_sa` | 85.12 | 89.54 | 79.05 | 3.968 | 83.94% | 77.93% | 382.48 | 100.0% | 0 / 0 |
| Small (3 cohorts, 35 sess) | **`hybrid_dsatur_ga_sa`** | **97.78** | **97.90** | **97.72** | **0.065** | **99.92%** | **99.81%** | 620.18 | **100.0%** | **0 / 0** |
| **Medium (8 cohorts, 75 sess)** | `dsatur_only` | 94.60 | 94.60 | 94.60 | 0.000 | 97.26% | 91.97% | 30.81 | 100.0% | 0 / 0 |
| Medium (8 cohorts, 75 sess) | `ga_only` | 54.73 | 60.86 | 50.48 | 3.459 | 48.88% | 14.20% | 654.35 | 100.0% | 0 / 0 |
| Medium (8 cohorts, 75 sess) | `ga_sa` | 66.59 | 71.55 | 57.86 | 5.437 | 64.25% | 39.16% | 785.81 | 100.0% | 0 / 0 |
| Medium (8 cohorts, 75 sess) | **`hybrid_dsatur_ga_sa`** | **97.17** | **97.37** | **96.71** | **0.246** | **99.38%** | **97.42%** | 1458.62 | **100.0%** | **0 / 0** |
| **High-Contention (8 coh, -2 big rms)*** | `dsatur_only` | 61.36 | 61.36 | 61.36 | 0.000 | 98.32% | 97.19% | 28.37 | 0.0% | 2 / 2 |
| High-Contention (8 coh, -2 big rms)* | `ga_only` | 18.63 | 23.42 | 16.06 | 2.524 | 49.52% | 9.88% | 621.47 | 0.0% | 2 / 2 |
| High-Contention (8 coh, -2 big rms)* | `ga_sa` | 26.25 | 32.39 | 20.22 | 4.786 | 58.25% | 27.37% | 820.73 | 0.0% | 2 / 2 |
| High-Contention (8 coh, -2 big rms)* | **`hybrid_dsatur_ga_sa`** | **61.36** | **61.38** | **61.36** | **0.008** | **98.32%** | **97.20%** | 1331.57 | 0.0% | 2 / 2 |
| **University-Wide (16 cohorts, 150 sess)** | `dsatur_only` | 94.12 | 94.12 | 94.12 | 0.000 | 96.16% | 93.30% | 61.13 | 100.0% | 0 / 0 |
| University-Wide (16 cohorts, 150 sess) | `ga_only` | 47.65 | 51.36 | 44.70 | 2.474 | 38.13% | 2.73% | 1321.48 | 100.0% | 0 / 0 |
| University-Wide (16 cohorts, 150 sess) | `ga_sa` | 50.90 | 54.90 | 48.20 | 2.274 | 43.63% | 5.44% | 1719.08 | 100.0% | 0 / 0 |
| University-Wide (16 cohorts, 150 sess) | **`hybrid_dsatur_ga_sa`** | **94.97** | **95.83** | **94.12** | **0.596** | **97.75%** | **93.55%** | 2961.18 | **100.0%** | **0 / 0** |

*\*Note on High-Contention (`-2` rooms): `_scale_dataset(1, extra_room_slack=-2)` removes the first 2 lecture rooms (`rm-lh1` cap 120, `rm-lh2` cap 80), leaving max room capacity `70` while shared elective `CS-415` has `expectedStudents=110` (`2` meetings/week). All algorithms deterministically incur exactly `2` capacity violations because hard capacity constraints cannot be bypassed. When retaining `rm-lh1..3` and removing `rm-lh4, rm-lh5` (see Section 4, Scenario 8), `hybrid_dsatur_ga_sa` achieves `100%` feasibility (`0` hard violations, score `97.92`).*

---

## 6. Audit 5 — Verification Integrity & Provenance Mapping
Every numeric claim across `/FINAL_RESEARCH_EVALUATION_REPORT.md` and this supplementary audit maps directly to live executable code — **zero values are hardcoded or fabricated**.

| Experiment / Metric Area | Core Source File(s) | Evaluation / Core Function(s) | Dataset Generator / Fixture | Benchmark / Test Function | Executed Verification Command |
|---|---|---|---|---|---|
| **Voting Aggregation & Influence (Exp A, Audit 1)** | `backend/app/optimization/preference_aggregator.py`, `fitness.py`, `scheduler.py` | `compute_batch_preferences_from_records()`, `evaluate_timetable_fitness()`, `independent_evaluate_schedule()` | `build_realistic_university_dataset()` + closed/approved polls | `experiment_a_voting_influence()`, `audit_voting_comparability()` | `python3 backend/tests/targeted_audit_verification.py` |
| **Participation & Poll Governance (Exp B)** | `backend/app/optimization/preference_aggregator.py`, `backend/app/routers/voting.py` | `compute_batch_preferences_from_records()`, `VotingAndValidationTests` | Synthetic 100-student + `b-zero` batches; `InMemorySupabaseStub` | `experiment_b_participation_sensitivity()`, `test_01_full_api_voting...`, `test_02_per_batch_norm...` | `python3 -m unittest discover -s backend/tests -v` |
| **Batch Fairness & Weight Sensitivity (Exp C, Audit 2)** | `backend/app/optimization/preference_aggregator.py`, `fitness.py`, `graph_coloring.py` | `compute_batch_preferences_from_records()`, `evaluate_timetable_fitness()`, `run_hybrid_timetable_pipeline()` | 20/40/80/120 cohorts + 36-vs-24 scarce morning dataset | `audit_fairness_verification()` | `python3 backend/tests/targeted_audit_verification.py` |
| **Conflicting Preferences & Infeasibility (Exp D, E)** | `backend/app/optimization/scheduler.py`, `validator.py` | `run_hybrid_timetable_pipeline()`, `validate_timetable_assignments()` | `build_realistic_university_dataset()`, blocked `i-busy` fixture | `experiment_d_conflicting_preferences()`, `experiment_e_unit_and_infeasibility()`, `test_03_infeasibility_detection...` | `python3 -m unittest discover -s backend/tests -v` |
| **Multi-Scale & Multi-Seed Benchmarks (Exp F, G, Audit 4)** | `scheduler.py`, `graph_coloring.py`, `genetic_algorithm.py`, `simulated_annealing.py`, `evaluation.py` | `run_hybrid_timetable_pipeline()`, `dsatur_construct_schedule()`, `run_genetic_algorithm()`, `run_simulated_annealing()` | `_scale_dataset()`, `build_realistic_university_dataset()` | `experiment_f_and_g_multiscale_and_seeds()`, `audit_algorithm_benchmarks()`, `test_04_fixed_seed_reproducibility_check` | `python3 backend/tests/targeted_audit_verification.py` |
| **Adaptive Tabu Rescheduling (Exp H, Audit 3)** | `backend/app/optimization/rescheduler.py`, `tabu_search.py`, `validator.py` | `generate_rescheduling_proposal()`, `run_tabu_search_reschedule()`, `validate_timetable_assignments()` | `build_realistic_university_dataset()` + 3-room tight variant | `audit_adaptive_rescheduling()`, `test_07_tabu_search...`, `test_15_compare_schema_and_minimal_rescheduling` | `python3 backend/tests/targeted_audit_verification.py` |
| **Supabase Schema & RLS Policy Audit (Exp J)** | `supabase/migrations/20261110000001_*.sql`, `20261117000001_*.sql`, `20261117000002_*.sql` | Regex static schema/policy inspection + API RBAC tests | Migration SQL files | `experiment_j_sql_rls_audit()` | `python3 backend/tests/generate_final_report.py` |
| **Frontend Build, Type-Safety & Export Parity** | `frontend/src/utils/googleSheetsExport.ts`, `frontend/src/types/institutional.ts`, `TimetableMatrix.tsx` | `buildCanonicalExportModel()`, `exportTimetableToGoogleSheetsWorkbook()`, `orderWorkingDaysFridayRightmost()` | TypeScript compiler & Vite production bundle | Static typecheck (`tsc`), Vite build | `npx tsc --noEmit` & `npm run build` |

**Honest Verification Boundary Re-Confirmed:** All optimization solvers, aggregators, reschedulers, 20/20 backend unit/API stub tests (`test_smartgrid_backend.py` + `test_voting_and_validation.py`), TypeScript checks, and Vite builds were executed live. Remote network PostgreSQL RLS enforcement (`SUPABASE_URL` absent in sandbox) and headless Chromium browser DOM clicking were not executed in this environment and remain covered via static SQL inspection and in-memory PostgREST API dispatch tests.
