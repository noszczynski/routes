import { env } from "@routes/env/web";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: env.NEXT_PUBLIC_SERVER_URL,
});
