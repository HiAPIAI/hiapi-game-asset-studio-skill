#!/usr/bin/env node
// gallery.mjs: an asset folder (manifest.json from run-plan.mjs) → gallery.html to review the whole pack at once:
// images on a checkerboard (so transparency shows), audio players, the video, and each asset's cost and model.
//   node scripts/gallery.mjs <assets dir> [--title="My game"]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { flags } from './hiapi.mjs';
const f = flags(), dir = f._[0];
if (!dir) { console.error('usage: gallery.mjs <assets dir> [--title=...]'); process.exit(1); }
const M = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')).assets, esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const items = Object.entries(M), total = items.reduce((s, [, a]) => s + (a.cost || 0), 0);
const card = ([id, a]) => {
  const media = a.type === 'video' ? `<video src="${a.file}" controls muted loop playsinline></video>`
    : ['music', 'voice'].includes(a.type) ? `<div class="aud">♪</div><audio src="${a.file}" controls></audio>`
    : `<div class="img"><img src="${a.file}" alt="${esc(id)}"></div>`;
  return `<figure class="${a.type}">${media}<figcaption><b>${esc(id)}</b><span>${esc(a.model || a.type)} · $${(a.cost || 0).toFixed(3)}</span></figcaption></figure>`;
};
writeFileSync(join(dir, 'gallery.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(f.title || 'Asset pack')}</title>
<style>body{margin:0;background:#12151c;color:#e8e6e1;font:15px/1.5 system-ui,sans-serif}main{max-width:1240px;margin:0 auto;padding:32px 20px}
h1{margin:0 0 4px}p{opacity:.7;margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
figure{margin:0;background:#1b2029;border-radius:14px;overflow:hidden}.video,.image:has(img[src*="key_art"]){grid-column:span 2}
.img{background:repeating-conic-gradient(#2a303b 0 25%,#222831 0 50%) 0 0/20px 20px;display:flex;align-items:center;justify-content:center;aspect-ratio:16/10}
.img img{max-width:100%;max-height:100%;image-rendering:pixelated}video{width:100%;display:block}.aud{font-size:64px;text-align:center;padding:30px 0 10px;opacity:.5}
audio{width:calc(100% - 24px);margin:0 12px 8px}figcaption{padding:10px 14px;display:flex;justify-content:space-between;gap:8px;font-size:13px}figcaption span{opacity:.55}
@media(max-width:640px){.video{grid-column:auto}}</style><main><h1>${esc(f.title || 'Asset pack')}</h1>
<p>${items.length} assets · about $${total.toFixed(2)} at list prices · made through HiAPI</p><div class="grid">${items.map(card).join('')}</div></main>`);
console.log('wrote', join(dir, 'gallery.html'));
