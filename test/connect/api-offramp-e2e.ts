#!/usr/bin/env npx tsx
/**
 * End-to-end OffRamp penny test — raw fetch, no SDK.
 * Mirrors offramp-e2e.ts but uses direct API calls to verify
 * the gateway returns the same results as the SDK.
 *
 * Usage: same env vars as offramp-e2e.ts (see that file for details).
 */

import * as readline from "node:readline/promises";
import { getSep10Token } from "../session-helper.js";
import { getSession } from "../session-helper.js";
import { Client, Environment } from "../../src/index.js";
import { BusinessClient } from "../../src/client/business/index.js";

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {}

const BASE = "https://api-gateway.zeam.app";

// ── Config ────────────────────────────────────────────────────────────────────

const mobile = process.env.ZEAM_TEST_MOBILE!;
const seed = process.env.ZEAM_STELLAR_SEED!;
const pubkey = process.env.ZEAM_STELLAR_PUBLIC_KEY!;
const connectSecret = process.env.ZEAM_CONNECT_SECRET!;

const bankAccountNumber = process.env.BANK_ACCOUNT_NUMBER!;
const bankBranchCode = process.env.BANK_BRANCH_CODE!;
const bankAccountName = process.env.BANK_ACCOUNT_NAME!;
const bankAccountType = process.env.BANK_ACCOUNT_TYPE ?? "Savings";

const senderFirstName = process.env.SENDER_FIRST_NAME!;
const senderLastName = process.env.SENDER_LAST_NAME!;
const senderMsisdn = process.env.SENDER_MSISDN!;
const senderIdNumber = process.env.SENDER_ID_NUMBER ?? "0000000000000";

const WALLET_NAME = process.env.WALLET_NAME ?? "";
const CONNECTOR_ID = process.env.ZEAM_TEST_CONNECTOR_ID ?? "";
const AMOUNT = 1;

const required = {
  mobile,
  seed,
  pubkey,
  connectSecret,
  bankAccountNumber,
  bankBranchCode,
  bankAccountName,
  senderFirstName,
  senderLastName,
  senderMsisdn,
};
const missing = Object.entries(required)
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  console.error(`Missing: ${missing.join(", ")}`);
  process.exit(1);
}

// ── ANSI ──────────────────────────────────────────────────────────────────────

const TTY = process.stdout.isTTY ?? false;
const c = (code: string) => (TTY ? code : "");
const BOLD = c("\x1b[1m");
const DIM = c("\x1b[2m");
const GREEN = c("\x1b[32m");
const RED = c("\x1b[31m");
const CYAN = c("\x1b[36m");
const RESET = c("\x1b[0m");

function step(n: number, title: string) {
  console.log(`\n${BOLD}${CYAN}── Step ${n}: ${title}${RESET}`);
}

// ── Transport ─────────────────────────────────────────────────────────────────

async function connectCall(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "x-zeam-auth": connectSecret,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const raw = await resp.text();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { raw } as Record<string, unknown>;
  }
  return { status: resp.status, data: parsed };
}

function pick<T>(obj: unknown, ...keys: string[]): T | undefined {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur as T;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${BOLD}OffRamp E2E — Raw API${RESET}`);
  console.log(`${DIM}Amount: ${AMOUNT} ZARZ → ${AMOUNT} ZAR to bank${RESET}\n`);

  const sdkClient = new Client({
    environment: Environment.Production,
    verboseErrors: true,
    skipVersionCheck: true,
  });
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    // ── Step 1: Business auth (SDK — needed for wallet tx) ────────────────────
    step(1, "Business auth (OTP)");
    const bizSession = await getSession(mobile, sdkClient, rl);
    console.log(`${GREEN}✓ Business session${RESET}`);
    const biz = new BusinessClient(sdkClient);

    // ── Step 2: Find wallet ──────────────────────────────────────────────────
    step(2, `Find wallet "${WALLET_NAME}"`);
    const assocs = await biz.listAssociations(bizSession);
    let wallet: { id: string; publicKey: string; walletName: string } | undefined;
    for (const a of assocs) {
      const wallets = await biz.listWalletsByAssociation(bizSession, a.id);
      wallet = wallets.find((w) => w.walletName === WALLET_NAME);
      if (wallet) break;
    }
    if (!wallet) {
      console.error(`${RED}✗ No wallet "${WALLET_NAME}"${RESET}`);
      process.exit(1);
    }
    console.log(`${GREEN}✓ ${wallet.walletName} (${wallet.publicKey.slice(0, 12)}…)${RESET}`);

    // ── Step 3: Connect auth + quote (raw API) ───────────────────────────────
    step(3, `Connect auth + quote (${AMOUNT} ZARZ)`);
    const token = await getSep10Token(pubkey, seed);
    console.log(`${GREEN}✓ SEP-10 token${RESET}`);

    const qr = await connectCall("POST", "/v1/connect-quote/Send", token, {
      ConnectorId: CONNECTOR_ID,
      Amount: AMOUNT,
    });
    if (qr.status !== 402 || !pick(qr.data, "data", "quoteId")) {
      console.error(`${RED}✗ Quote failed: ${qr.status} ${JSON.stringify(qr.data)}${RESET}`);
      process.exit(1);
    }
    const quoteId = pick<string>(qr.data, "data", "quoteId")!;
    const total = pick<number>(qr.data, "data", "total")!;
    const destAcct = pick<string>(qr.data, "data", "fundingInstructions", "destinationAccount")!;
    const memo = pick<string>(qr.data, "data", "fundingInstructions", "memo")!;
    const memoType = pick<string>(qr.data, "data", "fundingInstructions", "memoType")!;
    const assetCode = pick<string>(qr.data, "data", "fundingInstructions", "asset", "code")!;
    const assetIssuer = pick<string>(qr.data, "data", "fundingInstructions", "asset", "issuer")!;
    console.log(`${GREEN}✓ Quote: ${quoteId}  total: ${total} ZARZ${RESET}`);

    // ── Step 4: Confirm ──────────────────────────────────────────────────────
    step(4, "Confirm");
    console.log(
      `  ${total} ZARZ → ${destAcct.slice(0, 12)}…  bank: ${bankAccountName} (${bankAccountNumber})`,
    );
    const ok = (await rl.question(`\n  ${BOLD}Proceed? (y/N): ${RESET}`)).trim().toLowerCase();
    if (ok !== "y") {
      console.log("Aborted.");
      process.exit(0);
    }

    // ── Step 5: Stellar payment (SDK — Business wallet) ──────────────────────
    step(5, "Stellar payment via Business wallet");
    const txResult = await biz.executeWalletTransaction(bizSession, wallet.id, {
      toPublicKey: destAcct,
      fromAsset: `${assetCode}:${assetIssuer}`,
      amount: String(total),
      memo,
      memoType,
    });
    console.log(`${GREEN}✓ txHash: ${txResult.transactionHash}${RESET}`);

    // ── Step 6: Connect offramp (raw API) ────────────────────────────────────
    step(6, "POST /v1/connect-offramp (raw)");
    const or = await connectCall("POST", "/v1/connect-offramp", token, {
      reference: `api-${Date.now().toString(36)}`,
      quoteId,
      transactionHash: txResult.transactionHash,
      refundAccount: { account: wallet.publicKey },
      sender: {
        firstName: senderFirstName,
        lastname: senderLastName,
        msisdn: senderMsisdn,
        countryIsoCode: "ZA",
        dob: "1990-01-01",
        idType: "PASSPORT",
        idCountryIsoCode: "ZA",
        idNumber: senderIdNumber,
        sourceOfFunds: "SALARY",
      },
      bank: {
        accountNumber: bankAccountNumber,
        branchCode: bankBranchCode,
        accountName: bankAccountName,
        accountType: bankAccountType,
      },
    });
    if (or.status !== 200) {
      console.error(`${RED}✗ OffRamp failed: ${or.status} ${JSON.stringify(or.data)}${RESET}`);
      process.exit(1);
    }
    const txId = pick<string>(or.data, "data", "transactionId")!;
    const status = pick<string>(or.data, "data", "status")!;
    console.log(`${GREEN}✓ transactionId: ${txId}  status: ${status}${RESET}`);

    // ── Step 7: Poll status (raw API) ────────────────────────────────────────
    step(7, "Poll GET /v1/connect-status/:id");
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const sr = await connectCall("GET", `/v1/connect-status/${txId}`, token);
      const s = pick<string>(sr.data, "data", "status") ?? "unknown";
      console.log(`  [${i + 1}] ${s}`);
      if (s === "Successful") {
        console.log(`\n${GREEN}${BOLD}✓ R${AMOUNT} sent to ${bankAccountName}${RESET}`);
        return;
      }
      if (s === "Failed" || s === "RefundFailed") {
        console.log(`\n${RED}✗ ${s}${RESET}`);
        return;
      }
    }
    console.log(`${DIM}  (poll timeout — check manually)${RESET}`);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`\n${RED}Fatal:${RESET}`, err);
  process.exit(1);
});
