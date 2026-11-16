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


if __name__ == "__main__":
    unittest.main()
