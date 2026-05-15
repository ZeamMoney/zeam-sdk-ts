import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
import { call } from "../../call.js";
import type { AssetResponse } from "../types.js";

export type { AssetResponse } from "../types.js";

export function assetMethods(doer: Doer, connectSecret: string) {
  return {
    listConnectAssets(session: Session, signal?: AbortSignal): Promise<AssetResponse[]> {
      return call<AssetResponse[]>(doer, {
        method: "GET",
        path: "/v1/connect-assets",
        session,
        requireTrack: Track.Connect,
        connectSecret,
        signal,
      });
    },

    getConnectAsset(
      session: Session,
      id: string,
      signal?: AbortSignal,
    ): Promise<AssetResponse> {
      return call<AssetResponse>(doer, {
        method: "GET",
        path: `/v1/connect-assets/${encodeURIComponent(id)}`,
        session,
        requireTrack: Track.Connect,
        connectSecret,
        signal,
      });
    },
  };
}
