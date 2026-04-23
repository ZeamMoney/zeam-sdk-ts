import { createHmac, timingSafeEqual } from "node:crypto";

/** Canonical outbound header names. Mirror the gateway. */
export const HeaderSignature = "x-zeam-signature";
export const HeaderTimestamp = "x-zeam-timestamp";
export const HeaderEventID = "x-zeam-event-id";

const DEFAULT_MAX_SKEW_MS = 5 * 60_000;
const MAX_BODY_SIZE = 2 * 1024 * 1024;

/** Public sentinel errors. */
export class WebhookError extends Error {
  override readonly name = "WebhookError";
  constructor(
    readonly reason:
      | "missing_signature"
      | "missing_timestamp"
      | "invalid_timestamp"
      | "stale_timestamp"
      | "bad_signature"
      | "replay"
      | "body_too_large",
  ) {
    super(`webhook: ${reason}`);
  }
}

/**
 * Replay-cache interface. Implementations must be safe for concurrent
 * use. {@link LRU} is a bounded in-memory cache shipped with the SDK.
 */
export interface ReplayCache {
  seen(eventId: string, ttlMs: number): boolean;
}

export interface VerifyOptions {
  maxSkewMs?: number;
  replayCache?: ReplayCache;
  /** Override the clock (tests only). */
  now?: () => Date;
}

/**
 * Verify an inbound webhook Request. On success returns the raw request
 * body as a string (the caller can `JSON.parse` it). On failure throws
 * a {@link WebhookError}.
 */
export async function verify(
  req: Request,
  secret: string | Uint8Array,
  opts: VerifyOptions = {},
): Promise<string> {
  const sig = req.headers.get(HeaderSignature);
  if (!sig) throw new WebhookError("missing_signature");
  const tsHeader = req.headers.get(HeaderTimestamp);
  if (!tsHeader) throw new WebhookError("missing_timestamp");
  const ts = Number(tsHeader.trim());
  if (!Number.isFinite(ts)) throw new WebhookError("invalid_timestamp");

  const now = opts.now ? opts.now() : new Date();
  const skew = opts.maxSkewMs ?? DEFAULT_MAX_SKEW_MS;
  if (Math.abs(now.getTime() - ts * 1000) > skew) {
    throw new WebhookError("stale_timestamp");
  }

  // Enforce the body-size cap. Reading via .text() will materialise the
  // whole body; we check Content-Length first to short-circuit DoS.
  const lengthHeader = req.headers.get("content-length");
  if (lengthHeader && Number(lengthHeader) > MAX_BODY_SIZE) {
    throw new WebhookError("body_too_large");
  }
  const body = await req.text();
  if (body.length > MAX_BODY_SIZE) throw new WebhookError("body_too_large");

  const key = typeof secret === "string" ? Buffer.from(secret, "utf8") : Buffer.from(secret);
  const mac = createHmac("sha256", key);
  mac.update(`${ts}.`);
  mac.update(body);
  const expected = mac.digest();

  let supplied: Buffer;
  try {
    supplied = Buffer.from(sig, "hex");
  } catch {
    throw new WebhookError("bad_signature");
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new WebhookError("bad_signature");
  }

  if (opts.replayCache) {
    const eventId = req.headers.get(HeaderEventID);
    if (eventId && opts.replayCache.seen(eventId, skew * 2)) {
      throw new WebhookError("replay");
    }
  }

  return body;
}

/**
 * Build a Fetch-standard handler that verifies every inbound Request
 * before delegating to `next` with the same request but a replayable
 * body (re-wrapped around the verified bytes).
 */
export function handler(
  next: (req: Request, body: string) => Promise<Response> | Response,
  secret: string | Uint8Array,
  opts: VerifyOptions = {},
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      const body = await verify(req, secret, opts);
      return await next(req, body);
    } catch (err) {
      if (err instanceof WebhookError) {
        return statusFromError(err);
      }
      return new Response("bad request", { status: 400 });
    }
  };
}

function statusFromError(err: WebhookError): Response {
  switch (err.reason) {
    case "missing_signature":
    case "missing_timestamp":
    case "invalid_timestamp":
    case "stale_timestamp":
    case "bad_signature":
      return new Response("unauthorised", { status: 401 });
    case "replay":
      return new Response("replayed event", { status: 409 });
    case "body_too_large":
      return new Response("payload too large", { status: 413 });
  }
}

/** Bounded in-memory replay cache. */
export class LRU implements ReplayCache {
  private map = new Map<string, number>();
  constructor(private capacity: number = 1024) {}

  seen(eventId: string, ttlMs: number): boolean {
    const now = Date.now();
    const existing = this.map.get(eventId);
    if (existing !== undefined && existing > now) {
      // Refresh position (LRU) by delete + re-set.
      this.map.delete(eventId);
      this.map.set(eventId, existing);
      return true;
    }
    if (existing !== undefined) this.map.delete(eventId);

    while (this.map.size >= this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
    this.map.set(eventId, now + ttlMs);
    return false;
  }
}
