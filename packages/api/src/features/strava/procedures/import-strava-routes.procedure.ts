import { Effect } from "effect";

import { protectedProcedure } from "../../../index";
import { DatabaseError } from "../../db/errors";
import { GpxParseError } from "../../routes/errors";
import {
	StravaImportError,
	StravaNotConfiguredError,
	StravaNotConnectedError,
} from "../errors";
import { ImportStravaRoutesInputSchema } from "../schemas";
import { importStravaRoutes } from "../service";

export const importStravaRoutesProcedure = protectedProcedure
	.input(ImportStravaRoutesInputSchema)
	.errors({
		STRAVA_NOT_CONFIGURED: {
			status: 503,
			message: "Integracja Strava nie jest skonfigurowana",
		},
		STRAVA_NOT_CONNECTED: {
			status: 404,
			message: "Najpierw połącz konto Strava",
		},
		STRAVA_IMPORT_ERROR: {
			status: 422,
			message: "Nie udało się zaimportować tras ze Strava",
		},
		INTERNAL_SERVER_ERROR: {},
	})
	.handler(async ({ input, context, errors }) => {
		return await Effect.runPromise(
			importStravaRoutes({
				userId: context.session.user.id,
				limit: input.limit,
			}).pipe(
				Effect.mapError((error) => {
					if (error instanceof StravaNotConfiguredError) {
						return errors.STRAVA_NOT_CONFIGURED({
							message: error.publicMessage,
							cause: error,
						});
					}

					if (error instanceof StravaNotConnectedError) {
						return errors.STRAVA_NOT_CONNECTED({
							message: error.publicMessage,
							cause: error,
						});
					}

					if (
						error instanceof StravaImportError ||
						error instanceof GpxParseError
					) {
						return errors.STRAVA_IMPORT_ERROR({
							message: error.publicMessage,
							cause: error,
						});
					}

					if (error instanceof DatabaseError) {
						return errors.INTERNAL_SERVER_ERROR({
							message: error.publicMessage,
							cause: error,
						});
					}

					return errors.INTERNAL_SERVER_ERROR({ cause: error });
				}),
			),
		);
	});
