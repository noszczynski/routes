"use client";

import { env } from "@routes/env/web";
import { useEffect, useState } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";

import "leaflet/dist/leaflet.css";

const POLAND_CENTER: [number, number] = [52, 19];
const POLAND_ZOOM = 6;

export default function RoutePreviewMap({
	routeId,
	bbox,
}: {
	routeId: string;
	bbox?: {
		north?: number | null;
		south?: number | null;
		east?: number | null;
		west?: number | null;
	};
}) {
	const [geoJson, setGeoJson] = useState<object | null>(null);

	useEffect(() => {
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
				setGeoJson(data);
			})
			.catch((error) => {
				if (error instanceof Error && error.name === "AbortError") {
					return;
				}
			});

		return () => {
			controller.abort();
		};
	}, [routeId]);

	const bounds =
		bbox?.north !== undefined &&
		bbox?.south !== undefined &&
		bbox?.east !== undefined &&
		bbox?.west !== undefined
			? ([
					[bbox.south, bbox.west],
					[bbox.north, bbox.east],
				] as [[number, number], [number, number]])
			: undefined;

	return (
		<MapContainer
			center={POLAND_CENTER}
			zoom={POLAND_ZOOM}
			bounds={bounds}
			className="h-80 w-full"
			scrollWheelZoom={false}
		>
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
				url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
			/>
			{geoJson ? (
				<GeoJSON
					data={geoJson as never}
					style={() => ({
						color: "#38bdf8",
						weight: 4,
						opacity: 0.9,
					})}
				/>
			) : null}
		</MapContainer>
	);
}
