// Example: register an application and securely capture one-time
// credentials. Replace the callback body with a real secret-manager
// call in production.
//
//   npx tsx examples/app-registration/main.ts
//
import { Client, Environment } from "@zeammoney/sdk";
import type { Session } from "@zeammoney/sdk/auth";
import { registerApplication } from "@zeammoney/sdk/recipes";

async function main(): Promise<void> {
  const client = new Client({ environment: Environment.Production });

  // Partner-provided: load an existing Business session (typically
  // obtained via loginOTP and rehydrated from a secret manager).
  const session: Session = /* your loader here */ null as unknown as Session;

  const result = await registerApplication(client, {
    session,
    payload: { name: "demo-app", environment: "sandbox" },
    async captureOneTimeSecrets(s) {
      // In production: await vault.put({...})
      console.warn(
        `CAPTURE NOW — stellar.publicKey=${s.stellarPublicKey} apiKey.id=${s.apiKey.slice(0, 4)}… webhook.id=${s.webhookId}`,
      );
    },
  });
  console.warn(
    `registered integratorId=${result.integratorId} stellarPublicKey=${result.stellarPublicKey}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
