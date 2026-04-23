/**
 * Header keys that are always redacted before logging.
 */
const sensitiveHeaderKeys = new Set([
  "authorization",
  "x-zeam-auth",
  "set-cookie",
  "cookie",
  "x-idempotency-key",
  "x-zeam-otp-token",
]);

/**
 * Body keys (case-insensitive) whose values are redacted when found in
 * attribute maps or structured events.
 */
const sensitiveBodyKeys = new Set([
  "idtoken",
  "refreshtoken",
  "accesstoken",
  "customtoken",
  "otp",
  "code",
  "secret",
  "stellarsecret",
  "connectsecret",
  "apikey",
  "apikeysecret",
  "webhooksecret",
  "password",
  "pin",
  "otp_session_id",
  "otpsessionid",
  "requestid",
  "bearer",
  "seed",
  "privatekey",
]);

/**
 * Value-shape patterns redacted regardless of key: Stellar seed,
 * Stellar public key, JWT, platform API key.
 */
const patterns: RegExp[] = [
  /\bS[A-Z2-7]{55}\b/g,
  /\bG[A-Z2-7]{55}\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /\b1_[A-Za-z0-9_-]{16,}\b/g,
];

/**
 * Return a shallow copy of `attrs` with sensitive values replaced by a
 * placeholder. Nested objects are redacted recursively. Input is not
 * mutated.
 */
export function redact(attrs: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) {
    out[k] = redactValue(k, v);
  }
  return out;
}

function redactValue(key: string, value: unknown): unknown {
  const lk = key.toLowerCase();
  if (sensitiveHeaderKeys.has(lk) || sensitiveBodyKeys.has(lk)) {
    return "<redacted>";
  }
  if (typeof value === "string") {
    return redactString(value);
  }
  if (value instanceof Uint8Array) {
    return "<redacted-bytes>";
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(key, item));
  }
  if (value !== null && typeof value === "object") {
    return redact(value as Record<string, unknown>);
  }
  return value;
}

/**
 * Apply pattern-based redaction to a bare string.
 */
export function redactString(s: string): string {
  let out = s;
  for (const p of patterns) {
    out = out.replace(p, "<redacted>");
  }
  return out;
}

/**
 * Copy of a header map with sensitive headers replaced.
 */
export function redactHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    out[key] = sensitiveHeaderKeys.has(key.toLowerCase()) ? "<redacted>" : redactString(value);
  }
  return out;
}

/**
 * First eight characters of a bearer-like string, safe for correlation
 * in audit logs.
 */
export function fingerprint(token: string): string {
  if (!token) return "";
  if (token.length <= 8) return `len=${token.length}`;
  return `${token.slice(0, 8)}…`;
}
