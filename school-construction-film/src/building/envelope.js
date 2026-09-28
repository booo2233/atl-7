// Building envelope: masonry walls (laid course by course), openings,
// courtyard arcades with jali, sunshades, floor bands, parapets, trims and
// rainwater pipes. One "bay plan" is computed per facade bay and the
// create_* functions emit the elements of their category from it.
import { BUILDING as B, ROOF_LEVEL } from '../config.js';
import { boxModule } from '../core/modules.js';
import { cylinder } from '../core/geometry.js';
import { MODULES } from '../core/modules.js';
import { FFL, WALL_TOP, rotYFor, posOnRun, runDir, courses, solids, sOf } from './common.js';
import { windowFrame, glassPane, doorLeaf, doorFrame, jaliPanel, spandrel, corbel, chajja, trimStrip } from './parts.js';

const T = B.wallThickness;
const CW = B.columnWidth;
const EDGE_T = 0.2;           // courtyard parapet / spandrel thickness
const ENTRANCES = { 'B-edge': [1, 8], 'L-edge': [3, 8], 'R-edge': [3] };
const PIPE_BAYS = { 'B-edge': [1, 9], 'L-edge': [2, 6, 10], 'R-edge': [2, 5] };

function bayStyle(run, sc, L) {
  if (run.kind !== 'corrEdge') return run.kind;
  if (run.wing === 'B' && Math.abs(sc) < L.towerHalf - 0.01) return 'tower';
  if (run.style === 'mixed') return sc < L.zRightFront ? 'arch' : 'rect';
  return run.style;
}

// trimming of pieces where two perpendicular runs meet (avoids overlaps)
function trimAt(L, run, s) {
  if (run.axis !== 'z') return 0;
  return [L.zBackOut, L.zBackIn, L.zLeftFront, L.zRightFront].some((z) => Math.abs(z - s) < 1e-6) ? 0.1 : 0;
}

// ---------------------------------------------------------------------------
// Bay plan: pure description of every piece in one bay of one floor
// ---------------------------------------------------------------------------
function planBay(L, run, f, i) {
  const sa = run.stations[i], sb = run.stations[i + 1];
  const len = sb - sa, sc = (sa + sb) / 2;
  const c0 = sa + CW / 2, c1 = sb - CW / 2;
  const H = WALL_TOP(f) - FFL(f);
  const style = bayStyle(run, sc, L);
  const plan = { run, f, i, sa, sb, len, sc, c0, c1, style, walls: [], openings: [], features: [], trims: [] };
  const wallZone = (a, b, y0, y1, t = T, n = 0) => {
    if (b - a > 0.05 && y1 - y0 > 0.02) plan.walls.push({ a, b, y0, y1, t, n });
  };
  const holes = (ops, y0, y1, t = T) => {
    for (const [a, b] of solids(c0, c1, ops)) plan.walls.push({ a, b, y0, y1, t, n: 0 });
  };

  if (style === 'outer') {
    const nWin = len > 6 ? 2 : 1;
    const ww = len < 3.2 ? 1.2 : B.windowWidth;
    const centers = nWin === 1 ? [sc] : [sc - len / 4, sc + len / 4];
    const ops = centers.map((c) => [c - ww / 2, c + ww / 2]);
    wallZone(c0, c1, 0, B.sillHeight);
    holes(ops, B.sillHeight, B.sillHeight + B.windowHeight);
    wallZone(c0, c1, B.sillHeight + B.windowHeight, H);
    for (const c of centers) {
      plan.openings.push({ kind: 'window', s: c, w: ww, y: B.sillHeight, h: B.windowHeight, n: 0 });
      plan.features.push({ kind: 'chajja', s: c, w: ww + 0.5, y: B.sillHeight + B.windowHeight + 0.03, n: T / 2, depth: B.chajjaDepth });
    }
  } else if (style === 'corrWall') {
    if (len < 3.2) {
      wallZone(c0, c1, 0, H);
    } else if (i % 2 === 0) {
      const ds = c0 + 0.35 + B.doorWidth / 2;
      holes([[ds - B.doorWidth / 2, ds + B.doorWidth / 2]], 0, B.doorHeight);
      wallZone(c0, c1, B.doorHeight, H);
      plan.openings.push({ kind: 'door', s: ds, w: B.doorWidth, y: 0, h: B.doorHeight, n: 0 });
    } else {
      const ww = 1.5;
      wallZone(c0, c1, 0, B.sillHeight);
      holes([[sc - ww / 2, sc + ww / 2]], B.sillHeight, 2.1);
      wallZone(c0, c1, 2.1, H);
      plan.openings.push({ kind: 'window', s: sc, w: ww, y: B.sillHeight, h: 2.1 - B.sillHeight, n: 0 });
    }
  } else if (style === 'arch') {
    const entrance = f === 0 && (ENTRANCES[run.id] || []).includes(i);
    const spring = B.archSpring, clear = c1 - c0;
    if (!entrance) {
      wallZone(c0, c1, 0, B.corridorParapet, EDGE_T);
      const crown = spring + Math.min(0.26, clear * 0.08) * 0.75 + B.archRise;
      plan.openings.push({ kind: 'jali', s: sc, w: clear, y: B.corridorParapet, h: crown - B.corridorParapet + 0.02, n: -0.05 });
    } else {
      plan.features.push({ kind: 'steps', s: sc, w: clear - 0.2 });
    }
    plan.walls.push({ kind: 'spandrel', a: c0, b: c1, y0: spring, y1: H, t: EDGE_T, n: 0 });
    if (f >= 1) plan.features.push({ kind: 'band', s: sc, w: len, y: -0.2, n: 0.15 });
  } else if (style === 'rect') {
    const entrance = f === 0 && (ENTRANCES[run.id] || []).includes(i);
    const top = 2.6;
    if (!entrance) {
      wallZone(c0, c1, 0, B.corridorParapet, EDGE_T);
      plan.openings.push({ kind: 'jali', s: sc, w: c1 - c0, y: B.corridorParapet, h: top - B.corridorParapet, n: 0 });
    } else {
      plan.features.push({ kind: 'steps', s: sc, w: c1 - c0 - 0.2 });
    }
    wallZone(c0, c1, top, H, EDGE_T);
    plan.features.push({ kind: 'chajjaBand', s: sc, w: len, y: top + 0.01, n: EDGE_T / 2, depth: 0.45 });
    if (f >= 1) plan.features.push({ kind: 'band', s: sc, w: len, y: -0.2, n: 0.15 });
  } else if (style === 'tower') {
    if (f === 3 || (f === 2 && Math.abs(sc) > 5)) {
      const ops = [[sc - 1.45, sc - 0.55], [sc + 0.55, sc + 1.45]];
      wallZone(c0, c1, 0, 1.2);
      holes(ops, 1.2, 2.1);
      wallZone(c0, c1, 2.1, H);
      for (const [a, b] of ops) plan.openings.push({ kind: 'window', s: (a + b) / 2, w: b - a, y: 1.2, h: 0.9, n: 0 });
    } else {
      wallZone(c0, c1, 0, H);
    }
    // (no floor bands on the tower face: the pavilion roof abuts it)
  } else if (style === 'end') {
    const corridorBay = len < 3.2;
    if (run.id === 'L-end') {
      const ww = corridorBay ? 0.8 : 1.0, s0 = corridorBay ? sc : sc - 1.4;
      if (f === 0 && corridorBay) {
        wallZone(c0, c1, 0, 0.8);
        holes([[sc - 0.9, sc + 0.9]], 0.8, 1.8);
        wallZone(c0, c1, 1.8, H);
        plan.openings.push({ kind: 'jali', s: sc, w: 1.8, y: 0.8, h: 1.0, n: 0 });
      } else {
        wallZone(c0, c1, 0, 1.0);
        holes([[s0 - ww / 2, s0 + ww / 2]], 1.0, 2.2);
        wallZone(c0, c1, 2.2, H);
        plan.openings.push({ kind: 'window', s: s0, w: ww, y: 1.0, h: 1.2, n: 0 });
      }
      if (corridorBay && f >= 1) plan.features.push({ kind: 'chajjaBand', s: sc, w: len, y: 2.25, n: T / 2, depth: 0.45 });
    } else {
      // right wing end: corridor end with jali, stair bay with ventilation jali
      if (corridorBay) {
        wallZone(c0, c1, 0, 0.9);
        holes([[sc - 0.9, sc + 0.9]], 0.9, 2.4);
        wallZone(c0, c1, 2.4, H);
        plan.openings.push({ kind: 'jali', s: sc, w: 1.8, y: 0.9, h: 1.5, n: 0 });
        plan.features.push({ kind: 'chajja', s: sc, w: 2.3, y: 2.43, n: T / 2, depth: 0.45 });
      } else {
        const vs = sc + 1.9, ws = sc - 1.6;
        wallZone(c0, c1, 0, 1.3);
        holes([[vs - 0.5, vs + 0.5], [ws - 0.45, ws + 0.45]], 1.3, 2.3);
        wallZone(c0, c1, 2.3, H);
        plan.openings.push({ kind: 'jali', s: vs, w: 1.0, y: 1.3, h: 1.0, n: 0 });
        plan.openings.push({ kind: 'window', s: ws, w: 0.9, y: 1.3, h: 1.0, n: 0 });
      }
    }
  }
  return plan;
}

let _plans = null;
export function bayPlans(L) {
  if (_plans && _plans.L === L) return _plans.list;
  const list = [];
  for (const run of L.runs) {
    for (let f = 0; f < B.floorCount; f++) {
      for (let i = 0; i < run.stations.length - 1; i++) list.push(planBay(L, run, f, i));
    }
  }
  _plans = { L, list };
  return list;
}

// ---------------------------------------------------------------------------
function place(run, s, n, y) { return posOnRun(run, s, n, y); }
function rotOf(run) { return [0, rotYFor(run.normal), 0]; }
function startS(run, a, b) {
  const d = runDir(run);
  const comp = run.axis === 'x' ? d[0] : d[2];
  return comp > 0 ? a : b;
}

// create_walls(): masonry laid course by course, bay by bay
export function createWalls(ES, L) {
  for (const p of bayPlans(L)) {
    const { run, f } = p;
    const y0 = FFL(f);
    for (const w of p.walls) {
      const s = sOf(L, ...xzOf(run, (w.a + w.b) / 2));
      const tags = { floor: f, wing: run.wing, s, run: run.id, bay: p.i };
      if (w.kind === 'spandrel') {
        const mod = spandrel(w.b - w.a, w.y1 - w.y0, B.archRise, w.t);
        ES.add({ system: 'arch-spandrels', group: `walls.F${f}`, category: 'wall', module: mod, material: 'masonry',
          pos: place(run, (w.a + w.b) / 2, w.n, y0 + w.y0), rot: rotOf(run), anim: { type: 'drop', dist: 1.2 },
          order: s, tags: { ...tags, step: 6 } });
        continue;
      }
      for (const c of courses(w.y1 - w.y0)) {
        const baseStep = Math.round((w.y0 + c.y) / 0.5);
        const mod = boxModule(w.b - w.a, c.h, w.t, 'bottom', 0);
        ES.add({ system: 'masonry', group: `walls.F${f}`, category: 'wall', module: mod, material: 'masonry',
          pos: place(run, (w.a + w.b) / 2, w.n, y0 + w.y0 + c.y), rot: rotOf(run), anim: { type: 'lay' },
          order: s, tags: { ...tags, step: baseStep } });
      }
    }
  }
}

function xzOf(run, s) {
  return run.axis === 'x' ? [s, run.line] : [run.line, s];
}

// create_windows() / create_doors() / jali: installed into finished openings
export function createOpenings(ES, L) {
  for (const p of bayPlans(L)) {
    const { run, f } = p;
    const y0 = FFL(f);
    for (const o of p.openings) {
      const s = sOf(L, ...xzOf(run, o.s));
      const tags = { floor: f, wing: run.wing, s, run: run.id, bay: p.i };
      const pos = place(run, o.s, o.n, y0 + o.y);
      const anim = { type: 'install', normal: run.normal, dist: 1.4 };
      if (o.kind === 'window') {
        ES.add({ system: 'window-frames', group: `openings.windows.F${f}`, category: 'opening', module: windowFrame(o.w, o.h),
          material: 'winframe', pos, rot: rotOf(run), anim, order: s, tags });
        ES.add({ system: 'glazing', group: `openings.glass.F${f}`, category: 'glass', module: glassPane(o.w, o.h),
          material: 'glass', pos, rot: rotOf(run), anim: { type: 'install', normal: run.normal, dist: 0.6 }, order: s, tags });
      } else if (o.kind === 'door') {
        ES.add({ system: 'door-frames', group: `openings.doors.F${f}`, category: 'opening', module: doorFrame(o.w, o.h),
          material: 'winframe', pos, rot: rotOf(run), anim, order: s, tags });
        ES.add({ system: 'door-leaves', group: `openings.glass.F${f}`, category: 'glass', module: doorLeaf(o.w, o.h),
          material: 'door', pos, rot: rotOf(run), anim: { type: 'install', normal: run.normal, dist: 0.8 }, order: s, tags });
      } else if (o.kind === 'jali') {
        ES.add({ system: 'jali', group: `openings.jali.F${f}`, category: 'opening', module: jaliPanel(o.w, o.h),
          material: 'jali', pos, rot: rotOf(run), anim: { type: 'install', normal: run.normal, dist: 1.2 }, order: s, tags });
      }
    }
  }
}

// create_balconies()/exterior features: chajjas, floor bands, corbels, steps
export function createFeatures(ES, L) {
  for (const p of bayPlans(L)) {
    const { run, f } = p;
    const y0 = FFL(f);
    for (const ft of p.features) {
      const s = sOf(L, ...xzOf(run, ft.s));
      const tags = { floor: f, wing: run.wing, s, run: run.id, bay: p.i };
      if (ft.kind === 'chajja' || ft.kind === 'chajjaBand') {
        ES.add({ system: 'chajjas', group: 'exterior.chajjas', category: 'feature', module: chajja(ft.w, ft.depth),
          material: 'frame', pos: place(run, ft.s, ft.n, y0 + ft.y), rot: rotOf(run),
          anim: { type: 'install', normal: run.normal, dist: 1.0 }, order: s, tags });
        const tx = startS(run, ft.s - ft.w / 2, ft.s + ft.w / 2);
        ES.add({ system: 'trims', group: 'finishing.trims', category: 'trim', module: trimStrip(ft.w, 0.1, 0.02),
          material: 'lavender', pos: place(run, tx, ft.n + ft.depth + 0.012, y0 + ft.y - 0.02), rot: rotOf(run),
          anim: { type: 'unroll' }, order: s, tags });
      } else if (ft.kind === 'band') {
        const mod = boxModule(ft.w, 0.2, B.bandDepth, 'bottomBack', 0.01);
        ES.add({ system: 'floor-bands', group: 'exterior.bands', category: 'feature', module: mod, material: 'frame',
          pos: place(run, ft.s, ft.n, y0 + ft.y), rot: rotOf(run), anim: { type: 'install', normal: run.normal, dist: 0.8 },
          order: s, tags });
        const tx = startS(run, ft.s - ft.w / 2, ft.s + ft.w / 2);
        ES.add({ system: 'trims', group: 'finishing.trims', category: 'trim', module: trimStrip(ft.w, 0.075, 0.02),
          material: 'lavender', pos: place(run, tx, ft.n + B.bandDepth + 0.011, y0 + ft.y + 0.005), rot: rotOf(run),
          anim: { type: 'unroll' }, order: s, tags });
      } else if (ft.kind === 'steps') {
        for (let k = 0; k < 3; k++) {
          const mod = boxModule(ft.w, 0.2 * (3 - k), 0.32, 'bottom', 0.01);
          ES.add({ system: 'steps', group: 'exterior.steps', category: 'feature', module: mod, material: 'frame',
            pos: place(run, ft.s, 0.32 + 0.32 * k, 0), rot: rotOf(run), anim: { type: 'lay' }, order: s, tags: { ...tags, step: k } });
        }
      }
    }
  }
  // arcade corbels / pier capitals at every column of arched bays
  for (const run of L.runs.filter((r) => r.kind === 'corrEdge')) {
    for (let f = 0; f < B.floorCount; f++) {
      for (let i = 0; i < run.stations.length; i++) {
        const st = run.stations[i];
        const left = i > 0 ? bayStyle(run, (run.stations[i - 1] + st) / 2, L) : null;
        const right = i < run.stations.length - 1 ? bayStyle(run, (st + run.stations[i + 1]) / 2, L) : null;
        if (left !== 'arch' && right !== 'arch') continue;
        const s = sOf(L, ...xzOf(run, st));
        ES.add({ system: 'corbels', group: 'exterior.corbels', category: 'feature', module: corbel(0.66, 0.44), material: 'frame',
          pos: place(run, st, 0, FFL(f) + B.archSpring - 0.28), rot: rotOf(run),
          anim: { type: 'install', normal: run.normal, dist: 0.6 }, order: s, tags: { floor: f, wing: run.wing, s } });
      }
    }
  }
}

// Roof parapets (built in the roof phase on the roof slab)
export function createParapets(ES, L) {
  const y0 = ROOF_LEVEL;
  for (const run of L.runs) {
    if (run.kind === 'corrWall') continue;
    for (let i = 0; i < run.stations.length - 1; i++) {
      let a = run.stations[i], b = run.stations[i + 1];
      const sc = (a + b) / 2;
      if (run.wing === 'B' && Math.abs(sc) < L.towerHalf - 0.01) continue;           // tower rises here
      if (run.id === 'R-end' && b - a > 3.2) continue;                               // stair mumty
      if (run.id === 'R-outer' && i === run.stations.length - 2) continue;           // stair mumty
      a += trimAt(L, run, a); b -= trimAt(L, run, b);
      // leave room for the stair headroom walls at the right wing end
      const mumtyZ = L.zsRight[L.zsRight.length - 2];
      if (run.id === 'R-end' && Math.abs(b - L.xClassR) < 1e-6) b -= 0.1;
      if (run.id === 'R-outer' && Math.abs(b - mumtyZ) < 1e-6) b -= 0.1;
      const s = sOf(L, ...xzOf(run, sc));
      const n = 0;
      for (const c of courses(B.parapetHeight)) {
        ES.add({ system: 'parapets', group: 'roof.parapets', category: 'wall', module: boxModule(b - a, c.h, 0.2, 'bottom', 0),
          material: 'masonry', pos: posOnRun(run, (a + b) / 2, n, y0 + c.y), rot: [0, rotYFor(run.normal), 0], anim: { type: 'lay' },
          order: s, tags: { wing: run.wing, s, step: c.k, floor: 4 } });
      }
      // coping + lavender line at the parapet top on courtyard / end faces
      if (run.kind === 'corrEdge' || run.kind === 'end') {
        const tx = startS(run, a, b);
        ES.add({ system: 'trims', group: 'finishing.trims', category: 'trim', module: trimStrip(b - a, 0.08, 0.02),
          material: 'lavender', pos: posOnRun(run, tx, 0.111, y0 - 0.02), rot: [0, rotYFor(run.normal), 0],
          anim: { type: 'unroll' }, order: s, tags: { wing: run.wing, s, floor: 4 } });
      }
    }
  }
}

// Rainwater downpipes on the courtyard facades
export function createPipes(ES, L) {
  const h = ROOF_LEVEL + 0.6;
  const mod = MODULES.define(`pipe:${h.toFixed(2)}`, () => cylinder(0.055, h, { seg: 10 }));
  for (const run of L.runs.filter((r) => r.kind === 'corrEdge')) {
    for (const i of PIPE_BAYS[run.id] || []) {
      if (i >= run.stations.length) continue;
      const st = run.stations[i];
      if (run.wing === 'B' && Math.abs(st) < L.towerHalf + 0.01) continue;
      const s = sOf(L, ...xzOf(run, st));
      const d = runDir(run);
      const along = (run.axis === 'x' ? d[0] : d[2]) > 0 ? 0.32 : -0.32;
      ES.add({ system: 'downpipes', group: 'finishing.pipes', category: 'fixture', module: mod, material: 'pipe',
        pos: posOnRun(run, st + along, 0.26, 0), anim: { type: 'rise' }, order: s, tags: { wing: run.wing, s } });
    }
  }
}
