import type { Doer } from "../../client.js";
import { call } from "../call.js";

/**
 * /healthz response per ADR 0003 Finding #4 (once ratified:
 * `{ok, status, uptime_ms, version}`).
 */
export interface HealthResponse {
  ok: boolean;
  status: string;
  uptime_ms: number;
  version: string;
}

/**
 * Wraps GET /healthz. Unauthenticated and returns bare JSON.
 */
export class HealthClient {
  constructor(private doer: Doer) {}

  async get(signal?: AbortSignal): Promise<HealthResponse> {
    return call<HealthResponse>(this.doer, {
      method: "GET",
      path: "/healthz",
      signal,
    });
  }
}
