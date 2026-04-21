import StravaPanel from "@/components/strava/strava-panel";
import { requireSession } from "@/lib/require-session";
import { env } from "@routes/env/server";

export default async function StravaPage() {
	await requireSession();

	const redirectUri = env.STRAVA_REDIRECT_URI;
	const hasValidRedirectUri = (() => {
		if (!redirectUri) {
			return false;
		}

		try {
			new URL(redirectUri);
			return true;
		} catch {
			return false;
		}
	})();

	const configured = Boolean(
		env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET && hasValidRedirectUri,
	);

	return (
		<StravaPanel
			configured={configured}
			clientId={env.STRAVA_CLIENT_ID}
			redirectUri={hasValidRedirectUri ? redirectUri : undefined}
		/>
	);
}
