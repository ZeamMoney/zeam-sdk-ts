import type { Doer } from "../../client.js";
import { coreMethods } from "./core/index.js";
import { credentialMethods } from "./credentials/index.js";
import { lifecycleMethods } from "./lifecycle/index.js";
import { webhookMethods } from "./webhooks/index.js";

export type {
  ActivateApplicationInput,
  APIKeyMaterial,
  ApplicationEvent,
  ApplicationRecord,
  ApplicationStatus,
  ProvisionApplicationInput,
  RegisterApplicationInput,
  RegistrationResponse,
  SettlementAccount,
  StellarMaterial,
  WebhookSecretMaterial,
} from "./core/index.js";
export type { RotateCredentialResponse, TokenSmokeTestResponse } from "./credentials/index.js";
export type { TransitionInput } from "./lifecycle/index.js";
export type {
  AddWebhookInput,
  AddWebhookResponse,
  RotateWebhookSecretResponse,
  UpdateWebhookInput,
  Webhook,
  WebhookStatus,
} from "./webhooks/index.js";

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface ApplicationClient
  extends ReturnType<typeof coreMethods>,
    ReturnType<typeof lifecycleMethods>,
    ReturnType<typeof webhookMethods>,
    ReturnType<typeof credentialMethods> {}

/**
 * Wraps `/v1/application/*`. Requires a Firebase-backed Business session.
 * Methods are split across four domain subfolders and composed here.
 *
 * The `register` call is the single most sensitive call in the SDK — the
 * callback wrapper in `recipes.registerApplication` is the intended entry
 * point for partners.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class ApplicationClient {
  constructor(doer: Doer) {
    Object.assign(
      this,
      coreMethods(doer),
      lifecycleMethods(doer),
      webhookMethods(doer),
      credentialMethods(doer),
    );
  }
}
