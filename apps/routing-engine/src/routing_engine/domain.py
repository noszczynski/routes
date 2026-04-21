from __future__ import annotations

from dataclasses import dataclass, field
from math import atan2, cos, inf, radians, sin, sqrt
from typing import Literal

Profile = Literal["runner", "road_bike", "gravel_bike"]

PROFILE_ALIASES: dict[str, Profile] = {
	"runner": "runner",
	"walking": "runner",
	"road_bike": "road_bike",
	"driving": "road_bike",
	"gravel_bike": "gravel_bike",
	"cycling": "gravel_bike",
}

SUPPORTED_HIGHWAYS = {
	"cycleway",
	"footway",
	"living_street",
	"path",
	"pedestrian",
	"primary",
	"primary_link",
	"residential",
	"secondary",
	"secondary_link",
	"service",
	"tertiary",
	"tertiary_link",
	"track",
	"trunk",
	"trunk_link",
	"unclassified",
}

WEIGHTS: dict[Profile, dict[str, dict[str, float]]] = {
	"runner": {
		"highway": {
			"footway": 1.0,
			"path": 1.05,
			"track": 1.15,
			"pedestrian": 1.2,
			"residential": 1.4,
			"secondary": 2.5,
			"primary": 3.0,
			"trunk": 999.0,
		},
		"surface": {
			"asphalt": 1.0,
			"paved": 1.0,
			"compacted": 1.0,
			"gravel": 1.1,
			"fine_gravel": 1.1,
			"dirt": 1.2,
			"ground": 1.2,
			"mud": 2.0,
		},
		"tracktype": {
			"grade1": 1.0,
			"grade2": 1.0,
			"grade3": 1.05,
			"grade4": 1.1,
			"grade5": 1.2,
		},
	},
	"road_bike": {
		"highway": {
			"cycleway": 1.0,
			"secondary": 1.05,
			"primary": 1.1,
			"tertiary": 1.15,
			"residential": 1.25,
			"path": 2.5,
			"track": 3.5,
			"footway": 999.0,
			"trunk": 999.0,
		},
		"surface": {
			"asphalt": 1.0,
			"paved": 1.0,
			"concrete": 1.0,
			"compacted": 1.3,
			"fine_gravel": 2.5,
			"gravel": 4.0,
			"dirt": 8.0,
			"ground": 8.0,
			"mud": 999.0,
		},
		"tracktype": {
			"grade1": 1.0,
			"grade2": 1.5,
			"grade3": 2.0,
			"grade4": 4.0,
			"grade5": 8.0,
		},
	},
	"gravel_bike": {
		"highway": {
			"track": 1.0,
			"path": 1.05,
			"cycleway": 1.15,
			"residential": 1.25,
			"tertiary": 1.4,
			"secondary": 1.7,
			"primary": 2.5,
			"trunk": 999.0,
		},
		"surface": {
			"gravel": 1.0,
			"fine_gravel": 1.0,
			"dirt": 1.05,
			"ground": 1.1,
			"compacted": 1.1,
			"asphalt": 1.7,
			"paved": 1.8,
			"concrete": 1.8,
			"mud": 2.5,
		},
		"tracktype": {
			"grade1": 1.4,
			"grade2": 1.0,
			"grade3": 1.05,
			"grade4": 1.1,
			"grade5": 1.25,
		},
	},
}


@dataclass(frozen=True, slots=True)
class Node:
	id: int
	lat: float
	lon: float


@dataclass(frozen=True, slots=True)
class Edge:
	node_from: int
	node_to: int
	distance_m: float
	surface: str
	highway: str
	bicycle: str | None = None
	foot: str | None = None
	tracktype: str | None = None
	access: str | None = None
	oneway: bool = False


@dataclass(slots=True)
class RoadGraph:
	nodes: dict[int, Node] = field(default_factory=dict)
	adjacency: dict[int, list[Edge]] = field(default_factory=dict)

	def add_edge(self, edge: Edge) -> None:
		self.adjacency.setdefault(edge.node_from, []).append(edge)
		if edge.oneway:
			return

		self.adjacency.setdefault(edge.node_to, []).append(
			Edge(
				node_from=edge.node_to,
				node_to=edge.node_from,
				distance_m=edge.distance_m,
				surface=edge.surface,
				highway=edge.highway,
				bicycle=edge.bicycle,
				foot=edge.foot,
				tracktype=edge.tracktype,
				access=edge.access,
				oneway=False,
			),
		)

	@property
	def edge_count(self) -> int:
		return sum(len(edges) for edges in self.adjacency.values())


def normalize_profile(profile: str | None) -> Profile:
	if profile is None:
		return "gravel_bike"

	normalized = PROFILE_ALIASES.get(profile)
	if normalized is None:
		raise ValueError(f"Unsupported routing profile: {profile}")
	return normalized


def is_routable_way(tags: dict[str, str]) -> bool:
	highway = tags.get("highway")
	if not highway or highway not in SUPPORTED_HIGHWAYS:
		return False

	if tags.get("area") == "yes":
		return False

	if tags.get("access") in {"no", "private"}:
		return False

	return True


def haversine(first: Node, second: Node) -> float:
	return haversine_coords(first.lat, first.lon, second.lat, second.lon)


def haversine_coords(
	first_lat: float,
	first_lon: float,
	second_lat: float,
	second_lon: float,
) -> float:
	earth_radius = 6_371_000
	first_lat_rad = radians(first_lat)
	second_lat_rad = radians(second_lat)
	lat_delta = radians(second_lat - first_lat)
	lon_delta = radians(second_lon - first_lon)
	a = (
		sin(lat_delta / 2) ** 2
		+ cos(first_lat_rad) * cos(second_lat_rad) * sin(lon_delta / 2) ** 2
	)
	return earth_radius * 2 * atan2(sqrt(a), sqrt(1 - a))


def edge_cost(edge: Edge, profile: Profile) -> float:
	if not _edge_is_allowed(edge, profile):
		return inf

	weights = WEIGHTS[profile]
	highway_multiplier = weights["highway"].get(edge.highway, 1.4)
	surface_multiplier = weights["surface"].get(edge.surface, 1.15)
	tracktype_multiplier = weights["tracktype"].get(edge.tracktype or "", 1.0)

	if (
		highway_multiplier >= 999.0
		or surface_multiplier >= 999.0
		or tracktype_multiplier >= 999.0
	):
		return inf

	return edge.distance_m * highway_multiplier * surface_multiplier * tracktype_multiplier


def _edge_is_allowed(edge: Edge, profile: Profile) -> bool:
	if edge.access in {"no", "private"}:
		return False

	if profile == "runner":
		if edge.foot in {"no", "private"}:
			return False
		return True

	if edge.bicycle in {"no", "private"}:
		return False

	if edge.highway == "footway" and edge.bicycle not in {
		"yes",
		"designated",
		"permissive",
	}:
		return False

	return True
