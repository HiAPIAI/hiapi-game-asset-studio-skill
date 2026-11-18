#!/usr/bin/env node
// run-plan.mjs: one plan file → every asset, through HiAPI, in dependency order, resumable.
//   node scripts/run-plan.mjs plan.json [--out=assets] [--dry-run] [--only=id1,id2] [--redo=id1] [--concurrency=4]
// A plan is { "style": "...", "assets": [ {id, type, ...}, ... ] }. Types:
//   image   prompt, [ref: [ids]], [aspect_ratio], [resolution 1K|2K|4K], [background transparent|opaque|auto], [model]
//           The plan's "style" is appended to every image prompt, so the whole pack shares one look. With ref, the
//           referenced assets are sent as reference images (image-to-image), which keeps characters on model.
//   file    path: a local image (your logo, a sketch, a character you already have) to use as a ref; no API call
//   cutout  from: id            → transparent PNG (background removal)
//   music   prompt, [lyrics], [instrumental: true]
//   voice   text, [voice], [instruction], [lang]
//   video   prompt, [from: image id (first frame)], [duration 4-15], [resolution 480p|720p], [aspect_ratio], [audio]
// Output: <out>/<id>.<ext> and <out>/manifest.json (task ids, hosted URLs, cost estimate). Assets already in the
// manifest are skipped, so a crash or an edit costs only the missing ones. --dry-run prints the cost and the payloads.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { dataUri, download, flags, pollTask, submitTask } from './hiapi.mjs';

const IMG = 'gpt-image-2.5-sunburst', PRICE = { image: { '1K': .05, '2K': .08, '4K': .12 }, cutout: .002, music: .21, voicePer1k: .04, videoPerSec: { '480p': .0843, '720p': .1772 } };
const RATIOS = ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9', '27:16', '16:27', '9:8', '8:9'];
export function plan2tasks(plan) {
  const ids = new Set(), byId = {};
  for (const a of plan.assets || []) {
    if (!a.id || ids.has(a.id)) throw new Error(`asset ids must be present and unique (${a.id})`);
    ids.add(a.id); byId[a.id] = a;
    if (!['file', 'image', 'cutout', 'music', 'voice', 'video'].includes(a.type)) throw new Error(`${a.id}: unknown type ${a.type}`);
    for (const d of deps(a)) if (!plan.assets.some(b => b.id === d)) throw new Error(`${a.id}: depends on unknown asset ${d}`);
    if (a.type === 'file' && !a.path) throw new Error(`${a.id}: file needs a path`);
    if (a.type === 'image' && !a.prompt) throw new Error(`${a.id}: image needs a prompt`);
    if (a.type === 'image' && a.aspect_ratio && !RATIOS.includes(a.aspect_ratio)) throw new Error(`${a.id}: aspect_ratio must be one of ${RATIOS.join(' ')}`);
    if (a.type === 'image' && a.background === 'transparent' && a.resolution && a.resolution !== '1K') throw new Error(`${a.id}: transparent background works only at 1K`);
    if (a.type === 'video' && a.duration && (a.duration < 4 || a.duration > 15)) throw new Error(`${a.id}: video duration must be 4-15 s`);
  }
  return byId;
}
export const deps = a => [...(a.ref || []), ...(a.from ? [a.from] : [])];
export function cost(a) {
  if (a.type === 'file') return 0;
  if (a.type === 'image') return PRICE.image[a.resolution || '1K'];
  if (a.type === 'cutout') return PRICE.cutout;
  if (a.type === 'music') return PRICE.music;
  if (a.type === 'voice') return Math.max(1, a.text.length) / 1000 * PRICE.voicePer1k;
  if (a.type === 'video') return (a.duration || 5) * PRICE.videoPerSec[a.resolution || '720p'];
  return 0;
}
// the HiAPI request for one asset; done = manifest entries of finished assets (for references)
export function request(a, plan, done, outDir) {
  const ref = id => done[id]?.url && Date.now() / 1000 < (done[id].expireAt || 0) - 3600 ? done[id].url : dataUri(join(outDir, done[id].file));
  if (a.type === 'image') {
    const prompt = [a.prompt, plan.style].filter(Boolean).join('\n\nArt direction: ');
    const common = { prompt, aspect_ratio: a.aspect_ratio || '1:1', resolution: a.resolution || '1K', ...(a.background ? { background: a.background } : {}) };
    if (a.ref?.length) return { model: (a.model || IMG) + '/image-to-image', input: { ...common, image_urls: a.ref.map(ref) } };
    return { model: (a.model || IMG) + '/text-to-image', input: common };
  }
  if (a.type === 'cutout') { if (!done[a.from].url) throw new Error(`${a.id}: cutout needs a generated (hosted) image, not a local file`); return { model: '851-labs/background-remover', input: { image_url: done[a.from].url } }; }
  if (a.type === 'music') return { model: 'minimax-music-2.6', input: { prompt: a.prompt, ...(a.instrumental ? { is_instrumental: true } : { lyrics: a.lyrics }), audio_format: 'mp3' } };
  if (a.type === 'voice') return { model: 'qwen-audio-3.0-tts-plus', input: { text: a.text, voice: a.voice || 'longanlingxin', format: 'mp3', ...(a.instruction ? { instruction: a.instruction } : {}), ...(a.lang ? { language_hints: [a.lang] } : {}) } };
  if (a.type === 'video') return { model: 'seedance-2.0-fast', input: { prompt: a.prompt, resolution: a.resolution || '720p', duration: a.duration || 5, aspect_ratio: a.aspect_ratio || '16:9',
    generate_audio: a.audio ?? true, ...(a.from ? { first_frame_url: done[a.from].url } : {}) } };
}

async function main() {
  const f = flags(), file = f._[0];
  if (!file) { console.error('usage: run-plan.mjs plan.json [--out=assets] [--dry-run] [--only=a,b] [--redo=a] [--concurrency=4]'); process.exit(1); }
  const plan = JSON.parse(readFileSync(file, 'utf8')), byId = plan2tasks(plan), out = f.out || 'assets';
  mkdirSync(out, { recursive: true });
  const mf = join(out, 'manifest.json'), M = existsSync(mf) ? JSON.parse(readFileSync(mf, 'utf8')) : { assets: {} };
  for (const id of String(f.redo || '').split(',').filter(Boolean)) delete M.assets[id];
  let want = Object.keys(byId);
  if (f.only) { const need = new Set(), add = id => { if (need.has(id)) return; need.add(id); deps(byId[id]).forEach(add); }; String(f.only).split(',').forEach(add); want = want.filter(id => need.has(id)); }
  const todo = want.filter(id => !M.assets[id]);
  const total = todo.reduce((s, id) => s + cost(byId[id]), 0);
  console.log(`${todo.length} to make, ${want.length - todo.length} already done · estimated cost $${total.toFixed(2)} (list prices; check https://www.hiapi.ai/en/pricing)`);
  if (f['dry-run']) { for (const id of todo) { const a = byId[id], r = a.type === 'file' ? { model: '(local file ' + a.path + ')' } : deps(a).every(d => M.assets[d]) ? request(a, plan, M.assets, out) : { model: '(after ' + deps(a).join(', ') + ')' }; console.log(`- ${id} [${a.type}] $${cost(a).toFixed(3)} → ${r.model}`); } return; }
  const save = () => writeFileSync(mf, JSON.stringify(M, null, 1));
  const running = new Set(), failed = new Set(), conc = +(f.concurrency || 4);
  const ready = id => !M.assets[id] && !running.has(id) && !failed.has(id) && deps(byId[id]).every(d => M.assets[d]);
  const blocked = id => deps(byId[id]).some(d => failed.has(d) || blocked(d));
  async function make(id) {
    const a = byId[id];
    if (a.type === 'file') { if (!existsSync(a.path)) throw new Error(`${id}: ${a.path} not found`); copyFileSync(a.path, join(out, id + extname(a.path))); M.assets[id] = { file: id + extname(a.path), type: 'file', cost: 0 }; save(); return; }
    const req = request(a, plan, M.assets, out), t0 = Date.now();
    console.log(`→ ${id} [${a.type}] ${req.model}`);
    const task = await submitTask(req.model, req.input), d = await pollTask(task);
    if (d.status !== 'success') throw new Error(`${id}: task ${task} failed: ${JSON.stringify(d.error || d.failReason || d).slice(0, 300)}`);
    const o = (d.output || []).find(x => x.url); if (!o) throw new Error(`${id}: task ${task} returned no output`);
    const ext = (o.url.split('?')[0].split('.').pop() || 'bin').slice(0, 4).toLowerCase(), name = `${id}.${ext}`;
    await download(o.url, join(out, name));
    M.assets[id] = { file: name, type: a.type, model: req.model, task, url: o.url, expireAt: o.expireAt, cost: cost(a), seconds: Math.round((Date.now() - t0) / 1000) }; save();
    console.log(`✓ ${id} → ${join(out, name)} (${M.assets[id].seconds}s)`);
  }
  await new Promise(resolve => {
    const pump = () => {
      for (const id of want) if (running.size < conc && ready(id)) {
        running.add(id);
        make(id).catch(e => { failed.add(id); console.error(`✗ ${e.message}`); }).finally(() => { running.delete(id); pump(); });
      }
      if (!running.size) resolve();
    };
    pump();
  });
  const miss = want.filter(id => !M.assets[id]);
  console.log(miss.length ? `${miss.length} not made: ${miss.map(id => id + (failed.has(id) ? ' (failed)' : blocked(id) ? ' (blocked)' : '')).join(', ')}` : `all ${want.length} assets ready in ${out}/`);
  process.exit(miss.length ? 1 : 0);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
