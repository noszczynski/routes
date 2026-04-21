import { Effect } from "effect";

import { protectedProcedure } from "../../../index";
import { DatabaseError } from "../../db/errors";
import {
	GpxParseError,
	RoutingEngineError,
	RouteNotFoundError,
	RouteOwnershipError,
} from "../errors";
import { RecalculateRouteInputSchema } from "../schemas";
import { recalculateRoute } from "../service";

export const recalculateRouteProcedure = protectedProcedure
	.input(RecalculateRouteInputSchema)
	.errors({
		NOT_FOUND: {
			status: 404,
			message: "Trasa nie została znaleziona",
		},
		FORBIDDEN: {
			status: 403,
			message: "Nie możesz edytować tej trasy",
		},
		INVALID_GPX: {
			status: 422,
			message: "Nie udało się przetworzyć geometrii trasy",
		},
		ROUTING_ENGINE_ERROR: {
			status: 502,
			message: "Silnik routingu jest chwilowo niedostępny",
		},
		INTERNAL_SERVER_ERROR: {},
	})
	.handler(async ({ input, context, errors }) => {
		return await Effect.runPromise(
			recalculateRoute({
				routeId: input.routeId,
				userId: context.session.user.id,
				profile: input.profile,
				waypoints: input.waypoints,
				persist: input.persist,
			}).pipe(
				Effect.mapError((error) => {
					if (error instanceof RouteNotFoundError) {
						return errors.NOT_FOUND({
							message: error.publicMessage,
							cause: error,
						});
					}

					if (error instanceof RouteOwnershipError) {
						return errors.FORBIDDEN({
							message: error.publicMessage,
							cause: error,
						});
					}

					if (error instanceof GpxParseError) {
						return errors.INVALID_GPX({
							message: error.publicMessage,
							cause: error,
						});
					}

					if (error instanceof RoutingEngineError) {
						return errors.ROUTING_ENGINE_ERROR({
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
