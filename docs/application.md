# ApplicationClient

Wraps `/v1/application/*` — the integrator onboarding and lifecycle endpoints. Requires a Business-track session (OTP login).

```ts
import { Client, Environment } from "@zeammoney/sdk";
import { ApplicationClient } from "@zeammoney/sdk/client/application";

const client = new Client({ environment: Environment.Production });
const app    = new ApplicationClient(client);

const challenge = await client.otp.requestOTP({ mobileNumber: "+27821234567" });
const session   = await client.otp.verifyOTP({ requestId: challenge.requestId, code });

const rec = await app.register(session, {
  associationId:   "9e5064ac-e5a4-4f0b-be03-7819e2dfe9b3",
  applicationName: "my-app",
  webhookUrl:      "https://example.com/webhook",
});
```

---

## Status — live-tested ✅

All 20 methods smoke-tested against the live gateway. Three endpoints are blocked by authorization constraints or backend gaps (documented below) — these are not SDK bugs.

---

## Authorization

All methods require a Business-track session. The caller must be an **association admin** for the target `associationId`, or hold a `PlatformAdmin` / `KeysManager` DB role. If neither condition is met the gateway returns `403 forbidden: insufficient permissions`.

The `associationId` must appear in the request body (for `register`, `provision`) or be derivable from the application record (for all other routes). Without it the association-admin bypass never fires.

---

## Methods

### Core

| Method | Endpoint | HTTP | Returns |
|---|---|---|---|
| `listApplications(session, associationId)` | `/v1/applications/:associationId` | GET | `ApplicationRecord[]` |
| `lookup(session, publicKey)` | `/v1/application/lookup` | GET | `ApplicationRecord` |
| `getApplication(session, id)` | `/v1/application/:id` | GET | `ApplicationRecord` |
| `getApplicationEvents(session, id)` | `/v1/application/:id/event` | GET | `ApplicationEvent[]` |
| `provision(session, input)` | `/v1/application/provision` | POST | `ApplicationRecord` |
| `register(session, input)` | `/v1/application` | POST | `RegistrationResponse` |
| `activate(session, id, input)` | `/v1/application/:id/activate` | POST | `RegistrationResponse` |

### Lifecycle

| Method | Endpoint | HTTP | Returns |
|---|---|---|---|
| `submit(session, id, input?)` | `/v1/application/:id/submit` | POST | `ApplicationRecord` |
| `approve(session, id, input?)` | `/v1/application/:id/approve` | POST | `ApplicationRecord` |
| `reject(session, id, input?)` | `/v1/application/:id/reject` | POST | `ApplicationRecord` |
| `suspend(session, id, input?)` | `/v1/application/:id/suspend` | POST | `ApplicationRecord` |
| `resume(session, id, input?)` | `/v1/application/:id/resume` | POST | `ApplicationRecord` |
| `revoke(session, id, input?)` | `/v1/application/:id/revoke` | POST | `ApplicationRecord` |

### Credentials

| Method | Endpoint | HTTP | Returns |
|---|---|---|---|
| `rotateCredential(session, id)` | `/v1/application/:id/rotate-credential` | POST | `RotateCredentialResponse` |
| `tokenSmokeTest(session, id)` | `/v1/application/:id/token` | POST | `TokenSmokeTestResponse` |

### Webhooks

| Method | Endpoint | HTTP | Returns |
|---|---|---|---|
| `listWebhooks(session, id)` | `/v1/application/:id/webhook` | GET | `Webhook[]` |
| `addWebhook(session, id, input)` | `/v1/application/:id/webhook` | POST | `AddWebhookResponse` |
| `updateWebhook(session, id, webhookId, input)` | `/v1/application/:id/webhook/:webhookId` | PATCH | `Webhook` |
| `deleteWebhook(session, id, webhookId)` | `/v1/application/:id/webhook/:webhookId` | DELETE | `void` |
| `rotateWebhookSecret(session, id, webhookId)` | `/v1/application/:id/webhook/:webhookId/rotate-secret` | POST | `RotateWebhookSecretResponse` |

---

## Blocked endpoints

### `lookup` — 403 insufficient permissions

`GET /v1/application/lookup?publicKey=...` requires a `PlatformAdmin` or `KeysManager` DB role. Association admins cannot call this — the association-admin bypass is not wired to the lookup handler. Not an SDK bug; the caller needs an elevated role.

### `approve` — 403 approver must differ from submitter

The gateway enforces a two-person rule: the account that submitted an application cannot also approve it. To test `approve` and the subsequent `suspend`/`resume` cycle:

1. Register and submit with account A.
2. Set `ZEAM_TEST_APPROVED_APP_ID` to that application UUID.
3. Run the smoke test as account B (different mobile number) — account B must also be an association admin.

### `suspend` — skipped, requires approved app

Depends on the two-person setup above. The smoke test skips `suspend` when `ZEAM_TEST_APPROVED_APP_ID` is not set. Once set, `suspend` runs against that application ID and only proceeds to `resume` if `suspend` succeeds.

### `resume` — skipped, requires suspend to succeed

Runs only if `ZEAM_TEST_APPROVED_APP_ID` is set and `suspend` returned successfully. Both are gated on the same env var — see `approve` setup above.

### `rotateCredential` — 403 upstream bug

`credential_handlers.go:31` has a secondary `CanManageKeys` DB check that does not respect the association-admin context key set by `AssociationAccessMiddleware`. Association admins always get 403. Fix:

```go
// before
if h.Authorizer != nil && !h.Authorizer.CanManageKeys(c.Request.Context(), actor, id) {

// after
if h.Authorizer != nil && !middleware.IsAssociationAdmin(c) && !h.Authorizer.CanManageKeys(c.Request.Context(), actor, id) {
```

Until the fix is deployed, only accounts with a `KeysManager` DB role can call this endpoint. `rotateWebhookSecret` is unaffected.

### `tokenSmokeTest` — 501 not implemented

`POST /v1/application/:id/token` returns `501 downstream_error: signer resolver is not configured`. The backend `SignerStore` integration is not deployed in any environment yet. The SDK method exists and is typed, but the endpoint is non-functional. Do not use until the gateway team deploys the signer resolver.

---

## Application lifecycle

```
draft → pending_approval → approved → suspended ⇄ active
                        ↘ rejected
                        ↘ revoked  (terminal)
```

| Status | How to reach |
|---|---|
| `draft` | `provision()` |
| `pending_approval` | `register()`, `activate()`, `submit()` |
| `approved` | `approve()` — two-person rule applies |
| `rejected` | `reject()` |
| `suspended` | `suspend()` — only from `approved` |
| `revoked` | `revoke()` — terminal |

`"submitted"` is an **event type** in `ApplicationEvent.eventType`, not a status value. After `submit()` the status becomes `"pending_approval"`.

---

## One-time secrets

`register()` and `activate()` both return a `RegistrationResponse` containing credentials that the gateway will **never return again**. The SDK validates that all one-time fields are present before returning — if any are missing it throws immediately.

Fields marked ⚠️ are one-time only:

```ts
{
  application:    ApplicationRecord;
  integratorId:   string;                  // Stellar public key
  stellar:        StellarMaterial;         // { publicKey, secret ⚠️, vaultId }
  apiKey:         APIKeyMaterial;          // { keyId, secret ⚠️, last4 }
  webhookSecret?: WebhookSecretMaterial;   // { webhookId, secret ⚠️, last4 }
  connectSecret:  string;                  // ⚠️ one-time only
  idpAuthId:      string;
  warnings?:      string[];
}
```

`webhookSecret` is optional on the type because `activate()` may not return it in all configurations. The SDK guard in `register()` treats its absence as a hard error since `webhookUrl` is required in the registration input.

Use the recipe wrapper to enforce capture before the SDK zeros the in-memory copies:

```ts
import { registerApplication } from "@zeammoney/sdk/recipes";

const result = await registerApplication(client, {
  session,
  payload: { associationId, applicationName, webhookUrl },
  captureOneTimeSecrets: async (secrets) => {
    // MUST persist before this returns — SDK zeros immediately after
    await vault.store(secrets);
  },
});
// result contains only safe-to-log fields (ids, last4, publicKey)
```

---

## Key types

```ts
type ApplicationStatus =
  | "draft" | "pending_approval" | "approved"
  | "rejected" | "suspended" | "revoked";

interface ApplicationRecord {
  id:                        string;   // UUID — use for all subsequent calls
  associationId:             string;
  applicationName:           string;
  classificationCode:        string;
  publicKey?:                string | null;
  connectIntegratorId?:      string | null;
  idpAuthId?:                string | null;
  settlementAccountPublicKey?: string | null;
  environment:               string;
  status:                    ApplicationStatus;
  activated:                 boolean;
  expiresAt?:                string | null;
  createdAt:                 string;
  updatedAt:                 string;
}

interface ApplicationEvent {
  id:            string;
  applicationId?: string;
  actorUserId?:  string;
  actorIp?:      string;
  userAgent?:    string;
  eventType:     string;
  outcome:       string;
  metadata:      Record<string, unknown>;
  reason?:       string;
  createdAt:     string;
}

interface RegisterApplicationInput {
  associationId:      string;
  applicationName:    string;
  webhookUrl:         string;
  webhookMethod?:     "POST" | "PUT";
  settlementAccount?: { publicKey: string; vaultId: string };
  expiresAt?:         string;
  classificationCode?: string;
  publicKey?:         string;
  stellarSeedVaultId?: string;
  environment?:       "sandbox" | "production";
}

interface ProvisionApplicationInput {
  associationId:   string;
  applicationName: string;
  expiresAt?:      string;
}

interface ActivateApplicationInput {
  webhookUrl:      string;
  webhookMethod?:  "POST" | "PUT";
  settlementAccount?: { publicKey: string; vaultId: string };
}

interface TransitionInput { reason?: string }

interface StellarMaterial       { publicKey: string; secret: string; vaultId: string }
interface APIKeyMaterial        { keyId: string; secret: string; last4: string }
interface WebhookSecretMaterial { webhookId: string; secret: string; last4: string }

interface RegistrationResponse {
  application:    ApplicationRecord;
  integratorId:   string;
  stellar:        StellarMaterial;
  apiKey:         APIKeyMaterial;
  webhookSecret?: WebhookSecretMaterial;
  connectSecret:  string;
  idpAuthId:      string;
  warnings?:      string[];
}

interface RotateCredentialResponse    { keyId: string; secret: string; last4: string }
interface TokenSmokeTestResponse      { success?: boolean; token?: string }

type WebhookStatus = "pending_verification" | "active" | "paused" | "disabled" | "revoked";

interface Webhook {
  id:              string;
  applicationId:   string;
  url:             string;
  webhookMethod:   "POST" | "PUT";
  description?:    string | null;
  authScheme:      "none" | "bearer" | "hmac";
  status:          WebhookStatus;
  failureCount:    number;
  lastSuccessAt?:  string | null;
  lastFailureAt?:  string | null;
  createdBy:       string;   // always present — non-pointer UUID in Go
  deletedAt?:      string | null;
  createdAt:       string;
  updatedAt:       string;
}

interface AddWebhookInput {
  url:          string;
  webhookMethod: "POST" | "PUT";
  authScheme:   "none" | "bearer" | "hmac";
  description?: string;
}

interface AddWebhookResponse {
  webhook: Webhook;
  secret:  RotateWebhookSecretResponse;
}

interface UpdateWebhookInput {
  url?:          string;
  webhookMethod?: "POST" | "PUT";
  description?:  string | null;
  status?:       WebhookStatus;
}

interface RotateWebhookSecretResponse { webhookId: string; secret: string; last4: string }
```

---

## Smoke tests

```bash
# SDK smoke — all 20 methods
ZEAM_TEST_MOBILE=+27821234567 \
ZEAM_TEST_ASSOCIATION_ID=9e5064ac-e5a4-4f0b-be03-7819e2dfe9b3 \
npx tsx test/application-smoke.ts

# Raw gateway verification
ZEAM_TEST_MOBILE=+27821234567 \
ZEAM_TEST_ASSOCIATION_ID=9e5064ac-e5a4-4f0b-be03-7819e2dfe9b3 \
npx tsx test/api-application-smoke.ts

# To test suspend/resume (requires a pre-approved app from a different account):
ZEAM_TEST_APPROVED_APP_ID=<uuid> \
npx tsx test/application-smoke.ts
```

| File | Purpose |
|---|---|
| `test/application-smoke.ts` | SDK smoke — all 20 `ApplicationClient` methods |
| `test/api-application-smoke.ts` | Raw gateway — full request/response logging |
