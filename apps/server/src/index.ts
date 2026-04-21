import { readFile } from "node:fs/promises";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createContext } from "@routes/api/context";
import {
	getRouteVersionGeoJsonFilePath,
	getRouteVersionGpxFilePath,
} from "@routes/api/features/routes/service";
import { appRouter } from "@routes/api/routers/index";
import { auth } from "@routes/auth";
import { prisma } from "@routes/db";
import { env } from "@routes/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

export const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

export const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

app.use("/*", async (c, next) => {
	const context = await createContext({ context: c });

	const rpcResult = await rpcHandler.handle(c.req.raw, {
		prefix: "/rpc",
		context: context,
	});

	if (rpcResult.matched) {
		return c.newResponse(rpcResult.response.body, rpcResult.response);
	}

	const apiResult = await apiHandler.handle(c.req.raw, {
		prefix: "/api-reference",
		context: context,
	});

	if (apiResult.matched) {
		return c.newResponse(apiResult.response.body, apiResult.response);
	}

	await next();
});

const serveRouteFile = async (params: {
	id: string;
	contentType: string;
	filePath: string;
	contentDisposition?: string;
}) => {
	try {
		const file = await readFile(params.filePath);

		return new Response(file, {
			status: 200,
			headers: {
				"Content-Type": params.contentType,
				...(params.contentDisposition
					? { "Content-Disposition": params.contentDisposition }
					: {}),
			},
		});
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return null;
		}

		throw error;
	}
};

app.get("/files/geojson/:id", async (c) => {
	const id = c.req.param("id");
	const route = await prisma.route.findUnique({
		where: { id },
		select: {
			mainVersion: {
				select: {
					geoJsonFileName: true,
				},
			},
		},
	});

	if (!route?.mainVersion) {
		return c.notFound();
	}

	const fileResponse = await serveRouteFile({
		id,
		contentType: "application/geo+json; charset=utf-8",
		filePath: getRouteVersionGeoJsonFilePath(
			route.mainVersion.geoJsonFileName,
			env.GPX_UPLOADS_DIR,
		),
	});

	if (!fileResponse) {
		return c.notFound();
	}

	return fileResponse;
});

app.get("/files/gpx/:id", async (c) => {
	const id = c.req.param("id");
	const versionId = c.req.query("versionId");
	const selectedVersion = versionId
		? await prisma.routeVersion.findFirst({
				where: {
					id: versionId,
					routeId: id,
				},
				select: {
					gpxFileName: true,
				},
			})
		: null;
	const route = await prisma.route.findUnique({
		where: { id },
		select: {
			mainVersion: {
				select: {
					gpxFileName: true,
				},
			},
		},
	});

	if (!route?.mainVersion) {
		return c.notFound();
	}

	const gpxFileName =
		selectedVersion?.gpxFileName ?? route.mainVersion.gpxFileName;
	const fileResponse = await serveRouteFile({
		id,
		contentType: "application/gpx+xml; charset=utf-8",
		filePath: getRouteVersionGpxFilePath(gpxFileName, env.GPX_UPLOADS_DIR),
		contentDisposition: `attachment; filename="${gpxFileName}"`,
	});

	if (!fileResponse) {
		return c.notFound();
	}

	return fileResponse;
});

app.get("/", (c) => {
	return c.text("OK");
});

import { serve } from "@hono/node-server";

serve(
	{
		fetch: app.fetch,
		port: 3000,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`);
	},
);
