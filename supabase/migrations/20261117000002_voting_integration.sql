-- Migration: Voting Integration & Student Preference Rework (20261117000002_voting_integration.sql)

ALTER TABLE IF EXISTS polls
  ADD COLUMN IF NOT EXISTS poll_category TEXT DEFAULT 'general_suggestion',
  ADD COLUMN IF NOT EXISTS target_batch_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_multiple_votes BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS optimizer_approval_status TEXT DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS optimizer_approved_by TEXT,
  ADD COLUMN IF NOT EXISTS optimizer_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS optimizer_rejection_reason TEXT;

ALTER TABLE IF EXISTS institutions
  ADD COLUMN IF NOT EXISTS use_voting_preferences BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS voting_preference_influence NUMERIC(4,2) DEFAULT 0.65,
  ADD COLUMN IF NOT EXISTS low_participation_threshold NUMERIC(5,2) DEFAULT 25.0;

CREATE TABLE IF NOT EXISTS optimization_poll_traceability (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  optimization_run_id TEXT REFERENCES optimization_runs(id) ON DELETE CASCADE,
  timetable_version_id TEXT REFERENCES timetable_versions(id) ON DELETE CASCADE,
  poll_id TEXT REFERENCES polls(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS timetable_feedback (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  timetable_version_id TEXT REFERENCES timetable_versions(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
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

ALTER TABLE optimization_poll_traceability ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow tenant access to optimization_poll_traceability" ON optimization_poll_traceability
  FOR ALL USING (institution_id = public.current_user_university_id());

CREATE POLICY IF NOT EXISTS "Allow tenant access to timetable_feedback" ON timetable_feedback
  FOR ALL USING (institution_id = public.current_user_university_id());
