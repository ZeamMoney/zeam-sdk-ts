#!/usr/bin/env npx tsx
/**
 * ApplicationClient SDK smoke test.
 * Uses the real SDK methods and logs every request + response verbosely.
 *
 * Usage:
 *   ZEAM_TEST_MOBILE=+27821234567 npx tsx test/application-smoke.ts
 *
 * Optional env vars:
 *   ZEAM_API_URL                Override base URL (default: Production)
 *   ZEAM_TEST_ASSOCIATION_ID    Association UUID to list/register under
 *   ZEAM_TEST_WEBHOOK_URL       Webhook URL for the registered app (default: https://webhook.site/test)
 *   ZEAM_TEST_APP_ID            Pre-existing application ID
 *   ZEAM_TEST_WEBHOOK_ID        Pre-existing webhook ID for rotateWebhookSecret probe
 *   ZEAM_TEST_PUBLIC_KEY        Stellar public key for lookup probe
 *   ZEAM_TEST_APPROVED_APP_ID   App already in `approved` state (approved by a different user).
 *                               Enables suspend → resume probes that would otherwise be skipped.
 */

import * as readline from "node:readline/promises";
import { Client, Environment, ZeamError, Kind } from "../src/index.js";
import { ApplicationClient } from "../src/client/application/index.js";
import { getSession } from "./session-helper.js";

try { process.loadEnvFile(new URL(".env", import.meta.url)); } catch {}

const TTY = process.stdout.isTTY ?? false;
const c = (code: string) => (TTY ? code : "");

const BOLD   = c("\x1b[1m");
const DIM    = c("\x1b[2m");
const GREEN  = c("\x1b[32m");
const RED    = c("\x1b[31m");
const YELLOW = c("\x1b[33m");
const CYAN   = c("\x1b[36m");
const RESET  = c("\x1b[0m");

const HR  = "━".repeat(64);
const HR2 = "─".repeat(64);

function makeLoggingFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(input, init);
    const url = new URL(req.url);

    console.log(`\n${HR}`);
    console.log(`${BOLD}${CYAN}REQUEST  ${req.method} ${url.pathname}${url.search}${RESET}`);
    console.log(HR2);

    req.headers.forEach((v, k) => {
      const display =
        k === "authorization" ? `Bearer ${v.replace("Bearer ", "").slice(0, 40)}…` :
        k === "magic-header"  ? `${v.slice(0, 16)}…` : v;
      console.log(`${k}: ${display}`);
    });

    if (init?.body) {
      const bodyText = typeof init.body === "string" ? init.body : String(init.body);
      console.log("");
      try { console.log(JSON.stringify(JSON.parse(bodyText), null, 2)); }
      catch { console.log(bodyText); }
    }

    const start = Date.now();
    const resp = await fetch(req);
    const ms = Date.now() - start;

    const clone = resp.clone();
    const rawBody = await clone.text();
    let parsed: unknown;
    try { parsed = JSON.parse(rawBody); } catch { parsed = rawBody; }

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

/** 401 = hard fail, 403 = auth OK (expected for non-admin), other ZeamError = auth OK. */
function checkZeamError(name: string, err: unknown): void {
  if (err instanceof ZeamError) {
    const e = err as ZeamError;
    if (e.is(Kind.Auth)) {
      fail(name, err);
    } else if (e.is(Kind.Authz)) {
      pass(name, `403 Authz — auth OK, account lacks permissions (expected)`);
    } else {
      pass(name, `kind=${e.kind} status=${e.status} — ZeamError (auth OK)`);
    }
  } else {
    fail(name, err);
  }
}

async function main(): Promise<void> {
  const mobile = process.env.ZEAM_TEST_MOBILE;
  if (!mobile) {
    console.error(`${RED}Error:${RESET} set ZEAM_TEST_MOBILE=+<number>`);
    process.exit(1);
  }

  const associationId  = process.env.ZEAM_TEST_ASSOCIATION_ID ?? "";
  const webhookUrl     = process.env.ZEAM_TEST_WEBHOOK_URL ?? "https://webhook.site/test";
  const envAppId      = process.env.ZEAM_TEST_APP_ID ?? "";
  const envWebhookId  = process.env.ZEAM_TEST_WEBHOOK_ID ?? "";
  const envPublicKey  = process.env.ZEAM_TEST_PUBLIC_KEY ?? "";
  const approvedAppId = process.env.ZEAM_TEST_APPROVED_APP_ID ?? "";

  const baseURL     = process.env.ZEAM_API_URL;
  const environment = baseURL ? Environment.custom(baseURL) : Environment.Production;
  const isInsecure  = baseURL?.startsWith("http://") ?? false;

  const client = new Client({
    environment,
    verboseErrors: true,
    insecureTransport: isInsecure,
    skipVersionCheck: true,
    fetchImpl: makeLoggingFetch(),
  });

  const app = new ApplicationClient(client);
  const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(`\n${BOLD}ApplicationClient SDK smoke test${RESET}  ${DIM}${environment.baseURL}${RESET}`);
  if (associationId)  console.log(`  ${DIM}ZEAM_TEST_ASSOCIATION_ID   = ${associationId}${RESET}`);
  if (envAppId)       console.log(`  ${DIM}ZEAM_TEST_APP_ID           = ${envAppId}${RESET}`);
  if (envWebhookId)   console.log(`  ${DIM}ZEAM_TEST_WEBHOOK_ID       = ${envWebhookId}${RESET}`);
  if (envPublicKey)   console.log(`  ${DIM}ZEAM_TEST_PUBLIC_KEY       = ${envPublicKey}${RESET}`);
  if (approvedAppId)  console.log(`  ${DIM}ZEAM_TEST_APPROVED_APP_ID = ${approvedAppId}${RESET}`);

  // ── Auth ───────────────────────────────────────────────────────────────────
  section("Auth — OTP");

  const session = await getSession(mobile, client, rl);
  rl.close();
  pass("session", `fingerprint=${session.fingerprint}`);

  let probeAppId     = envAppId;
  let probeWebhookId = envWebhookId;

  // ── listApplications() ────────────────────────────────────────────────────
  section("ApplicationClient.listApplications()");

  if (!associationId) {
    skip("ApplicationClient.listApplications()", "set ZEAM_TEST_ASSOCIATION_ID");
  } else {
    try {
      const list = await app.listApplications(session, associationId);
      if (!probeAppId && list.length > 0) probeAppId = list[0].id;
      pass("ApplicationClient.listApplications()", `count=${list.length}`);
    } catch (err) { checkZeamError("ApplicationClient.listApplications()", err); }
  }

  // ── lookup() ──────────────────────────────────────────────────────────────
  section("ApplicationClient.lookup()");

  if (!envPublicKey) {
    skip("ApplicationClient.lookup()", "set ZEAM_TEST_PUBLIC_KEY");
  } else {
    try {
      const rec = await app.lookup(session, envPublicKey);
      pass("ApplicationClient.lookup()", `id=${rec.id}  status=${rec.status}`);
    } catch (err) { checkZeamError("ApplicationClient.lookup()", err); }
  }

  // ── getApplication() ──────────────────────────────────────────────────────
  section("ApplicationClient.getApplication()");

  if (!probeAppId) {
    skip("ApplicationClient.getApplication()", "no app ID — set ZEAM_TEST_APP_ID");
  } else {
    try {
      const rec = await app.getApplication(session, probeAppId);
      pass("ApplicationClient.getApplication()", `status=${rec.status}  activated=${rec.activated}`);
    } catch (err) { checkZeamError("ApplicationClient.getApplication()", err); }
  }

  // ── getApplicationEvents() ────────────────────────────────────────────────
  section("ApplicationClient.getApplicationEvents()");

  if (!probeAppId) {
    skip("ApplicationClient.getApplicationEvents()", "no app ID — set ZEAM_TEST_APP_ID");
  } else {
    try {
      const events = await app.getApplicationEvents(session, probeAppId);
      pass("ApplicationClient.getApplicationEvents()", `count=${events.length}`);
    } catch (err) { checkZeamError("ApplicationClient.getApplicationEvents()", err); }
  }

  // ── provision() ───────────────────────────────────────────────────────────
  section("ApplicationClient.provision()");

  let provisionedDraftId = "";

  if (!associationId) {
    skip("ApplicationClient.provision()", "set ZEAM_TEST_ASSOCIATION_ID");
  } else {
    try {
      const rec = await app.provision(session, {
        associationId,
        applicationName: `sdk-smoke-provision-${Date.now()}`,
      });
      provisionedDraftId = rec.id;
      pass("ApplicationClient.provision()", `id=${rec.id}  status=${rec.status}`);
    } catch (err) { checkZeamError("ApplicationClient.provision()", err); }
  }

  // ── register() ────────────────────────────────────────────────────────────
  section("ApplicationClient.register()");

  if (!associationId) {
    console.log(`  ${YELLOW}⚠  ZEAM_TEST_ASSOCIATION_ID not set — register will likely 403${RESET}`);
  }

  try {
    const resp = await app.register(session, {
      associationId:   associationId || undefined,
      applicationName: `sdk-smoke-test-app-${Date.now()}`,
      webhookUrl,
      webhookMethod:   "POST",
    });
    probeAppId     = resp.application.id;
    probeWebhookId = resp.webhookSecret.webhookId;
    pass(
      "ApplicationClient.register()",
      `appId=${resp.application.id}  apiKeyId=${resp.apiKey.keyId}  webhookId=${resp.webhookSecret.webhookId}`,
    );
    console.log(`  ${DIM}stellarPublicKey=${resp.stellar.publicKey}${RESET}`);
    console.log(`  ${DIM}apiKeyLast4=${resp.apiKey.last4}  webhookLast4=${resp.webhookSecret.last4}${RESET}`);
    if (resp.warnings?.length) {
      console.log(`  ${YELLOW}warnings: ${JSON.stringify(resp.warnings)}${RESET}`);
    }
  } catch (err) { checkZeamError("ApplicationClient.register()", err); }

  // ── activate() ────────────────────────────────────────────────────────────
  // Provision a second fresh draft exclusively for the activate probe so the
  // submit→revoke chain on provisionedDraftId doesn't consume it first.
  section("ApplicationClient.activate()");

  let activateDraftId = "";

  if (!associationId) {
    skip("ApplicationClient.activate()", "set ZEAM_TEST_ASSOCIATION_ID");
  } else {
    console.log(`  ${DIM}(provisioning fresh draft for activate probe)${RESET}`);
    try {
      const draft = await app.provision(session, {
        associationId,
        applicationName: `sdk-smoke-activate-${Date.now()}`,
      });
      activateDraftId = draft.id;
      console.log(`  ${DIM}activateDraftId = ${activateDraftId}${RESET}`);
    } catch (err) {
      skip("ApplicationClient.activate()", `provision for activate probe failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (activateDraftId) {
      try {
        const rec = await app.activate(session, activateDraftId, {
          webhookUrl,
          webhookMethod: "POST",
        });
        pass("ApplicationClient.activate()", `id=${rec.application.id}  status=${rec.application.status}`);
        console.log(`  ${DIM}stellarPublicKey=${rec.stellar.publicKey}${RESET}`);
        console.log(`  ${DIM}apiKeyLast4=${rec.apiKey.last4}  webhookLast4=${rec.webhookSecret.last4}${RESET}`);
      } catch (err) { checkZeamError("ApplicationClient.activate()", err); }
    }
  }

  // ── submit() ──────────────────────────────────────────────────────────────
  // submit targets the freshly provisioned draft (draft → pending_approval).
  // register() auto-submits, so probeAppId is already pending_approval and would 409.
  section("ApplicationClient.submit()");

  if (!provisionedDraftId) {
    skip("ApplicationClient.submit()", "no draft app — provision() must succeed");
  } else {
    try {
      const rec = await app.submit(session, provisionedDraftId);
      pass("ApplicationClient.submit()", `status=${rec.status}`);
    } catch (err) { checkZeamError("ApplicationClient.submit()", err); }
  }

  // ── approve() ─────────────────────────────────────────────────────────────
  section("ApplicationClient.approve()");

  if (!probeAppId) {
    skip("ApplicationClient.approve()", "no app ID");
  } else {
    try {
      const rec = await app.approve(session, probeAppId);
      pass("ApplicationClient.approve()", `status=${rec.status}`);
    } catch (err) { checkZeamError("ApplicationClient.approve()", err); }
  }

  // ── reject() ──────────────────────────────────────────────────────────────
  section("ApplicationClient.reject()");

  if (!probeAppId) {
    skip("ApplicationClient.reject()", "no app ID");
  } else {
    try {
      const rec = await app.reject(session, probeAppId, { reason: "sdk-smoke-test" });
      pass("ApplicationClient.reject()", `status=${rec.status}`);
    } catch (err) { checkZeamError("ApplicationClient.reject()", err); }
  }

  // ── suspend() ─────────────────────────────────────────────────────────────
  // Requires an app already in `approved` state approved by a different user.
  // Set ZEAM_TEST_APPROVED_APP_ID to enable; otherwise skipped.
  section("ApplicationClient.suspend()");

  let suspendSucceeded = false;

  if (!approvedAppId) {
    skip("ApplicationClient.suspend()", "set ZEAM_TEST_APPROVED_APP_ID (app approved by a different user)");
  } else {
    try {
      const rec = await app.suspend(session, approvedAppId);
      suspendSucceeded = true;
      pass("ApplicationClient.suspend()", `status=${rec.status}`);
    } catch (err) { checkZeamError("ApplicationClient.suspend()", err); }
  }

  // ── resume() ──────────────────────────────────────────────────────────────
  section("ApplicationClient.resume()");

  if (!approvedAppId || !suspendSucceeded) {
    skip("ApplicationClient.resume()", approvedAppId ? "suspend() did not succeed" : "set ZEAM_TEST_APPROVED_APP_ID");
  } else {
    try {
      const rec = await app.resume(session, approvedAppId);
      pass("ApplicationClient.resume()", `status=${rec.status}`);
    } catch (err) { checkZeamError("ApplicationClient.resume()", err); }
  }

  // ── revoke() ──────────────────────────────────────────────────────────────
  // revoke targets the submitted draft (pending_approval → revoked is a valid transition).
  section("ApplicationClient.revoke()");

  if (!provisionedDraftId) {
    skip("ApplicationClient.revoke()", "no submitted draft — provision() must succeed");
  } else {
    try {
      const rec = await app.revoke(session, provisionedDraftId, { reason: "sdk-smoke-test" });
      pass("ApplicationClient.revoke()", `status=${rec.status}`);
    } catch (err) { checkZeamError("ApplicationClient.revoke()", err); }
  }

  // ── rotateCredential() ────────────────────────────────────────────────────
  section("ApplicationClient.rotateCredential()");

  if (!probeAppId) {
    skip(
      "ApplicationClient.rotateCredential()",
      "no app ID — set ZEAM_TEST_APP_ID or ensure register() succeeds",
    );
  } else {
    try {
      const resp = await app.rotateCredential(session, probeAppId);
      pass("ApplicationClient.rotateCredential()", `keyId=${resp.keyId}  last4=${resp.last4}`);
    } catch (err) { checkZeamError("ApplicationClient.rotateCredential()", err); }
  }

  // ── tokenSmokeTest() ──────────────────────────────────────────────────────
  section("ApplicationClient.tokenSmokeTest()");

  if (!probeAppId) {
    skip("ApplicationClient.tokenSmokeTest()", "no app ID");
  } else {
    try {
      const resp = await app.tokenSmokeTest(session, probeAppId);
      pass("ApplicationClient.tokenSmokeTest()", JSON.stringify(resp).slice(0, 80));
    } catch (err) {
      if (err instanceof ZeamError && (err as ZeamError).status === 501) {
        skip("ApplicationClient.tokenSmokeTest()", "501 — signer resolver not configured in this environment");
      } else {
        checkZeamError("ApplicationClient.tokenSmokeTest()", err);
      }
    }
  }

  // ── listWebhooks() ────────────────────────────────────────────────────────
  section("ApplicationClient.listWebhooks()");

  let probeWebhookForCrud = "";

  if (!probeAppId) {
    skip("ApplicationClient.listWebhooks()", "no app ID");
  } else {
    try {
      const hooks = await app.listWebhooks(session, probeAppId);
      if (hooks.length > 0 && !probeWebhookId) probeWebhookForCrud = hooks[0].id;
      pass("ApplicationClient.listWebhooks()", `count=${hooks.length}`);
    } catch (err) { checkZeamError("ApplicationClient.listWebhooks()", err); }
  }

  // ── addWebhook() ──────────────────────────────────────────────────────────
  section("ApplicationClient.addWebhook()");

  let addedWebhookId = "";

  if (!probeAppId) {
    skip("ApplicationClient.addWebhook()", "no app ID");
  } else {
    try {
      const smokeUrl = `${webhookUrl}?smoke=${Date.now()}`;
      const result = await app.addWebhook(session, probeAppId, {
        url:           smokeUrl,
        webhookMethod: "POST",
        authScheme:    "none",
        description:   "sdk-smoke-test",
      });
      addedWebhookId = result.webhook.id;
      pass("ApplicationClient.addWebhook()", `id=${result.webhook.id}  status=${result.webhook.status}`);
    } catch (err) { checkZeamError("ApplicationClient.addWebhook()", err); }
  }

  // ── updateWebhook() ───────────────────────────────────────────────────────
  section("ApplicationClient.updateWebhook()");

  const updateTargetId = addedWebhookId || probeWebhookForCrud;

  if (!probeAppId || !updateTargetId) {
    skip("ApplicationClient.updateWebhook()", "no app ID / webhook ID");
  } else {
    try {
      const hook = await app.updateWebhook(session, probeAppId, updateTargetId, {
        description: "sdk-smoke-test-updated",
      });
      pass("ApplicationClient.updateWebhook()", `id=${hook.id}  status=${hook.status}`);
    } catch (err) { checkZeamError("ApplicationClient.updateWebhook()", err); }
  }

  // ── deleteWebhook() ───────────────────────────────────────────────────────
  section("ApplicationClient.deleteWebhook()");

  if (!probeAppId || !addedWebhookId) {
    skip(
      "ApplicationClient.deleteWebhook()",
      "no app ID / no webhook created by addWebhook() in this run",
    );
  } else {
    try {
      await app.deleteWebhook(session, probeAppId, addedWebhookId);
      pass("ApplicationClient.deleteWebhook()", `webhookId=${addedWebhookId}`);
    } catch (err) { checkZeamError("ApplicationClient.deleteWebhook()", err); }
  }

  // ── rotateWebhookSecret() ─────────────────────────────────────────────────
  section("ApplicationClient.rotateWebhookSecret()");

  const rotateWebhookTarget = probeWebhookId || probeWebhookForCrud;

  if (!probeAppId || !rotateWebhookTarget) {
    skip(
      "ApplicationClient.rotateWebhookSecret()",
      "no app ID / webhook ID — set ZEAM_TEST_APP_ID + ZEAM_TEST_WEBHOOK_ID",
    );
  } else {
    try {
      const resp = await app.rotateWebhookSecret(session, probeAppId, rotateWebhookTarget);
      pass(
        "ApplicationClient.rotateWebhookSecret()",
        `webhookId=${resp.webhookId}  last4=${resp.last4}`,
      );
    } catch (err) { checkZeamError("ApplicationClient.rotateWebhookSecret()", err); }
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
