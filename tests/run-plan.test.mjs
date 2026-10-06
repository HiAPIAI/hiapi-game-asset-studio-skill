import assert from 'node:assert/strict';
import test from 'node:test';
import { cost, deps, plan2tasks, request } from '../scripts/run-plan.mjs';

const plan = { style: 'pixel art', assets: [
  { id: 'key', type: 'image', prompt: 'a lighthouse', aspect_ratio: '16:9' },
  { id: 'hero', type: 'image', prompt: 'a cat', ref: ['key'], background: 'transparent' },
  { id: 'cut', type: 'cutout', from: 'hero' },
  { id: 'bgm', type: 'music', prompt: 'chiptune', instrumental: true },
  { id: 'clip', type: 'video', prompt: 'waves', from: 'key', duration: 8 },
] };
const done = { key: { url: 'https://x/key.png', expireAt: Date.now() / 1000 + 86400 }, hero: { url: 'https://x/hero.png', expireAt: Date.now() / 1000 + 86400 } };

test('validates ids, dependencies and options', () => {
  assert.ok(plan2tasks(plan));
  assert.throws(() => plan2tasks({ assets: [{ id: 'a', type: 'image', prompt: 'x', ref: ['nope'] }] }), /unknown asset nope/);
  assert.throws(() => plan2tasks({ assets: [{ id: 'a', type: 'image', prompt: 'x', aspect_ratio: '4:5' }] }), /aspect_ratio/);
  assert.throws(() => plan2tasks({ assets: [{ id: 'a', type: 'image', prompt: 'x', background: 'transparent', resolution: '2K' }] }), /transparent/);
  assert.throws(() => plan2tasks({ assets: [{ id: 'a', type: 'video', prompt: 'x', duration: 30 }] }), /4-15/);
});
test('style is appended and refs become image-to-image', () => {
  const r = request(plan.assets[1], plan, done, '.');
  assert.equal(r.model, 'gpt-image-2.5-sunburst/image-to-image');
  assert.match(r.input.prompt, /a cat[\s\S]*pixel art/);
  assert.deepEqual(r.input.image_urls, ['https://x/key.png']);
  assert.equal(request(plan.assets[0], plan, {}, '.').model, 'gpt-image-2.5-sunburst/text-to-image');
});
test('other asset types map to the right models', () => {
  assert.equal(request(plan.assets[2], plan, done, '.').input.image_url, 'https://x/hero.png');
  assert.deepEqual(request(plan.assets[3], plan, done, '.').input, { prompt: 'chiptune', is_instrumental: true, audio_format: 'mp3' });
  const v = request(plan.assets[4], plan, done, '.');
  assert.equal(v.model, 'seedance-2.0-fast'); assert.equal(v.input.first_frame_url, 'https://x/key.png'); assert.equal(v.input.duration, 8);
});
test('cost and dependencies', () => {
  assert.equal(cost(plan.assets[0]), .05); assert.equal(cost(plan.assets[3]), .21);
  assert.ok(Math.abs(cost(plan.assets[4]) - 8 * .1772) < 1e-9);
  assert.deepEqual(deps(plan.assets[1]), ['key']);
});
