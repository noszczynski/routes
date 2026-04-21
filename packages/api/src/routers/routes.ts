import { addRouteCommentProcedure } from "../features/routes/procedures/add-route-comment.procedure";
import { createRouteProcedure } from "../features/routes/procedures/create-route.procedure";
import { deleteRouteProcedure } from "../features/routes/procedures/delete-route.procedure";
import { getRouteProcedure } from "../features/routes/procedures/get-route.procedure";
import { listRoutesProcedure } from "../features/routes/procedures/list-routes.procedure";
import { recalculateRouteProcedure } from "../features/routes/procedures/recalculate-route.procedure";
import { rateRouteProcedure } from "../features/routes/procedures/rate-route.procedure";
import { updateRoutePrivacyProcedure } from "../features/routes/procedures/update-route-privacy.procedure";

export const routesRouter: {
	addRouteComment: typeof addRouteCommentProcedure;
	createRoute: typeof createRouteProcedure;
	deleteRoute: typeof deleteRouteProcedure;
	getRoute: typeof getRouteProcedure;
	listRoutes: typeof listRoutesProcedure;
	recalculateRoute: typeof recalculateRouteProcedure;
	rateRoute: typeof rateRouteProcedure;
	updateRoutePrivacy: typeof updateRoutePrivacyProcedure;
} = {
	addRouteComment: addRouteCommentProcedure,
	createRoute: createRouteProcedure,
	deleteRoute: deleteRouteProcedure,
	getRoute: getRouteProcedure,
	listRoutes: listRoutesProcedure,
	recalculateRoute: recalculateRouteProcedure,
	rateRoute: rateRouteProcedure,
	updateRoutePrivacy: updateRoutePrivacyProcedure,
};
