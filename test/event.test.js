import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/event.js';

function setup(body, { binding = true } = {}) {
  const points = [];
  const env = binding ? { EVENTS: { writeDataPoint: (p) => points.push(p) } } : {};
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const request = new Request('https://x.test/api/event', { method: 'POST', body: raw });
  return { points, call: () => onRequestPost({ request, env, waitUntil() {} }) };
}

test('valid event returns 204 and records one data point', async () => {
  const { points, call } = setup({ type: 'delivery_click', target: 'doordash', page: 'home' });
  assert.equal((await call()).status, 204);
  assert.deepEqual(points, [{ blobs: ['delivery_click', 'doordash', 'home'], doubles: [1], indexes: ['delivery_click'] }]);
});

test('invalid type is rejected without writing', async () => {
  const { points, call } = setup({ type: 'nope', target: '', page: 'home' });
  assert.equal((await call()).status, 400);
  assert.equal(points.length, 0);
});

test('unknown page is recorded as other', async () => {
  const { points, call } = setup({ type: 'result_shown', target: '', page: 'weird' });
  assert.equal((await call()).status, 204);
  assert.deepEqual(points[0].blobs, ['result_shown', '', 'other']);
});

test('target on a non-delivery type is rejected', async () => {
  const { points, call } = setup({ type: 'website_click', target: 'doordash', page: 'gems' });
  assert.equal((await call()).status, 400);
  assert.equal(points.length, 0);
});

test('delivery click needs a known target', async () => {
  const { call } = setup({ type: 'delivery_click', target: '', page: 'home' });
  assert.equal((await call()).status, 400);
});

test('body over 1 KB is rejected', async () => {
  const { points, call } = setup({ type: 'result_shown', target: '', page: 'home', pad: 'x'.repeat(2000) });
  assert.equal((await call()).status, 400);
  assert.equal(points.length, 0);
});

test('malformed JSON is rejected', async () => {
  assert.equal((await setup('{oops').call()).status, 400);
});

test('missing EVENTS binding still returns 204', async () => {
  const { call } = setup({ type: 'result_shown', target: '', page: 'home' }, { binding: false });
  assert.equal((await call()).status, 204);
});
