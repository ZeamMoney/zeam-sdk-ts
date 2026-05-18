#!/usr/bin/env npx tsx
/**
 * Connect API gateway smoke test — only endpoints that return 200.
 *
 * Endpoints NOT covered (see CONNECT_TEST_STATUS.md):
 *   Routes (pod crash), Providers (Yoyo enum), OnRamp quote (500),
 *   OnRamp cash-in (MediatR DI), Platform health (404 via gateway).
 * OffRamp E2E is in offramp-e2e.ts (requires real money).
 *
 * Usage:
 *   ZEAM_STELLAR_SEED=S...  \
 *   ZEAM_STELLAR_PUBLIC_KEY=G...  \
 *   ZEAM_CONNECT_SECRET=<secret>  \
 *   npx tsx test/connect/api-connect-smoke.ts
 */

import { getSep10Token } from "../session-helper.js";

try { process.loadEnvFile(new URL("../.env", import.meta.url)); } catch {}

const BASE = "https://api-gateway.zeam.app";

const seed          = process.env.ZEAM_STELLAR_SEED!;
const pubkey        = process.env.ZEAM_STELLAR_PUBLIC_KEY!;
const connectSecret = process.env.ZEAM_CONNECT_SECRET!;

if (!seed || !pubkey || !connectSecret) {
  console.error("Set ZEAM_STELLAR_SEED, ZEAM_STELLAR_PUBLIC_KEY, and ZEAM_CONNECT_SECRET");
  process.exit(1);
}

// ── ANSI ──────────────────────────────────────────────────────────────────────

const TTY = process.stdout.isTTY ?? false;
const c = (code: string) => (TTY ? code : "");
const BOLD  = c("\x1b[1m");
const DIM   = c("\x1b[2m");
const GREEN = c("\x1b[32m");
const RED   = c("\x1b[31m");
const RESET = c("\x1b[0m");

let passed = 0;
let failed = 0;

// ── Transport ─────────────────────────────────────────────────────────────────

async function connect(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "x-zeam-auth": connectSecret,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const resp = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const raw = await resp.text();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = raw; }
  return { status: resp.status, data: parsed };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function check(name: string, status: number, data: unknown, okStatuses = [200]): void {
  if (okStatuses.includes(status)) {
    pass(name, `${status}`);
  } else {
    const msg = (data as { message?: string })?.message ?? "";
    fail(name, `${status}${msg ? ` ${msg}` : ""}`);
  }
}

function pick<T>(data: unknown, ...keys: string[]): T | undefined {
  let cursor: unknown = data;
  for (const k of keys) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[k];
  }
  return cursor as T;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${BOLD}Connect API Gateway Smoke Test${RESET}  ${DIM}${BASE}${RESET}`);

  // ── Auth ──────────────────────────────────────────────────────────────────
  section("Auth — SEP-10");
  const token = await getSep10Token(pubkey, seed);
  pass("SEP-10 sign-in");

  let r: { status: number; data: unknown };

  // ── Countries ─────────────────────────────────────────────────────────────
  section("Countries");
  r = await connect("GET", "/v1/connect-countries", token);
  check("GET /v1/connect-countries", r.status, r.data);
  const countries = pick<unknown[]>(r.data, "data") ?? [];
  console.log(`${DIM}  count: ${countries.length}${RESET}`);

  // ── Assets ────────────────────────────────────────────────────────────────
  section("Assets");
  r = await connect("GET", "/v1/connect-assets", token);
  check("GET /v1/connect-assets", r.status, r.data);
  const assets = pick<unknown[]>(r.data, "data") ?? [];
  const firstAssetId = pick<string>(assets[0], "id");
  console.log(`${DIM}  count: ${assets.length}  first: ${firstAssetId ?? "—"}${RESET}`);

  if (firstAssetId) {
    r = await connect("GET", `/v1/connect-assets/${firstAssetId}`, token);
    check("GET /v1/connect-assets/:id", r.status, r.data);
  }

  // ── GraphQL connectors ────────────────────────────────────────────────────
  section("GraphQL — connectors");
  r = await connect("POST", "/v1/connect-query", token, { countryISO: "ZA", method: "BANK" });
  check("POST /v1/connect-query (ZA, BANK)", r.status, r.data);
  const connectors = pick<unknown[]>(r.data, "data", "connectors", "connectors") ?? [];
  const connectorId = pick<string>(connectors[0], "id");
  console.log(`${DIM}  connectors: ${connectors.length}  using: ${connectorId ?? "—"}${RESET}`);

  // ── Quotes (402 = success) ────────────────────────────────────────────────
  section("Quotes (402 = success with quote data)");
  if (connectorId) {
    r = await connect("POST", "/v1/connect-quote", token, { ConnectorId: connectorId, Amount: 1 });
    check("POST /v1/connect-quote", r.status, r.data, [402]);
    const quoteId = pick<string>(r.data, "data", "quoteId");
    console.log(`${DIM}  quoteId: ${quoteId ?? "—"}  total: ${pick(r.data, "data", "total")} ZARZ${RESET}`);

    r = await connect("POST", "/v1/connect-quote/Send", token, { ConnectorId: connectorId, Amount: 1 });
    check("POST /v1/connect-quote/Send", r.status, r.data, [402]);
  } else {
    fail("Quotes skipped — no connector");
  }

  // ── Integrator ────────────────────────────────────────────────────────────
  section("Integrator");
  r = await connect("GET", "/v1/connect-integrators", token);
  check("GET /v1/connect-integrators", r.status, r.data);
  if (r.status === 200) {
    console.log(`${DIM}  id: ${pick(r.data, "data", "id") ?? "—"}${RESET}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(64)}`);
  console.log(`  ${GREEN}${passed} passed${RESET}   ${failed > 0 ? RED : DIM}${failed} failed${RESET}`);
  console.log(`${"═".repeat(64)}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`\n${RED}Fatal:${RESET}`, err);
  process.exit(1);
});
