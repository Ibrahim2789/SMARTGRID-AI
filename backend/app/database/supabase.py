"""
SmartGrid AI — Supabase PostgreSQL PostgREST Client Layer
Provides full CRUD, filtering, upsert, count, and diagnostic probing over HTTPS PostgREST
using Python's standard `urllib.request` (zero third-party driver compilation required).
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Set

from app.core.config import settings


class SupabaseQueryError(Exception):
    def __init__(self, status_code: int, message: str, details: Any = None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.details = details


_SCHEMA_CACHE: Dict[str, tuple[float, Dict[str, Set[str]]]] = {}
_SCHEMA_ERROR_CACHE: Dict[str, Optional[str]] = {}
_DYNAMIC_MISSING_COLS: Dict[tuple[str, str], Set[str]] = {}
_COLUMN_PROBE_CACHE: Dict[tuple[str, str, str], bool] = {}
_SCHEMA_TTL_SECONDS = 300.0
_MISSING_COL_RE = re.compile(r"Could not find the '([^']+)' column", re.IGNORECASE)
_PG_MISSING_COL_RE = re.compile(r"column [a-zA-Z0-9_]+\.([a-zA-Z0-9_]+) does not exist", re.IGNORECASE)


class SupabaseRestClient:
    """
    Zero-dependency Supabase PostgREST client over HTTPS.
    """

    def __init__(self, url: str, api_key: str) -> None:
        self.base_url = url.rstrip("/")
        self.rest_url = f"{self.base_url}/rest/v1"
        self.api_key = api_key
        self.last_schema_error: Optional[str] = None

    def _headers(self, prefer: Optional[str] = None, accept: str = "application/json", include_content_type: bool = True) -> Dict[str, str]:
        headers = {
            "apikey": self.api_key,
            "Accept": accept,
        }
        if include_content_type:
            headers["Content-Type"] = "application/json"
        # Legacy JWT service_role/anon keys require Authorization: Bearer <jwt>.
        # New Supabase opaque keys (sb_secret_... / sb_publishable_...) authenticate via apikey only.
        if not self.api_key.startswith("sb_"):
            headers["Authorization"] = f"Bearer {self.api_key}"
        if prefer:
            headers["Prefer"] = prefer
        return headers

    def get_live_schema(self, force: bool = False) -> Dict[str, Set[str]]:
        now = time.monotonic()
        cached = _SCHEMA_CACHE.get(self.rest_url)
        if not force and cached and (now - cached[0]) < _SCHEMA_TTL_SECONDS:
            self.last_schema_error = _SCHEMA_ERROR_CACHE.get(self.rest_url)
            return cached[1]
        schema_map: Dict[str, Set[str]] = {}
        last_err: Optional[str] = None
        for accept_hdr in ("application/openapi+json", "application/json"):
            req = urllib.request.Request(
                f"{self.rest_url}/",
                headers=self._headers(accept=accept_hdr, include_content_type=False),
                method="GET",
            )
            try:
                with urllib.request.urlopen(req, timeout=8.0) as resp:
                    raw = resp.read().decode("utf-8")
                    doc = json.loads(raw) if raw else {}
                    defs = doc.get("definitions") or (doc.get("components") or {}).get("schemas") or {}
                    if isinstance(defs, dict):
                        for tbl_name, spec in defs.items():
                            if isinstance(spec, dict) and isinstance(spec.get("properties"), dict):
                                schema_map[tbl_name] = set(spec["properties"].keys())
                    if schema_map:
                        break
            except urllib.error.HTTPError as exc:
                last_err = f"HTTPError: {exc}"
                if exc.code in (401, 403):
                    break
            except Exception as exc:
                last_err = f"{type(exc).__name__}: {exc}"
        self.last_schema_error = None if schema_map else last_err
        _SCHEMA_ERROR_CACHE[self.rest_url] = self.last_schema_error
        if schema_map:
            _SCHEMA_CACHE[self.rest_url] = (now, schema_map)
        elif cached and cached[1]:
            _SCHEMA_CACHE[self.rest_url] = (now, cached[1])
            return cached[1]
        else:
            _SCHEMA_CACHE[self.rest_url] = (now, {})
        return schema_map

    def get_table_columns(self, table: str) -> Optional[Set[str]]:
        schema_map = self.get_live_schema()
        cols = schema_map.get(table)
        return cols if cols else None

    def has_column(self, table: str, column: str) -> bool:
        dyn = _DYNAMIC_MISSING_COLS.get((self.rest_url, table))
        if dyn and column in dyn:
            return False
        cols = self.get_table_columns(table)
        if cols:
            return column in cols
        cache_key = (self.rest_url, table, column)
        if cache_key in _COLUMN_PROBE_CACHE:
            return _COLUMN_PROBE_CACHE[cache_key]
        try:
            self._request("GET", table, query={"select": column, "limit": "0"}, timeout=5.0)
            _COLUMN_PROBE_CACHE[cache_key] = True
            return True
        except SupabaseQueryError as err:
            msg = err.message or ""
            if err.status_code == 400 and (_PG_MISSING_COL_RE.search(msg) or _MISSING_COL_RE.search(msg) or "does not exist" in msg.lower()):
                self._drop_cached_column(table, column)
                _COLUMN_PROBE_CACHE[cache_key] = False
                return False
            return True
        except Exception:
            return True

    def _drop_cached_column(self, table: str, column: str) -> None:
        _DYNAMIC_MISSING_COLS.setdefault((self.rest_url, table), set()).add(column)
        _COLUMN_PROBE_CACHE[(self.rest_url, table, column)] = False
        cached = _SCHEMA_CACHE.get(self.rest_url)
        if cached and table in cached[1]:
            cached[1][table].discard(column)

    def _filter_payload(self, table: str, payload: Any, drop_cols: Optional[Set[str]] = None) -> Any:
        cols = self.get_table_columns(table)
        dyn = _DYNAMIC_MISSING_COLS.get((self.rest_url, table), set())
        all_drops = (drop_cols or set()) | dyn
        if isinstance(payload, dict):
            if not payload:
                return payload
            return {
                k: v
                for k, v in payload.items()
                if (cols is None or k in cols) and (k not in all_drops)
            }
        if isinstance(payload, list):
            return [
                {
                    k: v
                    for k, v in row.items()
                    if (cols is None or k in cols) and (k not in all_drops)
                }
                if isinstance(row, dict)
                else row
                for row in payload
            ]
        return payload

    def _filter_select(self, table: str, select: str) -> str:
        if not select or select.strip() == "*":
            return select
        cols = self.get_table_columns(table)
        dyn = _DYNAMIC_MISSING_COLS.get((self.rest_url, table), set())
        parts = [p.strip() for p in select.split(",") if p.strip()]
        kept = [
            p
            for p in parts
            if "(" in p or ":" in p or ((cols is None or p in cols) and p not in dyn)
        ]
        return ",".join(kept) if kept else "*"

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
        for attempt in range(4):
            query: Dict[str, str] = {"select": self._filter_select(table, select)}
            if filters:
                query.update(filters)
            if order:
                query["order"] = order
            if limit is not None:
                query["limit"] = str(limit)

            try:
                _, _, data = self._request("GET", table, query=query)
                return data if isinstance(data, list) else []
            except SupabaseQueryError as err:
                if err.status_code == 400 and attempt < 3:
                    m = _PG_MISSING_COL_RE.search(err.message or "") or _MISSING_COL_RE.search(err.message or "")
                    if m:
                        self._drop_cached_column(table, m.group(1))
                        continue
                raise

        return []

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

        dropped: Set[str] = set()
        current_payload = self._filter_payload(table, payload)
        for _ in range(16):
            try:
                _, _, data = self._request("POST", table, query=query or None, payload=current_payload, prefer=prefer)
                return data if isinstance(data, list) else ([] if data is None else [data])
            except SupabaseQueryError as err:
                if err.status_code == 400:
                    m = _MISSING_COL_RE.search(err.message or "")
                    if m and m.group(1) not in dropped:
                        missing_col = m.group(1)
                        dropped.add(missing_col)
                        self._drop_cached_column(table, missing_col)
                        current_payload = self._filter_payload(table, payload, drop_cols=dropped)
                        continue
                raise

        _, _, data = self._request("POST", table, query=query or None, payload=current_payload, prefer=prefer)
        return data if isinstance(data, list) else ([] if data is None else [data])

    def update(
        self,
        table: str,
        match_filters: Dict[str, str],
        payload: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        dropped: Set[str] = set()
        current_payload = self._filter_payload(table, payload)
        if isinstance(current_payload, dict) and payload and not current_payload:
            return []
        for _ in range(16):
            try:
                _, _, data = self._request(
                    "PATCH",
                    table,
                    query=match_filters,
                    payload=current_payload,
                    prefer="return=representation",
                )
                return data if isinstance(data, list) else ([] if data is None else [data])
            except SupabaseQueryError as err:
                if err.status_code == 400:
                    m = _MISSING_COL_RE.search(err.message or "")
                    if m and m.group(1) not in dropped:
                        missing_col = m.group(1)
                        dropped.add(missing_col)
                        self._drop_cached_column(table, missing_col)
                        current_payload = self._filter_payload(table, payload, drop_cols=dropped)
                        if isinstance(current_payload, dict) and not current_payload:
                            return []
                        continue
                raise

        return []

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
        "activePersistenceEngine": "supabase-postgresql",
    }
