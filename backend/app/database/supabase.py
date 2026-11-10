"""
SmartGrid AI — Supabase PostgreSQL & PostgREST Client Layer
Provides real HTTP PostgREST / PostgreSQL connectivity when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
are configured by the user in `.env`, without fabricating credentials, and seamlessly falls back
to the local relational engine when running offline or before `.env` is populated.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

from app.core.config import settings


class SupabaseRestClient:
    """
    Lightweight, zero-dependency Supabase PostgREST client using Python's standard `urllib.request`.
    Works with any real Supabase project once SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY
    are provided in `.env`.
    """

    def __init__(self, url: str, api_key: str) -> None:
        self.base_url = url.rstrip("/")
        self.rest_url = f"{self.base_url}/rest/v1"
        self.api_key = api_key

    def _headers(self, prefer: Optional[str] = None) -> Dict[str, str]:
        headers = {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        return headers

    def select(self, table: str, filters: Optional[Dict[str, str]] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        query: Dict[str, str] = {"select": "*"}
        if filters:
            query.update(filters)
        if limit is not None:
            query["limit"] = str(limit)
        qs = urllib.parse.urlencode(query)
        req = urllib.request.Request(
            f"{self.rest_url}/{table}?{qs}",
            headers=self._headers(),
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def insert(self, table: str, payload: Dict[str, Any] | List[Dict[str, Any]], upsert: bool = False) -> List[Dict[str, Any]]:
        prefer = "return=representation"
        if upsert:
            prefer = "resolution=merge-duplicates,return=representation"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{self.rest_url}/{table}",
            data=data,
            headers=self._headers(prefer=prefer),
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def update(self, table: str, match_filters: Dict[str, str], payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        qs = urllib.parse.urlencode(match_filters)
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{self.rest_url}/{table}?{qs}",
            data=data,
            headers=self._headers(prefer="return=representation"),
            method="PATCH",
        )
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            return json.loads(resp.read().decode("utf-8"))


def get_supabase_client() -> Optional[SupabaseRestClient]:
    """
    Returns an initialized SupabaseRestClient if SUPABASE_URL and keys are configured in `.env`,
    or None if the user has not yet configured external Supabase credentials.
    """
    if not settings.is_supabase_configured:
        return None
    key = settings.supabase_service_role_key or settings.supabase_anon_key
    return SupabaseRestClient(settings.supabase_url, key)


def get_database_connection_status() -> Dict[str, Any]:
    """
    Reports transparent database connection status without fabricating credentials.
    """
    return {
        "supabaseConfigured": settings.is_supabase_configured,
        "supabaseUrlProvided": bool(settings.supabase_url),
        "schemaFile": "supabase/schema.sql",
        "migrationDirectory": "supabase/migrations/",
        "activePersistenceEngine": "supabase-postgresql" if settings.is_supabase_configured else "local-relational-sql",
    }
