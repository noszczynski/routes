import { Effect } from "effect";

import { protectedProcedure } from "../../../index";
import { DatabaseError } from "../../db/errors";
import { getStatus } from "../service";

export const getStravaStatusProcedure = protectedProcedure
	.errors({
		INTERNAL_SERVER_ERROR: {},
	})
	.handler(async ({ context, errors }) => {
		return await Effect.runPromise(
			getStatus(context.session.user.id).pipe(
				Effect.mapError((error) => {
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
