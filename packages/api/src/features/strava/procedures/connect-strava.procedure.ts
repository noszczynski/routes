import { Effect } from "effect";

import { protectedProcedure } from "../../../index";
import { DatabaseError } from "../../db/errors";
import { StravaImportError, StravaNotConfiguredError } from "../errors";
import { ConnectStravaInputSchema } from "../schemas";
import { connectStrava } from "../service";

export const connectStravaProcedure = protectedProcedure
	.input(ConnectStravaInputSchema)
	.errors({
		STRAVA_NOT_CONFIGURED: {
			status: 503,
			message: "Integracja Strava nie jest skonfigurowana",
		},
		STRAVA_CONNECT_ERROR: {
			status: 422,
			message: "Nie udało się połączyć konta Strava",
		},
		INTERNAL_SERVER_ERROR: {},
	})
	.handler(async ({ input, context, errors }) => {
		return await Effect.runPromise(
			connectStrava({
				userId: context.session.user.id,
				code: input.code,
			}).pipe(
				Effect.mapError((error) => {
					if (error instanceof StravaNotConfiguredError) {
						return errors.STRAVA_NOT_CONFIGURED({
							message: error.publicMessage,
							cause: error,
						});
					}

					if (error instanceof StravaImportError) {
						return errors.STRAVA_CONNECT_ERROR({
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
