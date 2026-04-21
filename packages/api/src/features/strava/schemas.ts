import { z } from "zod";

export const ConnectStravaInputSchema = z.object({
	code: z.string().min(1),
});

export const ImportStravaRoutesInputSchema = z.object({
	limit: z.number().int().min(1).max(20).default(10),
});
