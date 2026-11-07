# DinnerDecider

Can't decide where to eat? DinnerDecider helps a person or a couple settle on dinner and then points you to a real restaurant near you.

## Features

- **Spin wheel**: spin to pick a place at random.
- **Craving quiz**: answer a few questions to work out what you feel like eating.
- **Face-off**: pick between two options head to head until one wins.
- **Shareable partner shortlist**: share a shortlist so both people can see the same options.
- **Filters**: narrow down the places that are shown.
- **PWA**: installable to the home screen, with a service worker that serves cached files when offline.

## Architecture

- `public/`: static front end built from plain ES modules (no bundler). `public/index.html` loads `public/js/app.js` as a module, and styles live in `public/css/styles.css`.
- `public/data/`: **pre-built restaurant data** from OpenStreetMap. `meta.json` describes the build and lists the tiles; `tiles/{key}.json` holds the places in one 0.1° x 0.1° cell. The browser loads only the tiles around the user (`public/js/lib/tiles.js` is shared with the build script).
- `scripts/build-places.mjs`: downloads all restaurants for the configured regions from Overpass once, normalises them with `functions/_lib/osm.js` and writes the tiles.
- `functions/api/geocode.js`: address search and reverse lookup via Nominatim (routed by `src/worker.js`, cached at the edge). No API keys are needed.
- `test/`: unit tests for the shared logic, run with the Node test runner.

## Local development

```sh
npm install
npm run dev     # serves the site and API locally via wrangler
npm test        # runs the test suite
```

### Restaurant data

```sh
npm run build:data                        # download and rebuild public/data (can take several minutes)
npm run build:data -- --save raw.json     # also keep the raw Overpass response
npm run build:data -- --input raw.json    # rebuild from a saved response, no network
```

The build refuses to overwrite existing data if the new count is zero or under half of the previous one.

**Weekly refresh:** `.github/workflows/refresh-data.yml` runs every Monday (and on demand), rebuilds the data and commits `public/data` to `main` if it changed. The push triggers the normal Cloudflare deploy.

**Adding a region:** add its ISO 3166-2 code to `REGIONS` in `scripts/build-places.mjs` (for example `'CA-QC'`), add a display name to `REGION_NAMES` in `public/js/api.js`, then rebuild.

## Deployment (Cloudflare Workers + static assets)

Connect the GitHub repo in the Cloudflare dashboard (**Workers & Pages > Create > Import a repository**) and keep the defaults: build command *(none)*, deploy command `npx wrangler deploy`. Every push to `main` redeploys. Or deploy by hand:

```sh
npx wrangler login
npm run deploy
```

Then add your domain under **Workers & Pages > dinner-decider > Settings > Domains & Routes > Add > Custom domain**. If the domain uses Cloudflare DNS, records and certificate are created automatically.

The `User-Agent` in `functions/api/geocode.js` must keep a real contact URL or email (Nominatim usage policy).

## Data limits

- OpenStreetMap has no ratings, reviews or price levels, so results cannot be filtered or sorted by those.
- Opening hours are community maintained and may be missing or out of date.
- Data is as fresh as the last weekly build.
