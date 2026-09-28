// Camera rigs and the edit.
//
// Four cameras exist for the whole film (like a multicam shoot); each has a
// smooth path keyed in film-normalised time, so the cinematography retimes
// with the film length. The EDIT decides which camera is live, cutting at
// construction milestones.
//   CAM_1  wide establishing shot (whole process)
//   CAM_2  closer architectural angle on the courtyard facades
//   CAM_3  elevated three-quarter view, building rising floor by floor
//   CAM_4  hero shot of the completed school
import * as THREE from 'three';

// C1-continuous Hermite interpolation through time-stamped keys
function hermite(keys, t, field) {
  const n = keys.length;
  if (t <= keys[0].t) return keys[0][field].slice();
  if (t >= keys[n - 1].t) return keys[n - 1][field].slice();
  let i = 0;
  while (i < n - 2 && t > keys[i + 1].t) i++;
  const k0 = keys[i], k1 = keys[i + 1];
  const h = k1.t - k0.t, u = (t - k0.t) / h;
  const tan = (j) => {
    if (j === 0 || j === n - 1) return keys[j][field].map(() => 0);
    const a = keys[j - 1], b = keys[j + 1];
    return keys[j][field].map((_, c) => (b[field][c] - a[field][c]) / (b.t - a.t));
  };
  const m0 = tan(i), m1 = tan(i + 1);
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  return k0[field].map((v, c) => h00 * v + h10 * h * m0[c] + h01 * k1[field][c] + h11 * h * m1[c]);
}

export const CAMERAS = {
  CAM_1: {
    label: 'CAM 1 · Establishing (wide)',
    keys: [
      { t: 0.00, pos: [-104, 74, 116], target: [-6, 1, -6], fov: 33 },
      { t: 0.12, pos: [-90, 63, 100], target: [-5, 2, -8], fov: 33 },
      { t: 0.24, pos: [-74, 54, 86], target: [-4, 4, -9], fov: 33 },
      { t: 0.60, pos: [-72, 58, 92], target: [-3, 8, -11], fov: 34 },
      { t: 1.00, pos: [-52, 52, 92], target: [-2, 8, -12], fov: 34 },
    ],
  },
  CAM_2: {
    label: 'CAM 2 · Facade',
    keys: [
      { t: 0.00, pos: [-16, 11, 30], target: [-6, 7, -24], fov: 40, focus: 50 },
      { t: 0.43, pos: [-16, 11.5, 30], target: [-6, 7, -24], fov: 40, focus: 50 },
      { t: 0.52, pos: [-6, 12.5, 28], target: [-2, 7.5, -24], fov: 40, focus: 49 },
      { t: 0.60, pos: [5, 13.5, 27], target: [1, 8, -24], fov: 40, focus: 48 },
      { t: 1.00, pos: [14, 15, 30], target: [2, 8, -24], fov: 40, focus: 50 },
    ],
  },
  CAM_3: {
    label: 'CAM 3 · Elevated three-quarter',
    keys: [
      { t: 0.00, pos: [96, 58, 70], target: [-2, 3, -12], fov: 35 },
      { t: 0.215, pos: [92, 54, 66], target: [-2, 4, -12], fov: 35 },
      { t: 0.33, pos: [84, 50, 78], target: [-2, 6, -12], fov: 35 },
      { t: 0.43, pos: [74, 47, 88], target: [-2, 8, -12], fov: 35 },
      { t: 0.60, pos: [66, 60, 66], target: [-4, 12, -15], fov: 35 },
      { t: 0.68, pos: [58, 66, 58], target: [-4, 13, -15], fov: 35 },
      { t: 0.755, pos: [48, 70, 52], target: [-4, 13, -15], fov: 35 },
      { t: 1.00, pos: [40, 72, 50], target: [-4, 12, -15], fov: 35 },
    ],
  },
  CAM_4: {
    label: 'CAM 4 · Hero',
    keys: [
      { t: 0.00, pos: [40, 44, 90], target: [-3, 7, -13], fov: 32 },
      { t: 0.755, pos: [40, 44, 90], target: [-3, 7, -13], fov: 32 },
      { t: 0.86, pos: [22, 42, 84], target: [-3, 7, -13], fov: 32 },
      { t: 0.95, pos: [4, 41, 78], target: [-3, 7, -13.5], fov: 32 },
      { t: 1.00, pos: [-2, 40.5, 76], target: [-3, 7, -14], fov: 32 },
    ],
  },
};

// The edit: [start, end) in film-normalised time -> camera
export const EDIT = [
  { from: 0.000, to: 0.215, cam: 'CAM_1', note: 'empty site, foundation, first columns' },
  { from: 0.215, to: 0.430, cam: 'CAM_3', note: 'frame and slabs floor by floor, walls begin' },
  { from: 0.430, to: 0.600, cam: 'CAM_2', note: 'masonry, arcades, jali, windows, porch' },
  { from: 0.600, to: 0.755, cam: 'CAM_3', note: 'roof trusses and covering' },
  { from: 0.755, to: 1.001, cam: 'CAM_4', note: 'finishing, site works, hero hold' },
];

export function liveCamera(T) {
  for (const s of EDIT) if (T >= s.from && T < s.to) return s.cam;
  return EDIT[EDIT.length - 1].cam;
}

const _norm = new Map();
function normKeys(name) {
  if (!_norm.has(name)) {
    _norm.set(name, CAMERAS[name].keys.map((k) => ({
      t: k.t, pos: k.pos, target: k.target, fov: [k.fov ?? 35], focus: [k.focus ?? 0],
    })));
  }
  return _norm.get(name);
}

export function evalCamera(name, T) {
  const keys = normKeys(name);
  const hasFocus = CAMERAS[name].keys[0].focus != null;
  return {
    pos: hermite(keys, T, 'pos'),
    target: hermite(keys, T, 'target'),
    fov: hermite(keys, T, 'fov')[0],
    focus: hasFocus ? hermite(keys, T, 'focus')[0] : null,
  };
}

export function applyCamera(camera, name, T) {
  const c = evalCamera(name, T);
  camera.position.set(...c.pos);
  camera.lookAt(new THREE.Vector3(...c.target));
  if (Math.abs(camera.fov - c.fov) > 1e-4) { camera.fov = c.fov; camera.updateProjectionMatrix(); }
  return c;
}
