"use client";

import { env } from "@routes/env/web";
import { Button } from "@routes/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@routes/ui/components/card";
import { Checkbox } from "@routes/ui/components/checkbox";
import { Textarea } from "@routes/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
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

type RouteComment = {
	id: string;
	parentCommentId: string | null;
	content: string;
	authorName: string;
	createdAt: string | Date;
	replies: RouteComment[];
};

const formatCommentDate = (value: string | Date) =>
	new Date(value).toLocaleString("pl-PL", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

function CommentThread({
	comments,
	activeReplyId,
	replyDrafts,
	isSubmittingComment,
	isAuthenticated,
	onReplyDraftChange,
	onStartReply,
	onCancelReply,
	onSubmitReply,
}: {
	comments: RouteComment[];
	activeReplyId: string | null;
	replyDrafts: Record<string, string>;
	isSubmittingComment: boolean;
	isAuthenticated: boolean;
	onReplyDraftChange: (commentId: string, value: string) => void;
	onStartReply: (commentId: string) => void;
	onCancelReply: () => void;
	onSubmitReply: (commentId: string, content: string) => void;
}) {
	if (comments.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				Brak komentarzy. Bądź pierwszy/a i podziel się opinią o tej trasie.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{comments.map((comment) => {
				const isReplyOpen = activeReplyId === comment.id;

				return (
					<div key={comment.id} className="rounded-lg border p-3">
						<div className="flex items-center justify-between gap-2">
							<p className="font-medium text-sm">{comment.authorName}</p>
							<p className="text-muted-foreground text-xs">
								{formatCommentDate(comment.createdAt)}
							</p>
						</div>
						<p className="mt-2 whitespace-pre-wrap text-sm">
							{comment.content}
						</p>
						<div className="mt-3 flex gap-2">
							{isAuthenticated ? (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => onStartReply(comment.id)}
								>
									Odpowiedz
								</Button>
							) : null}
						</div>

						{isReplyOpen ? (
							<div className="mt-3 flex flex-col gap-2">
								<Textarea
									value={replyDrafts[comment.id] ?? ""}
									onChange={(event) =>
										onReplyDraftChange(comment.id, event.target.value)
									}
									placeholder="Napisz odpowiedź..."
									disabled={isSubmittingComment}
								/>
								<div className="flex gap-2">
									<Button
										type="button"
										size="sm"
										disabled={isSubmittingComment}
										onClick={() =>
											onSubmitReply(comment.id, replyDrafts[comment.id] ?? "")
										}
									>
										Wyślij odpowiedź
									</Button>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={onCancelReply}
										disabled={isSubmittingComment}
									>
										Anuluj
									</Button>
								</div>
							</div>
						) : null}

						{comment.replies.length > 0 ? (
							<div className="mt-4 border-l pl-4">
								<CommentThread
									comments={comment.replies}
									activeReplyId={activeReplyId}
									replyDrafts={replyDrafts}
									isSubmittingComment={isSubmittingComment}
									isAuthenticated={isAuthenticated}
									onReplyDraftChange={onReplyDraftChange}
									onStartReply={onStartReply}
									onCancelReply={onCancelReply}
									onSubmitReply={onSubmitReply}
								/>
							</div>
						) : null}
					</div>
				);
			})}
		</div>
	);
}

export default function RouteDetail({ routeId }: { routeId: string }) {
	const queryClient = useQueryClient();
	const routeQueryOptions = orpc.routes.getRoute.queryOptions({
		input: { id: routeId },
	});
	const routeQuery = useQuery(routeQueryOptions);
	const { data: session } = authClient.useSession();
	const [commentDraft, setCommentDraft] = useState("");
	const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
	const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
	const [selectedGpxFile, setSelectedGpxFile] = useState<File | null>(null);
	const routeVersionsQuery = useQuery({
		...orpc.routes.listRouteVersions.queryOptions({
			input: { routeId },
		}),
		enabled: Boolean(
			session?.user &&
				routeQuery.data &&
				session.user.id === routeQuery.data.userId,
		),
	});

	const rateRouteMutation = useMutation({
		mutationFn: async (value: "up" | "down" | null) =>
			client.routes.rateRoute({
				routeId,
				value,
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: routeQueryOptions.queryKey,
			});
		},
		onError: (error) => {
			toast.error(error.message || "Nie udało się zapisać oceny");
		},
	});

	const addCommentMutation = useMutation({
		mutationFn: async (params: { content: string; parentCommentId?: string }) =>
			client.routes.addRouteComment({
				routeId,
				content: params.content,
				parentCommentId: params.parentCommentId,
			}),
		onSuccess: async () => {
			setCommentDraft("");
			setActiveReplyId(null);
			setReplyDrafts({});
			await queryClient.invalidateQueries({
				queryKey: routeQueryOptions.queryKey,
			});
		},
		onError: (error) => {
			toast.error(error.message || "Nie udało się dodać komentarza");
		},
	});

	const updateRoutePrivacyMutation = useMutation({
		mutationFn: async (isPublic: boolean) =>
			client.routes.updateRoutePrivacy({
				routeId,
				isPublic,
			}),
		onSuccess: async (_, isPublic) => {
			toast.success(
				isPublic
					? "Trasa została ustawiona jako publiczna"
					: "Trasa została ustawiona jako prywatna",
			);
			await queryClient.invalidateQueries({
				queryKey: routeQueryOptions.queryKey,
			});
		},
		onError: (error) => {
			toast.error(error.message || "Nie udało się zmienić prywatności trasy");
		},
	});

	const setMainRouteVersionMutation = useMutation({
		mutationFn: async (versionId: string) =>
			client.routes.setMainRouteVersion({
				routeId,
				versionId,
			}),
		onSuccess: async () => {
			toast.success("Ustawiono wersję główną trasy");
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: routeQueryOptions.queryKey }),
				queryClient.invalidateQueries({
					queryKey: orpc.routes.listRouteVersions.queryOptions({
						input: { routeId },
					}).queryKey,
				}),
			]);
		},
		onError: (error) => {
			toast.error(error.message || "Nie udało się ustawić wersji głównej");
		},
	});

	const uploadRouteVersionMutation = useMutation({
		mutationFn: async (params: {
			gpxContent: string;
			originalFileName?: string;
			confirmDeleteOldest?: boolean;
		}) =>
			client.routes.uploadRouteVersionGpx({
				routeId,
				gpxContent: params.gpxContent,
				originalFileName: params.originalFileName,
				confirmDeleteOldest: params.confirmDeleteOldest ?? false,
			}),
		onSuccess: async () => {
			setSelectedGpxFile(null);
			toast.success("Dodano nową wersję trasy");
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: routeQueryOptions.queryKey }),
				queryClient.invalidateQueries({
					queryKey: orpc.routes.listRouteVersions.queryOptions({
						input: { routeId },
					}).queryKey,
				}),
			]);
		},
		onError: async (error) => {
			const shouldConfirmRotation = error.message.includes("limit");
			if (shouldConfirmRotation && selectedGpxFile) {
				const shouldReplaceOldest = window.confirm(
					"Osiągnięto limit 3 wersji. Czy chcesz usunąć najstarszą wersję i dodać nową?",
				);
				if (!shouldReplaceOldest) {
					return;
				}
				const gpxContent = await selectedGpxFile.text();
				uploadRouteVersionMutation.mutate({
					gpxContent,
					originalFileName: selectedGpxFile.name,
					confirmDeleteOldest: true,
				});
				return;
			}
			toast.error(error.message || "Nie udało się dodać wersji trasy");
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
	const myVote = route.rating?.myVote ?? null;
	const comments = (route.comments ?? []) as RouteComment[];
	const isRouteOwner = session?.user?.id === route.userId;

	return (
		<div className="flex flex-col gap-4 p-4 md:p-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="font-semibold text-2xl">{route.title}</h1>
					<p className="text-muted-foreground">Autor: {route.authorName}</p>
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

			<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,460px)] xl:items-start">
				<div className="flex flex-col gap-4">
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
						<CardContent className="grid gap-3 sm:grid-cols-2">
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

					{isRouteOwner ? (
						<Card>
							<CardHeader>
								<CardTitle>Prywatność trasy</CardTitle>
								<CardDescription>
									Zdecyduj, czy trasa ma być widoczna na mapie publicznej.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="flex items-start gap-3">
									<Checkbox
										id="route-privacy-toggle"
										checked={route.isPublic}
										disabled={updateRoutePrivacyMutation.isPending}
										onCheckedChange={(checked) =>
											updateRoutePrivacyMutation.mutate(checked === true)
										}
									/>
									<div className="grid gap-1.5 leading-none">
										<label
											htmlFor="route-privacy-toggle"
											className="font-medium text-sm"
										>
											Trasa publiczna
										</label>
										<p className="text-muted-foreground text-xs">
											{route.isPublic
												? "Aktualnie trasa jest publiczna i widoczna na mapie."
												: "Aktualnie trasa jest prywatna i ukryta na mapie."}
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					) : null}

					{isRouteOwner ? (
						<Card>
							<CardHeader>
								<CardTitle>Historia wersji</CardTitle>
								<CardDescription>
									Zarządzaj wersjami trasy i wybierz wersję główną.
								</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-col gap-3">
								<div className="flex flex-wrap items-center gap-2">
									<input
										type="file"
										accept=".gpx,application/gpx+xml,application/xml,text/xml"
										onChange={(event) => {
											const file = event.target.files?.[0] ?? null;
											setSelectedGpxFile(file);
										}}
									/>
									<Button
										type="button"
										disabled={
											!selectedGpxFile || uploadRouteVersionMutation.isPending
										}
										onClick={async () => {
											if (!selectedGpxFile) {
												return;
											}
											const gpxContent = await selectedGpxFile.text();
											uploadRouteVersionMutation.mutate({
												gpxContent,
												originalFileName: selectedGpxFile.name,
											});
										}}
									>
										{uploadRouteVersionMutation.isPending
											? "Wgrywanie..."
											: "Dodaj wersję z GPX"}
									</Button>
								</div>
								<p className="text-muted-foreground text-xs">
									Limit: 3 wersje. Przy przekroczeniu możesz zastąpić
									najstarszą.
								</p>

								{routeVersionsQuery.isLoading ? (
									<p className="text-muted-foreground text-sm">
										Ładowanie historii...
									</p>
								) : routeVersionsQuery.data?.length ? (
									<div className="flex flex-col gap-2">
										{routeVersionsQuery.data.map((version) => (
											<div
												key={version.id}
												className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
											>
												<div className="space-y-1">
													<p className="font-medium text-sm">
														Wersja #{version.versionOrder} ({version.sourceType}
														)
													</p>
													<p className="text-muted-foreground text-xs">
														{new Date(version.createdAt).toLocaleString(
															"pl-PL",
														)}
													</p>
													<p className="text-muted-foreground text-xs">
														{version.distance
															? `${version.distance} km`
															: "Brak dystansu"}
														{" • "}
														{version.elevationGain
															? `${Math.round(version.elevationGain)} m`
															: "Brak podejść"}
													</p>
												</div>
												<div className="flex items-center gap-2">
													{version.isMain ? (
														<span className="text-xs">Główna</span>
													) : (
														<Button
															type="button"
															size="sm"
															variant="outline"
															disabled={setMainRouteVersionMutation.isPending}
															onClick={() =>
																setMainRouteVersionMutation.mutate(version.id)
															}
														>
															Ustaw jako główną
														</Button>
													)}
													<a
														href={`${env.NEXT_PUBLIC_SERVER_URL}/files/gpx/${route.id}?versionId=${version.id}`}
														target="_blank"
														rel="noreferrer"
													>
														<Button type="button" size="sm" variant="ghost">
															Pobierz GPX
														</Button>
													</a>
												</div>
											</div>
										))}
									</div>
								) : (
									<p className="text-muted-foreground text-sm">
										Brak zapisanych wersji trasy.
									</p>
								)}
							</CardContent>
						</Card>
					) : null}

					<Card>
						<CardHeader>
							<CardTitle>Ocena społeczności</CardTitle>
							<CardDescription>
								Oddaj głos i zobacz, jak trasę oceniają inni.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-3">
							<div className="flex flex-wrap items-center gap-2">
								<Button
									type="button"
									variant={myVote === "up" ? "default" : "outline"}
									disabled={!session?.user || rateRouteMutation.isPending}
									onClick={() =>
										rateRouteMutation.mutate(myVote === "up" ? null : "up")
									}
								>
									<ThumbsUp className="mr-2 size-4" />
									Łapka w górę ({route.rating.upvotes})
								</Button>
								<Button
									type="button"
									variant={myVote === "down" ? "default" : "outline"}
									disabled={!session?.user || rateRouteMutation.isPending}
									onClick={() =>
										rateRouteMutation.mutate(myVote === "down" ? null : "down")
									}
								>
									<ThumbsDown className="mr-2 size-4" />
									Łapka w dół ({route.rating.downvotes})
								</Button>
							</div>
							{!session?.user ? (
								<p className="text-muted-foreground text-xs">
									Zaloguj się, aby oddać głos i komentować trasę.
								</p>
							) : null}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<MessageCircle className="size-4" />
								Komentarze
							</CardTitle>
							<CardDescription>
								Dyskusja o trasie wraz z odpowiedziami.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							{session?.user ? (
								<div className="flex flex-col gap-2">
									<Textarea
										value={commentDraft}
										onChange={(event) => setCommentDraft(event.target.value)}
										placeholder="Napisz komentarz o trasie..."
										disabled={addCommentMutation.isPending}
									/>
									<div>
										<Button
											type="button"
											disabled={addCommentMutation.isPending}
											onClick={() => {
												const trimmed = commentDraft.trim();
												if (!trimmed) {
													return;
												}

												addCommentMutation.mutate({
													content: trimmed,
												});
											}}
										>
											Dodaj komentarz
										</Button>
									</div>
								</div>
							) : null}

							<CommentThread
								comments={comments}
								activeReplyId={activeReplyId}
								replyDrafts={replyDrafts}
								isSubmittingComment={addCommentMutation.isPending}
								isAuthenticated={Boolean(session?.user)}
								onReplyDraftChange={(commentId, value) =>
									setReplyDrafts((previous) => ({
										...previous,
										[commentId]: value,
									}))
								}
								onStartReply={(commentId) => setActiveReplyId(commentId)}
								onCancelReply={() => setActiveReplyId(null)}
								onSubmitReply={(commentId, content) => {
									const trimmed = content.trim();
									if (!trimmed) {
										return;
									}

									addCommentMutation.mutate({
										content: trimmed,
										parentCommentId: commentId,
									});
								}}
							/>
						</CardContent>
					</Card>
				</div>

				<Card className="xl:sticky xl:top-6">
					<CardHeader>
						<div className="flex items-center justify-between gap-2">
							<CardTitle>Podgląd na mapie</CardTitle>
							{isRouteOwner ? (
								<Link href={`/routes/${route.id}/edit`}>
									<Button type="button" size="sm">
										Edytuj trasę
									</Button>
								</Link>
							) : null}
						</div>
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
		</div>
	);
}
