# SmartGrid AI — Frontend to Backend API Mapping (`FRONTEND_BACKEND_MAPPING.md`)

This document maps every existing screen, component, form, and role-based workflow in the SmartGrid AI React frontend (`src/`) to the FastAPI backend endpoints (`backend/`) and Supabase PostgreSQL schema (`supabase/schema.sql`).

---

## 1. Roles & Authorization Matrix

| Frontend Role (`systemRole` / `role`) | Backend Canonical Role | Scope & Permissions |
| :--- | :--- | :--- |
| `super_admin` | `super_admin` | Platform-level university creation, cross-university administration, system settings. |
| `admin` / `Registrar` | `university_admin` (`admin`) | Full university management: academic structure, batches, courses, rooms, BR provisioning, poll moderation, timetable generation, adaptive rescheduling approval, and publication. |
| `timetable_manager` | `timetable_manager` | Scheduling configuration, timetable generation (DSatur + GA + SA), adaptive rescheduling proposals (Tabu Search), and schedule validation. |
| `br` / `BR` | `br` (Batch Representative) | Submit batch-scoped or all-batch scheduling governance questions, track submission status, view batch participation analytics. |
| `faculty` / `Faculty` | `instructor` (`faculty`) | View personal teaching timetable, submit availability windows and preferred teaching hours, report room/time disruptions. |
| `student` / `Student` | `student` | View personal cohort/section timetable, submit learning slot preferences, cast votes on published scheduling polls (strictly 1 vote per poll). |

---

## 2. Screen-by-Screen API Mapping

### 2.1 Public Landing & Multi-University Discovery (`PublicLandingPage.tsx`)
- **User Role**: Public / Unauthenticated
- **Required Data**: Interactive timetable preview, registered universities list
- **API Endpoint**: `GET /api/institutions` (alias `GET /api/universities`)
- **Request Structure**: None
- **Response Structure**:
  ```json
  {
    "institutions": [
      {
        "id": "uuid-or-slug",
        "name": "University Name",
        "code": "UNIV",
        "campus_name": "Main Campus",
        "working_days": "Mon,Tue,Wed,Thu,Fri",
        "day_start_time": "09:00",
        "day_end_time": "17:00",
        "period_length_minutes": 50
      }
    ]
  }
  ```
- **Authentication**: Public

---

### 2.2 Authentication & Role-Scoped Onboarding (`AuthPage.tsx`, `AuthModal.tsx`)
- **User Role**: Public -> Authenticated (`student`, `faculty`, `br`, `admin`)
- **Workflows**:
  1. **Public Batches Lookup**:
     - **Endpoint**: `GET /api/auth/batches-public?institutionId={id}`
     - **Response**: `{ "batches": [{ "id", "code", "name", "departmentCode", "year", "semester" }] }`
     - **Authentication**: Public
  2. **Student Self-Registration**:
     - **Endpoint**: `POST /api/auth/register-student`
     - **Request**: `{ "name", "email", "registrationNumber", "batchId", "customBatchCode", "section", "password", "confirmPassword", "institutionId" }`
     - **Response**: `{ "message": "Student account registered.", "user": AuthenticatedUserDTO }`
     - **Security**: Strictly enforces `role = 'student'`. Rejects any attempt to self-assign `admin` or `br`.
  3. **Faculty Account Activation**:
     - **Endpoint**: `POST /api/auth/activate-faculty`
     - **Request**: `{ "name", "email", "department", "institutionId", "password", "confirmPassword" }`
     - **Response**: `{ "message": "Faculty account activated.", "user": AuthenticatedUserDTO }`
  4. **University Registration (New Tenant Onboarding)**:
     - **Endpoint**: `POST /api/institutions/register`
     - **Request**: `{ "name", "code", "campusName", "accreditation", "adminName", "adminEmail", "adminPassword", "workingDays", "dayStartTime", "dayEndTime", "periodLengthMinutes", "shortBreakMinutes", "middayBreakEnabled", "middayBreakStart", "middayBreakDuration", "labDurationMinutes" }`
     - **Response**: `{ "success": true, "institutionId", "institutionName", "institutionCode", "user": AuthenticatedUserDTO }`
  5. **Role-Verified Sign-In**:
     - **Endpoint**: `POST /api/auth/login`
     - **Request**: `{ "email", "password", "quickSwitch"?: boolean, "expectedPortalRole"?: "student" | "br" | "admin" | "faculty" }`
     - **Response**: `{ "user": AuthenticatedUserDTO }`
  6. **Session Verification & Profile**:
     - **Endpoints**: `GET /api/auth/me`, `PATCH /api/auth/profile`, `POST /api/auth/logout`, `POST /api/auth/password-recovery`
     - **Authentication**: `Bearer <JWT>` required for `/me` and `/profile`.

---

### 2.3 Multi-Step University Onboarding Wizard (`UniversityOnboardingModal.tsx`, `AcademicConfigurationPage.tsx`, `SettingsScreen.tsx`)
- **User Role**: `admin` (`university_admin`), `super_admin`
- **Required Data**: Institution profile, academic calendar terms, daily operating hours, lecture/lab/break durations, soft-constraint optimization weights
- **API Endpoints**:
  - `GET /api/universities/{university_id}`
  - `PATCH /api/universities/{university_id}/settings`
  - `GET /api/institutions/{id}/data`
  - `POST /api/institutions/{id}/data`
- **Request Structure (`PATCH /api/universities/{university_id}/settings`)**:
  ```json
  {
    "name": "University Name",
    "campusName": "Main Campus",
    "academicYear": "2026–2027",
    "currentTerm": "Fall Semester 2026",
    "workingDays": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "dayStartTime": "09:00",
    "dayEndTime": "17:00",
    "periodLengthMinutes": 50,
    "shortBreakMinutes": 10,
    "middayBreakEnabled": true,
    "middayBreakStart": "13:00",
    "middayBreakDuration": 60,
    "labDurationMinutes": 180
  }
  ```
- **Authentication**: `Bearer <JWT>` (`admin` / `super_admin` scoped to university)

---

### 2.4 Academic Structure & Resource Setup (`SetupFlow.tsx`, `DataImportWizard.tsx`, `HomeScreen.tsx`)
- **User Role**: `admin` (`university_admin`), `timetable_manager`
- **Required Data**: Departments, Programs, Batches, Semesters, Courses, Course Sessions, Classrooms, Laboratories, Instructors, Students
- **API Endpoints**:
  - `GET / POST / DELETE /api/departments`
  - `GET / POST / DELETE /api/programs`
  - `GET / POST / DELETE /api/batches`
  - `GET / POST / DELETE /api/semesters`
  - `GET / POST / DELETE /api/courses`
  - `GET / POST / DELETE /api/instructors`
  - `GET / POST / DELETE /api/classrooms`
  - `GET / POST / DELETE /api/students`
- **Authentication**: `Bearer <JWT>` (`admin` / `timetable_manager`)

---

### 2.5 Hybrid AI Timetable Generation & Algorithm Comparison (`GenerateScreen.tsx`, `GeneratorStudio.tsx`)
- **User Role**: `admin` (`university_admin`), `timetable_manager`
- **Required Data**: University scheduling parameters, courses, sections, rooms, instructors, student groups, preferences, optimization weights
- **API Endpoints**:
  - `POST /api/optimization/run` — Runs the hybrid optimization pipeline:
    1. Conflict Graph construction + **DSatur Graph Coloring** heuristic
    2. Room & laboratory capacity/equipment allocation
    3. **Genetic Algorithm** population evolution (crossover, mutation, elitism)
    4. **Simulated Annealing** local neighborhood refinement
    5. Hard constraint validator + Student-centric multi-objective fitness evaluation
  - `POST /api/optimization/compare` — Evaluates and compares:
    1. `dsatur_only` (DSatur Graph Coloring + Greedy Room Allocation)
    2. `ga_only` (Genetic Algorithm with random/heuristic initialization)
    3. `ga_sa` (Genetic Algorithm + Simulated Annealing)
    4. `hybrid_dsatur_ga_sa` (DSatur-seeded Genetic Algorithm + Simulated Annealing)
  - `GET /api/optimization/runs` — Lists historical optimization runs and metrics
  - `GET /api/optimization/runs/{run_id}` — Detailed fitness breakdown & assignments
- **Request Structure (`POST /api/optimization/run`)**:
  ```json
  {
    "institutionId": "inst-western-poly",
    "scenarioName": "Fall 2026 Optimal Build",
    "departmentScope": "all",
    "algorithm": "hybrid_dsatur_ga_sa",
    "timeConfig": {
      "workingDays": ["Mon", "Tue", "Wed", "Thu", "Fri"],
      "dayStartTime": "09:00",
      "dayEndTime": "17:00",
      "periodLengthMinutes": 50,
      "shortBreakMinutes": 10,
      "middayBreakEnabled": true,
      "middayBreakStart": "13:00",
      "middayBreakDuration": 60,
      "labDurationMinutes": 180
    },
    "weights": {
      "studentSatisfaction": 0.35,
      "instructorSatisfaction": 0.25,
      "compactnessAndGaps": 0.20,
      "fairnessAcrossBatches": 0.10,
      "roomUtilization": 0.10
    },
    "rooms": [...],
    "courses": [...],
    "instructors": [...],
    "studentGroups": [...],
    "sections": [...]
  }
  ```
- **Response Structure**:
  ```json
  {
    "runId": "opt-run-uuid",
    "algorithm": "hybrid_dsatur_ga_sa",
    "feasible": true,
    "hardConstraintViolations": 0,
    "placedCount": 42,
    "unplacedCount": 0,
    "executionTimeMs": 148.5,
    "fitness": {
      "totalScore": 96.4,
      "studentSatisfaction": 95.8,
      "instructorSatisfaction": 94.2,
      "compactnessScore": 97.1,
      "fairnessScore": 96.0,
      "leastSatisfiedBatchScore": 92.5,
      "roomUtilization": 84.6
    },
    "assignments": {
      "sec-id": {
        "roomId": "room-id",
        "day": "Mon",
        "startTime": "09:00",
        "secondDay": "Wed",
        "secondStartTime": "09:00",
        "thirdDay": "Fri",
        "thirdStartTime": "09:00"
      }
    },
    "validationReport": {
      "isValid": true,
      "violations": []
    }
  }
  ```
- **Authentication**: `Bearer <JWT>` (`admin` / `timetable_manager`)

---

### 2.6 Adaptive Rescheduling & Disruption Repair (`TimetableMatrix.tsx`, `AdaptiveEngine.tsx`, `ClassDetailsModal.tsx`)
- **User Role**: `admin`, `timetable_manager` (review/approve), `faculty` (report disruption)
- **Required Data**: Published timetable assignments, disruption specification (unavailable instructor, unavailable room/lab, changed operating hours, or slot lock), Tabu Search repair proposal
- **API Endpoints**:
  - `POST /api/rescheduling/disruptions` — Report disruption & generate minimal-change repair proposal via **Tabu Search**
  - `GET /api/rescheduling/proposals` — List pending and historical rescheduling proposals
  - `POST /api/rescheduling/proposals/{proposal_id}/approve` — Approve proposal and publish new timetable version
  - `POST /api/rescheduling/proposals/{proposal_id}/reject` — Reject proposal while preserving existing published timetable
- **Request Structure (`POST /api/rescheduling/disruptions`)**:
  ```json
  {
    "institutionId": "inst-western-poly",
    "disruptionType": "room_unavailable",
    "affectedResourceId": "room-id-or-instructor-id",
    "affectedDays": ["Tue"],
    "affectedStartTimes": ["10:00"],
    "reason": "Laboratory maintenance in Lab-2",
    "currentAssignments": {...},
    "sections": [...],
    "rooms": [...],
    "instructors": [...]
  }
  ```
- **Response Structure**:
  ```json
  {
    "proposalId": "prop-uuid",
    "status": "pending_approval",
    "affectedSessionIds": ["sec-1", "sec-2"],
    "changedSessionCount": 2,
    "unchangedSessionCount": 40,
    "stabilityPercent": 95.2,
    "remainingViolations": 0,
    "originalQualityScore": 95.4,
    "proposedQualityScore": 94.8,
    "changes": [
      {
        "sectionId": "sec-1",
        "reason": "Room unavailable on Tue 10:00",
        "before": { "roomId": "r1", "day": "Tue", "startTime": "10:00" },
        "after": { "roomId": "r2", "day": "Tue", "startTime": "10:00" },
        "affectedStudentsCount": 55,
        "affectedInstructorId": "inst-1"
      }
    ],
    "proposedAssignments": {...}
  }
  ```
- **Authentication**: `Bearer <JWT>`

---

### 2.7 Timetable Viewer, Versioning & Google Sheets Export (`TimetableMatrix.tsx`, `timetableExporter.ts`)
- **User Role**: All authenticated roles (`admin`, `br`, `faculty`, `student`)
- **Required Data**: Published or draft timetable versions, personal student cohort filter, personal instructor filter
- **API Endpoints**:
  - `GET /api/timetables` — List timetable versions for the user's university
  - `GET /api/timetables/student/me` — Retrieve personal student timetable
  - `GET /api/timetables/instructor/me` — Retrieve personal instructor timetable
  - `POST /api/timetables/{version_id}/publish` — Publish an approved timetable version (`admin` only)
  - `GET /api/timetables/compare?base={v1}&target={v2}` — Compare two timetable versions

---

### 2.8 Student & Instructor Preferences (`StudentDashboardPage.tsx`, `FacultyDashboardPage.tsx`)
- **User Role**: `student`, `faculty` (`instructor`)
- **Required Data**: Preferred time slots, avoided early/late slots, max daily load, instructor availability matrix
- **API Endpoints**:
  - `GET /api/preferences/me`
  - `POST /api/preferences/student`
  - `POST /api/preferences/instructor`
- **Authentication**: `Bearer <JWT>`

---

### 2.9 Batch Representative (BR) & Student Voting Governance (`StudentVotingPage.tsx`, `BrDashboardPage.tsx`, `AdminVotingManagementPage.tsx`, `FeedbackScreen.tsx`)
- **User Role**: `student` (vote), `br` (submit batch polls), `admin` (approve/reject/publish polls, manage BR accounts, analytics)
- **API Endpoints**:
  - `GET /api/voting/overview`
  - `POST /api/voting/polls/{pollId}/vote`
  - `POST /api/voting/br/polls`
  - `POST /api/voting/admin/batches`
  - `POST /api/voting/admin/br-accounts`
  - `PATCH /api/voting/admin/br-accounts/{userId}`
  - `PATCH /api/voting/admin/polls/{pollId}/status`
  - `DELETE /api/voting/admin/polls/{pollId}`
- **Authentication**: `Bearer <JWT>` with strict role guards

---

### 2.10 Analytics & Notifications (`AdminVotingManagementPage.tsx`, `FeedbackScreen.tsx`, `HomeScreen.tsx`)
- **User Role**: `admin`, `timetable_manager`, `faculty`, `student`
- **API Endpoints**:
  - `GET /api/analytics/overview` — Student satisfaction, instructor satisfaction, room utilization, fairness across batches, and optimization benchmark metrics
  - `GET /api/notifications` — Role-scoped notifications (timetable published, rescheduling alert, poll updates)
  - `PATCH /api/notifications/{notification_id}/read`
