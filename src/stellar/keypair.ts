const SEED_RE = /^S[A-Z2-7]{55}$/;
const PUBLIC_KEY_RE = /^G[A-Z2-7]{55}$/;

/** Thrown when a value does not look like a Stellar secret seed. */
export class InvalidSeedError extends Error {
  override readonly name = "InvalidSeedError";
  constructor() {
    super("stellar: invalid seed (expected S... 56 chars)");
  }
}

/** Thrown when a value does not look like a Stellar public key. */
export class InvalidPublicKeyError extends Error {
  override readonly name = "InvalidPublicKeyError";
  constructor() {
    super("stellar: invalid public key (expected G... 56 chars)");
  }
}

/**
 * Keypair carries a Stellar account address. Optionally holds the seed
 * for signing; callers SHOULD call `erase()` when they're done to
 * invalidate the in-memory copy.
 *
 * The underlying Stellar SDK types are intentionally not re-exported so
 * the wrapper can evolve independently.
 */
export class Keypair {
  #publicKey: string;
  #seed: string;

  private constructor(publicKey: string, seed = "") {
    this.#publicKey = publicKey;
    this.#seed = seed;
  }

  /**
   * Validate a public key and return a read-only keypair.
   */
  static parsePublicKey(address: string): Keypair {
    if (!PUBLIC_KEY_RE.test(address)) throw new InvalidPublicKeyError();
    return new Keypair(address);
  }

  /**
   * Validate a seed and return a keypair without a publicKey. Callers
   * must attach the public key via `Keypair.new(seed, publicKey)` if
   * they need to sign — the scaffold does not yet derive the public key
   * from the seed (that's wired when the upstream Stellar SDK is
   * integrated in Phase 1).
   */
  static parseSeed(seed: string): Keypair {
    if (!SEED_RE.test(seed)) throw new InvalidSeedError();
    return new Keypair("", seed);
  }

  /**
   * Construct a keypair from both the seed and its matching public key.
   */
  static new(seed: string, publicKey: string): Keypair {
    if (!SEED_RE.test(seed)) throw new InvalidSeedError();
    if (!PUBLIC_KEY_RE.test(publicKey)) throw new InvalidPublicKeyError();
    return new Keypair(publicKey, seed);
  }

  get publicKey(): string {
    return this.#publicKey;
  }

  /** @internal Used by the SEP-10 signer. */
  get seed(): string {
    return this.#seed;
  }

  canSign(): boolean {
    return this.#seed.length > 0;
  }

  erase(): void {
    this.#seed = "";
  }
}
