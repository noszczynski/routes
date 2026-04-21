import RouteDetail from "@/components/routes/route-detail";

export default async function RouteDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	return <RouteDetail routeId={id} />;
}
