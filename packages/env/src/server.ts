import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGIN: z.url(),
		STRAVA_CLIENT_ID: z.string().min(1).optional(),
		STRAVA_CLIENT_SECRET: z.string().min(1).optional(),
		STRAVA_REDIRECT_URI: z.string().min(1).optional(),
		GPX_UPLOADS_DIR: z.string().default("./uploads"),
		ROUTING_ENGINE_URL: z.url().default("http://127.0.0.1:5000"),
		ROUTING_DEFAULT_PROFILE: z
			.enum([
				"runner",
				"road_bike",
				"gravel_bike",
				"cycling",
				"driving",
				"walking",
			])
			.default("gravel_bike"),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
