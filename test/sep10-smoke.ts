#!/usr/bin/env npx tsx
/**
 * SEP-10 / Connect auth smoke test — SDK client, verbose logging.
 * Tests client.sep10.getChallenge → sign → submitSigned → refresh.
 *
 * Usage:
 *   ZEAM_STELLAR_SEED=S... ZEAM_STELLAR_PUBLIC_KEY=G... npx tsx test/sep10-smoke.ts
 */

import { Keypair as StellarKeypair, Transaction } from "@stellar/stellar-sdk";
import { Client, Environment } from "../src/index.js";

try {
  process.loadEnvFile(new URL(".env", import.meta.url));
} catch {}

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

function makeLoggingFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(input, init);
    const url = new URL(req.url);

    console.log(`\n${HR}`);
    console.log(`${BOLD}${CYAN}REQUEST  ${req.method} ${url.pathname}${url.search}${RESET}`);
    console.log(HR2);

    req.headers.forEach((v, k) => {
      const display =
        k === "authorization"
          ? `Bearer ${v.replace("Bearer ", "").slice(0, 40)}…`
          : k === "x-zeam-auth"
            ? `${v.slice(0, 16)}…`
            : v;
      console.log(`${k}: ${display}`);
    });

    if (init?.body) {
      const bodyText = typeof init.body === "string" ? init.body : String(init.body);
      console.log("");
      try {
        console.log(JSON.stringify(JSON.parse(bodyText), null, 2));
      } catch {
        console.log(bodyText);
      }
    }

    const start = Date.now();
    const resp = await fetch(req);
    const ms = Date.now() - start;

    const clone = resp.clone();
    const rawBody = await clone.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = rawBody;
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

    return resp;
  };
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

function fail(name: string, err: unknown): void {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`\n${RED}✗  FAIL  ${name}  (${msg})${RESET}`);
}

async function main(): Promise<void> {
  const baseURL = process.env.ZEAM_API_URL;
  const environment = baseURL ? Environment.custom(baseURL) : Environment.Production;

  const client = new Client({
    environment,
    verboseErrors: true,
    skipVersionCheck: true,
    fetchImpl: makeLoggingFetch(),
  });

  console.log(
    `\n${BOLD}SEP-10 auth smoke test (SDK)${RESET}  ${DIM}${environment.baseURL}${RESET}`,
  );
  console.log(`${DIM}account: ${pubkey}${RESET}`);

  // ── getChallenge ───────────────────────────────────────────────────────────
  section("getChallenge");

  let challenge: Awaited<ReturnType<typeof client.sep10.getChallenge>> | undefined;
  try {
    challenge = await client.sep10.getChallenge(pubkey);
    pass(
      "client.sep10.getChallenge()",
      `xdr_len=${challenge.transaction.length}  network=${challenge.network_passphrase}`,
    );
  } catch (err) {
    fail("client.sep10.getChallenge()", err);
  }

  if (!challenge) process.exit(1);

  // ── sign (local) ───────────────────────────────────────────────────────────
  section("sign (local)");

  const tx = new Transaction(challenge.transaction, challenge.network_passphrase);
  const stellarKp = StellarKeypair.fromSecret(seed);
  tx.sign(stellarKp);
  const signedXdr = tx.toEnvelope().toXDR("base64");
  console.log(`${DIM}signed_xdr_len: ${signedXdr.length}${RESET}`);
  pass("sign", `signed_xdr_len=${signedXdr.length}`);

  // ── submitSigned ───────────────────────────────────────────────────────────
  section("submitSigned");

  let session: Awaited<ReturnType<typeof client.sep10.submitSigned>> | undefined;
  try {
    session = await client.sep10.submitSigned(signedXdr, pubkey);
    pass(
      "client.sep10.submitSigned()",
      `fingerprint=${session.fingerprint}  track=${session.track}`,
    );
  } catch (err) {
    fail("client.sep10.submitSigned()", err);
  }

  if (!session) process.exit(1);

  // ── refresh ────────────────────────────────────────────────────────────────
  section("refresh");

  try {
    const refreshed = await client.sep10.refresh(session);
    pass("client.sep10.refresh()", `fingerprint=${refreshed.fingerprint}`);
  } catch (err) {
    fail("client.sep10.refresh()", err);
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
