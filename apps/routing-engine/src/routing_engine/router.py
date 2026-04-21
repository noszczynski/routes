from __future__ import annotations

from dataclasses import dataclass
import heapq

from .domain import Node, Profile, RoadGraph, edge_cost, haversine
from .osm_loader import GridSpatialIndex, SnappedNode


class RoutingError(RuntimeError):
	pass


@dataclass(frozen=True, slots=True)
class RequestedWaypoint:
	lat: float
	lon: float


@dataclass(frozen=True, slots=True)
class SnappedWaypoint:
	requested_lat: float
	requested_lon: float
	node_id: int
	distance_m: float


@dataclass(frozen=True, slots=True)
class RoutingResult:
	profile: Profile
	coordinates: list[tuple[float, float]]
	distance_m: float
	snapped_waypoints: list[SnappedWaypoint]


def route_waypoints(
	graph: RoadGraph,
	index: GridSpatialIndex,
	waypoints: list[RequestedWaypoint],
	profile: Profile,
	max_snap_distance_meters: float,
) -> RoutingResult:
	if len(waypoints) < 2:
		raise RoutingError("At least two waypoints are required")

	snapped_waypoints = [
		_snap_waypoint(index, waypoint, max_snap_distance_meters) for waypoint in waypoints
	]

	path: list[int] = []
	for start, end in zip(snapped_waypoints, snapped_waypoints[1:]):
		segment = astar(graph, start.node_id, end.node_id, profile)
		if segment is None:
			raise RoutingError("Could not find a route between the requested waypoints")
		if not path:
			path.extend(segment)
			continue
		path.extend(segment[1:])

	coordinates = [
		(graph.nodes[node_id].lon, graph.nodes[node_id].lat)
		for node_id in _deduplicate_consecutive_nodes(path)
	]
	if len(coordinates) < 2:
		raise RoutingError("Routing returned too few coordinates")

	return RoutingResult(
		profile=profile,
		coordinates=coordinates,
		distance_m=_calculate_distance(coordinates),
		snapped_waypoints=snapped_waypoints,
	)


def astar(
	graph: RoadGraph,
	start_id: int,
	end_id: int,
	profile: Profile,
) -> list[int] | None:
	open_heap: list[tuple[float, float, int]] = []
	heapq.heappush(open_heap, (0.0, 0.0, start_id))

	came_from: dict[int, int] = {}
	g_score: dict[int, float] = {start_id: 0.0}
	visited: set[int] = set()
	end_node = graph.nodes[end_id]

	while open_heap:
		_, current_cost, current = heapq.heappop(open_heap)
		if current in visited:
			continue
		visited.add(current)

		if current == end_id:
			return _reconstruct_path(came_from, start_id, end_id)

		for edge in graph.adjacency.get(current, ()):
			if edge.node_to in visited:
				continue

			cost = edge_cost(edge, profile)
			if cost == float("inf"):
				continue

			next_cost = current_cost + cost
			if next_cost >= g_score.get(edge.node_to, float("inf")):
				continue

			g_score[edge.node_to] = next_cost
			came_from[edge.node_to] = current
			heuristic = haversine(graph.nodes[edge.node_to], end_node)
			heapq.heappush(open_heap, (next_cost + heuristic, next_cost, edge.node_to))

	return None


def coordinates_to_gpx(coordinates: list[tuple[float, float]]) -> str:
	trk_points = "".join(
		f'<trkpt lat="{lat:.6f}" lon="{lon:.6f}"></trkpt>'
		for lon, lat in coordinates
	)
	return (
		'<?xml version="1.0" encoding="UTF-8"?>'
		'<gpx version="1.1" creator="routes-routing-engine" '
		'xmlns="http://www.topografix.com/GPX/1/1">'
		"<trk><name>Rerouted track</name><trkseg>"
		f"{trk_points}"
		"</trkseg></trk></gpx>"
	)


def _snap_waypoint(
	index: GridSpatialIndex,
	waypoint: RequestedWaypoint,
	max_snap_distance_meters: float,
) -> SnappedWaypoint:
	snapped = index.nearest(
		lat=waypoint.lat,
		lon=waypoint.lon,
		max_distance_meters=max_snap_distance_meters,
	)
	if snapped is None:
		raise RoutingError("Could not snap waypoint to the routing graph")

	return _to_snapped_waypoint(waypoint, snapped)


def _to_snapped_waypoint(
	waypoint: RequestedWaypoint,
	snapped: SnappedNode,
) -> SnappedWaypoint:
	return SnappedWaypoint(
		requested_lat=waypoint.lat,
		requested_lon=waypoint.lon,
		node_id=snapped.node_id,
		distance_m=snapped.distance_m,
	)


def _reconstruct_path(
	came_from: dict[int, int],
	start_id: int,
	end_id: int,
) -> list[int]:
	current = end_id
	path = [current]
	while current in came_from:
		current = came_from[current]
		path.append(current)
	if path[-1] != start_id:
		path.append(start_id)
	path.reverse()
	return path


def _calculate_distance(coordinates: list[tuple[float, float]]) -> float:
	total_distance = 0.0
	for (first_lon, first_lat), (second_lon, second_lat) in zip(
		coordinates,
		coordinates[1:],
	):
		total_distance += haversine(
			Node(id=0, lat=first_lat, lon=first_lon),
			Node(id=0, lat=second_lat, lon=second_lon),
		)
	return round(total_distance, 2)


def _deduplicate_consecutive_nodes(path: list[int]) -> list[int]:
	result: list[int] = []
	for node_id in path:
		if result and result[-1] == node_id:
			continue
		result.append(node_id)
	return result
