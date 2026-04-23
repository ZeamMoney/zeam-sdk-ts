import { Track, type Session } from "../../auth/index.js";
import type { Doer } from "../../client.js";
import { call } from "../call.js";

export interface Payment {
  id: string;
  status: string;
  amount: string;
  created_at?: string;
  [k: string]: unknown;
}

export interface Quote {
  id: string;
  status: string;
  [k: string]: unknown;
}

export interface Order {
  id: string;
  status: string;
  [k: string]: unknown;
}

/**
 * Wraps `/v1/payments`, `/v1/quotes`, and `/v1/orders`.
 */
export class PaymentsClient {
  constructor(private doer: Doer) {}

  createPayment(session: Session, body: unknown, signal?: AbortSignal): Promise<Payment> {
    return call<Payment>(this.doer, {
      method: "POST",
      path: "/v1/payments",
      session,
      requireTrack: Track.Business,
      body,
      signal,
    });
  }

  listPayments(
    session: Session,
    query?: URLSearchParams,
    signal?: AbortSignal,
  ): Promise<Payment[]> {
    return call<Payment[]>(this.doer, {
      method: "GET",
      path: "/v1/payments",
      session,
      requireTrack: Track.Business,
      query,
      signal,
    });
  }

  getPayment(session: Session, id: string, signal?: AbortSignal): Promise<Payment> {
    return call<Payment>(this.doer, {
      method: "GET",
      path: `/v1/payments/${encodeURIComponent(id)}`,
      session,
      requireTrack: Track.Business,
      signal,
    });
  }

  createQuote(session: Session, body: unknown, signal?: AbortSignal): Promise<Quote> {
    return call<Quote>(this.doer, {
      method: "POST",
      path: "/v1/quotes",
      session,
      requireTrack: Track.Business,
      body,
      signal,
    });
  }

  createOrder(session: Session, body: unknown, signal?: AbortSignal): Promise<Order> {
    return call<Order>(this.doer, {
      method: "POST",
      path: "/v1/orders",
      session,
      requireTrack: Track.Business,
      body,
      signal,
    });
  }

  cancelOrder(session: Session, id: string, signal?: AbortSignal): Promise<void> {
    return call<void>(this.doer, {
      method: "POST",
      path: `/v1/orders/${encodeURIComponent(id)}/cancel`,
      session,
      requireTrack: Track.Business,
      signal,
    });
  }
}
