import { Effect } from "effect";

import { protectedProcedure } from "../../../index";
import { DatabaseError } from "../../db/errors";
import {
	GpxParseError,
	RouteNotFoundError,
	RouteOwnershipError,
	RouteVersionLimitReachedError,
	RouteVersionNotFoundError,
	RoutingEngineError,
	RoutingEngineNotConfiguredError,
} from "../errors";
import { RecalculateRouteInputSchema } from "../schemas";
import { recalculateRoute } from "../service";

const getErrorMessage = (error: unknown) => {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "string") {
		return error;
	}

	if (typeof error === "object" && error !== null && "message" in error) {
		const message = (error as { message?: unknown }).message;
		return typeof message === "string" ? message : undefined;
	}

	return undefined;
};

const getErrorCode = (error: unknown) => {
	if (typeof error === "object" && error !== null && "code" in error) {
		const code = (error as { code?: unknown }).code;
		return typeof code === "string" ? code : undefined;
	}

	return undefined;
};

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
		ROUTING_ENGINE_NOT_CONFIGURED: {
			status: 503,
			message: "Przeliczanie trasy jest chwilowo niedostępne",
		},
		ROUTING_ENGINE_TIMEOUT: {
			status: 504,
			message: "Przekroczono czas oczekiwania na odpowiedź silnika routingu",
		},
		SOURCE_GPX_NOT_FOUND: {
			status: 409,
			message: "Brakuje źródłowego pliku GPX tej wersji trasy",
		},
		VERSION_NOT_FOUND: {
			status: 404,
			message: "Brak aktywnej wersji trasy",
		},
		VERSION_LIMIT_REACHED: {
			status: 409,
			message: "Osiągnięto limit wersji trasy",
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
				confirmDeleteOldest: input.confirmDeleteOldest,
			}).pipe(
				Effect.mapError((error) => {
					if (error instanceof RouteNotFoundError) {
						return errors.NOT_FOUND({
							message: error.publicMessage,
						});
					}

					if (error instanceof RouteOwnershipError) {
						return errors.FORBIDDEN({
							message: error.publicMessage,
						});
					}

					if (error instanceof GpxParseError) {
						const causeCode = getErrorCode(error.cause);
						if (causeCode === "ENOENT") {
							return errors.SOURCE_GPX_NOT_FOUND({
								message: "Nie znaleziono pliku GPX aktywnej wersji trasy",
							});
						}

						return errors.INVALID_GPX({
							message: error.publicMessage,
						});
					}

					if (error instanceof RoutingEngineError) {
						const causeMessage = getErrorMessage(error.cause)?.toLowerCase() ?? "";
						if (
							causeMessage.includes("aborted") ||
							causeMessage.includes("timeout")
						) {
							return errors.ROUTING_ENGINE_TIMEOUT({
								message: "Silnik routingu nie odpowiedział w wymaganym czasie",
							});
						}

						return errors.ROUTING_ENGINE_ERROR({
							message: error.publicMessage,
						});
					}

					if (error instanceof RoutingEngineNotConfiguredError) {
						return errors.ROUTING_ENGINE_NOT_CONFIGURED({
							message: error.publicMessage,
						});
					}

					if (error instanceof RouteVersionNotFoundError) {
						return errors.VERSION_NOT_FOUND({
							message: error.publicMessage,
						});
					}

					if (error instanceof RouteVersionLimitReachedError) {
						return errors.VERSION_LIMIT_REACHED({
							message: error.publicMessage,
						});
					}

					if (error instanceof DatabaseError) {
						return errors.INTERNAL_SERVER_ERROR({
							message: error.publicMessage,
						});
					}

					return errors.INTERNAL_SERVER_ERROR({
						message:
							getErrorMessage(error) ??
							"Wystąpił nieoczekiwany błąd podczas przeliczania trasy",
					});
				}),
			),
		);
	});
