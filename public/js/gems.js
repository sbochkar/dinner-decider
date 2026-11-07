// Progressive enhancements for the Local gems pages. The pages work without this.
import { nearestCity } from './lib/gems.js';
import { reduceMotion } from './ui.js';
import { track } from './track.js';

const KEY = 'dinnerdecider:v1';

function savedLocation() {
  try {
    const loc = JSON.parse(localStorage.getItem(KEY))?.location;
    return Number.isFinite(loc?.lat) && Number.isFinite(loc?.lng) ? loc : null;
  } catch {
    return null;
  }
}

function highlightNearest() {
  const grid = document.getElementById('cityGrid');
  const loc = savedLocation();
  if (!grid || !loc) return;
  const cards = [...grid.querySelectorAll('.city-card')];
  const cities = cards.map((el, i) => ({ i, lat: Number(el.dataset.lat), lng: Number(el.dataset.lng) }));
  const best = nearestCity(cities, loc.lat, loc.lng);
  if (!best) return;
  const card = cards[best.i];
  card.classList.add('nearest');
  card.querySelector('.city-flag').hidden = false;
  grid.prepend(card);
}

function wireRandom() {
  const btn = document.getElementById('randomGem');
  const cards = [...document.querySelectorAll('.gem')];
  if (!btn || !cards.length) return;
  btn.hidden = false;
  let last = null;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gem.chosen').forEach((el) => el.classList.remove('chosen'));
    let pool = cards.filter((el) => el !== last);
    if (!pool.length) pool = cards;
    last = pool[Math.floor(Math.random() * pool.length)];
    last.classList.add('chosen');
    last.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
  });
}

highlightNearest();
wireRandom();

document.addEventListener('click', (e) => {
  const el = e.target.closest?.('[data-track]');
  if (el) track(el.dataset.track, '', 'gems');
});
