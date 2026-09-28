// create_site(): setting-out at the very start, and the site works that
// complete the campus at the end - red interlocking pavers in the courtyard,
// the grey assembly plaza with its drain, concrete aprons and walkways, the
// basketball court and its steel shed, the green shade-net fence, turf,
// planting, and the yellow school-bus fleet parking in the courtyard.
import * as THREE from 'three';
import { boxModule, MODULES } from '../core/modules.js';
import { box, merge, xf, cylinder, ANCHOR, sheet } from '../core/geometry.js';
import { mulberry32 } from '../core/math.js';
import { palmGeometries } from '../world/environment.js';
import { trimStrip, roofSheet } from './parts.js';
import { sOf } from './common.js';

const tag = (L, x, z, extra = {}) => ({ wing: 'S', s: sOf(L, x, z), ...extra });

export function createSite(ES, L) {
  settingOut(ES, L);
  paving(ES, L);
  court(ES, L);
  fence(ES, L);
  landscaping(ES, L);
  buses(ES, L);
}

// ---- phase 1: pegs, strings and lime lines marking the footprint ----------------------
function settingOut(ES, L) {
  const outline = [
    [L.xOutL, L.zBackOut], [L.xOutR, L.zBackOut], [L.xOutR, L.zRightFront], [L.xInR, L.zRightFront],
    [L.xInR, L.zBackIn], [L.xInL, L.zBackIn], [L.xInL, L.zLeftFront], [L.xOutL, L.zLeftFront],
  ];
  const peg = boxModule(0.06, 0.75, 0.06, 'bottom', 0);
  const off = 1.2;
  outline.forEach(([x, z], i) => {
    // two pegs per corner, set back from the building line (profile pegs)
    const cx = Math.sign(x) * off, cz = z > L.zBackIn ? off : -off;
    for (const [px, pz] of [[x + cx, z], [x, z + cz]]) {
      ES.add({ system: 'setting-out', group: 'site.pegs', category: 'temp', temporary: true, module: peg, material: 'woodPeg',
        pos: [px, -0.35, pz], anim: { type: 'drop', dist: 0.9, remove: 'sink' }, order: i, tags: tag(L, px, pz) });
    }
  });
  // lime lines on the ground along every column grid line (footprint)
  const lines = [];
  for (const z of L.zsBack) lines.push([[L.xOutL - 1, z], [L.xOutR + 1, z]]);
  for (const x of L.xsLeft) lines.push([[x, L.zBackOut - 1], [x, L.zLeftFront + 1]]);
  for (const x of L.xsRight) lines.push([[x, L.zBackOut - 1], [x, L.zRightFront + 1]]);
  for (const z of [...L.zsLeft.slice(1)]) lines.push([[L.xOutL - 0.6, z], [L.xInL + 0.6, z]]);
  for (const z of [...L.zsRight.slice(1)]) lines.push([[L.xInR - 0.6, z], [L.xOutR + 0.6, z]]);
  for (const x of L.xsBack.slice(3, -3)) lines.push([[x, L.zBackOut - 0.6], [x, L.zBackIn + 0.6]]);
  lines.forEach(([a, b], i) => {
    const alongX = Math.abs(b[0] - a[0]) > 0.1;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const mod = trimStrip(len, 0.006, 0.09);
    ES.add({ system: 'setting-out', group: 'site.lime', category: 'temp', temporary: true, module: mod, material: 'lime',
      pos: [a[0], 0.004, a[1]], rot: [0, alongX ? 0 : -Math.PI / 2, 0], anim: { type: 'unroll', remove: 'unroll' },
      order: i / lines.length, tags: tag(L, a[0], a[1]) });
  });
  // strings between the corner pegs (at 0.35 m)
  outline.forEach(([x, z], i) => {
    const [nx, nz] = outline[(i + 1) % outline.length];
    const alongX = Math.abs(nx - x) > 0.1;
    const cx = Math.sign(x) * off, cz = z > L.zBackIn ? off : -off;
    const a = alongX ? [x, z + cz] : [x + cx, z];
    const len = alongX ? Math.abs(nx - x) : Math.abs(nz - z);
    const dir = alongX ? Math.sign(nx - x) : Math.sign(nz - z);
    const rot = alongX ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    ES.add({ system: 'setting-out', group: 'site.strings', category: 'temp', temporary: true, module: trimStrip(len, 0.012, 0.012), material: 'string',
      pos: [a[0], 0.34, a[1]], rot: [0, rot, 0], anim: { type: 'unroll', remove: 'unroll' }, order: i, tags: tag(L, a[0], a[1]) });
  });
}

// ---- phase 10: hard landscaping ---------------------------------------------------------
function tiles(ES, L, { x0, x1, z0, z1, cell, material, group, h = 0.08, hole = null, orderFn }) {
  for (let x = x0; x < x1 - 0.05; x += cell) {
    for (let z = z0; z < z1 - 0.05; z += cell) {
      const xa = x, xb = Math.min(x1, x + cell), za = z, zb = Math.min(z1, z + cell);
      const cx = (xa + xb) / 2, cz = (za + zb) / 2;
      if (hole && cx > hole.x0 && cx < hole.x1 && cz > hole.z0 && cz < hole.z1) continue;
      ES.add({ system: 'paving', group, category: 'site', module: boxModule(xb - xa, h, zb - za, 'bottom', 0.004), material,
        pos: [cx, 0, cz], anim: { type: 'drop', dist: 0.5 }, order: orderFn ? orderFn(cx, cz) : cz, tags: tag(L, cx, cz) });
    }
  }
}

function paving(ES, L) {
  const e = 0.15;
  // courtyard: red interlocking pavers, laid from the back wing forwards
  tiles(ES, L, { x0: L.xInL + e, x1: L.xInR - e, z0: L.zBackIn + e, z1: 0.0, cell: 4.0, material: 'pavers', group: 'sitework.pavers',
    hole: { x0: -8.6, x1: 8.6, z0: -26, z1: -12.2 }, orderFn: (x, z) => z + Math.abs(x) * 0.15 });
  // around the pavilion porch front / beside the side parts
  tiles(ES, L, { x0: -2.6, x1: 2.6, z0: -12.2, z1: -12.2 + 0.001, cell: 4, material: 'pavers', group: 'sitework.pavers' });
  // assembly plaza (grey tiles) beside the junior-college block
  tiles(ES, L, { x0: L.xInL + e, x1: -1.1, z0: 0.0, z1: 21.0, cell: 3.0, material: 'plaza', group: 'sitework.plaza', orderFn: (x, z) => z - x * 0.3 });
  // drain channel between plaza and playground
  ES.add({ system: 'paving', group: 'sitework.drain', category: 'site', module: boxModule(0.6, 0.05, 24, 'bottom', 0), material: 'drain',
    pos: [-0.8, 0, 10.5], anim: { type: 'drop', dist: 0.5 }, order: 0, tags: tag(L, -0.8, 10) });
  // concrete apron in front of the right half and the right wing end
  tiles(ES, L, { x0: -0.5, x1: L.xOutR + 1.4, z0: 0.0, z1: 6.0, cell: 3.0, material: 'apron', group: 'sitework.apron', orderFn: (x) => x });
  // perimeter walkways
  tiles(ES, L, { x0: L.xOutL - 1.35, x1: L.xOutR + 1.35, z0: L.zBackOut - 1.35, z1: L.zBackOut - e, cell: 3.0, material: 'apron', group: 'sitework.walkway', h: 0.06, orderFn: (x) => x });
  tiles(ES, L, { x0: L.xOutL - 1.35, x1: L.xOutL - e, z0: L.zBackOut - e, z1: L.zLeftFront + 1.35, cell: 3.0, material: 'apron', group: 'sitework.walkway', h: 0.06 });
  tiles(ES, L, { x0: L.xOutR + e, x1: L.xOutR + 1.35, z0: L.zBackOut - e, z1: 0.0, cell: 3.0, material: 'apron', group: 'sitework.walkway', h: 0.06 });
  tiles(ES, L, { x0: L.xOutL - e, x1: L.xInL + e, z0: L.zLeftFront + e, z1: L.zLeftFront + 1.35, cell: 3.0, material: 'apron', group: 'sitework.walkway', h: 0.06 });
}

function court(ES, L) {
  const x0 = -27, x1 = -7, z0 = 24, z1 = 47;
  tiles(ES, L, { x0, x1, z0, z1, cell: 5.0, material: 'courtSlab', group: 'sitework.court', h: 0.1 });
  // court markings: outer rectangle + centre line + keys
  const lines = [
    [[x0 + 1.5, z0 + 1.5], [x1 - 1.5, z0 + 1.5]], [[x0 + 1.5, z1 - 1.5], [x1 - 1.5, z1 - 1.5]],
    [[x0 + 1.5, z0 + 1.5], [x0 + 1.5, z1 - 1.5]], [[x1 - 1.5, z0 + 1.5], [x1 - 1.5, z1 - 1.5]],
    [[x0 + 1.5, (z0 + z1) / 2], [x1 - 1.5, (z0 + z1) / 2]],
    [[-19.5, z0 + 1.5], [-19.5, z0 + 7]], [[-14.5, z0 + 1.5], [-14.5, z0 + 7]], [[-19.5, z0 + 7], [-14.5, z0 + 7]],
    [[-19.5, z1 - 1.5], [-19.5, z1 - 7]], [[-14.5, z1 - 1.5], [-14.5, z1 - 7]], [[-19.5, z1 - 7], [-14.5, z1 - 7]],
  ];
  lines.forEach(([a, b], i) => {
    const alongX = Math.abs(b[0] - a[0]) > 0.1;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dir = alongX ? Math.sign(b[0] - a[0]) : Math.sign(b[1] - a[1]);
    ES.add({ system: 'court-lines', group: 'sitework.courtlines', category: 'site', module: trimStrip(len, 0.006, 0.07), material: 'courtLine',
      pos: [a[0], 0.1, a[1]], rot: [0, alongX ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2), 0], anim: { type: 'unroll' }, order: i, tags: tag(L, a[0], a[1]) });
  });
  // hoops
  const hoop = MODULES.define('hoop', () => merge([
    cylinder(0.07, 3.3, { seg: 10 }),
    xf(box(1.2, 0.12, 0.12, { anchor: ANCHOR.bottom }), { t: [0, 3.25, -0.55], r: [0, Math.PI / 2, 0] }),
    xf(box(1.8, 1.05, 0.05, { anchor: ANCHOR.bottom }), { t: [0, 2.9, -1.15] }),
  ]));
  for (const [z, ry] of [[z0 + 0.3, Math.PI], [z1 - 0.3, 0]]) {
    ES.add({ system: 'hoops', group: 'sitework.hoops', category: 'fixture', module: hoop, material: 'steel', pos: [-17, 0.1, z], rot: [0, ry, 0],
      anim: { type: 'rise' }, order: z, tags: tag(L, -17, z) });
  }
  // steel shed over the play area (front-left in the video)
  const sx0 = -47, sx1 = -29, sz0 = 22, sz1 = 40;
  const post = boxModule(0.18, 4.6, 0.18, 'bottom', 0.01);
  const xs = [sx0, (sx0 + sx1) / 2, sx1], zs = [sz0, (sz0 + sz1) / 2, sz1];
  for (const x of xs) for (const z of zs) {
    ES.add({ system: 'shed', group: 'sitework.shed.posts', category: 'frame', module: post, material: 'steel', pos: [x, 0, z], anim: { type: 'rise' }, order: x, tags: tag(L, x, z) });
  }
  ES.add({ system: 'shed', group: 'sitework.shed.posts', category: 'site', module: boxModule(sx1 - sx0 - 0.6, 0.08, sz1 - sz0 - 0.6, 'bottom', 0), material: 'courtSlab',
    pos: [(sx0 + sx1) / 2, 0, (sz0 + sz1) / 2], anim: { type: 'drop', dist: 0.4 }, order: 0, tags: tag(L, sx0, sz0) });
  for (const z of zs) {
    ES.add({ system: 'shed', group: 'sitework.shed.frame', category: 'roofframe', module: boxModule(sx1 - sx0 + 1.2, 0.3, 0.16, 'bottom', 0.01), material: 'steel',
      pos: [(sx0 + sx1) / 2, 4.6, z], anim: { type: 'lift', dist: 4 }, order: z, tags: tag(L, sx0, z) });
  }
  for (let i = 0; i < 6; i++) {
    const za = sz0 - 0.8 + ((sz1 - sz0 + 1.6) * i) / 6, zb = za + (sz1 - sz0 + 1.6) / 6;
    const w = zb - za + 0.05, len = sx1 - sx0 + 1.4;
    const mod = MODULES.define(`shedsheet:${len.toFixed(2)}:${w.toFixed(2)}`, () => sheet(w, len).rotateY(Math.PI / 2));
    ES.add({ system: 'shed', group: 'sitework.shed.sheets', category: 'roofcover', module: mod, material: 'sheetGrey',
      pos: [(sx0 + sx1) / 2, 4.95, (za + zb) / 2], anim: { type: 'sheet' }, order: za, tags: tag(L, sx0, za) });
  }
  // a slide under the shed
  const slide = MODULES.define('slide', () => merge([
    xf(box(0.7, 0.06, 3.4, { anchor: ANCHOR.center }), { t: [0, 1.0, 0], r: [0.55, 0, 0] }),
    xf(box(0.9, 1.9, 0.9, { anchor: ANCHOR.bottom }), { t: [0, 0, -1.9] }),
  ]));
  ES.add({ system: 'shed', group: 'sitework.hoops', category: 'fixture', module: slide, material: 'slide', pos: [-40, 0.08, 33], anim: { type: 'grow' }, order: 1, tags: tag(L, -40, 33) });
}

function fence(ES, L) {
  const x = 52, z0 = -6, z1 = 50, n = Math.round((z1 - z0) / 3);
  const post = boxModule(0.08, 2.4, 0.08, 'bottom', 0);
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    ES.add({ system: 'fence', group: 'sitework.fence', category: 'frame', module: post, material: 'steel', pos: [x, 0, z], anim: { type: 'rise' }, order: z, tags: tag(L, x, z, { step: 0 }) });
    if (i < n) {
      const net = MODULES.define('fencenet', () => { const g = new THREE.PlaneGeometry((z1 - z0) / n - 0.08, 2.1); g.translate(0, 1.2, 0); return g; });
      ES.add({ system: 'fence', group: 'sitework.fence', category: 'site', module: net, material: 'fenceNet', pos: [x, 0, z + (z1 - z0) / n / 2], rot: [0, Math.PI / 2, 0],
        anim: { type: 'rise' }, order: z, tags: tag(L, x, z, { step: 1 }) });
    }
  }
}

function landscaping(ES, L) {
  const rnd = mulberry32(77);
  // turf strips (rolled out) on the verges
  const verges = [
    { x0: L.xOutL - 12, x1: L.xOutL - 1.6, z0: -44, z1: 20 },
    { x0: L.xOutR + 1.6, x1: L.xOutR + 14, z0: -44, z1: -1 },
    { x0: -52, x1: -29.5, z0: 42, z1: 50 },
    { x0: -6.5, x1: 0, z0: 22, z1: 48 },
  ];
  for (const v of verges) {
    for (let x = v.x0; x < v.x1 - 0.2; x += 1.0) {
      const w = Math.min(1.0, v.x1 - x);
      ES.add({ system: 'turf', group: 'sitework.grass', category: 'site', module: trimStrip(v.z1 - v.z0, 0.03, w), material: 'grass',
        pos: [x + w / 2, 0, v.z0], rot: [0, -Math.PI / 2, 0], anim: { type: 'unroll' }, order: x * 0.02 + v.z0 * 0.001, tags: tag(L, x, v.z0) });
    }
  }
  // planting: young coconut palms and shrubs along the campus edges
  const palm = palmGeometries(9);
  const trunk = MODULES.define('palmtrunk', () => palm.trunk.clone().scale(0.62, 0.62, 0.62));
  const fronds = MODULES.define('palmfronds', () => palm.fronds.clone().scale(0.62, 0.62, 0.62));
  const shrub = MODULES.define('shrub', () => {
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.IcosahedronGeometry(0.7 + rnd() * 0.3, 1);
      g.translate((rnd() - 0.5) * 1.0, 0.55 + rnd() * 0.3, (rnd() - 0.5) * 1.0);
      parts.push(g);
    }
    return merge(parts);
  });
  const palms = [[-38, -40], [-38, -10], [-38, 12], [38, -40], [39, -22], [39, -6], [-3.5, 27], [-3.5, 41], [48, 2], [-50, 44]];
  palms.forEach(([x, z], i) => {
    for (const [mod, mat] of [[trunk, 'trunk'], [fronds, 'frond']]) {
      ES.add({ system: 'planting', group: 'sitework.plants', category: 'plant', module: mod, material: mat, pos: [x, 0, z], rot: [0, rnd() * 6.28, 0],
        anim: { type: 'grow' }, order: i, tags: tag(L, x, z, { unit: `palm${i}` }) });
    }
  });
  for (let i = 0; i < 26; i++) {
    const side = i % 3;
    const x = side === 0 ? L.xOutL - 2.4 - rnd() * 6 : side === 1 ? L.xOutR + 2.4 + rnd() * 8 : -5.5 + rnd() * 4.5;
    const z = side === 2 ? 23 + rnd() * 24 : -42 + rnd() * (side === 0 ? 60 : 38);
    ES.add({ system: 'planting', group: 'sitework.plants', category: 'plant', module: shrub, material: 'shrub', pos: [x, 0, z], rot: [0, rnd() * 6.28, 0],
      anim: { type: 'grow' }, order: 10 + i, tags: tag(L, x, z) });
  }
}

// ---- the bus fleet (the courtyard in the video is full of yellow buses) ---------------
function busModules() {
  const Lb = 9.4, W = 2.45, H = 2.75;
  const body = MODULES.define('bus:body', () => merge([
    xf(box(W, H - 0.9, Lb, { anchor: ANCHOR.bottom, bevel: 0.08 }), { t: [0, 0.45, 0] }),
    xf(box(W - 0.1, 0.18, Lb - 0.3, { anchor: ANCHOR.bottom, bevel: 0.05 }), { t: [0, H - 0.47, 0] }),
  ]));
  const glass = MODULES.define('bus:glass', () => merge([
    xf(box(W + 0.02, 0.85, Lb - 2.4, { anchor: ANCHOR.bottom }), { t: [0, 1.45, -0.6] }),
    xf(box(W - 0.3, 1.0, 0.04, { anchor: ANCHOR.bottom }), { t: [0, 1.35, Lb / 2 + 0.005] }),
  ]));
  const dark = MODULES.define('bus:dark', () => {
    const parts = [xf(box(W + 0.04, 0.3, 0.2, { anchor: ANCHOR.bottom }), { t: [0, 0.4, Lb / 2 - 0.05] })];
    for (const zz of [Lb / 2 - 1.7, -Lb / 2 + 2.2]) for (const xx of [-W / 2 + 0.12, W / 2 - 0.12]) {
      const w = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16); w.rotateZ(Math.PI / 2); w.translate(xx, 0.5, zz); parts.push(w);
    }
    return merge(parts);
  });
  const plate = MODULES.define('bus:plate', () => { const g = new THREE.PlaneGeometry(1.5, 0.28); g.translate(0, 2.52, Lb / 2 + 0.03); return g; });
  return { body, glass, dark, plate, Lb };
}

function buses(ES, L) {
  const m = busModules();
  const zBack = L.zBackIn + 1.4 + m.Lb / 2, zFront = zBack + m.Lb + 1.5;
  const slots = [
    ...[-18.3, -15.5, -12.7, -9.9].map((x) => [x, zBack]), ...[-17.2, -14.2, -11.2].map((x) => [x, zFront]),
    ...[9.9, 12.7, 15.5, 18.3].map((x) => [x, zBack]), ...[10.4, 13.4, 16.4].map((x) => [x, zFront + 0.4]),
  ];
  slots.forEach(([x, z], i) => {
    const order = (z < -15 ? 0 : 1) * 10 + i * 0.3;
    const yaw = (i % 3 - 1) * 0.02;
    for (const [mod, mat] of [[m.body, 'busYellow'], [m.glass, 'busGlass'], [m.dark, 'tyre'], [m.plate, 'busPlate']]) {
      ES.add({ system: 'buses', group: 'sitework.buses', category: 'vehicle', module: mod, material: mat, pos: [x, 0.08, z], rot: [0, yaw, 0],
        anim: { type: 'drive', dir: [0, 0, 1], dist: 34 - z * 0.2 }, order, tags: tag(L, x, z, { unit: `bus${i}` }), seed: 0.5 });
    }
  });
}
