// Offline renderer: headless Chromium draws each frame by number, the pixels
// are read back and piped into ffmpeg as raw RGBA. Workers render contiguous
// chunks in parallel; the chunks are joined and the soundtrack is muxed in.
//
//   node tools/render.mjs                         # 1920x1080, 60 fps, H.264 + audio
//   node tools/render.mjs --stills 0,1.2,2.6,4,6  # JPEG stills at those seconds
//   node tools/render.mjs --sheet 0.5              # contact sheet, one still every 0.5 s
//   options: --page v1.html (first version)  --workers N  --crf 16  --out output/file.mp4  --audio output/soundtrack.wav
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };

async function loadPlaywright() {
  const candidates = ['playwright', path.join(ROOT, '..', 'school-construction-film', 'node_modules', 'playwright', 'index.mjs')];
  for (const c of candidates) {
    try { return await import(c.startsWith('/') ? `file://${c}` : c); } catch { /* next */ }
  }
  throw new Error('playwright not found: run npm install');
}

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return 'ffmpeg'; } catch { /* fall through */ }
  return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.setDefaultTimeout(0);
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [page]', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/${arg('page', 'index.html')}?mode=render`);
  await page.waitForFunction('window.LOGO_READY === true || window.LOGO_ERROR');
  const err = await page.evaluate('window.LOGO_ERROR');
  if (err) throw new Error(err);
  return page;
}

async function main() {
  const { chromium } = await loadPlaywright();
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--disable-gpu', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  const ff = findFfmpeg();
  try {
    const stills = arg('stills', null), sheet = arg('sheet', null);
    if (stills || sheet) {
      const dir = path.join(ROOT, 'output', 'stills');
      fs.mkdirSync(dir, { recursive: true });
      const page = await openPage(browser, port);
      const fps = await page.evaluate('LOGO.fps');
      const times = stills ? stills.split(',').map(Number) : Array.from({ length: Math.floor(15 / Number(sheet)) + 1 }, (_, i) => i * Number(sheet));
      for (const s of times) {
        const f = Math.min(899, Math.round(s * fps));
        const t0 = Date.now();
        await page.evaluate((i) => LOGO.render(i), f);
        const url = await page.evaluate(() => LOGO.grabJPEG(0.9));
        const name = `t${s.toFixed(2).padStart(5, '0')}.jpg`;
        fs.writeFileSync(path.join(dir, name), Buffer.from(url.split(',')[1], 'base64'));
        console.log(`  ${name} ${Date.now() - t0} ms`);
      }
      return;
    }

    const W = 1920, H = 1080;
    const page0 = await openPage(browser, port);
    const { frames, fps, events } = await page0.evaluate('({ frames: LOGO.frames, fps: LOGO.fps, events: LOGO.events })');
    fs.mkdirSync(path.join(ROOT, 'output'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'output', 'events.json'), JSON.stringify(events, null, 1));
    const from = Number(arg('from', 0)), to = Number(arg('to', frames));
    const workers = Number(arg('workers', 3));
    const crf = arg('crf', '16');
    const out = path.resolve(ROOT, arg('out', 'output/de-paul-kinetic_1920x1080_60fps.mp4'));
    const tmp = path.join(ROOT, 'output', 'chunks');
    fs.mkdirSync(tmp, { recursive: true });
    const per = Math.ceil((to - from) / workers);
    const pages = [page0];
    for (let w = 1; w < workers; w++) pages.push(await openPage(browser, port));
    const started = Date.now();
    let done = 0;
    const chunk = async (w) => {
      const a = from + w * per, b = Math.min(to, a + per);
      const file = path.join(tmp, `chunk${w}.mp4`);
      const enc = spawn(ff, ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-x264-params', 'keyint=60', file], { stdio: ['pipe', 'inherit', 'inherit'] });
      const closed = new Promise((res, rej) => enc.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}`)))));
      for (let f = a; f < b; f++) {
        const b64 = await pages[w].evaluate((i) => { LOGO.render(i); return LOGO.grab(); }, f);
        const buf = Buffer.from(b64, 'base64');
        if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
        done++;
        if (done % 30 === 0) {
          const el = (Date.now() - started) / 1000;
          console.log(`  ${done}/${to - from} frames  ${(el / done).toFixed(2)} s/frame  eta ${Math.round((el / done) * (to - from - done))} s`);
        }
      }
      enc.stdin.end();
      await closed;
      return file;
    };
    const files = await Promise.all(pages.map((_, w) => chunk(w)));
    const list = path.join(tmp, 'list.txt');
    fs.writeFileSync(list, files.map((f) => `file '${f}'`).join('\n'));
    const audio = arg('audio', path.join(ROOT, 'output', 'soundtrack.wav'));
    const joinArgs = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
    if (fs.existsSync(audio) && !argv.includes('--mute')) joinArgs.push('-i', audio, '-c:a', 'aac', '-b:a', '256k', '-shortest');
    joinArgs.push('-c:v', 'copy', '-movflags', '+faststart', out);
    execFileSync(ff, joinArgs, { stdio: 'inherit' });
    console.log(`wrote ${out} in ${Math.round((Date.now() - started) / 1000)} s`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
