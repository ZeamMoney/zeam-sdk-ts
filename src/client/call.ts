import type { Session } from "../auth/index.js";
import { Track } from "../auth/index.js";
import type { Doer } from "../client.js";
import { WrongTrackError, ZeamError, kindFromStatus } from "../errors.js";
import { unwrap } from "../transport/envelope.js";

/**
 * Options for a single call. `body` is JSON-marshalled; `session`
 * supplies the bearer + track enforcement; `connectSecret` goes onto the
 * `x-zeam-auth` header for Connect endpoints.
 */
export interface CallOptions {
  method: string;
  path: string;
  query?: URLSearchParams;
  session?: Session;
  requireTrack?: Track;
  connectSecret?: string;
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Generic typed call. Unwraps the SPEC §18 envelope and returns the
 * inner `data` (or raw JSON for bare-JSON endpoints). Throws a
 * {@link ZeamError} on non-2xx or {@link WrongTrackError} when a session
 * of the wrong track is passed in.
 */
export async function call<T = unknown>(doer: Doer, opts: CallOptions): Promise<T> {
  if (opts.session && opts.requireTrack && opts.requireTrack !== Track.Unknown) {
    if (opts.session.track !== opts.requireTrack) throw new WrongTrackError();
  }

  const u = new URL(opts.path, doer.baseURL);
  if (opts.query) u.search = opts.query.toString();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.session) headers["Authorization"] = `Bearer ${opts.session.idToken}`;
  if (opts.connectSecret) headers["x-zeam-auth"] = opts.connectSecret;

  const req = new Request(u, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  const resp = await doer.fetch(req);
  const raw = await resp.text();
  const parsed = unwrap(resp.status, raw);
  if (!parsed.ok) {
    throw new ZeamError({
      code: parsed.error.code,
      kind: kindFromStatus(parsed.error.status),
      status: parsed.error.status,
      requestId: parsed.error.requestId,
      upstreamMessage: parsed.error.message,
      details: parsed.error.details,
      verbose: doer.verboseErrors,
    });
  }
  return parsed.data as T;
}
