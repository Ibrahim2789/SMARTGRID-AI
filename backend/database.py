"""
SmartGrid AI — Supabase PostgreSQL Connection Check, Password Hashing (scrypt), and Token Signing
Pure Supabase PostgREST persistence (zero SQLite dependency, zero sample/test account seeding).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.database.supabase import SupabaseQueryError, get_supabase_client

TOKEN_SECRET = os.environ.get("SMARTGRID_AUTH_SECRET", "smartgrid-institutional-secret-key-2026")


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def hash_password(password: str, salt: Optional[str] = None) -> str:
    """
    Compatible with Node's `crypto.scryptSync(password, salt, 64).toString('hex')`
    which uses N=16384, r=8, p=1, dklen=64 and UTF-8 bytes of the hex salt string.
    """
    actual_salt = salt or secrets.token_hex(16)
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=actual_salt.encode("utf-8"),
        n=16384,
        r=8,
        p=1,
        dklen=64,
    ).hex()
    return f"{actual_salt}:{derived}"


def verify_password(password: str, stored_hash: str) -> bool:
    if not stored_hash or ":" not in stored_hash:
        return False
    parts = stored_hash.split(":", 1)
    if len(parts) != 2:
        return False
    salt, key_hex = parts
    if not salt or not key_hex:
        return False
    try:
        candidate = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt.encode("utf-8"),
            n=16384,
            r=8,
            p=1,
            dklen=64,
        ).hex()
        return hmac.compare_digest(key_hex, candidate)
    except Exception:
        return False


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    padding = "=" * ((4 - len(s) % 4) % 4)
    return base64.urlsafe_b64decode((s + padding).encode("ascii"))


def sign_auth_token(payload: Dict[str, Any]) -> str:
    full_payload = {
        **payload,
        "exp": int(time.time() * 1000) + 1000 * 60 * 60 * 24 * 7,
    }
    data_bytes = json.dumps(full_payload, separators=(",", ":")).encode("utf-8")
    data_b64 = _b64url_encode(data_bytes)
    sig_bytes = hmac.new(
        TOKEN_SECRET.encode("utf-8"),
        data_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    sig_b64 = _b64url_encode(sig_bytes)
    return f"{data_b64}.{sig_b64}"


def verify_auth_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        if not token or "." not in token:
            return None
        data_b64, sig_b64 = token.split(".", 1)
        if not data_b64 or not sig_b64:
            return None
        expected_sig = _b64url_encode(
            hmac.new(
                TOKEN_SECRET.encode("utf-8"),
                data_b64.encode("ascii"),
                hashlib.sha256,
            ).digest()
        )
        if not hmac.compare_digest(sig_b64, expected_sig):
            return None
        parsed = json.loads(_b64url_decode(data_b64).decode("utf-8"))
        if int(parsed.get("exp", 0)) < int(time.time() * 1000):
            return None
        return parsed
    except Exception:
        return None


def initialize_voting_database() -> None:
    """
    Verifies Supabase connectivity and removes any legacy sample/demo institutions
    and test accounts without seeding sample records.
    """
    client = get_supabase_client()
    if client is None:
        print("[SmartGrid] Supabase credentials not configured; skipping startup check.")
        return

    try:
        # Remove any sample institutions (cascades to sample batches, users, courses, polls)
        client.delete("institutions", {"is_sample": "eq.true"})
        client.delete("institutions", {"id": "in.(inst-western-poly,inst-apex-tech)"})
    except SupabaseQueryError as err:
        if err.status_code in (401, 403):
            print(
                "[SmartGrid] Supabase RLS blocked startup cleanup (ensure SUPABASE_SERVICE_ROLE_KEY is active): "
                f"{err.message}"
            )
        else:
            print(f"[SmartGrid] Supabase startup check warning ({err.status_code}): {err.message}")
    except Exception as exc:
        print(f"[SmartGrid] Supabase startup check warning: {exc}")
