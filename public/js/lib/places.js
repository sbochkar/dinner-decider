import { distanceKm } from './geo.js';
import { isOpenAt } from './hours.js';

export const DEFAULT_FILTERS = {
  mode: 'all', // all | dinein | takeaway | delivery
  kind: 'all', // all | sitdown | quick
  cuisines: [], // empty = any
  diet: [], // all must match
  openNow: false,
  radiusKm: 3,
};

export function withDistances(places, origin) {
  return places
    .map((p) => ({ ...p, distKm: origin ? distanceKm(origin.lat, origin.lng, p.lat, p.lng) : null }))
    .sort((a, b) => (a.distKm ?? 0) - (b.distKm ?? 0));
}

// Places whose opening hours are known to be closed right now are dropped by
// the "open now" filter; unknown hours are kept (and labelled in the UI).
export function applyFilters(places, f, { excluded = new Set(), now = new Date() } = {}) {
  return places.filter((p) => {
    if (excluded.has(p.id)) return false;
    if (p.distKm != null && p.distKm > f.radiusKm) return false;
    if (f.mode !== 'all' && !p.modes.includes(f.mode)) return false;
    if (f.kind !== 'all' && p.kind !== f.kind) return false;
    if (f.cuisines.length && !p.cuisines.some((c) => f.cuisines.includes(c.label))) return false;
    if (f.diet.length && !f.diet.every((d) => p.diet.includes(d))) return false;
    if (f.openNow && isOpenAt(p.hours, now) === false) return false;
    return true;
  });
}

export function cuisineCounts(places) {
  const counts = new Map();
  for (const p of places) for (const c of p.cuisines) counts.set(c.label, (counts.get(c.label) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function pickRandom(list, n, rng = Math.random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

/* ---------- Craving quiz ---------- */

// Each answer boosts places whose cuisine keys / kind match.
export const QUIZ = [
  {
    q: "What's the vibe tonight?",
    options: [
      { label: 'Cozy comfort food', emoji: '🛋️', keys: ['ramen', 'noodle', 'pizza', 'italian', 'pasta', 'american', 'burger', 'dumpling', 'pho', 'vietnamese', 'chicken', 'korean', 'indian'] },
      { label: 'Quick & easy', emoji: '⚡', kind: 'quick', keys: ['sandwich', 'sub', 'burger', 'pizza', 'chicken', 'shawarma', 'kebab', 'tacos', 'mexican', 'hot_dog'] },
      { label: 'Treat ourselves', emoji: '🥂', kind: 'sitdown', keys: ['steak_house', 'steak', 'french', 'seafood', 'sushi', 'japanese', 'italian', 'bistro', 'spanish', 'greek'] },
      { label: 'Light & fresh', emoji: '🥗', keys: ['salad', 'vegetarian', 'vegan', 'healthy', 'bowl', 'mediterranean', 'sushi', 'vietnamese', 'greek', 'lebanese'] },
    ],
  },
  {
    q: 'What flavours are calling?',
    options: [
      { label: 'Spicy & bold', emoji: '🌶️', keys: ['thai', 'indian', 'korean', 'mexican', 'tacos', 'pakistani', 'ethiopian', 'caribbean', 'wings', 'sichuan'] },
      { label: 'Savoury & hearty', emoji: '🍖', keys: ['barbecue', 'bbq', 'steak_house', 'steak', 'burger', 'american', 'pub', 'gastropub', 'german', 'chicken'] },
      { label: 'Cheesy & carb-y', emoji: '🧀', keys: ['pizza', 'italian', 'pasta', 'burger', 'sandwich', 'mexican'] },
      { label: 'Umami & noodles', emoji: '🍜', keys: ['ramen', 'noodle', 'japanese', 'sushi', 'chinese', 'dumpling', 'dim_sum', 'korean', 'vietnamese', 'pho', 'asian'] },
    ],
  },
  {
    q: 'How adventurous are we?',
    options: [
      { label: 'Play it safe', emoji: '🙂', keys: ['pizza', 'burger', 'american', 'italian', 'sandwich', 'chicken', 'pub'] },
      { label: 'Something a little different', emoji: '🧭', keys: ['thai', 'korean', 'indian', 'greek', 'lebanese', 'vietnamese', 'japanese', 'mediterranean', 'mexican'] },
      { label: 'Surprise me!', emoji: '🎲', keys: [] },
    ],
  },
];

export function scorePlace(place, answers) {
  const keys = new Set(place.cuisines.map((c) => c.key));
  let score = 0;
  for (const a of answers) {
    if (a.keys.some((k) => keys.has(k))) score += 2;
    if (a.kind && place.kind === a.kind) score += 1;
  }
  return score;
}

export function rankByQuiz(places, answers, rng = Math.random) {
  return places
    .map((p) => ({ p, s: scorePlace(p, answers) + rng() * 0.9 }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}
