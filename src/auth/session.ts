import { fingerprint } from "../transport/redaction.js";
import { Track } from "./tracks.js";

/**
 * Session represents a live authenticated session. Tokens are stored as
 * strings (TypeScript has no reliable zeroisation primitive on V8), but
 * `erase()` replaces them with empty strings so leaked references don't
 * continue to expose them.
 */
export class Session {
  #track: Track;
  #idToken: string;
  #refreshToken: string;
  #expiresAt: Date;
  #subject: string;

  constructor(params: {
    track: Track;
    idToken: string;
    refreshToken: string;
    expiresAt: Date;
    subject?: string;
  }) {
    this.#track = params.track;
    this.#idToken = params.idToken;
    this.#refreshToken = params.refreshToken;
    this.#expiresAt = params.expiresAt;
    this.#subject = params.subject ?? "";
  }

  get track(): Track {
    return this.#track;
  }

  /** Do NOT log. Use {@link fingerprint} for correlation. */
  get idToken(): string {
    return this.#idToken;
  }

  get refreshToken(): string {
    return this.#refreshToken;
  }

  get expiresAt(): Date {
    return this.#expiresAt;
  }

  get subject(): string {
    return this.#subject;
  }

  /**
   * Short, non-reversible identifier for log correlation.
   */
  get fingerprint(): string {
    return fingerprint(this.#idToken);
  }

  /**
   * True when the session is within the supplied threshold of expiry.
   * A threshold of zero means "only when already expired".
   */
  needsRefresh(now: Date, thresholdMs: number): boolean {
    return now.getTime() + thresholdMs >= this.#expiresAt.getTime();
  }

  /**
   * Atomically replace the id-token / refresh-token / expiry.
   */
  update(idToken: string, refreshToken: string, expiresAt: Date): void {
    this.#idToken = idToken;
    this.#refreshToken = refreshToken;
    this.#expiresAt = expiresAt;
  }

  /**
   * Zero the tokens and reset the track. The session is no longer
   * usable after `erase()`.
   */
  erase(): void {
    this.#idToken = "";
    this.#refreshToken = "";
    this.#track = Track.Unknown;
    this.#expiresAt = new Date(0);
  }
}
