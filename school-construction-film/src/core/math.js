// Deterministic math helpers: seeded random numbers and easing curves.
// Everything in the film is a pure function of (seed, frame) so that the
// offline renderer produces identical frames on every run.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable hash of numbers/strings -> [0,1)
export function hash01(...parts) {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = typeof p === 'number' ? p.toFixed(3) : String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Easing curves: p in [0,1] -> eased value (may overshoot 1 for "back" curves)
export const EASE = {
  linear: (p) => p,
  inOutSine: (p) => 0.5 - 0.5 * Math.cos(Math.PI * p),
  outCubic: (p) => 1 - Math.pow(1 - p, 3),
  inCubic: (p) => p * p * p,
  inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  outQuart: (p) => 1 - Math.pow(1 - p, 4),
  smoother: (p) => p * p * p * (p * (6 * p - 15) + 10),
  // subtle overshoot, used for pieces that are lowered/slid into place
  outBackSoft: (p) => {
    const c = 0.9, u = p - 1;
    return 1 + (c + 1) * u * u * u + c * u * u;
  },
  // lowered by a crane: fast approach, gentle settle with a tiny bounce
  settle: (p) => {
    const a = 1 - Math.pow(1 - p, 3);
    return a + Math.sin(p * Math.PI * 2.0) * 0.035 * (1 - p);
  },
};

// Gaussian smoothing of a sampled 1D signal (used for the crane slew path)
export function gaussianSmooth(values, sigma) {
  const n = values.length;
  const r = Math.ceil(sigma * 3);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, w = 0;
    for (let k = -r; k <= r; k++) {
      const j = Math.min(n - 1, Math.max(0, i + k));
      const g = Math.exp(-(k * k) / (2 * sigma * sigma));
      s += values[j] * g; w += g;
    }
    out[i] = s / w;
  }
  return out;
}

// Catmull-Rom spline through keys [{t, v:[x,y,z]}] with eased parameter
export function sampleKeys(keys, t) {
  if (t <= keys[0].t) return keys[0].v.slice();
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.v.slice();
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
  const u = EASE.inOutSine((t - k1.t) / (k2.t - k1.t));
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const p0 = k0.v[c], p1 = k1.v[c], p2 = k2.v[c], p3 = k3.v[c];
    const m1 = (p2 - p0) * 0.5 * 0.5, m2 = (p3 - p1) * 0.5 * 0.5; // damped tangents
    const u2 = u * u, u3 = u2 * u;
    out[c] = (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2;
  }
  return out;
}
