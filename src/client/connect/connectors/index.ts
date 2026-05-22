import { Track, type Session } from "../../../auth/index.js";
import type { Doer } from "../../../client.js";
import { call } from "../../call.js";
import type { Connector, ConnectorQueryInput } from "../types.js";

export type { Connector, ConnectorQueryInput } from "../types.js";

/** Enum guard: uppercase ASCII / digits / underscores only. */
const ENUM_RE = /^[A-Z0-9_]+$/;

/** SSRF guard regex for `/v1/connect-exec/*path`. */
export const EXEC_PATH_RE = /^[a-zA-Z0-9/_-]+$/;

export function connectorMethods(doer: Doer, connectSecret: string) {
  return {
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
      const raw = await call<{ connectors?: { connectors?: Connector[] } }>(doer, {
        method: "POST",
        path: "/v1/connect-query",
        session,
        requireTrack: Track.Connect,
        connectSecret,
        body: { countryISO: input.countryISO, method: input.method },
        signal,
      });
      return raw.connectors?.connectors ?? [];
    },

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
      return call<T>(doer, {
        method,
        path: `/v1/connect-exec/${clean}`,
        session,
        requireTrack: Track.Connect,
        connectSecret,
        body,
        signal,
      });
    },
  };
}
