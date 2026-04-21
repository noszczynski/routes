import StravaCallback from "@/components/strava/strava-callback";
import { requireSession } from "@/lib/require-session";

export default async function StravaCallbackPage({
	searchParams,
}: {
	searchParams: Promise<{ code?: string }>;
}) {
	await requireSession();

	const { code } = await searchParams;

	return <StravaCallback code={code} />;
}
