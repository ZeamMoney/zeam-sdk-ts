#!/usr/bin/env node
// Fetches the gateway's OpenAPI spec at a specific tag and writes it
// into api/openapi.yaml along with a SHA-256 digest at api/openapi.sha256.
//
//   node scripts/sync-spec.mjs [gateway-tag]
//
// Defaults to `main` when no tag is supplied.

import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const gatewayTag = process.argv[2] ?? "main";
const rawBase = `https://raw.githubusercontent.com/BeamMoney/zeam-api-gateway.go/${gatewayTag}`;
const specUrl = `${rawBase}/docs/openapi.yaml`;

const repoRoot = resolve(fileURLToPath(import.meta.url), "..", "..");
const specPath = resolve(repoRoot, "api", "openapi.yaml");
const shaPath = resolve(repoRoot, "api", "openapi.sha256");

console.error(`syncing OpenAPI spec from ${specUrl}`);

const resp = await fetch(specUrl);
if (!resp.ok) {
  console.error(`HTTP ${resp.status} fetching ${specUrl}`);
  process.exit(1);
}
const text = await resp.text();
await writeFile(specPath, text);

const digest = createHash("sha256").update(text).digest("hex");
await writeFile(shaPath, `${digest}\n`);

console.error(`wrote ${specPath} (sha256 ${digest.slice(0, 12)}…)`);
