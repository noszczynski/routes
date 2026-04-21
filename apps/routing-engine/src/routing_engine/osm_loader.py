from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from math import ceil, floor
from pathlib import Path
from typing import Iterable
import xml.etree.ElementTree as element_tree

from .domain import Edge, Node, RoadGraph, haversine, haversine_coords, is_routable_way

try:
	import osmium  # type: ignore
except ImportError:  # pragma: no cover - optional dependency
	osmium = None


@dataclass(frozen=True, slots=True)
class SnappedNode:
	node_id: int
	distance_m: float


@dataclass(slots=True)
class GridSpatialIndex:
	nodes: dict[int, Node]
	cell_size_degrees: float
	_buckets: dict[tuple[int, int], list[int]] = field(init=False, default_factory=dict)

	def __post_init__(self) -> None:
		for node_id, node in self.nodes.items():
			self._buckets.setdefault(self._cell(node.lat, node.lon), []).append(node_id)

	def nearest(
		self,
		lat: float,
		lon: float,
		max_distance_meters: float,
	) -> SnappedNode | None:
		best: SnappedNode | None = None
		origin = self._cell(lat, lon)
		approx_cell_size_meters = max(1.0, self.cell_size_degrees * 111_320)
		max_rings = max(1, ceil(max_distance_meters / approx_cell_size_meters))

		for ring in range(max_rings + 1):
			for bucket in self._iter_ring(origin, ring):
				for node_id in self._buckets.get(bucket, ()):
					node = self.nodes[node_id]
					distance = haversine_coords(lat, lon, node.lat, node.lon)
					if distance > max_distance_meters:
						continue
					if best is None or distance < best.distance_m:
						best = SnappedNode(node_id=node_id, distance_m=distance)

		return best

	def _cell(self, lat: float, lon: float) -> tuple[int, int]:
		return (
			floor(lat / self.cell_size_degrees),
			floor(lon / self.cell_size_degrees),
		)

	def _iter_ring(
		self,
		origin: tuple[int, int],
		ring: int,
	) -> Iterable[tuple[int, int]]:
		if ring == 0:
			yield origin
			return

		lat_origin, lon_origin = origin
		for lat_delta in range(-ring, ring + 1):
			for lon_delta in range(-ring, ring + 1):
				if abs(lat_delta) != ring and abs(lon_delta) != ring:
					continue
				yield (lat_origin + lat_delta, lon_origin + lon_delta)


@dataclass(frozen=True, slots=True)
class LoadedGraph:
	graph: RoadGraph
	index: GridSpatialIndex
	source_path: Path
	loaded_at: datetime


def load_graph(path: Path, cell_size_degrees: float) -> LoadedGraph:
	graph = (
		_load_graph_pbf(path)
		if path.suffix == ".pbf" or path.name.endswith(".osm.pbf")
		else _load_graph_xml(path)
	)
	return LoadedGraph(
		graph=graph,
		index=GridSpatialIndex(graph.nodes, cell_size_degrees),
		source_path=path,
		loaded_at=datetime.now(timezone.utc),
	)


def _load_graph_xml(path: Path) -> RoadGraph:
	all_nodes: dict[int, Node] = {}
	for _, element in element_tree.iterparse(path, events=("end",)):
		if element.tag != "node":
			continue
		node_id = element.attrib.get("id")
		lat = element.attrib.get("lat")
		lon = element.attrib.get("lon")
		if node_id and lat and lon:
			all_nodes[int(node_id)] = Node(
				id=int(node_id),
				lat=float(lat),
				lon=float(lon),
			)
		element.clear()

	graph = RoadGraph()
	used_node_ids: set[int] = set()

	for _, element in element_tree.iterparse(path, events=("end",)):
		if element.tag != "way":
			continue

		tags = {
			child.attrib["k"]: child.attrib["v"]
			for child in element
			if child.tag == "tag" and "k" in child.attrib and "v" in child.attrib
		}
		if not is_routable_way(tags):
			element.clear()
			continue

		_add_way_edges(
			graph=graph,
			all_nodes=all_nodes,
			used_node_ids=used_node_ids,
			node_refs=[
				int(child.attrib["ref"])
				for child in element
				if child.tag == "nd" and "ref" in child.attrib
			],
			tags=tags,
		)
		element.clear()

	graph.nodes = {node_id: all_nodes[node_id] for node_id in used_node_ids}
	return graph


def _load_graph_pbf(path: Path) -> RoadGraph:
	if osmium is None:
		raise RuntimeError(
			"Parsing .pbf files requires pyosmium. Install it or provide a .osm XML extract.",
		)

	class NodeCollector(osmium.SimpleHandler):  # type: ignore[misc]
		def __init__(self) -> None:
			super().__init__()
			self.nodes: dict[int, Node] = {}

		def node(self, node: osmium.osm.Node) -> None:  # type: ignore[attr-defined]
			if not node.location.valid():
				return
			self.nodes[node.id] = Node(
				id=node.id,
				lat=node.location.lat,
				lon=node.location.lon,
			)

	class WayCollector(osmium.SimpleHandler):  # type: ignore[misc]
		def __init__(self, nodes: dict[int, Node]) -> None:
			super().__init__()
			self.nodes = nodes
			self.graph = RoadGraph()
			self.used_node_ids: set[int] = set()

		def way(self, way: osmium.osm.Way) -> None:  # type: ignore[attr-defined]
			tags = {tag.k: tag.v for tag in way.tags}
			if not is_routable_way(tags):
				return

			_add_way_edges(
				graph=self.graph,
				all_nodes=self.nodes,
				used_node_ids=self.used_node_ids,
				node_refs=[node.ref for node in way.nodes],
				tags=tags,
			)

	node_collector = NodeCollector()
	node_collector.apply_file(str(path), locations=False)
	way_collector = WayCollector(node_collector.nodes)
	way_collector.apply_file(str(path), locations=False)
	way_collector.graph.nodes = {
		node_id: node_collector.nodes[node_id]
		for node_id in way_collector.used_node_ids
	}
	return way_collector.graph


def _add_way_edges(
	graph: RoadGraph,
	all_nodes: dict[int, Node],
	used_node_ids: set[int],
	node_refs: list[int],
	tags: dict[str, str],
) -> None:
	highway = tags.get("highway", "unknown")
	surface = tags.get("surface", "unknown")
	bicycle = tags.get("bicycle")
	foot = tags.get("foot")
	tracktype = tags.get("tracktype")
	access = tags.get("access")
	oneway = tags.get("oneway") in {"yes", "1", "true"}

	for current_id, next_id in zip(node_refs, node_refs[1:]):
		current = all_nodes.get(current_id)
		next_node = all_nodes.get(next_id)
		if current is None or next_node is None:
			continue

		used_node_ids.add(current_id)
		used_node_ids.add(next_id)
		graph.add_edge(
			Edge(
				node_from=current_id,
				node_to=next_id,
				distance_m=haversine(current, next_node),
				surface=surface,
				highway=highway,
				bicycle=bicycle,
				foot=foot,
				tracktype=tracktype,
				access=access,
				oneway=oneway,
			),
		)
