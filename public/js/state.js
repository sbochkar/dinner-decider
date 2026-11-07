import { DEFAULT_FILTERS } from './lib/places.js';

const KEY = 'dinnerdecider:v1';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

const saved = read();

// Persisted: location, filters, saved places. Skipped places are per-session on purpose.
export const state = {
  location: saved.location || null, // { lat, lng, label }
  filters: { ...DEFAULT_FILTERS, ...(saved.filters || {}) },
  saved: new Set(saved.saved || []),
  excluded: new Set(),
};

export function persist() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ location: state.location, filters: state.filters, saved: [...state.saved] }),
    );
  } catch {
    /* private mode / storage disabled: app still works for this session */
  }
}
