import type { Session } from "../auth/index.js";
import type { Client } from "../client.js";
import { ApplicationClient } from "../client/application/index.js";

export interface RotateCredentialInput {
  session: Session;
  applicationId: string;
  /**
   * Invoked with the freshly minted API-key material. Partners MUST
   * persist the new key via their secret manager BEFORE the callback
   * returns. The old credential stays valid until the rotating window
   * closes upstream.
   */
  captureNew: (material: {
    keyId: string;
    newSecret: string;
    last4: string;
  }) => Promise<void> | void;
  signal?: AbortSignal;
}

/**
 * Rotate an application's API key and hand the new material to the
 * partner callback.
 */
export async function rotateCredential(
  client: Client,
  input: RotateCredentialInput,
): Promise<void> {
  if (!input.session) throw new Error("recipes: session is required");
  if (!input.applicationId) throw new Error("recipes: applicationId is required");
  if (!input.captureNew) throw new Error("recipes: captureNew callback is required");

  const app = new ApplicationClient(client);
  const resp = await app.rotateCredential(input.session, input.applicationId, input.signal);

  try {
    await input.captureNew({
      keyId: resp.apiKey.keyId,
      newSecret: resp.apiKey.secret,
      last4: resp.apiKey.last4,
    });
  } finally {
    resp.apiKey.secret = "";
  }
}
