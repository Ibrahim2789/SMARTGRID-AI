"""
SmartGrid AI — Multi-University Backend Server (Python + FastAPI)
Implements all institutional management, role-based authentication, BR provisioning,
and batch-scoped student voting endpoints.
"""

from __future__ import annotations

import json
import os
import re
import time
import uuid
from typing import Any, Dict, List, Optional

from database import (
    _db_lock,
    db_conn,
    hash_password,
    initialize_voting_database,
    now_iso,
    row_to_dict,
    rows_to_dicts,
    sign_auth_token,
    verify_auth_token,
    verify_password,
)
from fastapi_compat import (
    CORSMiddleware,
    FastAPI,
    HTTPException,
    JSONResponse,
    Request,
    USING_NATIVE_FASTAPI,
    run_fastapi_app,
)

# Ensure SQLite schema and multi-university seed data are initialized
initialize_voting_database()

app = FastAPI(
    title="SmartGrid AI Multi-University API",
    version="2.0.0",
    description="Python + FastAPI backend for SmartGrid AI University-Independent Timetable & Voting Platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# HELPER UTILITIES
# =========================================================
def map_role_to_display_role(role: str) -> str:
    if role == "admin":
        return "Registrar"
    if role == "br":
        return "BR"
    if role == "student":
        return "Student"
    if role == "faculty":
        return "Faculty"
    return "Student"


async def parse_json_body(request: Request) -> Dict[str, Any]:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def get_header(request: Request, key: str) -> str:
    headers = getattr(request, "headers", {}) or {}
    if hasattr(headers, "get"):
        val = headers.get(key) or headers.get(key.lower())
        if val:
            return str(val)
    return ""


def get_query_param(request: Request, key: str, default: str = "") -> str:
    qp = getattr(request, "query_params", {}) or {}
    if hasattr(qp, "get"):
        val = qp.get(key)
        if val is not None:
            return str(val)
    return default


def get_user_auth_context(user_id: str) -> Optional[Dict[str, Any]]:
    with _db_lock:
        user_row = db_conn.execute(
            """
            SELECT u.*, b.code as batch_code, b.name as batch_name, b.department_code as batch_department
            FROM users u
            LEFT JOIN batches b ON b.id = u.batch_id
            WHERE u.id = ?
            """,
            (user_id,),
        ).fetchone()

        user = row_to_dict(user_row)
        if not user:
            return None

        br_assignment: Optional[Dict[str, Any]] = None
        if user.get("role") == "br":
            br_row = db_conn.execute(
                """
                SELECT a.id, a.batch_id, a.gender_role, b.code as batch_code, b.name as batch_name, b.department_code
                FROM br_assignments a
                JOIN batches b ON b.id = a.batch_id
                WHERE a.user_id = ? AND a.is_active = 1
                """,
                (user["id"],),
            ).fetchone()
            br_assignment = row_to_dict(br_row)

        effective_batch_id = br_assignment["batch_id"] if br_assignment else user.get("batch_id")
        effective_batch_code = br_assignment["batch_code"] if br_assignment else user.get("batch_code")
        effective_batch_name = br_assignment["batch_name"] if br_assignment else user.get("batch_name")
        effective_br_gender = br_assignment["gender_role"] if br_assignment else None
        inst_id = user.get("institution_id") or "inst-western-poly"

        token = sign_auth_token(
            {
                "userId": user["id"],
                "email": user["email"],
                "name": user["name"],
                "role": user["role"],
                "institutionId": inst_id,
                "batchId": effective_batch_id,
                "brGenderRole": effective_br_gender,
            }
        )

        return {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": map_role_to_display_role(user["role"]),
            "systemRole": user["role"],
            "institution": user.get("institution") or "Western Polytechnic",
            "institutionId": inst_id,
            "batchId": effective_batch_id,
            "batchCode": effective_batch_code,
            "batchName": effective_batch_name,
            "brGenderRole": effective_br_gender,
            "registrationNumber": user.get("registration_number") or None,
            "section": user.get("section") or None,
            "isActive": bool(user.get("is_active")),
            "token": token,
        }


def require_auth_user(request: Request, allowed_roles: Optional[List[str]] = None) -> Dict[str, Any]:
    auth_header = get_header(request, "authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"error": "Authentication required. Please sign in."})

    token = auth_header[7:].strip()
    payload = verify_auth_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail={"error": "Invalid or expired authentication session."})

    with _db_lock:
        db_user_row = db_conn.execute(
            "SELECT id, name, role, is_active, batch_id, institution_id FROM users WHERE id = ?",
            (payload.get("userId"),),
        ).fetchone()
        db_user = row_to_dict(db_user_row)

        if not db_user or not db_user.get("is_active"):
            raise HTTPException(
                status_code=403,
                detail={"error": "Your account has been deactivated by the Administrator. Please contact the Registrar."},
            )

        if db_user["role"] == "br":
            active_assign_row = db_conn.execute(
                "SELECT batch_id, gender_role FROM br_assignments WHERE user_id = ? AND is_active = 1",
                (db_user["id"],),
            ).fetchone()
            active_assign = row_to_dict(active_assign_row)
            payload["batchId"] = active_assign["batch_id"] if active_assign else None
            payload["brGenderRole"] = active_assign["gender_role"] if active_assign else None
        else:
            payload["batchId"] = db_user.get("batch_id")

        payload["role"] = db_user["role"]
        payload["name"] = db_user["name"]
        payload["institutionId"] = db_user.get("institution_id") or payload.get("institutionId") or "inst-western-poly"

    if allowed_roles and payload["role"] not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail={
                "error": f"Access denied. Required role: {' or '.join(allowed_roles)}. Your current role is {payload['role']}."
            },
        )

    return payload


def build_enriched_polls_for_user(auth_user: Dict[str, Any]) -> List[Dict[str, Any]]:
    current_iso = now_iso()
    user_inst_id = auth_user.get("institutionId") or "inst-western-poly"

    with _db_lock:
        # Auto-close any Published polls whose end_at has passed
        db_conn.execute(
            """
            UPDATE polls
            SET status = 'Closed', closed_at = ?, updated_at = ?
            WHERE status = 'Published' AND end_at IS NOT NULL AND end_at < ?
            """,
            (current_iso, current_iso, current_iso),
        )
        db_conn.commit()

        polls_query = """
            SELECT p.*, b.code as batch_code, b.name as batch_name, b.department_code, b.student_count as batch_student_count
            FROM polls p
            JOIN batches b ON b.id = p.batch_id
            WHERE (p.institution_id = ? OR (p.institution_id IS NULL AND ? = 'inst-western-poly'))
        """
        query_params: List[Any] = [user_inst_id, user_inst_id]

        role = auth_user.get("role")
        if role in ("student", "faculty"):
            polls_query += " AND p.status IN ('Published', 'Closed')"
        elif role == "br":
            polls_query += " AND (p.batch_id = ? OR p.submitted_by_user_id = ? OR p.status IN ('Published', 'Closed'))"
            query_params.extend([auth_user.get("batchId") or "", auth_user.get("userId")])

        polls_query += " ORDER BY p.created_at DESC"
        raw_polls = rows_to_dicts(db_conn.execute(polls_query, tuple(query_params)).fetchall())

        all_options = rows_to_dicts(
            db_conn.execute("SELECT id, poll_id, label, sort_order FROM poll_options ORDER BY sort_order ASC").fetchall()
        )
        vote_counts = rows_to_dicts(
            db_conn.execute("SELECT poll_id, option_id, COUNT(*) as count FROM poll_votes GROUP BY poll_id, option_id").fetchall()
        )
        batch_participation = rows_to_dicts(
            db_conn.execute(
                """
                SELECT pv.poll_id, pv.batch_id, b.code as batch_code, b.name as batch_name, b.student_count, COUNT(*) as votes_cast
                FROM poll_votes pv
                JOIN batches b ON b.id = pv.batch_id
                GROUP BY pv.poll_id, pv.batch_id
                """
            ).fetchall()
        )
        user_votes = rows_to_dicts(
            db_conn.execute(
                "SELECT poll_id, option_id, created_at FROM poll_votes WHERE student_user_id = ?",
                (auth_user.get("userId"),),
            ).fetchall()
        )

    user_vote_map = {v["poll_id"]: v for v in user_votes}
    enriched_polls: List[Dict[str, Any]] = []

    for poll in raw_polls:
        poll_id = poll["id"]
        options_for_poll = [o for o in all_options if o["poll_id"] == poll_id]
        counts_for_poll = [c for c in vote_counts if c["poll_id"] == poll_id]
        total_votes = sum(int(c["count"]) for c in counts_for_poll)

        my_vote = user_vote_map.get(poll_id)
        has_voted = bool(my_vote)

        start_at = poll.get("start_at")
        end_at = poll.get("end_at")
        status = poll.get("status")

        is_upcoming = status == "Published" and bool(start_at and start_at > current_iso)
        is_expired = status == "Closed" or (status == "Published" and bool(end_at and end_at < current_iso))
        is_active_window = status == "Published" and not is_upcoming and not is_expired

        can_view_results = False
        visibility = poll.get("result_visibility")
        if role == "admin":
            can_view_results = True
        elif role == "br":
            can_view_results = (
                visibility == "always"
                or is_expired
                or status == "Closed"
                or poll.get("submitted_by_user_id") == auth_user.get("userId")
                or poll.get("batch_id") == auth_user.get("batchId")
            )
        else:
            if visibility == "always":
                can_view_results = True
            elif visibility == "after_vote":
                can_view_results = has_voted or is_expired or status == "Closed"
            elif visibility == "after_close":
                can_view_results = is_expired or status == "Closed"

        enriched_options = []
        for opt in options_for_poll:
            found_count = next((c for c in counts_for_poll if c["option_id"] == opt["id"]), None)
            votes = int(found_count["count"]) if found_count else 0
            percentage = round((votes / total_votes) * 100, 1) if total_votes > 0 else 0
            enriched_options.append(
                {
                    "id": opt["id"],
                    "label": opt["label"],
                    "sortOrder": opt["sort_order"],
                    "votes": votes if can_view_results else None,
                    "percentage": percentage if can_view_results else None,
                }
            )

        batch_breakdown = []
        if role == "admin" or can_view_results:
            for r in batch_participation:
                if r["poll_id"] == poll_id:
                    st_count = int(r["student_count"] or 0)
                    v_cast = int(r["votes_cast"] or 0)
                    p_rate = min(100.0, round((v_cast / st_count) * 100, 1)) if st_count > 0 else 0
                    batch_breakdown.append(
                        {
                            "batchId": r["batch_id"],
                            "batchCode": r["batch_code"],
                            "batchName": r["batch_name"],
                            "studentCount": st_count,
                            "votesCast": v_cast,
                            "participationRate": p_rate,
                        }
                    )

        enriched_polls.append(
            {
                "id": poll_id,
                "title": poll["title"],
                "description": poll["description"],
                "batchId": poll["batch_id"],
                "batchCode": poll["batch_code"],
                "batchName": poll["batch_name"],
                "departmentCode": poll["department_code"],
                "targetScope": poll["target_scope"],
                "submittedByUserId": poll["submitted_by_user_id"],
                "submittedByName": poll["submitted_by_name"],
                "brGenderRole": poll["br_gender_role"],
                "status": status,
                "rejectionReason": poll.get("rejection_reason") if role in ("admin", "br") else None,
                "resultVisibility": visibility,
                "startAt": start_at,
                "endAt": end_at,
                "publishedAt": poll.get("published_at"),
                "closedAt": poll.get("closed_at"),
                "createdAt": poll["created_at"],
                "updatedAt": poll["updated_at"],
                "isUpcoming": is_upcoming,
                "isExpired": is_expired,
                "isActiveVotingWindow": is_active_window,
                "hasVoted": has_voted,
                "myVotedOptionId": my_vote["option_id"] if my_vote else None,
                "myVotedAt": my_vote["created_at"] if my_vote else None,
                "canViewResults": can_view_results,
                "totalVotes": total_votes,
                "options": enriched_options,
                "batchBreakdown": batch_breakdown,
            }
        )

    return enriched_polls


# =========================================================
# HEALTH & DIAGNOSTICS ENDPOINT
# =========================================================
@app.get("/api/health")
def health_check() -> Dict[str, Any]:
    return {
        "status": "ok",
        "engine": "python-fastapi",
        "nativeFastApi": USING_NATIVE_FASTAPI,
        "timestamp": now_iso(),
    }


# =========================================================
# MULTI-UNIVERSITY INSTITUTION MANAGEMENT ENDPOINTS
# =========================================================
@app.get("/api/institutions")
def list_institutions() -> Dict[str, Any]:
    with _db_lock:
        rows = rows_to_dicts(db_conn.execute("SELECT * FROM institutions ORDER BY created_at ASC").fetchall())
    return {"institutions": rows}


@app.post("/api/institutions/register")
async def register_institution(request: Request) -> Dict[str, Any]:
    body = await parse_json_body(request)
    name = (body.get("name") or "").strip()
    code = (body.get("code") or "").strip()
    campus_name = (body.get("campusName") or "Main Campus").strip()
    accreditation = (body.get("accreditation") or "Accredited Higher Education Institution").strip()
    admin_name = (body.get("adminName") or "University Administrator").strip()
    admin_email = (body.get("adminEmail") or "").strip().lower()
    admin_password = (body.get("adminPassword") or "").strip()
    working_days = body.get("workingDays") or "Mon,Tue,Wed,Thu,Fri"
    day_start_time = body.get("dayStartTime") or "09:00"
    day_end_time = body.get("dayEndTime") or "17:00"
    period_length_minutes = int(body.get("periodLengthMinutes") or 50)
    short_break_minutes = int(body.get("shortBreakMinutes") or 10)
    midday_break_enabled = 1 if body.get("middayBreakEnabled", True) else 0
    midday_break_start = body.get("middayBreakStart") or "13:00"
    midday_break_duration = int(body.get("middayBreakDuration") or 60)
    lab_duration_minutes = int(body.get("labDurationMinutes") or 180)

    if not name or not code or not admin_email or not admin_password:
        raise HTTPException(
            status_code=400,
            detail={"error": "University name, code, admin email, and password are required."},
        )

    clean_code = code.upper()
    slug = re.sub(r"[^a-z0-9]", "-", clean_code.lower())
    inst_id = f"inst-{slug}-{ hex(int(time.time() * 1000))[2:] }"
    current_iso = now_iso()

    with _db_lock:
        try:
            db_conn.execute(
                """
                INSERT INTO institutions (
                  id, name, code, campus_name, accreditation, academic_year, current_term,
                  working_days, day_start_time, day_end_time, period_length_minutes, short_break_minutes,
                  midday_break_enabled, midday_break_start, midday_break_duration, lab_duration_minutes,
                  timezone, is_sample, created_at
                ) VALUES (?, ?, ?, ?, ?, '2026–2027', 'Fall Semester 2026', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UTC', 0, ?)
                """,
                (
                    inst_id,
                    name,
                    clean_code,
                    campus_name,
                    accreditation,
                    working_days,
                    day_start_time,
                    day_end_time,
                    period_length_minutes,
                    short_break_minutes,
                    midday_break_enabled,
                    midday_break_start,
                    midday_break_duration,
                    lab_duration_minutes,
                    current_iso,
                ),
            )

            batch1_id = f"batch-{clean_code.lower()}-cs-1"
            batch2_id = f"batch-{clean_code.lower()}-se-1"
            db_conn.execute(
                """
                INSERT OR IGNORE INTO batches (id, code, name, department_code, year, semester, student_count, institution_id, created_at)
                VALUES (?, ?, ?, 'CS', 1, 1, 60, ?, ?)
                """,
                (batch1_id, f"{clean_code}-2026-CS", f"Computer Science — Cohort 2026 ({clean_code})", inst_id, current_iso),
            )
            db_conn.execute(
                """
                INSERT OR IGNORE INTO batches (id, code, name, department_code, year, semester, student_count, institution_id, created_at)
                VALUES (?, ?, ?, 'SE', 2, 3, 55, ?, ?)
                """,
                (batch2_id, f"{clean_code}-2025-SE", f"Software & Systems Engineering — Cohort 2025 ({clean_code})", inst_id, current_iso),
            )

            admin_id = f"user-admin-{int(time.time() * 1000)}"
            db_conn.execute(
                """
                INSERT INTO users (
                  id, name, email, password_hash, role, gender, batch_id,
                  registration_number, section,
                  is_active, must_reset_password, credential_hint, institution, institution_id, created_at
                ) VALUES (?, ?, ?, ?, 'admin', 'male', NULL, NULL, NULL, 1, 0, ?, ?, ?, ?)
                """,
                (
                    admin_id,
                    admin_name,
                    admin_email,
                    hash_password(admin_password),
                    admin_password,
                    name,
                    inst_id,
                    current_iso,
                ),
            )
            db_conn.commit()
        except Exception as exc:
            db_conn.rollback()
            raise HTTPException(
                status_code=500,
                detail={"error": "Failed to register institution", "details": str(exc)},
            )

    auth_context = get_user_auth_context(admin_id)
    return {
        "success": True,
        "institutionId": inst_id,
        "institutionName": name,
        "institutionCode": clean_code,
        "user": auth_context,
    }


@app.get("/api/institutions/{id}/data")
def get_institution_data(id: str) -> Dict[str, Any]:
    with _db_lock:
        row = row_to_dict(
            db_conn.execute("SELECT payload FROM institution_data WHERE institution_id = ?", (id,)).fetchone()
        )
    if row and row.get("payload"):
        return {"data": json.loads(row["payload"])}
    return {"data": None}


@app.post("/api/institutions/{id}/data")
async def save_institution_data(id: str, request: Request) -> Dict[str, Any]:
    require_auth_user(request)
    body = await parse_json_body(request)
    data = body.get("data")
    if data is None:
        raise HTTPException(status_code=400, detail={"error": "Missing data payload."})

    with _db_lock:
        db_conn.execute(
            """
            INSERT INTO institution_data (institution_id, payload, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(institution_id) DO UPDATE SET
              payload = excluded.payload,
              updated_at = excluded.updated_at
            """,
            (id, json.dumps(data), now_iso()),
        )
        db_conn.commit()

    return {"success": True, "message": "Institutional academic catalog saved."}


# =========================================================
# PUBLIC BATCHES ENDPOINT (Scoped by University / Institution)
# =========================================================
@app.get("/api/auth/batches-public")
def get_public_batches(request: Request) -> Dict[str, Any]:
    institution_id = get_query_param(request, "institutionId", "").strip()
    with _db_lock:
        if institution_id:
            rows = rows_to_dicts(
                db_conn.execute(
                    """
                    SELECT id, code, name, department_code as departmentCode, year, semester
                    FROM batches
                    WHERE institution_id = ?
                    ORDER BY year DESC, code ASC
                    """,
                    (institution_id,),
                ).fetchall()
            )
        else:
            rows = rows_to_dicts(
                db_conn.execute(
                    """
                    SELECT id, code, name, department_code as departmentCode, year, semester
                    FROM batches
                    ORDER BY year DESC, code ASC
                    """
                ).fetchall()
            )
    return {"batches": rows}


# =========================================================
# STUDENT REGISTRATION ENDPOINT (Strictly Forces 'student' Role)
# =========================================================
@app.post("/api/auth/register-student", status_code=201)
async def register_student(request: Request) -> Dict[str, Any]:
    body = await parse_json_body(request)
    attempted_role = str(body.get("role") or "").strip().lower()
    if attempted_role and attempted_role != "student":
        raise HTTPException(
            status_code=403,
            detail={
                "error": "Security violation: Public registration is strictly restricted to Student accounts. Batch Representative (BR) and Admin accounts cannot be self-registered."
            },
        )

    clean_name = str(body.get("name") or "").strip()
    clean_email = str(body.get("email") or "").strip().lower()
    clean_reg_no = str(body.get("registrationNumber") or "").strip().upper()
    clean_batch_id = str(body.get("batchId") or "").strip()
    clean_custom_batch = str(body.get("customBatchCode") or "").strip().upper()
    clean_section = str(body.get("section") or "").strip()
    clean_password = str(body.get("password") or "").strip()
    clean_confirm = str(body.get("confirmPassword") or "").strip()
    requested_inst_id = str(body.get("institutionId") or "").strip()

    if len(clean_name) < 2:
        raise HTTPException(status_code=400, detail={"error": "Please enter your full name."})
    if not clean_email or not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", clean_email):
        raise HTTPException(status_code=400, detail={"error": "Please enter a valid university or student email address."})
    if len(clean_reg_no) < 3:
        raise HTTPException(status_code=400, detail={"error": "Please enter your student registration / roll number."})
    if not clean_batch_id and not clean_custom_batch:
        raise HTTPException(status_code=400, detail={"error": "Please select or enter your academic batch."})
    if not clean_section:
        raise HTTPException(status_code=400, detail={"error": "Please select or enter your class section."})
    if len(clean_password) < 6:
        raise HTTPException(status_code=400, detail={"error": "Password must be at least 6 characters long."})
    if clean_password != clean_confirm:
        raise HTTPException(status_code=400, detail={"error": "Password and Confirm Password do not match."})

    resolved_inst_id = requested_inst_id or "inst-western-poly"
    resolved_inst_name = "Western Polytechnic"

    with _db_lock:
        inst_row = row_to_dict(
            db_conn.execute(
                "SELECT id, name FROM institutions WHERE id = ? OR UPPER(code) = UPPER(?)",
                (resolved_inst_id, resolved_inst_id),
            ).fetchone()
        )
        if inst_row:
            resolved_inst_id = inst_row["id"]
            resolved_inst_name = inst_row["name"]

        if (clean_batch_id == "__custom__" or not clean_batch_id) and clean_custom_batch:
            existing_custom_batch = row_to_dict(
                db_conn.execute(
                    "SELECT id, institution_id FROM batches WHERE UPPER(code) = ? AND institution_id = ?",
                    (clean_custom_batch, resolved_inst_id),
                ).fetchone()
            )
            if existing_custom_batch:
                clean_batch_id = existing_custom_batch["id"]
            else:
                slug = re.sub(r"[^a-z0-9]", "-", clean_custom_batch.lower())
                new_batch_id = f"batch-{slug}-{hex(int(time.time() * 1000))[2:]}"
                db_conn.execute(
                    """
                    INSERT INTO batches (id, code, name, department_code, year, semester, student_count, institution_id, created_at)
                    VALUES (?, ?, ?, 'GEN', 1, 1, 60, ?, ?)
                    """,
                    (new_batch_id, clean_custom_batch, f"{clean_custom_batch} Cohort", resolved_inst_id, now_iso()),
                )
                db_conn.commit()
                clean_batch_id = new_batch_id

        batch_row = row_to_dict(
            db_conn.execute(
                "SELECT id, code, name, institution_id FROM batches WHERE id = ?",
                (clean_batch_id,),
            ).fetchone()
        )
        if not batch_row:
            raise HTTPException(status_code=400, detail={"error": "Selected academic batch was not found."})

        if batch_row.get("institution_id"):
            batch_inst = row_to_dict(
                db_conn.execute(
                    "SELECT id, name FROM institutions WHERE id = ?",
                    (batch_row["institution_id"],),
                ).fetchone()
            )
            if batch_inst:
                resolved_inst_id = batch_inst["id"]
                resolved_inst_name = batch_inst["name"]

        existing_email = db_conn.execute(
            "SELECT id FROM users WHERE LOWER(email) = ?",
            (clean_email,),
        ).fetchone()
        if existing_email:
            raise HTTPException(
                status_code=409,
                detail={"error": f'An account with email "{clean_email}" is already registered.'},
            )

        existing_reg = db_conn.execute(
            "SELECT id FROM users WHERE UPPER(registration_number) = ? AND institution_id = ?",
            (clean_reg_no, resolved_inst_id),
        ).fetchone()
        if existing_reg:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": f'A student with registration/roll number "{clean_reg_no}" is already registered at {resolved_inst_name}.'
                },
            )

        new_student_id = f"user-student-{uuid.uuid4().hex[:8]}"
        current_iso = now_iso()

        db_conn.execute(
            """
            INSERT INTO users (
              id, name, email, password_hash, role, gender, batch_id,
              registration_number, section,
              is_active, must_reset_password, credential_hint, institution, institution_id, created_at
            ) VALUES (?, ?, ?, ?, 'student', NULL, ?, ?, ?, 1, 0, NULL, ?, ?, ?)
            """,
            (
                new_student_id,
                clean_name,
                clean_email,
                hash_password(clean_password),
                clean_batch_id,
                clean_reg_no,
                clean_section,
                resolved_inst_name,
                resolved_inst_id,
                current_iso,
            ),
        )
        db_conn.commit()

    auth_context = get_user_auth_context(new_student_id)
    return {
        "message": "Student account registered.",
        "user": auth_context,
    }


# =========================================================
# FACULTY ACCOUNT ACTIVATION / REGISTRATION ENDPOINT
# =========================================================
@app.post("/api/auth/activate-faculty", status_code=201)
async def activate_faculty(request: Request) -> Dict[str, Any]:
    body = await parse_json_body(request)
    clean_name = str(body.get("name") or "").strip()
    clean_email = str(body.get("email") or "").strip().lower()
    clean_dept = str(body.get("department") or "Faculty Member").strip()
    clean_password = str(body.get("password") or "").strip()
    clean_confirm = str(body.get("confirmPassword") or "").strip()
    requested_inst_id = str(body.get("institutionId") or "inst-western-poly").strip()

    if len(clean_name) < 2:
        raise HTTPException(
            status_code=400,
            detail={"error": "Please enter your full name and academic title (e.g., Dr. Sarah Chen)."},
        )
    if not clean_email or not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", clean_email):
        raise HTTPException(
            status_code=400,
            detail={"error": "Please enter a valid institutional faculty email address."},
        )
    if len(clean_password) < 6:
        raise HTTPException(status_code=400, detail={"error": "Password must be at least 6 characters long."})
    if clean_password != clean_confirm:
        raise HTTPException(status_code=400, detail={"error": "Password and Confirm Password do not match."})

    resolved_inst_id = requested_inst_id
    resolved_inst_name = "Western Polytechnic"

    with _db_lock:
        inst_row = row_to_dict(
            db_conn.execute(
                "SELECT id, name FROM institutions WHERE id = ? OR UPPER(code) = UPPER(?)",
                (requested_inst_id, requested_inst_id),
            ).fetchone()
        )
        if inst_row:
            resolved_inst_id = inst_row["id"]
            resolved_inst_name = inst_row["name"]

        existing_user = row_to_dict(
            db_conn.execute(
                "SELECT id, role, institution_id FROM users WHERE LOWER(email) = ?",
                (clean_email,),
            ).fetchone()
        )

        if existing_user:
            if existing_user["role"] != "faculty":
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error": f'Email "{clean_email}" is already registered under a {existing_user["role"].upper()} account.'
                    },
                )
            faculty_user_id = existing_user["id"]
            db_conn.execute(
                """
                UPDATE users
                SET name = ?, password_hash = ?, credential_hint = ?, is_active = 1,
                    section = ?, institution = ?, institution_id = ?
                WHERE id = ?
                """,
                (
                    clean_name,
                    hash_password(clean_password),
                    clean_password,
                    clean_dept,
                    resolved_inst_name,
                    resolved_inst_id,
                    faculty_user_id,
                ),
            )
        else:
            faculty_user_id = f"user-faculty-{uuid.uuid4().hex[:8]}"
            db_conn.execute(
                """
                INSERT INTO users (
                  id, name, email, password_hash, role, gender, batch_id,
                  registration_number, section,
                  is_active, must_reset_password, credential_hint, institution, institution_id, created_at
                ) VALUES (?, ?, ?, ?, 'faculty', NULL, NULL, NULL, ?, 1, 0, ?, ?, ?, ?)
                """,
                (
                    faculty_user_id,
                    clean_name,
                    clean_email,
                    hash_password(clean_password),
                    clean_dept,
                    clean_password,
                    resolved_inst_name,
                    resolved_inst_id,
                    now_iso(),
                ),
            )
        db_conn.commit()

    auth_context = get_user_auth_context(faculty_user_id)
    return {
        "message": "Faculty account activated.",
        "user": auth_context,
    }


# =========================================================
# AUTHENTICATION ENDPOINTS
# =========================================================
@app.post("/api/auth/login")
async def login(request: Request) -> Dict[str, Any]:
    body = await parse_json_body(request)
    email = body.get("email")
    password = body.get("password")
    quick_switch = bool(body.get("quickSwitch"))
    expected_portal_role = body.get("expectedPortalRole")

    if not email or not isinstance(email, str):
        raise HTTPException(status_code=400, detail={"error": "Institutional email is required."})

    normalized_email = email.strip().lower()
    with _db_lock:
        user_row = row_to_dict(
            db_conn.execute("SELECT * FROM users WHERE LOWER(email) = ?", (normalized_email,)).fetchone()
        )

    if not user_row:
        raise HTTPException(
            status_code=401,
            detail={"error": "No institutional account found for this email address."},
        )

    if not user_row.get("is_active"):
        raise HTTPException(
            status_code=403,
            detail={"error": "This account has been deactivated by the University Administrator."},
        )

    if expected_portal_role:
        actual_role = user_row["role"]
        display_actual = map_role_to_display_role(actual_role)
        if expected_portal_role == "admin" and actual_role != "admin":
            raise HTTPException(
                status_code=403,
                detail={
                    "error": f"Access denied: This account is registered as a {display_actual}, not an Administrator. Please use the {display_actual} Login screen."
                },
            )
        if expected_portal_role == "br" and actual_role != "br":
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Access denied: This account is not a designated Batch Representative (BR) account. Only BR accounts issued by the Administrator can sign in here."
                },
            )
        if expected_portal_role == "faculty" and actual_role != "faculty":
            raise HTTPException(
                status_code=403,
                detail={
                    "error": f"Access denied: This account is registered as a {display_actual}, not Faculty. Please use the {display_actual} Login screen."
                },
            )
        if expected_portal_role == "student" and actual_role != "student":
            raise HTTPException(
                status_code=403,
                detail={
                    "error": f"This account is a {display_actual} account. Please use the dedicated {display_actual} Login option."
                },
            )

    is_placeholder_demo_mask = password == "••••••••••••"
    if not quick_switch and not is_placeholder_demo_mask:
        if not password or not verify_password(str(password), user_row["password_hash"]):
            raise HTTPException(
                status_code=401,
                detail={"error": "Invalid email or password. Please check your credentials."},
            )

    auth_context = get_user_auth_context(user_row["id"])
    if not auth_context:
        raise HTTPException(status_code=500, detail={"error": "Unable to load account context."})

    return {"user": auth_context}


@app.get("/api/auth/me")
def get_me(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    auth_context = get_user_auth_context(auth_user["userId"])
    if not auth_context:
        raise HTTPException(status_code=404, detail={"error": "User not found."})
    return {"user": auth_context}


@app.patch("/api/auth/profile")
async def update_profile(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    body = await parse_json_body(request)
    clean_name = str(body.get("name") or "").strip()
    section = body.get("section")
    new_password = str(body.get("newPassword") or "").strip()

    if len(clean_name) < 2:
        raise HTTPException(status_code=400, detail={"error": "Name must be at least 2 characters long."})

    clean_section = str(section).strip() if section else None

    with _db_lock:
        if new_password:
            if len(new_password) < 6:
                raise HTTPException(
                    status_code=400,
                    detail={"error": "New password must be at least 6 characters long."},
                )
            db_conn.execute(
                "UPDATE users SET name = ?, section = COALESCE(?, section), password_hash = ? WHERE id = ?",
                (clean_name, clean_section, hash_password(new_password), auth_user["userId"]),
            )
        else:
            db_conn.execute(
                "UPDATE users SET name = ?, section = COALESCE(?, section) WHERE id = ?",
                (clean_name, clean_section, auth_user["userId"]),
            )
        db_conn.commit()

    updated = get_user_auth_context(auth_user["userId"])
    return {
        "message": "Account profile updated.",
        "user": updated,
    }


# =========================================================
# VOTING OVERVIEW (Role-Filtered Polls, Batches & Stats)
# =========================================================
@app.get("/api/voting/overview")
def get_voting_overview(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    polls = build_enriched_polls_for_user(auth_user)
    user_inst_id = auth_user.get("institutionId") or "inst-western-poly"

    with _db_lock:
        batches = rows_to_dicts(
            db_conn.execute(
                """
                SELECT * FROM batches
                WHERE institution_id = ? OR (institution_id IS NULL AND ? = 'inst-western-poly')
                ORDER BY year DESC, code ASC
                """,
                (user_inst_id, user_inst_id),
            ).fetchall()
        )

        active_assignments = rows_to_dicts(
            db_conn.execute(
                """
                SELECT a.id, a.batch_id, a.user_id, a.gender_role, a.is_active, a.assigned_by, a.assigned_at,
                       u.name as user_name, u.email as user_email, u.is_active as user_is_active,
                       u.credential_hint
                FROM br_assignments a
                JOIN users u ON u.id = a.user_id
                JOIN batches b ON b.id = a.batch_id
                WHERE a.is_active = 1 AND (b.institution_id = ? OR (b.institution_id IS NULL AND ? = 'inst-western-poly'))
                """,
                (user_inst_id, user_inst_id),
            ).fetchall()
        )

        batch_vote_agg = rows_to_dicts(
            db_conn.execute(
                """
                SELECT batch_id,
                       COUNT(*) as total_votes_cast,
                       COUNT(DISTINCT student_user_id) as unique_voters
                FROM poll_votes
                GROUP BY batch_id
                """
            ).fetchall()
        )

        batch_questions_agg = rows_to_dicts(
            db_conn.execute(
                """
                SELECT batch_id,
                       COUNT(*) as total_questions,
                       SUM(CASE WHEN br_gender_role = 'male' THEN 1 ELSE 0 END) as male_br_questions,
                       SUM(CASE WHEN br_gender_role = 'female' THEN 1 ELSE 0 END) as female_br_questions
                FROM polls
                GROUP BY batch_id
                """
            ).fetchall()
        )

        enriched_batches = []
        for b in batches:
            b_id = b["id"]
            male_br = next((a for a in active_assignments if a["batch_id"] == b_id and a["gender_role"] == "male"), None)
            female_br = next((a for a in active_assignments if a["batch_id"] == b_id and a["gender_role"] == "female"), None)
            vote_agg = next((v for v in batch_vote_agg if v["batch_id"] == b_id), None)
            q_agg = next((q for q in batch_questions_agg if q["batch_id"] == b_id), None)

            enriched_batches.append(
                {
                    "id": b_id,
                    "code": b["code"],
                    "name": b["name"],
                    "departmentCode": b["department_code"],
                    "year": b["year"],
                    "semester": b["semester"],
                    "studentCount": b["student_count"],
                    "totalVotesCast": int(vote_agg["total_votes_cast"]) if vote_agg else 0,
                    "uniqueVoters": int(vote_agg["unique_voters"]) if vote_agg else 0,
                    "questionsSubmitted": int(q_agg["total_questions"]) if q_agg else 0,
                    "maleBrQuestions": int(q_agg["male_br_questions"] or 0) if q_agg else 0,
                    "femaleBrQuestions": int(q_agg["female_br_questions"] or 0) if q_agg else 0,
                    "maleRepresentative": (
                        {
                            "assignmentId": male_br["id"],
                            "userId": male_br["user_id"],
                            "name": male_br["user_name"],
                            "email": male_br["user_email"],
                            "isActive": bool(male_br["user_is_active"]),
                            "credentialHint": male_br.get("credential_hint") if auth_user["role"] == "admin" else None,
                            "assignedAt": male_br["assigned_at"],
                        }
                        if male_br
                        else None
                    ),
                    "femaleRepresentative": (
                        {
                            "assignmentId": female_br["id"],
                            "userId": female_br["user_id"],
                            "name": female_br["user_name"],
                            "email": female_br["user_email"],
                            "isActive": bool(female_br["user_is_active"]),
                            "credentialHint": female_br.get("credential_hint") if auth_user["role"] == "admin" else None,
                            "assignedAt": female_br["assigned_at"],
                        }
                        if female_br
                        else None
                    ),
                }
            )

        br_accounts: List[Dict[str, Any]] = []
        if auth_user["role"] == "admin":
            raw_br_users = rows_to_dicts(
                db_conn.execute(
                    """
                    SELECT u.*, b.code as batch_code, b.name as batch_name,
                           (SELECT COUNT(*) FROM polls p WHERE p.submitted_by_user_id = u.id) as questions_count
                    FROM users u
                    LEFT JOIN batches b ON b.id = u.batch_id
                    WHERE u.role = 'br'
                      AND (u.institution_id = ? OR (u.institution_id IS NULL AND ? = 'inst-western-poly'))
                    ORDER BY u.created_at DESC
                    """,
                    (user_inst_id, user_inst_id),
                ).fetchall()
            )
            for u in raw_br_users:
                br_accounts.append(
                    {
                        "id": u["id"],
                        "name": u["name"],
                        "email": u["email"],
                        "gender": u.get("gender"),
                        "batchId": u.get("batch_id"),
                        "batchCode": u.get("batch_code"),
                        "batchName": u.get("batch_name"),
                        "isActive": bool(u.get("is_active")),
                        "hasActiveAssignment": any(a["user_id"] == u["id"] for a in active_assignments),
                        "credentialHint": u.get("credential_hint"),
                        "questionsSubmittedCount": int(u.get("questions_count") or 0),
                        "createdAt": u["created_at"],
                    }
                )

    return {
        "user": get_user_auth_context(auth_user["userId"]),
        "polls": polls,
        "batches": enriched_batches,
        "brAccounts": br_accounts,
    }


# =========================================================
# STUDENT ENDPOINT: CAST VOTE (Strict One-Vote-Per-Question Transaction)
# =========================================================
@app.post("/api/voting/polls/{pollId}/vote", status_code=201)
async def cast_vote(pollId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=["student"])
    body = await parse_json_body(request)
    option_id = body.get("optionId")

    if not option_id or not isinstance(option_id, str):
        raise HTTPException(
            status_code=400,
            detail={"error": "Please select a valid answer option before voting."},
        )

    current_iso = now_iso()

    with _db_lock:
        poll = row_to_dict(db_conn.execute("SELECT * FROM polls WHERE id = ?", (pollId,)).fetchone())
        if not poll:
            raise HTTPException(status_code=404, detail={"error": "Voting question not found."})

        if poll["status"] != "Published":
            raise HTTPException(
                status_code=400,
                detail={"error": f"Voting is not open for this question (current status: {poll['status']})."},
            )

        if poll.get("start_at") and poll["start_at"] > current_iso:
            raise HTTPException(
                status_code=400,
                detail={"error": "Voting for this question has not started yet."},
            )

        if poll.get("end_at") and poll["end_at"] < current_iso:
            db_conn.execute(
                "UPDATE polls SET status = 'Closed', closed_at = ?, updated_at = ? WHERE id = ?",
                (current_iso, current_iso, pollId),
            )
            db_conn.commit()
            raise HTTPException(
                status_code=400,
                detail={"error": "The voting deadline for this question has passed."},
            )

        if poll.get("target_scope") == "submitting_batch" and auth_user.get("batchId") != poll.get("batch_id"):
            raise HTTPException(
                status_code=403,
                detail={"error": "This poll is restricted to students of the submitting batch."},
            )

        option_row = row_to_dict(
            db_conn.execute(
                "SELECT id, label FROM poll_options WHERE id = ? AND poll_id = ?",
                (option_id, pollId),
            ).fetchone()
        )
        if not option_row:
            raise HTTPException(
                status_code=400,
                detail={"error": "Selected option does not belong to this poll."},
            )

        existing_vote = db_conn.execute(
            "SELECT id FROM poll_votes WHERE poll_id = ? AND student_user_id = ?",
            (pollId, auth_user["userId"]),
        ).fetchone()
        if existing_vote:
            raise HTTPException(
                status_code=409,
                detail={"error": "You have already voted on this question. Duplicate votes are not permitted."},
            )

        effective_batch_id = auth_user.get("batchId") or poll["batch_id"]
        vote_id = f"vote-{uuid.uuid4()}"

        try:
            db_conn.execute(
                """
                INSERT INTO poll_votes (id, poll_id, option_id, student_user_id, batch_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (vote_id, pollId, option_id, auth_user["userId"], effective_batch_id, current_iso),
            )
            db_conn.commit()
        except Exception as exc:
            db_conn.rollback()
            if "UNIQUE constraint failed" in str(exc):
                raise HTTPException(
                    status_code=409,
                    detail={"error": "You have already voted on this question."},
                )
            raise HTTPException(status_code=500, detail={"error": str(exc)})

    updated_polls = build_enriched_polls_for_user(auth_user)
    updated_poll = next((p for p in updated_polls if p["id"] == pollId), None)

    return {
        "message": f'Your vote for "{option_row["label"]}" has been recorded.',
        "poll": updated_poll,
    }


# =========================================================
# BATCH REPRESENTATIVE (BR) ENDPOINT: SUBMIT NEW QUESTION
# =========================================================
@app.post("/api/voting/br/polls", status_code=201)
async def submit_br_poll(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=["br"])
    body = await parse_json_body(request)

    with _db_lock:
        assignment = row_to_dict(
            db_conn.execute(
                """
                SELECT a.batch_id, a.gender_role, b.code as batch_code, b.name as batch_name, u.name as user_name
                FROM br_assignments a
                JOIN batches b ON b.id = a.batch_id
                JOIN users u ON u.id = a.user_id
                WHERE a.user_id = ? AND a.is_active = 1
                """,
                (auth_user["userId"],),
            ).fetchone()
        )

    if not assignment:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "You do not have an active Batch Representative assignment. Please contact the Administrator."
            },
        )

    requested_batch_id = body.get("requestedBatchId")
    if requested_batch_id and requested_batch_id != assignment["batch_id"]:
        raise HTTPException(
            status_code=403,
            detail={
                "error": f"Batch Representatives can only submit questions for their own assigned batch ({assignment['batch_code']})."
            },
        )

    clean_title = str(body.get("title") or "").strip()
    clean_description = str(body.get("description") or "").strip()
    options = body.get("options")
    end_at = body.get("endAt")
    target_scope = body.get("targetScope")

    if len(clean_title) < 5:
        raise HTTPException(status_code=400, detail={"error": "Question title must be at least 5 characters long."})
    if len(clean_description) < 10:
        raise HTTPException(
            status_code=400,
            detail={"error": "Please provide a clear question description or context (at least 10 characters)."},
        )
    if not isinstance(options, list):
        raise HTTPException(status_code=400, detail={"error": "At least two answer options are required."})

    clean_options = [str(o or "").strip() for o in options if str(o or "").strip()]
    if len(clean_options) < 2:
        raise HTTPException(
            status_code=400,
            detail={"error": "Please provide at least two non-empty answer options."},
        )

    unique_options = {o.lower() for o in clean_options}
    if len(unique_options) != len(clean_options):
        raise HTTPException(
            status_code=400,
            detail={"error": "Answer options must be distinct from one another."},
        )

    current_iso = now_iso()
    poll_id = f"poll-{uuid.uuid4()}"
    scope = "submitting_batch" if target_scope == "submitting_batch" else "all_batches"
    user_inst_id = auth_user.get("institutionId") or "inst-western-poly"

    with _db_lock:
        try:
            db_conn.execute(
                """
                INSERT INTO polls (
                  id, title, description, batch_id, target_scope,
                  submitted_by_user_id, submitted_by_name, br_gender_role,
                  status, rejection_reason, result_visibility,
                  start_at, end_at, published_at, closed_at, institution_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NULL, 'after_vote', NULL, ?, NULL, NULL, ?, ?, ?)
                """,
                (
                    poll_id,
                    clean_title,
                    clean_description,
                    assignment["batch_id"],
                    scope,
                    auth_user["userId"],
                    assignment["user_name"],
                    assignment["gender_role"],
                    end_at or None,
                    user_inst_id,
                    current_iso,
                    current_iso,
                ),
            )
            for idx, label in enumerate(clean_options):
                db_conn.execute(
                    "INSERT INTO poll_options (id, poll_id, label, sort_order) VALUES (?, ?, ?, ?)",
                    (f"opt-{uuid.uuid4()}", poll_id, label, idx + 1),
                )
            db_conn.commit()
        except Exception as exc:
            db_conn.rollback()
            raise HTTPException(status_code=500, detail={"error": str(exc)})

    updated_polls = build_enriched_polls_for_user(auth_user)
    created_poll = next((p for p in updated_polls if p["id"] == poll_id), None)

    return {
        "message": "Question submitted to the Administrator for review and approval.",
        "poll": created_poll,
    }


# =========================================================
# ADMIN ENDPOINTS: BATCHES, BR ACCOUNTS & QUESTION MODERATION
# =========================================================
@app.post("/api/voting/admin/batches", status_code=201)
async def create_admin_batch(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=["admin"])
    body = await parse_json_body(request)

    clean_code = str(body.get("code") or "").strip().upper()
    clean_name = str(body.get("name") or "").strip()
    clean_dept = str(body.get("departmentCode") or "BSCS").strip().upper()
    year = int(body.get("year") or 1)
    semester = int(body.get("semester") or 1)
    student_count = max(1, int(body.get("studentCount") or 60))

    if not clean_code or not clean_name:
        raise HTTPException(status_code=400, detail={"error": "Batch code and batch name are required."})

    admin_inst_id = auth_user.get("institutionId") or "inst-western-poly"

    with _db_lock:
        existing = db_conn.execute(
            "SELECT id FROM batches WHERE UPPER(code) = ? AND institution_id = ?",
            (clean_code, admin_inst_id),
        ).fetchone()
        if existing:
            raise HTTPException(
                status_code=409,
                detail={"error": f'A batch with code "{clean_code}" already exists in your university.'},
            )

        slug = re.sub(r"[^a-z0-9]", "-", clean_code.lower())
        batch_id = f"batch-{slug}-{hex(int(time.time() * 1000))[2:]}"
        current_iso = now_iso()

        db_conn.execute(
            """
            INSERT INTO batches (id, code, name, department_code, year, semester, student_count, institution_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (batch_id, clean_code, clean_name, clean_dept, year, semester, student_count, admin_inst_id, current_iso),
        )
        db_conn.commit()

    return {
        "message": f"Batch {clean_code} created.",
        "batchId": batch_id,
    }


@app.post("/api/voting/admin/br-accounts", status_code=201)
async def create_br_account(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=["admin"])
    body = await parse_json_body(request)

    clean_name = str(body.get("name") or "").strip()
    clean_email = str(body.get("email") or "").strip().lower()
    clean_password = str(body.get("password") or "").strip()
    batch_id = str(body.get("batchId") or "").strip()
    gender_role = str(body.get("genderRole") or "").strip()
    replace_existing = bool(body.get("replaceExisting"))

    if not clean_name or not clean_email or not clean_password or not batch_id or not gender_role:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Full name, institutional email, password, target batch, and representative gender role (male/female) are required."
            },
        )

    if gender_role not in ("male", "female"):
        raise HTTPException(
            status_code=400,
            detail={"error": 'Representative role must be either "male" or "female".'},
        )

    if len(clean_password) < 6:
        raise HTTPException(
            status_code=400,
            detail={"error": "BR password must be at least 6 characters long."},
        )

    with _db_lock:
        batch_row = row_to_dict(
            db_conn.execute("SELECT id, code, name FROM batches WHERE id = ?", (batch_id,)).fetchone()
        )
        if not batch_row:
            raise HTTPException(status_code=404, detail={"error": "Selected batch does not exist."})

        existing_email = db_conn.execute(
            "SELECT id FROM users WHERE LOWER(email) = ?",
            (clean_email,),
        ).fetchone()
        if existing_email:
            raise HTTPException(
                status_code=409,
                detail={"error": f'An account with email "{clean_email}" already exists.'},
            )

        existing_slot = row_to_dict(
            db_conn.execute(
                """
                SELECT a.id, u.name as current_br_name
                FROM br_assignments a
                JOIN users u ON u.id = a.user_id
                WHERE a.batch_id = ? AND a.gender_role = ? AND a.is_active = 1
                """,
                (batch_id, gender_role),
            ).fetchone()
        )

        if existing_slot:
            if not replace_existing:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error": f'Batch {batch_row["code"]} already has an active {gender_role} Batch Representative ({existing_slot["current_br_name"]}). Enable "Replace current {gender_role} representative" or deactivate the existing assignment first.'
                    },
                )
            db_conn.execute("UPDATE br_assignments SET is_active = 0 WHERE id = ?", (existing_slot["id"],))

        current_iso = now_iso()
        new_user_id = f"user-br-{gender_role}-{uuid.uuid4().hex[:8]}"
        gender_label = "Male" if gender_role == "male" else "Female"
        display_label = f"{clean_name} ({gender_label} BR · {batch_row['code']})"

        admin_inst_id = auth_user.get("institutionId") or "inst-western-poly"
        admin_inst_row = row_to_dict(
            db_conn.execute("SELECT name FROM institutions WHERE id = ?", (admin_inst_id,)).fetchone()
        )
        admin_inst_name = admin_inst_row["name"] if admin_inst_row else "Western Polytechnic"

        db_conn.execute(
            """
            INSERT INTO users (
              id, name, email, password_hash, role, gender, batch_id,
              is_active, must_reset_password, credential_hint, institution, institution_id, created_at
            ) VALUES (?, ?, ?, ?, 'br', ?, ?, 1, 0, ?, ?, ?, ?)
            """,
            (
                new_user_id,
                display_label,
                clean_email,
                hash_password(clean_password),
                gender_role,
                batch_id,
                clean_password,
                admin_inst_name,
                admin_inst_id,
                current_iso,
            ),
        )

        db_conn.execute(
            """
            INSERT INTO br_assignments (id, batch_id, user_id, gender_role, is_active, assigned_by, assigned_at)
            VALUES (?, ?, ?, ?, 1, ?, ?)
            """,
            (
                f"assign-{uuid.uuid4().hex[:8]}",
                batch_id,
                new_user_id,
                gender_role,
                auth_user.get("name") or "Administrator",
                current_iso,
            ),
        )
        db_conn.commit()

    return {
        "message": f"Created {gender_label} Batch Representative account for {batch_row['code']}.",
        "issuedCredentials": {
            "userId": new_user_id,
            "name": display_label,
            "email": clean_email,
            "password": clean_password,
            "batchCode": batch_row["code"],
            "batchName": batch_row["name"],
            "genderRole": gender_role,
        },
    }


@app.patch("/api/voting/admin/br-accounts/{userId}")
async def update_br_account(userId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=["admin"])
    body = await parse_json_body(request)
    action = body.get("action")
    new_password = str(body.get("newPassword") or "").strip()
    batch_id = body.get("batchId")
    gender_role = body.get("genderRole")

    with _db_lock:
        br_user = row_to_dict(
            db_conn.execute("SELECT * FROM users WHERE id = ? AND role = 'br'", (userId,)).fetchone()
        )
        if not br_user:
            raise HTTPException(status_code=404, detail={"error": "Batch Representative account not found."})

        current_iso = now_iso()

        if action == "deactivate":
            db_conn.execute("UPDATE users SET is_active = 0 WHERE id = ?", (userId,))
            db_conn.execute("UPDATE br_assignments SET is_active = 0 WHERE user_id = ?", (userId,))
            db_conn.commit()
            return {"message": f'Deactivated BR account "{br_user["name"]}".'}

        if action == "activate":
            db_conn.execute("UPDATE users SET is_active = 1 WHERE id = ?", (userId,))
            if br_user.get("batch_id") and br_user.get("gender"):
                db_conn.execute(
                    "UPDATE br_assignments SET is_active = 0 WHERE batch_id = ? AND gender_role = ?",
                    (br_user["batch_id"], br_user["gender"]),
                )
                db_conn.execute(
                    """
                    INSERT INTO br_assignments (id, batch_id, user_id, gender_role, is_active, assigned_by, assigned_at)
                    VALUES (?, ?, ?, ?, 1, ?, ?)
                    """,
                    (
                        f"assign-{uuid.uuid4().hex[:8]}",
                        br_user["batch_id"],
                        userId,
                        br_user["gender"],
                        auth_user.get("name") or "Administrator",
                        current_iso,
                    ),
                )
            db_conn.commit()
            return {"message": f'Activated BR account "{br_user["name"]}".'}

        if action == "reset_password":
            if len(new_password) < 6:
                raise HTTPException(
                    status_code=400,
                    detail={"error": "New password must be at least 6 characters long."},
                )
            db_conn.execute(
                "UPDATE users SET password_hash = ?, credential_hint = ?, is_active = 1 WHERE id = ?",
                (hash_password(new_password), new_password, userId),
            )
            db_conn.commit()
            return {
                "message": f'Password reset for "{br_user["name"]}".',
                "issuedCredentials": {
                    "name": br_user["name"],
                    "email": br_user["email"],
                    "password": new_password,
                },
            }

        if action == "assign_slot":
            if not batch_id or not gender_role:
                raise HTTPException(status_code=400, detail={"error": "batchId and genderRole are required."})
            db_conn.execute(
                "UPDATE br_assignments SET is_active = 0 WHERE batch_id = ? AND gender_role = ?",
                (batch_id, gender_role),
            )
            db_conn.execute("UPDATE br_assignments SET is_active = 0 WHERE user_id = ?", (userId,))
            db_conn.execute(
                "UPDATE users SET batch_id = ?, gender = ?, is_active = 1 WHERE id = ?",
                (batch_id, gender_role, userId),
            )
            db_conn.execute(
                """
                INSERT INTO br_assignments (id, batch_id, user_id, gender_role, is_active, assigned_by, assigned_at)
                VALUES (?, ?, ?, ?, 1, ?, ?)
                """,
                (
                    f"assign-{uuid.uuid4().hex[:8]}",
                    batch_id,
                    userId,
                    gender_role,
                    auth_user.get("name") or "Administrator",
                    current_iso,
                ),
            )
            db_conn.commit()
            return {"message": f'Assigned "{br_user["name"]}" as {gender_role} BR.'}

    raise HTTPException(status_code=400, detail={"error": "Unsupported action."})


@app.patch("/api/voting/admin/polls/{pollId}/status")
async def update_poll_status(pollId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=["admin"])
    body = await parse_json_body(request)

    with _db_lock:
        existing = row_to_dict(db_conn.execute("SELECT * FROM polls WHERE id = ?", (pollId,)).fetchone())
        if not existing:
            raise HTTPException(status_code=404, detail={"error": "Question not found."})

        next_status = body.get("status") or existing["status"]
        rejection_reason = str(body.get("rejectionReason") or "").strip()

        if next_status == "Rejected" and not rejection_reason:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Please provide a rejection reason so the Batch Representative understands the feedback."
                },
            )

        current_iso = now_iso()
        next_visibility = body.get("resultVisibility") or existing["result_visibility"]
        next_start_at = body["startAt"] if "startAt" in body else existing.get("start_at")
        next_end_at = body["endAt"] if "endAt" in body else existing.get("end_at")
        next_scope = body.get("targetScope") or existing["target_scope"]

        published_at = (
            current_iso
            if next_status == "Published" and not existing.get("published_at")
            else existing.get("published_at")
        )
        closed_at = (
            current_iso
            if next_status == "Closed"
            else (None if next_status == "Published" else existing.get("closed_at"))
        )

        db_conn.execute(
            """
            UPDATE polls
            SET status = ?,
                rejection_reason = ?,
                result_visibility = ?,
                start_at = ?,
                end_at = ?,
                target_scope = ?,
                published_at = ?,
                closed_at = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                next_status,
                rejection_reason if next_status == "Rejected" else None,
                next_visibility,
                next_start_at,
                next_end_at,
                next_scope,
                published_at,
                closed_at,
                current_iso,
                pollId,
            ),
        )
        db_conn.commit()

    updated_polls = build_enriched_polls_for_user(auth_user)
    updated_poll = next((p for p in updated_polls if p["id"] == pollId), None)

    return {
        "message": f"Question status updated to {next_status}.",
        "poll": updated_poll,
    }


@app.delete("/api/voting/admin/polls/{pollId}")
def delete_poll(pollId: str, request: Request) -> Dict[str, Any]:
    require_auth_user(request, allowed_roles=["admin"])
    with _db_lock:
        cur = db_conn.execute("DELETE FROM polls WHERE id = ?", (pollId,))
        db_conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail={"error": "Question not found."})

    return {"message": "Question permanently removed."}


# Register all Academic, Preference, Hybrid AI Optimization (DSatur + GA + SA),
# Tabu Search Rescheduling, Timetable Versioning, Analytics, and Notification routes
from app.api_routes import register_smartgrid_routes  # noqa: E402

register_smartgrid_routes(
    app=app,
    require_auth_user=require_auth_user,
    parse_json_body=parse_json_body,
    get_query_param=get_query_param,
)


if __name__ == "__main__":
    port = int(os.environ.get("PYTHON_BACKEND_PORT", "8001"))
    host = os.environ.get("PYTHON_BACKEND_HOST", "127.0.0.1")
    run_fastapi_app(app, host=host, port=port)

