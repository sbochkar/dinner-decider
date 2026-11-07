// OpenStreetMap helpers shared by the API routes: query building and
// normalising raw Overpass elements into the shape the front end consumes.

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
];

export const MAX_RADIUS_M = 15000;
export const MAX_RESULTS = 500;

const CUISINES = {
  pizza: ['Pizza', '🍕'],
  burger: ['Burgers', '🍔'],
  sushi: ['Sushi', '🍣'],
  japanese: ['Japanese', '🍱'],
  ramen: ['Ramen', '🍜'],
  noodle: ['Noodles', '🍜'],
  chinese: ['Chinese', '🥡'],
  dumpling: ['Dumplings', '🥟'],
  dim_sum: ['Dim Sum', '🥟'],
  thai: ['Thai', '🍛'],
  vietnamese: ['Vietnamese', '🍲'],
  pho: ['Vietnamese', '🍲'],
  korean: ['Korean', '🥘'],
  indian: ['Indian', '🍛'],
  pakistani: ['Pakistani', '🍛'],
  asian: ['Asian', '🥢'],
  italian: ['Italian', '🍝'],
  pasta: ['Italian', '🍝'],
  mexican: ['Mexican', '🌮'],
  tacos: ['Mexican', '🌮'],
  american: ['American', '🍔'],
  chicken: ['Chicken', '🍗'],
  wings: ['Wings', '🍗'],
  barbecue: ['BBQ', '🍖'],
  bbq: ['BBQ', '🍖'],
  steak_house: ['Steakhouse', '🥩'],
  steak: ['Steakhouse', '🥩'],
  seafood: ['Seafood', '🦞'],
  fish: ['Seafood', '🐟'],
  fish_and_chips: ['Fish & Chips', '🐟'],
  greek: ['Greek', '🥙'],
  mediterranean: ['Mediterranean', '🥙'],
  middle_eastern: ['Middle Eastern', '🥙'],
  lebanese: ['Lebanese', '🥙'],
  turkish: ['Turkish', '🥙'],
  kebab: ['Kebab', '🥙'],
  shawarma: ['Shawarma', '🥙'],
  french: ['French', '🥐'],
  spanish: ['Spanish', '🥘'],
  caribbean: ['Caribbean', '🍹'],
  ethiopian: ['Ethiopian', '🍲'],
  sandwich: ['Sandwiches', '🥪'],
  sub: ['Sandwiches', '🥪'],
  deli: ['Deli', '🥪'],
  breakfast: ['Breakfast', '🥞'],
  brunch: ['Brunch', '🥞'],
  salad: ['Salads', '🥗'],
  vegetarian: ['Vegetarian', '🥗'],
  vegan: ['Vegan', '🥗'],
  healthy: ['Healthy', '🥗'],
  bowl: ['Bowls', '🥗'],
  hot_dog: ['Hot Dogs', '🌭'],
  donut: ['Donuts', '🍩'],
  ice_cream: ['Ice Cream', '🍦'],
  dessert: ['Dessert', '🍰'],
  coffee_shop: ['Café', '☕'],
  pub: ['Pub Food', '🍺'],
  gastropub: ['Gastropub', '🍺'],
  bistro: ['Bistro', '🍷'],
  regional: ['Regional', '🍽️'],
};

const DEFAULT_EMOJI = { restaurant: '🍽️', fast_food: '🍟', pub: '🍺' };

export function buildAroundQuery(lat, lng, radius) {
  // Single regex clause is much cheaper on the public Overpass servers than a union.
  return `[out:json][timeout:25];nwr["amenity"~"^(restaurant|fast_food)$"]["name"](around:${radius},${lat},${lng});out center tags ${MAX_RESULTS};`;
}

// ids look like n123 / w456 / r789
export function parseIds(raw) {
  const ids = String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[nwr]\d{1,12}$/.test(s));
  return [...new Set(ids)].slice(0, 12);
}

export function buildIdsQuery(ids) {
  const groups = { n: [], w: [], r: [] };
  for (const id of ids) groups[id[0]].push(id.slice(1));
  const names = { n: 'node', w: 'way', r: 'relation' };
  const parts = Object.entries(groups)
    .filter(([, list]) => list.length)
    .map(([k, list]) => `${names[k]}(id:${list.join(',')});`);
  return `[out:json][timeout:20];(${parts.join('')});out center tags;`;
}

function titleCase(s) {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseCuisines(raw) {
  const out = [];
  for (const part of String(raw || '').split(/[;,]/)) {
    const key = part.trim().toLowerCase().replace(/\s+/g, '_');
    if (!key) continue;
    const [label, emoji] = CUISINES[key] || [titleCase(key), null];
    if (!out.some((c) => c.label === label)) out.push({ key, label, emoji });
  }
  return out;
}

function yesNo(v) {
  if (v === 'yes' || v === 'only') return true;
  if (v === 'no') return false;
  return null;
}

function buildAddress(t) {
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const locality = [t['addr:city'], t['addr:postcode']].filter(Boolean).join(' ');
  return [street, locality].filter(Boolean).join(', ') || null;
}

function cleanWebsite(url) {
  if (!url) return null;
  const u = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    return new URL(u).toString();
  } catch {
    return null;
  }
}

function cleanPhone(p) {
  return p ? String(p).split(';')[0].trim() : null;
}

// Turn one raw Overpass element into the shape we send to the browser.
// Nothing is invented: if OSM doesn't know something it is null/absent.
export function normalizeElement(el) {
  const t = el.tags;
  if (!t || !t.name) return null;
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const amenity = t.amenity === 'fast_food' ? 'fast_food' : t.amenity === 'pub' ? 'pub' : 'restaurant';
  const cuisines = parseCuisines(t.cuisine);
  const emoji = cuisines.find((c) => c.emoji)?.emoji || DEFAULT_EMOJI[amenity];
  const takeaway = yesNo(t.takeaway);
  const delivery = yesNo(t.delivery);

  const modes = [];
  if (t.takeaway !== 'only') modes.push('dinein');
  if (takeaway === true || (amenity === 'fast_food' && takeaway !== false)) modes.push('takeaway');
  if (delivery === true) modes.push('delivery');

  const diet = [];
  for (const d of ['vegetarian', 'vegan', 'halal', 'kosher', 'gluten_free']) {
    const v = t[`diet:${d}`];
    if (v === 'yes' || v === 'only') diet.push(d);
  }
  if (cuisines.some((c) => c.key === 'vegan') && !diet.includes('vegan')) diet.push('vegan');
  if (cuisines.some((c) => c.key === 'vegetarian') && !diet.includes('vegetarian')) diet.push('vegetarian');

  return {
    id: `${el.type[0]}${el.id}`,
    name: t.name,
    kind: amenity === 'fast_food' ? 'quick' : 'sitdown',
    lat,
    lng,
    cuisines: cuisines.map(({ key, label }) => ({ key, label })),
    emoji,
    address: buildAddress(t),
    phone: cleanPhone(t.phone || t['contact:phone']),
    website: cleanWebsite(t.website || t['contact:website']),
    hours: t.opening_hours || null,
    modes,
    diet,
    outdoor: yesNo(t.outdoor_seating) === true,
    wheelchair: t.wheelchair === 'yes' ? true : t.wheelchair === 'no' ? false : null,
  };
}

export function normalizeElements(elements) {
  const seen = new Set();
  const out = [];
  for (const el of elements || []) {
    const place = normalizeElement(el);
    if (!place || seen.has(place.id)) continue;
    seen.add(place.id);
    out.push(place);
  }
  return out;
}

async function queryEndpoint(endpoint, query, fetchImpl) {
  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'DinnerDecider/1.0 (+https://github.com/)',
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(50000),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = await res.json(); // busy servers return an HTML error page -> throws
  if (!Array.isArray(json.elements)) throw new Error('Bad Overpass payload');
  return json.elements;
}

// Public Overpass servers are often busy: race two mirrors, first good answer wins.
export async function runOverpass(query, fetchImpl = fetch) {
  try {
    return await Promise.any(OVERPASS_ENDPOINTS.slice(0, 2).map((e) => queryEndpoint(e, query, fetchImpl)));
  } catch {
    throw new Error('Overpass unavailable');
  }
}
