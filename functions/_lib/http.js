export function json(data, { status = 200, maxAge = 0 } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': maxAge ? `public, max-age=${maxAge}` : 'no-store',
    },
  });
}

export function num(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

// Cache successful upstream-derived responses at the Cloudflare edge so we
// stay well inside the free OSM services' fair-use limits.
export async function cached(request, ctx, ttl, produce) {
  const cache = globalThis.caches?.default;
  const key = new Request(request.url, { method: 'GET' });
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }
  const res = await produce();
  if (cache && res.status === 200) {
    const copy = new Response(res.clone().body, res);
    copy.headers.set('cache-control', `public, max-age=${ttl}`);
    ctx.waitUntil(cache.put(key, copy));
  }
  return res;
}
