// HTML shell and static page copy for scripts/build-pages.mjs.
export const SITE = 'https://dinnerdecider.ca';
export const EMAIL = 'hello@dinnerdecider.ca';

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// JSON for an ld+json block: "<" is escaped so the data can never close the script tag.
export const jsonLd = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

const NAV = [
  ['Decide', '/'],
  ['Local gems', '/gems/'],
  ['About', '/about/'],
];

const FOOTER_LINKS = [
  ['About', '/about/'],
  ['Contact', '/contact/'],
  ['Privacy', '/privacy/'],
  ['Terms', '/terms/'],
  ['Local gems', '/gems/'],
];

export function page({ path, title, description, body, head = '', scripts = [], active = '' }) {
  const url = `${SITE}${path}`;
  const nav = NAV.map(
    ([label, href]) => `<a href="${href}"${href === active ? ' aria-current="page"' : ''}>${esc(label)}</a>`,
  ).join('\n      ');
  const footer = FOOTER_LINKS.map(([label, href]) => `<a href="${href}">${esc(label)}</a>`).join('\n      ');
  const scriptTags = scripts.map((s) => `  <script type="module" src="${s}"></script>\n`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(url)}">
  <meta name="theme-color" content="#c2410c">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:site_name" content="DinnerDecider">
  <link rel="stylesheet" href="/css/styles.css">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7839352352766254" crossorigin="anonymous"></script>
${head}</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>

  <header class="topbar">
    <a class="brand" href="/" aria-label="DinnerDecider home">
      <span class="brand-mark" aria-hidden="true">🍽️</span>
      <span class="brand-name">Dinner<b>Decider</b></span>
    </a>
    <nav class="nav" aria-label="Main">
      ${nav}
    </nav>
  </header>

  <main id="main" class="page">
${body}
  </main>

  <footer class="footer">
    <p>Restaurant data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>. Hours and details are community-maintained — double-check before you head out.</p>
    <nav class="footer-links" aria-label="Footer">
      ${footer}
    </nav>
  </footer>
${scriptTags}</body>
</html>
`;
}

const mail = `<a href="mailto:${EMAIL}">${EMAIL}</a>`;

export const STATIC_PAGES = [
  {
    path: '/about/',
    title: 'About DinnerDecider',
    description: 'DinnerDecider is a small, independent Ontario project that turns "where should we eat?" into a quick game using real restaurants near you.',
    body: `<article class="prose">
  <h1>About DinnerDecider</h1>
  <p class="lead">DinnerDecider ends the "I don't know, you pick" argument. Tell it where you are and it turns the real restaurants around you into a quick game.</p>

  <h2>What it does</h2>
  <p>You can spin a wheel, take a short craving quiz, or run a face-off between two spots until one wins. Filters for dine-in, takeaway, dietary needs, cuisine and distance narrow things down first. You can also send a shortlist to your partner so they get the final say.</p>

  <h2>How decisions work</h2>
  <p>The wheel and face-off are random picks from the places that match your filters. The quiz scores places by cuisine and style, with a little randomness so you do not always get the same answer. Nothing is sponsored, and no restaurant can pay to appear or rank higher.</p>

  <h2>Local gems</h2>
  <p>Our <a href="/gems/">Local gems</a> pages are short lists of favourite spots in Ontario cities, picked by hand. They are editorial opinion, not paid placements. Each pick is checked against OpenStreetMap data so the address and contact details are real, and picks that no longer match a listed place are left off.</p>

  <h2>Where the data comes from</h2>
  <p>Restaurant locations, cuisines, hours and contact details come from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, which is made by volunteers and available under the Open Database Licence (ODbL). We rebuild our copy of the Ontario data every week. OpenStreetMap does not have ratings or reviews, so we do not show any.</p>

  <h2>Who runs it</h2>
  <p>DinnerDecider is a small hobby project run from Ontario, Canada. If something is wrong, or you know a place we should feature, <a href="/contact/">get in touch</a>.</p>
</article>`,
  },
  {
    path: '/contact/',
    title: 'Contact DinnerDecider',
    description: 'Report a closed restaurant, send a correction, suggest a local gem or make a privacy request: email hello@dinnerdecider.ca.',
    body: `<article class="prose">
  <h1>Contact</h1>
  <p class="lead">The best way to reach us is email: ${mail}</p>
  <h2>What to write to us about</h2>
  <ul>
    <li><strong>Closed or moved restaurants.</strong> Tell us the name and city. The fix is best made on <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener">OpenStreetMap</a>, and we will pick it up in the next weekly refresh. We will also remove it from any Local gems page.</li>
    <li><strong>Corrections</strong> to anything we wrote on the site.</li>
    <li><strong>Suggestions</strong> for a place or a city we should add to Local gems, or a feature you would like.</li>
    <li><strong>Privacy requests</strong>, such as access to or correction of personal information. See our <a href="/privacy/">Privacy policy</a>.</li>
    <li><strong>Business enquiries.</strong> Gems are never for sale, but we are happy to hear from you.</li>
  </ul>
  <p>This is a one-person project, so replies can take a few days.</p>
</article>`,
  },
  {
    path: '/privacy/',
    title: 'Privacy Policy — DinnerDecider',
    description: 'What DinnerDecider stores in your browser, what it sends to its server, how advertising cookies work, and how to contact us about your privacy.',
    body: `<article class="prose">
  <h1>Privacy Policy</h1>
  <p class="muted">Effective November 2026</p>
  <p class="lead">DinnerDecider has no accounts and does not ask you to sign up. This page explains what happens to your information.</p>

  <h2>Stored in your browser</h2>
  <p>Your chosen location (coordinates and a label), your filters, and the restaurants you save are stored in your browser's local storage so the app remembers them next time. This stays on your device. You can clear it at any time through your browser's site settings. Skipped restaurants are kept only for the current visit.</p>

  <h2>Sent to our server</h2>
  <p>When you search for an address or use "Use my location", your browser sends the search text or map coordinates (rounded to roughly 100 metres) to our server, which asks the OpenStreetMap Nominatim service to turn it into an address or place name. Results may be cached for a short time. We do not link these requests to you or build a profile of you. Restaurant data itself is static files that your browser downloads for the area around you.</p>
  <p>Shortlist links you share contain only restaurant IDs and an optional first name that you type.</p>
  <p>Our hosting provider, Cloudflare, may process standard technical information such as IP address and browser type to deliver the site and protect it from abuse.</p>

  <h2>Advertising</h2>
  <p>We may show ads on this site through Google AdSense. Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits to this and other websites. Google's use of advertising cookies enables it and its partners to serve ads to you based on your visit to this site and/or other sites on the Internet.</p>
  <p>You can opt out of personalised advertising by visiting <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google Ads Settings</a>. You can also opt out of some third-party vendors' use of cookies for personalised advertising at <a href="https://www.aboutads.info" target="_blank" rel="noopener">www.aboutads.info</a>. To learn more about how Google handles data, see <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">How Google uses information from sites or apps that use our services</a>.</p>
  <p>If you visit from the European Economic Area, the United Kingdom or Switzerland, Google's consent tool asks for your choice before any advertising cookies are used. You can consent, decline, or pick specific purposes under "Manage options". To change your choice later, use the "Privacy and cookie settings" link shown on the page.</p>

  <h2>Your rights</h2>
  <p>Under Canadian privacy law (PIPEDA), you can ask what personal information we hold about you, ask us to correct it, or ask us to delete it. We hold very little, but you are welcome to ask. Email ${mail} and we will respond within 30 days.</p>

  <h2>Children</h2>
  <p>DinnerDecider is a general-audience site and is not directed at children under 13.</p>

  <h2>Changes</h2>
  <p>If we change this policy we will update the date at the top of this page.</p>
</article>`,
  },
  {
    path: '/terms/',
    title: 'Terms of Use — DinnerDecider',
    description: 'The terms for using DinnerDecider: information may be inaccurate, use at your own risk, OpenStreetMap attribution, and Ontario governing law.',
    body: `<article class="prose">
  <h1>Terms of Use</h1>
  <p class="muted">Effective November 2026</p>
  <p class="lead">By using DinnerDecider you agree to these simple terms.</p>

  <h2>Use at your own risk</h2>
  <p>DinnerDecider is provided as is, for fun and convenience. Restaurant information, including opening hours, addresses, phone numbers, menus and dietary tags, is community-maintained and may be inaccurate, incomplete or out of date. Please check with the restaurant before you go, especially if you have allergies or dietary requirements.</p>

  <h2>Editorial picks</h2>
  <p>Local gems are our own opinions. They are not paid placements and are not a guarantee of quality, safety or availability.</p>

  <h2>No liability</h2>
  <p>To the fullest extent permitted by law, DinnerDecider and its operator are not liable for any loss, damage or disappointment arising from your use of the site or from relying on its information, including a restaurant being closed, different from its description, or unable to meet your needs.</p>

  <h2>Data and attribution</h2>
  <p>Restaurant data is © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> and is available under the <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener">Open Database Licence (ODbL)</a>. Our own text and code are not licensed for copying wholesale without permission.</p>

  <h2>Third-party links</h2>
  <p>The site links to maps, restaurant websites and delivery services that we do not control. We are not responsible for their content or practices.</p>

  <h2>Governing law</h2>
  <p>These terms are governed by the laws of the Province of Ontario and the federal laws of Canada that apply there.</p>

  <h2>Contact</h2>
  <p>Questions about these terms? Email ${mail}.</p>
</article>`,
  },
];
