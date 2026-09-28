// create_roof(): the light-gauge metal roofs over the roof terraces (grey
// galvalume on steel posts + trusses, one gable per wing, valleys formed where
// the wings meet), the two red cross-gables flanking the tower on the
// courtyard side, and the stair headroom ("mumty") at the right wing end.
import * as THREE from 'three';
import { BUILDING as B, ROOF_LEVEL } from '../config.js';
import { boxModule, MODULES } from '../core/modules.js';
import { box, ANCHOR, merge, xf } from '../core/geometry.js';
import { roofTruss, roofSheet } from './parts.js';
import { sOf, courses } from './common.js';

const rad = THREE.MathUtils.degToRad;

// Generic gable roof over a wing.
//   axis: 'x' (ridge runs along X) or 'z'; ridge: fixed coordinate of the ridge
//   half: half-span to the post lines; stations: truss positions along axis
//   ext: [from, to] extent of the covering along the axis (incl. overhangs)
//   sides: slopes present; [-1] or [1] builds a mono-pitch half roof on
//   half-trusses with posts under the ridge.
function gableRoof(ES, L, cfg) {
  const { axis, ridge, half, stations, ext, eave, pitch, sheetMat, sides = [-1, 1], overhang = B.roofOverhang, group = 'roof', wing } = cfg;
  const tan = Math.tan(pitch), cos = Math.cos(pitch);
  const inset = 0.25;
  const ridgeY = eave + (half - inset) * tan;          // top chord apex
  const chordY = (d) => ridgeY - d * tan;               // top chord at distance d from ridge
  const P = (a, c, y) => (axis === 'x' ? [a, y, c] : [c, y, a]);
  const alongRot = axis === 'x' ? 0 : Math.PI / 2;
  const s = (a) => sOf(L, ...(axis === 'x' ? [a, ridge] : [ridge, a]));
  const tags = (a) => ({ wing, s: s(a), floor: 4 });
  const halfRoof = sides.length === 1;
  // local +X of a truss maps to world -Z (axis x) or +X (axis z)
  const localSide = axis === 'x' ? -sides[0] : sides[0];

  // posts
  const postH = eave - ROOF_LEVEL;
  const post = boxModule(0.14, postH, 0.14, 'bottom', 0.01);
  const ridgePost = boxModule(0.16, ridgeY - ROOF_LEVEL, 0.16, 'bottom', 0.01);
  for (const a of stations) {
    const postSides = halfRoof ? sides : [-1, 1];
    for (const sd of postSides) {
      ES.add({ system: 'roof-posts', group: `${group}.posts`, category: 'roofframe', module: post, material: 'steel',
        pos: P(a, ridge + sd * (half - inset), ROOF_LEVEL), anim: { type: 'rise' }, order: s(a), tags: tags(a) });
    }
    if (halfRoof) {
      ES.add({ system: 'roof-posts', group: `${group}.posts`, category: 'roofframe', module: ridgePost, material: 'steel',
        pos: P(a, ridge, ROOF_LEVEL), anim: { type: 'rise' }, order: s(a), tags: tags(a) });
    }
  }
  // trusses, lowered into place by the crane
  const truss = roofTruss(2 * (half - inset), (half - inset) * tan, overhang + inset, halfRoof ? localSide : 0);
  for (const a of stations) {
    ES.add({ system: 'roof-trusses', group: `${group}.trusses`, category: 'roofframe', module: truss, material: 'steel',
      pos: P(a, ridge, eave), rot: [0, axis === 'x' ? Math.PI / 2 : 0, 0], anim: { type: 'lift', dist: 6 }, order: s(a), tags: tags(a) });
  }
  // bays along the axis for purlins + sheets
  const cuts = [ext[0], ...stations.filter((a) => a > ext[0] + 0.3 && a < ext[1] - 0.3), ext[1]];
  const bays = cuts.slice(0, -1).map((a, i) => [a, cuts[i + 1]]);
  const slopeLen = (half + overhang) / cos;
  const purlinD = [0.1, 0.36, 0.62, 0.88].map((f) => f * (half - inset));
  for (const [a0, a1] of bays) {
    const len = a1 - a0, ac = (a0 + a1) / 2;
    for (const sd of sides) {
      for (const dd of purlinD) {
        ES.add({ system: 'roof-purlins', group: `${group}.purlins`, category: 'roofframe', module: boxModule(len, 0.1, 0.06, 'center', 0), material: 'steel',
          pos: P(ac, ridge + sd * dd, chordY(dd) + 0.095), rot: [sd * pitch, alongRot, 0],
          anim: { type: 'slide', axis: axis === 'x' ? [1, 0, 0] : [0, 0, 1], dist: Math.min(2.5, len * 0.6) }, order: s(ac), tags: tags(ac) });
      }
      const dm = (half + overhang) / 2;
      const rot = axis === 'x' ? [pitch, sd > 0 ? 0 : Math.PI, 0] : [pitch, sd > 0 ? Math.PI / 2 : -Math.PI / 2, 0];
      ES.add({ system: 'roof-sheets', group: `${group}.sheets`, category: 'roofcover', module: roofSheet(len + 0.06, slopeLen + 0.05), material: sheetMat,
        pos: P(ac, ridge + sd * dm, chordY(dm) + 0.15), rot, anim: { type: 'sheet' }, order: s(ac) + (sd > 0 ? 0.004 : 0), tags: tags(ac) });
    }
    if (!halfRoof) {
      const cap = MODULES.define(`ridgecap:${len.toFixed(3)}:${pitch.toFixed(3)}`, () => merge([
        xf(box(len + 0.04, 0.02, 0.34, { anchor: ANCHOR.center }), { t: [0, 0, 0.15], r: [pitch, 0, 0] }),
        xf(box(len + 0.04, 0.02, 0.34, { anchor: ANCHOR.center }), { t: [0, 0, -0.15], r: [-pitch, 0, 0] }),
      ]));
      ES.add({ system: 'roof-ridge', group: `${group}.ridge`, category: 'roofcover', module: cap, material: sheetMat === 'sheetRed' ? 'sheetRed' : 'ridgeGrey',
        pos: P(ac, ridge, ridgeY + 0.19), rot: [0, alongRot, 0], anim: { type: 'drop', dist: 1.2 }, order: s(ac), tags: tags(ac) });
    }
  }
}

export function createRoofs(ES, L) {
  const eave = ROOF_LEVEL + B.terracePostHeight;
  const pitch = rad(B.roofPitchDeg);
  const half = L.D / 2;
  const tH = L.towerHalf;
  const ov = B.roofOverhang;
  const zRidgeB = L.zBackOut + half;
  const inRange = (a, lo, hi) => a >= lo - 1e-6 && a <= hi + 1e-6;
  // back wing: two halves either side of the tower; between the tower and the
  // corners only the rear slope (the red cross-gables cover the front)
  for (const sgn of [-1, 1]) {
    const lo = sgn < 0 ? L.xOutL - ov : tH + 0.15, hi = sgn < 0 ? -tH - 0.15 : L.xOutR + ov;
    const st = L.xsBack.filter((x) => inRange(x, sgn < 0 ? L.xOutL : tH + 0.6, sgn < 0 ? -tH - 0.6 : L.xOutR));
    if (sgn < 0) st.push(-tH - 0.6); else st.unshift(tH + 0.6);
    const cornerEdge = sgn < 0 ? L.xInL : L.xInR;
    // corner squares: full gable
    const cLo = sgn < 0 ? lo : cornerEdge, cHi = sgn < 0 ? cornerEdge : hi;
    gableRoof(ES, L, { axis: 'x', ridge: zRidgeB, half, stations: st.filter((x) => inRange(x, cLo, cHi)), ext: [cLo, cHi], eave, pitch, sheetMat: 'sheetGrey', wing: 'B', group: 'roof' });
    // between tower and corner: rear slope only (sd = -1 is towards -z, the back)
    const mLo = sgn < 0 ? cornerEdge : lo, mHi = sgn < 0 ? hi : cornerEdge;
    gableRoof(ES, L, { axis: 'x', ridge: zRidgeB, half, stations: st.filter((x) => inRange(x, mLo + 0.1, mHi - 0.1)), ext: [mLo, mHi], eave, pitch, sheetMat: 'sheetGrey', sides: [-1], wing: 'B', group: 'roof' });
  }
  // side wings: ridge along Z, running into the back roof (valleys)
  const zBackRidge = zRidgeB + 0.5;
  const leftSt = [zBackRidge, ...L.zsLeft];
  gableRoof(ES, L, { axis: 'z', ridge: L.xOutL + half, half, stations: leftSt, ext: [zBackRidge - 0.5, L.zLeftFront + ov], eave, pitch, sheetMat: 'sheetGrey', wing: 'L', group: 'roof' });
  const mumtyZ = L.zsRight[L.zsRight.length - 2];
  const rightSt = [zBackRidge, ...L.zsRight.filter((z) => z < mumtyZ - 0.1), mumtyZ - 0.35];
  gableRoof(ES, L, { axis: 'z', ridge: L.xOutR - half, half, stations: rightSt, ext: [zBackRidge - 0.5, mumtyZ - 0.05], eave, pitch, sheetMat: 'sheetGrey', wing: 'R', group: 'roof' });

  // red cross-gables over the back corridor between tower and corners
  const redPitch = rad(B.redGablePitchDeg);
  for (const sgn of [-1, 1]) {
    const x0 = sgn < 0 ? L.xInL + 0.1 : tH + 0.45, x1 = sgn < 0 ? -tH - 0.45 : L.xInR - 0.1;
    const rh = (x1 - x0) / 2, rc = (x0 + x1) / 2;
    gableRoof(ES, L, { axis: 'z', ridge: rc, half: rh, stations: [L.zBackIn - 0.25, L.zClassB, zRidgeB + 0.6], ext: [zRidgeB, L.zBackIn + 0.95], eave: eave - 0.3, pitch: redPitch, sheetMat: 'sheetRed', overhang: 0.25, wing: 'B', group: 'roof' });
  }
  createMumty(ES, L);
}

// Stair headroom at the right wing end
function createMumty(ES, L) {
  const z0 = L.zsRight[L.zsRight.length - 2], z1 = L.zRightFront, x0 = L.xClassR, x1 = L.xOutR;
  const H = 2.9, t = 0.2, y0 = ROOF_LEVEL;
  const walls = [
    { a: [x0, z0], b: [x1, z0], door: true }, { a: [x0, z1], b: [x1, z1] },
    { a: [x0, z0 + t / 2], b: [x0, z1 - t / 2] }, { a: [x1, z0 + t / 2], b: [x1, z1 - t / 2] },
  ];
  for (const w of walls) {
    const alongX = Math.abs(w.b[0] - w.a[0]) > 0.1;
    const len = alongX ? Math.abs(w.b[0] - w.a[0]) + t : Math.abs(w.b[1] - w.a[1]);
    const cx = (w.a[0] + w.b[0]) / 2, cz = (w.a[1] + w.b[1]) / 2;
    const s = sOf(L, cx, cz);
    const segs = w.door ? [[-len / 2, -0.6], [0.6, len / 2]] : [[-len / 2, len / 2]];
    for (const [p0, p1] of segs) {
      for (const c of courses(w.door ? 2.1 : H)) {
        const off = (p0 + p1) / 2;
        ES.add({ system: 'mumty', group: 'roof.mumty.walls', category: 'wall', module: boxModule(p1 - p0, c.h, t, 'bottom', 0), material: 'masonry',
          pos: alongX ? [cx + off, y0 + c.y, cz] : [cx, y0 + c.y, cz + off], rot: [0, alongX ? 0 : Math.PI / 2, 0],
          anim: { type: 'lay' }, order: s, tags: { wing: 'R', s, step: c.k, floor: 4 } });
      }
    }
    if (w.door) {
      ES.add({ system: 'mumty', group: 'roof.mumty.walls', category: 'wall', module: boxModule(len, H - 2.1, t, 'bottom', 0), material: 'masonry',
        pos: [cx, y0 + 2.1, cz], anim: { type: 'lay' }, order: sOf(L, cx, cz), tags: { wing: 'R', s: sOf(L, cx, cz), step: 5, floor: 4 } });
    }
  }
  const slab = boxModule(x1 - x0 + 0.6, 0.14, z1 - z0 + 0.5, 'bottom', 0.01);
  ES.add({ system: 'mumty', group: 'roof.mumty.slab', category: 'roofcover', module: slab, material: 'frame',
    pos: [(x0 + x1) / 2, y0 + H, (z0 + z1) / 2 + 0.05], anim: { type: 'pour' }, order: 0, tags: { wing: 'R', s: 1, floor: 4 } });
}
