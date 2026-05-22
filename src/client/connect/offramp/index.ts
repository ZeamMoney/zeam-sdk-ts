import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
import { call } from "../../call.js";
import type { ExecuteRequest, ExecuteResponse, OffRampRequest, OffRampResponse } from "../types.js";

export type { ExecuteRequest, ExecuteResponse, OffRampRequest, OffRampResponse } from "../types.js";

export function offRampMethods(doer: Doer, connectSecret: string) {
  return {
    /**
     * POST /v1/connect-execute — gateway-rewritten offramp lane.
     * Body format is determined by the gateway's body transformation.
     */
    execute(
      session: Session,
      input: ExecuteRequest,
      signal?: AbortSignal,
    ): Promise<ExecuteResponse> {
      return call<ExecuteResponse>(doer, {
        method: "POST",
        path: "/v1/connect-execute",
        session,
        requireTrack: Track.Connect,
        connectSecret,
        body: input,
        signal,
      });
    },

    /** POST /v1/connect-offramp → direct offramp with full OffRampRequest. */
    executeOffRamp(
      session: Session,
      input: OffRampRequest,
      signal?: AbortSignal,
    ): Promise<OffRampResponse> {
      return call<OffRampResponse>(doer, {
        method: "POST",
        path: "/v1/connect-offramp",
        session,
        requireTrack: Track.Connect,
        connectSecret,
        body: input,
        signal,
      });
    },
  };
}
