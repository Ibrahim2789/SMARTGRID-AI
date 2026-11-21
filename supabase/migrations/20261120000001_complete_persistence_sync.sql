-- ============================================================================
-- SMARTGRID AI — COMPLETE PERSISTENCE SYNC MIGRATION (NO RLS CHANGES)
-- File: supabase/migrations/20261120000001_complete_persistence_sync.sql
-- ============================================================================
-- CRITICAL: This migration intentionally does NOT alter or enable Row Level
-- Security (RLS). RLS remains disabled during integration per administrator
-- configuration. All tenant isolation and RBAC are enforced in the backend API.
-- ============================================================================

-- 1. Institutions: Profile, Management Policy & Full Academic Timing Fields
ALTER TABLE IF EXISTS public.institutions
    ADD COLUMN IF NOT EXISTS campus_code TEXT DEFAULT 'MAIN',
    ADD COLUMN IF NOT EXISTS registrar_name TEXT DEFAULT 'Dr. Robert Alverez',
    ADD COLUMN IF NOT EXISTS registrar_email TEXT DEFAULT 'registrar@university.edu',
    ADD COLUMN IF NOT EXISTS auto_conflict_sweep BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS default_session_minutes INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS timetable_management_policy TEXT NOT NULL DEFAULT 'whole_university',
    ADD COLUMN IF NOT EXISTS short_break_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS include_break_after_last_slot BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS midday_break_mode TEXT NOT NULL DEFAULT 'fixed',
    ADD COLUMN IF NOT EXISTS friday_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS friday_mode TEXT NOT NULL DEFAULT 'jummah_break',
    ADD COLUMN IF NOT EXISTS friday_start_time TEXT,
    ADD COLUMN IF NOT EXISTS friday_end_time TEXT,
    ADD COLUMN IF NOT EXISTS friday_break_start TEXT DEFAULT '13:00',
    ADD COLUMN IF NOT EXISTS friday_break_end TEXT DEFAULT '14:30',
    ADD COLUMN IF NOT EXISTS friday_closing_time TEXT DEFAULT '13:00',
    ADD COLUMN IF NOT EXISTS friday_compression_scope TEXT DEFAULT 'after_jummah',
    ADD COLUMN IF NOT EXISTS friday_period_length INTEGER DEFAULT 45,
    ADD COLUMN IF NOT EXISTS friday_short_break INTEGER DEFAULT 5,
    ADD COLUMN IF NOT EXISTS friday_allowed_batches JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS friday_allowed_departments JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS friday_afternoon_shift_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS friday_afternoon_start_time TEXT DEFAULT '14:30',
    ADD COLUMN IF NOT EXISTS custom_breaks JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS active_term_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS lab_split_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS use_voting_preferences BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS voting_preference_influence NUMERIC(4,2) DEFAULT 0.65,
    ADD COLUMN IF NOT EXISTS low_participation_threshold NUMERIC(5,2) DEFAULT 25.0;

ALTER TABLE public.institutions DROP CONSTRAINT IF EXISTS institutions_timetable_management_policy_check;
ALTER TABLE public.institutions ADD CONSTRAINT institutions_timetable_management_policy_check
    CHECK (timetable_management_policy IN ('whole_university', 'department_wise'));

-- 2. Campuses & Buildings (Physical Hierarchy)
CREATE TABLE IF NOT EXISTS public.campuses (
    id TEXT PRIMARY KEY DEFAULT ('camp-' || gen_random_uuid()::text),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    address TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, code)
);
CREATE INDEX IF NOT EXISTS idx_campuses_institution ON public.campuses(institution_id);

CREATE TABLE IF NOT EXISTS public.buildings (
    id TEXT PRIMARY KEY DEFAULT ('bld-' || gen_random_uuid()::text),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    campus_id TEXT REFERENCES public.campuses(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    floors INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, code)
);
CREATE INDEX IF NOT EXISTS idx_buildings_institution ON public.buildings(institution_id);

-- 3. Departments: school, color_hex, sub_departments
ALTER TABLE IF EXISTS public.departments
    ADD COLUMN IF NOT EXISTS school TEXT,
    ADD COLUMN IF NOT EXISTS color_hex TEXT NOT NULL DEFAULT '#171717',
    ADD COLUMN IF NOT EXISTS sub_departments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 4. Academic Programs: expand degree_level check to allow UI + canonical codes
ALTER TABLE public.academic_programs DROP CONSTRAINT IF EXISTS academic_programs_degree_level_check;
ALTER TABLE public.academic_programs ADD CONSTRAINT academic_programs_degree_level_check
    CHECK (degree_level IN ('BS', 'BE', 'MS', 'PhD', 'Diploma', 'Associate', 'Undergraduate', 'Graduate', 'Postgraduate'));

-- 5. Semesters: academic_year, weeks_count, status, department_ids
ALTER TABLE IF EXISTS public.semesters
    ADD COLUMN IF NOT EXISTS academic_year TEXT NOT NULL DEFAULT '2026–2027',
    ADD COLUMN IF NOT EXISTS weeks_count INTEGER NOT NULL DEFAULT 16,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS department_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.semesters DROP CONSTRAINT IF EXISTS semesters_status_check;
ALTER TABLE public.semesters ADD CONSTRAINT semesters_status_check
    CHECK (status IN ('draft', 'active', 'archived'));

-- 6. Batches: batch_code, section, home_room, shared_course_ids, term_id, academic_year
ALTER TABLE IF EXISTS public.batches
    ADD COLUMN IF NOT EXISTS batch_code TEXT,
    ADD COLUMN IF NOT EXISTS section TEXT DEFAULT 'A',
    ADD COLUMN IF NOT EXISTS home_room TEXT,
    ADD COLUMN IF NOT EXISTS term_id TEXT,
    ADD COLUMN IF NOT EXISTS academic_year INTEGER DEFAULT 2026,
    ADD COLUMN IF NOT EXISTS shared_course_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 7. Instructors: staff_role, sub_department, qualified_course_ids
ALTER TABLE IF EXISTS public.instructors
    ADD COLUMN IF NOT EXISTS staff_role TEXT NOT NULL DEFAULT 'faculty',
    ADD COLUMN IF NOT EXISTS sub_department TEXT,
    ADD COLUMN IF NOT EXISTS qualified_course_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.instructors DROP CONSTRAINT IF EXISTS instructors_staff_role_check;
ALTER TABLE public.instructors ADD CONSTRAINT instructors_staff_role_check
    CHECK (staff_role IN ('faculty', 'lab_engineer'));

ALTER TABLE IF EXISTS public.instructor_preferences
    ADD COLUMN IF NOT EXISTS max_weekly_hours INTEGER DEFAULT 14;

-- 8. Classrooms & Laboratories: building_id, is_accessible, equipment, assigned_lab_engineer_id
ALTER TABLE IF EXISTS public.classrooms
    ADD COLUMN IF NOT EXISTS building_id TEXT,
    ADD COLUMN IF NOT EXISTS is_accessible BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.classrooms DROP CONSTRAINT IF EXISTS classrooms_room_type_check;
ALTER TABLE public.classrooms ADD CONSTRAINT classrooms_room_type_check
    CHECK (room_type IN ('lecture', 'seminar', 'auditorium', 'studio'));

ALTER TABLE IF EXISTS public.laboratories
    ADD COLUMN IF NOT EXISTS building_id TEXT,
    ADD COLUMN IF NOT EXISTS is_accessible BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS assigned_lab_engineer_id TEXT REFERENCES public.instructors(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS equipment TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 9. Courses: elective metadata, credit hours split, assigned staff, required_room_type
ALTER TABLE IF EXISTS public.courses
    ADD COLUMN IF NOT EXISTS course_type TEXT NOT NULL DEFAULT 'lecture',
    ADD COLUMN IF NOT EXISTS lecture_credit_hours INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS lab_credit_hours INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS assigned_instructor_id TEXT REFERENCES public.instructors(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_lab_engineer_id TEXT REFERENCES public.instructors(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_batch_id TEXT REFERENCES public.batches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS semester_number INTEGER,
    ADD COLUMN IF NOT EXISTS lab_session_mode TEXT NOT NULL DEFAULT 'continuous',
    ADD COLUMN IF NOT EXISTS sub_department TEXT,
    ADD COLUMN IF NOT EXISTS is_elective BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS elective_pool_name TEXT,
    ADD COLUMN IF NOT EXISTS required_room_type TEXT NOT NULL DEFAULT 'lecture';

ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_lecture_hours_per_week_check;
ALTER TABLE public.courses ADD CONSTRAINT courses_lecture_hours_per_week_check
    CHECK (lecture_hours_per_week BETWEEN 0 AND 12);

ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_lab_hours_per_week_check;
ALTER TABLE public.courses ADD CONSTRAINT courses_lab_hours_per_week_check
    CHECK (lab_hours_per_week BETWEEN 0 AND 12);

ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_course_type_check;
ALTER TABLE public.courses ADD CONSTRAINT courses_course_type_check
    CHECK (course_type IN ('lecture', 'lab', 'lecture_lab'));

ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_lab_session_mode_check;
ALTER TABLE public.courses ADD CONSTRAINT courses_lab_session_mode_check
    CHECK (lab_session_mode IN ('continuous', 'split_allowed'));

-- 10. Course Sessions: full section state including manual slot assignments & lock
ALTER TABLE IF EXISTS public.course_sessions
    ADD COLUMN IF NOT EXISTS term_id TEXT,
    ADD COLUMN IF NOT EXISTS lab_engineer_id TEXT REFERENCES public.instructors(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS component_type TEXT NOT NULL DEFAULT 'lecture',
    ADD COLUMN IF NOT EXISTS lab_split_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS shared_group_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS is_atomic_session BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS span_slots INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS assigned_day TEXT,
    ADD COLUMN IF NOT EXISTS assigned_start_time TEXT,
    ADD COLUMN IF NOT EXISTS assigned_room_id TEXT,
    ADD COLUMN IF NOT EXISTS assigned_slot_json JSONB,
    ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.course_sessions DROP CONSTRAINT IF EXISTS course_sessions_component_type_check;
ALTER TABLE public.course_sessions ADD CONSTRAINT course_sessions_component_type_check
    CHECK (component_type IN ('lecture', 'lab', 'tutorial'));

-- 11. Scheduling Constraints: code, kind, description + expanded category check
ALTER TABLE IF EXISTS public.scheduling_constraints
    ADD COLUMN IF NOT EXISTS code TEXT,
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'soft',
    ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

ALTER TABLE public.scheduling_constraints DROP CONSTRAINT IF EXISTS scheduling_constraints_category_check;
ALTER TABLE public.scheduling_constraints ADD CONSTRAINT scheduling_constraints_category_check
    CHECK (category IN ('hard', 'soft_student', 'soft_instructor', 'soft_room', 'soft_fairness', 'instructor', 'room', 'student', 'facility', 'temporal'));

-- 12. Timetable Entries: component & Friday slot markers
ALTER TABLE IF EXISTS public.timetable_entries
    ADD COLUMN IF NOT EXISTS lab_engineer_id TEXT,
    ADD COLUMN IF NOT EXISTS component_type TEXT NOT NULL DEFAULT 'lecture',
    ADD COLUMN IF NOT EXISTS department_id TEXT,
    ADD COLUMN IF NOT EXISTS slot_source TEXT NOT NULL DEFAULT 'regular';

-- 13. Optimization Runs: allow 'needs_review' status cleanly
ALTER TABLE public.optimization_runs DROP CONSTRAINT IF EXISTS optimization_runs_status_check;
ALTER TABLE public.optimization_runs ADD CONSTRAINT optimization_runs_status_check
    CHECK (status IN ('running', 'completed', 'needs_review', 'failed'));

-- 14. Disruptions: allow 'lab_engineer_unavailable' and 'forced_course_move'
ALTER TABLE public.disruptions DROP CONSTRAINT IF EXISTS disruptions_disruption_type_check;
ALTER TABLE public.disruptions ADD CONSTRAINT disruptions_disruption_type_check
    CHECK (disruption_type IN (
        'instructor_unavailable',
        'lab_engineer_unavailable',
        'room_unavailable',
        'lab_unavailable',
        'forced_course_move',
        'operating_hours_changed',
        'capacity_or_equipment_changed',
        'admin_slot_adjustment'
    ));

-- 15. Student Preferences: UI visibility & dashboard preferences JSONB
ALTER TABLE IF EXISTS public.student_preferences
    ADD COLUMN IF NOT EXISTS ui_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 16. Polls: voting integration columns & expanded target_scope
ALTER TABLE IF EXISTS public.polls
    ADD COLUMN IF NOT EXISTS poll_category TEXT DEFAULT 'general_suggestion',
    ADD COLUMN IF NOT EXISTS target_batch_ids JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS allow_multiple_votes BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS optimizer_approval_status TEXT DEFAULT 'pending_review',
    ADD COLUMN IF NOT EXISTS optimizer_approved_by TEXT,
    ADD COLUMN IF NOT EXISTS optimizer_approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS optimizer_rejection_reason TEXT;

ALTER TABLE public.polls DROP CONSTRAINT IF EXISTS polls_target_scope_check;
ALTER TABLE public.polls ADD CONSTRAINT polls_target_scope_check
    CHECK (target_scope IN ('all_batches', 'submitting_batch', 'selected_batches'));

-- 17. Create Missing Tables WITHOUT Enabling RLS
CREATE TABLE IF NOT EXISTS public.optimization_poll_traceability (
    id TEXT PRIMARY KEY,
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    optimization_run_id TEXT REFERENCES public.optimization_runs(id) ON DELETE CASCADE,
    timetable_version_id TEXT REFERENCES public.timetable_versions(id) ON DELETE CASCADE,
    poll_id TEXT REFERENCES public.polls(id) ON DELETE CASCADE,
    batch_id TEXT,
    poll_category TEXT,
    winning_option TEXT,
    win_percentage NUMERIC(5,2),
    participation_percentage NUMERIC(5,2),
    preference_strength NUMERIC(4,3),
    normalized_weight NUMERIC(4,3),
    low_participation_flag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_opt_poll_trace_inst ON public.optimization_poll_traceability(institution_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.timetable_feedback (
    id TEXT PRIMARY KEY,
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    timetable_version_id TEXT REFERENCES public.timetable_versions(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    batch_id TEXT,
    section_code TEXT,
    timings_rating INTEGER CHECK (timings_rating BETWEEN 1 AND 5),
    compactness_rating INTEGER CHECK (compactness_rating BETWEEN 1 AND 5),
    gaps_rating INTEGER CHECK (gaps_rating BETWEEN 1 AND 5),
    free_day_rating INTEGER CHECK (free_day_rating BETWEEN 1 AND 5),
    overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
    preferred_adjustment_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_timetable_feedback UNIQUE (timetable_version_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tt_feedback_inst ON public.timetable_feedback(institution_id, timetable_version_id);

CREATE TABLE IF NOT EXISTS public.import_history (
    id TEXT PRIMARY KEY DEFAULT ('imp-' || gen_random_uuid()::text),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    user_name TEXT,
    user_email TEXT,
    category TEXT NOT NULL,
    file_name TEXT NOT NULL,
    duplicate_mode TEXT NOT NULL DEFAULT 'skip' CHECK (duplicate_mode IN ('skip', 'update', 'stop')),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'partial', 'failed', 'rolled_back')),
    idempotency_key TEXT,
    total_rows INTEGER NOT NULL DEFAULT 0,
    created_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    error_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
    response_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_import_history_institution_created ON public.import_history(institution_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY DEFAULT ('aud-' || gen_random_uuid()::text),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL DEFAULT 'System',
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_institution_created ON public.audit_logs(institution_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.schedule_proposals (
    id TEXT PRIMARY KEY DEFAULT ('sprop-' || gen_random_uuid()::text),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    description TEXT NOT NULL,
    target_slot TEXT DEFAULT '',
    submitted_by TEXT NOT NULL DEFAULT 'Campus Community',
    submitted_by_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Under Review', 'Adopted', 'Archived')),
    votes_approve INTEGER NOT NULL DEFAULT 0,
    votes_revise INTEGER NOT NULL DEFAULT 0,
    voters JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schedule_proposals_institution ON public.schedule_proposals(institution_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_courses_assigned_staff
    ON public.courses(institution_id, assigned_instructor_id, assigned_lab_engineer_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_lab_eng
    ON public.timetable_entries(institution_id, lab_engineer_id);

-- Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
