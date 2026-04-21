import { addRouteCommentProcedure } from "../features/routes/procedures/add-route-comment.procedure";
import { createRouteProcedure } from "../features/routes/procedures/create-route.procedure";
import { deleteRouteProcedure } from "../features/routes/procedures/delete-route.procedure";
import { getRouteProcedure } from "../features/routes/procedures/get-route.procedure";
import { listRouteVersionsProcedure } from "../features/routes/procedures/list-route-versions.procedure";
import { listRoutesProcedure } from "../features/routes/procedures/list-routes.procedure";
import { rateRouteProcedure } from "../features/routes/procedures/rate-route.procedure";
import { recalculateRouteProcedure } from "../features/routes/procedures/recalculate-route.procedure";
import { setMainRouteVersionProcedure } from "../features/routes/procedures/set-main-route-version.procedure";
import { updateRoutePrivacyProcedure } from "../features/routes/procedures/update-route-privacy.procedure";
import { uploadRouteVersionGpxProcedure } from "../features/routes/procedures/upload-route-version-gpx.procedure";

export const routesRouter: {
	addRouteComment: typeof addRouteCommentProcedure;
	createRoute: typeof createRouteProcedure;
	deleteRoute: typeof deleteRouteProcedure;
	getRoute: typeof getRouteProcedure;
	listRoutes: typeof listRoutesProcedure;
	listRouteVersions: typeof listRouteVersionsProcedure;
	recalculateRoute: typeof recalculateRouteProcedure;
	rateRoute: typeof rateRouteProcedure;
	setMainRouteVersion: typeof setMainRouteVersionProcedure;
	uploadRouteVersionGpx: typeof uploadRouteVersionGpxProcedure;
	updateRoutePrivacy: typeof updateRoutePrivacyProcedure;
} = {
	addRouteComment: addRouteCommentProcedure,
	createRoute: createRouteProcedure,
	deleteRoute: deleteRouteProcedure,
	getRoute: getRouteProcedure,
	listRoutes: listRoutesProcedure,
	listRouteVersions: listRouteVersionsProcedure,
	recalculateRoute: recalculateRouteProcedure,
	rateRoute: rateRouteProcedure,
	setMainRouteVersion: setMainRouteVersionProcedure,
	uploadRouteVersionGpx: uploadRouteVersionGpxProcedure,
	updateRoutePrivacy: updateRoutePrivacyProcedure,
};
