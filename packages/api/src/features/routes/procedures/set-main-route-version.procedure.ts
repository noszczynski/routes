import { Effect } from "effect";

import { protectedProcedure } from "../../../index";
import { DatabaseError } from "../../db/errors";
import {
	RouteNotFoundError,
	RouteOwnershipError,
	RouteVersionNotFoundError,
} from "../errors";
import { SetMainRouteVersionInputSchema } from "../schemas";
import { setMainRouteVersion } from "../service";

export const setMainRouteVersionProcedure = protectedProcedure
	.input(SetMainRouteVersionInputSchema)
	.errors({
		NOT_FOUND: {
			status: 404,
			message: "Trasa nie została znaleziona",
		},
		VERSION_NOT_FOUND: {
			status: 404,
			message: "Wersja trasy nie została znaleziona",
		},
		FORBIDDEN: {
			status: 403,
			message: "Nie możesz zarządzać wersjami tej trasy",
		},
		INTERNAL_SERVER_ERROR: {},
	})
	.handler(async ({ input, context, errors }) => {
		return await Effect.runPromise(
			setMainRouteVersion({
				routeId: input.routeId,
				versionId: input.versionId,
				userId: context.session.user.id,
			}).pipe(
				Effect.mapError((error) => {
					if (error instanceof RouteNotFoundError) {
						return errors.NOT_FOUND({
							message: error.publicMessage,
							cause: error,
						});
					}

					if (error instanceof RouteVersionNotFoundError) {
						return errors.VERSION_NOT_FOUND({
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
