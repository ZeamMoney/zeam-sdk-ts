import { fetchWithRetry } from "./retry.js";
import { redact } from "./redaction.js";

/**
 * Observer callback. Attributes are redacted before being passed in.
 */
export type ObservabilityHook = (event: string, attrs: Record<string, unknown>) => void;

export interface FetcherOptions {
  readonly userAgent: string;
  readonly observer?: ObservabilityHook;
  /** Injected fetch, primarily for testing. */
  readonly fetchImpl?: typeof fetch;
}

/**
 * Fetcher is the decorated fetch used by the SDK. It:
 *
 *   - attaches a User-Agent header
 *   - generates an Idempotency-Key on mutating verbs when the caller
 *     didn't supply one
 *   - delegates to the retry wrapper for GETs
 *   - emits a single redacted event per request to the observer hook.
 */
export function newFetcher(opts: FetcherOptions): (req: Request) => Promise<Response> {
  const baseFetch = opts.fetchImpl ?? fetch;

  return async function doRequest(req: Request): Promise<Response> {
    // User-Agent
    if (!req.headers.has("User-Agent")) {
      req.headers.set("User-Agent", opts.userAgent);
    }

    // Idempotency-Key on mutating verbs
    if (isMutating(req.method) && !req.headers.has("Idempotency-Key")) {
      req.headers.set("Idempotency-Key", crypto.randomUUID());
    }

    const start = Date.now();
    let resp: Response | undefined;
    let err: unknown;
    try {
      resp = await fetchWithRetry(req, baseFetch, { maxGet: 2, maxWrite: 1 });
    } catch (e) {
      err = e;
    }
    const latency = Date.now() - start;

    if (opts.observer) {
      const u = new URL(req.url);
      const attrs: Record<string, unknown> = {
        method: req.method,
        host: u.host,
        path: u.pathname,
        latency_ms: latency,
      };
      if (resp) {
        attrs.status = resp.status;
        attrs.x_request_id = resp.headers.get("X-Request-Id") ?? "";
      }
      if (err) {
        attrs.error = err instanceof Error ? err.message : String(err);
      }
      try {
        opts.observer("http.request", redact(attrs));
      } catch {
        /* observers must not throw; swallow */
      }
    }

    if (err) throw err;
    return resp!;
  };
}

export function isMutating(method: string): boolean {
  switch (method.toUpperCase()) {
    case "POST":
    case "PUT":
    case "PATCH":
    case "DELETE":
      return true;
    default:
      return false;
  }
}
