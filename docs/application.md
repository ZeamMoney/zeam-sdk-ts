# ApplicationClient

Wraps `/v1/application/*` — the integrator onboarding endpoints. Requires a Business-track session (OTP login).

```ts
import { Client, Environment } from "@zeammoney/sdk";
import { ApplicationClient } from "@zeammoney/sdk/client/application";

const client = new Client({ environment: Environment.Production });
const app = new ApplicationClient(client);

const challenge = await client.otp.requestOTP({ mobileNumber: "+27821234567" });
const session   = await client.otp.verifyOTP({ requestId: challenge.requestId, code });

const result = await app.register(session, {
  associationId:   "9e5064ac-e5a4-4f0b-be03-7819e2dfe9b3",
  applicationName: "my-app",
  webhookUrl:      "https://example.com/webhook",
  webhookMethod:   "POST",
});
```

---

## Authorization

All three methods require a Business-track session. The caller must be an **association admin** — i.e. the `associationId` in the payload must match an association the caller is an active admin of via the Business API.

There is no DB role requirement for association admins. If the account is not an association admin *and* has no `PlatformAdmin` / `KeysManager` DB role, the gateway returns `403 forbidden: insufficient permissions`.

> **Known backend bug** — `rotateCredential` has a secondary `CanManageKeys` DB check inside the handler that ignores the association-admin bypass. Association admins will always get 403 on that endpoint until the fix (`!middleware.IsAssociationAdmin(c)` guard added to `credential_handlers.go:31`) is deployed. `rotateWebhookSecret` is unaffected.

---

## Methods

| Method | Endpoint | Auth |
|---|---|---|
| `register(session, input)` | `POST /v1/application` | association admin or PlatformAdmin / Owner |
| `rotateCredential(session, id)` | `POST /v1/application/:id/rotate-credential` | PlatformAdmin / KeysManager ⚠️ see above |
| `rotateWebhookSecret(session, id, webhookId)` | `POST /v1/application/:id/webhook/:webhookId/rotate-secret` | association admin or PlatformAdmin / KeysManager |

---

## `register()`

Creates a new integrator application and returns **one-time-only credentials**. The gateway will never return these secrets again. Use the `recipes.registerApplication` wrapper to enforce capture before the SDK zeros them.

### Input — `RegisterApplicationInput`

| Field | Type | Required | Notes |
|---|---|---|---|
| `associationId` | `string` | ✅ | UUID of the association to register under. Also triggers the association-admin auth bypass. |
| `applicationName` | `string` | ✅ | 1–255 chars. Must be unique within the association. |
| `webhookUrl` | `string` | ✅ | Must be a valid URL. |
| `webhookMethod` | `"POST" \| "PUT"` | — | Defaults to `POST` upstream if omitted. |
| `settlementAccount` | `SettlementAccount` | — | `{ publicKey, vaultId }` |
| `expiresAt` | `string` | — | RFC3339. |

### Response — `RegistrationResponse`

```ts
{
  application:   ApplicationRecord;      // id, status, environment, publicKey, …
  integratorId:  string;                 // Stellar public key (same as application.publicKey)
  stellar:       StellarMaterial;        // { publicKey, secret ⚠️, vaultId }
  apiKey:        APIKeyMaterial;         // { keyId, secret ⚠️, last4 }
  webhookSecret: WebhookSecretMaterial;  // { webhookId, secret ⚠️, last4 }
  connectSecret: string;                 // ⚠️ one-time only
  idpAuthId?:    string;
  warnings?:     string[];
}
```

Fields marked ⚠️ are **one-time only** — zero or lose them and they cannot be recovered.

`application.id` (UUID) is the correct ID to pass to `rotateCredential` and `rotateWebhookSecret`. Do not use `integratorId` (Stellar public key) for those calls.

### Application statuses

New applications are created with `status: "pending_approval"`. The lifecycle is:

```
draft → pending_approval → approved → suspended / revoked
```

---

## `rotateCredential(session, id)`

Issues a new API key for an existing application and marks the previous one as `rotating`. The old key stays valid for a rotation window before expiring.

`id` must be the application UUID (`application.id` from the registration response) — **not** `integratorId`.

### Response — `RotateCredentialResponse`

```ts
{ keyId: string; secret: string; last4: string }
```

Use `recipes.rotateCredential` to enforce secret capture before the SDK zeros it.

---

## `rotateWebhookSecret(session, id, webhookId)`

Generates a new signing secret for a webhook. Previous secret enters rotation window.

`id` = application UUID. `webhookId` = `webhookSecret.webhookId` from the registration response (or `GET /v1/application/:id/webhook`).

### Response — `RotateWebhookSecretResponse`

```ts
{ webhookId: string; secret: string; last4: string }
```

---

## Key types

```ts
interface RegisterApplicationInput {
  associationId:     string;
  applicationName:   string;
  webhookUrl:        string;
  webhookMethod?:    "POST" | "PUT";
  settlementAccount?: { publicKey: string; vaultId: string };
  expiresAt?:        string;
}

interface ApplicationRecord {
  id:                 string;   // UUID — use this for rotate calls
  applicationName:    string;
  associationId:      string;
  classificationCode: string;
  publicKey?:         string;
  connectIntegratorId?: string;
  environment:        string;
  status:             string;
  activated:          boolean;
  idpAuthId?:         string;
  createdAt:          string;
  updatedAt:          string;
}

interface StellarMaterial        { publicKey: string; secret: string; vaultId: string }
interface APIKeyMaterial         { keyId: string; secret: string; last4: string }
interface WebhookSecretMaterial  { webhookId: string; secret: string; last4: string }
interface RotateCredentialResponse    { keyId: string; secret: string; last4: string }
interface RotateWebhookSecretResponse { webhookId: string; secret: string; last4: string }
```

---

## Safe-to-use recipe wrappers

```ts
import { registerApplication, rotateCredential } from "@zeammoney/sdk/recipes";

// Register — forces secret capture before SDK zeros them
const result = await registerApplication(client, {
  session,
  payload: { associationId, applicationName, webhookUrl },
  captureOneTimeSecrets: async (secrets) => {
    await vault.store(secrets); // MUST persist before this returns
  },
});

// Rotate credential
await rotateCredential(client, {
  session,
  applicationId: result.integratorId,
  captureNew: async ({ keyId, newSecret, last4 }) => {
    await vault.update({ keyId, secret: newSecret });
  },
});
```

---

## Smoke tests

| File | Purpose |
|---|---|
| `test/api-application-smoke.ts` | Raw gateway — logs full request/response for all 3 endpoints |
| `test/application-smoke.ts` | SDK smoke — exercises `ApplicationClient` methods end-to-end |

```bash
ZEAM_TEST_MOBILE=+27821234567 \
ZEAM_TEST_ASSOCIATION_ID=9e5064ac-e5a4-4f0b-be03-7819e2dfe9b3 \
npx tsx test/application-smoke.ts
```

`ZEAM_TEST_ASSOCIATION_ID` is required for `register()` to pass auth. It is set in `~/.zshrc`.
