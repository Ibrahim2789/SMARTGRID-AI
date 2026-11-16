"""
SmartGrid AI — Supabase PostgreSQL PostgREST Client Layer
Provides full CRUD, filtering, upsert, count, and diagnostic probing over HTTPS PostgREST
using Python's standard `urllib.request` (zero third-party driver compilation required).
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

from app.core.config import settings


class SupabaseQueryError(Exception):
    def __init__(self, status_code: int, message: str, details: Any = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.details = details


class SupabaseRestClient:
    """
    Zero-dependency Supabase PostgREST client over HTTPS.
    """

    def __init__(self, url: str, api_key: str) -> None:
        self.base_url = url.rstrip("/")
        self.rest_url = f"{self.base_url}/rest/v1"
        self.api_key = api_key

    def _headers(self, prefer: Optional[str] = None) -> Dict[str, str]:
        headers = {
            "apikey": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        # Legacy JWT service_role/anon keys require Authorization: Bearer <jwt>.
        # New Supabase opaque keys (sb_secret_... / sb_publishable_...) authenticate via apikey only.
        if not self.api_key.startswith("sb_"):
            headers["Authorization"] = f"Bearer {self.api_key}"
        if prefer:
            headers["Prefer"] = prefer
        return headers

    def _request(
        self,
        method: str,
        path: str,
        query: Optional[Dict[str, str]] = None,
        payload: Any = None,
        prefer: Optional[str] = None,
        timeout: float = 15.0,
    ) -> tuple[int, Dict[str, str], Any]:
        url = f"{self.rest_url}/{path.lstrip('/')}"
        if query:
            qs = urllib.parse.urlencode(query, safe="(),.*:@", quote_via=urllib.parse.quote)
            url = f"{url}?{qs}"

        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        req = urllib.request.Request(
            url,
            data=data,
            headers=self._headers(prefer=prefer),
            method=method.upper(),
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8")
                parsed = json.loads(raw) if raw else None
                resp_headers = {k.lower(): v for k, v in resp.headers.items()}
                return resp.status, resp_headers, parsed
        except urllib.error.HTTPError as err:
            raw_err = ""
            parsed_err: Any = None
            try:
                raw_err = err.read().decode("utf-8")
                parsed_err = json.loads(raw_err)
            except Exception:
                parsed_err = raw_err or str(err)

            msg = (
                parsed_err.get("message")
                if isinstance(parsed_err, dict) and parsed_err.get("message")
                else str(parsed_err)
            )
            raise SupabaseQueryError(err.code, msg, parsed_err) from err

    def select(
        self,
        table: str,
        filters: Optional[Dict[str, str]] = None,
        select: str = "*",
        order: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        query: Dict[str, str] = {"select": select}
        if filters:
            query.update(filters)
        if order:
            query["order"] = order
        if limit is not None:
            query["limit"] = str(limit)

        _, _, data = self._request("GET", table, query=query)
        return data if isinstance(data, list) else []

    def select_one(
        self,
        table: str,
        filters: Optional[Dict[str, str]] = None,
        select: str = "*",
        order: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        rows = self.select(table, filters=filters, select=select, order=order, limit=1)
        return rows[0] if rows else None

    def count(self, table: str, filters: Optional[Dict[str, str]] = None) -> int:
        query: Dict[str, str] = {"select": "id", "limit": "1"}
        if filters:
            query.update(filters)
        _, headers, _ = self._request("GET", table, query=query, prefer="count=exact")
        content_range = headers.get("content-range", "")
        if "/" in content_range:
            total_str = content_range.split("/", 1)[1].strip()
            if total_str.isdigit():
                return int(total_str)
        return 0

    def insert(
        self,
        table: str,
        payload: Dict[str, Any] | List[Dict[str, Any]],
        upsert: bool = False,
        ignore_duplicates: bool = False,
        on_conflict: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        prefer = "return=representation"
        if ignore_duplicates:
            prefer = "resolution=ignore-duplicates,return=representation"
        elif upsert:
            prefer = "resolution=merge-duplicates,return=representation"

        query: Dict[str, str] = {}
        if on_conflict:
            query["on_conflict"] = on_conflict

        _, _, data = self._request("POST", table, query=query or None, payload=payload, prefer=prefer)
        return data if isinstance(data, list) else ([] if data is None else [data])

    def update(
        self,
        table: str,
        match_filters: Dict[str, str],
        payload: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        _, _, data = self._request(
            "PATCH",
            table,
            query=match_filters,
            payload=payload,
            prefer="return=representation",
        )
        return data if isinstance(data, list) else ([] if data is None else [data])

    def delete(
        self,
        table: str,
        match_filters: Dict[str, str],
    ) -> List[Dict[str, Any]]:
        _, _, data = self._request(
            "DELETE",
            table,
            query=match_filters,
            prefer="return=representation",
        )
        return data if isinstance(data, list) else ([] if data is None else [data])


def get_supabase_client() -> Optional[SupabaseRestClient]:
    """
    Returns an initialized SupabaseRestClient if valid Supabase HTTPS URL and key are available,
    or None if external Supabase credentials are not configured.
    """
    if not settings.is_supabase_configured:
        return None
    return SupabaseRestClient(settings.effective_supabase_url, settings.effective_supabase_key)


def require_supabase_client() -> SupabaseRestClient:
    client = get_supabase_client()
    if not client:
        raise SupabaseQueryError(
            503,
            "Supabase is not configured. Please set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.",
        )
    return client


def probe_supabase_rest() -> Dict[str, Any]:
    """Checks HTTPS reachability and table read/write permissions against Supabase PostgREST without exposing secrets."""
    client = get_supabase_client()
    if not client:
        return {"reachable": False, "reason": "not_configured"}

    supa_env_keys = [k for k in sorted(os.environ.keys()) if "SUPA" in k.upper() or "SERVICE" in k.upper()]
    table_statuses: Dict[str, Any] = {}
    for tbl in ("institutions", "batches", "users", "courses", "polls"):
        try:
            rows = client.select(tbl, select="id", limit=1)
            table_statuses[tbl] = {"status": 200, "rows": len(rows)}
        except SupabaseQueryError as err:
            table_statuses[tbl] = {"status": err.status_code, "message": err.message}
        except Exception as exc:
            table_statuses[tbl] = {"error": type(exc).__name__}

    write_tables: Dict[str, Any] = {}
    all_writable = True
    for w_tbl in ("institutions", "users", "batches", "polls"):
        try:
            client.insert(w_tbl, {})
            write_tables[w_tbl] = {"status": 201, "writable": True}
        except SupabaseQueryError as err:
            tbl_writable = err.status_code == 400 and "row-level security" not in err.message.lower()
            if not tbl_writable:
                all_writable = False
            write_tables[w_tbl] = {
                "status": err.status_code,
                "writable": tbl_writable,
                "message": err.message,
            }
        except Exception as exc:
            all_writable = False
            write_tables[w_tbl] = {"writable": False, "error": type(exc).__name__}

    rls_write_check: Dict[str, Any] = {
        "writable": all_writable,
        "status": write_tables.get("institutions", {}).get("status"),
        "message": write_tables.get("institutions", {}).get("message"),
        "tables": write_tables,
    }

    inst_status = table_statuses.get("institutions", {}).get("status")
    return {
        "reachable": True,
        "httpStatus": inst_status,
        "schemaReady": inst_status == 200,
        "tableStatuses": table_statuses,
        "rlsWriteCheck": rls_write_check,
        "usingServiceRoleKey": settings.has_valid_service_role_key,
        "envKeyNames": supa_env_keys,
    }


def _classify_key_format(val: str) -> str:
    s = (val or "").strip()
    if not s:
        return "empty"
    low = s.lower()
    if low.startswith("your-") or "your-service-role" in low or "your-anon-key" in low or "[your-" in low:
        return "placeholder"
    if s.startswith("eyJ"):
        return "jwt"
    if s.startswith("sb_secret_"):
        return "sb_secret"
    if s.startswith("sb_publishable_"):
        return "sb_publishable"
    return f"other(len={len(s)})"


def get_database_connection_status() -> Dict[str, Any]:
    """
    Reports transparent Supabase database connection status without fabricating or exposing credentials.
    """
    rest_probe = probe_supabase_rest() if settings.is_supabase_configured else None
    schema_ready = bool(rest_probe and rest_probe.get("schemaReady"))
    writable = bool(rest_probe and (rest_probe.get("rlsWriteCheck") or {}).get("writable"))
    conn_status = (
        "connected"
        if (schema_ready and writable)
        else ("read_only" if schema_ready else "disconnected")
    )
    return {
        "status": conn_status,
        "provider": "supabase-postgresql",
        "serviceRoleConnected": bool(settings.has_valid_service_role_key and writable),
        "supabaseConfigured": settings.is_supabase_configured,
        "supabaseUrlProvided": bool(settings.supabase_url),
        "supabaseUrlValid": bool(settings.effective_supabase_url),
        "supabaseAnonKeyProvided": bool(settings.supabase_anon_key),
        "supabaseAnonKeyValid": settings.has_valid_anon_key,
        "supabaseServiceRoleKeyProvided": bool(settings.supabase_service_role_key),
        "supabaseServiceRoleKeyValid": settings.has_valid_service_role_key,
        "supabaseServiceRoleKeyFormat": _classify_key_format(settings.supabase_service_role_key),
        "supabaseDbUrlProvided": bool(settings.supabase_db_url),
        "supabaseRestProbe": rest_probe,
        "schemaFile": "supabase/schema.sql",
        "migrationDirectory": "supabase/migrations/",
        "activePersistenceEngine": "supabase-postgresql",
    }
