# Operational patterns

The SDK is safe by default but cannot by itself guarantee a safe
deployment. This page captures the infrastructure expectations the
team recommends for partners running the SDK in production.

## Secret storage

| Class                                                                                             | Recommended                                                                                      | Acceptable                                    | Discouraged                          |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------ |
| **One-time secrets** (`stellar.secret`, `connectSecret`, `apiKey.secret`, `webhookSecret.secret`) | Cloud secret manager (Azure Key Vault, AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault) | OS keychain via `KeyringStore` (Phase 3)      | `.env`, plaintext files, git history |
| **Issued bearer / refresh tokens**                                                                | `MemoryStore` (default)                                                                          | Durable secret manager for long-lived daemons | Disk without encryption              |
| **Gateway URLs, integrator IDs**                                                                  | Non-secret config file / env var                                                                 | Build-time constants                          | —                                    |

## Environment variables

The SDK reads exactly one env var: `ZEAM_SDK_ALLOW_INSECURE`. Every
other configuration flows through the `Client` constructor so it's
explicit in code.

## Rotation

- Use `rotateCredential` for API-key rotation. The old key enters
  `rotating` state upstream; migrate before the window closes.
- Use `ApplicationClient.rotateWebhookSecret` for webhook HMAC
  rotation. The old secret stays valid while `rotating`; swap your
  verifier once the new secret is stored.

## Logging & observability

- Structured logs only. The SDK's `redact` runs before any
  user-supplied observer, but your app may still emit secrets if you
  log request bodies directly.
- Use `new Client({ observer })` to receive a redacted
  `http.request` event per call. The observer MUST NOT throw; the SDK
  swallows thrown errors to protect request processing.
- Never attach a telemetry backend that forwards arbitrary fields to a
  third party without its own redaction layer.

## Deployment hardening

- Run as a **non-root** user.
- Use a read-only filesystem (Kubernetes
  `securityContext.readOnlyRootFilesystem: true`).
- Set memory limits — Node's V8 can keep strings alive across
  generations; swapping multiplies the blast radius of a leak.
- Drop Linux capabilities (`CAP_DROP=ALL`).
- Keep NTP / chrony running — SEP-10 signatures are time-bound.

## Incident response

1. Revoke the compromised credential via the platform portal.
2. Call `rotateCredential` / the webhook-secret rotation.
3. Invalidate any active Firebase sessions server-side.
4. Email `security@zeam.app` with the integrator ID and suspected
   blast radius.

## Backup & disaster recovery

Treat SDK runtime state as ephemeral. On recovery, partners should
re-authenticate (OTP / SEP-10) rather than restore cached refresh
tokens.
