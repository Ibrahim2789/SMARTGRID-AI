"""
CSV & Tabular Academic Data Import Endpoints (Supabase PostgreSQL).
Enforces Admin RBAC, strict university tenant isolation, server-side re-validation,
explicit duplicate conflict handling (skip / update / stop), idempotency,
atomic compensating rollback, downloadable error CSVs, and persistent import history.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.database.supabase import SupabaseQueryError, require_supabase_client
from app.deps import (
    get_query_param,
    parse_json_body,
    raise_supabase_http_error,
    require_auth_user,
)
from app.services.csv_import import (
    ADMIN_IMPORT_ROLES,
    CATEGORY_DEFINITIONS,
    VALID_CATEGORIES,
    CsvParseError,
    build_error_report_csv,
    commit_staged_import,
    generate_template_csv,
    validate_and_stage_import,
)
from fastapi_compat import APIRouter, HTTPException, Request

router = APIRouter(tags=["imports"])


def _resolve_target_institution(auth_user: Dict[str, Any], requested_inst_id: str) -> str:
    user_inst_id = str(auth_user.get("institutionId") or "").strip()
    role = str(auth_user.get("role") or "").lower()
    req_id = str(requested_inst_id or "").strip()
    if req_id and role != "super_admin" and user_inst_id and req_id != user_inst_id:
        raise HTTPException(
            status_code=403,
            detail={
                "error": (
                    "Access denied: Cross-institution data imports are blocked. "
                    "You can only import records for your own university workspace."
                )
            },
        )
    target = req_id or user_inst_id
    if not target:
        raise HTTPException(status_code=400, detail={"error": "Target institutionId is required."})
    return target


@router.get("/api/imports/schemas")
def get_import_schemas(request: Request) -> Dict[str, Any]:
    require_auth_user(request, allowed_roles=ADMIN_IMPORT_ROLES)
    return {
        "categories": list(VALID_CATEGORIES),
        "schemas": CATEGORY_DEFINITIONS,
    }


@router.get("/api/imports/template")
def get_import_template(request: Request) -> Dict[str, Any]:
    require_auth_user(request, allowed_roles=ADMIN_IMPORT_ROLES)
    category = get_query_param(request, "category", "courses").strip().lower()
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail={"error": f"Unsupported import category '{category}'."})
    csv_text = generate_template_csv(category)
    return {
        "category": category,
        "fileName": f"smartgrid_{category}_template.csv",
        "csvText": csv_text,
    }


@router.post("/api/imports/validate")
async def validate_import_payload(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=ADMIN_IMPORT_ROLES)
    body = await parse_json_body(request)

    category = str(body.get("category") or "courses").strip().lower()
    duplicate_mode = str(body.get("duplicateMode") or "skip").strip().lower()
    requested_inst_id = str(body.get("institutionId") or "").strip()
    institution_id = _resolve_target_institution(auth_user, requested_inst_id)

    csv_text: Optional[str] = body.get("csvText") if isinstance(body.get("csvText"), str) else None
    headers: Optional[List[str]] = body.get("headers") if isinstance(body.get("headers"), list) else None
    rows: Optional[List[List[str]]] = body.get("rows") if isinstance(body.get("rows"), list) else None
    column_mappings: Optional[Dict[str, str]] = (
        body.get("columnMappings") if isinstance(body.get("columnMappings"), dict) else None
    )

    client = require_supabase_client()
    try:
        result = validate_and_stage_import(
            client=client,
            institution_id=institution_id,
            category=category,
            duplicate_mode=duplicate_mode,
            csv_text=csv_text,
            headers=headers,
            rows=rows,
            column_mappings=column_mappings,
        )
    except CsvParseError as exc:
        raise HTTPException(status_code=400, detail={"error": exc.message, "line": exc.line})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)})
    except SupabaseQueryError as exc:
        raise_supabase_http_error(exc)

    error_csv = (
        build_error_report_csv(result["headers"], result["rows"])
        if result["summary"]["errorRows"] > 0
        else ""
    )

    # Strip raw plannedOperations DB secrets/internals from response, keep safe UI preview
    return {
        "institutionId": institution_id,
        "category": result["category"],
        "duplicateMode": result["duplicateMode"],
        "headers": result["headers"],
        "mappingInfo": result["mappingInfo"],
        "canProceed": result["canProceed"],
        "blockingReason": result["blockingReason"],
        "summary": result["summary"],
        "rows": result["rows"],
        "fieldDiffs": result["fieldDiffs"],
        "errorCsv": error_csv,
    }


@router.post("/api/imports/commit")
async def commit_import_payload(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=ADMIN_IMPORT_ROLES)
    body = await parse_json_body(request)

    category = str(body.get("category") or "courses").strip().lower()
    duplicate_mode = str(body.get("duplicateMode") or "skip").strip().lower()
    file_name = str(body.get("fileName") or f"{category}_import.csv").strip()
    confirm_updates = bool(body.get("confirmUpdates", False))
    atomic = bool(body.get("atomic", False))
    idempotency_key = str(body.get("idempotencyKey") or "").strip() or None
    requested_inst_id = str(body.get("institutionId") or "").strip()
    institution_id = _resolve_target_institution(auth_user, requested_inst_id)

    csv_text: Optional[str] = body.get("csvText") if isinstance(body.get("csvText"), str) else None
    headers: Optional[List[str]] = body.get("headers") if isinstance(body.get("headers"), list) else None
    rows: Optional[List[List[str]]] = body.get("rows") if isinstance(body.get("rows"), list) else None
    column_mappings: Optional[Dict[str, str]] = (
        body.get("columnMappings") if isinstance(body.get("columnMappings"), dict) else None
    )

    client = require_supabase_client()
    try:
        result = commit_staged_import(
            client=client,
            auth_user=auth_user,
            institution_id=institution_id,
            category=category,
            file_name=file_name,
            duplicate_mode=duplicate_mode,
            confirm_updates=confirm_updates,
            atomic=atomic,
            idempotency_key=idempotency_key,
            csv_text=csv_text,
            headers=headers,
            rows=rows,
            column_mappings=column_mappings,
        )
    except CsvParseError as exc:
        raise HTTPException(status_code=400, detail={"error": exc.message, "line": exc.line})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)})
    except SupabaseQueryError as exc:
        raise_supabase_http_error(exc)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail={"error": str(exc), "rolledBack": True})

    if result.get("blocked"):
        status_code = 409 if result.get("requiresConfirmation") else 422
        raise HTTPException(
            status_code=status_code,
            detail={
                "error": result.get("message") or "Import blocked by validation rules.",
                **result,
            },
        )

    return result


@router.get("/api/imports/history")
def list_import_history(request: Request) -> Dict[str, Any]:
    auth_user = require_auth_user(request, allowed_roles=ADMIN_IMPORT_ROLES)
    requested_inst_id = get_query_param(request, "institutionId", "")
    institution_id = _resolve_target_institution(auth_user, requested_inst_id)
    limit_raw = get_query_param(request, "limit", "30")
    try:
        limit = max(1, min(100, int(limit_raw)))
    except ValueError:
        limit = 30

    client = require_supabase_client()
    try:
        rows = client.select(
            "import_history",
            filters={"institution_id": f"eq.{institution_id}"},
            select="id,institution_id,user_id,user_name,user_email,category,file_name,duplicate_mode,status,total_rows,created_count,updated_count,skipped_count,failed_count,duration_ms,error_summary,created_at",
            order="created_at.desc",
            limit=limit,
        )
    except SupabaseQueryError as exc:
        msg = (exc.message or "").lower()
        if "import_history" in msg and ("does not exist" in msg or "could not find" in msg or exc.status_code == 404):
            return {"history": []}
        raise_supabase_http_error(exc)

    normalized = [
        {
            "id": r.get("id"),
            "institutionId": r.get("institution_id"),
            "userId": r.get("user_id"),
            "userName": r.get("user_name") or "Administrator",
            "userEmail": r.get("user_email") or "",
            "category": r.get("category"),
            "fileName": r.get("file_name"),
            "duplicateMode": r.get("duplicate_mode"),
            "status": r.get("status"),
            "totalRows": r.get("total_rows", 0),
            "createdCount": r.get("created_count", 0),
            "updatedCount": r.get("updated_count", 0),
            "skippedCount": r.get("skipped_count", 0),
            "failedCount": r.get("failed_count", 0),
            "durationMs": r.get("duration_ms", 0),
            "errorSummary": r.get("error_summary") or [],
            "createdAt": r.get("created_at"),
        }
        for r in rows
    ]
    return {"history": normalized}
