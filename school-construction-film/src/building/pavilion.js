// The central courtyard pavilion (porch/stage block) in front of the tower:
// raised red stage with blue-grey plinth and side steps, twin round porch
// columns, a two-storey core with three windows over the porch, lower side
// parts, and a Kerala-style clay-tile roof: a hipped main roof with a front
// gablet, flanked by lower lean-to hips. Roofs are built from timber rafters,
// then tile courses laid eave to ridge.
import * as THREE from 'three';
import { BUILDING as B } from '../config.js';
import { boxModule, MODULES } from '../core/modules.js';
import { merge, xf, box, ANCHOR, polygon } from '../core/geometry.js';
import { porchColumn, jaliPanel, trimStrip } from './parts.js';
import { wallRun, sOf } from './common.js';

const P = B.pavilion;
const CW = B.columnWidth;
const XC = P.coreHalfWidth;                 // 5.0
const XS = XC + P.sideWidth;                // 8.0
const ZB = -25.4;                           // back column line (free-standing frame)
const ZF = P.front;                         // core front wall
const ZSF = P.sideFront;                    // side parts front wall
const ZM = -21.2;
const ZP = -13.75;                          // porch columns
const Y1 = P.firstFloor;                    // 4.6
const EAVE = P.eave;                        // 8.0
const SIDE_EAVE = 6.8;                       // ring-beam top of the lower side parts

export function pavilionColumns() {
  const cols = [];
  for (const sx of [-1, 1]) {
    for (const z of [ZF, ZSF, ZM, ZB]) cols.push({ x: sx * XC, z, core: true });
    for (const z of [ZSF, ZM, ZB]) cols.push({ x: sx * XS, z, core: false });
  }
  return cols;
}

// footings for the foundation phase (pavilion columns + porch twin pairs)
export function pavilionFootings(L) {
  const list = pavilionColumns().map((c) => ({ x: c.x, z: c.z, wing: 'P', order: sOf(L, c.x, c.z) }));
  for (const sx of [-1, 1]) list.push({ x: sx * 4.17, z: ZP, wing: 'P', order: sOf(L, sx * 4.17, ZP) });
  return list;
}

const tagsAt = (L, x, z, floor = 0, extra = {}) => ({ wing: 'P', s: sOf(L, x, z), floor, ...extra });

export function createPavilion(ES, L) {
  structure(ES, L);
  stage(ES, L);
  walls(ES, L);
  roofs(ES, L);
}

function structure(ES, L) {
  const cols = pavilionColumns();
  // ground floor columns from the plinth to the first-floor beams
  const hG = (Y1 - 0.15) - 0.45;              // from pedestal top to slab soffit
  for (const c of cols) {
    ES.add({ system: 'columns', group: 'pav.columns.F0', category: 'frame', module: boxModule(CW, hG, CW, 'bottom', 0.015), material: 'frame',
      pos: [c.x, 0.45, c.z], anim: { type: 'rise' }, order: sOf(L, c.x, c.z), tags: tagsAt(L, c.x, c.z) });
    const hU = (c.core ? EAVE : SIDE_EAVE) - 0.35 - Y1;
    ES.add({ system: 'columns', group: 'pav.columns.F1', category: 'frame', module: boxModule(CW, hU, CW, 'bottom', 0.015), material: 'frame',
      pos: [c.x, Y1, c.z], anim: { type: 'rise' }, order: sOf(L, c.x, c.z), tags: tagsAt(L, c.x, c.z, 1) });
  }
  // twin porch columns on the stage
  for (const sx of [-1, 1]) for (const dx of [-0.28, 0.28]) {
    const x = sx * 4.17 + dx;
    ES.add({ system: 'porch-columns', group: 'pav.porch', category: 'frame', module: porchColumn(Y1 - 0.15 - 0.35 - P.stageHeight), material: 'frame',
      pos: [x, P.stageHeight, ZP], anim: { type: 'rise' }, order: sOf(L, x, ZP), tags: tagsAt(L, x, ZP) });
  }
  // beams: first floor and roof ring
  const lines = [];
  for (const sx of [-1, 1]) {
    lines.push([[sx * XC, ZF], [sx * XC, ZSF]], [[sx * XC, ZSF], [sx * XC, ZM]], [[sx * XC, ZM], [sx * XC, ZB]]);
    lines.push([[sx * XS, ZSF], [sx * XS, ZM]], [[sx * XS, ZM], [sx * XS, ZB]]);
    lines.push([[sx * XC, ZSF], [sx * XS, ZSF]], [[sx * XC, ZM], [sx * XS, ZM]], [[sx * XC, ZB], [sx * XS, ZB]]);
  }
  lines.push([[-XC, ZF], [XC, ZF]], [[-XC, ZM], [XC, ZM]], [[-XC, ZB], [XC, ZB]]);
  const beam = (a, b, y, group, core = true) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) - CW;
    const alongX = Math.abs(b[0] - a[0]) > 0.1;
    const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
    ES.add({ system: 'beams', group, category: 'frame', module: boxModule(len, 0.35, 0.3, 'bottom', 0.012), material: 'frame',
      pos: [cx, y, cz], rot: [0, alongX ? 0 : Math.PI / 2, 0], anim: { type: 'slide', axis: alongX ? [1, 0, 0] : [0, 0, 1], dist: 2 },
      order: sOf(L, cx, cz), tags: tagsAt(L, cx, cz, core ? 1 : 0) });
  };
  for (const [a, b] of lines) beam(a, b, Y1 - 0.5, 'pav.beams.F0');
  // porch beam on the twin columns
  ES.add({ system: 'beams', group: 'pav.beams.F0', category: 'frame', module: boxModule(2 * XC + 0.2, 0.35, 0.36, 'bottom', 0.012), material: 'frame',
    pos: [0, Y1 - 0.5, ZP], anim: { type: 'slide', axis: [1, 0, 0], dist: 2.5 }, order: sOf(L, 0, ZP), tags: tagsAt(L, 0, ZP) });
  for (const [a, b] of lines) {
    const core = Math.abs(a[0]) <= XC + 0.01 && Math.abs(b[0]) <= XC + 0.01;
    beam(a, b, (core ? EAVE : SIDE_EAVE) - 0.35, 'pav.beams.F1', true);
  }
  // first floor slab: core (with the porch cantilever) + side parts
  const cells = [
    [-XC, XC, ZM, ZB], [-XC, XC, ZSF, ZM], [-XC, XC, ZF, ZSF], [-XC - 0.3, XC + 0.3, ZP + 0.45, ZF],
    [XC, XS, ZM, ZB], [XC, XS, ZSF, ZM], [-XS, -XC, ZM, ZB], [-XS, -XC, ZSF, ZM],
  ];
  for (const [x0, x1, z0, z1] of cells) {
    const zz0 = Math.min(z0, z1), zz1 = Math.max(z0, z1);
    const e = (v, lim) => (Math.abs(Math.abs(v) - lim) < 1e-6 ? 0.15 : 0);
    const xa = x0 - e(x0, XS), xb = x1 + e(x1, XS);
    const cx = (xa + xb) / 2, cz = (zz0 + zz1) / 2;
    ES.add({ system: 'slabs', group: 'pav.slab.F0', category: 'slab', module: boxModule(xb - xa, 0.15, zz1 - zz0, 'bottom', 0), material: 'frame',
      pos: [cx, Y1 - 0.15, cz], anim: { type: 'pour' }, order: sOf(L, cx, cz), tags: tagsAt(L, cx, cz) });
  }
  // side-part ground slabs (plinth level)
  for (const sx of [-1, 1]) for (const [z0, z1] of [[ZB, ZM], [ZM, ZSF]]) {
    const cx = sx * (XC + XS) / 2, cz = (z0 + z1) / 2;
    ES.add({ system: 'ground-slab', group: 'found.groundslab', category: 'found', module: boxModule(XS - XC, 0.15, z1 - z0, 'bottom', 0), material: 'frame',
      pos: [cx, 0.45, cz], anim: { type: 'pour' }, order: sOf(L, cx, cz), tags: tagsAt(L, cx, cz) });
  }
}

function stage(ES, L) {
  const w = 2 * (XC - CW / 2), z0 = ZB - 0.2, z1 = P.stageFront;
  const cz = (z0 + z1) / 2, h = P.stageHeight;
  ES.add({ system: 'stage', group: 'pav.stage', category: 'found', module: boxModule(w, h - 0.06, z1 - z0, 'bottom', 0.02), material: 'plinthBlue',
    pos: [0, 0, cz], anim: { type: 'emerge' }, order: 0, tags: { ...tagsAt(L, 0, cz), step: 0 } });
  ES.add({ system: 'stage', group: 'pav.stage', category: 'found', module: boxModule(w + 0.04, 0.06, z1 - z0 + 0.04, 'bottom', 0.005), material: 'stageRed',
    pos: [0, h - 0.06, cz], anim: { type: 'pour' }, order: 0, tags: { ...tagsAt(L, 0, cz), step: 1 } });
  // steps down both front corners, grille panel between them
  for (const sx of [-1, 1]) {
    const x = sx * (XC - CW / 2 - 1.1);
    for (let k = 0; k < 2; k++) {
      ES.add({ system: 'steps', group: 'pav.features', category: 'feature', module: boxModule(2.2, h * (2 - k) / 3, 0.36, 'bottom', 0.01), material: 'plinthBlue',
        pos: [x, 0, z1 + 0.18 + k * 0.36], anim: { type: 'lay' }, order: sOf(L, x, z1), tags: { ...tagsAt(L, x, z1), step: k } });
    }
  }
  ES.add({ system: 'grilles', group: 'pav.features', category: 'feature', module: jaliPanel(w - 4.4 - 0.1, h - 0.1, 0.2), material: 'grille',
    pos: [0, 0.02, z1 + 0.06], anim: { type: 'install', normal: [0, 0, 1], dist: 1 }, order: 0.5, tags: { ...tagsAt(L, 0, z1), step: 2 } });
  // first-floor ledge curb over the porch + lavender fascia
  const lz = ZP + 0.45 - 0.06;
  ES.add({ system: 'ledge', group: 'pav.features', category: 'feature', module: boxModule(2 * XC + 0.6, 0.28, 0.12, 'bottom', 0.01), material: 'frame',
    pos: [0, Y1, lz], anim: { type: 'lay' }, order: 0.6, tags: { ...tagsAt(L, 0, lz, 1), step: 3 } });
  ES.add({ system: 'trims', group: 'finishing.trims', category: 'trim', module: trimStrip(2 * XC + 0.6, 0.12, 0.02), material: 'lavender',
    pos: [-(XC + 0.3), Y1 - 0.14, lz + 0.075], anim: { type: 'unroll' }, order: 0.6, tags: tagsAt(L, 0, lz, 1) });
}

function walls(ES, L) {
  const g = { group: 'pav.walls', openGroup: 'pav.openings', glassGroup: 'pav.glass', wing: 'P' };
  const inner = CW / 2;
  // core upper front wall with three windows over the porch
  const lenF = 2 * XC - CW;
  wallRun(ES, L, { ...g, a: [-XC + inner, ZF], b: [XC - inner, ZF], y0: Y1, h: EAVE - 0.35 - Y1, normal: [0, 0, 1], floor: 1,
    openings: [-3.1, 0, 3.1].map((d) => ({ at: lenF / 2 + d, w: 1.45, y: 0.9, h: 1.25, kind: 'window', panes: 3 })) });
  for (const sx of [-1, 1]) {
    // core side walls between the front and the side parts (upper floor)
    wallRun(ES, L, { ...g, a: [sx * XC, ZF - inner], b: [sx * XC, ZSF + inner], y0: Y1, h: EAVE - 0.35 - Y1, normal: [sx, 0, 0], floor: 1,
      openings: [{ at: (ZF - ZSF - CW) / 2, w: 0.9, y: 0.9, h: 1.1, kind: 'window', panes: 2 }] });
    // side parts: ground + upper floor front walls, outer walls
    const lenS = XS - XC - CW;
    for (const [y0, h, fl] of [[0.6, Y1 - 0.5 - 0.6, 0], [Y1, SIDE_EAVE - 0.35 - Y1, 1]]) {
      wallRun(ES, L, { ...g, a: [sx * (XC + inner), ZSF], b: [sx * (XS - inner), ZSF], y0, h, normal: [0, 0, 1], floor: fl,
        openings: [{ at: lenS / 2, w: 1.2, y: fl ? 0.55 : 0.9, h: fl ? 0.95 : 1.2, kind: fl ? 'window' : 'jali' }] });
      for (const [za, zb] of [[ZSF - inner, ZM + inner], [ZM - inner, ZB + inner]]) {
        wallRun(ES, L, { ...g, a: [sx * XS, za], b: [sx * XS, zb], y0, h, normal: [sx, 0, 0], floor: fl,
          openings: [{ at: Math.abs(za - zb) / 2, w: 1.2, y: fl ? 0.55 : 0.9, h: fl ? 0.95 : 1.2, kind: 'window' }] });
      }
      // side part back walls against the tower frame line
    }
    // ground floor walls separating stage and side rooms (door to each)
    wallRun(ES, L, { ...g, a: [sx * XC, ZSF - inner], b: [sx * XC, ZM + inner], y0: 0.6, h: Y1 - 0.5 - 0.6, normal: [-sx, 0, 0], floor: 0,
      openings: [{ at: (ZSF - ZM - CW) / 2, w: 1.0, y: 0.3, h: 2.1, kind: 'door' }] });
    wallRun(ES, L, { ...g, a: [sx * XC, ZM - inner], b: [sx * XC, ZB + inner], y0: 0.6, h: Y1 - 0.5 - 0.6, normal: [-sx, 0, 0], floor: 0 });
  }
  // stage back wall with a grille door (the red back wall in the video)
  wallRun(ES, L, { ...g, a: [-XC + inner, ZB], b: [XC - inner, ZB], y0: P.stageHeight, h: Y1 - 0.5 - P.stageHeight, normal: [0, 0, 1], floor: 0,
    openings: [{ at: XC - inner, w: 2.4, y: 0, h: 2.4, kind: 'grille', cell: 0.3 }] });
  wallRun(ES, L, { ...g, a: [-XC + inner, ZB], b: [XC - inner, ZB], y0: Y1, h: EAVE - 0.35 - Y1, normal: [0, 0, -1], floor: 1 });
}

// ---------------------------------------------------------------------------
// Clay-tile roofs: planes -> rafters (frame) -> tile courses (cover)
// ---------------------------------------------------------------------------
function rod(a, b, r) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const g = new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 8, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}

// plane: eave edge E0->E1 (horizontal), polygon vertices (3D), all coplanar
function roofPlane(ES, L, plane, id) {
  const pts = plane.poly.map((p) => new THREE.Vector3(...p));
  const E0 = new THREE.Vector3(...plane.eave[0]), E1 = new THREE.Vector3(...plane.eave[1]);
  const U = E1.clone().sub(E0).normalize();
  const N = new THREE.Vector3().subVectors(pts[1], pts[0]).cross(new THREE.Vector3().subVectors(pts[2], pts[0])).normalize();
  if (N.y < 0) N.negate();
  const V = new THREE.Vector3().crossVectors(N, U).normalize();          // up-slope
  if (V.y < 0) V.negate();
  const to2 = (p) => [p.clone().sub(E0).dot(U), p.clone().sub(E0).dot(V)];
  const to3 = ([u, v], lift = 0) => E0.clone().addScaledVector(U, u).addScaledVector(V, v).addScaledVector(N, lift);
  const poly2 = pts.map(to2);
  const vMax = Math.max(...poly2.map((p) => p[1]));
  const uMin = Math.min(...poly2.map((p) => p[0])), uMax = Math.max(...poly2.map((p) => p[0]));
  const clip = (poly, v0, v1) => {
    const cut = (ps, keep, inter) => {
      const out = [];
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i], b = ps[(i + 1) % ps.length];
        const ka = keep(a), kb = keep(b);
        if (ka) out.push(a);
        if (ka !== kb) out.push(inter(a, b));
      }
      return out;
    };
    const at = (a, b, v) => { const t = (v - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, v]; };
    let p = cut(poly, (q) => q[1] >= v0, (a, b) => at(a, b, v0));
    p = cut(p, (q) => q[1] <= v1, (a, b) => at(a, b, v1));
    return p;
  };
  // rafters: every 0.75 m along the eave, from eave to the top boundary
  const rafterLift = -0.09;
  for (let u = uMin + 0.2; u < uMax - 0.1; u += 0.75) {
    let vTop = 0;
    for (let i = 0; i < poly2.length; i++) {
      const a = poly2[i], b = poly2[(i + 1) % poly2.length];
      if ((a[0] - u) * (b[0] - u) <= 0 && Math.abs(b[0] - a[0]) > 1e-6) {
        const t = (u - a[0]) / (b[0] - a[0]);
        vTop = Math.max(vTop, a[1] + (b[1] - a[1]) * t);
      }
    }
    if (vTop < 0.3) continue;
    const A = to3([u, 0], rafterLift), Bp = to3([u, vTop], rafterLift);
    const key = `rafter:${id}:${u.toFixed(2)}`;
    const mid = A.clone().add(Bp).multiplyScalar(0.5);
    MODULES.define(key, () => rod(A.clone().sub(mid).toArray(), Bp.clone().sub(mid).toArray(), 0.055));
    ES.add({ system: 'rafters', group: 'pav.roof.frame', category: 'roofframe', module: key, material: 'timber',
      pos: mid.toArray(), anim: { type: 'drop', dist: 1.5 }, order: u / (uMax - uMin + 1), tags: tagsAt(L, mid.x, mid.z, 2, { diagonal: true }) });
  }
  // tile courses, eave to ridge
  const c = 0.33;
  for (let k = 0, v0 = 0; v0 < vMax - 0.02; k++, v0 += c) {
    const v1 = Math.min(vMax, v0 + c);
    const q = clip(poly2, v0, v1);
    if (q.length < 3) continue;
    const lip = 0.04;
    const P3 = q.map(([u, v]) => to3([u, v], (v1 - v) / (v1 - v0) * lip + 0.02));
    const cen = P3.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / P3.length);
    const key = `tile:${id}:${k}`;
    MODULES.define(key, () => {
      const top = polygon(P3.map((p) => p.clone().sub(cen).toArray()), U.toArray(), V.toArray());
      // remap v to the course (0 at the butt, 1 at the head) for the tile texture
      const uv = top.attributes.uv;
      const pos = top.attributes.position;
      for (let i = 0; i < uv.count; i++) {
        const w = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).add(cen);
        const [uu, vv] = to2(w);
        uv.setXY(i, uu, (vv - v0) / (v1 - v0));
      }
      // butt lip (front edge of the course)
      const lo = q.filter(([, v]) => Math.abs(v - v0) < 1e-4).map(([u]) => u).sort((a, b) => a - b);
      const parts = [top];
      if (lo.length >= 2) {
        const a = to3([lo[0], v0], lip + 0.02).sub(cen), b = to3([lo[lo.length - 1], v0], lip + 0.02).sub(cen);
        const a2 = to3([lo[0], v0], 0.0).sub(cen), b2 = to3([lo[lo.length - 1], v0], 0.0).sub(cen);
        parts.push(polygon([a2.toArray(), b2.toArray(), b.toArray(), a.toArray()], U.toArray(), [0, 1, 0]));
      }
      return merge(parts);
    });
    ES.add({ system: 'roof-tiles', group: 'pav.roof.tiles', category: 'roofcover', module: key, material: 'tile',
      pos: cen.toArray(), anim: { type: 'tile' }, order: v0 / 12 + (plane.orderBias || 0), tags: tagsAt(L, cen.x, cen.z, 2) });
  }
}

function roofs(ES, L) {
  const t30 = Math.tan(THREE.MathUtils.degToRad(P.pitchDeg));
  const t15 = Math.tan(THREE.MathUtils.degToRad(15));
  const ov = 0.9, ovS = 0.8;
  const xe = XC + ov, ze = ZF + ov, zb = -25.75;
  const tip = EAVE - ov * t30;                 // eave tip; plane is at EAVE over the wall line
  const ridgeY = tip + xe * t30;
  const cut = 2.6;                             // gablet cut height above the tip
  const gz = ze - cut / t30, gy = tip + cut, gx = xe - cut / t30;
  const planes = [
    { id: 'front', eave: [[-xe, tip, ze], [xe, tip, ze]], poly: [[-xe, tip, ze], [xe, tip, ze], [gx, gy, gz], [-gx, gy, gz]] },
    { id: 'left', eave: [[-xe, tip, zb], [-xe, tip, ze]], poly: [[-xe, tip, zb], [-xe, tip, ze], [-gx, gy, gz], [0, ridgeY, gz], [0, ridgeY, zb]], orderBias: 0.01 },
    { id: 'right', eave: [[xe, tip, ze], [xe, tip, zb]], poly: [[xe, tip, ze], [xe, tip, zb], [0, ridgeY, zb], [0, ridgeY, gz], [gx, gy, gz]], orderBias: 0.01 },
  ];
  const tipS = SIDE_EAVE - ovS * t15;
  const run = XS + ovS - XC;
  const topY = tipS + run * t15;
  for (const sx of [-1, 1]) {
    const xo = sx * (XS + ovS), xi = sx * XC, zf = ZSF + ovS, hz = zf - run;
    planes.push({ id: `sideF${sx}`, eave: sx < 0 ? [[xo, tipS, zf], [xi, tipS, zf]] : [[xi, tipS, zf], [xo, tipS, zf]],
      poly: [[xo, tipS, zf], [xi, tipS, zf], [xi, topY, hz]], orderBias: 0.02 });
    planes.push({ id: `sideO${sx}`, eave: sx < 0 ? [[xo, tipS, zb], [xo, tipS, zf]] : [[xo, tipS, zf], [xo, tipS, zb]],
      poly: [[xo, tipS, zb], [xo, tipS, zf], [xi, topY, hz], [xi, topY, zb]], orderBias: 0.02 });
  }
  for (const pl of planes) roofPlane(ES, L, pl, pl.id);

  // ridge + hip ridge tiles
  const ridges = [
    [[0, ridgeY + 0.08, gz], [0, ridgeY + 0.08, zb]],
    [[-xe, tip + 0.08, ze], [-gx, gy + 0.08, gz]], [[xe, tip + 0.08, ze], [gx, gy + 0.08, gz]],
  ];
  for (const sx of [-1, 1]) ridges.push([[sx * (XS + ovS), tipS + 0.08, ZSF + ovS], [sx * XC, topY + 0.08, ZSF + ovS - run]]);
  // hip + ridge rafters (the jack rafters bear on them), under the tiles
  ridges.forEach(([a, b], i) => {
    const lo = (p) => [p[0], p[1] - 0.26, p[2]];
    const A = lo(a), Bq = lo(b);
    const mid = A.map((v, k) => (v + Bq[k]) / 2);
    const key = `hiprafter:${i}`;
    MODULES.define(key, () => rod(A.map((v, k) => v - mid[k]), Bq.map((v, k) => v - mid[k]), 0.08));
    ES.add({ system: 'rafters', group: 'pav.roof.frame', category: 'roofframe', module: key, material: 'timber',
      pos: mid, anim: { type: 'drop', dist: 1.5 }, order: 0.2, tags: tagsAt(L, mid[0], mid[2], 2, { diagonal: true }) });
  });
  ridges.forEach(([a, b], i) => {
    const mid = a.map((v, k) => (v + b[k]) / 2);
    const key = `ridgetile:${i}`;
    MODULES.define(key, () => rod(a.map((v, k) => v - mid[k]), b.map((v, k) => v - mid[k]), 0.13));
    ES.add({ system: 'ridge-tiles', group: 'pav.roof.ridge', category: 'roofcover', module: key, material: 'ridgeTile',
      pos: mid, anim: { type: 'drop', dist: 0.8 }, order: i, tags: tagsAt(L, mid[0], mid[2], 2, { diagonal: true }) });
  });
  // front gablet (Kerala style): vertical triangle with a small vent grille
  const gablet = MODULES.define('gablet', () => merge([
    polygon([[-gx, gy, 0], [gx, gy, 0], [0, ridgeY, 0]], [1, 0, 0], [0, 1, 0]),
    polygon([[gx, gy, -0.03], [-gx, gy, -0.03], [0, ridgeY, -0.03]], [1, 0, 0], [0, 1, 0]),
  ]));
  ES.add({ system: 'gablet', group: 'pav.roof.ridge', category: 'roofcover', module: gablet, material: 'frame',
    pos: [0, 0, gz + 0.01], anim: { type: 'drop', dist: 0.8 }, order: 9, tags: tagsAt(L, 0, gz, 2) });
  const vent = MODULES.define('gabletvent', () => xf(jaliPanelGeo(gx * 0.9, (ridgeY - gy) * 0.42), { t: [0, gy + 0.08, 0] }));
  ES.add({ system: 'gablet', group: 'pav.roof.ridge', category: 'roofcover', module: vent, material: 'timber',
    pos: [0, 0, gz + 0.05], anim: { type: 'drop', dist: 0.8 }, order: 10, tags: tagsAt(L, 0, gz, 2) });
  // timber wall plates on the ring beams carry the rafters
  const plates = [
    [[-XC, EAVE + 0.04, ZF], [XC, EAVE + 0.04, ZF]], [[-XC, EAVE + 0.04, ZF], [-XC, EAVE + 0.04, zb]], [[XC, EAVE + 0.04, ZF], [XC, EAVE + 0.04, zb]],
  ];
  for (const sx of [-1, 1]) plates.push([[sx * XC, SIDE_EAVE + 0.04, ZSF], [sx * XS, SIDE_EAVE + 0.04, ZSF]], [[sx * XS, SIDE_EAVE + 0.04, ZSF], [sx * XS, SIDE_EAVE + 0.04, zb]]);
  for (const [a, b] of plates) {
    const mid = a.map((v, k) => (v + b[k]) / 2);
    const key = `plate:${a.join(',')}:${b.join(',')}`;
    MODULES.define(key, () => xf(box(Math.hypot(b[0] - a[0], b[2] - a[2]), 0.08, 0.2, { anchor: ANCHOR.center }), { r: [0, Math.abs(b[0] - a[0]) > 0.1 ? 0 : Math.PI / 2, 0] }));
    ES.add({ system: 'rafters', group: 'pav.roof.frame', category: 'roofframe', module: key, material: 'timber',
      pos: mid, anim: { type: 'drop', dist: 1 }, order: 0, tags: tagsAt(L, mid[0], mid[2], 2) });
  }
}

function jaliPanelGeo(w, h) {
  const key = jaliPanel(w, h, 0.12);
  return MODULES.geometry(key).clone();
}
