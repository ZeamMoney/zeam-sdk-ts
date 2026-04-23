import { describe, expect, it } from "vitest";
import { unwrap } from "./envelope.js";
import { fingerprint, redact } from "./redaction.js";
import { computeBackoff, isRetryableStatus } from "./retry.js";
import { isMutating } from "./fetcher.js";

describe("unwrap", () => {
  it("returns inner data on a SPEC §18 success envelope", () => {
    const body = `{"ok":true,"request_id":"rid-1","resource":"foo","verb":"get","data":{"hello":"world"}}`;
    const result = unwrap(200, body);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ hello: "world" });
  });

  it("passes through bare JSON on 2xx when the envelope is missing", () => {
    const body = `{"idToken":"abc","refreshToken":"def","expiresIn":"3600"}`;
    const result = unwrap(200, body);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ idToken: "abc" });
  });

  it("extracts a SPEC §18 error envelope on non-2xx", () => {
    const body = `{"ok":false,"request_id":"rid-2","errors":[{"code":"invalid_token","message":"nope","details":{"k":"v"}}]}`;
    const result = unwrap(401, body);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_token");
      expect(result.error.requestId).toBe("rid-2");
      expect(result.error.status).toBe(401);
      expect(result.error.details).toEqual({ k: "v" });
    }
  });

  it("survives malformed error bodies without throwing", () => {
    const result = unwrap(500, "not json at all");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe(500);
      expect(result.error.code).toBe("");
    }
  });
});

describe("redact", () => {
  it("strips seeds, JWTs, and authorization headers", () => {
    const seed = "SABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.abc";
    const out = redact({
      note: `please keep the ${seed} around`,
      jwt,
      Authorization: `Bearer ${jwt}`,
      nested: { stellarSecret: seed, safe: "hello" },
    });
    expect(out.note).not.toContain(seed);
    expect(out.Authorization).toBe("<redacted>");
    const nested = out.nested as Record<string, unknown>;
    expect(nested.stellarSecret).toBe("<redacted>");
    expect(nested.safe).toBe("hello");
  });
});

describe("fingerprint", () => {
  it("keeps the first 8 chars of a long token", () => {
    const out = fingerprint("eyJhbGciOiJIUzI1NiJ9.short");
    expect(out.startsWith("eyJhbGci")).toBe(true);
    expect(out).not.toContain(".");
  });

  it("returns len= for short tokens", () => {
    expect(fingerprint("abc")).toBe("len=3");
  });
});

describe("retry helpers", () => {
  it("isMutating flags write verbs", () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE"]) expect(isMutating(m)).toBe(true);
    for (const m of ["GET", "HEAD", "OPTIONS"]) expect(isMutating(m)).toBe(false);
  });

  it("isRetryableStatus matches ADR 0008 R6", () => {
    for (const s of [408, 429, 502, 503, 504]) expect(isRetryableStatus(s)).toBe(true);
    for (const s of [200, 400, 401, 403, 404, 500]) expect(isRetryableStatus(s)).toBe(false);
  });

  it("computeBackoff honours Retry-After over exponential", () => {
    const resp = new Response(null, { status: 429, headers: { "Retry-After": "2" } });
    const delay = computeBackoff(1, resp, () => 0.5);
    expect(delay).toBe(1000); // capped at 1s even though Retry-After asked for 2
  });

  it("computeBackoff caps exponential at 1 second", () => {
    for (let attempt = 1; attempt <= 8; attempt++) {
      const delay = computeBackoff(attempt, undefined, () => 1);
      expect(delay).toBeLessThanOrEqual(1000);
    }
  });
});
