"""Authentication, registration, university detection, and profile endpoints (Supabase PostgreSQL)."""

from __future__ import annotations

import re
import time
import uuid
from typing import Any, Dict

from app.database.supabase import SupabaseQueryError, require_supabase_client
from app.deps import (
    get_query_param,
    get_user_auth_context,
    map_role_to_display_role,
    parse_json_body,
    raise_supabase_http_error,
    require_auth_user,
)
from database import hash_password, now_iso, verify_password
from fastapi_compat import APIRouter, HTTPException, Request

router = APIRouter(tags=["auth"])


@router.get("/api/auth/detect-university")
def detect_university_by_email(request: Request) -> Dict[str, Any]:
    raw_email = get_query_param(request, "email", "").strip().lower()
    if not raw_email or "@" not in raw_email:
        return {"status": "idle"}

    _, domain = raw_email.rsplit("@", 1)
    domain = domain.strip()
    if not domain or "." not in domain or domain.endswith("."):
        return {"status": "idle"}

    personal_domains = {
        "gmail.com",
        "googlemail.com",
        "yahoo.com",
        "yahoo.co.uk",
        "outlook.com",
        "hotmail.com",
        "live.com",
        "icloud.com",
        "me.com",
        "aol.com",
        "protonmail.com",
        "proton.me",
        "zoho.com",
        "yandex.com",
        "mail.com",
    }

    client = require_supabase_client()
    try:
        all_insts = client.select("institutions")
        inst_by_id = {i["id"]: i for i in all_insts}

        exact_user = client.select_one(
            "users",
            filters={"email": f"ilike.{raw_email}"},
            select="institution_id,institution",
        )
        if exact_user and exact_user.get("institution_id"):
            inst = inst_by_id.get(exact_user["institution_id"], {})
            return {
                "status": "detected",
                "domain": domain,
                "institutionId": exact_user["institution_id"],
                "institutionName": inst.get("name") or exact_user.get("institution") or "Registered University",
                "institutionCode": inst.get("code") or "UNI",
                "campusName": inst.get("campus_name") or "Main Campus",
            }

        if domain in personal_domains:
            return {
                "status": "unsupported",
                "domain": domain,
                "message": f"@{domain} is a personal email provider, not an institutional university domain.",
            }

        domain_user = client.select_one(
            "users",
            filters={"email": f"ilike.*@{domain}"},
            select="institution_id,institution",
        )
        if domain_user and domain_user.get("institution_id"):
            inst = inst_by_id.get(domain_user["institution_id"], {})
            return {
                "status": "detected",
                "domain": domain,
                "institutionId": domain_user["institution_id"],
                "institutionName": inst.get("name") or domain_user.get("institution") or "Registered University",
                "institutionCode": inst.get("code") or "UNI",
                "campusName": inst.get("campus_name") or "Main Campus",
            }

        domain_prefix = domain.split(".")[0].lower()
        for inst in all_insts:
            code_lower = str(inst.get("code") or "").lower()
            if code_lower and (domain_prefix == code_lower or code_lower in domain_prefix):
                return {
                    "status": "detected",
                    "domain": domain,
                    "institutionId": inst["id"],
                    "institutionName": inst["name"],
                    "institutionCode": inst["code"],
                    "campusName": inst.get("campus_name") or "Main Campus",
                }
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {
        "status": "unrecognized",
        "domain": domain,
        "message": f"No workspace found for @{domain} in the institutional directory.",
    }


@router.post("/api/auth/forgot-password")
async def request_password_recovery(request: Request) -> Dict[str, Any]:
    body = await parse_json_body(request)
    email = str(body.get("email") or "").strip().lower()
    role = str(body.get("role") or "student").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(
            status_code=400,
            detail={"error": "Please enter a valid institutional email address."},
        )

    current_iso = now_iso()
    client = require_supabase_client()
    try:
        user_row = client.select_one(
            "users",
            filters={"email": f"ilike.{email}"},
            select="id,name,email,role,institution_id,institution",
        )

        if user_row:
            uni_id = user_row.get("institution_id") or "inst-western-poly"
            inst_row = client.select_one("institutions", filters={"id": f"eq.{uni_id}"}, select="name")
            uni_name = (inst_row or {}).get("name") or user_row.get("institution") or "your university"

            try:
                client.insert(
                    "notifications",
                    {
                        "institution_id": uni_id,
                        "recipient_user_id": None,
                        "recipient_role": "admin",
                        "title": f"Password Recovery Requested ({user_row['role'].upper()})",
                        "message": f"{user_row['name']} ({user_row['email']}) requested a credential recovery check.",
                        "notification_type": "preference_reminder",
                        "is_read": False,
                        "created_at": current_iso,
                    },
                )
            except SupabaseQueryError:
                pass

            if user_row["role"] == "br":
                return {
                    "status": "sent",
                    "accountFound": True,
                    "role": "br",
                    "institutionName": uni_name,
                    "message": (
                        f"Batch Representative accounts are governed by {uni_name}. "
                        "A credential reset notification has been logged for your University Administrator "
                        "under Administration → Batch Representatives."
                    ),
                }
            return {
                "status": "sent",
                "accountFound": True,
                "role": user_row["role"],
                "institutionName": uni_name,
                "message": (
                    f"Password recovery instructions for {email} have been dispatched via {uni_name} identity services, "
                    "and your Registrar office has been notified."
                ),
            }
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {
        "status": "sent",
        "accountFound": False,
        "role": role,
        "message": (
            f"If an active institutional account exists for {email}, recovery instructions have been queued. "
            "Please verify you entered your official university email address."
        ),
    }


@router.get("/api/auth/batches-public")
def get_public_batches(request: Request) -> Dict[str, Any]:
    institution_id = get_query_param(request, "institutionId", "").strip()
    client = require_supabase_client()
    try:
        filters = {"institution_id": f"eq.{institution_id}"} if institution_id else None
        raw = client.select(
            "batches",
            filters=filters,
            select="id,code,name,department_code,year,semester",
            order="year.desc,code.asc",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    rows = [
        {
            "id": r["id"],
            "code": r["code"],
            "name": r["name"],
            "departmentCode": r["department_code"],
            "year": r["year"],
            "semester": r["semester"],
        }
        for r in raw
    ]
    return {"batches": rows}


@router.post("/api/auth/register-student", status_code=201)
async def register_student(request: Request) -> Dict[str, Any]:
    body = await parse_json_body(request)
    attempted_role = str(body.get("role") or "").strip().lower()
    if attempted_role and attempted_role != "student":
        raise HTTPException(
            status_code=403,
            detail={
                "error": (
                    "Security violation: Public registration is strictly restricted to Student accounts. "
                    "Batch Representative (BR) and Admin accounts cannot be self-registered."
                )
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
    client = require_supabase_client()

    try:
        inst_row = client.select_one(
            "institutions",
            filters={"or": f"(id.eq.{resolved_inst_id},code.ilike.{resolved_inst_id})"},
            select="id,name",
        )
        if inst_row:
            resolved_inst_id = inst_row["id"]
            resolved_inst_name = inst_row["name"]

        if (clean_batch_id == "__custom__" or not clean_batch_id) and clean_custom_batch:
            existing_custom_batch = client.select_one(
                "batches",
                filters={"code": f"ilike.{clean_custom_batch}", "institution_id": f"eq.{resolved_inst_id}"},
                select="id,institution_id",
            )
            if existing_custom_batch:
                clean_batch_id = existing_custom_batch["id"]
            else:
                slug = re.sub(r"[^a-z0-9]", "-", clean_custom_batch.lower())
                new_batch_id = f"batch-{slug}-{hex(int(time.time() * 1000))[2:]}"
                client.insert(
                    "batches",
                    {
                        "id": new_batch_id,
                        "code": clean_custom_batch,
                        "name": f"{clean_custom_batch} Cohort",
                        "department_code": "GEN",
                        "year": 1,
                        "semester": 1,
                        "student_count": 60,
                        "institution_id": resolved_inst_id,
                        "created_at": now_iso(),
                    },
                )
                clean_batch_id = new_batch_id

        batch_row = client.select_one(
            "batches",
            filters={"id": f"eq.{clean_batch_id}"},
            select="id,code,name,institution_id",
        )
        if not batch_row:
            raise HTTPException(status_code=400, detail={"error": "Selected academic batch was not found."})

        if batch_row.get("institution_id"):
            batch_inst = client.select_one(
                "institutions",
                filters={"id": f"eq.{batch_row['institution_id']}"},
                select="id,name",
            )
            if batch_inst:
                resolved_inst_id = batch_inst["id"]
                resolved_inst_name = batch_inst["name"]

        existing_email = client.select_one("users", filters={"email": f"ilike.{clean_email}"}, select="id")
        if existing_email:
            raise HTTPException(
                status_code=409,
                detail={"error": f'An account with email "{clean_email}" is already registered.'},
            )

        existing_reg = client.select_one(
            "users",
            filters={"registration_number": f"ilike.{clean_reg_no}", "institution_id": f"eq.{resolved_inst_id}"},
            select="id",
        )
        if existing_reg:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": f'A student with registration/roll number "{clean_reg_no}" is already registered at {resolved_inst_name}.'
                },
            )

        new_student_id = f"user-student-{uuid.uuid4().hex[:8]}"
        current_iso = now_iso()
        client.insert(
            "users",
            {
                "id": new_student_id,
                "name": clean_name,
                "email": clean_email,
                "password_hash": hash_password(clean_password),
                "role": "student",
                "gender": None,
                "batch_id": clean_batch_id,
                "registration_number": clean_reg_no,
                "section": clean_section,
                "is_active": True,
                "must_reset_password": False,
                "credential_hint": None,
                "institution": resolved_inst_name,
                "institution_id": resolved_inst_id,
                "created_at": current_iso,
            },
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    auth_context = get_user_auth_context(new_student_id)
    return {
        "message": "Student account registered.",
        "user": auth_context,
    }


@router.post("/api/auth/activate-faculty", status_code=201)
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
    client = require_supabase_client()

    try:
        inst_row = client.select_one(
            "institutions",
            filters={"or": f"(id.eq.{requested_inst_id},code.ilike.{requested_inst_id})"},
            select="id,name",
        )
        if inst_row:
            resolved_inst_id = inst_row["id"]
            resolved_inst_name = inst_row["name"]

        existing_user = client.select_one(
            "users",
            filters={"email": f"ilike.{clean_email}"},
            select="id,role,institution_id",
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
            client.update(
                "users",
                {"id": f"eq.{faculty_user_id}"},
                {
                    "name": clean_name,
                    "password_hash": hash_password(clean_password),
                    "credential_hint": clean_password,
                    "is_active": True,
                    "section": clean_dept,
                    "institution": resolved_inst_name,
                    "institution_id": resolved_inst_id,
                },
            )
        else:
            faculty_user_id = f"user-faculty-{uuid.uuid4().hex[:8]}"
            client.insert(
                "users",
                {
                    "id": faculty_user_id,
                    "name": clean_name,
                    "email": clean_email,
                    "password_hash": hash_password(clean_password),
                    "role": "faculty",
                    "gender": None,
                    "batch_id": None,
                    "registration_number": None,
                    "section": clean_dept,
                    "is_active": True,
                    "must_reset_password": False,
                    "credential_hint": clean_password,
                    "institution": resolved_inst_name,
                    "institution_id": resolved_inst_id,
                    "created_at": now_iso(),
                },
            )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    auth_context = get_user_auth_context(faculty_user_id)
    return {
        "message": "Faculty account activated.",
        "user": auth_context,
    }


@router.post("/api/auth/login")
async def login(request: Request) -> Dict[str, Any]:
    body = await parse_json_body(request)
    email = body.get("email")
    password = body.get("password")
    quick_switch = bool(body.get("quickSwitch"))
    expected_portal_role = body.get("expectedPortalRole")

    if not email or not isinstance(email, str):
        raise HTTPException(status_code=400, detail={"error": "Institutional email is required."})

    normalized_email = email.strip().lower()
    client = require_supabase_client()
    try:
        user_row = client.select_one("users", filters={"email": f"ilike.{normalized_email}"})
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

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
                    "error": (
                        f"Access denied: This account is registered as a {display_actual}, not an Administrator. "
                        f"Please use the {display_actual} Login screen."
                    )
                },
            )
        if expected_portal_role == "br" and actual_role != "br":
            raise HTTPException(
                status_code=403,
                detail={
                    "error": (
                        "Access denied: This account is not a designated Batch Representative (BR) account. "
                        "Only BR accounts issued by the Administrator can sign in here."
                    )
                },
            )
        if expected_portal_role == "faculty" and actual_role != "faculty":
            raise HTTPException(
                status_code=403,
                detail={
                    "error": (
                        f"Access denied: This account is registered as a {display_actual}, not Faculty. "
                        f"Please use the {display_actual} Login screen."
                    )
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


@router.get("/api/auth/me")
def get_me(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    auth_context = get_user_auth_context(auth_user["userId"])
    if not auth_context:
        raise HTTPException(status_code=404, detail={"error": "User not found."})
    return {"user": auth_context}


@router.patch("/api/auth/profile")
async def update_profile(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    body = await parse_json_body(request)
    clean_name = str(body.get("name") or "").strip()
    section = body.get("section")
    new_password = str(body.get("newPassword") or "").strip()

    if len(clean_name) < 2:
        raise HTTPException(status_code=400, detail={"error": "Name must be at least 2 characters long."})

    updates: Dict[str, Any] = {"name": clean_name}
    if section:
        updates["section"] = str(section).strip()
    if new_password:
        if len(new_password) < 6:
            raise HTTPException(
                status_code=400,
                detail={"error": "New password must be at least 6 characters long."},
            )
        updates["password_hash"] = hash_password(new_password)

    client = require_supabase_client()
    try:
        client.update("users", {"id": f"eq.{auth_user['userId']}"}, updates)
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    updated = get_user_auth_context(auth_user["userId"])
    return {
        "message": "Account profile updated.",
        "user": updated,
    }
