import test from 'node:test';
import assert from 'node:assert/strict';
import { isOpenAt } from '../public/js/lib/hours.js';
import { distanceKm, formatDistance } from '../public/js/lib/geo.js';
import { applyFilters, DEFAULT_FILTERS, rankByQuiz, QUIZ, cuisineCounts, pickRandom } from '../public/js/lib/places.js';
import { normalizeElement, normalizeElements, parseCuisines } from '../functions/_lib/osm.js';

// 2025-01-06 is a Monday
const at = (day, h, m = 0) => new Date(2025, 0, 5 + day, h, m); // day: 0=Sun

test('opening hours: simple ranges', () => {
  const h = 'Mo-Fr 11:00-22:00; Sa,Su 12:00-23:00';
  assert.equal(isOpenAt(h, at(1, 12)), true);
  assert.equal(isOpenAt(h, at(1, 10, 59)), false);
  assert.equal(isOpenAt(h, at(6, 11, 30)), false);
  assert.equal(isOpenAt(h, at(6, 12, 0)), true);
});

test('opening hours: past midnight, 24/7, off, unknown', () => {
  assert.equal(isOpenAt('Fr 18:00-02:00', at(5, 23)), true);
  assert.equal(isOpenAt('Fr 18:00-02:00', at(6, 1)), true, 'spills into Saturday');
  assert.equal(isOpenAt('Fr 18:00-02:00', at(6, 2, 30)), false);
  assert.equal(isOpenAt('24/7', at(3, 4)), true);
  assert.equal(isOpenAt('Mo-Su 10:00-20:00; We off', at(3, 12)), false);
  assert.equal(isOpenAt(null), null);
  assert.equal(isOpenAt('by appointment'), null);
  assert.equal(isOpenAt('Mo-Su 11:00-22:00; PH off', at(2, 12)), true);
});

test('distance', () => {
  const d = distanceKm(43.6532, -79.3832, 43.7615, -79.4111); // downtown Toronto -> North York
  assert.ok(d > 11 && d < 13, String(d));
  assert.equal(formatDistance(0.43), '400 m');
  assert.equal(formatDistance(2.345), '2.3 km');
});

const mk = (id, over = {}) => ({
  id, name: id, kind: 'sitdown', lat: 0, lng: 0, distKm: 1, hours: null, modes: ['dinein'],
  diet: [], cuisines: [{ key: 'pizza', label: 'Pizza' }], ...over,
});

test('filters', () => {
  const places = [
    mk('a'),
    mk('b', { distKm: 5 }),
    mk('c', { modes: ['dinein', 'delivery'], kind: 'quick', cuisines: [{ key: 'thai', label: 'Thai' }] }),
    mk('d', { hours: 'Mo-Su 01:00-02:00' }),
    mk('e', { diet: ['vegan'] }),
  ];
  const ids = (f, o) => applyFilters(places, { ...DEFAULT_FILTERS, ...f }, o).map((p) => p.id);
  assert.deepEqual(ids({ radiusKm: 3 }), ['a', 'c', 'd', 'e']);
  assert.deepEqual(ids({ mode: 'delivery' }), ['c']);
  assert.deepEqual(ids({ kind: 'quick' }), ['c']);
  assert.deepEqual(ids({ cuisines: ['Thai'] }), ['c']);
  assert.deepEqual(ids({ diet: ['vegan'] }), ['e']);
  assert.deepEqual(ids({ openNow: true, radiusKm: 3 }, { now: at(1, 12) }), ['a', 'c', 'e'], 'known-closed dropped, unknown kept');
  assert.deepEqual(ids({}, { excluded: new Set(['a']) }), ['c', 'd', 'e']);
  assert.deepEqual(cuisineCounts(places)[0], ['Pizza', 4]);
});

test('quiz ranking prefers matching cuisines', () => {
  const places = [mk('pizza'), mk('thai', { cuisines: [{ key: 'thai', label: 'Thai' }] })];
  const answers = [QUIZ[1].options[0]]; // spicy
  assert.equal(rankByQuiz(places, answers, () => 0)[0].id, 'thai');
});

test('pickRandom returns n unique items', () => {
  const r = pickRandom([1, 2, 3, 4, 5], 3);
  assert.equal(new Set(r).size, 3);
});

test('normalizeElement maps OSM tags without inventing data', () => {
  const p = normalizeElement({
    type: 'node', id: 42, lat: 1, lon: 2,
    tags: {
      amenity: 'restaurant', name: 'Pho Tai', cuisine: 'vietnamese;noodle', 'addr:housenumber': '9',
      'addr:street': 'Yonge St', 'addr:city': 'Richmond Hill', website: 'photai.ca', takeaway: 'yes',
      delivery: 'yes', 'diet:vegan': 'yes', opening_hours: 'Mo-Su 11:00-21:00',
    },
  });
  assert.equal(p.id, 'n42');
  assert.equal(p.address, '9 Yonge St, Richmond Hill');
  assert.equal(p.website, 'https://photai.ca/');
  assert.deepEqual(p.modes, ['dinein', 'takeaway', 'delivery']);
  assert.deepEqual(p.diet, ['vegan']);
  assert.deepEqual(p.cuisines.map((c) => c.label), ['Vietnamese', 'Noodles']);
  assert.equal(p.emoji, '🍲');
  assert.equal('rating' in p, false);
});

test('normalizeElement handles ways (center), fast food, and junk', () => {
  const w = normalizeElement({ type: 'way', id: 7, center: { lat: 3, lon: 4 }, tags: { amenity: 'fast_food', name: 'Quick', takeaway: 'only' } });
  assert.equal(w.id, 'w7');
  assert.equal(w.kind, 'quick');
  assert.deepEqual(w.modes, ['takeaway']);
  assert.equal(normalizeElement({ type: 'node', id: 1, lat: 1, lon: 1, tags: { amenity: 'restaurant' } }), null, 'no name');
  assert.equal(normalizeElements([{ type: 'node', id: 1, lat: 1, lon: 1, tags: { name: 'A', amenity: 'restaurant' } }, { type: 'node', id: 1, lat: 1, lon: 1, tags: { name: 'A' } }]).length, 1, 'deduped');
});

test('cuisine parsing', () => {
  assert.deepEqual(parseCuisines('Sushi; fish_and_chips').map((c) => c.label), ['Sushi', 'Fish & Chips']);
});
