// OpenStreetMap helpers used by the data build script: normalising raw
// Overpass elements into the shape the front end consumes.

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
