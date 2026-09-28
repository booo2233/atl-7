// Parametric architectural part modules. Each function returns a module key;
// identical parameters return the same key, so geometry is shared (instanced).
import * as THREE from 'three';
import { MODULES } from '../core/modules.js';
import { box, merge, xf, lattice, archSpandrel, cylinder, strut, sheet, ANCHOR } from '../core/geometry.js';

const k = (...a) => a.map((v) => (typeof v === 'number' ? v.toFixed(3) : v)).join(':');

// Window frame (outer frame + mullions + transom), in the wall plane (XY),
// origin bottom-centre. Dark aluminium sections as seen in the reference.
export function windowFrame(w, h, panes = null) {
  const n = panes ?? (w > 1.8 ? 3 : w > 0.95 ? 2 : 1);
  return MODULES.define(k('winframe', w, h, n), () => {
    const f = 0.055, d = 0.07, parts = [];
    parts.push(xf(box(w, f, d, { anchor: ANCHOR.bottom }), { t: [0, 0, 0] }));
    parts.push(xf(box(w, f, d, { anchor: ANCHOR.bottom }), { t: [0, h - f, 0] }));
    parts.push(xf(box(f, h, d, { anchor: ANCHOR.bottom }), { t: [-w / 2 + f / 2, 0, 0] }));
    parts.push(xf(box(f, h, d, { anchor: ANCHOR.bottom }), { t: [w / 2 - f / 2, 0, 0] }));
    for (let i = 1; i < n; i++) parts.push(xf(box(0.04, h, d * 0.9, { anchor: ANCHOR.bottom }), { t: [-w / 2 + (w * i) / n, 0, 0] }));
    if (h > 1.3) parts.push(xf(box(w, 0.04, d * 0.9, { anchor: ANCHOR.bottom }), { t: [0, h * 0.72, 0] }));
    // sill nosing (outside)
    parts.push(xf(box(w + 0.02, 0.04, 0.16, { anchor: ANCHOR.bottom }), { t: [0, -0.04, 0.06] }));
    return merge(parts);
  });
}

export function glassPane(w, h) {
  return MODULES.define(k('glass', w, h), () => box(w - 0.07, h - 0.07, 0.012, { anchor: ANCHOR.bottom }).translate(0, 0.035, 0));
}

export function doorLeaf(w, h) {
  return MODULES.define(k('door', w, h), () => {
    const parts = [box(w - 0.06, h - 0.04, 0.045, { anchor: ANCHOR.bottom })];
    // raised panels
    for (const yy of [0.25, 1.15]) parts.push(xf(box(w - 0.36, 0.72, 0.02, { anchor: ANCHOR.bottom }), { t: [0, yy, 0.03] }));
    return merge(parts);
  });
}

export function doorFrame(w, h) {
  return MODULES.define(k('doorframe', w, h), () => {
    const f = 0.07, d = 0.16, parts = [];
    parts.push(xf(box(w, f, d, { anchor: ANCHOR.bottom }), { t: [0, h - f, 0] }));
    parts.push(xf(box(f, h, d, { anchor: ANCHOR.bottom }), { t: [-w / 2 + f / 2, 0, 0] }));
    parts.push(xf(box(f, h, d, { anchor: ANCHOR.bottom }), { t: [w / 2 - f / 2, 0, 0] }));
    return merge(parts);
  });
}

// Jali (breeze-block grille) panel, origin bottom-centre
export function jaliPanel(w, h, cell = 0.16) {
  return MODULES.define(k('jali', w, h, cell), () => {
    const parts = [lattice(w - 0.04, h, 0.06, cell, 0.035)];
    return merge(parts);
  });
}

// Arcade spandrel (segmental arch between two piers), origin at springing
export function spandrel(w, h, rise, t) {
  return MODULES.define(k('spandrel', w, h, rise, t), () => archSpandrel(w, h, rise, t, Math.min(0.26, w * 0.08)));
}

// Pier capital / corbel block at arch springing
export function corbel(w, t) {
  return MODULES.define(k('corbel', w, t), () => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + 0.1, 0); s.lineTo(w / 2 - 0.1, 0); s.lineTo(w / 2, 0.18); s.lineTo(w / 2, 0.28);
    s.lineTo(-w / 2, 0.28); s.lineTo(-w / 2, 0.18); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
    g.translate(0, 0, -t / 2);
    return g;
  });
}

// Chajja: thin cantilevered sunshade slab with a drip edge, origin at the
// wall face (back edge), bottom.
export function chajja(w, depth) {
  return MODULES.define(k('chajja', w, depth), () => merge([
    box(w, 0.08, depth, { anchor: ANCHOR.bottomBack, bevel: 0.01 }),
    xf(box(w, 0.1, 0.05, { anchor: ANCHOR.bottomBack }), { t: [0, -0.06, depth - 0.05] }),
  ]));
}

// Lavender trim strip: origin at x-start so it can "unroll" along the band
export function trimStrip(len, h = 0.07, t = 0.025) {
  return MODULES.define(k('trim', len, h, t), () => box(len, h, t, { anchor: ANCHOR.bottomStart }));
}

// Round porch column with moulded base and capital (pavilion twin columns)
export function porchColumn(h) {
  return MODULES.define(k('porchcol', h), () => {
    const parts = [];
    parts.push(box(0.5, 0.32, 0.5, { anchor: ANCHOR.bottom, bevel: 0.02 }));
    parts.push(xf(cylinder(0.24, 0.1, { seg: 20 }), { t: [0, 0.32, 0] }));
    parts.push(xf(cylinder(0.18, h - 0.72, { seg: 20 }), { t: [0, 0.42, 0] }));
    for (const yy of [0.9, h - 0.62]) parts.push(xf(cylinder(0.205, 0.06, { seg: 20 }), { t: [0, yy, 0] }));
    parts.push(xf(cylinder(0.26, 0.12, { seg: 20, rTop: 0.2 }), { t: [0, h - 0.3, 0] }));
    parts.push(xf(box(0.52, 0.18, 0.52, { anchor: ANCHOR.bottom }), { t: [0, h - 0.18, 0] }));
    return merge(parts);
  });
}

// Steel roof truss spanning local X from -span/2..span/2, bottom chord at y=0.
// side = 0: full gable truss; side = +1/-1: half (mono-pitch) truss on that
// side of the ridge only.
export function roofTruss(span, rise, overhang, side = 0) {
  return MODULES.define(k('truss', span, rise, overhang, side), () => {
    const h = span / 2, parts = [];
    const sides = side === 0 ? [-1, 1] : [side];
    const chord = 0.09;
    const slope = rise / h;
    const x0 = side === 0 ? -h : side < 0 ? -h : 0, x1 = side === 0 ? h : side < 0 ? 0 : h;
    parts.push(strut([x0, 0, 0], [x1, 0, 0], chord, 0.07));
    for (const sgn of sides) {
      const e = [sgn * (h + overhang), -overhang * slope, 0];
      parts.push(strut(e, [0, rise, 0], chord, 0.07));
    }
    parts.push(strut([0, 0, 0], [0, rise, 0], 0.07, 0.07));
    const n = 3;
    for (let i = 1; i < n; i++) {
      const x = (h * i) / n;
      for (const sgn of sides) {
        parts.push(strut([sgn * x, 0, 0], [sgn * x, rise * (1 - x / h), 0], 0.045, 0.045));
        parts.push(strut([sgn * x, 0, 0], [sgn * (x - h / n), rise * (1 - (x - h / n) / h), 0], 0.04, 0.04));
      }
    }
    for (const sgn of sides) parts.push(xf(box(0.3, 0.22, 0.02, { anchor: ANCHOR.center }), { t: [sgn * (h - 0.15), 0.05, 0.045] }));
    return merge(parts);
  });
}

// Corrugated metal sheet panel, lying in XZ, local X along the ridge
// (width), local Z along the slope (length); origin at centre.
export function roofSheet(width, length) {
  return MODULES.define(k('sheet', width, length), () => {
    const top = sheet(width, length);
    // thin return at the eave edge to read as a real sheet profile
    const lip = xf(box(width, 0.035, 0.02, { anchor: ANCHOR.center }), { t: [0, -0.0175, length / 2] });
    return merge([top, lip]);
  });
}

export { k as moduleKey };
