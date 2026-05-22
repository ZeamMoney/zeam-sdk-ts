import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
import { call } from "../../call.js";
import type { QuoteDirection, QuoteRequest, QuoteResponse } from "../types.js";

export type { QuoteDirection, QuoteRequest, QuoteResponse } from "../types.js";

export function quoteMethods(doer: Doer, connectSecret: string) {
  return {
    /** POST /v1/connect-quote → downstream /quote/send (direction always Send).
     *  Connect returns 402 "Payment Required" with the quote data on success. */
    getQuote(session: Session, input: QuoteRequest, signal?: AbortSignal): Promise<QuoteResponse> {
      return call<QuoteResponse>(doer, {
        method: "POST",
        path: "/v1/connect-quote",
        session,
        requireTrack: Track.Connect,
        connectSecret,
        body: input,
        signal,
        passthroughStatuses: [402],
      });
    },

    /** POST /v1/connect-quote/:direction → downstream /quote/{send|receive}.
     *  Connect returns 402 "Payment Required" with the quote data on success. */
    getDirectionalQuote(
      session: Session,
      direction: QuoteDirection,
      input: QuoteRequest,
      signal?: AbortSignal,
    ): Promise<QuoteResponse> {
      return call<QuoteResponse>(doer, {
        method: "POST",
        path: `/v1/connect-quote/${direction}`,
        session,
        requireTrack: Track.Connect,
        connectSecret,
        body: input,
        signal,
        passthroughStatuses: [402],
      });
    },
  };
}
