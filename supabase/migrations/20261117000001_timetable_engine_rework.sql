-- ============================================================================
-- SMARTGRID AI — TIMETABLE ENGINE REWORK ADDITIVE MIGRATION
-- File: supabase/migrations/20261117000001_timetable_engine_rework.sql
-- ============================================================================
-- Safely adds Friday scheduling configuration, split/continuous lab policy,
-- explicit Lecture/Lab credit-hour breakdown, and admin-assigned Instructor
-- & Lab Engineer bindings without dropping or altering existing records.
-- ============================================================================

-- 1. Institutions: Friday scheduling & lab split configuration
ALTER TABLE public.institutions
    ADD COLUMN IF NOT EXISTS friday_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS friday_mode TEXT NOT NULL DEFAULT 'jummah_break',
    ADD COLUMN IF NOT EXISTS friday_start_time TEXT,
    ADD COLUMN IF NOT EXISTS friday_end_time TEXT,
    ADD COLUMN IF NOT EXISTS friday_break_start TEXT DEFAULT '13:00',
    ADD COLUMN IF NOT EXISTS friday_break_end TEXT DEFAULT '14:30',
    ADD COLUMN IF NOT EXISTS friday_closing_time TEXT DEFAULT '13:00',
    ADD COLUMN IF NOT EXISTS friday_compression_scope TEXT DEFAULT 'all_day',
    ADD COLUMN IF NOT EXISTS friday_period_length INTEGER DEFAULT 40,
    ADD COLUMN IF NOT EXISTS friday_short_break INTEGER DEFAULT 5,
    ADD COLUMN IF NOT EXISTS friday_allowed_batches JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS friday_allowed_departments JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS lab_split_allowed BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Laboratories: explicit assigned lab engineer & equipment summary
ALTER TABLE public.laboratories
    ADD COLUMN IF NOT EXISTS assigned_lab_engineer_id TEXT REFERENCES public.instructors(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS equipment TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 3. Courses: separate lecture/lab credits, course_type, admin-assigned staff, batch & semester
ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS course_type TEXT NOT NULL DEFAULT 'lecture',
    ADD COLUMN IF NOT EXISTS lecture_credit_hours INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS lab_credit_hours INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS assigned_instructor_id TEXT REFERENCES public.instructors(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_lab_engineer_id TEXT REFERENCES public.instructors(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_batch_id TEXT REFERENCES public.batches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS semester_number INTEGER,
    ADD COLUMN IF NOT EXISTS lab_session_mode TEXT NOT NULL DEFAULT 'continuous',
    ADD COLUMN IF NOT EXISTS sub_department TEXT;

-- Relax upper CHECK bounds on lecture_hours_per_week / lab_hours_per_week if needed (e.g., 3 CR lab = 9h/wk)
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

-- Backfill lecture_credit_hours & lab_credit_hours cleanly for existing rows
UPDATE public.courses
SET
    lecture_credit_hours = GREATEST(0, COALESCE(lecture_hours_per_week, CASE WHEN lab_hours_per_week > 0 AND lecture_hours_per_week = 0 THEN 0 ELSE credit_hours END)),
    lab_credit_hours = CASE
        WHEN COALESCE(lab_hours_per_week, 0) > 0 THEN GREATEST(1, ROUND(lab_hours_per_week::numeric / 3.0)::integer)
        ELSE 0
    END,
    course_type = CASE
        WHEN COALESCE(lecture_hours_per_week, 0) > 0 AND COALESCE(lab_hours_per_week, 0) > 0 THEN 'lecture_lab'
        WHEN COALESCE(lab_hours_per_week, 0) > 0 THEN 'lab'
        ELSE 'lecture'
    END
WHERE lecture_credit_hours = 3 AND lab_credit_hours = 0;

-- 4. Course Sessions: track lab engineer & component type explicitly
ALTER TABLE public.course_sessions
    ADD COLUMN IF NOT EXISTS lab_engineer_id TEXT REFERENCES public.instructors(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS component_type TEXT NOT NULL DEFAULT 'lecture',
    ADD COLUMN IF NOT EXISTS lab_split_allowed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.course_sessions DROP CONSTRAINT IF EXISTS course_sessions_component_type_check;
ALTER TABLE public.course_sessions ADD CONSTRAINT course_sessions_component_type_check
    CHECK (component_type IN ('lecture', 'lab', 'tutorial'));

-- 5. Timetable Entries: store lab engineer, component type, department & Friday slot marker
ALTER TABLE public.timetable_entries
    ADD COLUMN IF NOT EXISTS lab_engineer_id TEXT,
    ADD COLUMN IF NOT EXISTS component_type TEXT NOT NULL DEFAULT 'lecture',
    ADD COLUMN IF NOT EXISTS department_id TEXT,
    ADD COLUMN IF NOT EXISTS slot_source TEXT NOT NULL DEFAULT 'regular';

CREATE INDEX IF NOT EXISTS idx_courses_assigned_staff
    ON public.courses(institution_id, assigned_instructor_id, assigned_lab_engineer_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_lab_eng
    ON public.timetable_entries(institution_id, lab_engineer_id);
