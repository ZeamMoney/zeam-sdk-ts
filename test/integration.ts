#!/usr/bin/env npx tsx
/**
 * End-to-end integration smoke test. Exercises every SDK call against the
 * live gateway. The Business OTP flow is interactive — it pauses and waits
 * for you to type the code sent to your phone.
 *
 * Usage:
 *   ZEAM_TEST_MOBILE=+27821234567 npx tsx test/integration.ts
 *
 * Optional env vars:
 *   ZEAM_API_URL          Override the base URL (default: Production)
 *   ZEAM_TEST_MOBILE      Your mobile number for OTP (required)
 *   ZEAM_TEST_APP_SEED    Stellar seed for SEP-10 tests (skips that section if absent)
 *   ZEAM_TEST_APP_PUBKEY  Stellar public key matching the seed
 *   ZEAM_TEST_CONNECT_SECRET  Connect secret for Connect-track tests
 */

import * as readline from "node:readline/promises";
import { Client, Environment, ZeamError, Kind } from "../src/index.js";
import { ApplicationClient } from "../src/client/application/index.js";
import { BusinessClient } from "../src/client/business/index.js";
import { HealthClient } from "../src/client/health/index.js";
// import { PaymentsClient } from "../src/client/payments/index.js"; // not yet implemented — see docs/payments.md
// import { ReportsClient } from "../src/client/reports/index.js";   // not yet implemented — see docs/reports.md
import { Session, Track } from "../src/auth/index.js";

try { process.loadEnvFile(new URL(".env", import.meta.url)); } catch {}

// ─── helpers ────────────────────────────────────────────────────────────────

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

let passed = 0;
let failed = 0;
let skipped = 0;

function section(title: string): void {
  console.log(`\n${BOLD}── ${title} ${"─".repeat(Math.max(0, 60 - title.length))}${RESET}`);
}

function pass(name: string, note = ""): void {
  passed++;
  console.log(`  ${GREEN}✓${RESET} ${name}${note ? `  ${DIM}${note}${RESET}` : ""}`);
}

function fail(name: string, err: unknown): void {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`  ${RED}✗${RESET} ${name}`);
  console.log(`    ${DIM}${msg}${RESET}`);
}

function skip(name: string, reason: string): void {
  skipped++;
  console.log(`  ${YELLOW}–${RESET} ${name}  ${DIM}(${reason})${RESET}`);
}

function isZeamError(err: unknown, kind: Kind): boolean {
  return err instanceof ZeamError && err.is(kind);
}

async function ask(rl: readline.Interface, prompt: string): Promise<string> {
  return rl.question(`  ${YELLOW}?${RESET} ${prompt}`);
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const mobile = process.env.ZEAM_TEST_MOBILE;
  if (!mobile) {
    console.error(`${RED}Error:${RESET} set ZEAM_TEST_MOBILE=+<number> before running`);
    process.exit(1);
  }

  const baseURL = process.env.ZEAM_API_URL;
  const environment = baseURL
    ? Environment.custom(baseURL)
    : Environment.Production;

  const isInsecure = baseURL?.startsWith("http://") ?? false;

  const client = new Client({
    environment,
    verboseErrors: true,
    insecureTransport: isInsecure,
    skipVersionCheck: true,
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(`\n${BOLD}Zeam SDK integration test${RESET}  ${DIM}${environment.baseURL}${RESET}`);

  let businessSession: Session | undefined;
  let firstAssociationId: string | undefined;
  let firstWalletId: string | undefined;
  let firstWalletPubKey: string | undefined;

  // ── 1. Health / version handshake ─────────────────────────────────────────
  section("1 · Health & version handshake");

  try {
    await client.ping();
    pass("client.ping()  (/healthz version check)");
  } catch (err) {
    fail("client.ping()", err);
  }

  const health = new HealthClient(client);
  try {
    const h = await health.get();
    pass("HealthClient.get()", `version=${h.version} status=${h.status}`);
  } catch (err) {
    fail("HealthClient.get()", err);
  }

  try {
    const raw = await client.raw().get("/healthz");
    pass("RawClient.get('/healthz')", `ok=${!!(raw as { version?: string }).version}`);
  } catch (err) {
    fail("RawClient.get('/healthz')", err);
  }

  // ── 2. Business OTP auth (interactive) ────────────────────────────────────
  section("2 · Business OTP auth  (interactive — check your phone)");

  let challenge: { requestId: string; maskedDestination: string } | undefined;

  try {
    challenge = await client.otp.requestOTP({ mobileNumber: mobile });
    pass("OTPFlow.requestOTP()", `requestId=${challenge.requestId}${challenge.maskedDestination ? ` masked=${challenge.maskedDestination}` : ""}`);
  } catch (err) {
    fail("OTPFlow.requestOTP()", err);
  }

  if (challenge) {
    const dest = challenge.maskedDestination ?? mobile;
    const code = await ask(rl, `OTP sent to ${dest} — enter code: `);
    const trimmed = code.trim();

    if (!trimmed) {
      skip("OTPFlow.verifyOTP()", "no code entered");
    } else {
      try {
        businessSession = await client.otp.verifyOTP({
          requestId: challenge.requestId,
          code: trimmed,
          subject: "integration-test",
        });
        await client.tokenStore.put(businessSession);
        pass("OTPFlow.verifyOTP()", `fingerprint=${businessSession.fingerprint}`);
      } catch (err) {
        fail("OTPFlow.verifyOTP()", err);
      }
    }
  }

  // refresh tested later (section 2b) on a copy so it can't corrupt businessSession

  // ── 3. Business API ────────────────────────────────────────────────────────
  section("3 · BusinessClient");

  const biz = new BusinessClient(client);

  if (!businessSession) {
    skip("BusinessClient.listAssociations()", "no business session");
    skip("BusinessClient.listWalletsByAssociation()", "no business session");
    skip("BusinessClient.getBeneficiary()", "no business session");
    skip("BusinessClient.stellarQuote()", "no business session");
    skip("BusinessClient.executeWalletTransaction()", "no business session");
  } else {
    const sess = businessSession;

    try {
      const assocs = await biz.listAssociations(sess);
      firstAssociationId = assocs[0]?.id;
      pass(
        "BusinessClient.listAssociations()",
        `count=${assocs.length}${firstAssociationId ? ` first=${firstAssociationId}` : ""}`,
      );
    } catch (err) {
      fail("BusinessClient.listAssociations()", err);
    }

    if (!firstAssociationId) {
      skip("BusinessClient.listWalletsByAssociation()", "no associations returned");
    } else {
      try {
        const wallets = await biz.listWalletsByAssociation(sess, firstAssociationId);
        firstWalletId = wallets[0]?.id;
        firstWalletPubKey = wallets[0]?.publicKey;
        pass(
          "BusinessClient.listWalletsByAssociation()",
          `count=${wallets.length}${firstWalletId ? ` first=${firstWalletId}` : ""}`,
        );
      } catch (err) {
        fail("BusinessClient.listWalletsByAssociation()", err);
      }
    }

    // getBeneficiary requires real IDs — we probe with a sentinel that should
    // come back 404 (NotFound), proving the auth and routing work.
    try {
      await biz.getBeneficiary(sess, firstAssociationId ?? "test-assoc", "test-benef-id");
      pass("BusinessClient.getBeneficiary()  (unexpected 200)");
    } catch (err) {
      if (isZeamError(err, Kind.NotFound)) {
        pass("BusinessClient.getBeneficiary()", "404 NotFound — auth OK, ID not found as expected");
      } else if (isZeamError(err, Kind.Validation)) {
        pass("BusinessClient.getBeneficiary()", "422 Validation — auth OK, sentinel ID rejected as expected");
      } else {
        fail("BusinessClient.getBeneficiary()", err);
      }
    }

    // stellarQuote: probe with a sentinel; expect 404/422/400 (not 401/403).
    try {
      await biz.stellarQuote(sess, {
        fromAsset: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        toAsset: "XLM",
        amount: "1.00",
      });
      pass("BusinessClient.stellarQuote()  (unexpected 200)");
    } catch (err) {
      if (
        isZeamError(err, Kind.NotFound) ||
        isZeamError(err, Kind.Validation) ||
        isZeamError(err, Kind.Remote)
      ) {
        pass("BusinessClient.stellarQuote()", `${(err as ZeamError).kind} — auth OK, sentinel rejected`);
      } else if (isZeamError(err, Kind.Auth) || isZeamError(err, Kind.Authz)) {
        fail("BusinessClient.stellarQuote()  (auth failure — session may have expired)", err);
      } else {
        fail("BusinessClient.stellarQuote()", err);
      }
    }

    // executeWalletTransaction: probe expecting 404/422 (not 401/403).
    if (!firstWalletId) {
      skip("BusinessClient.executeWalletTransaction()", "no wallets returned");
    } else {
      try {
        await biz.executeWalletTransaction(sess, firstWalletId, {
          toPublicKey: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
          fromAsset: "XLM:native",
          amount: "0.0000001",
        });
        pass("BusinessClient.executeWalletTransaction()  (unexpected 200)");
      } catch (err) {
        if (
          isZeamError(err, Kind.NotFound) ||
          isZeamError(err, Kind.Validation) ||
          isZeamError(err, Kind.Conflict) ||
          isZeamError(err, Kind.Remote)
        ) {
          pass("BusinessClient.executeWalletTransaction()", `${(err as ZeamError).kind} — auth OK`);
        } else if (isZeamError(err, Kind.Auth) || isZeamError(err, Kind.Authz)) {
          fail("BusinessClient.executeWalletTransaction()  (auth failure)", err);
        } else {
          fail("BusinessClient.executeWalletTransaction()", err);
        }
      }
    }
  }

  // ── 4. Payments — skipped (gateway routes not yet implemented, see docs/payments.md)
  // ── 5. Reports  — skipped (gateway routes not yet implemented, see docs/reports.md)

  // ── 6. Application ─────────────────────────────────────────────────────────
  section("6 · ApplicationClient");

  const appClient = new ApplicationClient(client);

  if (!businessSession) {
    skip("ApplicationClient.register()", "no business session");
    skip("ApplicationClient.rotateCredential()", "no business session");
    skip("ApplicationClient.rotateWebhookSecret()", "no business session");
  } else {
    const sess = businessSession;

    // register() is destructive — only probe; expect 400/422 on invalid payload.
    try {
      await appClient.register(sess, {});
      pass("ApplicationClient.register()  (unexpected 200)");
    } catch (err) {
      if (err instanceof ZeamError) {
        const e = err as ZeamError;
        if (e.is(Kind.Auth)) {
          fail("ApplicationClient.register()  (401 — token rejected)", err);
        } else {
          pass("ApplicationClient.register()", `kind=${e.kind} status=${e.status} — ZeamError OK`);
        }
      } else {
        fail("ApplicationClient.register()", err);
      }
    }

    try {
      await appClient.rotateCredential(sess, "test-app-id");
      pass("ApplicationClient.rotateCredential()  (unexpected 200)");
    } catch (err) {
      if (err instanceof ZeamError) {
        const e = err as ZeamError;
        if (e.is(Kind.Auth)) {
          fail("ApplicationClient.rotateCredential()  (401 — token rejected)", err);
        } else {
          pass("ApplicationClient.rotateCredential()", `kind=${e.kind} status=${e.status} — ZeamError OK`);
        }
      } else {
        fail("ApplicationClient.rotateCredential()", err);
      }
    }

    try {
      await appClient.rotateWebhookSecret(sess, "test-app-id", "test-webhook-id");
      pass("ApplicationClient.rotateWebhookSecret()  (unexpected 200)");
    } catch (err) {
      if (err instanceof ZeamError) {
        const e = err as ZeamError;
        if (e.is(Kind.Auth)) {
          fail("ApplicationClient.rotateWebhookSecret()  (401 — token rejected)", err);
        } else {
          pass("ApplicationClient.rotateWebhookSecret()", `kind=${e.kind} status=${e.status} — ZeamError OK`);
        }
      } else {
        fail("ApplicationClient.rotateWebhookSecret()", err);
      }
    }
  }

  // ── 2b. OTPFlow.refresh (on a copy — must not mutate the live session) ────
  section("2b · OTPFlow.refresh");

  if (!businessSession) {
    skip("OTPFlow.refresh()", "no business session");
  } else {
    const copy = new Session({
      track: Track.Business,
      idToken: businessSession.idToken,
      refreshToken: businessSession.refreshToken,
      expiresAt: businessSession.expiresAt,
      subject: businessSession.subject,
    });
    try {
      const refreshed = await client.otp.refresh(copy);
      pass("OTPFlow.refresh()", `fingerprint=${refreshed.fingerprint}`);
    } catch (err) {
      fail("OTPFlow.refresh()", err);
    }
  }

  // ── 7. Connect (SEP-10) ────────────────────────────────────────────────────
  section("7 · SEP-10 / ConnectClient");

  const appSeed = process.env.ZEAM_TEST_APP_SEED ?? process.env.ZEAM_STELLAR_SEED ?? "";
  const appPubKey = process.env.ZEAM_TEST_APP_PUBKEY ?? process.env.ZEAM_STELLAR_PUBLIC_KEY ?? "";
  const connectSecret = process.env.ZEAM_TEST_CONNECT_SECRET ?? process.env.ZEAM_CONNECT_SECRET ?? "";

  // getChallenge doesn't require a signer — just needs a valid Stellar pubkey.
  if (!appPubKey) {
    skip("SEP10Flow.getChallenge()", "ZEAM_TEST_APP_PUBKEY not set");
  } else {
    try {
      const challenge = await client.sep10.getChallenge(appPubKey);
      pass("SEP10Flow.getChallenge()", `xdr_len=${challenge.transaction.length}`);
    } catch (err) {
      if (isZeamError(err, Kind.NotFound) || isZeamError(err, Kind.Validation)) {
        pass("SEP10Flow.getChallenge()", `${(err as ZeamError).kind} — endpoint reachable`);
      } else {
        fail("SEP10Flow.getChallenge()", err);
      }
    }
  }

  // sep10.login() requires the signer, which is a Phase 1 stub that always throws.
  if (!appSeed || !appPubKey) {
    skip("SEP10Flow.login()", "ZEAM_TEST_APP_SEED / ZEAM_TEST_APP_PUBKEY not set");
  } else {
    try {
      await client.sep10.login({ publicKey: appPubKey, canSign: () => true } as never);
      pass("SEP10Flow.login()  (unexpected 200)");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Phase 1") || msg.includes("not yet wired")) {
        skip("SEP10Flow.login()", "Stellar signer not wired yet (Phase 1 stub)");
      } else {
        fail("SEP10Flow.login()", err);
      }
    }
  }

  // ConnectClient calls require a Connect (SEP-10) session; skip if none.
  if (!connectSecret) {
    skip("ConnectClient.queryConnectors()", "ZEAM_TEST_CONNECT_SECRET not set");
    skip("ConnectClient.getQuote()", "ZEAM_TEST_CONNECT_SECRET not set");
    skip("ConnectClient.execute()", "ZEAM_TEST_CONNECT_SECRET not set");
    skip("ConnectClient.exec()", "ZEAM_TEST_CONNECT_SECRET not set");
  } else {
    skip("ConnectClient.*", "Connect session requires SEP-10 login (Phase 1 stub not yet wired)");
  }

  // ── 8. Raw escape hatch ────────────────────────────────────────────────────
  section("8 · RawClient escape hatch");

  try {
    const body = await client.raw().get("/healthz");
    pass("RawClient.get('/healthz')");

    // Verify the version field comes through.
    if (body && typeof body === "object" && "version" in body) {
      pass("RawClient response shape", `version=${String((body as { version: unknown }).version)}`);
    }
  } catch (err) {
    fail("RawClient.get('/healthz')", err);
  }

  if (!businessSession) {
    skip("RawClient.get('/v1/business/association/all')", "no business session");
  } else {
    // Can't attach auth via raw() — expect 401; this tests routing at least.
    try {
      await client.raw().get("/v1/business/association/all");
      pass("RawClient.get('/v1/business/association/all')  (unexpected 200 — no auth header)");
    } catch (err) {
      if (isZeamError(err, Kind.Auth)) {
        pass("RawClient.get('/v1/business/association/all')", "401 as expected — raw() sends no auth header");
      } else if (isZeamError(err, Kind.NotFound) || isZeamError(err, Kind.Validation)) {
        pass("RawClient.get('/v1/business/association/all')", `${(err as ZeamError).kind}`);
      } else {
        fail("RawClient.get('/v1/business/association/all')", err);
      }
    }
  }

  // ── 9. Error taxonomy ──────────────────────────────────────────────────────
  section("9 · Error taxonomy");

  try {
    await client.raw().get("/v1/nonexistent-route-404-check");
    fail("ZeamError 404", new Error("expected a 404 but got 200"));
  } catch (err) {
    if (isZeamError(err, Kind.NotFound)) {
      const e = err as ZeamError;
      pass("ZeamError.is(Kind.NotFound)", `code=${e.code} status=${e.status}`);
    } else if (err instanceof ZeamError) {
      pass("ZeamError thrown", `kind=${(err as ZeamError).kind} status=${(err as ZeamError).status}`);
    } else {
      fail("ZeamError taxonomy", err);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  rl.close();

  const total = passed + failed + skipped;
  console.log(`\n${"─".repeat(64)}`);
  console.log(
    `${BOLD}Results:${RESET}  ` +
      `${GREEN}${passed} passed${RESET}  ` +
      `${failed > 0 ? RED : DIM}${failed} failed${RESET}  ` +
      `${YELLOW}${skipped} skipped${RESET}  ` +
      `${DIM}${total} total${RESET}`,
  );

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(`\n${RED}Fatal:${RESET}`, err);
  process.exit(1);
});
