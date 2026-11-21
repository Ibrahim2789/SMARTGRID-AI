# SmartGrid AI — Multi-University Timetable & Batch Voting Platform

**SmartGrid AI** is an institutional multi-university academic timetable optimization, adaptive rescheduling, and batch-representative (BR) student voting platform powered by a **Python + FastAPI** backend, **Supabase (PostgreSQL)** schema architecture, and a **from-scratch Hybrid AI Optimization Engine** (no OR-Tools or black-box solver dependencies).

---

## 1. Custom AI Optimization Architecture (Implemented From Scratch)

All scheduling and optimization algorithms are implemented from first principles in `/backend/app/optimization/`:

1. **DSatur Graph Coloring (`/backend/app/optimization/graph_coloring.py`)**:
   - Models course sessions as graph vertices $V$ and conflicts (shared instructor, shared student batch/section, or same-day course meetings) as edges $E$.
   - Dynamically selects the unscheduled session with the highest **saturation degree** (number of distinct time slots already taken by adjacent conflicting sessions), breaking ties by total conflict degree, and assigns compatible rooms by capacity, room type (`Theory` vs. `Lab`), and required equipment.

2. **Genetic Algorithm (`/backend/app/optimization/genetic_algorithm.py`)**:
   - Evolves a population of candidate timetable chromosomes (`TimetableChromosome` in `chromosome.py`) seeded with DSatur-valid schedules and randomized feasible permutations.
   - Uses **Tournament Selection**, **Section-Preserving Crossover**, **Prime-Slot & Room Mutation**, **Elitism**, and deterministic hard-constraint repair (`repair_chromosome`).

3. **Simulated Annealing (`/backend/app/optimization/simulated_annealing.py`)**:
   - Performs fine-grained local search refinement on the best Genetic Algorithm chromosome using single-session slot moves, pairwise session swaps, and room reassignments.
   - Escapes local optima via the **Metropolis acceptance criterion** $P(\Delta E, T) = \exp(\Delta E / T)$ under a geometric cooling schedule $T_{k+1} = \alpha T_k$.

4. **Student-Centric Multi-Objective Fitness & Rawlsian Batch Fairness (`/backend/app/optimization/fitness.py`)**:
   - Evaluates schedules across weighted objectives:
     - Hard constraint feasibility barrier ($0$ instructor, room, batch, capacity, or midday break clashes)
     - Student preferred time-window and poll-vote alignment (`studentSatisfaction`)
     - Schedule compactness & idle gap minimization (`compactnessScore` & `studentGapMinutesAvg`)
     - Daily academic workload balance (`workloadBalanceScore`)
     - Instructor slot preference satisfaction (`instructorSatisfaction`)
     - **Rawlsian Min-Max Batch Fairness** (`fairnessScore` & `leastSatisfiedBatchScore`) ensuring no academic batch is systematically disadvantaged
     - Classroom capacity utilization (`roomUtilization`)

5. **Tabu Search Adaptive Rescheduling (`/backend/app/optimization/tabu_search.py` & `rescheduler.py`)**:
   - Handles dynamic real-world disruptions (`instructor_unavailable`, `room_unavailable`, `lab_unavailable`) using a FIFO **Tabu List** with configurable **Tabu Tenure** and an **Aspiration Criterion**.
   - Repairs affected sessions while maximizing **Schedule Stability** (`stabilityPercentage`) so unaffected classes remain in their original slots and rooms.

---

## 2. Step-by-Step Supabase (PostgreSQL) Setup Instructions

No fake credentials are embedded in the repository. Follow these steps to provision your own **Supabase PostgreSQL** database:

### Step 1: Create a Supabase Project
1. Sign in to [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Click **New Project**, choose your organization, enter a project name (e.g., `smartgrid-ai`), set a strong database password, select your closest region, and wait for provisioning to complete.

### Step 2: Copy Your Supabase Credentials
1. In your Supabase project dashboard, navigate to **Project Settings** (gear icon) $\rightarrow$ **API**.
2. Copy the following values:
   - **Project URL** $\rightarrow$ `SUPABASE_URL`
   - **anon / public key** $\rightarrow$ `SUPABASE_ANON_KEY`
   - **service_role / secret key** $\rightarrow$ `SUPABASE_SERVICE_ROLE_KEY` (keep this server-side only; never expose in frontend code)
3. Navigate to **Project Settings** $\rightarrow$ **Database** and copy your PostgreSQL connection URI $\rightarrow$ `SUPABASE_DB_URL`.

### Step 3: Run the SQL Schema in Supabase SQL Editor
1. Open the **SQL Editor** in the left sidebar of your Supabase Dashboard and click **New Query**.
2. Open [`supabase/schema.sql`](./supabase/schema.sql) (also mirrored in `supabase/migrations/20261110000001_initial_smartgrid_schema.sql` and `supabase_schema.sql`).
3. Paste the entire contents of `supabase/schema.sql` into the Supabase SQL Editor and click **Run**.
4. Verify in the **Table Editor** that all 28 relational tables (`universities`, `university_settings`, `departments`, `programs`, `semesters`, `batches`, `sections`, `users`, `user_roles`, `br_assignments`, `instructors`, `instructor_availability`, `classrooms`, `classroom_availability`, `courses`, `course_instructors`, `course_sections`, `student_preferences`, `instructor_preferences`, `polls`, `poll_options`, `poll_votes`, `timetable_versions`, `timetable_entries`, `timetable_conflicts`, `optimization_runs`, `optimization_scores`, `disruption_events`, `rescheduling_proposals`, `notifications`, `audit_logs`) and their Row Level Security (RLS) policies are created.

### Step 4: Configure Authentication in Supabase
1. In the Supabase Dashboard, navigate to **Authentication** $\rightarrow$ **Providers** and ensure **Email** provider is enabled.
2. Under **Authentication** $\rightarrow$ **URL Configuration**, set your Site URL (e.g., `http://localhost:3000`).

### Step 5: Configure Environment Variables
1. From the project root, copy `.env.example` to `.env`:

   **Windows PowerShell:**
   ```powershell
   Copy-Item .env.example .env
   ```

   **macOS/Linux:**
   ```bash
   cp .env.example .env
   ```
2. Fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, and `SMARTGRID_AUTH_SECRET`.

### Step 6: Install Dependencies & Run the Backend and Frontend
1. Create and activate a Python virtual environment from the project root:

   **Windows PowerShell:**
   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install --upgrade pip
   python -m pip install -r backend/requirements.txt
   ```

   **macOS/Linux:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   python3 -m pip install --upgrade pip
   python3 -m pip install -r backend/requirements.txt
   ```

2. Install the Node.js dependencies:
   ```bash
   npm install
   ```

3. Start the full-stack development server:
   ```bash
   npm run dev
   ```
   This runs the Express gateway and Vite frontend on `http://localhost:3000` and starts the Python FastAPI backend on port `8001`.

### Additional Run Commands

Run the frontend and backend in one command for development:

```bash
npm run dev
```

Run the FastAPI backend separately:

**Windows PowerShell:**
```powershell
cd backend
python main.py
```

**macOS/Linux:**
```bash
cd backend
python3 main.py
```

Build the production frontend:

```bash
npm run build
```

Run the production Express server after building:

```bash
npm start
```

### Step 7: Verify Database & Optimization Endpoints
- Check backend health: `GET http://localhost:3000/api/health`
- Check database & Supabase connection status: `GET http://localhost:3000/api/database/status`
- Run automated backend tests:
  ```bash
  python3 -m unittest discover -s backend/tests -v
  ```
