"use client";

import { Button } from "@routes/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@routes/ui/components/card";
import { Checkbox } from "@routes/ui/components/checkbox";
import { Input } from "@routes/ui/components/input";
import { Label } from "@routes/ui/components/label";
import { Textarea } from "@routes/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { client } from "@/utils/orpc";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function CreateRouteForm() {
	const router = useRouter();
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [isPublic, setIsPublic] = useState(false);

	const createRoute = useMutation({
		mutationFn: async () => {
			if (!file) {
				throw new Error("Wybierz plik GPX");
			}

			if (file.size > MAX_FILE_SIZE) {
				throw new Error("Plik GPX nie może przekraczać 5 MB");
			}

			const gpxContent = await file.text();

			return client.routes.createRoute({
				title,
				description,
				isPublic,
				gpxContent,
			});
		},
		onSuccess: (route) => {
			toast.success("Trasa została dodana");
			router.push(`/routes/${route.id}`);
		},
		onError: (error) => {
			toast.error(error.message || "Nie udało się dodać trasy");
		},
	});

	return (
		<div className="flex flex-col gap-4 p-4 md:p-6">
			<Card className="max-w-2xl">
				<CardHeader>
					<CardTitle>Dodaj trasę</CardTitle>
					<CardDescription>
						Wgraj plik GPX i zdecyduj, czy trasa ma być publiczna.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						className="flex flex-col gap-4"
						onSubmit={(event) => {
							event.preventDefault();
							createRoute.mutate();
						}}
					>
						<div className="flex flex-col gap-2">
							<Label htmlFor="route-title">Tytuł</Label>
							<Input
								id="route-title"
								value={title}
								onChange={(event) => setTitle(event.target.value)}
								placeholder="Np. Pętla po Beskidzie Niskim"
								required
							/>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="route-description">Opis</Label>
							<Textarea
								id="route-description"
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								placeholder="Krótki opis trasy, nawierzchni i warunków."
							/>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="route-file">Plik GPX</Label>
							<Input
								id="route-file"
								type="file"
								accept=".gpx,application/gpx+xml"
								onChange={(event) => {
									setFile(event.target.files?.[0] ?? null);
								}}
								required
							/>
							<p className="text-muted-foreground text-xs">
								Maksymalny rozmiar pliku: 5 MB.
							</p>
						</div>

						<div className="flex items-start gap-3">
							<Checkbox
								id="route-public"
								checked={isPublic}
								onCheckedChange={(checked) => setIsPublic(checked === true)}
							/>
							<div className="grid gap-1.5 leading-none">
								<Label htmlFor="route-public">
									Czy chcesz upublicznić tę trasę?
								</Label>
								<p className="text-muted-foreground text-xs">
									Domyślnie trasa jest prywatna i widoczna tylko dla Ciebie.
								</p>
							</div>
						</div>

						<div className="flex gap-3">
							<Button type="submit" disabled={createRoute.isPending}>
								{createRoute.isPending ? "Wysyłanie..." : "Dodaj trasę"}
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => router.push("/")}
							>
								Anuluj
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
