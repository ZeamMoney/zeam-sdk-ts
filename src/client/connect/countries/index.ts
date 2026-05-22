import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
import { call } from "../../call.js";
import type { CountryResponse } from "../types.js";

export type { CountryResponse } from "../types.js";

export function countryMethods(doer: Doer, connectSecret: string) {
  return {
    listCountries(session: Session, signal?: AbortSignal): Promise<CountryResponse[]> {
      return call<CountryResponse[]>(doer, {
        method: "GET",
        path: "/v1/connect-countries",
        session,
        requireTrack: Track.Connect,
        connectSecret,
        signal,
      });
    },
  };
}
