"""Batch-scoped voting, BR question submissions, community schedule proposals, and Admin BR/poll governance endpoints (Supabase PostgreSQL)."""

from __future__ import annotations

import re
import time
import uuid
from collections import defaultdict
from typing import Any, Dict, List, Set

from app.database.supabase import SupabaseQueryError, require_supabase_client
from app.deps import (
    ADMIN_ROLES,
    CATALOG_MANAGER_ROLES,
    assert_institution_access,
    build_enriched_polls_for_user,
    get_query_param,
    get_user_auth_context,
    is_missing_table_error,
    parse_json_body,
    raise_supabase_http_error,
    require_auth_user,
    safe_json_loads,
    scoped_uni_id,
    write_audit_log,
)
import json
from database import hash_password, now_iso
from fastapi_compat import APIRouter, HTTPException, Request

router = APIRouter(tags=["voting"])


@router.get("/api/voting/overview")
def get_voting_overview(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    polls = build_enriched_polls_for_user(auth_user)
    user_inst_id = auth_user.get("institutionId") or ""
    client = require_supabase_client()
    is_admin = auth_user.get("role") in ADMIN_ROLES

    try:
        batches = client.select(
            "batches",
            filters={"institution_id": f"eq.{user_inst_id}"},
            order="year.desc,code.asc",
        )
        batch_ids = [b["id"] for b in batches]
        batch_id_set = set(batch_ids)

        active_assignments: List[Dict[str, Any]] = []
        all_users: List[Dict[str, Any]] = []
        if batch_ids:
            raw_assigns = client.select(
                "br_assignments",
                filters={"is_active": "eq.true", "batch_id": f"in.({','.join(batch_ids)})"},
            )
            all_users = client.select(
                "users",
                filters={"institution_id": f"eq.{user_inst_id}"},
                order="created_at.desc",
            )
            user_by_id = {u["id"]: u for u in all_users}
            for a in raw_assigns:
                u = user_by_id.get(a["user_id"], {})
                active_assignments.append(
                    {
                        **a,
                        "user_name": u.get("name") or "",
                        "user_email": u.get("email") or "",
                        "user_is_active": bool(u.get("is_active", True)),
                        "credential_hint": u.get("credential_hint"),
                    }
                )
        elif is_admin:
            all_users = client.select(
                "users",
                filters={"institution_id": f"eq.{user_inst_id}"},
                order="created_at.desc",
            )

        inst_polls = client.select(
            "polls",
            filters={"institution_id": f"eq.{user_inst_id}"},
            select="id,batch_id,br_gender_role,submitted_by_user_id",
        )
        all_votes = (
            client.select(
                "poll_votes",
                filters={"batch_id": f"in.({','.join(batch_ids)})"},
                select="batch_id,student_user_id",
            )
            if batch_ids
            else []
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    votes_per_batch: Dict[str, int] = defaultdict(int)
    voters_per_batch: Dict[str, Set[str]] = defaultdict(set)
    for v in all_votes:
        b_id = v["batch_id"]
        votes_per_batch[b_id] += 1
        if v.get("student_user_id"):
            voters_per_batch[b_id].add(v["student_user_id"])

    q_total: Dict[str, int] = defaultdict(int)
    q_male: Dict[str, int] = defaultdict(int)
    q_female: Dict[str, int] = defaultdict(int)
    q_by_user: Dict[str, int] = defaultdict(int)
    for p in inst_polls:
        b_id = p.get("batch_id")
        if b_id in batch_id_set:
            q_total[b_id] += 1
            if p.get("br_gender_role") == "male":
                q_male[b_id] += 1
            elif p.get("br_gender_role") == "female":
                q_female[b_id] += 1
        if p.get("submitted_by_user_id"):
            q_by_user[p["submitted_by_user_id"]] += 1

    enriched_batches = []
    for b in batches:
        b_id = b["id"]
        male_br = next((a for a in active_assignments if a["batch_id"] == b_id and a["gender_role"] == "male"), None)
        female_br = next((a for a in active_assignments if a["batch_id"] == b_id and a["gender_role"] == "female"), None)

        enriched_batches.append(
            {
                "id": b_id,
                "code": b["code"],
                "name": b["name"],
                "departmentCode": b["department_code"],
                "year": b["year"],
                "semester": b["semester"],
                "studentCount": b["student_count"],
                "totalVotesCast": votes_per_batch.get(b_id, 0),
                "uniqueVoters": len(voters_per_batch.get(b_id, set())),
                "questionsSubmitted": q_total.get(b_id, 0),
                "maleBrQuestions": q_male.get(b_id, 0),
                "femaleBrQuestions": q_female.get(b_id, 0),
                "maleRepresentative": (
                    {
                        "assignmentId": male_br["id"],
                        "userId": male_br["user_id"],
                        "name": male_br["user_name"],
                        "email": male_br["user_email"],
                        "isActive": bool(male_br["user_is_active"]),
                        "credentialHint": male_br.get("credential_hint") if is_admin else None,
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
                        "credentialHint": female_br.get("credential_hint") if is_admin else None,
                        "assignedAt": female_br["assigned_at"],
                    }
                    if female_br
                    else None
                ),
            }
        )

    br_accounts: List[Dict[str, Any]] = []
    if is_admin:
        batch_by_id = {b["id"]: b for b in batches}
        for u in all_users:
            if u.get("role") != "br":
                continue
            b_obj = batch_by_id.get(u.get("batch_id") or "", {})
            br_accounts.append(
                {
                    "id": u["id"],
                    "name": u["name"],
                    "email": u["email"],
                    "gender": u.get("gender"),
                    "batchId": u.get("batch_id"),
                    "batchCode": b_obj.get("code"),
                    "batchName": b_obj.get("name"),
                    "isActive": bool(u.get("is_active")),
                    "hasActiveAssignment": any(a["user_id"] == u["id"] for a in active_assignments),
                    "credentialHint": u.get("credential_hint"),
                    "questionsSubmittedCount": q_by_user.get(u["id"], 0),
                    "createdAt": u["created_at"],
                }
            )

    return {
        "user": get_user_auth_context(auth_user["userId"]),
        "polls": polls,
        "batches": enriched_batches,
        "brAccounts": br_accounts,
    }


@router.post("/api/voting/polls/{pollId}/vote", status_code=201)
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
    client = require_supabase_client()

    try:
        poll = client.select_one("polls", filters={"id": f"eq.{pollId}"})
        if not poll:
            raise HTTPException(status_code=404, detail={"error": "Voting question not found."})
        assert_institution_access(auth_user, poll.get("institution_id"))

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
            client.update(
                "polls",
                {"id": f"eq.{pollId}"},
                {"status": "Closed", "closed_at": current_iso, "updated_at": current_iso},
            )
            raise HTTPException(
                status_code=400,
                detail={"error": "The voting deadline for this question has passed."},
            )

        if poll.get("target_scope") == "submitting_batch" and auth_user.get("batchId") != poll.get("batch_id"):
            raise HTTPException(
                status_code=403,
                detail={"error": "This poll is restricted to students of the submitting batch."},
            )
        if poll.get("target_scope") == "selected_batches":
            allowed_batches = safe_json_loads(poll.get("target_batch_ids"), [])
            if allowed_batches and auth_user.get("batchId") not in allowed_batches:
                raise HTTPException(
                    status_code=403,
                    detail={"error": "This poll is restricted to selected batches."},
                )

        option_row = client.select_one(
            "poll_options",
            filters={"id": f"eq.{option_id}", "poll_id": f"eq.{pollId}"},
            select="id,label",
        )
        if not option_row:
            raise HTTPException(
                status_code=400,
                detail={"error": "Selected option does not belong to this poll."},
            )

        existing_vote = client.select_one(
            "poll_votes",
            filters={"poll_id": f"eq.{pollId}", "student_user_id": f"eq.{auth_user['userId']}"},
            select="id",
        )
        if existing_vote:
            raise HTTPException(
                status_code=409,
                detail={"error": "You have already voted on this question. Duplicate votes are not permitted."},
            )

        effective_batch_id = auth_user.get("batchId") or poll["batch_id"]
        vote_id = f"vote-{uuid.uuid4()}"

        try:
            client.insert(
                "poll_votes",
                {
                    "id": vote_id,
                    "poll_id": pollId,
                    "option_id": option_id,
                    "student_user_id": auth_user["userId"],
                    "batch_id": effective_batch_id,
                    "created_at": current_iso,
                },
            )
        except SupabaseQueryError as exc:
            if exc.status_code == 409 or "duplicate" in exc.message.lower() or "unique" in exc.message.lower():
                raise HTTPException(
                    status_code=409,
                    detail={"error": "You have already voted on this question."},
                )
            raise
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    updated_polls = build_enriched_polls_for_user(auth_user)
    updated_poll = next((p for p in updated_polls if p["id"] == pollId), None)

    return {
        "message": f'Your vote for "{option_row["label"]}" has been recorded.',
        "poll": updated_poll,
    }


@router.post("/api/voting/br/polls", status_code=201)
async def submit_br_poll(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=["br"])
    body = await parse_json_body(request)
    client = require_supabase_client()

    try:
        assign_row = client.select_one(
            "br_assignments",
            filters={"user_id": f"eq.{auth_user['userId']}", "is_active": "eq.true"},
            select="batch_id,gender_role,user_id",
        )
        if not assign_row:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "You do not have an active Batch Representative assignment. Please contact the Administrator."
                },
            )
        batch_row = client.select_one("batches", filters={"id": f"eq.{assign_row['batch_id']}"}, select="code,name,institution_id")
        if batch_row:
            assert_institution_access(auth_user, batch_row.get("institution_id"))
        user_row = client.select_one("users", filters={"id": f"eq.{auth_user['userId']}"}, select="name")
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    assignment = {
        "batch_id": assign_row["batch_id"],
        "gender_role": assign_row["gender_role"],
        "batch_code": (batch_row or {}).get("code") or assign_row["batch_id"],
        "batch_name": (batch_row or {}).get("name") or "",
        "user_name": (user_row or {}).get("name") or auth_user.get("name") or "BR",
    }

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
    has_poll_ext = getattr(client, "has_column", lambda t, c: True)("polls", "optimizer_approval_status")
    scope = (
        "submitting_batch"
        if target_scope == "submitting_batch"
        else ("selected_batches" if (target_scope == "selected_batches" and has_poll_ext) else "all_batches")
    )
    user_inst_id = auth_user.get("institutionId") or ""

    from app.optimization.preference_aggregator import ALLOWED_POLL_CATEGORIES
    raw_cat = str(body.get("pollCategory") or body.get("poll_category") or "general_suggestion").strip().lower()
    if raw_cat not in ALLOWED_POLL_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail={"error": f"Invalid poll category '{raw_cat}'. Allowed: {', '.join(sorted(ALLOWED_POLL_CATEGORIES))}."},
        )
    target_batch_ids = body.get("targetBatchIds") if isinstance(body.get("targetBatchIds"), list) else []

    poll_row = {
        "id": poll_id,
        "title": clean_title,
        "description": clean_description,
        "batch_id": assignment["batch_id"],
        "target_scope": scope,
        "target_batch_ids": target_batch_ids,
        "poll_category": raw_cat,
        "optimizer_approval_status": "pending_review",
        "submitted_by_user_id": auth_user["userId"],
        "submitted_by_name": assignment["user_name"],
        "br_gender_role": assignment["gender_role"],
        "status": "Pending",
        "rejection_reason": None,
        "result_visibility": "after_vote",
        "start_at": None,
        "end_at": end_at or None,
        "published_at": None,
        "closed_at": None,
        "institution_id": user_inst_id,
        "created_at": current_iso,
        "updated_at": current_iso,
    }

    try:
        client.insert("polls", poll_row)
        client.insert(
            "poll_options",
            [
                {
                    "id": f"opt-{uuid.uuid4()}",
                    "poll_id": poll_id,
                    "label": label,
                    "sort_order": idx + 1,
                }
                for idx, label in enumerate(clean_options)
            ],
        )
        if not has_poll_ext:
            client.insert(
                "feedback",
                {
                    "id": str(uuid.uuid4()),
                    "institution_id": user_inst_id,
                    "user_id": auth_user["userId"],
                    "category": f"poll_meta:{poll_id}",
                    "rating": 5,
                    "comment": json.dumps(
                        {
                            "poll_id": poll_id,
                            "poll_category": raw_cat,
                            "target_batch_ids": target_batch_ids,
                            "target_scope": target_scope or scope,
                            "optimizer_approval_status": "pending_review",
                        }
                    ),
                    "created_at": current_iso,
                },
            )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    updated_polls = build_enriched_polls_for_user(auth_user)
    created_poll = next((p for p in updated_polls if p["id"] == poll_id), None)

    return {
        "message": "Question submitted to the Administrator for review and approval.",
        "poll": created_poll,
    }


@router.post("/api/voting/admin/batches", status_code=201)
async def create_admin_batch(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=ADMIN_ROLES)
    body = await parse_json_body(request)

    clean_code = str(body.get("code") or "").strip().upper()
    clean_name = str(body.get("name") or "").strip()
    clean_dept = str(body.get("departmentCode") or "BSCS").strip().upper()
    year = int(body.get("year") or 1)
    semester = int(body.get("semester") or 1)
    student_count = max(1, int(body.get("studentCount") or 60))

    if not clean_code or not clean_name:
        raise HTTPException(status_code=400, detail={"error": "Batch code and batch name are required."})

    admin_inst_id = auth_user.get("institutionId") or ""
    client = require_supabase_client()

    try:
        existing = client.select_one(
            "batches",
            filters={"code": f"ilike.{clean_code}", "institution_id": f"eq.{admin_inst_id}"},
            select="id",
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail={"error": f'A batch with code "{clean_code}" already exists in your university.'},
            )

        slug = re.sub(r"[^a-z0-9]", "-", clean_code.lower())
        batch_id = f"batch-{slug}-{hex(int(time.time() * 1000))[2:]}"
        current_iso = now_iso()

        client.insert(
            "batches",
            {
                "id": batch_id,
                "code": clean_code,
                "name": clean_name,
                "department_code": clean_dept,
                "year": year,
                "semester": semester,
                "student_count": student_count,
                "institution_id": admin_inst_id,
                "created_at": current_iso,
            },
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {
        "message": f"Batch {clean_code} created.",
        "batchId": batch_id,
    }


@router.post("/api/voting/admin/br-accounts", status_code=201)
async def create_br_account(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=ADMIN_ROLES)
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
                "error": (
                    "Full name, institutional email, password, target batch, and representative "
                    "gender role (male/female) are required."
                )
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

    client = require_supabase_client()
    try:
        batch_row = client.select_one("batches", filters={"id": f"eq.{batch_id}"}, select="id,code,name,institution_id")
        if not batch_row:
            raise HTTPException(status_code=404, detail={"error": "Selected batch does not exist."})
        assert_institution_access(auth_user, batch_row.get("institution_id"))

        existing_email = client.select_one("users", filters={"email": f"ilike.{clean_email}"}, select="id")
        if existing_email:
            raise HTTPException(
                status_code=409,
                detail={"error": f'An account with email "{clean_email}" already exists.'},
            )

        existing_slot = client.select_one(
            "br_assignments",
            filters={"batch_id": f"eq.{batch_id}", "gender_role": f"eq.{gender_role}", "is_active": "eq.true"},
            select="id,user_id",
        )
        if existing_slot:
            slot_user = client.select_one("users", filters={"id": f"eq.{existing_slot['user_id']}"}, select="name")
            current_br_name = (slot_user or {}).get("name") or existing_slot["user_id"]
            if not replace_existing:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error": (
                            f'Batch {batch_row["code"]} already has an active {gender_role} Batch Representative '
                            f'({current_br_name}). Enable "Replace current {gender_role} representative" or '
                            "deactivate the existing assignment first."
                        )
                    },
                )
            client.update("br_assignments", {"id": f"eq.{existing_slot['id']}"}, {"is_active": False})

        current_iso = now_iso()
        new_user_id = f"user-br-{gender_role}-{uuid.uuid4().hex[:8]}"
        gender_label = "Male" if gender_role == "male" else "Female"
        display_label = f"{clean_name} ({gender_label} BR · {batch_row['code']})"

        admin_inst_id = batch_row.get("institution_id") or auth_user.get("institutionId") or ""
        admin_inst_row = client.select_one("institutions", filters={"id": f"eq.{admin_inst_id}"}, select="name")
        admin_inst_name = admin_inst_row["name"] if admin_inst_row else ""

        client.insert(
            "users",
            {
                "id": new_user_id,
                "name": display_label,
                "email": clean_email,
                "password_hash": hash_password(clean_password),
                "role": "br",
                "gender": gender_role,
                "batch_id": batch_id,
                "is_active": True,
                "must_reset_password": False,
                "credential_hint": clean_password,
                "institution": admin_inst_name,
                "institution_id": admin_inst_id,
                "created_at": current_iso,
            },
        )
        client.insert(
            "br_assignments",
            {
                "id": f"assign-{uuid.uuid4().hex[:8]}",
                "batch_id": batch_id,
                "user_id": new_user_id,
                "gender_role": gender_role,
                "is_active": True,
                "assigned_by": auth_user.get("name") or "Administrator",
                "assigned_at": current_iso,
            },
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

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


@router.patch("/api/voting/admin/br-accounts/{userId}")
async def update_br_account(userId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=ADMIN_ROLES)
    body = await parse_json_body(request)
    action = body.get("action")
    new_password = str(body.get("newPassword") or "").strip()
    batch_id = body.get("batchId")
    gender_role = body.get("genderRole")

    client = require_supabase_client()
    try:
        br_user = client.select_one("users", filters={"id": f"eq.{userId}", "role": "eq.br"})
        if not br_user:
            raise HTTPException(status_code=404, detail={"error": "Batch Representative account not found."})
        assert_institution_access(auth_user, br_user.get("institution_id"))

        current_iso = now_iso()

        if action == "deactivate":
            client.update("users", {"id": f"eq.{userId}"}, {"is_active": False})
            client.update("br_assignments", {"user_id": f"eq.{userId}"}, {"is_active": False})
            return {"message": f'Deactivated BR account "{br_user["name"]}".'}

        if action == "activate":
            client.update("users", {"id": f"eq.{userId}"}, {"is_active": True})
            if br_user.get("batch_id") and br_user.get("gender"):
                client.update(
                    "br_assignments",
                    {"batch_id": f"eq.{br_user['batch_id']}", "gender_role": f"eq.{br_user['gender']}"},
                    {"is_active": False},
                )
                client.insert(
                    "br_assignments",
                    {
                        "id": f"assign-{uuid.uuid4().hex[:8]}",
                        "batch_id": br_user["batch_id"],
                        "user_id": userId,
                        "gender_role": br_user["gender"],
                        "is_active": True,
                        "assigned_by": auth_user.get("name") or "Administrator",
                        "assigned_at": current_iso,
                    },
                )
            return {"message": f'Activated BR account "{br_user["name"]}".'}

        if action == "reset_password":
            if len(new_password) < 6:
                raise HTTPException(
                    status_code=400,
                    detail={"error": "New password must be at least 6 characters long."},
                )
            client.update(
                "users",
                {"id": f"eq.{userId}"},
                {"password_hash": hash_password(new_password), "credential_hint": new_password, "is_active": True},
            )
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
            target_batch = client.select_one("batches", filters={"id": f"eq.{batch_id}"}, select="id,institution_id")
            if not target_batch:
                raise HTTPException(status_code=404, detail={"error": "Target batch not found."})
            assert_institution_access(auth_user, target_batch.get("institution_id"))

            client.update(
                "br_assignments",
                {"batch_id": f"eq.{batch_id}", "gender_role": f"eq.{gender_role}"},
                {"is_active": False},
            )
            client.update("br_assignments", {"user_id": f"eq.{userId}"}, {"is_active": False})
            client.update(
                "users",
                {"id": f"eq.{userId}"},
                {"batch_id": batch_id, "gender": gender_role, "is_active": True},
            )
            client.insert(
                "br_assignments",
                {
                    "id": f"assign-{uuid.uuid4().hex[:8]}",
                    "batch_id": batch_id,
                    "user_id": userId,
                    "gender_role": gender_role,
                    "is_active": True,
                    "assigned_by": auth_user.get("name") or "Administrator",
                    "assigned_at": current_iso,
                },
            )
            return {"message": f'Assigned "{br_user["name"]}" as {gender_role} BR.'}
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    raise HTTPException(status_code=400, detail={"error": "Unsupported action."})


@router.patch("/api/voting/admin/polls/{pollId}/status")
async def update_poll_status(pollId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=ADMIN_ROLES)
    body = await parse_json_body(request)
    client = require_supabase_client()

    try:
        existing = client.select_one("polls", filters={"id": f"eq.{pollId}"})
        if not existing:
            raise HTTPException(status_code=404, detail={"error": "Question not found."})
        assert_institution_access(auth_user, existing.get("institution_id"))

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

        client.update(
            "polls",
            {"id": f"eq.{pollId}"},
            {
                "status": next_status,
                "rejection_reason": rejection_reason if next_status == "Rejected" else None,
                "result_visibility": next_visibility,
                "start_at": next_start_at,
                "end_at": next_end_at,
                "target_scope": next_scope,
                "published_at": published_at,
                "closed_at": closed_at,
                "updated_at": current_iso,
            },
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    updated_polls = build_enriched_polls_for_user(auth_user)
    updated_poll = next((p for p in updated_polls if p["id"] == pollId), None)

    return {
        "message": f"Question status updated to {next_status}.",
        "poll": updated_poll,
    }


@router.delete("/api/voting/admin/polls/{pollId}")
def delete_poll(pollId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=ADMIN_ROLES)
    client = require_supabase_client()
    try:
        existing = client.select_one("polls", filters={"id": f"eq.{pollId}"})
        if not existing:
            raise HTTPException(status_code=404, detail={"error": "Question not found."})
        assert_institution_access(auth_user, existing.get("institution_id"))
        client.delete("polls", {"id": f"eq.{pollId}"})
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Question permanently removed."}


@router.patch("/api/voting/admin/polls/{pollId}/optimizer-approval")
async def update_poll_optimizer_approval(pollId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=ADMIN_ROLES)
    body = await parse_json_body(request)
    approval_status = str(body.get("approvalStatus") or "").strip()
    rejection_reason = str(body.get("rejectionReason") or "").strip()

    if approval_status not in ("pending_review", "approved_for_optimizer", "rejected_from_optimizer"):
        raise HTTPException(
            status_code=400,
            detail={"error": "Invalid approval status for optimizer integration."},
        )

    if approval_status == "rejected_from_optimizer" and not rejection_reason:
        raise HTTPException(
            status_code=400,
            detail={"error": "Please provide a reason for excluding this poll from the optimizer."},
        )

    current_iso = now_iso()
    client = require_supabase_client()
    try:
        poll = client.select_one("polls", filters={"id": f"eq.{pollId}"})
        if not poll:
            raise HTTPException(status_code=404, detail={"error": "Poll not found."})
        assert_institution_access(auth_user, poll.get("institution_id"))

        client.update(
            "polls",
            {"id": f"eq.{pollId}"},
            {
                "optimizer_approval_status": approval_status,
                "optimizer_approved_by": auth_user.get("userId"),
                "optimizer_approved_at": current_iso if approval_status == "approved_for_optimizer" else None,
                "optimizer_rejection_reason": rejection_reason if approval_status == "rejected_from_optimizer" else None,
                "updated_at": current_iso,
            },
        )
        if not getattr(client, "has_column", lambda t, c: True)("polls", "optimizer_approval_status"):
            meta_cat = f"poll_meta:{pollId}"
            existing_meta = client.select_one(
                "feedback",
                filters={"institution_id": f"eq.{poll['institution_id']}", "category": f"eq.{meta_cat}"},
                order="created_at.desc",
            )
            parsed_meta = safe_json_loads(existing_meta.get("comment"), {}) if existing_meta else {}
            if not isinstance(parsed_meta, dict):
                parsed_meta = {}
            parsed_meta.update(
                {
                    "poll_id": pollId,
                    "optimizer_approval_status": approval_status,
                    "optimizer_rejection_reason": rejection_reason if approval_status == "rejected_from_optimizer" else None,
                    "optimizer_approved_at": current_iso if approval_status == "approved_for_optimizer" else None,
                }
            )
            if existing_meta:
                client.update("feedback", {"id": f"eq.{existing_meta['id']}"}, {"comment": json.dumps(parsed_meta)})
            else:
                client.insert(
                    "feedback",
                    {
                        "id": str(uuid.uuid4()),
                        "institution_id": poll["institution_id"],
                        "user_id": auth_user.get("userId"),
                        "category": meta_cat,
                        "rating": 5,
                        "comment": json.dumps(parsed_meta),
                        "created_at": current_iso,
                    },
                )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    updated_polls = build_enriched_polls_for_user(auth_user)
    updated_poll = next((p for p in updated_polls if p["id"] == pollId), None)
    return {
        "message": f"Poll optimizer approval status updated to {approval_status}.",
        "poll": updated_poll,
    }


@router.get("/api/voting/admin/active-preferences")
def get_active_preferences_overview(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        inst = client.select_one("institutions", filters={"id": f"eq.{uni_id}"}) or {}
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    inf_weight = float(inst.get("voting_preference_influence") or 0.65)
    low_thresh = float(inst.get("low_participation_threshold") or 25.0)

    from app.optimization.preference_aggregator import aggregate_approved_voting_preferences
    agg = aggregate_approved_voting_preferences(uni_id, inf_weight, low_thresh)

    return {
        "useVotingPreferences": bool(inst.get("use_voting_preferences", True)),
        "votingPreferenceInfluence": inf_weight,
        "lowParticipationThreshold": low_thresh,
        "batchPreferences": agg.get("batchPreferences", {}),
        "traceability": agg.get("traceability", []),
    }


@router.get("/api/voting/admin/optimizer-config")
def get_optimizer_voting_config(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        inst = client.select_one("institutions", filters={"id": f"eq.{uni_id}"}) or {}
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {
        "useVotingPreferences": bool(inst.get("use_voting_preferences", True)),
        "votingPreferenceInfluence": float(inst.get("voting_preference_influence") or 0.65),
        "lowParticipationThreshold": float(inst.get("low_participation_threshold") or 25.0),
    }


@router.patch("/api/voting/admin/optimizer-config")
async def update_optimizer_voting_config(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=ADMIN_ROLES)
    uni_id = scoped_uni_id(auth_user, "")
    body = await parse_json_body(request)

    patch_data: Dict[str, Any] = {}
    if "useVotingPreferences" in body:
        patch_data["use_voting_preferences"] = bool(body["useVotingPreferences"])
    if "votingPreferenceInfluence" in body:
        patch_data["voting_preference_influence"] = float(body["votingPreferenceInfluence"])
    if "lowParticipationThreshold" in body:
        patch_data["low_participation_threshold"] = float(body["lowParticipationThreshold"])

    client = require_supabase_client()
    try:
        if patch_data:
            client.update("institutions", {"id": f"eq.{uni_id}"}, patch_data)
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Voting optimizer configuration updated successfully."}


@router.post("/api/timetables/{versionId}/feedback", status_code=201)
async def submit_timetable_feedback(versionId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = auth_user.get("institutionId") or ""
    body = await parse_json_body(request)

    timings = int(body.get("timingsRating") or body.get("timings_rating") or 5)
    compactness = int(body.get("compactnessRating") or body.get("compactness_rating") or 5)
    gaps = int(body.get("gapsRating") or body.get("gaps_rating") or 5)
    free_day = int(body.get("freeDayRating") or body.get("free_day_rating") or 5)
    overall = int(body.get("overallRating") or body.get("overall_rating") or 5)
    note = str(body.get("preferredAdjustmentNote") or body.get("preferred_adjustment_note") or "").strip()

    client = require_supabase_client()
    feedback_id = f"fb-{uuid.uuid4().hex[:10]}"
    current_iso = now_iso()
    fb_payload = {
        "id": feedback_id,
        "institution_id": uni_id,
        "timetable_version_id": versionId,
        "user_id": auth_user["userId"],
        "batch_id": auth_user.get("batchId"),
        "section_code": auth_user.get("section"),
        "timings_rating": timings,
        "compactness_rating": compactness,
        "gaps_rating": gaps,
        "free_day_rating": free_day,
        "overall_rating": overall,
        "preferred_adjustment_note": note,
        "created_at": current_iso,
    }
    try:
        tt = client.select_one("timetable_versions", filters={"id": f"eq.{versionId}", "institution_id": f"eq.{uni_id}"})
        if not tt:
            raise HTTPException(status_code=404, detail={"error": "Timetable version not found."})

        try:
            client.insert(
                "timetable_feedback",
                fb_payload,
                upsert=True,
                on_conflict="timetable_version_id,user_id",
            )
        except SupabaseQueryError as tbl_err:
            if not is_missing_table_error(tbl_err):
                raise
            client.insert(
                "feedback",
                {
                    "id": str(uuid.uuid4()),
                    "institution_id": uni_id,
                    "user_id": auth_user["userId"],
                    "category": f"timetable_feedback:{versionId}",
                    "rating": max(1, min(5, overall)),
                    "comment": json.dumps(fb_payload),
                    "created_at": current_iso,
                },
            )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Thank you! Your feedback has been recorded and will guide future optimization iterations."}


@router.get("/api/timetables/{versionId}/feedback")
def get_timetable_feedback(versionId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = auth_user.get("institutionId") or ""
    client = require_supabase_client()
    try:
        try:
            rows = client.select(
                "timetable_feedback",
                filters={"timetable_version_id": f"eq.{versionId}", "institution_id": f"eq.{uni_id}"},
            )
        except SupabaseQueryError as tbl_err:
            if not is_missing_table_error(tbl_err):
                raise
            fb_rows = client.select(
                "feedback",
                filters={"institution_id": f"eq.{uni_id}", "category": f"eq.timetable_feedback:{versionId}"},
                order="created_at.desc",
            )
            rows = [
                parsed
                for r in fb_rows
                for parsed in [safe_json_loads(r.get("comment"), None)]
                if isinstance(parsed, dict)
            ]
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    total = len(rows)
    if total == 0:
        return {"totalFeedback": 0, "averages": {}, "feedback": []}

    avg_timings = sum(r["timings_rating"] for r in rows) / total
    avg_compact = sum(r["compactness_rating"] for r in rows) / total
    avg_gaps = sum(r["gaps_rating"] for r in rows) / total
    avg_free = sum(r["free_day_rating"] for r in rows) / total
    avg_overall = sum(r["overall_rating"] for r in rows) / total

    return {
        "totalFeedback": total,
        "averages": {
            "timings": round(avg_timings, 2),
            "compactness": round(avg_compact, 2),
            "gaps": round(avg_gaps, 2),
            "freeDay": round(avg_free, 2),
            "overall": round(avg_overall, 2),
        },
        "feedback": rows,
    }


# ============================================================================
# COMMUNITY SCHEDULE PROPOSALS (FEEDBACK PROPOSALS IN SCHEDULE_PROPOSALS OR FEEDBACK)
# ============================================================================

def _map_schedule_proposal(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "category": row.get("category") or "General",
        "description": row["description"],
        "targetSlot": row.get("target_slot") or row.get("targetSlot") or "",
        "submittedBy": row.get("submitted_by") or row.get("submittedBy") or "Campus Community",
        "createdAt": row.get("created_at") or row.get("createdAt") or now_iso(),
        "status": row.get("status") or "Open",
        "votesApprove": int(row.get("votes_approve") if row.get("votes_approve") is not None else (row.get("votesApprove") or 0)),
        "votesRevise": int(row.get("votes_revise") if row.get("votes_revise") is not None else (row.get("votesRevise") or 0)),
        "voters": safe_json_loads(row.get("voters"), {}),
    }


@router.get("/api/feedback/proposals")
def list_schedule_proposals(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    uni_id = scoped_uni_id(auth_user, get_query_param(request, "universityId", ""))
    client = require_supabase_client()
    try:
        try:
            rows = client.select(
                "schedule_proposals",
                filters={"institution_id": f"eq.{uni_id}"},
                order="created_at.desc",
                limit=50,
            )
            return {"proposals": [_map_schedule_proposal(r) for r in rows]}
        except SupabaseQueryError as tbl_err:
            if not is_missing_table_error(tbl_err):
                raise
            fb_rows = client.select(
                "feedback",
                filters={"institution_id": f"eq.{uni_id}", "category": "eq.schedule_proposal"},
                order="created_at.desc",
                limit=50,
            )
            mapped: List[Dict[str, Any]] = []
            for fb in fb_rows:
                parsed = safe_json_loads(fb.get("comment"), None)
                if isinstance(parsed, dict) and parsed.get("title"):
                    mapped.append(_map_schedule_proposal({**parsed, "createdAt": parsed.get("createdAt") or fb.get("created_at")}))
            return {"proposals": mapped}
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)


@router.post("/api/feedback/proposals", status_code=201)
async def create_schedule_proposal(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    body = await parse_json_body(request)
    uni_id = scoped_uni_id(auth_user, str(body.get("universityId") or ""))

    title = str(body.get("title") or "").strip()
    description = str(body.get("description") or "").strip()
    category = str(body.get("category") or "General").strip()
    target_slot = str(body.get("targetSlot") or "").strip()

    if len(title) < 3 or len(description) < 5:
        raise HTTPException(
            status_code=400,
            detail={"error": "Proposal title and description are required."},
        )

    prop_id = str(body.get("id") or f"sprop-{uuid.uuid4().hex[:8]}")
    current_iso = now_iso()
    submitted_by_name = str(body.get("submittedBy") or auth_user.get("name") or "Campus Member")
    client = require_supabase_client()
    try:
        try:
            inserted = client.insert(
                "schedule_proposals",
                {
                    "id": prop_id,
                    "institution_id": uni_id,
                    "title": title,
                    "category": category,
                    "description": description,
                    "target_slot": target_slot,
                    "submitted_by": submitted_by_name,
                    "submitted_by_user_id": auth_user.get("userId"),
                    "status": "Open",
                    "votes_approve": 0,
                    "votes_revise": 0,
                    "voters": {},
                    "created_at": current_iso,
                    "updated_at": current_iso,
                },
            )
            row = inserted[0] if inserted else None
            mapped = _map_schedule_proposal(row) if row else None
        except SupabaseQueryError as tbl_err:
            if not is_missing_table_error(tbl_err):
                raise
            prop_obj = {
                "id": prop_id,
                "title": title,
                "category": category,
                "description": description,
                "targetSlot": target_slot,
                "submittedBy": submitted_by_name,
                "status": "Open",
                "votesApprove": 0,
                "votesRevise": 0,
                "voters": {},
                "createdAt": current_iso,
            }
            client.insert(
                "feedback",
                {
                    "id": str(uuid.uuid4()),
                    "institution_id": uni_id,
                    "user_id": auth_user.get("userId"),
                    "category": "schedule_proposal",
                    "rating": 5,
                    "comment": json.dumps(prop_obj),
                    "created_at": current_iso,
                },
            )
            mapped = prop_obj
        write_audit_log(
            client,
            uni_id,
            auth_user,
            "create",
            "scenario",
            prop_id,
            f"Submitted community schedule proposal '{title}'",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    return {"message": "Proposal submitted to Supabase.", "proposal": mapped}


@router.post("/api/feedback/proposals/{proposalId}/vote")
async def vote_schedule_proposal(proposalId: str, request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request)
    body = await parse_json_body(request)
    vote = str(body.get("vote") or "").strip().lower()
    if vote not in ("approve", "revise"):
        raise HTTPException(status_code=400, detail={"error": "Vote must be 'approve' or 'revise'."})

    client = require_supabase_client()
    try:
        try:
            existing = client.select_one("schedule_proposals", filters={"id": f"eq.{proposalId}"})
            if not existing:
                raise HTTPException(status_code=404, detail={"error": "Schedule proposal not found."})
            assert_institution_access(auth_user, existing.get("institution_id"))

            voters = safe_json_loads(existing.get("voters"), {})
            if not isinstance(voters, dict):
                voters = {}
            voter_key = str(auth_user.get("userId") or "user")
            voters[voter_key] = vote
            approve_cnt = sum(1 for v in voters.values() if v == "approve")
            revise_cnt = sum(1 for v in voters.values() if v == "revise")

            updated_rows = client.update(
                "schedule_proposals",
                {"id": f"eq.{proposalId}"},
                {
                    "voters": voters,
                    "votes_approve": approve_cnt,
                    "votes_revise": revise_cnt,
                    "updated_at": now_iso(),
                },
            )
            row = updated_rows[0] if updated_rows else existing
            return {"message": "Vote recorded.", "proposal": _map_schedule_proposal(row)}
        except SupabaseQueryError as tbl_err:
            if not is_missing_table_error(tbl_err):
                raise
            fb_rows = client.select(
                "feedback",
                filters={"category": "eq.schedule_proposal"},
                order="created_at.desc",
                limit=200,
            )
            target_fb = None
            target_prop = None
            for fb in fb_rows:
                parsed = safe_json_loads(fb.get("comment"), None)
                if isinstance(parsed, dict) and parsed.get("id") == proposalId:
                    target_fb = fb
                    target_prop = parsed
                    break
            if not target_fb or not target_prop:
                raise HTTPException(status_code=404, detail={"error": "Schedule proposal not found."})
            assert_institution_access(auth_user, target_fb.get("institution_id"))

            voters = target_prop.get("voters") if isinstance(target_prop.get("voters"), dict) else {}
            voter_key = str(auth_user.get("userId") or "user")
            voters[voter_key] = vote
            approve_cnt = sum(1 for v in voters.values() if v == "approve")
            revise_cnt = sum(1 for v in voters.values() if v == "revise")
            target_prop["voters"] = voters
            target_prop["votesApprove"] = approve_cnt
            target_prop["votesRevise"] = revise_cnt
            client.update(
                "feedback",
                {"id": f"eq.{target_fb['id']}"},
                {"comment": json.dumps(target_prop)},
            )
            return {"message": "Vote recorded.", "proposal": _map_schedule_proposal(target_prop)}
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)
