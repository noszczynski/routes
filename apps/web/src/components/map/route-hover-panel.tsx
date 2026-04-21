"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@routes/ui/components/card";

type HoverRoute = {
	id: string;
	title: string;
	distance?: number | null;
	elevationGain?: number | null;
	authorName: string;
};

export default function RouteHoverPanel({
	route,
}: {
	route: HoverRoute | null;
}) {
	if (!route) {
		return null;
	}

	return (
		<div className="pointer-events-none absolute top-4 right-4 z-[500] w-80 max-w-[calc(100%-2rem)]">
			<Card>
				<CardHeader>
					<CardTitle>{route.title}</CardTitle>
					<CardDescription>{route.authorName}</CardDescription>
				</CardHeader>
				<CardContent className="grid grid-cols-2 gap-3">
					<div>
						<p className="text-muted-foreground text-xs">Dystans</p>
						<p>{route.distance ? `${route.distance} km` : "Brak danych"}</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Przewyższenie</p>
						<p>
							{route.elevationGain
								? `${Math.round(route.elevationGain)} m`
								: "Brak danych"}
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
