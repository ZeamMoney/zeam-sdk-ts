import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
import { call } from "../../call.js";

export type WebhookStatus = "pending_verification" | "active" | "paused" | "disabled" | "revoked";

export interface Webhook {
  id: string;
  applicationId: string;
  url: string;
  webhookMethod: "POST" | "PUT";
  description?: string | null;
  authScheme: "none" | "bearer" | "hmac";
  status: WebhookStatus;
  failureCount: number;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  createdBy: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddWebhookInput {
  url: string;
  webhookMethod: "POST" | "PUT";
  authScheme: "none" | "bearer" | "hmac";
  description?: string;
}

export interface UpdateWebhookInput {
  url?: string;
  webhookMethod?: "POST" | "PUT";
  description?: string | null;
  status?: WebhookStatus;
}

export interface RotateWebhookSecretResponse {
  webhookId: string;
  secret: string;
  last4: string;
}

export interface AddWebhookResponse {
  webhook: Webhook;
  secret: RotateWebhookSecretResponse;
}

export function webhookMethods(doer: Doer) {
  return {
    listWebhooks(
      session: Session,
      id: string,
      signal?: AbortSignal,
    ): Promise<Webhook[]> {
      return call<Webhook[]>(doer, {
        method: "GET",
        path: `/v1/application/${encodeURIComponent(id)}/webhook`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    addWebhook(
      session: Session,
      id: string,
      input: AddWebhookInput,
      signal?: AbortSignal,
    ): Promise<AddWebhookResponse> {
      return call<AddWebhookResponse>(doer, {
        method: "POST",
        path: `/v1/application/${encodeURIComponent(id)}/webhook`,
        session,
        requireTrack: Track.Business,
        body: input,
        signal,
      });
    },

    updateWebhook(
      session: Session,
      id: string,
      webhookId: string,
      input: UpdateWebhookInput,
      signal?: AbortSignal,
    ): Promise<Webhook> {
      return call<Webhook>(doer, {
        method: "PATCH",
        path: `/v1/application/${encodeURIComponent(id)}/webhook/${encodeURIComponent(webhookId)}`,
        session,
        requireTrack: Track.Business,
        body: input,
        signal,
      });
    },

    deleteWebhook(
      session: Session,
      id: string,
      webhookId: string,
      signal?: AbortSignal,
    ): Promise<void> {
      return call(doer, {
        method: "DELETE",
        path: `/v1/application/${encodeURIComponent(id)}/webhook/${encodeURIComponent(webhookId)}`,
        session,
        requireTrack: Track.Business,
        signal,
      }).then(() => undefined);
    },

    rotateWebhookSecret(
      session: Session,
      id: string,
      webhookId: string,
      signal?: AbortSignal,
    ): Promise<RotateWebhookSecretResponse> {
      return call<RotateWebhookSecretResponse>(doer, {
        method: "POST",
        path: `/v1/application/${encodeURIComponent(id)}/webhook/${encodeURIComponent(webhookId)}/rotate-secret`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },
  };
}
