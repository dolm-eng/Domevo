import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWS, DECORS, DEFAULT_VIEWS, buildPrompt } from '../src/prompts.js';

process.env.PROVIDER = 'mock';
const { server, parseDataUrl } = await import('../server.js');

let base;
before(async () => {
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('les vues par défaut existent', () => {
  for (const v of DEFAULT_VIEWS) assert.ok(VIEWS[v], v);
});

test('buildPrompt combine règles, vue, décor et note', () => {
  const p = buildPrompt('dos', 'bois', '  sweat oversize ');
  assert.match(p, /EXACTLY this same item/);
  assert.match(p, /BACK/);
  assert.match(p, /oak/);
  assert.match(p, /sweat oversize/);
  assert.throws(() => buildPrompt('nope', 'studio'));
  assert.throws(() => buildPrompt('face', 'nope'));
});

test('parseDataUrl refuse les formats non image', () => {
  assert.equal(parseDataUrl(TINY_PNG).mimeType, 'image/png');
  assert.throws(() => parseDataUrl('data:text/html;base64,AAAA'));
  assert.throws(() => parseDataUrl('pas une image'));
});

test('GET /api/config expose vues et décors', async () => {
  const cfg = await (await fetch(`${base}/api/config`)).json();
  assert.equal(cfg.provider, 'mock');
  assert.deepEqual(Object.keys(cfg.decors), Object.keys(DECORS));
  assert.deepEqual(Object.keys(cfg.views), Object.keys(VIEWS));
});

test('POST /api/generate renvoie une image', async () => {
  const res = await fetch(`${base}/api/generate`, {
    method: 'POST',
    body: JSON.stringify({ image: TINY_PNG, view: 'face', decor: 'studio' }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.view, 'face');
  assert.match(json.image, /^data:image\/png;base64,/);
});

test('POST /api/generate valide les entrées', async () => {
  const bad = await fetch(`${base}/api/generate`, {
    method: 'POST',
    body: JSON.stringify({ image: TINY_PNG, view: 'x', decor: 'studio' }),
  });
  assert.equal(bad.status, 400);
  const badImg = await fetch(`${base}/api/generate`, { method: 'POST', body: JSON.stringify({ image: 'x', view: 'face', decor: 'studio' }) });
  assert.equal(badImg.status, 400);
});

test('les fichiers statiques sont servis sans sortir de public/', async () => {
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Vinted Studio/);
  const escape = await fetch(`${base}/..%2Fserver.js`);
  assert.notEqual(escape.status, 200);
});
