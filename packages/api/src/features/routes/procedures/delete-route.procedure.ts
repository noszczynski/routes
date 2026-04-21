import { Effect } from "effect";

import { protectedProcedure } from "../../../index";
import { DatabaseError } from "../../db/errors";
import { RouteNotFoundError, RouteOwnershipError } from "../errors";
import { DeleteRouteInputSchema } from "../schemas";
import { deleteRoute } from "../service";

export const deleteRouteProcedure = protectedProcedure
	.input(DeleteRouteInputSchema)
	.errors({
		NOT_FOUND: {
			status: 404,
			message: "Trasa nie została znaleziona",
		},
		FORBIDDEN: {
			status: 403,
			message: "Nie możesz usunąć tej trasy",
		},
		INTERNAL_SERVER_ERROR: {},
	})
	.handler(async ({ input, context, errors }) => {
		return await Effect.runPromise(
			deleteRoute({
				routeId: input.id,
				userId: context.session.user.id,
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
