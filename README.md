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
- `functions/api/places.js` and `functions/api/geocode.js`: API handlers (routed by `src/worker.js`) that proxy OpenStreetMap services (Overpass for places, Nominatim for geocoding). Responses are cached at the Cloudflare edge to limit upstream load.
- No API keys are needed.
- `test/`: unit tests for the shared logic, run with the Node test runner.

## Local development

```sh
npm install
npm run dev     # serves the site and API locally via wrangler
npm test        # runs the test suite
```

## Deployment (Cloudflare Workers + static assets)

Connect the GitHub repo in the Cloudflare dashboard (**Workers & Pages > Create > Import a repository**) and keep the defaults: build command *(none)*, deploy command `npx wrangler deploy`. Every push to `main` redeploys. Or deploy by hand:

```sh
npx wrangler login
npm run deploy
```

Then add your domain under **Workers & Pages > dinner-decider > Settings > Domains & Routes > Add > Custom domain**. If the domain uses Cloudflare DNS, records and certificate are created automatically.

Before launching, replace the placeholder contact URL in the `User-Agent` headers in `functions/api/geocode.js` and `functions/_lib/osm.js`. The Nominatim usage policy requires a real contact URL or email in the User-Agent.

## Data limits

- OpenStreetMap has no ratings, reviews or price levels, so results cannot be filtered or sorted by those.
- Opening hours are community maintained and may be missing or out of date.
- For heavy traffic, consider self-hosting an Overpass instance, or swapping in Google Places behind the same `/api/places` contract.
