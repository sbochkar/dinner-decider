// Matches editor-curated "local gems" to places in the pre-built tile data.
import { distanceKm } from './geo.js';

const MIN_NAME_LENGTH = 4;
const SEARCH_MARGIN_KM = 6;

export function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Returns the matching place or null. `city` needs lat, lng and radiusKm.
export function resolvePick(pick, places, city) {
  if (pick.osmId) return places.find((p) => p.id === pick.osmId) || null;

  const want = normalizeName(pick.name);
  if (want.length < MIN_NAME_LENGTH) return null;

  const limit = city.radiusKm + SEARCH_MARGIN_KM;
  const near = [];
  for (const p of places) {
    const d = distanceKm(city.lat, city.lng, p.lat, p.lng);
    if (d > limit) continue;
    const have = normalizeName(p.name);
    if (have.length < MIN_NAME_LENGTH) continue;
    near.push({ p, d, have });
  }
  const nearest = (list) => list.sort((a, b) => a.d - b.d || (a.p.id < b.p.id ? -1 : 1))[0]?.p || null;

  const exact = nearest(near.filter((x) => x.have === want));
  if (exact) return exact;
  return nearest(near.filter((x) => x.have.startsWith(want) || want.startsWith(x.have)));
}

export function nearestCity(cities, lat, lng) {
  let best = null;
  for (const c of cities) {
    const d = distanceKm(lat, lng, c.lat, c.lng);
    if (!best || d < best.distKm) best = { ...c, distKm: d };
  }
  return best;
}
