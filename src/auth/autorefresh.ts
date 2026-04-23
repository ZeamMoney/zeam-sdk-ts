import { Session } from "./session.js";
import { TokenStore } from "./store.js";
import { Track } from "./tracks.js";

/**
 * A `Refresher` exchanges a session's current refresh token for a new
 * id-token / refresh-token pair. [OTPFlow] and [SEP10Flow] implement it.
 */
export interface Refresher {
  refresh(session: Session): Promise<Session>;
}

/**
 * Wraps a [Refresher] so concurrent callers coalesce into a single
 * in-flight refresh per track. Refresh is triggered when the id-token
 * is within `thresholdMs` of expiry (default: 5 minutes).
 */
export class AutoRefresher {
  private pending = new Map<Track, Promise<Session>>();

  constructor(
    private store: TokenStore,
    private refresher: Refresher,
    private thresholdMs: number = 5 * 60_000,
  ) {}

  /**
   * Return a valid session for the given track, refreshing if required.
   */
  async ensure(track: Track): Promise<Session> {
    const sess = await this.store.get(track);
    if (!sess) throw new Error(`auth: no session for track ${track}`);
    if (!sess.needsRefresh(new Date(), this.thresholdMs)) return sess;

    const existing = this.pending.get(track);
    if (existing) return existing;

    const promise = (async () => {
      try {
        // Re-check after acquiring the slot — a peer may have refreshed.
        const current = await this.store.get(track);
        if (!current) throw new Error(`auth: no session for track ${track}`);
        if (!current.needsRefresh(new Date(), this.thresholdMs)) return current;
        const refreshed = await this.refresher.refresh(current);
        await this.store.put(refreshed);
        return refreshed;
      } finally {
        this.pending.delete(track);
      }
    })();
    this.pending.set(track, promise);
    return promise;
  }
}
