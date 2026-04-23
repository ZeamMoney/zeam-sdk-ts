import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  HeaderEventID,
  HeaderSignature,
  HeaderTimestamp,
  LRU,
  WebhookError,
  handler,
  verify,
} from "./index.js";

const SECRET = "super-secret-do-not-log";

function sign(ts: number, body: string): string {
  const mac = createHmac("sha256", Buffer.from(SECRET));
  mac.update(`${ts}.`);
  mac.update(body);
  return mac.digest("hex");
}

function build(body: string, ts: number, omit: Partial<Record<string, true>> = {}): Request {
  const headers: Record<string, string> = {};
  if (!omit.sig) headers[HeaderSignature] = sign(ts, body);
  if (!omit.ts) headers[HeaderTimestamp] = String(ts);
  if (omit.event) delete headers[HeaderEventID];
  else headers[HeaderEventID] = "evt-1";
  return new Request("https://example.invalid/webhook", {
    method: "POST",
    headers,
    body,
  });
}

describe("verify", () => {
  it("accepts a valid request and returns the raw body", async () => {
    const body = `{"event":"payment.succeeded"}`;
    const ts = Math.floor(Date.now() / 1000);
    const out = await verify(build(body, ts), SECRET);
    expect(out).toBe(body);
  });

  it("rejects stale timestamps", async () => {
    const body = `{"event":"x"}`;
    const ts = Math.floor((Date.now() - 60 * 60_000) / 1000);
    await expect(verify(build(body, ts), SECRET)).rejects.toMatchObject({
      name: "WebhookError",
      reason: "stale_timestamp",
    });
  });

  it("rejects bad signatures", async () => {
    const body = `{"event":"x"}`;
    const ts = Math.floor(Date.now() / 1000);
    const req = build(body, ts);
    req.headers.set(HeaderSignature, "00deadbeef");
    await expect(verify(req, SECRET)).rejects.toMatchObject({ reason: "bad_signature" });
  });

  it("rejects missing headers", async () => {
    const body = "{}";
    const ts = Math.floor(Date.now() / 1000);
    await expect(verify(build(body, ts, { sig: true }), SECRET)).rejects.toMatchObject({
      reason: "missing_signature",
    });
    await expect(verify(build(body, ts, { ts: true }), SECRET)).rejects.toMatchObject({
      reason: "missing_timestamp",
    });
  });

  it("flags replay via the cache", async () => {
    const body = `{"event":"payment.succeeded"}`;
    const ts = Math.floor(Date.now() / 1000);
    const cache = new LRU(16);
    const opts = { replayCache: cache };
    await verify(build(body, ts), SECRET, opts);
    await expect(verify(build(body, ts), SECRET, opts)).rejects.toMatchObject({ reason: "replay" });
  });
});

describe("handler", () => {
  it("delegates on success with the verified body", async () => {
    const body = `{"ok":true}`;
    const ts = Math.floor(Date.now() / 1000);
    let seen = "";
    const h = handler(async (_req, text) => {
      seen = text;
      return new Response(null, { status: 204 });
    }, SECRET);
    const resp = await h(build(body, ts));
    expect(resp.status).toBe(204);
    expect(seen).toBe(body);
  });

  it("returns 401 on missing signature", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const h = handler(() => new Response(null, { status: 204 }), SECRET);
    const resp = await h(build("{}", ts, { sig: true }));
    expect(resp.status).toBe(401);
  });
});

describe("LRU", () => {
  it("evicts the oldest entry at capacity", () => {
    const c = new LRU(2);
    expect(c.seen("a", 60_000)).toBe(false);
    expect(c.seen("b", 60_000)).toBe(false);
    expect(c.seen("c", 60_000)).toBe(false); // evicts "a"
    expect(c.seen("a", 60_000)).toBe(false);
  });
});

// Ensure the WebhookError class is exported for typing.
export const _t: WebhookError | undefined = undefined;
