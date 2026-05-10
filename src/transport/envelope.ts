/**
 * Standard gateway envelope unwrap. The gateway emits:
 *
 *   {data, status, message}
 *
 * on both success and failure. `/auth-connect*` is the one exception —
 * bare JSON that we pass through unchanged.
 */
export interface EnvelopeError {
  status: number;
  requestId: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** Standard gateway envelope shape: {data, status, message} */
interface GatewayEnvelope {
  data?: unknown;
  status?: number;
  message?: string;
}

export type UnwrapResult = { ok: true; data: unknown } | { ok: false; error: EnvelopeError };

/**
 * Decode a gateway response. On success returns `{ok: true, data}`
 * where `data` is the inner envelope payload (or the raw body for
 * bare-JSON endpoints). On non-2xx status returns an `EnvelopeError`.
 */
export function unwrap(status: number, body: string): UnwrapResult {
  if (status >= 200 && status < 300) {
    try {
      const parsed = JSON.parse(body) as GatewayEnvelope;
      if (
        parsed &&
        typeof parsed.status === "number" &&
        parsed.status >= 200 &&
        "data" in parsed
      ) {
        return { ok: true, data: parsed.data };
      }
      // Bare-JSON passthrough for endpoints that don't use the
      // standard envelope (e.g. /auth-connect returns bare SEP-10 JSON).
      return { ok: true, data: parsed };
    } catch {
      return { ok: true, data: body };
    }
  }

  const out: EnvelopeError = { status, requestId: "", code: "", message: "" };
  try {
    const parsed = JSON.parse(body) as GatewayEnvelope;
    const msg = parsed.message ?? "";
    out.message = msg;
    // The gateway encodes error codes as the prefix before ":" in the
    // message field (e.g. "missing_field: amount is required").
    const colonIdx = msg.indexOf(":");
    if (colonIdx > 0) {
      out.code = msg.slice(0, colonIdx).trim();
    }
  } catch {
    // leave the EnvelopeError fields at their defaults.
  }
  return { ok: false, error: out };
}
