-- ============================================================================
-- SMARTGRID AI — FINAL CONSOLIDATED SUPABASE POSTGRESQL SCHEMA
-- File: supabase/schema.sql
-- ============================================================================
-- Single authoritative schema covering the entire SmartGrid AI platform:
--   - Core Multi-University Institutions, Settings, Friday/Jummah Config,
--     Physical Hierarchy (Campuses, Buildings), Academic Structure
--     (Departments, Programs, Semesters, Batches), RBAC Users & Roles
--   - Faculty, Lab Engineers, Students, Availability & Preferences
--   - Classrooms, Laboratories & Equipment Capacities
--   - Courses, Enrollments, Course Sessions & Scheduling Constraints
--   - Timetable Versions, Entries, Optimization Runs, Scores & Poll Traceability
--   - Disruptions, Rescheduling Proposals & Rescheduling History
--   - Governance Voting (BR Assignments, Polls, Options, Votes, Proposals)
--   - Feedback, Timetable Feedback, CSV Import History, Audit Logs & Notifications
--   - Idempotent column/constraint upgrades for existing databases
--   - Automatic updated_at triggers & PostgREST schema cache reload
--
-- IMPORTANT CONFIGURATION NOTE (RLS INTENTIONALLY DISABLED):
--   Row Level Security (RLS) is intentionally kept DISABLED during active
--   backend-enforced integration. All authentication, role-based access control
--   (RBAC), and multi-university institution_id tenant isolation are enforced
--   on the trusted backend API layer. Do NOT enable RLS in this schema file.
--   Deferred RLS activation notes and policy templates are preserved as comments
--   at the bottom of this file for administrator activation later.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.current_user_university_id()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'institution_id',
        current_setting('request.jwt.claims', true)::jsonb ->> 'institution_id'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role',
        current_setting('request.jwt.claims', true)::jsonb ->> 'role',
        'student'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN 'student';
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 1. UNIVERSITIES (INSTITUTIONS) & SNAPSHOT ARCHIVE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.institutions (
    id TEXT PRIMARY KEY DEFAULT ('inst-' || gen_random_uuid()::text),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    campus_code TEXT DEFAULT 'MAIN',
    campus_name TEXT NOT NULL DEFAULT 'Main Campus',
    accreditation TEXT NOT NULL DEFAULT 'Accredited University',
    registrar_name TEXT DEFAULT 'Dr. Robert Alverez',
    registrar_email TEXT DEFAULT 'registrar@university.edu',
    academic_year TEXT NOT NULL DEFAULT '2026–2027',
    current_term TEXT NOT NULL DEFAULT 'Fall Semester 2026',
    working_days TEXT NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri',
    day_start_time TEXT NOT NULL DEFAULT '09:00',
    day_end_time TEXT NOT NULL DEFAULT '17:00',
    period_length_minutes INTEGER NOT NULL DEFAULT 50 CHECK (period_length_minutes BETWEEN 30 AND 180),
    short_break_minutes INTEGER NOT NULL DEFAULT 10 CHECK (short_break_minutes BETWEEN 0 AND 60),
    short_break_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    include_break_after_last_slot BOOLEAN NOT NULL DEFAULT FALSE,
    midday_break_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    midday_break_mode TEXT NOT NULL DEFAULT 'fixed',
    midday_break_start TEXT NOT NULL DEFAULT '13:00',
    midday_break_duration INTEGER NOT NULL DEFAULT 60 CHECK (midday_break_duration BETWEEN 0 AND 180),
    lab_duration_minutes INTEGER NOT NULL DEFAULT 180 CHECK (lab_duration_minutes BETWEEN 60 AND 300),
    lab_split_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    auto_conflict_sweep BOOLEAN NOT NULL DEFAULT TRUE,
    default_session_minutes INTEGER NOT NULL DEFAULT 50,
    timetable_management_policy TEXT NOT NULL DEFAULT 'whole_university' CHECK (timetable_management_policy IN ('whole_university', 'department_wise')),
    friday_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    friday_mode TEXT NOT NULL DEFAULT 'jummah_break',
    friday_start_time TEXT,
    friday_end_time TEXT,
    friday_break_start TEXT DEFAULT '13:00',
    friday_break_end TEXT DEFAULT '14:30',
    friday_closing_time TEXT DEFAULT '13:00',
    friday_compression_scope TEXT DEFAULT 'after_jummah',
    friday_period_length INTEGER DEFAULT 45,
    friday_short_break INTEGER DEFAULT 5,
    friday_allowed_batches JSONB NOT NULL DEFAULT '[]'::jsonb,
    friday_allowed_departments JSONB NOT NULL DEFAULT '[]'::jsonb,
    friday_afternoon_shift_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    friday_afternoon_start_time TEXT DEFAULT '14:30',
    custom_breaks JSONB NOT NULL DEFAULT '[]'::jsonb,
    active_term_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    use_voting_preferences BOOLEAN NOT NULL DEFAULT TRUE,
    voting_preference_influence NUMERIC(4,2) DEFAULT 0.65,
    low_participation_threshold NUMERIC(5,2) DEFAULT 25.0,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    is_sample BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE VIEW public.universities AS SELECT * FROM public.institutions;

CREATE TABLE IF NOT EXISTS public.institution_data (
    institution_id TEXT PRIMARY KEY REFERENCES public.institutions(id) ON DELETE CASCADE,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. ROLES AND PERMISSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.roles_permissions (
    role_code TEXT PRIMARY KEY CHECK (role_code IN ('super_admin', 'university_admin', 'admin', 'timetable_manager', 'br', 'instructor', 'faculty', 'student')),
    display_name TEXT NOT NULL,
    can_manage_universities BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_academic_structure BOOLEAN NOT NULL DEFAULT FALSE,
    can_generate_timetables BOOLEAN NOT NULL DEFAULT FALSE,
    can_publish_timetables BOOLEAN NOT NULL DEFAULT FALSE,
    can_approve_rescheduling BOOLEAN NOT NULL DEFAULT FALSE,
    can_submit_preferences BOOLEAN NOT NULL DEFAULT TRUE,
    can_participate_voting BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.roles_permissions (
    role_code, display_name, can_manage_universities, can_manage_academic_structure,
    can_generate_timetables, can_publish_timetables, can_approve_rescheduling,
    can_submit_preferences, can_participate_voting
) VALUES
    ('super_admin', 'Super Admin', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
    ('university_admin', 'University Admin', FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
    ('admin', 'University Registrar / Admin', FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
    ('timetable_manager', 'Timetable Manager', FALSE, TRUE, TRUE, FALSE, FALSE, TRUE, FALSE),
    ('br', 'Batch Representative', FALSE, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE),
    ('instructor', 'Instructor', FALSE, FALSE, FALSE, FALSE, FALSE, TRUE, FALSE),
    ('faculty', 'Faculty Member', FALSE, FALSE, FALSE, FALSE, FALSE, TRUE, FALSE),
    ('student', 'Student', FALSE, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE)
ON CONFLICT (role_code) DO NOTHING;

-- ============================================================================
-- 3. PHYSICAL HIERARCHY (CAMPUSES & BUILDINGS)
-- ============================================================================
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

-- ============================================================================
-- 4. DEPARTMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.departments (
    id TEXT PRIMARY KEY DEFAULT ('dept-' || gen_random_uuid()::text),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    school TEXT,
    faculty_name TEXT,
    head_of_department TEXT,
    color_hex TEXT NOT NULL DEFAULT '#171717',
    sub_departments JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, code)
);

CREATE INDEX IF NOT EXISTS idx_departments_institution ON public.departments(institution_id);

-- ============================================================================
-- 5. ACADEMIC PROGRAMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.academic_programs (
    id TEXT PRIMARY KEY DEFAULT ('prog-' || gen_random_uuid()::text),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    department_id TEXT REFERENCES public.departments(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    degree_level TEXT NOT NULL DEFAULT 'BS' CHECK (degree_level IN ('BS', 'BE', 'MS', 'PhD', 'Diploma', 'Associate', 'Undergraduate', 'Graduate', 'Postgraduate')),
    duration_years INTEGER NOT NULL DEFAULT 4 CHECK (duration_years BETWEEN 1 AND 8),
    total_semesters INTEGER NOT NULL DEFAULT 8 CHECK (total_semesters BETWEEN 1 AND 16),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, code)
);

CREATE INDEX IF NOT EXISTS idx_programs_institution ON public.academic_programs(institution_id);

-- ============================================================================
-- 6. SEMESTERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.semesters (
    id TEXT PRIMARY KEY DEFAULT ('sem-' || gen_random_uuid()::text),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    academic_year TEXT NOT NULL DEFAULT '2026–2027',
    semester_number INTEGER NOT NULL DEFAULT 1 CHECK (semester_number BETWEEN 1 AND 16),
    weeks_count INTEGER NOT NULL DEFAULT 16,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
    department_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, code)
);

CREATE INDEX IF NOT EXISTS idx_semesters_institution ON public.semesters(institution_id);

-- ============================================================================
-- 7. BATCHES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.batches (
    id TEXT PRIMARY KEY DEFAULT ('batch-' || gen_random_uuid()::text),
    code TEXT NOT NULL,
    batch_code TEXT,
    name TEXT NOT NULL,
    department_code TEXT NOT NULL,
    program_id TEXT REFERENCES public.academic_programs(id) ON DELETE SET NULL,
    term_id TEXT,
    academic_year INTEGER DEFAULT 2026,
    year INTEGER NOT NULL DEFAULT 1,
    semester INTEGER NOT NULL DEFAULT 1,
    student_count INTEGER NOT NULL DEFAULT 60 CHECK (student_count > 0),
    section TEXT DEFAULT 'A',
    sections_list TEXT NOT NULL DEFAULT 'A,B',
    home_room TEXT,
    shared_course_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    institution_id TEXT NOT NULL DEFAULT 'inst-western-poly' REFERENCES public.institutions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, code)
);

CREATE INDEX IF NOT EXISTS idx_batches_institution_id ON public.batches(institution_id);

-- ============================================================================
-- 8. USER PROFILES (USERS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY DEFAULT ('user-' || gen_random_uuid()::text),
    auth_user_id UUID UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'university_admin', 'admin', 'timetable_manager', 'br', 'instructor', 'faculty', 'student')),
    gender TEXT CHECK (gender IN ('male', 'female') OR gender IS NULL),
    batch_id TEXT REFERENCES public.batches(id) ON DELETE SET NULL,
    registration_number TEXT,
    section TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    must_reset_password BOOLEAN NOT NULL DEFAULT FALSE,
    credential_hint TEXT,
    institution TEXT NOT NULL DEFAULT 'Western Polytechnic',
    institution_id TEXT NOT NULL DEFAULT 'inst-western-poly' REFERENCES public.institutions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE VIEW public.user_profiles AS SELECT * FROM public.users;

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON public.users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_institution_role ON public.users (institution_id, role);
CREATE INDEX IF NOT EXISTS idx_users_batch_id ON public.users (batch_id);

-- ============================================================================
-- 9. STUDENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY DEFAULT ('stu-' || gen_random_uuid()::text),
    user_id TEXT UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    batch_id TEXT NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    registration_number TEXT NOT NULL,
    section TEXT NOT NULL DEFAULT 'A',
    current_semester INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, registration_number)
);

CREATE INDEX IF NOT EXISTS idx_students_institution_batch ON public.students(institution_id, batch_id);

-- ============================================================================
-- 10. INSTRUCTORS (FACULTY & LAB ENGINEERS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.instructors (
    id TEXT PRIMARY KEY DEFAULT ('inst-fac-' || gen_random_uuid()::text),
    user_id TEXT UNIQUE REFERENCES public.users(id) ON DELETE SET NULL,
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    department_id TEXT REFERENCES public.departments(id) ON DELETE SET NULL,
    sub_department TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    designation TEXT NOT NULL DEFAULT 'Assistant Professor',
    staff_role TEXT NOT NULL DEFAULT 'faculty' CHECK (staff_role IN ('faculty', 'lab_engineer')),
    max_weekly_hours INTEGER NOT NULL DEFAULT 18 CHECK (max_weekly_hours BETWEEN 1 AND 45),
    max_daily_classes INTEGER NOT NULL DEFAULT 4 CHECK (max_daily_classes BETWEEN 1 AND 10),
    specializations TEXT[] DEFAULT ARRAY[]::TEXT[],
    qualified_course_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, email)
);

CREATE INDEX IF NOT EXISTS idx_instructors_institution ON public.instructors(institution_id);

-- ============================================================================
-- 11. INSTRUCTOR AVAILABILITY
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.instructor_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    instructor_id TEXT NOT NULL REFERENCES public.instructors(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (instructor_id, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS idx_instructor_avail_lookup ON public.instructor_availability(instructor_id, day_of_week);

-- ============================================================================
-- 12. INSTRUCTOR PREFERENCES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.instructor_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    instructor_id TEXT NOT NULL UNIQUE REFERENCES public.instructors(id) ON DELETE CASCADE,
    preferred_days TEXT[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri'],
    preferred_start_time TEXT DEFAULT '09:00',
    preferred_end_time TEXT DEFAULT '16:00',
    avoid_back_to_back_more_than INTEGER NOT NULL DEFAULT 2,
    prefer_compact_schedule BOOLEAN NOT NULL DEFAULT TRUE,
    max_weekly_hours INTEGER DEFAULT 14,
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 13. STUDENT PREFERENCES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.student_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    batch_id TEXT REFERENCES public.batches(id) ON DELETE CASCADE,
    preferred_time_window TEXT NOT NULL DEFAULT 'morning' CHECK (preferred_time_window IN ('morning', 'midday', 'afternoon', 'balanced')),
    avoid_early_8am BOOLEAN NOT NULL DEFAULT TRUE,
    avoid_late_after_4pm BOOLEAN NOT NULL DEFAULT TRUE,
    max_acceptable_gap_minutes INTEGER NOT NULL DEFAULT 60,
    max_daily_lectures INTEGER NOT NULL DEFAULT 4,
    preferred_free_day TEXT,
    ui_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_student_prefs_batch ON public.student_preferences(institution_id, batch_id);

-- ============================================================================
-- 14. CLASSROOMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.classrooms (
    id TEXT PRIMARY KEY DEFAULT ('room-' || gen_random_uuid()::text),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    building TEXT NOT NULL DEFAULT 'Academic Block A',
    building_id TEXT,
    floor INTEGER NOT NULL DEFAULT 1,
    capacity INTEGER NOT NULL DEFAULT 60 CHECK (capacity > 0),
    room_type TEXT NOT NULL DEFAULT 'lecture' CHECK (room_type IN ('lecture', 'seminar', 'auditorium', 'studio')),
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_accessible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, code)
);

CREATE INDEX IF NOT EXISTS idx_classrooms_institution ON public.classrooms(institution_id);

-- ============================================================================
-- 15. LABORATORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.laboratories (
    id TEXT PRIMARY KEY DEFAULT ('lab-' || gen_random_uuid()::text),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    department_id TEXT REFERENCES public.departments(id) ON DELETE SET NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    building TEXT NOT NULL DEFAULT 'Engineering Lab Complex',
    building_id TEXT,
    capacity INTEGER NOT NULL DEFAULT 40 CHECK (capacity > 0),
    lab_category TEXT NOT NULL DEFAULT 'Computing',
    assigned_lab_engineer_id TEXT REFERENCES public.instructors(id) ON DELETE SET NULL,
    equipment TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_accessible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, code)
);

CREATE INDEX IF NOT EXISTS idx_laboratories_institution ON public.laboratories(institution_id);

-- ============================================================================
-- 16. ROOM EQUIPMENT AND CAPACITIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.room_equipment_capacities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    room_id TEXT NOT NULL,
    room_kind TEXT NOT NULL DEFAULT 'classroom' CHECK (room_kind IN ('classroom', 'laboratory')),
    equipment_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
    has_projector BOOLEAN NOT NULL DEFAULT TRUE,
    has_smartboard BOOLEAN NOT NULL DEFAULT FALSE,
    has_high_performance_pcs BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_equip_room ON public.room_equipment_capacities(institution_id, room_id);

-- ============================================================================
-- 17. COURSES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.courses (
    id TEXT PRIMARY KEY DEFAULT ('crs-' || gen_random_uuid()::text),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    department_id TEXT REFERENCES public.departments(id) ON DELETE CASCADE,
    sub_department TEXT,
    program_id TEXT REFERENCES public.academic_programs(id) ON DELETE SET NULL,
    semester_id TEXT REFERENCES public.semesters(id) ON DELETE SET NULL,
    semester_number INTEGER,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    credit_hours INTEGER NOT NULL DEFAULT 3 CHECK (credit_hours BETWEEN 1 AND 8),
    course_type TEXT NOT NULL DEFAULT 'lecture' CHECK (course_type IN ('lecture', 'lab', 'lecture_lab')),
    lecture_credit_hours INTEGER NOT NULL DEFAULT 3 CHECK (lecture_credit_hours BETWEEN 0 AND 6),
    lab_credit_hours INTEGER NOT NULL DEFAULT 0 CHECK (lab_credit_hours BETWEEN 0 AND 4),
    lecture_hours_per_week INTEGER NOT NULL DEFAULT 3 CHECK (lecture_hours_per_week BETWEEN 0 AND 12),
    lab_hours_per_week INTEGER NOT NULL DEFAULT 0 CHECK (lab_hours_per_week BETWEEN 0 AND 12),
    assigned_instructor_id TEXT REFERENCES public.instructors(id) ON DELETE SET NULL,
    assigned_lab_engineer_id TEXT REFERENCES public.instructors(id) ON DELETE SET NULL,
    assigned_batch_id TEXT REFERENCES public.batches(id) ON DELETE SET NULL,
    lab_session_mode TEXT NOT NULL DEFAULT 'continuous' CHECK (lab_session_mode IN ('continuous', 'split_allowed')),
    is_compulsory BOOLEAN NOT NULL DEFAULT TRUE,
    is_elective BOOLEAN NOT NULL DEFAULT FALSE,
    elective_pool_name TEXT,
    required_room_type TEXT NOT NULL DEFAULT 'lecture',
    required_equipment TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, code)
);

CREATE INDEX IF NOT EXISTS idx_courses_institution ON public.courses(institution_id);
CREATE INDEX IF NOT EXISTS idx_courses_assigned_staff
    ON public.courses(institution_id, assigned_instructor_id, assigned_lab_engineer_id);

-- ============================================================================
-- 18. COURSE ENROLLMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.course_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    batch_id TEXT NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES public.students(id) ON DELETE CASCADE,
    section TEXT NOT NULL DEFAULT 'A',
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, batch_id, section, student_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_batch_course ON public.course_enrollments(institution_id, batch_id, course_id);

-- ============================================================================
-- 19. COURSE SESSIONS (SCHEDULING SECTIONS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.course_sessions (
    id TEXT PRIMARY KEY DEFAULT ('sec-' || gen_random_uuid()::text),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    term_id TEXT,
    instructor_id TEXT REFERENCES public.instructors(id) ON DELETE SET NULL,
    lab_engineer_id TEXT REFERENCES public.instructors(id) ON DELETE SET NULL,
    batch_id TEXT NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    shared_group_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    section_code TEXT NOT NULL DEFAULT 'A',
    session_type TEXT NOT NULL DEFAULT 'Theory' CHECK (session_type IN ('Theory', 'Lab', 'Tutorial')),
    component_type TEXT NOT NULL DEFAULT 'lecture' CHECK (component_type IN ('lecture', 'lab', 'tutorial')),
    lab_split_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    is_atomic_session BOOLEAN NOT NULL DEFAULT FALSE,
    span_slots INTEGER NOT NULL DEFAULT 1,
    sessions_per_week INTEGER NOT NULL DEFAULT 3 CHECK (sessions_per_week BETWEEN 1 AND 6),
    duration_minutes INTEGER NOT NULL DEFAULT 50 CHECK (duration_minutes BETWEEN 30 AND 300),
    expected_students INTEGER NOT NULL DEFAULT 50 CHECK (expected_students > 0),
    required_room_type TEXT NOT NULL DEFAULT 'lecture' CHECK (required_room_type IN ('lecture', 'lab', 'seminar')),
    required_equipment TEXT[] DEFAULT ARRAY[]::TEXT[],
    assigned_day TEXT,
    assigned_start_time TEXT,
    assigned_room_id TEXT,
    assigned_slot_json JSONB,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_sessions_institution ON public.course_sessions(institution_id);

-- ============================================================================
-- 20. SCHEDULING CONSTRAINTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.scheduling_constraints (
    id TEXT PRIMARY KEY DEFAULT ('const-' || gen_random_uuid()::text),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    code TEXT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'soft',
    category TEXT NOT NULL CHECK (category IN (
        'hard', 'soft_student', 'soft_instructor', 'soft_room', 'soft_fairness',
        'instructor', 'room', 'student', 'facility', 'temporal'
    )),
    description TEXT DEFAULT '',
    weight NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_constraints_institution ON public.scheduling_constraints(institution_id);

-- ============================================================================
-- 21. TIMETABLE VERSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.timetable_versions (
    id TEXT PRIMARY KEY DEFAULT ('ttv-' || gen_random_uuid()::text),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    semester_id TEXT REFERENCES public.semesters(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    version_number TEXT NOT NULL DEFAULT '1.0.0',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'approved', 'published', 'archived')),
    algorithm_used TEXT NOT NULL DEFAULT 'hybrid_dsatur_ga_sa',
    hard_violations_count INTEGER NOT NULL DEFAULT 0,
    overall_fitness_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    student_satisfaction_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    instructor_satisfaction_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    room_utilization_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    fairness_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    approved_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timetable_versions_inst_status ON public.timetable_versions(institution_id, status);

-- ============================================================================
-- 22. TIMETABLE ENTRIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.timetable_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    timetable_version_id TEXT NOT NULL REFERENCES public.timetable_versions(id) ON DELETE CASCADE,
    course_session_id TEXT NOT NULL,
    course_code TEXT NOT NULL,
    course_title TEXT,
    batch_id TEXT,
    section_code TEXT NOT NULL DEFAULT 'A',
    instructor_id TEXT,
    lab_engineer_id TEXT,
    room_id TEXT NOT NULL,
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 50,
    session_type TEXT NOT NULL DEFAULT 'Theory',
    component_type TEXT NOT NULL DEFAULT 'lecture',
    department_id TEXT,
    slot_source TEXT NOT NULL DEFAULT 'regular',
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timetable_entries_version ON public.timetable_entries(timetable_version_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_inst_batch ON public.timetable_entries(institution_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_inst_instructor ON public.timetable_entries(institution_id, instructor_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_lab_eng ON public.timetable_entries(institution_id, lab_engineer_id);

-- ============================================================================
-- 23. OPTIMIZATION RUNS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.optimization_runs (
    id TEXT PRIMARY KEY DEFAULT ('opt-' || gen_random_uuid()::text),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    timetable_version_id TEXT REFERENCES public.timetable_versions(id) ON DELETE SET NULL,
    algorithm TEXT NOT NULL CHECK (algorithm IN ('dsatur_only', 'ga_only', 'ga_sa', 'hybrid_dsatur_ga_sa', 'tabu_reschedule')),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'needs_review', 'failed')),
    total_sessions INTEGER NOT NULL DEFAULT 0,
    placed_sessions INTEGER NOT NULL DEFAULT 0,
    hard_constraint_violations INTEGER NOT NULL DEFAULT 0,
    execution_time_ms NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    assignments_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optimization_runs_institution ON public.optimization_runs(institution_id, created_at DESC);

-- ============================================================================
-- 24. OPTIMIZATION SCORES & EVALUATION METRICS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.optimization_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    optimization_run_id TEXT NOT NULL REFERENCES public.optimization_runs(id) ON DELETE CASCADE,
    total_fitness_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    student_satisfaction_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    instructor_satisfaction_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    compactness_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    student_gap_penalty NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    workload_balance_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    fairness_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    least_satisfied_batch_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    room_utilization_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    batch_satisfaction_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opt_scores_run ON public.optimization_scores(optimization_run_id);

-- ============================================================================
-- 25. OPTIMIZATION POLL TRACEABILITY
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.optimization_poll_traceability (
    id TEXT PRIMARY KEY,
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    optimization_run_id TEXT REFERENCES public.optimization_runs(id) ON DELETE CASCADE,
    timetable_version_id TEXT REFERENCES public.timetable_versions(id) ON DELETE CASCADE,
    poll_id TEXT,
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

-- ============================================================================
-- 26. DISRUPTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.disruptions (
    id TEXT PRIMARY KEY DEFAULT ('disr-' || gen_random_uuid()::text),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    disruption_type TEXT NOT NULL CHECK (disruption_type IN (
        'instructor_unavailable',
        'lab_engineer_unavailable',
        'room_unavailable',
        'lab_unavailable',
        'forced_course_move',
        'operating_hours_changed',
        'capacity_or_equipment_changed',
        'admin_slot_adjustment'
    )),
    affected_resource_id TEXT NOT NULL,
    affected_days TEXT[] DEFAULT ARRAY[]::TEXT[],
    affected_start_times TEXT[] DEFAULT ARRAY[]::TEXT[],
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'proposal_generated', 'resolved', 'dismissed')),
    reported_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disruptions_institution ON public.disruptions(institution_id, status);

-- ============================================================================
-- 27. RESCHEDULING PROPOSALS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rescheduling_proposals (
    id TEXT PRIMARY KEY DEFAULT ('prop-' || gen_random_uuid()::text),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    disruption_id TEXT REFERENCES public.disruptions(id) ON DELETE CASCADE,
    base_timetable_version_id TEXT REFERENCES public.timetable_versions(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected', 'published')),
    algorithm_used TEXT NOT NULL DEFAULT 'tabu_search',
    affected_sessions_count INTEGER NOT NULL DEFAULT 0,
    changed_sessions_count INTEGER NOT NULL DEFAULT 0,
    unchanged_sessions_count INTEGER NOT NULL DEFAULT 0,
    stability_percentage NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    remaining_hard_violations INTEGER NOT NULL DEFAULT 0,
    original_quality_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    proposed_quality_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
    repair_execution_time_ms NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    changes_detail JSONB NOT NULL DEFAULT '[]'::jsonb,
    original_assignments JSONB NOT NULL DEFAULT '{}'::jsonb,
    proposed_assignments JSONB NOT NULL DEFAULT '{}'::jsonb,
    reviewed_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resched_proposals_institution ON public.rescheduling_proposals(institution_id, status);

-- ============================================================================
-- 28. RESCHEDULING HISTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rescheduling_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    proposal_id TEXT NOT NULL REFERENCES public.rescheduling_proposals(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('created', 'approved', 'rejected', 'published')),
    actor_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    actor_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resched_history_institution ON public.rescheduling_history(institution_id, created_at DESC);

-- ============================================================================
-- 29. GOVERNANCE VOTING (BR ASSIGNMENTS, POLLS, OPTIONS, VOTES)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.br_assignments (
    id TEXT PRIMARY KEY DEFAULT ('assign-' || gen_random_uuid()::text),
    batch_id TEXT NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    gender_role TEXT NOT NULL CHECK (gender_role IN ('male', 'female')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_by TEXT NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_br_assignments_batch_active ON public.br_assignments (batch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_br_assignments_user_active ON public.br_assignments (user_id, is_active);

CREATE TABLE IF NOT EXISTS public.polls (
    id TEXT PRIMARY KEY DEFAULT ('poll-' || gen_random_uuid()::text),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    batch_id TEXT NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    target_scope TEXT NOT NULL DEFAULT 'all_batches' CHECK (target_scope IN ('all_batches', 'submitting_batch', 'selected_batches')),
    target_batch_ids JSONB DEFAULT '[]'::jsonb,
    poll_category TEXT DEFAULT 'general_suggestion',
    is_anonymous BOOLEAN DEFAULT TRUE,
    allow_multiple_votes BOOLEAN DEFAULT FALSE,
    submitted_by_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    submitted_by_name TEXT NOT NULL,
    br_gender_role TEXT NOT NULL CHECK (br_gender_role IN ('male', 'female')),
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Published', 'Closed')),
    rejection_reason TEXT,
    optimizer_approval_status TEXT DEFAULT 'pending_review',
    optimizer_approved_by TEXT,
    optimizer_approved_at TIMESTAMPTZ,
    optimizer_rejection_reason TEXT,
    result_visibility TEXT NOT NULL DEFAULT 'after_vote' CHECK (result_visibility IN ('after_vote', 'after_close', 'always')),
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    institution_id TEXT NOT NULL DEFAULT 'inst-western-poly' REFERENCES public.institutions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_polls_institution_status ON public.polls (institution_id, status);
CREATE INDEX IF NOT EXISTS idx_polls_batch_id ON public.polls (batch_id);

CREATE TABLE IF NOT EXISTS public.poll_options (
    id TEXT PRIMARY KEY DEFAULT ('opt-' || gen_random_uuid()::text),
    poll_id TEXT NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON public.poll_options (poll_id, sort_order);

CREATE TABLE IF NOT EXISTS public.poll_votes (
    id TEXT PRIMARY KEY DEFAULT ('vote-' || gen_random_uuid()::text),
    poll_id TEXT NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    option_id TEXT NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
    student_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    batch_id TEXT NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (poll_id, student_user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_option ON public.poll_votes (poll_id, option_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_student ON public.poll_votes (student_user_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_batch ON public.poll_votes (batch_id);

-- ============================================================================
-- 30. FEEDBACK, TIMETABLE FEEDBACK & SCHEDULE PROPOSALS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    category TEXT NOT NULL DEFAULT 'schedule_quality',
    rating INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_institution ON public.feedback(institution_id, created_at DESC);

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

-- ============================================================================
-- 31. CSV IMPORT HISTORY & IDEMPOTENCY TRACKING
-- ============================================================================
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

-- ============================================================================
-- 32. AUDIT LOGS & NOTIFICATIONS
-- ============================================================================
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

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id TEXT NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    recipient_user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_role TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT NOT NULL DEFAULT 'timetable_update' CHECK (notification_type IN (
        'timetable_published',
        'timetable_update',
        'disruption_alert',
        'preference_reminder',
        'voting_update'
    )),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(institution_id, recipient_user_id, is_read);

-- ============================================================================
-- IDEMPOTENT COLUMN & CONSTRAINT SYNC FOR EXISTING DATABASES
-- ============================================================================
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

ALTER TABLE IF EXISTS public.institutions DROP CONSTRAINT IF EXISTS institutions_timetable_management_policy_check;
ALTER TABLE IF EXISTS public.institutions ADD CONSTRAINT institutions_timetable_management_policy_check
    CHECK (timetable_management_policy IN ('whole_university', 'department_wise'));

ALTER TABLE IF EXISTS public.departments
    ADD COLUMN IF NOT EXISTS school TEXT,
    ADD COLUMN IF NOT EXISTS faculty_name TEXT,
    ADD COLUMN IF NOT EXISTS head_of_department TEXT,
    ADD COLUMN IF NOT EXISTS color_hex TEXT NOT NULL DEFAULT '#171717',
    ADD COLUMN IF NOT EXISTS sub_departments JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS public.academic_programs DROP CONSTRAINT IF EXISTS academic_programs_degree_level_check;
ALTER TABLE IF EXISTS public.academic_programs ADD CONSTRAINT academic_programs_degree_level_check
    CHECK (degree_level IN ('BS', 'BE', 'MS', 'PhD', 'Diploma', 'Associate', 'Undergraduate', 'Graduate', 'Postgraduate'));

ALTER TABLE IF EXISTS public.semesters
    ADD COLUMN IF NOT EXISTS academic_year TEXT NOT NULL DEFAULT '2026–2027',
    ADD COLUMN IF NOT EXISTS weeks_count INTEGER NOT NULL DEFAULT 16,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS department_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS public.semesters DROP CONSTRAINT IF EXISTS semesters_status_check;
ALTER TABLE IF EXISTS public.semesters ADD CONSTRAINT semesters_status_check
    CHECK (status IN ('draft', 'active', 'archived'));

ALTER TABLE IF EXISTS public.batches
    ADD COLUMN IF NOT EXISTS batch_code TEXT,
    ADD COLUMN IF NOT EXISTS section TEXT DEFAULT 'A',
    ADD COLUMN IF NOT EXISTS sections_list TEXT NOT NULL DEFAULT 'A',
    ADD COLUMN IF NOT EXISTS home_room TEXT,
    ADD COLUMN IF NOT EXISTS term_id TEXT,
    ADD COLUMN IF NOT EXISTS academic_year INTEGER DEFAULT 2026,
    ADD COLUMN IF NOT EXISTS shared_course_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS public.instructors
    ADD COLUMN IF NOT EXISTS staff_role TEXT NOT NULL DEFAULT 'faculty',
    ADD COLUMN IF NOT EXISTS sub_department TEXT,
    ADD COLUMN IF NOT EXISTS max_daily_classes INTEGER NOT NULL DEFAULT 4,
    ADD COLUMN IF NOT EXISTS specializations TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS qualified_course_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS public.instructors DROP CONSTRAINT IF EXISTS instructors_staff_role_check;
ALTER TABLE IF EXISTS public.instructors ADD CONSTRAINT instructors_staff_role_check
    CHECK (staff_role IN ('faculty', 'lab_engineer'));

ALTER TABLE IF EXISTS public.instructor_preferences
    ADD COLUMN IF NOT EXISTS max_weekly_hours INTEGER DEFAULT 14;

ALTER TABLE IF EXISTS public.classrooms
    ADD COLUMN IF NOT EXISTS building_id TEXT,
    ADD COLUMN IF NOT EXISTS is_accessible BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE IF EXISTS public.classrooms DROP CONSTRAINT IF EXISTS classrooms_room_type_check;
ALTER TABLE IF EXISTS public.classrooms ADD CONSTRAINT classrooms_room_type_check
    CHECK (room_type IN ('lecture', 'seminar', 'auditorium', 'studio'));

ALTER TABLE IF EXISTS public.laboratories
    ADD COLUMN IF NOT EXISTS building_id TEXT,
    ADD COLUMN IF NOT EXISTS is_accessible BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS assigned_lab_engineer_id TEXT REFERENCES public.instructors(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS equipment TEXT[] DEFAULT ARRAY[]::TEXT[];

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
    ADD COLUMN IF NOT EXISTS is_compulsory BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_elective BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS elective_pool_name TEXT,
    ADD COLUMN IF NOT EXISTS required_room_type TEXT NOT NULL DEFAULT 'lecture',
    ADD COLUMN IF NOT EXISTS required_equipment TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE IF EXISTS public.courses DROP CONSTRAINT IF EXISTS courses_credit_hours_check;
ALTER TABLE IF EXISTS public.courses ADD CONSTRAINT courses_credit_hours_check
    CHECK (credit_hours BETWEEN 1 AND 8);

ALTER TABLE IF EXISTS public.courses DROP CONSTRAINT IF EXISTS courses_lecture_hours_per_week_check;
ALTER TABLE IF EXISTS public.courses ADD CONSTRAINT courses_lecture_hours_per_week_check
    CHECK (lecture_hours_per_week BETWEEN 0 AND 12);

ALTER TABLE IF EXISTS public.courses DROP CONSTRAINT IF EXISTS courses_lab_hours_per_week_check;
ALTER TABLE IF EXISTS public.courses ADD CONSTRAINT courses_lab_hours_per_week_check
    CHECK (lab_hours_per_week BETWEEN 0 AND 12);

ALTER TABLE IF EXISTS public.courses DROP CONSTRAINT IF EXISTS courses_course_type_check;
ALTER TABLE IF EXISTS public.courses ADD CONSTRAINT courses_course_type_check
    CHECK (course_type IN ('lecture', 'lab', 'lecture_lab'));

ALTER TABLE IF EXISTS public.courses DROP CONSTRAINT IF EXISTS courses_lab_session_mode_check;
ALTER TABLE IF EXISTS public.courses ADD CONSTRAINT courses_lab_session_mode_check
    CHECK (lab_session_mode IN ('continuous', 'split_allowed'));

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

ALTER TABLE IF EXISTS public.course_sessions DROP CONSTRAINT IF EXISTS course_sessions_component_type_check;
ALTER TABLE IF EXISTS public.course_sessions ADD CONSTRAINT course_sessions_component_type_check
    CHECK (component_type IN ('lecture', 'lab', 'tutorial'));

ALTER TABLE IF EXISTS public.scheduling_constraints
    ADD COLUMN IF NOT EXISTS code TEXT,
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'soft',
    ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

ALTER TABLE IF EXISTS public.scheduling_constraints DROP CONSTRAINT IF EXISTS scheduling_constraints_category_check;
ALTER TABLE IF EXISTS public.scheduling_constraints ADD CONSTRAINT scheduling_constraints_category_check
    CHECK (category IN (
        'hard', 'soft_student', 'soft_instructor', 'soft_room', 'soft_fairness',
        'instructor', 'room', 'student', 'facility', 'temporal'
    ));

ALTER TABLE IF EXISTS public.timetable_entries
    ADD COLUMN IF NOT EXISTS lab_engineer_id TEXT,
    ADD COLUMN IF NOT EXISTS component_type TEXT NOT NULL DEFAULT 'lecture',
    ADD COLUMN IF NOT EXISTS department_id TEXT,
    ADD COLUMN IF NOT EXISTS slot_source TEXT NOT NULL DEFAULT 'regular';

ALTER TABLE IF EXISTS public.optimization_runs DROP CONSTRAINT IF EXISTS optimization_runs_status_check;
ALTER TABLE IF EXISTS public.optimization_runs ADD CONSTRAINT optimization_runs_status_check
    CHECK (status IN ('running', 'completed', 'needs_review', 'failed'));

ALTER TABLE IF EXISTS public.disruptions DROP CONSTRAINT IF EXISTS disruptions_disruption_type_check;
ALTER TABLE IF EXISTS public.disruptions ADD CONSTRAINT disruptions_disruption_type_check
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

ALTER TABLE IF EXISTS public.student_preferences
    ADD COLUMN IF NOT EXISTS ui_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS public.polls
    ADD COLUMN IF NOT EXISTS poll_category TEXT DEFAULT 'general_suggestion',
    ADD COLUMN IF NOT EXISTS target_batch_ids JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS allow_multiple_votes BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS optimizer_approval_status TEXT DEFAULT 'pending_review',
    ADD COLUMN IF NOT EXISTS optimizer_approved_by TEXT,
    ADD COLUMN IF NOT EXISTS optimizer_approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS optimizer_rejection_reason TEXT;

ALTER TABLE IF EXISTS public.polls DROP CONSTRAINT IF EXISTS polls_target_scope_check;
ALTER TABLE IF EXISTS public.polls ADD CONSTRAINT polls_target_scope_check
    CHECK (target_scope IN ('all_batches', 'submitting_batch', 'selected_batches'));

-- ============================================================================
-- AUTOMATIC TIMESTAMP TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS trg_institutions_updated_at ON public.institutions;
CREATE TRIGGER trg_institutions_updated_at
    BEFORE UPDATE ON public.institutions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_institution_data_updated_at ON public.institution_data;
CREATE TRIGGER trg_institution_data_updated_at
    BEFORE UPDATE ON public.institution_data
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_departments_updated_at ON public.departments;
CREATE TRIGGER trg_departments_updated_at
    BEFORE UPDATE ON public.departments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_academic_programs_updated_at ON public.academic_programs;
CREATE TRIGGER trg_academic_programs_updated_at
    BEFORE UPDATE ON public.academic_programs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_instructors_updated_at ON public.instructors;
CREATE TRIGGER trg_instructors_updated_at
    BEFORE UPDATE ON public.instructors
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_instructor_prefs_updated_at ON public.instructor_preferences;
CREATE TRIGGER trg_instructor_prefs_updated_at
    BEFORE UPDATE ON public.instructor_preferences
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_student_prefs_updated_at ON public.student_preferences;
CREATE TRIGGER trg_student_prefs_updated_at
    BEFORE UPDATE ON public.student_preferences
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_scheduling_constraints_updated_at ON public.scheduling_constraints;
CREATE TRIGGER trg_scheduling_constraints_updated_at
    BEFORE UPDATE ON public.scheduling_constraints
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_timetable_versions_updated_at ON public.timetable_versions;
CREATE TRIGGER trg_timetable_versions_updated_at
    BEFORE UPDATE ON public.timetable_versions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_resched_proposals_updated_at ON public.rescheduling_proposals;
CREATE TRIGGER trg_resched_proposals_updated_at
    BEFORE UPDATE ON public.rescheduling_proposals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_polls_updated_at ON public.polls;
CREATE TRIGGER trg_polls_updated_at
    BEFORE UPDATE ON public.polls
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_schedule_proposals_updated_at ON public.schedule_proposals;
CREATE TRIGGER trg_schedule_proposals_updated_at
    BEFORE UPDATE ON public.schedule_proposals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- DEFERRED ROW LEVEL SECURITY (RLS) REFERENCE POLICIES (DISABLED BY DEFAULT)
-- ============================================================================
-- Row Level Security is intentionally NOT enabled in this schema.
-- When ready to activate RLS for direct Supabase Auth JWT access:
--   1. Activate row-level security per table:
--      ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
--   2. Apply tenant isolation policies scoped by public.current_user_university_id()
--      and public.current_user_role() on:
--        institutions, institution_data, campuses, buildings, departments,
--        academic_programs, semesters, batches, users, students, instructors,
--        instructor_availability, instructor_preferences, student_preferences,
--        classrooms, laboratories, room_equipment_capacities, courses,
--        course_enrollments, course_sessions, scheduling_constraints,
--        timetable_versions, timetable_entries, optimization_runs,
--        optimization_scores, optimization_poll_traceability, disruptions,
--        rescheduling_proposals, rescheduling_history, br_assignments,
--        polls, poll_options, poll_votes, feedback, timetable_feedback,
--        schedule_proposals, import_history, audit_logs, notifications.
--   Template policy examples:
--     CREATE POLICY "Tenant isolation" ON public.<table_name> FOR ALL
--       USING (institution_id = public.current_user_university_id()
--              OR public.current_user_role() = 'super_admin');
--     CREATE POLICY "Student preferences owner access" ON public.student_preferences FOR ALL
--       USING (institution_id = public.current_user_university_id()
--              AND (user_id = auth.uid()::text OR public.current_user_role() IN ('super_admin','university_admin','admin','timetable_manager')));
--     CREATE POLICY "Published timetable visibility" ON public.timetable_versions FOR SELECT
--       USING (institution_id = public.current_user_university_id()
--              AND (status = 'published' OR public.current_user_role() IN ('super_admin','university_admin','admin','timetable_manager')));
-- ============================================================================

-- Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
