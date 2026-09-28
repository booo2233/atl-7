// Temporary works: a tower crane in the courtyard. It is erected section by
// section at the start, slews its jib to wherever work is happening (the
// centroid of the elements being installed at that moment), runs its trolley
// out and lowers its hook to the working level, and is dismantled - top parts
// first, then the mast top-down - before the site works begin.
import * as THREE from 'three';
import { MODULES } from '../core/modules.js';
import { box, merge, xf, strut, cylinder, ANCHOR } from '../core/geometry.js';
import { gaussianSmooth, clamp, smoothstep } from '../core/math.js';

export const CRANE = { cx: 9, cz: -3, sections: 10, secH: 3.0, base: 0.3, jibLen: 50, cjLen: 14, r0: 20 };
CRANE.mastTop = CRANE.base + CRANE.sections * CRANE.secH;
CRANE.jibY = CRANE.mastTop + 1.2;

function mastSection() {
  return MODULES.define('crane:mast', () => {
    const w = 1.8, h = CRANE.secH, c = 0.14, p = [];
    const corners = [[-w / 2, -w / 2], [w / 2, -w / 2], [w / 2, w / 2], [-w / 2, w / 2]];
    for (const [x, z] of corners) p.push(xf(box(c, h, c, { anchor: ANCHOR.bottom }), { t: [x, 0, z] }));
    for (let i = 0; i < 4; i++) {
      const [x0, z0] = corners[i], [x1, z1] = corners[(i + 1) % 4];
      p.push(strut([x0, 0.05, z0], [x1, 0.05, z1], 0.08));
      p.push(strut([x0, 0.05, z0], [x1, h - 0.05, z1], 0.07));
      p.push(strut([x1, h / 2, z1], [x0, h - 0.05, z0], 0.06));
    }
    return merge(p);
  });
}

function jib(len, start) {
  return MODULES.define(`crane:jib:${len}`, () => {
    const p = [], hh = 1.6, hw = 0.8, step = 2.5;
    p.push(strut([start, 0, -hw], [start + len, 0, -hw], 0.12), strut([start, 0, hw], [start + len, 0, hw], 0.12));
    p.push(strut([start, hh, 0], [start + len - 1.2, hh * 0.6, 0], 0.12));
    for (let x = start; x < start + len - 0.1; x += step) {
      const topY = hh - ((x - start) / len) * hh * 0.4;
      p.push(strut([x, 0, -hw], [x, 0, hw], 0.06));
      p.push(strut([x, 0, -hw], [x + step / 2, topY, 0], 0.06), strut([x, 0, hw], [x + step / 2, topY, 0], 0.06));
      p.push(strut([x + step / 2, topY, 0], [Math.min(start + len, x + step), 0, -hw], 0.06), strut([x + step / 2, topY, 0], [Math.min(start + len, x + step), 0, hw], 0.06));
    }
    return merge(p);
  });
}

function counterJib(len) {
  return MODULES.define(`crane:cj:${len}`, () => {
    const p = [], hw = 1.0;
    p.push(strut([-0.9, 0, -hw], [-len, 0, -hw], 0.16), strut([-0.9, 0, hw], [-len, 0, hw], 0.16));
    for (let x = -0.9; x > -len; x -= 2) p.push(strut([x, 0, -hw], [x, 0, hw], 0.08), strut([x, 0, -hw], [x - 2, 0, hw], 0.06));
    p.push(xf(box(len - 1, 0.04, 1.6, { anchor: ANCHOR.center }), { t: [-(len + 0.9) / 2, 0.1, 0] }));
    // hoist winch
    p.push(xf(box(1.6, 1.1, 1.4, { anchor: ANCHOR.bottom }), { t: [-5, 0.1, 0] }));
    return merge(p);
  });
}

function head() {
  return MODULES.define('crane:head', () => {
    const p = [], w = 0.9, h = 6.5;
    for (const [x, z] of [[-w, -w], [w, -w], [w, w], [-w, w]]) p.push(strut([x, 0, z], [0, h, 0], 0.14));
    p.push(xf(box(2.6, 1.3, 2.6, { anchor: ANCHOR.bottom }), { t: [0, -1.25, 0] }));   // slewing ring / turntable
    return merge(p);
  });
}

export function createCraneElements(ES, L) {
  const { cx, cz, secH, base } = CRANE;
  const tags = (step, extra = {}) => ({ wing: 'C', s: 0.5, step, ...extra });
  const T = (o) => ES.add({ temporary: true, category: 'temp', ...o });
  T({ system: 'crane', group: 'crane.base', module: MODULES.define('crane:base', () => box(6, 1.3, 6, { anchor: ANCHOR.bottom, bevel: 0.03 })), material: 'ballast',
    pos: [cx, base - 1.3, cz], anim: { type: 'emerge', remove: 'sink' }, order: 0, tags: tags(0) });
  for (let k = 0; k < CRANE.sections; k++) {
    T({ system: 'crane', group: 'crane.mast', module: mastSection(), material: 'crane', pos: [cx, base + k * secH, cz],
      anim: { type: 'mast', remove: 'lower' }, order: 0, tags: tags(k) });
  }
  const yTop = CRANE.mastTop + 1.25;
  const top = [
    { mod: head(), mat: 'crane', pos: [cx, yTop, cz], step: 0 },
    { mod: MODULES.define('crane:cab', () => box(1.7, 2.1, 1.9, { anchor: ANCHOR.bottom, bevel: 0.05 })), mat: 'crane', pos: [cx + 0.2, CRANE.mastTop - 0.1, cz + 2.2], step: 0 },
    { mod: MODULES.define('crane:cabglass', () => box(1.72, 0.9, 1.4, { anchor: ANCHOR.bottom })), mat: 'busGlass', pos: [cx + 0.2, CRANE.mastTop + 0.95, cz + 2.4], step: 0 },
    { mod: jib(CRANE.jibLen, 0.9), mat: 'crane', pos: [cx, CRANE.jibY, cz], step: 1 },
    { mod: counterJib(CRANE.cjLen), mat: 'crane', pos: [cx, CRANE.jibY, cz], step: 1 },
    { mod: MODULES.define('crane:ballast', () => merge([0, 1, 2].map((i) => xf(box(0.6, 2.2, 2.0, { anchor: ANCHOR.bottom }), { t: [-(CRANE.cjLen - 1.4) + i * 0.65, 0, 0] })))),
      mat: 'ballast', pos: [cx, CRANE.jibY - 1.9, cz], step: 2 },
    { mod: MODULES.define('crane:ties', () => {
      const apex = [0, yTop + 6.5 - CRANE.jibY, 0];
      return merge([
        strut(apex, [26, 1.1, 0], 0.07), strut(apex, [CRANE.jibLen - 3, 0.75, 0], 0.06),
        strut(apex, [-CRANE.cjLen + 0.5, 0.1, -0.9], 0.07), strut(apex, [-CRANE.cjLen + 0.5, 0.1, 0.9], 0.07),
      ]);
    }), mat: 'cable', pos: [cx, CRANE.jibY, cz], step: 2 },
  ];
  for (const t of top) {
    T({ system: 'crane', group: 'crane.top', module: t.mod, material: t.mat, pos: t.pos, rig: 'slew',
      anim: { type: t.step === 1 ? 'lift' : 'drop', dist: t.step === 1 ? 8 : 3, remove: 'lower' }, order: 0, tags: tags(t.step) });
  }
  // trolley, hoist cable and hook block
  const tr = CRANE.r0;
  T({ system: 'crane', group: 'crane.top', module: MODULES.define('crane:trolley', () => box(1.5, 0.45, 1.8, { anchor: ANCHOR.top })), material: 'craneDark',
    pos: [cx + tr, CRANE.jibY - 0.02, cz], rig: 'trolley', anim: { type: 'drop', dist: 2, remove: 'lower' }, order: 0, tags: tags(3) });
  T({ system: 'crane', group: 'crane.top', module: MODULES.define('crane:cable', () => merge([
    xf(cylinder(0.018, 1, { seg: 5 }), { t: [0, -1, -0.12] }), xf(cylinder(0.018, 1, { seg: 5 }), { t: [0, -1, 0.12] })])), material: 'cable',
    pos: [cx + tr, CRANE.jibY - 0.47, cz], rig: 'cable', anim: { type: 'drop', dist: 2, remove: 'lower' }, order: 0, tags: tags(3) });
  T({ system: 'crane', group: 'crane.top', module: MODULES.define('crane:hook', () => merge([
    box(0.55, 0.8, 0.45, { anchor: ANCHOR.top, bevel: 0.03 }), xf(cylinder(0.06, 0.45, { seg: 8 }), { t: [0, -1.2, 0] })])), material: 'crane',
    pos: [cx + tr, CRANE.jibY - 1.47, cz], rig: 'hook', anim: { type: 'drop', dist: 2, remove: 'lower' }, order: 0, tags: tags(3) });
  void L; void THREE;
}

// ---- runtime rig: slew angle / trolley radius / hook height from the schedule ----------
const WORK = new Set(['found', 'frame', 'slab', 'wall', 'opening', 'feature', 'roofframe', 'roofcover', 'glass']);

export function setupCraneRigs(runtime, elements) {
  const { cx, cz, jibY, r0 } = CRANE;
  const N = 720;
  const angle = new Float64Array(N + 1), radius = new Float64Array(N + 1), hookY = new Float64Array(N + 1);
  const work = elements.filter((e) => !e.temporary && WORK.has(e.category)).map((e) => {
    const b = e.bbox();
    return { t0: e.t0, t1: e.t1, x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2, top: b.max.y };
  }).sort((a, b) => a.t0 - b.t0);
  const cranes = elements.filter((e) => e.system === 'crane');
  const dismantle = Math.min(...cranes.filter((e) => e.rm0 != null && e.group === 'crane.top').map((e) => e.rm0));
  let pa = -Math.PI / 2, pr = r0, ph = 6;
  for (let i = 0; i <= N; i++) {
    const T = i / N;
    let sx = 0, sz = 0, n = 0, top = 0;
    for (const w of work) {
      if (w.t0 > T + 0.012) break;
      if (w.t1 < T - 0.004) continue;
      sx += w.x; sz += w.z; n++; top = Math.max(top, w.top);
    }
    if (n > 0) {
      const dx = sx / n - cx, dz = sz / n - cz;
      pa = Math.atan2(-dz, dx);
      pr = clamp(Math.hypot(dx, dz), 6, CRANE.jibLen - 3);
      ph = top + 3.5;
    }
    // before dismantling, park the jib over the open courtyard mouth (+Z)
    const park = smoothstep(dismantle - 0.03, dismantle - 0.004, T);
    angle[i] = pa; radius[i] = pr * (1 - park) + 12 * park; hookY[i] = ph * (1 - park) + (jibY - 4) * park;
    if (park > 0) angle[i] = pa + (wrap(-Math.PI / 2 - pa)) * park;
  }
  // unwrap + smooth
  for (let i = 1; i <= N; i++) angle[i] = angle[i - 1] + wrap(angle[i] - angle[i - 1]);
  const A = gaussianSmooth(angle, 9), R = gaussianSmooth(radius, 9), H = gaussianSmooth(hookY, 7);
  const sample = (arr, T) => {
    const f = clamp(T) * N, i = Math.floor(f), t = f - i;
    return i >= N ? arr[N] : arr[i] * (1 - t) + arr[i + 1] * t;
  };
  const C = new THREE.Vector3(cx, 0, cz);
  const mSlew = (T) => new THREE.Matrix4().makeTranslation(C.x, 0, C.z)
    .multiply(new THREE.Matrix4().makeRotationY(sample(A, T))).multiply(new THREE.Matrix4().makeTranslation(-C.x, 0, -C.z));
  const mTrolley = (T) => mSlew(T).multiply(new THREE.Matrix4().makeTranslation(sample(R, T) - r0, 0, 0));
  const cableLen = (T) => clamp(jibY - 0.47 - sample(H, T), 1.5, jibY - 2);
  runtime.rigs.set('slew', (T) => mSlew(T));
  runtime.rigs.set('trolley', (T) => mTrolley(T));
  runtime.rigs.set('cable', (T, e) => {
    const p = new THREE.Vector3(...e.pos);
    return mTrolley(T).multiply(new THREE.Matrix4().makeTranslation(p.x, p.y, p.z))
      .multiply(new THREE.Matrix4().makeScale(1, cableLen(T), 1)).multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
  });
  runtime.rigs.set('hook', (T) => mTrolley(T).multiply(new THREE.Matrix4().makeTranslation(0, -(cableLen(T) - 1), 0)));
  return { angle: A, radius: R, hook: H };
}

function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
