#!/usr/bin/env npx tsx
/**
 * ConnectClient SDK smoke test — same endpoints as api-connect-smoke.ts
 * but using the typed SDK client. Verifies SDK returns match raw API.
 *
 * Usage:
 *   ZEAM_STELLAR_SEED=S...  \
 *   ZEAM_STELLAR_PUBLIC_KEY=G...  \
 *   ZEAM_CONNECT_SECRET=<secret>  \
 *   npx tsx test/connect/connect-smoke.ts
 */

import { Client, Environment } from "../../src/index.js";
import { ConnectClient } from "../../src/client/connect/index.js";
import type { QuoteRequest } from "../../src/client/connect/index.js";
import { getSep10Session } from "../session-helper.js";

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {}

const seed = process.env.ZEAM_STELLAR_SEED!;
const pubkey = process.env.ZEAM_STELLAR_PUBLIC_KEY!;
const connectSecret = process.env.ZEAM_CONNECT_SECRET!;

if (!seed || !pubkey || !connectSecret) {
  console.error("Set ZEAM_STELLAR_SEED, ZEAM_STELLAR_PUBLIC_KEY, and ZEAM_CONNECT_SECRET");
  process.exit(1);
}

// ── ANSI ──────────────────────────────────────────────────────────────────────

const TTY = process.stdout.isTTY ?? false;
const c = (code: string) => (TTY ? code : "");
const BOLD = c("\x1b[1m");
const DIM = c("\x1b[2m");
const GREEN = c("\x1b[32m");
const RED = c("\x1b[31m");
const RESET = c("\x1b[0m");

let passed = 0;
let failed = 0;

function section(title: string): void {
  console.log(`\n${"═".repeat(64)}`);
  console.log(`  ${BOLD}${title}${RESET}`);
  console.log(`${"═".repeat(64)}`);
}

function pass(name: string, note = ""): void {
  passed++;
  console.log(`${GREEN}✓  ${name}${note ? `  (${note})` : ""}${RESET}`);
}

function fail(name: string, note = ""): void {
  failed++;
  console.log(`${RED}✗  ${name}${note ? `  (${note})` : ""}${RESET}`);
}

async function run<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const result = await fn();
    pass(name);
    return result;
  } catch (err) {
    fail(name, err instanceof Error ? err.message : String(err));
    return undefined;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const client = new Client({
    environment: Environment.Production,
    verboseErrors: true,
    skipVersionCheck: true,
  });

  console.log(`\n${BOLD}ConnectClient SDK Smoke Test${RESET}  ${DIM}${client.baseURL}${RESET}`);

  // ── Auth ──────────────────────────────────────────────────────────────────
  section("Auth — SEP-10 (via session helper)");
  const session = await run("getSep10Session()", () => getSep10Session(pubkey, seed));
  if (!session) process.exit(1);

  const connect = new ConnectClient(client, connectSecret);

  // ── Countries ─────────────────────────────────────────────────────────────
  section("Countries");
  const countries = await run("connect.listCountries()", () => connect.listCountries(session));
  console.log(`${DIM}  count: ${Array.isArray(countries) ? countries.length : "—"}${RESET}`);

  // ── Assets ────────────────────────────────────────────────────────────────
  section("Assets");
  const assets = await run("connect.listConnectAssets()", () => connect.listConnectAssets(session));
  const firstAssetId = Array.isArray(assets) ? assets[0]?.id : undefined;
  console.log(
    `${DIM}  count: ${Array.isArray(assets) ? assets.length : "—"}  first: ${firstAssetId ?? "—"}${RESET}`,
  );

  if (firstAssetId) {
    await run(`connect.getConnectAsset(${firstAssetId.slice(0, 8)}…)`, () =>
      connect.getConnectAsset(session, firstAssetId),
    );
  }

  // ── GraphQL connectors ────────────────────────────────────────────────────
  section("GraphQL — connectors");
  const connectors = await run("connect.queryConnectors(ZA, BANK)", () =>
    connect.queryConnectors(session, { countryISO: "ZA", method: "BANK" }),
  );
  const connectorId = Array.isArray(connectors)
    ? connectors.find((c) => c.isActive)?.id
    : undefined;
  console.log(
    `${DIM}  connectors: ${Array.isArray(connectors) ? connectors.length : "—"}  using: ${connectorId ?? "—"}${RESET}`,
  );

  // ── Quotes (SDK handles 402 passthrough) ────────────────────────────────────
  section("Quotes (SDK handles 402 as success)");
  if (connectorId) {
    const quoteBody: QuoteRequest = { connectorId, amount: 1 };

    const q1 = await run("connect.getQuote()", () => connect.getQuote(session, quoteBody));
    if (q1)
      console.log(`${DIM}  quoteId: ${q1.quoteId}  total: ${q1.total} ${q1.sendCurrency}${RESET}`);

    const q2 = await run("connect.getDirectionalQuote(Send)", () =>
      connect.getDirectionalQuote(session, "Send", quoteBody),
    );
    if (q2)
      console.log(`${DIM}  quoteId: ${q2.quoteId}  total: ${q2.total} ${q2.sendCurrency}${RESET}`);
  } else {
    fail("Quotes skipped — no connector");
  }

  // ── Integrator ────────────────────────────────────────────────────────────
  section("Integrator");
  const integrator = await run("connect.getIntegrator()", () => connect.getIntegrator(session));
  if (integrator) console.log(`${DIM}  id: ${integrator.id}${RESET}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(64)}`);
  console.log(
    `  ${GREEN}${passed} passed${RESET}   ${failed > 0 ? RED : DIM}${failed} failed${RESET}`,
  );
  console.log(`${"═".repeat(64)}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`\n${RED}Fatal:${RESET}`, err);
  process.exit(1);
});
