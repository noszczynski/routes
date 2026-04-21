# Routing Engine

Osobna aplikacja w Pythonie, która buduje graf dróg z OpenStreetMap i liczy przebieg trasy przez waypointy.

## Endpointy

- `GET /health` - status silnika i załadowanego grafu
- `POST /route` - oblicza trasę i zwraca `coordinates`, `distance_m`, `snapped_waypoints` oraz `gpx`

## Profile

Silnik działa natywnie na profilach:

- `runner`
- `road_bike`
- `gravel_bike`

Zachowuje też aliasy kompatybilne z obecnym API:

- `walking` -> `runner`
- `driving` -> `road_bike`
- `cycling` -> `gravel_bike`

## Konfiguracja

Przy starcie proces wczytuje opcjonalny plik `apps/routing-engine/.env` (nie nadpisuje zmiennych już ustawionych w shellu).

Obsługiwane zmienne środowiskowe:

- `ROUTING_ENGINE_HOST` - domyślnie `127.0.0.1`
- `ROUTING_ENGINE_PORT` - domyślnie `5000`
- `ROUTING_ENGINE_OSM_PATH` - ścieżka do pliku `.osm` albo `.osm.pbf`
- `ROUTING_ENGINE_MAX_SNAP_DISTANCE_METERS` - maksymalna odległość snapowania waypointa do grafu
- `ROUTING_ENGINE_GRID_SIZE_DEGREES` - rozmiar komórki prostego indeksu przestrzennego

Jeżeli `ROUTING_ENGINE_OSM_PATH` nie jest ustawione, proces nadal startuje, ale `POST /route` zwróci `503`.

## Dane OSM

Na start pobierz ekstrakt z [Geofabrik](https://download.geofabrik.de/) i ustaw go w `ROUTING_ENGINE_OSM_PATH`.

Przykład:

```bash
cd apps/routing-engine
export ROUTING_ENGINE_OSM_PATH="$PWD/data/poland-latest.osm.pbf"
PYTHONPATH=src python3 -m routing_engine
```
