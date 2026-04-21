"use client";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@routes/ui/components/card";
import { Button } from "@routes/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import type { authClient } from "@/lib/auth-client";
import { client, orpc, queryClient } from "@/utils/orpc";

export default function Dashboard({
	session,
}: {
	session: typeof authClient.$Infer.Session;
}) {
	const routesQuery = useQuery(
		orpc.routes.listRoutes.queryOptions({
			input: { mine: true },
		}),
	);
	const deleteRoute = useMutation({
		mutationFn: async (routeId: string) => client.routes.deleteRoute({ id: routeId }),
		onSuccess: async () => {
			toast.success("Trasa została usunięta");
			await queryClient.invalidateQueries();
		},
		onError: (error) => {
			toast.error(error.message || "Nie udało się usunąć trasy");
		},
	});

	return (
		<div className="flex h-full flex-col gap-4 p-4 md:p-6">
			<div className="flex flex-col gap-1">
				<h1 className="font-semibold text-2xl">Moje trasy</h1>
				<p className="text-muted-foreground">
					Zalogowano jako {session.user.name}
				</p>
			</div>

			{routesQuery.isLoading ? (
				<Card>
					<CardHeader>
						<CardTitle>Ładowanie tras</CardTitle>
					</CardHeader>
				</Card>
			) : routesQuery.data && routesQuery.data.length > 0 ? (
				<div className="grid gap-4">
					{routesQuery.data.map((route) => (
						<Card key={route.id}>
							<CardHeader>
								<CardTitle>{route.title}</CardTitle>
								<CardDescription>
									{route.distance ? `${route.distance} km` : "Brak dystansu"} ·{" "}
									{new Intl.DateTimeFormat("pl-PL", {
										dateStyle: "medium",
									}).format(new Date(route.createdAt))}
								</CardDescription>
							</CardHeader>
							<CardContent className="flex items-center justify-between gap-3">
								<Link href={`/routes/${route.id}`}>
									<Button variant="outline">Zobacz</Button>
								</Link>
								<Button
									variant="destructive"
									disabled={deleteRoute.isPending}
									onClick={() => deleteRoute.mutate(route.id)}
								>
									Usuń
								</Button>
							</CardContent>
						</Card>
					))}
				</div>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>Nie masz jeszcze tras</CardTitle>
						<CardDescription>
							Dodaj pierwszą trasę GPX albo zaimportuj ją ze Strava.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex gap-3">
						<Link href="/routes/new">
							<Button>Dodaj trasę</Button>
						</Link>
						<Link href="/strava">
							<Button variant="outline">Połącz Strava</Button>
						</Link>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
