import test from 'node:test';
import assert from 'node:assert/strict';
import { tileKey, tilesForRadius } from '../public/js/lib/tiles.js';

test('tileKey for positive and negative coordinates', () => {
  assert.equal(tileKey(43.85, -79.45), '438_-795');
  assert.equal(tileKey(43.8, -79.5), '438_-795', 'cell boundary belongs to the upper cell');
  assert.equal(tileKey(-33.87, 151.21), '-339_1512');
});

test('small radius inside one cell returns one key', () => {
  assert.deepEqual(tilesForRadius(43.85, -79.45, 1), ['438_-795']);
});

test('radius spanning cell borders returns every touched cell', () => {
  // 0.1 deg lat is ~11.1 km: 6 km from 43.80 reaches both 437 and 438 rows.
  const keys = tilesForRadius(43.8, -79.45, 6);
  assert.ok(keys.includes('437_-795') && keys.includes('438_-795'));
  assert.ok(keys.every((k) => k.startsWith('437_') || k.startsWith('438_') || k.startsWith('439_')));
  assert.equal(new Set(keys).size, keys.length);
  // A 20 km circle at 45N covers a 4x5-ish block, always including the centre cell.
  const big = tilesForRadius(45.0, -75.0, 20);
  assert.ok(big.includes(tileKey(45.0, -75.0)));
  assert.ok(big.length >= 16);
});
