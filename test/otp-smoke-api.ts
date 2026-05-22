#!/usr/bin/env npx tsx
/**
 * OTP auth flow smoke test — raw gateway calls, no SDK.
 * Tests requestOTP → verifyOTP → refresh against the live gateway.
 *
 * Usage:
 *   ZEAM_TEST_MOBILE=+27123456789 npx tsx test/otp-smoke-api.ts
 */

import * as readline from "node:readline/promises";

try { process.loadEnvFile(new URL(".env", import.meta.url)); } catch {}

const BASE = "https://api-gateway.zeam.app";

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

async function call(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  console.log(`\n${HR}`);
  console.log(`${BOLD}${CYAN}REQUEST  ${method} ${path}${RESET}`);
  console.log(HR2);
  for (const [k, v] of Object.entries(headers)) {
    const display = k === "Authorization" ? `Bearer ${v.replace("Bearer ", "").slice(0, 40)}…` : v;
    console.log(`${k}: ${display}`);
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
  try { parsed = JSON.parse(raw); } catch { parsed = raw; }

  const statusColor = resp.status < 300 ? GREEN : resp.status < 500 ? YELLOW : RED;
  console.log(`\n${statusColor}RESPONSE  ${resp.status} ${resp.statusText}  (${ms}ms)${RESET}`);
  console.log(HR2);
  const keepHeaders = ["content-type", "x-request-id", "x-envoy-upstream-service-time", "cf-ray"];
  resp.headers.forEach((v, k) => { if (keepHeaders.includes(k)) console.log(`${k}: ${v}`); });
  console.log("");
  console.log(JSON.stringify(parsed, null, 2));

  return { status: resp.status, data: parsed };
}

function pass(name: string, note = ""): void {
  passed++;
  console.log(`\n${GREEN}✓  PASS  ${name}${note ? `  (${note})` : ""}${RESET}`);
}

function fail(name: string, note = ""): void {
  failed++;
  console.log(`\n${RED}✗  FAIL  ${name}${note ? `  (${note})` : ""}${RESET}`);
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

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\n${BOLD}OTP auth smoke test (raw API)${RESET}  ${DIM}${BASE}${RESET}`);

  // ── 1. requestOTP ──────────────────────────────────────────────────────────
  section("requestOTP");

  const otpResp = await call("POST", "/v1/public/auth/request-otp", "", { mobileNumber: mobile });
  const requestId = (otpResp.data as { data?: { requestId?: string } })?.data?.requestId;
  if (!requestId) {
    fail("requestOTP", "no requestId in response");
    process.exit(1);
  }
  pass("requestOTP", `requestId=${requestId}`);

  // ── 2. resendOTP ───────────────────────────────────────────────────────────
  section("resendOTP");

  const resendResp = await call("POST", "/v1/public/auth/resend-otp", "", { requestId });
  if (resendResp.status >= 300) {
    fail("resendOTP", `status=${resendResp.status}`);
  } else {
    pass("resendOTP", `requestId=${requestId}`);
  }

  // ── 3. verifyOTP ───────────────────────────────────────────────────────────
  section("verifyOTP");

  const code = (await rl.question(`\n  ${YELLOW}?${RESET} OTP code: `)).trim();
  rl.close();

  const verifyResp = await call("POST", "/v1/public/auth/verify-otp", "", { requestId, code });
  const idToken = (verifyResp.data as { data?: { idToken?: string } })?.data?.idToken;
  const refreshToken = (verifyResp.data as { data?: { refreshToken?: string } })?.data?.refreshToken;
  if (!idToken || !refreshToken) {
    fail("verifyOTP", "missing idToken or refreshToken");
    process.exit(1);
  }
  pass("verifyOTP", `token=…${idToken.slice(-8)}`);

  // ── 4. refresh ─────────────────────────────────────────────────────────────
  section("refresh");

  const refreshResp = await call("POST", "/v1/public/auth/refresh", "", { refreshToken });
  const newToken = (refreshResp.data as { data?: { idToken?: string; accessToken?: string } })?.data;
  const newIdToken = newToken?.idToken ?? newToken?.accessToken;
  if (!newIdToken || refreshResp.status >= 300) {
    fail("refresh", `status=${refreshResp.status}`);
  } else {
    pass("refresh", `token=…${newIdToken.slice(-8)}`);
  }

  // ── 5-6. sign-up flow (optional) ──────────────────────────────────────────
  const signupMobile = process.env.ZEAM_TEST_SIGNUP_MOBILE;
  if (signupMobile) {
    // 5. requestSignUp
    section("requestSignUp");

    const signupResp = await call("POST", "/v1/public/auth/sign-up", "", { mobileNumber: signupMobile });
    const signupRequestId = (signupResp.data as { data?: { requestId?: string } })?.data?.requestId;
    if (!signupRequestId) {
      fail("requestSignUp", "no requestId in response");
    } else {
      pass("requestSignUp", `requestId=${signupRequestId}`);

      // 6. verifySignUp
      section("verifySignUp");

      const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
      const signupCode = (await rl2.question(`\n  ${YELLOW}?${RESET} Sign-up OTP code: `)).trim();
      rl2.close();

      const signupVerifyResp = await call("POST", "/v1/public/auth/sign-up/verify", "", {
        requestId: signupRequestId,
        code: signupCode,
      });
      const signupIdToken = (signupVerifyResp.data as { data?: { idToken?: string } })?.data?.idToken;
      if (!signupIdToken || signupVerifyResp.status >= 300) {
        fail("verifySignUp", `status=${signupVerifyResp.status}`);
      } else {
        pass("verifySignUp", `token=…${signupIdToken.slice(-8)}`);
      }
    }
  } else {
    console.log(`\n${DIM}sign-up flow skipped — set ZEAM_TEST_SIGNUP_MOBILE=+<number> to enable${RESET}`);
  }

  // ── summary ────────────────────────────────────────────────────────────────
  console.log(`\n\n${"═".repeat(64)}`);
  console.log(`  ${passed} passed  ${failed > 0 ? RED : ""}${failed} failed${RESET}`);
  console.log(`${"═".repeat(64)}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
