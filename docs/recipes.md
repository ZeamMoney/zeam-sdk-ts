# Recipes

Recipes are opinionated, one-function workflows over the low-level
`client/*` sub-packages. Each is safe to use directly or to drive
step-by-step when you need to interleave partner logic.

## Overview

| Recipe                | Purpose                                                     |
| --------------------- | ----------------------------------------------------------- |
| `loginOTP`            | Business OTP login (request + verify + persist).            |
| `registerApplication` | `POST /v1/application` with secure one-time-secret capture. |
| `connectLogin`        | Connect sign-in with application public key and secret.     |
| `ConnectPayment`      | 8-step Connect off-ramp orchestration (class).              |
| `rotateCredential`    | Rotate an application API key.                              |
| `quoteThenExecute`    | Generic `quote → execute` pattern (generic).                |

## `ConnectPayment` — the flagship

```ts
import { newConnectPayment } from "@zeammoney/sdk/recipes";

const flow = newConnectPayment(client, {
  businessSession,
  applicationSecret: vaultApplicationSecret,
  applicationPublicKey: appPublicKey,
  associationId: "6f…e2",
  walletId: "wallet-id",
  fundingAsset: "USDC:GA…",
  beneficiaryId: "bb…12",
  method: "MOBILE_MONEY",
  countryISO: "ZW",
  sendAmount: 100,
  connectSecret: vaultConnectSecret,
});

const result = await flow.do();
```

Steps (all exposed as methods for manual driving):

1. `listAssociations`
2. `listWallets`
3. `getBeneficiary`
4. `signInConnect`
5. `discoverConnectors`
6. `selectConnector` + `getConnectQuote`
7. `executeStellarTransaction`
8. `executeConnectPayment`

## `registerApplication` — secure capture callback

```ts
import { registerApplication } from "@zeammoney/sdk/recipes";

const result = await registerApplication(client, {
  session: businessSession,
  payload: registrationPayload,
  async captureOneTimeSecrets(s) {
    await vault.put({
      "application.secret": s.stellarSeed,
      "connect.secret": s.connectSecret,
      "api.key": s.apiKey,
      "webhook.secret": s.webhookSecret,
    });
  },
});
```

The SDK zeros the secrets immediately after your callback returns. If
it throws, the SDK rethrows — your caller knows the credentials were
minted but not captured, and must rotate.
