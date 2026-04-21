"use client";

import { env } from "@routes/env/web";
import { useMutation } from "@tanstack/react-query";
import L from "leaflet";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	GeoJSON,
	MapContainer,
	Marker,
	Pane,
	Popup,
	TileLayer,
	useMap,
	useMapEvents,
} from "react-leaflet";
import { toast } from "sonner";

import "leaflet/dist/leaflet.css";

import { client } from "@/utils/orpc";

import MapInteractionEnhancer from "./map-interaction-enhancer";

const POLAND_CENTER: [number, number] = [52, 19];
const POLAND_ZOOM = 6;
const MIN_TURN_DISTANCE_METERS = 80;
const MAX_SEGMENT_LENGTH_METERS = 900;
const TURN_THRESHOLD_DEGREES = 18;
const MAX_EDITABLE_WAYPOINTS = 36;

type GeoJsonFeatureCollection = {
	type: "FeatureCollection";
	features: Array<{
		type: "Feature";
		geometry?: {
			type?: string;
			coordinates?: unknown;
		};
		properties?: Record<string, unknown>;
	}>;
};

export type RouteWaypoint = {
	lat: number;
	lon: number;
};

type EditableWaypoint = RouteWaypoint & {
	id: string;
};

const toRouteWaypoints = (
	editableWaypoints: EditableWaypoint[],
): RouteWaypoint[] => editableWaypoints.map(({ lat, lon }) => ({ lat, lon }));

const START_ICON = L.divIcon({
	className: "route-editor-marker",
	html: '<div style="width:14px;height:14px;border-radius:9999px;background:#22c55e;border:2px solid #0f172a;"></div>',
	iconSize: [14, 14],
	iconAnchor: [7, 7],
});

const END_ICON = L.divIcon({
	className: "route-editor-marker",
	html: '<div style="width:14px;height:14px;border-radius:9999px;background:#f97316;border:2px solid #0f172a;"></div>',
	iconSize: [14, 14],
	iconAnchor: [7, 7],
});

const VIA_ICON = L.divIcon({
	className: "route-editor-marker",
	html: '<div style="width:12px;height:12px;border-radius:9999px;background:#38bdf8;border:2px solid #0f172a;"></div>',
	iconSize: [12, 12],
	iconAnchor: [6, 6],
});

const getWaypointIcon = (index: number, total: number) => {
	if (index === 0) {
		return START_ICON;
	}

	if (index === total - 1) {
		return END_ICON;
	}

	return VIA_ICON;
};

const extractLineCoordinates = (geoJson: GeoJsonFeatureCollection) => {
	for (const feature of geoJson.features ?? []) {
		const geometry = feature.geometry;
		if (!geometry?.type) {
			continue;
		}

		if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
			return (geometry.coordinates as number[][]).filter(
				(coordinate) =>
					Array.isArray(coordinate) &&
					Number.isFinite(coordinate[0]) &&
					Number.isFinite(coordinate[1]),
			);
		}

		if (
			geometry.type === "MultiLineString" &&
			Array.isArray(geometry.coordinates)
		) {
			const firstLine = (geometry.coordinates as number[][][]).find(
				(line) => line.length > 1,
			);

			if (firstLine) {
				return firstLine.filter(
					(coordinate) =>
						Array.isArray(coordinate) &&
						Number.isFinite(coordinate[0]) &&
						Number.isFinite(coordinate[1]),
				);
			}
		}
	}

	return [];
};

const toWaypoint = (coordinate: number[]) => {
	const [lon, lat] = coordinate;
	return {
		lat: Number(lat.toFixed(6)),
		lon: Number(lon.toFixed(6)),
	} satisfies RouteWaypoint;
};

const areCoordinatesEqual = (left: number[] | undefined, right: number[]) =>
	Boolean(
		left &&
			Math.abs(left[0] - right[0]) < 0.000001 &&
			Math.abs(left[1] - right[1]) < 0.000001,
	);

const haversineInMeters = (start: number[], end: number[]) => {
	const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
	const earthRadius = 6371000;
	const latDiff = toRadians(end[1] - start[1]);
	const lonDiff = toRadians(end[0] - start[0]);
	const startLat = toRadians(start[1]);
	const endLat = toRadians(end[1]);

	const a =
		Math.sin(latDiff / 2) ** 2 +
		Math.cos(startLat) * Math.cos(endLat) * Math.sin(lonDiff / 2) ** 2;

	return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getTurnAngleDegrees = (
	previous: number[],
	current: number[],
	next: number[],
) => {
	const firstSegment = [current[0] - previous[0], current[1] - previous[1]];
	const secondSegment = [next[0] - current[0], next[1] - current[1]];
	const firstLength = Math.hypot(firstSegment[0], firstSegment[1]);
	const secondLength = Math.hypot(secondSegment[0], secondSegment[1]);

	if (firstLength === 0 || secondLength === 0) {
		return 0;
	}

	const cosine =
		(firstSegment[0] * secondSegment[0] + firstSegment[1] * secondSegment[1]) /
		(firstLength * secondLength);
	const clampedCosine = Math.min(1, Math.max(-1, cosine));

	return (Math.acos(clampedCosine) * 180) / Math.PI;
};

const sampleCoordinates = (coordinates: number[][], maxPoints: number) => {
	if (coordinates.length <= maxPoints) {
		return coordinates;
	}

	const sampled = Array.from({ length: maxPoints }, (_, index) => {
		const coordinateIndex = Math.round(
			(index * (coordinates.length - 1)) / (maxPoints - 1),
		);
		return coordinates[coordinateIndex] ?? coordinates[coordinates.length - 1];
	});

	return sampled.filter(
		(coordinate, index) =>
			index === 0 || !areCoordinatesEqual(sampled[index - 1], coordinate),
	);
};

const toEditableWaypoints = (geoJson: GeoJsonFeatureCollection) => {
	const coordinates = extractLineCoordinates(geoJson);
	if (coordinates.length < 2) {
		return [];
	}

	if (coordinates.length === 2) {
		return coordinates.map(toWaypoint);
	}

	const candidateCoordinates = [coordinates[0]];
	let distanceSinceLastWaypoint = 0;

	for (let index = 1; index < coordinates.length - 1; index += 1) {
		const previous = coordinates[index - 1];
		const current = coordinates[index];
		const next = coordinates[index + 1];

		distanceSinceLastWaypoint += haversineInMeters(previous, current);

		const isTurn =
			getTurnAngleDegrees(previous, current, next) >= TURN_THRESHOLD_DEGREES &&
			distanceSinceLastWaypoint >= MIN_TURN_DISTANCE_METERS;
		const isLongSegment =
			distanceSinceLastWaypoint >= MAX_SEGMENT_LENGTH_METERS;

		if (isTurn || isLongSegment) {
			candidateCoordinates.push(current);
			distanceSinceLastWaypoint = 0;
		}
	}

	candidateCoordinates.push(coordinates[coordinates.length - 1]);

	return sampleCoordinates(candidateCoordinates, MAX_EDITABLE_WAYPOINTS).map(
		toWaypoint,
	);
};

function RouteEditMapClickHandler({
	enabled,
	onAddVia,
}: {
	enabled: boolean;
	onAddVia: (point: RouteWaypoint) => void;
}) {
	useMapEvents({
		click(event) {
			if (!enabled) {
				return;
			}

			const clickTarget = event.originalEvent.target;
			if (
				clickTarget instanceof HTMLElement &&
				clickTarget.closest(
					".leaflet-marker-icon, .leaflet-popup, .leaflet-control, button, a",
				)
			) {
				return;
			}

			onAddVia({
				lat: Number(event.latlng.lat.toFixed(6)),
				lon: Number(event.latlng.lng.toFixed(6)),
			});
		},
	});

	return null;
}

function FitRouteBounds({
	bounds,
}: {
	bounds?: [[number, number], [number, number]];
}) {
	const map = useMap();

	useEffect(() => {
		if (!bounds) {
			return;
		}

		map.fitBounds(bounds, { padding: [16, 16], maxZoom: 18, animate: false });
		map.invalidateSize();
	}, [map, bounds]);

	return null;
}

export default function RoutePreviewMap({
	routeId,
	bbox,
	editMode = false,
	dataVersion,
	onDraftChange,
	className,
}: {
	routeId: string;
	bbox?: {
		north?: number | null;
		south?: number | null;
		east?: number | null;
		west?: number | null;
	};
	editMode?: boolean;
	dataVersion?: string | Date;
	onDraftChange?: (value: {
		waypoints: RouteWaypoint[];
		hasChanges: boolean;
		isCalculating: boolean;
	}) => void;
	className?: string;
}) {
	const { resolvedTheme } = useTheme();
	const [geoJson, setGeoJson] = useState<GeoJsonFeatureCollection | null>(null);
	const [draftGeoJson, setDraftGeoJson] =
		useState<GeoJsonFeatureCollection | null>(null);
	const [waypoints, setWaypoints] = useState<EditableWaypoint[]>([]);
	const [hasWaypointChanges, setHasWaypointChanges] = useState(false);
	const lastRequestedWaypointKeyRef = useRef<string | null>(null);
	const waypointIdCounterRef = useRef(0);
	const tileLayerVariant = resolvedTheme === "light" ? "light_all" : "dark_all";

	useEffect(() => {
		// Trigger refetch after persisted edits even when routeId stays the same.
		void dataVersion;
		const controller = new AbortController();

		void fetch(`${env.NEXT_PUBLIC_SERVER_URL}/files/geojson/${routeId}`, {
			signal: controller.signal,
		})
			.then(async (response) => {
				if (!response.ok) {
					throw new Error("Nie udało się pobrać geometrii trasy");
				}

				return response.json();
			})
			.then((data) => {
				setGeoJson(data as GeoJsonFeatureCollection);
				setDraftGeoJson(null);
				setWaypoints([]);
				setHasWaypointChanges(false);
				lastRequestedWaypointKeyRef.current = null;
				waypointIdCounterRef.current = 0;
			})
			.catch((error) => {
				if (error instanceof Error && error.name === "AbortError") {
					return;
				}
			});

		return () => {
			controller.abort();
		};
	}, [routeId, dataVersion]);

	useEffect(() => {
		if (!editMode || !geoJson) {
			return;
		}

		const initialWaypoints = toEditableWaypoints(geoJson).map(
			(waypoint, index) => ({
				id: `wp-${index + 1}`,
				lat: waypoint.lat,
				lon: waypoint.lon,
			}),
		);
		setWaypoints(initialWaypoints);
		setDraftGeoJson(geoJson);
		setHasWaypointChanges(false);
		lastRequestedWaypointKeyRef.current = null;
		waypointIdCounterRef.current = initialWaypoints.length;
	}, [editMode, geoJson]);

	const recalculateDraftMutation = useMutation({
		mutationFn: async (draftWaypoints: RouteWaypoint[]) =>
			client.routes.recalculateRoute({
				routeId,
				waypoints: draftWaypoints,
				profile: "cycling",
				persist: false,
			}),
		onSuccess: (data) => {
			setDraftGeoJson(data.geoJson as GeoJsonFeatureCollection);
		},
		onError: (error) => {
			toast.error(error.message || "Nie udało się przeliczyć szkicu trasy");
		},
	});

	const waypointSignature = useMemo(
		() => JSON.stringify(toRouteWaypoints(waypoints)),
		[waypoints],
	);

	useEffect(() => {
		onDraftChange?.({
			waypoints: toRouteWaypoints(waypoints),
			hasChanges: hasWaypointChanges,
			isCalculating: recalculateDraftMutation.isPending,
		});
	}, [
		hasWaypointChanges,
		onDraftChange,
		recalculateDraftMutation.isPending,
		waypoints,
	]);

	useEffect(() => {
		if (
			!editMode ||
			!hasWaypointChanges ||
			waypoints.length < 2 ||
			recalculateDraftMutation.isPending ||
			lastRequestedWaypointKeyRef.current === waypointSignature
		) {
			return;
		}

		const timeout = setTimeout(() => {
			lastRequestedWaypointKeyRef.current = waypointSignature;
			recalculateDraftMutation.mutate(toRouteWaypoints(waypoints));
		}, 350);

		return () => clearTimeout(timeout);
	}, [
		editMode,
		hasWaypointChanges,
		recalculateDraftMutation.isPending,
		recalculateDraftMutation.mutate,
		waypointSignature,
		waypoints,
	]);

	const bounds = useMemo(() => {
		const north = Number(bbox?.north);
		const south = Number(bbox?.south);
		const east = Number(bbox?.east);
		const west = Number(bbox?.west);

		if (
			!Number.isFinite(north) ||
			!Number.isFinite(south) ||
			!Number.isFinite(east) ||
			!Number.isFinite(west)
		) {
			return undefined;
		}

		return [
			[south, west],
			[north, east],
		] as [[number, number], [number, number]];
	}, [bbox?.north, bbox?.south, bbox?.east, bbox?.west]);

	const visibleDraftGeoJson = draftGeoJson;

	return (
		<MapContainer
			center={POLAND_CENTER}
			zoom={POLAND_ZOOM}
			bounds={bounds}
			boundsOptions={{ padding: [16, 16], maxZoom: 18 }}
			className={className ?? "h-80 w-full"}
			scrollWheelZoom="center"
			keyboard
			dragging
			doubleClickZoom
			boxZoom
			touchZoom
		>
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
				url={`https://{s}.basemaps.cartocdn.com/${tileLayerVariant}/{z}/{x}/{y}{r}.png`}
			/>
			<MapInteractionEnhancer
				initialCenter={POLAND_CENTER}
				initialZoom={POLAND_ZOOM}
				fitBounds={bounds}
			/>
			<FitRouteBounds bounds={bounds} />
			<RouteEditMapClickHandler
				enabled={editMode}
				onAddVia={(waypoint) => {
					setWaypoints((previous) => {
						if (previous.length < 2) {
							return previous;
						}

						waypointIdCounterRef.current += 1;
						const newViaPoint: EditableWaypoint = {
							id: `wp-${waypointIdCounterRef.current}`,
							lat: waypoint.lat,
							lon: waypoint.lon,
						};
						const next = [
							...previous.slice(0, -1),
							newViaPoint,
							previous[previous.length - 1],
						];
						setHasWaypointChanges(true);
						return next;
					});
				}}
			/>
			{editMode && visibleDraftGeoJson ? (
				<Pane name="route-draft-pane" style={{ zIndex: 430 }}>
					<GeoJSON
						data={visibleDraftGeoJson as never}
						style={() => ({
							color: "#22c55e",
							weight: 4,
							opacity: 0.85,
						})}
					/>
				</Pane>
			) : null}
			{editMode && geoJson ? (
				<Pane name="route-original-pane" style={{ zIndex: 420 }}>
					<GeoJSON
						data={geoJson as never}
						style={() => ({
							color: "#94a3b8",
							weight: 5,
							opacity: 0.9,
						})}
					/>
				</Pane>
			) : null}
			{!editMode && geoJson ? (
				<GeoJSON
					data={geoJson as never}
					style={() => ({
						color: "#38bdf8",
						weight: 4,
						opacity: 0.9,
					})}
				/>
			) : null}
			{editMode
				? waypoints.map((waypoint, index) => {
						const isViaPoint = index > 0 && index < waypoints.length - 1;

						return (
							<Marker
								key={waypoint.id}
								position={[waypoint.lat, waypoint.lon]}
								icon={getWaypointIcon(index, waypoints.length)}
								draggable
								eventHandlers={{
									dragend: (event) => {
										const marker = event.target as L.Marker;
										const latLng = marker.getLatLng();
										setWaypoints((previous) => {
											return previous.map((candidate, candidateIndex) =>
												candidateIndex === index
													? {
															...candidate,
															lat: Number(latLng.lat.toFixed(6)),
															lon: Number(latLng.lng.toFixed(6)),
														}
													: candidate,
											);
										});
										setHasWaypointChanges(true);
									},
								}}
							>
								{isViaPoint ? (
									<Popup>
										<button
											type="button"
											onMouseDown={(event) => {
												event.preventDefault();
												event.stopPropagation();
											}}
											onClick={(event) => {
												event.preventDefault();
												event.stopPropagation();
												setWaypoints((previous) =>
													previous.filter(
														(_, waypointIndex) => waypointIndex !== index,
													),
												);
												setHasWaypointChanges(true);
											}}
										>
											Usuń punkt pośredni
										</button>
									</Popup>
								) : null}
							</Marker>
						);
					})
				: null}
		</MapContainer>
	);
}
