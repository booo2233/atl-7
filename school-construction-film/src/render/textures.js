// Procedural canvas textures. No image files are used anywhere in the film:
// plaster, laterite blocks, concrete, pavers, soil, clay tiles, corrugated
// sheets and the school signs are all painted here from seeded noise.
import * as THREE from 'three';
import { mulberry32 } from '../core/math.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tex(c, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

// value noise on a torus so every texture tiles seamlessly
function tileNoise(w, h, cells, rnd) {
  const g = Array.from({ length: cells * cells }, () => rnd());
  const at = (i, j) => g[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)];
  return (x, y) => {
    const fx = (x / w) * cells, fy = (y / h) * cells;
    const i = Math.floor(fx), j = Math.floor(fy);
    let u = fx - i, v = fy - j;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  };
}

function fbm(w, h, rnd, octaves = [4, 8, 16, 32, 64]) {
  const ns = octaves.map((c) => tileNoise(w, h, c, rnd));
  return (x, y) => {
    let s = 0, a = 0.5, n = 0;
    for (const f of ns) { s += f(x, y) * a; n += a; a *= 0.55; }
    return s / n;
  };
}

function paintNoise(ctx, w, h, rnd, base, amp, grain = 6, fn = null) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const f = fn || fbm(w, h, rnd);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const n = (f(x, y) - 0.5) * amp + (rnd() - 0.5) * grain;
      d[i] = Math.max(0, Math.min(255, (base ? base[0] : d[i]) + n));
      d[i + 1] = Math.max(0, Math.min(255, (base ? base[1] : d[i + 1]) + n));
      d[i + 2] = Math.max(0, Math.min(255, (base ? base[2] : d[i + 2]) + n * 0.95));
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Painted plaster (4 m tile): warm off-white with faint trowel marks & stains
export function plasterTexture(seed = 1, base = [238, 234, 229]) {
  const w = 512, h = 512, c = canvas(w, h), ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  paintNoise(ctx, w, h, rnd, base, 10, 3);
  // faint vertical weathering streaks
  for (let i = 0; i < 40; i++) {
    const x = rnd() * w, y = rnd() * h, len = 40 + rnd() * 160;
    const gr = ctx.createLinearGradient(0, y, 0, y + len);
    gr.addColorStop(0, 'rgba(120,110,100,0.05)'); gr.addColorStop(1, 'rgba(120,110,100,0)');
    ctx.fillStyle = gr; ctx.fillRect(x, y, 1.5 + rnd() * 3, len);
  }
  return tex(c);
}

// Laterite blocks (2 m tile): Kerala's orange-red porous stone in running bond
export function lateriteTexture(seed = 2) {
  const w = 1024, h = 1024, c = canvas(w, h), ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  const ppm = w / 2, bw = 0.4 * ppm, bh = 0.2 * ppm, m = 0.012 * ppm;
  ctx.fillStyle = 'rgb(176,160,140)'; ctx.fillRect(0, 0, w, h);
  for (let r = 0; r < h / bh; r++) {
    const off = (r % 2) * bw / 2;
    for (let k = -1; k < w / bw + 1; k++) {
      const x = k * bw + off, y = r * bh;
      const hue = 14 + rnd() * 12, sat = 45 + rnd() * 18, lig = 34 + rnd() * 12;
      ctx.fillStyle = `hsl(${hue},${sat}%,${lig}%)`;
      ctx.fillRect(x + m / 2, y + m / 2, bw - m, bh - m);
      // pores and yellow ochre inclusions
      for (let p = 0; p < 26; p++) {
        const px = x + m + rnd() * (bw - 2 * m), py = y + m + rnd() * (bh - 2 * m);
        ctx.fillStyle = rnd() < 0.7 ? `rgba(60,25,15,${0.25 + rnd() * 0.35})` : `rgba(210,150,80,${0.25 + rnd() * 0.3})`;
        ctx.beginPath(); ctx.ellipse(px, py, 1 + rnd() * 4, 1 + rnd() * 3, rnd() * 3, 0, 7); ctx.fill();
      }
    }
  }
  paintNoise(ctx, w, h, rnd, null, 18, 8);
  return tex(c);
}

// Raw cast concrete (2 m tile) with plywood formwork seams
export function concreteTexture(seed = 3, base = [152, 150, 145]) {
  const w = 512, h = 512, c = canvas(w, h), ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  paintNoise(ctx, w, h, rnd, base, 30, 10);
  ctx.strokeStyle = 'rgba(80,78,74,0.25)'; ctx.lineWidth = 1.2;
  for (let y = 0; y < h; y += h / 1.6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  for (let x = 0; x < w; x += w / 1.6) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '90,88,84' : '190,188,182'},${0.05 + rnd() * 0.08})`;
    ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 4 + rnd() * 30, 0, 7); ctx.fill();
  }
  return tex(c);
}

// Corrugated profile normal map: 5 ribs per metre along U
export function corrugationNormal() {
  const w = 256, h = 4, c = canvas(w, h), ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let x = 0; x < w; x++) {
    const u = (x / w) * 5 * Math.PI * 2;
    const slope = Math.cos(u) * 0.55 + Math.cos(u * 2) * 0.12;
    const nx = -slope, nz = 1;
    const l = Math.hypot(nx, nz);
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = 128;
      img.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
}

// Metal sheet albedo (1 m x 4 m): per-rib variation + dirt streaks down slope
export function sheetTexture(seed, base, { rust = 0, fade = 0 } = {}) {
  const w = 256, h = 1024, c = canvas(w, h), ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  paintNoise(ctx, w, h, rnd, base, 12, 3, fbm(w, h, rnd, [2, 4, 8]));
  for (let i = 0; i < 90; i++) {
    const x = rnd() * w, y = rnd() * h, len = 60 + rnd() * 420;
    const col = rust && rnd() < rust ? '120,55,30' : fade && rnd() < fade ? '235,215,210' : '70,70,68';
    const gr = ctx.createLinearGradient(0, y, 0, y + len);
    gr.addColorStop(0, `rgba(${col},0.10)`); gr.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gr; ctx.fillRect(x, y, 1 + rnd() * 4, len);
  }
  return tex(c);
}

// Mangalore clay tiles: 1 m (u) x one course (v)
export function tileTexture(seed = 5) {
  const w = 512, h = 192, c = canvas(w, h), ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  const n = 4, tw = w / n;
  for (let i = 0; i < n; i++) {
    const hue = 348 + rnd() * 10, lig = 23 + rnd() * 6;
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, `hsl(${hue},38%,${lig - 8}%)`);
    gr.addColorStop(0.75, `hsl(${hue},40%,${lig + 2}%)`);
    gr.addColorStop(1, `hsl(${hue},36%,${lig - 6}%)`);
    ctx.fillStyle = gr; ctx.fillRect(i * tw, 0, tw, h);
    // two raised ribs per tile
    for (const rx of [0.33, 0.67]) {
      const g2 = ctx.createLinearGradient(i * tw + rx * tw - 8, 0, i * tw + rx * tw + 8, 0);
      g2.addColorStop(0, 'rgba(0,0,0,0.18)'); g2.addColorStop(0.5, 'rgba(255,220,220,0.14)'); g2.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = g2; ctx.fillRect(i * tw + rx * tw - 8, 0, 16, h * 0.9);
    }
    ctx.fillStyle = 'rgba(20,5,8,0.55)'; ctx.fillRect(i * tw, 0, 3, h);
  }
  paintNoise(ctx, w, h, rnd, null, 16, 6);
  ctx.fillStyle = 'rgba(15,4,6,0.45)'; ctx.fillRect(0, h - 10, w, 10);
  return tex(c);
}

// Red interlocking pavers, herringbone (2 m tile)
export function paverTexture(seed = 6) {
  const w = 1024, h = 1024, c = canvas(w, h), ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  const ppm = w / 2, L = 0.2 * ppm, S = 0.1 * ppm;
  ctx.fillStyle = 'rgb(62,40,34)'; ctx.fillRect(0, 0, w, h);
  const brick = (x, y, bw, bh) => {
    const t = rnd();
    const col = t < 0.08 ? [70, 62, 60] : t < 0.16 ? [140, 120, 105] : [120 + rnd() * 30, 52 + rnd() * 18, 42 + rnd() * 12];
    ctx.fillStyle = `rgb(${col.map((v) => v | 0).join(',')})`;
    ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
  };
  for (let j = -2; j < h / S + 2; j++) {
    for (let i = -2; i < w / L + 2; i++) {
      const ox = i * L + (j % 2) * S, oy = j * S;
      if ((i + j) % 2 === 0) brick(ox, oy, L, S); else brick(ox, oy, S, L);
    }
  }
  paintNoise(ctx, w, h, rnd, null, 22, 10);
  return tex(c);
}

// Grey square plaza tiles (2.4 m tile, 0.3 m modules)
export function plazaTexture(seed = 7) {
  const w = 512, h = 512, c = canvas(w, h), ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  const n = 8, s = w / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const g = 160 + rnd() * 26;
    ctx.fillStyle = `rgb(${g},${g + 2},${g})`; ctx.fillRect(i * s, j * s, s, s);
    ctx.strokeStyle = 'rgba(95,98,96,0.8)'; ctx.lineWidth = 2; ctx.strokeRect(i * s + 1, j * s + 1, s - 2, s - 2);
  }
  paintNoise(ctx, w, h, rnd, null, 14, 6);
  return tex(c);
}

export function apronTexture(seed = 8) {
  const w = 512, h = 512, c = canvas(w, h), ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  paintNoise(ctx, w, h, rnd, [158, 160, 156], 24, 8);
  ctx.strokeStyle = 'rgba(80,80,78,0.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(w, 1); ctx.moveTo(1, 0); ctx.lineTo(1, h); ctx.stroke();
  return tex(c);
}

// Red laterite soil (8 m tile)
export function soilTexture(seed = 9) {
  const w = 1024, h = 1024, c = canvas(w, h), ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  paintNoise(ctx, w, h, rnd, [150, 88, 58], 46, 18);
  for (let i = 0; i < 1400; i++) {
    const g = 100 + rnd() * 100;
    ctx.fillStyle = `rgba(${g + 30},${g * 0.7},${g * 0.5},${0.25 + rnd() * 0.4})`;
    ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 0.6 + rnd() * 2.2, 0, 7); ctx.fill();
  }
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(95,55,38,${0.08 + rnd() * 0.08})`;
    ctx.beginPath(); ctx.ellipse(rnd() * w, rnd() * h, 30 + rnd() * 120, 20 + rnd() * 80, rnd() * 3, 0, 7); ctx.fill();
  }
  return tex(c);
}

export function grassTexture(seed = 10) {
  const w = 512, h = 512, c = canvas(w, h), ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  paintNoise(ctx, w, h, rnd, [74, 108, 48], 40, 14);
  for (let i = 0; i < 6000; i++) {
    const x = rnd() * w, y = rnd() * h;
    ctx.strokeStyle = `rgba(${50 + rnd() * 60},${90 + rnd() * 70},${30 + rnd() * 30},0.5)`;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * 4, y - 3 - rnd() * 5); ctx.stroke();
  }
  return tex(c);
}

// School name boards (white serif lettering on blue-grey, as in the video)
export function signTexture(text, aspect) {
  const h = 192, w = Math.round(h * aspect), c = canvas(w, h), ctx = c.getContext('2d');
  const gr = ctx.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#5f8aa3'); gr.addColorStop(1, '#4a7289');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#26394a'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.strokeRect(16, 16, w - 32, h - 32);
  const size = h * 0.62;
  ctx.font = `bold ${size}px "Liberation Serif", "DejaVu Serif", "Times New Roman", serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const spaced = text.split('').join(' ');
  const measure = ctx.measureText(spaced).width;
  const sx = Math.min(1, (w * 0.9) / measure);
  ctx.save(); ctx.translate(w / 2, h / 2 + h * 0.03); ctx.scale(sx, 1);
  ctx.fillStyle = 'rgba(10,20,30,0.55)'; ctx.fillText(spaced, 4, 5);
  ctx.fillStyle = '#f8f7f2'; ctx.fillText(spaced, 0, 0);
  ctx.restore();
  return tex(c, { repeat: false });
}

// Small text plate (bus destination boards)
export function plateTexture(text, fg = '#111', bg = '#f2c200') {
  const w = 512, h = 96, c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.font = 'bold 70px "Liberation Sans", "DejaVu Sans", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = fg;
  ctx.fillText(text, w / 2, h / 2 + 4);
  return tex(c, { repeat: false });
}

// Palm frond leaflets (alpha-tested card)
export function frondTexture(seed = 11) {
  const w = 512, h = 128, c = canvas(w, h), ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.clearRect(0, 0, w, h);
  for (let x = 4; x < w - 2; x += 5) {
    const l = (h / 2 - 3) * Math.sin((x / w) * Math.PI * 0.92 + 0.2);
    for (const sgn of [-1, 1]) {
      const g = 60 + rnd() * 40;
      ctx.strokeStyle = `rgb(${g * 0.55 | 0},${g | 0},${g * 0.3 | 0})`;
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(x, h / 2); ctx.quadraticCurveTo(x + 6, h / 2 + sgn * l * 0.6, x + 14, h / 2 + sgn * l); ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgb(88,92,40)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
  return tex(c, { repeat: false });
}
