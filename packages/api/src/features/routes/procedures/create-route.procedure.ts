import { Effect } from "effect";
import { protectedProcedure } from "../../../index";

import { DatabaseError } from "../../db/errors";
import { GpxParseError } from "../errors";
import { CreateRouteInputSchema } from "../schemas";
import { createRoute } from "../service";

export const createRouteProcedure = protectedProcedure
	.input(CreateRouteInputSchema)
	.errors({
		INVALID_GPX: {
			status: 422,
			message: "Nieprawidłowy plik GPX",
		},
		INTERNAL_SERVER_ERROR: {},
	})
	.handler(async ({ input, context, errors }) => {
		return await Effect.runPromise(
			createRoute({
				...input,
				userId: context.session.user.id,
			}).pipe(
				Effect.mapError((error) => {
					if (error instanceof GpxParseError) {
						return errors.INVALID_GPX({
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
