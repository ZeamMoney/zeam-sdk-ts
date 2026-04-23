import { Track, type Session } from "../../auth/index.js";
import type { Doer } from "../../client.js";
import { call } from "../call.js";

export interface Connector {
  id: string;
  name: string;
  method: string;
  isActive: boolean;
  acceptedAsset: string;
  destinationAsset: string;
  requiresQuote: boolean;
  fees?: unknown;
  limits?: unknown;
  execution?: unknown;
  [k: string]: unknown;
}

export interface ConnectorQueryInput {
  countryISO: string;
  method: string;
}

export interface QuoteInput {
  connector_id: string;
  amount: string;
  currency: string;
  destination: unknown;
}

export interface QuoteResponse {
  quoteId: string;
  acceptedAsset: string;
  destinationAsset: string;
  sendAmount: string;
  receiveAmount: string;
  fxRate?: string;
  expiresAt?: string;
  clearingAccount?: string;
  [k: string]: unknown;
}

export interface ExecuteInput {
  quoteId: string;
  txHash: string;
  destination: unknown;
  memo?: string;
}

export interface ExecuteResponse {
  transactionId: string;
  status: string;
  [k: string]: unknown;
}

/** Enum guard: uppercase ASCII / digits / underscores only. */
const ENUM_RE = /^[A-Z0-9_]+$/;
/** SSRF guard regex for `/v1/connect-exec/*path`. */
export const EXEC_PATH_RE = /^[a-zA-Z0-9/_-]+$/;

/**
 * Wraps `/v1/connect-*`. Requires a Connect (SEP-10) session AND the
 * integrator secret captured at registration.
 */
export class ConnectClient {
  constructor(
    private doer: Doer,
    private connectSecret: string,
  ) {}

  async queryConnectors(
    session: Session,
    input: ConnectorQueryInput,
    signal?: AbortSignal,
  ): Promise<Connector[]> {
    if (!ENUM_RE.test(input.countryISO)) {
      throw new Error(
        `connect: countryISO must match ^[A-Z0-9_]+$, got ${JSON.stringify(input.countryISO)}`,
      );
    }
    if (!ENUM_RE.test(input.method)) {
      throw new Error(
        `connect: method must match ^[A-Z0-9_]+$, got ${JSON.stringify(input.method)}`,
      );
    }
    const raw = await call<{
      data?: { connectors?: { connectors?: Connector[] } };
    }>(this.doer, {
      method: "POST",
      path: "/v1/connect-query",
      session,
      requireTrack: Track.Connect,
      connectSecret: this.connectSecret,
      body: { countryISO: input.countryISO, method: input.method },
      signal,
    });
    return raw.data?.connectors?.connectors ?? [];
  }

  getQuote(session: Session, input: QuoteInput, signal?: AbortSignal): Promise<QuoteResponse> {
    return call<QuoteResponse>(this.doer, {
      method: "POST",
      path: "/v1/connect-quote",
      session,
      requireTrack: Track.Connect,
      connectSecret: this.connectSecret,
      body: input,
      signal,
    });
  }

  execute(session: Session, input: ExecuteInput, signal?: AbortSignal): Promise<ExecuteResponse> {
    return call<ExecuteResponse>(this.doer, {
      method: "POST",
      path: "/v1/connect-execute",
      session,
      requireTrack: Track.Connect,
      connectSecret: this.connectSecret,
      body: input,
      signal,
    });
  }

  /**
   * Escape hatch for metadata-driven Connect calls against
   * `/v1/connect-exec/{path}`. The path must match {@link EXEC_PATH_RE};
   * absolute URIs, query strings, and traversal segments are rejected
   * before the network call.
   */
  async exec<T = unknown>(
    session: Session,
    method: string,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    if (!path) throw new Error("connect: exec path is required");
    if (path.includes("..")) throw new Error("connect: exec path must not contain `..`");
    if (path.includes("://") || path.startsWith("//")) {
      throw new Error("connect: exec path must not be absolute");
    }
    if (!EXEC_PATH_RE.test(path)) {
      throw new Error(
        `connect: exec path must match ${EXEC_PATH_RE.source}, got ${JSON.stringify(path)}`,
      );
    }
    const clean = path.startsWith("/") ? path.slice(1) : path;
    return call<T>(this.doer, {
      method,
      path: `/v1/connect-exec/${clean}`,
      session,
      requireTrack: Track.Connect,
      connectSecret: this.connectSecret,
      body,
      signal,
    });
  }
}
