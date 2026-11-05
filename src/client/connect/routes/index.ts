// import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
// import { call } from "../../call.js";
// import type { RouteResponse } from "../types.js";

export type { RouteResponse } from "../types.js";

export function routeMethods(_doer: Doer, _connectSecret: string) {
  return {
    // DISABLED: GET /v1/connect-routes crashes the Connect pod due to
    // an unregistered 'Yoyo' value in the InternalProviderName enum.
    // Uncomment once the Connect service adds Yoyo to the enum or
    // removes the stale DB row.
    //
    // listRoutes(session: Session, signal?: AbortSignal): Promise<RouteResponse[]> {
    //   return call<RouteResponse[]>(_doer, {
    //     method: "GET",
    //     path: "/v1/connect-routes",
    //     session,
    //     requireTrack: Track.Connect,
    //     connectSecret: _connectSecret,
    //     signal,
    //   });
    // },
  };
}
