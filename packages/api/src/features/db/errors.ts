import { Data } from "effect";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
	cause: unknown;
}> {
	get publicMessage() {
		return "Wystąpił błąd podczas komunikacji z bazą danych";
	}
}
