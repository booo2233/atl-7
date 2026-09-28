// Structural grid + facade runs of the reconstructed U-shaped block.
// Everything is derived from BUILDING parameters (src/config.js).
import { BUILDING as B } from '../config.js';

const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const segs = (a) => a.slice(0, -1).map((v, i) => [v, a[i + 1]]);

export function makeLayout() {
  const W = B.courtyardWidth, D = B.wingDepth, CD = B.courtyardDepth, c = B.corridorDepth;
  const xInL = -W / 2, xInR = W / 2, xOutL = xInL - D, xOutR = xInR + D;
  const xClassL = xOutL + (D - c), xClassR = xOutR - (D - c);
  const zBackOut = -(CD + D), zBackIn = -CD, zClassB = zBackOut + (D - c);
  const zRightFront = 0, zLeftFront = B.leftWingExtension;
  const bay = W / B.backBays;

  const xsBack = [xOutL, xClassL, xInL, ...range(B.backBays - 1, (k) => xInL + (k + 1) * bay), xInR, xClassR, xOutR];
  const zsBack = [zBackOut, zClassB, zBackIn];
  const zSide = range(B.courtyardSideBays, (k) => zBackIn + ((k + 1) * CD) / B.courtyardSideBays);
  const zExt = range(B.extensionBays, (k) => zRightFront + ((k + 1) * B.leftWingExtension) / B.extensionBays);
  const zsLeft = [zBackIn, ...zSide, ...zExt];
  const zsRight = [zBackIn, ...zSide];
  const xsLeft = [xOutL, xClassL, xInL];
  const xsRight = [xInR, xClassR, xOutR];
  const towerHalf = (B.towerBays / 2) * bay;

  // ---- columns -------------------------------------------------------------
  const columns = [];
  const addCol = (x, z, wing) => columns.push({ x, z, wing });
  for (const x of xsBack) for (const z of zsBack) addCol(x, z, 'B');
  for (const x of xsLeft) for (const z of zsLeft.slice(1)) addCol(x, z, 'L');
  for (const x of xsRight) for (const z of zsRight.slice(1)) addCol(x, z, 'R');

  // ---- beams (between adjacent grid nodes) -----------------------------------
  const beams = [];
  const addBeam = (a, b, wing) => beams.push({ a, b, wing });
  for (const z of zsBack) for (const [x0, x1] of segs(xsBack)) addBeam([x0, z], [x1, z], 'B');
  for (const x of xsBack) for (const [z0, z1] of segs(zsBack)) addBeam([x, z0], [x, z1], 'B');
  for (const x of xsLeft) for (const [z0, z1] of segs(zsLeft)) addBeam([x, z0], [x, z1], 'L');
  for (const z of zsLeft.slice(1)) for (const [x0, x1] of segs(xsLeft)) addBeam([x0, z], [x1, z], 'L');
  for (const x of xsRight) for (const [z0, z1] of segs(zsRight)) addBeam([x, z0], [x, z1], 'R');
  for (const z of zsRight.slice(1)) for (const [x0, x1] of segs(xsRight)) addBeam([x0, z], [x1, z], 'R');

  // ---- slab cells --------------------------------------------------------------
  const cells = [];
  const addCells = (xs, zs, wing) => {
    for (const [x0, x1] of segs(xs)) for (const [z0, z1] of segs(zs)) cells.push({ x0, x1, z0, z1, wing });
  };
  addCells(xsBack, zsBack, 'B');
  addCells(xsLeft, zsLeft, 'L');
  addCells(xsRight, zsRight, 'R');
  const footprint = { xOutL, xOutR, zBackOut, zLeftFront, zRightFront, xInL, xInR, zBackIn };
  const isPerimeter = (axis, v) => {
    // is the grid line `v` along `axis` on the outside boundary of the U?
    if (axis === 'x') return [xOutL, xOutR, xInL, xInR].some((q) => Math.abs(q - v) < 1e-6);
    return [zBackOut, zLeftFront, zRightFront, zBackIn].some((q) => Math.abs(q - v) < 1e-6);
  };

  // ---- facade runs ----------------------------------------------------------------
  // axis: coordinate that varies along the run; line: the fixed coordinate;
  // normal: outward direction the facade faces; stations: grid positions.
  const runs = [
    { id: 'B-outer', wing: 'B', kind: 'outer', axis: 'x', line: zBackOut, normal: [0, 0, -1], stations: xsBack },
    { id: 'B-corrwall', wing: 'B', kind: 'corrWall', axis: 'x', line: zClassB, normal: [0, 0, 1], stations: xsBack.slice(1, -1) },
    { id: 'B-edge', wing: 'B', kind: 'corrEdge', axis: 'x', line: zBackIn, normal: [0, 0, 1], stations: xsBack.slice(2, -2), style: 'arch' },
    { id: 'L-outer', wing: 'L', kind: 'outer', axis: 'z', line: xOutL, normal: [-1, 0, 0], stations: [zBackOut, zClassB, ...zsLeft] },
    { id: 'L-corrwall', wing: 'L', kind: 'corrWall', axis: 'z', line: xClassL, normal: [1, 0, 0], stations: [zClassB, ...zsLeft] },
    { id: 'L-edge', wing: 'L', kind: 'corrEdge', axis: 'z', line: xInL, normal: [1, 0, 0], stations: zsLeft, style: 'mixed' },
    { id: 'L-end', wing: 'L', kind: 'end', axis: 'x', line: zLeftFront, normal: [0, 0, 1], stations: xsLeft },
    { id: 'R-outer', wing: 'R', kind: 'outer', axis: 'z', line: xOutR, normal: [1, 0, 0], stations: [zBackOut, zClassB, ...zsRight] },
    { id: 'R-corrwall', wing: 'R', kind: 'corrWall', axis: 'z', line: xClassR, normal: [-1, 0, 0], stations: [zClassB, ...zsRight] },
    { id: 'R-edge', wing: 'R', kind: 'corrEdge', axis: 'z', line: xInR, normal: [-1, 0, 0], stations: zsRight, style: 'rect' },
    { id: 'R-end', wing: 'R', kind: 'end', axis: 'x', line: zRightFront, normal: [0, 0, 1], stations: xsRight },
  ];

  return {
    W, D, CD, c, bay, towerHalf,
    xInL, xInR, xOutL, xOutR, xClassL, xClassR, zBackOut, zBackIn, zClassB, zRightFront, zLeftFront,
    xsBack, zsBack, zsLeft, zsRight, xsLeft, xsRight, zSide, zExt,
    columns, beams, cells, runs, footprint, isPerimeter,
  };
}

// Parameter along the U (0 at the junior-college front end, through the back
// wing, to 1 at the right wing front end). Used to sweep construction crews
// around the building.
export function uParam(L, x, z) {
  const lenL = L.zLeftFront - (L.zBackOut + L.D / 2);
  const lenB = (L.xOutR - L.D / 2) - (L.xOutL + L.D / 2);
  const lenR = L.zRightFront - (L.zBackOut + L.D / 2);
  const total = lenL + lenB + lenR;
  const zMid = L.zBackOut + L.D / 2, xMidL = L.xOutL + L.D / 2;
  let s;
  if (z < L.zBackIn || (x > L.xInL && x < L.xInR)) s = lenL + Math.min(lenB, Math.max(0, x - xMidL));
  else if (x <= L.xInL) s = Math.min(lenL, Math.max(0, L.zLeftFront - z));
  else s = lenL + lenB + Math.min(lenR, Math.max(0, z - zMid));
  return s / total;
}

export function wingOf(L, x, z) {
  if (z < L.zBackIn) return 'B';
  if (x <= L.xInL + 0.01) return 'L';
  if (x >= L.xInR - 0.01) return 'R';
  return 'C';
}
