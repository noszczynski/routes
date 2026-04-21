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
