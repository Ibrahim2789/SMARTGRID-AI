"""
SmartGrid AI — Multi-University Backend Server (Python + FastAPI)
Initializes the relational database, configures FastAPI middleware, and mounts
the central router (`app.router.api_router`) which delegates to modular endpoint files
under `app.routers.*`.
"""

from __future__ import annotations

import os

from app.deps import get_user_auth_context, require_auth_user  # noqa: F401
from app.router import api_router
from database import initialize_voting_database
from fastapi_compat import CORSMiddleware, FastAPI, run_fastapi_app

# Ensure Supabase PostgreSQL schema seed data is initialized when configured
initialize_voting_database()

app = FastAPI(
    title="SmartGrid AI Multi-University API",
    version="2.0.0",
    description="Python + FastAPI backend for SmartGrid AI University-Independent Timetable & Voting Platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount central API router (routes to modular endpoint files under app/routers/)
app.include_router(api_router)


if __name__ == "__main__":
    port = int(os.environ.get("PYTHON_BACKEND_PORT", "8001"))
    host = os.environ.get("PYTHON_BACKEND_HOST", "127.0.0.1")
    run_fastapi_app(app, host=host, port=port)
