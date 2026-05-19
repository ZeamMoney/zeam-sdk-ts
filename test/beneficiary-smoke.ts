#!/usr/bin/env npx tsx
/**
 * Beneficiary CRUD smoke test.
 * Logs every request and response in full — method, URL, headers, body.
 *
 * Usage:
 *   ZEAM_TEST_MOBILE=+27123456789 npx tsx test/beneficiary-smoke.ts
 */

import * as readline from "node:readline/promises";
import { getRawToken } from "./session-helper.js";

try { process.loadEnvFile(new URL(".env", import.meta.url)); } catch {}

const BASE = "https://api-gateway.zeam.app";
const ASSOCIATION_ID = process.env.ZEAM_TEST_ASSOCIATION_ID ?? "";

const BOLD  = "\x1b[1m";
const DIM   = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED   = "\x1b[31m";
const CYAN  = "\x1b[36m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

// ── verbose fetch ─────────────────────────────────────────────────────────────

async function call(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/json",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  // ── print request ──────────────────────────────────────────────────────────
  console.log(`\n${BOLD}${CYAN}> ${method} ${url}${RESET}`);
  for (const [k, v] of Object.entries(headers)) {
    const display = k === "Authorization" ? `Bearer ${token.slice(0, 20)}…` : v;
    console.log(`${DIM}> ${k}: ${display}${RESET}`);
  }
  if (body !== undefined) {
    console.log(`${DIM}>${RESET}`);
    console.log(
      JSON.stringify(body, null, 2)
        .split("\n")
        .map((l) => `${DIM}> ${l}${RESET}`)
        .join("\n"),
    );
  }

  // ── send ───────────────────────────────────────────────────────────────────
  const resp = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const raw = await resp.text();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = raw; }

  // ── print response ─────────────────────────────────────────────────────────
  const statusColor = resp.status < 300 ? GREEN : resp.status < 500 ? YELLOW : RED;
  console.log(`\n${statusColor}< HTTP/1.1 ${resp.status} ${resp.statusText}${RESET}`);
  resp.headers.forEach((v, k) => {
    console.log(`${DIM}< ${k}: ${v}${RESET}`);
  });
  console.log(`${DIM}<${RESET}`);
  console.log(
    JSON.stringify(parsed, null, 2)
      .split("\n")
      .map((l) => `${DIM}< ${l}${RESET}`)
      .join("\n"),
  );

  return { status: resp.status, data: parsed };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const mobile = process.env.ZEAM_TEST_MOBILE;
  if (!mobile) {
    console.error(`${RED}Error:${RESET} set ZEAM_TEST_MOBILE=+<number>`);
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // ── Auth ───────────────────────────────────────────────────────────────────
  const token = await getRawToken(mobile, rl);
  rl.close();
  console.log(`\n  ${GREEN}✓ Authenticated${RESET}`);

  // ── 3. List beneficiaries ──────────────────────────────────────────────────
  console.log(`\n${BOLD}── 3. List beneficiaries ${"─".repeat(37)}${RESET}`);
  await call("GET", `/v1/business/beneficiaries/${ASSOCIATION_ID}`, token);

  // ── 4. Create beneficiary ──────────────────────────────────────────────────
  console.log(`\n${BOLD}── 4. Create beneficiary ${"─".repeat(37)}${RESET}`);
  const createResp = await call(
    "POST",
    `/v1/business/beneficiaries/${ASSOCIATION_ID}`,
    token,
    {
      beneficiary_type: "Individual",
      reference: "sdk-smoke-test",
      individual: {
        first_name: "SDK",
        last_name: "SmokeTest",
      },
      payment_destinations: [
        {
          method: "MOMO",
          mobile_number: "+27845551234",
          country_iso: "ZA",
          is_primary: true,
        },
      ],
    },
  );

  const body = createResp.data as Record<string, unknown>;
  const dataField = body?.data as Record<string, unknown> | undefined;
  const beneficiaryId =
    (body?.id as string) ??
    (dataField?.id as string) ??
    ((dataField?.beneficiary as Record<string, unknown>)?.id as string);

  if (!beneficiaryId) {
    console.error(`\n${RED}No beneficiary ID in create response — stopping.${RESET}`);
    process.exit(1);
  }
  console.log(`\n  ${GREEN}✓ BENEFICIARY_ID=${beneficiaryId}${RESET}`);

  // ── 5. Get beneficiary ─────────────────────────────────────────────────────
  console.log(`\n${BOLD}── 5. Get beneficiary ${"─".repeat(40)}${RESET}`);
  await call("GET", `/v1/business/beneficiaries/${ASSOCIATION_ID}/${beneficiaryId}`, token);

  // ── 6. Update beneficiary ──────────────────────────────────────────────────
  console.log(`\n${BOLD}── 6. Update beneficiary ${"─".repeat(37)}${RESET}`);
  await call(
    "PUT",
    `/v1/business/beneficiaries/${ASSOCIATION_ID}/${beneficiaryId}`,
    token,
    {
      beneficiary_type: "Individual",
      reference: "sdk-smoke-test-updated",
      individual: {
        first_name: "SDK",
        last_name: "SmokeTest-Updated",
      },
      payment_destinations: [
        {
          method: "MOMO",
          mobile_number: "+27845551234",
          country_iso: "ZA",
          is_primary: true,
        },
      ],
    },
  );

  // ── 7. List payment destinations ───────────────────────────────────────────
  console.log(`\n${BOLD}── 7. List payment destinations ${"─".repeat(30)}${RESET}`);
  await call(
    "GET",
    `/v1/business/beneficiaries/${ASSOCIATION_ID}/${beneficiaryId}/payment-destinations`,
    token,
  );

  // ── 8. Delete beneficiary ──────────────────────────────────────────────────
  console.log(`\n${BOLD}── 8. Delete beneficiary ${"─".repeat(37)}${RESET}`);
  await call("DELETE", `/v1/business/beneficiaries/${ASSOCIATION_ID}/${beneficiaryId}`, token);

  console.log(`\n${GREEN}${BOLD}Done.${RESET}\n`);
}

main().catch((err) => {
  console.error(`\n${RED}Fatal:${RESET}`, err);
  process.exit(1);
});
