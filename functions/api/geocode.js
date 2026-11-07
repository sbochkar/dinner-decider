import { json, num, cached } from '../_lib/http.js';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const HEADERS = { 'user-agent': 'DinnerDecider/1.0 (+https://dinnerdecider.ca)', 'accept-language': 'en' };

function shortLabel(item) {
  const a = item.address || {};
  const street = [a.house_number, a.road].filter(Boolean).join(' ');
  const place = a.city || a.town || a.village || a.suburb || a.municipality || a.county;
  const region = a.state || a.country;
  const label = [street, place, region].filter(Boolean).join(', ');
  return label || item.display_name;
}

// GET /api/geocode?q=123 Main St      -> address search
// GET /api/geocode?lat=..&lng=..      -> reverse lookup (friendly label for GPS)
export async function onRequestGet(context) {
  const { request } = context;
  const ctx = { waitUntil: context.waitUntil };
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();

  if (q) {
    if (q.length < 3 || q.length > 200) return json({ error: 'Enter at least 3 characters' }, { status: 400 });
    return cached(request, ctx, 86400, async () => {
      const upstream = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`;
      try {
        const res = await fetch(upstream, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(String(res.status));
        const items = await res.json();
        return json({
          results: items.map((i) => ({ label: shortLabel(i), lat: Number(i.lat), lng: Number(i.lon) })),
        });
      } catch {
        return json({ error: 'Address search is temporarily unavailable' }, { status: 502 });
      }
    });
  }

  const lat = num(url.searchParams.get('lat'), -90, 90);
  const lng = num(url.searchParams.get('lng'), -180, 180);
  if (lat === null || lng === null) return json({ error: 'Provide q or lat/lng' }, { status: 400 });

  const canonical = new URL(url);
  canonical.search = `?lat=${lat.toFixed(3)}&lng=${lng.toFixed(3)}`;
  return cached(new Request(canonical, request), ctx, 86400, async () => {
    try {
      const res = await fetch(
        `${NOMINATIM}/reverse?format=jsonv2&zoom=16&addressdetails=1&lat=${lat}&lon=${lng}`,
        { headers: HEADERS, signal: AbortSignal.timeout(8000) },
      );
      if (!res.ok) throw new Error(String(res.status));
      const item = await res.json();
      const a = item.address || {};
      const label = [a.suburb || a.neighbourhood, a.city || a.town || a.village, a.state].filter(Boolean).join(', ');
      return json({ label: label || item.display_name || 'Current location' });
    } catch {
      return json({ label: 'Current location' });
    }
  });
}
