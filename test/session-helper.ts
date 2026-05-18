/**
 * Persistent session helper for smoke tests.
 *
 * Caches the session to /tmp/zeam-<mobile>.json after a successful OTP login.
 * On the next run it tries to refresh the cached session first; only falls
 * back to the full interactive OTP flow if the refresh fails or no cache exists.
 *
 * Two exports:
 *   getSession   — for tests that use the SDK Client (returns Session)
 *   getRawToken  — for tests that use raw fetch (returns idToken string)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import type { Client } from "../src/index.js";
import { Session } from "../src/auth/session.js";
import type { Track } from "../src/auth/tracks.js";

try { process.loadEnvFile(new URL(".env", import.meta.url)); } catch {}

const BASE = "https://api-gateway.zeam.app";

interface StoredSession {
  idToken: string;
  refreshToken: string;
  expiresAt: string;
  track: string;
}

function cachePath(mobile: string): string {
  return path.join("/tmp", `zeam-${mobile.replace(/\+/g, "")}.json`);
}

function saveSession(mobile: string, session: Session): void {
  const data: StoredSession = {
    idToken: session.idToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt.toISOString(),
    track: session.track,
  };
  fs.writeFileSync(cachePath(mobile), JSON.stringify(data, null, 2));
}

function saveRaw(mobile: string, idToken: string, refreshToken: string): void {
  const data: StoredSession = {
    idToken,
    refreshToken,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    track: "business",
  };
  fs.writeFileSync(cachePath(mobile), JSON.stringify(data, null, 2));
}

function loadStored(mobile: string): StoredSession | null {
  try {
    const raw = fs.readFileSync(cachePath(mobile), "utf8");
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

async function rawRefresh(refreshToken: string): Promise<{ idToken: string; refreshToken: string } | null> {
  try {
    const resp = await fetch(`${BASE}/v1/public/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!resp.ok) return null;
    const body = await resp.json() as { data?: { accessToken?: string; idToken?: string; refreshToken?: string } };
    const newToken = body.data?.accessToken ?? body.data?.idToken;
    const newRefresh = body.data?.refreshToken;
    if (!newToken || !newRefresh) return null;
    return { idToken: newToken, refreshToken: newRefresh };
  } catch {
    return null;
  }
}

async function rawOtp(mobile: string, rl: readline.Interface): Promise<{ idToken: string; refreshToken: string }> {
  const challengeResp = await fetch(`${BASE}/v1/public/auth/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ mobileNumber: mobile }),
  });
  const challengeBody = await challengeResp.json() as { data?: { requestId?: string } };
  const requestId = challengeBody.data?.requestId;
  if (!requestId) throw new Error("session-helper: no requestId from request-otp");

  const code = (await rl.question("\n  ? OTP code: ")).trim();

  const verifyResp = await fetch(`${BASE}/v1/public/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ requestId, code }),
  });
  const verifyBody = await verifyResp.json() as { data?: { idToken?: string; refreshToken?: string } };
  const idToken = verifyBody.data?.idToken;
  const refreshToken = verifyBody.data?.refreshToken;
  if (!idToken || !refreshToken) throw new Error("session-helper: no tokens from verify-otp");
  return { idToken, refreshToken };
}

// ── SDK-based helper ──────────────────────────────────────────────────────────

/**
 * Returns a valid Business Session using the SDK client.
 * Reuses a cached session (refresh) if possible, otherwise runs the OTP flow.
 */
export async function getSession(
  mobile: string,
  client: Client,
  rl: readline.Interface,
): Promise<Session> {
  const stored = loadStored(mobile);
  if (stored) {
    try {
      const cached = new Session({
        track: stored.track as Track,
        idToken: stored.idToken,
        refreshToken: stored.refreshToken,
        expiresAt: new Date(stored.expiresAt),
      });
      const refreshed = await client.otp.refresh(cached);
      saveSession(mobile, refreshed);
      console.log(`  (resumed cached session from ${cachePath(mobile)})`);
      return refreshed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  (session refresh failed: ${msg} — requesting new OTP)`);
    }
  }

  const challenge = await client.otp.requestOTP({ mobileNumber: mobile });
  const code = (await rl.question("\n  ? OTP code: ")).trim();
  const session = await client.otp.verifyOTP({ requestId: challenge.requestId, code });
  await client.tokenStore.put(session);
  saveSession(mobile, session);
  return session;
}

// ── SEP-10 helper ─────────────────────────────────────────────────────────────

interface StoredSep10Session {
  idToken: string;
  refreshToken: string;
  expiresAt: string;
  publicKey: string;
}

function sep10CachePath(publicKey: string): string {
  return path.join("/tmp", `zeam-sep10-${publicKey}.json`);
}

function loadStoredSep10(publicKey: string): StoredSep10Session | null {
  try {
    const raw = fs.readFileSync(sep10CachePath(publicKey), "utf8");
    return JSON.parse(raw) as StoredSep10Session;
  } catch {
    return null;
  }
}

async function sep10SignIn(publicKey: string, secret: string): Promise<{ idToken: string; refreshToken: string }> {
  const resp = await fetch(`${BASE}/v1/public/auth-connect/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ publicKey, secret }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`SEP-10 sign-in failed: ${resp.status} ${body}`);
  }
  const body = await resp.json() as { idToken?: string; refreshToken?: string };
  if (!body.idToken || !body.refreshToken) throw new Error("SEP-10 sign-in: missing tokens in response");
  return { idToken: body.idToken, refreshToken: body.refreshToken };
}

/**
 * Returns a valid Connect idToken using SEP-10 authentication.
 * Caches the session to /tmp/zeam-sep10-<publicKey>.json.
 *
 * Flow:
 *   1. If cached token exists AND hasn't expired (60s buffer) AND belongs to
 *      the same publicKey → reuse it.
 *   2. If expired or missing → full SEP-10 sign-in (no user interaction needed).
 *
 * NOTE: We don't use the OTP refresh endpoint for SEP-10 tokens because
 * /v1/public/auth/refresh can return a token for a different identity.
 */
export async function getSep10Token(publicKey: string, secret: string): Promise<string> {
  const stored = loadStoredSep10(publicKey);
  if (stored && stored.publicKey === publicKey) {
    // If the cached token hasn't expired yet (with 60s buffer), use it directly
    const expiresAt = new Date(stored.expiresAt).getTime();
    if (expiresAt > Date.now() + 60_000) {
      console.log(`  (reusing cached SEP-10 session for ${publicKey.slice(0, 12)}...)`);
      return stored.idToken;
    }
    // Expired — don't try OTP refresh (it returns a different identity).
    // SEP-10 sign-in is cheap (no user interaction), so just re-auth.
    console.log(`  (SEP-10 token expired for ${publicKey.slice(0, 12)}... — re-authenticating)`);
  }

  const { idToken, refreshToken } = await sep10SignIn(publicKey, secret);
  saveSep10(publicKey, idToken, refreshToken);
  console.log(`  (new SEP-10 session for ${publicKey.slice(0, 12)}...)`);
  return idToken;
}

function saveSep10(publicKey: string, idToken: string, refreshToken: string): void {
  const data: StoredSep10Session = {
    idToken,
    refreshToken,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    publicKey,
  };
  fs.writeFileSync(sep10CachePath(publicKey), JSON.stringify(data, null, 2));
}

/**
 * Returns a valid Connect Session for SDK tests.
 * Uses the same cache/refresh/sign-in logic as getSep10Token.
 */
export async function getSep10Session(publicKey: string, secret: string): Promise<Session> {
  const token = await getSep10Token(publicKey, secret);
  const stored = loadStoredSep10(publicKey)!;
  return new Session({
    track: "connect" as Track,
    idToken: token,
    refreshToken: stored.refreshToken,
    expiresAt: new Date(stored.expiresAt),
  });
}

// ── Raw-fetch helper ──────────────────────────────────────────────────────────

/**
 * Returns a valid idToken string using raw fetch (no SDK dependency).
 * Reuses a cached session (refresh) if possible, otherwise runs the OTP flow.
 */
export async function getRawToken(
  mobile: string,
  rl: readline.Interface,
): Promise<string> {
  const stored = loadStored(mobile);
  if (stored) {
    const refreshed = await rawRefresh(stored.refreshToken);
    if (refreshed) {
      saveRaw(mobile, refreshed.idToken, refreshed.refreshToken);
      console.log(`  (resumed cached session from ${cachePath(mobile)})`);
      return refreshed.idToken;
    }
    console.log("  (session refresh failed — requesting new OTP)");
  }

  const { idToken, refreshToken } = await rawOtp(mobile, rl);
  saveRaw(mobile, idToken, refreshToken);
  return idToken;
}
