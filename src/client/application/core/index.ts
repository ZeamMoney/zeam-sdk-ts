import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
import { call } from "../../call.js";

export type ApplicationStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "suspended"
  | "revoked";

export interface ApplicationRecord {
  id: string;
  associationId: string;
  applicationName: string;
  classificationCode: string;
  publicKey?: string | null;
  connectIntegratorId?: string | null;
  environment: string;
  status: ApplicationStatus;
  activated: boolean;
  expiresAt?: string | null;
  idpAuthId?: string | null;
  settlementAccountPublicKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationEvent {
  id: string;
  applicationId?: string;
  actorUserId?: string;
  actorIp?: string;
  userAgent?: string;
  eventType: string;
  outcome: string;
  metadata: Record<string, unknown>;
  reason?: string;
  createdAt: string;
}

export interface SettlementAccount {
  publicKey: string;
  vaultId: string;
}

export interface ProvisionApplicationInput {
  associationId: string;
  applicationName: string;
  expiresAt?: string;
}

export interface RegisterApplicationInput {
  associationId: string;
  applicationName: string;
  webhookUrl: string;
  webhookMethod?: "POST" | "PUT";
  settlementAccount?: SettlementAccount;
  expiresAt?: string;
  classificationCode?: string;
  publicKey?: string;
  stellarSeedVaultId?: string;
  environment?: "sandbox" | "production";
}

export interface ActivateApplicationInput {
  webhookUrl: string;
  webhookMethod?: "POST" | "PUT";
  settlementAccount?: SettlementAccount;
}

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

export interface RegistrationResponse {
  application: ApplicationRecord;
  integratorId: string;
  stellar: StellarMaterial;
  apiKey: APIKeyMaterial;
  webhookSecret?: WebhookSecretMaterial;
  connectSecret: string;
  idpAuthId: string;
  warnings?: string[];
}

export function coreMethods(doer: Doer) {
  return {
    listApplications(
      session: Session,
      associationId: string,
      signal?: AbortSignal,
    ): Promise<ApplicationRecord[]> {
      return call<ApplicationRecord[]>(doer, {
        method: "GET",
        path: `/v1/applications/${encodeURIComponent(associationId)}`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    lookup(
      session: Session,
      publicKey: string,
      signal?: AbortSignal,
    ): Promise<ApplicationRecord> {
      const q = new URLSearchParams({ publicKey });
      return call<ApplicationRecord>(doer, {
        method: "GET",
        path: "/v1/application/lookup",
        query: q,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    getApplication(
      session: Session,
      id: string,
      signal?: AbortSignal,
    ): Promise<ApplicationRecord> {
      return call<ApplicationRecord>(doer, {
        method: "GET",
        path: `/v1/application/${encodeURIComponent(id)}`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    getApplicationEvents(
      session: Session,
      id: string,
      signal?: AbortSignal,
    ): Promise<ApplicationEvent[]> {
      return call<ApplicationEvent[]>(doer, {
        method: "GET",
        path: `/v1/application/${encodeURIComponent(id)}/event`,
        session,
        requireTrack: Track.Business,
        signal,
      });
    },

    provision(
      session: Session,
      input: ProvisionApplicationInput,
      signal?: AbortSignal,
    ): Promise<ApplicationRecord> {
      return call<ApplicationRecord>(doer, {
        method: "POST",
        path: "/v1/application/provision",
        session,
        requireTrack: Track.Business,
        body: input,
        signal,
      });
    },

    async register(
      session: Session,
      payload: RegisterApplicationInput,
      signal?: AbortSignal,
    ): Promise<RegistrationResponse> {
      const resp = await call<RegistrationResponse>(doer, {
        method: "POST",
        path: "/v1/application",
        session,
        requireTrack: Track.Business,
        body: payload,
        signal,
      });
      if (!resp.connectSecret || !resp.stellar?.secret || !resp.webhookSecret) {
        throw new Error(
          "application: registration response missing one-time credentials — partner will not be able to call Connect",
        );
      }
      return resp;
    },

    async activate(
      session: Session,
      id: string,
      input: ActivateApplicationInput,
      signal?: AbortSignal,
    ): Promise<RegistrationResponse> {
      const resp = await call<RegistrationResponse>(doer, {
        method: "POST",
        path: `/v1/application/${encodeURIComponent(id)}/activate`,
        session,
        requireTrack: Track.Business,
        body: input,
        signal,
      });
      if (!resp.connectSecret || !resp.stellar?.secret) {
        throw new Error(
          "application: activate response missing one-time credentials — partner will not be able to call Connect",
        );
      }
      return resp;
    },
  };
}
