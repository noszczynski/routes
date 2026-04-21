import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@routes/env/server";
import { gpx as gpxToGeoJson } from "@tmcw/togeojson";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { Either, Effect } from "effect";
import { XMLParser } from "fast-xml-parser";

import {
	GpxParseError,
	RoutingEngineError,
	RouteCommentParentMismatchError,
	RouteCommentParentNotFoundError,
	RouteNotFoundError,
	RouteOwnershipError,
} from "./errors";
import {
	countRouteVotes,
	createRouteComment,
	createRouteRecord,
	deleteRouteVote,
	deleteRouteById,
	findRouteCommentById,
	findRouteById,
	findRouteVoteByUser,
	findRouteBySourceReference,
	listRoutesByUserId,
	listRouteCommentsByRouteId,
	listRoutesInBbox,
	updateRouteMetricsById,
	updateRoutePrivacyById,
	upsertRouteVote,
} from "./repository";

type ParsedPoint = {
	lat: number;
	lon: number;
	ele: number | undefined;
};

export type RouteWaypoint = {
	lat: number;
	lon: number;
};

type RoutingProfile = "cycling" | "driving" | "walking";

type ParsedRouteData = {
	gpxContent: string;
	geoJson: {
		type: "FeatureCollection";
		features: Array<Record<string, unknown>>;
	};
	metrics: {
		distance?: number;
		elevationGain?: number;
		elevationLoss?: number;
		minElevation?: number;
		maxElevation?: number;
		bboxNorth?: number;
		bboxSouth?: number;
		bboxEast?: number;
		bboxWest?: number;
	};
};

type RouteRecord = {
	id: string;
	title: string;
	description: string | null;
	isPublic: boolean;
	distance: number | null;
	elevationGain: number | null;
	elevationLoss: number | null;
	minElevation: number | null;
	maxElevation: number | null;
	bboxNorth: number | null;
	bboxSouth: number | null;
	bboxEast: number | null;
	bboxWest: number | null;
	userId: string;
	user: {
		name: string;
	};
	createdAt: Date;
	updatedAt: Date;
};

type RouteCommentRecord = {
	id: string;
	routeId: string;
	parentId: string | null;
	content: string;
	userId: string;
	user: {
		id: string;
		name: string;
	};
	createdAt: Date;
	updatedAt: Date;
};

export type RouteCommentNode = {
	id: string;
	routeId: string;
	parentCommentId: string | null;
	content: string;
	authorId: string;
	authorName: string;
	createdAt: Date;
	updatedAt: Date;
	replies: RouteCommentNode[];
};

const xmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "",
});
const xmlSerializer = new XMLSerializer();
const xmlDeclarationPattern = /^\s*(<\?xml[\s\S]*?\?>)\s*/i;

const round = (value: number, precision = 2) =>
	Number(value.toFixed(precision));

const toArray = <T>(value: T | T[] | undefined) =>
	value === undefined ? [] : Array.isArray(value) ? value : [value];

const toOptionalNumber = (value: unknown) => {
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : undefined;
};

type XmlDomNode = {
	nodeType: number;
	nodeName: string;
	localName?: string | null;
	nodeValue?: string | null;
	firstChild: XmlDomNode | null;
	nextSibling: XmlDomNode | null;
	removeChild(child: XmlDomNode): XmlDomNode;
};

const stripExtensionsAndWhitespace = (node: XmlDomNode) => {
	let child = node.firstChild;

	while (child) {
		const nextSibling = child.nextSibling;

		if (child.nodeType === 3 && !(child.nodeValue ?? "").trim()) {
			node.removeChild(child);
			child = nextSibling;
			continue;
		}

		if (child.nodeType === 1) {
			const nodeName = child.nodeName.toLowerCase();
			const localName =
				typeof child.localName === "string"
					? child.localName.toLowerCase()
					: undefined;

			if (localName === "extensions" || nodeName === "extensions" || nodeName.endsWith(":extensions")) {
				node.removeChild(child);
				child = nextSibling;
				continue;
			}

			stripExtensionsAndWhitespace(child);
		}

		child = nextSibling;
	}
};

const sanitizeGpxContent = (gpxContent: string) => {
	const xmlDeclaration = gpxContent.match(xmlDeclarationPattern)?.[1] ?? "";
	const document = new DOMParser().parseFromString(
		gpxContent,
		"application/xml",
	);
	const root = document.documentElement;

	if (!root) {
		throw new Error("Missing gpx root node");
	}

	stripExtensionsAndWhitespace(root);

	const serializedRoot = xmlSerializer
		.serializeToString(root)
		.replace(/>\s+</g, "><")
		.replace(/\s+\/>/g, "/>");

	return `${xmlDeclaration}${serializedRoot}`;
};

const extractPointsFromParsedGpx = (gpxContent: string): ParsedPoint[] => {
	const parsed = xmlParser.parse(gpxContent) as {
		gpx?: {
			trk?: unknown;
			rte?: unknown;
		};
	};

	const root = parsed.gpx;
	if (!root) {
		throw new Error("Missing gpx root node");
	}

	const trackPoints = toArray(root.trk).flatMap((track) =>
		toArray((track as { trkseg?: unknown }).trkseg).flatMap((segment) =>
			toArray((segment as { trkpt?: unknown }).trkpt),
		),
	);

	const routePoints = toArray(root.rte).flatMap((route) =>
		toArray((route as { rtept?: unknown }).rtept),
	);

	const rawPoints = trackPoints.length > 0 ? trackPoints : routePoints;

	return rawPoints
		.map((point) => {
			const rawPoint = point as {
				lat?: unknown;
				lon?: unknown;
				ele?: unknown;
			};

			const lat = toOptionalNumber(rawPoint.lat);
			const lon = toOptionalNumber(rawPoint.lon);

			if (lat === undefined || lon === undefined) {
				return null;
			}

			return {
				lat,
				lon,
				ele: toOptionalNumber(rawPoint.ele),
			};
		})
		.filter((point): point is ParsedPoint => point !== null);
};

const toFeatureCollection = (gpxContent: string, points: ParsedPoint[]) => {
	const geoJsonDocument = new DOMParser().parseFromString(
		gpxContent,
		"application/xml",
	);

	const geoJson = gpxToGeoJson(geoJsonDocument) as unknown as {
		type?: string;
		features?: Array<Record<string, unknown>>;
	};

	if (geoJson.type === "FeatureCollection" && geoJson.features?.length) {
		return {
			type: "FeatureCollection" as const,
			features: geoJson.features,
		};
	}

	return {
		type: "FeatureCollection" as const,
		features: [
			{
				type: "Feature",
				properties: {},
				geometry: {
					type: "LineString",
					coordinates: points.map((point) => [point.lon, point.lat]),
				},
			},
		],
	};
};

const haversineInKm = (start: ParsedPoint, end: ParsedPoint) => {
	const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
	const earthRadius = 6371;
	const latDiff = toRadians(end.lat - start.lat);
	const lonDiff = toRadians(end.lon - start.lon);
	const startLat = toRadians(start.lat);
	const endLat = toRadians(end.lat);

	const a =
		Math.sin(latDiff / 2) ** 2 +
		Math.cos(startLat) * Math.cos(endLat) * Math.sin(lonDiff / 2) ** 2;

	return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const calculateMetrics = (points: ParsedPoint[]) => {
	if (points.length === 0) {
		return {};
	}

	let distance = 0;
	let elevationGain = 0;
	let elevationLoss = 0;
	let minElevation: number | undefined;
	let maxElevation: number | undefined;
	let bboxNorth = -90;
	let bboxSouth = 90;
	let bboxEast = -180;
	let bboxWest = 180;

	points.forEach((point, index) => {
		const previous = index > 0 ? points[index - 1] : undefined;

		if (previous) {
			distance += haversineInKm(previous, point);

			if (previous.ele !== undefined && point.ele !== undefined) {
				const delta = point.ele - previous.ele;
				if (delta > 0) {
					elevationGain += delta;
				} else {
					elevationLoss += Math.abs(delta);
				}
			}
		}

		if (point.ele !== undefined) {
			minElevation =
				minElevation === undefined
					? point.ele
					: Math.min(minElevation, point.ele);
			maxElevation =
				maxElevation === undefined
					? point.ele
					: Math.max(maxElevation, point.ele);
		}

		bboxNorth = Math.max(bboxNorth, point.lat);
		bboxSouth = Math.min(bboxSouth, point.lat);
		bboxEast = Math.max(bboxEast, point.lon);
		bboxWest = Math.min(bboxWest, point.lon);
	});

	return {
		distance: round(distance),
		elevationGain: round(elevationGain, 1),
		elevationLoss: round(elevationLoss, 1),
		minElevation:
			minElevation === undefined ? undefined : round(minElevation, 1),
		maxElevation:
			maxElevation === undefined ? undefined : round(maxElevation, 1),
		bboxNorth: round(bboxNorth, 6),
		bboxSouth: round(bboxSouth, 6),
		bboxEast: round(bboxEast, 6),
		bboxWest: round(bboxWest, 6),
	};
};

const resolveRoutingProfile = (
	profile: RoutingProfile | undefined,
): RoutingProfile => {
	if (profile) {
		return profile;
	}

	const defaultProfile = env.ROUTING_DEFAULT_PROFILE;
	if (
		defaultProfile === "cycling" ||
		defaultProfile === "driving" ||
		defaultProfile === "walking"
	) {
		return defaultProfile;
	}

	return "cycling";
};

const toRoundedWaypoints = (waypoints: RouteWaypoint[]) =>
	waypoints.map((waypoint) => ({
		lat: round(waypoint.lat, 6),
		lon: round(waypoint.lon, 6),
	}));

const buildOsrmRequestUrl = (params: {
	baseUrl: string;
	profile: RoutingProfile;
	waypoints: RouteWaypoint[];
}) => {
	const coordinates = params.waypoints
		.map((point) => `${point.lon.toFixed(6)},${point.lat.toFixed(6)}`)
		.join(";");
	const query = new URLSearchParams({
		overview: "full",
		geometries: "geojson",
		steps: "false",
	});
	return `${params.baseUrl}/route/v1/${params.profile}/${coordinates}?${query.toString()}`;
};

const waypointsToCoordinates = (waypoints: RouteWaypoint[]) =>
	waypoints.map((waypoint) => [waypoint.lon, waypoint.lat]);

const routeCoordinatesToGpx = (coordinates: number[][]) => {
	const trkPoints = coordinates
		.map((coordinate) => {
			const [lon, lat] = coordinate;

			if (
				lat === undefined ||
				lon === undefined ||
				!Number.isFinite(lat) ||
				!Number.isFinite(lon)
			) {
				return "";
			}

			return `<trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"></trkpt>`;
		})
		.filter(Boolean)
		.join("");

	if (!trkPoints) {
		throw new Error("Route did not return valid coordinates");
	}

	return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="routes" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Rerouted track</name><trkseg>${trkPoints}</trkseg></trk></gpx>`;
};

const fetchReroutedGpxFromOsrm = (params: {
	profile?: RoutingProfile;
	waypoints: RouteWaypoint[];
}) =>
	Effect.tryPromise({
		try: async () => {
			const roundedWaypoints = toRoundedWaypoints(params.waypoints);
			const routingEngineBaseUrl = env.ROUTING_ENGINE_URL?.replace(/\/+$/, "");
			const applicationBaseUrl = env.BETTER_AUTH_URL.replace(/\/+$/, "");

			if (
				!routingEngineBaseUrl ||
				routingEngineBaseUrl === applicationBaseUrl
			) {
				return routeCoordinatesToGpx(waypointsToCoordinates(roundedWaypoints));
			}

			const profile = resolveRoutingProfile(params.profile);
			const requestUrl = buildOsrmRequestUrl({
				baseUrl: routingEngineBaseUrl,
				profile,
				waypoints: roundedWaypoints,
			});
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 10_000);

			try {
				const response = await fetch(requestUrl, {
					signal: controller.signal,
				});

				if (!response.ok) {
					throw new Error(`OSRM request failed with status ${response.status}`);
				}

				const body = (await response.json()) as {
					routes?: Array<{
						geometry?: {
							coordinates?: number[][];
						};
					}>;
				};
				const coordinates = body.routes?.[0]?.geometry?.coordinates ?? [];

				if (coordinates.length < 2) {
					throw new Error("OSRM returned too few coordinates");
				}

				return routeCoordinatesToGpx(coordinates);
			} finally {
				clearTimeout(timeout);
			}
		},
		catch: (cause) => new RoutingEngineError({ cause }),
	});

const parseGpx = (gpxContent: string) =>
	Effect.try({
		try: () => {
			const sanitizedGpxContent = sanitizeGpxContent(gpxContent);
			const points = extractPointsFromParsedGpx(sanitizedGpxContent);

			if (points.length < 2) {
				throw new Error("GPX route needs at least two points");
			}

			return {
				gpxContent: sanitizedGpxContent,
				geoJson: toFeatureCollection(sanitizedGpxContent, points),
				metrics: calculateMetrics(points),
			} satisfies ParsedRouteData;
		},
		catch: (cause) => new GpxParseError({ cause }),
	});

export const resolveUploadsDir = (uploadsDir = env.GPX_UPLOADS_DIR) =>
	path.isAbsolute(uploadsDir)
		? uploadsDir
		: path.resolve(process.cwd(), uploadsDir);

export const getGpxFileName = (params: { routeId: string; userId: string }) =>
	`${params.userId}-${params.routeId}.gpx`;

export const getGpxFilePath = (
	params: { routeId: string; userId: string },
	uploadsDir = env.GPX_UPLOADS_DIR,
) =>
	path.join(
		resolveUploadsDir(uploadsDir),
		"gpx",
		getGpxFileName(params),
	);

export const getGeoJsonFilePath = (
	routeId: string,
	uploadsDir = env.GPX_UPLOADS_DIR,
) => path.join(resolveUploadsDir(uploadsDir), "geojson", `${routeId}.geojson`);

const ensureUploadsDirectories = (uploadsDir = env.GPX_UPLOADS_DIR) =>
	Effect.tryPromise({
		try: async () => {
			const baseDir = resolveUploadsDir(uploadsDir);

			await Promise.all([
				mkdir(path.join(baseDir, "gpx"), { recursive: true }),
				mkdir(path.join(baseDir, "geojson"), { recursive: true }),
			]);
		},
		catch: (cause) => new GpxParseError({ cause }),
	});

const writeRouteFiles = (params: {
	routeId: string;
	userId: string;
	gpxContent: string;
	geoJson: ParsedRouteData["geoJson"];
}) =>
	Effect.gen(function* () {
		yield* ensureUploadsDirectories();

		yield* Effect.tryPromise({
			try: async () => {
				await Promise.all([
					writeFile(
						getGpxFilePath({
							routeId: params.routeId,
							userId: params.userId,
						}),
						params.gpxContent,
						"utf8",
					),
					writeFile(
						getGeoJsonFilePath(params.routeId),
						JSON.stringify(params.geoJson),
						"utf8",
					),
				]);
			},
			catch: (cause) => new GpxParseError({ cause }),
		});
	});

const deleteRouteFiles = (params: { routeId: string; userId: string }) =>
	Effect.tryPromise({
		try: async () => {
			await Promise.all(
				[
					getGpxFilePath({
						routeId: params.routeId,
						userId: params.userId,
					}),
					getGeoJsonFilePath(params.routeId),
				].map(
					async (filePath) => {
						try {
							await unlink(filePath);
						} catch (error) {
							const errorCode =
								typeof error === "object" &&
								error !== null &&
								"code" in error
									? (error as { code?: string }).code
									: undefined;

							if (errorCode !== "ENOENT") {
								throw error;
							}
						}
					},
				),
			);
		},
		catch: (cause) => new GpxParseError({ cause }),
	});

const toRouteSummary = (route: RouteRecord) => ({
	id: route.id,
	title: route.title,
	description: route.description,
	isPublic: route.isPublic,
	distance: route.distance,
	elevationGain: route.elevationGain,
	elevationLoss: route.elevationLoss,
	minElevation: route.minElevation,
	maxElevation: route.maxElevation,
	bboxNorth: route.bboxNorth,
	bboxSouth: route.bboxSouth,
	bboxEast: route.bboxEast,
	bboxWest: route.bboxWest,
	userId: route.userId,
	authorName: route.user.name,
	createdAt: route.createdAt,
	updatedAt: route.updatedAt,
});

const toRouteComment = (comment: RouteCommentRecord): RouteCommentNode => ({
	id: comment.id,
	routeId: comment.routeId,
	parentCommentId: comment.parentId,
	content: comment.content,
	authorId: comment.userId,
	authorName: comment.user.name,
	createdAt: comment.createdAt,
	updatedAt: comment.updatedAt,
	replies: [],
});

const buildCommentsTree = (comments: RouteCommentRecord[]): RouteCommentNode[] => {
	const commentMap = new Map(
		comments.map((comment) => [comment.id, toRouteComment(comment)]),
	);
	const roots: RouteCommentNode[] = [];

	for (const comment of comments) {
		const node = commentMap.get(comment.id);
		if (!node) {
			continue;
		}

		if (!comment.parentId) {
			roots.push(node);
			continue;
		}

		const parent = commentMap.get(comment.parentId);
		if (!parent) {
			roots.push(node);
			continue;
		}

		parent.replies.push(node);
	}

	return roots;
};

const getRouteRating = (params: { routeId: string; userId?: string }) =>
	Effect.gen(function* () {
		const groupedVotes = yield* countRouteVotes(params.routeId);
		const userVote = params.userId
			? yield* findRouteVoteByUser({
					routeId: params.routeId,
					userId: params.userId,
				})
			: null;

		let upvotes = 0;
		let downvotes = 0;

		for (const vote of groupedVotes) {
			if (vote.value === "up") {
				upvotes = vote._count._all;
				continue;
			}

			downvotes = vote._count._all;
		}

		const myVote =
			userVote?.value === "up" ? "up" : userVote?.value === "down" ? "down" : null;

		return {
			upvotes,
			downvotes,
			myVote,
		};
	});

const getRouteComments = (routeId: string) =>
	Effect.gen(function* () {
		const comments = yield* listRouteCommentsByRouteId(routeId);
		return buildCommentsTree(comments);
	});

export const listRoutes = (params: {
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
	userId?: string;
	mine?: boolean;
}) =>
	Effect.gen(function* () {
		if (params.mine) {
			if (!params.userId) {
				return [];
			}

			const routes = yield* listRoutesByUserId(params.userId);
			return routes.map(toRouteSummary);
		}

		const routes = yield* listRoutesInBbox({
			bbox: params.bbox,
			filters: params.filters,
		});

		return routes.map(toRouteSummary);
	});

export const getRoute = (params: { routeId: string; userId?: string }) =>
	Effect.gen(function* () {
		const route = yield* findRouteById(params.routeId);

		if (!route) {
			return yield* Effect.fail(
				new RouteNotFoundError({ routeId: params.routeId }),
			);
		}

		const rating = yield* getRouteRating({
			routeId: route.id,
			userId: params.userId,
		});
		const comments = yield* getRouteComments(route.id);

		return {
			...toRouteSummary(route),
			source: route.source,
			sourceReference: route.sourceReference,
			rating,
			comments,
		};
	});

export const createRoute = (params: {
	title: string;
	description?: string;
	isPublic?: boolean;
	gpxContent: string;
	userId: string;
	source?: "manual" | "strava";
	sourceReference?: string;
}) =>
	Effect.gen(function* () {
		if (params.sourceReference) {
			const existingRoute = yield* findRouteBySourceReference({
				userId: params.userId,
				sourceReference: params.sourceReference,
			});

			if (existingRoute) {
				return toRouteSummary(existingRoute);
			}
		}

		const parsedRoute = yield* parseGpx(params.gpxContent);
		const createdRoute = yield* createRouteRecord({
			title: params.title,
			description: params.description,
			isPublic: params.isPublic,
			userId: params.userId,
			source: params.source,
			sourceReference: params.sourceReference,
			...parsedRoute.metrics,
		});

		const writeResult = yield* Effect.either(
			writeRouteFiles({
				routeId: createdRoute.id,
				userId: params.userId,
				gpxContent: parsedRoute.gpxContent,
				geoJson: parsedRoute.geoJson,
			}),
		);

		if (Either.isLeft(writeResult)) {
			yield* Effect.ignore(deleteRouteById(createdRoute.id));
			yield* Effect.ignore(
				deleteRouteFiles({
					routeId: createdRoute.id,
					userId: params.userId,
				}),
			);
			return yield* Effect.fail(writeResult.left);
		}

		return toRouteSummary(createdRoute);
	});

export const deleteRoute = (params: { routeId: string; userId: string }) =>
	Effect.gen(function* () {
		const route = yield* findRouteById(params.routeId);

		if (!route) {
			return yield* Effect.fail(
				new RouteNotFoundError({ routeId: params.routeId }),
			);
		}

		if (route.userId !== params.userId) {
			return yield* Effect.fail(new RouteOwnershipError());
		}

		yield* deleteRouteById(params.routeId);
		yield* Effect.ignore(
			deleteRouteFiles({
				routeId: params.routeId,
				userId: route.userId,
			}),
		);

		return {
			id: params.routeId,
			deleted: true,
		};
	});

export const rateRoute = (params: {
	routeId: string;
	userId: string;
	value: "up" | "down" | null;
}) =>
	Effect.gen(function* () {
		const route = yield* findRouteById(params.routeId);

		if (!route) {
			return yield* Effect.fail(
				new RouteNotFoundError({ routeId: params.routeId }),
			);
		}

		if (params.value === null) {
			yield* deleteRouteVote({
				routeId: params.routeId,
				userId: params.userId,
			});
		} else {
			yield* upsertRouteVote({
				routeId: params.routeId,
				userId: params.userId,
				value: params.value,
			});
		}

		return yield* getRouteRating({
			routeId: params.routeId,
			userId: params.userId,
		});
	});

export const addRouteComment = (params: {
	routeId: string;
	userId: string;
	content: string;
	parentCommentId?: string;
}) =>
	Effect.gen(function* () {
		const route = yield* findRouteById(params.routeId);

		if (!route) {
			return yield* Effect.fail(
				new RouteNotFoundError({ routeId: params.routeId }),
			);
		}

		if (params.parentCommentId) {
			const parentComment = yield* findRouteCommentById(params.parentCommentId);

			if (!parentComment) {
				return yield* Effect.fail(new RouteCommentParentNotFoundError());
			}

			if (parentComment.routeId !== params.routeId) {
				return yield* Effect.fail(new RouteCommentParentMismatchError());
			}
		}

		const createdComment = yield* createRouteComment({
			routeId: params.routeId,
			userId: params.userId,
			parentId: params.parentCommentId,
			content: params.content,
		});

		return toRouteComment(createdComment);
	});

export const recalculateRoute = (params: {
	routeId: string;
	userId: string;
	waypoints: RouteWaypoint[];
	profile?: RoutingProfile;
	persist?: boolean;
}) =>
	Effect.gen(function* () {
		const route = yield* findRouteById(params.routeId);

		if (!route) {
			return yield* Effect.fail(
				new RouteNotFoundError({ routeId: params.routeId }),
			);
		}

		if (route.userId !== params.userId) {
			return yield* Effect.fail(new RouteOwnershipError());
		}

		// Ensure source GPX file exists before allowing recalculation.
		yield* Effect.tryPromise({
			try: () =>
				readFile(
					getGpxFilePath({
						routeId: params.routeId,
						userId: route.userId,
					}),
					"utf8",
				),
			catch: (cause) => new GpxParseError({ cause }),
		});

		const reroutedGpx = yield* fetchReroutedGpxFromOsrm({
			profile: params.profile,
			waypoints: params.waypoints,
		});
		const parsedRoute = yield* parseGpx(reroutedGpx);

		if (!params.persist) {
			return {
				route: {
					...toRouteSummary(route),
					...parsedRoute.metrics,
				},
				geoJson: parsedRoute.geoJson,
				gpxContent: parsedRoute.gpxContent,
			};
		}

		yield* writeRouteFiles({
			routeId: route.id,
			userId: route.userId,
			gpxContent: parsedRoute.gpxContent,
			geoJson: parsedRoute.geoJson,
		});

		const updatedRoute = yield* updateRouteMetricsById({
			routeId: route.id,
			...parsedRoute.metrics,
		});

		return {
			route: toRouteSummary(updatedRoute),
			geoJson: parsedRoute.geoJson,
			gpxContent: parsedRoute.gpxContent,
		};
	});

export const updateRoutePrivacy = (params: {
	routeId: string;
	userId: string;
	isPublic: boolean;
}) =>
	Effect.gen(function* () {
		const route = yield* findRouteById(params.routeId);

		if (!route) {
			return yield* Effect.fail(
				new RouteNotFoundError({ routeId: params.routeId }),
			);
		}

		if (route.userId !== params.userId) {
			return yield* Effect.fail(new RouteOwnershipError());
		}

		const updatedRoute = yield* updateRoutePrivacyById({
			routeId: params.routeId,
			isPublic: params.isPublic,
		});

		return toRouteSummary(updatedRoute);
	});
