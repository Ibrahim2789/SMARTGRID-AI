"""Health & Supabase PostgreSQL database diagnostic endpoints."""

from __future__ import annotations

from typing import Any, Dict

from app.core.config import settings
from app.database.supabase import SupabaseQueryError, get_database_connection_status, get_supabase_client
from database import now_iso
from fastapi_compat import APIRouter, USING_NATIVE_FASTAPI

router = APIRouter(tags=["health"])


@router.get("/api/health")
def health_check() -> Dict[str, Any]:
    return {
        "status": "ok",
        "engine": "python-fastapi",
        "nativeFastApi": USING_NATIVE_FASTAPI,
        "persistence": "supabase-postgresql",
        "supabaseConfigured": settings.is_supabase_configured,
        "usingServiceRoleKey": settings.has_valid_service_role_key,
        "timestamp": now_iso(),
    }


@router.get("/api/database/status")
def database_status() -> Dict[str, Any]:
    status = get_database_connection_status()
    client = get_supabase_client()
    counts: Dict[str, int] = {
        "universities": 0,
        "batches": 0,
        "users": 0,
        "courses": 0,
        "instructors": 0,
        "classrooms": 0,
        "polls": 0,
        "optimizationRuns": 0,
        "timetableVersions": 0,
        "reschedulingProposals": 0,
    }
    count_errors: Dict[str, str] = {}

    if client is not None:
        table_map = {
            "universities": "institutions",
            "batches": "batches",
            "users": "users",
            "courses": "courses",
            "instructors": "instructors",
            "classrooms": "classrooms",
            "polls": "polls",
            "optimizationRuns": "optimization_runs",
            "timetableVersions": "timetable_versions",
            "reschedulingProposals": "rescheduling_proposals",
        }
        for key, tbl in table_map.items():
            try:
                counts[key] = client.count(tbl)
            except SupabaseQueryError as err:
                count_errors[tbl] = f"{err.status_code}: {err.message}"
        try:
            counts["classrooms"] += client.count("laboratories")
        except SupabaseQueryError as err:
            count_errors["laboratories"] = f"{err.status_code}: {err.message}"

    return {
        **status,
        "tableCounts": counts,
        "countErrors": count_errors or None,
        "timestamp": now_iso(),
    }


@router.get("/api/database/schema-info")
def database_schema_info() -> Dict[str, Any]:
    """
    Safely inspects live Supabase table reachability and row counts across all
    SmartGrid AI PostgreSQL tables (no secrets, no row contents).
    """
    client = get_supabase_client()
    if client is None:
        return {"configured": False, "tables": {}}

    expected_tables = [
        "institutions",
        "campuses",
        "buildings",
        "departments",
        "academic_programs",
        "semesters",
        "batches",
        "users",
        "students",
        "instructors",
        "instructor_availability",
        "instructor_preferences",
        "student_preferences",
        "classrooms",
        "laboratories",
        "room_equipment_capacities",
        "courses",
        "course_enrollments",
        "course_sessions",
        "scheduling_constraints",
        "timetable_versions",
        "timetable_entries",
        "optimization_runs",
        "optimization_scores",
        "optimization_poll_traceability",
        "disruptions",
        "rescheduling_proposals",
        "rescheduling_history",
        "br_assignments",
        "polls",
        "poll_options",
        "poll_votes",
        "timetable_feedback",
        "feedback",
        "schedule_proposals",
        "notifications",
        "import_history",
        "audit_logs",
    ]

    tables: Dict[str, Any] = {}
    reachable_count = 0
    errors: Dict[str, str] = {}

    for tbl in expected_tables:
        try:
            row_count = client.count(tbl)
            tables[tbl] = {"reachable": True, "rowCount": row_count}
            reachable_count += 1
        except SupabaseQueryError as err:
            tables[tbl] = {
                "reachable": False,
                "statusCode": err.status_code,
                "error": err.message,
            }
            errors[tbl] = f"{err.status_code}: {err.message}"

    live_schema = client.get_live_schema()
    return {
        "configured": True,
        "tableCount": len(expected_tables),
        "reachableCount": reachable_count,
        "allTablesReachable": reachable_count == len(expected_tables),
        "openapiSchemaTableCount": len(live_schema),
        "openapiSchemaError": client.last_schema_error,
        "tables": tables,
        "errors": errors or None,
        "timestamp": now_iso(),
    }


