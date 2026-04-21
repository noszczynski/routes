"use client";

import { Button } from "@routes/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@routes/ui/components/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { client, orpc, queryClient } from "@/utils/orpc";

export default function StravaPanel({
	configured,
	clientId,
	redirectUri,
}: {
	configured: boolean;
	clientId?: string;
	redirectUri?: string;
}) {
	const statusQuery = useQuery(orpc.strava.getStatus.queryOptions());
	const importRoutes = useMutation({
		mutationFn: async () => client.strava.importStravaRoutes({ limit: 10 }),
		onSuccess: async (result) => {
			toast.success(`Zaimportowano ${result.importedCount} tras`);
			await queryClient.invalidateQueries();
		},
		onError: (error) => {
			toast.error(error.message || "Nie udało się zaimportować tras");
		},
	});

	const authorizeUrl = configured
		? new URL("https://www.strava.com/oauth/authorize")
		: null;

	if (authorizeUrl && clientId && redirectUri) {
		authorizeUrl.searchParams.set("client_id", clientId);
		authorizeUrl.searchParams.set("redirect_uri", redirectUri);
		authorizeUrl.searchParams.set("response_type", "code");
		authorizeUrl.searchParams.set("scope", "activity:read_all");
	}

	return (
		<div className="flex flex-col gap-4 p-4 md:p-6">
			<Card className="max-w-2xl">
				<CardHeader>
					<CardTitle>Strava</CardTitle>
					<CardDescription>
						Połącz konto Strava, aby importować swoje aktywności jako trasy.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{!configured ? (
						<p className="text-muted-foreground text-sm">
							Uzupełnij konfigurację Strava w zmiennych środowiskowych, aby
							połączyć konto i importować aktywności.
						</p>
					) : null}

					<div>
						<p className="text-muted-foreground text-xs">Status</p>
						<p>
							{statusQuery.data?.connected
								? "Konto jest połączone"
								: "Konto nie jest połączone"}
						</p>
					</div>

					<div className="flex flex-wrap gap-3">
						{authorizeUrl ? (
							<a href={authorizeUrl.toString()}>
								<Button>Połącz z Strava</Button>
							</a>
						) : (
							<Button disabled>Połącz z Strava</Button>
						)}
						<Button
							variant="outline"
							disabled={
								!configured ||
								!statusQuery.data?.connected ||
								importRoutes.isPending
							}
							onClick={() => importRoutes.mutate()}
						>
							{importRoutes.isPending
								? "Importowanie..."
								: "Importuj trasy ze Strava"}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
