import { Track, type Session } from "../../auth/index.js";
import type { Doer } from "../../client.js";
import { call } from "../call.js";

export interface StellarMaterial {
  publicKey: string;
  secret: string;
  vaultId: string;
}

export interface APIKeyMaterial {
  keyId: string;
  secret: string;
  last4: string;
}

export interface WebhookSecretMaterial {
  webhookId: string;
  secret: string;
  last4: string;
}

/**
 * Shape of POST /v1/application. ALL fields marked "one-time only" in
 * `docs/CLI_AUTH_FLOWS.md §4` are captured here. The SDK never persists
 * these — partners MUST capture them inside
 * `recipes.registerApplication`'s `captureOneTimeSecrets` callback.
 */
export interface RegistrationResponse {
  application: unknown;
  integratorId: string;
  stellar: StellarMaterial;
  apiKey: APIKeyMaterial;
  webhookSecret: WebhookSecretMaterial;
  connectSecret: string;
  idpAuthId?: string;
  warnings?: string[];
}

export interface RotateCredentialResponse {
  apiKey: APIKeyMaterial;
}

export interface RotateWebhookSecretResponse {
  webhookSecret: WebhookSecretMaterial;
}

/**
 * Wraps `/v1/application/*`. The registration call is the single most
 * sensitive call in the SDK — the callback wrapper in
 * `recipes.registerApplication` is the intended entry point for
 * partners.
 */
export class ApplicationClient {
  constructor(private doer: Doer) {}

  async register(
    session: Session,
    payload: unknown,
    signal?: AbortSignal,
  ): Promise<RegistrationResponse> {
    const resp = await call<RegistrationResponse>(this.doer, {
      method: "POST",
      path: "/v1/application",
      session,
      requireTrack: Track.Business,
      body: payload,
      signal,
    });
    if (!resp.connectSecret || !resp.stellar?.secret) {
      throw new Error(
        "application: registration response missing one-time credentials — partner will not be able to call Connect",
      );
    }
    return resp;
  }

  rotateCredential(
    session: Session,
    id: string,
    signal?: AbortSignal,
  ): Promise<RotateCredentialResponse> {
    return call<RotateCredentialResponse>(this.doer, {
      method: "POST",
      path: `/v1/application/${encodeURIComponent(id)}/rotate-credential`,
      session,
      requireTrack: Track.Business,
      signal,
    });
  }

  rotateWebhookSecret(
    session: Session,
    id: string,
    webhookId: string,
    signal?: AbortSignal,
  ): Promise<RotateWebhookSecretResponse> {
    return call<RotateWebhookSecretResponse>(this.doer, {
      method: "POST",
      path: `/v1/application/${encodeURIComponent(id)}/webhook/${encodeURIComponent(
        webhookId,
      )}/rotate-secret`,
      session,
      requireTrack: Track.Business,
      signal,
    });
  }
}
