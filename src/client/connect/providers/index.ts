// import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
// import { call } from "../../call.js";
// import type { PaymentProviderResponse } from "../types.js";

export type { PaymentProviderResponse } from "../types.js";

export function providerMethods(_doer: Doer, _connectSecret: string) {
  return {
    // DISABLED: GET /v1/connect-providers returns 403 due to
    // unregistered 'Yoyo' value in the InternalProviderName enum.
    // Same root cause as the Routes pod crash.
    // Uncomment once the Connect service fixes the Yoyo enum/DB row.
    //
    // listProviders(session: Session, signal?: AbortSignal): Promise<PaymentProviderResponse[]> {
    //   return call<PaymentProviderResponse[]>(_doer, {
    //     method: "GET",
    //     path: "/v1/connect-providers",
    //     session,
    //     requireTrack: Track.Connect,
    //     connectSecret: _connectSecret,
    //     signal,
    //   });
    // },
    //
    // getProvider(session: Session, id: string, signal?: AbortSignal): Promise<PaymentProviderResponse> {
    //   return call<PaymentProviderResponse>(_doer, {
    //     method: "GET",
    //     path: `/v1/connect-providers/${encodeURIComponent(id)}`,
    //     session,
    //     requireTrack: Track.Connect,
    //     connectSecret: _connectSecret,
    //     signal,
    //   });
    // },
  };
}
