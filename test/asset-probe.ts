#!/usr/bin/env npx tsx
/**
 * Usage:
 *   ZEAM_TEST_MOBILE=+27123456789 npx tsx test/asset-probe.ts
 */

import * as readline from "node:readline/promises";
import { getRawToken } from "./session-helper.js";

try { process.loadEnvFile(new URL(".env", import.meta.url)); } catch {}

const BASE = "https://api-gateway.zeam.app";

async function call(method: string, path: string, token: string): Promise<void> {
  console.log(`\n${"━".repeat(64)}`);
  console.log(`REQUEST  ${method} ${path}`);
  console.log("─".repeat(64));

  const start = Date.now();
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const ms = Date.now() - start;

  const raw = await resp.text();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = raw; }

  console.log(`\nRESPONSE  ${resp.status} ${resp.statusText}  (${ms}ms)`);
  console.log("─".repeat(64));
  console.log(JSON.stringify(parsed, null, 2));
}

async function main(): Promise<void> {
  const mobile = process.env.ZEAM_TEST_MOBILE;
  if (!mobile) { console.error("set ZEAM_TEST_MOBILE=+<number>"); process.exit(1); }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const token = await getRawToken(mobile, rl);
  rl.close();
  console.log(`\nauth OK  token=…${token.slice(-8)}`);

  await call("GET", "/v1/business/asset/bb2c3d4e-5f6a-789b-bbbb-ccddeeff0011", token);
  await call("GET", "/v1/business/asset/dto/1c46a28a-47a9-45bb-9765-37c05361ac35", token);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
