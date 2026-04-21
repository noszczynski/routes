import { Effect } from "effect";

import { protectedProcedure } from "../../../index";
import { DatabaseError } from "../../db/errors";
import {
	GpxParseError,
	RouteNotFoundError,
	RouteOwnershipError,
	RouteVersionLimitReachedError,
} from "../errors";
import { UploadRouteVersionGpxInputSchema } from "../schemas";
import { uploadRouteVersionGpx } from "../service";

export const uploadRouteVersionGpxProcedure = protectedProcedure
	.input(UploadRouteVersionGpxInputSchema)
	.errors({
		NOT_FOUND: {
			status: 404,
			message: "Trasa nie została znaleziona",
		},
		FORBIDDEN: {
			status: 403,
			message: "Nie możesz zarządzać wersjami tej trasy",
		},
		INVALID_GPX: {
			status: 422,
			message: "Nieprawidłowy plik GPX",
		},
		VERSION_LIMIT_REACHED: {
			status: 409,
			message: "Osiągnięto limit wersji trasy",
		},
		INTERNAL_SERVER_ERROR: {},
	})
	.handler(async ({ input, context, errors }) => {
		return await Effect.runPromise(
			uploadRouteVersionGpx({
				routeId: input.routeId,
				userId: context.session.user.id,
				gpxContent: input.gpxContent,
				originalFileName: input.originalFileName,
				confirmDeleteOldest: input.confirmDeleteOldest,
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

					if (error instanceof RouteVersionLimitReachedError) {
						return errors.VERSION_LIMIT_REACHED({
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
