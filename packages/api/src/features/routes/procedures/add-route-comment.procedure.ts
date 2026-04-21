import { Effect } from "effect";

import { protectedProcedure } from "../../../index";
import { DatabaseError } from "../../db/errors";
import {
	RouteCommentParentMismatchError,
	RouteCommentParentNotFoundError,
	RouteNotFoundError,
} from "../errors";
import { AddRouteCommentInputSchema } from "../schemas";
import { addRouteComment } from "../service";

export const addRouteCommentProcedure = protectedProcedure
	.input(AddRouteCommentInputSchema)
	.errors({
		NOT_FOUND: {
			status: 404,
			message: "Trasa nie została znaleziona",
		},
		INVALID_PARENT_COMMENT: {
			status: 422,
			message: "Nieprawidłowy komentarz nadrzędny",
		},
		INTERNAL_SERVER_ERROR: {},
	})
	.handler(async ({ input, context, errors }) => {
		return await Effect.runPromise(
			addRouteComment({
				routeId: input.routeId,
				userId: context.session.user.id,
				content: input.content,
				parentCommentId: input.parentCommentId,
			}).pipe(
				Effect.mapError((error) => {
					if (error instanceof RouteNotFoundError) {
						return errors.NOT_FOUND({
							message: error.publicMessage,
							cause: error,
						});
					}

					if (
						error instanceof RouteCommentParentNotFoundError ||
						error instanceof RouteCommentParentMismatchError
					) {
						return errors.INVALID_PARENT_COMMENT({
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
