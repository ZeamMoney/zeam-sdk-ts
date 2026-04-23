import { Track, type Session } from "../../auth/index.js";
import type { Doer } from "../../client.js";
import { call } from "../call.js";

/**
 * Wraps `/v1/reports/*`, `/v1/market-prices`, and `/v1/network/status`.
 * These are read-only endpoints; the transport layer applies bounded
 * retries (ADR 0008 R6).
 */
export class ReportsClient {
  constructor(private doer: Doer) {}

  apiUsage(session: Session, from: string, to: string, signal?: AbortSignal): Promise<unknown> {
    return call(this.doer, {
      method: "GET",
      path: "/v1/reports/api-usage",
      query: new URLSearchParams({ from, to }),
      session,
      requireTrack: Track.Business,
      signal,
    });
  }

  walletBalance(session: Session, wallet: string, signal?: AbortSignal): Promise<unknown> {
    return call(this.doer, {
      method: "GET",
      path: "/v1/reports/wallet-balance",
      query: new URLSearchParams({ wallet }),
      session,
      requireTrack: Track.Business,
      signal,
    });
  }

  marketPrice(
    session: Session,
    pair: string,
    priceType: "mid" | "buy-a" | "buy-b",
    signal?: AbortSignal,
  ): Promise<unknown> {
    return call(this.doer, {
      method: "GET",
      path: `/v1/market-prices/${encodeURIComponent(pair)}`,
      query: new URLSearchParams({ type: priceType }),
      session,
      requireTrack: Track.Business,
      signal,
    });
  }

  networkStatus(session: Session, signal?: AbortSignal): Promise<unknown> {
    return call(this.doer, {
      method: "GET",
      path: "/v1/network/status",
      session,
      requireTrack: Track.Business,
      signal,
    });
  }
}
