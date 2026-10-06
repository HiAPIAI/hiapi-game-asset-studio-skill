// record.mjs: plays play.html?demo deterministically in headless Chrome → gameplay.mp4 with the level music. Needs puppeteer-core (npm i puppeteer-core) and ffmpeg.
import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 960, height: 540 });
await p.goto('file://' + process.cwd() + '/play.html?demo'); await p.evaluate(() => window.ready);
rmSync('frames', { recursive: true, force: true }); mkdirSync('frames');
const N = 30 * 14;
for (let i = 0; i < N; i++) { const d = await p.evaluate(() => { window.step(1 / 30); return document.getElementById('c').toDataURL('image/png'); }); writeFileSync(`frames/f${String(i).padStart(4, '0')}.png`, Buffer.from(d.split(',')[1], 'base64')); }
await b.close();
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '30', '-i', 'frames/f%04d.png', '-i', 'assets/bgm_level.mp3', '-map', '0:v', '-map', '1:a', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-af', 'afade=t=out:st=12.5:d=1.5', process.env.OUT || 'gameplay.mp4']);
console.log('wrote demo.mp4');
