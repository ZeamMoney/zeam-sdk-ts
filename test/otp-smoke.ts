#!/usr/bin/env npx tsx
/**
 * OTP auth flow smoke test — SDK client, verbose logging.
 * Tests client.otp.requestOTP → verifyOTP → refresh.
 *
 * Usage:
 *   ZEAM_TEST_MOBILE=+27781506692 npx tsx test/otp-smoke.ts
 */

import * as readline from "node:readline/promises";
import { Client, Environment } from "../src/index.js";

try { process.loadEnvFile(new URL(".env", import.meta.url)); } catch {}

const TTY = process.stdout.isTTY ?? false;
const c = (code: string) => (TTY ? code : "");

const BOLD   = c("\x1b[1m");
const DIM    = c("\x1b[2m");
const GREEN  = c("\x1b[32m");
const RED    = c("\x1b[31m");
const YELLOW = c("\x1b[33m");
const CYAN   = c("\x1b[36m");
const RESET  = c("\x1b[0m");

const HR  = "━".repeat(64);
const HR2 = "─".repeat(64);

let passed = 0;
let failed = 0;

function makeLoggingFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(input, init);
    const url = new URL(req.url);

    console.log(`\n${HR}`);
    console.log(`${BOLD}${CYAN}REQUEST  ${req.method} ${url.pathname}${url.search}${RESET}`);
    console.log(HR2);

    req.headers.forEach((v, k) => {
      const display =
        k === "authorization" ? `Bearer ${v.replace("Bearer ", "").slice(0, 40)}…` :
        k === "x-zeam-auth"   ? `${v.slice(0, 16)}…` : v;
      console.log(`${k}: ${display}`);
    });

    if (init?.body) {
      const bodyText = typeof init.body === "string" ? init.body : String(init.body);
      console.log("");
      try { console.log(JSON.stringify(JSON.parse(bodyText), null, 2)); }
      catch { console.log(bodyText); }
    }

    const start = Date.now();
    const resp = await fetch(req);
    const ms = Date.now() - start;

    const clone = resp.clone();
    const rawBody = await clone.text();
    let parsed: unknown;
    try { parsed = JSON.parse(rawBody); } catch { parsed = rawBody; }

    const statusColor = resp.status < 300 ? GREEN : resp.status < 500 ? YELLOW : RED;
    console.log(`\n${statusColor}RESPONSE  ${resp.status} ${resp.statusText}  (${ms}ms)${RESET}`);
    console.log(HR2);

    const keepHeaders = ["content-type", "x-request-id", "x-envoy-upstream-service-time", "cf-ray"];
    resp.headers.forEach((v, k) => { if (keepHeaders.includes(k)) console.log(`${k}: ${v}`); });
    console.log("");
    console.log(JSON.stringify(parsed, null, 2));

    return resp;
  };
}

function pass(name: string, note = ""): void {
  passed++;
  console.log(`\n${GREEN}✓  PASS  ${name}${note ? `  (${note})` : ""}${RESET}`);
}

function fail(name: string, err: unknown): void {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`\n${RED}✗  FAIL  ${name}  (${msg})${RESET}`);
}

function section(title: string): void {
  console.log(`\n\n${"═".repeat(64)}`);
  console.log(`  ${BOLD}${title}${RESET}`);
  console.log(`${"═".repeat(64)}`);
}

async function main(): Promise<void> {
  const mobile = process.env.ZEAM_TEST_MOBILE;
  if (!mobile) {
    console.error(`${RED}Error:${RESET} set ZEAM_TEST_MOBILE=+<number>`);
    process.exit(1);
  }

  const baseURL = process.env.ZEAM_API_URL;
  const environment = baseURL ? Environment.custom(baseURL) : Environment.Production;

  const client = new Client({
    environment,
    verboseErrors: true,
    skipVersionCheck: true,
    fetchImpl: makeLoggingFetch(),
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\n${BOLD}OTP auth smoke test (SDK)${RESET}  ${DIM}${environment.baseURL}${RESET}`);

  // ── requestOTP ─────────────────────────────────────────────────────────────
  section("requestOTP");

  let requestId: string | undefined;
  try {
    const challenge = await client.otp.requestOTP({ mobileNumber: mobile });
    requestId = challenge.requestId;
    pass("client.otp.requestOTP()", `requestId=${requestId}`);
  } catch (err) { fail("client.otp.requestOTP()", err); }

  if (!requestId) { process.exit(1); }

  // ── verifyOTP ──────────────────────────────────────────────────────────────
  section("verifyOTP");

  const code = (await rl.question(`\n  ${YELLOW}?${RESET} OTP code: `)).trim();
  rl.close();

  let session: Awaited<ReturnType<typeof client.otp.verifyOTP>> | undefined;
  try {
    session = await client.otp.verifyOTP({ requestId, code });
    pass("client.otp.verifyOTP()", `fingerprint=${session.fingerprint}`);
  } catch (err) { fail("client.otp.verifyOTP()", err); }

  if (!session) { process.exit(1); }

  // ── refresh ────────────────────────────────────────────────────────────────
  section("refresh");

  try {
    const refreshed = await client.otp.refresh(session);
    pass("client.otp.refresh()", `fingerprint=${refreshed.fingerprint}`);
  } catch (err) { fail("client.otp.refresh()", err); }

  // ── summary ────────────────────────────────────────────────────────────────
  console.log(`\n\n${"═".repeat(64)}`);
  console.log(`  ${passed} passed  ${failed > 0 ? RED : ""}${failed} failed${RESET}`);
  console.log(`${"═".repeat(64)}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
