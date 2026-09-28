// Entry point. Two modes:
//  * player (default): real-time interactive playback with timeline, camera
//    switching and a free orbit camera.
//  * render (?mode=render&w=3840&h=2160): no UI, fixed resolution, exposes a
//    deterministic frame API used by tools/render.mjs to capture the film.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Film } from './film/film.js';
import { FILM, PHASES } from './config.js';
import { CAMERAS, EDIT } from './film/cameras.js';
import { CAPTIONS } from './film/hud.js';

const q = new URLSearchParams(location.search);
const mode = q.get('mode') || 'player';
const statusEl = document.getElementById('status');
const log = (m) => { if (statusEl) statusEl.textContent = `Building… ${m}`; };

async function startRender() {
  const w = Number(q.get('w') || FILM.width), h = Number(q.get('h') || FILM.height);
  const canvas = document.getElementById('film');
  canvas.width = w; canvas.height = h;
  canvas.style.width = `${Math.min(w, 1280)}px`;
  const film = new Film(canvas, {
    width: w, height: h, ao: q.get('ao') !== '0', msaa: Number(q.get('msaa') ?? 4), smaa: q.get('smaa') === '1', captions: q.get('captions') !== '0',
  });
  if (q.get('camera')) film.cameraMode = q.get('camera');
  await film.init(log);
  applyLookOverrides(film);
  const gl = film.renderer.getContext();
  const px1 = new Uint8Array(4);
  window.FILM_API = {
    frameCount: film.frameCount, fps: film.fps, width: w, height: h,
    validation: film.validation,
    buildMs: film.buildMs,
    renderFrame(i) {
      const t0 = performance.now();
      film.renderFrame(i);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1); // sync
      return { ms: performance.now() - t0, camera: film.lastCamera, visible: film.runtime.visibleCount };
    },
    renderT(T) { film.renderT(T); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1); return film.lastCamera; },
    // raw RGBA, bottom-up rows, base64 encoded
    grab() {
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let s = '';
      const CH = 0x8000;
      for (let i = 0; i < buf.length; i += CH) s += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
      return btoa(s);
    },
    grabJPEG(qual = 0.92) { return canvas.toDataURL('image/jpeg', qual); },
    stats() { const i = film.renderer.info; return { calls: i.render.calls, triangles: i.render.triangles, forest: film.env.counts, elements: film.elements.length }; },
  };
  if (statusEl) statusEl.remove();
  window.FILM_READY = true;
}

// Optional look-development overrides (?tm=aces&exp=1&fog=0.0016&hemi=0.4&env=0.7&sun=3)
function applyLookOverrides(film) {
  const TM = { aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping };
  if (q.get('tm')) film.renderer.toneMapping = TM[q.get('tm')];
  if (q.get('exp')) film.renderer.toneMappingExposure = Number(q.get('exp'));
  if (q.get('fog')) film.scene.fog.density = Number(q.get('fog'));
  if (q.get('hemi')) film.env.hemi.intensity = Number(q.get('hemi'));
  if (q.get('env')) film.scene.environmentIntensity = Number(q.get('env'));
  if (q.get('sun')) film.env.sun.intensity = Number(q.get('sun'));
  if (q.get('shadow')) { film.renderer.shadowMap.type = q.get('shadow') === 'pcf' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap; film.renderer.shadowMap.needsUpdate = true; }
}

async function startPlayer() {
  const canvas = document.getElementById('film');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = () => [Math.floor(window.innerWidth * dpr), Math.floor(window.innerHeight * dpr)];
  const [w, h] = size();
  canvas.width = w; canvas.height = h;
  const film = new Film(canvas, { width: w, height: h, ao: q.get('ao') !== '0', msaa: 4, captions: true });
  await film.init(log);
  if (statusEl) statusEl.remove();

  const free = new THREE.PerspectiveCamera(35, w / h, 0.5, 12000);
  free.position.set(60, 45, 80);
  const controls = new OrbitControls(free, canvas);
  controls.target.set(-2, 6, -12);
  controls.enableDamping = true;

  // UI ---------------------------------------------------------------------------
  const ui = document.getElementById('ui');
  ui.hidden = false;
  const play = document.getElementById('play'), scrub = document.getElementById('scrub');
  const timeEl = document.getElementById('time'), phaseEl = document.getElementById('phase');
  const camSel = document.getElementById('camera'), speedSel = document.getElementById('speed');
  const capChk = document.getElementById('captions'), lenInput = document.getElementById('length');
  for (const [k, v] of Object.entries(CAMERAS)) camSel.add(new Option(v.label, k));
  camSel.add(new Option('Free orbit camera', 'free'));
  lenInput.value = FILM.seconds;

  let playing = true, T = 0, last = performance.now();
  play.onclick = () => { playing = !playing; play.textContent = playing ? 'Pause' : 'Play'; last = performance.now(); };
  scrub.oninput = () => { T = Number(scrub.value) / 1000; };
  camSel.onchange = () => { film.cameraMode = camSel.value; };
  capChk.onchange = () => { film.hud.enabled = capChk.checked; };
  lenInput.onchange = () => { FILM.seconds = Math.max(8, Math.min(180, Number(lenInput.value) || 30)); };
  window.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); play.onclick(); } });
  window.addEventListener('resize', () => {
    const [nw, nh] = size();
    film.resize(nw, nh); free.aspect = nw / nh; free.updateProjectionMatrix();
  });

  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (playing) { T += (dt * Number(speedSel.value)) / FILM.seconds; if (T > 1) T = 0; }
    controls.update();
    film.renderT(T, { freeCamera: free });
    scrub.value = String(Math.round(T * 1000));
    const s = T * FILM.seconds;
    timeEl.textContent = `${s.toFixed(1)} s / ${FILM.seconds} s · frame ${Math.round(T * (film.frameCount - 1)) + 1}`;
    const cap = CAPTIONS.find((c) => T >= c.from && T < c.to);
    const shot = EDIT.find((e) => T >= e.from && T < e.to);
    phaseEl.textContent = `${cap ? `${cap.n} ${cap.title}` : 'Completed'} · ${film.runtime.visibleCount} elements standing · ${film.cameraMode === 'edit' ? CAMERAS[shot.cam].label : camSel.selectedOptions[0].text}`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.film = film;
  void PHASES;
}

(mode === 'render' ? startRender() : startPlayer()).catch((err) => {
  console.error(err);
  if (statusEl) statusEl.textContent = `Error: ${err.message}`;
  window.FILM_ERROR = String(err.stack || err);
});
