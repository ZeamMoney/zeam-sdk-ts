#!/usr/bin/env npx tsx
/**
 * SEP-10 / Connect auth smoke test — raw gateway calls, no SDK.
 * Tests getChallenge → sign → submitSigned → refresh against the live gateway.
 *
 * Usage:
 *   ZEAM_STELLAR_SEED=S... ZEAM_STELLAR_PUBLIC_KEY=G... npx tsx test/api-sep10-smoke.ts
 */

import { Keypair as StellarKeypair, Transaction } from "@stellar/stellar-sdk";

try {
  process.loadEnvFile(new URL(".env", import.meta.url));
} catch {}

const BASE = "https://api-gateway.zeam.app";

const seed = process.env.ZEAM_STELLAR_SEED!;
const pubkey = process.env.ZEAM_STELLAR_PUBLIC_KEY!;

if (!seed || !pubkey) {
  console.error("Set ZEAM_STELLAR_SEED and ZEAM_STELLAR_PUBLIC_KEY");
  process.exit(1);
}

const TTY = process.stdout.isTTY ?? false;
const c = (code: string) => (TTY ? code : "");

const BOLD = c("\x1b[1m");
const DIM = c("\x1b[2m");
const GREEN = c("\x1b[32m");
const RED = c("\x1b[31m");
const YELLOW = c("\x1b[33m");
const CYAN = c("\x1b[36m");
const RESET = c("\x1b[0m");

const HR = "━".repeat(64);
const HR2 = "─".repeat(64);

let passed = 0;
let failed = 0;

async function call(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  console.log(`\n${HR}`);
  console.log(`${BOLD}${CYAN}REQUEST  ${method} ${path}${RESET}`);
  console.log(HR2);
  for (const [k, v] of Object.entries(headers)) {
    console.log(`${k}: ${v}`);
  }
  if (body !== undefined) {
    console.log("");
    console.log(JSON.stringify(body, null, 2));
  }

  const start = Date.now();
  const resp = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const ms = Date.now() - start;

  const raw = await resp.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = raw;
  }

  const statusColor = resp.status < 300 ? GREEN : resp.status < 500 ? YELLOW : RED;
  console.log(`\n${statusColor}RESPONSE  ${resp.status} ${resp.statusText}  (${ms}ms)${RESET}`);
  console.log(HR2);
  const keepHeaders = ["content-type", "x-request-id", "x-envoy-upstream-service-time", "cf-ray"];
  resp.headers.forEach((v, k) => {
    if (keepHeaders.includes(k)) console.log(`${k}: ${v}`);
  });
  console.log("");
  console.log(JSON.stringify(parsed, null, 2));

  return { status: resp.status, data: parsed };
}

function section(title: string): void {
  console.log(`\n\n${"═".repeat(64)}`);
  console.log(`  ${BOLD}${title}${RESET}`);
  console.log(`${"═".repeat(64)}`);
}

function pass(name: string, note = ""): void {
  passed++;
  console.log(`\n${GREEN}✓  PASS  ${name}${note ? `  (${note})` : ""}${RESET}`);
}

function fail(name: string, note = ""): void {
  failed++;
  console.log(`\n${RED}✗  FAIL  ${name}${note ? `  (${note})` : ""}${RESET}`);
}

async function main(): Promise<void> {
  console.log(`\n${BOLD}SEP-10 auth smoke test (raw API)${RESET}  ${DIM}${BASE}${RESET}`);
  console.log(`${DIM}account: ${pubkey}${RESET}`);

  // ── 1. getChallenge ────────────────────────────────────────────────────────
  section("getChallenge");

  const challengeResp = await call(
    "GET",
    `/v1/public/auth-connect?account=${encodeURIComponent(pubkey)}`,
  );
  const challenge = challengeResp.data as { transaction?: string; network_passphrase?: string };

  if (challengeResp.status >= 300 || !challenge.transaction) {
    fail("GET /v1/public/auth-connect", `status=${challengeResp.status}`);
    process.exit(1);
  }
  pass(
    "GET /v1/public/auth-connect",
    `xdr_len=${challenge.transaction.length}  network=${challenge.network_passphrase}`,
  );

  // ── 2. sign ────────────────────────────────────────────────────────────────
  section("sign (local)");

  const tx = new Transaction(challenge.transaction, challenge.network_passphrase!);
  const stellarKp = StellarKeypair.fromSecret(seed);
  tx.sign(stellarKp);
  const signedXdr = tx.toEnvelope().toXDR("base64");
  console.log(`${DIM}signed_xdr_len: ${signedXdr.length}${RESET}`);
  pass("sign", `signed_xdr_len=${signedXdr.length}`);

  // ── 3. submitSigned ────────────────────────────────────────────────────────
  section("submitSigned");

  const submitResp = await call("POST", "/v1/public/auth-connect", { transaction: signedXdr });
  const tokens = submitResp.data as { idToken?: string; refreshToken?: string; expiresIn?: string };

  if (submitResp.status >= 300 || !tokens.idToken || !tokens.refreshToken) {
    fail("POST /v1/public/auth-connect", `status=${submitResp.status}`);
    process.exit(1);
  }
  pass("POST /v1/public/auth-connect", `token=…${tokens.idToken.slice(-8)}`);

  // ── 4. refresh ─────────────────────────────────────────────────────────────
  section("refresh");

  const refreshResp = await call("POST", "/v1/public/auth/refresh", {
    refreshToken: tokens.refreshToken,
  });
  const refreshed = (refreshResp.data as { data?: { accessToken?: string; refreshToken?: string } })
    ?.data;

  if (refreshResp.status >= 300 || !refreshed?.accessToken) {
    fail("POST /v1/public/auth/refresh", `status=${refreshResp.status}`);
  } else {
    pass("POST /v1/public/auth/refresh", `token=…${refreshed.accessToken.slice(-8)}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n\n${"═".repeat(64)}`);
  console.log(`  RESULTS`);
  console.log(`${"═".repeat(64)}`);
  console.log(`  ${GREEN}${passed} passed${RESET}`);
  console.log(`  ${failed > 0 ? RED : DIM}${failed} failed${RESET}`);
  console.log(`${"═".repeat(64)}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`\n${RED}Fatal:${RESET}`, err);
  process.exit(1);
});
