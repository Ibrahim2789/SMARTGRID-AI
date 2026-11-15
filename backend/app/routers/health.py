"""Health & Supabase PostgreSQL database diagnostic endpoints."""

from __future__ import annotations

from typing import Any, Dict

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
