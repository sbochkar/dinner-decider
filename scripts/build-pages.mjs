// Builds the static content pages from content/gems/*.json and the restaurant tiles.
//   npm run build:pages
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tilesForRadius } from '../public/js/lib/tiles.js';
import { resolvePick } from '../public/js/lib/gems.js';
import { SITE, esc, jsonLd, page, STATIC_PAGES } from './lib/pages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const MIN_PICKS = 3;
const SEARCH_MARGIN_KM = 6;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const monthLabel = (ym) => {
  const [y, m] = String(ym).split('-').map(Number);
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} ${y}` : String(ym);
};

async function write(rel, text) {
  const file = path.join(pub, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

async function loadTiles(city, have) {
  const places = [];
  for (const key of tilesForRadius(city.lat, city.lng, city.radiusKm + SEARCH_MARGIN_KM)) {
    if (!have.has(key)) continue;
    places.push(...JSON.parse(await readFile(path.join(pub, 'data/tiles', `${key}.json`), 'utf8')));
  }
  return places;
}

const mapsUrl = (p) => {
  const dest = p.address ? `${p.name}, ${p.address}` : `${p.lat},${p.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
};

const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : null);

function pickCard(pick, p) {
  const cuisines = (p.cuisines || []).map((c) => c.label);
  const details = [];
  if (p.address) details.push(['Address', esc(p.address)]);
  if (p.hours) details.push(['Hours', esc(p.hours)]);
  if (p.phone) details.push(['Phone', `<a href="tel:${esc(p.phone.replace(/[^+\d]/g, ''))}">${esc(p.phone)}</a>`]);
  const site = safeUrl(p.website);
  return `    <article class="gem" id="${esc(p.id)}">
      <div class="gem-emoji" aria-hidden="true">${esc(p.emoji || '🍽️')}</div>
      <div class="gem-main">
        <h3>${esc(p.name)}</h3>
        <p class="gem-meta">${esc([pick.neighbourhood, ...cuisines.slice(0, 3)].filter(Boolean).join(' · '))}</p>
        <p class="gem-why">${esc(pick.why)}</p>
        <ul class="tags">${(pick.goodFor || []).map((t) => `<li class="tag">${esc(t)}</li>`).join('')}</ul>${
          details.length
            ? `\n        <dl class="details gem-details">${details.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`
            : ''
        }
        <div class="row">
          <a class="btn secondary small" href="${esc(mapsUrl(p))}" target="_blank" rel="noopener">Directions</a>${
            site ? `\n          <a class="btn ghost small" href="${esc(site)}" target="_blank" rel="noopener nofollow">Website</a>` : ''
          }
        </div>
      </div>
    </article>`;
}

function cityPage(city, picks, cities) {
  const title = `Local gems in ${city.city} — hand-picked places to eat`;
  const description = `${picks.length} editor-picked restaurants in ${city.city} (${city.area}), checked against OpenStreetMap data. Hand-picked, never paid.`;
  const others = cities
    .filter((c) => c.slug !== city.slug)
    .map((c) => `<a class="chip-link" href="/gems/${c.slug}/">${esc(c.city)}</a>`)
    .join('\n      ');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Local gems in ${city.city}`,
    itemListElement: picks.map(({ place: p }, i) => {
      const r = {
        '@type': 'Restaurant',
        name: p.name,
        geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng },
      };
      if (p.address) r.address = p.address;
      if (safeUrl(p.website)) r.url = p.website;
      return { '@type': 'ListItem', position: i + 1, item: r };
    }),
  };
  const body = `  <nav class="crumbs" aria-label="Breadcrumb"><a href="/gems/">Local gems</a> <span aria-hidden="true">›</span> ${esc(city.city)}</nav>
  <h1>Local gems in ${esc(city.city)}</h1>
  <p class="area">${esc(city.area)}</p>
  <p class="lead">${esc(city.intro)}</p>
  <p class="fine">Updated ${esc(monthLabel(city.updated))} · Editor's picks, not paid placements</p>

  <div class="gem-list">
${picks.map(({ pick, place }) => pickCard(pick, place)).join('\n')}
  </div>

  <div class="row center gem-actions">
    <button id="randomGem" class="btn primary large" type="button" hidden>🎲 Can't choose? Pick one for me</button>
    <a class="btn secondary large" href="/">Spin the wheel with every restaurant near you →</a>
  </div>

  <section class="more-cities" aria-labelledby="moreCities">
    <h2 id="moreCities">More cities</h2>
    <p class="city-links">
      ${others}
    </p>
  </section>

  <p class="fine disclaimer">Details such as addresses, hours and phone numbers come from OpenStreetMap contributors and may be out of date, so check with the restaurant before you go. Picks are editorial opinion, not paid placements. Spotted a closed place? <a href="/contact/">Tell us</a>.</p>`;
  return page({
    path: `/gems/${city.slug}/`,
    title,
    description,
    body,
    active: '/gems/',
    scripts: ['/js/gems.js'],
    head: `  <script type="application/ld+json">${jsonLd(ld)}</script>\n`,
  });
}

function indexPage(cities) {
  const cards = cities
    .map(
      (c) => `    <a class="city-card" href="/gems/${c.slug}/" data-lat="${c.lat}" data-lng="${c.lng}">
      <span class="city-flag" hidden>Closest to you</span>
      <h2>${esc(c.city)}</h2>
      <p class="muted">${esc(c.area)}</p>
      <p class="city-count">${c.count} hand-picked spots →</p>
    </a>`,
    )
    .join('\n');
  const body = `  <h1>Local gems across Ontario</h1>
  <p class="lead">These are editor's picks: places we like, chosen by hand rather than by algorithm or advertiser. Each one is checked against OpenStreetMap data so the details are real. If a place has closed or moved, <a href="/contact/">tell us</a> and we will fix it.</p>
  <div id="cityGrid" class="city-grid">
${cards}
  </div>
  <p class="fine disclaimer">Not sure which place to try? <a href="/">Let DinnerDecider choose</a> from every restaurant near you.</p>`;
  return page({
    path: '/gems/',
    title: 'Local gems across Ontario — hand-picked places to eat',
    description: 'Hand-picked local restaurants in Toronto, Ottawa, Mississauga and more across Ontario. Editor\'s picks, checked against OpenStreetMap data, never paid.',
    body,
    active: '/gems/',
    scripts: ['/js/gems.js'],
  });
}

async function main() {
  const meta = JSON.parse(await readFile(path.join(pub, 'data/meta.json'), 'utf8'));
  const have = new Set(meta.tiles);
  const lastmod = String(meta.generated).slice(0, 10);

  const dir = path.join(root, 'content/gems');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  const cities = [];
  for (const f of files) {
    const city = JSON.parse(await readFile(path.join(dir, f), 'utf8'));
    const places = await loadTiles(city, have);
    const picks = [];
    for (const pick of city.picks) {
      const place = resolvePick(pick, places, city);
      if (place) picks.push({ pick, place });
      else console.warn(`WARN ${city.slug}: could not resolve "${pick.name}"${pick.osmId ? ` (osmId ${pick.osmId})` : ''}; omitted`);
    }
    if (picks.length < MIN_PICKS) {
      throw new Error(`${city.slug}: only ${picks.length} of ${city.picks.length} picks resolved (need ${MIN_PICKS})`);
    }
    cities.push({ ...city, resolved: picks, count: picks.length });
  }
  cities.sort((a, b) => (a.city < b.city ? -1 : 1));

  for (const c of cities) await write(`gems/${c.slug}/index.html`, cityPage(c, c.resolved, cities));
  await write('gems/index.html', indexPage(cities));
  for (const p of STATIC_PAGES) {
    await write(`${p.path.slice(1)}index.html`, page({ ...p, active: p.path === '/about/' ? '/about/' : '' }));
  }

  const index = cities.map((c) => ({ slug: c.slug, city: c.city, lat: c.lat, lng: c.lng, count: c.count }));
  await write('data/gems-index.json', `${JSON.stringify(index)}\n`);

  const urls = [
    ['/', null],
    ['/gems/', lastmod],
    ...cities.map((c) => [`/gems/${c.slug}/`, lastmod]),
    ['/about/', null],
    ['/contact/', null],
    ['/privacy/', null],
    ['/terms/', null],
  ];
  const xml = urls
    .map(([u, d]) => `  <url><loc>${SITE}${u}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`)
    .join('\n');
  await write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xml}\n</urlset>\n`);
  await write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

  console.log(`Built ${cities.length} city pages (${cities.reduce((n, c) => n + c.count, 0)} picks) and ${STATIC_PAGES.length} static pages`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
