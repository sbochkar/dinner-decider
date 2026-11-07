// Cloudflare Worker entry: static files are served from ./public by the assets
// binding; only /api/* requests reach this script (see run_worker_first).
import { onRequestGet as geocode } from '../functions/api/geocode.js';
import { onRequestPost as event } from '../functions/api/event.js';

const routes = {
  '/api/geocode': { method: 'GET', handler: geocode },
  '/api/event': { method: 'POST', handler: event },
};

export default {
  async fetch(request, env, ctx) {
    const route = routes[new URL(request.url).pathname];
    if (!route) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
    if (request.method !== route.method) return new Response('Method not allowed', { status: 405, headers: { allow: route.method } });
    return route.handler({ request, env, waitUntil: (p) => ctx.waitUntil(p) });
  },
};
