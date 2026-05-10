// Example: run the 9-step Connect off-ramp payment recipe.
//
//   ZEAM_APP_SEED=S... ZEAM_APP_PUBLIC_KEY=G... ZEAM_CONNECT_SECRET=... \
//     npx tsx examples/connect-payment/main.ts
//
import { Client, Environment } from "@zeammoney/sdk";
import type { Session } from "@zeammoney/sdk/auth";
import { newConnectPayment } from "@zeammoney/sdk/recipes";
import { mustAsset } from "@zeammoney/sdk/stellar";

async function main(): Promise<void> {
  const client = new Client({ environment: Environment.Production });

  // Partner-supplied inputs.
  const businessSession: Session = /* your loader here */ null as unknown as Session;
  const appSeed = process.env.ZEAM_APP_SEED ?? "";
  const appPub = process.env.ZEAM_APP_PUBLIC_KEY ?? "";
  const connectSecret = process.env.ZEAM_CONNECT_SECRET ?? "";

  const flow = newConnectPayment(client, {
    businessSession,
    applicationSeed: appSeed,
    applicationPublicKey: appPub,
    associationId: "6f…e2",
    walletId: "wallet-id",
    fundingAsset: mustAsset("USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"),
    beneficiaryId: "bb…12",
    method: "MOBILE_MONEY",
    countryISO: "ZW",
    sendAmount: "100.00",
    connectSecret,
  });

  const result = await flow.do();
  console.warn(
    `connect tx=${result.connectTransactionId} status=${result.connectStatus} stellar=${result.stellarTxHash}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
