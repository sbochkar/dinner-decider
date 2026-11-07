// A pragmatic parser for the common subset of OSM opening_hours syntax:
//   "Mo-Fr 11:00-22:00; Sa,Su 12:00-23:00", "24/7", "Mo-Su 10:00-02:00", "... off"
// Returns true (open), false (closed) or null (unknown / unsupported syntax).
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function dayIndex(s) {
  return DAYS.indexOf(s);
}

function expandDays(spec) {
  const days = new Set();
  for (const part of spec.split(',')) {
    const range = part.trim().match(/^([A-Za-z]{2})(?:-([A-Za-z]{2}))?$/);
    if (!range) return null;
    const a = dayIndex(range[1]);
    const b = range[2] ? dayIndex(range[2]) : a;
    if (a < 0 || b < 0) return null;
    for (let d = a; ; d = (d + 1) % 7) {
      days.add(d);
      if (d === b) break;
    }
  }
  return days;
}

function minutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function isOpenAt(hours, date = new Date()) {
  if (!hours) return null;
  const text = hours.trim();
  if (text === '24/7') return true;

  // rules[day] = list of [start, end) minute ranges, end may exceed 1440 (past midnight)
  const rules = Array.from({ length: 7 }, () => []);
  let understood = false;

  for (const raw of text.split(';')) {
    const rule = raw.trim();
    if (!rule) continue;
    if (/(PH|SH|\bsunrise\b|\bsunset\b|week|\[|easter|"|\+)/i.test(rule)) {
      // Holiday/week-number/comment rules: ignore this rule, don't guess.
      continue;
    }
    const m = rule.match(/^(?:([A-Za-z]{2}(?:\s*[-,]\s*[A-Za-z]{2})*)\s+)?(off|closed|\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*)$/i);
    if (!m) return null;
    const days = m[1] ? expandDays(m[1].replace(/\s+/g, '')) : new Set([0, 1, 2, 3, 4, 5, 6]);
    if (!days) return null;
    understood = true;
    if (/^(off|closed)$/i.test(m[2])) {
      for (const d of days) rules[d] = [];
      continue;
    }
    const ranges = m[2].split(',').map((r) => {
      const [s, e] = r.split('-').map((x) => minutes(x.trim()));
      return [s, e <= s ? e + 1440 : e];
    });
    for (const d of days) rules[d] = ranges;
  }
  if (!understood) return null;

  const today = date.getDay();
  const now = date.getHours() * 60 + date.getMinutes();
  if (rules[today].some(([s, e]) => now >= s && now < e)) return true;
  // Spill-over from yesterday's late-night range
  const yesterday = (today + 6) % 7;
  return rules[yesterday].some(([, e]) => e > 1440 && now + 1440 < e);
}
