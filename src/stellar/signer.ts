import type { Keypair } from "./keypair.js";

/** Stellar Public Main Network passphrase. */
export const PublicNetworkPassphrase = "Public Global Stellar Network ; September 2015";

/** Stellar Test SDF Network passphrase. */
export const TestnetNetworkPassphrase = "Test SDF Network ; September 2015";

/**
 * ChallengeSigner signs a SEP-10 challenge XDR with a keypair's seed.
 * Implementations delegate to the upstream Stellar SDK; the wrapper
 * lets consumers depend only on this interface.
 */
export interface ChallengeSigner {
  sign(xdr: string, keypair: Keypair): Promise<string>;
  readonly network: string;
}

/**
 * Default signer. The scaffold variant throws so callers cannot ship
 * unsigned challenges; Phase 1 wires the upstream Stellar SDK.
 */
export function newSigner(network: string): ChallengeSigner {
  return new PlaceholderSigner(network);
}

class PlaceholderSigner implements ChallengeSigner {
  constructor(readonly network: string) {}

  async sign(xdr: string, keypair: Keypair): Promise<string> {
    if (!xdr) throw new Error("stellar: empty challenge XDR");
    if (!keypair.canSign()) throw new Error("stellar: keypair has no seed");
    throw new Error("stellar: signer not yet wired to upstream SDK (Phase 1)");
  }
}
