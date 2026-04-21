import { createRouteProcedure } from "../features/routes/procedures/create-route.procedure";
import { deleteRouteProcedure } from "../features/routes/procedures/delete-route.procedure";
import { getRouteProcedure } from "../features/routes/procedures/get-route.procedure";
import { listRoutesProcedure } from "../features/routes/procedures/list-routes.procedure";

export const routesRouter = {
	createRoute: createRouteProcedure,
	deleteRoute: deleteRouteProcedure,
	getRoute: getRouteProcedure,
	listRoutes: listRoutesProcedure,
};
