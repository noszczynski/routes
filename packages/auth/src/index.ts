import { createPrismaClient } from "@routes/db";
import { env } from "@routes/env/server";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

const getAuthBaseURL = () => {
	const configuredBaseURL = new URL(env.BETTER_AUTH_URL);

	// Better Auth needs the backend origin here. In local development it's easy
	// to accidentally point this at the frontend callback placeholder instead.
	if (
		env.NODE_ENV === "development" &&
		(configuredBaseURL.origin === env.CORS_ORIGIN ||
			configuredBaseURL.pathname !== "/")
	) {
		return "http://localhost:3000";
	}

	return env.BETTER_AUTH_URL;
};

export function createAuth() {
	const prisma = createPrismaClient();

	return betterAuth({
		database: prismaAdapter(prisma, {
			provider: "postgresql",
		}),

		trustedOrigins: [env.CORS_ORIGIN],
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
		},
		databaseHooks: {
			user: {
				create: {
					before: async (user) => ({
						data: { ...user, emailVerified: true },
					}),
				},
			},
		},
		secret: env.BETTER_AUTH_SECRET,
		baseURL: getAuthBaseURL(),
		advanced: {
			defaultCookieAttributes: {
				sameSite: "none",
				secure: true,
				httpOnly: true,
			},
		},
		plugins: [],
	});
}

export const auth = createAuth();
