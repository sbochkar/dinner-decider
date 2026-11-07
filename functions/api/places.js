import { json, num, cached } from '../_lib/http.js';
import {
  MAX_RADIUS_M,
  buildAroundQuery,
  buildIdsQuery,
  normalizeElements,
  parseIds,
  runOverpass,
} from '../_lib/osm.js';

// GET /api/places?lat=..&lng=..&radius=<metres>   restaurants around a point
// GET /api/places?ids=n123,w456                   specific places (shared shortlists)
export async function onRequestGet(context) {
  const { request } = context;
  const ctx = { waitUntil: context.waitUntil };
  const url = new URL(request.url);

  const idsParam = url.searchParams.get('ids');
  if (idsParam !== null) {
    const ids = parseIds(idsParam);
    if (!ids.length) return json({ error: 'No valid ids' }, { status: 400 });
    return cached(request, ctx, 86400, async () => {
      try {
        const elements = await runOverpass(buildIdsQuery(ids));
        return json({ places: normalizeElements(elements) });
      } catch {
        return json({ error: 'Restaurant data is temporarily unavailable' }, { status: 502 });
      }
    });
  }

  const lat = num(url.searchParams.get('lat'), -90, 90);
  const lng = num(url.searchParams.get('lng'), -180, 180);
  const radius = Math.min(num(url.searchParams.get('radius'), 100, 1e6) ?? 3000, MAX_RADIUS_M);
  if (lat === null || lng === null) return json({ error: 'lat and lng are required' }, { status: 400 });

  // Snap to ~110 m so nearby users share a cache entry; the client does exact distances.
  const rLat = lat.toFixed(3);
  const rLng = lng.toFixed(3);
  const rRadius = Math.round(radius / 500) * 500 || 500;
  const canonical = new URL(url);
  canonical.search = `?lat=${rLat}&lng=${rLng}&radius=${rRadius}`;

  return cached(new Request(canonical, request), ctx, 21600, async () => {
    try {
      const elements = await runOverpass(buildAroundQuery(rLat, rLng, rRadius));
      return json({ places: normalizeElements(elements), radius: rRadius });
    } catch {
      return json({ error: 'Restaurant data is temporarily unavailable' }, { status: 502 });
    }
  });
}
