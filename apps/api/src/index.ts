// Worker de entrada: los estáticos los sirve Cloudflare sin ejecutar este código.
// Todo /api/* se reenvía al Durable Object "World", única autoridad del juego.
export { World } from './world';

export interface Env {
  WORLD: DurableObjectNamespace;
  ASSETS: Fetcher;
  PREMIUM_ENABLED: string;
  DAILY_REQUEST_BUDGET: string;
}

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (url.pathname === '/api/health') return Response.json({ ok: true, at: Date.now() });
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
      return Response.json({ error: 'bad_request' }, { status: 405 });
    }
    // Las escrituras deben venir del propio sitio (defensa CSRF; el token igual va en un header).
    if (req.method !== 'GET') {
      const origin = req.headers.get('origin');
      if (origin && new URL(origin).host !== url.host) return Response.json({ error: 'unauthorized' }, { status: 403 });
    }
    const stub = env.WORLD.get(env.WORLD.idFromName('world'));
    const res = await stub.fetch(req);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
    return out;
  },
} satisfies ExportedHandler<Env>;
