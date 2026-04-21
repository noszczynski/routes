import { Data } from "effect";

export class RouteNotFoundError extends Data.TaggedError("RouteNotFoundError")<{
	routeId: string;
}> {
	get publicMessage() {
		return `Trasa o ID ${this.routeId} nie została znaleziona`;
	}
}

export class RouteOwnershipError extends Data.TaggedError(
	"RouteOwnershipError",
)<{}> {
	get publicMessage() {
		return "Nie masz uprawnień do tej trasy";
	}
}

export class GpxParseError extends Data.TaggedError("GpxParseError")<{
	cause: unknown;
}> {
	get publicMessage() {
		return "Nie udało się odczytać pliku GPX";
	}
}

export class RouteCommentParentNotFoundError extends Data.TaggedError(
	"RouteCommentParentNotFoundError",
)<{}> {
	get publicMessage() {
		return "Komentarz nadrzędny nie istnieje";
	}
}

export class RouteCommentParentMismatchError extends Data.TaggedError(
	"RouteCommentParentMismatchError",
)<{}> {
	get publicMessage() {
		return "Nieprawidłowy komentarz nadrzędny dla tej trasy";
	}
}

export class RoutingEngineError extends Data.TaggedError("RoutingEngineError")<{
	cause: unknown;
}> {
	get publicMessage() {
		return "Nie udało się przeliczyć trasy po drogach";
	}
}
