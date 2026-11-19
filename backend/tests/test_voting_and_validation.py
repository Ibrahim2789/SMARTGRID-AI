"""
Comprehensive API Route, Voting-Optimizer Integration, Preference Aggregation,
Hard-Constraint Regression, and Infeasibility Validation Suite.
Uses `backend.main.app.dispatch(...)` with a full in-memory Supabase PostgREST table stub.
"""

from __future__ import annotations

import copy
import json
import sys
import unittest
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main  # noqa: E402
from app.database.supabase import SupabaseQueryError  # noqa: E402
from app.optimization.constraints import TimeSlotConfig  # noqa: E402
from app.optimization.evaluation import compare_optimization_algorithms  # noqa: E402
from app.optimization.preference_aggregator import compute_batch_preferences_from_records  # noqa: E402
from app.optimization.scheduler import run_hybrid_timetable_pipeline  # noqa: E402
from database import hash_password, sign_auth_token  # noqa: E402


class InMemorySupabaseStub:
    """In-memory PostgREST-compatible stub supporting eq., ilike., in.(...), lt., order, limit."""

    def __init__(self, initial_tables: Optional[Dict[str, List[Dict[str, Any]]]] = None) -> None:
        self.tables: Dict[str, List[Dict[str, Any]]] = {
            k: copy.deepcopy(v) for k, v in (initial_tables or {}).items()
        }

    def _matches(self, row: Dict[str, Any], filters: Optional[Dict[str, str]]) -> bool:
        if not filters:
            return True
        for col, expr in filters.items():
            val = row.get(col)
            expr_s = str(expr)
            if expr_s.startswith("eq."):
                target = expr_s[3:]
                if isinstance(val, bool):
                    if str(val).lower() != target.lower():
                        return False
                elif val is None or str(val) != target:
                    return False
            elif expr_s.startswith("ilike."):
                target = expr_s[6:].lower()
                if val is None or str(val).lower() != target:
                    return False
            elif expr_s.startswith("in.(") and expr_s.endswith(")"):
                items = [x.strip() for x in expr_s[4:-1].split(",") if x.strip()]
                if str(val) not in items:
                    return False
            elif expr_s.startswith("lt."):
                target = expr_s[3:]
                if val is None or str(val) >= target:
                    return False
        return True

    def select(
        self,
        table: str,
        filters: Optional[Dict[str, str]] = None,
        select: str = "*",
        order: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        rows = [copy.deepcopy(r) for r in self.tables.get(table, []) if self._matches(r, filters)]
        if order:
            for part in reversed([p.strip() for p in order.split(",") if p.strip()]):
                bits = part.split(".")
                col = bits[0]
                desc = len(bits) > 1 and bits[1].lower() == "desc"
                rows.sort(key=lambda r: str(r.get(col) or ""), reverse=desc)
        if limit is not None:
            rows = rows[:limit]
        return rows

    def select_one(
        self,
        table: str,
        filters: Optional[Dict[str, str]] = None,
        select: str = "*",
        order: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        res = self.select(table, filters=filters, select=select, order=order, limit=1)
        return res[0] if res else None

    def insert(
        self,
        table: str,
        payload: Any,
        upsert: bool = False,
        on_conflict: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        bucket = self.tables.setdefault(table, [])
        items = payload if isinstance(payload, list) else [payload]
        inserted = []
        conflict_cols = [c.strip() for c in (on_conflict or "").split(",") if c.strip()]
        for item in items:
            row = copy.deepcopy(item)
            if table == "poll_votes":
                for existing in bucket:
                    if existing.get("poll_id") == row.get("poll_id") and existing.get("student_user_id") == row.get("student_user_id"):
                        raise SupabaseQueryError("duplicate key value violates unique constraint", status_code=409)
            if upsert and conflict_cols:
                matched_idx = None
                for idx, ex in enumerate(bucket):
                    if all(ex.get(c) == row.get(c) for c in conflict_cols):
                        matched_idx = idx
                        break
                if matched_idx is not None:
                    bucket[matched_idx] = row
                    inserted.append(copy.deepcopy(row))
                    continue
            bucket.append(row)
            inserted.append(copy.deepcopy(row))
        return inserted

    def update(self, table: str, filters: Dict[str, str], patch_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        bucket = self.tables.setdefault(table, [])
        updated = []
        for row in bucket:
            if self._matches(row, filters):
                row.update(copy.deepcopy(patch_data))
                updated.append(copy.deepcopy(row))
        return updated

    def delete(self, table: str, filters: Dict[str, str]) -> List[Dict[str, Any]]:
        bucket = self.tables.setdefault(table, [])
        kept = []
        deleted = []
        for row in bucket:
            if self._matches(row, filters):
                deleted.append(copy.deepcopy(row))
            else:
                kept.append(row)
        self.tables[table] = kept
        return deleted


@contextmanager
def patch_supabase(stub: InMemorySupabaseStub):
    with (
        patch("app.deps.require_supabase_client", return_value=stub),
        patch("app.routers.voting.require_supabase_client", return_value=stub),
        patch("app.routers.optimization.require_supabase_client", return_value=stub),
        patch("app.routers.timetables.require_supabase_client", return_value=stub),
        patch("app.optimization.preference_aggregator.require_supabase_client", return_value=stub),
    ):
        yield


def _dispatch_json(method: str, url: str, token: Optional[str] = None, body: Optional[Dict[str, Any]] = None):
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    raw = json.dumps(body).encode("utf-8") if body is not None else b""
    status, _hdrs, resp_bytes = main.app.dispatch(method, url, headers, raw)
    return status, json.loads(resp_bytes.decode("utf-8"))


class VotingAndValidationTests(unittest.TestCase):
    def _build_seed_stub(self) -> InMemorySupabaseStub:
        return InMemorySupabaseStub(
            {
                "institutions": [
                    {
                        "id": "inst-test",
                        "name": "Test University",
                        "code": "TU",
                        "working_days": "Mon,Tue,Wed,Thu,Fri",
                        "day_start_time": "09:00",
                        "day_end_time": "17:00",
                        "period_length_minutes": 50,
                        "short_break_minutes": 10,
                        "midday_break_enabled": True,
                        "midday_break_start": "13:00",
                        "midday_break_duration": 60,
                        "lab_duration_minutes": 180,
                        "use_voting_preferences": True,
                        "voting_preference_influence": 0.65,
                        "low_participation_threshold": 25.0,
                    }
                ],
                "batches": [
                    {"id": "batch-a", "code": "2K24-CS-A", "name": "CS 2K24 A", "department_code": "CS", "year": 2, "semester": 4, "student_count": 20, "institution_id": "inst-test"},
                    {"id": "batch-b", "code": "2K24-CS-B", "name": "CS 2K24 B", "department_code": "CS", "year": 2, "semester": 4, "student_count": 20, "institution_id": "inst-test"},
                ],
                "users": [
                    {"id": "u-admin", "name": "Registrar", "email": "admin@tu.edu", "password_hash": hash_password("Pass@123"), "role": "admin", "institution_id": "inst-test", "is_active": True},
                    {"id": "u-stu-a1", "name": "Student A1", "email": "a1@tu.edu", "password_hash": hash_password("Pass@123"), "role": "student", "batch_id": "batch-a", "section": "A", "institution_id": "inst-test", "is_active": True},
                    {"id": "u-stu-b1", "name": "Student B1", "email": "b1@tu.edu", "password_hash": hash_password("Pass@123"), "role": "student", "batch_id": "batch-b", "section": "B", "institution_id": "inst-test", "is_active": True},
                ],
                "br_assignments": [],
                "polls": [],
                "poll_options": [],
                "poll_votes": [],
                "instructors": [
                    {"id": "inst-1", "name": "Dr. Turing", "institution_id": "inst-test", "staff_role": "faculty"},
                    {"id": "inst-2", "name": "Dr. Hopper", "institution_id": "inst-test", "staff_role": "faculty"},
                ],
                "classrooms": [
                    {"id": "rm-1", "code": "LH-101", "name": "LH-101", "capacity": 80, "room_type": "lecture", "is_available": True, "institution_id": "inst-test"},
                    {"id": "rm-2", "code": "LH-102", "name": "LH-102", "capacity": 80, "room_type": "lecture", "is_available": True, "institution_id": "inst-test"},
                ],
                "laboratories": [],
                "room_equipment_capacities": [],
                "courses": [
                    {"id": "crs-1", "code": "CS-101", "title": "Algorithms", "course_type": "lecture", "lecture_credit_hours": 3, "lab_credit_hours": 0, "credit_hours": 3, "assigned_instructor_id": "inst-1", "institution_id": "inst-test"},
                    {"id": "crs-2", "code": "CS-102", "title": "Systems", "course_type": "lecture", "lecture_credit_hours": 3, "lab_credit_hours": 0, "credit_hours": 3, "assigned_instructor_id": "inst-2", "institution_id": "inst-test"},
                ],
                "course_sessions": [
                    {"id": "cs-a1", "course_id": "crs-1", "batch_id": "batch-a", "instructor_id": "inst-1", "section_code": "A", "session_type": "Theory", "component_type": "lecture", "sessions_per_week": 3, "expected_students": 20, "institution_id": "inst-test"},
                    {"id": "cs-b1", "course_id": "crs-2", "batch_id": "batch-b", "instructor_id": "inst-2", "section_code": "B", "session_type": "Theory", "component_type": "lecture", "sessions_per_week": 3, "expected_students": 20, "institution_id": "inst-test"},
                ],
                "student_preferences": [],
                "instructor_preferences": [],
                "instructor_availability": [],
                "timetable_versions": [],
                "timetable_entries": [],
                "optimization_runs": [],
                "optimization_scores": [],
                "optimization_poll_traceability": [],
                "timetable_feedback": [],
                "notifications": [],
            }
        )

    def test_01_full_api_voting_lifecycle_traceability_and_gates(self) -> None:
        stub = self._build_seed_stub()
        admin_tok = sign_auth_token({"userId": "u-admin", "role": "admin", "institutionId": "inst-test"})
        stu_a1_tok = sign_auth_token({"userId": "u-stu-a1", "role": "student", "institutionId": "inst-test", "batchId": "batch-a"})
        stu_b1_tok = sign_auth_token({"userId": "u-stu-b1", "role": "student", "institutionId": "inst-test", "batchId": "batch-b"})

        with patch_supabase(stub):
            # 1. Admin creates Male BR for batch-a
            st, res = _dispatch_json(
                "POST",
                "/api/voting/admin/br-accounts",
                token=admin_tok,
                body={
                    "name": "Ali Raza",
                    "email": "br.a@tu.edu",
                    "password": "BrPass@2026",
                    "batchId": "batch-a",
                    "genderRole": "male",
                },
            )
            self.assertEqual(st, 201, res)
            br_id = res["issuedCredentials"]["userId"]
            br_tok = sign_auth_token({"userId": br_id, "role": "br", "institutionId": "inst-test", "batchId": "batch-a"})

            # 2. Invalid pollCategory must return HTTP 400
            st_bad, _ = _dispatch_json(
                "POST",
                "/api/voting/br/polls",
                token=br_tok,
                body={
                    "title": "Invalid Cat Poll",
                    "description": "Testing invalid category enforcement.",
                    "options": ["Option 1", "Option 2"],
                    "pollCategory": "not_a_category",
                },
            )
            self.assertEqual(st_bad, 400)

            # 3. BR submits valid poll scoped to submitting_batch with category preferred_lecture_timing
            st, created = _dispatch_json(
                "POST",
                "/api/voting/br/polls",
                token=br_tok,
                body={
                    "title": "Preferred Lecture Timing Window for CS 2K24 A",
                    "description": "Select preferred lecture block for morning vs afternoon attendance.",
                    "options": ["Morning (09:00 AM - 12:00 PM)", "Afternoon (02:00 PM - 05:00 PM)"],
                    "targetScope": "submitting_batch",
                    "pollCategory": "preferred_lecture_timing",
                },
            )
            self.assertEqual(st, 201, created)
            poll = created["poll"]
            poll_id = poll["id"]
            self.assertEqual(poll["pollCategory"], "preferred_lecture_timing")
            self.assertEqual(poll["optimizerApprovalStatus"], "pending_review")

            # 4. Admin publishes poll
            st, _ = _dispatch_json(
                "PATCH",
                f"/api/voting/admin/polls/{poll_id}/status",
                token=admin_tok,
                body={"status": "Published"},
            )
            self.assertEqual(st, 200)

            # 5. Cross-batch student (batch-b) cannot vote on submitting_batch poll -> HTTP 403
            opt_morning_id = poll["options"][0]["id"]
            st_cross, _ = _dispatch_json(
                "POST",
                f"/api/voting/polls/{poll_id}/vote",
                token=stu_b1_tok,
                body={"optionId": opt_morning_id},
            )
            self.assertEqual(st_cross, 403)

            # 6. In-batch student casts vote -> 201; duplicate vote -> 409
            st_v1, _ = _dispatch_json(
                "POST",
                f"/api/voting/polls/{poll_id}/vote",
                token=stu_a1_tok,
                body={"optionId": opt_morning_id},
            )
            self.assertEqual(st_v1, 201)
            st_dup, _ = _dispatch_json(
                "POST",
                f"/api/voting/polls/{poll_id}/vote",
                token=stu_a1_tok,
                body={"optionId": opt_morning_id},
            )
            self.assertEqual(st_dup, 409)

            # 7. Admin closes poll; while optimizer_approval_status is pending_review, active-preferences stays empty
            _dispatch_json("PATCH", f"/api/voting/admin/polls/{poll_id}/status", token=admin_tok, body={"status": "Closed"})
            st_act1, act1 = _dispatch_json("GET", "/api/voting/admin/active-preferences", token=admin_tok)
            self.assertEqual(st_act1, 200)
            self.assertEqual(act1["batchPreferences"], {})

            # 8. Admin approves poll for optimizer -> active-preferences now populated for batch-a (batch-b excluded!)
            st_app, app_res = _dispatch_json(
                "PATCH",
                f"/api/voting/admin/polls/{poll_id}/optimizer-approval",
                token=admin_tok,
                body={"approvalStatus": "approved_for_optimizer"},
            )
            self.assertEqual(st_app, 200)
            self.assertEqual(app_res["poll"]["optimizerApprovalStatus"], "approved_for_optimizer")

            st_act2, act2 = _dispatch_json("GET", "/api/voting/admin/active-preferences", token=admin_tok)
            self.assertEqual(st_act2, 200)
            self.assertIn("batch-a", act2["batchPreferences"])
            self.assertEqual(act2["batchPreferences"]["batch-a"]["preferred_time_window"], "morning")
            self.assertNotIn("batch-b", act2["batchPreferences"])

            # 9. Admin updates optimizer config -> verified via GET
            st_cfg, _ = _dispatch_json(
                "PATCH",
                "/api/voting/admin/optimizer-config",
                token=admin_tok,
                body={"useVotingPreferences": True, "votingPreferenceInfluence": 0.85, "lowParticipationThreshold": 20},
            )
            self.assertEqual(st_cfg, 200)
            st_cfg_get, cfg_get = _dispatch_json("GET", "/api/voting/admin/optimizer-config", token=admin_tok)
            self.assertEqual(st_cfg_get, 200)
            self.assertAlmostEqual(cfg_get["votingPreferenceInfluence"], 0.85, places=2)

            # 10. Run Optimization endpoint persists optimization_poll_traceability & returns votingTraceability
            st_opt, opt_res = _dispatch_json(
                "POST",
                "/api/optimization/run",
                token=admin_tok,
                body={"algorithm": "hybrid_dsatur_ga_sa"},
            )
            self.assertEqual(st_opt, 200, opt_res)
            self.assertEqual(opt_res["hardConstraintViolations"], 0)
            self.assertTrue(opt_res["feasible"])
            self.assertEqual(len(opt_res["votingTraceability"]), 1)
            self.assertEqual(opt_res["votingTraceability"][0]["pollId"], poll_id)
            self.assertEqual(len(stub.tables["optimization_poll_traceability"]), 1)

            # 11. Post-publication feedback endpoint save & retrieve
            tt_id = opt_res["timetableVersionId"]
            st_fb, _ = _dispatch_json(
                "POST",
                f"/api/timetables/{tt_id}/feedback",
                token=stu_a1_tok,
                body={"timingsRating": 5, "compactnessRating": 4, "gapsRating": 5, "freeDayRating": 4, "overallRating": 5, "preferredAdjustmentNote": "Great morning slots"},
            )
            self.assertEqual(st_fb, 201)
            st_fb_get, fb_get = _dispatch_json("GET", f"/api/timetables/{tt_id}/feedback", token=admin_tok)
            self.assertEqual(st_fb_get, 200)
            self.assertEqual(fb_get["totalFeedback"], 1)
            self.assertEqual(fb_get["averages"]["overall"], 5.0)

            # 12. Publish gate blocks draft with hard_violations_count > 0 (HTTP 422)
            stub.insert("timetable_versions", {"id": "ttv-bad", "institution_id": "inst-test", "name": "Bad Draft", "status": "draft", "hard_violations_count": 3, "overall_fitness_score": 40.0})
            st_pub_bad, _ = _dispatch_json("POST", "/api/timetables/ttv-bad/publish", token=admin_tok)
            self.assertEqual(st_pub_bad, 422)

    def test_02_per_batch_normalization_zero_vote_exclusion_and_dampening(self) -> None:
        polls = [
            {
                "id": "p-lec",
                "title": "Lecture Timing",
                "status": "Closed",
                "optimizer_approval_status": "approved_for_optimizer",
                "poll_category": "preferred_lecture_timing",
                "target_scope": "all_batches",
                "batch_id": "b-large",
                "closed_at": "2026-11-18T10:00:00Z",
            },
            {
                "id": "p-unapproved",
                "title": "Unapproved Poll",
                "status": "Closed",
                "optimizer_approval_status": "pending_review",
                "poll_category": "preferred_free_day",
                "target_scope": "all_batches",
                "batch_id": "b-large",
            },
        ]
        options = [
            {"id": "o-morn", "poll_id": "p-lec", "label": "Morning Lecture Block (09:00-12:00)"},
            {"id": "o-aft", "poll_id": "p-lec", "label": "Afternoon Lecture Block (14:00-17:00)"},
        ]
        batches = [
            {"id": "b-large", "code": "LARGE", "student_count": 200},
            {"id": "b-small", "code": "SMALL", "student_count": 20},
            {"id": "b-zero", "code": "ZERO", "student_count": 40},
        ]
        votes = (
            [{"poll_id": "p-lec", "option_id": "o-morn", "student_user_id": f"sl-{i}", "batch_id": "b-large"} for i in range(100)]
            + [{"poll_id": "p-lec", "option_id": "o-aft", "student_user_id": f"ss-{i}", "batch_id": "b-small"} for i in range(15)]
            # Inject duplicate vote for ss-0 that must be ignored defensively
            + [{"poll_id": "p-lec", "option_id": "o-morn", "student_user_id": "ss-0", "batch_id": "b-small"}]
        )
        agg = compute_batch_preferences_from_records(polls, options, votes, batches, weights_influence=0.65, low_participation_threshold=25.0)
        prefs = agg["batchPreferences"]
        self.assertIn("b-large", prefs)
        self.assertIn("b-small", prefs)
        self.assertNotIn("b-zero", prefs)  # Zero-vote exclusion!
        # Large batch (100 morning votes) must NOT drown out small batch (15 afternoon votes)
        self.assertEqual(prefs["b-large"]["preferred_time_window"], "morning")
        self.assertEqual(prefs["b-small"]["preferred_time_window"], "afternoon")
        reasons = {e.get("batchId") or e.get("pollId"): e["reason"] for e in agg["excluded"]}
        self.assertEqual(reasons.get("b-zero"), "zero_votes_in_batch")
        self.assertIn("optimizer_approval_status_not_approved", reasons.get("p-unapproved", ""))

        # Participation monotonicity check (10% vs 50% vs 100% of 100 students)
        votes_10 = [{"poll_id": "p-lec", "option_id": "o-morn", "student_user_id": f"u{i}", "batch_id": "b1"} for i in range(10)]
        votes_50 = [{"poll_id": "p-lec", "option_id": "o-morn", "student_user_id": f"u{i}", "batch_id": "b1"} for i in range(50)]
        votes_100 = [{"poll_id": "p-lec", "option_id": "o-morn", "student_user_id": f"u{i}", "batch_id": "b1"} for i in range(100)]
        b_100 = [{"id": "b1", "code": "B1", "student_count": 100}]
        p_10 = compute_batch_preferences_from_records([polls[0]], options, votes_10, b_100, 0.65, 25.0)["batchPreferences"]["b1"]["preferenceStrength"]
        p_50 = compute_batch_preferences_from_records([polls[0]], options, votes_50, b_100, 0.65, 25.0)["batchPreferences"]["b1"]["preferenceStrength"]
        p_100 = compute_batch_preferences_from_records([polls[0]], options, votes_100, b_100, 0.65, 25.0)["batchPreferences"]["b1"]["preferenceStrength"]
        self.assertLess(p_10, p_50)
        self.assertLess(p_50, p_100)

    def test_03_infeasibility_detection_with_voting_enabled_and_disabled(self) -> None:
        # Impossible dataset: 1 lecture room, 1 instructor, 25 hours/week across 1 single cohort (max capacity ~35 slots/wk, but 2 courses x 1 instructor across narrow window)
        # Specifically: 1 instructor blocked on ALL slots except Mon-09:00, tasked with 3 credit hours! Impossible regardless of voting.
        cfg = TimeSlotConfig(friday_enabled=False)
        courses = [{"id": "c1", "code": "CS-999", "title": "Impossible Course", "courseType": "lecture", "lectureCredits": 3, "credits": 3, "assignedInstructorId": "i-busy"}]
        sections = [{"id": "s1", "courseId": "c1", "studentGroupId": "b1", "instructorId": "i-busy", "sessionType": "Theory", "sessionsPerWeek": 3, "expectedStudents": 40}]
        rooms = [{"id": "r1", "code": "LH-1", "type": "lecture", "capacity": 60, "isAvailable": True}]
        groups = [{"id": "b1", "code": "B1", "size": 40}]
        instructors = [{"id": "i-busy", "name": "Dr. Busy"}]
        # Block all Mon-Thu slots except Mon-09:00
        blocked = [f"{d}-{t}" for d in ["Mon", "Tue", "Wed", "Thu"] for t in cfg.generate_daily_lecture_slots() if not (d == "Mon" and t == "09:00")]
        unavail = {"i-busy": blocked}
        voted_prefs = [{"batch_id": "b1", "preferred_time_window": "afternoon", "preferenceStrength": 0.95}]

        res_no_vote = run_hybrid_timetable_pipeline(sections, courses, rooms, groups, instructors, cfg, unavailable_instructor_slots=unavail, student_preferences=[], seed=42)
        res_with_vote = run_hybrid_timetable_pipeline(sections, courses, rooms, groups, instructors, cfg, unavailable_instructor_slots=unavail, student_preferences=voted_prefs, seed=42)

        self.assertFalse(res_no_vote["feasible"])
        self.assertGreater(res_no_vote["hardConstraintViolations"], 0)
        self.assertFalse(res_with_vote["feasible"])
        self.assertGreater(res_with_vote["hardConstraintViolations"], 0)

    def test_04_fixed_seed_reproducibility_check(self) -> None:
        from tests.audit_benchmark import build_realistic_university_dataset
        ds = build_realistic_university_dataset()
        cfg = TimeSlotConfig()
        scores = []
        for _ in range(3):
            res = run_hybrid_timetable_pipeline(
                sections=ds["sections"],
                courses=ds["courses"],
                rooms_raw=ds["rooms_raw"],
                student_groups=ds["student_groups"],
                instructors=ds["instructors"],
                time_config=cfg,
                student_preferences=ds["student_preferences"],
                unavailable_instructor_slots=ds["unavailable_instructor_slots"],
                unavailable_room_slots=ds["unavailable_room_slots"],
                algorithm="hybrid_dsatur_ga_sa",
                seed=42,
            )
            self.assertEqual(res["hardConstraintViolations"], 0)
            scores.append(res["fitness"]["totalScore"])
        self.assertEqual(len(set(scores)), 1, f"Fixed seed 42 must be deterministic, got {scores}")

        # Compare algorithms forwards seed deterministically
        comp = compare_optimization_algorithms(
            sections=ds["sections"],
            courses=ds["courses"],
            rooms_raw=ds["rooms_raw"],
            student_groups=ds["student_groups"],
            time_config=cfg,
            instructors=ds["instructors"],
            seed=77,
        )
        self.assertEqual(len(comp["comparisons"]), 4)
        self.assertTrue(all(c["feasible"] for c in comp["comparisons"]))

    def test_05_fairness_weight_sensitivity_and_staff_immutability(self) -> None:
        from app.optimization.scheduler import OptimizationWeights

        cfg_scarce = TimeSlotConfig(working_days=["Mon", "Tue", "Wed", "Thu"], friday_enabled=False)
        groups = [
            {"id": "cb1", "code": "CONT-A", "size": 50},
            {"id": "cb2", "code": "CONT-B", "size": 50},
            {"id": "cb3", "code": "CONT-C", "size": 50},
        ]
        insts = [
            {"id": "ci1", "name": "Prof One", "unavailableSlots": [{"day": "Mon", "timeSlot": "9:00 – 9:50 AM"}]},
            {"id": "ci2", "name": "Prof Two"},
            {"id": "ci3", "name": "Prof Three"},
            {"id": "ci4", "name": "Prof Four"},
        ]
        courses = [
            {"id": f"cc{i}", "code": f"M{i}", "title": f"Course {i}", "courseType": "lecture", "lectureCredits": 3, "creditHours": 3}
            for i in range(1, 5)
        ]
        rooms = [
            {"id": "cr1", "code": "R1", "type": "lecture", "capacity": 60, "isAvailable": True},
            {"id": "cr2", "code": "R2", "type": "lecture", "capacity": 60, "isAvailable": True},
        ]
        sections = [
            {"id": f"cs-{g['id']}-{i}", "courseId": f"cc{i}", "studentGroupId": g["id"], "instructorId": f"ci{i}", "sessionType": "Theory", "sessionsPerWeek": 3}
            for g in groups
            for i in range(1, 5)
        ]
        prefs = [
            {"batch_id": g["id"], "preferred_time_window": "morning", "preferred_free_day": "Thu", "preferenceStrength": 0.90}
            for g in groups
        ]
        expected_inst = {s["id"]: s["instructorId"] for s in sections}

        res_low = run_hybrid_timetable_pipeline(
            sections=sections,
            courses=courses,
            rooms_raw=rooms,
            student_groups=groups,
            instructors=insts,
            time_config=cfg_scarce,
            weights=OptimizationWeights(student_gap_minimization=0.35, student_fairness=0.00, instructor_balance=0.15, room_utilization=0.10, preferences=0.15),
            algorithm="hybrid_dsatur_ga_sa",
            student_preferences=prefs,
            seed=42,
        )
        res_high = run_hybrid_timetable_pipeline(
            sections=sections,
            courses=courses,
            rooms_raw=rooms,
            student_groups=groups,
            instructors=insts,
            time_config=cfg_scarce,
            weights=OptimizationWeights(student_gap_minimization=0.35, student_fairness=0.95, instructor_balance=0.15, room_utilization=0.10, preferences=0.15),
            algorithm="hybrid_dsatur_ga_sa",
            student_preferences=prefs,
            seed=42,
        )
        self.assertEqual(res_low["hardConstraintViolations"], 0)
        self.assertEqual(res_high["hardConstraintViolations"], 0)
        self.assertEqual(res_low["fitness"]["objectiveBreakdown"]["fairnessSharePct"], 0.0)
        self.assertEqual(res_low["fitness"]["objectiveBreakdown"]["fairnessWeightedContribution"], 0.0)
        self.assertGreater(res_high["fitness"]["objectiveBreakdown"]["fairnessSharePct"], 45.0)
        self.assertGreater(
            res_high["fitness"]["fairnessScore"],
            res_low["fitness"]["fairnessScore"],
        )
        self.assertGreater(
            res_high["fitness"]["leastSatisfiedBatchScore"],
            res_low["fitness"]["leastSatisfiedBatchScore"],
        )
        self.assertLess(
            res_high["fitness"]["satisfactionSpread"],
            res_low["fitness"]["satisfactionSpread"],
        )
        for res in (res_low, res_high):
            for entry in res["entries"]:
                self.assertEqual(entry["instructorId"], expected_inst[entry["sectionId"]])


if __name__ == "__main__":
    unittest.main()
