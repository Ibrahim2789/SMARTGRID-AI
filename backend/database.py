"""
SmartGrid AI — Supabase PostgreSQL Seed Layer, Password Hashing (scrypt), and Token Signing
Pure Supabase PostgREST persistence (zero SQLite dependency).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.database.supabase import SupabaseQueryError, get_supabase_client

TOKEN_SECRET = os.environ.get("SMARTGRID_AUTH_SECRET", "smartgrid-institutional-secret-key-2026")


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
    """
    Idempotently seeds multi-university institutions, batches, users, BR assignments,
    polls, and academic catalog entities into Supabase PostgreSQL via PostgREST.
    """
    client = get_supabase_client()
    if client is None:
        print("[SmartGrid] Supabase credentials not configured; skipping startup seed.")
        return

    try:
        current_iso = now_iso()
        client.insert(
            "institutions",
            [
                {
                    "id": "inst-western-poly",
                    "name": "Western Polytechnic University",
                    "code": "WPU",
                    "campus_name": "Central Engineering & Computing Campus",
                    "accreditation": "ABET & Regional Higher Education Commission Accredited",
                    "academic_year": "2026–2027",
                    "current_term": "Fall Semester 2026",
                    "working_days": "Mon,Tue,Wed,Thu,Fri",
                    "day_start_time": "09:00",
                    "day_end_time": "17:00",
                    "period_length_minutes": 50,
                    "short_break_minutes": 10,
                    "midday_break_enabled": True,
                    "midday_break_start": "13:00",
                    "midday_break_duration": 60,
                    "lab_duration_minutes": 180,
                    "timezone": "UTC-5",
                    "is_sample": True,
                    "created_at": current_iso,
                },
                {
                    "id": "inst-apex-tech",
                    "name": "Apex Institute of Technology & Sciences",
                    "code": "AITS",
                    "campus_name": "North Innovation & Medical Robotics Campus",
                    "accreditation": "Global STEM & Autonomous Systems Accreditation Board",
                    "academic_year": "2026–2027",
                    "current_term": "Trimester I — 2026",
                    "working_days": "Mon,Tue,Wed,Thu,Fri,Sat",
                    "day_start_time": "08:30",
                    "day_end_time": "16:30",
                    "period_length_minutes": 60,
                    "short_break_minutes": 15,
                    "midday_break_enabled": True,
                    "midday_break_start": "12:30",
                    "midday_break_duration": 60,
                    "lab_duration_minutes": 120,
                    "timezone": "UTC+1",
                    "is_sample": True,
                    "created_at": current_iso,
                },
            ],
            ignore_duplicates=True,
            on_conflict="id",
        )

        _seed_initial_western_poly_data(client)
        _seed_apex_tech_data(client)
        _seed_academic_catalog(client)
    except SupabaseQueryError as err:
        if err.status_code in (401, 403):
            print(
                "[SmartGrid] Supabase RLS blocked initial seed (ensure SUPABASE_SERVICE_ROLE_KEY is active): "
                f"{err.message}"
            )
        else:
            print(f"[SmartGrid] Supabase seed warning ({err.status_code}): {err.message}")
    except Exception as exc:
        print(f"[SmartGrid] Supabase startup check warning: {exc}")


def _seed_initial_western_poly_data(client: Any) -> None:
    existing = client.select(
        "batches",
        filters={"institution_id": "eq.inst-western-poly"},
        select="id",
        limit=1,
    )
    if existing:
        return

    now = datetime.now(timezone.utc)
    two_days_ago = (now - timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    three_days_ago = (now - timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    in_five_days = (now + timedelta(days=5)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    batches = [
        ("batch-2k25-bscs", "2K25-BSCS", "BS Computer Science — Batch 2K25", "BSCS", 2, 3, 110),
        ("batch-2k24-bese", "2K24-BESE", "BE Software Engineering — Batch 2K24", "BESE", 3, 5, 95),
        ("batch-2k24-bee", "2K24-BEE", "BE Electrical Engineering — Batch 2K24", "BEE", 3, 5, 105),
        ("batch-2k25-bce", "2K25-BCE", "BE Computer Systems Engineering — Batch 2K25", "BCE", 2, 3, 90),
        ("batch-2k26-bscs", "2K26-BSCS", "BS Computer Science — Batch 2K26", "BSCS", 1, 1, 120),
    ]
    client.insert(
        "batches",
        [
            {
                "id": b_id,
                "code": code,
                "name": name,
                "department_code": dept,
                "year": yr,
                "semester": sem,
                "student_count": st_count,
                "institution_id": "inst-western-poly",
                "created_at": three_days_ago,
            }
            for b_id, code, name, dept, yr, sem, st_count in batches
        ],
        ignore_duplicates=True,
        on_conflict="id",
    )

    users_raw = [
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
    user_payloads: List[Dict[str, Any]] = []
    br_payloads: List[Dict[str, Any]] = []
    for u_id, name, email, pw, role, gender, batch_id, reg_no, sec in users_raw:
        user_payloads.append(
            {
                "id": u_id,
                "name": name,
                "email": email,
                "password_hash": hash_password(pw),
                "role": role,
                "gender": gender,
                "batch_id": batch_id,
                "registration_number": reg_no,
                "section": sec,
                "is_active": True,
                "must_reset_password": False,
                "credential_hint": pw,
                "institution": "Western Polytechnic",
                "institution_id": "inst-western-poly",
                "created_at": three_days_ago,
            }
        )
        if role == "br" and batch_id and gender:
            br_payloads.append(
                {
                    "id": f"assign-{u_id}",
                    "batch_id": batch_id,
                    "user_id": u_id,
                    "gender_role": gender,
                    "is_active": True,
                    "assigned_by": "Dr. Katherine Reynolds",
                    "assigned_at": three_days_ago,
                }
            )

    client.insert("users", user_payloads, ignore_duplicates=True, on_conflict="id")
    if br_payloads:
        client.insert("br_assignments", br_payloads, ignore_duplicates=True, on_conflict="id")

    client.insert(
        "polls",
        {
            "id": "poll-1-friday-labs",
            "title": "Preferred Continuous 3-Hour Lab Slot on Fridays",
            "description": (
                "To prevent Friday afternoon overlap with inter-departmental societies and Jummah prayers, "
                "which continuous 3-hour slot should the timetable engine prioritize for Friday laboratory sections?"
            ),
            "batch_id": "batch-2k25-bscs",
            "target_scope": "all_batches",
            "submitted_by_user_id": "user-br-male-2k25-bscs",
            "submitted_by_name": "Hamza Tariq (Male BR · 2K25-BSCS)",
            "br_gender_role": "male",
            "status": "Published",
            "rejection_reason": None,
            "result_visibility": "after_vote",
            "start_at": two_days_ago,
            "end_at": in_five_days,
            "published_at": two_days_ago,
            "closed_at": None,
            "institution_id": "inst-western-poly",
            "created_at": two_days_ago,
            "updated_at": two_days_ago,
        },
        ignore_duplicates=True,
        on_conflict="id",
    )
    client.insert(
        "poll_options",
        [
            {"id": "opt-p1-1", "poll_id": "poll-1-friday-labs", "label": "Morning Block (09:00 AM – 12:00 PM)", "sort_order": 1},
            {"id": "opt-p1-2", "poll_id": "poll-1-friday-labs", "label": "Post-Break Afternoon Block (02:00 PM – 05:00 PM)", "sort_order": 2},
            {"id": "opt-p1-3", "poll_id": "poll-1-friday-labs", "label": "Move Friday Labs to Thursday Afternoon where room capacity permits", "sort_order": 3},
        ],
        ignore_duplicates=True,
        on_conflict="id",
    )


def _seed_apex_tech_data(client: Any) -> None:
    existing = client.select(
        "batches",
        filters={"institution_id": "eq.inst-apex-tech"},
        select="id",
        limit=1,
    )
    if existing:
        return

    now = datetime.now(timezone.utc)
    current_iso = now_iso()
    one_day_ago = (now - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    in_five_days = (now + timedelta(days=5)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    client.insert(
        "batches",
        [
            {
                "id": "batch-apex-2k25-bme",
                "code": "2K25-BME",
                "name": "2K25 Biomedical & Robotics Cohort",
                "department_code": "BME",
                "year": 2025,
                "semester": 3,
                "student_count": 45,
                "institution_id": "inst-apex-tech",
                "created_at": current_iso,
            },
            {
                "id": "batch-apex-2k25-bsds",
                "code": "2K25-BSDS",
                "name": "2K25 Data Science & AI Cohort",
                "department_code": "BSDS",
                "year": 2025,
                "semester": 3,
                "student_count": 55,
                "institution_id": "inst-apex-tech",
                "created_at": current_iso,
            },
        ],
        ignore_duplicates=True,
        on_conflict="id",
    )

    apex_users = [
        ("user-apex-admin", "Dr. Arthur Vance", "admin@apextech.edu", "Admin@2026", "admin", "male", None, None, None),
        ("user-apex-vance", "Dr. Marcus Vance", "m.vance@apextech.edu", "Faculty@2026", "faculty", "male", None, None, None),
        ("user-apex-rostova", "Prof. Elena Rostova", "e.rostova@apextech.edu", "Faculty@2026", "faculty", "female", None, None, None),
        ("user-apex-br-liam", "Liam Chen", "br.male@apextech.edu", "BR@2026", "br", "male", "batch-apex-2k25-bme", "2K25-BME-002", "Section A"),
        ("user-apex-br-aria", "Aria Thorne", "br.female@apextech.edu", "BR@2026", "br", "female", "batch-apex-2k25-bsds", "2K25-BSDS-003", "Section A"),
        ("user-apex-student-alex", "Alex Rivera", "student.alex@apextech.edu", "Student@2026", "student", "male", "batch-apex-2k25-bme", "2K25-BME-001", "Section A"),
    ]
    client.insert(
        "users",
        [
            {
                "id": u_id,
                "name": name,
                "email": email,
                "password_hash": hash_password(pw),
                "role": role,
                "gender": gender,
                "batch_id": batch_id,
                "registration_number": reg_no,
                "section": sec,
                "is_active": True,
                "must_reset_password": False,
                "credential_hint": pw,
                "institution": "Apex Institute of Technology & Sciences",
                "institution_id": "inst-apex-tech",
                "created_at": current_iso,
            }
            for u_id, name, email, pw, role, gender, batch_id, reg_no, sec in apex_users
        ],
        ignore_duplicates=True,
        on_conflict="id",
    )

    client.insert(
        "br_assignments",
        [
            {
                "id": "assign-apex-liam",
                "batch_id": "batch-apex-2k25-bme",
                "user_id": "user-apex-br-liam",
                "gender_role": "male",
                "is_active": True,
                "assigned_by": "user-apex-admin",
                "assigned_at": current_iso,
            },
            {
                "id": "assign-apex-aria",
                "batch_id": "batch-apex-2k25-bsds",
                "user_id": "user-apex-br-aria",
                "gender_role": "female",
                "is_active": True,
                "assigned_by": "user-apex-admin",
                "assigned_at": current_iso,
            },
        ],
        ignore_duplicates=True,
        on_conflict="id",
    )

    client.insert(
        "polls",
        {
            "id": "poll-apex-gpu-lab",
            "title": "Extend Saturday High-Performance GPU Cluster Hours for Capstone AI",
            "description": (
                "Proposal to extend Ada-DS1 high-performance cluster access until 18:30 on Saturdays "
                "for senior robotics and machine learning research."
            ),
            "batch_id": "batch-apex-2k25-bsds",
            "target_scope": "all_batches",
            "submitted_by_user_id": "user-apex-br-aria",
            "submitted_by_name": "Aria Thorne",
            "br_gender_role": "female",
            "status": "Published",
            "result_visibility": "after_vote",
            "start_at": one_day_ago,
            "end_at": in_five_days,
            "published_at": one_day_ago,
            "institution_id": "inst-apex-tech",
            "created_at": one_day_ago,
            "updated_at": current_iso,
        },
        ignore_duplicates=True,
        on_conflict="id",
    )
    client.insert(
        "poll_options",
        [
            {"id": "opt-apex-gpu-1", "poll_id": "poll-apex-gpu-lab", "label": "Approve Saturday Extension to 18:30", "sort_order": 1},
            {"id": "opt-apex-gpu-2", "poll_id": "poll-apex-gpu-lab", "label": "Keep Standard 16:30 Saturday Close", "sort_order": 2},
        ],
        ignore_duplicates=True,
        on_conflict="id",
    )


def _seed_academic_catalog(client: Any) -> None:
    existing_courses = client.select(
        "courses",
        filters={"institution_id": "eq.inst-western-poly"},
        select="id",
        limit=1,
    )
    if existing_courses:
        return

    current_iso = now_iso()

    client.insert(
        "departments",
        [
            {
                "id": "dept-wpu-bscs",
                "institution_id": "inst-western-poly",
                "code": "BSCS",
                "name": "Department of Computer Science",
                "faculty_name": "Engineering & Computing",
                "head_of_department": "Prof. Alan Turing",
                "created_at": current_iso,
            },
            {
                "id": "dept-wpu-bese",
                "institution_id": "inst-western-poly",
                "code": "BESE",
                "name": "Department of Software Engineering",
                "faculty_name": "Engineering & Computing",
                "head_of_department": "Dr. Jehanzeb Ahmad",
                "created_at": current_iso,
            },
            {
                "id": "dept-wpu-bee",
                "institution_id": "inst-western-poly",
                "code": "BEE",
                "name": "Department of Electrical Engineering",
                "faculty_name": "Engineering & Computing",
                "head_of_department": "Dr. Nikola Tesla",
                "created_at": current_iso,
            },
            {
                "id": "dept-wpu-bce",
                "institution_id": "inst-western-poly",
                "code": "BCE",
                "name": "Department of Computer Systems Engineering",
                "faculty_name": "Engineering & Computing",
                "head_of_department": "Dr. Grace Hopper",
                "created_at": current_iso,
            },
        ],
        ignore_duplicates=True,
        on_conflict="id",
    )

    client.insert(
        "instructors",
        [
            {
                "id": "inst-turing",
                "institution_id": "inst-western-poly",
                "user_id": "user-faculty-turing",
                "department_id": "dept-wpu-bscs",
                "name": "Prof. Alan Turing",
                "email": "a.turing@westernpoly.edu",
                "designation": "Professor",
                "specializations": ["Algorithms & Artificial Intelligence"],
                "max_weekly_hours": 15,
                "max_daily_classes": 3,
                "created_at": current_iso,
            },
            {
                "id": "inst-jehanzeb",
                "institution_id": "inst-western-poly",
                "user_id": "user-faculty-jehanzeb",
                "department_id": "dept-wpu-bese",
                "name": "Dr. Jehanzeb Ahmad",
                "email": "jehanzeb.ahmad@westernpoly.edu",
                "designation": "Associate Professor",
                "specializations": ["Distributed Software Architecture"],
                "max_weekly_hours": 15,
                "max_daily_classes": 3,
                "created_at": current_iso,
            },
            {
                "id": "inst-hopper",
                "institution_id": "inst-western-poly",
                "user_id": None,
                "department_id": "dept-wpu-bce",
                "name": "Dr. Grace Hopper",
                "email": "g.hopper@westernpoly.edu",
                "designation": "Professor",
                "specializations": ["Compilers & Embedded Systems"],
                "max_weekly_hours": 15,
                "max_daily_classes": 3,
                "created_at": current_iso,
            },
            {
                "id": "inst-lovelace",
                "institution_id": "inst-western-poly",
                "user_id": None,
                "department_id": "dept-wpu-bscs",
                "name": "Dr. Ada Lovelace",
                "email": "a.lovelace@westernpoly.edu",
                "designation": "Assistant Professor",
                "specializations": ["Machine Learning & Data Science"],
                "max_weekly_hours": 15,
                "max_daily_classes": 3,
                "created_at": current_iso,
            },
            {
                "id": "inst-dijkstra",
                "institution_id": "inst-western-poly",
                "user_id": None,
                "department_id": "dept-wpu-bese",
                "name": "Prof. Edsger Dijkstra",
                "email": "e.dijkstra@westernpoly.edu",
                "designation": "Professor",
                "specializations": ["Formal Methods & Operating Systems"],
                "max_weekly_hours": 15,
                "max_daily_classes": 3,
                "created_at": current_iso,
            },
            {
                "id": "inst-tesla",
                "institution_id": "inst-western-poly",
                "user_id": None,
                "department_id": "dept-wpu-bee",
                "name": "Dr. Nikola Tesla",
                "email": "n.tesla@westernpoly.edu",
                "designation": "Professor",
                "specializations": ["Power Systems & Electromagnetics"],
                "max_weekly_hours": 15,
                "max_daily_classes": 3,
                "created_at": current_iso,
            },
        ],
        ignore_duplicates=True,
        on_conflict="id",
    )

    client.insert(
        "classrooms",
        [
            {
                "id": "room-lh-101",
                "institution_id": "inst-western-poly",
                "code": "LH-101",
                "name": "LH-101 (Turing Lecture Hall)",
                "building": "Computing Block A",
                "floor": 1,
                "room_type": "lecture",
                "capacity": 120,
                "is_available": True,
                "created_at": current_iso,
            },
            {
                "id": "room-lh-102",
                "institution_id": "inst-western-poly",
                "code": "LH-102",
                "name": "LH-102 (Shannon Hall)",
                "building": "Computing Block A",
                "floor": 1,
                "room_type": "lecture",
                "capacity": 110,
                "is_available": True,
                "created_at": current_iso,
            },
            {
                "id": "room-lh-201",
                "institution_id": "inst-western-poly",
                "code": "LH-201",
                "name": "LH-201 (Engineering Auditorium)",
                "building": "Engineering Block B",
                "floor": 2,
                "room_type": "auditorium",
                "capacity": 130,
                "is_available": True,
                "created_at": current_iso,
            },
            {
                "id": "room-lh-202",
                "institution_id": "inst-western-poly",
                "code": "LH-202",
                "name": "LH-202 (Systems Seminar Room)",
                "building": "Engineering Block B",
                "floor": 2,
                "room_type": "seminar",
                "capacity": 100,
                "is_available": True,
                "created_at": current_iso,
            },
        ],
        ignore_duplicates=True,
        on_conflict="id",
    )

    client.insert(
        "laboratories",
        [
            {
                "id": "room-lab-ai",
                "institution_id": "inst-western-poly",
                "department_id": "dept-wpu-bscs",
                "code": "LAB-301",
                "name": "LAB-301 (AI & GPU Computing Lab)",
                "building": "Computing Block A",
                "capacity": 120,
                "lab_category": "AI & GPU Computing",
                "is_available": True,
                "created_at": current_iso,
            },
            {
                "id": "room-lab-se",
                "institution_id": "inst-western-poly",
                "department_id": "dept-wpu-bese",
                "code": "LAB-302",
                "name": "LAB-302 (Software Systems Lab)",
                "building": "Computing Block A",
                "capacity": 110,
                "lab_category": "Software Systems",
                "is_available": True,
                "created_at": current_iso,
            },
            {
                "id": "room-lab-ee",
                "institution_id": "inst-western-poly",
                "department_id": "dept-wpu-bee",
                "code": "LAB-105",
                "name": "LAB-105 (Power & Embedded Lab)",
                "building": "Engineering Block B",
                "capacity": 115,
                "lab_category": "Power & Embedded",
                "is_available": True,
                "created_at": current_iso,
            },
        ],
        ignore_duplicates=True,
        on_conflict="id",
    )

    existing_equip = client.select(
        "room_equipment_capacities",
        filters={"institution_id": "eq.inst-western-poly"},
        select="id",
        limit=1,
    )
    if not existing_equip:
        equip_rows: List[Dict[str, Any]] = []
        for r_id, r_kind, items in [
            ("room-lh-101", "classroom", ["Projector", "SmartBoard", "AudioSystem"]),
            ("room-lh-102", "classroom", ["Projector", "SmartBoard"]),
            ("room-lh-201", "classroom", ["Projector", "AudioSystem"]),
            ("room-lh-202", "classroom", ["Projector", "Whiteboard"]),
            ("room-lab-ai", "laboratory", ["GPUWorkstations", "Projector", "LinuxCluster"]),
            ("room-lab-se", "laboratory", ["Workstations", "SmartBoard"]),
            ("room-lab-ee", "laboratory", ["Oscilloscopes", "EmbeddedKits", "Projector"]),
        ]:
            for item in items:
                equip_rows.append(
                    {
                        "institution_id": "inst-western-poly",
                        "room_id": r_id,
                        "room_kind": r_kind,
                        "equipment_name": item,
                        "quantity": 1,
                        "has_projector": "Projector" in items,
                        "has_smartboard": "SmartBoard" in items,
                        "has_high_performance_pcs": any("Workstation" in x or "Cluster" in x for x in items),
                    }
                )
        client.insert("room_equipment_capacities", equip_rows)

    courses_seed = [
        ("crs-cs301", "dept-wpu-bscs", "CS-301", "Design & Analysis of Algorithms", 3, 3, 0, ["Projector"], "batch-2k25-bscs", "inst-turing", "Theory", 110, "lecture", 50),
        ("crs-cs302", "dept-wpu-bscs", "CS-302", "Artificial Intelligence & Heuristics", 3, 3, 0, ["Projector"], "batch-2k25-bscs", "inst-lovelace", "Theory", 110, "lecture", 50),
        ("crs-cs302l", "dept-wpu-bscs", "CS-302L", "Artificial Intelligence Lab", 1, 0, 3, ["GPUWorkstations"], "batch-2k25-bscs", "inst-lovelace", "Lab", 110, "lab", 180),
        ("crs-se301", "dept-wpu-bese", "SE-301", "Software Architecture & Design", 3, 3, 0, ["Projector"], "batch-2k24-bese", "inst-jehanzeb", "Theory", 95, "lecture", 50),
        ("crs-se302", "dept-wpu-bese", "SE-302", "Operating Systems Internals", 3, 3, 0, ["Projector"], "batch-2k24-bese", "inst-dijkstra", "Theory", 95, "lecture", 50),
        ("crs-se302l", "dept-wpu-bese", "SE-302L", "Operating Systems Kernel Lab", 1, 0, 3, ["Workstations"], "batch-2k24-bese", "inst-dijkstra", "Lab", 95, "lab", 180),
        ("crs-ee301", "dept-wpu-bee", "EE-301", "Power Systems & Smart Grids", 3, 3, 0, ["Projector"], "batch-2k24-bee", "inst-tesla", "Theory", 105, "lecture", 50),
        ("crs-ce201", "dept-wpu-bce", "CE-201", "Microprocessor & Embedded Systems", 3, 3, 0, ["Projector"], "batch-2k25-bce", "inst-hopper", "Theory", 90, "lecture", 50),
        ("crs-ce201l", "dept-wpu-bce", "CE-201L", "Embedded Systems Interfacing Lab", 1, 0, 3, ["EmbeddedKits"], "batch-2k25-bce", "inst-hopper", "Lab", 90, "lab", 180),
    ]

    client.insert(
        "courses",
        [
            {
                "id": c_id,
                "institution_id": "inst-western-poly",
                "department_id": dept_id,
                "code": code,
                "title": title,
                "credit_hours": ch,
                "lecture_hours_per_week": lec_h,
                "lab_hours_per_week": lab_h,
                "is_compulsory": True,
                "required_equipment": req_eq,
                "created_at": current_iso,
            }
            for c_id, dept_id, code, title, ch, lec_h, lab_h, req_eq, *_ in courses_seed
        ],
        ignore_duplicates=True,
        on_conflict="id",
    )

    client.insert(
        "course_sessions",
        [
            {
                "id": f"sec-{c_id}-a",
                "institution_id": "inst-western-poly",
                "course_id": c_id,
                "instructor_id": inst_id,
                "batch_id": batch_id,
                "section_code": "A",
                "session_type": stype,
                "sessions_per_week": 1 if stype == "Lab" else 3,
                "duration_minutes": dur,
                "expected_students": scnt,
                "required_room_type": rtype,
                "required_equipment": req_eq,
                "created_at": current_iso,
            }
            for c_id, _dept_id, _code, _title, _ch, _lec_h, _lab_h, req_eq, batch_id, inst_id, stype, scnt, rtype, dur in courses_seed
        ],
        ignore_duplicates=True,
        on_conflict="id",
    )
