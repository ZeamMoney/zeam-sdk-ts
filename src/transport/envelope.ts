/**
 * SPEC §18 envelope unwrap. The gateway emits:
 *
 *   {ok, request_id, resource, verb, data, state?, substate?}
 *
 * on success and
 *
 *   {ok: false, request_id, errors: [{code, message, details}]}
 *
 * on failure. `/auth-connect*` is the one exception — bare JSON that we
 * pass through unchanged.
 */
export interface EnvelopeError {
  status: number;
  requestId: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

interface SuccessEnvelope {
  ok?: boolean;
  request_id?: string;
  data?: unknown;
}

interface ErrorEnvelope {
  ok?: boolean;
  request_id?: string;
  errors?: Array<{ code?: string; message?: string; details?: Record<string, unknown> }>;
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
      const parsed = JSON.parse(body) as SuccessEnvelope;
      if (parsed && parsed.ok === true && "data" in parsed) {
        return { ok: true, data: parsed.data };
      }
      return { ok: true, data: parsed };
    } catch {
      return { ok: true, data: body };
    }
  }

  const out: EnvelopeError = { status, requestId: "", code: "", message: "" };
  try {
    const parsed = JSON.parse(body) as ErrorEnvelope;
    out.requestId = parsed.request_id ?? "";
    const first = parsed.errors?.[0];
    if (first) {
      out.code = first.code ?? "";
      out.message = first.message ?? "";
      out.details = first.details;
    }
  } catch {
    // leave the EnvelopeError fields at their defaults.
  }
  return { ok: false, error: out };
}
