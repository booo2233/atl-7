// Automatic validation + repair of the construction sequence.
//
// Dependencies are derived from geometry, not hand-authored:
//  * BOTTOM SUPPORT: an element resting on others (touching their top faces)
//    may only start once every one of them is complete.
//  * LATERAL SUPPORT: an element with nothing below (a beam, a spandrel, a
//    sunshade) needs the frame/wall members it is attached to complete.
//  * OPENINGS: windows, doors and jali start only after every wall piece
//    around their opening is complete; glass/leaves only after their frame.
//  * ROOF COVER after roof framing; TRIMS/SIGNS after the host is painted;
//    PLASTER never before the element exists; REMOVAL after installation.
// Violations are fixed by delaying the dependent element (keeping its
// duration), iterated to a fixed point. Remaining geometric problems
// (floating pieces, interpenetrations, too-short motions) are reported.
import * as THREE from 'three';
import { terrainHeight } from '../world/terrain.js';
import { HOLD_START } from '../config.js';

const TOL = 0.025;

function touches(a, b, tol = TOL) {
  return a.min.x <= b.max.x + tol && a.max.x >= b.min.x - tol &&
    a.min.y <= b.max.y + tol && a.max.y >= b.min.y - tol &&
    a.min.z <= b.max.z + tol && a.max.z >= b.min.z - tol;
}
function overlapDepth(a, b) {
  // smallest per-axis overlap length (negative if separated)
  return Math.min(
    Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x),
    Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y),
    Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z));
}

class Grid {
  constructor(cell = 3) { this.cell = cell; this.map = new Map(); }
  keys(bb) {
    const c = this.cell, out = [];
    for (let x = Math.floor(bb.min.x / c); x <= Math.floor(bb.max.x / c); x++)
      for (let y = Math.floor(bb.min.y / c); y <= Math.floor(bb.max.y / c); y++)
        for (let z = Math.floor(bb.min.z / c); z <= Math.floor(bb.max.z / c); z++) out.push(`${x},${y},${z}`);
    return out;
  }
  insert(e) { for (const k of this.keys(e.bbox())) { if (!this.map.has(k)) this.map.set(k, []); this.map.get(k).push(e); } }
  query(bb) {
    const set = new Set();
    for (const k of this.keys(new THREE.Box3(bb.min.clone().subScalar(TOL), bb.max.clone().addScalar(TOL)))) {
      for (const e of this.map.get(k) || []) set.add(e);
    }
    return set;
  }
}

const STRUCTURAL = new Set(['found', 'frame', 'slab', 'wall', 'roofframe', 'temp']);
// construction hierarchy: an element can only depend on (rest on / hang
// from) elements of equal or lower rank. Infill walls under a beam are NOT
// its support, sheets are not the support of a purlin, etc.
export const RANK = {
  found: 0, frame: 1, slab: 1, wall: 2, opening: 3, feature: 3, roofframe: 3, glass: 4, roofcover: 4,
  trim: 5, sign: 5, site: 4.5, fixture: 5, plant: 7, vehicle: 7, temp: 0,
};
const HOSTS = new Set(['found', 'frame', 'slab', 'wall', 'feature', 'roofframe']);
// category pairs that intentionally interpenetrate (embedded fixings, jali set
// into arch soffits, roof members crossing at valleys, pavers under vehicles...)
const ALLOWED_OVERLAP = new Set([
  'opening|wall', 'feature|frame', 'feature|wall', 'feature|slab', 'roofframe|roofframe', 'roofcover|roofcover',
  'roofcover|roofframe', 'roofcover|wall', 'roofframe|wall', 'found|found', 'trim|feature', 'fixture|feature',
  'site|site', 'plant|site', 'temp|temp', 'glass|opening', 'frame|found', 'opening|opening', 'trim|wall', 'trim|trim',
  'wall|frame', 'roofframe|slab', 'feature|feature', 'roofcover|slab', 'roofframe|frame', 'sign|wall', 'sign|trim',
  'vehicle|site', 'plant|plant', 'fixture|wall', 'fixture|trim', 'roofcover|frame', 'opening|feature', 'frame|slab',
  'glass|wall', 'site|found', 'feature|site', 'fixture|site', 'site|vehicle', 'plant|site', 'site|wall', 'site|frame',
]);

export function deriveDependencies(elements) {
  const grid = new Grid(3);
  for (const e of elements) grid.insert(e);
  for (const e of elements) {
    const bb = e.bbox();
    const near = [...grid.query(bb)].filter((o) => o !== e && touches(bb, o.bbox()));
    const ground = terrainHeight((bb.min.x + bb.max.x) / 2, (bb.min.z + bb.max.z) / 2);
    e._grounded = bb.min.y <= ground + 0.06;
    e._near = near;
    const bottom = [], lateral = [];
    for (const o of near) {
      if (o.temporary !== e.temporary) continue;
      if ((RANK[o.category] ?? 9) > (RANK[e.category] ?? 9)) continue;
      const ob = o.bbox();
      const xzOverlap = Math.min(bb.max.x, ob.max.x) - Math.max(bb.min.x, ob.min.x) > 0.01 &&
        Math.min(bb.max.z, ob.max.z) - Math.max(bb.min.z, ob.min.z) > 0.01;
      // roof coverings bear on the framing, not on the course/sheet below
      if (e.category === 'roofcover' && o.category === 'roofcover') continue;
      // bottom support: its top meets our base and it really lies below us
      // (not a coplanar neighbour such as two crossing lines on the ground)
      if (xzOverlap && Math.abs(ob.max.y - bb.min.y) <= TOL * 2 && ob.min.y < bb.min.y - TOL) bottom.push(o);
      else if (ob.min.y < bb.min.y - TOL && STRUCTURAL.has(o.category)) lateral.push(o);
    }
    e._bottom = bottom;
    e._lateral = lateral;
    // sloped roof members (rafters, sheets, tiles) bear on whatever they touch
    e._contact = (!bottom.length && !lateral.length && ['roofframe', 'roofcover'].includes(e.category))
      ? near.filter((o) => o.temporary === e.temporary && (RANK[o.category] ?? 9) <= (RANK[e.category] ?? 9) && o.category !== e.category) : [];
  }
}

// Earliest allowed start of e given its dependencies
function requiredStart(e) {
  let req = 0;
  const gap = 0.0015;
  const done = (o) => o.t1 + gap;
  if (e.temporary) {
    for (const o of e._bottom) req = Math.max(req, done(o));
    return req;
  }
  switch (e.category) {
    case 'opening':
      for (const o of e._near) if (o.category === 'wall' || o.category === 'frame') req = Math.max(req, done(o));
      break;
    case 'glass':
      for (const o of e._near) if (o.category === 'opening') req = Math.max(req, done(o));
      break;
    case 'roofcover':
      for (const o of e._near) if (o.category === 'roofframe') req = Math.max(req, done(o));
      break;
    case 'trim': case 'sign':
      for (const o of e._near) if (HOSTS.has(o.category)) req = Math.max(req, done(o), o.finishable && o.f1 != null ? o.f1 + gap : 0);
      break;
    default: break;
  }
  if (!e._grounded) {
    if (e._bottom.length) for (const o of e._bottom) req = Math.max(req, done(o));
    else if (e._lateral.length && ['frame', 'feature', 'wall', 'slab', 'roofframe', 'fixture'].includes(e.category)) {
      for (const o of e._lateral) req = Math.max(req, done(o));
    } else if (e._contact.length) {
      req = Math.max(req, Math.min(...e._contact.map(done)));
    }
  } else {
    for (const o of e._bottom) if (o.category !== 'site' || e.category === 'vehicle') req = Math.max(req, done(o));
  }
  return req;
}

export function validateAndFix(elements, { fps = 24, seconds = 30, maxPasses = 12 } = {}) {
  const t0 = Date.now();
  const report = { fixes: [], problems: [], stats: {}, checkpoints: [] };
  const frameN = 1 / (fps * seconds);
  deriveDependencies(elements);

  // 1) motion duration: never shorter than 8 frames (no snapping)
  let lengthened = 0;
  for (const e of elements) {
    if (e.t1 - e.t0 < 8 * frameN) { e.t1 = e.t0 + 8 * frameN; lengthened++; }
  }
  if (lengthened) report.fixes.push({ rule: 'min-duration', count: lengthened });

  // 2) dependency fixed point
  const order = [...elements].sort((a, b) => a.t0 - b.t0);
  const shifted = new Map();
  let pass = 0, changed = true;
  while (changed && pass < maxPasses) {
    changed = false; pass++;
    for (const e of order) {
      const req = requiredStart(e);
      if (e.t0 < req - 1e-9) {
        const dt = req - e.t0;
        e.t0 += dt; e.t1 += dt;
        if (e.rm0 != null && e.rm0 < e.t1 + 0.002) { const dr = e.t1 + 0.002 - e.rm0; e.rm0 += dr; e.rm1 += dr; }
        shifted.set(e, (shifted.get(e) || 0) + dt);
        changed = true;
      }
    }
    order.sort((a, b) => a.t0 - b.t0);
  }
  const byGroup = {};
  for (const [e, dt] of shifted) {
    const g = e.group.replace(/\.F\d$/, '.F*');
    byGroup[g] = byGroup[g] || { count: 0, maxShiftFrames: 0 };
    byGroup[g].count++;
    byGroup[g].maxShiftFrames = Math.max(byGroup[g].maxShiftFrames, Math.round(dt / frameN));
  }
  if (shifted.size) report.fixes.push({ rule: 'dependency-order', count: shifted.size, passes: pass, byGroup });

  // 3) finishing never before an element is built; removal after install
  let finFix = 0;
  for (const e of elements) {
    if (e.f0 != null && e.f0 < e.t1 + 0.002) { const d = e.t1 + 0.002 - e.f0; e.f0 += d; e.f1 += d; finFix++; }
  }
  if (finFix) report.fixes.push({ rule: 'finish-after-build', count: finFix });
  // trims/signs may have moved because of finishing
  for (let k = 0; k < 3; k++) for (const e of elements) {
    if (e.category === 'trim' || e.category === 'sign') {
      const req = requiredStart(e);
      if (e.t0 < req) { const dt = req - e.t0; e.t0 += dt; e.t1 += dt; }
    }
  }

  // 4) everything permanent must be complete (and painted) before the hold
  const late = elements.filter((e) => !e.temporary && (e.t1 > HOLD_START + 1e-6 || (e.f1 != null && e.f1 > HOLD_START + 1e-6)));
  report.lateGroups = countBy(late, (e) => e.group);
  if (late.length) {
    // compress the tail of late elements into the window before the hold
    for (const e of late) {
      const end = Math.max(e.t1, e.f1 ?? 0);
      const over = end - HOLD_START + 0.002;
      if (over > 0) { e.t0 -= over; e.t1 -= over; if (e.f0 != null) { e.f0 -= over; e.f1 -= over; } }
    }
    report.fixes.push({ rule: 'complete-before-hold', count: late.length });
  }

  // ---- checks (reported) ---------------------------------------------------------------
  // (parts of one physical unit - a bus body and its glazing, a palm trunk
  // and its fronds - are judged by the unit's base part)
  const floating = elements.filter((e) => !e._grounded && !e._bottom.length && !e._lateral.length && !e._contact.length && !e.tags.unit &&
    !['glass', 'opening', 'trim', 'sign', 'roofcover'].includes(e.category) && !e.rig);
  report.problems.push({ check: 'floating-elements', count: floating.length, examples: floating.slice(0, 8).map(desc) });

  const unsupportedAtStart = elements.filter((e) => !e._grounded && !e.rig && e._bottom.length && e._bottom.some((o) => o.t1 > e.t0 + 1e-6));
  report.problems.push({ check: 'starts-before-support-complete', count: unsupportedAtStart.length, examples: unsupportedAtStart.slice(0, 8).map(desc) });

  const openingsEarly = elements.filter((e) => e.category === 'opening' && e._near.some((o) => o.category === 'wall' && o.t1 > e.t0 + 1e-6));
  report.problems.push({ check: 'windows-before-walls', count: openingsEarly.length, examples: openingsEarly.slice(0, 8).map(desc) });

  const roofSlabDone = Math.max(0, ...elements.filter((e) => e.tags.roofSlab).map((e) => e.t1));
  const roofEarly = elements.filter((e) => (e.category === 'roofcover' || e.group.startsWith('roof.trusses') || e.group.startsWith('roof.posts')) && e.t0 < roofSlabDone - 0.05);
  report.problems.push({ check: 'roof-before-top-slab', count: roofEarly.length, note: `roof slab complete at T=${roofSlabDone.toFixed(3)}` });

  // interpenetration of solid pieces (AABB), excluding intended embeds
  const grid = new Grid(3);
  for (const e of elements) grid.insert(e);
  const pairs = {}; const seen = new Set(); const examples = [];
  for (const e of elements) {
    if (['plant', 'vehicle', 'temp'].includes(e.category) || e.tags.diagonal) continue;
    for (const o of grid.query(e.bbox())) {
      if (o.id <= e.id || o.temporary || e.temporary || o.tags.diagonal) continue;
      const key = [e.category, o.category].sort().join('|');
      if (ALLOWED_OVERLAP.has(key) || ALLOWED_OVERLAP.has(`${e.category}|${o.category}`) || ALLOWED_OVERLAP.has(`${o.category}|${e.category}`)) continue;
      const k2 = `${e.id}-${o.id}`; if (seen.has(k2)) continue; seen.add(k2);
      if (overlapDepth(e.bbox(), o.bbox()) > 0.04) {
        if (key === 'slab|slab' && planOverlap(e.bbox(), o.bbox()) < 0.03) continue; // concave-corner edge strips
        pairs[key] = (pairs[key] || 0) + 1;
        if (examples.length < 10) examples.push(`${desc(e)}  ×  ${desc(o)}`);
      }
    }
  }
  report.problems.push({ check: 'interpenetrations', count: Object.values(pairs).reduce((a, b) => a + b, 0), byPair: pairs, examples });

  const badTiming = elements.filter((e) => !(e.t1 > e.t0) || e.t0 < 0 || e.t1 > 1 || Number.isNaN(e.t0));
  report.problems.push({ check: 'invalid-timing', count: badTiming.length, examples: badTiming.slice(0, 5).map(desc) });
  const tooShort = elements.filter((e) => e.t1 - e.t0 < 8 * frameN - 1e-9);
  report.problems.push({ check: 'snapping-motions(<8 frames)', count: tooShort.length });

  // checkpoints: how much is standing at key frames
  const frames = Math.round(fps * seconds);
  const cps = [['frame 1 (empty site)', 0], ['early construction', 0.12], ['structural midpoint', 0.3], ['facade construction', 0.5], ['near completion', 0.85], ['final frame', 1]];
  let prevPermanent = -1, monotonic = true;
  for (const [name, T] of cps) {
    const vis = elements.filter((e) => e.t0 < T && (e.rm1 == null || T < e.rm1));
    const perm = vis.filter((e) => !e.temporary).length;
    const complete = elements.filter((e) => !e.temporary && e.t1 <= T).length;
    if (perm < prevPermanent) monotonic = false;
    prevPermanent = perm;
    report.checkpoints.push({ name, frame: Math.round(T * (frames - 1)) + 1, visible: vis.length, permanent: perm, complete });
  }
  const finalState = {
    permanentComplete: elements.filter((e) => !e.temporary && e.t1 <= 1).length,
    permanentTotal: elements.filter((e) => !e.temporary).length,
    temporaryRemoved: elements.filter((e) => e.temporary && e.rm1 != null && e.rm1 <= 1).length,
    temporaryTotal: elements.filter((e) => e.temporary).length,
    paintedBeforeHold: elements.filter((e) => e.finishable && e.f1 <= HOLD_START + 1e-6).length,
    finishable: elements.filter((e) => e.finishable).length,
    emptyAtFrame1: report.checkpoints[0].visible === 0,
    monotonicGrowth: monotonic,
  };
  report.stats = {
    elements: elements.length,
    systems: countBy(elements, (e) => e.system),
    categories: countBy(elements, (e) => e.category),
    finalState,
    ms: Date.now() - t0,
  };
  return report;
}

function planOverlap(a, b) {
  return Math.max(0, Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x)) * Math.max(0, Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z));
}
function countBy(list, fn) {
  const o = {};
  for (const e of list) { const k = fn(e); o[k] = (o[k] || 0) + 1; }
  return o;
}
function desc(e) {
  const p = e.pos.map((v) => v.toFixed(1)).join(',');
  return `${e.system}#${e.id}[${e.group}] @(${p}) t=${e.t0.toFixed(3)}-${e.t1.toFixed(3)}`;
}
