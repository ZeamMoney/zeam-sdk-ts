import type { Session } from "../auth/index.js";
import type { Client } from "../client.js";

export interface ConnectLoginInput {
  /** The application public key captured at registration. */
  publicKey: string;
  /** The application secret captured at registration. */
  secret: string;
  signal?: AbortSignal;
}

/**
 * Signs in to Connect with the application's public key and secret,
 * persists the resulting Connect session, and returns it.
 */
export async function connectLogin(client: Client, input: ConnectLoginInput): Promise<Session> {
  const sess = await client.sep10.signIn(input.publicKey, input.secret);
  await client.tokenStore.put(sess);
  return sess;
}
