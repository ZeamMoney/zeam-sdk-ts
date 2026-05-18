#!/usr/bin/env npx tsx
import * as readline from "node:readline/promises";
import { Client, Environment } from "../../src/index.js";
import { BusinessClient } from "../../src/client/business/index.js";
import { getSession } from "../session-helper.js";

try { process.loadEnvFile(new URL("../.env", import.meta.url)); } catch {}

const mobile = process.env.ZEAM_MOBILE!;
if (!mobile) { console.error("Set ZEAM_MOBILE"); process.exit(1); }

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const client = new Client({ environment: Environment.Production, verboseErrors: true, skipVersionCheck: true });

async function main() {
  const session = await getSession(mobile, client, rl);
  const biz = new BusinessClient(client);
  const assocs = await biz.listAssociations(session);
  for (const a of assocs) {
    console.log(`\nassociation: "${a.associationName}" (${a.id})`);
    const wallets = await biz.listWalletsByAssociation(session, a.id);
    if (!wallets.length) { console.log("  (no wallets)"); continue; }
    for (const w of wallets) {
      console.log(`  wallet: "${w.walletName}"  id=${w.id}  publicKey=${w.publicKey}`);
    }
  }
  rl.close();
}

main().catch((e) => { console.error(e); rl.close(); process.exit(1); });
