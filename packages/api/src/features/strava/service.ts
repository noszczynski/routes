import { env } from "@routes/env/server";
import { Effect } from "effect";

import { createRoute } from "../routes/service";
import {
	StravaImportError,
	StravaNotConfiguredError,
	StravaNotConnectedError,
} from "./errors";
import {
	findStravaConnection,
	upsertStravaConnection,
} from "./repository";

type StravaTokenResponse = {
	access_token: string;
	refresh_token: string;
	expires_at: number;
	scope?: string;
	athlete: {
		id: number;
	};
};

type StravaActivity = {
	id: number;
	name: string;
	type: string;
	start_date: string;
};

type StravaActivityStreams = {
	latlng?: {
		data: Array<[number, number]>;
	};
	altitude?: {
		data: number[];
	};
};

const importableActivityTypes = new Set([
	"Ride",
	"Run",
	"Walk",
	"Hike",
	"TrailRun",
	"MountainBikeRide",
	"GravelRide",
]);

const fetchStravaJson = <T>(url: string, init?: RequestInit) =>
	Effect.tryPromise({
		try: async () => {
			const response = await fetch(url, init);

			if (!response.ok) {
				throw new Error(`Strava request failed with status ${response.status}`);
			}

			return (await response.json()) as T;
		},
		catch: (cause) => new StravaImportError({ cause }),
	});

const getStravaConfig = () =>
	Effect.gen(function* () {
		if (
			!env.STRAVA_CLIENT_ID ||
			!env.STRAVA_CLIENT_SECRET ||
			!env.STRAVA_REDIRECT_URI
		) {
			return yield* Effect.fail(new StravaNotConfiguredError());
		}

		try {
			new URL(env.STRAVA_REDIRECT_URI);
		} catch {
			return yield* Effect.fail(new StravaNotConfiguredError());
		}

		return {
			clientId: env.STRAVA_CLIENT_ID,
			clientSecret: env.STRAVA_CLIENT_SECRET,
			redirectUri: env.STRAVA_REDIRECT_URI,
		};
	});

const exchangeCodeForTokens = (code: string) =>
	Effect.gen(function* () {
		const config = yield* getStravaConfig();

		return yield* fetchStravaJson<StravaTokenResponse>(
			"https://www.strava.com/api/v3/oauth/token",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					client_id: config.clientId,
					client_secret: config.clientSecret,
					code,
					grant_type: "authorization_code",
					redirect_uri: config.redirectUri,
				}),
			},
		);
	});

const refreshTokens = (refreshToken: string) =>
	Effect.gen(function* () {
		const config = yield* getStravaConfig();

		return yield* fetchStravaJson<StravaTokenResponse>(
			"https://www.strava.com/api/v3/oauth/token",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					client_id: config.clientId,
					client_secret: config.clientSecret,
					refresh_token: refreshToken,
					grant_type: "refresh_token",
				}),
			},
		);
	});

const buildGpxFromStreams = (
	activity: StravaActivity,
	streams: StravaActivityStreams,
) => {
	const latlng = streams.latlng?.data ?? [];
	if (latlng.length < 2) {
		throw new Error(`Activity ${activity.id} has no route stream`);
	}

	const altitude = streams.altitude?.data ?? [];
	const trackPoints = latlng
		.map(([lat, lon], index) => {
			const elevation = altitude[index];
			return [
				`<trkpt lat="${lat}" lon="${lon}">`,
				elevation !== undefined ? `<ele>${elevation}</ele>` : "",
				"</trkpt>",
			]
				.filter(Boolean)
				.join("");
		})
		.join("");

	return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="routes" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${activity.name}</name>
  </metadata>
  <trk>
    <name>${activity.name}</name>
    <trkseg>${trackPoints}</trkseg>
  </trk>
</gpx>`;
};

const getFreshConnection = (userId: string) =>
	Effect.gen(function* () {
		const connection = yield* findStravaConnection(userId);

		if (!connection) {
			return yield* Effect.fail(new StravaNotConnectedError());
		}

		if (connection.accessTokenExpiresAt.getTime() > Date.now() + 30_000) {
			return connection;
		}

		const refreshed = yield* refreshTokens(connection.refreshToken);

		return yield* upsertStravaConnection({
			userId,
			stravaAthleteId: String(refreshed.athlete.id),
			accessToken: refreshed.access_token,
			refreshToken: refreshed.refresh_token,
			accessTokenExpiresAt: new Date(refreshed.expires_at * 1000),
			scope: refreshed.scope ?? connection.scope,
		});
	});

export const connectStrava = (params: { userId: string; code: string }) =>
	Effect.gen(function* () {
		const tokenResponse = yield* exchangeCodeForTokens(params.code);

		return yield* upsertStravaConnection({
			userId: params.userId,
			stravaAthleteId: String(tokenResponse.athlete.id),
			accessToken: tokenResponse.access_token,
			refreshToken: tokenResponse.refresh_token,
			accessTokenExpiresAt: new Date(tokenResponse.expires_at * 1000),
			scope: tokenResponse.scope ?? "activity:read_all",
		});
	});

export const getStatus = (userId: string) =>
	Effect.gen(function* () {
		const connection = yield* findStravaConnection(userId);

		return {
			connected: Boolean(connection),
			stravaAthleteId: connection?.stravaAthleteId,
			scope: connection?.scope,
			accessTokenExpiresAt: connection?.accessTokenExpiresAt,
		};
	});

export const importStravaRoutes = (params: { userId: string; limit: number }) =>
	Effect.gen(function* () {
		const connection = yield* getFreshConnection(params.userId);

		const activities = yield* fetchStravaJson<StravaActivity[]>(
			`https://www.strava.com/api/v3/athlete/activities?per_page=${params.limit}&page=1`,
			{
				headers: {
					Authorization: `Bearer ${connection.accessToken}`,
				},
			},
		);

		const candidates = activities
			.filter((activity) => importableActivityTypes.has(activity.type))
			.slice(0, params.limit);

		const importedRoutes = [];

		for (const activity of candidates) {
			const streamsResult = yield* Effect.either(
				fetchStravaJson<StravaActivityStreams>(
					`https://www.strava.com/api/v3/activities/${activity.id}/streams?keys=latlng,altitude&key_by_type=true`,
					{
						headers: {
							Authorization: `Bearer ${connection.accessToken}`,
						},
					},
				),
			);

			if (streamsResult._tag === "Left") {
				continue;
			}

			const gpxResult = yield* Effect.either(
				Effect.try({
					try: () => buildGpxFromStreams(activity, streamsResult.right),
					catch: (cause) => new StravaImportError({ cause }),
				}),
			);

			if (gpxResult._tag === "Left") {
				continue;
			}

			const routeResult = yield* Effect.either(
				createRoute({
					userId: params.userId,
					title: activity.name,
					description: `Zaimportowano ze Strava (${activity.type})`,
					gpxContent: gpxResult.right,
					source: "strava",
					sourceReference: String(activity.id),
				}),
			);

			if (routeResult._tag === "Right") {
				importedRoutes.push(routeResult.right);
			}
		}

		return {
			importedCount: importedRoutes.length,
			routes: importedRoutes,
		};
	});
