"""
SmartGrid AI — Core Configuration Module
Reads environment variables for Supabase PostgreSQL, JWT security, and AI Optimization defaults.
Never fabricates credentials; exposes `is_supabase_configured` so the app knows whether
external Supabase variables are supplied.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class Settings:
    app_name: str = os.environ.get("APP_NAME", "SmartGrid AI Multi-University API")
    app_env: str = os.environ.get("APP_ENV", "development")
    backend_host: str = os.environ.get("PYTHON_BACKEND_HOST", "127.0.0.1")
    backend_port: int = int(os.environ.get("PYTHON_BACKEND_PORT", "8001"))

    # Supabase configuration (only active when user configures real project credentials in .env)
    supabase_url: str = os.environ.get("SUPABASE_URL", "").strip()
    supabase_anon_key: str = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    supabase_service_role_key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    supabase_db_url: str = os.environ.get("SUPABASE_DB_URL", "").strip()

    # Auth / JWT configuration
    jwt_secret_key: str = os.environ.get("SMARTGRID_AUTH_SECRET", "smartgrid-institutional-secret-key-2026")
    jwt_algorithm: str = os.environ.get("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

    # Default optimization parameters
    ga_population_size: int = int(os.environ.get("GA_POPULATION_SIZE", "24"))
    ga_generations: int = int(os.environ.get("GA_GENERATIONS", "40"))
    ga_mutation_rate: float = float(os.environ.get("GA_MUTATION_RATE", "0.18"))
    ga_crossover_rate: float = float(os.environ.get("GA_CROSSOVER_RATE", "0.85"))
    sa_initial_temperature: float = float(os.environ.get("SA_INITIAL_TEMPERATURE", "120.0"))
    sa_cooling_rate: float = float(os.environ.get("SA_COOLING_RATE", "0.92"))
    sa_iterations: int = int(os.environ.get("SA_ITERATIONS", "80"))
    tabu_tenure: int = int(os.environ.get("TABU_TENURE", "7"))
    tabu_max_iterations: int = int(os.environ.get("TABU_MAX_ITERATIONS", "45"))

    @property
    def is_supabase_configured(self) -> bool:
        """Returns True only when non-placeholder Supabase URL and key are provided."""
        if not self.supabase_url or not (self.supabase_service_role_key or self.supabase_anon_key):
            return False
        if "your-project-ref.supabase.co" in self.supabase_url or "your-" in self.supabase_url:
            return False
        return True


settings = Settings()
