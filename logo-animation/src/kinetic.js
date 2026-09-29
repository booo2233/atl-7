// De Paul Public School — kinetic logo reveal (v2).
//
// 15 s at 60 fps, cut to a 120 BPM grid (one beat = 0.5 s). Flat brand
// colour, bold type, hard wipes and real motion blur (temporal
// supersampling). The motto punches in word by word; the letters of COUNTRY
// turn into the seven stars; laurels sprout on a green wipe; the line-art
// emblem collapses into the real crest, which assembles piece by piece and
// settles into a lockup with the school's name.
//
// Every frame is a pure function of its time, so it plays the same live and
// when rendered offline.

export const FPS = 60;
export const SECONDS = 15;
export const FRAMES = FPS * SECONDS;
export const WIDTH = 1920;
export const HEIGHT = 1080;

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const E = {
  expoOut: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  expoIn: (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10)),
  expoInOut: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
  quintOut: (t) => 1 - (1 - t) ** 5,
  quintInOut: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2),
  cubicInOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  backOut: (t, s = 1.2) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
};

const COL = {
  navy: '#0A1D40',
  blue: '#0255A0',
  red: '#D21816',
  green: '#2B8A3E',
  gold: '#CF9A2E',
  purple: '#342A7A',
  paper: '#EEE9DF',
  white: '#FFFFFF',
};

const F = (w, px) => `${w} ${px}px "Inter Tight"`;
const SERIF = (px) => `italic 400 ${px}px "Instrument Serif"`;

// ---------------------------------------------------------------------------
// Timeline (seconds). The sound design reads EVENTS.
// ---------------------------------------------------------------------------
const LAND = [0, 1, 2, 3, 4, 5, 6].map((i) => 2.3 + i * 0.125); // star landings on 16ths
const FLY = 0.36;
const LEAF_T = (k) => 3.5 + k * 0.125;
const T = {
  collapse: [4.72, 5.18],
  pull: [5.4, 6.2],
  iris: [4.86, 5.22],
  xfade: [5.22, 5.42],
  laurelWipe: [5.22, 5.5],
  book: [5.5, 5.78],
  outline: [5.58, 6.08],
  field: [5.92, 6.2],
  roundels: [6.22, 6.52],
  torch: [6.34, 6.56],
  olympic: 6.4,
  lamp: [6.46, 6.68],
  ribbon: [6.5, 6.8],
  ribbonLetters: 6.66,
  banner: [6.98, 7.24],
  bannerLetters: 7.1,
  raj: 7.46,
  pill: [7.58, 7.86],
  orn: [7.64, 7.98],
  lock: [9.0, 9.62],
  push: [10.0, 15.0],
};
const CUTS = [1.0, 1.25];
const PUNCH = [[3.5, 0.04], [5.22, 0.028], [8.0, 0.02]];

export const EVENTS = (() => {
  const ev = [
    { t: 0.03, kind: 'slice', dur: 0.33 },
    { t: 0.46, kind: 'open' },
    { t: 1.0, kind: 'slam', size: 1 },
    { t: 1.25, kind: 'amp' },
    { t: 1.34, kind: 'wipe', dur: 0.16, pan: -1 },
    { t: 1.5, kind: 'slam', size: 1.15 },
    { t: 2.3, kind: 'zip', dur: 0.8 },
    { t: 2.72, kind: 'pop', f: 520 },
    { t: 3.36, kind: 'wipe', dur: 0.14, pan: 0 },
    { t: 3.5, kind: 'hit' },
    { t: T.collapse[0], kind: 'suck', dur: T.iris[1] - T.collapse[0] },
    { t: T.iris[1], kind: 'boom' },
    { t: T.book[0], kind: 'pop', f: 380 },
    { t: T.outline[0], kind: 'zip', dur: 0.5 },
    { t: T.field[0] + 0.12, kind: 'thump' },
    { t: T.roundels[0], kind: 'zip', dur: 0.3 },
    { t: T.ribbon[0], kind: 'wipe', dur: 0.3, pan: 1 },
    { t: T.banner[0] + 0.06, kind: 'slam', size: 0.8 },
    { t: T.pill[0], kind: 'pop', f: 300 },
    { t: T.orn[0], kind: 'swish', dur: 0.34 },
    { t: 8.0, kind: 'hit' },
    { t: T.lock[0], kind: 'whoosh', dur: 0.62 },
    { t: 9.5, kind: 'final' },
  ];
  LAND.forEach((t, i) => ev.push({ t, kind: 'star', i }));
  for (let k = 0; k < 9; k++) ev.push({ t: LEAF_T(k), kind: 'leaf', i: k });
  for (let i = 0; i < 5; i++) ev.push({ t: T.olympic + i * 0.04, kind: 'tick', f: 2400 + i * 180, pan: 0.55 });
  for (let i = 0; i < 18; i += 2) ev.push({ t: T.ribbonLetters + i * 0.02, kind: 'tick', f: 1700 + i * 30, pan: (i / 17 - 0.5) * 1.2 });
  for (let i = 0; i < 14; i += 2) ev.push({ t: T.bannerLetters + i * 0.022, kind: 'tick', f: 2100 + i * 30, pan: (i / 13 - 0.5) * 1.1 });
  for (let i = 0; i < 3; i++) ev.push({ t: 9.28 + i * 0.075, kind: 'type', i });
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

export async function createKinetic(canvas, opts = {}) {
  const base = opts.base || new URL('../assets/', import.meta.url).href;
  const readback = !!opts.readback;
  const blur = opts.motionBlur ?? readback;

  const fontDefs = [
    ['Inter Tight', 'inter-tight-latin-900-normal.woff2', { weight: '900' }],
    ['Inter Tight', 'inter-tight-latin-800-normal.woff2', { weight: '800' }],
    ['Inter Tight', 'inter-tight-latin-600-normal.woff2', { weight: '600' }],
    ['Instrument Serif', 'instrument-serif-latin-400-italic.woff2', { style: 'italic', weight: '400' }],
  ];
  await Promise.all(fontDefs.map(async ([fam, file, desc]) => {
    const f = new FontFace(fam, `url(${base}fonts/${file})`, desc);
    await f.load();
    document.fonts.add(f);
  }));
  const M = await (await fetch(`${base}layers/manifest.json`)).json();
  const PATHS = await (await fetch(`${base}layers/paths.json`)).json();
  const img = {};
  await Promise.all(Object.keys(M.layers).map(async (n) => { img[n] = await loadImage(`${base}layers/${n}.png`); }));

  const W = WIDTH, H = HEIGHT;
  canvas.width = W; canvas.height = H;
  const out = canvas.getContext('2d', { alpha: false, willReadFrequently: readback });
  const subCv = mk(W, H);
  const sub = subCv.getContext('2d', { alpha: false });
  for (const c of [out, sub]) { c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; }

  // ---- geometry (logo px) ---------------------------------------------------
  const RING = M.ring, GL = M.globe;
  const CREST = { x: 594, y: 665 };
  const K1 = 330 / RING.r; // line-art emblem scale
  const KM = 0.9; // emblem right after the collapse
  const KC = 860 / 1330; // crest while it assembles
  const KL = 800 / 1330; // crest in the lockup
  const STAR_R = M.layers.star1.h / 1.809; // outer radius of a regular star with that height
  const STAR_OF_LETTER = [5, 6, 0, 1, 2, 3, 4]; // C O U N T R Y -> stars, clockwise from lower left
  const LAUREL = [
    { a0: 110 * DEG, dir: 1 }, // left branch climbs clockwise
    { a0: 70 * DEG, dir: -1 }, // right branch climbs anticlockwise
  ];
  const LSPAN = 112 * DEG, LRAD = 336;

  // ---- text metrics ------------------------------------------------------
  const mcache = new Map();
  function metrics(str, font) {
    const key = `${font}|${str}`;
    let m = mcache.get(key);
    if (!m) {
      sub.font = font;
      const mt = sub.measureText(str);
      const chars = [...str];
      const xs = chars.map((ch, i) => sub.measureText(chars.slice(0, i + 1).join('')).width - sub.measureText(ch).width);
      const ws = chars.map((ch) => sub.measureText(ch).width);
      m = { width: mt.width, asc: mt.actualBoundingBoxAscent, desc: mt.actualBoundingBoxDescent, left: mt.actualBoundingBoxLeft, right: mt.actualBoundingBoxRight, xs, ws, chars };
      mcache.set(key, m);
    }
    return m;
  }
  const cap = (font) => metrics('H', font).asc;

  // lockup layout (screen px)
  const NAME = ['DE PAUL', 'PUBLIC', 'SCHOOL'];
  const NAME_FONT = F(900, 132);
  const SUB_FONT = F(600, 30);
  const SUB_TEXT = 'RAJAMUDY  ·  IDUKKI';
  const SUB_TRACK = 6.5;
  const MOTTO_FONT = SERIF(56);
  const MOTTO = 'For God & Country';
  const nameW = Math.max(...NAME.map((s) => metrics(s, NAME_FONT).width));
  const capN = cap(NAME_FONT);
  const LINE = 124;
  const crestW = (1168 - 20) * KL;
  const GAP = 64;
  const lockLeft = (W - (crestW + GAP * 2 + 2 + nameW)) / 2;
  const LOCK_CX = lockLeft + crestW / 2;
  const RULE_X = lockLeft + crestW + GAP;
  const TEXT_X = RULE_X + 2 + GAP;
  const blockH = capN + 2 * LINE + 44 + 8 + 58 + 70 + 12;
  const T0 = H / 2 - blockH / 2;
  const B1 = T0 + capN, B2 = B1 + LINE, B3 = B2 + LINE;
  const BAR_Y = B3 + 44, B4 = BAR_Y + 8 + 58, B5 = B4 + 70;

  // ---- crest shadow --------------------------------------------------------
  const SL = M.layers.shield;
  const PAD = 80;
  const shadowCv = (() => {
    const w = (SL.w + PAD * 2) / 4, h = (SL.h + PAD * 2) / 4;
    const a = mk(w, h), ag = a.getContext('2d');
    ag.drawImage(img.shield, PAD / 4, PAD / 4, SL.w / 4, SL.h / 4);
    ag.globalCompositeOperation = 'source-in';
    ag.fillStyle = '#1a1206';
    ag.fillRect(0, 0, w, h);
    const b = mk(w, h), bg = b.getContext('2d');
    bg.filter = 'blur(9px)';
    bg.drawImage(a, 0, 0);
    return b;
  })();

  // film grain, overlaid once per output frame
  const grainTiles = [0, 1, 2].map((k) => {
    const c = mk(256, 256), gc = c.getContext('2d');
    const d = gc.createImageData(256, 256);
    let s = 1234567 + k * 7654321;
    for (let i = 0; i < d.data.length; i += 4) {
      s = (Math.imul(s, 1664525) + 1013904223) | 0;
      const v = 128 + (((s >>> 8) & 255) - 128) * 0.55;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    gc.putImageData(d, 0, 0);
    return c;
  });

  // ---- camera for the emblem / crest --------------------------------------
  function crestCam(t) {
    // the emblem collapses around the ring, then the camera pulls back and
    // down to take in the shield as its outline draws
    const e1 = E.expoInOut(inv(T.collapse[0], T.collapse[1], t));
    const e2 = E.quintInOut(inv(T.pull[0], T.pull[1], t));
    let k = Math.exp(lerp(Math.log(K1), Math.log(KM), e1));
    k = Math.exp(lerp(Math.log(k), Math.log(KC), e2));
    const fx = lerp(RING.cx, CREST.x, e2), fy = lerp(RING.cy, CREST.y, e2);
    const l = E.expoInOut(inv(T.lock[0], T.lock[1], t));
    k *= lerp(1, KL / KC, l);
    const px = lerp(W / 2, LOCK_CX, l), py = H / 2;
    for (const [t0, a] of PUNCH) if (t > t0) k *= 1 + a * Math.exp(-(t - t0) * 13);
    return { k, fx, fy, px, py };
  }
  const applyCam = (g, c) => {
    g.translate(c.px, c.py);
    g.scale(c.k, c.k);
    g.translate(-c.fx, -c.fy);
  };
  const toScreen = (c, x, y) => ({ x: c.px + (x - c.fx) * c.k, y: c.py + (y - c.fy) * c.k });

  // ---- primitives -----------------------------------------------------------
  function text(g, str, font, x, y, color) {
    g.font = font;
    g.fillStyle = color;
    g.fillText(str, x, y);
  }
  // draw a string centred on (cx, cy) by cap height / advance width
  function word(g, str, font, cx, cy, s, color, rot = 0) {
    const m = metrics(str, font);
    g.save();
    g.translate(cx, cy);
    if (rot) g.rotate(rot);
    g.scale(s, s);
    text(g, str, font, -m.width / 2, cap(font) / 2, color);
    g.restore();
  }
  // draw a glyph centred on its ink box
  function glyph(g, str, font, cx, cy, s, color, rot = 0) {
    const m = metrics(str, font);
    g.save();
    g.translate(cx, cy);
    if (rot) g.rotate(rot);
    g.scale(s, s);
    text(g, str, font, -(m.right - m.left) / 2, (m.asc - m.desc) / 2, color);
    g.restore();
  }
  function tracked(g, str, font, x, y, track, color) {
    const m = metrics(str, font);
    g.font = font;
    g.fillStyle = color;
    m.chars.forEach((ch, i) => g.fillText(ch, x + m.xs[i] + track * i, y));
  }
  function starPath(g, x, y, ro, rot = 0) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? ro * 0.4 : ro;
      const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath();
  }
  function layer(g, name, o = {}) {
    const L = M.layers[name];
    const a = o.alpha ?? 1;
    const sx = o.sx ?? o.s ?? 1, sy = o.sy ?? o.s ?? 1;
    if (a <= 0.002 || Math.abs(sx) < 1e-4 || Math.abs(sy) < 1e-4) return;
    const ox = o.ox ?? L.x + L.w / 2, oy = o.oy ?? L.y + L.h / 2;
    g.save();
    g.globalAlpha *= a;
    g.translate(ox + (o.dx || 0), oy + (o.dy || 0));
    if (o.rot) g.rotate(o.rot);
    g.scale(sx, sy);
    g.drawImage(img[name], L.x - ox, L.y - oy, L.w, L.h);
    g.restore();
  }
  function clipRect(g, x, y, w, h) {
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
  }
  function polylinePart(g, pts, frac) {
    // stroke the first `frac` of a polyline's length
    let total = 0;
    const seg = [];
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      seg.push(l);
      total += l;
    }
    let left = total * frac;
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && left > 0; i++) {
      const l = seg[i - 1];
      const f = Math.min(1, left / l);
      g.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f));
      left -= l;
    }
  }

  // ---- line-art emblem (logo px) ---------------------------------------------
  function flatGlobe(g, t, color, alpha) {
    const s = E.expoOut(inv(2.72, 3.12, t));
    if (s <= 0 || alpha <= 0) return;
    const R = GL.r * s, cx = GL.cx, cy = GL.cy;
    const la = clamp(inv(2.8, 3.1, t));
    const lon0 = (t - 2.72) * (TAU / 5) + 0.4;
    const tilt = 20 * DEG, ct = Math.cos(tilt), st = Math.sin(tilt);
    const proj = (lat, lon) => {
      const cl = Math.cos(lat);
      const X = cl * Math.sin(lon), Y = Math.sin(lat) * ct - cl * Math.cos(lon) * st;
      const Z = Math.sin(lat) * st + cl * Math.cos(lon) * ct;
      return [cx + R * X, cy - R * Y, Z];
    };
    const curves = [];
    for (const latD of [-60, -30, 0, 30, 60]) {
      const pts = [];
      for (let d = 0; d <= 360; d += 4) pts.push(proj(latD * DEG, d * DEG));
      curves.push(pts);
    }
    for (let m = 0; m < 12; m++) {
      const pts = [];
      for (let d = -90; d <= 90; d += 4) pts.push(proj(d * DEG, m * 30 * DEG + lon0));
      curves.push(pts);
    }
    g.save();
    g.strokeStyle = color;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const pass = (front) => {
      g.globalAlpha = alpha * la * (front ? 1 : 0.26);
      g.lineWidth = front ? 5 : 4;
      g.beginPath();
      for (const pts of curves) {
        let pen = false;
        for (const p of pts) {
          if ((p[2] > 0) === front) { if (pen) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); pen = true; } else pen = false;
        }
      }
      g.stroke();
    };
    if (la > 0) pass(false);
    g.globalAlpha = alpha;
    g.lineWidth = 7;
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.stroke();
    if (la > 0) pass(true);
    g.restore();
  }

  function leaf(g, bx, by, dx, dy, len, wid) {
    const tx = bx + dx * len, ty = by + dy * len;
    const mx = bx + dx * len * 0.5, my = by + dy * len * 0.5;
    const px = -dy * wid, py = dx * wid;
    g.moveTo(bx, by);
    g.quadraticCurveTo(mx + px, my + py, tx, ty);
    g.quadraticCurveTo(mx - px, my - py, bx, by);
  }
  function flatLaurels(g, t, color, alpha) {
    if (alpha <= 0 || t < 3.5) return;
    g.save();
    g.fillStyle = color;
    g.strokeStyle = color;
    g.globalAlpha = alpha;
    g.lineCap = 'round';
    const sp = clamp((t - 3.5) / 1.05 + 0.07);
    for (const L of LAUREL) {
      const ang = (s) => L.a0 + L.dir * LSPAN * s;
      g.lineWidth = 6;
      g.beginPath();
      g.arc(RING.cx, RING.cy, LRAD, ang(0), ang(Math.max(0.001, sp)), L.dir < 0);
      g.stroke();
      g.beginPath();
      const c38 = Math.cos(38 * DEG), s38 = Math.sin(38 * DEG);
      for (let k = 0; k < 9; k++) {
        const gk = E.backOut(inv(LEAF_T(k), LEAF_T(k) + 0.22, t), 1.4);
        if (gk <= 0) continue;
        const s = k < 8 ? 0.06 + 0.117 * k : 1;
        const a = ang(s);
        const bx = RING.cx + Math.cos(a) * LRAD, by = RING.cy + Math.sin(a) * LRAD;
        const tx = -Math.sin(a) * L.dir, ty = Math.cos(a) * L.dir;
        const nx = Math.cos(a), ny = Math.sin(a);
        const len = lerp(78, 50, s) * gk, wid = len * 0.25;
        if (k < 8) {
          leaf(g, bx, by, tx * c38 + nx * s38, ty * c38 + ny * s38, len, wid);
          leaf(g, bx, by, tx * c38 - nx * s38, ty * c38 - ny * s38, len * 0.9, wid * 0.9);
        } else leaf(g, bx, by, tx, ty, len, wid);
      }
      g.fill();
    }
    g.restore();
  }

  function flatRing(g, t, color, full) {
    const p = full ? 1 : E.expoInOut(inv(2.3, 3.1, t));
    if (p <= 0) return;
    g.save();
    g.strokeStyle = color;
    g.lineWidth = RING.width;
    g.beginPath();
    if (p >= 1) g.arc(RING.cx, RING.cy, RING.r, 0, TAU);
    else {
      g.lineCap = 'round';
      g.arc(RING.cx, RING.cy, RING.r, -Math.PI / 2 - Math.PI * p, -Math.PI / 2 + Math.PI * p);
    }
    g.stroke();
    g.restore();
  }

  function landedStars(g, t, color, alpha, accents) {
    if (alpha <= 0) return;
    g.save();
    g.fillStyle = color;
    g.strokeStyle = color;
    g.globalAlpha = alpha;
    g.lineCap = 'round';
    STAR_OF_LETTER.forEach((si, li) => {
      const d = t - LAND[li];
      if (d < 0) return;
      const L = M.layers[`star${si}`];
      const s = 1 + 0.2 * Math.exp(-d * 16);
      starPath(g, L.cx, L.cy, STAR_R * s);
      g.fill();
      if (accents && d < 0.3) {
        const v = d / 0.3;
        const r1 = STAR_R * (1.35 + 1.5 * E.expoOut(v)), r0 = STAR_R * (1.35 + 1.5 * E.expoIn(v));
        const out = Math.atan2(L.cy - RING.cy, L.cx - RING.cx);
        g.lineWidth = 4.5;
        g.beginPath();
        for (const off of [-0.7, 0, 0.7]) {
          const a = out + off;
          g.moveTo(L.cx + Math.cos(a) * r0, L.cy + Math.sin(a) * r0);
          g.lineTo(L.cx + Math.cos(a) * r1, L.cy + Math.sin(a) * r1);
        }
        g.stroke();
      }
    });
    g.restore();
  }

  function flatEmblem(g, t, cam, mode, fade = { globe: 1, stars: 1, laurels: 1 }) {
    const white = mode === 'white';
    g.save();
    applyCam(g, cam);
    flatLaurels(g, t, white ? COL.white : COL.green, fade.laurels);
    flatRing(g, t, white ? COL.white : COL.red, !white);
    flatGlobe(g, t, white ? COL.white : COL.gold, fade.globe);
    landedStars(g, t, white ? COL.white : COL.red, fade.stars, white);
    g.restore();
  }

  // ---- COUNTRY: letters that become stars (screen px) -----------------------
  const COUNTRY_FONT = F(900, 250);
  function countryLetters(t) {
    const m = metrics('COUNTRY', COUNTRY_FONT);
    const trk = 72 * (1 - E.expoOut(inv(1.46, 1.96, t)));
    const sw = lerp(1.16, 1, E.expoOut(inv(1.46, 1.92, t)));
    const wipeX = lerp(W, 0, E.quintInOut(inv(1.34, 1.5, t)));
    const total = m.width + trk * 6;
    return m.chars.map((ch, i) => ({
      ch, s: sw, w: m.ws[i],
      x: W / 2 + wipeX * 0.3 + (m.xs[i] + trk * i + m.ws[i] / 2 - total / 2) * sw,
      y: H / 2,
    }));
  }
  function drawCountry(g, t, cam) {
    const letters = countryLetters(Math.min(t, 1.96));
    const capC = cap(COUNTRY_FONT);
    letters.forEach((l, i) => {
      const t0 = LAND[i] - FLY;
      if (t >= LAND[i]) return; // landed: drawn as part of the emblem
      if (t < t0) {
        g.save();
        g.translate(l.x, l.y);
        g.scale(l.s, l.s);
        text(g, l.ch, COUNTRY_FONT, -l.w / 2, capC / 2, COL.white);
        g.restore();
        return;
      }
      const u = inv(t0, LAND[i], t);
      const mph = E.expoInOut(inv(t0, t0 + 0.16, t));
      const p = E.expoInOut(u);
      const S = M.layers[`star${STAR_OF_LETTER[i]}`];
      const tgt = toScreen(cam, S.cx, S.cy);
      const mx = (l.x + tgt.x) / 2, my = (l.y + tgt.y) / 2;
      let nx = mx - W / 2, ny = my - H / 2;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl; ny /= nl;
      const qx = mx + nx * 110, qy = my + ny * 110;
      const x = (1 - p) ** 2 * l.x + 2 * p * (1 - p) * qx + p * p * tgt.x;
      const y = (1 - p) ** 2 * l.y + 2 * p * (1 - p) * qy + p * p * tgt.y;
      if (mph < 1) {
        g.save();
        g.globalAlpha = 1 - mph;
        g.translate(x, y);
        g.scale(l.s * (1 - 0.65 * mph), l.s * (1 - 0.65 * mph));
        text(g, l.ch, COUNTRY_FONT, -l.w / 2, capC / 2, COL.white);
        g.restore();
      }
      if (mph > 0) {
        g.save();
        g.globalAlpha = mph;
        g.fillStyle = COL.white;
        starPath(g, x, y, STAR_R * cam.k * lerp(0.45, 1, mph), -144 * DEG * (1 - p));
        g.fill();
        g.restore();
      }
    });
  }

  // ---- the real crest (logo px) ------------------------------------------
  function crest(g, t, cam) {
    const xf = inv(T.xfade[0], T.xfade[1], t);
    g.save();
    applyCam(g, cam);
    // shield: outline draws itself, then the field and shadow come in
    const fa = E.sineInOut(inv(T.field[0], T.field[1], t));
    if (fa > 0) {
      g.save();
      g.globalAlpha = 0.22 * fa;
      g.drawImage(shadowCv, SL.x - PAD, SL.y - PAD + 26, SL.w + PAD * 2, SL.h + PAD * 2);
      g.restore();
      g.save();
      clipRect(g, SL.x - 20, SL.y - 20, SL.w + 40, (SL.h + 40) * E.expoOut(inv(T.field[0], T.field[1] + 0.1, t)));
      g.drawImage(img.shield, SL.x, SL.y);
      g.restore();
    }
    const op = E.expoInOut(inv(T.outline[0], T.outline[1], t));
    const oa = 1 - inv(T.field[1], T.field[1] + 0.12, t);
    if (op > 0 && oa > 0) {
      g.save();
      g.globalAlpha = oa;
      g.strokeStyle = COL.blue;
      g.lineWidth = PATHS.borderWidth;
      g.lineJoin = 'round';
      g.beginPath();
      polylinePart(g, PATHS.shieldLeft, op);
      polylinePart(g, PATHS.shieldRight, op);
      g.stroke();
      g.restore();
    }
    flatRing(g, t, COL.red, true);
    // laurels: flat ones above the wipe line, the real ones below it
    const lw = E.expoInOut(inv(T.laurelWipe[0], T.laurelWipe[1], t));
    const edge = lerp(800, 180, lw);
    if (lw < 1) {
      g.save();
      clipRect(g, -2000, -2000, 6000, edge + 2000);
      flatLaurels(g, t, COL.green, 1);
      g.restore();
    }
    if (lw > 0) {
      g.save();
      clipRect(g, -2000, edge, 6000, 4000);
      layer(g, 'laurelL');
      layer(g, 'laurelR');
      g.restore();
    }
    // roundels, torch, Olympic rings, lamp
    for (const [C, dir] of [[M.torchCircle, 1], [M.ringsCircle, -1]]) {
      const p = E.expoInOut(inv(T.roundels[0], T.roundels[1], t));
      if (p <= 0) continue;
      g.save();
      g.strokeStyle = COL.purple;
      g.lineWidth = C.width;
      g.beginPath();
      if (p >= 1) g.arc(C.cx, C.cy, C.r, 0, TAU);
      else { g.lineCap = 'round'; g.arc(C.cx, C.cy, C.r, -Math.PI / 2, -Math.PI / 2 + dir * TAU * p, dir < 0); }
      g.stroke();
      g.restore();
    }
    {
      const u = inv(T.torch[0], T.torch[1], t);
      if (u > 0) {
        layer(g, 'torchHolder', { dy: (1 - E.expoOut(u)) * 26, alpha: clamp(u * 4) });
        const L = M.layers.torchFlame;
        const v = inv(T.torch[0] + 0.06, T.torch[1] + 0.06, t);
        const fl = 1 + 0.025 * Math.sin(t * 19) + 0.015 * Math.sin(t * 31 + 1);
        layer(g, 'torchFlame', { ox: L.baseX, oy: L.baseY, sx: E.expoOut(v), sy: E.expoOut(v) * fl, alpha: clamp(v * 4) });
      }
      M.olympic.forEach((n, i) => {
        const order = ['oring_blue', 'oring_yellow', 'oring_black', 'oring_green', 'oring_red'].indexOf(n);
        const v = inv(T.olympic + order * 0.04, T.olympic + order * 0.04 + 0.2, t);
        if (v <= 0) return;
        const L = M.layers[n];
        layer(g, n, { ox: L.cx, oy: L.cy, s: E.backOut(v, 1.6), alpha: clamp(v * 5) });
      });
      const lu = inv(T.lamp[0], T.lamp[1], t);
      if (lu > 0) {
        const L = M.layers.lamp;
        layer(g, 'lamp', { oy: L.y + L.h, sx: E.expoOut(lu), alpha: clamp(lu * 5) });
        const F0 = M.layers.lampFlame;
        const v = inv(T.lamp[0] + 0.08, T.lamp[1] + 0.08, t);
        const fl = 1 + 0.03 * Math.sin(t * 17 + 2) + 0.015 * Math.sin(t * 29);
        layer(g, 'lampFlame', { ox: F0.baseX, oy: F0.baseY, s: E.expoOut(v), sy: E.expoOut(v) * fl, alpha: clamp(v * 4) });
      }
    }
    // globe: line art hands over to the real globe
    if (xf < 1) flatGlobe(g, t, COL.gold, 1 - xf);
    if (xf > 0) {
      const v = inv(T.xfade[0], T.xfade[0] + 0.45, t);
      layer(g, 'globe', { ox: GL.cx, oy: GL.cy, s: lerp(0.9, 1, E.expoOut(v)), rot: -0.35 * (1 - E.expoOut(v)), alpha: E.sineInOut(xf) });
    }
    // stars
    if (xf < 1) landedStars(g, t, COL.red, 1 - xf, false);
    if (xf > 0) for (let i = 0; i < 7; i++) layer(g, `star${i}`, { alpha: xf });
    // book opens from its spine
    {
      const u = inv(T.book[0], T.book[1], t);
      if (u > 0) {
        const L = M.layers.book, sp = L.spineX;
        const o = E.expoOut(u);
        for (const side of [-1, 1]) {
          g.save();
          g.globalAlpha = clamp(u * 5);
          if (side < 0) clipRect(g, L.x - 300, L.y - 300, sp - L.x + 300, L.h + 600);
          else clipRect(g, sp, L.y - 300, L.w + 300, L.h + 600);
          g.translate(sp, L.y + L.h);
          g.scale(Math.max(0.002, o), lerp(0.7, 1, o));
          g.translate(-sp, -(L.y + L.h));
          g.drawImage(img.book, L.x, L.y);
          g.restore();
        }
      }
    }
    // ribbon: hard wipe left to right, then the lettering punches up
    {
      const u = inv(T.ribbon[0], T.ribbon[1], t);
      if (u > 0) {
        const L = M.layers.ribbon;
        const x = lerp(L.x - 10, L.x + L.w + 10, E.expoInOut(u));
        g.save();
        clipRect(g, -2000, -2000, x + 2000, 6000);
        layer(g, 'ribbon', { oy: 1030, sy: lerp(0.86, 1, E.expoOut(u)) });
        g.restore();
        M.ribbonLetters.forEach((n, i) => {
          const v = inv(T.ribbonLetters + i * 0.02, T.ribbonLetters + i * 0.02 + 0.22, t);
          if (v <= 0) return;
          const Lt = M.layers[n];
          layer(g, n, { ox: Lt.cx, oy: Lt.cy, dy: (1 - E.expoOut(v)) * 30, s: lerp(0.7, 1, E.expoOut(v)), alpha: clamp(v * 4) });
        });
      }
    }
    // RAJAMUDY, the IDUKKI pill and the flourishes
    {
      const order = M.rajLetters.map((n) => n).sort((a, b) => Math.abs(M.layers[a].cx - 585) - Math.abs(M.layers[b].cx - 585));
      order.forEach((n, rank) => {
        const v = inv(T.raj + rank * 0.03, T.raj + rank * 0.03 + 0.24, t);
        if (v <= 0) return;
        const Lt = M.layers[n];
        layer(g, n, { ox: Lt.cx, oy: Lt.cy, dy: (1 - E.expoOut(v)) * 22, alpha: clamp(v * 4) });
      });
      const pu = inv(T.pill[0], T.pill[1], t);
      if (pu > 0) {
        const L = M.layers.pill;
        layer(g, 'pill', { ox: L.cx, oy: L.cy, sx: E.expoOut(pu), sy: lerp(0.5, 1, E.expoOut(pu)), alpha: clamp(pu * 6) });
      }
      const ou = E.expoOut(inv(T.orn[0], T.orn[1], t));
      if (ou > 0) {
        const L0 = M.layers.ornL, L1 = M.layers.ornR;
        g.save();
        clipRect(g, L0.anchorX - (L0.anchorX - L0.x + 4) * ou, L0.y - 10, (L0.anchorX - L0.x + 4) * ou + 1, L0.h + 20);
        layer(g, 'ornL');
        g.restore();
        g.save();
        clipRect(g, L1.anchorX, L1.y - 10, (L1.x + L1.w - L1.anchorX + 4) * ou, L1.h + 20);
        layer(g, 'ornR');
        g.restore();
      }
    }
    // banner slams down from above, then its lettering lands
    {
      const u = inv(T.banner[0], T.banner[1], t);
      if (u > 0) {
        const dy = -280 * (1 - E.expoOut(u));
        layer(g, 'banner', { dy, alpha: clamp(u * 6) });
        M.bannerLetters.forEach((n, i) => {
          const v = inv(T.bannerLetters + i * 0.022, T.bannerLetters + i * 0.022 + 0.22, t);
          if (v <= 0) return;
          const Lt = M.layers[n];
          layer(g, n, { ox: Lt.cx, oy: Lt.cy, dy: dy - (1 - E.expoOut(v)) * 26, s: lerp(1.35, 1, E.expoOut(v)), alpha: clamp(v * 4) });
        });
      }
    }
    g.restore();
  }

  function lockup(g, t) {
    if (t < T.lock[0] + 0.1) return;
    // divider grows from the centre
    const hh = 270 * E.expoInOut(inv(9.3, 9.82, t));
    if (hh > 0) {
      g.fillStyle = 'rgba(10,29,64,0.2)';
      g.fillRect(RULE_X, H / 2 - hh, 2, hh * 2);
    }
    const rise = (t0, dur, top, bottom, draw) => {
      const u = inv(t0, t0 + dur, t);
      if (u <= 0) return;
      const off = (1 - E.expoOut(u)) * (bottom - top + 24);
      g.save();
      clipRect(g, TEXT_X - 30, top - 14, W, bottom - top + 28);
      g.translate(0, off);
      draw();
      g.restore();
    };
    NAME.forEach((s, j) => {
      const b = [B1, B2, B3][j];
      rise(9.28 + j * 0.075, 0.62, b - capN, b, () => text(g, s, NAME_FONT, TEXT_X, b, COL.navy));
    });
    const bw = 112 * E.expoOut(inv(9.6, 10.0, t));
    if (bw > 0) { g.fillStyle = COL.red; g.fillRect(TEXT_X, BAR_Y, bw, 8); }
    const capS = cap(SUB_FONT);
    rise(9.66, 0.6, B4 - capS, B4 + 2, () => tracked(g, SUB_TEXT, SUB_FONT, TEXT_X, B4, SUB_TRACK, COL.blue));
    const mm = metrics(MOTTO, MOTTO_FONT);
    rise(9.76, 0.62, B5 - mm.asc, B5 + mm.desc, () => text(g, MOTTO, MOTTO_FONT, TEXT_X, B5, COL.red));
  }

  // ---- scenes ---------------------------------------------------------------
  function drawScene(g, t) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    const cam = crestCam(t);

    if (t < 1.0) {
      // a line slices the frame, opens like a slit, FOR is inside
      g.fillStyle = COL.navy;
      g.fillRect(0, 0, W, H);
      g.fillStyle = COL.white;
      if (t < 0.46) {
        const head = lerp(-60, W + 60, E.expoOut(inv(0.03, 0.36, t)));
        g.fillRect(-60, H / 2 - 2, head + 60, 4);
      } else {
        const h = 190 * E.expoOut(inv(0.46, 0.82, t));
        const len = W * (1 - E.expoIn(inv(0.6, 0.94, t)));
        g.fillRect(W / 2 - len / 2, H / 2 - h - 2, len, 4);
        g.fillRect(W / 2 - len / 2, H / 2 + h - 2, len, 4);
        g.save();
        clipRect(g, 0, H / 2 - h, W, h * 2);
        word(g, 'FOR', F(900, 360), W / 2, H / 2, lerp(1.2, 1, E.expoOut(inv(0.46, 0.98, t))), COL.white);
        g.restore();
      }
    } else if (t < 1.25) {
      g.fillStyle = COL.white;
      g.fillRect(0, 0, W, H);
      word(g, 'GOD', F(900, 420), W / 2, H / 2, lerp(1.6, 1, E.expoOut(inv(1.0, 1.22, t))), COL.navy);
    } else if (t < 1.5) {
      g.fillStyle = COL.white;
      g.fillRect(0, 0, W, H);
      const u = E.expoOut(inv(1.25, 1.46, t));
      glyph(g, '&', SERIF(760), W / 2, H / 2, lerp(0.7, 1, u), COL.red, lerp(-0.7, 0, u));
      const x = lerp(W, 0, E.quintInOut(inv(1.34, 1.5, t)));
      g.fillStyle = COL.red;
      g.fillRect(x, 0, W - x + 1, H);
      g.save();
      clipRect(g, x, 0, W - x + 1, H);
      drawCountry(g, t, cam);
      g.restore();
    } else if (t < T.iris[0]) {
      // red field: COUNTRY breaks into the stars; green wipe: laurels sprout
      g.fillStyle = COL.red;
      g.fillRect(0, 0, W, H);
      const wy = lerp(H, 0, E.quintInOut(inv(3.36, 3.5, t)));
      if (t > 3.36) { g.fillStyle = COL.green; g.fillRect(0, wy, W, H - wy + 1); }
      flatEmblem(g, t, cam, 'white');
      if (t < LAND[6] + 0.01) drawCountry(g, t, cam);
    } else if (t < T.iris[1]) {
      // the emblem collapses into the crest; a two-colour iris wipes to paper
      g.fillStyle = COL.green;
      g.fillRect(0, 0, W, H);
      flatEmblem(g, t, cam, 'white');
      const c = toScreen(cam, RING.cx, RING.cy);
      const r2 = 1350 * E.expoInOut(inv(T.iris[0] + 0.05, T.iris[1], t));
      const r1 = 1350 * E.expoInOut(inv(T.iris[0], T.iris[1] - 0.02, t));
      g.fillStyle = COL.red;
      g.beginPath();
      g.arc(c.x, c.y, r1, 0, TAU);
      g.fill();
      if (r2 > 0) {
        g.save();
        g.beginPath();
        g.arc(c.x, c.y, r2, 0, TAU);
        g.clip();
        g.fillStyle = COL.paper;
        g.fillRect(0, 0, W, H);
        flatEmblem(g, t, cam, 'color');
        g.restore();
      }
    } else {
      g.fillStyle = COL.paper;
      g.fillRect(0, 0, W, H);
      const push = 1 + 0.03 * E.sineInOut(inv(T.push[0], T.push[1], t));
      g.save();
      g.translate(W / 2, H / 2);
      g.scale(push, push);
      g.translate(-W / 2, -H / 2);
      crest(g, t, cam);
      lockup(g, t);
      g.restore();
    }
  }

  function shutter(t) {
    const half = 0.25 / FPS; // 180 degree shutter
    let a = t - half, b = t + half;
    for (const c of CUTS) {
      if (c > a && c <= b) {
        if (t >= c) a = c;
        else b = c - 1e-6;
      }
    }
    return [a, b];
  }
  const samples = (t) => (t < 10.45 ? 8 : 1);

  function renderFrame(frame) {
    const t = frame / FPS;
    const n = blur ? samples(t) : 1;
    if (n === 1) drawScene(out, t);
    else {
      const [a, b] = shutter(t);
      for (let s = 0; s < n; s++) {
        drawScene(sub, lerp(a, b, (s + 0.5) / n));
        out.setTransform(1, 0, 0, 1, 0, 0);
        out.globalCompositeOperation = 'source-over';
        out.globalAlpha = 1 / (s + 1);
        out.drawImage(subCv, 0, 0);
      }
    }
    // grain
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.globalCompositeOperation = 'overlay';
    out.globalAlpha = 0.07;
    const tile = grainTiles[frame % 3];
    const ox = -((frame * 97) % 256), oy = -((frame * 57) % 256);
    for (let y = oy; y < H; y += 256) for (let x = ox; x < W; x += 256) out.drawImage(tile, x, y);
    out.globalAlpha = 1;
    out.globalCompositeOperation = 'source-over';
  }

  return {
    frames: FRAMES, fps: FPS, width: W, height: H, events: EVENTS,
    render(frame) { renderFrame(Math.max(0, Math.min(FRAMES - 1, frame))); },
    grab() {
      const d = out.getImageData(0, 0, W, H).data;
      let s = '';
      const CH = 0x8000;
      for (let i = 0; i < d.length; i += CH) s += String.fromCharCode.apply(null, d.subarray(i, i + CH));
      return btoa(s);
    },
    grabJPEG(q = 0.92) { return canvas.toDataURL('image/jpeg', q); },
  };
}
