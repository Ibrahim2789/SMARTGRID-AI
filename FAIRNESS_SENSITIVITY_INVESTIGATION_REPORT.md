# SmartGrid AI — Student Fairness Weight Sensitivity & Metrics Reconciliation Report

## 1. Investigation Mandate & Architectural Preservation
This report documents:
1. The root-cause resolution of the student fairness weight sensitivity defect identified in `/SUPPLEMENTARY_EXPERIMENTAL_AUDIT_REPORT.md` (`Section 3.2, Table 2.2`).
2. The formal reconciliation of the apparent discrepancy between batch-wise 5-seed mean satisfaction and reported multi-seed `CommonWorst` / `CommonSpread` figures in the initial sensitivity report.

Strict project constraints maintained throughout:
- Zero relaxation of **hard constraints** and 100% **immutable staff assignments** (`instructorId` / `labEngineerId`).
- Complete preservation of the existing **CSP + DSatur + Genetic Algorithm + Simulated Annealing + Tabu Search + preference aggregation** architecture (zero ML, neural networks, or Google OR-Tools).
- **Strict separation** between System A (independent canonical student satisfaction evaluator) and System B (optimizer-internal fitness and objective metrics).
- Preservation of `/FINAL_RESEARCH_EVALUATION_REPORT.md` and `/SUPPLEMENTARY_EXPERIMENTAL_AUDIT_REPORT.md` untouched (verified free of cross-table contradictions).

---

## 2. Canonical vs Optimizer Metric Definitions (Strict Separation)

To prevent silent mixing of measurement systems, this report separates all metrics into two non-interchangeable systems evaluated over the exact same generated schedules (`seeds = [42, 101, 202, 303, 404]`):

### System A — Canonical Independent Student Satisfaction Evaluator (`independent_evaluate_schedule`)
Defined in `/backend/tests/targeted_audit_verification.py` (`lines 49–221`), completely independent of `fitness.py`, optimizer weights, and poll strength scaling:
- **Batch Inclusion**: All student cohorts in `student_groups` (`CONT-A`, `CONT-B`, `CONT-C`; `12` placed sessions each, `0` excluded).
- **Physical Gap Health (`GapHealth_{s,b} ∈ [0, 100]`)**: Starts at `100.0`, subtracting penalties for unnecessary inter-class idle minutes (`min(45.0, batch_idle * 0.22)`), gap counts (`min(20.0, batch_gaps * 4.5)`), long single gaps (`> 90m`), and compactness deficit (`(100.0 - compactness) * 0.25`). On the scarce-morning dataset, every batch in every seed records `0` idle minutes, `0` gaps, and `100.0%` compactness, so `GapHealth_{s,b} = 100.00` identically.
- **Preference Fulfillment (`PrefFulfill_{s,b} ∈ [0, 100]`)**: Equal-weighted arithmetic mean over active ground-truth preference dimensions (`preferred_time_window = morning` checked as `< 12:30` across all non-lab lectures, plus `preferred_free_day = Thu` checked as `100.0` if `0` Thu classes else `max(0.0, 100.0 - classes_on_Thu * 33.33)`):
  $$\text{PrefFulfill}_{s,b} = \frac{1}{2}\left(\text{LectureMorningMatch\%}_{s,b} + \text{FreeDayCompliance\%}_{s,b}\right)$$
- **Batch-Wise Common Satisfaction (`C_{s,b} ∈ [0, 100]`)**:
  $$C_{s,b} = 0.50 \times \text{GapHealth}_{s,b} + 0.50 \times \text{PrefFulfill}_{s,b}$$
  *(With `0` idle minutes and `0` gaps, $C_{s,b} = 50.00 + 0.50 \times \text{PrefFulfill}_{s,b}$; worst-possible `0%` preference fulfillment yields `50.00%`, unlike System B.)*
- **Single-Schedule Aggregates**:
  $$\text{Mean}_s = \frac{1}{3}\sum_{b \in \{A,B,C\}} C_{s,b}, \quad \text{Worst}_s = \min_{b} C_{s,b}, \quad \text{Best}_s = \max_{b} C_{s,b}, \quad \text{Spread}_s = \text{Best}_s - \text{Worst}_s$$

### System B — Optimizer-Internal Fitness & Fairness Evaluator (`evaluate_timetable_fitness`)
Defined in `/backend/app/optimization/fitness.py` (`lines 247–693`), used internally by DSatur/GA/SA for search guidance and normalized multi-objective selection:
- **Batch Inclusion**: Every cohort in `group_schedule` (all `3` cohorts on this dataset; same-course daily bunching is `0` under Hard Constraint #6).
- **Optimizer Batch Score (`O_{s,b} ∈ [0, 100]`)**: Penalty-subtraction from `100.0`, combining gap/early/late/compactness deductions plus a preference penalty scaled by `raw_strength / 0.65` (`0.90 / 0.65 = 1.385x` here) and capped at `-22.0` (`+2.0` low-load compactness bonus when weekly load `<= 8` and attendance `<= 3` days). Thus complete preference violation with zero gaps still scores `78.0` (`100 - 22`), creating a different floor and slope than System A.
- **Rawlsian Fairness Objective & `fairnessScore` (`fitness.py` lines 484–501, 629)**:
  $$\text{RawlsianFairObjective}_s = 0.80 \cdot O_{s,\min} + 0.20 \cdot \frac{O_{s,(1)} + O_{s,(2)}}{2}$$
  $$\text{OptFairness}_s = \text{clamp}_{[0,100]}\!\left(0.70 \cdot O_{s,\min} + 0.30 \cdot \bar{O}_s - 0.05 \cdot \text{IdleSpread}_s - 0.10 \cdot \left(O_{s,\max} - O_{s,\min}\right)\right)$$
- **Total Objective Score (`totalScore`)**:
  $$\text{totalScore}_s = \frac{\bar{O}_s w_{\text{gap}} + \text{RawlsianFairObj}_s w_{\text{fair}} + \text{Inst}_s w_{\text{inst}} + \text{Room}_s w_{\text{room}} + \text{Comp}_s w_{\text{comp}} + \text{Pref}_s w_{\text{pref}}}{\sum w_i} - 18 \cdot \text{HV}_s$$
  with `w_fair = max(0.0, student_fairness) * 0.85` (`fairnessSharePct = w_fair / sum(w_i) * 100%`).

---

## 3. Reconciliation of Reported Discrepancy (`Batch Means` vs `CommonWorst / CommonSpread`)

### 3.1 Verification Audit Verdict on Underlying Data
Inspection of `/backend/tests/targeted_audit_verification.py`, `/backend/tests/fairness_sensitivity_audit.py`, and all `60` run records in `/backend/tests/fairness_sensitivity_audit_results.json` confirms that **zero metric implementation defects or calculation errors exist in the JSON data**:
- Every single `commonSatisfaction`, `overallCommonSatisfaction`, `worstBatchSatisfaction`, `bestBatchSatisfaction`, `satisfactionSpread`, `optSatisfaction`, `rawlsianFairObjective`, `fairnessScore`, and `batchMeans` value satisfies its exact defining formula to `< 0.015` (pure 2-decimal display rounding).

### 3.2 Exact Mathematical Root Cause: Non-Commutativity of `min`/`max` with Expectation
The apparent contradiction in the initial report arose because two mathematically distinct multi-seed aggregation operators were both labeled without qualification:

1. **Across-Seed Cohort-Mean Equity (*Average First, Then Min/Max*)**:
   $$\bar{C}_b = \frac{1}{5}\sum_{s \in K} C_{s,b}, \qquad \text{WorstOfMeans} = \min_{b} \bar{C}_b, \qquad \text{BestOfMeans} = \max_{b} \bar{C}_b, \qquad \text{SpreadOfMeans} = \max_{b} \bar{C}_b - \min_{b} \bar{C}_b$$
   This answers: *"Across 5 independent random seeds, is any **specific cohort ID** systematically disadvantaged on average?"*
2. **Expected Per-Run Equity (*Min/Max First Inside Each Seed, Then Average*)**:
   $$\text{MeanPerSeedWorst} = \frac{1}{5}\sum_{s \in K} \min_{b} C_{s,b}, \qquad \text{MeanPerSeedBest} = \frac{1}{5}\sum_{s \in K} \max_{b} C_{s,b}, \qquad \text{MeanPerSeedSpread} = \frac{1}{5}\sum_{s \in K} \left(\max_{b} C_{s,b} - \min_{b} C_{s,b}\right)$$
   This answers: *"On any **single generated timetable**, how well-protected is whoever turns out to be the worst-off cohort in that run, and what is the within-timetable gap between best and worst?"*

By **Jensen's Inequality** (since $\min$ is concave and $\max$ is convex), whenever different cohorts rotate into the worst or best spot across seeds:
$$\frac{1}{5}\sum_{s} \min_b S_{s,b} \;\le\; \min_b \left(\frac{1}{5}\sum_{s} S_{s,b}\right) \qquad \text{and} \qquad \frac{1}{5}\sum_{s} \max_b S_{s,b} \;\ge\; \max_b \left(\frac{1}{5}\sum_{s} S_{s,b}\right)$$
hence **`MeanPerSeedWorst <= WorstOfMeans`** and **`MeanPerSeedSpread >= SpreadOfMeans`** strictly whenever cohort identities swap ranks across seeds. (By linearity of expectation, only the **Overall Mean** commutes: $\frac{1}{5}\sum_s \text{Mean}_s = \frac{1}{3}\sum_b \bar{C}_b$.)

### 3.3 Exact Step-by-Step Arithmetic Reconciliation of the Three Flagged Examples

1. **`Fairness_0.65` (System A Common Satisfaction)**:
   - Per-seed `(CONT-A, CONT-B, CONT-C)`:
     - Seed `42`: `(83.34, 83.34, 70.84)` → `Worst = 70.84` (`C`), `Best = 83.34` (`A/B`), `Spread = 12.50`
     - Seed `101`: `(70.84, 72.92, 79.17)` → `Worst = 70.84` (**`A` is worst**), `Best = 79.17` (**`C` is best**), `Spread = 8.33`
     - Seed `202`: `(83.34, 91.67, 62.50)` → `Worst = 62.50` (`C`), `Best = 91.67` (`B`), `Spread = 29.17`
     - Seed `303`: `(100.00, 91.67, 60.42)` → `Worst = 60.42` (`C`), `Best = 100.00` (`A`), `Spread = 39.58`
     - Seed `404`: `(81.25, 75.00, 75.00)` → `Worst = 75.00` (`B/C`), `Best = 81.25` (`A`), `Spread = 6.25`
   - **Per-Batch 5-Seed Means**:
     - `CONT-A`: $(83.34 + 70.84 + 83.34 + 100.00 + 81.25)/5 = 418.77/5 = \mathbf{83.75\%}$
     - `CONT-B`: $(83.34 + 72.92 + 91.67 + 91.67 + 75.00)/5 = 414.60/5 = \mathbf{82.92\%}$
     - `CONT-C`: $(70.84 + 79.17 + 62.50 + 60.42 + 75.00)/5 = 347.93/5 = \mathbf{69.59\%}$
   - **Batch-Mean Aggregates**: `WorstOfMeans` $= \min(83.75, 82.92, 69.59) = \mathbf{69.59\%}$, `BestOfMeans` $= \mathbf{83.75\%}$, `SpreadOfMeans` $= 83.75 - 69.59 = \mathbf{14.16}$ *(unrounded: $83.754 - 69.586 = 14.17$)*.
   - **Per-Run Averages**: `MeanPerSeedWorst` $= (70.84 + 70.84 + 62.50 + 60.42 + 75.00)/5 = \mathbf{67.92\%}$, `MeanPerSeedBest` $= (83.34 + 79.17 + 91.67 + 100.00 + 81.25)/5 = \mathbf{87.09\%}$, `MeanPerSeedSpread` $= (12.50 + 8.33 + 29.17 + 39.58 + 6.25)/5 = \mathbf{19.17}$.

2. **`Fairness_0.95` (System A Common Satisfaction)**:
   - Per-seed `(CONT-A, CONT-B, CONT-C)`:
     - Seed `42`: `(83.34, 83.34, 64.59)` → `Worst = 64.59` (`C`), `Best = 83.34`, `Spread = 18.75`
     - Seed `101`: `(83.34, 83.34, 70.84)` → `Worst = 70.84` (`C`), `Best = 83.34`, `Spread = 12.50`
     - Seed `202`: `(79.17, 75.00, 83.33)` → `Worst = 75.00` (**`B` is worst**), `Best = 83.33`, `Spread = 8.33`
     - Seed `303`: `(83.34, 72.92, 83.33)` → `Worst = 72.92` (**`B` is worst**), `Best = 83.34`, `Spread = 10.42`
     - Seed `404`: `(83.34, 83.34, 64.59)` → `Worst = 64.59` (`C`), `Best = 83.34`, `Spread = 18.75`
   - **Per-Batch 5-Seed Means**: `CONT-A` $= \mathbf{82.51\%}$, `CONT-B` $= \mathbf{79.59\%}$, `CONT-C` $= \mathbf{73.34\%}$.
   - **Batch-Mean Aggregates**: `WorstOfMeans` $= \mathbf{73.34\%}$, `BestOfMeans` $= \mathbf{82.51\%}$, `SpreadOfMeans` $= 82.51 - 73.34 = \mathbf{9.17}$.
   - **Per-Run Averages**: `MeanPerSeedWorst` $= (64.59 + 70.84 + 75.00 + 72.92 + 64.59)/5 = \mathbf{69.59\%}$, `MeanPerSeedBest` $= \mathbf{83.34\%}$, `MeanPerSeedSpread` $= (18.75 + 12.50 + 8.33 + 10.42 + 18.75)/5 = \mathbf{13.75}$.

3. **`CP_0.95` (System A Common Satisfaction)**:
   - Per-seed `(CONT-A, CONT-B, CONT-C)`:
     - Seed `42`: `(72.92, 75.00, 83.33)` → `Worst = 72.92` (`A`), `Best = 83.33` (`C`), `Spread = 10.41`
     - Seed `101`: `(83.34, 83.34, 70.84)` → `Worst = 70.84` (`C`), `Best = 83.34` (`A/B`), `Spread = 12.50`
     - Seed `202`: `(75.00, 72.92, 77.09)` → `Worst = 72.92` (`B`), `Best = 77.09` (`C`), `Spread = 4.17`
     - Seed `303`: `(75.00, 75.00, 89.58)` → `Worst = 75.00` (`A/B`), `Best = 89.58` (`C`), `Spread = 14.58`
     - Seed `404`: `(83.34, 83.34, 70.84)` → `Worst = 70.84` (`C`), `Best = 83.34` (`A/B`), `Spread = 12.50`
   - **Per-Batch 5-Seed Means**:
     - `CONT-A`: $(72.92 + 83.34 + 75.00 + 75.00 + 83.34)/5 = 389.60/5 = \mathbf{77.92\%}$
     - `CONT-B`: $(75.00 + 83.34 + 72.92 + 75.00 + 83.34)/5 = 389.60/5 = \mathbf{77.92\%}$
     - `CONT-C`: $(83.33 + 70.84 + 77.09 + 89.58 + 70.84)/5 = 391.68/5 = \mathbf{78.34\%}$
   - **Batch-Mean Aggregates**: `WorstOfMeans` $= \mathbf{77.92\%}$, `BestOfMeans` $= \mathbf{78.34\%}$, `SpreadOfMeans` $= 78.34 - 77.92 = \mathbf{0.42}$ (across seeds, all three cohort IDs receive virtually identical expected satisfaction!).
   - **Per-Run Averages**: `MeanPerSeedWorst` $= (72.92 + 70.84 + 72.92 + 75.00 + 70.84)/5 = \mathbf{72.50\%}$, `MeanPerSeedBest` $= (83.33 + 83.34 + 77.09 + 89.58 + 83.34)/5 = \mathbf{83.34\%}$, `MeanPerSeedSpread` $= (10.41 + 12.50 + 4.17 + 14.58 + 12.50)/5 = \mathbf{10.83}$.

Notice the exact same rank-rotation phenomenon occurs on System B (`OptBest` / `OptSpread`) for `Fairness_0.65`, `Fairness_0.95`, `CP_0.65`, and `CP_0.95`, and is reconciled in Section 5 below.

---

## 4. Recalculated Canonical Common Evaluation Results (System A Only)

All values in this section are computed strictly by `independent_evaluate_schedule()` from `/backend/tests/fairness_sensitivity_audit_results.json`. Every batch across every run recorded `0.0` idle minutes, `0` gaps, and `100.0%` compactness (`GapHealth = 100.0`).

### 4.1 Complete Per-Seed Batch Matrix (All 5 Seeds × All Configurations)

| Config & Seed | `CONT-A` ComSat (`Pref%`) | `CONT-B` ComSat (`Pref%`) | `CONT-C` ComSat (`Pref%`) | Per-Seed `Mean` | Per-Seed `Worst` | Per-Seed `Best` | Per-Seed `Spread` | Mean `Pref%` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **`Fairness_0.00`** *(Hybrid)* | | | | | | | | |
| Seed `42` | 100.00 (`100.00%`) | 91.67 (`83.34%`) | 60.42 (`20.83%`) | 84.03 | 60.42 | 100.00 | 39.58 | 68.06% |
| Seed `101` | 100.00 (`100.00%`) | 91.67 (`83.34%`) | 60.42 (`20.83%`) | 84.03 | 60.42 | 100.00 | 39.58 | 68.06% |
| Seed `202` | 100.00 (`100.00%`) | 91.67 (`83.34%`) | 60.42 (`20.83%`) | 84.03 | 60.42 | 100.00 | 39.58 | 68.06% |
| Seed `303` | 100.00 (`100.00%`) | 91.67 (`83.34%`) | 60.42 (`20.83%`) | 84.03 | 60.42 | 100.00 | 39.58 | 68.06% |
| Seed `404` | 100.00 (`100.00%`) | 83.34 (`66.67%`) | 60.42 (`20.83%`) | 81.25 | 60.42 | 100.00 | 39.58 | 62.50% |
| **`Fairness_0.25`** *(Hybrid)* | | | | | | | | |
| Seed `42` | 75.00 (`50.00%`) | 91.67 (`83.34%`) | 62.50 (`25.01%`) | 76.39 | 62.50 | 91.67 | 29.17 | 52.78% |
| Seed `101` | 91.67 (`83.34%`) | 83.34 (`66.67%`) | 62.50 (`25.01%`) | 79.17 | 62.50 | 91.67 | 29.17 | 58.34% |
| Seed `202` | 100.00 (`100.00%`) | 91.67 (`83.34%`) | 60.42 (`20.83%`) | 84.03 | 60.42 | 100.00 | 39.58 | 68.06% |
| Seed `303` | 83.34 (`66.67%`) | 75.00 (`50.01%`) | 70.84 (`41.67%`) | 76.39 | 70.84 | 83.34 | 12.50 | 52.78% |
| Seed `404` | 91.67 (`83.34%`) | 83.34 (`66.67%`) | 62.50 (`25.01%`) | 79.17 | 62.50 | 91.67 | 29.17 | 58.34% |
| **`Fairness_0.65`** *(Hybrid)* | | | | | | | | |
| Seed `42` | 83.34 (`66.67%`) | 83.34 (`66.67%`) | 70.84 (`41.67%`) | 79.17 | 70.84 | 83.34 | 12.50 | 58.34% |
| Seed `101` | 70.84 (`41.67%`) | 72.92 (`45.84%`) | 79.17 (`58.34%`) | 74.31 | 70.84 | 79.17 | 8.33 | 48.62% |
| Seed `202` | 83.34 (`66.67%`) | 91.67 (`83.34%`) | 62.50 (`25.00%`) | 79.17 | 62.50 | 91.67 | 29.17 | 58.34% |
| Seed `303` | 100.00 (`100.00%`) | 91.67 (`83.34%`) | 60.42 (`20.83%`) | 84.03 | 60.42 | 100.00 | 39.58 | 68.06% |
| Seed `404` | 81.25 (`62.50%`) | 75.00 (`50.00%`) | 75.00 (`50.00%`) | 77.08 | 75.00 | 81.25 | 6.25 | 54.17% |
| **`Fairness_0.95`** *(Hybrid)* | | | | | | | | |
| Seed `42` | 83.34 (`66.67%`) | 83.34 (`66.67%`) | 64.59 (`29.17%`) | 77.09 | 64.59 | 83.34 | 18.75 | 54.17% |
| Seed `101` | 83.34 (`66.67%`) | 83.34 (`66.67%`) | 70.84 (`41.67%`) | 79.17 | 70.84 | 83.34 | 12.50 | 58.34% |
| Seed `202` | 79.17 (`58.34%`) | 75.00 (`50.01%`) | 83.33 (`66.67%`) | 79.17 | 75.00 | 83.33 | 8.33 | 58.34% |
| Seed `303` | 83.34 (`66.67%`) | 72.92 (`45.83%`) | 83.33 (`66.67%`) | 79.86 | 72.92 | 83.34 | 10.42 | 59.72% |
| Seed `404` | 83.34 (`66.67%`) | 83.34 (`66.67%`) | 64.59 (`29.17%`) | 77.09 | 64.59 | 83.34 | 18.75 | 54.17% |
| **`CP_0.00`** *(Hybrid)* | | | | | | | | |
| Seed `42` | 100.00 (`100.00%`) | 91.67 (`83.34%`) | 60.42 (`20.83%`) | 84.03 | 60.42 | 100.00 | 39.58 | 68.06% |
| Seed `101` | 100.00 (`100.00%`) | 91.67 (`83.34%`) | 60.42 (`20.83%`) | 84.03 | 60.42 | 100.00 | 39.58 | 68.06% |
| Seed `202` | 100.00 (`100.00%`) | 91.67 (`83.34%`) | 60.42 (`20.83%`) | 84.03 | 60.42 | 100.00 | 39.58 | 68.06% |
| Seed `303` | 100.00 (`100.00%`) | 91.67 (`83.34%`) | 60.42 (`20.83%`) | 84.03 | 60.42 | 100.00 | 39.58 | 68.06% |
| Seed `404` | 100.00 (`100.00%`) | 83.34 (`66.67%`) | 60.42 (`20.83%`) | 81.25 | 60.42 | 100.00 | 39.58 | 62.50% |
| **`CP_0.25`** *(Hybrid)* | | | | | | | | |
| Seed `42` | 75.00 (`50.00%`) | 91.67 (`83.34%`) | 62.50 (`25.01%`) | 76.39 | 62.50 | 91.67 | 29.17 | 52.78% |
| Seed `101` | 91.67 (`83.34%`) | 83.34 (`66.67%`) | 62.50 (`25.01%`) | 79.17 | 62.50 | 91.67 | 29.17 | 58.34% |
| Seed `202` | 100.00 (`100.00%`) | 91.67 (`83.34%`) | 60.42 (`20.83%`) | 84.03 | 60.42 | 100.00 | 39.58 | 68.06% |
| Seed `303` | 83.34 (`66.67%`) | 75.00 (`50.01%`) | 70.84 (`41.67%`) | 76.39 | 70.84 | 83.34 | 12.50 | 52.78% |
| Seed `404` | 91.67 (`83.34%`) | 83.34 (`66.67%`) | 62.50 (`25.01%`) | 79.17 | 62.50 | 91.67 | 29.17 | 58.34% |
| **`CP_0.65`** *(Hybrid)* | | | | | | | | |
| Seed `42` | 83.34 (`66.67%`) | 83.34 (`66.67%`) | 70.84 (`41.67%`) | 79.17 | 70.84 | 83.34 | 12.50 | 58.34% |
| Seed `101` | 70.84 (`41.67%`) | 72.92 (`45.84%`) | 79.17 (`58.34%`) | 74.31 | 70.84 | 79.17 | 8.33 | 48.62% |
| Seed `202` | 83.34 (`66.67%`) | 91.67 (`83.34%`) | 62.50 (`25.00%`) | 79.17 | 62.50 | 91.67 | 29.17 | 58.34% |
| Seed `303` | 100.00 (`100.00%`) | 91.67 (`83.34%`) | 60.42 (`20.83%`) | 84.03 | 60.42 | 100.00 | 39.58 | 68.06% |
| Seed `404` | 100.00 (`100.00%`) | 91.67 (`83.34%`) | 60.42 (`20.83%`) | 84.03 | 60.42 | 100.00 | 39.58 | 68.06% |
| **`CP_0.95`** *(Hybrid)* | | | | | | | | |
| Seed `42` | 72.92 (`45.84%`) | 75.00 (`50.01%`) | 83.33 (`66.67%`) | 77.08 | 72.92 | 83.33 | 10.41 | 54.17% |
| Seed `101` | 83.34 (`66.67%`) | 83.34 (`66.67%`) | 70.84 (`41.67%`) | 79.17 | 70.84 | 83.34 | 12.50 | 58.34% |
| Seed `202` | 75.00 (`50.01%`) | 72.92 (`45.83%`) | 77.09 (`54.17%`) | 75.00 | 72.92 | 77.09 | 4.17 | 50.00% |
| Seed `303` | 75.00 (`50.01%`) | 75.00 (`50.00%`) | 89.58 (`79.17%`) | 79.86 | 75.00 | 89.58 | 14.58 | 59.73% |
| Seed `404` | 83.34 (`66.67%`) | 83.34 (`66.67%`) | 70.84 (`41.67%`) | 79.17 | 70.84 | 83.34 | 12.50 | 58.34% |
| **`DSatur-Only`** *(All 4 Wts, All 5 Seeds)* | 100.00 (`100.00%`) | 91.67 (`83.34%`) | 60.42 (`20.83%`) | 84.03 | 60.42 | 100.00 | 39.58 | 68.06% |

### 4.2 Reconciled 5-Seed Summary Table (Both Aggregation Operators Explicitly Reported — System A)

| Config (`Mode`) | `CONT-A` 5-Seed Mean (`Pref%`) | `CONT-B` 5-Seed Mean (`Pref%`) | `CONT-C` 5-Seed Mean (`Pref%`) | Mean Batch Sat | Mean `Pref%` | **Per-Run Equity** *(Mean of Per-Seed)* `Worst / Best / Spread` | **Across-Seed Cohort-Mean** *(Min/Max of Batch Means)* `Worst / Best / Spread` |
|---|---:|---:|---:|---:|---:|---:|---:|
| **`Fairness_0.00`** *(Rebal)* | 100.00% (`100.00%`) | 90.00% (`80.01%`) | 60.42% (`20.83%`) | 83.47% | 66.95% | **60.42% / 100.00% / 39.58** | **60.42% / 100.00% / 39.58** |
| **`Fairness_0.25`** *(Rebal)* | 88.34% (`76.67%`) | 85.00% (`70.01%`) | 63.75% (`27.51%`) | 79.03% | 58.06% | **63.75% / 91.67% / 27.92** | **63.75% / 88.34% / 24.59** |
| **`Fairness_0.65`** *(Rebal)* | 83.75% (`67.50%`) | 82.92% (`65.84%`) | 69.59% (`39.17%`) | 78.75% | 57.51% | **67.92% / 87.09% / 19.17** | **69.59% / 83.75% / 14.16** |
| **`Fairness_0.95`** *(Rebal)* | 82.51% (`65.00%`) | 79.59% (`59.17%`) | 73.34% (`46.67%`) | 78.48% | 56.95% | **69.59% / 83.34% / 13.75** | **73.34% / 82.51% / 9.17** |
| **`CP_0.00`** *(Ceteris Par.)* | 100.00% (`100.00%`) | 90.00% (`80.01%`) | 60.42% (`20.83%`) | 83.47% | 66.95% | **60.42% / 100.00% / 39.58** | **60.42% / 100.00% / 39.58** |
| **`CP_0.25`** *(Ceteris Par.)* | 88.34% (`76.67%`) | 85.00% (`70.01%`) | 63.75% (`27.51%`) | 79.03% | 58.06% | **63.75% / 91.67% / 27.92** | **63.75% / 88.34% / 24.59** |
| **`CP_0.65`** *(Ceteris Par.)* | 87.50% (`75.00%`) | 86.25% (`72.51%`) | 66.67% (`33.33%`) | 80.14% | 60.28% | **65.00% / 90.84% / 25.83** | **66.67% / 87.50% / 20.83** |
| **`CP_0.95`** *(Ceteris Par.)* | 77.92% (`55.84%`) | 77.92% (`55.84%`) | 78.34% (`56.67%`) | 78.06% | 56.12% | **72.50% / 83.34% / 10.83** | **77.92% / 78.34% / 0.42** |
| **`DSatur-Only`** *(Baseline)* | 100.00% (`100.00%`) | 91.67% (`83.34%`) | 60.42% (`20.83%`) | 84.03% | 68.06% | **60.42% / 100.00% / 39.58** | **60.42% / 100.00% / 39.58** |

*(Rounding note: arithmetic differences of `0.01`—e.g., `Fairness_0.65` displayed `83.75 - 69.59 = 14.16` vs unrounded `83.754 - 69.586 = 14.17`, and `Fairness_0.65` per-seed rounded `MeanPref = 57.51%` vs batch-mean average `57.50%`—stem solely from 2-decimal display rounding of intermediate values.)*

**Both views confirm strict fairness improvement:**
- **Within-Run Rawlsian Floor** (`MeanPerSeedWorst`): strictly rises `60.42% → 63.75% → 67.92% → 69.59%` (rebalanced) and `60.42% → 63.75% → 65.00% → 72.50%` (*ceteris paribus*); within-run spread narrows `39.58 → 27.92 → 19.17 → 13.75` and `39.58 → 27.92 → 25.83 → 10.83`.
- **Across-Seed Cohort-Mean Equity** (`WorstOfMeans` / `SpreadOfMeans`): `CONT-C` 5-seed mean rises `60.42% → 63.75% → 69.59% → 73.34%` (rebalanced) and `60.42% → 63.75% → 66.67% → 78.34%` (*ceteris paribus*), compressing expected cohort disparity from `39.58` down to `9.17` (rebalanced) and `0.42` (`CP_0.95`).

### 4.3 Before-and-After Common Evaluation Comparison (`System A`, 5-Seed Per-Run Equity)
Comparing against the exact Per-Run Mean-of-Seed Worst/Spread metric reported in `/SUPPLEMENTARY_EXPERIMENTAL_AUDIT_REPORT.md` Table 2.2 (`36` lectures vs `24` Mon–Thu morning room-slots):

| Config (`student_fairness`) | Before → **After `MeanPerSeedWorst`** | Before → **After `MeanPerSeedSpread`** | Before → **After `Mean Pref%`** | Before → **After `Idle / Gaps`** |
|---|---:|---:|---:|---:|
| **`Fairness_0.00`** (`0.00`) | 57.52% → **60.42%** | 28.60 → **39.58** | 55.56% → **66.95%** | 40.0m / 1.6 → **0.0m / 0** |
| **`Fairness_0.25`** (`0.25`) | 66.42% → **63.75%** | 8.47 → **27.92** | 51.39% → **58.06%** | 32.0m / 1.6 → **0.0m / 0** |
| **`Fairness_0.65`** (`0.65`) | 59.35% → **67.92%** | 32.45 → **19.17** | 60.84% → **57.51%** | 40.0m / 1.6 → **0.0m / 0** |
| **`Fairness_0.95`** (`0.95`) | 57.62% → **69.59%** | 36.54 → **13.75** | 54.72% → **56.95%** | 24.0m / 1.0 → **0.0m / 0** |
| **`CP_0.00`** (`0.00`) | 60.83% → **60.42%** | 39.17 → **39.58** | — → **66.95%** | 0.0m / 0 → **0.0m / 0** |
| **`CP_0.25`** (`0.25`) | 60.83% → **63.75%** | 39.17 → **27.92** | — → **58.06%** | 0.0m / 0 → **0.0m / 0** |
| **`CP_0.65`** (`0.65`) | 60.83% → **65.00%** | 39.17 → **25.83** | — → **60.28%** | 0.0m / 0 → **0.0m / 0** |
| **`CP_0.95`** (`0.95`) | 60.83% → **72.50%** | 39.17 → **10.83** | — → **56.12%** | 0.0m / 0 → **0.0m / 0** |

---

## 5. Fairness Sensitivity Correction & Optimizer Internal Metrics (System B Only)

### 5.1 Root Causes Resolved & Exact Source Files Modified
Tracing `student_fairness` from `/backend/app/deps.py` (`line 779`) into the optimizer identified four defects inside the optimization modules:
1. **`fitness.py` (`line 612` pre-fix)**: `w_fair_term = 0.18 + w_student_fair * 0.12` injected ~19.1% baseline fairness weight at `0.00` and compressed `[0.00, 0.95]` to `[0.180, 0.294]`.
2. **`fitness.py` (`line 490` pre-fix)**: `fairnessScore` omitted `- score_spread * 0.10`, remaining blind to cross-batch disparities at zero idle minutes.
3. **`graph_coloring.py` (`lines 219–395`)**: `Set[str]` `remaining_ids` broke ties via `PYTHONHASHSEED`, and DSatur ignored `student_fairness`.
4. **`genetic_algorithm.py` & `simulated_annealing.py`**: Neither passed `weights` / `student_preferences` into neighborhood generators or implemented conflict-free cross-batch pairwise swaps on 100%-saturated scarce slots.

| Source File | Modification Summary |
|---|---|
| `/backend/app/optimization/fitness.py` | Set `w_fair_term = max(0.0, w_student_fair) * 0.85` (`0.00%` share when `0.0`); added `- score_spread * 0.10` to `fairnessScore`; set `rawlsian_fair_obj = least_satisfied_batch * 0.80 + bottom_pair_mean * 0.20`; exposed `bestBatchSatisfactionScore`, `satisfactionSpread`, and `objectiveBreakdown`. |
| `/backend/app/optimization/graph_coloring.py` | Added deterministic `-session_order[sid]` tie-breaking and bounded scarcity-moderated per-batch urgency (`fair_urgency_mult`, `window_pref_scale >= 0.35`) without creating idle gaps. |
| `/backend/app/optimization/genetic_algorithm.py` | Added `_slot_pref_penalty()`, `_estimate_batch_penalties()`, gap-preserving guards, and `propose_fairness_swap_or_relocation()`; preserved successful swaps via early return in `mutate_chromosome()`; threaded `weights` and `student_preferences` through `run_genetic_algorithm()`. |
| `/backend/app/optimization/simulated_annealing.py` | Integrated `propose_fairness_swap_or_relocation()` and `_slot_pref_penalty()` local cost inside `_generate_gap_aware_neighbor()`, threading `weights` and `student_preferences` through `run_simulated_annealing()`. |
| `/backend/tests/test_voting_and_validation.py` | Added `test_05_fairness_weight_sensitivity_and_staff_immutability` (`0` hard violations, `0` staff mutations, strict `student_fairness=0.95 > 0.00` fairness progression). |
| `/backend/tests/fairness_sensitivity_audit.py` | Created reproducible 5-seed audit script generating `/backend/tests/fairness_sensitivity_audit_results.json`. |

### 5.2 Optimizer Internal 5-Seed Summary & Before/After Comparison (System B)

| Config (`Mode`) | Before → **After `OptFair`** | Before → **After `OptWorst`** | `TotalFitness` | `FairShare%` | `RawlsianObj` | `FairContrib` | `MeanContrib` | `PrefContrib` | `OptMean` | **Per-Run `Opt`** `W / B / Spr` | **Batch-Mean `Opt`** `W / B / Spr` | `CONT-A / B / C OptSat` | `Time (ms)` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| `Fairness_0.00` | 60.50% → **75.30%** | 58.68% → **73.25%** | 92.34 | 0.00% | 75.30 | 0.00 | 54.76 | 2.90 | 89.01 | 73.25 / 100.00 / 26.75 | 73.25 / 100.00 / 26.75 | 100.00 / 93.77 / 73.25 | 696.71 |
| `Fairness_0.25` | 72.56% → **82.04%** | 72.47% → **80.74%** | 90.71 | 21.74% | 82.04 | 17.84 | 43.42 | 1.57 | 89.84 | 80.74 / 95.02 / 14.28 | 80.74 / 95.02 / 14.28 | 95.02 / 93.77 / 80.74 | 720.95 |
| `Fairness_0.65` | 60.32% → **84.01%** | 58.82% → **83.06%** | 89.32 | 43.16% | 84.01 | 36.27 | 31.15 | 1.21 | 90.10 | 83.06 / 94.63 / 11.57 | 83.06 / 93.85 / 10.79 | 93.85 / 93.38 / 83.06 | 748.57 |
| `Fairness_0.95` | 63.92% → **85.28%** | 61.78% → **84.47%** | 89.11 | 53.30% | 85.28 | 45.46 | 25.48 | 1.02 | 90.28 | 84.47 / 93.77 / 9.30 | 84.47 / 93.38 / 8.91 | 92.99 / 93.38 / 84.47 | 947.25 |
| `CP_0.00` | 79.65% → **75.30%** | 75.04% → **73.25%** | 92.60 | 0.00% | 75.30 | 0.00 | 54.98 | 2.00 | 89.01 | 73.25 / 100.00 / 26.75 | 73.25 / 100.00 / 26.75 | 100.00 / 93.77 / 73.25 | 648.21 |
| `CP_0.25` | 79.65% → **82.04%** | 75.04% → **80.74%** | 90.71 | 21.74% | 82.04 | 17.84 | 43.42 | 1.57 | 89.84 | 80.74 / 95.02 / 14.28 | 80.74 / 95.02 / 14.28 | 95.02 / 93.77 / 80.74 | 740.53 |
| `CP_0.65` | 79.65% → **82.09%** | 75.04% → **80.88%** | 88.53 | 41.94% | 82.09 | 34.42 | 32.25 | 1.17 | 89.92 | 80.88 / 95.87 / 14.99 | 80.88 / 95.49 / 14.61 | 95.49 / 93.38 / 80.88 | 862.91 |
| `CP_0.95` | 79.65% → **86.44%** | 75.04% → **85.71%** | 90.01 | 51.35% | 86.44 | 44.39 | 27.29 | 1.00 | 90.82 | 85.71 / 93.77 / 8.06 | 85.71 / 93.38 / 7.67 | 93.38 / 93.38 / 85.71 | 998.55 |
| `DSatur-Only` | — → **74.18%** | — → **72.00%** | 92.06 → 82.70 | 0.00% → 53.30% | 74.18 | 0.00 → 39.54 | 54.50 → 25.00 | 2.87 → 1.00 | 88.59 | 72.00 / 100.00 / 28.00 | 72.00 / 100.00 / 28.00 | 100.00 / 93.77 / 72.00 | 14.89–19.58 |

*Zero hard constraint violations (`HV = 0`) and zero staff mutations (`StaffMut = 0`) across every configuration and seed.*

### 5.3 Cross-Process Determinism Proof (`PYTHONHASHSEED`)
Running `seed = 42, student_fairness = 0.65` across separate Python subprocesses with `PYTHONHASHSEED ∈ {1, 2, 999}` produced 100% identical outputs (`totalScore = 89.06`, `identicalAcrossHashSeeds = True`).

---

## 6. Hard Constraint, Regression & Build Verification Results

| Verification Check | Outcome | Key Verified Evidence |
|---|---|---|
| **Full Backend Test Suite** (`python3 -m unittest discover -s backend/tests -v`) | **PASSED (`21 / 21`)** | All `16` core engine tests (`test_smartgrid_backend.py`) + all `5` voting/fairness/validation tests (`test_voting_and_validation.py`) passed with `0` failures. |
| **Metric Formula Integrity Audit** (`fairness_sensitivity_audit_results.json`) | **PASSED (`0` errors)** | Verified every `perSeed` and `batchMeans` entry satisfies `independent_evaluate_schedule()` and `evaluate_timetable_fitness()` formulas within `< 0.015` rounding. |
| **Medium Realistic Dataset 4-Algorithm Check** (`seed=42`, `75` sessions) | **PASSED (`0` HV across all 4)** | `dsatur_only`: `95.80` / Fair `93.54` (`35.83ms`); `ga_only`: `59.47` / Fair `26.92` (`794.28ms`); `ga_sa`: `86.48` / Fair `73.78` (`1041.61ms`); `hybrid_dsatur_ga_sa`: **`97.18` / Fair `96.63` / Sat `99.44%`** (`1718.20ms`). |
| **Tabu Search Full-Day Outage Repair** (`inst-gauss` Mon) | **PASSED (`0` HV, `0` staff mut)** | `feasible = True`, `6 / 75` sessions relocated, `92.00%` stability, `412.25ms`. |
| **Frontend TypeScript Check** (`lint_applet` / `tsc --noEmit`) | **PASSED (`0` errors)** | Clean pass after final edits. |
| **Frontend Production Build** (`compile_applet` / `vite build`) | **PASSED (`0` errors)** | Production bundle compiled cleanly. |

---

## 7. Remaining Limitations
1. **Single-Pass Greedy DSatur Behavior**: Standalone `dsatur_only` constructs one sequential timetable (`~15–20ms`) and relies on `GA + SA` (`hybrid_dsatur_ga_sa`) for cross-batch fairness swaps.
2. **Genuine Capacity-Equity Trade-off**: When requested Mon–Wed morning slots + free Thu (`36` lectures) exceed physical room supply (`24` room-slots), elevating worst-batch satisfaction (`60.42% → 72.50%` per-run / `60.42% → 77.92%` batch-mean floor) trades off mean preference fulfillment (`66.95% → 56.12%`).
3. **Pairwise Swap Horizon on Tight Day-Lock Cycles**: `propose_fairness_swap_or_relocation()` evaluates single relocations and `2`-batch pairwise swaps; rare `3+`-session day-lock permutation cycles can remain in local optima under `GA(12)/SA(70)` budgets.
4. **Sandbox UI E2E**: Backend optimization, unit tests, and Vite/TypeScript builds ran directly against the live workspace; headless browser automation against a live remote Supabase instance was not executed in this isolated sandbox.
