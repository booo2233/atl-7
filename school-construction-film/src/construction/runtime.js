// Construction runtime: turns scheduled elements into InstancedMeshes (one per
// module+material pair) and, for any film time T (0..1), writes each visible
// element's animated transform and its finishing state.
//
// Motion is chosen per animation_type so every category moves in a way that
// fits how it is really built: footings emerge, columns rise, beams slide in,
// slab panels are poured, masonry is laid course by course, windows are
// pushed into their openings, trusses are lowered by the crane, sheets are
// laid and settle, trims unroll, plants grow, buses drive in.
import * as THREE from 'three';
import { MODULES } from '../core/modules.js';
import { EASE, clamp } from '../core/math.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Static per-element motion parameters derived from its animation type
export function motionOf(e) {
  const a = e.anim || {};
  const bb = MODULES.bbox(e.module);
  const h = bb.max.y - bb.min.y;
  const m = { off: V(), s0: V(1, 1, 1), r0: V(), ease: EASE.outCubic, sEase: EASE.inOutCubic, rem: null };
  switch (a.type) {
    case 'emerge': m.off.set(0, -(h + 0.4), 0); m.ease = EASE.outCubic; break;
    case 'rise': m.s0.set(1, 0.001, 1); m.sEase = EASE.inOutSine; break;
    case 'slide': {
      const ax = a.axis || [1, 0, 0];
      const sgn = (e.seed > 0.5 ? 1 : -1);
      m.off.set(ax[0] * a.dist * sgn, 0.9, ax[2] * a.dist * sgn);
      m.ease = EASE.outBackSoft; break;
    }
    case 'drop': m.off.set(0, a.dist ?? 2.5, 0); m.ease = EASE.settle; break;
    case 'pour': m.off.set(0, 0.45, 0); m.s0.set(0.9, 0.06, 0.9); m.ease = EASE.outCubic; m.sEase = EASE.outCubic; break;
    case 'lay': m.off.set(0, 0.5, 0); m.ease = EASE.outCubic; break;
    case 'install': {
      const n = a.normal || [0, 0, 1];
      m.off.set(n[0] * (a.dist ?? 1), 0.05, n[2] * (a.dist ?? 1));
      m.ease = EASE.outCubic; break;
    }
    case 'unroll': m.s0.set(0.001, 1, 1); m.sEase = EASE.inOutSine; break;
    case 'lift': m.off.set(0, a.dist ?? 5, 0); m.r0.set(0, 0.22 * (e.seed - 0.5), 0); m.ease = EASE.settle; break;
    case 'sheet': m.off.set(0, 1.4, 0); m.r0.set(0.1, 0, 0.02); m.ease = EASE.outCubic; break;
    case 'tile': m.off.set(0, 0.35, 0); m.ease = EASE.outCubic; break;
    case 'grow': m.s0.set(0.02, 0.02, 0.02); m.sEase = EASE.outBackSoft; break;
    case 'drive': {
      const dv = a.dir || [0, 0, 1];
      m.off.set(dv[0] * a.dist, 0, dv[2] * a.dist); m.ease = EASE.inOutCubic; break;
    }
    case 'mast': m.off.set(0, 3.5, 0); m.ease = EASE.settle; break;
    default: m.off.set(0, 1.5, 0);
  }
  const r = a.remove;
  if (r === 'lift') m.rem = { off: V(0, 7, 0), s: null, ease: EASE.inOutCubic };
  else if (r === 'sink') m.rem = { off: V(0, -1.2, 0), s: null, ease: EASE.inCubic };
  else if (r === 'unroll') m.rem = { off: V(), s: V(0.001, 1, 1), ease: EASE.inOutSine };
  else if (r === 'shrink') m.rem = { off: V(), s: V(0.001, 0.001, 0.001), ease: EASE.inCubic };
  else if (r === 'lower') m.rem = { off: V(0, -(e.pos[1] + bb.max.y + 2), 0), s: null, ease: EASE.inOutCubic }; // lowered to the ground
  return m;
}

// Progress helpers ------------------------------------------------------------------
export function progress(e, T) {
  const p = clamp((T - e.t0) / Math.max(1e-6, e.t1 - e.t0));
  const q = e.rm0 == null ? 0 : clamp((T - e.rm0) / Math.max(1e-6, e.rm1 - e.rm0));
  return { p, q, visible: p > 0 && q < 1 };
}
export function finishOf(e, T) {
  if (!e.finishable || e.f0 == null) return 0;
  return clamp((T - e.f0) / Math.max(1e-6, e.f1 - e.f0));
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();

// Compute an element's animated local->world matrix at film time T.
export function animatedMatrix(e, mo, T, out) {
  const { p, q } = progress(e, T);
  const k = mo.ease(p);
  const ks = clamp(mo.sEase(p), 0, 1.2);
  _p.set(e.pos[0], e.pos[1], e.pos[2]).addScaledVector(mo.off, 1 - k);
  _s.set(1, 1, 1).lerp(mo.s0, 1 - ks);
  _q.setFromEuler(_e.set(e.rot[0], e.rot[1], e.rot[2], 'YXZ'));
  if (mo.r0.lengthSq() > 0) {
    _q2.setFromEuler(_e.set(mo.r0.x * (1 - k), mo.r0.y * (1 - k), mo.r0.z * (1 - k), 'YXZ'));
    _q.multiply(_q2);
  }
  if (q > 0 && mo.rem) {
    const kr = mo.rem.ease(q);
    _p.addScaledVector(mo.rem.off, kr);
    if (mo.rem.s) _s.lerp(mo.rem.s, kr);
  }
  _s.x = Math.max(_s.x, 1e-4); _s.y = Math.max(_s.y, 1e-4); _s.z = Math.max(_s.z, 1e-4);
  return out.compose(_p, _q, _s);
}

export class ConstructionRuntime {
  constructor(elements, materials) {
    this.elements = elements;
    this.materials = materials;
    this.batches = [];
    this.rigs = new Map();     // rig name -> function(T) returning Matrix4 (crane)
    const map = new Map();
    for (const e of elements) {
      const key = `${e.module}|${e.material}|${e.rig || ''}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    for (const [key, list] of map) this.batches.push({ key, list, motions: list.map(motionOf) });
  }

  build(root) {
    this.group = new THREE.Group();
    this.group.name = 'construction';
    for (const b of this.batches) {
      const e0 = b.list[0];
      const src = MODULES.geometry(e0.module);
      const geo = new THREE.BufferGeometry();
      for (const [k, a] of Object.entries(src.attributes)) geo.setAttribute(k, a);
      geo.boundingBox = src.boundingBox; geo.boundingSphere = src.boundingSphere;
      const n = b.list.length;
      b.aFinish = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
      b.aSeed = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
      b.aFinish.setUsage(THREE.DynamicDrawUsage); b.aSeed.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aFinish', b.aFinish);
      geo.setAttribute('aSeed', b.aSeed);
      const mat = this.materials.get(e0.material);
      if (!mat) throw new Error(`Missing material ${e0.material}`);
      const mesh = new THREE.InstancedMesh(geo, mat, n);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = !['glass', 'lavender', 'lime', 'string'].includes(e0.material);
      mesh.receiveShadow = true;
      mesh.name = b.key;
      mesh.count = 0;
      b.mesh = mesh;
      this.group.add(mesh);
    }
    root.add(this.group);
    return this.group;
  }

  // Update every instance for film time T in [0,1]
  update(T) {
    let visible = 0;
    for (const b of this.batches) {
      let c = 0;
      const mesh = b.mesh;
      for (let i = 0; i < b.list.length; i++) {
        const e = b.list[i];
        const { visible: vis } = progress(e, T);
        if (!vis) continue;
        animatedMatrix(e, b.motions[i], T, _m);
        if (e.rig && this.rigs.has(e.rig)) _m.premultiply(this.rigs.get(e.rig)(T, e));
        mesh.setMatrixAt(c, _m);
        b.aFinish.array[c] = finishOf(e, T);
        b.aSeed.array[c] = e.seed;
        c++;
      }
      mesh.count = c;
      mesh.visible = c > 0;
      mesh.instanceMatrix.needsUpdate = true;
      b.aFinish.needsUpdate = true;
      b.aSeed.needsUpdate = true;
      visible += c;
    }
    this.visibleCount = visible;
    return visible;
  }
}
