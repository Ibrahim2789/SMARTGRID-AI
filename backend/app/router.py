"""
Central FastAPI Router for SmartGrid AI.
Aggregates all modular endpoint routers from `app.routers.*` and mounts them onto `api_router`.
"""

from __future__ import annotations

from app.routers import (
    analytics,
    assignments,
    auth,
    catalog,
    health,
    imports,
    institutions,
    optimization,
    preferences,
    rescheduling,
    timetables,
    voting,
)
from fastapi_compat import APIRouter

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(institutions.router)
api_router.include_router(auth.router)
api_router.include_router(voting.router)
api_router.include_router(catalog.router)
api_router.include_router(assignments.router)
api_router.include_router(imports.router)
api_router.include_router(preferences.router)
api_router.include_router(optimization.router)
api_router.include_router(timetables.router)
api_router.include_router(rescheduling.router)
api_router.include_router(analytics.router)
