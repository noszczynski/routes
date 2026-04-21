from __future__ import annotations

from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from typing import Any
from urllib.parse import urlparse

from .config import Settings
from .router import RoutingError
from .service import (
	RequestValidationError,
	RoutingEngineService,
	ServiceUnavailableError,
)


class RoutingHttpHandler(BaseHTTPRequestHandler):
	engine_service: RoutingEngineService
	server_version = "routes-routing-engine/0.1"

	def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API.
		path = urlparse(self.path).path
		if path == "/":
			self._write_json(
				HTTPStatus.OK,
				{
					"service": "routing-engine",
					"health_url": "/health",
					"route_url": "/route",
				},
			)
			return

		if path == "/health":
			self._write_json(HTTPStatus.OK, self.engine_service.health())
			return

		self._write_error(HTTPStatus.NOT_FOUND, "Route not found")

	def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API.
		path = urlparse(self.path).path
		if path != "/route":
			self._write_error(HTTPStatus.NOT_FOUND, "Route not found")
			return

		try:
			payload = self._read_json_body()
			result = self.engine_service.route(payload)
		except RequestValidationError as exc:
			self._write_error(HTTPStatus.BAD_REQUEST, str(exc))
			return
		except ServiceUnavailableError as exc:
			self._write_error(HTTPStatus.SERVICE_UNAVAILABLE, str(exc))
			return
		except RoutingError as exc:
			self._write_error(HTTPStatus.UNPROCESSABLE_ENTITY, str(exc))
			return

		self._write_json(HTTPStatus.OK, result)

	def log_message(self, format: str, *args: Any) -> None:
		print(
			"%s - - [%s] %s"
			% (
				self.address_string(),
				self.log_date_time_string(),
				format % args,
			),
		)

	def _read_json_body(self) -> dict[str, Any]:
		try:
			content_length = int(self.headers.get("Content-Length", "0"))
		except ValueError as exc:
			raise RequestValidationError("Invalid Content-Length header") from exc

		raw_body = self.rfile.read(content_length) if content_length > 0 else b"{}"
		try:
			payload = json.loads(raw_body.decode("utf-8"))
		except json.JSONDecodeError as exc:
			raise RequestValidationError("Request body must be valid JSON") from exc

		if not isinstance(payload, dict):
			raise RequestValidationError("Request body must be a JSON object")
		return payload

	def _write_error(self, status: HTTPStatus, message: str) -> None:
		self._write_json(status, {"error": message})

	def _write_json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
		body = json.dumps(payload).encode("utf-8")
		self.send_response(status)
		self.send_header("Content-Type", "application/json; charset=utf-8")
		self.send_header("Content-Length", str(len(body)))
		self.end_headers()
		self.wfile.write(body)


def main() -> None:
	settings = Settings.from_env()
	engine_service = RoutingEngineService(settings)
	handler = type(
		"RoutingHttpHandlerWithService",
		(RoutingHttpHandler,),
		{"engine_service": engine_service},
	)

	server = ThreadingHTTPServer((settings.host, settings.port), handler)
	print(f"Routing engine is listening on http://{settings.host}:{settings.port}")
	try:
		server.serve_forever()
	except KeyboardInterrupt:
		print("Shutting down routing engine")
	finally:
		server.server_close()
