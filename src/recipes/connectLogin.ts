import type { Session } from "../auth/index.js";
import type { Client } from "../client.js";
import { Keypair } from "../stellar/index.js";

export interface ConnectLoginInput {
  /** The `stellar.secret` captured at application registration. */
  stellarSeed: string;
  /** The matching Stellar public key. */
  publicKey: string;
  signal?: AbortSignal;
}

/**
 * SEP-10 login end-to-end. Parses the supplied seed, signs the challenge,
 * persists the resulting Connect session, and erases the keypair.
 */
export async function connectLogin(client: Client, input: ConnectLoginInput): Promise<Session> {
  const kp = Keypair.new(input.stellarSeed, input.publicKey);
  try {
    const sess = await client.sep10.login(kp);
    await client.tokenStore.put(sess);
    return sess;
  } finally {
    kp.erase();
  }
}
