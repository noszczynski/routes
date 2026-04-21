import { requireSession } from "@/lib/require-session";

import Dashboard from "./dashboard";

export default async function DashboardPage() {
	const session = await requireSession();

	return (
		<Dashboard session={session} />
	);
}
