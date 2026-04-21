from __future__ import annotations

from pathlib import Path
from threading import Lock
from typing import Any

from .config import Settings
from .domain import normalize_profile
from .osm_loader import LoadedGraph, load_graph
from .router import RequestedWaypoint, RoutingError, coordinates_to_gpx, route_waypoints


class RequestValidationError(ValueError):
	pass


class ServiceUnavailableError(RuntimeError):
	pass


class RoutingEngineService:
	def __init__(self, settings: Settings) -> None:
		self.settings = settings
		self._lock = Lock()
		self._loaded_graph: LoadedGraph | None = None
		self._loaded_graph_mtime: float | None = None
		self._last_error: str | None = None

	def health(self) -> dict[str, Any]:
		graph = self._try_get_graph()
		return {
			"ready": graph is not None,
			"source_path": str(self.settings.osm_path) if self.settings.osm_path else None,
			"last_error": self._last_error,
			"graph": None
			if graph is None
			else {
				"nodes": len(graph.graph.nodes),
				"edges": graph.graph.edge_count,
				"loaded_at": graph.loaded_at.isoformat(),
			},
		}

	def route(self, payload: dict[str, Any]) -> dict[str, Any]:
		graph = self._require_graph()
		profile = normalize_profile(_get_optional_string(payload, "profile"))
		waypoints = _parse_waypoints(payload.get("waypoints"))
		result = route_waypoints(
			graph=graph.graph,
			index=graph.index,
			waypoints=waypoints,
			profile=profile,
			max_snap_distance_meters=self.settings.max_snap_distance_meters,
		)
		return {
			"profile": result.profile,
			"distance_m": result.distance_m,
			"coordinates": [[lon, lat] for lon, lat in result.coordinates],
			"gpx": coordinates_to_gpx(result.coordinates),
			"snapped_waypoints": [
				{
					"requested": {
						"lat": waypoint.requested_lat,
						"lon": waypoint.requested_lon,
					},
					"node_id": waypoint.node_id,
					"distance_m": round(waypoint.distance_m, 2),
				}
				for waypoint in result.snapped_waypoints
			],
		}

	def _require_graph(self) -> LoadedGraph:
		graph = self._try_get_graph()
		if graph is None:
			raise ServiceUnavailableError(
				self._last_error
				or "Routing graph is unavailable. Configure ROUTING_ENGINE_OSM_PATH first.",
			)
		return graph

	def _try_get_graph(self) -> LoadedGraph | None:
		if self.settings.osm_path is None:
			self._last_error = (
				"ROUTING_ENGINE_OSM_PATH is not set. Point it to a .osm or .osm.pbf file."
			)
			return None

		source_path = self.settings.osm_path.resolve()
		if not source_path.exists():
			self._last_error = f"Routing data file does not exist: {source_path}"
			return None

		current_mtime = source_path.stat().st_mtime
		with self._lock:
			if (
				self._loaded_graph is not None
				and self._loaded_graph.source_path == source_path
				and self._loaded_graph_mtime == current_mtime
			):
				return self._loaded_graph

			try:
				self._loaded_graph = load_graph(
					path=Path(source_path),
					cell_size_degrees=self.settings.grid_size_degrees,
				)
				self._loaded_graph_mtime = current_mtime
				self._last_error = None
			except Exception as exc:  # noqa: BLE001 - surfaced over HTTP.
				self._loaded_graph = None
				self._loaded_graph_mtime = None
				self._last_error = str(exc)
				return None

			return self._loaded_graph


def _get_optional_string(payload: dict[str, Any], key: str) -> str | None:
	value = payload.get(key)
	if value is None:
		return None
	if not isinstance(value, str):
		raise RequestValidationError(f"{key} must be a string")
	return value


def _parse_waypoints(value: Any) -> list[RequestedWaypoint]:
	if not isinstance(value, list):
		raise RequestValidationError("waypoints must be an array")
	if len(value) < 2:
		raise RequestValidationError("At least two waypoints are required")

	waypoints: list[RequestedWaypoint] = []
	for item in value:
		if not isinstance(item, dict):
			raise RequestValidationError("Each waypoint must be an object")

		lat = item.get("lat")
		lon = item.get("lon")
		if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
			raise RequestValidationError("Waypoint lat and lon must be numbers")
		if not -90 <= lat <= 90:
			raise RequestValidationError("Waypoint lat must be between -90 and 90")
		if not -180 <= lon <= 180:
			raise RequestValidationError("Waypoint lon must be between -180 and 180")

		waypoints.append(RequestedWaypoint(lat=float(lat), lon=float(lon)))

	return waypoints
