"""
SmartGrid AI — Comprehensive Automated Backend Test Suite
Tests:
1. Authentication, Password Hashing (scrypt), JWT Tokens, and Role-Based Access Control
2. Multi-University Isolation & Dynamic Time-Slot Engine
3. Custom DSatur Graph Coloring Conflict Resolution
4. Custom Genetic Algorithm (GA) & Simulated Annealing (SA) Optimization
5. Student-Centric Multi-Objective Fitness & Rawlsian Batch Fairness
6. Custom Tabu Search Adaptive Rescheduling & Stability Preservation
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

# Ensure /backend is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.optimization.constraints import (  # noqa: E402
    RoomResource,
    TimeSlotConfig,
    expand_sections_to_sessions,
)
from app.optimization.evaluation import compare_optimization_algorithms  # noqa: E402
from app.optimization.graph_coloring import (  # noqa: E402
    build_conflict_graph,
    run_dsatur_initial_schedule,
)
from app.optimization.rescheduler import generate_rescheduling_proposal  # noqa: E402
from app.optimization.scheduler import run_hybrid_timetable_pipeline  # noqa: E402
from app.optimization.validator import validate_timetable_assignments  # noqa: E402
from database import (  # noqa: E402
    hash_password,
    initialize_voting_database,
    sign_auth_token,
    verify_auth_token,
    verify_password,
)
from main import get_user_auth_context  # noqa: E402


def sample_test_catalog():
    courses = [
        {
            "id": "crs-algo",
            "code": "CS-301",
            "title": "Design & Analysis of Algorithms",
            "type": "Theory",
            "credits": 3,
            "requiredEquipment": ["Projector"],
        },
        {
            "id": "crs-ai",
            "code": "CS-302",
            "title": "Artificial Intelligence",
            "type": "Theory",
            "credits": 3,
            "requiredEquipment": ["Projector"],
        },
        {
            "id": "crs-ailab",
            "code": "CS-302L",
            "title": "Artificial Intelligence Lab",
            "type": "Lab",
            "credits": 1,
            "requiredEquipment": ["GPUWorkstations"],
        },
        {
            "id": "crs-se",
            "code": "SE-301",
            "title": "Software Architecture",
            "type": "Theory",
            "credits": 3,
            "requiredEquipment": ["Projector"],
        },
    ]
    sections = [
        {
            "id": "sec-algo-a",
            "courseId": "crs-algo",
            "courseCode": "CS-301",
            "instructorId": "inst-turing",
            "studentGroupId": "batch-2k25-bscs",
            "sectionCode": "A",
            "sessionType": "Theory",
            "enrollment": 100,
        },
        {
            "id": "sec-ai-a",
            "courseId": "crs-ai",
            "courseCode": "CS-302",
            "instructorId": "inst-lovelace",
            "studentGroupId": "batch-2k25-bscs",
            "sectionCode": "A",
            "sessionType": "Theory",
            "enrollment": 100,
        },
        {
            "id": "sec-ailab-a",
            "courseId": "crs-ailab",
            "courseCode": "CS-302L",
            "instructorId": "inst-lovelace",
            "studentGroupId": "batch-2k25-bscs",
            "sectionCode": "A",
            "sessionType": "Lab",
            "enrollment": 100,
        },
        {
            "id": "sec-se-a",
            "courseId": "crs-se",
            "courseCode": "SE-301",
            "instructorId": "inst-jehanzeb",
            "studentGroupId": "batch-2k24-bese",
            "sectionCode": "A",
            "sessionType": "Theory",
            "enrollment": 90,
        },
    ]
    rooms_raw = [
        {
            "id": "room-101",
            "code": "LH-101",
            "name": "LH-101",
            "type": "lecture",
            "capacity": 120,
            "equipment": ["Projector", "SmartBoard"],
            "isAvailable": True,
        },
        {
            "id": "room-102",
            "code": "LH-102",
            "name": "LH-102",
            "type": "lecture",
            "capacity": 110,
            "equipment": ["Projector"],
            "isAvailable": True,
        },
        {
            "id": "room-lab-301",
            "code": "LAB-301",
            "name": "LAB-301",
            "type": "lab",
            "capacity": 120,
            "equipment": ["GPUWorkstations", "Projector"],
            "isAvailable": True,
        },
    ]
    student_groups = [
        {"id": "batch-2k25-bscs", "batchId": "batch-2k25-bscs", "code": "2K25-BSCS", "size": 100},
        {"id": "batch-2k24-bese", "batchId": "batch-2k24-bese", "code": "2K24-BESE", "size": 90},
    ]
    return sections, courses, rooms_raw, student_groups


class SmartGridBackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        initialize_voting_database()

    def test_01_password_hashing_and_jwt_tokens(self) -> None:
        pw_hash = hash_password("SecurePass@2026")
        self.assertTrue(verify_password("SecurePass@2026", pw_hash))
        self.assertFalse(verify_password("WrongPassword", pw_hash))

        token = sign_auth_token({"userId": "user-admin-reynolds", "role": "admin", "institutionId": "inst-western-poly"})
        decoded = verify_auth_token(token)
        self.assertIsNotNone(decoded)
        assert decoded is not None
        self.assertEqual(decoded["userId"], "user-admin-reynolds")
        self.assertEqual(decoded["role"], "admin")

    def test_02_role_mapping_and_multi_university_context(self) -> None:
        from unittest.mock import patch
        from app.core.config import settings

        fake_users = {
            "user-admin-reynolds": {
                "id": "user-admin-reynolds",
                "name": "Dr. Katherine Reynolds",
                "email": "k.reynolds@westernpoly.edu",
                "role": "admin",
                "institution": "Western Polytechnic",
                "institution_id": "inst-western-poly",
                "batch_id": None,
                "is_active": True,
            },
            "user-apex-admin": {
                "id": "user-apex-admin",
                "name": "Dr. Arthur Vance",
                "email": "admin@apextech.edu",
                "role": "admin",
                "institution": "Apex Institute of Technology & Sciences",
                "institution_id": "inst-apex-tech",
                "batch_id": None,
                "is_active": True,
            },
        }

        class _StubClient:
            def select_one(self, table, filters=None, select="*", order=None):
                if table == "users" and filters and "id" in filters:
                    uid = filters["id"].replace("eq.", "")
                    return fake_users.get(uid)
                return None

        with patch("app.deps.require_supabase_client", return_value=_StubClient()):
            admin_ctx = get_user_auth_context("user-admin-reynolds")
            apex_admin_ctx = get_user_auth_context("user-apex-admin")

        self.assertIsNotNone(admin_ctx)
        self.assertIsNotNone(apex_admin_ctx)
        assert admin_ctx is not None and apex_admin_ctx is not None
        self.assertEqual(admin_ctx["systemRole"], "admin")
        self.assertEqual(admin_ctx["role"], "Registrar")
        self.assertEqual(admin_ctx["institutionId"], "inst-western-poly")
        self.assertEqual(apex_admin_ctx["institutionId"], "inst-apex-tech")

    def test_03_dynamic_timeslot_configuration_and_midday_break(self) -> None:
        cfg = TimeSlotConfig(
            working_days=["Mon", "Tue", "Wed", "Thu", "Fri"],
            day_start_time="09:00",
            day_end_time="17:00",
            period_length_minutes=50,
            short_break_minutes=10,
            midday_break_enabled=True,
            midday_break_start="13:00",
            midday_break_duration=60,
            lab_duration_minutes=180,
        )
        slot_starts = cfg.generate_daily_lecture_slots()
        self.assertNotIn("13:00", slot_starts)
        self.assertIn("09:00", slot_starts)
        self.assertIn("14:00", slot_starts)
        self.assertGreaterEqual(len(cfg.generate_valid_lab_start_slots()), 1)

    def test_04_dsatur_graph_coloring_conflict_free_schedule(self) -> None:
        sections, courses, rooms_raw, student_groups = sample_test_catalog()
        cfg = TimeSlotConfig()
        sessions = expand_sections_to_sessions(sections, courses, student_groups)
        adj = build_conflict_graph(sessions)
        self.assertGreater(len(adj[sessions[0].session_id]), 0)

        rooms = [
            RoomResource(
                room_id=r["id"],
                code=r["code"],
                name=r["name"],
                capacity=r["capacity"],
                room_type=r["type"],
                equipment=r["equipment"],
                is_available=r["isAvailable"],
            )
            for r in rooms_raw
        ]

        genes = run_dsatur_initial_schedule(
            sessions=sessions,
            rooms=rooms,
            time_config=cfg,
        )
        self.assertEqual(len(genes), len(sessions))
        validation = validate_timetable_assignments(genes, sessions, rooms, cfg)
        self.assertTrue(validation.is_valid)
        self.assertEqual(validation.hard_violation_count, 0)

    def test_05_genetic_algorithm_and_simulated_annealing_refinement(self) -> None:
        sections, courses, rooms_raw, student_groups = sample_test_catalog()
        pipeline_res = run_hybrid_timetable_pipeline(
            sections=sections,
            courses=courses,
            rooms_raw=rooms_raw,
            student_groups=student_groups,
            algorithm="hybrid_dsatur_ga_sa",
        )
        fb = pipeline_res["fitness"]
        self.assertTrue(pipeline_res["feasible"])
        self.assertEqual(pipeline_res["hardConstraintViolations"], 0)
        self.assertGreater(fb["totalScore"], 0)
        self.assertGreater(fb["fairnessScore"], 0)
        self.assertGreater(fb["studentSatisfaction"], 0)

    def test_06_multi_algorithm_comparison_benchmark(self) -> None:
        sections, courses, rooms_raw, student_groups = sample_test_catalog()
        comp = compare_optimization_algorithms(
            sections=sections,
            courses=courses,
            rooms_raw=rooms_raw,
            student_groups=student_groups,
        )
        algos = [c["algorithmId"] for c in comp["comparisons"]]
        self.assertEqual(algos, ["dsatur_only", "ga_only", "ga_sa", "hybrid_dsatur_ga_sa"])
        for c in comp["comparisons"]:
            self.assertEqual(c["hardConstraintViolations"], 0)

    def test_07_tabu_search_adaptive_rescheduling_minimal_perturbation(self) -> None:
        sections, courses, rooms_raw, student_groups = sample_test_catalog()
        cfg = TimeSlotConfig()
        initial = run_hybrid_timetable_pipeline(
            sections=sections,
            courses=courses,
            rooms_raw=rooms_raw,
            student_groups=student_groups,
            time_config=cfg,
            algorithm="hybrid_dsatur_ga_sa",
        )
        assignments = initial["assignments"]
        self.assertGreater(len(assignments), 0)

        target_sec = assignments["sec-algo-a"]
        proposal = generate_rescheduling_proposal(
            disruption_type="instructor_unavailable",
            affected_resource_id="inst-turing",
            affected_days=[target_sec["day"]],
            affected_start_times=[target_sec["startTime"]],
            reason="Prof. Turing attending conference keynote",
            current_section_assignments=assignments,
            sections=sections,
            courses=courses,
            rooms_raw=rooms_raw,
            student_groups=student_groups,
            time_config=cfg,
        )
        self.assertEqual(proposal["remainingHardViolations"], 0)
        self.assertTrue(proposal["feasible"])
        self.assertGreaterEqual(proposal["stabilityPercentage"], 75.0)
        self.assertGreaterEqual(proposal["changedSessionsCount"], 1)

    def test_08_supabase_service_role_key_handling(self) -> None:
        import os
        from unittest.mock import patch
        from app.core.config import settings
        from app.database.supabase import SupabaseRestClient, get_supabase_client

        jwt_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig"
        jwt_client = SupabaseRestClient("https://demo.supabase.co", jwt_key)
        jwt_headers = jwt_client._headers()
        self.assertEqual(jwt_headers["apikey"], jwt_key)
        self.assertEqual(jwt_headers["Authorization"], f"Bearer {jwt_key}")

        opaque_key = "sb_secret_test_value_123456"
        opaque_client = SupabaseRestClient("https://demo.supabase.co", opaque_key)
        opaque_headers = opaque_client._headers()
        self.assertEqual(opaque_headers["apikey"], opaque_key)
        self.assertNotIn("Authorization", opaque_headers)

        with patch.dict(
            os.environ,
            {
                "SUPABASE_URL": "https://demo.supabase.co",
                "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiJ9.anon.sig",
                "SUPABASE_SERVICE_ROLE_KEY": f'"{opaque_key}"',
            },
            clear=False,
        ):
            self.assertTrue(settings.has_valid_service_role_key)
            self.assertEqual(settings.effective_supabase_key, opaque_key)
            client = get_supabase_client()
            self.assertIsNotNone(client)
            assert client is not None
            self.assertEqual(client.api_key, opaque_key)

    def test_09_scenario_a_b_credit_hour_expansion_and_split_lab(self) -> None:
        from app.optimization.constraints import expand_sections_to_sessions

        courses = [
            {
                "id": "crs-1cr-lec",
                "code": "HUM-101",
                "title": "Ethics",
                "courseType": "lecture",
                "lectureCredits": 1,
                "labCredits": 0,
                "credits": 1,
                "assignedInstructorId": "inst-1",
            },
            {
                "id": "crs-3lec-1lab",
                "code": "CS-201",
                "title": "Data Structures",
                "courseType": "lecture_lab",
                "lectureCredits": 3,
                "labCredits": 1,
                "credits": 4,
                "assignedInstructorId": "inst-1",
                "assignedLabEngineerId": "eng-1",
            },
        ]
        cfg = TimeSlotConfig()
        # Scenario A + B default continuous lab
        sessions = expand_sections_to_sessions(courses=courses, sections=[], rooms=[], instructors=[], time_config=cfg)
        lec_1cr = [s for s in sessions if s.course_id == "crs-1cr-lec" and not s.is_lab]
        lec_3cr = [s for s in sessions if s.course_id == "crs-3lec-1lab" and not s.is_lab]
        lab_1cr = [s for s in sessions if s.course_id == "crs-3lec-1lab" and s.is_lab]
        self.assertEqual(len(lec_1cr), 1)
        self.assertEqual(len(lec_3cr), 3)
        self.assertEqual(len(lab_1cr), 1)
        self.assertEqual(lab_1cr[0].duration_minutes, 180)
        # Total weekly minutes for 3 Lec (3*50) + 1 Lab (180)
        self.assertEqual(sum(s.duration_minutes for s in lec_3cr + lab_1cr), 3 * 50 + 180)

        # Split lab allowed when explicitly enabled via preferSplitLab + lab_split_allowed
        cfg_split = TimeSlotConfig(lab_split_allowed=True)
        split_sections = [
            {
                "id": "sec-split-lab",
                "courseId": "crs-3lec-1lab",
                "studentGroupId": "grp-a",
                "sessionType": "Lab",
                "componentType": "lab",
                "preferSplitLab": True,
                "instructorId": "inst-1",
                "labEngineerId": "eng-1",
            }
        ]
        split_sessions = expand_sections_to_sessions(
            courses=courses,
            sections=split_sections,
            rooms=[],
            instructors=[],
            time_config=cfg_split,
        )
        self.assertEqual(len(split_sessions), 2)
        self.assertTrue(all(s.is_split_lab and s.duration_minutes == 90 for s in split_sessions))

    def test_10_scenario_c_d_admin_staff_binding_invariance(self) -> None:
        courses = [
            {
                "id": "crs-os",
                "code": "CS-310",
                "title": "Operating Systems",
                "courseType": "lecture",
                "credits": 3,
                "assignedInstructorId": "inst-alice",
            },
            {
                "id": "crs-os-lab",
                "code": "CS-310L",
                "title": "Operating Systems Lab",
                "courseType": "lab",
                "credits": 1,
                "assignedInstructorId": "inst-alice",
                "assignedLabEngineerId": "eng-zara",
            },
            {
                "id": "crs-db-lab",
                "code": "CS-320L",
                "title": "Database Lab",
                "courseType": "lab",
                "credits": 1,
                "assignedInstructorId": "inst-bob",
                "assignedLabEngineerId": "eng-zara",
            },
        ]
        instructors = [
            {"id": "inst-alice", "name": "Dr. Alice", "staffRole": "faculty"},
            {"id": "inst-bob", "name": "Dr. Bob", "staffRole": "faculty"},
            {"id": "eng-zara", "name": "Eng. Zara", "staffRole": "lab_engineer"},
        ]
        sections = [
            {
                "id": "s-os-lec",
                "courseId": "crs-os",
                "studentGroupId": "batch-a",
                "instructorId": "inst-alice",
                "sessionType": "Theory",
                "componentType": "lecture",
            },
            {
                "id": "s-os-lab",
                "courseId": "crs-os-lab",
                "studentGroupId": "batch-a",
                "instructorId": "inst-alice",
                "labEngineerId": "eng-zara",
                "sessionType": "Lab",
                "componentType": "lab",
            },
            {
                "id": "s-db-lab",
                "courseId": "crs-db-lab",
                "studentGroupId": "batch-b",
                "instructorId": "inst-bob",
                "labEngineerId": "eng-zara",
                "sessionType": "Lab",
                "componentType": "lab",
            },
        ]
        rooms_raw = [
            {"id": "r-lh1", "code": "LH-1", "type": "lecture", "capacity": 80, "isAvailable": True},
            {"id": "r-lab1", "code": "LAB-1", "type": "lab", "capacity": 80, "isAvailable": True},
            {"id": "r-lab2", "code": "LAB-2", "type": "lab", "capacity": 80, "isAvailable": True},
        ]
        groups = [
            {"id": "batch-a", "code": "2K24-BSCS-A", "size": 50},
            {"id": "batch-b", "code": "2K24-BSCS-B", "size": 50},
        ]

        for algo in ["dsatur_only", "ga_only", "ga_sa", "hybrid_dsatur_ga_sa"]:
            res = run_hybrid_timetable_pipeline(
                sections=sections,
                courses=courses,
                rooms_raw=rooms_raw,
                student_groups=groups,
                instructors=instructors,
                algorithm=algo,
            )
            self.assertEqual(res["hardConstraintViolations"], 0, f"Hard clash in {algo}")
            entries = res["entries"]
            os_lab_entries = [e for e in entries if e["sectionId"] == "s-os-lab"]
            db_lab_entries = [e for e in entries if e["sectionId"] == "s-db-lab"]
            self.assertTrue(all(e["labEngineerId"] == "eng-zara" for e in os_lab_entries + db_lab_entries))
            # Shared lab engineer Eng. Zara must NOT have overlapping labs
            for e1 in os_lab_entries:
                for e2 in db_lab_entries:
                    if e1["day"] == e2["day"]:
                        self.assertFalse(
                            e1["startMinutes"] < e2["endMinutes"] and e2["startMinutes"] < e1["endMinutes"],
                            f"Lab engineer overlap in {algo}",
                        )

    def test_11_scenario_e_student_gap_evaluation_excludes_midday_break(self) -> None:
        from app.optimization.chromosome import SessionGene
        from app.optimization.fitness import evaluate_student_gaps

        cfg = TimeSlotConfig(
            day_start_time="09:00",
            day_end_time="17:00",
            period_length_minutes=50,
            short_break_minutes=10,
            midday_break_enabled=True,
            midday_break_start="13:00",
            midday_break_duration=60,
        )
        courses = [
            {"id": "c1", "code": "MTH-101", "title": "Calc", "credits": 2, "assignedInstructorId": "i1"},
        ]
        # 2 classes separated ONLY by official midday break (12:00-12:50 and 14:00-14:50) -> 0 unnecessary idle mins
        sessions = expand_sections_to_sessions(
            courses=courses,
            sections=[
                {
                    "id": "sec1",
                    "courseId": "c1",
                    "studentGroupId": "grp1",
                    "instructorId": "i1",
                    "sessionsPerWeek": 2,
                }
            ],
            rooms=[],
            instructors=[{"id": "i1", "name": "Prof"}],
            time_config=cfg,
        )
        # Find morning 12:00 slot index and afternoon 14:00 slot index on Mon
        mon_slots = cfg.get_day_slots("Mon")
        pre_lunch_idx = next(s.slot_index for s in mon_slots if s.start_time == "12:00")
        post_lunch_idx = next(s.slot_index for s in mon_slots if s.start_time == "14:00")

        g0 = SessionGene(session_id=sessions[0].session_id, day="Mon", slot_index=pre_lunch_idx, room_id="r1")
        g1 = SessionGene(session_id=sessions[1].session_id, day="Mon", slot_index=post_lunch_idx, room_id="r1")
        g0.sync_timing(sessions[0], cfg)
        g1.sync_timing(sessions[1], cfg)

        report_break_only = evaluate_student_gaps({"grp1": [(sessions[0], g0), (sessions[1], g1)]}, cfg)
        self.assertEqual(report_break_only["totalIdleMinutes"], 0)
        self.assertGreaterEqual(report_break_only["avgCompactness"], 99.0)

        # Now move g1 to 16:00 (2 hours of unnecessary idle after break) -> penalizes idle minutes
        late_idx = next(s.slot_index for s in mon_slots if s.start_time == "16:00")
        g1_late = SessionGene(session_id=sessions[1].session_id, day="Mon", slot_index=late_idx, room_id="r1")
        g1_late.sync_timing(sessions[1], cfg)
        report_with_gap = evaluate_student_gaps({"grp1": [(sessions[0], g0), (sessions[1], g1_late)]}, cfg)
        self.assertGreater(report_with_gap["totalIdleMinutes"], 100)
        self.assertLess(report_with_gap["avgCompactness"], report_break_only["avgCompactness"])

    def test_12_scenario_f_friday_disabled_and_batch_restrictions_and_rightmost(self) -> None:
        from app.optimization.constraints import canonicalize_working_days

        # Rightmost Friday ordering regardless of input permutation
        self.assertEqual(canonicalize_working_days(["Fri", "Wed", "Mon", "Thu", "Tue"], True), ["Mon", "Tue", "Wed", "Thu", "Fri"])
        self.assertEqual(canonicalize_working_days(["Mon", "Tue", "Wed", "Thu", "Fri"], False), ["Mon", "Tue", "Wed", "Thu"])

        sections, courses, rooms_raw, student_groups = sample_test_catalog()
        # Disable Friday completely -> zero Friday entries
        cfg_no_fri = TimeSlotConfig(working_days=["Mon", "Tue", "Wed", "Thu", "Fri"], friday_enabled=False)
        res_no_fri = run_hybrid_timetable_pipeline(
            sections=sections,
            courses=courses,
            rooms_raw=rooms_raw,
            student_groups=student_groups,
            time_config=cfg_no_fri,
        )
        self.assertEqual(res_no_fri["hardConstraintViolations"], 0)
        self.assertFalse(any(e["day"] == "Fri" for e in res_no_fri["entries"]))

        # Restrict Friday ONLY to 2K24-BESE batch -> 2K25-BSCS must never appear on Friday
        cfg_restricted_fri = TimeSlotConfig(
            working_days=["Mon", "Tue", "Wed", "Thu", "Fri"],
            friday_enabled=True,
            friday_allowed_batches=["2K24-BESE"],
        )
        res_restricted = run_hybrid_timetable_pipeline(
            sections=sections,
            courses=courses,
            rooms_raw=rooms_raw,
            student_groups=student_groups,
            time_config=cfg_restricted_fri,
        )
        self.assertEqual(res_restricted["hardConstraintViolations"], 0)
        for e in res_restricted["entries"]:
            if e["day"] == "Fri":
                self.assertEqual(e["batchId"], "batch-2k24-bese")

    def test_13_scenario_g_h_i_reject_invalid_publish_and_validate_clashes(self) -> None:
        from types import SimpleNamespace
        from unittest.mock import patch
        from app.routers.timetables import publish_timetable_version
        from fastapi_compat import HTTPException

        class _FakePublishClient:
            def select_one(self, table, filters=None, select="*", order=None):
                if table == "timetable_versions":
                    return {
                        "id": "ttv-invalid-1",
                        "name": "Conflicted Draft",
                        "status": "draft",
                        "hard_violations_count": 2,
                        "overall_fitness_score": 45.0,
                    }
                return None

        fake_req = SimpleNamespace(
            method="POST",
            url="/api/timetables/ttv-invalid-1/publish",
            headers={},
            query_params={},
            path_params={"versionId": "ttv-invalid-1"},
        )
        with (
            patch("app.routers.timetables.require_auth_user", return_value={"userId": "u-admin", "role": "admin", "institutionId": "inst-1"}),
            patch("app.routers.timetables.require_supabase_client", return_value=_FakePublishClient()),
        ):
            with self.assertRaises(HTTPException) as ctx:
                publish_timetable_version("ttv-invalid-1", fake_req)
            self.assertEqual(ctx.exception.status_code, 422)

        # Scenario I: Validator catches injected resource/Friday conflict
        cfg = TimeSlotConfig(friday_enabled=False)
        sections = [
            {"id": "s1", "courseId": "c1", "studentGroupId": "g1", "instructorId": "i1", "sessionsPerWeek": 1},
            {"id": "s2", "courseId": "c2", "studentGroupId": "g1", "instructorId": "i2", "sessionsPerWeek": 1},
        ]
        courses = [
            {"id": "c1", "code": "CS1", "title": "C1", "credits": 1, "assignedInstructorId": "i1"},
            {"id": "c2", "code": "CS2", "title": "C2", "credits": 1, "assignedInstructorId": "i2"},
        ]
        rooms = [{"id": "r1", "code": "LH-1", "type": "lecture", "capacity": 60, "isAvailable": True}]
        sessions = expand_sections_to_sessions(courses=courses, sections=sections, rooms=rooms, time_config=cfg)
        # Inject overlapping Monday 09:00 same cohort + same room
        bad_assignments = {
            sessions[0].session_id: ("Mon", "09:00", "r1"),
            sessions[1].session_id: ("Mon", "09:00", "r1"),
        }
        report = validate_timetable_assignments(bad_assignments, sessions, rooms, cfg)
        self.assertFalse(report.is_valid)
        self.assertGreaterEqual(report.hard_violation_count, 2)

    def test_14_dict_unavailability_enforcement_across_all_algorithms(self) -> None:
        from tests.audit_benchmark import (
            build_realistic_university_dataset,
            check_unavailability_compliance,
        )

        dataset = build_realistic_university_dataset()
        cfg = TimeSlotConfig()
        for algo in ["dsatur_only", "ga_only", "ga_sa", "hybrid_dsatur_ga_sa"]:
            res = run_hybrid_timetable_pipeline(
                sections=dataset["sections"],
                courses=dataset["courses"],
                rooms_raw=dataset["rooms_raw"],
                student_groups=dataset["student_groups"],
                instructors=dataset["instructors"],
                time_config=cfg,
                algorithm=algo,
                student_preferences=dataset["student_preferences"],
                unavailable_instructor_slots=dataset["unavailable_instructor_slots"],
                unavailable_room_slots=dataset["unavailable_room_slots"],
            )
            self.assertTrue(res["feasible"], f"{algo} failed feasibility: {res['validationReport']}")
            self.assertEqual(res["hardConstraintViolations"], 0, f"{algo} had hard violations")
            hits, msgs = check_unavailability_compliance(res, dataset)
            self.assertEqual(hits, 0, f"{algo} violated unavailability: {msgs}")

    def test_15_compare_schema_and_minimal_rescheduling(self) -> None:
        from tests.audit_benchmark import build_realistic_university_dataset

        dataset = build_realistic_university_dataset()
        cfg = TimeSlotConfig()
        comp = compare_optimization_algorithms(
            sections=dataset["sections"],
            courses=dataset["courses"],
            rooms_raw=dataset["rooms_raw"],
            student_groups=dataset["student_groups"],
            time_config=cfg,
            instructors=dataset["instructors"],
            student_preferences=dataset["student_preferences"],
            unavailable_instructor_slots=dataset["unavailable_instructor_slots"],
            unavailable_room_slots=dataset["unavailable_room_slots"],
        )
        self.assertIn("comparisons", comp)
        self.assertIn("comparison", comp)
        self.assertEqual(len(comp["comparison"]), 4)
        self.assertTrue(all(item["feasible"] for item in comp["comparison"]))

        base_res = run_hybrid_timetable_pipeline(
            sections=dataset["sections"],
            courses=dataset["courses"],
            rooms_raw=dataset["rooms_raw"],
            student_groups=dataset["student_groups"],
            instructors=dataset["instructors"],
            time_config=cfg,
            algorithm="hybrid_dsatur_ga_sa",
        )
        target_entry = next(e for e in base_res["entries"] if not e["isLab"])
        resched = generate_rescheduling_proposal(
            disruption_type="instructor_unavailable",
            affected_resource_id=target_entry["instructorId"],
            affected_days=[target_entry["day"]],
            affected_start_times=[target_entry["startTime"]],
            reason="One-slot disruption regression check",
            current_section_assignments=base_res["assignments"],
            sections=dataset["sections"],
            courses=dataset["courses"],
            rooms_raw=dataset["rooms_raw"],
            student_groups=dataset["student_groups"],
            time_config=cfg,
            instructors=dataset["instructors"],
        )
        self.assertTrue(resched["feasible"])
        self.assertEqual(resched["remainingHardViolations"], 0)
        self.assertGreaterEqual(resched["stabilityPercentage"], 95.0)
        self.assertLessEqual(resched["changedSessionsCount"], 2)


if __name__ == "__main__":
    unittest.main()

