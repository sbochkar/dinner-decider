// Cloudflare Worker entry: static files are served from ./public by the assets
// binding; only /api/* requests reach this script (see run_worker_first).
import { onRequestGet as geocode } from '../functions/api/geocode.js';

const routes = { '/api/geocode': geocode };

export default {
  async fetch(request, env, ctx) {
    const handler = routes[new URL(request.url).pathname];
    if (!handler) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } });
    return handler({ request, env, waitUntil: (p) => ctx.waitUntil(p) });
  },
};
