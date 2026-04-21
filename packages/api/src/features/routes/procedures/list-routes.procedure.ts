import { Effect } from "effect";

import { publicProcedure } from "../../../index";
import { DatabaseError } from "../../db/errors";
import { ListRoutesInputSchema } from "../schemas";
import { listRoutes } from "../service";

export const listRoutesProcedure = publicProcedure
	.input(ListRoutesInputSchema)
	.errors({
		UNAUTHORIZED: {
			status: 401,
			message: "Ta akcja wymaga zalogowania",
		},
		INTERNAL_SERVER_ERROR: {},
	})
	.handler(async ({ input, context, errors }) => {
		if (input.mine && !context.session?.user) {
			throw errors.UNAUTHORIZED();
		}

		return await Effect.runPromise(
			listRoutes({
				bbox: input.bbox,
				filters: input.filters,
				mine: input.mine,
				userId: context.session?.user?.id,
			}).pipe(
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
