import type { Session } from "../auth/index.js";
import type { Client } from "../client.js";
import { ApplicationClient } from "../client/application/index.js";

/**
 * Credentials that `POST /v1/application` returns exactly once.
 * Partners MUST persist every field via their secret manager BEFORE the
 * callback returns — the SDK zeros them immediately after.
 */
export interface OneTimeSecrets {
  stellarSeed: string;
  stellarPublicKey: string;
  connectSecret: string;
  apiKey: string;
  webhookSecret: string;
  webhookId: string;
}

export interface RegisterAppInput {
  session: Session;
  /** Shape is upstream-owned; forwarded through the gateway unchanged. */
  payload: unknown;
  captureOneTimeSecrets: (secrets: OneTimeSecrets) => Promise<void> | void;
  signal?: AbortSignal;
}

/** Safe-to-log fields returned after the secrets have been captured. */
export interface RegisterAppResult {
  integratorId: string;
  application: unknown;
  stellarPublicKey: string;
  apiKeyId: string;
  apiKeyLast4: string;
  webhookId: string;
  webhookLast4: string;
  warnings: string[];
}

/**
 * Register an integrator application and hand the one-time secrets to
 * the partner callback. The secrets are zeroed immediately after — if
 * the callback throws, the SDK surfaces the error so the caller knows
 * the credentials were minted but not captured and must rotate.
 */
export async function registerApplication(
  client: Client,
  input: RegisterAppInput,
): Promise<RegisterAppResult> {
  if (!input.session) throw new Error("recipes: session is required");
  if (!input.captureOneTimeSecrets) {
    throw new Error("recipes: captureOneTimeSecrets callback is required");
  }

  const app = new ApplicationClient(client);
  const resp = await app.register(input.session, input.payload, input.signal);

  const secrets: OneTimeSecrets = {
    stellarSeed: resp.stellar.secret,
    stellarPublicKey: resp.stellar.publicKey,
    connectSecret: resp.connectSecret,
    apiKey: resp.apiKey.secret,
    webhookSecret: resp.webhookSecret.secret,
    webhookId: resp.webhookSecret.webhookId,
  };

  try {
    await input.captureOneTimeSecrets(secrets);
  } finally {
    // Zero the in-memory copies regardless of capture outcome.
    secrets.stellarSeed = "";
    secrets.connectSecret = "";
    secrets.apiKey = "";
    secrets.webhookSecret = "";
    resp.stellar.secret = "";
    resp.connectSecret = "";
    resp.apiKey.secret = "";
    resp.webhookSecret.secret = "";
  }

  return {
    integratorId: resp.integratorId,
    application: resp.application,
    stellarPublicKey: resp.stellar.publicKey,
    apiKeyId: resp.apiKey.keyId,
    apiKeyLast4: resp.apiKey.last4,
    webhookId: resp.webhookSecret.webhookId,
    webhookLast4: resp.webhookSecret.last4,
    warnings: resp.warnings ?? [],
  };
}
