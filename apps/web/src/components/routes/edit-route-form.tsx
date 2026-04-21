"use client";

import { Button } from "@routes/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@routes/ui/components/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { RouteWaypoint } from "@/components/map/route-preview-map";
import { authClient } from "@/lib/auth-client";
import { client, orpc } from "@/utils/orpc";

const RoutePreviewMap = dynamic(
	() => import("@/components/map/route-preview-map"),
	{
		ssr: false,
		loading: () => (
			<div className="flex h-80 items-center justify-center text-muted-foreground">
				Ładowanie mapy...
			</div>
		),
	},
);

export default function EditRouteForm({ routeId }: { routeId: string }) {
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const routeQueryOptions = useMemo(
		() =>
			orpc.routes.getRoute.queryOptions({
				input: { id: routeId },
			}),
		[routeId],
	);
	const routeQuery = useQuery(routeQueryOptions);
	const [draftWaypoints, setDraftWaypoints] = useState<RouteWaypoint[]>([]);
	const [hasDraftChanges, setHasDraftChanges] = useState(false);
	const [isDraftCalculating, setIsDraftCalculating] = useState(false);

	const saveRouteMutation = useMutation({
		mutationFn: async (waypoints: RouteWaypoint[]) =>
			client.routes.recalculateRoute({
				routeId,
				waypoints,
				profile: "cycling",
				persist: true,
			}),
		onSuccess: async () => {
			toast.success("Zapisano nowy przebieg trasy");
			await queryClient.invalidateQueries({
				queryKey: routeQueryOptions.queryKey,
			});
		},
		onError: (error) => {
			toast.error(error.message || "Nie udało się zapisać przebiegu trasy");
		},
	});

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
	const isRouteOwner = session?.user?.id === route.userId;

	if (!isRouteOwner) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground">
				Nie masz uprawnień do edycji tej trasy.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 p-4 md:p-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="font-semibold text-2xl">Edycja trasy</h1>
					<p className="text-muted-foreground">{route.title}</p>
				</div>
				<div className="flex gap-2">
					<Link href={`/routes/${route.id}`}>
						<Button variant="outline">Wróć do szczegółów</Button>
					</Link>
					<Button
						type="button"
						disabled={
							!hasDraftChanges ||
							draftWaypoints.length < 2 ||
							isDraftCalculating ||
							saveRouteMutation.isPending
						}
						onClick={() => saveRouteMutation.mutate(draftWaypoints)}
					>
						{saveRouteMutation.isPending ? "Zapisywanie..." : "Zapisz zmiany"}
					</Button>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Nowy przebieg</CardTitle>
					<CardDescription>
						Przeciągnij punkt startu/końca lub dodaj via point klikając mapę.
						Punkt pośredni usuń z popupu markera. Szary ślad pokazuje oryginalny
						przebieg i ma priorytet przy nakładaniu.
					</CardDescription>
				</CardHeader>
				<CardContent className="aspect-square">
					<RoutePreviewMap
						routeId={route.id}
						editMode
						dataVersion={route.updatedAt}
						onDraftChange={(draft) => {
							setDraftWaypoints(draft.waypoints);
							setHasDraftChanges(draft.hasChanges);
							setIsDraftCalculating(draft.isCalculating);
						}}
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
