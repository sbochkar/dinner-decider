// Geographic tiling shared by the build script and the browser.
// The world is cut into 0.1° x 0.1° cells; each cell is one data file.

const CELLS_PER_DEG = 10;
const KM_PER_DEG = 111.32;

export function tileKey(lat, lng) {
  return `${Math.floor(lat * CELLS_PER_DEG)}_${Math.floor(lng * CELLS_PER_DEG)}`;
}

// Keys of every cell touching the bounding box of the circle.
export function tilesForRadius(lat, lng, radiusKm) {
  const dLat = radiusKm / KM_PER_DEG;
  const dLng = radiusKm / (KM_PER_DEG * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const r0 = Math.floor((lat - dLat) * CELLS_PER_DEG);
  const r1 = Math.floor((lat + dLat) * CELLS_PER_DEG);
  const c0 = Math.floor((lng - dLng) * CELLS_PER_DEG);
  const c1 = Math.floor((lng + dLng) * CELLS_PER_DEG);
  const keys = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) keys.push(`${r}_${c}`);
  return keys;
}
