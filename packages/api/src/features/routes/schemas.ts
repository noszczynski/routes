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
	gpxContent: z.string().min(1),
	source: z.enum(["manual", "strava"]).default("manual"),
	sourceReference: z.string().min(1).optional(),
});

export const DeleteRouteInputSchema = z.object({
	id: z.string().min(1),
});
