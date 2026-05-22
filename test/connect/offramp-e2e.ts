#!/usr/bin/env npx tsx
/**
 * End-to-end OffRamp penny test.
 *
 * 1. Business auth (OTP) → find wallet "zarz_account"
 * 2. Connect auth (SEP-10) → get a 1 ZARZ quote
 * 3. Business wallet transaction → send ZARZ to Connect clearing account
 * 4. Connect offramp → deliver ZAR to bank account
 *
 * Usage:
 *   ZEAM_TEST_MOBILE=+27...                  \
 *   ZEAM_STELLAR_SEED=S...                  \
 *   ZEAM_STELLAR_PUBLIC_KEY=G...            \
 *   ZEAM_CONNECT_SECRET=<secret>            \
 *   BANK_ACCOUNT_NUMBER=...                 \
 *   BANK_BRANCH_CODE=...                    \
 *   BANK_ACCOUNT_NAME="Your Name"           \
 *   BANK_ACCOUNT_TYPE=Savings               \
 *   SENDER_FIRST_NAME=Your                  \
 *   SENDER_LAST_NAME=Name                   \
 *   SENDER_MSISDN=27...                     \
 *   SENDER_ID_NUMBER=...                    \
 *   npx tsx test/connect/offramp-e2e.ts
 */

import * as readline from "node:readline/promises";
import { Client, Environment } from "../../src/index.js";
import { BusinessClient } from "../../src/client/business/index.js";
import { ConnectClient } from "../../src/client/connect/index.js";
import type { OffRampRequest, QuoteResponse } from "../../src/client/connect/index.js";

import { getSession } from "../session-helper.js";

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {}

// ── Config ────────────────────────────────────────────────────────────────────

const mobile = process.env.ZEAM_TEST_MOBILE!;
const seed = process.env.ZEAM_STELLAR_SEED!;
const pubkey = process.env.ZEAM_STELLAR_PUBLIC_KEY!;
const connectSecret = process.env.ZEAM_CONNECT_SECRET!;

// Bank details for the offramp payout
const bankAccountNumber = process.env.BANK_ACCOUNT_NUMBER!;
const bankBranchCode = process.env.BANK_BRANCH_CODE!;
const bankAccountName = process.env.BANK_ACCOUNT_NAME!;
const bankAccountType = process.env.BANK_ACCOUNT_TYPE ?? "Savings";

// Sender KYC
const senderFirstName = process.env.SENDER_FIRST_NAME!;
const senderLastName = process.env.SENDER_LAST_NAME!;
const senderMsisdn = process.env.SENDER_MSISDN!;
const senderIdNumber = process.env.SENDER_ID_NUMBER ?? "0000000000000";

const WALLET_NAME = process.env.WALLET_NAME ?? "zarz_account";
const CONNECTOR_ID = process.env.ZEAM_TEST_CONNECTOR_ID ?? "";
const AMOUNT = 1; // 1 ZARZ send + 1 ZARZ fee = 2 ZARZ total

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
  console.error(`Missing env vars: ${missing.join(", ")}`);
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${BOLD}OffRamp E2E Penny Test${RESET}`);
  console.log(`${DIM}Amount: ${AMOUNT} ZARZ → ${AMOUNT} ZAR to bank${RESET}`);
  console.log(`${DIM}Connector: South Africa Bank EFT${RESET}\n`);

  const client = new Client({
    environment: Environment.Production,
    verboseErrors: true,
    skipVersionCheck: true,
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    // ── Step 1: Business auth ───────────────────────────────────────────────
    step(1, "Business auth (OTP)");
    const bizSession = await getSession(mobile, client, rl);
    console.log(`${GREEN}✓ Business session: track=${bizSession.track}${RESET}`);

    const biz = new BusinessClient(client);

    // ── Step 2: Find wallet ─────────────────────────────────────────────────
    step(2, `Find wallet "${WALLET_NAME}"`);
    const associations = await biz.listAssociations(bizSession);
    console.log(`${DIM}  associations: ${associations.length}${RESET}`);

    let wallet: { id: string; publicKey: string; walletName: string } | undefined;
    for (const assoc of associations) {
      const wallets = await biz.listWalletsByAssociation(bizSession, assoc.id);
      wallet = wallets.find((w) => w.walletName === WALLET_NAME);
      if (wallet) {
        console.log(`${GREEN}✓ Found wallet "${wallet.walletName}" (${wallet.id})${RESET}`);
        console.log(`${DIM}  publicKey: ${wallet.publicKey}${RESET}`);
        console.log(`${DIM}  association: ${assoc.associationName} (${assoc.id})${RESET}`);
        break;
      }
    }
    if (!wallet) {
      console.error(`${RED}✗ No wallet named "${WALLET_NAME}" found${RESET}`);
      process.exit(1);
    }

    // ── Step 3: Connect auth + quote ────────────────────────────────────────
    step(3, `Connect auth + quote (${AMOUNT} ZARZ)`);
    const connectSession = await client.sep10.signIn(pubkey, seed);
    console.log(`${GREEN}✓ Connect session: track=${connectSession.track}${RESET}`);

    const connect = new ConnectClient(client, connectSecret);
    const quote: QuoteResponse = await connect.getDirectionalQuote(connectSession, "Send", {
      connectorId: CONNECTOR_ID,
      amount: AMOUNT,
    });
    console.log(`${GREEN}✓ Quote created${RESET}`);
    console.log(`${DIM}  quoteId:    ${quote.quoteId}${RESET}`);
    console.log(`${DIM}  send:       ${quote.sendAmount} ${quote.sendCurrency}${RESET}`);
    console.log(`${DIM}  fee:        ${quote.fee} ${quote.feeCurrency}${RESET}`);
    console.log(`${DIM}  total:      ${quote.total} ${quote.sendCurrency}${RESET}`);
    console.log(`${DIM}  receive:    ${quote.receiveAmount} ${quote.receiveCurrency}${RESET}`);
    console.log(`${DIM}  expires:    ${quote.expiresAt}${RESET}`);
    console.log(`${DIM}  destination: ${quote.fundingInstructions?.destinationAccount}${RESET}`);
    console.log(`${DIM}  memo:       ${quote.fundingInstructions?.memo}${RESET}`);
    console.log(
      `${DIM}  asset:      ${quote.fundingInstructions?.asset.code}:${quote.fundingInstructions?.asset.issuer}${RESET}`,
    );

    // ── Step 4: Confirm ─────────────────────────────────────────────────────
    step(4, "Confirm");
    console.log(
      `  Will send ${BOLD}${quote.total} ZARZ${RESET} from wallet "${wallet.walletName}"`,
    );
    console.log(`  To Connect clearing account: ${quote.fundingInstructions?.destinationAccount}`);
    console.log(
      `  Bank payout: ${quote.receiveAmount} ZAR → ${bankAccountName} (${bankAccountNumber})`,
    );
    const confirm = (await rl.question(`\n  ${BOLD}Proceed? (y/N): ${RESET}`)).trim().toLowerCase();
    if (confirm !== "y") {
      console.log("Aborted.");
      process.exit(0);
    }

    // ── Step 5: Stellar wallet transaction ──────────────────────────────────
    step(5, "Execute Stellar payment via Business wallet");
    const funding = quote.fundingInstructions!;
    const txResult = await biz.executeWalletTransaction(bizSession, wallet.id, {
      toPublicKey: funding.destinationAccount,
      fromAsset: `${funding.asset.code}:${funding.asset.issuer}`,
      amount: String(quote.total),
      memo: funding.memo,
      memoType: funding.memoType,
    });
    console.log(`${GREEN}✓ Stellar transaction submitted${RESET}`);
    console.log(`${DIM}  txHash: ${txResult.transactionHash}${RESET}`);
    console.log(`${DIM}  amount: ${txResult.amount} ${txResult.asset}${RESET}`);

    // ── Step 6: Connect offramp ─────────────────────────────────────────────
    step(6, "Execute Connect offramp");
    const offRampBody: OffRampRequest = {
      reference: `e2e-${Date.now().toString(36)}`,
      quoteId: quote.quoteId,
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
    };

    const offRampResult = await connect.executeOffRamp(connectSession, offRampBody);
    console.log(`${GREEN}✓ OffRamp executed${RESET}`);
    console.log(`${DIM}  transactionId: ${offRampResult.transactionId}${RESET}`);
    console.log(`${DIM}  status:        ${offRampResult.status}${RESET}`);
    console.log(`${DIM}  connectorId:   ${offRampResult.connectorId}${RESET}`);

    // ── Step 7: Poll status ─────────────────────────────────────────────────
    step(7, "Poll transaction status");
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const status = await connect.getConnectStatus(connectSession, offRampResult.transactionId);
        console.log(`  [${i + 1}] status: ${status.status}`);
        if (status.status === "Successful") {
          console.log(
            `\n${GREEN}${BOLD}✓ OffRamp complete! ${quote.receiveAmount} ZAR sent to ${bankAccountName}${RESET}`,
          );
          return;
        }
        if (status.status === "Failed" || status.status === "RefundFailed") {
          console.log(`\n${RED}✗ OffRamp failed: ${status.status}${RESET}`);
          return;
        }
      } catch (err) {
        console.log(`  [${i + 1}] poll error: ${err instanceof Error ? err.message : err}`);
      }
    }
    console.log(
      `\n${DIM}  (stopped polling — check status manually: GET /v1/connect-status/${offRampResult.transactionId})${RESET}`,
    );
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`\n${RED}Fatal:${RESET}`, err);
  process.exit(1);
});
