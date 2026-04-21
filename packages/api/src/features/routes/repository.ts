import { prisma } from "@routes/db";
import { Effect } from "effect";

import { DatabaseError } from "../db/errors";

const routeSelect = {
	id: true,
	title: true,
	description: true,
	isPublic: true,
	source: true,
	sourceReference: true,
	mainVersionId: true,
	userId: true,
	createdAt: true,
	updatedAt: true,
	mainVersion: {
		select: {
			id: true,
			sourceType: true,
			originalFileName: true,
			gpxFileName: true,
			geoJsonFileName: true,
			versionOrder: true,
			distance: true,
			elevationGain: true,
			elevationLoss: true,
			minElevation: true,
			maxElevation: true,
			bboxNorth: true,
			bboxSouth: true,
			bboxEast: true,
			bboxWest: true,
			createdAt: true,
			updatedAt: true,
		},
	},
	_count: {
		select: {
			versions: true,
		},
	},
	user: {
		select: {
			id: true,
			name: true,
		},
	},
} as const;

const routeCommentSelect = {
	id: true,
	routeId: true,
	parentId: true,
	content: true,
	userId: true,
	createdAt: true,
	updatedAt: true,
	user: {
		select: {
			id: true,
			name: true,
		},
	},
} as const;

const routeVersionSelect = {
	id: true,
	routeId: true,
	sourceType: true,
	originalFileName: true,
	gpxFileName: true,
	geoJsonFileName: true,
	versionOrder: true,
	distance: true,
	elevationGain: true,
	elevationLoss: true,
	minElevation: true,
	maxElevation: true,
	bboxNorth: true,
	bboxSouth: true,
	bboxEast: true,
	bboxWest: true,
	createdAt: true,
	updatedAt: true,
} as const;

export const findRouteById = (routeId: string) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.route.findUnique({
					where: { id: routeId },
					select: routeSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const findRouteBySourceReference = (params: {
	userId: string;
	sourceReference: string;
}) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.route.findFirst({
					where: {
						userId: params.userId,
						sourceReference: params.sourceReference,
					},
					select: routeSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const listRoutesInBbox = (params: {
	bbox?: {
		north: number;
		south: number;
		east: number;
		west: number;
	};
	filters?: {
		minDistance?: number;
		maxDistance?: number;
		minElevationGain?: number;
		maxElevationGain?: number;
	};
}) =>
	Effect.gen(function* () {
		const mainVersionFilters = {
			...(params.bbox
				? {
						bboxNorth: { not: null, gte: params.bbox.south },
						bboxSouth: { not: null, lte: params.bbox.north },
						bboxEast: { not: null, gte: params.bbox.west },
						bboxWest: { not: null, lte: params.bbox.east },
					}
				: {}),
			...(params.filters?.minDistance !== undefined ||
			params.filters?.maxDistance !== undefined
				? {
						distance: {
							...(params.filters.minDistance !== undefined
								? { gte: params.filters.minDistance }
								: {}),
							...(params.filters.maxDistance !== undefined
								? { lte: params.filters.maxDistance }
								: {}),
						},
					}
				: {}),
			...(params.filters?.minElevationGain !== undefined ||
			params.filters?.maxElevationGain !== undefined
				? {
						elevationGain: {
							...(params.filters.minElevationGain !== undefined
								? { gte: params.filters.minElevationGain }
								: {}),
							...(params.filters.maxElevationGain !== undefined
								? { lte: params.filters.maxElevationGain }
								: {}),
						},
					}
				: {}),
		};

		const where = {
			isPublic: true,
			mainVersion: {
				is: mainVersionFilters,
			},
		};

		return yield* Effect.tryPromise({
			try: () =>
				prisma.route.findMany({
					where,
					orderBy: { createdAt: "desc" },
					select: routeSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const listRoutesByUserId = (userId: string) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.route.findMany({
					where: { userId },
					orderBy: { createdAt: "desc" },
					select: routeSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const createRouteRecord = (params: {
	title: string;
	description?: string;
	isPublic?: boolean;
	userId: string;
	source?: string;
	sourceReference?: string;
}) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.route.create({
					data: {
						title: params.title,
						description: params.description,
						isPublic: params.isPublic,
						userId: params.userId,
						source: params.source,
						sourceReference: params.sourceReference,
					},
					select: routeSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const deleteRouteById = (routeId: string) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.route.delete({
					where: { id: routeId },
					select: routeSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const findRouteVoteByUser = (params: {
	routeId: string;
	userId: string;
}) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.routeVote.findUnique({
					where: {
						routeId_userId: {
							routeId: params.routeId,
							userId: params.userId,
						},
					},
					select: {
						value: true,
					},
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const upsertRouteVote = (params: {
	routeId: string;
	userId: string;
	value: "up" | "down";
}) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.routeVote.upsert({
					where: {
						routeId_userId: {
							routeId: params.routeId,
							userId: params.userId,
						},
					},
					create: {
						routeId: params.routeId,
						userId: params.userId,
						value: params.value,
					},
					update: {
						value: params.value,
					},
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const deleteRouteVote = (params: { routeId: string; userId: string }) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: async () => {
				await prisma.routeVote.deleteMany({
					where: {
						routeId: params.routeId,
						userId: params.userId,
					},
				});
			},
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const countRouteVotes = (routeId: string) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.routeVote.groupBy({
					by: ["value"],
					where: { routeId },
					_count: {
						_all: true,
					},
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const listRouteCommentsByRouteId = (routeId: string) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.routeComment.findMany({
					where: { routeId },
					orderBy: { createdAt: "asc" },
					select: routeCommentSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const findRouteCommentById = (commentId: string) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.routeComment.findUnique({
					where: { id: commentId },
					select: routeCommentSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const createRouteComment = (params: {
	routeId: string;
	userId: string;
	content: string;
	parentId?: string;
}) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.routeComment.create({
					data: {
						routeId: params.routeId,
						userId: params.userId,
						content: params.content,
						parentId: params.parentId,
					},
					select: routeCommentSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const updateRoutePrivacyById = (params: {
	routeId: string;
	isPublic: boolean;
}) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.route.update({
					where: { id: params.routeId },
					data: {
						isPublic: params.isPublic,
					},
					select: routeSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const listRouteVersionsByRouteId = (routeId: string) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.routeVersion.findMany({
					where: { routeId },
					orderBy: { createdAt: "desc" },
					select: routeVersionSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const createRouteVersionRecord = (params: {
	routeId: string;
	sourceType: "edit" | "upload";
	originalFileName?: string;
	gpxFileName: string;
	geoJsonFileName: string;
	versionOrder: number;
	distance?: number;
	elevationGain?: number;
	elevationLoss?: number;
	minElevation?: number;
	maxElevation?: number;
	bboxNorth?: number;
	bboxSouth?: number;
	bboxEast?: number;
	bboxWest?: number;
}) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.routeVersion.create({
					data: {
						routeId: params.routeId,
						sourceType: params.sourceType,
						originalFileName: params.originalFileName,
						gpxFileName: params.gpxFileName,
						geoJsonFileName: params.geoJsonFileName,
						versionOrder: params.versionOrder,
						distance: params.distance,
						elevationGain: params.elevationGain,
						elevationLoss: params.elevationLoss,
						minElevation: params.minElevation,
						maxElevation: params.maxElevation,
						bboxNorth: params.bboxNorth,
						bboxSouth: params.bboxSouth,
						bboxEast: params.bboxEast,
						bboxWest: params.bboxWest,
					},
					select: routeVersionSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const setRouteMainVersionById = (params: {
	routeId: string;
	mainVersionId: string;
}) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.route.update({
					where: { id: params.routeId },
					data: { mainVersionId: params.mainVersionId },
					select: routeSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const findRouteVersionById = (params: {
	routeId: string;
	versionId: string;
}) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.routeVersion.findFirst({
					where: {
						id: params.versionId,
						routeId: params.routeId,
					},
					select: routeVersionSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const countRouteVersionsByRouteId = (routeId: string) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () => prisma.routeVersion.count({ where: { routeId } }),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const findOldestRouteVersionByRouteId = (routeId: string) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.routeVersion.findFirst({
					where: { routeId },
					orderBy: { createdAt: "asc" },
					select: routeVersionSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const deleteRouteVersionById = (versionId: string) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.routeVersion.delete({
					where: { id: versionId },
					select: routeVersionSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});
