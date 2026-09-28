// Shared helpers for the building generators.
import { BUILDING as B, floorLevel } from '../config.js';
import { uParam } from './layout.js';

export const FFL = floorLevel;                                   // floor level of floor f
export const WALL_TOP = (f) => floorLevel(f + 1) - B.beamDepth; // underside of beams
export const COURSE = 0.5;                                       // masonry lift per course

export function rotYFor(normal) { return Math.atan2(normal[0], normal[2]); }

// world position of a point at station s along a run, offset n along the
// run's outward normal, at height y
export function posOnRun(run, s, n, y) {
  if (run.axis === 'x') return [s, y, run.line + run.normal[2] * n];
  return [run.line + run.normal[0] * n, y, s];
}

// unit vector along a run in world space, matching the local +X of modules
// placed with rotYFor(run.normal)
export function runDir(run) {
  const a = rotYFor(run.normal);
  return [Math.cos(a), 0, -Math.sin(a)];
}

// Split a wall piece of height h into masonry courses
export function courses(h) {
  const n = Math.max(1, Math.round(h / COURSE));
  return Array.from({ length: n }, (_, i) => ({ y: (i * h) / n, h: h / n, k: i }));
}

// Solid intervals of [a,b] after removing openings [[o0,o1],...]
export function solids(a, b, openings) {
  const out = [];
  let cur = a;
  for (const [o0, o1] of [...openings].sort((p, q) => p[0] - q[0])) {
    if (o0 - cur > 0.02) out.push([cur, o0]);
    cur = Math.max(cur, o1);
  }
  if (b - cur > 0.02) out.push([cur, b]);
  return out;
}

export function sOf(L, x, z) { return uParam(L, x, z); }

// ---------------------------------------------------------------------------
// wallRun(): a straight masonry wall from a=[x,z] to b=[x,z], laid in courses,
// with openings (windows / doors / jali / glazing) installed afterwards.
// Used for the hand-designed parts (pavilion, tower room, headroom).
// ---------------------------------------------------------------------------
import { boxModule } from '../core/modules.js';
import { windowFrame, glassPane, doorLeaf, doorFrame, jaliPanel } from './parts.js';

export function wallRun(ES, L, spec) {
  const { a, b, y0, h, t = 0.23, openings = [], group, openGroup, glassGroup, wing = 'P', normal, material = 'masonry', floor = 0, category = 'wall' } = spec;
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  const ux = dx / len, uz = dz / len;
  const rotY = Math.atan2(-uz, ux);
  const at = (d, y) => [a[0] + ux * d, y, a[1] + uz * d];
  const nrm = normal || [uz, 0, -ux];
  const ys = [...new Set([0, h, ...openings.flatMap((o) => [o.y, o.y + o.h])])].filter((v) => v >= 0 && v <= h).sort((p, q) => p - q);
  const s = sOf(L, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  for (let i = 0; i < ys.length - 1; i++) {
    const z0 = ys[i], z1 = ys[i + 1];
    if (z1 - z0 < 0.02) continue;
    const cut = openings.filter((o) => o.y < z1 - 1e-6 && o.y + o.h > z0 + 1e-6).map((o) => [o.at - o.w / 2, o.at + o.w / 2]);
    for (const [p, q] of solids(0, len, cut)) {
      for (const c of courses(z1 - z0)) {
        ES.add({ system: spec.system || 'masonry', group, category, module: boxModule(q - p, c.h, t, 'bottom', 0), material,
          pos: at((p + q) / 2, y0 + z0 + c.y), rot: [0, rotY, 0], anim: { type: 'lay' }, order: s,
          tags: { wing, s, floor, step: Math.round((z0 + c.y) / COURSE) } });
      }
    }
  }
  for (const o of openings) {
    const pos = at(o.at, y0 + o.y);
    const anim = { type: 'install', normal: nrm, dist: 1.2 };
    const tags = { wing, s, floor };
    if (o.kind === 'door') {
      ES.add({ system: 'door-frames', group: openGroup, category: 'opening', module: doorFrame(o.w, o.h), material: 'winframe', pos, rot: [0, rotY, 0], anim, order: s, tags });
      ES.add({ system: 'door-leaves', group: glassGroup, category: 'glass', module: doorLeaf(o.w, o.h), material: 'door', pos, rot: [0, rotY, 0], anim, order: s, tags });
    } else if (o.kind === 'jali' || o.kind === 'grille') {
      ES.add({ system: 'jali', group: openGroup, category: 'opening', module: jaliPanel(o.w, o.h, o.cell ?? 0.16), material: o.kind === 'grille' ? 'grille' : 'jali', pos, rot: [0, rotY, 0], anim, order: s, tags });
    } else if (o.kind !== 'void') {
      ES.add({ system: 'window-frames', group: openGroup, category: 'opening', module: windowFrame(o.w, o.h, o.panes), material: 'winframe', pos, rot: [0, rotY, 0], anim, order: s, tags });
      ES.add({ system: 'glazing', group: glassGroup, category: 'glass', module: glassPane(o.w, o.h), material: 'glass', pos, rot: [0, rotY, 0], anim: { ...anim, dist: 0.6 }, order: s, tags });
    }
  }
  return { rotY, at, len };
}
