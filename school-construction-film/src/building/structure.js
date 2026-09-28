// Foundation, RCC frame (columns + beams) and floor slabs.
import { BUILDING as B } from '../config.js';
import { boxModule } from '../core/modules.js';
import { FFL, sOf } from './common.js';

// create_foundation(): footings emerge from the ground, pedestals rise,
// plinth beams slide between them, then the plinth slab is poured.
export function createFoundation(ES, L, extraColumns = []) {
  const fs = B.footingSize, cw = B.columnWidth;
  const footing = boxModule(fs, 0.5, fs, 'bottom', 0.02);
  const pedestal = boxModule(cw + 0.1, 0.43, cw + 0.1, 'bottom', 0.01);
  const cols = [...L.columns, ...extraColumns];
  for (const c of cols) {
    const s = sOf(L, c.x, c.z);
    ES.add({
      system: 'footings', group: 'found.footings', category: 'found', module: footing, material: 'frame',
      pos: [c.x, -0.48, c.z], anim: { type: 'emerge' }, order: c.order ?? s, tags: { wing: c.wing, s },
    });
    ES.add({
      system: 'pedestals', group: 'found.pedestals', category: 'found', module: pedestal, material: 'frame',
      pos: [c.x, 0.02, c.z], anim: { type: 'rise' }, order: c.order ?? s, tags: { wing: c.wing, s },
    });
  }
  // plinth beams, resting on the ground between pedestals
  const pw = cw + 0.1;
  for (const b of L.beams) addBeam(ES, L, b, 0.0, 0.45, pw, 'found.plinthbeams', 'plinth-beams', 'found');
  // plinth slab (ground floor) cells
  for (const c of L.cells) addSlab(ES, L, c, 0.45, 0.15, 'found.groundslab', 'ground-slab', 'found', 0);
}

// create_columns(): one column per grid node per floor, rising from the slab
export function createColumns(ES, L) {
  const cw = B.columnWidth;
  for (let f = 0; f < B.floorCount; f++) {
    const h = FFL(f + 1) - B.slabThickness - FFL(f);
    const mod = boxModule(cw, h, cw, 'bottom', 0.015);
    for (const c of L.columns) {
      const s = sOf(L, c.x, c.z);
      ES.add({
        system: 'columns', group: `frame.columns.F${f}`, category: 'frame', module: mod, material: 'frame',
        pos: [c.x, FFL(f), c.z], anim: { type: 'rise' }, order: s, tags: { floor: f, wing: c.wing, s },
      });
    }
  }
}

function addBeam(ES, L, b, y0, depth, clearCut, group, system, category, floor) {
  const [x0, z0] = b.a, [x1, z1] = b.b;
  const len = Math.hypot(x1 - x0, z1 - z0) - clearCut;
  if (len < 0.2) return;
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const mod = boxModule(len, depth, B.beamWidth, 'bottom', 0.012);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const s = sOf(L, cx, cz);
  ES.add({
    system, group, category, module: mod, material: 'frame',
    pos: [cx, y0, cz], rot: [0, alongX ? 0 : Math.PI / 2, 0],
    anim: { type: 'slide', axis: alongX ? [1, 0, 0] : [0, 0, 1], dist: Math.min(2.4, len * 0.55) },
    order: s, tags: { floor, wing: b.wing, s },
  });
}

// create_beams(): beams frame into the columns under every slab
export function createBeams(ES, L) {
  for (let f = 1; f <= B.floorCount; f++) {
    const y0 = FFL(f) - B.beamDepth;
    for (const b of L.beams) {
      addBeam(ES, L, b, y0, B.beamDepth - B.slabThickness, B.columnWidth, `frame.beams.F${f - 1}`, 'beams', 'frame', f - 1);
    }
  }
}

// a cell edge is on the building perimeter when no other cell shares it
function hasNeighbour(L, c, side) {
  const eq = (a, b) => Math.abs(a - b) < 1e-6;
  const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 0.05;
  return L.cells.some((o) => o !== c && (
    (side === 'x0' && eq(o.x1, c.x0) && ov(o.z0, o.z1, c.z0, c.z1)) ||
    (side === 'x1' && eq(o.x0, c.x1) && ov(o.z0, o.z1, c.z0, c.z1)) ||
    (side === 'z0' && eq(o.z1, c.z0) && ov(o.x0, o.x1, c.x0, c.x1)) ||
    (side === 'z1' && eq(o.z0, c.z1) && ov(o.x0, o.x1, c.x0, c.x1))));
}

function addSlab(ES, L, c, y0, t, group, system, category, floor) {
  const ext = B.beamWidth / 2;
  const e = (side) => (hasNeighbour(L, c, side) ? 0 : ext);
  const x0 = c.x0 - e('x0'), x1 = c.x1 + e('x1');
  const z0 = c.z0 - e('z0'), z1 = c.z1 + e('z1');
  // side-wing panels at the inner courtyard corners overlap the back-wing
  // panel's edge strip by 15 cm; drop them 4 mm so the tops never z-fight
  const cornerDrop = c.wing !== 'B' && Math.abs(c.z0 - L.zBackIn) < 1e-6 && (e('x0') || e('x1')) ? 0.004 : 0;
  const mod = boxModule(x1 - x0, t - cornerDrop, z1 - z0, 'bottom', 0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const s = sOf(L, cx, cz);
  return ES.add({
    system, group, category, module: mod, material: 'frame',
    pos: [cx, y0, cz], anim: { type: 'pour' }, order: s, tags: { floor, wing: c.wing, s },
  });
}

// create_floor_slab(): one slab panel per structural cell, per level
export function createFloorSlabs(ES, L) {
  for (let f = 1; f <= B.floorCount; f++) {
    for (const c of L.cells) {
      const el = addSlab(ES, L, c, FFL(f) - B.slabThickness, B.slabThickness,
        `slabs.F${f - 1}`, f === B.floorCount ? 'roof-slab' : 'slabs', 'slab', f - 1);
      if (f === B.floorCount) el.tags.roofSlab = true;
    }
  }
}
