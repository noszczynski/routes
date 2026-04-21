import { prisma } from "@routes/db";
import { Effect } from "effect";

import { DatabaseError } from "../db/errors";

const stravaConnectionSelect = {
	id: true,
	userId: true,
	stravaAthleteId: true,
	accessToken: true,
	refreshToken: true,
	accessTokenExpiresAt: true,
	scope: true,
	createdAt: true,
	updatedAt: true,
} as const;

export const findStravaConnection = (userId: string) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.stravaConnection.findUnique({
					where: { userId },
					select: stravaConnectionSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});

export const upsertStravaConnection = (params: {
	userId: string;
	stravaAthleteId: string;
	accessToken: string;
	refreshToken: string;
	accessTokenExpiresAt: Date;
	scope: string;
}) =>
	Effect.gen(function* () {
		return yield* Effect.tryPromise({
			try: () =>
				prisma.stravaConnection.upsert({
					where: { userId: params.userId },
					create: params,
					update: {
						stravaAthleteId: params.stravaAthleteId,
						accessToken: params.accessToken,
						refreshToken: params.refreshToken,
						accessTokenExpiresAt: params.accessTokenExpiresAt,
						scope: params.scope,
					},
					select: stravaConnectionSelect,
				}),
			catch: (cause) => new DatabaseError({ cause }),
		});
	});
