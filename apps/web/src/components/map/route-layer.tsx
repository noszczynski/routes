"use client";

import { env } from "@routes/env/web";
import { useEffect, useState } from "react";
import { GeoJSON } from "react-leaflet";

type RouteSummary = {
	id: string;
	title: string;
	distance?: number | null;
	elevationGain?: number | null;
	authorName: string;
};

export default function RouteLayer({
	route,
	active,
	onHoverChange,
	onSelect,
}: {
	route: RouteSummary;
	active: boolean;
	onHoverChange: (route: RouteSummary | null) => void;
	onSelect: (route: RouteSummary) => void;
}) {
	const [geoJson, setGeoJson] = useState<object | null>(null);

	useEffect(() => {
		const controller = new AbortController();

		void fetch(`${env.NEXT_PUBLIC_SERVER_URL}/files/geojson/${route.id}`, {
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
	}, [route.id]);

	if (!geoJson) {
		return null;
	}

	return (
		<GeoJSON
			data={geoJson as never}
			style={() => ({
				color: active ? "#38bdf8" : "#60a5fa",
				weight: active ? 5 : 3,
				opacity: active ? 1 : 0.75,
			})}
			eventHandlers={{
				mouseover: () => onHoverChange(route),
				mouseout: () => onHoverChange(null),
				click: () => onSelect(route),
			}}
		/>
	);
}
