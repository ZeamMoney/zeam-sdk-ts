#!/usr/bin/env npx tsx
/**
 * ApplicationClient raw gateway smoke test.
 * Hits every /v1/application/* endpoint directly and logs full request/response.
 *
 * Usage:
 *   ZEAM_TEST_MOBILE=+27821234567 npx tsx test/api-application-smoke.ts
 *
 * Optional env vars:
 *   ZEAM_API_URL                Override base URL (default: https://api-gateway.zeam.app)
 *   ZEAM_TEST_ASSOCIATION_ID    Association UUID to list/register under
 *   ZEAM_TEST_WEBHOOK_URL       Webhook URL for the registered app (default: https://webhook.site/test)
 *   ZEAM_TEST_APP_ID            Pre-existing application ID
 *   ZEAM_TEST_WEBHOOK_ID        Pre-existing webhook ID for rotate-secret probe
 *   ZEAM_TEST_PUBLIC_KEY        Stellar public key for lookup probe
 *   ZEAM_TEST_APPROVED_APP_ID   App already in `approved` state (approved by a different user).
 *                               Enables suspend → resume probes that would otherwise be skipped.
 */

import * as readline from "node:readline/promises";
import { getRawToken } from "./session-helper.js";

try {
  process.loadEnvFile(new URL(".env", import.meta.url));
} catch {}

const BASE = process.env.ZEAM_API_URL ?? "https://api-gateway.zeam.app";

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
    "magic-header": MAGIC_HEADER,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  console.log(`\n${HR}`);
  console.log(`${BOLD}${CYAN}REQUEST  ${method} ${path}${RESET}`);
  console.log(HR2);
  for (const [k, v] of Object.entries(headers)) {
    const display =
      k === "Authorization"
        ? `Bearer ${v.replace("Bearer ", "").slice(0, 40)}…`
        : k === "magic-header"
          ? `${v.slice(0, 16)}…`
          : v;
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

  const statusColor = resp.status < 300 ? GREEN : resp.status < 500 ? YELLOW : RED;
  console.log(`\n${statusColor}RESPONSE  ${resp.status} ${resp.statusText}  (${ms}ms)${RESET}`);
  console.log(HR2);

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

function skip(name: string, reason: string): void {
  console.log(`\n${YELLOW}–  SKIP  ${name}  ${DIM}(${reason})${RESET}`);
}

/** 401 = hard fail, 403 = expected (no integrator permissions), 5xx = fail. */
function check(name: string, status: number, data: unknown): void {
  const msg = (data as { message?: string })?.message ?? "";
  if (status === 401) {
    fail(name, `401 — token rejected`);
  } else if (status === 403) {
    pass(name, `403 Authz — auth OK, account lacks permissions (expected)`);
  } else if (status >= 500) {
    fail(name, `${status}${msg ? `  ${msg}` : ""}`);
  } else {
    pass(name, `${status}${msg ? `  ${msg}` : ""}`);
  }
}

function extractData(raw: unknown): Record<string, unknown> {
  return (raw as { data?: Record<string, unknown> })?.data ?? (raw as Record<string, unknown>);
}

async function main(): Promise<void> {
  const mobile = process.env.ZEAM_TEST_MOBILE;
  if (!mobile) {
    console.error(`${RED}Error:${RESET} set ZEAM_TEST_MOBILE=+<number>`);
    process.exit(1);
  }

  const associationId = process.env.ZEAM_TEST_ASSOCIATION_ID ?? "";
  const webhookUrl = process.env.ZEAM_TEST_WEBHOOK_URL ?? "https://webhook.site/test";
  const envAppId = process.env.ZEAM_TEST_APP_ID ?? "";
  const envWebhookId = process.env.ZEAM_TEST_WEBHOOK_ID ?? "";
  const envPublicKey = process.env.ZEAM_TEST_PUBLIC_KEY ?? "";
  const approvedAppId = process.env.ZEAM_TEST_APPROVED_APP_ID ?? "";

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\n${BOLD}ApplicationClient API gateway smoke test${RESET}  ${DIM}${BASE}${RESET}`);
  if (associationId) console.log(`  ${DIM}ZEAM_TEST_ASSOCIATION_ID   = ${associationId}${RESET}`);
  if (envAppId) console.log(`  ${DIM}ZEAM_TEST_APP_ID           = ${envAppId}${RESET}`);
  if (envWebhookId) console.log(`  ${DIM}ZEAM_TEST_WEBHOOK_ID       = ${envWebhookId}${RESET}`);
  if (envPublicKey) console.log(`  ${DIM}ZEAM_TEST_PUBLIC_KEY       = ${envPublicKey}${RESET}`);
  if (approvedAppId) console.log(`  ${DIM}ZEAM_TEST_APPROVED_APP_ID = ${approvedAppId}${RESET}`);

  // ── Auth ───────────────────────────────────────────────────────────────────
  section("Auth — OTP");

  const token = await getRawToken(mobile, rl);
  rl.close();
  pass("session", `token=…${token.slice(-8)}`);

  let probeAppId = envAppId;
  let probeWebhookId = envWebhookId;

  // ── List applications ──────────────────────────────────────────────────────
  section("GET /v1/applications/:association_id  (list)");

  if (!associationId) {
    skip("GET /v1/applications/:association_id", "set ZEAM_TEST_ASSOCIATION_ID");
  } else {
    const r = await call("GET", `/v1/applications/${encodeURIComponent(associationId)}`, token);
    check("GET /v1/applications/:association_id", r.status, r.data);
    if (r.status === 200) {
      const list = (Array.isArray(r.data) ? r.data : (extractData(r.data) as unknown[])) as Array<{
        id?: string;
      }>;
      if (!probeAppId && list.length > 0) {
        probeAppId = list[0].id ?? "";
        if (probeAppId) console.log(`  ${DIM}probeAppId = ${probeAppId}${RESET}`);
      }
    }
  }

  // ── Lookup by public key ───────────────────────────────────────────────────
  section("GET /v1/application/lookup  (by public key)");

  if (!envPublicKey) {
    skip("GET /v1/application/lookup", "set ZEAM_TEST_PUBLIC_KEY");
  } else {
    const r = await call(
      "GET",
      `/v1/application/lookup?publicKey=${encodeURIComponent(envPublicKey)}`,
      token,
    );
    check("GET /v1/application/lookup", r.status, r.data);
  }

  // ── Get application by ID ──────────────────────────────────────────────────
  section("GET /v1/application/:id");

  if (!probeAppId) {
    skip("GET /v1/application/:id", "no app ID — set ZEAM_TEST_APP_ID");
  } else {
    const r = await call("GET", `/v1/application/${encodeURIComponent(probeAppId)}`, token);
    check("GET /v1/application/:id", r.status, r.data);
  }

  // ── List application events ────────────────────────────────────────────────
  section("GET /v1/application/:id/event");

  if (!probeAppId) {
    skip("GET /v1/application/:id/event", "no app ID");
  } else {
    const r = await call("GET", `/v1/application/${encodeURIComponent(probeAppId)}/event`, token);
    check("GET /v1/application/:id/event", r.status, r.data);
  }

  // ── Provision ─────────────────────────────────────────────────────────────
  section("POST /v1/application/provision");

  let provisionedDraftId = "";

  if (!associationId) {
    skip("POST /v1/application/provision", "set ZEAM_TEST_ASSOCIATION_ID");
  } else {
    const r = await call("POST", "/v1/application/provision", token, {
      associationId,
      applicationName: `sdk-smoke-provision-${Date.now()}`,
    });
    check("POST /v1/application/provision", r.status, r.data);
    if (r.status === 200 || r.status === 201) {
      const d = extractData(r.data);
      provisionedDraftId = (d as { id?: string }).id ?? "";
      if (provisionedDraftId)
        console.log(`  ${DIM}provisionedDraftId = ${provisionedDraftId}${RESET}`);
    }
  }

  // ── Register ───────────────────────────────────────────────────────────────
  section("POST /v1/application  (register)");

  if (!associationId) {
    console.log(
      `  ${YELLOW}⚠  ZEAM_TEST_ASSOCIATION_ID not set — register will likely 403${RESET}`,
    );
  }

  const r = await call("POST", "/v1/application", token, {
    associationId: associationId || undefined,
    applicationName: `sdk-smoke-test-app-${Date.now()}`,
    webhookUrl,
    webhookMethod: "POST",
  });
  check("POST /v1/application", r.status, r.data);

  if (r.status === 200 || r.status === 201) {
    const d = extractData(r.data);
    const appId = (d as { application?: { id?: string } }).application?.id ?? "";
    const webhookId =
      (d as { webhookSecret?: { webhookId?: string } }).webhookSecret?.webhookId ?? "";
    if (appId) {
      probeAppId = appId;
      console.log(`  ${DIM}probeAppId     = ${appId}${RESET}`);
    }
    if (webhookId) {
      probeWebhookId = webhookId;
      console.log(`  ${DIM}probeWebhookId = ${webhookId}${RESET}`);
    }
  }

  // ── Activate draft application ─────────────────────────────────────────────
  // Provision a second fresh draft exclusively for the activate probe so the
  // submit→revoke chain on provisionedDraftId doesn't consume it first.
  section("POST /v1/application/:id/activate");

  let activateDraftId = "";

  if (!associationId) {
    skip("POST /v1/application/:id/activate", "set ZEAM_TEST_ASSOCIATION_ID");
  } else {
    console.log(`  ${DIM}(provisioning fresh draft for activate probe)${RESET}`);
    const rp = await call("POST", "/v1/application/provision", token, {
      associationId,
      applicationName: `sdk-smoke-activate-${Date.now()}`,
    });
    if (rp.status === 200 || rp.status === 201) {
      const d = extractData(rp.data);
      activateDraftId = (d as { id?: string }).id ?? "";
      if (activateDraftId) console.log(`  ${DIM}activateDraftId = ${activateDraftId}${RESET}`);
    }

    if (!activateDraftId) {
      skip("POST /v1/application/:id/activate", "provision for activate probe failed");
    } else {
      const ra = await call(
        "POST",
        `/v1/application/${encodeURIComponent(activateDraftId)}/activate`,
        token,
        { webhookUrl, webhookMethod: "POST" },
      );
      check("POST /v1/application/:id/activate", ra.status, ra.data);
    }
  }

  // ── Submit for review ──────────────────────────────────────────────────────
  // submit targets the freshly provisioned draft (draft → pending_approval).
  // register() auto-submits, so probeAppId is already pending_approval and would 409.
  section("POST /v1/application/:id/submit");

  if (!provisionedDraftId) {
    skip("POST /v1/application/:id/submit", "no draft app — provision() must succeed");
  } else {
    const rs = await call(
      "POST",
      `/v1/application/${encodeURIComponent(provisionedDraftId)}/submit`,
      token,
    );
    check("POST /v1/application/:id/submit", rs.status, rs.data);
  }

  // ── Approve ────────────────────────────────────────────────────────────────
  section("POST /v1/application/:id/approve");

  if (!probeAppId) {
    skip("POST /v1/application/:id/approve", "no app ID");
  } else {
    const ra = await call(
      "POST",
      `/v1/application/${encodeURIComponent(probeAppId)}/approve`,
      token,
    );
    check("POST /v1/application/:id/approve", ra.status, ra.data);
  }

  // ── Reject ─────────────────────────────────────────────────────────────────
  section("POST /v1/application/:id/reject");

  if (!probeAppId) {
    skip("POST /v1/application/:id/reject", "no app ID");
  } else {
    const rr = await call(
      "POST",
      `/v1/application/${encodeURIComponent(probeAppId)}/reject`,
      token,
      { reason: "sdk-smoke-test" },
    );
    check("POST /v1/application/:id/reject", rr.status, rr.data);
  }

  // ── Suspend ────────────────────────────────────────────────────────────────
  // Requires an app already in `approved` state approved by a different user.
  // Set ZEAM_TEST_APPROVED_APP_ID to enable; otherwise skipped.
  section("POST /v1/application/:id/suspend");

  let suspendSucceeded = false;

  if (!approvedAppId) {
    skip(
      "POST /v1/application/:id/suspend",
      "set ZEAM_TEST_APPROVED_APP_ID (app approved by a different user)",
    );
  } else {
    const rsu = await call(
      "POST",
      `/v1/application/${encodeURIComponent(approvedAppId)}/suspend`,
      token,
    );
    check("POST /v1/application/:id/suspend", rsu.status, rsu.data);
    if (rsu.status === 200 || rsu.status === 201) suspendSucceeded = true;
  }

  // ── Resume ─────────────────────────────────────────────────────────────────
  section("POST /v1/application/:id/resume");

  if (!approvedAppId || !suspendSucceeded) {
    skip(
      "POST /v1/application/:id/resume",
      approvedAppId ? "suspend did not succeed" : "set ZEAM_TEST_APPROVED_APP_ID",
    );
  } else {
    const rre = await call(
      "POST",
      `/v1/application/${encodeURIComponent(approvedAppId)}/resume`,
      token,
    );
    check("POST /v1/application/:id/resume", rre.status, rre.data);
  }

  // ── Revoke ─────────────────────────────────────────────────────────────────
  // revoke targets the submitted draft (pending_approval → revoked is a valid transition).
  section("POST /v1/application/:id/revoke");

  if (!provisionedDraftId) {
    skip("POST /v1/application/:id/revoke", "no submitted draft — provision() must succeed");
  } else {
    const rrv = await call(
      "POST",
      `/v1/application/${encodeURIComponent(provisionedDraftId)}/revoke`,
      token,
      { reason: "sdk-smoke-test" },
    );
    check("POST /v1/application/:id/revoke", rrv.status, rrv.data);
  }

  // ── Rotate credential ──────────────────────────────────────────────────────
  section("POST /v1/application/:id/rotate-credential");

  if (!probeAppId) {
    skip(
      "POST /v1/application/:id/rotate-credential",
      "no app ID — set ZEAM_TEST_APP_ID or ensure register() succeeds",
    );
  } else {
    const rc = await call(
      "POST",
      `/v1/application/${encodeURIComponent(probeAppId)}/rotate-credential`,
      token,
    );
    check("POST /v1/application/:id/rotate-credential", rc.status, rc.data);
  }

  // ── Token smoke test ───────────────────────────────────────────────────────
  section("POST /v1/application/:id/token");

  if (!probeAppId) {
    skip("POST /v1/application/:id/token", "no app ID");
  } else {
    const rt = await call("POST", `/v1/application/${encodeURIComponent(probeAppId)}/token`, token);
    if (rt.status === 501) {
      skip(
        "POST /v1/application/:id/token",
        "501 — signer resolver not configured in this environment",
      );
    } else {
      check("POST /v1/application/:id/token", rt.status, rt.data);
    }
  }

  // ── List webhooks ──────────────────────────────────────────────────────────
  section("GET /v1/application/:id/webhook");

  let addedWebhookId = "";

  if (!probeAppId) {
    skip("GET /v1/application/:id/webhook", "no app ID");
  } else {
    const rlw = await call(
      "GET",
      `/v1/application/${encodeURIComponent(probeAppId)}/webhook`,
      token,
    );
    check("GET /v1/application/:id/webhook", rlw.status, rlw.data);
    if (rlw.status === 200 && !probeWebhookId) {
      const hooks = (
        Array.isArray(rlw.data) ? rlw.data : (extractData(rlw.data) as unknown[])
      ) as Array<{ id?: string }>;
      if (hooks.length > 0) probeWebhookId = hooks[0].id ?? "";
    }
  }

  // ── Add webhook ────────────────────────────────────────────────────────────
  section("POST /v1/application/:id/webhook");

  if (!probeAppId) {
    skip("POST /v1/application/:id/webhook", "no app ID");
  } else {
    const smokeUrl = `${webhookUrl}?smoke=${Date.now()}`;
    const raw = await call(
      "POST",
      `/v1/application/${encodeURIComponent(probeAppId)}/webhook`,
      token,
      {
        url: smokeUrl,
        webhookMethod: "POST",
        authScheme: "none",
        description: "sdk-smoke-test",
      },
    );
    check("POST /v1/application/:id/webhook", raw.status, raw.data);
    if (raw.status === 200 || raw.status === 201) {
      const d = extractData(raw.data);
      addedWebhookId =
        (d as { webhook?: { id?: string } }).webhook?.id ?? (d as { id?: string }).id ?? "";
      if (addedWebhookId) console.log(`  ${DIM}addedWebhookId = ${addedWebhookId}${RESET}`);
    }
  }

  // ── Update webhook ─────────────────────────────────────────────────────────
  section("PATCH /v1/application/:id/webhook/:webhookId");

  const updateTargetId = addedWebhookId || probeWebhookId;

  if (!probeAppId || !updateTargetId) {
    skip("PATCH /v1/application/:id/webhook/:webhookId", "no app ID / webhook ID");
  } else {
    const ru = await call(
      "PATCH",
      `/v1/application/${encodeURIComponent(probeAppId)}/webhook/${encodeURIComponent(updateTargetId)}`,
      token,
      { description: "sdk-smoke-test-updated" },
    );
    check("PATCH /v1/application/:id/webhook/:webhookId", ru.status, ru.data);
  }

  // ── Delete webhook ─────────────────────────────────────────────────────────
  section("DELETE /v1/application/:id/webhook/:webhookId");

  if (!probeAppId || !addedWebhookId) {
    skip(
      "DELETE /v1/application/:id/webhook/:webhookId",
      "no app ID / no webhook created by addWebhook in this run",
    );
  } else {
    const rd = await call(
      "DELETE",
      `/v1/application/${encodeURIComponent(probeAppId)}/webhook/${encodeURIComponent(addedWebhookId)}`,
      token,
    );
    check("DELETE /v1/application/:id/webhook/:webhookId", rd.status, rd.data);
  }

  // ── Rotate webhook secret ──────────────────────────────────────────────────
  section("POST /v1/application/:id/webhook/:webhookId/rotate-secret");

  const rotateTarget = probeWebhookId;

  if (!probeAppId || !rotateTarget) {
    skip(
      "POST /v1/application/:id/webhook/:webhookId/rotate-secret",
      "no app ID / webhook ID — set ZEAM_TEST_APP_ID + ZEAM_TEST_WEBHOOK_ID",
    );
  } else {
    const rw = await call(
      "POST",
      `/v1/application/${encodeURIComponent(probeAppId)}/webhook/${encodeURIComponent(rotateTarget)}/rotate-secret`,
      token,
    );
    check("POST /v1/application/:id/webhook/:webhookId/rotate-secret", rw.status, rw.data);
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
