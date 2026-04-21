import { prisma } from "@routes/db";
import { Effect } from "effect";

import { DatabaseError } from "../db/errors";

const routeSelect = {
	id: true,
	title: true,
	description: true,
	distance: true,
	elevationGain: true,
	elevationLoss: true,
	minElevation: true,
	maxElevation: true,
	bboxNorth: true,
	bboxSouth: true,
	bboxEast: true,
	bboxWest: true,
	source: true,
	sourceReference: true,
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
		const where = {
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
	userId: string;
	distance?: number;
	elevationGain?: number;
	elevationLoss?: number;
	minElevation?: number;
	maxElevation?: number;
	bboxNorth?: number;
	bboxSouth?: number;
	bboxEast?: number;
	bboxWest?: number;
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
						userId: params.userId,
						distance: params.distance,
						elevationGain: params.elevationGain,
						elevationLoss: params.elevationLoss,
						minElevation: params.minElevation,
						maxElevation: params.maxElevation,
						bboxNorth: params.bboxNorth,
						bboxSouth: params.bboxSouth,
						bboxEast: params.bboxEast,
						bboxWest: params.bboxWest,
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
