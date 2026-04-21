import { Effect } from "effect";

import { publicProcedure } from "../../../index";
import { DatabaseError } from "../../db/errors";
import { RouteNotFoundError } from "../errors";
import { GetRouteInputSchema } from "../schemas";
import { getRoute } from "../service";

export const getRouteProcedure = publicProcedure
	.input(GetRouteInputSchema)
	.errors({
		NOT_FOUND: {
			status: 404,
			message: "Trasa nie została znaleziona",
		},
		INTERNAL_SERVER_ERROR: {},
	})
	.handler(async ({ input, errors }) => {
		return await Effect.runPromise(
			getRoute(input.id).pipe(
				Effect.mapError((error) => {
					if (error instanceof RouteNotFoundError) {
						return errors.NOT_FOUND({
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
