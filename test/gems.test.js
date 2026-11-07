import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, resolvePick, nearestCity } from '../public/js/lib/gems.js';

const city = { lat: 43.65, lng: -79.38, radiusKm: 5 };
const place = (id, name, lat = 43.65, lng = -79.38) => ({ id, name, lat, lng });

test('normalizeName strips accents, punctuation and case', () => {
  assert.equal(normalizeName("  Café  Le  P'tit "), 'cafe le ptit');
  assert.equal(normalizeName('天皇名粥'), '');
});

test('exact match beats prefix match', () => {
  const places = [place('n1', 'Pizza Palace Deluxe'), place('n2', 'Pizza Palace', 43.66)];
  assert.equal(resolvePick({ name: 'Pizza Palace' }, places, city).id, 'n2');
});

test('prefix match works both ways', () => {
  assert.equal(resolvePick({ name: 'Pizza Palace' }, [place('n1', 'Pizza Palace Yonge')], city).id, 'n1');
  assert.equal(resolvePick({ name: 'Pizza Palace Yonge' }, [place('n1', 'Pizza Palace')], city).id, 'n1');
});

test('nearest candidate to the centre wins', () => {
  const places = [place('n1', 'Noodle Bar', 43.69), place('n2', 'Noodle Bar', 43.652)];
  assert.equal(resolvePick({ name: 'Noodle Bar' }, places, city).id, 'n2');
});

test('places outside radius + margin are ignored', () => {
  assert.equal(resolvePick({ name: 'Noodle Bar' }, [place('n1', 'Noodle Bar', 44.5)], city), null);
});

test('names that normalise to nothing never match everything', () => {
  const places = [place('n1', '天皇名粥'), place('n2', 'Real Place')];
  assert.equal(resolvePick({ name: '天皇名粥' }, places, city), null);
});

test('short candidate names are ignored', () => {
  assert.equal(resolvePick({ name: 'Pizza Palace' }, [place('n1', 'Piz')], city), null);
});

test('osmId pins the place regardless of name or distance', () => {
  const places = [place('w9', 'Something Else', 44.9), place('n2', 'Pizza Palace')];
  assert.equal(resolvePick({ name: 'Pizza Palace', osmId: 'w9' }, places, city).id, 'w9');
  assert.equal(resolvePick({ name: 'Pizza Palace', osmId: 'w404' }, places, city), null);
});

test('nearestCity picks the closest centre', () => {
  const cities = [{ slug: 'a', lat: 43, lng: -79 }, { slug: 'b', lat: 45, lng: -75 }];
  assert.equal(nearestCity(cities, 44.9, -75.1).slug, 'b');
});
