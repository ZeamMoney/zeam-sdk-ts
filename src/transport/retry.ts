/**
 * Retry policy from ADR 0008 R6:
 *
 *   - GET: retry on 408/429/502/503/504, max 2 attempts, full-jitter
 *     exponential backoff (base 100ms, cap 1s), honouring Retry-After.
 *   - POST/PUT/DELETE/PATCH: never retry on a received non-2xx response.
 *     Network-level errors (no response at all) are retried at most once,
 *     relying on Idempotency-Key propagation to make this safe.
 */

const retryableStatuses = new Set([408, 429, 502, 503, 504]);

/**
 * Should we retry a GET response with this status?
 */
export function isRetryableStatus(status: number): boolean {
  return retryableStatuses.has(status);
}

export interface RetryOptions {
  readonly maxGet: number;
  readonly maxWrite: number;
  /** Injected clock for testing. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Injected RNG for testing. */
  readonly random?: () => number;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * `fetch`-shaped retry wrapper. `doFetch` is the actual network call —
 * the wrapper calls it repeatedly up to the budget.
 */
export async function fetchWithRetry(
  input: Request,
  doFetch: (req: Request) => Promise<Response>,
  opts: RetryOptions = { maxGet: 2, maxWrite: 1 },
): Promise<Response> {
  const sleep = opts.sleep ?? defaultSleep;
  const random = opts.random ?? Math.random;
  const budget = input.method === "GET" ? opts.maxGet : opts.maxWrite;
  const writeVerb = input.method !== "GET";

  let lastResp: Response | undefined;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= budget; attempt++) {
    if (attempt > 0) {
      const delay = computeBackoff(attempt, lastResp, random);
      await sleep(delay);
      // Discard previous response body so the connection can be reused.
      if (lastResp) {
        try {
          await lastResp.body?.cancel();
        } catch {
          /* ignored */
        }
        lastResp = undefined;
      }
    }

    try {
      lastResp = await doFetch(cloneRequest(input));
    } catch (err) {
      lastErr = err;
      if (writeVerb && attempt < opts.maxWrite) continue;
      if (!writeVerb && attempt < opts.maxGet) continue;
      throw err;
    }

    if (writeVerb) {
      return lastResp;
    }

    if (!isRetryableStatus(lastResp.status) || attempt === budget) {
      return lastResp;
    }
  }

  if (lastResp) return lastResp;
  throw lastErr ?? new Error("zeam: exhausted retry budget");
}

/**
 * Compute the next sleep. If the previous response carried a
 * Retry-After header (seconds) and it's shorter than the cap, it wins.
 * Otherwise full-jitter exponential with base 100ms and cap 1s.
 */
export function computeBackoff(
  attempt: number,
  prev: Response | undefined,
  random: () => number,
): number {
  const capMs = 1000;
  if (prev) {
    const ra = prev.headers.get("Retry-After");
    if (ra) {
      const secs = Number(ra);
      if (Number.isFinite(secs) && secs >= 0) {
        const d = Math.min(secs * 1000, capMs);
        return d;
      }
    }
  }
  const exponent = Math.min(attempt - 1, 4);
  const max = Math.min(100 * 2 ** exponent, capMs);
  return Math.min(Math.floor(random() * (max + 1)), max);
}

function cloneRequest(req: Request): Request {
  // Fetch consumes the body on the first call, so we clone before each
  // retry. Body-bearing writes must have a bounded, replayable body —
  // the SDK only sends JSON strings so this is safe.
  return req.clone();
}
