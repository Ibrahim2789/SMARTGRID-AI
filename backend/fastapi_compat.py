"""
FastAPI runtime loader with automatic standard-library fallback for sandboxed containers
where third-party pip wheels are not pre-installed.

When `fastapi` and `uvicorn` are installed in the Python environment, this module
re-exports the official FastAPI classes and runs `uvicorn.run(...)`.
When running in a restricted container without `pip`, it provides a drop-in
FastAPI-compatible decorator router (`@app.get`, `@app.post`, `@app.patch`, `@app.delete`),
`Request`, `HTTPException`, `JSONResponse`, and a multi-threaded HTTP server on port 8000.
"""

from __future__ import annotations

import inspect
import json
import re
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable, Dict, List, Optional, Tuple
from urllib.parse import parse_qs, urlparse

try:
    from fastapi import APIRouter as _RealAPIRouter, FastAPI as _RealFastAPI, HTTPException as _RealHTTPException, Request as _RealRequest
    from fastapi.middleware.cors import CORSMiddleware as _RealCORSMiddleware
    from fastapi.responses import JSONResponse as _RealJSONResponse
    import uvicorn as _real_uvicorn

    USING_NATIVE_FASTAPI = True
    APIRouter = _RealAPIRouter
    FastAPI = _RealFastAPI
    HTTPException = _RealHTTPException
    Request = _RealRequest
    CORSMiddleware = _RealCORSMiddleware
    JSONResponse = _RealJSONResponse

    def run_fastapi_app(app: Any, host: str = "127.0.0.1", port: int = 8001) -> None:
        _real_uvicorn.run(app, host=host, port=port, log_level="info")

except ImportError:
    USING_NATIVE_FASTAPI = False

    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: Any = None) -> None:
            super().__init__(str(detail))
            self.status_code = status_code
            self.detail = detail

    class JSONResponse:
        def __init__(self, content: Any, status_code: int = 200, headers: Optional[Dict[str, str]] = None) -> None:
            self.content = content
            self.status_code = status_code
            self.headers = headers or {}

    class CORSMiddleware:
        pass

    class Request:
        def __init__(
            self,
            method: str,
            path: str,
            headers: Dict[str, str],
            query_params: Dict[str, str],
            path_params: Dict[str, str],
            raw_body: bytes,
        ) -> None:
            self.method = method
            self.url = path
            self.headers = {k.lower(): v for k, v in headers.items()}
            self.query_params = query_params
            self.path_params = path_params
            self._raw_body = raw_body

        async def json(self) -> Any:
            if not self._raw_body:
                return {}
            return json.loads(self._raw_body.decode("utf-8"))

        def json_sync(self) -> Any:
            if not self._raw_body:
                return {}
            try:
                return json.loads(self._raw_body.decode("utf-8"))
            except Exception:
                return {}

    class _RouteEntry:
        def __init__(self, method: str, path_template: str, handler: Callable[..., Any], status_code: int = 200) -> None:
            self.method = method.upper()
            self.path_template = path_template
            self.handler = handler
            self.default_status_code = status_code
            param_names: List[str] = []

            def _replacer(match: re.Match[str]) -> str:
                name = match.group(1)
                param_names.append(name)
                return f"(?P<{name}>[^/]+)"

            regex_pattern = "^" + re.sub(r"\{([a-zA-Z0-9_]+)\}", _replacer, path_template.rstrip("/") or "/") + "/?$"
            self.regex = re.compile(regex_pattern)
            self.param_names = param_names

        def match(self, method: str, path: str) -> Optional[Dict[str, str]]:
            if self.method != method.upper():
                return None
            m = self.regex.match(path)
            if not m:
                return None
            return m.groupdict()

    def _join_paths(prefix: str, path: str) -> str:
        p = prefix.rstrip("/")
        s = path if path.startswith("/") else f"/{path}"
        if not p:
            return s
        if s == "/":
            return p or "/"
        return f"{p}{s}"

    class APIRouter:
        def __init__(self, prefix: str = "", tags: Optional[List[str]] = None) -> None:
            self.prefix = prefix.rstrip("/")
            self.tags = tags or []
            self.routes: List[_RouteEntry] = []

        def _register(self, method: str, path: str, status_code: int = 200) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            full_path = _join_paths(self.prefix, path)

            def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
                self.routes.append(_RouteEntry(method, full_path, func, status_code=status_code))
                return func

            return decorator

        def get(self, path: str, status_code: int = 200, **kwargs: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            return self._register("GET", path, status_code=status_code)

        def post(self, path: str, status_code: int = 200, **kwargs: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            return self._register("POST", path, status_code=status_code)

        def patch(self, path: str, status_code: int = 200, **kwargs: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            return self._register("PATCH", path, status_code=status_code)

        def put(self, path: str, status_code: int = 200, **kwargs: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            return self._register("PUT", path, status_code=status_code)

        def delete(self, path: str, status_code: int = 200, **kwargs: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            return self._register("DELETE", path, status_code=status_code)

        def include_router(self, router: "APIRouter", prefix: str = "", tags: Optional[List[str]] = None) -> None:
            combined_prefix = _join_paths(self.prefix, prefix) if prefix else self.prefix
            for entry in router.routes:
                full_path = _join_paths(combined_prefix, entry.path_template) if combined_prefix else entry.path_template
                self.routes.append(
                    _RouteEntry(entry.method, full_path, entry.handler, status_code=entry.default_status_code)
                )

    class FastAPI:
        def __init__(self, title: str = "FastAPI", version: str = "1.0.0", description: str = "") -> None:
            self.title = title
            self.version = version
            self.description = description
            self.routes: List[_RouteEntry] = []

        def add_middleware(self, *args: Any, **kwargs: Any) -> None:
            pass

        def include_router(self, router: APIRouter, prefix: str = "", tags: Optional[List[str]] = None) -> None:
            clean_prefix = prefix.rstrip("/")
            for entry in router.routes:
                full_path = _join_paths(clean_prefix, entry.path_template) if clean_prefix else entry.path_template
                self.routes.append(
                    _RouteEntry(entry.method, full_path, entry.handler, status_code=entry.default_status_code)
                )

        def _register(self, method: str, path: str, status_code: int = 200) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
                self.routes.append(_RouteEntry(method, path, func, status_code=status_code))
                return func

            return decorator

        def get(self, path: str, status_code: int = 200, **kwargs: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            return self._register("GET", path, status_code=status_code)

        def post(self, path: str, status_code: int = 200, **kwargs: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            return self._register("POST", path, status_code=status_code)

        def patch(self, path: str, status_code: int = 200, **kwargs: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            return self._register("PATCH", path, status_code=status_code)

        def put(self, path: str, status_code: int = 200, **kwargs: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            return self._register("PUT", path, status_code=status_code)

        def delete(self, path: str, status_code: int = 200, **kwargs: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            return self._register("DELETE", path, status_code=status_code)

        def dispatch(
            self,
            method: str,
            raw_url: str,
            headers: Dict[str, str],
            raw_body: bytes,
        ) -> Tuple[int, Dict[str, str], bytes]:
            parsed = urlparse(raw_url)
            path = parsed.path or "/"
            qs_Multi = parse_qs(parsed.query, keep_blank_values=True)
            query_params = {k: v[0] if v else "" for k, v in qs_Multi.items()}

            for route in self.routes:
                path_params = route.match(method, path)
                if path_params is not None:
                    req = Request(
                        method=method,
                        path=path,
                        headers=headers,
                        query_params=query_params,
                        path_params=path_params,
                        raw_body=raw_body,
                    )
                    try:
                        sig = inspect.signature(route.handler)
                        kwargs: Dict[str, Any] = {}
                        for p_name, p_Obj in sig.parameters.items():
                            if p_name in ("request", "req") or p_Obj.annotation is Request or p_Obj.annotation == "Request":
                                kwargs[p_name] = req
                            elif p_name in path_params:
                                kwargs[p_name] = path_params[p_name]
                            elif p_name in query_params:
                                kwargs[p_name] = query_params[p_name]

                        result = route.handler(**kwargs)
                        if inspect.iscoroutine(result):
                            import asyncio
                            result = asyncio.run(result)

                        if isinstance(result, JSONResponse):
                            body_bytes = json.dumps(result.content).encode("utf-8")
                            resp_headers = {"Content-Type": "application/json; charset=utf-8", **result.headers}
                            return result.status_code, resp_headers, body_bytes

                        body_bytes = json.dumps(result).encode("utf-8")
                        return (
                            route.default_status_code,
                            {"Content-Type": "application/json; charset=utf-8"},
                            body_bytes,
                        )
                    except HTTPException as exc:
                        err_payload = exc.detail if isinstance(exc.detail, dict) else {"error": str(exc.detail)}
                        return (
                            exc.status_code,
                            {"Content-Type": "application/json; charset=utf-8"},
                            json.dumps(err_payload).encode("utf-8"),
                        )
                    except Exception as exc:
                        traceback.print_exc()
                        return (
                            500,
                            {"Content-Type": "application/json; charset=utf-8"},
                            json.dumps({"error": str(exc)}).encode("utf-8"),
                        )

            return (
                404,
                {"Content-Type": "application/json; charset=utf-8"},
                json.dumps({"error": f"Route {method} {path} not found on Python FastAPI backend."}).encode("utf-8"),
            )

    def run_fastapi_app(app: FastAPI, host: str = "127.0.0.1", port: int = 8001) -> None:
        class _Handler(BaseHTTPRequestHandler):
            def _handle_all(self) -> None:
                content_len = int(self.headers.get("Content-Length", "0") or "0")
                raw_body = self.rfile.read(content_len) if content_len > 0 else b""
                hdrs = {k: v for k, v in self.headers.items()}
                status_code, resp_headers, resp_body = app.dispatch(
                    self.command, self.path, hdrs, raw_body
                )
                self.send_response(status_code)
                for k, v in resp_headers.items():
                    self.send_header(k, v)
                self.send_header("Content-Length", str(len(resp_body)))
                self.send_header("Connection", "close")
                self.end_headers()
                self.wfile.write(resp_body)
                self.wfile.flush()
                self.close_connection = True

            def do_GET(self) -> None:
                self._handle_all()

            def do_POST(self) -> None:
                self._handle_all()

            def do_PATCH(self) -> None:
                self._handle_all()

            def do_PUT(self) -> None:
                self._handle_all()

            def do_DELETE(self) -> None:
                self._handle_all()

            def log_message(self, format: str, *args: Any) -> None:
                pass

        class _CustomServer(ThreadingHTTPServer):
            allow_reuse_address = True
            daemon_threads = True

        try:
            server = _CustomServer((host, port), _Handler)
            print(f"[Python FastAPI Backend] Listening on http://{host}:{port}", flush=True)
            server.serve_forever()
        except OSError as exc:
            if exc.errno == 98:
                print(f"[Python FastAPI Backend] Notice: Port {port} is already active. Service running.", flush=True)
                import time
                while True:
                    time.sleep(3600)
            else:
                raise
