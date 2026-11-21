"""
Shared request parsing, Supabase HTTP error translation, authentication/RBAC guards,
voting enrichment, and optimization catalog loading helpers for SmartGrid AI routers.
"""

from __future__ import annotations

import json
import uuid
from collections import defaultdict
from typing import Any, Dict, List, NoReturn, Optional

from app.database.supabase import SupabaseQueryError, require_supabase_client
from database import now_iso, sign_auth_token, verify_auth_token
from fastapi_compat import HTTPException, Request

ADMIN_ROLES: List[str] = ["admin", "university_admin", "super_admin"]
CATALOG_MANAGER_ROLES: List[str] = ["admin", "university_admin", "super_admin", "timetable_manager"]


def scoped_uni_id(auth_user: Dict[str, Any], requested_uni_id: str = "") -> str:
    user_inst = str(auth_user.get("institutionId") or "").strip()
    role = str(auth_user.get("role") or "").lower()
    req = str(requested_uni_id or "").strip()
    if req and role != "super_admin" and user_inst and req != user_inst:
        raise HTTPException(
            status_code=403,
            detail={"error": "Access denied: Cross-institution data access is prohibited."},
        )
    target = req or user_inst
    if not target:
        raise HTTPException(status_code=400, detail={"error": "University / institution context is required."})
    return target


def assert_institution_access(auth_user: Dict[str, Any], record_inst_id: Optional[str]) -> None:
    role = str(auth_user.get("role") or "").lower()
    if role == "super_admin":
        return
    user_inst = str(auth_user.get("institutionId") or "").strip()
    rec_inst = str(record_inst_id or "").strip()
    if rec_inst and user_inst and rec_inst != user_inst:
        raise HTTPException(
            status_code=403,
            detail={"error": "Access denied: Resource belongs to another university."},
        )


def is_missing_table_error(err: SupabaseQueryError) -> bool:
    msg = (err.message or "").lower()
    return (
        err.status_code == 404
        or "pgrst205" in msg
        or "could not find the table" in msg
        or "does not exist" in msg
    )


def safe_select_optional(
    client: Any,
    table: str,
    filters: Optional[Dict[str, str]] = None,
    select: str = "*",
    order: Optional[str] = None,
    limit: Optional[int] = None,
) -> List[Dict[str, Any]]:
    try:
        return client.select(table, filters=filters, select=select, order=order, limit=limit)
    except SupabaseQueryError as err:
        if is_missing_table_error(err):
            return []
        raise


def safe_insert_optional(
    client: Any,
    table: str,
    rows: Any,
    upsert: bool = False,
    on_conflict: Optional[str] = None,
) -> List[Dict[str, Any]]:
    try:
        return client.insert(table, rows, upsert=upsert, on_conflict=on_conflict)
    except SupabaseQueryError as err:
        if is_missing_table_error(err):
            return []
        raise


def safe_delete_optional(
    client: Any,
    table: str,
    filters: Dict[str, str],
) -> None:
    try:
        client.delete(table, filters)
    except SupabaseQueryError as err:
        if is_missing_table_error(err):
            return
        raise


def write_audit_log(
    client: Any,
    institution_id: str,
    auth_user: Dict[str, Any],
    action: str,
    entity_type: str,
    entity_id: str,
    summary: str,
    previous_value: Optional[str] = None,
    new_value: Optional[str] = None,
) -> None:
    if not institution_id:
        return
    safe_insert_optional(
        client,
        "audit_logs",
        {
            "id": f"aud-{uuid.uuid4().hex[:10]}",
            "institution_id": institution_id,
            "user_id": auth_user.get("userId"),
            "user_name": auth_user.get("name") or "Administrator",
            "action": action,
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "summary": summary,
            "previous_value": previous_value,
            "new_value": new_value,
            "created_at": now_iso(),
        },
    )


def safe_json_loads(raw: Any, default: Any) -> Any:
    if isinstance(raw, (list, dict)):
        return raw
    if not raw or not isinstance(raw, str):
        return default
    try:
        return json.loads(raw)
    except Exception:
        return default


def raise_supabase_http_error(err: SupabaseQueryError) -> NoReturn:
    msg = err.message or "Supabase database operation failed."
    low = msg.lower()
    if err.status_code in (401, 403) and ("row-level security" in low or "permission denied" in low):
        raise HTTPException(
            status_code=503,
            detail={
                "error": (
                    "Supabase row-level security blocked this database operation. "
                    "Verify SUPABASE_SERVICE_ROLE_KEY is configured and active in the runtime."
                )
            },
        )
    status = err.status_code if 400 <= err.status_code < 600 else 500
    raise HTTPException(status_code=status, detail={"error": msg})


def map_role_to_display_role(role: str) -> str:
    if role in ("admin", "university_admin", "super_admin"):
        return "Registrar"
    if role == "timetable_manager":
        return "Registrar"
    if role == "br":
        return "BR"
    if role == "student":
        return "Student"
    if role in ("faculty", "instructor"):
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
    client = require_supabase_client()
    try:
        user = client.select_one("users", filters={"id": f"eq.{user_id}"})
        if not user:
            return None

        batch_map: Dict[str, Dict[str, Any]] = {}
        if user.get("batch_id"):
            b_row = client.select_one(
                "batches",
                filters={"id": f"eq.{user['batch_id']}"},
                select="id,code,name,department_code",
            )
            if b_row:
                batch_map[b_row["id"]] = b_row

        br_assignment: Optional[Dict[str, Any]] = None
        if user.get("role") == "br":
            br_row = client.select_one(
                "br_assignments",
                filters={"user_id": f"eq.{user['id']}", "is_active": "eq.true"},
                select="id,batch_id,gender_role",
            )
            if br_row:
                if br_row["batch_id"] not in batch_map:
                    b_row = client.select_one(
                        "batches",
                        filters={"id": f"eq.{br_row['batch_id']}"},
                        select="id,code,name,department_code",
                    )
                    if b_row:
                        batch_map[b_row["id"]] = b_row
                b_info = batch_map.get(br_row["batch_id"], {})
                br_assignment = {
                    **br_row,
                    "batch_code": b_info.get("code"),
                    "batch_name": b_info.get("name"),
                    "department_code": b_info.get("department_code"),
                }

        user_batch = batch_map.get(user.get("batch_id") or "", {})
        effective_batch_id = br_assignment["batch_id"] if br_assignment else user.get("batch_id")
        effective_batch_code = br_assignment["batch_code"] if br_assignment else user_batch.get("code")
        effective_batch_name = br_assignment["batch_name"] if br_assignment else user_batch.get("name")
        effective_br_gender = br_assignment["gender_role"] if br_assignment else None
        inst_id = user.get("institution_id") or ""

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
            "institution": user.get("institution") or "",
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
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)


def require_auth_user(request: Request, allowed_roles: Optional[List[str]] = None) -> Dict[str, Any]:
    auth_header = get_header(request, "authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"error": "Authentication required. Please sign in."})

    token = auth_header[7:].strip()
    payload = verify_auth_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail={"error": "Invalid or expired authentication session."})

    client = require_supabase_client()
    try:
        db_user = client.select_one(
            "users",
            filters={"id": f"eq.{payload.get('userId')}"},
            select="id,name,role,is_active,batch_id,institution_id",
        )

        if not db_user or not db_user.get("is_active"):
            raise HTTPException(
                status_code=403,
                detail={"error": "Your account has been deactivated by the Administrator. Please contact the Registrar."},
            )

        if db_user["role"] == "br":
            active_assign = client.select_one(
                "br_assignments",
                filters={"user_id": f"eq.{db_user['id']}", "is_active": "eq.true"},
                select="batch_id,gender_role",
            )
            payload["batchId"] = active_assign["batch_id"] if active_assign else None
            payload["brGenderRole"] = active_assign["gender_role"] if active_assign else None
        else:
            payload["batchId"] = db_user.get("batch_id")

        payload["role"] = db_user["role"]
        payload["name"] = db_user["name"]
        payload["institutionId"] = db_user.get("institution_id") or payload.get("institutionId") or ""
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

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
    user_inst_id = auth_user.get("institutionId") or ""
    role = auth_user.get("role")
    client = require_supabase_client()

    try:
        # Auto-close expired published polls (ignore RLS error only if caller lacks write permissions)
        try:
            client.update(
                "polls",
                {"status": "eq.Published", "end_at": f"lt.{current_iso}"},
                {"status": "Closed", "closed_at": current_iso, "updated_at": current_iso},
            )
        except SupabaseQueryError as close_err:
            if close_err.status_code not in (401, 403):
                raise

        all_inst_polls = client.select(
            "polls",
            filters={"institution_id": f"eq.{user_inst_id}"},
            order="created_at.desc",
        )
        if all_inst_polls and any("optimizer_approval_status" not in p for p in all_inst_polls):
            meta_rows = client.select(
                "feedback",
                filters={"institution_id": f"eq.{user_inst_id}", "category": "like.poll_meta:%"},
                order="created_at.desc",
            )
            meta_by_poll: Dict[str, Dict[str, Any]] = {}
            for mr in meta_rows:
                cat = str(mr.get("category") or "")
                pid = cat.split("poll_meta:", 1)[1] if cat.startswith("poll_meta:") else ""
                parsed = safe_json_loads(mr.get("comment"), None)
                if pid and isinstance(parsed, dict) and pid not in meta_by_poll:
                    meta_by_poll[pid] = parsed
            for p in all_inst_polls:
                m = meta_by_poll.get(p["id"])
                if m:
                    for k in ("poll_category", "target_batch_ids", "optimizer_approval_status", "optimizer_rejection_reason"):
                        if p.get(k) is None and m.get(k) is not None:
                            p[k] = m[k]

        if role in ("student", "faculty"):
            raw_polls = [p for p in all_inst_polls if p.get("status") in ("Published", "Closed")]
        elif role == "br":
            my_batch_id = auth_user.get("batchId") or ""
            my_user_id = auth_user.get("userId")
            raw_polls = [
                p
                for p in all_inst_polls
                if p.get("batch_id") == my_batch_id
                or p.get("submitted_by_user_id") == my_user_id
                or p.get("status") in ("Published", "Closed")
            ]
        else:
            raw_polls = all_inst_polls

        if not raw_polls:
            return []

        batches = client.select(
            "batches",
            filters={"institution_id": f"eq.{user_inst_id}"},
            select="id,code,name,department_code,student_count",
        )
        batch_by_id = {b["id"]: b for b in batches}

        poll_ids_filter = f"in.({','.join(p['id'] for p in raw_polls)})"
        all_options = client.select(
            "poll_options",
            filters={"poll_id": poll_ids_filter},
            select="id,poll_id,label,sort_order",
            order="sort_order.asc",
        )
        all_votes = client.select(
            "poll_votes",
            filters={"poll_id": poll_ids_filter},
            select="poll_id,option_id,student_user_id,batch_id,created_at",
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    vote_counts_map: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    batch_votes_map: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    user_vote_map: Dict[str, Dict[str, Any]] = {}
    my_uid = auth_user.get("userId")

    for v in all_votes:
        p_id = v["poll_id"]
        vote_counts_map[p_id][v["option_id"]] += 1
        batch_votes_map[p_id][v["batch_id"]] += 1
        if v.get("student_user_id") == my_uid:
            user_vote_map[p_id] = v

    enriched_polls: List[Dict[str, Any]] = []

    for poll in raw_polls:
        poll_id = poll["id"]
        batch_info = batch_by_id.get(poll.get("batch_id") or "", {})
        options_for_poll = [o for o in all_options if o["poll_id"] == poll_id]
        option_counts = vote_counts_map.get(poll_id, {})
        total_votes = sum(option_counts.values())

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
        if role in CATALOG_MANAGER_ROLES:
            can_view_results = True
        elif role == "br":
            can_view_results = (
                visibility == "always"
                or is_expired
                or status == "Closed"
                or poll.get("submitted_by_user_id") == my_uid
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
            votes = int(option_counts.get(opt["id"], 0))
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
        if role in CATALOG_MANAGER_ROLES or can_view_results:
            for b_id, v_cast in batch_votes_map.get(poll_id, {}).items():
                b_obj = batch_by_id.get(b_id, {})
                st_count = int(b_obj.get("student_count") or 0)
                p_rate = min(100.0, round((v_cast / st_count) * 100, 1)) if st_count > 0 else 0
                batch_breakdown.append(
                    {
                        "batchId": b_id,
                        "batchCode": b_obj.get("code") or b_id,
                        "batchName": b_obj.get("name") or b_id,
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
                "batchCode": batch_info.get("code") or poll["batch_id"],
                "batchName": batch_info.get("name") or poll["batch_id"],
                "departmentCode": batch_info.get("department_code") or "GEN",
                "targetScope": poll["target_scope"],
                "targetBatchIds": poll.get("target_batch_ids") or [],
                "pollCategory": poll.get("poll_category") or "general_suggestion",
                "optimizerApprovalStatus": poll.get("optimizer_approval_status") or "pending_review",
                "optimizerRejectionReason": poll.get("optimizer_rejection_reason"),
                "submittedByUserId": poll["submitted_by_user_id"],
                "submittedByName": poll["submitted_by_name"],
                "brGenderRole": poll["br_gender_role"],
                "status": status,
                "rejectionReason": poll.get("rejection_reason") if role in (*CATALOG_MANAGER_ROLES, "br") else None,
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


def load_university_optimization_inputs(
    university_id: str,
    override_body: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Loads courses, course_sessions, classrooms, laboratories, room_equipment_capacities,
    instructors, batches/student_groups, preferences, availability, and TimeSlotConfig
    for the given university_id from Supabase PostgreSQL, allowing overrides in request body.
    """
    from app.optimization.constraints import TimeSlotConfig
    from app.optimization.fitness import OptimizationWeights

    body = override_body or {}
    client = require_supabase_client()

    def _select_for_uni(table: str, filters: Dict[str, str], order: Optional[str] = None) -> List[Dict[str, Any]]:
        if not university_id:
            return []
        try:
            return client.select(table, filters=filters, order=order)
        except SupabaseQueryError as err:
            raise_supabase_http_error(err)

    try:
        inst_row = (
            client.select_one("institutions", filters={"id": f"eq.{university_id}"})
            if university_id
            else None
        ) or {}

        db_courses = (
            client.select("courses", filters={"institution_id": f"eq.{university_id}"}, order="code.asc")
            if university_id
            else []
        )
        db_sessions = (
            client.select("course_sessions", filters={"institution_id": f"eq.{university_id}"})
            if university_id
            else []
        )
        db_classrooms = (
            client.select("classrooms", filters={"institution_id": f"eq.{university_id}"}, order="name.asc")
            if university_id
            else []
        )
        db_labs = (
            client.select("laboratories", filters={"institution_id": f"eq.{university_id}"}, order="name.asc")
            if university_id
            else []
        )
        db_equip = (
            client.select("room_equipment_capacities", filters={"institution_id": f"eq.{university_id}"})
            if university_id
            else []
        )
        db_batches = (
            client.select("batches", filters={"institution_id": f"eq.{university_id}"}, order="code.asc")
            if university_id
            else []
        )
        db_instructors = (
            client.select("instructors", filters={"institution_id": f"eq.{university_id}"}, order="name.asc")
            if university_id
            else []
        )
    except SupabaseQueryError as err:
        raise_supabase_http_error(err)

    db_student_prefs = _select_for_uni("student_preferences", {"institution_id": f"eq.{university_id}"})

    # Integrate approved BR voting preferences if enabled in institution settings or body override
    use_voting = bool(
        body["useVotingPreferences"]
        if "useVotingPreferences" in body
        else inst_row.get("use_voting_preferences", True)
    )
    inf_weight = float(
        body["votingPreferenceInfluence"]
        if "votingPreferenceInfluence" in body and body["votingPreferenceInfluence"] is not None
        else (inst_row.get("voting_preference_influence") if inst_row.get("voting_preference_influence") is not None else 0.65)
    )
    low_thresh = float(
        body["lowParticipationThreshold"]
        if "lowParticipationThreshold" in body and body["lowParticipationThreshold"] is not None
        else (inst_row.get("low_participation_threshold") if inst_row.get("low_participation_threshold") is not None else 25.0)
    )
    voting_traceability: List[Dict[str, Any]] = []
    voting_excluded: List[Dict[str, Any]] = []
    voting_config: Dict[str, Any] = {
        "useVotingPreferences": use_voting,
        "votingPreferenceInfluence": inf_weight,
        "lowParticipationThreshold": low_thresh,
    }

    if use_voting and university_id and inf_weight > 0.0:
        from app.optimization.preference_aggregator import aggregate_approved_voting_preferences
        agg_res = aggregate_approved_voting_preferences(university_id, inf_weight, low_thresh)
        batch_prefs_map = agg_res.get("batchPreferences", {})
        voting_traceability = list(agg_res.get("traceability") or [])
        voting_excluded = list(agg_res.get("excluded") or [])
        if batch_prefs_map:
            pref_by_batch: Dict[str, Dict[str, Any]] = {
                str(p.get("batch_id") or p.get("batchId")): p
                for p in db_student_prefs
                if p.get("batch_id") or p.get("batchId")
            }
            for b_id, prefs in batch_prefs_map.items():
                if b_id in pref_by_batch:
                    existing = pref_by_batch[b_id]
                    cats = prefs.get("categoryStrengths") or {}
                    if "preferred_lecture_timing" in cats:
                        existing["preferred_time_window"] = prefs.get("preferred_time_window", existing.get("preferred_time_window"))
                        existing["avoid_early_8am"] = prefs.get("avoid_early_8am", existing.get("avoid_early_8am"))
                        existing["avoid_late_after_4pm"] = prefs.get("avoid_late_after_4pm", existing.get("avoid_late_after_4pm"))
                    if "preferred_free_day" in cats and prefs.get("preferred_free_day"):
                        existing["preferred_free_day"] = prefs["preferred_free_day"]
                    if "lab_timing_preferences" in cats:
                        existing["preferred_lab_window"] = prefs.get("preferred_lab_window")
                    if "break_schedule_preference" in cats:
                        existing["break_schedule_preference"] = prefs.get("break_schedule_preference")
                        existing["max_acceptable_gap_minutes"] = prefs.get("max_acceptable_gap_minutes", existing.get("max_acceptable_gap_minutes"))
                    existing["preferenceStrength"] = prefs.get("preferenceStrength", 0.0)
                    existing["categoryStrengths"] = cats
                    existing["source"] = "manual+voting_poll"
                else:
                    db_student_prefs.append({
                        "batch_id": b_id,
                        "institution_id": university_id,
                        **prefs,
                    })

    db_inst_prefs = _select_for_uni("instructor_preferences", {"institution_id": f"eq.{university_id}"})
    db_inst_avails = _select_for_uni("instructor_availability", {"institution_id": f"eq.{university_id}"})

    equip_by_room: Dict[str, List[str]] = defaultdict(list)
    for eq in db_equip:
        if eq.get("room_id") and eq.get("equipment_name"):
            equip_by_room[eq["room_id"]].append(eq["equipment_name"])

    unavail_inst: Dict[str, List[str]] = defaultdict(list)
    for av in db_inst_avails:
        if not av.get("is_available", True) and av.get("instructor_id"):
            unavail_inst[av["instructor_id"]].append(f"{av['day_of_week']}-{av['start_time']}")

    normalized_instructors: List[Dict[str, Any]] = []
    for inst in db_instructors:
        normalized_instructors.append(
            {
                **inst,
                "unavailable_slots": unavail_inst.get(inst["id"], []),
            }
        )

    sessions_by_course: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for s in db_sessions:
        sessions_by_course[s["course_id"]].append(s)

    default_instructor_id = db_instructors[0]["id"] if db_instructors else ""
    default_batch_id = db_batches[0]["id"] if db_batches else ""

    normalized_courses: List[Dict[str, Any]] = []
    default_sections: List[Dict[str, Any]] = []

    for c in db_courses:
        req_eq = c.get("required_equipment") if isinstance(c.get("required_equipment"), list) else safe_json_loads(c.get("required_equipment"), [])
        lec_hrs = int(c.get("lecture_hours_per_week") or 0)
        lab_hrs = int(c.get("lab_hours_per_week") or 0)
        lec_cr = int(c.get("lecture_credit_hours") if c.get("lecture_credit_hours") is not None else lec_hrs)
        lab_cr = int(c.get("lab_credit_hours") if c.get("lab_credit_hours") is not None else (round(lab_hrs / 3) if lab_hrs > 0 else 0))

        raw_ct = str(c.get("course_type") or "").strip().lower()
        if raw_ct in ("lecture", "lab", "lecture_lab"):
            course_type = raw_ct
        elif lec_cr > 0 and lab_cr > 0:
            course_type = "lecture_lab"
        elif lab_cr > 0:
            course_type = "lab"
        else:
            course_type = "lecture"

        is_pure_lab = course_type == "lab"
        legacy_ctype = "Lab" if is_pure_lab else "Theory"
        assigned_inst_id = c.get("assigned_instructor_id") or default_instructor_id
        assigned_lab_eng_id = c.get("assigned_lab_engineer_id")

        normalized_courses.append(
            {
                **c,
                "type": legacy_ctype,
                "courseType": course_type,
                "credits": int(c.get("credit_hours") or max(1, lec_cr + lab_cr)),
                "lectureCredits": lec_cr,
                "labCredits": lab_cr,
                "lectureHours": lec_hrs or lec_cr,
                "labHours": lab_hrs or (lab_cr * 3),
                "assignedInstructorId": assigned_inst_id,
                "assignedLabEngineerId": assigned_lab_eng_id,
                "labSessionMode": c.get("lab_session_mode") or "continuous",
                "required_equipment": req_eq,
                "requiredEquipment": req_eq,
            }
        )
        c_sessions = sessions_by_course.get(c["id"], [])
        if c_sessions:
            for s in c_sessions:
                s_type = str(s.get("session_type") or legacy_ctype)
                s_is_lab = s_type.lower() == "lab" or str(s.get("component_type") or "").lower() == "lab"
                default_sections.append(
                    {
                        "id": s["id"],
                        "courseId": c["id"],
                        "courseCode": c["code"],
                        "instructorId": s.get("instructor_id") or assigned_inst_id,
                        "labEngineerId": s.get("lab_engineer_id") or assigned_lab_eng_id,
                        "studentGroupId": s.get("batch_id") or default_batch_id,
                        "sectionCode": s.get("section_code") or "A",
                        "sessionType": s_type,
                        "componentType": s.get("component_type") or ("lab" if s_is_lab else "lecture"),
                        "sessionsPerWeek": s.get("sessions_per_week"),
                        "durationMinutes": s.get("duration_minutes"),
                        "enrollment": int(s.get("expected_students") or 60),
                    }
                )
        else:
            if lec_cr > 0:
                default_sections.append(
                    {
                        "id": f"sec-{c['id']}-a-lec",
                        "courseId": c["id"],
                        "courseCode": c["code"],
                        "instructorId": assigned_inst_id,
                        "studentGroupId": default_batch_id,
                        "sectionCode": "A",
                        "sessionType": "Theory",
                        "componentType": "lecture",
                        "sessionsPerWeek": lec_cr,
                        "enrollment": 60,
                    }
                )
            if lab_cr > 0:
                default_sections.append(
                    {
                        "id": f"sec-{c['id']}-a-lab",
                        "courseId": c["id"],
                        "courseCode": c["code"],
                        "instructorId": assigned_inst_id,
                        "labEngineerId": assigned_lab_eng_id,
                        "studentGroupId": default_batch_id,
                        "sectionCode": "A",
                        "sessionType": "Lab",
                        "componentType": "lab",
                        "sessionsPerWeek": lab_cr,
                        "enrollment": 60,
                    }
                )

    normalized_rooms: List[Dict[str, Any]] = []
    for r in db_classrooms:
        rtype = str(r.get("room_type") or "lecture").lower()
        normalized_rooms.append(
            {
                "id": r["id"],
                "code": r.get("code") or r["id"],
                "name": r["name"],
                "capacity": int(r.get("capacity") or 60),
                "type": "lab" if "lab" in rtype else "lecture",
                "equipment": equip_by_room.get(r["id"], ["Projector"]),
                "isAvailable": bool(r.get("is_available", True)),
            }
        )
    for lab in db_labs:
        normalized_rooms.append(
            {
                "id": lab["id"],
                "code": lab.get("code") or lab["id"],
                "name": lab["name"],
                "capacity": int(lab.get("capacity") or 40),
                "type": "lab",
                "assignedLabEngineerId": lab.get("assigned_lab_engineer_id"),
                "equipment": equip_by_room.get(lab["id"], ["Workstations"]),
                "isAvailable": bool(lab.get("is_available", True)),
            }
        )

    normalized_groups: List[Dict[str, Any]] = []
    for b in db_batches:
        normalized_groups.append(
            {
                "id": b["id"],
                "batchId": b["id"],
                "code": b["code"],
                "name": b["name"],
                "departmentCode": b.get("department_code") or "",
                "size": int(b.get("student_count") or 60),
            }
        )

    # Merge institution TimeSlotConfig with optional request-body timeStructure/timeConfig override
    ts_override = body.get("timeStructure") or body.get("timeConfig") or {}
    working_days_raw = ts_override.get("workingDays") or inst_row.get("working_days") or "Mon,Tue,Wed,Thu,Fri"
    if isinstance(working_days_raw, list):
        working_days = [str(d).strip() for d in working_days_raw if str(d).strip()]
    else:
        working_days = [d.strip() for d in str(working_days_raw).split(",") if d.strip()]

    merged_ts: Dict[str, Any] = {
        "workingDays": working_days or ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "dayStartTime": ts_override.get("dayStartTime") or str(inst_row.get("day_start_time") or "09:00"),
        "dayEndTime": ts_override.get("dayEndTime") or str(inst_row.get("day_end_time") or "17:00"),
        "periodLengthMinutes": int(ts_override.get("periodLengthMinutes") or inst_row.get("period_length_minutes") or 50),
        "shortBreakMinutes": int(
            ts_override["shortBreakMinutes"]
            if "shortBreakMinutes" in ts_override
            else (inst_row.get("short_break_minutes") if inst_row.get("short_break_minutes") is not None else 10)
        ),
        "shortBreakEnabled": ts_override.get("shortBreakEnabled", True),
        "middayBreakEnabled": bool(ts_override.get("middayBreakEnabled", inst_row.get("midday_break_enabled", True))),
        "middayBreakStart": ts_override.get("middayBreakStart")
        or ts_override.get("middayBreakStartTime")
        or str(inst_row.get("midday_break_start") or "13:00"),
        "middayBreakDuration": int(
            ts_override.get("middayBreakDuration")
            or ts_override.get("middayBreakDurationMinutes")
            or inst_row.get("midday_break_duration")
            or 60
        ),
        "labDurationMinutes": int(ts_override.get("labDurationMinutes") or inst_row.get("lab_duration_minutes") or 180),
        "labSplitAllowed": bool(ts_override.get("labSplitAllowed", inst_row.get("lab_split_allowed", False))),
        "fridayEnabled": bool(
            ts_override["fridayEnabled"]
            if "fridayEnabled" in ts_override
            else inst_row.get("friday_enabled", "Fri" in working_days)
        ),
        "fridayMode": ts_override.get("fridayMode") or inst_row.get("friday_mode") or "jummah_break",
        "fridayStartTime": ts_override.get("fridayStartTime") or inst_row.get("friday_start_time"),
        "fridayEndTime": ts_override.get("fridayEndTime") or inst_row.get("friday_end_time"),
        "fridayBreakStart": ts_override.get("fridayBreakStart")
        or ts_override.get("fridayBreakStartTime")
        or inst_row.get("friday_break_start")
        or "13:00",
        "fridayBreakEnd": ts_override.get("fridayBreakEnd")
        or ts_override.get("fridayBreakEndTime")
        or ts_override.get("fridayAfternoonStartTime")
        or inst_row.get("friday_break_end")
        or "14:30",
        "fridayClosingTime": ts_override.get("fridayClosingTime") or inst_row.get("friday_closing_time") or "13:00",
        "fridayCompressionScope": ts_override.get("fridayCompressionScope")
        or inst_row.get("friday_compression_scope")
        or "none",
        "fridayPeriodLength": int(
            ts_override.get("fridayPeriodLengthMinutes")
            or ts_override.get("fridayPeriodLength")
            or inst_row.get("friday_period_length")
            or 40
        ),
        "fridayShortBreak": int(
            ts_override["fridayShortBreakMinutes"]
            if "fridayShortBreakMinutes" in ts_override
            else inst_row.get("friday_short_break", 5)
        ),
        "fridayAllowedBatches": ts_override.get("fridayAllowedBatches")
        if ts_override.get("fridayAllowedBatches") is not None
        else (inst_row.get("friday_allowed_batches") or []),
        "fridayAllowedDepartments": ts_override.get("fridayAllowedDepartments")
        if ts_override.get("fridayAllowedDepartments") is not None
        else (inst_row.get("friday_allowed_departments") or []),
    }
    time_config = TimeSlotConfig.from_dict(merged_ts)

    w_raw = body.get("weights") or {}
    weights = OptimizationWeights(
        student_gap_minimization=float(w_raw.get("student_gap_minimization", 0.35)),
        student_fairness=float(w_raw.get("student_fairness", 0.25)),
        instructor_balance=float(w_raw.get("instructor_balance", 0.20)),
        room_utilization=float(w_raw.get("room_utilization", 0.15)),
        preferences=float(w_raw.get("preferences", 0.15)),
    )

    courses = body.get("courses") if isinstance(body.get("courses"), list) and body.get("courses") else normalized_courses
    sections = body.get("sections") if isinstance(body.get("sections"), list) and body.get("sections") else default_sections
    rooms_raw = body.get("classrooms") if isinstance(body.get("classrooms"), list) and body.get("classrooms") else normalized_rooms
    student_groups = body.get("studentGroups") if isinstance(body.get("studentGroups"), list) and body.get("studentGroups") else normalized_groups
    instructors = body.get("instructors") if isinstance(body.get("instructors"), list) and body.get("instructors") else normalized_instructors
    student_prefs = body.get("studentPreferences") if isinstance(body.get("studentPreferences"), list) else db_student_prefs
    inst_prefs = body.get("instructorPreferences") if isinstance(body.get("instructorPreferences"), list) else db_inst_prefs

    return {
        "sections": sections,
        "courses": courses,
        "rooms_raw": rooms_raw,
        "student_groups": student_groups,
        "instructors": instructors,
        "student_preferences": student_prefs,
        "instructor_preferences": inst_prefs,
        "unavailable_instructor_slots": body.get("unavailableInstructorSlots") or unavail_inst,
        "unavailable_room_slots": body.get("unavailableRoomSlots") or {},
        "time_config": time_config,
        "weights": weights,
        "voting_traceability": voting_traceability,
        "voting_excluded": voting_excluded,
        "voting_config": voting_config,
    }
