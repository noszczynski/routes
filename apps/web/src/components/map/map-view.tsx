"use client";

import { Button } from "@routes/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import type { LatLngBounds, Map as LeafletMap } from "leaflet";
import { LocateFixed } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";

import { orpc } from "@/utils/orpc";

import MapFilters from "./map-filters";
import MapInteractionEnhancer from "./map-interaction-enhancer";
import RouteHoverPanel from "./route-hover-panel";
import RouteLayer from "./route-layer";

import "leaflet/dist/leaflet.css";

type MapRoute = {
	id: string;
	title: string;
	distance?: number | null;
	elevationGain?: number | null;
	authorName: string;
};

type MapFiltersState = {
	minDistance?: number;
	maxDistance?: number;
	minElevationGain?: number;
	maxElevationGain?: number;
};

const POLAND_CENTER: [number, number] = [52, 19];
const POLAND_ZOOM = 6;

const boundsToBbox = (bounds: LatLngBounds) => ({
	north: bounds.getNorth(),
	south: bounds.getSouth(),
	east: bounds.getEast(),
	west: bounds.getWest(),
});

function MapBoundsListener({
	onBoundsChange,
	onMapReady,
}: {
	onBoundsChange: (bbox: ReturnType<typeof boundsToBbox>) => void;
	onMapReady: (map: LeafletMap) => void;
}) {
	const map = useMapEvents({
		moveend() {
			onBoundsChange(boundsToBbox(map.getBounds()));
		},
	});

	useEffect(() => {
		onMapReady(map);
		onBoundsChange(boundsToBbox(map.getBounds()));
	}, [map, onBoundsChange, onMapReady]);

	return null;
}

export default function MapView() {
	const router = useRouter();
	const { resolvedTheme } = useTheme();
	const [bbox, setBbox] = useState<ReturnType<typeof boundsToBbox> | null>(null);
	const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
	const [hoveredRoute, setHoveredRoute] = useState<MapRoute | null>(null);
	const [filters, setFilters] = useState<MapFiltersState>({});
	const tileLayerVariant = resolvedTheme === "light" ? "light_all" : "dark_all";

	const queryInput = useMemo(
		() =>
			bbox
				? {
						bbox,
						filters,
					}
				: undefined,
		[bbox, filters],
	);

	const routesQuery = useQuery({
		...(queryInput
			? orpc.routes.listRoutes.queryOptions({ input: queryInput })
			: {
					queryKey: ["routes", "idle"],
					queryFn: async () => [],
				}),
		enabled: Boolean(queryInput),
	});

	return (
		<div className="relative h-full min-h-0">
			<MapContainer
				center={POLAND_CENTER}
				zoom={POLAND_ZOOM}
				className="h-full w-full"
				preferCanvas
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
				/>
				<MapBoundsListener
					onBoundsChange={setBbox}
					onMapReady={setMapInstance}
				/>
				{routesQuery.data?.map((route) => (
					<RouteLayer
						key={route.id}
						route={route}
						active={hoveredRoute?.id === route.id}
						onHoverChange={setHoveredRoute}
						onSelect={(selectedRoute) => router.push(`/routes/${selectedRoute.id}`)}
					/>
				))}
			</MapContainer>

			<MapFilters filters={filters} onChange={setFilters} />
			<RouteHoverPanel route={hoveredRoute} />

			<div className="absolute right-4 bottom-4 z-500 flex flex-col gap-2">
				<Button
					size="icon"
					variant="outline"
					onClick={() => {
						if (!mapInstance || !navigator.geolocation) {
							return;
						}

						navigator.geolocation.getCurrentPosition((position) => {
							mapInstance.flyTo(
								[position.coords.latitude, position.coords.longitude],
								12,
							);
						});
					}}
				>
					<LocateFixed />
					<span className="sr-only">Użyj mojej lokalizacji</span>
				</Button>
			</div>
		</div>
	);
}
