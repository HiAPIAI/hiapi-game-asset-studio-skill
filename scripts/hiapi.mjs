// hiapi.mjs: the small HiAPI client the scripts share (Node 18+, no dependencies).
// The key comes from HIAPI_API_KEY (or a .env next to the skill); it is never printed or written to disk.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function dotenv(name) {
  const f = join(root, '.env');
  if (!existsSync(f)) return undefined;
  const hit = readFileSync(f, 'utf8').split('\n').map(l => l.trim()).find(l => l.startsWith(name + '='));
  return hit ? hit.slice(name.length + 1).replace(/^["']|["']$/g, '') : undefined;
}
export const BASE = (process.env.HIAPI_BASE_URL || dotenv('HIAPI_BASE_URL') || 'https://api.hiapi.ai').replace(/\/$/, '');
export function apiKey() {
  const k = process.env.HIAPI_API_KEY || dotenv('HIAPI_API_KEY');
  if (!k || k === 'your_hiapi_api_key') throw new Error('HIAPI_API_KEY is required: create one at https://www.hiapi.ai/en/dashboard/api-keys');
  return k;
}
const HINT = { 400: 'check the parameters against the model page', 401: 'check the API key', 403: 'check the API key', 402: 'top up the HiAPI balance', 429: 'rate limited: wait and retry' };
async function call(method, path, body, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + path, { method, body: body === undefined ? undefined : JSON.stringify(body),
        headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' } });
      const text = await res.text();
      if (res.ok) return JSON.parse(text);
      last = new Error(`HiAPI ${method} ${path} → HTTP ${res.status}${HINT[res.status] ? ` (${HINT[res.status]})` : ''}: ${text.slice(0, 500)}`);
      if (res.status < 500 && res.status !== 429) throw last;     // a bad request is not retried
    } catch (e) { last = e; if (/HTTP 4(0[0-3]|04)/.test(e.message)) throw e; }
    await new Promise(r => setTimeout(r, 3000 * (i + 1)));
  }
  throw last;
}
// The unified async task API: submit once, then poll until success | fail.
export async function submitTask(model, input) {
  const r = await call('POST', '/v1/tasks', { model, input }, 1);   // never re-submit a paid task blindly
  const id = r?.data?.taskId;
  if (!id) throw new Error('HiAPI returned no taskId: ' + JSON.stringify(r).slice(0, 300));
  return id;
}
export async function pollTask(id, { everyMs = 6000, timeoutMs = 20 * 60000 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const d = (await call('GET', `/v1/tasks/${id}`)).data;
    if (d.status === 'success' || d.status === 'fail') return d;
    if (Date.now() - t0 > timeoutMs) throw new Error(`task ${id} still ${d.status}; check GET /v1/tasks/${id} later`);
    await new Promise(r => setTimeout(r, everyMs));
  }
}
export async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} → HTTP ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}
// A local image as a data URI (accepted by the GPT Image 2.5 mode routes as a reference image).
export function dataUri(file) {
  const t = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp' }[extname(file).toLowerCase()];
  if (!t) throw new Error(`unsupported image type: ${file}`);
  return `data:image/${t};base64,` + readFileSync(file).toString('base64');
}
export function flags(argv = process.argv.slice(2)) {
  const o = { _: [] };
  for (const a of argv) { if (!a.startsWith('--')) { o._.push(a); continue; } const [k, ...v] = a.slice(2).split('='); o[k] = v.length ? v.join('=') : true; }
  return o;
}
