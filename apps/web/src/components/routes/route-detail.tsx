"use client";

import { Button } from "@routes/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@routes/ui/components/card";
import { env } from "@routes/env/web";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";

import { orpc } from "@/utils/orpc";

const RoutePreviewMap = dynamic(() => import("@/components/map/route-preview-map"), {
	ssr: false,
	loading: () => (
		<div className="flex h-80 items-center justify-center text-muted-foreground">
			Ładowanie mapy...
		</div>
	),
});

export default function RouteDetail({ routeId }: { routeId: string }) {
	const routeQuery = useQuery(
		orpc.routes.getRoute.queryOptions({
			input: { id: routeId },
		}),
	);

	if (routeQuery.isLoading) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground">
				Ładowanie trasy...
			</div>
		);
	}

	if (!routeQuery.data) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground">
				Nie udało się wczytać trasy.
			</div>
		);
	}

	const route = routeQuery.data;

	return (
		<div className="flex flex-col gap-4 p-4 md:p-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="font-semibold text-2xl">{route.title}</h1>
					<p className="text-muted-foreground">
						Autor: {route.authorName}
					</p>
				</div>
				<div className="flex gap-2">
					<Link href="/">
						<Button variant="outline">Wróć do mapy</Button>
					</Link>
					<a
						href={`${env.NEXT_PUBLIC_SERVER_URL}/files/gpx/${route.id}`}
						target="_blank"
						rel="noreferrer"
					>
						<Button>Pobierz GPX</Button>
					</a>
				</div>
			</div>

			{route.description ? (
				<Card>
					<CardHeader>
						<CardTitle>Opis</CardTitle>
					</CardHeader>
					<CardContent>{route.description}</CardContent>
				</Card>
			) : null}

			<Card>
				<CardHeader>
					<CardTitle>Statystyki</CardTitle>
					<CardDescription>Podsumowanie zapisanej trasy</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<div>
						<p className="text-muted-foreground text-xs">Dystans</p>
						<p>{route.distance ? `${route.distance} km` : "Brak danych"}</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Podejścia</p>
						<p>
							{route.elevationGain
								? `${Math.round(route.elevationGain)} m`
								: "Brak danych"}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Wys. min</p>
						<p>
							{route.minElevation
								? `${Math.round(route.minElevation)} m`
								: "Brak danych"}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Wys. max</p>
						<p>
							{route.maxElevation
								? `${Math.round(route.maxElevation)} m`
								: "Brak danych"}
						</p>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Podgląd na mapie</CardTitle>
				</CardHeader>
				<CardContent>
					<RoutePreviewMap
						routeId={route.id}
						bbox={{
							north: route.bboxNorth,
							south: route.bboxSouth,
							east: route.bboxEast,
							west: route.bboxWest,
						}}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
