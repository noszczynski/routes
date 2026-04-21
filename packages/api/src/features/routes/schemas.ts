import { z } from "zod";

const nonEmptyOptionalString = z
	.string()
	.trim()
	.max(4000)
	.transform((value) => value || undefined)
	.optional();

export const BboxSchema = z.object({
	north: z.number().min(-90).max(90),
	south: z.number().min(-90).max(90),
	east: z.number().min(-180).max(180),
	west: z.number().min(-180).max(180),
});

export const RouteFiltersSchema = z
	.object({
		minDistance: z.number().nonnegative().optional(),
		maxDistance: z.number().nonnegative().optional(),
		minElevationGain: z.number().nonnegative().optional(),
		maxElevationGain: z.number().nonnegative().optional(),
	})
	.optional();

export const ListRoutesInputSchema = z.object({
	bbox: BboxSchema.optional(),
	filters: RouteFiltersSchema,
	mine: z.boolean().default(false),
});

export const GetRouteInputSchema = z.object({
	id: z.string().min(1),
});

export const CreateRouteInputSchema = z.object({
	title: z.string().trim().min(1).max(120),
	description: nonEmptyOptionalString,
	isPublic: z.boolean().default(false),
	gpxContent: z.string().min(1),
	source: z.enum(["manual", "strava"]).default("manual"),
	sourceReference: z.string().min(1).optional(),
});

export const DeleteRouteInputSchema = z.object({
	id: z.string().min(1),
});

export const RateRouteInputSchema = z.object({
	routeId: z.string().min(1),
	value: z.enum(["up", "down"]).nullable(),
});

export const AddRouteCommentInputSchema = z.object({
	routeId: z.string().min(1),
	parentCommentId: z.string().min(1).optional(),
	content: z.string().trim().min(1).max(1000),
});

export const UpdateRoutePrivacyInputSchema = z.object({
	routeId: z.string().min(1),
	isPublic: z.boolean(),
});

export const RouteWaypointSchema = z.object({
	lat: z.number().min(-90).max(90),
	lon: z.number().min(-180).max(180),
});

export const RecalculateRouteInputSchema = z.object({
	routeId: z.string().min(1),
	profile: z.enum(["cycling", "driving", "walking"]).default("cycling"),
	waypoints: z.array(RouteWaypointSchema).min(2),
	persist: z.boolean().default(false),
});
