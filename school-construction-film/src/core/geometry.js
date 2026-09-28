// Low-level procedural geometry helpers. Every architectural module is built
// from these primitives. All geometries are returned non-indexed with
// position / normal / uv and an extra `hNorm` attribute (0 at the bottom of the
// module, 1 at the top) that the finishing shader uses for top-down plastering.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// anchor = where the module origin sits, as a fraction of the box extents
export const ANCHOR = {
  bottom: [0.5, 0, 0.5],
  center: [0.5, 0.5, 0.5],
  top: [0.5, 1, 0.5],
  bottomStart: [0, 0, 0.5],   // origin at x-min end (used by "unroll" motion)
  centerStart: [0, 0.5, 0.5],
  bottomBack: [0.5, 0, 0],
};

function prep(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  for (const k of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  }
  g.morphAttributes = {};
  return g;
}

export function finalize(geo) {
  const g = prep(geo);
  g.computeBoundingBox();
  const bb = g.boundingBox;
  const h = Math.max(1e-6, bb.max.y - bb.min.y);
  const pos = g.attributes.position;
  const hn = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) hn[i] = (pos.getY(i) - bb.min.y) / h;
  g.setAttribute('hNorm', new THREE.BufferAttribute(hn, 1));
  g.computeBoundingSphere();
  return g;
}

export function merge(list) {
  const prepared = list.filter(Boolean).map(prep);
  const m = mergeGeometries(prepared, false);
  if (!m) throw new Error('mergeGeometries failed');
  return m;
}

export function xf(geo, { t = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], order = 'YXZ' } = {}) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...t),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], order)),
    new THREE.Vector3(...(Array.isArray(s) ? s : [s, s, s])),
  );
  geo.applyMatrix4(m);
  return geo;
}

// Box with UVs in metres (so textures keep a real-world scale on every face)
export function box(w, h, d, { anchor = ANCHOR.bottom, bevel = 0 } = {}) {
  let g;
  if (bevel > 0 && Math.min(w, h, d) > bevel * 2.5) g = new RoundedBoxGeometry(w, h, d, 1, bevel);
  else g = new THREE.BoxGeometry(w, h, d);
  metricBoxUV(g, w, h, d);
  g.translate(w * (0.5 - anchor[0]), h * (0.5 - anchor[1]), d * (0.5 - anchor[2]));
  return g;
}

function metricBoxUV(g, w, h, d) {
  // project UVs from the dominant normal axis, in metres
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + w / 2, y = pos.getY(i) + h / 2, z = pos.getZ(i) + d / 2;
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    if (ax >= ay && ax >= az) uv.setXY(i, z, y);
    else if (ay >= az) uv.setXY(i, x, z);
    else uv.setXY(i, x, y);
  }
}

export function cylinder(r, h, { seg = 16, anchor = 'bottom', rTop = r } = {}) {
  const g = new THREE.CylinderGeometry(rTop, r, h, seg, 1, false);
  if (anchor === 'bottom') g.translate(0, h / 2, 0);
  return g;
}

// Beam-like box running from point a to b (world-aligned cross section)
export function strut(a, b, thick, depth = thick) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const g = new THREE.BoxGeometry(thick, len, depth);
  const dir = vb.clone().sub(va).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const m = new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}

// Extrude a 2D shape drawn in the XY plane (x along the wall, y up) through
// `depth` metres, centred on z = 0.
export function extrude(shape, depth, { bevel = 0, curveSegments = 12 } = {}) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 1, curveSegments,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Breeze-block / grille lattice ("jali"): grid of bars in the XY plane,
// origin bottom-centre. Vertical bars are marginally thicker than horizontal
// ones so crossing faces never become coplanar (no z-fighting).
export function lattice(w, h, t, cell, bar) {
  const parts = [];
  const cols = Math.max(1, Math.round(w / cell));
  const rows = Math.max(1, Math.round(h / cell));
  for (let i = 0; i <= cols; i++) {
    const x = -w / 2 + (w * i) / cols;
    parts.push(xf(new THREE.BoxGeometry(bar, h, t * 1.06), { t: [x, h / 2, 0] }));
  }
  for (let j = 0; j <= rows; j++) {
    const y = (h * j) / rows;
    parts.push(xf(new THREE.BoxGeometry(w, bar, t), { t: [0, Math.min(h - bar / 2, Math.max(bar / 2, y)), 0] }));
  }
  return merge(parts);
}

// Segmental arch spandrel: fills the space between two piers above the
// springing line. Width w (clear span), height h, arch rise `rise`, with small
// corbel chamfers at the springing points. Origin: bottom-centre (springing).
export function archSpandrel(w, h, rise, t, corbel = 0.22) {
  const s = new THREE.Shape();
  const half = w / 2;
  s.moveTo(-half, 0);
  s.lineTo(-half + corbel, corbel * 0.75);
  // segmental arc between the corbels
  const x0 = -half + corbel, x1 = half - corbel, y0 = corbel * 0.75;
  const chord = x1 - x0;
  const R = (chord * chord / 4 + rise * rise) / (2 * rise);
  const cy = y0 + rise - R;
  const a0 = Math.atan2(y0 - cy, x0), a1 = Math.atan2(y0 - cy, x1);
  const N = 18;
  for (let i = 1; i <= N; i++) {
    const a = a0 + (a1 - a0) * (i / N);
    s.lineTo(R * Math.cos(a), cy + R * Math.sin(a));
  }
  s.lineTo(half, 0);
  s.lineTo(half, h);
  s.lineTo(-half, h);
  s.lineTo(-half, 0);
  return extrude(s, t);
}

// Plane lying in XZ (horizontal), UVs in metres, origin at centre.
export function sheet(width, length, { anchor = 'center' } = {}) {
  const g = new THREE.PlaneGeometry(width, length, 1, 1);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * width, uv.getY(i) * length);
  if (anchor === 'low') g.translate(0, 0, -length / 2); // origin on the low edge
  return g;
}

// Planar polygon (list of [x,y,z]) triangulated as a fan, both windings kept
// consistent by the caller. UVs are metric along (uAxis, vAxis).
export function polygon(points, uAxis, vAxis) {
  const pos = [], uv = [];
  const U = new THREE.Vector3(...uAxis), V = new THREE.Vector3(...vAxis);
  const p0 = new THREE.Vector3(...points[0]);
  for (let i = 1; i < points.length - 1; i++) {
    for (const p of [points[0], points[i], points[i + 1]]) {
      pos.push(...p);
      const d = new THREE.Vector3(...p).sub(p0);
      uv.push(d.dot(U), d.dot(V));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

export { THREE };
