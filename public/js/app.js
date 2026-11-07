import { state, persist } from './state.js';
import { fetchPlaces, fetchPlacesByIds, searchAddress, reverseGeocode } from './api.js';
import { $, $$, h, clear, toast, openDialog, wireDialogs, confetti, vibrate } from './ui.js';
import { Wheel } from './wheel.js';
import { isOpenAt } from './lib/hours.js';
import { formatDistance } from './lib/geo.js';
import {
  DEFAULT_FILTERS, QUIZ, applyFilters, cuisineCounts, pickRandom, rankByQuiz, withDistances,
} from './lib/places.js';

const MAX_RADIUS_KM = 15;
const WHEEL_SIZE = 12;

let allPlaces = []; // everything fetched, with distances
let fetchedRadiusKm = 0;
let loadError = null;
let loading = false;
let wheelIds = [];
let wheel;
let activeTab = 'spin';
let quiz = { step: 0, answers: [] };
let faceoff = null;

const pool = () => applyFilters(allPlaces, state.filters, { excluded: state.excluded });
const byId = (id) => allPlaces.find((p) => p.id === id);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function cuisineText(p) {
  if (p.cuisines.length) return p.cuisines.slice(0, 2).map((c) => c.label).join(' · ');
  return p.kind === 'quick' ? 'Quick bite' : 'Restaurant';
}

function metaText(p) {
  return [cuisineText(p), p.distKm != null ? formatDistance(p.distKm) : null].filter(Boolean).join(' · ');
}

function openTag(p) {
  const open = isOpenAt(p.hours);
  if (open === true) return h('span', { class: 'tag open', text: 'Open now' });
  if (open === false) return h('span', { class: 'tag closed', text: 'Closed now' });
  return null;
}

function mapsUrl(p) {
  const dest = p.address ? `${p.name}, ${p.address}` : `${p.lat},${p.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

function show(el, visible) {
  el.hidden = !visible;
}

/* ------------------------------------------------------------------ */
/* Location & loading                                                  */
/* ------------------------------------------------------------------ */

async function setLocation(loc) {
  state.location = loc;
  persist();
  $('#locationDialog').close();
  fetchedRadiusKm = 0;
  allPlaces = [];
  state.excluded.clear();
  await loadPlaces();
}

async function loadPlaces({ widen = true } = {}) {
  if (!state.location) return;
  loading = true;
  loadError = null;
  render();
  try {
    let radius = Math.max(state.filters.radiusKm, 3);
    let places = await fetchPlaces({ ...state.location, radiusKm: radius });
    // Sparse area? Widen once or twice rather than showing an empty app.
    while (widen && places.length < 6 && radius < MAX_RADIUS_KM) {
      radius = Math.min(MAX_RADIUS_KM, radius * 2);
      places = await fetchPlaces({ ...state.location, radiusKm: radius });
      if (state.filters.radiusKm < radius) {
        state.filters.radiusKm = radius;
        toast(`Not many spots nearby — widened to ${radius} km`);
      }
    }
    fetchedRadiusKm = radius;
    allPlaces = withDistances(places, state.location);
    persist();
  } catch (err) {
    loadError = err.message;
  } finally {
    loading = false;
    wheelIds = [];
    faceoff = null;
    quiz = { step: 0, answers: [] };
    render();
  }
}

function gpsLookup(errorEl) {
  if (!navigator.geolocation) {
    showError(errorEl, "Your browser can't share its location — try searching for an address instead.");
    return;
  }
  toast('Finding you…');
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      const label = await reverseGeocode(lat, lng);
      setLocation({ lat, lng, label });
    },
    (err) => {
      const msg = err.code === 1
        ? 'Location permission was denied. You can search for an address instead.'
        : "Couldn't get your location. Try searching for an address instead.";
      showError(errorEl, msg);
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
  );
}

function showError(el, msg) {
  el.textContent = msg;
  el.hidden = !msg;
}

function wireAddressSearch({ form, input, list, error }) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    showError(error, '');
    list.hidden = true;
    if (q.length < 3) return showError(error, 'Enter at least 3 characters.');
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      const results = await searchAddress(q);
      if (!results.length) return showError(error, "We couldn't find that place. Try adding a city or country.");
      if (results.length === 1) return setLocation(results[0]);
      clear(list).append(
        ...results.map((r) =>
          h('li', {}, h('button', { type: 'button', onclick: () => setLocation(r), text: r.label })),
        ),
      );
      list.hidden = false;
    } catch (err) {
      showError(error, err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function render() {
  const partner = new URLSearchParams(location.search).has('s');
  show($('#partnerView'), partner);
  show($('#locationBtn'), !!state.location && !partner);
  $('#locationLabel').textContent = state.location?.label || 'Set location';
  if (partner) {
    show($('#onboarding'), false);
    show($('#app'), false);
    return;
  }
  show($('#onboarding'), !state.location);
  show($('#app'), !!state.location);
  if (!state.location) return;

  renderFilters();
  renderStatus();

  const matches = pool();
  const problem = loading || loadError || allPlaces.length === 0 || matches.length === 0;
  show($('#games'), !problem);
  show($('#empty'), !!problem);
  if (problem) return renderEmpty();

  renderSpin(matches);
  if (activeTab === 'quiz') renderQuiz();
  if (activeTab === 'faceoff') renderFaceoff();
  if (activeTab === 'list') renderList();
}

function renderStatus() {
  const s = $('#status');
  if (loading) return void (s.textContent = 'Finding restaurants near you…');
  if (loadError) return void (s.textContent = 'Couldn’t load restaurants');
  const n = pool().length;
  const skipped = state.excluded.size;
  clear(s).append(
    h('b', { text: String(n) }),
    ` spot${n === 1 ? '' : 's'} within ${state.filters.radiusKm} km`,
    skipped ? ` · ${skipped} skipped` : '',
  );
}

function renderEmpty() {
  const title = $('#emptyTitle');
  const text = $('#emptyText');
  const btn = $('#emptyAction');
  show(btn, !loading);
  if (loading) {
    $('#empty .big').textContent = '🍳';
    title.textContent = 'Finding restaurants near you…';
    text.textContent = 'Just a moment…';
    return;
  }
  $('#empty .big').textContent = '🫥';
  if (loadError) {
    title.textContent = 'Couldn’t load restaurants';
    text.textContent = loadError;
    btn.textContent = 'Try again';
    btn.onclick = () => loadPlaces();
  } else if (allPlaces.length === 0) {
    title.textContent = 'No restaurants found here';
    text.textContent = 'OpenStreetMap has no mapped restaurants near this spot. Try a different address.';
    btn.textContent = 'Change location';
    btn.onclick = () => openDialog($('#locationDialog'));
  } else if (state.excluded.size && applyFilters(allPlaces, state.filters).length > 0) {
    title.textContent = "You've skipped everything!";
    text.textContent = 'Bring the skipped spots back to keep deciding.';
    btn.textContent = 'Bring them back';
    btn.onclick = () => { state.excluded.clear(); render(); };
  } else {
    title.textContent = 'No spots match those filters';
    text.textContent = 'Try widening the distance or clearing a few filters.';
    btn.textContent = 'Reset filters';
    btn.onclick = resetFilters;
  }
}

/* ---------- Filters ---------- */

function activeFilterCount() {
  const f = state.filters;
  return (f.mode !== 'all') + (f.kind !== 'all') + f.diet.length + f.cuisines.length + (f.openNow ? 1 : 0)
    + (f.radiusKm !== DEFAULT_FILTERS.radiusKm ? 1 : 0);
}

function renderFilters() {
  const f = state.filters;
  for (const group of ['mode', 'kind']) {
    $$(`[data-group="${group}"] .chip`).forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.value === f[group])));
  }
  $$('[data-group="diet"] .chip').forEach((c) => c.setAttribute('aria-pressed', String(f.diet.includes(c.dataset.value))));
  $('#openNow').checked = f.openNow;
  $('#radius').value = f.radiusKm;
  $('#radiusValue').textContent = `${f.radiusKm} km`;

  const counts = cuisineCounts(applyFilters(allPlaces, { ...f, cuisines: [] }, { excluded: state.excluded })).slice(0, 30);
  const chips = clear($('#cuisineChips'));
  const labels = new Set(counts.map(([l]) => l));
  const entries = [...counts, ...f.cuisines.filter((l) => !labels.has(l)).map((l) => [l, 0])];
  chips.append(
    ...entries.map(([label, n]) =>
      h('button', {
        type: 'button', class: 'chip', 'data-value': label,
        'aria-pressed': String(f.cuisines.includes(label)),
        onclick: () => toggleIn(f.cuisines, label),
      }, label, ' ', h('small', { text: String(n) })),
    ),
  );
  show($('#cuisineFieldset'), entries.length > 0);
  show($('#clearCuisines'), f.cuisines.length > 0);
  show($('#resetExcluded'), state.excluded.size > 0);

  const count = activeFilterCount();
  $('#filtersCount').textContent = String(count);
  show($('#filtersCount'), count > 0);
}

function toggleIn(arr, value) {
  const i = arr.indexOf(value);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(value);
  filtersChanged();
}

function filtersChanged() {
  persist();
  wheelIds = [];
  faceoff = null;
  quiz = { step: 0, answers: [] };
  render();
}

function resetFilters() {
  state.filters = { ...DEFAULT_FILTERS };
  filtersChanged();
  if (state.filters.radiusKm > fetchedRadiusKm) loadPlaces({ widen: false });
}

function wireFilters() {
  $('#filtersToggle').addEventListener('click', (e) => {
    const body = $('#filtersBody');
    body.hidden = !body.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!body.hidden));
  });
  for (const group of ['mode', 'kind']) {
    $(`[data-group="${group}"]`).addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      state.filters[group] = chip.dataset.value;
      filtersChanged();
    });
  }
  $('[data-group="diet"]').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) toggleIn(state.filters.diet, chip.dataset.value);
  });
  $('#openNow').addEventListener('change', (e) => {
    state.filters.openNow = e.target.checked;
    filtersChanged();
  });
  $('#radius').addEventListener('input', (e) => {
    state.filters.radiusKm = Number(e.target.value);
    $('#radiusValue').textContent = `${state.filters.radiusKm} km`;
  });
  $('#radius').addEventListener('change', () => {
    filtersChanged();
    if (state.filters.radiusKm > fetchedRadiusKm) loadPlaces({ widen: false });
  });
  $('#clearCuisines').addEventListener('click', () => {
    state.filters.cuisines = [];
    filtersChanged();
  });
  $('#resetFilters').addEventListener('click', resetFilters);
  $('#resetExcluded').addEventListener('click', () => {
    state.excluded.clear();
    filtersChanged();
  });
}

/* ---------- Result dialog ---------- */

function showResult(place, { eyebrow = "Tonight's pick", onSkip = null, celebrate = true } = {}) {
  $('#resultEyebrow').textContent = eyebrow;
  $('#resultEmoji').textContent = place.emoji;
  $('#resultName').textContent = place.name;
  clear($('#resultMeta')).append(...[metaText(place), openTag(place)].filter(Boolean));

  const rows = [];
  if (place.address) rows.push(['Address', place.address]);
  if (place.hours) rows.push(['Hours', place.hours]);
  const features = [
    place.modes.includes('delivery') && 'Delivery',
    place.modes.includes('takeaway') && 'Takeaway',
    place.outdoor && 'Patio',
    ...place.diet.map((d) => d.replace('_', '-')),
  ].filter(Boolean);
  if (features.length) rows.push(['Good to know', features.join(', ')]);
  clear($('#resultDetails')).append(
    ...rows.map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', { text: v }))),
  );

  const link = (cls, text, href, extra = {}) =>
    h('a', { class: `btn ${cls}`, href, target: '_blank', rel: 'noopener noreferrer', text, ...extra });
  const actions = clear($('#resultActions'));
  actions.append(link('primary', '🧭 Get directions', mapsUrl(place)));
  if (place.phone) actions.append(h('a', { class: 'btn secondary', href: `tel:${place.phone.replace(/[^+\d]/g, '')}`, text: `📞 Call` }));
  if (place.website) actions.append(link('secondary', '🌐 Website', place.website));
  actions.append(
    h('button', {
      class: 'btn ghost', type: 'button', 'aria-pressed': String(state.saved.has(place.id)),
      text: state.saved.has(place.id) ? '★ Saved' : '☆ Save',
      onclick: (e) => {
        toggleSaved(place.id);
        e.currentTarget.textContent = state.saved.has(place.id) ? '★ Saved' : '☆ Save';
      },
    }),
  );

  const q = encodeURIComponent(place.name);
  const delivery = clear($('#resultDelivery'));
  delivery.append(
    h('p', { class: 'delivery-label', text: place.modes.includes('delivery') ? 'Order delivery' : 'Order delivery (availability not confirmed)' }),
    h('div', { class: 'delivery-links' },
      link('ghost', 'Uber Eats ↗', `https://www.ubereats.com/search?q=${q}`),
      link('ghost', 'DoorDash ↗', `https://www.doordash.com/search/store/${q}/`),
      link('ghost', 'SkipTheDishes ↗', `https://www.skipthedishes.com/search?q=${q}`),
    ),
  );

  const skip = $('#resultSkip');
  show(skip, !!onSkip);
  skip.onclick = () => {
    state.excluded.add(place.id);
    $('#resultDialog').close();
    persist();
    wheelIds = wheelIds.filter((id) => id !== place.id);
    render();
    onSkip?.();
  };

  openDialog($('#resultDialog'));
  if (celebrate) {
    vibrate(30);
    confetti();
  }
}

function toggleSaved(id) {
  if (state.saved.has(id)) state.saved.delete(id);
  else state.saved.add(id);
  persist();
  if (activeTab === 'list') renderList();
}

/* ---------- Tabs ---------- */

function setTab(name) {
  activeTab = name;
  for (const t of $$('[role="tab"]')) {
    const on = t.dataset.tab === name;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    show($(`#panel-${t.dataset.tab}`), on);
  }
  render();
}

function wireTabs() {
  const tabs = $$('[role="tab"]');
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => setTab(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      const next = tabs[(i + dir + tabs.length) % tabs.length];
      next.focus();
      setTab(next.dataset.tab);
    });
  });
}

/* ---------- Spin ---------- */

function syncWheel(matches, force = false) {
  const valid = new Set(matches.map((p) => p.id));
  let ids = force ? [] : wheelIds.filter((id) => valid.has(id));
  const want = Math.min(WHEEL_SIZE, matches.length);
  if (ids.length < want) {
    const have = new Set(ids);
    ids = ids.concat(pickRandom(matches.filter((p) => !have.has(p.id)), want - ids.length).map((p) => p.id));
  }
  wheelIds = ids;
}

function renderSpin(matches) {
  if (!wheelIds.length || wheelIds.length < Math.min(WHEEL_SIZE, matches.length)) syncWheel(matches);
  if (!wheel.spinning) wheel.setItems(wheelIds.map((id) => byId(id).name));
  $('#wheelCount').textContent = String(matches.length);
}

async function spin() {
  if (wheel.spinning) return;
  const matches = pool();
  if (!matches.length) return;
  syncWheel(matches);
  if (wheelIds.length === 1) return showResult(byId(wheelIds[0]), { onSkip: null });
  wheel.setItems(wheelIds.map((id) => byId(id).name));
  const index = Math.floor(Math.random() * wheelIds.length);
  const winner = byId(wheelIds[index]);
  $$('#spinBtn, #wheelCenter, #shuffleBtn').forEach((b) => (b.disabled = true));
  await wheel.spin(index);
  $$('#spinBtn, #wheelCenter, #shuffleBtn').forEach((b) => (b.disabled = false));
  showResult(winner, { onSkip: () => spin() });
}

/* ---------- Quiz ---------- */

function renderQuiz() {
  const bar = $('#quizBar');
  const optionsEl = clear($('#quizOptions'));
  const result = $('#quizResult');
  if (quiz.step >= QUIZ.length) {
    bar.style.width = '100%';
    $('#quizStep').textContent = 'Your matches';
    $('#quizQuestion').textContent = 'Based on your cravings…';
    show(optionsEl, false);
    show(result, true);
    const ranked = rankByQuiz(pool(), quiz.answers).slice(0, 3);
    clear(result).append(
      h('div', { class: 'picks' },
        ranked.map((p, i) => pickCard(p, { badge: i === 0 ? '🏆 Best match' : null, onClick: () => showResult(p, { eyebrow: 'Matched to your cravings', onSkip: () => { renderQuiz(); } }) })),
      ),
      h('div', { class: 'row center gap-top' },
        h('button', { class: 'btn ghost', type: 'button', text: 'Retake quiz', onclick: () => { quiz = { step: 0, answers: [] }; renderQuiz(); } }),
      ),
    );
    return;
  }
  const q = QUIZ[quiz.step];
  show(optionsEl, true);
  show(result, false);
  bar.style.width = `${(quiz.step / QUIZ.length) * 100}%`;
  $('#quizStep').textContent = `Question ${quiz.step + 1} of ${QUIZ.length}`;
  $('#quizQuestion').textContent = q.q;
  optionsEl.append(
    ...q.options.map((o) =>
      h('button', { class: 'option', type: 'button', onclick: () => { quiz.answers.push(o); quiz.step++; renderQuiz(); } },
        h('span', { class: 'e', 'aria-hidden': 'true', text: o.emoji }), o.label),
    ),
  );
}

function pickCard(p, { badge, onClick }) {
  return h('button', { class: 'pick-card', type: 'button', onclick: onClick },
    h('span', { class: 'e', 'aria-hidden': 'true', text: p.emoji }),
    badge ? h('span', { class: 'tag open', text: badge }) : null,
    h('span', { class: 'n', text: p.name }),
    h('span', { class: 'm', text: metaText(p) }),
  );
}

/* ---------- Face-off ---------- */

function newFaceoff() {
  const matches = pool();
  let size = 1;
  while (size * 2 <= Math.min(matches.length, 8)) size *= 2;
  if (size < 2) return { error: true };
  return { current: pickRandom(matches, size), next: [], i: 0, size };
}

function renderFaceoff() {
  if (!faceoff) faceoff = newFaceoff();
  const arena = clear($('#faceoffArena'));
  if (faceoff.error) {
    $('#faceoffRound').textContent = 'Not enough spots';
    arena.append(h('p', { class: 'muted', text: 'A face-off needs at least 2 matching spots. Loosen your filters and try again.' }));
    return;
  }
  const n = faceoff.current.length;
  $('#faceoffRound').textContent = n === 2 ? 'Final' : n === 4 ? 'Semi-finals' : n === 8 ? 'Quarter-finals' : `Round of ${n}`;
  $('#faceoffTitle').textContent = `Match ${faceoff.i / 2 + 1} of ${n / 2} — which wins?`;
  const [a, b] = [faceoff.current[faceoff.i], faceoff.current[faceoff.i + 1]];
  const side = (p) =>
    h('button', { class: 'contender', type: 'button', onclick: () => advanceFaceoff(p) },
      h('span', { class: 'e', 'aria-hidden': 'true', text: p.emoji }),
      h('span', { class: 'n', text: p.name }),
      h('span', { class: 'm', text: metaText(p) }),
    );
  arena.append(side(a), h('span', { class: 'vs-badge', 'aria-hidden': 'true', text: 'VS' }), side(b));
}

function advanceFaceoff(winner) {
  faceoff.next.push(winner);
  faceoff.i += 2;
  if (faceoff.i >= faceoff.current.length) {
    if (faceoff.next.length === 1) {
      faceoff = null;
      showResult(winner, { eyebrow: 'Face-off champion', onSkip: () => { renderFaceoff(); } });
      return renderFaceoff();
    }
    faceoff.current = faceoff.next;
    faceoff.next = [];
    faceoff.i = 0;
  }
  renderFaceoff();
}

/* ---------- List ---------- */

let listLimit = 60;

function renderList() {
  const savedOnly = $('#savedOnly').checked;
  let items = applyFilters(allPlaces, state.filters);
  if (savedOnly) items = items.filter((p) => state.saved.has(p.id));
  const box = clear($('#spotList'));
  if (!items.length) {
    box.append(h('p', { class: 'muted', text: savedOnly ? 'No saved spots yet — tap ☆ on a spot to save it.' : 'Nothing to show.' }));
    return;
  }
  box.append(
    ...items.slice(0, listLimit).map((p) => {
      const skipped = state.excluded.has(p.id);
      return h('div', { class: `spot${skipped ? ' skipped' : ''}` },
        h('span', { class: 'e', 'aria-hidden': 'true', text: p.emoji }),
        h('div', {},
          h('button', { class: 'link n spot-name', type: 'button', text: p.name, onclick: () => showResult(p, { eyebrow: 'Spot details', celebrate: false }) }),
          h('div', { class: 'm' }, metaText(p), ' ', openTag(p)),
        ),
        h('div', { class: 'spot-actions' },
          h('button', {
            class: 'icon-btn', type: 'button', 'aria-pressed': String(state.saved.has(p.id)),
            'aria-label': state.saved.has(p.id) ? `Unsave ${p.name}` : `Save ${p.name}`, text: state.saved.has(p.id) ? '★' : '☆',
            onclick: () => toggleSaved(p.id),
          }),
          h('button', {
            class: 'icon-btn', type: 'button', 'aria-pressed': String(skipped),
            title: skipped ? 'Include in games' : 'Skip tonight',
            'aria-label': skipped ? `Include ${p.name} again` : `Skip ${p.name} tonight`, text: '🚫',
            onclick: () => {
              if (skipped) state.excluded.delete(p.id);
              else state.excluded.add(p.id);
              wheelIds = wheelIds.filter((id) => !state.excluded.has(id));
              faceoff = null;
              render();
            },
          }),
        ),
      );
    }),
  );
  if (items.length > listLimit) {
    box.append(h('button', { class: 'btn ghost', type: 'button', text: `Show more (${items.length - listLimit})`, onclick: () => { listLimit += 60; renderList(); } }));
  }
}

/* ---------- Share ---------- */

function openShare() {
  const matches = pool();
  if (!matches.length) return;
  const choices = clear($('#shareChoices'));
  const listed = matches.slice(0, 40);
  const initial = new Set(pickRandom(listed, 3).map((p) => p.id));
  for (const p of listed) {
    choices.append(
      h('label', {},
        h('input', { type: 'checkbox', value: p.id, checked: initial.has(p.id), onchange: onShareChange }),
        h('span', {}, `${p.emoji} ${p.name}`, ' ', h('span', { class: 'muted', text: metaText(p) })),
      ),
    );
  }
  updateShareUrl();
  show($('#shareNative'), !!navigator.share);
  openDialog($('#shareDialog'));
}

function onShareChange(e) {
  const checked = $$('#shareChoices input:checked');
  if (checked.length > 5) {
    e.target.checked = false;
    toast('Up to 5 spots per shortlist');
  }
  updateShareUrl();
}

function updateShareUrl() {
  const ids = $$('#shareChoices input:checked').map((i) => i.value);
  const url = new URL('/', location.origin);
  if (ids.length) url.searchParams.set('s', ids.join(','));
  const name = $('#shareName').value.trim();
  if (name) url.searchParams.set('from', name);
  // Carry the sender's area so the partner's browser knows which tiles to load.
  if (ids.length && state.location) {
    url.searchParams.set('c', `${state.location.lat.toFixed(3)},${state.location.lng.toFixed(3)}`);
  }
  $('#shareUrl').value = ids.length ? url.toString() : '';
  $('#shareCopy').disabled = $('#shareNative').disabled = !ids.length;
}

async function copyShare() {
  const input = $('#shareUrl');
  try {
    await navigator.clipboard.writeText(input.value);
  } catch {
    input.select();
    document.execCommand?.('copy');
  }
  toast('Link copied!');
}

/* ---------- Partner view ---------- */

async function initPartner() {
  const params = new URLSearchParams(location.search);
  const ids = (params.get('s') || '').split(',').filter(Boolean).slice(0, 5);
  const center = (params.get('c') || '').split(',').map((v) => (v.trim() === '' ? NaN : Number(v)));
  const hasCenter = center.length === 2 && center.every(Number.isFinite);
  const from = (params.get('from') || '').trim().slice(0, 30);
  render();
  $('#partnerEyebrow').textContent = from ? `${from} sent you a shortlist` : 'Someone sent you a shortlist';
  const list = clear($('#partnerList'));
  show($('#partnerRandom'), false);
  list.append(h('p', { class: 'muted', text: 'Loading the shortlist…' }));
  try {
    if (!hasCenter) throw new Error('This shortlist link is incomplete — ask for a new one.');
    const places = withDistances(await fetchPlacesByIds(ids, { lat: center[0], lng: center[1] }), state.location);
    if (!places.length) throw new Error('Those spots are no longer available.');
    clear(list).append(
      ...places.map((p) =>
        pickCard(p, { onClick: () => showResult(p, { eyebrow: 'You chose', celebrate: true }) }),
      ),
    );
    show($('#partnerRandom'), true);
    $('#partnerRandom').onclick = () => showResult(pickRandom(places, 1)[0], { eyebrow: 'Fate has chosen' });
  } catch (err) {
    clear(list).append(h('p', { class: 'error', text: err.message }));
  }
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

function boot() {
  wireDialogs();
  wireFilters();
  wireTabs();
  wheel = new Wheel($('#wheel'));

  wireAddressSearch({ form: $('#heroSearch'), input: $('#heroQuery'), list: $('#heroResults'), error: $('#heroError') });
  wireAddressSearch({ form: $('#locSearch'), input: $('#locQuery'), list: $('#locResults'), error: $('#locError') });
  $('#gpsBtn').addEventListener('click', () => gpsLookup($('#heroError')));
  $('#gpsBtn2').addEventListener('click', () => gpsLookup($('#locError')));
  $('#locationBtn').addEventListener('click', () => openDialog($('#locationDialog')));
  $('#privacyBtn').addEventListener('click', () => openDialog($('#privacyDialog')));

  $('#spinBtn').addEventListener('click', spin);
  $('#wheelCenter').addEventListener('click', spin);
  $('#shuffleBtn').addEventListener('click', () => {
    syncWheel(pool(), true);
    render();
  });
  $('#shareBtn').addEventListener('click', openShare);
  $('#shareName').addEventListener('input', updateShareUrl);
  $('#shareCopy').addEventListener('click', copyShare);
  $('#shareNative').addEventListener('click', () =>
    navigator.share({ title: 'Dinner tonight?', text: 'Help me pick where we eat tonight 🍽️', url: $('#shareUrl').value }).catch(() => {}),
  );
  $('#savedOnly').addEventListener('change', renderList);
  $('#faceoffRestart').addEventListener('click', () => { faceoff = null; renderFaceoff(); });

  if (new URLSearchParams(location.search).has('s')) {
    initPartner();
  } else if (state.location) {
    loadPlaces();
  } else {
    render();
  }

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

boot();
