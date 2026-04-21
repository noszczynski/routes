"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { client, queryClient } from "@/utils/orpc";

export default function StravaCallback({ code }: { code?: string }) {
	const router = useRouter();
	const connectMutation = useMutation({
		mutationFn: async (authCode: string) =>
			client.strava.connectStrava({ code: authCode }),
		onSuccess: async () => {
			toast.success("Połączono konto Strava");
			await queryClient.invalidateQueries();
			router.replace("/strava");
		},
		onError: (error) => {
			toast.error(error.message || "Nie udało się połączyć Strava");
			router.replace("/strava");
		},
	});

	useEffect(() => {
		if (!code) {
			toast.error("Brak kodu autoryzacyjnego Strava");
			router.replace("/strava");
			return;
		}

		connectMutation.mutate(code);
	}, [code, connectMutation, router]);

	return (
		<div className="flex h-full items-center justify-center text-muted-foreground">
			Łączenie ze Strava...
		</div>
	);
}
