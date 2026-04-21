import { Effect } from "effect";

import { protectedProcedure } from "../../../index";
import { DatabaseError } from "../../db/errors";
import { RouteNotFoundError, RouteOwnershipError } from "../errors";
import { ListRouteVersionsInputSchema } from "../schemas";
import { listRouteVersions } from "../service";

export const listRouteVersionsProcedure = protectedProcedure
	.input(ListRouteVersionsInputSchema)
	.errors({
		NOT_FOUND: {
			status: 404,
			message: "Trasa nie została znaleziona",
		},
		FORBIDDEN: {
			status: 403,
			message: "Nie możesz zarządzać wersjami tej trasy",
		},
		INTERNAL_SERVER_ERROR: {},
	})
	.handler(async ({ input, context, errors }) => {
		return await Effect.runPromise(
			listRouteVersions({
				routeId: input.routeId,
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
