// The central tower on the back wing: a glazed room at terrace level carrying
// the "DE PAUL PUBLIC SCHOOL" board, a grey gable roof, and the white tank /
// stair-headroom block rising through the roof. Also the "DE PAUL JUNIOR
// COLLEGE" board on the junior-college (left wing) end.
import * as THREE from 'three';
import { BUILDING as B, ROOF_LEVEL } from '../config.js';
import { boxModule, MODULES } from '../core/modules.js';
import { box, merge, xf, ANCHOR } from '../core/geometry.js';
import { wallRun, sOf } from './common.js';
import { roofTruss, roofSheet } from './parts.js';

const ROOM_H = 3.85;      // column height of the glazed room
const SILL = 0.9;

// Sign board: a front face with the lettering texture (UV 0..1) + steel frame
function signModules(w, h) {
  const face = MODULES.define(`signface:${w}:${h}`, () => {
    const g = new THREE.PlaneGeometry(w, h);
    g.translate(0, h / 2, 0.041);
    return g;
  });
  const frame = MODULES.define(`signframe:${w}:${h}`, () => merge([
    box(w + 0.12, h + 0.12, 0.08, { anchor: [0.5, 0, 0.5] }).translate(0, -0.06, 0),
  ]));
  return { face, frame };
}

export function createTower(ES, L) {
  const x0 = -L.towerHalf, x1 = L.towerHalf, z0 = L.zBackOut, z1 = L.zBackIn;
  const y0 = ROOF_LEVEL;
  const cw = B.columnWidth;
  const xs = [-8, -4, 0, 4, 8].map((v) => (v / 8) * L.towerHalf);
  const zs = [z0, -32.4, L.zClassB, z1];
  const cols = [];
  for (const x of xs) for (const z of [z0, z1]) cols.push([x, z]);
  for (const x of [x0, x1]) for (const z of zs.slice(1, -1)) cols.push([x, z]);
  const colMod = boxModule(cw, ROOM_H, cw, 'bottom', 0.015);
  for (const [x, z] of cols) {
    const s = sOf(L, x, z);
    ES.add({ system: 'tower-columns', group: 'tower.columns', category: 'frame', module: colMod, material: 'frame',
      pos: [x, y0, z], anim: { type: 'rise' }, order: s, tags: { wing: 'T', s, floor: 4 } });
  }
  // ring beams + walls/glazing between columns on the 4 sides
  const beamY = y0 + ROOM_H - 0.35;
  const sides = [
    { pts: xs.map((x) => [x, z1]), normal: [0, 0, 1] },
    { pts: xs.map((x) => [x, z0]), normal: [0, 0, -1] },
    { pts: zs.map((z) => [x0, z]), normal: [-1, 0, 0] },
    { pts: zs.map((z) => [x1, z]), normal: [1, 0, 0] },
  ];
  for (const side of sides) {
    for (let i = 0; i < side.pts.length - 1; i++) {
      const [ax, az] = side.pts[i], [bx, bz] = side.pts[i + 1];
      const alongX = Math.abs(bx - ax) > 0.1;
      const len = Math.hypot(bx - ax, bz - az) - cw;
      const cx = (ax + bx) / 2, cz = (az + bz) / 2;
      const s = sOf(L, cx, cz);
      ES.add({ system: 'tower-beams', group: 'tower.beams', category: 'frame', module: boxModule(len, 0.35, 0.3, 'bottom', 0.01), material: 'frame',
        pos: [cx, beamY, cz], rot: [0, alongX ? 0 : Math.PI / 2, 0], anim: { type: 'slide', axis: alongX ? [1, 0, 0] : [0, 0, 1], dist: 2 }, order: s, tags: { wing: 'T', s, floor: 4 } });
      // sill wall + full-height glazing (the glazed room seen in the video)
      const a = alongX ? [ax + Math.sign(bx - ax) * cw / 2, az] : [ax, az + Math.sign(bz - az) * cw / 2];
      const b = alongX ? [bx - Math.sign(bx - ax) * cw / 2, bz] : [bx, bz - Math.sign(bz - az) * cw / 2];
      const glazH = ROOM_H - 0.35 - SILL;
      wallRun(ES, L, { a, b, y0, h: ROOM_H - 0.35, t: 0.2, group: 'tower.walls', openGroup: 'tower.glazing', glassGroup: 'tower.glass',
        wing: 'T', floor: 4, normal: side.normal,
        openings: [{ at: len / 2, w: len - 0.02, y: SILL, h: glazH - 0.01, kind: 'window', panes: 4 }] });
    }
  }
  // roof slab of the glazed room
  const slabY = y0 + ROOM_H;
  ES.add({ system: 'tower-slab', group: 'tower.slab', category: 'slab', module: boxModule(x1 - x0 + 0.5, 0.15, z1 - z0 + 0.5, 'bottom', 0.01),
    material: 'frame', pos: [0, slabY, (z0 + z1) / 2], anim: { type: 'pour' }, order: 0.5, tags: { wing: 'T', s: 0.5, floor: 4 } });
  const top = slabY + 0.15;
  // tank / headroom block rising through the back slope of the tower roof
  const tx = 3.2, tz0 = z0 + 0.8, tz1 = -30.4, th = 3.9;
  const tw = [[[-tx, tz0], [tx, tz0], [0, 0, -1]], [[tx, tz1], [-tx, tz1], [0, 0, 1]], [[-tx, tz1 - 0.1], [-tx, tz0 + 0.1], [-1, 0, 0]], [[tx, tz0 + 0.1], [tx, tz1 - 0.1], [1, 0, 0]]];
  for (const [a, b, n] of tw) {
    wallRun(ES, L, { a, b, y0: top, h: th, t: 0.2, group: 'tower.tank.walls', openGroup: 'tower.glazing', glassGroup: 'tower.glass', wing: 'T', floor: 5, normal: n });
  }
  ES.add({ system: 'tower-tank', group: 'tower.tank.slab', category: 'roofcover', module: boxModule(2 * tx + 0.5, 0.15, tz1 - tz0 + 0.5, 'bottom', 0.01),
    material: 'frame', pos: [0, top + th, (tz0 + tz1) / 2], anim: { type: 'pour' }, order: 0.5, tags: { wing: 'T', s: 0.5, floor: 5 } });

  // tower gable roof (ridge along X), on short posts over the room slab
  const pitch = THREE.MathUtils.degToRad(B.roofPitchDeg);
  const half = (z1 - z0) / 2, ridge = (z0 + z1) / 2, ov = 0.8, inset = 0.25;
  const eave = top + 0.3;
  const tan = Math.tan(pitch);
  const ridgeY = eave + (half - inset) * tan;
  const truss = roofTruss(2 * (half - inset), (half - inset) * tan, ov + inset);
  const post = boxModule(0.14, 0.3, 0.14, 'bottom', 0);
  const stations = [x0, -4.8, 4.8, x1];
  for (const a of stations) {
    const s = sOf(L, a, ridge);
    for (const sd of [-1, 1]) {
      ES.add({ system: 'roof-posts', group: 'tower.roof.posts', category: 'roofframe', module: post, material: 'steel',
        pos: [a, top, ridge + sd * (half - inset)], anim: { type: 'rise' }, order: s, tags: { wing: 'T', s, floor: 5 } });
    }
    ES.add({ system: 'roof-trusses', group: 'tower.roof.trusses', category: 'roofframe', module: truss, material: 'steel',
      pos: [a, eave, ridge], rot: [0, Math.PI / 2, 0], anim: { type: 'lift', dist: 6 }, order: s, tags: { wing: 'T', s, floor: 5 } });
  }
  const cuts = [x0 - ov, -4.8, 4.8, x1 + ov];
  const slopeLen = (half + ov) / Math.cos(pitch);
  for (let i = 0; i < cuts.length - 1; i++) {
    const a0 = cuts[i], a1 = cuts[i + 1], len = a1 - a0, ac = (a0 + a1) / 2;
    const s = sOf(L, ac, ridge);
    for (const sd of [-1, 1]) {
      for (const f of [0.1, 0.36, 0.62, 0.88]) {
        const dd = f * (half - inset);
        ES.add({ system: 'roof-purlins', group: 'tower.roof.purlins', category: 'roofframe', module: boxModule(len, 0.1, 0.06, 'center', 0), material: 'steel',
          pos: [ac, ridgeY - dd * tan + 0.095, ridge + sd * dd], rot: [sd * pitch, 0, 0], anim: { type: 'slide', axis: [1, 0, 0], dist: 2 }, order: s, tags: { wing: 'T', s, floor: 5 } });
      }
      const dm = (half + ov) / 2;
      ES.add({ system: 'roof-sheets', group: 'tower.roof.sheets', category: 'roofcover', module: roofSheet(len + 0.06, slopeLen + 0.05), material: 'sheetGrey',
        pos: [ac, ridgeY - dm * tan + 0.15, ridge + sd * dm], rot: [pitch, sd > 0 ? 0 : Math.PI, 0], anim: { type: 'sheet' }, order: s, tags: { wing: 'T', s, floor: 5 } });
    }
    const cap = MODULES.define(`ridgecap:${len.toFixed(3)}:${pitch.toFixed(3)}`, () => merge([
      xf(box(len + 0.04, 0.02, 0.34, { anchor: ANCHOR.center }), { t: [0, 0, 0.15], r: [pitch, 0, 0] }),
      xf(box(len + 0.04, 0.02, 0.34, { anchor: ANCHOR.center }), { t: [0, 0, -0.15], r: [-pitch, 0, 0] }),
    ]));
    ES.add({ system: 'roof-ridge', group: 'tower.roof.ridge', category: 'roofcover', module: cap, material: 'ridgeGrey',
      pos: [ac, ridgeY + 0.19, ridge], anim: { type: 'drop', dist: 1.2 }, order: s, tags: { wing: 'T', s, floor: 5 } });
  }
  createSigns(ES, L);
}

// School name boards, installed once the host walls are painted
function createSigns(ES, L) {
  const pub = signModules(13.4, 1.05);
  const zf = L.zBackIn + B.columnWidth / 2 + 0.045;   // on the face of the tower columns
  for (const [mod, mat] of [[pub.frame, 'steel'], [pub.face, 'signPublic']]) {
    ES.add({ system: 'signs', group: 'finishing.signs', category: 'sign', module: mod, material: mat,
      pos: [0, ROOF_LEVEL + 0.02, zf], anim: { type: 'install', normal: [0, 0, 1], dist: 1.6 }, order: 0, tags: { wing: 'T', s: 0.5, floor: 4, unit: 'signPublic' } });
  }
  const jun = signModules(9.2, 0.92);
  const xc = (L.xOutL + L.xInL) / 2;
  for (const [mod, mat] of [[jun.frame, 'steel'], [jun.face, 'signJunior']]) {
    ES.add({ system: 'signs', group: 'finishing.signs', category: 'sign', module: mod, material: mat,
      pos: [xc, ROOF_LEVEL + 0.04, L.zLeftFront + 0.14], anim: { type: 'install', normal: [0, 0, 1], dist: 1.6 }, order: 1, tags: { wing: 'L', s: 0, floor: 4, unit: 'signJunior' } });
  }
}
