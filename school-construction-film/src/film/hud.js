// HUD layer: opening title, phase captions with a construction timeline,
// closing title and fades. Drawn on a 2D canvas and composited in WebGL so
// the offline renderer captures it in the same frame.
import * as THREE from 'three';
import { smoothstep, clamp } from '../core/math.js';

export const CAPTIONS = [
  { from: 0.000, to: 0.050, n: '01', title: 'Empty site', sub: 'Setting out the footprint' },
  { from: 0.050, to: 0.155, n: '02', title: 'Foundation', sub: 'Footings, pedestals, plinth beams, plinth slab' },
  { from: 0.155, to: 0.235, n: '03', title: 'Structural frame', sub: 'RCC columns and beams, floor by floor' },
  { from: 0.235, to: 0.300, n: '04', title: 'Floor slabs', sub: 'Slab panels poured across each floor' },
  { from: 0.300, to: 0.405, n: '05', title: 'Masonry walls', sub: 'Laterite blockwork, course by course' },
  { from: 0.405, to: 0.475, n: '06', title: 'Windows, doors & jali', sub: 'Frames first, glazing after' },
  { from: 0.475, to: 0.560, n: '07', title: 'Arcades & sunshades', sub: 'Chajjas, floor bands, corbels, porch' },
  { from: 0.560, to: 0.665, n: '08', title: 'Roof', sub: 'Parapets, steel trusses, purlins, sheets, clay tiles' },
  { from: 0.665, to: 0.790, n: '09', title: 'Finishing', sub: 'Plaster, paint, trims and signage' },
  { from: 0.790, to: 0.905, n: '10', title: 'Site works', sub: 'Paving, landscaping, the bus fleet arrives' },
];

export class Hud {
  constructor(renderer, width, height, { enabled = true } = {}) {
    this.renderer = renderer;
    this.enabled = enabled;
    this.canvas = document.createElement('canvas');
    this.resize(width, height);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    this.scene.add(quad);
  }

  resize(w, h) { this.w = w; this.h = h; this.canvas.width = w; this.canvas.height = h; }

  draw(T, { cameraLabel = '', showCamera = false } = {}) {
    const ctx = this.canvas.getContext('2d');
    const { w, h } = this;
    ctx.clearRect(0, 0, w, h);
    const u = h / 1080;
    const sans = '"Liberation Sans", "DejaVu Sans", Helvetica, Arial, sans-serif';
    const serif = '"Liberation Serif", "DejaVu Serif", Georgia, serif';
    ctx.textBaseline = 'alphabetic';

    if (this.enabled) {
      // opening title
      const aT = smoothstep(0.006, 0.02, T) * (1 - smoothstep(0.052, 0.07, T));
      if (aT > 0.001) this.title(ctx, 'DE PAUL PUBLIC SCHOOL', 'A procedural construction film  ·  reconstructed from aerial reference', aT, u, serif, sans);
      // closing title
      const aE = smoothstep(0.918, 0.94, T) * (1 - smoothstep(0.985, 0.998, T));
      if (aE > 0.001) {
        // closing card sits where the phase captions were, clear of the building
        ctx.save();
        ctx.globalAlpha = aE;
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 14 * u;
        const x = 96 * u, y = h - 118 * u;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = `600 ${22 * u}px ${sans}`;
        ctx.fillText('COMPLETED', x, y - 58 * u);
        ctx.fillStyle = '#ffffff';
        ctx.font = `${56 * u}px ${serif}`;
        ctx.fillText('De Paul Public School', x, y);
        ctx.font = `${22 * u}px ${sans}`;
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillText('G+3 courtyard block, pavilion and tower  ·  reconstructed from aerial reference', x, y + 40 * u);
        ctx.restore();
      }
      // phase caption
      const cap = CAPTIONS.find((c) => T >= c.from && T < c.to);
      if (cap && T > 0.045) {
        const a = smoothstep(cap.from, cap.from + 0.008, T) * (1 - smoothstep(cap.to - 0.006, cap.to, T));
        const x = 96 * u, y = h - 132 * u;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 12 * u;
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.font = `600 ${22 * u}px ${sans}`;
        ctx.fillText(`${cap.n} / 10`, x, y - 44 * u);
        ctx.fillStyle = '#ffffff';
        ctx.font = `${46 * u}px ${serif}`;
        ctx.fillText(cap.title, x, y);
        ctx.font = `${22 * u}px ${sans}`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(cap.sub, x, y + 36 * u);
        ctx.restore();
      }
      // construction timeline
      const tl = smoothstep(0.045, 0.06, T) * (1 - smoothstep(0.905, 0.925, T));
      if (tl > 0.001) {
        const x0 = 96 * u, x1 = w - 96 * u, y = h - 56 * u, gap = 6 * u;
        const segW = (x1 - x0 - gap * 9) / 10;
        ctx.save();
        ctx.globalAlpha = tl;
        CAPTIONS.forEach((c, i) => {
          const sx = x0 + i * (segW + gap);
          const p = clamp((T - c.from) / (c.to - c.from));
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.fillRect(sx, y, segW, 3 * u);
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.fillRect(sx, y, segW * p, 3 * u);
        });
        ctx.restore();
      }
      if (showCamera && cameraLabel) {
        ctx.save();
        ctx.font = `${18 * u}px ${sans}`; ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.textAlign = 'right';
        ctx.fillText(cameraLabel, w - 96 * u, 72 * u);
        ctx.restore();
      }
    }
    // fade from / to black
    const black = 1 - smoothstep(0.0, 0.022, T) + smoothstep(0.991, 1.0, T);
    if (black > 0.001) { ctx.fillStyle = `rgba(0,0,0,${clamp(black)})`; ctx.fillRect(0, 0, w, h); }
    this.texture.needsUpdate = true;
  }

  title(ctx, big, small, a, u, serif, sans, yf = 0.44) {
    const { w, h } = this;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18 * u;
    ctx.fillStyle = '#ffffff';
    ctx.font = `${64 * u}px ${serif}`;
    const spaced = big.split('').join(' ');
    ctx.fillText(spaced, w / 2, h * yf);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(w / 2 - 60 * u, h * yf + 26 * u, 120 * u, 1.5 * u);
    ctx.font = `${24 * u}px ${sans}`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(small, w / 2, h * yf + 68 * u);
    ctx.restore();
  }

  render() {
    const r = this.renderer;
    const ac = r.autoClear;
    r.autoClear = false;
    r.setRenderTarget(null);
    r.render(this.scene, this.cam);
    r.autoClear = ac;
  }
}
