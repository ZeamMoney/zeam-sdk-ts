// import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
// import { call } from "../../call.js";
// import type { PlatformHealthResponse } from "../types.js";

export type { PlatformHealthResponse } from "../types.js";

export function platformMethods(_doer: Doer, _connectSecret: string) {
  return {
    // DISABLED: GET /v1/connect-platform/health returns 404 —
    // Gateway proxies to /platform/health but Connect serves /healthz.
    // Works via localhost port-forward at GET /healthz.
    // Uncomment once the gateway handler is fixed to target /healthz.
    //
    // getPlatformHealth(session: Session, signal?: AbortSignal): Promise<PlatformHealthResponse> {
    //   return call<PlatformHealthResponse>(_doer, {
    //     method: "GET",
    //     path: "/v1/connect-platform/health",
    //     session,
    //     requireTrack: Track.Connect,
    //     connectSecret: _connectSecret,
    //     signal,
    //   });
    // },
  };
}
