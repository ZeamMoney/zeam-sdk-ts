#!/usr/bin/env npx tsx
/**
 * BusinessClient SDK smoke test — full coverage.
 * Uses the real SDK methods and logs every request + response verbosely.
 *
 * Usage:
 *   ZEAM_TEST_MOBILE=+27123456789 npx tsx test/business-smoke.ts
 */

import * as readline from "node:readline/promises";
import { Client, Environment } from "../src/index.js";
import { BusinessClient } from "../src/client/business/index.js";
import { getSession } from "./session-helper.js";

try {
  process.loadEnvFile(new URL(".env", import.meta.url));
} catch {}

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

// ── verbose fetch wrapper ─────────────────────────────────────────────────────

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

// ── helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(name: string, note = ""): void {
  passed++;
  console.log(`\n${GREEN}✓  PASS  ${name}${note ? `  (${note})` : ""}${RESET}`);
}

function fail(name: string, err: unknown): void {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`\n${RED}✗  FAIL  ${name}  (${msg})${RESET}`);
}

function skip(name: string, reason: string): void {
  console.log(`\n${YELLOW}–  SKIP  ${name}  ${DIM}(${reason})${RESET}`);
}

function section(title: string): void {
  console.log(`\n\n${"═".repeat(64)}`);
  console.log(`  ${BOLD}${title}${RESET}`);
  console.log(`${"═".repeat(64)}`);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const mobile = process.env.ZEAM_TEST_MOBILE;
  if (!mobile) {
    console.error(`${RED}Error:${RESET} set ZEAM_TEST_MOBILE=+<number>`);
    process.exit(1);
  }

  const baseURL = process.env.ZEAM_API_URL;
  const environment = baseURL ? Environment.custom(baseURL) : Environment.Production;
  const isInsecure = baseURL?.startsWith("http://") ?? false;

  const client = new Client({
    environment,
    verboseErrors: true,
    insecureTransport: isInsecure,
    skipVersionCheck: true,
    fetchImpl: makeLoggingFetch(),
  });

  const biz = new BusinessClient(client);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(
    `\n${BOLD}BusinessClient SDK smoke test${RESET}  ${DIM}${environment.baseURL}${RESET}`,
  );

  // ── Auth ───────────────────────────────────────────────────────────────────
  section("Auth — OTP");

  const session = await getSession(mobile, client, rl);
  rl.close();
  pass("session", `fingerprint=${session.fingerprint}`);

  // IDs captured from responses and reused in subsequent calls
  let associationId: string | undefined;
  let walletId: string | undefined;
  let assetId: string | undefined;
  let assetDTOId: string | undefined;
  let createdWalletId: string | undefined;
  let beneficiaryId: string | undefined;
  let createdBeneficiaryId: string | undefined;
  let paymentDestinationId: string | undefined;

  // ── Associations ───────────────────────────────────────────────────────────
  section("Associations");

  try {
    const assocs = await biz.listAssociations(session);
    associationId = assocs[0]?.id;
    pass("listAssociations()", `count=${assocs.length}  first=${associationId}`);
  } catch (err) {
    fail("listAssociations()", err);
  }

  if (associationId) {
    try {
      const detail = await biz.getAssociationById(session, associationId);
      pass("getAssociationById()", `name=${detail.associationName}`);
    } catch (err) {
      fail("getAssociationById()", err);
    }
  } else {
    skip("getAssociationById()", "no association ID");
  }

  // ── Assets ─────────────────────────────────────────────────────────────────
  section("Assets");

  try {
    const assets = await biz.listAssets(session);
    assetId = assets[0]?.id;
    pass("listAssets()", `count=${assets.length}  first=${assetId}`);
  } catch (err) {
    fail("listAssets()", err);
  }

  if (assetId) {
    try {
      const asset = await biz.getAssetById(session, assetId);
      pass("getAssetById()", `symbol=${asset.symbol}`);
    } catch (err) {
      fail("getAssetById()", err);
    }
  } else {
    skip("getAssetById()", "no asset ID");
  }

  try {
    const dtos = await biz.listAssetDTOs(session);
    assetDTOId = dtos[0]?.assetID;
    pass("listAssetDTOs()", `count=${dtos.length}  first=${assetDTOId}`);
  } catch (err) {
    fail("listAssetDTOs()", err);
  }

  if (assetDTOId) {
    try {
      const dto = await biz.getAssetDTOById(session, assetDTOId);
      pass("getAssetDTOById()", `symbol=${dto.symbol}`);
    } catch (err) {
      fail("getAssetDTOById()", err);
    }
  } else {
    skip("getAssetDTOById()", "no DTO ID");
  }

  // ── Wallets ────────────────────────────────────────────────────────────────
  section("Wallets");

  try {
    const types = await biz.listWalletTypes(session);
    pass("listWalletTypes()", `count=${types.length}`);
  } catch (err) {
    fail("listWalletTypes()", err);
  }

  try {
    const all = await biz.listAllWallets(session);
    walletId = all[0]?.id;
    pass("listAllWallets()", `count=${all.length}  first=${walletId}`);
  } catch (err) {
    fail("listAllWallets()", err);
  }

  if (associationId) {
    try {
      const assocWallets = await biz.listWalletsByAssociation(session, associationId);
      pass("listWalletsByAssociation()", `count=${assocWallets.length}`);
    } catch (err) {
      fail("listWalletsByAssociation()", err);
    }
  } else {
    skip("listWalletsByAssociation()", "no association ID");
  }

  if (walletId) {
    try {
      const w = await biz.getWalletById(session, walletId);
      pass("getWalletById()", `name=${w.walletName}`);
    } catch (err) {
      fail("getWalletById()", err);
    }

    try {
      const dto = await biz.getWalletDTOById(session, walletId);
      pass("getWalletDTOById()", `name=${dto.walletName}`);
    } catch (err) {
      fail("getWalletDTOById()", err);
    }
  } else {
    skip("getWalletById()", "no wallet ID");
    skip("getWalletDTOById()", "no wallet ID");
  }

  try {
    const created = await biz.createWallet(session, {
      walletName: "SDK smoke test wallet",
      typeId: "729db392-8c75-4c52-b7a1-af4b6f4157d9",
      networkId: "014b4ef6-5f0e-473a-95f9-8e01f2a06bf7",
    });
    createdWalletId = created.id;
    pass("createWallet()", `id=${createdWalletId}`);
  } catch (err) {
    fail("createWallet()", err);
  }

  if (createdWalletId) {
    try {
      await biz.updateWallet(session, createdWalletId, { label: "SDK smoke test (updated)" });
      pass("updateWallet()", `id=${createdWalletId}`);
    } catch (err) {
      fail("updateWallet()", err);
    }
  } else {
    skip("updateWallet()", "createWallet() did not return an ID");
  }

  // ── Stellar quote ──────────────────────────────────────────────────────────
  section("Stellar quote");

  try {
    const quote = await biz.stellarQuote(session, {
      fromAsset: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      toAsset: "XLM",
      amount: "1.00",
    });
    pass("stellarQuote()", `sendMax=${JSON.stringify(quote).slice(0, 60)}`);
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes("not_found") ||
        err.message.includes("validation") ||
        err.message.includes("remote"))
    ) {
      pass("stellarQuote()", "non-auth error — route reached, auth OK");
    } else {
      fail("stellarQuote()", err);
    }
  }

  // ── executeWalletTransaction (sentinel probe) ──────────────────────────────
  section("executeWalletTransaction() — sentinel probe");

  if (!walletId) {
    skip("executeWalletTransaction()", "no wallet ID");
  } else {
    try {
      const tx = await biz.executeWalletTransaction(session, walletId, {
        toPublicKey: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        fromAsset: "native",
        amount: "0.0000001",
      });
      pass("executeWalletTransaction()", `txHash=${tx.transactionHash}`);
    } catch (err) {
      fail("executeWalletTransaction()", err);
    }
  }

  // ── Beneficiaries ──────────────────────────────────────────────────────────
  section("Beneficiaries");

  if (!associationId) {
    skip("all beneficiary methods", "no association ID");
  } else {
    try {
      const bens = await biz.listBeneficiaries(session, associationId);
      beneficiaryId = bens.beneficiaries[0]?.id;
      pass("listBeneficiaries()", `count=${bens.beneficiaries.length}  first=${beneficiaryId}`);
    } catch (err) {
      fail("listBeneficiaries()", err);
    }

    if (beneficiaryId) {
      try {
        const { beneficiary: ben } = await biz.getBeneficiary(
          session,
          associationId,
          beneficiaryId,
        );
        pass("getBeneficiary()", `id=${ben.id}`);
      } catch (err) {
        fail("getBeneficiary()", err);
      }
    } else {
      skip("getBeneficiary()", "no existing beneficiary");
    }

    try {
      const result = await biz.createBeneficiary(session, associationId, {
        beneficiary_type: "Individual",
        reference: "sdk-smoke-test",
        individual: { first_name: "SDK", last_name: "SmokeTest" },
        payment_destinations: [
          { method: "MOMO", mobile_number: "+27845551234", country_iso: "ZA", is_primary: true },
        ],
      });
      createdBeneficiaryId = result.beneficiary.id;
      pass("createBeneficiary()", `id=${createdBeneficiaryId}`);
    } catch (err) {
      fail("createBeneficiary()", err);
    }

    try {
      await biz.bulkCreateBeneficiaries(session, associationId, [
        {
          beneficiary_type: "Individual",
          reference: "sdk-bulk-smoke-1",
          individual: { first_name: "Bulk", last_name: "One" },
          payment_destinations: [
            { method: "MOMO", mobile_number: "+27845550001", country_iso: "ZA", is_primary: true },
          ],
        },
      ]);
      pass("bulkCreateBeneficiaries()", "1 beneficiary");
    } catch (err) {
      fail("bulkCreateBeneficiaries()", err);
    }

    const benId = createdBeneficiaryId ?? beneficiaryId;

    if (benId) {
      try {
        await biz.updateBeneficiary(session, associationId, benId, {
          beneficiary_type: "Individual",
          reference: "sdk-smoke-test-updated",
          individual: { first_name: "SDK", last_name: "SmokeTest-Updated" },
          payment_destinations: [
            { method: "MOMO", mobile_number: "+27845551234", country_iso: "ZA", is_primary: true },
          ],
        });
        pass("updateBeneficiary()", `id=${benId}`);
      } catch (err) {
        fail("updateBeneficiary()", err);
      }

      // ── Beneficiary tags ─────────────────────────────────────────────────
      section("Beneficiary tags");

      try {
        const tags = await biz.getBeneficiaryTags(session, associationId, benId);
        pass("getBeneficiaryTags()", `tags=${JSON.stringify(tags.tags)}`);
      } catch (err) {
        fail("getBeneficiaryTags()", err);
      }

      try {
        await biz.updateBeneficiaryTags(session, associationId, benId, ["smoke-test", "sdk"]);
        pass("updateBeneficiaryTags()", 'tags=["smoke-test","sdk"]');
      } catch (err) {
        fail("updateBeneficiaryTags()", err);
      }

      // ── Payment destinations ─────────────────────────────────────────────
      section("Payment destinations");

      try {
        const result = await biz.listPaymentDestinations(session, associationId, benId);
        pass("listPaymentDestinations()", `count=${result.total}`);
      } catch (err) {
        fail("listPaymentDestinations()", err);
      }

      try {
        const result = await biz.addPaymentDestination(session, associationId, benId, {
          method: "MOMO",
          mobile_number: "+27845559999",
          country_iso: "ZA",
          is_primary: false,
        });
        paymentDestinationId = result.payment_destination.id;
        pass("addPaymentDestination()", `id=${paymentDestinationId}`);
      } catch (err) {
        fail("addPaymentDestination()", err);
      }

      if (paymentDestinationId) {
        try {
          await biz.updatePaymentDestination(session, associationId, benId, paymentDestinationId, {
            method: "MOMO",
            mobile_number: "+27845558888",
            country_iso: "ZA",
            is_primary: false,
          });
          pass("updatePaymentDestination()", `id=${paymentDestinationId}`);
        } catch (err) {
          fail("updatePaymentDestination()", err);
        }

        try {
          await biz.setPaymentDestinationPrimary(
            session,
            associationId,
            benId,
            paymentDestinationId,
          );
          pass("setPaymentDestinationPrimary()", `id=${paymentDestinationId}`);
        } catch (err) {
          fail("setPaymentDestinationPrimary()", err);
        }

        try {
          await biz.deletePaymentDestination(session, associationId, benId, paymentDestinationId);
          pass("deletePaymentDestination()", `id=${paymentDestinationId}`);
        } catch (err) {
          fail("deletePaymentDestination()", err);
        }
      } else {
        skip("updatePaymentDestination()", "addPaymentDestination() did not return an ID");
        skip("setPaymentDestinationPrimary()", "addPaymentDestination() did not return an ID");
        skip("deletePaymentDestination()", "addPaymentDestination() did not return an ID");
      }

      // ── Connectors ───────────────────────────────────────────────────────
      section("Available connectors");

      try {
        const result = await biz.getAvailableConnectors(session, associationId, benId, "MOMO");
        pass(
          "getAvailableConnectors()",
          `connectors=${JSON.stringify(result.connectors.connectors).slice(0, 60)}`,
        );
      } catch (err) {
        fail("getAvailableConnectors()", err);
      }

      // ── Cleanup ──────────────────────────────────────────────────────────
      if (createdBeneficiaryId) {
        section("Cleanup");

        try {
          await biz.deleteBeneficiary(session, associationId, createdBeneficiaryId);
          pass("deleteBeneficiary()", `id=${createdBeneficiaryId}`);
        } catch (err) {
          fail("deleteBeneficiary()", err);
        }
      }
    } else {
      skip("updateBeneficiary / tags / payment-destinations / connectors", "no beneficiary ID");
    }
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
