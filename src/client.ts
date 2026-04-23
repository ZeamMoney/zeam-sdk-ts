import { OTPFlow, SEP10Flow, MemoryStore, type TokenStore } from "./auth/index.js";
import type { Environment } from "./environment.js";
import { Environment as Env } from "./environment.js";
import { IncompatibleGatewayError, ZeamError, kindFromStatus } from "./errors.js";
import { newSigner, PublicNetworkPassphrase } from "./stellar/index.js";
import { newFetcher, type ObservabilityHook } from "./transport/fetcher.js";
import { unwrap } from "./transport/envelope.js";
import { MIN_GATEWAY_VERSION, VERSION } from "./version.js";

/**
 * Options passed to the {@link Client} constructor.
 */
export interface ClientOptions {
  environment?: Environment;
  /** Override the User-Agent header. Defaults to `@zeammoney/sdk/<VERSION>`. */
  userAgent?: string;
  /** Pluggable token persistence. Defaults to an in-memory store. */
  tokenStore?: TokenStore;
  /** Observability hook — attributes are redacted before being passed in. */
  observer?: ObservabilityHook;
  /** Include the gateway's human-readable message in `ZeamError.message`. */
  verboseErrors?: boolean;
  /** Permit plain-HTTP base URLs. Requires `ZEAM_SDK_ALLOW_INSECURE=1`. */
  insecureTransport?: boolean;
  /** Disable the `/healthz` version handshake. Intended for sandbox use. */
  skipVersionCheck?: boolean;
  /** Default per-call deadline in ms when no AbortSignal is supplied. */
  timeoutMs?: number;
  /** Override the SEP-10 network passphrase. Defaults to Public. */
  stellarNetwork?: string;
  /** Inject a custom fetch implementation — primarily for testing. */
  fetchImpl?: typeof fetch;
}

/**
 * The typed subset of Client the `client/*` sub-packages depend on.
 * Exposed so partners can write their own middleware adapters against
 * a narrow interface instead of the full class.
 */
export interface Doer {
  readonly baseURL: URL;
  readonly userAgent: string;
  readonly verboseErrors: boolean;
  readonly timeoutMs: number;
  fetch(req: Request): Promise<Response>;
}

/**
 * The SDK entry point. Construct one per process and pass it to the
 * `client/*` sub-packages or a recipes/ workflow.
 */
export class Client implements Doer {
  readonly baseURL: URL;
  readonly userAgent: string;
  readonly verboseErrors: boolean;
  readonly timeoutMs: number;
  readonly stellarNetwork: string;
  readonly tokenStore: TokenStore;

  readonly #fetcher: (req: Request) => Promise<Response>;
  readonly #skipVersionCheck: boolean;

  #otp?: OTPFlow;
  #sep10?: SEP10Flow;
  #versionChecked?: Promise<void>;

  constructor(opts: ClientOptions = {}) {
    const env = opts.environment ?? Env.Production;
    const url = new URL(env.baseURL);

    if (url.protocol === "http:") {
      if (!opts.insecureTransport) {
        throw new Error("zeam: http:// base URLs require insecureTransport: true");
      }
      if (process.env.ZEAM_SDK_ALLOW_INSECURE !== "1") {
        throw new Error("zeam: set ZEAM_SDK_ALLOW_INSECURE=1 to permit plain http");
      }
      console.warn("zeam-sdk: WARNING — plain HTTP transport in use; never use this in production");
    } else if (url.protocol !== "https:") {
      throw new Error(`zeam: unsupported URL scheme ${JSON.stringify(url.protocol)}`);
    }

    this.baseURL = url;
    this.userAgent = opts.userAgent ?? `@zeammoney/sdk/${VERSION}`;
    this.verboseErrors = opts.verboseErrors ?? false;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.stellarNetwork = opts.stellarNetwork ?? PublicNetworkPassphrase;
    this.tokenStore = opts.tokenStore ?? new MemoryStore();
    this.#skipVersionCheck = opts.skipVersionCheck ?? false;

    this.#fetcher = newFetcher({
      userAgent: this.userAgent,
      observer: opts.observer,
      fetchImpl: opts.fetchImpl,
    });
  }

  fetch(req: Request): Promise<Response> {
    return this.#fetcher(req);
  }

  /** Business OTP flow helper. */
  get otp(): OTPFlow {
    this.#otp ??= new OTPFlow(this.baseURL, (req) => this.#fetcher(req));
    return this.#otp;
  }

  /** Connect SEP-10 flow helper. */
  get sep10(): SEP10Flow {
    this.#sep10 ??= new SEP10Flow(
      this.baseURL,
      (req) => this.#fetcher(req),
      newSigner(this.stellarNetwork),
    );
    return this.#sep10;
  }

  /**
   * Run the version handshake against `/healthz`. Runs at most once per
   * client. Throws {@link IncompatibleGatewayError} if the gateway is
   * older than {@link MIN_GATEWAY_VERSION}.
   */
  async ping(signal?: AbortSignal): Promise<void> {
    if (this.#skipVersionCheck) return;
    this.#versionChecked ??= this.#performPing(signal);
    return this.#versionChecked;
  }

  async #performPing(signal: AbortSignal | undefined): Promise<void> {
    const u = new URL("/healthz", this.baseURL);
    const req = new Request(u, { method: "GET", signal });
    const resp = await this.#fetcher(req);
    const raw = await resp.text();
    if (!resp.ok) {
      throw new ZeamError({
        code: "healthz_failed",
        kind: kindFromStatus(resp.status),
        status: resp.status,
        requestId: resp.headers.get("X-Request-Id") ?? "",
      });
    }
    let version = "";
    try {
      const body = JSON.parse(raw) as { version?: string };
      version = body.version ?? "";
    } catch {
      throw new IncompatibleGatewayError("", MIN_GATEWAY_VERSION);
    }
    if (!version || compareSemver(version, MIN_GATEWAY_VERSION) < 0) {
      throw new IncompatibleGatewayError(version, MIN_GATEWAY_VERSION);
    }
  }

  /**
   * Direct HTTP escape hatch for endpoints not yet wrapped by the
   * typed clients. Still goes through the SDK transport stack.
   */
  raw(): RawClient {
    return new RawClient(this);
  }
}

/** `client.raw()` handle. */
export class RawClient {
  constructor(private client: Client) {}

  get(path: string, query?: URLSearchParams, signal?: AbortSignal): Promise<unknown> {
    return this.do("GET", path, query, undefined, signal);
  }

  post(path: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
    return this.do("POST", path, undefined, body, signal);
  }

  put(path: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
    return this.do("PUT", path, undefined, body, signal);
  }

  delete(path: string, signal?: AbortSignal): Promise<unknown> {
    return this.do("DELETE", path, undefined, undefined, signal);
  }

  private async do(
    method: string,
    path: string,
    query: URLSearchParams | undefined,
    body: unknown,
    signal: AbortSignal | undefined,
  ): Promise<unknown> {
    if (!path.startsWith("/")) {
      throw new Error(`zeam: raw path must be absolute, got ${JSON.stringify(path)}`);
    }
    const u = new URL(path, this.client.baseURL);
    if (query) u.search = query.toString();

    const req = new Request(u, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });

    const resp = await this.client.fetch(req);
    const raw = await resp.text();
    const parsed = unwrap(resp.status, raw);
    if (!parsed.ok) {
      throw new ZeamError({
        code: parsed.error.code,
        kind: kindFromStatus(parsed.error.status),
        status: parsed.error.status,
        requestId: parsed.error.requestId,
        upstreamMessage: parsed.error.message,
        details: parsed.error.details,
        verbose: this.client.verboseErrors,
      });
    }
    return parsed.data;
  }
}

/** MAJOR.MINOR.PATCH comparison; missing segments default to zero. */
function compareSemver(a: string, b: string): number {
  const pa = a
    .replace(/^v/, "")
    .split(".")
    .slice(0, 3)
    .map((s) => Number(s) || 0);
  const pb = b
    .replace(/^v/, "")
    .split(".")
    .slice(0, 3)
    .map((s) => Number(s) || 0);
  for (let i = 0; i < 3; i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}
