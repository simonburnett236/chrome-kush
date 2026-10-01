// Cloudflare Worker: serves the built game (dist/) and a small API.
//   POST /api/iap/verify      verify an Amazon receipt with Amazon RVS
//   GET|PUT /api/save/:userId cloud save keyed by Amazon user id (KV)

export interface Env {
  ASSETS: Fetcher;
  SAVES: KVNamespace;
  /** Amazon Developer Console > Shared Key. Set with `wrangler secret put AMAZON_SHARED_SECRET`. */
  AMAZON_SHARED_SECRET?: string;
  /** "production" (default) or "sandbox" (App Tester: receipts are trusted, for testing only). */
  AMAZON_IAP_ENV?: string;
}

const RVS = "https://appstore-sdk.amazon.com/version/1.0/verifyReceiptId/developer";
const MAX_SAVE_BYTES = 64 * 1024;
const ID_RE = /^[A-Za-z0-9._:\-=]{1,200}$/;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function verify(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { userId?: string; receiptId?: string };
  const userId = String(body.userId ?? "");
  const receiptId = String(body.receiptId ?? "");
  if (!ID_RE.test(receiptId)) return json({ valid: false, error: "bad_receipt" }, 400);
  if (env.AMAZON_IAP_ENV === "sandbox") return json({ valid: true, sandbox: true });
  if (!env.AMAZON_SHARED_SECRET) return json({ valid: false, error: "not_configured" }, 503);
  if (!ID_RE.test(userId)) return json({ valid: false, error: "bad_user" }, 400);
  const url = `${RVS}/${encodeURIComponent(env.AMAZON_SHARED_SECRET)}/user/${encodeURIComponent(userId)}/receiptId/${encodeURIComponent(receiptId)}`;
  const res = await fetch(url);
  if (res.status !== 200) return json({ valid: false, status: res.status });
  const r = (await res.json()) as Record<string, unknown>;
  return json({ valid: true, sku: r.productId, productType: r.productType, cancelDate: r.cancelDate ?? null, renewalDate: r.renewalDate ?? null });
}

async function save(req: Request, env: Env, userId: string): Promise<Response> {
  if (!ID_RE.test(userId)) return json({ error: "bad_user" }, 400);
  const key = `save:${userId}`;
  if (req.method === "GET") {
    const v = await env.SAVES.get(key);
    return new Response(v ?? "null", { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }
  if (req.method === "PUT") {
    const text = await req.text();
    if (text.length > MAX_SAVE_BYTES) return json({ error: "too_large" }, 413);
    try {
      JSON.parse(text);
    } catch {
      return json({ error: "bad_json" }, 400);
    }
    await env.SAVES.put(key, text);
    return json({ ok: true });
  }
  return json({ error: "method" }, 405);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/api/iap/verify" && req.method === "POST") return verify(req, env);
    const m = url.pathname.match(/^\/api\/save\/([^/]+)$/);
    if (m) return save(req, env, decodeURIComponent(m[1]));
    if (url.pathname.startsWith("/api/")) return json({ error: "not_found" }, 404);
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
