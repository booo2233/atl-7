// Terrain height field: a levelled school terrace cut into a Kerala hillside.
// Pure function (no Three.js) so validation and the site generator can use it.

function hash2(i, j) {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z);
  let u = x - i, v = z - j;
  u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm2(x, z, oct = 5) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let o = 0; o < oct; o++) { s += vnoise(x * f, z * f) * a; n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The levelled pad (rounded rectangle) that contains the school and its site
export const PAD = { x0: -62, x1: 60, z0: -52, z1: 52, r: 10 };

export function padDistance(x, z) {
  const cx = (PAD.x0 + PAD.x1) / 2, cz = (PAD.z0 + PAD.z1) / 2;
  const hx = (PAD.x1 - PAD.x0) / 2 - PAD.r, hz = (PAD.z1 - PAD.z0) / 2 - PAD.r;
  const dx = Math.abs(x - cx) - hx, dz = Math.abs(z - cz) - hz;
  const ox = Math.max(dx, 0), oz = Math.max(dz, 0);
  return Math.hypot(ox, oz) + Math.min(Math.max(dx, dz), 0) - PAD.r;
}

export function terrainHeight(x, z) {
  const d = padDistance(x, z);
  if (d <= 0) return 0;
  const n = fbm2(x * 0.008, z * 0.008);
  const n2 = fbm2(x * 0.0025 + 17, z * 0.0025 - 9, 4);
  let h = sstep(0, 45, d) * (3 + 16 * n);
  h += Math.max(0, -(z + 60)) * (0.30 + 0.25 * n);            // hillside rising behind
  h += Math.max(0, -(x + 75)) * (0.16 + 0.12 * n);            // slope to the west
  h += Math.max(0, x - 80) * (0.10 + 0.10 * n);               // forested ridge east
  h -= sstep(60, 260, z) * sstep(-200, 100, x) * 14 * (0.6 + 0.4 * n); // valley in front
  const r = Math.hypot(x, z);
  h += sstep(260, 900, r) * (60 + 160 * n2);                   // distant misty hills
  return h * sstep(0, 6, d);
}

// Tea plantation terraces on the slope behind the campus (as in the video)
export function teaMask(x, z) {
  const cx = 10, cz = -150;
  const dx = (x - cx) / 90, dz = (z - cz) / 45;
  return sstep(1.0, 0.75, Math.hypot(dx, dz));
}
