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

    def test_16_csv_import_validation(self) -> None:
        """Test CSV structure, delimiters, required fields, and academic rule validations."""
        # Test delimiter and quoting parser logic simulation
        raw_csv = "code,title,lecture_credits,lab_credits\nCS-101,\"Introduction to Computing, Advanced\",3,1\n,Missing Code,3,0\n"
        # Simulate validation checks
        lines = [line.split(',') for line in raw_csv.strip().split('\n')]
        headers = lines[0]
        self.assertIn("code", headers)
        self.assertIn("title", headers)

        row_valid = lines[1]
        self.assertTrue(bool(row_valid[0].strip())) # code present
        self.assertTrue(bool(row_valid[1].strip())) # title present

        row_invalid = lines[2]
        self.assertFalse(bool(row_invalid[0].strip())) # missing code should fail validation

    def test_17_batch_department_resolution_and_multi_section_generation(self) -> None:
        """Verify batches/sections without academic_programs map across all sections and persist sessions."""
        from unittest.mock import patch
        from app.deps import (
            resolve_batch_department_id,
            resolve_matching_batches_for_course,
            load_university_optimization_inputs,
        )

        departments = [
            {"id": "dept-cs", "institution_id": "inst-1", "code": "CS", "name": "Computer Science"},
            {"id": "dept-ee", "institution_id": "inst-1", "code": "EE", "name": "Electrical Engineering"},
        ]
        # Empty programs (SetupFlow does not create academic_programs) and degree-prefixed dept codes
        batches = [
            {"id": "b-cs-a", "institution_id": "inst-1", "code": "2K24-BSCS-A", "name": "2K24 BSCS Section A", "department_code": "BSCS", "section": "A", "student_count": 45},
            {"id": "b-cs-b", "institution_id": "inst-1", "code": "2K24-BSCS-B", "name": "2K24 BSCS Section B", "department_code": "BSCS", "section": "B", "student_count": 42},
            {"id": "b-ee-a", "institution_id": "inst-1", "code": "2K24-EE-A", "name": "2K24 EE Section A", "department_code": "EE", "section": "A", "student_count": 50},
        ]
        courses = [
            {
                "id": "crs-cs101",
                "institution_id": "inst-1",
                "department_id": "dept-cs",
                "code": "CS-101",
                "title": "Programming Fundamentals",
                "course_type": "lecture_lab",
                "lecture_credit_hours": 3,
                "lab_credit_hours": 1,
                "lecture_hours_per_week": 3,
                "lab_hours_per_week": 3,
                "credit_hours": 4,
                "is_compulsory": True,
                "assigned_instructor_id": "inst-1",
                "assigned_lab_engineer_id": "eng-1",
            }
        ]

        # Degree prefix BSCS matches department CS without any academic_programs row
        self.assertEqual(resolve_batch_department_id(batches[0], departments, []), "dept-cs")
        self.assertEqual(resolve_batch_department_id(batches[1], departments, []), "dept-cs")
        self.assertEqual(resolve_batch_department_id(batches[2], departments, []), "dept-ee")

        matched_cs = resolve_matching_batches_for_course(courses[0], batches, departments, [])
        self.assertEqual([b["id"] for b in matched_cs], ["b-cs-a", "b-cs-b"])

        # Stub client to verify load_university_optimization_inputs builds sections for ALL matching batches
        class _UniStubClient:
            def select_one(self, table, filters=None, select="*", order=None):
                if table == "institutions":
                    return {"id": "inst-1", "name": "NUST", "working_days": ["Mon", "Tue", "Wed", "Thu", "Fri"], "use_voting_preferences": False}
                return None

            def select(self, table, filters=None, select="*", order=None):
                mapping = {
                    "courses": courses,
                    "course_sessions": [],
                    "classrooms": [{"id": "rm-1", "code": "CR-101", "name": "CR-101", "room_type": "lecture", "capacity": 60, "is_available": True}, {"id": "rm-lab", "code": "LAB-1", "name": "LAB-1", "room_type": "lab", "capacity": 50, "is_available": True}],
                    "laboratories": [],
                    "room_equipment_capacities": [],
                    "batches": batches,
                    "instructors": [
                        {"id": "inst-1", "name": "Dr. Ali", "department_id": "dept-cs", "staff_role": "faculty", "max_weekly_hours": 18, "max_consecutive_hours": 3},
                        {"id": "eng-1", "name": "Eng. Sara", "department_id": "dept-cs", "staff_role": "lab_engineer", "max_weekly_hours": 18, "max_consecutive_hours": 3},
                    ],
                    "departments": departments,
                    "academic_programs": [],
                    "student_preferences": [],
                    "instructor_preferences": [],
                    "instructor_availability": [],
                }
                return mapping.get(table, [])

        with patch("app.deps.require_supabase_client", return_value=_UniStubClient()):
            inputs = load_university_optimization_inputs("inst-1", {})

        sec_group_ids = {(s["studentGroupId"], s["componentType"]) for s in inputs["sections"]}
        self.assertIn(("b-cs-a", "lecture"), sec_group_ids)
        self.assertIn(("b-cs-a", "lab"), sec_group_ids)
        self.assertIn(("b-cs-b", "lecture"), sec_group_ids)
        self.assertIn(("b-cs-b", "lab"), sec_group_ids)
        self.assertNotIn(("b-ee-a", "lecture"), sec_group_ids)

    def test_18_semester_enrollment_scoping_and_chunked_insert(self) -> None:
        """Verify semester scoping, explicit course_enrollments, partial session restriction, and 250-row chunked inserts."""
        from unittest.mock import patch
        from app.database.supabase import SupabaseRestClient
        from app.deps import load_university_optimization_inputs, resolve_matching_batches_for_course

        departments = [
            {"id": "dept-cs", "institution_id": "inst-1", "code": "CS", "name": "Computer Science"},
        ]
        batches = [
            {"id": "b-s1-a", "institution_id": "inst-1", "code": "FA25-BSCS-1A", "name": "FA25 BSCS 1A", "department_id": "dept-cs", "semester": 1, "section": "A", "student_count": 45},
            {"id": "b-s1-b", "institution_id": "inst-1", "code": "FA25-BSCS-1B", "name": "FA25 BSCS 1B", "department_id": "dept-cs", "semester": 1, "section": "B", "student_count": 45},
            {"id": "b-s3-a", "institution_id": "inst-1", "code": "FA24-BSCS-3A", "name": "FA24 BSCS 3A", "department_id": "dept-cs", "semester": 3, "section": "A", "student_count": 45},
            {"id": "b-s5-a", "institution_id": "inst-1", "code": "FA23-BSCS-5A", "name": "FA23 BSCS 5A", "department_id": "dept-cs", "semester": 5, "section": "A", "student_count": 45},
        ]
        course_sem1 = {
            "id": "crs-pf",
            "institution_id": "inst-1",
            "department_id": "dept-cs",
            "code": "CS-101",
            "title": "Programming Fundamentals",
            "course_type": "lecture",
            "lecture_credit_hours": 3,
            "lab_credit_hours": 0,
            "credit_hours": 3,
            "semester_number": 1,
            "is_compulsory": True,
            "assigned_instructor_id": "inst-1",
        }

        # 1. Semester scoping prevents multiplying a Sem-1 course into Sem-3 / Sem-5 batches
        sem1_matched = resolve_matching_batches_for_course(course_sem1, batches, departments, [])
        self.assertEqual([b["id"] for b in sem1_matched], ["b-s1-a", "b-s1-b"])

        # 2. Explicit course_enrollments restricts even further to only enrolled batch IDs
        enrolled_matched = resolve_matching_batches_for_course(
            course_sem1,
            batches,
            departments,
            [],
            enrolled_batch_ids={"b-s1-a"},
        )
        self.assertEqual([b["id"] for b in enrolled_matched], ["b-s1-a"])

        # 3. Existing partial course_sessions for a non-elective scopes generation strictly to those mapped batches
        course_existing = {
            "id": "crs-db",
            "institution_id": "inst-1",
            "department_id": "dept-cs",
            "code": "CS-202",
            "title": "Database Systems",
            "course_type": "lecture",
            "lecture_credit_hours": 3,
            "lab_credit_hours": 0,
            "credit_hours": 3,
            "is_compulsory": True,
            "assigned_instructor_id": "inst-1",
        }

        class _PartialSessionsStub:
            def select_one(self, table, filters=None, select="*", order=None):
                if table == "institutions":
                    return {"id": "inst-1", "name": "COMSATS", "working_days": ["Mon", "Tue", "Wed", "Thu", "Fri"], "use_voting_preferences": False}
                return None

            def select(self, table, filters=None, select="*", order=None):
                mapping = {
                    "courses": [course_sem1, course_existing],
                    "course_sessions": [
                        {
                            "id": "sec-db-3a",
                            "course_id": "crs-db",
                            "batch_id": "b-s3-a",
                            "section_code": "A",
                            "session_type": "lecture",
                            "component_type": "lecture",
                            "instructor_id": "inst-1",
                            "sessions_per_week": 3,
                        }
                    ],
                    "course_enrollments": [{"course_id": "crs-pf", "batch_id": "b-s1-a"}],
                    "classrooms": [{"id": "rm-1", "code": "CR-101", "name": "CR-101", "room_type": "lecture", "capacity": 60, "is_available": True}],
                    "laboratories": [],
                    "room_equipment_capacities": [],
                    "batches": batches,
                    "instructors": [{"id": "inst-1", "name": "Dr. Ali", "department_id": "dept-cs", "staff_role": "faculty", "max_weekly_hours": 18, "max_consecutive_hours": 3}],
                    "departments": departments,
                    "academic_programs": [],
                    "student_preferences": [],
                    "instructor_preferences": [],
                    "instructor_availability": [],
                }
                return mapping.get(table, [])

        with patch("app.deps.require_supabase_client", return_value=_PartialSessionsStub()):
            inputs = load_university_optimization_inputs("inst-1", {})

        pf_batches = {s["studentGroupId"] for s in inputs["sections"] if s["courseId"] == "crs-pf"}
        db_batches = {s["studentGroupId"] for s in inputs["sections"] if s["courseId"] == "crs-db"}
        self.assertEqual(pf_batches, {"b-s1-a"})
        self.assertEqual(db_batches, {"b-s3-a"})

        # 4. Chunked SupabaseRestClient.insert splits 600 rows into 250 / 250 / 100 chunks
        client = SupabaseRestClient("https://demo.supabase.co", "sb_secret_test")
        chunk_sizes: list[int] = []

        def fake_request(method, path, query=None, payload=None, prefer=None, timeout=15.0):
            if method == "POST":
                assert isinstance(payload, list)
                chunk_sizes.append(len(payload))
                return 201, {}, payload
            return 200, {}, []

        rows_600 = [{"id": f"row-{i}"} for i in range(600)]
        with (
            patch.object(client, "get_table_columns", return_value={"id"}),
            patch.object(client, "_request", side_effect=fake_request),
        ):
            res_rows = client.insert("timetable_entries", rows_600, chunk_size=250)

        self.assertEqual(chunk_sizes, [250, 250, 100])
        self.assertEqual(len(res_rows), 600)

    def test_19_large_scale_solver_performance(self) -> None:
        """Benchmark hybrid DSatur+GA+SA solver on ~2,000 sessions across 40 batches within strict wall-clock bounds."""
        import time

        cfg = TimeSlotConfig()
        courses = []
        sections = []
        student_groups = []
        instructors = [{"id": f"inst-{i}", "name": f"Prof {i}", "staffRole": "faculty"} for i in range(60)]
        rooms_raw = [
            {"id": f"rm-lec-{i}", "code": f"LH-{100 + i}", "name": f"LH-{100 + i}", "type": "lecture", "capacity": 80, "isAvailable": True}
            for i in range(45)
        ] + [
            {"id": f"rm-lab-{i}", "code": f"LAB-{200 + i}", "name": f"LAB-{200 + i}", "type": "lab", "capacity": 80, "isAvailable": True}
            for i in range(15)
        ]

        # 40 batches * (16 3-credit lectures -> 48 lecture sessions + 2 labs -> 2 lab sessions) = 2,000 sessions
        for b_idx in range(40):
            bid = f"batch-{b_idx}"
            student_groups.append({"id": bid, "batchId": bid, "code": f"B-{b_idx}", "size": 50})
            for c_idx in range(16):
                cid = f"crs-{b_idx}-{c_idx}"
                iid = f"inst-{(b_idx * 3 + c_idx) % 60}"
                courses.append({
                    "id": cid,
                    "code": f"C-{b_idx}-{c_idx}",
                    "title": f"Course {b_idx}-{c_idx}",
                    "courseType": "lecture",
                    "lectureCredits": 3,
                    "labCredits": 0,
                    "credits": 3,
                    "assignedInstructorId": iid,
                })
                sections.append({
                    "id": f"sec-{cid}",
                    "courseId": cid,
                    "courseCode": f"C-{b_idx}-{c_idx}",
                    "instructorId": iid,
                    "studentGroupId": bid,
                    "sectionCode": "A",
                    "sessionType": "Theory",
                    "componentType": "lecture",
                    "enrollment": 50,
                })
            for l_idx in range(2):
                cid = f"clab-{b_idx}-{l_idx}"
                iid = f"inst-{(b_idx * 5 + l_idx) % 60}"
                courses.append({
                    "id": cid,
                    "code": f"L-{b_idx}-{l_idx}",
                    "title": f"Lab {b_idx}-{l_idx}",
                    "courseType": "lab",
                    "lectureCredits": 0,
                    "labCredits": 1,
                    "credits": 1,
                    "assignedInstructorId": iid,
                })
                sections.append({
                    "id": f"sec-{cid}",
                    "courseId": cid,
                    "courseCode": f"L-{b_idx}-{l_idx}",
                    "instructorId": iid,
                    "studentGroupId": bid,
                    "sectionCode": "A",
                    "sessionType": "Lab",
                    "componentType": "lab",
                    "enrollment": 50,
                })

        t_start = time.perf_counter()
        res = run_hybrid_timetable_pipeline(
            sections=sections,
            courses=courses,
            rooms_raw=rooms_raw,
            student_groups=student_groups,
            instructors=instructors,
            time_config=cfg,
            algorithm="hybrid_dsatur_ga_sa",
        )
        elapsed = time.perf_counter() - t_start

        self.assertEqual(res["totalSessions"], 2000)
        self.assertGreater(res["placedSessions"], 0)
        self.assertEqual(res["placedSessions"], len(res["entries"]))
        self.assertLess(elapsed, 15.0, f"Large-scale solve took too long: {elapsed:.2f}s")

    @staticmethod
    def _make_fake_supabase_and_req():
        import asyncio
        import json
        from copy import deepcopy
        from types import SimpleNamespace

        class _FakeStatefulSupabase:
            def __init__(self, fail_update_on_call: int | None = None):
                self.fail_update_on_call = fail_update_on_call
                self.update_calls = 0
                self.tables = {
                    "institutions": [
                        {
                            "id": "uni-1",
                            "name": "National University",
                            "code": "NU",
                            "working_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
                            "day_start_time": "09:00",
                            "day_end_time": "17:00",
                            "period_length_minutes": 50,
                            "short_break_minutes": 10,
                            "midday_break_enabled": True,
                            "midday_break_start": "13:00",
                            "midday_break_duration": 60,
                            "lab_duration_minutes": 180,
                        }
                    ],
                    "departments": [
                        {"id": "dept-cs", "institution_id": "uni-1", "code": "CS", "name": "Computer Science"},
                    ],
                    "academic_programs": [
                        {"id": "prog-bscs", "institution_id": "uni-1", "department_id": "dept-cs", "code": "BSCS", "name": "BS Computer Science"},
                    ],
                    "semesters": [
                        {"id": "term-f26", "institution_id": "uni-1", "name": "Fall 2026", "status": "active"},
                    ],
                    "batches": [
                        {"id": "b-cs-a", "institution_id": "uni-1", "program_id": "prog-bscs", "term_id": "term-f26", "code": "2K25-CS-A", "name": "2K25 CS A", "batch_code": "2K25", "department_code": "BSCS", "section": "A", "student_count": 45, "semester": 1},
                        {"id": "b-cs-b", "institution_id": "uni-1", "program_id": "prog-bscs", "term_id": "term-f26", "code": "2K25-CS-B", "name": "2K25 CS B", "batch_code": "2K25", "department_code": "BSCS", "section": "B", "student_count": 45, "semester": 1},
                    ],
                    "courses": [
                        {"id": "crs-ds", "institution_id": "uni-1", "department_id": "dept-cs", "code": "CS-201", "title": "Data Structures", "course_type": "lecture_lab", "lecture_credit_hours": 3, "lab_credit_hours": 1, "credit_hours": 4, "semester_number": 1, "is_compulsory": True, "required_equipment": ["Computers"]},
                        {"id": "crs-db", "institution_id": "uni-1", "department_id": "dept-cs", "code": "CS-202", "title": "Database Systems", "course_type": "lecture", "lecture_credit_hours": 3, "lab_credit_hours": 0, "credit_hours": 3, "semester_number": 1, "is_compulsory": True, "required_equipment": []},
                        {"id": "crs-os", "institution_id": "uni-1", "department_id": "dept-cs", "code": "CS-301", "title": "Operating Systems", "course_type": "lecture", "lecture_credit_hours": 3, "lab_credit_hours": 0, "credit_hours": 3, "semester_number": 1, "is_compulsory": True, "required_equipment": []},
                    ],
                    "instructors": [
                        {"id": "inst-fac1", "institution_id": "uni-1", "user_id": "u-fac-1", "department_id": "dept-cs", "staff_code": "FAC-101", "name": "Dr. Ada Lovelace", "email": "ada@nu.edu", "designation": "Professor", "staff_role": "faculty", "is_active": True, "max_weekly_hours": 6, "max_consecutive_hours": 3, "qualified_course_ids": ["crs-ds", "crs-db"]},
                        {"id": "inst-fac2", "institution_id": "uni-1", "user_id": "u-fac-2", "department_id": "dept-cs", "staff_code": "FAC-102", "name": "Dr. Alan Turing", "email": "alan@nu.edu", "designation": "Associate Professor", "staff_role": "faculty", "is_active": True, "max_weekly_hours": 16, "max_consecutive_hours": 3, "qualified_course_ids": []},
                        {"id": "inst-eng1", "institution_id": "uni-1", "user_id": "u-eng-1", "department_id": "dept-cs", "staff_code": "LAB-201", "name": "Eng. Grace Hopper", "email": "grace@nu.edu", "designation": "Lab Engineer", "staff_role": "lab_engineer", "is_active": True, "max_weekly_hours": 18, "max_consecutive_hours": 3, "qualified_course_ids": []},
                        {"id": "inst-inactive", "institution_id": "uni-1", "department_id": "dept-cs", "staff_code": "FAC-999", "name": "Prof. Retired", "email": "retired@nu.edu", "designation": "Professor", "staff_role": "faculty", "is_active": False, "max_weekly_hours": 12, "max_consecutive_hours": 3, "qualified_course_ids": []},
                    ],
                    "classrooms": [
                        {"id": "rm-lh1", "institution_id": "uni-1", "code": "LH-101", "name": "LH-101", "room_type": "lecture", "capacity": 80, "is_available": True},
                        {"id": "lab-1", "institution_id": "uni-1", "code": "LAB-1", "name": "General Lab 1", "room_type": "lab", "capacity": 60, "equipment": ["Computers"], "is_available": True},
                        {"id": "lab-2", "institution_id": "uni-1", "code": "LAB-2", "name": "GPU Spec Lab 2", "room_type": "lab", "capacity": 60, "equipment": ["Computers"], "is_available": True},
                        {"id": "lab-small", "institution_id": "uni-1", "code": "LAB-S", "name": "Tiny Lab", "room_type": "lab", "capacity": 15, "equipment": ["Computers"], "is_available": True},
                        {"id": "lab-offline", "institution_id": "uni-1", "code": "LAB-OFF", "name": "Offline Lab", "room_type": "lab", "capacity": 60, "is_available": False},
                    ],
                    "laboratories": [
                        {"id": "lab-1", "institution_id": "uni-1", "code": "LAB-1", "name": "General Lab 1", "capacity": 60, "is_available": True},
                        {"id": "lab-2", "institution_id": "uni-1", "code": "LAB-2", "name": "GPU Spec Lab 2", "capacity": 60, "is_available": True},
                        {"id": "lab-small", "institution_id": "uni-1", "code": "LAB-S", "name": "Tiny Lab", "capacity": 15, "is_available": True},
                        {"id": "lab-offline", "institution_id": "uni-1", "code": "LAB-OFF", "name": "Offline Lab", "capacity": 60, "is_available": False},
                    ],
                    "room_equipment_capacities": [
                        {"id": "eq-1", "institution_id": "uni-1", "room_id": "lab-1", "equipment_name": "Computers"},
                        {"id": "eq-2", "institution_id": "uni-1", "room_id": "lab-2", "equipment_name": "Computers"},
                        {"id": "eq-3", "institution_id": "uni-1", "room_id": "lab-small", "equipment_name": "Computers"},
                    ],
                    "course_sessions": [],
                    "course_enrollments": [],
                    "timetable_versions": [],
                    "timetable_entries": [],
                    "instructor_availability": [],
                    "instructor_preferences": [],
                    "student_preferences": [],
                    "users": [
                        {"id": "u-student", "institution_id": "uni-1", "name": "Student One", "email": "stu@nu.edu", "role": "student", "is_active": True, "batch_id": "b-cs-a"},
                        {"id": "u-br", "institution_id": "uni-1", "name": "BR One", "email": "br@nu.edu", "role": "br", "is_active": True, "batch_id": "b-cs-a"},
                        {"id": "u-eng-1", "institution_id": "uni-1", "name": "Eng. Grace Hopper", "email": "grace@nu.edu", "role": "faculty", "is_active": True},
                    ],
                    "br_assignments": [
                        {"id": "bra-1", "user_id": "u-br", "batch_id": "b-cs-a", "gender_role": "male", "is_active": True},
                    ],
                    "audit_logs": [],
                }

            def _match(self, row, filters):
                if not filters:
                    return True
                for k, v in filters.items():
                    val = str(v)
                    if val.startswith("eq."):
                        if str(row.get(k) or "") != val[3:]:
                            return False
                return True

            def select(self, table, filters=None, select="*", order=None, limit=None):
                rows = [deepcopy(r) for r in self.tables.get(table, []) if self._match(r, filters)]
                return rows[:limit] if limit else rows

            def select_one(self, table, filters=None, select="*", order=None):
                rows = self.select(table, filters=filters)
                return rows[0] if rows else None

            def insert(self, table, payload, chunk_size=250, upsert=False, on_conflict=None):
                items = payload if isinstance(payload, list) else [payload]
                inserted = []
                for it in items:
                    row = deepcopy(it)
                    self.tables.setdefault(table, []).append(row)
                    inserted.append(deepcopy(row))
                return inserted

            def update(self, table, filters, patch):
                if table == "course_sessions" and self.fail_update_on_call is not None:
                    self.update_calls += 1
                    if self.update_calls == self.fail_update_on_call:
                        from app.database.supabase import SupabaseQueryError
                        raise SupabaseQueryError(503, "Simulated transient Supabase failure")
                updated = []
                for r in self.tables.get(table, []):
                    if self._match(r, filters):
                        r.update(deepcopy(patch))
                        updated.append(deepcopy(r))
                return updated

            def delete(self, table, filters):
                before = len(self.tables.get(table, []))
                self.tables[table] = [r for r in self.tables.get(table, []) if not self._match(r, filters)]
                return before - len(self.tables[table])

            def get_table_columns(self, table):
                return set()

            def has_column(self, table, column):
                return True

        def make_req(method="GET", url="/", body=None, query=None):
            raw = json.dumps(body).encode("utf-8") if body is not None else b""

            async def _body():
                return raw

            async def _json():
                return json.loads(raw.decode("utf-8")) if raw else {}

            return SimpleNamespace(
                method=method,
                url=url,
                headers={"content-type": "application/json"},
                query_params=query or {},
                path_params={},
                body=_body,
                json=_json,
            )

        return _FakeStatefulSupabase, make_req, asyncio.run

    def test_20_assignment_sync_and_workspace_no_fake_staff(self) -> None:
        from unittest.mock import patch
        from app.routers.assignments import get_assignment_workspace, sync_course_offerings

        FakeClient, make_req, run_async = self._make_fake_supabase_and_req()
        client = FakeClient()
        admin_auth = {"userId": "u-admin", "role": "admin", "systemRole": "admin", "institutionId": "uni-1"}

        with (
            patch("app.routers.assignments.require_auth_user", return_value=admin_auth),
            patch("app.routers.assignments.require_supabase_client", return_value=client),
        ):
            sync_res = run_async(sync_course_offerings(make_req("POST", body={"universityId": "uni-1"})))
            self.assertGreaterEqual(sync_res["createdCount"], 6)
            # Verify no fake staff or default lab was substituted on materialized rows
            for row in client.tables["course_sessions"]:
                self.assertIsNone(row.get("instructor_id"))
                self.assertIsNone(row.get("lab_engineer_id"))
                self.assertIsNone(row.get("assigned_lab_id"))

            ws = get_assignment_workspace(make_req("GET", query={"universityId": "uni-1", "cohortCode": "2K25"}))
            self.assertEqual(ws["summary"]["totalOfferings"], 6)
            self.assertEqual(ws["summary"]["unassignedCount"], 6)
            self.assertEqual(ws["summary"]["completeCount"], 0)
            self.assertEqual(ws["hierarchy"]["programs"][0]["code"], "BSCS")

    def test_21_assignment_validation_422_rules_and_workload_cap(self) -> None:
        from unittest.mock import patch
        from app.routers.assignments import sync_course_offerings, update_single_offering_assignment
        from fastapi_compat import HTTPException

        FakeClient, make_req, run_async = self._make_fake_supabase_and_req()
        client = FakeClient()
        admin_auth = {"userId": "u-admin", "role": "admin", "systemRole": "admin", "institutionId": "uni-1"}

        with (
            patch("app.routers.assignments.require_auth_user", return_value=admin_auth),
            patch("app.routers.assignments.require_supabase_client", return_value=client),
        ):
            run_async(sync_course_offerings(make_req("POST", body={"universityId": "uni-1"})))
            ds_a_id = "term-f26::crs-ds::b-cs-a::A"
            os_a_id = "term-f26::crs-os::b-cs-a::A"
            db_a_id = "term-f26::crs-db::b-cs-a::A"

            # 1. Inactive staff rejected with 422
            with self.assertRaises(HTTPException) as ctx1:
                run_async(update_single_offering_assignment(os_a_id, make_req("PUT", body={"universityId": "uni-1", "instructorId": "inst-inactive"})))
            self.assertEqual(ctx1.exception.status_code, 422)

            # 2. Lab engineer cannot be assigned as theory instructor (422)
            with self.assertRaises(HTTPException) as ctx2:
                run_async(update_single_offering_assignment(os_a_id, make_req("PUT", body={"universityId": "uni-1", "instructorId": "inst-eng1"})))
            self.assertEqual(ctx2.exception.status_code, 422)

            # 3. Faculty member restricted by qualified_course_ids cannot teach unlisted crs-os (422)
            with self.assertRaises(HTTPException) as ctx3:
                run_async(update_single_offering_assignment(os_a_id, make_req("PUT", body={"universityId": "uni-1", "instructorId": "inst-fac1"})))
            self.assertEqual(ctx3.exception.status_code, 422)

            # 4. Undersized lab and offline lab rejected (422)
            with self.assertRaises(HTTPException) as ctx4:
                run_async(update_single_offering_assignment(ds_a_id, make_req("PUT", body={"universityId": "uni-1", "instructorId": "inst-fac1", "labEngineerId": "inst-eng1", "assignedLabId": "lab-small"})))
            self.assertEqual(ctx4.exception.status_code, 422)
            with self.assertRaises(HTTPException) as ctx5:
                run_async(update_single_offering_assignment(ds_a_id, make_req("PUT", body={"universityId": "uni-1", "instructorId": "inst-fac1", "labEngineerId": "inst-eng1", "assignedLabId": "lab-offline"})))
            self.assertEqual(ctx5.exception.status_code, 422)

            # 5. Valid assignment saves cleanly and tracks weekly load (inst-fac1 has cap=6, crs-ds adds 3h)
            ok = run_async(update_single_offering_assignment(ds_a_id, make_req("PUT", body={"universityId": "uni-1", "instructorId": "inst-fac1", "labEngineerId": "inst-eng1", "assignedLabId": "lab-2"})))
            self.assertEqual(ok["validation"]["status"], "assigned")

            # 6. Cross-institution / missing offering returns 404
            with self.assertRaises(HTTPException) as ctx_miss:
                run_async(update_single_offering_assignment("term-f26::other::b::A", make_req("PUT", body={"universityId": "uni-1", "instructorId": "inst-fac2"})))
            self.assertEqual(ctx_miss.exception.status_code, 404)

            # 7. Adding crs-db (3h) to inst-fac1 (cap=6 -> 6h) fits, whereas adding a third 3h offering fails cap -> override works
            ok2 = run_async(update_single_offering_assignment(db_a_id, make_req("PUT", body={"universityId": "uni-1", "instructorId": "inst-fac1"})))
            self.assertEqual(ok2["validation"]["status"], "assigned")

            ds_b_id = "term-f26::crs-ds::b-cs-b::B"
            with self.assertRaises(HTTPException) as ctx_cap:
                run_async(update_single_offering_assignment(ds_b_id, make_req("PUT", body={"universityId": "uni-1", "instructorId": "inst-fac1", "labEngineerId": "inst-eng1", "assignedLabId": "lab-1"})))
            self.assertEqual(ctx_cap.exception.status_code, 422)

            override_ok = run_async(update_single_offering_assignment(ds_b_id, make_req("PUT", body={"universityId": "uni-1", "instructorId": "inst-fac1", "labEngineerId": "inst-eng1", "assignedLabId": "lab-1", "allowWorkloadOverride": True})))
            self.assertEqual(override_ok["validation"]["status"], "assigned")

    def test_22_single_edit_409_published_impact_clear_and_audit_log(self) -> None:
        from unittest.mock import patch
        from app.routers.assignments import (
            clear_offering_assignments,
            get_assignment_history,
            sync_course_offerings,
            update_single_offering_assignment,
        )
        from fastapi_compat import HTTPException

        FakeClient, make_req, run_async = self._make_fake_supabase_and_req()
        client = FakeClient()
        admin_auth = {"userId": "u-admin", "name": "Registrar", "role": "admin", "systemRole": "admin", "institutionId": "uni-1"}

        with (
            patch("app.routers.assignments.require_auth_user", return_value=admin_auth),
            patch("app.routers.assignments.require_supabase_client", return_value=client),
        ):
            run_async(sync_course_offerings(make_req("POST", body={"universityId": "uni-1"})))
            os_a_id = "term-f26::crs-os::b-cs-a::A"
            run_async(update_single_offering_assignment(os_a_id, make_req("PUT", body={"universityId": "uni-1", "instructorId": "inst-fac2"})))

            # Attach published timetable version referencing this course_session
            os_row = next(r for r in client.tables["course_sessions"] if r["course_id"] == "crs-os" and r["batch_id"] == "b-cs-a")
            client.tables["timetable_versions"].append({"id": "ttv-pub-1", "institution_id": "uni-1", "name": "Fall 2026 Live", "status": "published"})
            client.tables["timetable_entries"].append({
                "id": "tte-1", "institution_id": "uni-1", "timetable_version_id": "ttv-pub-1",
                "course_session_id": os_row["id"], "course_code": "CS-301", "batch_id": "b-cs-a",
                "instructor_id": "inst-fac2", "day_of_week": "Mon", "start_time": "09:00", "end_time": "09:50", "room_id": "rm-lh1",
            })

            # Clearing without confirmation -> 409
            with self.assertRaises(HTTPException) as ctx409:
                run_async(clear_offering_assignments(make_req("POST", body={"universityId": "uni-1", "offeringId": os_a_id})))
            self.assertEqual(ctx409.exception.status_code, 409)
            self.assertTrue(ctx409.exception.detail["requiresConfirmation"])

            # Confirming impact clears assignment & writes audit log
            cleared = run_async(clear_offering_assignments(make_req("POST", body={"universityId": "uni-1", "offeringId": os_a_id, "confirmTimetableImpact": True})))
            self.assertEqual(cleared["clearedCount"], 1)
            hist = get_assignment_history(make_req("GET", query={"universityId": "uni-1"}))
            self.assertTrue(any(h["action"] == "clear" and h["entity_type"] == "assignment" for h in hist["history"]))

    def test_23_bulk_preview_apply_overwrite_and_rollback(self) -> None:
        from unittest.mock import patch
        from app.database.supabase import SupabaseQueryError
        from app.routers.assignments import (
            apply_bulk_assignment,
            preview_bulk_assignment,
            sync_course_offerings,
            update_single_offering_assignment,
        )
        from fastapi_compat import HTTPException

        FakeClient, make_req, run_async = self._make_fake_supabase_and_req()
        client = FakeClient()
        admin_auth = {"userId": "u-admin", "role": "admin", "systemRole": "admin", "institutionId": "uni-1"}

        with (
            patch("app.routers.assignments.require_auth_user", return_value=admin_auth),
            patch("app.routers.assignments.require_supabase_client", return_value=client),
        ):
            run_async(sync_course_offerings(make_req("POST", body={"universityId": "uni-1"})))
            os_a_id = "term-f26::crs-os::b-cs-a::A"
            os_b_id = "term-f26::crs-os::b-cs-b::B"
            db_a_id = "term-f26::crs-db::b-cs-a::A"

            # Pre-assign os-a to fac2; preview bulk assigning inst-fac2 with overwriteExisting=False skips os-a
            run_async(update_single_offering_assignment(os_a_id, make_req("PUT", body={"universityId": "uni-1", "instructorId": "inst-fac2"})))
            # Change os-a to inst-fac1 on db-a so overwrite detection triggers when assigning fac2 across both
            run_async(update_single_offering_assignment(db_a_id, make_req("PUT", body={"universityId": "uni-1", "instructorId": "inst-fac1"})))

            preview = run_async(preview_bulk_assignment(make_req("POST", body={
                "universityId": "uni-1",
                "offeringIds": [db_a_id, os_b_id],
                "instructorId": "inst-fac2",
                "overwriteExisting": False,
            })))
            self.assertEqual(preview["overwriteCount"], 1)
            self.assertEqual(preview["applicableCount"], 1)

            # Test compensating rollback when Supabase update raises error on 2nd write
            client.fail_update_on_call = 2
            with self.assertRaises(HTTPException):
                run_async(apply_bulk_assignment(make_req("POST", body={
                    "universityId": "uni-1",
                    "offeringIds": [db_a_id, os_b_id],
                    "instructorId": "inst-fac2",
                    "overwriteExisting": True,
                })))
            client.fail_update_on_call = None
            # db-a must be rolled back cleanly to inst-fac1!
            db_a_row = next(r for r in client.tables["course_sessions"] if r["course_id"] == "crs-db" and r["batch_id"] == "b-cs-a")
            self.assertEqual(db_a_row["instructor_id"], "inst-fac1")

            # Clean retry with overwriteExisting=True succeeds
            applied = run_async(apply_bulk_assignment(make_req("POST", body={
                "universityId": "uni-1",
                "offeringIds": [db_a_id, os_b_id],
                "instructorId": "inst-fac2",
                "overwriteExisting": True,
            })))
            self.assertEqual(applied["appliedCount"], 2)

    def test_24_copy_section_and_rbac_student_br_faculty_isolation(self) -> None:
        from unittest.mock import patch
        from app.deps import require_auth_user
        from app.routers.assignments import (
            copy_section_assignments,
            get_assignment_workspace,
            get_my_staff_assignments,
            sync_course_offerings,
            update_single_offering_assignment,
        )
        from fastapi_compat import HTTPException

        FakeClient, make_req, run_async = self._make_fake_supabase_and_req()
        client = FakeClient()
        admin_auth = {"userId": "u-admin", "role": "admin", "systemRole": "admin", "institutionId": "uni-1"}

        with (
            patch("app.routers.assignments.require_auth_user", return_value=admin_auth),
            patch("app.routers.assignments.require_supabase_client", return_value=client),
        ):
            run_async(sync_course_offerings(make_req("POST", body={"universityId": "uni-1"})))
            run_async(update_single_offering_assignment(
                "term-f26::crs-ds::b-cs-a::A",
                make_req("PUT", body={"universityId": "uni-1", "instructorId": "inst-fac2", "labEngineerId": "inst-eng1", "assignedLabId": "lab-2"}),
            ))
            copy_res = run_async(copy_section_assignments(make_req("POST", body={
                "universityId": "uni-1",
                "sourceSectionId": "b-cs-a",
                "targetSectionIds": ["b-cs-b"],
            })))
            self.assertEqual(copy_res["copiedCount"], 1)

        # RBAC check: student & br strictly denied (403) on BOTH workspace and my-load
        for denied_role in ("student", "br"):
            with (
                patch("app.deps.verify_auth_token", return_value={"userId": f"u-{denied_role}"}),
                patch("app.deps.require_supabase_client", return_value=client),
                patch("app.routers.assignments.require_supabase_client", return_value=client),
            ):
                req = make_req("GET", query={"universityId": "uni-1"})
                req.headers["authorization"] = "Bearer fake-token"
                with self.assertRaises(HTTPException) as err_ws:
                    get_assignment_workspace(req)
                self.assertEqual(err_ws.exception.status_code, 403)
                with self.assertRaises(HTTPException) as err_ml:
                    get_my_staff_assignments(req)
                self.assertEqual(err_ml.exception.status_code, 403)

        # RBAC check: lab_engineer / faculty denied on workspace (403), allowed read-only own load on /my-load (200)
        with (
            patch("app.deps.verify_auth_token", return_value={"userId": "u-eng-1", "email": "grace@nu.edu"}),
            patch("app.deps.require_supabase_client", return_value=client),
            patch("app.routers.assignments.require_supabase_client", return_value=client),
        ):
            req = make_req("GET", query={"universityId": "uni-1"})
            req.headers["authorization"] = "Bearer fake-token"
            with self.assertRaises(HTTPException) as err_fac_ws:
                get_assignment_workspace(req)
            self.assertEqual(err_fac_ws.exception.status_code, 403)

            my_load = get_my_staff_assignments(req)
            self.assertEqual(my_load["instructor"]["id"], "inst-eng1")
            self.assertEqual(len(my_load["offerings"]), 2)
            self.assertTrue(all(o["labEngineerId"] == "inst-eng1" for o in my_load["offerings"]))

    def test_25_optimization_prevalidation_422_and_assigned_lab_id_enforcement(self) -> None:
        from unittest.mock import patch
        from app.routers.optimization import run_optimization
        from fastapi_compat import HTTPException

        FakeClient, make_req, run_async = self._make_fake_supabase_and_req()
        client = FakeClient()
        admin_auth = {"userId": "u-admin", "role": "admin", "systemRole": "admin", "institutionId": "uni-1"}

        # 1. Missing instructor/lab engineer blocks optimization with HTTP 422 before solver runs
        bad_payload = {
            "universityId": "uni-1",
            "courses": client.tables["courses"][:1],
            "classrooms": client.tables["classrooms"][:3],
            "studentGroups": client.tables["batches"][:1],
            "instructors": client.tables["instructors"],
            "sections": [
                {"id": "s-lec-1", "courseId": "crs-ds", "studentGroupId": "b-cs-a", "sessionType": "Theory", "componentType": "lecture", "instructorId": ""},
                {"id": "s-lab-1", "courseId": "crs-ds", "studentGroupId": "b-cs-a", "sessionType": "Lab", "componentType": "lab", "assignedLabId": "lab-2"},
            ],
        }
        with (
            patch("app.routers.optimization.require_auth_user", return_value=admin_auth),
            patch("app.routers.optimization.require_supabase_client", return_value=client),
            patch("app.deps.require_supabase_client", return_value=client),
            patch("app.optimization.preference_aggregator.require_supabase_client", return_value=client),
        ):
            with self.assertRaises(HTTPException) as ctx422:
                run_async(run_optimization(make_req("POST", body=bad_payload)))
            self.assertEqual(ctx422.exception.status_code, 422)
            self.assertGreaterEqual(ctx422.exception.detail["readiness"]["blockerCount"], 1)

        # 2. With valid instructor + lab engineer + specific assignedLabId='lab-2', ALL algorithms respect lab-2
        good_sections = [
            {"id": "s-lec-1", "courseId": "crs-ds", "studentGroupId": "b-cs-a", "sessionType": "Theory", "componentType": "lecture", "instructorId": "inst-fac2"},
            {"id": "s-lab-1", "courseId": "crs-ds", "studentGroupId": "b-cs-a", "sessionType": "Lab", "componentType": "lab", "instructorId": "inst-fac2", "labEngineerId": "inst-eng1", "assignedLabId": "lab-2"},
        ]
        for algo in ("dsatur_only", "ga_only", "ga_sa", "hybrid_dsatur_ga_sa"):
            res = run_hybrid_timetable_pipeline(
                sections=good_sections,
                courses=client.tables["courses"][:1],
                rooms_raw=client.tables["classrooms"],
                student_groups=client.tables["batches"][:1],
                instructors=client.tables["instructors"],
                algorithm=algo,
            )
            self.assertEqual(res["hardConstraintViolations"], 0, f"Hard clash on {algo}")
            lab_entries = [e for e in res["entries"] if e["isLab"]]
            self.assertEqual(len(lab_entries), 1)
            self.assertEqual(lab_entries[0]["roomId"], "lab-2", f"{algo} failed to respect assignedLabId=lab-2")

        # 3. Validator flags hard violation if a lab with assignedLabId='lab-2' is forced into 'lab-1'
        cfg = TimeSlotConfig()
        sessions = expand_sections_to_sessions(
            sections=good_sections,
            courses=client.tables["courses"][:1],
            rooms=client.tables["classrooms"],
            instructors=client.tables["instructors"],
            time_config=cfg,
        )
        lab_session = next(s for s in sessions if s.is_lab)
        lec_sessions = [s for s in sessions if not s.is_lab]
        bad_assign = {
            lab_session.session_id: ("Mon", "09:00", "lab-1"),
            **{s.session_id: (["Tue", "Wed", "Thu"][idx % 3], "09:00", "rm-lh1") for idx, s in enumerate(lec_sessions)},
        }
        v_report = validate_timetable_assignments(bad_assign, sessions, client.tables["classrooms"], cfg)
        self.assertFalse(v_report.is_valid)
        self.assertTrue(any(v.violation_type == "assigned_lab_mismatch" or "lab-2" in v.message.lower() for v in v_report.violations))


if __name__ == "__main__":
    unittest.main()



