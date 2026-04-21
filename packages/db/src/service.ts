import { Context, Layer } from "effect";

import type { PrismaClient } from "../prisma/generated/client";

export class Database extends Context.Tag("Database")<
	Database,
	PrismaClient
>() {}

export const DatabaseService = (client: PrismaClient) =>
	Layer.succeed(Database, client);
