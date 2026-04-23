// Example: verify inbound webhooks with HMAC + replay protection.
//
//   ZEAM_WEBHOOK_SECRET=... npx tsx examples/webhook-server/main.ts
//
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { LRU, handler } from "@zeammoney/sdk/webhook";

async function collectBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function toFetchRequest(req: IncomingMessage, body: Buffer): Request {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) headers.set(k, v.join(", "));
    else if (typeof v === "string") headers.set(k, v);
  }
  return new Request(url, {
    method: req.method ?? "GET",
    headers,
    body: body.length > 0 ? body : undefined,
  });
}

const secret = process.env.ZEAM_WEBHOOK_SECRET;
if (!secret) {
  console.error("set ZEAM_WEBHOOK_SECRET to the webhookSecret.secret captured at registration");
  process.exit(1);
}

const replay = new LRU(10_000);

const verified = handler(
  async (_req, body) => {
    console.warn(`received event: ${body.slice(0, 120)}`);
    return new Response(null, { status: 204 });
  },
  secret,
  { maxSkewMs: 5 * 60_000, replayCache: replay },
);

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  void (async () => {
    const body = await collectBody(req);
    const fetchReq = toFetchRequest(req, body);
    const resp = await verified(fetchReq);
    res.statusCode = resp.status;
    for (const [k, v] of resp.headers.entries()) res.setHeader(k, v);
    const text = await resp.text();
    res.end(text);
  })();
});

server.listen(8080, () => console.warn("listening on :8080"));
