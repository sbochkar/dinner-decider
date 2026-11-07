// Prints anonymous click totals from the Workers Analytics Engine dataset.
// Usage: CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... npm run stats -- [--days 30]
const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token } = process.env;

if (!account || !token) {
  console.error(`Missing CLOUDFLARE_ACCOUNT_ID and/or CLOUDFLARE_API_TOKEN.

Setup:
  1. Account ID: Cloudflare dashboard > Workers & Pages > right sidebar.
  2. Token: My Profile > API Tokens > Create Token > Custom token with the
     "Account Analytics: Read" permission.
  3. Run: CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... npm run stats`);
  process.exit(1);
}

let days = 30;
const i = process.argv.indexOf('--days');
if (i !== -1) {
  days = Number(process.argv[i + 1]);
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    console.error('--days must be an integer from 1 to 90');
    process.exit(1);
  }
}

const sql = `SELECT blob1 AS type, blob2 AS target, blob3 AS page, SUM(_sample_interval * double1) AS clicks FROM dinnerdecider_events WHERE timestamp > NOW() - INTERVAL '${days}' DAY GROUP BY type, target, page ORDER BY clicks DESC`;

const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}` },
  body: sql,
});
if (!res.ok) {
  console.error(`Cloudflare API error ${res.status}: ${(await res.text()).slice(0, 500)}`);
  process.exit(1);
}
const rows = (await res.json()).data || [];

console.log(`Anonymous events, last ${days} days\n`);
if (!rows.length) {
  console.log('No events recorded yet.');
} else {
  const cells = rows.map((r) => [r.type, r.target || '-', r.page, String(Math.round(Number(r.clicks)))]);
  const head = ['type', 'target', 'page', 'count'];
  const widths = head.map((t, c) => Math.max(t.length, ...cells.map((row) => row[c].length)));
  const fmt = (row) => row.map((v, c) => (c === 3 ? v.padStart(widths[c]) : v.padEnd(widths[c]))).join('  ');
  console.log(fmt(head));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  cells.forEach((row) => console.log(fmt(row)));
}

const total = (type) => rows.filter((r) => r.type === type).reduce((n, r) => n + Number(r.clicks), 0);
const shown = total('result_shown');
console.log(`\nDelivery clicks per result shown: ${shown ? ((total('delivery_click') / shown) * 100).toFixed(1) : '0.0'}%`);
