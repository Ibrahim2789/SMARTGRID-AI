-- ============================================================================
-- SMARTGRID AI — CSV IMPORT HISTORY & IDEMPOTENCY TRACKING MIGRATION
-- File: supabase/migrations/20261119000001_csv_import_history.sql
-- ============================================================================
-- Tracks institutional CSV/Excel bulk import executions, performing admin user,
-- row counts, error reports, duplicate resolution mode, and idempotency keys
-- with strict multi-university tenant isolation.
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

CREATE INDEX IF NOT EXISTS idx_import_history_institution_created
    ON public.import_history(institution_id, created_at DESC);

ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation on import_history" ON public.import_history;
CREATE POLICY "Tenant isolation on import_history"
    ON public.import_history FOR ALL
    USING (
        (
            institution_id = public.current_user_university_id()
            AND public.current_user_role() IN ('super_admin', 'university_admin', 'admin', 'timetable_manager')
        )
        OR public.current_user_role() = 'super_admin'
    );
