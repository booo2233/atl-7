// Offline, deterministic film renderer.
// Launches headless Chromium (software WebGL works; a GPU is faster), loads
// the film in render mode, steps through every frame by number, reads the
// pixels back and pipes raw RGBA into ffmpeg (H.264, yuv420p).
//
//   node tools/render.mjs --preset preview            # 1280x720 draft
//   node tools/render.mjs --preset final              # 3840x2160 UHD
//   node tools/render.mjs --stills 0,0.1,0.5,1 --w 1920 --h 1080
//   options: --workers N  --from F --to F  --camera CAM_1  --ao 0  --msaa 4  --out file.mp4
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const PRESETS = {
  preview: { w: 1280, h: 720, ao: 1, msaa: 4, crf: 20 },
  hd: { w: 1920, h: 1080, ao: 1, msaa: 4, crf: 17 },
  final: { w: 3840, h: 2160, ao: 1, msaa: 0, smaa: 1, crf: 16 },
};
const preset = PRESETS[arg('preset', 'preview')] || PRESETS.preview;
const W = Number(arg('w', preset.w)), H = Number(arg('h', preset.h));
const AO = arg('ao', String(preset.ao)), MSAA = arg('msaa', String(preset.msaa));
const CRF = arg('crf', String(preset.crf));
const CAMERA = arg('camera', '');
const WORKERS = Number(arg('workers', 1));
const OUT = path.resolve(ROOT, arg('out', `output/film_${W}x${H}.mp4`));
const STILLS = arg('stills', null);
const STEP = Number(arg('step', 1));   // render every Nth frame (quick previews)
const STILL_DIR = path.resolve(ROOT, arg('stilldir', 'output/stills'));

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return 'ffmpeg'; } catch { /* fall through */ }
  try {
    return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
  } catch { throw new Error('ffmpeg not found: set FFMPEG=/path/to/ffmpeg or pip install imageio-ffmpeg'); }
}

async function openFilm(port) {
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog',
      '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--js-flags=--max-old-space-size=8192'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(0);
  page.on('console', (m) => { const t = m.text(); if (!t.includes('GPU stall') && !t.includes('GL Driver')) console.log('  [page]', t); });
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  const q = new URLSearchParams({ mode: 'render', w: W, h: H, ao: AO, msaa: MSAA, smaa: arg('smaa', String(preset.smaa ?? 0)) });
  if (CAMERA) q.set('camera', CAMERA);
  if (argv.includes('--no-captions')) q.set('captions', '0');
  for (const k of ['tm', 'exp', 'fog', 'hemi', 'env', 'sun']) if (arg(k)) q.set(k, arg(k));
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}`);
  await page.waitForFunction('window.FILM_READY === true || window.FILM_ERROR', null, { timeout: 0 });
  const err = await page.evaluate('window.FILM_ERROR');
  if (err) throw new Error(err);
  return { browser, page };
}

async function renderStills(port) {
  fs.mkdirSync(STILL_DIR, { recursive: true });
  const { browser, page } = await openFilm(port);
  const info = await page.evaluate('({ frames: FILM_API.frameCount, build: FILM_API.buildMs })');
  console.log(`film ready: ${info.frames} frames, built in ${Math.round(info.build)} ms`);
  for (const tok of STILLS.split(',')) {
    const T = tok.includes('f') ? (Number(tok.replace('f', '')) - 1) / (info.frames - 1) : Number(tok);
    const t0 = Date.now();
    const cam = await page.evaluate((t) => FILM_API.renderT(t), T);
    const url = await page.evaluate(() => FILM_API.grabJPEG(0.93));
    const name = `still_T${T.toFixed(3)}_f${String(Math.round(T * (info.frames - 1)) + 1).padStart(3, '0')}${CAMERA ? `_${CAMERA}` : ''}${arg('tag') ? `_${arg('tag')}` : ''}.jpg`;
    fs.writeFileSync(path.join(STILL_DIR, name), Buffer.from(url.split(',')[1], 'base64'));
    console.log(`  ${name}  (${cam}, ${Date.now() - t0} ms)`);
  }
  await browser.close();
}

async function renderRange(port, from, to, outFile, tag) {
  const ff = findFfmpeg();
  const { browser, page } = await openFilm(port);
  const fps = await page.evaluate('FILM_API.fps');
  const enc = spawn(ff, ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps / STEP), '-i', '-',
    '-vf', 'vflip', '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  const started = Date.now();
  for (let i = from; i <= to; i += STEP) {
    const r = await page.evaluate((f) => FILM_API.renderFrame(f), i);
    const b64 = await page.evaluate(() => FILM_API.grab());
    const buf = Buffer.from(b64, 'base64');
    if (!enc.stdin.write(buf)) await new Promise((res) => enc.stdin.once('drain', res));
    const done = Math.floor((i - from) / STEP) + 1, total = Math.floor((to - from) / STEP) + 1;
    const eta = ((Date.now() - started) / done) * (total - done) / 1000;
    if (done % 10 === 0 || done === total) {
      console.log(`${tag} frame ${i + 1} (${done}/${total})  ${Math.round(r.ms)} ms render  cam=${r.camera}  visible=${r.visible}  ETA ${Math.round(eta / 60)} min`);
    }
  }
  enc.stdin.end();
  await new Promise((res, rej) => enc.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exit ${c}`)))));
  await browser.close();
}

const server = await startServer(0);
const port = server.address().port;
try {
  if (STILLS) {
    await renderStills(port);
  } else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    const probe = await openFilm(port);
    const frames = await probe.page.evaluate('FILM_API.frameCount');
    const validation = await probe.page.evaluate('FILM_API.validation');
    await probe.browser.close();
    console.log(`rendering ${W}x${H}, ${frames} frames, validation:`, validation.problems.map((p) => `${p.check}=${p.count}`).join(' '));
    const from = Number(arg('from', 0)), to = Number(arg('to', frames - 1));
    if (WORKERS <= 1) {
      await renderRange(port, from, to, OUT, 'w0');
    } else {
      const n = to - from + 1, per = Math.ceil(n / WORKERS);
      const parts = [];
      const jobs = [];
      for (let k = 0; k < WORKERS; k++) {
        const a = from + k * per, b = Math.min(to, a + per - 1);
        if (a > b) break;
        const seg = OUT.replace(/\.mp4$/, `.part${k}.mp4`);
        parts.push(seg);
        jobs.push(renderRange(port, a, b, seg, `w${k}`));
      }
      await Promise.all(jobs);
      const list = OUT.replace(/\.mp4$/, '.parts.txt');
      fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
      execFileSync(findFfmpeg(), ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', OUT]);
      for (const p of parts) fs.unlinkSync(p);
      fs.unlinkSync(list);
    }
    console.log('wrote', OUT);
  }
} finally {
  server.close();
}
