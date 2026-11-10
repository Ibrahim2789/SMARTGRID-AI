"""
Python SQLite Database, Password Hashing (scrypt), Token Signing, and Multi-University Seed Layer
for SmartGrid AI (Python + FastAPI Backend).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "smartgrid_voting.sqlite"
TOKEN_SECRET = os.environ.get("SMARTGRID_AUTH_SECRET", "smartgrid-institutional-secret-key-2026")

_db_lock = threading.RLock()


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


db_conn = get_connection()


def row_to_dict(row: Optional[sqlite3.Row]) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    return dict(row)


def rows_to_dicts(rows: List[sqlite3.Row]) -> List[Dict[str, Any]]:
    return [dict(r) for r in rows]


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def hash_password(password: str, salt: Optional[str] = None) -> str:
    """
    Compatible with Node's `crypto.scryptSync(password, salt, 64).toString('hex')`
    which uses N=16384, r=8, p=1, dklen=64 and UTF-8 bytes of the hex salt string.
    """
    actual_salt = salt or secrets.token_hex(16)
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=actual_salt.encode("utf-8"),
        n=16384,
        r=8,
        p=1,
        dklen=64,
    ).hex()
    return f"{actual_salt}:{derived}"


def verify_password(password: str, stored_hash: str) -> bool:
    if not stored_hash or ":" not in stored_hash:
        return False
    parts = stored_hash.split(":", 1)
    if len(parts) != 2:
        return False
    salt, key_hex = parts
    if not salt or not key_hex:
        return False
    try:
        candidate = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt.encode("utf-8"),
            n=16384,
            r=8,
            p=1,
            dklen=64,
        ).hex()
        return hmac.compare_digest(key_hex, candidate)
    except Exception:
        return False


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    padding = "=" * ((4 - len(s) % 4) % 4)
    return base64.urlsafe_b64decode((s + padding).encode("ascii"))


def sign_auth_token(payload: Dict[str, Any]) -> str:
    full_payload = {
        **payload,
        "exp": int(time.time() * 1000) + 1000 * 60 * 60 * 24 * 7,
    }
    data_bytes = json.dumps(full_payload, separators=(",", ":")).encode("utf-8")
    data_b64 = _b64url_encode(data_bytes)
    sig_bytes = hmac.new(
        TOKEN_SECRET.encode("utf-8"),
        data_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    sig_b64 = _b64url_encode(sig_bytes)
    return f"{data_b64}.{sig_b64}"


def verify_auth_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        if not token or "." not in token:
            return None
        data_b64, sig_b64 = token.split(".", 1)
        if not data_b64 or not sig_b64:
            return None
        expected_sig = _b64url_encode(
            hmac.new(
                TOKEN_SECRET.encode("utf-8"),
                data_b64.encode("ascii"),
                hashlib.sha256,
            ).digest()
        )
        if not hmac.compare_digest(sig_b64, expected_sig):
            return None
        parsed = json.loads(_b64url_decode(data_b64).decode("utf-8"))
        if int(parsed.get("exp", 0)) < int(time.time() * 1000):
            return None
        return parsed
    except Exception:
        return None


def initialize_voting_database() -> None:
    with _db_lock:
        db_conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS institutions (
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
              midday_break_enabled INTEGER NOT NULL DEFAULT 1,
              midday_break_start TEXT NOT NULL DEFAULT '13:00',
              midday_break_duration INTEGER NOT NULL DEFAULT 60,
              lab_duration_minutes INTEGER NOT NULL DEFAULT 180,
              timezone TEXT NOT NULL DEFAULT 'UTC',
              is_sample INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS institution_data (
              institution_id TEXT PRIMARY KEY,
              payload TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS batches (
              id TEXT PRIMARY KEY,
              code TEXT NOT NULL UNIQUE,
              name TEXT NOT NULL,
              department_code TEXT NOT NULL,
              year INTEGER NOT NULL,
              semester INTEGER NOT NULL,
              student_count INTEGER NOT NULL DEFAULT 60,
              institution_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL CHECK (role IN ('student', 'br', 'admin', 'faculty')),
              gender TEXT CHECK (gender IN ('male', 'female') OR gender IS NULL),
              batch_id TEXT,
              registration_number TEXT,
              section TEXT,
              is_active INTEGER NOT NULL DEFAULT 1,
              must_reset_password INTEGER NOT NULL DEFAULT 0,
              credential_hint TEXT,
              institution TEXT NOT NULL DEFAULT 'Western Polytechnic',
              institution_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              created_at TEXT NOT NULL,
              FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS br_assignments (
              id TEXT PRIMARY KEY,
              batch_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              gender_role TEXT NOT NULL CHECK (gender_role IN ('male', 'female')),
              is_active INTEGER NOT NULL DEFAULT 1,
              assigned_by TEXT NOT NULL,
              assigned_at TEXT NOT NULL,
              FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS polls (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              description TEXT NOT NULL,
              batch_id TEXT NOT NULL,
              target_scope TEXT NOT NULL DEFAULT 'all_batches' CHECK (target_scope IN ('all_batches', 'submitting_batch')),
              submitted_by_user_id TEXT NOT NULL,
              submitted_by_name TEXT NOT NULL,
              br_gender_role TEXT NOT NULL CHECK (br_gender_role IN ('male', 'female')),
              status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Published', 'Closed')),
              rejection_reason TEXT,
              result_visibility TEXT NOT NULL DEFAULT 'after_vote' CHECK (result_visibility IN ('after_vote', 'after_close', 'always')),
              start_at TEXT,
              end_at TEXT,
              published_at TEXT,
              closed_at TEXT,
              institution_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
              FOREIGN KEY (submitted_by_user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS poll_options (
              id TEXT PRIMARY KEY,
              poll_id TEXT NOT NULL,
              label TEXT NOT NULL,
              sort_order INTEGER NOT NULL DEFAULT 0,
              FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS poll_votes (
              id TEXT PRIMARY KEY,
              poll_id TEXT NOT NULL,
              option_id TEXT NOT NULL,
              student_user_id TEXT NOT NULL,
              batch_id TEXT NOT NULL,
              created_at TEXT NOT NULL,
              UNIQUE(poll_id, student_user_id),
              FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
              FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE,
              FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS departments (
              id TEXT PRIMARY KEY,
              university_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              code TEXT NOT NULL,
              name TEXT NOT NULL,
              faculty_group TEXT DEFAULT 'Engineering & Computing',
              head_of_department TEXT,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS programs (
              id TEXT PRIMARY KEY,
              university_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              department_id TEXT,
              code TEXT NOT NULL,
              name TEXT NOT NULL,
              degree_level TEXT NOT NULL DEFAULT 'Undergraduate',
              duration_years INTEGER NOT NULL DEFAULT 4,
              total_semesters INTEGER NOT NULL DEFAULT 8,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS semesters (
              id TEXT PRIMARY KEY,
              university_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              code TEXT NOT NULL,
              name TEXT NOT NULL,
              academic_year TEXT NOT NULL DEFAULT '2026–2027',
              semester_number INTEGER NOT NULL DEFAULT 1,
              is_current INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sections (
              id TEXT PRIMARY KEY,
              university_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              batch_id TEXT NOT NULL,
              code TEXT NOT NULL,
              name TEXT NOT NULL,
              student_count INTEGER NOT NULL DEFAULT 50,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS instructors (
              id TEXT PRIMARY KEY,
              university_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              user_id TEXT,
              department_code TEXT NOT NULL,
              name TEXT NOT NULL,
              email TEXT,
              designation TEXT NOT NULL DEFAULT 'Professor',
              specialization TEXT,
              max_weekly_hours INTEGER NOT NULL DEFAULT 15,
              max_lectures_per_day INTEGER NOT NULL DEFAULT 3,
              unavailable_slots TEXT NOT NULL DEFAULT '[]',
              preferred_slots TEXT NOT NULL DEFAULT '[]',
              avoid_early_morning INTEGER NOT NULL DEFAULT 0,
              avoid_late_afternoon INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS classrooms (
              id TEXT PRIMARY KEY,
              university_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              name TEXT NOT NULL,
              building TEXT NOT NULL DEFAULT 'Main Academic Block',
              floor INTEGER NOT NULL DEFAULT 1,
              type TEXT NOT NULL DEFAULT 'Theory',
              capacity INTEGER NOT NULL DEFAULT 60,
              equipment TEXT NOT NULL DEFAULT '[]',
              unavailable_slots TEXT NOT NULL DEFAULT '[]',
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS courses (
              id TEXT PRIMARY KEY,
              university_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              code TEXT NOT NULL,
              title TEXT NOT NULL,
              department_code TEXT NOT NULL,
              batch_id TEXT NOT NULL,
              semester INTEGER NOT NULL DEFAULT 3,
              type TEXT NOT NULL DEFAULT 'Theory',
              credit_hours INTEGER NOT NULL DEFAULT 3,
              hours_per_week INTEGER NOT NULL DEFAULT 3,
              instructor_id TEXT NOT NULL,
              student_count INTEGER NOT NULL DEFAULT 60,
              required_room_type TEXT NOT NULL DEFAULT 'Theory',
              required_equipment TEXT NOT NULL DEFAULT '[]',
              sections_count INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS student_preferences (
              id TEXT PRIMARY KEY,
              university_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              student_user_id TEXT NOT NULL,
              batch_id TEXT NOT NULL,
              preferred_start_window TEXT NOT NULL DEFAULT '09:00-14:00',
              preferred_lab_slots TEXT NOT NULL DEFAULT '[]',
              avoid_early_morning INTEGER NOT NULL DEFAULT 0,
              avoid_late_evening INTEGER NOT NULL DEFAULT 1,
              max_acceptable_idle_gaps INTEGER NOT NULL DEFAULT 1,
              compact_schedule_weight REAL NOT NULL DEFAULT 0.85,
              preferred_free_day TEXT,
              notes TEXT,
              updated_at TEXT NOT NULL,
              UNIQUE(student_user_id)
            );

            CREATE TABLE IF NOT EXISTS instructor_preferences (
              id TEXT PRIMARY KEY,
              university_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              instructor_id TEXT NOT NULL,
              preferred_days TEXT NOT NULL DEFAULT '["Mon","Tue","Wed","Thu","Fri"]',
              preferred_slots TEXT NOT NULL DEFAULT '[]',
              unavailable_slots TEXT NOT NULL DEFAULT '[]',
              max_consecutive_hours INTEGER NOT NULL DEFAULT 2,
              avoid_early_morning INTEGER NOT NULL DEFAULT 0,
              avoid_late_afternoon INTEGER NOT NULL DEFAULT 0,
              notes TEXT,
              updated_at TEXT NOT NULL,
              UNIQUE(instructor_id)
            );

            CREATE TABLE IF NOT EXISTS optimization_runs (
              id TEXT PRIMARY KEY,
              university_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              triggered_by_user_id TEXT,
              algorithm_pipeline TEXT NOT NULL DEFAULT 'hybrid_dsatur_ga_sa',
              status TEXT NOT NULL DEFAULT 'Completed',
              hyperparameters TEXT NOT NULL DEFAULT '{}',
              objective_weights TEXT NOT NULL DEFAULT '{}',
              dsatur_initial_fitness REAL,
              ga_best_fitness REAL,
              sa_final_fitness REAL,
              hard_constraint_violations INTEGER NOT NULL DEFAULT 0,
              execution_time_ms INTEGER NOT NULL DEFAULT 0,
              generations_executed INTEGER NOT NULL DEFAULT 0,
              sa_iterations_executed INTEGER NOT NULL DEFAULT 0,
              convergence_history TEXT NOT NULL DEFAULT '[]',
              summary_metrics TEXT NOT NULL DEFAULT '{}',
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS optimization_scores (
              id TEXT PRIMARY KEY,
              optimization_run_id TEXT NOT NULL,
              university_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              batch_id TEXT,
              overall_fitness_score REAL NOT NULL DEFAULT 0,
              hard_constraint_score REAL NOT NULL DEFAULT 100,
              student_preference_score REAL NOT NULL DEFAULT 0,
              compactness_score REAL NOT NULL DEFAULT 0,
              workload_balance_score REAL NOT NULL DEFAULT 0,
              instructor_preference_score REAL NOT NULL DEFAULT 0,
              batch_fairness_score REAL NOT NULL DEFAULT 0,
              room_utilization_score REAL NOT NULL DEFAULT 0,
              average_idle_gaps_per_day REAL NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              FOREIGN KEY (optimization_run_id) REFERENCES optimization_runs(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS timetable_versions (
              id TEXT PRIMARY KEY,
              university_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              optimization_run_id TEXT,
              version_name TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'Draft',
              fitness_score REAL NOT NULL DEFAULT 0,
              hard_conflicts_count INTEGER NOT NULL DEFAULT 0,
              entries_json TEXT NOT NULL DEFAULT '[]',
              metrics_json TEXT NOT NULL DEFAULT '{}',
              created_by_user_id TEXT,
              published_at TEXT,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS disruption_events (
              id TEXT PRIMARY KEY,
              university_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              timetable_version_id TEXT,
              disruption_type TEXT NOT NULL,
              title TEXT NOT NULL,
              description TEXT NOT NULL,
              affected_instructor_id TEXT,
              affected_classroom_id TEXT,
              affected_batch_id TEXT,
              affected_day TEXT,
              affected_slots TEXT NOT NULL DEFAULT '[]',
              severity TEXT NOT NULL DEFAULT 'Medium',
              status TEXT NOT NULL DEFAULT 'Resolved',
              reported_by_user_id TEXT,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS rescheduling_proposals (
              id TEXT PRIMARY KEY,
              university_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              disruption_event_id TEXT NOT NULL,
              timetable_version_id TEXT,
              algorithm_used TEXT NOT NULL DEFAULT 'tabu_search_rescheduler',
              status TEXT NOT NULL DEFAULT 'Pending',
              affected_classes_count INTEGER NOT NULL DEFAULT 0,
              moved_classes_count INTEGER NOT NULL DEFAULT 0,
              unchanged_classes_count INTEGER NOT NULL DEFAULT 0,
              stability_score REAL NOT NULL DEFAULT 100.0,
              new_fitness_score REAL NOT NULL DEFAULT 0.0,
              hard_conflicts_introduced INTEGER NOT NULL DEFAULT 0,
              diff_payload TEXT NOT NULL DEFAULT '[]',
              updated_entries_json TEXT NOT NULL DEFAULT '[]',
              execution_time_ms INTEGER NOT NULL DEFAULT 0,
              reviewed_by_user_id TEXT,
              reviewed_at TEXT,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS notifications (
              id TEXT PRIMARY KEY,
              university_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              recipient_user_id TEXT,
              recipient_batch_id TEXT,
              recipient_role TEXT,
              category TEXT NOT NULL DEFAULT 'System',
              title TEXT NOT NULL,
              message TEXT NOT NULL,
              is_read INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
              id TEXT PRIMARY KEY,
              university_id TEXT NOT NULL DEFAULT 'inst-western-poly',
              actor_user_id TEXT,
              actor_name TEXT,
              actor_role TEXT,
              action TEXT NOT NULL,
              entity_type TEXT NOT NULL,
              entity_id TEXT,
              details TEXT NOT NULL DEFAULT '{}',
              created_at TEXT NOT NULL
            );
            """
        )

        # Ensure schema columns exist on legacy SQLite files
        user_cols = [r["name"] for r in db_conn.execute("PRAGMA table_info(users)").fetchall()]
        if "registration_number" not in user_cols:
            db_conn.execute("ALTER TABLE users ADD COLUMN registration_number TEXT;")
        if "section" not in user_cols:
            db_conn.execute("ALTER TABLE users ADD COLUMN section TEXT;")
        if "institution_id" not in user_cols:
            db_conn.execute("ALTER TABLE users ADD COLUMN institution_id TEXT NOT NULL DEFAULT 'inst-western-poly';")

        batch_cols = [r["name"] for r in db_conn.execute("PRAGMA table_info(batches)").fetchall()]
        if "institution_id" not in batch_cols:
            db_conn.execute("ALTER TABLE batches ADD COLUMN institution_id TEXT NOT NULL DEFAULT 'inst-western-poly';")

        poll_cols = [r["name"] for r in db_conn.execute("PRAGMA table_info(polls)").fetchall()]
        if "institution_id" not in poll_cols:
            db_conn.execute("ALTER TABLE polls ADD COLUMN institution_id TEXT NOT NULL DEFAULT 'inst-western-poly';")

        # Seed default institutions if not present
        db_conn.execute(
            """
            INSERT OR IGNORE INTO institutions (
              id, name, code, campus_name, accreditation, academic_year, current_term,
              working_days, day_start_time, day_end_time, period_length_minutes, short_break_minutes,
              midday_break_enabled, midday_break_start, midday_break_duration, lab_duration_minutes,
              timezone, is_sample, created_at
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
              1,
              '13:00',
              60,
              180,
              'UTC-5',
              1,
              datetime('now')
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
              1,
              '12:30',
              60,
              120,
              'UTC+1',
              1,
              datetime('now')
            );
            """
        )
        db_conn.commit()
        _seed_initial_western_poly_data()
        _seed_apex_tech_data()
        _seed_academic_catalog()


def _seed_initial_western_poly_data() -> None:
    cnt_row = db_conn.execute("SELECT COUNT(*) as cnt FROM batches WHERE institution_id = 'inst-western-poly'").fetchone()
    if cnt_row and int(cnt_row["cnt"]) > 0:
        return

    now = datetime.now(timezone.utc)
    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    two_days_ago = (now - timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    three_days_ago = (now - timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    in_five_days = (now + timedelta(days=5)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    in_seven_days = (now + timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    batches = [
        ("batch-2k25-bscs", "2K25-BSCS", "BS Computer Science — Batch 2K25", "BSCS", 2, 3, 110),
        ("batch-2k24-bese", "2K24-BESE", "BE Software Engineering — Batch 2K24", "BESE", 3, 5, 95),
        ("batch-2k24-bee", "2K24-BEE", "BE Electrical Engineering — Batch 2K24", "BEE", 3, 5, 105),
        ("batch-2k25-bce", "2K25-BCE", "BE Computer Systems Engineering — Batch 2K25", "BCE", 2, 3, 90),
        ("batch-2k26-bscs", "2K26-BSCS", "BS Computer Science — Batch 2K26", "BSCS", 1, 1, 120),
    ]
    for b_id, code, name, dept, yr, sem, st_count in batches:
        db_conn.execute(
            """
            INSERT OR IGNORE INTO batches (id, code, name, department_code, year, semester, student_count, institution_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'inst-western-poly', ?)
            """,
            (b_id, code, name, dept, yr, sem, st_count, three_days_ago),
        )

    users = [
        ("user-admin-reynolds", "Dr. Katherine Reynolds", "k.reynolds@westernpoly.edu", "Admin@2026", "admin", "female", None, None, None),
        ("user-faculty-turing", "Prof. Alan Turing", "a.turing@westernpoly.edu", "Faculty@2026", "faculty", "male", None, None, None),
        ("user-faculty-jehanzeb", "Dr. Jehanzeb Ahmad", "jehanzeb.ahmad@westernpoly.edu", "Faculty@2026", "faculty", "male", None, None, None),
        ("user-br-male-2k25-bscs", "Hamza Tariq (Male BR · 2K25-BSCS)", "br.male.2k25bscs@westernpoly.edu", "BR-2K25CS-M!", "br", "male", "batch-2k25-bscs", "2K25-BSCS-BR01", "Section A"),
        ("user-br-female-2k25-bscs", "Aisha Siddiqui (Female BR · 2K25-BSCS)", "br.female.2k25bscs@westernpoly.edu", "BR-2K25CS-F!", "br", "female", "batch-2k25-bscs", "2K25-BSCS-BR02", "Section A"),
        ("user-br-male-2k24-bese", "Zain Ul Abideen (Male BR · 2K24-BESE)", "br.male.2k24bese@westernpoly.edu", "BR-2K24SE-M!", "br", "male", "batch-2k24-bese", "2K24-BESE-BR01", "Section A"),
        ("user-br-female-2k24-bese", "Fatima Noor (Female BR · 2K24-BESE)", "br.female.2k24bese@westernpoly.edu", "BR-2K24SE-F!", "br", "female", "batch-2k24-bese", "2K24-BESE-BR02", "Section B"),
        ("user-br-male-2k24-bee", "Bilal Mahmood (Male BR · 2K24-BEE)", "br.male.2k24bee@westernpoly.edu", "BR-2K24EE-M!", "br", "male", "batch-2k24-bee", "2K24-BEE-BR01", "Section A"),
        ("user-br-female-2k24-bee", "Sana Javed (Female BR · 2K24-BEE)", "br.female.2k24bee@westernpoly.edu", "BR-2K24EE-F!", "br", "female", "batch-2k24-bee", "2K24-BEE-BR02", "Section B"),
        ("user-br-male-2k25-bce", "Omar Farooq (Male BR · 2K25-BCE)", "br.male.2k25bce@westernpoly.edu", "BR-2K25CE-M!", "br", "male", "batch-2k25-bce", "2K25-BCE-BR01", "Section A"),
        ("user-student-maya", "Maya Lin", "m.lin@westernpoly.edu", "Student@2026", "student", "female", "batch-2k25-bscs", "2K25-BSCS-014", "Section A"),
        ("user-student-ahmed", "Ahmed Raza", "a.raza@westernpoly.edu", "Student@2026", "student", "male", "batch-2k25-bscs", "2K25-BSCS-028", "Section B"),
        ("user-student-sara", "Sara Khan", "s.khan@westernpoly.edu", "Student@2026", "student", "female", "batch-2k24-bese", "2K24-BESE-009", "Section A"),
        ("user-student-daniyal", "Daniyal Sheikh", "d.sheikh@westernpoly.edu", "Student@2026", "student", "male", "batch-2k24-bese", "2K24-BESE-033", "Section B"),
        ("user-student-usman", "Usman Ali", "u.ali@westernpoly.edu", "Student@2026", "student", "male", "batch-2k24-bee", "2K24-BEE-019", "Section A"),
        ("user-student-hira", "Hira Malik", "h.malik@westernpoly.edu", "Student@2026", "student", "female", "batch-2k24-bee", "2K24-BEE-044", "Section B"),
        ("user-student-rayyan", "Rayyan Qureshi", "r.qureshi@westernpoly.edu", "Student@2026", "student", "male", "batch-2k25-bce", "2K25-BCE-012", "Section A"),
        ("user-student-zoya", "Zoya Hassan", "z.hassan@westernpoly.edu", "Student@2026", "student", "female", "batch-2k26-bscs", "2K26-BSCS-005", "Section A"),
    ]
    for u_id, name, email, pw, role, gender, batch_id, reg_no, sec in users:
        db_conn.execute(
            """
            INSERT OR IGNORE INTO users (
              id, name, email, password_hash, role, gender, batch_id,
              registration_number, section,
              is_active, must_reset_password, credential_hint, institution, institution_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, 'Western Polytechnic', 'inst-western-poly', ?)
            """,
            (u_id, name, email, hash_password(pw), role, gender, batch_id, reg_no, sec, pw, three_days_ago),
        )
        if role == "br" and batch_id and gender:
            db_conn.execute(
                """
                INSERT OR IGNORE INTO br_assignments (id, batch_id, user_id, gender_role, is_active, assigned_by, assigned_at)
                VALUES (?, ?, ?, ?, 1, 'Dr. Katherine Reynolds', ?)
                """,
                (f"assign-{u_id}", batch_id, u_id, gender, three_days_ago),
            )

    db_conn.execute(
        """
        INSERT OR IGNORE INTO polls (
          id, title, description, batch_id, target_scope,
          submitted_by_user_id, submitted_by_name, br_gender_role,
          status, rejection_reason, result_visibility,
          start_at, end_at, published_at, closed_at, institution_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'all_batches', ?, ?, 'male', 'Published', NULL, 'after_vote', ?, ?, ?, NULL, 'inst-western-poly', ?, ?)
        """,
        (
            "poll-1-friday-labs",
            "Preferred Continuous 3-Hour Lab Slot on Fridays",
            "To prevent Friday afternoon overlap with inter-departmental societies and Jummah prayers, which continuous 3-hour slot should the timetable engine prioritize for Friday laboratory sections?",
            "batch-2k25-bscs",
            "user-br-male-2k25-bscs",
            "Hamza Tariq (Male BR · 2K25-BSCS)",
            two_days_ago,
            in_five_days,
            two_days_ago,
            two_days_ago,
            two_days_ago,
        ),
    )
    for opt_id, label, order in [
        ("opt-p1-1", "Morning Block (09:00 AM – 12:00 PM)", 1),
        ("opt-p1-2", "Post-Break Afternoon Block (02:00 PM – 05:00 PM)", 2),
        ("opt-p1-3", "Move Friday Labs to Thursday Afternoon where room capacity permits", 3),
    ]:
        db_conn.execute(
            "INSERT OR IGNORE INTO poll_options (id, poll_id, label, sort_order) VALUES (?, 'poll-1-friday-labs', ?, ?)",
            (opt_id, label, order),
        )
    db_conn.commit()


def _seed_apex_tech_data() -> None:
    cnt_row = db_conn.execute("SELECT COUNT(*) as cnt FROM batches WHERE institution_id = 'inst-apex-tech'").fetchone()
    if cnt_row and int(cnt_row["cnt"]) > 0:
        return

    current_iso = now_iso()
    db_conn.execute(
        """
        INSERT OR IGNORE INTO batches (id, code, name, department_code, year, semester, student_count, institution_id, created_at)
        VALUES
        ('batch-apex-2k25-bme', '2K25-BME', '2K25 Biomedical & Robotics Cohort', 'BME', 2025, 3, 45, 'inst-apex-tech', ?),
        ('batch-apex-2k25-bsds', '2K25-BSDS', '2K25 Data Science & AI Cohort', 'BSDS', 2025, 3, 55, 'inst-apex-tech', ?)
        """,
        (current_iso, current_iso),
    )

    apex_users = [
        ("user-apex-admin", "Dr. Arthur Vance", "admin@apextech.edu", "Admin@2026", "admin", "male", None, None, None),
        ("user-apex-vance", "Dr. Marcus Vance", "m.vance@apextech.edu", "Faculty@2026", "faculty", "male", None, None, None),
        ("user-apex-rostova", "Prof. Elena Rostova", "e.rostova@apextech.edu", "Faculty@2026", "faculty", "female", None, None, None),
        ("user-apex-br-liam", "Liam Chen", "br.male@apextech.edu", "BR@2026", "br", "male", "batch-apex-2k25-bme", "2K25-BME-002", "Section A"),
        ("user-apex-br-aria", "Aria Thorne", "br.female@apextech.edu", "BR@2026", "br", "female", "batch-apex-2k25-bsds", "2K25-BSDS-003", "Section A"),
        ("user-apex-student-alex", "Alex Rivera", "student.alex@apextech.edu", "Student@2026", "student", "male", "batch-apex-2k25-bme", "2K25-BME-001", "Section A"),
    ]
    for u_id, name, email, pw, role, gender, batch_id, reg_no, sec in apex_users:
        db_conn.execute(
            """
            INSERT OR IGNORE INTO users (
              id, name, email, password_hash, role, gender, batch_id,
              registration_number, section,
              is_active, must_reset_password, credential_hint, institution, institution_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, 'Apex Institute of Technology & Sciences', 'inst-apex-tech', ?)
            """,
            (u_id, name, email, hash_password(pw), role, gender, batch_id, reg_no, sec, pw, current_iso),
        )

    db_conn.execute(
        """
        INSERT OR IGNORE INTO br_assignments (id, batch_id, user_id, gender_role, is_active, assigned_by, assigned_at)
        VALUES
        ('assign-apex-liam', 'batch-apex-2k25-bme', 'user-apex-br-liam', 'male', 1, 'user-apex-admin', ?),
        ('assign-apex-aria', 'batch-apex-2k25-bsds', 'user-apex-br-aria', 'female', 1, 'user-apex-admin', ?)
        """,
        (current_iso, current_iso),
    )

    db_conn.execute(
        """
        INSERT OR IGNORE INTO polls (
          id, title, description, batch_id, target_scope,
          submitted_by_user_id, submitted_by_name, br_gender_role,
          status, result_visibility, start_at, end_at, published_at, institution_id, created_at, updated_at
        ) VALUES (
          'poll-apex-gpu-lab',
          'Extend Saturday High-Performance GPU Cluster Hours for Capstone AI',
          'Proposal to extend Ada-DS1 high-performance cluster access until 18:30 on Saturdays for senior robotics and machine learning research.',
          'batch-apex-2k25-bsds',
          'all_batches',
          'user-apex-br-aria',
          'Aria Thorne',
          'female',
          'Published',
          'after_vote',
          datetime('now', '-1 day'),
          datetime('now', '+5 days'),
          datetime('now', '-1 day'),
          'inst-apex-tech',
          datetime('now', '-1 day'),
          datetime('now')
        )
        """
    )
    db_conn.execute(
        """
        INSERT OR IGNORE INTO poll_options (id, poll_id, label, sort_order)
        VALUES
        ('opt-apex-gpu-1', 'poll-apex-gpu-lab', 'Approve Saturday Extension to 18:30', 1),
        ('opt-apex-gpu-2', 'poll-apex-gpu-lab', 'Keep Standard 16:30 Saturday Close', 2)
        """
    )
    db_conn.commit()


def _seed_academic_catalog() -> None:
    cnt_row = db_conn.execute("SELECT COUNT(*) as cnt FROM courses WHERE university_id = 'inst-western-poly'").fetchone()
    if cnt_row and int(cnt_row["cnt"]) > 0:
        return

    current_iso = now_iso()

    # Seed departments
    depts = [
        ("dept-wpu-bscs", "inst-western-poly", "BSCS", "Department of Computer Science", "Engineering & Computing", "Prof. Alan Turing"),
        ("dept-wpu-bese", "inst-western-poly", "BESE", "Department of Software Engineering", "Engineering & Computing", "Dr. Jehanzeb Ahmad"),
        ("dept-wpu-bee", "inst-western-poly", "BEE", "Department of Electrical Engineering", "Engineering & Computing", "Dr. Nikola Tesla"),
        ("dept-wpu-bce", "inst-western-poly", "BCE", "Department of Computer Systems Engineering", "Engineering & Computing", "Dr. Grace Hopper"),
    ]
    for d_id, u_id, code, name, fg, hod in depts:
        db_conn.execute(
            """
            INSERT OR IGNORE INTO departments (id, university_id, code, name, faculty_group, head_of_department, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (d_id, u_id, code, name, fg, hod, current_iso),
        )

    # Seed instructors
    instructors = [
        ("inst-turing", "inst-western-poly", "user-faculty-turing", "BSCS", "Prof. Alan Turing", "a.turing@westernpoly.edu", "Professor", "Algorithms & Artificial Intelligence", 15, 3, '["Fri-14:00","Fri-15:00"]', '["Mon-09:00","Tue-09:00","Wed-10:00"]', 0, 1),
        ("inst-jehanzeb", "inst-western-poly", "user-faculty-jehanzeb", "BESE", "Dr. Jehanzeb Ahmad", "jehanzeb.ahmad@westernpoly.edu", "Associate Professor", "Distributed Software Architecture", 15, 3, '["Mon-15:00"]', '["Mon-10:00","Tue-10:00","Thu-09:00"]', 0, 0),
        ("inst-hopper", "inst-western-poly", None, "BCE", "Dr. Grace Hopper", "g.hopper@westernpoly.edu", "Professor", "Compilers & Embedded Systems", 15, 3, '[]', '["Tue-09:00","Wed-09:00","Thu-10:00"]', 0, 1),
        ("inst-lovelace", "inst-western-poly", None, "BSCS", "Dr. Ada Lovelace", "a.lovelace@westernpoly.edu", "Assistant Professor", "Machine Learning & Data Science", 15, 3, '["Wed-15:00"]', '["Mon-11:00","Wed-11:00","Thu-11:00"]', 1, 0),
        ("inst-dijkstra", "inst-western-poly", None, "BESE", "Prof. Edsger Dijkstra", "e.dijkstra@westernpoly.edu", "Professor", "Formal Methods & Operating Systems", 15, 3, '[]', '["Mon-09:00","Wed-09:00","Fri-09:00"]', 0, 1),
        ("inst-tesla", "inst-western-poly", None, "BEE", "Dr. Nikola Tesla", "n.tesla@westernpoly.edu", "Professor", "Power Systems & Electromagnetics", 15, 3, '[]', '["Tue-10:00","Thu-10:00"]', 0, 0),
    ]
    for i_id, u_id, usr_id, dept, name, email, desig, spec, mwh, mlpd, unavail, pref, aem, ala in instructors:
        db_conn.execute(
            """
            INSERT OR IGNORE INTO instructors (
              id, university_id, user_id, department_code, name, email, designation, specialization,
              max_weekly_hours, max_lectures_per_day, unavailable_slots, preferred_slots,
              avoid_early_morning, avoid_late_afternoon, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (i_id, u_id, usr_id, dept, name, email, desig, spec, mwh, mlpd, unavail, pref, aem, ala, current_iso),
        )

    # Seed classrooms
    classrooms = [
        ("room-lh-101", "inst-western-poly", "LH-101 (Turing Lecture Hall)", "Computing Block A", 1, "Theory", 120, '["Projector","SmartBoard","AudioSystem"]', '[]'),
        ("room-lh-102", "inst-western-poly", "LH-102 (Shannon Hall)", "Computing Block A", 1, "Theory", 110, '["Projector","SmartBoard"]', '[]'),
        ("room-lh-201", "inst-western-poly", "LH-201 (Engineering Auditorium)", "Engineering Block B", 2, "Theory", 130, '["Projector","AudioSystem"]', '[]'),
        ("room-lh-202", "inst-western-poly", "LH-202 (Systems Seminar Room)", "Engineering Block B", 2, "Theory", 100, '["Projector","Whiteboard"]', '[]'),
        ("room-lab-ai", "inst-western-poly", "LAB-301 (AI & GPU Computing Lab)", "Computing Block A", 3, "Lab", 120, '["GPUWorkstations","Projector","LinuxCluster"]', '[]'),
        ("room-lab-se", "inst-western-poly", "LAB-302 (Software Systems Lab)", "Computing Block A", 3, "Lab", 110, '["Workstations","SmartBoard"]', '[]'),
        ("room-lab-ee", "inst-western-poly", "LAB-105 (Power & Embedded Lab)", "Engineering Block B", 1, "Lab", 115, '["Oscilloscopes","EmbeddedKits","Projector"]', '[]'),
    ]
    for r_id, u_id, name, bldg, flr, rtype, cap, equip, unavail in classrooms:
        db_conn.execute(
            """
            INSERT OR IGNORE INTO classrooms (
              id, university_id, name, building, floor, type, capacity, equipment, unavailable_slots, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (r_id, u_id, name, bldg, flr, rtype, cap, equip, unavail, current_iso),
        )

    # Seed courses
    courses = [
        ("crs-cs301", "inst-western-poly", "CS-301", "Design & Analysis of Algorithms", "BSCS", "batch-2k25-bscs", 3, "Theory", 3, 3, "inst-turing", 110, "Theory", '["Projector"]'),
        ("crs-cs302", "inst-western-poly", "CS-302", "Artificial Intelligence & Heuristics", "BSCS", "batch-2k25-bscs", 3, "Theory", 3, 3, "inst-lovelace", 110, "Theory", '["Projector"]'),
        ("crs-cs302l", "inst-western-poly", "CS-302L", "Artificial Intelligence Lab", "BSCS", "batch-2k25-bscs", 3, "Lab", 1, 3, "inst-lovelace", 110, "Lab", '["GPUWorkstations"]'),
        ("crs-se301", "inst-western-poly", "SE-301", "Software Architecture & Design", "BESE", "batch-2k24-bese", 5, "Theory", 3, 3, "inst-jehanzeb", 95, "Theory", '["Projector"]'),
        ("crs-se302", "inst-western-poly", "SE-302", "Operating Systems Internals", "BESE", "batch-2k24-bese", 5, "Theory", 3, 3, "inst-dijkstra", 95, "Theory", '["Projector"]'),
        ("crs-se302l", "inst-western-poly", "SE-302L", "Operating Systems Kernel Lab", "BESE", "batch-2k24-bese", 5, "Lab", 1, 3, "inst-dijkstra", 95, "Lab", '["Workstations"]'),
        ("crs-ee301", "inst-western-poly", "EE-301", "Power Systems & Smart Grids", "BEE", "batch-2k24-bee", 5, "Theory", 3, 3, "inst-tesla", 105, "Theory", '["Projector"]'),
        ("crs-ce201", "inst-western-poly", "CE-201", "Microprocessor & Embedded Systems", "BCE", "batch-2k25-bce", 3, "Theory", 3, 3, "inst-hopper", 90, "Theory", '["Projector"]'),
        ("crs-ce201l", "inst-western-poly", "CE-201L", "Embedded Systems Interfacing Lab", "BCE", "batch-2k25-bce", 3, "Lab", 1, 3, "inst-hopper", 90, "Lab", '["EmbeddedKits"]'),
    ]
    for c_id, u_id, code, title, dept, b_id, sem, ctype, ch, hpw, i_id, scnt, rtype, req_eq in courses:
        db_conn.execute(
            """
            INSERT OR IGNORE INTO courses (
              id, university_id, code, title, department_code, batch_id, semester,
              type, credit_hours, hours_per_week, instructor_id, student_count,
              required_room_type, required_equipment, sections_count, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            """,
            (c_id, u_id, code, title, dept, b_id, sem, ctype, ch, hpw, i_id, scnt, rtype, req_eq, current_iso),
        )

    db_conn.commit()


