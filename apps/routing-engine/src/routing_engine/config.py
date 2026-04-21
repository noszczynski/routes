from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path


def load_local_env() -> None:
	"""
	Load `apps/routing-engine/.env` into the process environment if present.
	Does not override variables already set in the environment.
	"""
	app_root = Path(__file__).resolve().parents[2]
	env_file = app_root / ".env"
	if not env_file.is_file():
		return

	try:
		raw = env_file.read_text(encoding="utf-8")
	except OSError:
		return

	for raw_line in raw.splitlines():
		line = raw_line.strip()
		if not line or line.startswith("#"):
			continue
		if line.startswith("export "):
			line = line[7:].strip()
		if "=" not in line:
			continue
		key, _, value = line.partition("=")
		key = key.strip()
		if not key:
			continue
		value = value.strip()
		if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
			value = value[1:-1]
		if key not in os.environ:
			os.environ[key] = value


def _get_float(name: str, default: float) -> float:
	value = os.getenv(name)
	if value is None or value.strip() == "":
		return default

	try:
		return float(value)
	except ValueError as exc:
		raise ValueError(f"{name} must be a number") from exc


def _get_int(name: str, default: int) -> int:
	value = os.getenv(name)
	if value is None or value.strip() == "":
		return default

	try:
		return int(value)
	except ValueError as exc:
		raise ValueError(f"{name} must be an integer") from exc


@dataclass(frozen=True, slots=True)
class Settings:
	host: str
	port: int
	osm_path: Path | None
	max_snap_distance_meters: float
	grid_size_degrees: float

	@classmethod
	def from_env(cls) -> "Settings":
		load_local_env()
		osm_path = os.getenv("ROUTING_ENGINE_OSM_PATH", "").strip()
		return cls(
			host=os.getenv("ROUTING_ENGINE_HOST", "127.0.0.1"),
			port=_get_int("ROUTING_ENGINE_PORT", 5000),
			osm_path=Path(osm_path).expanduser() if osm_path else None,
			max_snap_distance_meters=_get_float(
				"ROUTING_ENGINE_MAX_SNAP_DISTANCE_METERS",
				1500.0,
			),
			grid_size_degrees=_get_float("ROUTING_ENGINE_GRID_SIZE_DEGREES", 0.02),
		)
