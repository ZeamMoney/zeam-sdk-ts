/**
 * Generic "quote → execute" helper used by payments, tokenops, and
 * Connect. Callers supply typed `quote` and `execute` functions; the
 * recipe wires timeouts and error context around them. If `decide`
 * returns `false`, execution is skipped and the quote is returned with
 * a `null` result.
 */
export async function quoteThenExecute<In, Q, R>(options: {
  input: In;
  quote: (input: In, signal?: AbortSignal) => Promise<Q>;
  execute: (quote: Q, signal?: AbortSignal) => Promise<R>;
  decide?: (quote: Q) => Promise<boolean> | boolean;
  quoteTimeoutMs?: number;
  signal?: AbortSignal;
}): Promise<{ quote: Q; result: R | null }> {
  const { input, quote, execute, decide, quoteTimeoutMs, signal } = options;

  let quoteSignal = signal;
  let timer: NodeJS.Timeout | undefined;
  if (quoteTimeoutMs && quoteTimeoutMs > 0) {
    const ctrl = new AbortController();
    timer = setTimeout(() => ctrl.abort(), quoteTimeoutMs);
    // Chain caller signal → controller.
    if (signal) {
      signal.addEventListener("abort", () => ctrl.abort(), { once: true });
    }
    quoteSignal = ctrl.signal;
  }

  try {
    const q = await quote(input, quoteSignal);
    if (decide && !(await decide(q))) {
      return { quote: q, result: null };
    }
    const r = await execute(q, signal);
    return { quote: q, result: r };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
