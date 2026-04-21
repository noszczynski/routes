import { Data } from "effect";

export class StravaNotConnectedError extends Data.TaggedError(
	"StravaNotConnectedError",
)<Record<string, never>> {
	get publicMessage() {
		return "Konto Strava nie jest połączone";
	}
}

export class StravaNotConfiguredError extends Data.TaggedError(
	"StravaNotConfiguredError",
)<Record<string, never>> {
	get publicMessage() {
		return "Integracja Strava nie została jeszcze skonfigurowana";
	}
}

export class StravaImportError extends Data.TaggedError("StravaImportError")<{
	cause: unknown;
}> {
	get publicMessage() {
		return "Nie udało się zaimportować tras ze Strava";
	}
}
