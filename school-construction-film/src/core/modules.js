// Module library + construction element model.
//
// A *module* is a reusable piece of geometry (a column, a 3.65 m beam, a
// window frame, a jali panel...). Modules are cached by a parameter key, so
// forty identical windows share ONE geometry and are drawn as instances.
//
// An *element* is one placed occurrence of a module in the building, carrying
// the procedural construction attributes used by the animation system:
//   construction_start / construction_end  -> t0 / t1   (fractions of the film)
//   construction_group                     -> group
//   construction_order                     -> order (sort key inside group)
//   animation_type                         -> anim.type
//   delay                                  -> delay (extra offset, fraction)
//   random_seed                            -> seed
//   finish window (plaster/paint)          -> f0 / f1
//   removal window (temporary works)       -> rm0 / rm1
import * as THREE from 'three';
import { finalize, box, ANCHOR } from './geometry.js';
import { hash01 } from './math.js';

const fx = (v) => (Math.round(v * 1000) / 1000).toFixed(3);

export class ModuleLibrary {
  constructor() { this.map = new Map(); }
  define(key, builder) {
    if (!this.map.has(key)) this.map.set(key, { key, builder, geo: null, bbox: null });
    return key;
  }
  has(key) { return this.map.has(key); }
  geometry(key) {
    const m = this.map.get(key);
    if (!m) throw new Error(`Unknown module ${key}`);
    if (!m.geo) { m.geo = finalize(m.builder()); m.bbox = m.geo.boundingBox.clone(); }
    return m.geo;
  }
  bbox(key) { this.geometry(key); return this.map.get(key).bbox; }
  get size() { return this.map.size; }
}

export const MODULES = new ModuleLibrary();

export function boxModule(w, h, d, anchorName = 'bottom', bevel = 0) {
  const key = `box:${fx(w)}x${fx(h)}x${fx(d)}:${anchorName}:${bevel}`;
  return MODULES.define(key, () => box(w, h, d, { anchor: ANCHOR[anchorName], bevel }));
}

// Materials whose surfaces transition from raw construction to finished paint
export const FINISHABLE = new Set(['frame', 'masonry']);

let _uid = 0;
export class Element {
  constructor(o) {
    this.id = _uid++;
    this.system = o.system;            // e.g. 'columns', 'walls', 'roof-sheets'
    this.group = o.group;              // construction group, e.g. 'frame.columns.F2'
    this.category = o.category;        // semantic category for validation rules
    this.module = o.module;
    this.material = o.material;
    this.pos = o.pos;                  // [x,y,z]
    this.rot = o.rot || [0, 0, 0];     // Euler (YXZ) radians
    this.anim = o.anim || { type: 'drop' };
    this.tags = o.tags || {};
    this.order = o.order ?? 0;         // construction_order within the group
    this.delay = o.delay ?? 0;
    this.seed = o.seed ?? hash01(this.system, ...this.pos);
    this.rig = o.rig || null;          // runtime rig (crane parts)
    this.temporary = !!o.temporary;
    this.t0 = 0; this.t1 = 0;          // construction_start / construction_end
    this.f0 = null; this.f1 = null;    // finishing window
    this.rm0 = null; this.rm1 = null;  // removal window (temporary works)
    this.finishable = FINISHABLE.has(this.material);
    this._bbox = null;
  }

  matrix(target = new THREE.Matrix4()) {
    return target.compose(
      new THREE.Vector3(...this.pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(this.rot[0], this.rot[1], this.rot[2], 'YXZ')),
      new THREE.Vector3(1, 1, 1),
    );
  }

  // World-space AABB of the element in its final position
  bbox() {
    if (!this._bbox) this._bbox = MODULES.bbox(this.module).clone().applyMatrix4(this.matrix());
    return this._bbox;
  }
}

export class ElementSet {
  constructor() { this.list = []; this.bySystem = new Map(); }
  add(o) {
    const e = new Element(o);
    this.list.push(e);
    if (!this.bySystem.has(e.system)) this.bySystem.set(e.system, []);
    this.bySystem.get(e.system).push(e);
    return e;
  }
  get length() { return this.list.length; }
  filter(fn) { return this.list.filter(fn); }
}
