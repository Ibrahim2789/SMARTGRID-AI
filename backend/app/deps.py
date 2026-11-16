"""
Shared request parsing, Supabase HTTP error translation, authentication/RBAC guards,
voting enrichment, and optimization catalog loading helpers for SmartGrid AI routers.
"""

from __future__ import annotations

import json
from collections import defaultdict
from typing import Any, Dict, List, NoReturn, Optional

from app.database.supabase import SupabaseQueryError, require_supabase_client
from database import now_iso, sign_auth_token, verify_auth_token
from fastapi_compat import HTTPException, Request


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
        # Auto-close expired published polls (ignore RLS error if caller lacks write permissions)
        try:
            client.update(
                "polls",
                {"status": "eq.Published", "end_at": f"lt.{current_iso}"},
                {"status": "Closed", "closed_at": current_iso, "updated_at": current_iso},
            )
        except SupabaseQueryError:
            pass

        all_inst_polls = client.select(
            "polls",
            filters={"institution_id": f"eq.{user_inst_id}"},
            order="created_at.desc",
        )

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
        if role == "admin":
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
        if role == "admin" or can_view_results:
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


def load_university_optimization_inputs(
    university_id: str,
    override_body: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Loads courses, course_sessions, classrooms, laboratories, room_equipment_capacities,
    instructors, batches/student_groups, and TimeSlotConfig for the given university_id
    from Supabase PostgreSQL, allowing optional overrides in request body.
    """
    from app.optimization.constraints import TimeSlotConfig
    from app.optimization.fitness import OptimizationWeights

    body = override_body or {}
    client = require_supabase_client()

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

    equip_by_room: Dict[str, List[str]] = defaultdict(list)
    for eq in db_equip:
        if eq.get("room_id") and eq.get("equipment_name"):
            equip_by_room[eq["room_id"]].append(eq["equipment_name"])

    course_by_id = {c["id"]: c for c in db_courses}
    sessions_by_course: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for s in db_sessions:
        sessions_by_course[s["course_id"]].append(s)

    default_instructor_id = db_instructors[0]["id"] if db_instructors else ""
    default_batch_id = db_batches[0]["id"] if db_batches else ""

    normalized_courses: List[Dict[str, Any]] = []
    default_sections: List[Dict[str, Any]] = []

    for c in db_courses:
        req_eq = c.get("required_equipment") if isinstance(c.get("required_equipment"), list) else safe_json_loads(c.get("required_equipment"), [])
        is_lab = int(c.get("lab_hours_per_week") or 0) > 0 and int(c.get("lecture_hours_per_week") or 0) == 0
        ctype = "Lab" if is_lab else "Theory"
        normalized_courses.append(
            {
                **c,
                "type": ctype,
                "credits": int(c.get("credit_hours") or (1 if is_lab else 3)),
                "required_equipment": req_eq,
                "requiredEquipment": req_eq,
            }
        )
        c_sessions = sessions_by_course.get(c["id"], [])
        if c_sessions:
            for s in c_sessions:
                default_sections.append(
                    {
                        "id": s["id"],
                        "courseId": c["id"],
                        "courseCode": c["code"],
                        "instructorId": s.get("instructor_id") or default_instructor_id,
                        "studentGroupId": s.get("batch_id") or default_batch_id,
                        "sectionCode": s.get("section_code") or "A",
                        "sessionType": s.get("session_type") or ctype,
                        "enrollment": int(s.get("expected_students") or 60),
                    }
                )
        else:
            default_sections.append(
                {
                    "id": f"sec-{c['id']}-a",
                    "courseId": c["id"],
                    "courseCode": c["code"],
                    "instructorId": default_instructor_id,
                    "studentGroupId": default_batch_id,
                    "sectionCode": "A",
                    "sessionType": ctype,
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
                "size": int(b.get("student_count") or 60),
            }
        )

    working_days_raw = inst_row.get("working_days") or "Mon,Tue,Wed,Thu,Fri"
    working_days = [d.strip() for d in str(working_days_raw).split(",") if d.strip()]
    time_config = TimeSlotConfig(
        working_days=working_days or ["Mon", "Tue", "Wed", "Thu", "Fri"],
        day_start_time=str(inst_row.get("day_start_time") or "09:00"),
        day_end_time=str(inst_row.get("day_end_time") or "17:00"),
        period_length_minutes=int(inst_row.get("period_length_minutes") or 50),
        short_break_minutes=int(inst_row.get("short_break_minutes") or 10),
        midday_break_enabled=bool(inst_row.get("midday_break_enabled", True)),
        midday_break_start=str(inst_row.get("midday_break_start") or "13:00"),
        midday_break_duration=int(inst_row.get("midday_break_duration") or 60),
        lab_duration_minutes=int(inst_row.get("lab_duration_minutes") or 180),
    )

    courses = body.get("courses") if isinstance(body.get("courses"), list) and body.get("courses") else normalized_courses
    sections = body.get("sections") if isinstance(body.get("sections"), list) and body.get("sections") else default_sections
    rooms_raw = body.get("classrooms") if isinstance(body.get("classrooms"), list) and body.get("classrooms") else normalized_rooms
    student_groups = body.get("studentGroups") if isinstance(body.get("studentGroups"), list) and body.get("studentGroups") else normalized_groups

    return {
        "sections": sections,
        "courses": courses,
        "rooms_raw": rooms_raw,
        "student_groups": student_groups,
        "time_config": time_config,
        "weights": OptimizationWeights(),
    }
