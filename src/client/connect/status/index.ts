import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
import { call } from "../../call.js";
import type { ConnectStatusResponse } from "../types.js";

export type { ConnectStatusResponse } from "../types.js";

export function statusMethods(doer: Doer, connectSecret: string) {
  return {
    getConnectStatus(
      session: Session,
      transactionId: string,
      signal?: AbortSignal,
    ): Promise<ConnectStatusResponse> {
      return call<ConnectStatusResponse>(doer, {
        method: "GET",
        path: `/v1/connect-status/${encodeURIComponent(transactionId)}`,
        session,
        requireTrack: Track.Connect,
        connectSecret,
        signal,
      });
    },
  };
}
