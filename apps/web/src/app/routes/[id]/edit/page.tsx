import EditRouteForm from "@/components/routes/edit-route-form";
import { requireSession } from "@/lib/require-session";

export default async function EditRoutePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	await requireSession();
	const { id } = await params;

	return <EditRouteForm routeId={id} />;
}
