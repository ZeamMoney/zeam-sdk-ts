#!/usr/bin/env npx tsx
/**
 * Gateway smoke test for all Business endpoints not yet in the SDK.
 * Tests every route exists and auth works before wrapping in BusinessClient.
 *
 * Usage:
 *   ZEAM_TEST_MOBILE=+27123456789 npx tsx test/api-business-smoke.ts
 */

import * as readline from "node:readline/promises";
import { getRawToken } from "./session-helper.js";

try {
  process.loadEnvFile(new URL(".env", import.meta.url));
} catch {}

const BASE = "https://api-gateway.zeam.app";
const ASSOCIATION_ID = process.env.ZEAM_TEST_ASSOCIATION_ID ?? "";
const BENEFICIARY_ID = process.env.ZEAM_TEST_BENEFICIARY_ID ?? "";
const WALLET_ID = process.env.ZEAM_TEST_WALLET_ID ?? "";

// Strip ANSI when piped to a file
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

// ── verbose fetch ─────────────────────────────────────────────────────────────

async function call(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  // ── request block ──────────────────────────────────────────────────────────
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
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = raw;
  }

  // ── response block ─────────────────────────────────────────────────────────
  const statusColor = resp.status < 300 ? GREEN : resp.status < 500 ? YELLOW : RED;
  console.log(`\n${statusColor}RESPONSE  ${resp.status} ${resp.statusText}  (${ms}ms)${RESET}`);
  console.log(HR2);

  // Only print the headers most useful for debugging
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

function check(name: string, status: number, data: unknown): void {
  const msg = (data as { message?: string })?.message ?? "";
  if (status === 401 || status === 403) {
    fail(name, `${status} — auth rejected`);
  } else if (status >= 500) {
    fail(name, `${status}  ${msg}`);
  } else {
    pass(name, `${status}${msg ? `  ${msg}` : ""}`);
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const mobile = process.env.ZEAM_TEST_MOBILE;
  if (!mobile) {
    console.error(`${RED}Error:${RESET} set ZEAM_TEST_MOBILE=+<number>`);
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\n${BOLD}Business API gateway smoke test${RESET}  ${DIM}${BASE}${RESET}`);

  // ── Auth ───────────────────────────────────────────────────────────────────
  section("Auth — OTP");

  const token = await getRawToken(mobile, rl);
  rl.close();
  pass("session", `token=…${token.slice(-8)}`);

  // ── Associations ───────────────────────────────────────────────────────────
  section("Associations");

  let r = await call("GET", `/v1/business/association/${ASSOCIATION_ID}`, token);
  check("GET /business/association/:id", r.status, r.data);

  // ── Assets ─────────────────────────────────────────────────────────────────
  section("Assets");

  r = await call("GET", "/v1/business/asset", token);
  check("GET /business/asset", r.status, r.data);

  // Grab asset id from the full asset list (uses `id` field)
  const fullAssetList = (r.data as { data?: { id?: string }[] })?.data ?? [];
  const fullAssetId = (fullAssetList[0] as { id?: string } | undefined)?.id;
  console.log(`  ${DIM}first full asset id: ${fullAssetId ?? "none"}${RESET}`);

  r = await call("GET", "/v1/business/asset/dto", token);
  check("GET /business/asset/dto", r.status, r.data);

  // Grab assetID from the DTO list (uses `assetID` field — different ID space)
  const dtoList = (r.data as { data?: { assetID?: string }[] })?.data ?? [];
  const dtoAssetId = (dtoList[0] as { assetID?: string } | undefined)?.assetID;
  console.log(`  ${DIM}first dto assetID: ${dtoAssetId ?? "none"}${RESET}`);

  if (dtoAssetId) {
    r = await call("GET", `/v1/business/asset/dto/${encodeURIComponent(dtoAssetId)}`, token);
    check("GET /business/asset/dto/:id", r.status, r.data);
  } else {
    console.log(`  ${YELLOW}– GET /business/asset/dto/:id  (skipped — no DTO assetID)${RESET}`);
  }

  if (fullAssetId) {
    r = await call("GET", `/v1/business/asset/${encodeURIComponent(fullAssetId)}`, token);
    check("GET /business/asset/:id", r.status, r.data);
  } else {
    console.log(`  ${YELLOW}– GET /business/asset/:id      (skipped — no asset ID)${RESET}`);
  }

  // ── Wallets ────────────────────────────────────────────────────────────────
  section("Wallets");

  r = await call("GET", "/v1/business/wallet/type", token);
  check("GET /business/wallet/type", r.status, r.data);

  r = await call("GET", "/v1/business/wallet/all", token);
  check("GET /business/wallet/all", r.status, r.data);

  r = await call("GET", `/v1/business/wallet/dto/${WALLET_ID}`, token);
  check("GET /business/wallet/dto/:id", r.status, r.data);

  r = await call("GET", `/v1/business/wallet/${WALLET_ID}`, token);
  check("GET /business/wallet/:id", r.status, r.data);

  // Create wallet — upstream expects camelCase with a valid typeId UUID
  r = await call("POST", "/v1/business/wallet", token, {
    walletName: "SDK smoke test wallet",
    typeId: "729db392-8c75-4c52-b7a1-af4b6f4157d9", // Exchange Wallet
    networkId: "014b4ef6-5f0e-473a-95f9-8e01f2a06bf7", // Stellar
  });
  check("POST /business/wallet", r.status, r.data);
  const createdWalletId =
    (r.data as { data?: { id?: string } })?.data?.id ?? (r.data as { id?: string })?.id;
  console.log(`  ${DIM}created wallet id: ${createdWalletId ?? "none"}${RESET}`);

  // Update wallet — use created or fallback to known wallet
  const walletToUpdate = createdWalletId ?? WALLET_ID;
  r = await call("PUT", `/v1/business/wallet/${walletToUpdate}`, token, {
    label: "SDK smoke test wallet (updated)",
  });
  check("PUT /business/wallet/:id", r.status, r.data);

  // ── Beneficiaries ──────────────────────────────────────────────────────────
  section("Beneficiaries — CRUD");

  r = await call("GET", `/v1/business/beneficiaries/${ASSOCIATION_ID}`, token);
  check("GET /business/beneficiaries/:associationId", r.status, r.data);

  // Create a test beneficiary
  r = await call("POST", `/v1/business/beneficiaries/${ASSOCIATION_ID}`, token, {
    beneficiary_type: "Individual",
    reference: "api-smoke-test",
    individual: { first_name: "API", last_name: "SmokeTest" },
    payment_destinations: [
      { method: "MOMO", mobile_number: "+27845551234", country_iso: "ZA", is_primary: true },
    ],
  });
  check("POST /business/beneficiaries/:associationId", r.status, r.data);
  const createdBeneficiaryId =
    (r.data as { data?: { beneficiary?: { id?: string } } })?.data?.beneficiary?.id ??
    (r.data as { data?: { id?: string } })?.data?.id ??
    (r.data as { id?: string })?.id;
  console.log(`  ${DIM}created beneficiary id: ${createdBeneficiaryId ?? "none"}${RESET}`);

  // Bulk create
  r = await call("POST", `/v1/business/beneficiaries/${ASSOCIATION_ID}/bulk`, token, {
    beneficiaries: [
      {
        beneficiary_type: "Individual",
        reference: "bulk-smoke-1",
        individual: { first_name: "Bulk", last_name: "One" },
        payment_destinations: [
          { method: "MOMO", mobile_number: "+27845550001", country_iso: "ZA", is_primary: true },
        ],
      },
    ],
  });
  check("POST /business/beneficiaries/:associationId/bulk", r.status, r.data);

  // Use created or known beneficiary for remaining tests
  const benId = createdBeneficiaryId ?? BENEFICIARY_ID;

  r = await call("PUT", `/v1/business/beneficiaries/${ASSOCIATION_ID}/${benId}`, token, {
    beneficiary_type: "Individual",
    reference: "api-smoke-test-updated",
    individual: { first_name: "API", last_name: "SmokeTest-Updated" },
    payment_destinations: [
      { method: "MOMO", mobile_number: "+27845551234", country_iso: "ZA", is_primary: true },
    ],
  });
  check("PUT /business/beneficiaries/:associationId/:id", r.status, r.data);

  // ── Beneficiary tags ───────────────────────────────────────────────────────
  section("Beneficiary tags");

  r = await call("GET", `/v1/business/beneficiaries/${ASSOCIATION_ID}/${benId}/tags`, token);
  check("GET /business/beneficiaries/:associationId/:id/tags", r.status, r.data);

  r = await call("PUT", `/v1/business/beneficiaries/${ASSOCIATION_ID}/${benId}/tags`, token, {
    tags: ["smoke-test", "sdk"],
  });
  check("PUT /business/beneficiaries/:associationId/:id/tags", r.status, r.data);

  // ── Payment destinations ───────────────────────────────────────────────────
  section("Payment destinations");

  r = await call(
    "GET",
    `/v1/business/beneficiaries/${ASSOCIATION_ID}/${benId}/payment-destinations`,
    token,
  );
  check("GET /business/beneficiaries/:associationId/:id/payment-destinations", r.status, r.data);

  // Add a second destination
  r = await call(
    "POST",
    `/v1/business/beneficiaries/${ASSOCIATION_ID}/${benId}/payment-destinations`,
    token,
    { method: "MOMO", mobile_number: "+27845559999", country_iso: "ZA", is_primary: false },
  );
  check("POST /business/beneficiaries/:associationId/:id/payment-destinations", r.status, r.data);
  const createdDestId =
    (r.data as { data?: { payment_destination?: { id?: string } } })?.data?.payment_destination
      ?.id ??
    (r.data as { data?: { id?: string } })?.data?.id ??
    (r.data as { id?: string })?.id;
  console.log(`  ${DIM}created destination id: ${createdDestId ?? "none"}${RESET}`);

  if (createdDestId) {
    r = await call(
      "PUT",
      `/v1/business/beneficiaries/${ASSOCIATION_ID}/${benId}/payment-destinations/${createdDestId}`,
      token,
      { method: "MOMO", mobile_number: "+27845558888", country_iso: "ZA", is_primary: false },
    );
    check(
      "PUT /business/beneficiaries/:associationId/:id/payment-destinations/:destId",
      r.status,
      r.data,
    );

    r = await call(
      "PUT",
      `/v1/business/beneficiaries/${ASSOCIATION_ID}/${benId}/payment-destinations/${createdDestId}/primary`,
      token,
    );
    check(
      "PUT /business/beneficiaries/:associationId/:id/payment-destinations/:destId/primary",
      r.status,
      r.data,
    );

    r = await call(
      "DELETE",
      `/v1/business/beneficiaries/${ASSOCIATION_ID}/${benId}/payment-destinations/${createdDestId}`,
      token,
    );
    check(
      "DELETE /business/beneficiaries/:associationId/:id/payment-destinations/:destId",
      r.status,
      r.data,
    );
  } else {
    console.log(
      `  ${YELLOW}– payment destination update/primary/delete skipped — no destId${RESET}`,
    );
  }

  // ── Available connectors ───────────────────────────────────────────────────
  section("Available connectors for a beneficiary");

  r = await call(
    "GET",
    `/v1/business/beneficiaries/getAvailableConnectors/${ASSOCIATION_ID}/${benId}/MOMO`,
    token,
  );
  check(
    "GET /business/beneficiaries/getAvailableConnectors/:assocId/:benId/:method",
    r.status,
    r.data,
  );

  // ── Cleanup ────────────────────────────────────────────────────────────────
  if (createdBeneficiaryId) {
    section("Cleanup");
    r = await call(
      "DELETE",
      `/v1/business/beneficiaries/${ASSOCIATION_ID}/${createdBeneficiaryId}`,
      token,
    );
    check("DELETE /business/beneficiaries/:associationId/:id", r.status, r.data);
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
