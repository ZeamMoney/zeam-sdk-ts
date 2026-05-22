#!/usr/bin/env npx tsx
/**
 * Demonstrates the transparent 401-retry in the transport layer.
 *
 * The stored SEP-10 session is deliberately expired. The first call to
 * connect.listCountries() receives a 401; the SDK refreshes the session
 * via the wired SEP10Flow and retries automatically — no manual handling.
 *
 * Usage:
 *   ZEAM_CONNECT_SECRET=<secret>  STELLAR_SEED=<S...>  npx tsx test/connect/401-refresh-smoke.ts
 */

import * as fs from "node:fs";
import { Client, Environment } from "../../src/index.js";
import { Session, Track, SEP10Flow } from "../../src/auth/index.js";
import { newSigner, PublicNetworkPassphrase } from "../../src/stellar/index.js";
import { ConnectClient } from "../../src/client/connect/index.js";

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {}

const connectSecret = process.env.ZEAM_CONNECT_SECRET;
if (!connectSecret) {
  console.error("Set ZEAM_CONNECT_SECRET");
  process.exit(1);
}

const stellarSecret = process.env.STELLAR_SEED;
if (!stellarSecret) {
  console.error("Set STELLAR_SEED (the Stellar private key for the stored session)");
  process.exit(1);
}

const stellarPublicKey = process.env.ZEAM_STELLAR_PUBLIC_KEY;
if (!stellarPublicKey) {
  console.error("Set ZEAM_STELLAR_PUBLIC_KEY");
  process.exit(1);
}

const STORED_PATH = `/tmp/zeam-sep10-${stellarPublicKey}.json`;

interface StoredSep10 {
  idToken: string;
  refreshToken: string;
  expiresAt: string;
  publicKey: string;
}

const stored = JSON.parse(fs.readFileSync(STORED_PATH, "utf8")) as StoredSep10;

console.log(`\nLoaded session`);
console.log(`  key:       ${stored.publicKey.slice(0, 12)}…`);
console.log(`  expiresAt: ${stored.expiresAt}  (expired — will trigger 401)`);

const session = new Session({
  track: Track.Connect,
  idToken: stored.idToken,
  refreshToken: stored.refreshToken,
  expiresAt: new Date(stored.expiresAt),
});

const fingerprintBefore = session.fingerprint;
console.log(`  fingerprint before: ${fingerprintBefore}`);

const baseURL = new URL(Environment.Production.baseURL);
const flow = new SEP10Flow(baseURL, (req) => fetch(req), newSigner(PublicNetworkPassphrase), {
  publicKey: stored.publicKey,
  secret: stellarSecret,
});

const client = new Client({
  environment: Environment.Production,
  skipVersionCheck: true,
  verboseErrors: true,
  refresher: flow,
});

const connect = new ConnectClient(client, connectSecret);

console.log("\nCalling connect.listCountries() with expired token…");

const countries = await connect.listCountries(session);

const fingerprintAfter = session.fingerprint;

console.log(`\n✓  Success — ${countries.length} countries returned`);
console.log(`  fingerprint before: ${fingerprintBefore}`);
console.log(
  `  fingerprint after:  ${fingerprintAfter}  ${fingerprintBefore !== fingerprintAfter ? "(token was refreshed)" : "(unchanged)"}`,
);
console.log(`\n  Sample countries:`);
for (const c of countries.slice(0, 5)) {
  console.log(`    ${c.isoCode ?? "??"}  ${c.name ?? ""}`);
}
