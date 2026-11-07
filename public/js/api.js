import { distanceKm } from './lib/geo.js';
import { tilesForRadius } from './lib/tiles.js';

const OFFLINE = 'You seem to be offline — check your connection and try again.';
const REGION_NAMES = { 'CA-ON': 'Ontario, Canada' };
const BBOX_MARGIN_KM = 20;

async function get(path, params) {
  const url = `${path}?${new URLSearchParams(params)}`;
  let res;
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } });
  } catch {
    throw new Error(OFFLINE);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

/* ---------- Pre-built restaurant tiles ---------- */

let metaPromise = null;
const tilePromises = new Map();

async function getJson(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(OFFLINE);
  }
  if (!res.ok) throw new Error('Something went wrong. Please try again.');
  try {
    return await res.json();
  } catch {
    throw new Error('Something went wrong. Please try again.');
  }
}

function loadMeta() {
  if (!metaPromise) {
    metaPromise = getJson('/data/meta.json');
    metaPromise.catch(() => { metaPromise = null; }); // allow retry after a failure
  }
  return metaPromise;
}

function loadTile(key) {
  if (!tilePromises.has(key)) {
    const p = getJson(`/data/tiles/${key}.json`);
    p.catch(() => tilePromises.delete(key));
    tilePromises.set(key, p);
  }
  return tilePromises.get(key);
}

// Build files drop empty fields; put the defaults back.
function withDefaults(p) {
  return {
    address: null, phone: null, website: null, hours: null, wheelchair: null, outdoor: false,
    ...p,
    cuisines: p.cuisines || [],
    modes: p.modes || [],
    diet: p.diet || [],
  };
}

function coverageError(meta) {
  const names = (meta.regions || []).map((r) => REGION_NAMES[r] || r);
  const where = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0] || 'a few regions';
  return new Error(`DinnerDecider currently covers ${where}. More regions are coming soon!`);
}

function insideBbox(meta, lat, lng) {
  if (!Array.isArray(meta.bbox)) return false;
  const [minLat, minLng, maxLat, maxLng] = meta.bbox;
  const dLat = BBOX_MARGIN_KM / 111.32;
  const dLng = BBOX_MARGIN_KM / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return lat >= minLat - dLat && lat <= maxLat + dLat && lng >= minLng - dLng && lng <= maxLng + dLng;
}

async function placesNear(lat, lng, radiusKm) {
  const meta = await loadMeta();
  if (!insideBbox(meta, lat, lng)) throw coverageError(meta);
  const have = new Set(meta.tiles);
  const keys = tilesForRadius(lat, lng, radiusKm).filter((k) => have.has(k));
  if (!keys.length) throw coverageError(meta);
  const tiles = await Promise.all(keys.map(loadTile));
  return tiles.flat().map(withDefaults).filter((p) => distanceKm(lat, lng, p.lat, p.lng) <= radiusKm);
}

export const fetchPlaces = ({ lat, lng, radiusKm }) => placesNear(lat, lng, radiusKm);

// Shared shortlist: look near the sender's area, return matches in `ids` order.
export async function fetchPlacesByIds(ids, center) {
  const nearby = await placesNear(center.lat, center.lng, 15);
  const byId = new Map(nearby.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export const searchAddress = (q) => get('/api/geocode', { q }).then((d) => d.results);

export const reverseGeocode = (lat, lng) =>
  get('/api/geocode', { lat: lat.toFixed(4), lng: lng.toFixed(4) }).then((d) => d.label).catch(() => 'Current location');
