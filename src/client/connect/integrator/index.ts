import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
import { call } from "../../call.js";
import type { IntegratorResponse } from "../types.js";

export type { IntegratorResponse } from "../types.js";

export function integratorMethods(doer: Doer, connectSecret: string) {
  return {
    getIntegrator(session: Session, signal?: AbortSignal): Promise<IntegratorResponse> {
      return call<IntegratorResponse>(doer, {
        method: "GET",
        path: "/v1/connect-integrators",
        session,
        requireTrack: Track.Connect,
        connectSecret,
        signal,
      });
    },
  };
}
