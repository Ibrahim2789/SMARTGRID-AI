-- ============================================================================
-- SMARTGRID AI — SUPABASE (POSTGRESQL) DATABASE SCHEMA
-- ============================================================================
-- How to use in Supabase:
-- 1. Open your Supabase Project Dashboard -> SQL Editor -> New Query
-- 2. Paste this entire file into the editor and click "Run"
-- 3. Copy your SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_DB_URL)
--    into your .env file to connect the Python FastAPI backend.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. INSTITUTIONS TABLE (Multi-University Tenant Configuration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.institutions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    campus_name TEXT NOT NULL DEFAULT 'Main Campus',
    accreditation TEXT NOT NULL DEFAULT 'Accredited University',
    academic_year TEXT NOT NULL DEFAULT '2026–2027',
    current_term TEXT NOT NULL DEFAULT 'Fall Semester 2026',
    working_days TEXT NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri',
    day_start_time TEXT NOT NULL DEFAULT '09:00',
    day_end_time TEXT NOT NULL DEFAULT '17:00',
    period_length_minutes INTEGER NOT NULL DEFAULT 50,
    short_break_minutes INTEGER NOT NULL DEFAULT 10,
    midday_break_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    midday_break_start TEXT NOT NULL DEFAULT '13:00',
    midday_break_duration INTEGER NOT NULL DEFAULT 60,
    lab_duration_minutes INTEGER NOT NULL DEFAULT 180,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    is_sample BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. INSTITUTION DATA TABLE (JSONB Catalog: Courses, Rooms, Faculty, Timetables)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.institution_data (
    institution_id TEXT PRIMARY KEY REFERENCES public.institutions(id) ON DELETE CASCADE,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. BATCHES TABLE (Academic Cohorts Scoped by University)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.batches (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    department_code TEXT NOT NULL,
    year INTEGER NOT NULL DEFAULT 1,
    semester INTEGER NOT NULL DEFAULT 1,
    student_count INTEGER NOT NULL DEFAULT 60,
    institution_id TEXT NOT NULL DEFAULT 'inst-western-poly' REFERENCES public.institutions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, code)
);

CREATE INDEX IF NOT EXISTS idx_batches_institution_id ON public.batches(institution_id);

-- ============================================================================
-- 4. USERS TABLE (Role-Based Accounts: Student, BR, Admin, Faculty)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'br', 'admin', 'faculty')),
    gender TEXT CHECK (gender IN ('male', 'female') OR gender IS NULL),
    batch_id TEXT REFERENCES public.batches(id) ON DELETE SET NULL,
    registration_number TEXT,
    section TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    must_reset_password BOOLEAN NOT NULL DEFAULT FALSE,
    credential_hint TEXT,
    institution TEXT NOT NULL DEFAULT 'Western Polytechnic',
    institution_id TEXT NOT NULL DEFAULT 'inst-western-poly' REFERENCES public.institutions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON public.users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_institution_role ON public.users (institution_id, role);
CREATE INDEX IF NOT EXISTS idx_users_batch_id ON public.users (batch_id);

-- ============================================================================
-- 5. BR ASSIGNMENTS TABLE (Designated Male & Female Batch Representatives)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.br_assignments (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    gender_role TEXT NOT NULL CHECK (gender_role IN ('male', 'female')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_by TEXT NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_br_assignments_batch_active ON public.br_assignments (batch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_br_assignments_user_active ON public.br_assignments (user_id, is_active);

-- ============================================================================
-- 6. POLLS TABLE (Batch & Institutional Scheduling Governance Polls)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.polls (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    batch_id TEXT NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    target_scope TEXT NOT NULL DEFAULT 'all_batches' CHECK (target_scope IN ('all_batches', 'submitting_batch')),
    submitted_by_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    submitted_by_name TEXT NOT NULL,
    br_gender_role TEXT NOT NULL CHECK (br_gender_role IN ('male', 'female')),
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Published', 'Closed')),
    rejection_reason TEXT,
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

-- ============================================================================
-- 7. POLL OPTIONS TABLE (Selectable Choices per Poll)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.poll_options (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON public.poll_options (poll_id, sort_order);

-- ============================================================================
-- 8. POLL VOTES TABLE (Strict 1-Vote-Per-Student-Per-Poll Constraint)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.poll_votes (
    id TEXT PRIMARY KEY,
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
-- 9. OPTIONAL STARTER SEED DATA (Demo Universities: WPU & AITS)
-- ============================================================================
INSERT INTO public.institutions (
    id, name, code, campus_name, accreditation, academic_year, current_term,
    working_days, day_start_time, day_end_time, period_length_minutes, short_break_minutes,
    midday_break_enabled, midday_break_start, midday_break_duration, lab_duration_minutes,
    timezone, is_sample
) VALUES
(
    'inst-western-poly',
    'Western Polytechnic University',
    'WPU',
    'Central Engineering & Computing Campus',
    'ABET & Regional Higher Education Commission Accredited',
    '2026–2027',
    'Fall Semester 2026',
    'Mon,Tue,Wed,Thu,Fri',
    '09:00',
    '17:00',
    50,
    10,
    TRUE,
    '13:00',
    60,
    180,
    'UTC-5',
    TRUE
),
(
    'inst-apex-tech',
    'Apex Institute of Technology & Sciences',
    'AITS',
    'North Innovation & Medical Robotics Campus',
    'Global STEM & Autonomous Systems Accreditation Board',
    '2026–2027',
    'Trimester I — 2026',
    'Mon,Tue,Wed,Thu,Fri,Sat',
    '08:30',
    '16:30',
    60,
    15,
    TRUE,
    '12:30',
    60,
    120,
    'UTC+1',
    TRUE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.batches (id, code, name, department_code, year, semester, student_count, institution_id)
VALUES
    ('batch-2k25-bscs', '2K25-BSCS', 'BS Computer Science — Batch 2K25', 'BSCS', 2, 3, 110, 'inst-western-poly'),
    ('batch-2k24-bese', '2K24-BESE', 'BE Software Engineering — Batch 2K24', 'BESE', 3, 5, 95, 'inst-western-poly'),
    ('batch-2k24-bee',  '2K24-BEE',  'BE Electrical Engineering — Batch 2K24', 'BEE', 3, 5, 105, 'inst-western-poly'),
    ('batch-2k25-bce',  '2K25-BCE',  'BE Computer Systems Engineering — Batch 2K25', 'BCE', 2, 3, 90, 'inst-western-poly'),
    ('batch-2k26-bscs', '2K26-BSCS', 'BS Computer Science — Batch 2K26', 'BSCS', 1, 1, 120, 'inst-western-poly'),
    ('batch-apex-2k25-bme',  '2K25-BME',  '2K25 Biomedical & Robotics Cohort', 'BME', 2025, 3, 45, 'inst-apex-tech'),
    ('batch-apex-2k25-bsds', '2K25-BSDS', '2K25 Data Science & AI Cohort', 'BSDS', 2025, 3, 55, 'inst-apex-tech')
ON CONFLICT (id) DO NOTHING;
