import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface Route {
  method: string;
  path: string;
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
}

/**
 * Tiny httptest-style fake gateway. Not part of the public stability
 * contract.
 */
export class FakeServer {
  readonly server: Server;
  private _url = "";

  constructor(routes: Route[]) {
    this.server = createServer((req, res) => {
      const route = routes.find(
        (r) =>
          r.method.toUpperCase() === (req.method ?? "").toUpperCase() && r.path === (req.url ?? ""),
      );
      if (!route) {
        res.statusCode = 404;
        res.end("no route");
        return;
      }
      void Promise.resolve(route.handler(req, res)).catch((err: unknown) => {
        res.statusCode = 500;
        res.end(err instanceof Error ? err.message : String(err));
      });
    });
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve) => this.server.listen(0, "127.0.0.1", resolve));
    const addr = this.server.address() as AddressInfo;
    this._url = `http://127.0.0.1:${addr.port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  get url(): string {
    return this._url;
  }
}

/**
 * Write a SPEC §18 success envelope.
 */
export function writeEnvelope(res: ServerResponse, requestId: string, data: unknown): void {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Request-Id", requestId);
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      ok: true,
      request_id: requestId,
      resource: "test",
      verb: "get",
      data,
    }),
  );
}

/**
 * Write a SPEC §18 error envelope.
 */
export function writeError(
  res: ServerResponse,
  status: number,
  requestId: string,
  code: string,
  message: string,
): void {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Request-Id", requestId);
  res.statusCode = status;
  res.end(
    JSON.stringify({
      ok: false,
      request_id: requestId,
      errors: [{ code, message }],
    }),
  );
}
