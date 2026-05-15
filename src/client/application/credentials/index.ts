import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
import { call } from "../../call.js";

export interface RotateCredentialResponse {
  keyId: string;
  secret: string;
  last4: string;
}

// Shape is unknown — endpoint returns 501 until the backend SignerStore is wired.
export interface TokenSmokeTestResponse {
  success?: boolean;
  token?: string;
}

export function credentialMethods(doer: Doer) {
  return {
    rotateCredential(
      session: Session,
      id: string,
      signal?: AbortSignal,
    ): Promise<RotateCredentialResponse> {
      return call<RotateCredentialResponse>(doer, {
        method: "POST",
        path: `/v1/application/${encodeURIComponent(id)}/rotate-credential`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    tokenSmokeTest(
      session: Session,
      id: string,
      signal?: AbortSignal,
    ): Promise<TokenSmokeTestResponse> {
      return call<TokenSmokeTestResponse>(doer, {
        method: "POST",
        path: `/v1/application/${encodeURIComponent(id)}/token`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },
  };
}
