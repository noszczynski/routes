import { connectStravaProcedure } from "../features/strava/procedures/connect-strava.procedure";
import { getStravaStatusProcedure } from "../features/strava/procedures/get-strava-status.procedure";
import { importStravaRoutesProcedure } from "../features/strava/procedures/import-strava-routes.procedure";

export const stravaRouter = {
	connectStrava: connectStravaProcedure,
	getStatus: getStravaStatusProcedure,
	importStravaRoutes: importStravaRoutesProcedure,
};
