import CreateRouteForm from "@/components/routes/create-route-form";
import { requireSession } from "@/lib/require-session";

export default async function NewRoutePage() {
	await requireSession();

	return <CreateRouteForm />;
}
