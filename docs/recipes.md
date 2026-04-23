# Recipes

Recipes are opinionated, one-function workflows over the low-level
`client/*` sub-packages. Each is safe to use directly or to drive
step-by-step when you need to interleave partner logic.

## Overview

| Recipe                | Purpose                                                     |
| --------------------- | ----------------------------------------------------------- |
| `loginOTP`            | Business OTP login (request + verify + persist).            |
| `registerApplication` | `POST /v1/application` with secure one-time-secret capture. |
| `connectLogin`        | Full SEP-10 login using a stored Stellar seed.              |
| `ConnectPayment`      | 9-step Connect off-ramp orchestration (class).              |
| `rotateCredential`    | Rotate an application API key.                              |
| `quoteThenExecute`    | Generic `quote → execute` pattern (generic).                |

## `ConnectPayment` — the flagship

```ts
import { newConnectPayment } from "@zeammoney/sdk/recipes";
import { mustAsset } from "@zeammoney/sdk/stellar";

const flow = newConnectPayment(client, {
  businessSession,
  applicationSeed: vaultStellarSeed,
  applicationPublicKey: appPublicKey,
  associationId: "6f…e2",
  walletId: "wallet-id",
  fundingAsset: mustAsset("USDC:GA…"),
  beneficiaryId: "bb…12",
  method: "MOBILE_MONEY",
  countryISO: "ZW",
  sendAmount: "100.00",
  connectSecret: vaultConnectSecret,
});

const result = await flow.do();
```

Steps (all exposed as methods for manual driving):

1. `listAssociations`
2. `listWallets`
3. `getBeneficiary`
4. `signInConnect` (SEP-10)
5. `discoverConnectors`
6. `selectConnector` + `getConnectQuote`
7. `requiresStellarQuote()` + `getStellarQuote` (conditional)
8. `executeStellarTransaction`
9. `executeConnectPayment`

The SDK applies the strict-receive decision rule upstream: if
`fundingAsset !== connector.acceptedAsset` after normalisation, Step 7
runs and Step 8 uses `STRICT_PATH_RECEIVE` with the returned `sendMax`.

## `registerApplication` — secure capture callback

```ts
import { registerApplication } from "@zeammoney/sdk/recipes";

const result = await registerApplication(client, {
  session: businessSession,
  payload: registrationPayload,
  async captureOneTimeSecrets(s) {
    await vault.put({
      "stellar.secret": s.stellarSeed,
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
