import { Session } from "./session.js";
import { Track } from "./tracks.js";

/**
 * TokenStore persists Sessions by [Track]. Implementations must be safe
 * for concurrent use.
 */
export interface TokenStore {
  put(session: Session): Promise<void>;
  get(track: Track): Promise<Session | undefined>;
  delete(track: Track): Promise<void>;
  close(): Promise<void>;
}

/**
 * In-memory token store. The default; the SDK never persists tokens to
 * disk without an explicit opt-in.
 */
export class MemoryStore implements TokenStore {
  private sessions = new Map<Track, Session>();

  async put(session: Session): Promise<void> {
    if (session.track === Track.Unknown) {
      throw new Error("auth: session has unknown track");
    }
    const existing = this.sessions.get(session.track);
    if (existing && existing !== session) existing.erase();
    this.sessions.set(session.track, session);
  }

  async get(track: Track): Promise<Session | undefined> {
    return this.sessions.get(track);
  }

  async delete(track: Track): Promise<void> {
    const sess = this.sessions.get(track);
    if (sess) sess.erase();
    this.sessions.delete(track);
  }

  async close(): Promise<void> {
    for (const sess of this.sessions.values()) sess.erase();
    this.sessions.clear();
  }
}

/**
 * Keyring-backed store. Ships in v1 behind an explicit constructor; the
 * native bindings (macOS Keychain / Windows DPAPI / Linux libsecret) are
 * wired in Phase 3. Partners can supply their own secret-manager-backed
 * implementation today by conforming to [TokenStore].
 */
export class KeyringStore implements TokenStore {
  readonly service: string;

  constructor(service: string) {
    if (!service) throw new Error("auth: keyring service name required");
    this.service = service;
  }

  async put(_session: Session): Promise<void> {
    throw new Error(
      "auth: keyring backend not wired in the scaffold; Phase 3 wires the OS bindings",
    );
  }

  async get(_track: Track): Promise<Session | undefined> {
    return undefined;
  }

  async delete(_track: Track): Promise<void> {}

  async close(): Promise<void> {}
}
