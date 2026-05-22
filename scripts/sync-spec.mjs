#!/usr/bin/env node
// Fetches the gateway's OpenAPI spec at a specific tag and writes it
// into api/openapi.yaml along with a SHA-256 digest at api/openapi.sha256.
//
//   node scripts/sync-spec.mjs [gateway-tag]
//
// Defaults to `main` when no tag is supplied.

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const gatewayTag = process.argv[2] ?? "main";
const rawBase = `https://raw.githubusercontent.com/BeamMoney/zeam-api-gateway.go/${gatewayTag}`;
const specUrl = `${rawBase}/docs/mintlify/openapi/gateway.yaml`;

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
  console.error("GITHUB_TOKEN env var is required to fetch from a private repo");
  process.exit(1);
}

const repoRoot = resolve(fileURLToPath(import.meta.url), "..", "..");
const specPath = resolve(repoRoot, "api", "openapi.yaml");
const shaPath = resolve(repoRoot, "api", "openapi.sha256");

console.error(`syncing OpenAPI spec from ${specUrl}`);

const resp = await fetch(specUrl, {
  headers: { Authorization: `Bearer ${githubToken}` },
});
if (!resp.ok) {
  console.error(`HTTP ${resp.status} fetching ${specUrl}`);
  process.exit(1);
}
const text = await resp.text();
await writeFile(specPath, text);

const digest = createHash("sha256").update(text).digest("hex");
await writeFile(shaPath, `${digest}\n`);

const versionPath = resolve(repoRoot, "src", "version.ts");
const versionSrc = await readFile(versionPath, "utf8");
const updated = versionSrc.replace(
  /export const SPEC_HASH = "[0-9a-f]{64}";/,
  `export const SPEC_HASH = "${digest}";`,
);
await writeFile(versionPath, updated);

console.error(`wrote ${specPath} (sha256 ${digest.slice(0, 12)}…)`);
console.error(`updated src/version.ts SPEC_HASH`);
