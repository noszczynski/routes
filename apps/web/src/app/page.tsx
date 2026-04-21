"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/map/map-view"), {
	ssr: false,
	loading: () => (
		<div className="flex h-full items-center justify-center text-muted-foreground">
			Ładowanie mapy...
		</div>
	),
});

export default function Home() {
	return (
		<div className="h-full min-h-0">
			<MapView />
		</div>
	);
}
