async function get(path, params) {
  const url = `${path}?${new URLSearchParams(params)}`;
  let res;
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } });
  } catch {
    throw new Error("You seem to be offline — check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

export const fetchPlaces = ({ lat, lng, radiusKm }) =>
  get('/api/places', { lat: lat.toFixed(4), lng: lng.toFixed(4), radius: String(Math.round(radiusKm * 1000)) }).then((d) => d.places);

export const fetchPlacesByIds = (ids) => get('/api/places', { ids: ids.join(',') }).then((d) => d.places);

export const searchAddress = (q) => get('/api/geocode', { q }).then((d) => d.results);

export const reverseGeocode = (lat, lng) =>
  get('/api/geocode', { lat: lat.toFixed(4), lng: lng.toFixed(4) }).then((d) => d.label).catch(() => 'Current location');
