#!/usr/bin/env npx tsx
/**
 * Connect service localhost smoke test — REST + GraphQL connector discovery.
 * Hits the Connect service directly (bypasses the gateway).
 *
 * Port-forward first:
 *   kubectl port-forward svc/connect-api 8099:8080
 *
 * Usage (SEP-10 auto-auth — recommended):
 *   ZEAM_STELLAR_SEED=S... ZEAM_STELLAR_PUBLIC_KEY=G... npx tsx test/connect/connect-localhost-smoke.ts
 *
 * Or with a pre-issued token (skips SEP-10):
 *   CONNECT_SECRET=<idToken>  npx tsx test/connect/connect-localhost-smoke.ts
 */

import { getSep10Token } from "../session-helper.js";

try { process.loadEnvFile(new URL("../.env", import.meta.url)); } catch {}

const BASE = process.env.CONNECT_HOST ?? "http://localhost:8099";
const PUBKEY = process.env.ZEAM_STELLAR_PUBLIC_KEY ?? "";
let SECRET = process.env.CONNECT_SECRET ?? "";

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const TTY = process.stdout.isTTY ?? false;
const c = (code: string) => (TTY ? code : "");
const BOLD   = c("\x1b[1m");
const DIM    = c("\x1b[2m");
const GREEN  = c("\x1b[32m");
const RED    = c("\x1b[31m");
const YELLOW = c("\x1b[33m");
const RESET  = c("\x1b[0m");

let passed = 0;
let failed = 0;

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function call(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${SECRET}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

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

  const col = resp.status < 300 ? GREEN : resp.status < 500 ? YELLOW : RED;
  console.log(`\n${col}${method} ${path}  ${resp.status} ${resp.statusText}  (${ms}ms)${RESET}`);
  if (body !== undefined) console.log(`${DIM}${JSON.stringify(body)}${RESET}`);
  console.log(JSON.stringify(parsed, null, 2));

  return { status: resp.status, data: parsed };
}

async function gql(query: string): Promise<unknown> {
  const resp = await fetch(`${BASE}/graphql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const json = await resp.json() as { data?: unknown; errors?: unknown[] };
  if (json.errors?.length) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

function pick<T>(obj: unknown, ...keys: string[]): T | undefined {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur as T;
}

// ── Assertion helpers ─────────────────────────────────────────────────────────

function section(title: string): void {
  console.log(`\n\n${"═".repeat(64)}`);
  console.log(`  ${BOLD}${title}${RESET}`);
  console.log(`${"═".repeat(64)}`);
}

function pass(name: string, note = ""): void {
  passed++;
  console.log(`${GREEN}✓  PASS  ${name}${note ? `  (${note})` : ""}${RESET}`);
}

function fail(name: string, note = ""): void {
  failed++;
  console.log(`${RED}✗  FAIL  ${name}${note ? `  (${note})` : ""}${RESET}`);
}

// 2xx = pass
function check(name: string, status: number, data: unknown): void {
  const msg = (data as { message?: string })?.message ?? "";
  if (status >= 200 && status < 300) {
    pass(name, `${status}`);
  } else {
    fail(name, `${status}${msg ? `  ${msg}` : ""}`);
  }
}

// 402 = pass for quotes (Connect returns 402 "Payment Required" with quote data on success)
function checkQuote(name: string, status: number, data: unknown): void {
  const msg = (data as { message?: string })?.message ?? "";
  if (status === 402 && pick(data, "data", "quoteId")) {
    pass(name, `${status} — quote created`);
  } else if (status >= 200 && status < 300) {
    pass(name, `${status}`);
  } else {
    fail(name, `${status}${msg ? `  ${msg}` : ""}`);
  }
}

async function run(
  name: string,
  fn: () => Promise<{ status: number; data: unknown }>,
  checker: (n: string, s: number, d: unknown) => void,
): Promise<{ status: number; data: unknown }> {
  try {
    const res = await fn();
    checker(name, res.status, res.data);
    return res;
  } catch (err) {
    fail(name, err instanceof Error ? err.message : String(err));
    return { status: 0, data: null };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${BOLD}Connect localhost smoke test${RESET}  ${DIM}${BASE}${RESET}`);

  if (!SECRET) {
    const seed   = process.env.ZEAM_STELLAR_SEED;
    const pubkey = process.env.ZEAM_STELLAR_PUBLIC_KEY;
    if (!seed || !pubkey) {
      console.error(`\n${RED}Set CONNECT_SECRET or both ZEAM_STELLAR_SEED + ZEAM_STELLAR_PUBLIC_KEY${RESET}`);
      process.exit(1);
    }
    SECRET = await getSep10Token(pubkey, seed);
  }

  // ── Platform health ────────────────────────────────────────────────────────
  section("Platform health");
  await run("GET /healthz", () => call("GET", "/healthz"), check);

  // ── Discover connectors via GraphQL ──────────────────────────────────────────
  section("Connector discovery (GraphQL)");
  let offRampConnectorId = "";
  let onRampConnectorId = "";

  async function discoverConnector(direction: string): Promise<{ id: string; name: string } | undefined> {
    const data = await gql(`query {
      connectors {
        connectors(country: ZA, method: BANK, direction: ${direction}) {
          id name isActive
        }
      }
    }`);
    const list = pick<{ id: string; name: string; isActive: boolean }[]>(data, "connectors", "connectors") ?? [];
    return list.find((c) => c.isActive) ?? list[0];
  }

  try {
    const off = await discoverConnector("OFF_RAMP");
    if (off) {
      offRampConnectorId = off.id;
      pass("GraphQL OFF_RAMP", `"${off.name}" (${off.id})`);
    } else {
      fail("GraphQL OFF_RAMP", "no connectors returned");
    }
  } catch (err) {
    fail("GraphQL OFF_RAMP", err instanceof Error ? err.message : String(err));
  }

  try {
    const on = await discoverConnector("ON_RAMP");
    if (on) {
      onRampConnectorId = on.id;
      pass("GraphQL ON_RAMP", `"${on.name}" (${on.id})`);
    } else {
      fail("GraphQL ON_RAMP", "no connectors returned");
    }
  } catch (err) {
    fail("GraphQL ON_RAMP", err instanceof Error ? err.message : String(err));
  }

  if (!offRampConnectorId && !onRampConnectorId) {
    console.error(`\n${RED}Cannot continue without at least one connector ID${RESET}`);
    printSummary();
    return;
  }

  // ── Helper: create a fresh quote ───────────────────────────────────────────
  async function freshQuote(direction: string, cId: string): Promise<string | undefined> {
    const res = await call("POST", `/api/v1/quote/${direction}`, {
      ConnectorId: cId,
      Amount: 100,
    });
    return pick<string>(res.data, "data", "quoteId");
  }

  // ── Quotes ─────────────────────────────────────────────────────────────────
  section("Quotes (402 = success — Connect returns quote data with 402)");

  if (offRampConnectorId) {
    await run(
      "POST /api/v1/quote/send",
      () => call("POST", "/api/v1/quote/send", { ConnectorId: offRampConnectorId, Amount: 100 }),
      checkQuote,
    );
    await run(
      "POST /api/v1/quote/Send",
      () => call("POST", "/api/v1/quote/Send", { ConnectorId: offRampConnectorId, Amount: 100 }),
      checkQuote,
    );
  }

  if (onRampConnectorId) {
    await run(
      "POST /api/v1/quote/Receive",
      () => call("POST", "/api/v1/quote/Receive", { ConnectorId: onRampConnectorId, Amount: 100 }),
      checkQuote,
    );
  }

  // ── OffRamp ────────────────────────────────────────────────────────────────
  // Needs a real Stellar transaction hash to fully succeed — we use a valid
  // quote but a fake tx hash, so the best we get is 402 "payment not found".
  section("OffRamp (needs real Stellar tx — expect 402 payment-not-found)");
  if (offRampConnectorId) {
    const offrampQuoteId = await freshQuote("send", offRampConnectorId);
    if (offrampQuoteId) {
      await run("POST /api/v1/offramp", () => call("POST", "/api/v1/offramp", {
        Reference: `smoke-offramp-${Date.now()}`,
        QuoteId: offrampQuoteId,
        TransactionHash: "0000000000000000000000000000000000000000000000000000000000000000",
        RefundAccount: { Account: PUBKEY },
      }), (name, status, data) => {
        // 402 "payment not found" is expected without a real Stellar tx
        if (status === 402) {
          pass(name, `${status} — quote accepted, awaiting Stellar payment (expected)`);
        } else {
          check(name, status, data);
        }
      });
    } else {
      fail("POST /api/v1/offramp", "skipped — no quote ID available");
    }
  } else {
    fail("POST /api/v1/offramp", "skipped — no OFF_RAMP connector");
  }

  // ── OnRamp ─────────────────────────────────────────────────────────────────
  section("OnRamp");
  if (onRampConnectorId) {
    const onrampQuoteId = await freshQuote("Receive", onRampConnectorId);
    if (onrampQuoteId) {
      await run("POST /api/v1/onramp", () => call("POST", "/api/v1/onramp", {
        Reference: `smoke-onramp-${Date.now()}`,
        QuoteId: onrampQuoteId,
        SettlementAccount: { Account: PUBKEY },
      }), check);
    } else {
      fail("POST /api/v1/onramp", "skipped — no quote ID available");
    }
  } else {
    fail("POST /api/v1/onramp", "skipped — no ON_RAMP connector");
  }

  // cash-in: skipped — MediatR handler not registered (Connect backend bug)
  console.log(`\n${YELLOW}⚠  SKIP  POST /api/v1/onramp/cash-in — MediatR handler not registered (backend DI bug)${RESET}`);

  // ── Transaction status ─────────────────────────────────────────────────────
  // We don't have a real transaction from the ramps above, so this will 404.
  section("Transaction status (no real transaction — expect 404)");
  await run(
    "GET /api/v1/status/:transaction_id",
    () => call("GET", `/api/v1/status/00000000-0000-0000-0000-000000000000`),
    (name, status, data) => {
      if (status === 404) {
        pass(name, `${status} — no transaction exists (expected)`);
      } else {
        check(name, status, data);
      }
    },
  );

  printSummary();
}

function printSummary(): void {
  console.log(`\n\n${"═".repeat(64)}`);
  console.log(`  RESULTS`);
  console.log(`${"═".repeat(64)}`);
  console.log(`  ${GREEN}${passed} passed${RESET}`);
  console.log(`  ${failed > 0 ? RED : DIM}${failed} failed${RESET}`);
  console.log(`${"═".repeat(64)}`);
}

main().catch((err) => {
  console.error(`\n${RED}Fatal:${RESET}`, err);
});
