import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
import { call } from "../../call.js";
import type {
  // OnRampCashInRequest,
  // OnRampCashInResponse,
  OnRampRequest,
  OnRampResponse,
} from "../types.js";

export type {
  OnRampCashInRequest,
  OnRampCashInResponse,
  OnRampRequest,
  OnRampResponse,
} from "../types.js";

export function onRampMethods(doer: Doer, connectSecret: string) {
  return {
    executeOnRamp(
      session: Session,
      input: OnRampRequest,
      signal?: AbortSignal,
    ): Promise<OnRampResponse> {
      return call<OnRampResponse>(doer, {
        method: "POST",
        path: "/v1/connect-onramp",
        session,
        requireTrack: Track.Connect,
        connectSecret,
        body: input,
        signal,
      });
    },

    // DISABLED: POST /v1/connect-onramp/cash-in returns 403 —
    // MediatR handler for OnRampCashInCommand not registered (DI bug).
    // Uncomment once the Connect service registers the handler.
    //
    // onRampCashIn(
    //   session: Session,
    //   input: OnRampCashInRequest,
    //   signal?: AbortSignal,
    // ): Promise<OnRampCashInResponse> {
    //   return call<OnRampCashInResponse>(doer, {
    //     method: "POST",
    //     path: "/v1/connect-onramp/cash-in",
    //     session,
    //     requireTrack: Track.Connect,
    //     connectSecret,
    //     body: input,
    //     signal,
    //   });
    // },
  };
}
