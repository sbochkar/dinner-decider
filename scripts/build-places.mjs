// Builds the static restaurant data served from public/data/.
//   npm run build:data [-- --input raw.json] [-- --save raw.json]
import { readFile, writeFile, mkdir, rm, rename, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeElements } from '../functions/_lib/osm.js';
import { tileKey } from '../public/js/lib/tiles.js';

// ISO3166-2 codes of the regions to include; add more here.
const REGIONS = ['CA-ON'];

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
];
const USER_AGENT = 'DinnerDecider/1.0 (+https://dinnerdecider.ca)';
const FETCH_TIMEOUT_MS = 15 * 60 * 1000;
const ATTEMPTS = 3;
const BACKOFF_MS = [30000, 60000];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'public/data');

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

const queryFor = (code) =>
  `[out:json][timeout:900][maxsize:1073741824];area["ISO3166-2"="${code}"]["boundary"="administrative"]->.a;nwr["amenity"~"^(restaurant|fast_food)$"]["name"](area.a);out center tags;`;

async function queryOnce(endpoint, query) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Not JSON (${text.slice(0, 120).replace(/\s+/g, ' ')})`);
  }
  if (!Array.isArray(json.elements)) throw new Error('Response has no elements array');
  if (/runtime error/i.test(json.remark || '')) throw new Error(`Overpass remark: ${json.remark}`);
  return json;
}

async function fetchRegion(code) {
  const query = queryFor(code);
  const errors = [];
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    log(`[${code}] attempt ${attempt + 1}/${ATTEMPTS} via ${endpoint}`);
    try {
      return await queryOnce(endpoint, query);
    } catch (err) {
      const msg = `${endpoint}: ${err.message}`;
      errors.push(msg);
      log(`[${code}] failed: ${msg}`);
      if (attempt < ATTEMPTS - 1) {
        const wait = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
        log(`[${code}] retrying in ${wait / 1000}s`);
        await sleep(wait);
      }
    }
  }
  throw new Error(`All attempts failed for ${code}:\n  ${errors.join('\n  ')}`);
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;

// Drop null/false/empty values to keep files small; the client restores defaults.
function slim(place) {
  const out = {};
  for (const [k, v] of Object.entries(place)) {
    if (v === null || v === undefined || v === false || (Array.isArray(v) && !v.length)) continue;
    out[k] = v;
  }
  out.lat = round6(place.lat);
  out.lng = round6(place.lng);
  return out;
}

async function previousCount() {
  try {
    return JSON.parse(await readFile(path.join(dataDir, 'meta.json'), 'utf8')).count || 0;
  } catch {
    return 0;
  }
}

async function main() {
  const input = arg('--input');
  const save = arg('--save');

  let elements = [];
  if (input) {
    const json = JSON.parse(await readFile(input, 'utf8'));
    elements = json.elements;
    log(`Read ${elements.length} elements from ${input}`);
  } else {
    const raws = [];
    for (const code of REGIONS) {
      const json = await fetchRegion(code);
      log(`[${code}] ${json.elements.length} elements`);
      raws.push(json);
    }
    elements = raws.flatMap((j) => j.elements);
    if (save) {
      await writeFile(save, JSON.stringify({ elements }));
      log(`Saved raw response to ${save}`);
    }
  }

  const places = normalizeElements(elements).map(slim).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  log(`Kept ${places.length} of ${elements.length} elements`);

  const prev = await previousCount();
  if (!places.length || places.length < prev * 0.5) {
    throw new Error(`Safety check failed: ${places.length} places vs ${prev} previously. Existing data left untouched.`);
  }

  const tiles = new Map();
  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
  for (const p of places) {
    const key = tileKey(p.lat, p.lng);
    if (!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push(p);
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  const keys = [...tiles.keys()].sort();

  // Write to a temp dir inside public/data, then swap it in.
  await mkdir(dataDir, { recursive: true });
  const tmp = await mkdtemp(path.join(dataDir, '.tmp-'));
  let bytes = 0;
  for (const key of keys) {
    const body = JSON.stringify(tiles.get(key));
    bytes += Buffer.byteLength(body);
    await writeFile(path.join(tmp, `${key}.json`), body);
  }
  const tilesDir = path.join(dataDir, 'tiles');
  await rm(tilesDir, { recursive: true, force: true });
  await rename(tmp, tilesDir);

  const meta = {
    generated: new Date().toISOString(),
    regions: REGIONS,
    count: places.length,
    tiles: keys,
    bbox: [minLat, minLng, maxLat, maxLng],
  };
  const metaTmp = path.join(dataDir, 'meta.json.tmp');
  await writeFile(metaTmp, JSON.stringify(meta));
  await rename(metaTmp, path.join(dataDir, 'meta.json'));

  log(`Wrote ${keys.length} tiles, ${(bytes / 1024 / 1024).toFixed(2)} MB of tile data`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
