// De Paul Public School — crest build-out.
// A 15 s motion-graphics logo reveal drawn with Canvas 2D. Every frame is a
// pure function of its frame number, so the piece plays the same in real time
// and when it is rendered offline, frame by frame.
//
// Story: a point of light becomes a gold wire globe that spins and fills with
// glass and continents; a spark orbits it, spirals out and becomes the comet
// that draws the red ring; the ring bursts and throws the seven stars, which
// arc round and lock into place; the laurels grow up the ring, the book opens,
// the shield grows out from inside, the emblems ignite, the ribbon unfurls,
// the lettering pops on, the banner drops in, the globe spins down and the
// crest locks up under a light sweep.

export const FPS = 60;
export const SECONDS = 15;
export const FRAMES = FPS * SECONDS;
export const WIDTH = 1920;
export const HEIGHT = 1080;

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const S = 0.68; // logo px -> screen px at camera zoom 1

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const smooth = (a, b, x) => { const t = inv(a, b, x); return t * t * (3 - 2 * t); };
const bump = (a, b, x) => { const t = inv(a, b, x); return Math.sin(Math.PI * t); };
const ease = {
  outCubic: (t) => 1 - (1 - t) ** 3,
  outQuart: (t) => 1 - (1 - t) ** 4,
  outQuint: (t) => 1 - (1 - t) ** 5,
  inCubic: (t) => t * t * t,
  inQuad: (t) => t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
};

// deterministic hash -> [0, 1)
function hash(n) {
  let x = Math.imul((n | 0) ^ 0x5bd1e995, 0x9e3779b1);
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
const rnd = (i, k = 0) => hash(i * 7919 + k * 104729 + 1013);

// ---------------------------------------------------------------------------
// Timeline (seconds). Sound design reads the same table (exported below).
// ---------------------------------------------------------------------------
const T = {
  flash: 0.12,
  globeIn: [0.18, 1.15],
  meridians: 0.24,
  parallels: 0.42,
  glass: [0.78, 1.55],
  land: [0.98, 1.95],
  orbit: [0.34, 1.25],
  ring: [1.25, 2.3],
  burst: 2.3,
  laurelL: [2.9, 4.15],
  laurelR: [3.0, 4.25],
  book: [3.2, 3.85],
  shield: [3.8, 4.85],
  torchCircle: [4.5, 5.15],
  ringsCircle: [4.6, 5.25],
  torch: [4.8, 5.2],
  torchFlame: [5.05, 5.5],
  olympic: 4.95,
  lamp: [5.1, 5.45],
  lampFlame: [5.3, 5.75],
  ribbon: [5.3, 6.25],
  ribbonLetters: 5.8,
  banner: [6.25, 6.9],
  bannerLetters: 6.95,
  raj: 7.3,
  pill: [7.48, 7.95],
  orn: [7.62, 8.3],
  spin: [0.18, 9.0],
  swap: [8.95, 9.45],
  sweep: [9.35, 10.45],
  rays: [9.3, 10.6],
  twinkle: 10.1,
  sweep2: [12.8, 13.9],
};
const STAR_LAUNCH = { 1: 2.3, 0: 2.34, 2: 2.34, 6: 2.46, 3: 2.46, 5: 2.58, 4: 2.58 };
const STAR_FLIGHT = 0.62;
const OLYMPIC_ORDER = ['oring_blue', 'oring_yellow', 'oring_black', 'oring_green', 'oring_red'];
const IMPACTS = [[4.42, 5], [6.72, 6]]; // camera shake: [time, amplitude px]
const GLOBE_LON = -44 * DEG; // the logo's globe faces the Atlantic
const GLOBE_LAT = 11 * DEG;
const SPIN_TURNS = 2.5;

export const EVENTS = (() => {
  const ev = [
    { t: 0.0, kind: 'riser', dur: 0.5 },
    { t: T.flash, kind: 'flash' },
    { t: T.orbit[0], kind: 'orbit', dur: T.orbit[1] - T.orbit[0] },
    { t: T.ring[0], kind: 'comet', dur: T.ring[1] - T.ring[0] },
    { t: T.burst, kind: 'burst' },
    { t: T.laurelL[0], kind: 'rustle', dur: 1.3 },
    { t: T.book[0], kind: 'flutter', dur: 0.6 },
    { t: T.shield[0], kind: 'swell', dur: 0.62 },
    { t: IMPACTS[0][0], kind: 'boom' },
    { t: T.torchFlame[0], kind: 'ignite' },
    { t: T.lampFlame[0], kind: 'ignite' },
    { t: T.ribbon[0], kind: 'unfurl', dur: 0.9 },
    { t: T.banner[0], kind: 'drop', dur: 0.45 },
    { t: IMPACTS[1][0], kind: 'thud' },
    { t: T.pill[0], kind: 'pop' },
    { t: T.swap[0] + 0.2, kind: 'chime' },
    { t: T.sweep[0], kind: 'shine', dur: 1.1 },
    { t: T.sweep2[0], kind: 'shimmer', dur: 1.0 },
  ];
  for (const [i, t0] of Object.entries(STAR_LAUNCH)) ev.push({ t: t0 + STAR_FLIGHT * 0.86, kind: 'star', i: Number(i) });
  for (let i = 0; i < 18; i++) ev.push({ t: T.ribbonLetters + i * 0.042 + 0.06, kind: 'tick', i });
  for (let i = 0; i < 14; i++) ev.push({ t: T.bannerLetters + i * 0.036 + 0.06, kind: 'tick', i: i + 20 });
  for (let i = 0; i < 8; i++) ev.push({ t: T.raj + i * 0.045, kind: 'tick', i: i + 40 });
  for (let i = 0; i < 5; i++) ev.push({ t: T.olympic + i * 0.08 + 0.08, kind: 'ping', i });
  for (let i = 0; i < 7; i++) ev.push({ t: T.twinkle + i * 0.14, kind: 'twinkle', i });
  return ev.sort((a, b) => a.t - b.t);
})();

// ---------------------------------------------------------------------------

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

async function loadImage(src) {
  const im = new Image();
  im.src = src;
  await im.decode();
  return im;
}

function pixels(img, w = img.width, h = img.height) {
  const c = mk(w, h);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  return g.getImageData(0, 0, w, h).data;
}

// soft round sprite, used for every glow and spark
function sprite(rgb, size = 128, hard = 0.0) {
  const c = mk(size, size);
  const g = c.getContext('2d');
  const r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(clamp(0.12 + hard), `rgba(${rgb},0.7)`);
  gr.addColorStop(0.35, `rgba(${rgb},0.22)`);
  gr.addColorStop(0.65, `rgba(${rgb},0.06)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

export async function createLogo(canvas, { base = new URL('../assets/layers/', import.meta.url).href, readback = false } = {}) {
  const M = await (await fetch(`${base}manifest.json`)).json();
  const img = {};
  await Promise.all(Object.keys(M.layers).map(async (n) => { img[n] = await loadImage(`${base}${n}.png`); }));
  const landImg = await loadImage(`${base}globe_land.png`);
  const noiseImg = await loadImage(`${base}globe_noise.png`);
  const TW = landImg.width, TH = landImg.height;
  const land = pixels(landImg);
  const NW = noiseImg.width, NH = noiseImg.height;
  const noise = pixels(noiseImg);

  const W = WIDTH, H = HEIGHT;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: readback });
  const crestCv = mk(W, H), cg = crestCv.getContext('2d');
  const fxCv = mk(W, H), fg = fxCv.getContext('2d');
  const bloomA = mk(W / 2, H / 2), bga = bloomA.getContext('2d');
  const bloomB = mk(W / 8, H / 8), bgb = bloomB.getContext('2d');
  const raysCv = mk(W / 4, H / 4), rg = raysCv.getContext('2d');
  for (const g of [ctx, cg, fg]) { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; }

  const RING = M.ring, GL = M.globe;
  const RED = `rgb(${RING.color.join(',')})`;
  const PURPLE = `rgb(${M.torchCircle.color.join(',')})`;

  const SPR = {
    white: sprite('255,255,255'),
    warm: sprite('255,236,196'),
    gold: sprite('255,196,92'),
    fire: sprite('255,120,40'),
    red: sprite('255,60,40'),
    green: sprite('190,255,140'),
    blue: sprite('150,200,255'),
    core: sprite('255,255,255', 64, 0.35),
  };

  // shield shadow and glow: blurred silhouettes at quarter resolution
  const SL = M.layers.shield;
  const PAD = 64;
  const silhouette = (rgb, blur) => {
    const w = (SL.w + PAD * 2) / 4, h = (SL.h + PAD * 2) / 4;
    const a = mk(w, h), ag = a.getContext('2d');
    ag.drawImage(img.shield, PAD / 4, PAD / 4, SL.w / 4, SL.h / 4);
    ag.globalCompositeOperation = 'source-in';
    ag.fillStyle = `rgb(${rgb})`;
    ag.fillRect(0, 0, w, h);
    const b = mk(w, h), bg = b.getContext('2d');
    bg.filter = `blur(${blur}px)`;
    bg.drawImage(a, 0, 0);
    return b;
  };
  const shieldShadow = silhouette('0,0,0', 6);
  const shieldGlow = silhouette('190,220,255', 9);
  const shieldScratch = mk(SL.w + PAD * 2, SL.h + PAD * 2);

  const scratches = {};
  const scratch = (key, w, h) => {
    const c = scratches[key] || (scratches[key] = mk(w, h));
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, c.width, c.height);
    return [c, g];
  };

  // ---- camera -------------------------------------------------------------
  function camera(t) {
    const a = ease.outCubic(inv(0, 2.5, t));
    const b = ease.inOutCubic(inv(2.1, 4.9, t));
    const c = ease.inOutSine(inv(4.9, 15, t));
    const lz = Math.log(3.0) + (Math.log(2.1) - Math.log(3.0)) * a
      + (Math.log(0.965) - Math.log(2.1)) * b + (Math.log(1.045) - Math.log(0.965)) * c;
    const zoom = Math.exp(lz);
    const fx = lerp(GL.cx, 591, b);
    const fy = lerp(GL.cy + 12 * a, 666, b);
    const rot = -0.085 * (1 - ease.inOutCubic(inv(0, 4.9, t)));
    let sx = 0, sy = 0;
    for (const [t0, amp] of IMPACTS) {
      const d = t - t0;
      if (d > 0 && d < 0.7) {
        const k = amp * Math.exp(-d * 8);
        sx += k * Math.sin(d * 83 + t0 * 7);
        sy += k * Math.cos(d * 67 + t0 * 3);
      }
    }
    return { zoom, fx, fy, rot, sx, sy, k: S * zoom };
  }
  const applyCam = (g, cam) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(W / 2 + cam.sx, H / 2 + cam.sy);
    g.rotate(cam.rot);
    g.scale(cam.k, cam.k);
    g.translate(-cam.fx, -cam.fy);
  };
  const project = (cam, x, y) => {
    const dx = (x - cam.fx) * cam.k, dy = (y - cam.fy) * cam.k;
    const c = Math.cos(cam.rot), s = Math.sin(cam.rot);
    return { x: W / 2 + cam.sx + dx * c - dy * s, y: H / 2 + cam.sy + dx * s + dy * c };
  };

  // ---- drawing helpers (logo coordinates) ---------------------------------
  function layer(g, name, o = {}) {
    const L = M.layers[name];
    const a = o.alpha ?? 1;
    const sx = o.sx ?? o.s ?? 1, sy = o.sy ?? o.s ?? 1;
    if (a <= 0.002 || Math.abs(sx) < 1e-4 || Math.abs(sy) < 1e-4) return;
    const ox = o.ox ?? L.x + L.w / 2, oy = o.oy ?? L.y + L.h / 2;
    g.save();
    g.globalAlpha = a;
    g.translate(ox + (o.dx || 0), oy + (o.dy || 0));
    if (o.rot) g.rotate(o.rot);
    if (o.skew) g.transform(1, 0, o.skew, 1, 0, 0);
    g.scale(sx, sy);
    const src = o.src || img[name];
    const pad = o.pad || 0;
    g.drawImage(src, L.x - ox - pad, L.y - oy - pad, L.w + pad * 2, L.h + pad * 2);
    g.restore();
  }

  function spr(g, key, x, y, r, a, sx = 1, sy = 1, rot = 0) {
    if (a <= 0.003 || r <= 0.01) return;
    g.save();
    g.globalAlpha = Math.min(1, a);
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.scale(sx, sy);
    g.drawImage(SPR[key], -r, -r, r * 2, r * 2);
    g.restore();
  }

  function streak(g, x0, y0, x1, y1, w, color, a) {
    if (a <= 0.003) return;
    g.globalAlpha = Math.min(1, a);
    g.strokeStyle = color;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }

  function shockwave(g, x, y, r, w, color, a) {
    if (a <= 0.003 || r <= 0) return;
    g.save();
    g.globalAlpha = Math.min(1, a);
    g.strokeStyle = color;
    g.lineWidth = w;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.stroke();
    g.restore();
  }

  // ---- globe --------------------------------------------------------------
  const globeScale = (t) => {
    const u = inv(T.globeIn[0], T.globeIn[1], t);
    return u <= 0 ? 0 : ease.outBack(u, 2.2);
  };
  const spinLon = (t) => GLOBE_LON + SPIN_TURNS * TAU * (1 - ease.outCubic(inv(T.spin[0], T.spin[1], t)));
  const tiltLat = (t) => {
    const d = Math.max(0, t - T.spin[0]);
    return GLOBE_LAT + 26 * DEG * Math.exp(-1.25 * d) * Math.sin(2.3 * d + 0.35);
  };
  const MERID_T = (k) => T.meridians + 0.021 * ((k * 7) % 24);
  const PARAL_T = (j) => T.parallels + 0.055 * Math.abs(j);

  const GMAX = 760;
  const globeCv = mk(GMAX, GMAX);
  const gctx = globeCv.getContext('2d');
  const gimg = gctx.createImageData(GMAX, GMAX);
  const gdat = gimg.data;

  // screen position of a point on the globe (lon/lat in radians), or null if on the far side
  function globePoint(t, cam, lon, lat) {
    const gs = globeScale(t);
    const c = project(cam, GL.cx, GL.cy);
    const R = GL.r * cam.k * gs;
    const l0 = spinLon(t), la0 = tiltLat(t);
    const x1 = Math.cos(lat) * Math.sin(lon - l0), y1 = Math.sin(lat), z1 = Math.cos(lat) * Math.cos(lon - l0);
    const Y = y1 * Math.cos(la0) - z1 * Math.sin(la0);
    const Z = y1 * Math.sin(la0) + z1 * Math.cos(la0);
    if (Z < 0.05) return null;
    const cr = Math.cos(cam.rot), sr = Math.sin(cam.rot);
    const px = x1 * R, py = -Y * R;
    return { x: c.x + px * cr - py * sr, y: c.y + px * sr + py * cr, z: Z };
  }

  function renderGlobe(t, cam) {
    const gs = globeScale(t);
    if (gs <= 0.004) return null;
    const c = project(cam, GL.cx, GL.cy);
    const R = GL.r * cam.k * gs;
    const half = Math.min(GMAX / 2 - 1, Math.ceil(R + 3));
    const size = half * 2;
    const ox = Math.floor(c.x) - half, oy = Math.floor(c.y) - half;
    const cr = Math.cos(cam.rot), sr = Math.sin(cam.rot);
    const lon0 = spinLon(t), lat0 = tiltLat(t);
    const cl0 = Math.cos(lat0), sl0 = Math.sin(lat0);
    const glassA = ease.inOutSine(inv(T.glass[0], T.glass[1], t));
    const landP = inv(T.land[0], T.land[1], t);
    const wiresDone = t > 1.35;
    // rotation during one frame (180 degree shutter) for motion blur of the spin
    const dLon = spinLon(t - 0.5 / FPS) - lon0;
    const nS = Math.abs(dLon) * R > 1.2 ? 3 : 1;
    const wHalf = Math.max(0.75, R * 0.0135);
    const LX = -0.46, LY = 0.56, LZ = 0.69; // key light, view space (y up)
    let HX = LX, HY = LY, HZ = LZ + 1;
    const hl = Math.hypot(HX, HY, HZ); HX /= hl; HY /= hl; HZ /= hl;
    const edge2 = ((R + 1.5) / R) ** 2;
    const toDeg = 1 / DEG;
    const merVis = new Float32Array(24), parVis = new Float32Array(11), parStart = new Float32Array(11);
    for (let k = 0; k < 24; k++) merVis[k] = 180 * ease.outCubic(inv(MERID_T(k), MERID_T(k) + 0.5, t));
    for (let j = 0; j < 11; j++) {
      parVis[j] = 360 * ease.outCubic(inv(PARAL_T(j - 5), PARAL_T(j - 5) + 0.55, t));
      parStart[j] = (j * 137) % 360;
    }

    // wire coverage for a globe-frame point; returns [coverage, across]
    const wires = (x1, y1, z1, lonOff) => {
      const lat = Math.asin(y1 < -1 ? -1 : y1 > 1 ? 1 : y1);
      const rr = Math.sqrt(x1 * x1 + z1 * z1) || 1e-6;
      const sLr = x1 / rr, cLr = z1 / rr;
      const cosLat = rr, sinLat = y1;
      const latD = lat * toDeg;
      const lonD = (Math.atan2(x1, z1) + lon0 + lonOff) * toDeg;
      // meridians every 15 degrees
      let mRel = lonD % 15; if (mRel < 0) mRel += 15;
      const mD = mRel < 7.5 ? mRel : 15 - mRel;
      const tE = Math.sqrt(cLr * cLr + sLr * sLr * sl0 * sl0);
      const mPx = R * cosLat * mD * DEG * tE;
      let covM = clamp(wHalf + 0.5 - mPx) * smooth(86, 77, Math.abs(latD));
      if (covM > 0 && !wiresDone) {
        let k = Math.round((lonD - (mRel < 7.5 ? mRel : mRel - 15)) / 15) % 24; if (k < 0) k += 24;
        covM *= clamp((merVis[k] - (90 - latD)) / 5 + 0.5);
      }
      // parallels every 15 degrees, -75..75
      let pRel = latD % 15; if (pRel < 0) pRel += 15;
      const pD = pRel < 7.5 ? pRel : 15 - pRel;
      const nx = -sinLat * sLr, ny = cosLat * cl0 + sinLat * cLr * sl0;
      const pPx = R * pD * DEG * Math.sqrt(nx * nx + ny * ny);
      let covP = Math.abs(latD) < 82 ? clamp(wHalf + 0.5 - pPx) : 0;
      if (covP > 0 && !wiresDone) {
        const j = Math.round((latD - (pRel < 7.5 ? pRel : pRel - 15)) / 15) + 5;
        if (j < 0 || j > 10) covP = 0;
        else {
          let a = (lonD - parStart[j]) % 360; if (a < 0) a += 360;
          covP *= clamp((parVis[j] - a) / 6 + 0.5);
        }
      }
      if (covM >= covP) return [covM, mPx / wHalf];
      return [covP, pPx / wHalf];
    };

    for (let j = 0; j < size; j++) {
      const py = oy + j + 0.5 - c.y;
      let o = j * GMAX * 4;
      for (let i = 0; i < size; i++, o += 4) {
        const px = ox + i + 0.5 - c.x;
        const X = (px * cr + py * sr) / R;
        const Y = -(-px * sr + py * cr) / R;
        const d2 = X * X + Y * Y;
        if (d2 > edge2) { gdat[o + 3] = 0; continue; }
        const edgeA = clamp((1 - Math.sqrt(d2)) * R + 0.5);
        const Z = Math.sqrt(Math.max(0, 1 - d2));
        const ndl = Math.max(0, X * LX + Y * LY + Z * LZ);
        let r = 0, g = 0, b = 0, a = 0;

        // far-side wires seen through the glass
        {
          const y1 = Y * cl0 - Z * sl0, z1 = -Y * sl0 - Z * cl0;
          const [cov] = wires(X, y1, z1, 0);
          if (cov > 0) {
            const al = cov * (0.62 - 0.3 * glassA);
            r = 150 * al; g = 104 * al; b = 36 * al; a = al;
          }
        }
        // glass sphere
        if (glassA > 0) {
          const sh = 0.28 + 0.72 * ndl;
          const oR = lerp(58, 206, sh), oG = lerp(92, 226, sh), oB = lerp(140, 248, sh);
          const al = glassA * 0.9;
          r = oR * al + r * (1 - al); g = oG * al + g * (1 - al); b = oB * al + b * (1 - al); a = al + a * (1 - al);
        }
        // front point in the globe frame
        const y1 = Y * cl0 + Z * sl0, z1 = -Y * sl0 + Z * cl0, x1 = X;
        if (landP > 0) {
          const lat = Math.asin(y1 < -1 ? -1 : y1 > 1 ? 1 : y1);
          const lr = Math.atan2(x1, z1);
          let lr0 = 0, lg0 = 0, lb0 = 0, la0s = 0;
          const v = (0.5 - lat / Math.PI) * TH - 0.5;
          const y0 = v < 0 ? 0 : Math.min(TH - 2, Math.floor(v));
          const fy = clamp(v - y0);
          for (let s = 0; s < nS; s++) {
            const lon = lr + lon0 + (nS > 1 ? (dLon * s) / (nS - 1) : 0);
            let u = ((lon / TAU + 0.5) % 1) * TW - 0.5; if (u < 0) u += TW;
            const x0 = Math.floor(u), fx = u - x0, x1i = (x0 + 1) % TW;
            const i00 = (y0 * TW + (x0 % TW)) * 4, i10 = (y0 * TW + x1i) * 4;
            const i01 = i00 + TW * 4, i11 = i10 + TW * 4;
            const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
            const A00 = land[i00 + 3] * w00, A10 = land[i10 + 3] * w10, A01 = land[i01 + 3] * w01, A11 = land[i11 + 3] * w11;
            lr0 += land[i00] * A00 + land[i10] * A10 + land[i01] * A01 + land[i11] * A11;
            lg0 += land[i00 + 1] * A00 + land[i10 + 1] * A10 + land[i01 + 1] * A01 + land[i11 + 1] * A11;
            lb0 += land[i00 + 2] * A00 + land[i10 + 2] * A10 + land[i01 + 2] * A01 + land[i11 + 2] * A11;
            la0s += A00 + A10 + A01 + A11;
          }
          if (la0s > 0.5) {
            let la = la0s / (255 * nS);
            const lr1 = lr0 / la0s, lg1 = lg0 / la0s, lb1 = lb0 / la0s;
            let glow = 0;
            if (landP < 1) {
              let nu = ((lr + lon0) / TAU + 0.5) % 1; if (nu < 0) nu += 1;
              const nv = Math.min(NH - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * NH)));
              const n = noise[(nv * NW + Math.floor(nu * NW) % NW) * 4] / 255;
              const th = landP * 1.35 - 0.2;
              la *= clamp((th - n) * 9);
              glow = Math.max(0, 1 - Math.abs(th - n - 0.06) * 14);
            }
            const sh = 0.42 + 0.78 * ndl;
            const cr0 = lr1 * sh + glow * 255, cg0 = lg1 * sh + glow * 190, cb0 = lb1 * sh + glow * 70;
            r = cr0 * la + r * (1 - la); g = cg0 * la + g * (1 - la); b = cb0 * la + b * (1 - la); a = la + a * (1 - la);
          }
        }
        // front wires, with motion blur on the meridians while the globe spins fast
        {
          let cov = 0, across = 0;
          for (let s = 0; s < nS; s++) {
            const w = wires(x1, y1, z1, nS > 1 ? (dLon * s) / (nS - 1) : 0);
            cov += w[0]; across += w[1] * w[0];
          }
          cov /= nS;
          if (cov > 0) {
            across = across / (cov * nS);
            const prof = 1 - 0.45 * Math.min(1, across * across);
            const sh = (0.38 + 0.95 * ndl) * prof;
            const spec = Math.pow(Math.max(0, X * HX + Y * HY + Z * HZ), 18) * 0.8;
            const wr = 214 * sh + 255 * spec, wg = 158 * sh + 236 * spec, wb = 52 * sh + 160 * spec;
            r = wr * cov + r * (1 - cov); g = wg * cov + g * (1 - cov); b = wb * cov + b * (1 - cov); a = cov + a * (1 - cov);
          }
        }
        // glass sheen: specular hot spot and a cool fresnel rim
        if (glassA > 0) {
          const hv = Math.max(0, X * HX + Y * HY + Z * HZ);
          const spec = Math.pow(hv, 90) * 210 + Math.pow(hv, 10) * 22;
          const fr = (1 - Z) ** 3;
          r += (spec + fr * 70) * glassA; g += (spec + fr * 110) * glassA; b += (spec + fr * 150) * glassA;
          a = Math.max(a, glassA * fr * 0.5);
        }
        r *= edgeA; g *= edgeA; b *= edgeA; a *= edgeA;
        if (a > 0.002) {
          gdat[o] = r / a; gdat[o + 1] = g / a; gdat[o + 2] = b / a; gdat[o + 3] = a * 255;
        } else gdat[o + 3] = 0;
      }
    }
    gctx.putImageData(gimg, 0, 0, 0, 0, size, size);
    return { x: ox, y: oy, size };
  }

  // ---- comet --------------------------------------------------------------
  // angle clockwise from +x (canvas convention). One orbit round the globe,
  // spiralling out, then one lap of the ring starting from the top.
  const cometAngle = (t) => {
    if (t <= T.ring[0]) return -Math.PI / 2 - TAU + TAU * inv(T.orbit[0], T.ring[0], t);
    const u = inv(T.ring[0], T.ring[1], t);
    const a = 0.16;
    return -Math.PI / 2 + TAU * (u + a * u * (1 - u));
  };
  function cometPos(t) {
    const th = cometAngle(t);
    const o = ease.inOutCubic(inv(0.82, T.ring[0], t));
    const rho = lerp(GL.r * 1.22, RING.r, o);
    const k = lerp(0.3, 1, o);
    const psi = lerp(-0.42, 0, o);
    const ex = rho * Math.cos(th), ey = rho * k * Math.sin(th);
    const x = RING.cx + lerp(GL.cx - RING.cx, 0, o) + ex * Math.cos(psi) - ey * Math.sin(psi);
    const y = RING.cy + lerp(GL.cy - RING.cy, 0, o) + ex * Math.sin(psi) + ey * Math.cos(psi);
    // on the far side of a tilted orbit and inside the globe's disc -> hidden
    const behind = Math.sin(th) < 0 && o < 0.98 && Math.hypot(x - GL.cx, y - GL.cy) < GL.r * globeScale(t) * 0.99;
    return { x, y, behind };
  }
  const ringSweep = (t) => (t <= T.ring[0] ? 0 : t >= T.ring[1] ? TAU : cometAngle(t) + Math.PI / 2);

  // ---- stars --------------------------------------------------------------
  function starPose(i, t) {
    const L = M.layers[`star${i}`];
    const t0 = STAR_LAUNCH[i];
    if (t < t0) return null;
    if (i === 1) {
      const u = inv(t0, t0 + 0.55, t);
      return { x: L.cx, y: L.cy, rot: -(1 - ease.outCubic(u)) * Math.PI * 1.2, s: ease.outElastic(u), u: 1, land: t0 + 0.05 };
    }
    const u = inv(t0, t0 + STAR_FLIGHT, t);
    const B = { x: RING.cx, y: RING.cy - RING.r };
    const ang = Math.atan2(L.cy - RING.cy, L.cx - RING.cx);
    const reach = RING.r * (i === 3 || i === 6 ? 1.95 : 1.75);
    const C = { x: RING.cx + Math.cos(ang - Math.sign(L.cx - RING.cx) * 0.35) * reach, y: RING.cy + Math.sin(ang - Math.sign(L.cx - RING.cx) * 0.35) * reach };
    const e = ease.outBack(ease.outQuart(u) * 0.985 + u * 0.015, 0.6);
    const x = (1 - e) * (1 - e) * B.x + 2 * e * (1 - e) * C.x + e * e * L.cx;
    const y = (1 - e) * (1 - e) * B.y + 2 * e * (1 - e) * C.y + e * e * L.cy;
    const dir = L.cx < RING.cx ? -1 : 1;
    const rot = dir * (1 - ease.outCubic(u)) * TAU * 1.5;
    const land = t0 + STAR_FLIGHT * 0.86;
    const dl = t - land;
    let s = lerp(0.35, 1, ease.outCubic(inv(0, 0.25, u))) * (1 + 0.55 * Math.sin(Math.PI * Math.min(1, u / 0.86)));
    if (dl > 0) s += 0.22 * Math.exp(-dl * 10) * Math.sin(dl * 30);
    return { x, y, rot, s, u, land };
  }

  // ---- ribbon / banner waves ---------------------------------------------
  const ribbonWave = (x, t) => {
    const d0 = t - T.ribbon[0];
    if (d0 <= 0 || d0 > 2.2) return 0;
    const dd = Math.abs(x - 591) / 580;
    return 15 * Math.exp(-2.6 * d0) * dd * Math.sin(dd * 7.5 - d0 * 15);
  };
  const bannerWave = (x, t) => {
    const d0 = t - T.banner[0];
    if (d0 <= 0 || d0 > 2) return 0;
    const dd = (x - 583) / 370;
    return 9 * Math.exp(-3 * d0) * Math.sin(dd * 5 - d0 * 17) * Math.abs(dd);
  };
  function bannerPose(t) {
    const u = inv(T.banner[0], T.banner[1], t);
    const dy = -560 * (1 - ease.outBack(u, 1.25));
    const d = Math.max(0, t - T.banner[0]);
    const rot = 0.2 * Math.exp(-3.6 * d) * Math.sin(9.5 * d);
    return { u, dy, rot, ox: 583, oy: 74 };
  }

  function stripDraw(g, im, L, waveAt, t, dx0, dy0, n) {
    const sw = L.w / n;
    for (let s = 0; s < n; s++) {
      const x = s * sw;
      const off = waveAt(L.x + x + sw / 2, t);
      g.drawImage(im, x, 0, sw + 1, L.h, dx0 + x, dy0 + off, sw + 1, L.h);
    }
  }

  // ---- crest --------------------------------------------------------------
  function drawShield(g, t) {
    const u = inv(T.shield[0], T.shield[1], t);
    if (u <= 0) return;
    const o = { x: 591, y: 600 };
    const drawBody = (h) => {
      h.globalAlpha = 0.62;
      h.drawImage(shieldShadow, SL.x - PAD, SL.y - PAD + 24, SL.w + PAD * 2, SL.h + PAD * 2);
      h.globalAlpha = 1;
      h.drawImage(img.shield, SL.x, SL.y);
    };
    if (u >= 1) { g.save(); drawBody(g); g.restore(); return; }
    const [sc, sg] = [shieldScratch, shieldScratch.getContext('2d')];
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalCompositeOperation = 'source-over';
    sg.clearRect(0, 0, sc.width, sc.height);
    sg.translate(PAD - SL.x, PAD - SL.y);
    drawBody(sg);
    sg.globalCompositeOperation = 'destination-in';
    const rad = lerp(0, 1120, ease.outCubic(u));
    const fe = 120;
    const gr = sg.createRadialGradient(o.x, o.y, Math.max(0, rad - fe), o.x, o.y, Math.max(1, rad));
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = gr;
    sg.fillRect(SL.x - PAD, SL.y - PAD, sc.width, sc.height);
    sg.globalCompositeOperation = 'source-over';
    const s = lerp(0.8, 1, ease.outBack(u, 1.5));
    g.save();
    g.translate(o.x, o.y);
    g.scale(s, s);
    g.translate(-o.x, -o.y);
    g.drawImage(sc, SL.x - PAD, SL.y - PAD);
    g.restore();
  }

  function drawRing(g, t) {
    const a = ringSweep(t);
    if (a <= 0.001) return;
    g.save();
    g.strokeStyle = RED;
    g.lineWidth = RING.width;
    g.beginPath();
    if (a >= TAU - 1e-4) g.arc(RING.cx, RING.cy, RING.r, 0, TAU);
    else { g.lineCap = 'round'; g.arc(RING.cx, RING.cy, RING.r, -Math.PI / 2, -Math.PI / 2 + a); }
    g.stroke();
    g.restore();
  }

  function laurelHead(side, t) {
    const [t0, t1] = side < 0 ? T.laurelL : T.laurelR;
    const u = inv(t0, t1, t);
    return { u, e: ease.inOutSine(u) * 0.35 + ease.outCubic(u) * 0.65 };
  }
  function drawLaurel(g, t, side) {
    const name = side < 0 ? 'laurelL' : 'laurelR';
    const { u, e } = laurelHead(side, t);
    if (u <= 0) return;
    const L = M.layers[name];
    const s = lerp(0.9, 1, ease.outCubic(u));
    if (u >= 1) { layer(g, name, { s, ox: L.baseX, oy: L.baseY }); return; }
    const [c, h] = scratch(name, L.w, L.h);
    h.drawImage(img[name], 0, 0);
    h.globalCompositeOperation = 'destination-in';
    const A0 = (side < 0 ? 100 : 80) * DEG, SPAN = 150 * DEG, F = 16 * DEG, M0 = 8 * DEG;
    const cx = RING.cx - L.x, cy = RING.cy - L.y;
    let gr;
    if (side < 0) {
      gr = h.createConicGradient(A0 - M0, cx, cy);
      const hd = (M0 + e * (SPAN + F)) / TAU;
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(clamp(hd - F / TAU), 'rgba(0,0,0,1)');
      gr.addColorStop(clamp(hd), 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      gr = h.createConicGradient(A0 + M0, cx, cy);
      const hd = (M0 + e * (SPAN + F)) / TAU;
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(clamp(1 - hd), 'rgba(0,0,0,0)');
      gr.addColorStop(clamp(1 - hd + F / TAU), 'rgba(0,0,0,1)');
      gr.addColorStop(1, 'rgba(0,0,0,1)');
    }
    h.fillStyle = gr;
    h.fillRect(0, 0, L.w, L.h);
    layer(g, name, { src: c, s, ox: L.baseX, oy: L.baseY });
  }

  function drawBook(g, t) {
    const u = inv(T.book[0], T.book[1], t);
    if (u <= 0) return;
    const L = M.layers.book, sp = L.spineX;
    const open = Math.sin(clamp(ease.outBack(u, 1.8), 0, 1.15) * Math.PI / 2);
    const lift = (1 - ease.outCubic(u)) * 26;
    for (const side of [-1, 1]) {
      g.save();
      g.globalAlpha = clamp(u * 5);
      g.beginPath();
      if (side < 0) g.rect(L.x - 200, L.y - 200, sp - L.x + 200, L.h + 400);
      else g.rect(sp, L.y - 200, L.w + 200, L.h + 400);
      g.clip();
      g.translate(sp, L.y + L.h + lift);
      g.scale(Math.max(0.002, open), lerp(0.8, 1, ease.outCubic(u)));
      g.translate(-sp, -(L.y + L.h));
      g.drawImage(img.book, L.x, L.y);
      g.restore();
    }
  }

  function circleArc(g, C, u, dir) {
    if (u <= 0) return;
    g.save();
    g.strokeStyle = PURPLE;
    g.lineWidth = C.width;
    g.beginPath();
    if (u >= 1) g.arc(C.cx, C.cy, C.r, 0, TAU);
    else {
      g.lineCap = 'round';
      const a0 = -Math.PI / 2;
      g.arc(C.cx, C.cy, C.r, a0, a0 + dir * TAU * u, dir < 0);
    }
    g.stroke();
    g.restore();
  }

  const flicker = (t, seed) => ({
    sy: 1 + 0.05 * Math.sin(t * 21.3 + seed) + 0.03 * Math.sin(t * 34.1 + seed * 2) + 0.018 * Math.sin(t * 57.7 + seed * 3),
    skew: 0.035 * Math.sin(t * 13.7 + seed) + 0.02 * Math.sin(t * 29.3 + seed * 5),
  });
  function drawFlame(g, name, t, [t0, t1], seed) {
    const u = inv(t0, t1, t);
    if (u <= 0) return;
    const L = M.layers[name];
    const f = flicker(t, seed);
    const s = ease.outBack(u, 2.4);
    layer(g, name, { ox: L.baseX, oy: L.baseY, sx: s * (1 - (f.sy - 1) * 0.5), sy: s * f.sy, skew: f.skew, alpha: clamp(u * 4) });
  }

  function drawEmblems(g, t) {
    circleArc(g, M.torchCircle, ease.inOutCubic(inv(T.torchCircle[0], T.torchCircle[1], t)), 1);
    circleArc(g, M.ringsCircle, ease.inOutCubic(inv(T.ringsCircle[0], T.ringsCircle[1], t)), -1);
    const th = inv(T.torch[0], T.torch[1], t);
    if (th > 0) layer(g, 'torchHolder', { dy: (1 - ease.outBack(th, 2)) * 34, alpha: clamp(th * 4) });
    drawFlame(g, 'torchFlame', t, T.torchFlame, 1.3);
    OLYMPIC_ORDER.forEach((n, i) => {
      const u = inv(T.olympic + i * 0.08, T.olympic + i * 0.08 + 0.42, t);
      if (u <= 0) return;
      const L = M.layers[n];
      layer(g, n, { s: ease.outBack(u, 2.6), rot: (1 - ease.outCubic(u)) * -0.9, ox: L.cx, oy: L.cy, alpha: clamp(u * 5) });
    });
    const lu = inv(T.lamp[0], T.lamp[1], t);
    if (lu > 0) {
      const L = M.layers.lamp;
      layer(g, 'lamp', { sx: ease.outBack(lu, 1.8), sy: lerp(0.6, 1, ease.outCubic(lu)), oy: L.y + L.h, alpha: clamp(lu * 5) });
    }
    drawFlame(g, 'lampFlame', t, T.lampFlame, 4.1);
  }

  function drawStars(g, t) {
    for (let i = 0; i < 7; i++) {
      const p = starPose(i, t);
      if (!p) continue;
      const L = M.layers[`star${i}`];
      // motion-blur ghosts while the star is travelling fast
      if (i !== 1 && p.u < 0.9) {
        for (let k = 4; k >= 1; k--) {
          const q = starPose(i, t - k * 0.0075);
          if (!q) continue;
          layer(g, `star${i}`, { dx: q.x - L.cx, dy: q.y - L.cy, rot: q.rot, s: q.s, ox: L.cx, oy: L.cy, alpha: 0.16 * (1 - k / 5) });
        }
      }
      layer(g, `star${i}`, { dx: p.x - L.cx, dy: p.y - L.cy, rot: p.rot, s: p.s, ox: L.cx, oy: L.cy, alpha: clamp((t - STAR_LAUNCH[i]) * 12) });
    }
  }

  function drawRibbon(g, t) {
    const u = inv(T.ribbon[0], T.ribbon[1], t);
    if (u <= 0) return;
    const L = M.layers.ribbon;
    const e = ease.outCubic(u);
    const VP = 24;
    const [c, h] = scratch('ribbon', L.w, L.h + VP * 2);
    stripDraw(h, img.ribbon, L, ribbonWave, t, 0, VP, 72);
    if (u < 1) {
      h.globalCompositeOperation = 'destination-in';
      const hw = e * 600, fe = 70, cx = 591 - L.x;
      const gr = h.createLinearGradient(cx - hw - fe, 0, cx + hw + fe, 0);
      const tot = 2 * (hw + fe);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(fe / tot, 'rgba(0,0,0,1)');
      gr.addColorStop(1 - fe / tot, 'rgba(0,0,0,1)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      h.fillStyle = gr;
      h.fillRect(0, 0, c.width, c.height);
    }
    const sy = lerp(0.55, 1, ease.outBack(u, 1.6));
    g.save();
    g.translate(591, 1030);
    g.scale(1, sy);
    g.translate(-591, -1030);
    g.drawImage(c, L.x, L.y - VP);
    g.restore();
    // lettering
    M.ribbonLetters.forEach((n, i) => {
      const t0 = T.ribbonLetters + i * 0.042;
      const v = inv(t0, t0 + 0.42, t);
      if (v <= 0) return;
      const Lt = M.layers[n];
      const k = ease.outCubic(v);
      layer(g, n, {
        ox: Lt.cx, oy: Lt.cy, s: ease.outBack(v, 2.8),
        dy: (1 - k) * 30 + ribbonWave(Lt.cx, t), rot: (1 - k) * (i % 2 ? 0.4 : -0.4), alpha: clamp(v * 6),
      });
    });
  }

  function drawBanner(g, t) {
    const p = bannerPose(t);
    if (p.u <= 0) return;
    const L = M.layers.banner;
    const VP = 16;
    const [c, h] = scratch('banner', L.w, L.h + VP * 2);
    stripDraw(h, img.banner, L, bannerWave, t, 0, VP, 48);
    g.save();
    g.translate(p.ox, p.oy + p.dy);
    g.rotate(p.rot);
    g.translate(-p.ox, -p.oy);
    g.globalAlpha = clamp(p.u * 6);
    g.drawImage(c, L.x, L.y - VP);
    g.globalAlpha = 1;
    M.bannerLetters.forEach((n, i) => {
      const t0 = T.bannerLetters + i * 0.036;
      const v = inv(t0, t0 + 0.4, t);
      if (v <= 0) return;
      const Lt = M.layers[n];
      layer(g, n, {
        ox: Lt.cx, oy: Lt.cy, s: lerp(1.6, 1, ease.outBack(v, 1.6)),
        dy: -(1 - ease.outBack(v, 2)) * 38 + bannerWave(Lt.cx, t), alpha: clamp(v * 4),
      });
    });
    g.restore();
  }

  function drawBase(g, t) {
    const order = M.rajLetters.map((n, i) => [n, i]).sort((a, b) => Math.abs(M.layers[a[0]].cx - 585) - Math.abs(M.layers[b[0]].cx - 585));
    order.forEach(([n], rank) => {
      const t0 = T.raj + rank * 0.045;
      const v = inv(t0, t0 + 0.5, t);
      if (v <= 0) return;
      const Lt = M.layers[n];
      const e = ease.outCubic(v);
      layer(g, n, { ox: Lt.cx, oy: Lt.cy, dx: (Lt.cx - 585) * 0.55 * (1 - e), dy: (1 - e) * 16, alpha: e });
    });
    const pu = inv(T.pill[0], T.pill[1], t);
    if (pu > 0) {
      const L = M.layers.pill;
      layer(g, 'pill', { ox: L.cx, oy: L.cy, sx: ease.outExpo(pu), sy: lerp(0.3, 1, ease.outBack(pu, 2.2)), alpha: clamp(pu * 6) });
    }
    const ou = inv(T.orn[0], T.orn[1], t);
    if (ou > 0) {
      for (const [name, dir] of [['ornL', -1], ['ornR', 1]]) {
        const L = M.layers[name];
        const e = ease.outCubic(ou);
        if (ou >= 1) { layer(g, name); continue; }
        const [c, h] = scratch(name, L.w, L.h);
        h.drawImage(img[name], 0, 0);
        h.globalCompositeOperation = 'destination-in';
        const ax = L.anchorX - L.x, len = L.w + 40, fe = 30;
        const x0 = ax, x1 = ax + dir * (len * e);
        const gr = h.createLinearGradient(x0, 0, x1 + dir * fe, 0);
        gr.addColorStop(0, 'rgba(0,0,0,1)');
        gr.addColorStop(clamp(1 - fe / (len * e + fe)), 'rgba(0,0,0,1)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        h.fillStyle = gr;
        h.fillRect(0, 0, L.w, L.h);
        layer(g, name, { src: c, ox: L.anchorX, sx: lerp(0.7, 1, e) });
      }
    }
  }

  function drawGlobe(g, t, cam) {
    const swap = inv(T.swap[0], T.swap[1], t);
    if (swap < 1) {
      const sp = renderGlobe(t, cam);
      if (sp) {
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(globeCv, 0, 0, sp.size, sp.size, sp.x, sp.y, sp.size, sp.size);
        g.restore();
      }
    }
    if (swap > 0) layer(g, 'globe', { alpha: ease.inOutSine(swap) });
  }

  function drawCrest(g, t, cam) {
    drawShield(g, t);
    drawRing(g, t);
    drawLaurel(g, t, -1);
    drawLaurel(g, t, 1);
    drawEmblems(g, t);
    drawGlobe(g, t, cam);
    drawStars(g, t);
    drawBook(g, t);
    drawRibbon(g, t);
    drawBase(g, t);
    drawBanner(g, t);
  }

  // diagonal specular band across everything already drawn on the crest layer
  function sheen(g, t, [t0, t1], strength) {
    const u = inv(t0, t1, t);
    if (u <= 0 || u >= 1) return;
    const x = lerp(-700, W + 700, ease.inOutSine(u));
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.translate(x, H / 2);
    g.rotate(0.38);
    const bw = 260;
    const gr = g.createLinearGradient(-bw, 0, bw, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.42, `rgba(255,252,240,${0.18 * strength})`);
    gr.addColorStop(0.5, `rgba(255,255,255,${0.62 * strength})`);
    gr.addColorStop(0.58, `rgba(255,252,240,${0.18 * strength})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(-bw, -H * 1.4, bw * 2, H * 2.8);
    g.restore();
  }

  // ---- background ---------------------------------------------------------
  function drawBackground(t, cam) {
    const g = ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    const c = project(cam, 591, 560);
    const gr = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, 1250);
    gr.addColorStop(0, '#1d3b72');
    gr.addColorStop(0.38, '#0f2250');
    gr.addColorStop(0.75, '#081330');
    gr.addColorStop(1, '#040915');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    // slow bokeh, parallax at a third of the camera move
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      const bx = rnd(i, 1) * 2400 - 240, by = rnd(i, 2) * 1400 - 160;
      const drift = t * (6 + rnd(i, 3) * 10);
      const px = W / 2 + (bx - W / 2 - (cam.fx - 591) * cam.k * 0.3) * (0.7 + 0.3 * cam.zoom) + Math.sin(t * 0.3 + i) * 20;
      const py = H / 2 + (by - H / 2 - (cam.fy - 666) * cam.k * 0.3) * (0.7 + 0.3 * cam.zoom) - drift;
      const r = 40 + rnd(i, 4) * 130;
      spr(g, rnd(i, 5) < 0.3 ? 'gold' : 'blue', px, py, r, (0.05 + rnd(i, 6) * 0.06) * smooth(0, 1.2, t));
    }
    g.globalCompositeOperation = 'source-over';
  }

  // backlight: shield rim flash as it lands, a soft halo, and light rays after lock-up
  function drawRays(t, cam) {
    const a = smooth(T.rays[0], T.rays[1], t);
    const halo = smooth(4.2, 5.2, t);
    const c = project(cam, 591, 600);
    const d = t - IMPACTS[0][0];
    if (d > -0.05 && d < 1.6) {
      const k = clamp((d + 0.05) / 0.05) * Math.exp(-Math.max(0, d) * 2.6);
      ctx.save();
      applyCam(ctx, cam);
      ctx.globalCompositeOperation = 'lighter';
      const grow = 1 + 0.06 * ease.outCubic(clamp(d / 0.8));
      ctx.translate(591, 640); ctx.scale(grow, grow); ctx.translate(-591, -640);
      ctx.globalAlpha = 0.9 * k;
      ctx.drawImage(shieldGlow, SL.x - PAD * 2, SL.y - PAD * 2, SL.w + PAD * 4, SL.h + PAD * 4);
      ctx.restore();
    }
    if (halo > 0) {
      ctx.globalCompositeOperation = 'lighter';
      spr(ctx, 'blue', c.x, c.y, 760 * cam.zoom, 0.18 * halo);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (a <= 0) return;
    const g = rg, w = raysCv.width, h = raysCv.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'copy';
    const cx = c.x / 4, cy = c.y / 4;
    const cg0 = g.createConicGradient(t * 0.07, cx, cy);
    const n = 28;
    for (let i = 0; i < n; i++) {
      const f = i / n, w0 = 0.35 + 0.65 * rnd(i, 9);
      cg0.addColorStop(f, 'rgba(255,240,210,0)');
      cg0.addColorStop(f + (0.5 / n) * w0, `rgba(255,240,210,${0.55 * (0.4 + 0.6 * rnd(i, 8))})`);
      cg0.addColorStop(f + (1 / n) * 0.98, 'rgba(255,240,210,0)');
    }
    g.fillStyle = cg0;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    const rad = g.createRadialGradient(cx, cy, 30, cx, cy, 300);
    rad.addColorStop(0, 'rgba(0,0,0,1)');
    rad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rad;
    g.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.2 * a * (0.85 + 0.15 * Math.sin(t * 1.3));
    ctx.drawImage(raysCv, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---- effects (additive, logo coordinates) --------------------------------
  function drawFx(g, t, cam) {
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    const z = 1 / cam.zoom; // keeps glows a constant screen size where wanted

    // opening: point of light, anamorphic streak and a shockwave
    {
      const d = t - T.flash;
      if (d > -0.12 && d < 1.0) {
        const a = clamp((d + 0.12) / 0.12) * Math.exp(-Math.max(0, d) * 4.2);
        spr(g, 'white', GL.cx, GL.cy, 60 + 260 * ease.outCubic(clamp(d / 0.5)), a);
        spr(g, 'blue', GL.cx, GL.cy, 520, a * 0.6, 3.2, 0.035);
        spr(g, 'warm', GL.cx, GL.cy, 380, a * 0.5, 1.6, 0.02);
        const w = inv(0, 0.8, d);
        shockwave(g, GL.cx, GL.cy, 40 + 520 * ease.outCubic(w), 6 * (1 - w) + 0.5, 'rgba(200,225,255,1)', 0.7 * (1 - w) * (d > 0));
      }
    }

    // wire heads racing along the meridians and parallels as the cage draws
    if (t > T.meridians && t < 1.3) {
      for (let k = 0; k < 24; k++) {
        const t0 = MERID_T(k), v = inv(t0, t0 + 0.5, t);
        if (v <= 0 || v >= 1) continue;
        const lat = (90 - 180 * ease.outCubic(v)) * DEG;
        const p = globePoint(t, cam, k * 15 * DEG, lat);
        if (!p) continue;
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
        spr(g, 'gold', p.x, p.y, 16, 0.9 * bump(0, 1, v));
        spr(g, 'white', p.x, p.y, 5, bump(0, 1, v));
        g.restore();
      }
      for (let j = -5; j <= 5; j++) {
        const t0 = PARAL_T(j), v = inv(t0, t0 + 0.55, t);
        if (v <= 0 || v >= 1) continue;
        const lon = ((((j + 5) * 137) % 360) + 360 * ease.outCubic(v)) * DEG;
        const p = globePoint(t, cam, lon, j * 15 * DEG);
        if (!p) continue;
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
        spr(g, 'gold', p.x, p.y, 14, 0.8 * bump(0, 1, v));
        g.restore();
      }
    }

    // comet: orbit, spiral out, draw the ring
    if (t > T.orbit[0] && t < T.ring[1] + 0.05) {
      const fadeIn = smooth(T.orbit[0], T.orbit[0] + 0.15, t);
      const N = 26;
      for (let s = N; s >= 1; s--) {
        const ts = t - s * 0.0075, ts2 = t - (s - 1) * 0.0075;
        if (ts < T.orbit[0]) continue;
        const p0 = cometPos(ts), p1 = cometPos(ts2);
        if (p0.behind || p1.behind) continue;
        const f = 1 - s / N;
        const col = f > 0.75 ? 'rgba(255,236,190,1)' : f > 0.4 ? 'rgba(255,150,60,1)' : 'rgba(255,70,40,1)';
        streak(g, p0.x, p0.y, p1.x, p1.y, (2 + 13 * f) * z, col, fadeIn * f * 0.85);
      }
      const p = cometPos(t);
      if (!p.behind) {
        spr(g, 'fire', p.x, p.y, 70 * z, 0.55 * fadeIn);
        spr(g, 'gold', p.x, p.y, 34 * z, 0.9 * fadeIn);
        spr(g, 'core', p.x, p.y, 12 * z, fadeIn);
      }
      g.globalAlpha = 1;
    }
    // sparks shed by the comet
    {
      const N = 110, a0 = T.orbit[0] + 0.1, a1 = T.ring[1];
      for (let i = 0; i < N; i++) {
        const tb = a0 + ((a1 - a0) * i) / N;
        const life = 0.35 + 0.45 * rnd(i, 1);
        const age = t - tb;
        if (age <= 0 || age > life) continue;
        const p0 = cometPos(tb);
        if (p0.behind) continue;
        const ang = rnd(i, 2) * TAU, sp = 60 + 220 * rnd(i, 3);
        const k = 3.2;
        const disp = (tt) => (sp * (1 - Math.exp(-k * tt))) / k;
        const d0 = disp(Math.max(0, age - 0.035)), d1 = disp(age);
        const gy = 60 * age * age;
        const f = 1 - age / life;
        streak(g, p0.x + Math.cos(ang) * d0, p0.y + Math.sin(ang) * d0 + 60 * Math.max(0, age - 0.035) ** 2,
          p0.x + Math.cos(ang) * d1, p0.y + Math.sin(ang) * d1 + gy, (1.2 + 2.2 * f) * z,
          rnd(i, 4) < 0.5 ? 'rgba(255,200,110,1)' : 'rgba(255,110,60,1)', f * f);
      }
      g.globalAlpha = 1;
    }

    // burst at the top of the ring: the stars are thrown out of it
    {
      const d = t - T.burst;
      if (d > 0 && d < 1.0) {
        const B = { x: RING.cx, y: RING.cy - RING.r };
        const a = Math.exp(-d * 5);
        spr(g, 'white', B.x, B.y, 150 * z, a);
        spr(g, 'red', B.x, B.y, 300 * z, a * 0.7);
        spr(g, 'warm', B.x, B.y, 520 * z, a * 0.7, 2.4, 0.03);
        const w = inv(0, 0.7, d);
        shockwave(g, B.x, B.y, 20 + 260 * ease.outCubic(w), 5 * (1 - w) + 0.5, 'rgba(255,200,170,1)', 0.8 * (1 - w));
        for (let i = 0; i < 26; i++) {
          const ang = (i / 26) * TAU + rnd(i, 7) * 0.2, sp = 250 + 450 * rnd(i, 8);
          const life = 0.4 + 0.4 * rnd(i, 9);
          if (d > life) continue;
          const dd = (tt) => (sp * (1 - Math.exp(-4 * tt))) / 4;
          const f = 1 - d / life;
          streak(g, B.x + Math.cos(ang) * dd(Math.max(0, d - 0.04)), B.y + Math.sin(ang) * dd(Math.max(0, d - 0.04)),
            B.x + Math.cos(ang) * dd(d), B.y + Math.sin(ang) * dd(d), (1.5 + 2.5 * f) * z, 'rgba(255,170,120,1)', f);
        }
        g.globalAlpha = 1;
      }
    }

    // star trails and landings
    for (let i = 0; i < 7; i++) {
      const p = starPose(i, t);
      if (!p) continue;
      if (i !== 1 && p.u < 1) {
        const N = 16;
        for (let s = N; s >= 1; s--) {
          const q0 = starPose(i, t - s * 0.012), q1 = starPose(i, t - (s - 1) * 0.012);
          if (!q0 || !q1) continue;
          const f = 1 - s / N;
          streak(g, q0.x, q0.y, q1.x, q1.y, (2 + 16 * f) * z, f > 0.6 ? 'rgba(255,200,170,1)' : 'rgba(255,60,40,1)', 0.5 * f * (1 - p.u * 0.6));
        }
        g.globalAlpha = 1;
        spr(g, 'red', p.x, p.y, 70 * z, 0.5);
      }
      const d = t - p.land;
      if (d > 0 && d < 0.9) {
        const L = M.layers[`star${i}`];
        const a = Math.exp(-d * 7);
        spr(g, 'white', L.cx, L.cy, 70 * z, a);
        spr(g, 'red', L.cx, L.cy, 140 * z, a * 0.8);
        spr(g, 'warm', L.cx, L.cy, 200 * z, a * 0.6, 2.2, 0.04);
        const w = inv(0, 0.55, d);
        shockwave(g, L.cx, L.cy, 12 + 90 * ease.outCubic(w), 3.5 * (1 - w) + 0.4, 'rgba(255,190,170,1)', 0.8 * (1 - w));
      }
    }

    // laurels: green-gold sparkles riding the growing tip
    for (const side of [-1, 1]) {
      const [t0, t1] = side < 0 ? T.laurelL : T.laurelR;
      const N = 34;
      for (let i = 0; i < N; i++) {
        const tb = t0 + ((t1 - t0) * i) / N;
        const life = 0.5 + 0.4 * rnd(i + side * 50, 1);
        const age = t - tb;
        if (age <= 0 || age > life) continue;
        const { e } = laurelHead(side, tb);
        const A0 = (side < 0 ? 100 : 80) * DEG;
        const ang = A0 - side * -1 * 0 + (side < 0 ? 1 : -1) * e * 150 * DEG;
        const r = 285 + 85 * rnd(i + side * 50, 2) + 30 * age;
        const x = RING.cx + Math.cos(ang) * r, y = RING.cy + Math.sin(ang) * r - 25 * age;
        spr(g, rnd(i, 3) < 0.6 ? 'green' : 'gold', x, y, (10 + 14 * rnd(i, 4)) * z, Math.sin(Math.PI * age / life) * 0.9);
      }
    }

    // book: fan of light from the spine
    {
      const d = t - (T.book[0] + 0.12);
      if (d > 0 && d < 1.1) {
        const a = Math.sin(Math.PI * clamp(d / 1.1)) ** 1.5;
        const L = M.layers.book, x = L.spineX, y = L.y + 40;
        g.save();
        g.translate(x, y);
        for (let i = 0; i < 11; i++) {
          const ang = -Math.PI / 2 + (i - 5) * 0.2 + Math.sin(d * 2 + i) * 0.03;
          const len = 260 + 140 * rnd(i, 5);
          g.save();
          g.rotate(ang);
          const gr = g.createLinearGradient(0, 0, len, 0);
          gr.addColorStop(0, `rgba(255,230,170,${0.55 * a})`);
          gr.addColorStop(1, 'rgba(255,230,170,0)');
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(len, -10 - 8 * rnd(i, 6));
          g.lineTo(len, 10 + 8 * rnd(i, 6));
          g.closePath();
          g.fill();
          g.restore();
        }
        g.restore();
        spr(g, 'warm', x, y + 30, 160, a * 0.8);
      }
    }

    // shield: ring of energy at the reveal front and a rim flash as it lands
    {
      const u = inv(T.shield[0], T.shield[1], t);
      if (u > 0 && u < 1) {
        const rad = lerp(0, 1120, ease.outCubic(u)) - 95;
        shockwave(g, 591, 600, Math.max(1, rad), 22 * (1 - u) + 2, 'rgba(160,205,255,1)', 0.35 * (1 - u));
      }
    }

    // emblems: circle-drawing heads, flame glows
    {
      const heads = [[M.torchCircle, T.torchCircle, 1], [M.ringsCircle, T.ringsCircle, -1]];
      for (const [C, [t0, t1], dir] of heads) {
        const u = inv(t0, t1, t);
        if (u <= 0 || u >= 1) continue;
        const a = -Math.PI / 2 + dir * TAU * ease.inOutCubic(u);
        spr(g, 'blue', C.cx + Math.cos(a) * C.r, C.cy + Math.sin(a) * C.r, 28, 0.9);
        spr(g, 'white', C.cx + Math.cos(a) * C.r, C.cy + Math.sin(a) * C.r, 8, 1);
      }
      for (const [name, [t0], seed] of [['torchFlame', T.torchFlame, 1.3], ['lampFlame', T.lampFlame, 4.1]]) {
        const d = t - t0;
        if (d <= 0) continue;
        const L = M.layers[name];
        const f = flicker(t, seed);
        const ign = Math.exp(-d * 6) * 1.2;
        const cy = name === 'torchFlame' ? L.y + L.h * 0.55 : L.baseY - 30;
        spr(g, 'fire', L.baseX, cy, 95 * (1 + (f.sy - 1) * 2), clamp(d * 5) * (0.42 + ign));
        spr(g, 'warm', L.baseX, cy, 30, clamp(d * 5) * (0.3 + ign));
      }
      OLYMPIC_ORDER.forEach((n, i) => {
        const d = t - (T.olympic + i * 0.08 + 0.08);
        if (d <= 0 || d > 0.5) return;
        const L = M.layers[n];
        spr(g, 'white', L.cx, L.cy, 50, Math.exp(-d * 9) * 0.8);
      });
    }

    // letter pops
    {
      const pop = (n, t0, rgbKey, amp) => {
        const d = t - t0;
        if (d <= 0 || d > 0.4) return;
        const L = M.layers[n];
        spr(g, rgbKey, L.cx, L.cy, 44, Math.exp(-d * 11) * amp);
      };
      M.ribbonLetters.forEach((n, i) => pop(n, T.ribbonLetters + i * 0.042 + 0.05, 'white', 0.7));
      const bp = bannerPose(t);
      if (bp.u > 0) {
        g.save();
        g.translate(bp.ox, bp.oy + bp.dy);
        g.rotate(bp.rot);
        g.translate(-bp.ox, -bp.oy);
        M.bannerLetters.forEach((n, i) => pop(n, T.bannerLetters + i * 0.036 + 0.08, 'white', 0.65));
        g.restore();
      }
      // banner landing: a puff of light along its lower edge
      const d = t - IMPACTS[1][0];
      if (d > 0 && d < 0.8) {
        const a = Math.exp(-d * 5);
        spr(g, 'warm', 583, 130, 420, a * 0.55, 1.6, 0.12);
        spr(g, 'red', 583, 90, 300, a * 0.35, 1.8, 0.3);
      }
      // pill and ornaments
      const pd = t - T.pill[0];
      if (pd > 0 && pd < 0.6) spr(g, 'blue', M.layers.pill.cx, M.layers.pill.cy, 200, Math.exp(-pd * 6) * 0.6, 1.8, 0.4);
      const ou = inv(T.orn[0], T.orn[1], t);
      if (ou > 0 && ou < 1) {
        for (const [name, dir] of [['ornL', -1], ['ornR', 1]]) {
          const L = M.layers[name];
          const x = L.anchorX + dir * (L.w + 40) * ease.outCubic(ou) * lerp(0.7, 1, ease.outCubic(ou));
          spr(g, 'blue', x, L.y + L.h / 2, 40, 0.8 * (1 - ou));
        }
      }
    }

    // globe: glint that covers the hand-over to the crest's own globe art
    {
      const u = inv(T.swap[0] - 0.1, T.swap[1] + 0.25, t);
      if (u > 0 && u < 1) {
        g.save();
        g.beginPath();
        g.arc(GL.cx, GL.cy, GL.r, 0, TAU);
        g.clip();
        g.translate(GL.cx, GL.cy);
        g.rotate(-0.6);
        const x = lerp(-GL.r * 1.6, GL.r * 1.6, ease.inOutSine(u));
        const gr = g.createLinearGradient(x - 90, 0, x + 90, 0);
        gr.addColorStop(0, 'rgba(255,245,220,0)');
        gr.addColorStop(0.5, 'rgba(255,245,220,0.75)');
        gr.addColorStop(1, 'rgba(255,245,220,0)');
        g.fillStyle = gr;
        g.fillRect(-GL.r * 2, -GL.r * 2, GL.r * 4, GL.r * 4);
        g.restore();
        const a = bump(0.25, 0.75, u);
        spr(g, 'white', GL.cx - 60, GL.cy - 70, 40, a);
        spr(g, 'warm', GL.cx - 60, GL.cy - 70, 190, a * 0.5, 2.5, 0.04);
        spr(g, 'warm', GL.cx - 60, GL.cy - 70, 150, a * 0.5, 0.04, 2.2);
      }
    }

    // star twinkles after lock-up, then an occasional glint
    for (let i = 0; i < 7; i++) {
      const L = M.layers[`star${i}`];
      const d = t - (T.twinkle + [3, 2, 4, 5, 6, 0, 1][i] * 0.14);
      let a = d > 0 && d < 0.5 ? Math.sin(Math.PI * d / 0.5) : 0;
      const d2 = t - (12.2 + rnd(i, 21) * 2.4);
      if (d2 > 0 && d2 < 0.45) a = Math.max(a, 0.6 * Math.sin(Math.PI * d2 / 0.45));
      if (a <= 0) continue;
      const rot = d * 0.8;
      spr(g, 'white', L.cx, L.cy - 2, 60, a * 0.9, 1.8, 0.05, rot);
      spr(g, 'white', L.cx, L.cy - 2, 60, a * 0.9, 0.05, 1.8, rot);
      spr(g, 'white', L.cx, L.cy - 2, 14, a);
    }

    // drifting gold dust
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const dustA = 0.35 + 0.65 * smooth(9.2, 10.5, t);
    for (let i = 0; i < 90; i++) {
      const depth = 0.3 + rnd(i, 11) * 0.9;
      const x0 = rnd(i, 12) * (W + 200) - 100, y0 = rnd(i, 13) * (H + 400);
      const x = x0 + Math.sin(t * (0.3 + rnd(i, 14) * 0.5) + i) * 30 * depth - (cam.fx - 591) * cam.k * 0.15 * depth;
      let y = y0 - t * (18 + 30 * rnd(i, 15)) * depth - (cam.fy - 666) * cam.k * 0.15 * depth;
      y = ((y % (H + 400)) + H + 400) % (H + 400) - 200;
      const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + rnd(i, 16) * 3) + i * 1.7);
      const a = dustA * (0.12 + 0.35 * tw) * depth * smooth(0.3, 1.5, t);
      spr(g, rnd(i, 17) < 0.7 ? 'gold' : 'warm', x, y, (3 + 5 * rnd(i, 18)) * depth, a);
    }
    g.restore();
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  // ---- final composite -----------------------------------------------------
  let vignette = null;
  function drawFrame(frame) {
    const t = frame / FPS;
    const cam = camera(t);
    drawBackground(t, cam);
    drawRays(t, cam);

    cg.setTransform(1, 0, 0, 1, 0, 0);
    cg.globalCompositeOperation = 'source-over';
    cg.globalAlpha = 1;
    cg.clearRect(0, 0, W, H);
    applyCam(cg, cam);
    drawCrest(cg, t, cam);
    sheen(cg, t, T.sweep, 1);
    sheen(cg, t, T.sweep2, 0.45);
    ctx.drawImage(crestCv, 0, 0);

    fg.setTransform(1, 0, 0, 1, 0, 0);
    fg.clearRect(0, 0, W, H);
    applyCam(fg, cam);
    drawFx(fg, t, cam);
    fg.setTransform(1, 0, 0, 1, 0, 0);

    // bloom: the emissive layer, blurred at two scales
    bga.globalCompositeOperation = 'copy';
    bga.filter = 'blur(5px)';
    bga.drawImage(fxCv, 0, 0, bloomA.width, bloomA.height);
    bga.filter = 'none';
    bgb.globalCompositeOperation = 'copy';
    bgb.filter = 'blur(4px)';
    bgb.drawImage(bloomA, 0, 0, bloomB.width, bloomB.height);
    bgb.filter = 'none';
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(fxCv, 0, 0);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(bloomA, 0, 0, W, H);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(bloomB, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    if (!vignette) {
      vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.15);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
    }
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
    // fade up from black
    const fade = 1 - smooth(0, 0.35, t);
    if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
  }

  return {
    frames: FRAMES, fps: FPS, width: W, height: H, events: EVENTS,
    render(frame) { drawFrame(Math.max(0, Math.min(FRAMES - 1, frame))); },
    grab() {
      const d = ctx.getImageData(0, 0, W, H).data;
      let s = '';
      const CH = 0x8000;
      for (let i = 0; i < d.length; i += CH) s += String.fromCharCode.apply(null, d.subarray(i, i + CH));
      return btoa(s);
    },
    grabJPEG(q = 0.92) { return canvas.toDataURL('image/jpeg', q); },
  };
}
