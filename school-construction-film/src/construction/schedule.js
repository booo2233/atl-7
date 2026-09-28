// Procedural construction schedule.
//
// Every element belongs to a construction group ("frame.columns.F2",
// "walls.F0", "roof.sheets"...). A rule table maps groups to a time window
// (fractions of the film, so the whole film retimes when its length
// changes), a per-element duration, and an ordering strategy. Inside the
// window, elements are staggered by their construction_order (usually the
// crew's path around the U), plus `step` offsets for stacked work such as
// masonry courses, plus a small deterministic jitter from random_seed.
import { FILM } from '../config.js';
import { hash01, clamp } from '../core/math.js';

const REF = 30; // durations below are authored in seconds of a 30 s film
const d = (sec) => sec / REF;
const floorWin = (base, stepPerFloor, len) => (f) => [base + f * stepPerFloor, base + f * stepPerFloor + len];

// order helpers
const bySAndFloor = (wS, wF) => (e) => e.order * wS + (e.tags.floor ?? 0) * wF;
const topDown = (e) => (4 - (e.tags.floor ?? 0)) + e.order * 0.9;

export const GROUP_RULES = [
  // ---- phase 1: setting out ---------------------------------------------------
  { match: /^site\.pegs/, win: [0.016, 0.046], dur: d(0.5) },
  { match: /^site\.strings/, win: [0.028, 0.056], dur: d(0.6) },
  { match: /^site\.lime/, win: [0.022, 0.058], dur: d(0.7) },
  // ---- crane erection (temporary works) ------------------------------------------
  { match: /^crane\.base/, win: [0.030, 0.045], dur: d(0.45) },
  { match: /^crane\.mast/, win: [0.040, 0.092], dur: d(0.35), step: d(0.16) },
  { match: /^crane\.top/, win: [0.090, 0.118], dur: d(0.5), step: d(0.2) },
  // ---- phase 2: foundation -------------------------------------------------------
  { match: /^found\.footings/, win: [0.052, 0.105], dur: d(0.7) },
  { match: /^found\.pedestals/, win: [0.078, 0.122], dur: d(0.45) },
  { match: /^found\.plinthbeams/, win: [0.098, 0.142], dur: d(0.55) },
  { match: /^found\.groundslab/, win: [0.122, 0.162], dur: d(0.6) },
  // ---- phase 3/4: frame floor by floor -------------------------------------------
  { match: /^frame\.columns\.F(\d)/, win: floorWin(0.158, 0.064, 0.030), dur: d(0.55) },
  { match: /^frame\.beams\.F(\d)/, win: floorWin(0.176, 0.064, 0.032), dur: d(0.6) },
  { match: /^slabs\.F(\d)/, win: floorWin(0.196, 0.064, 0.034), dur: d(0.55) },
  // ---- pavilion structure (built in parallel with floors 1-2) ----------------------
  { match: /^pav\.columns\.F0/, win: [0.232, 0.250], dur: d(0.5) },
  { match: /^pav\.porch/, win: [0.238, 0.258], dur: d(0.6) },
  { match: /^pav\.beams\.F0/, win: [0.252, 0.270], dur: d(0.5) },
  { match: /^pav\.slab\.F0/, win: [0.268, 0.290], dur: d(0.55) },
  { match: /^pav\.columns\.F1/, win: [0.292, 0.308], dur: d(0.5) },
  { match: /^pav\.beams\.F1/, win: [0.306, 0.322], dur: d(0.5) },
  { match: /^pav\.stage/, win: [0.300, 0.330], dur: d(0.5), step: d(0.25) },
  { match: /^pav\.walls/, win: [0.330, 0.430], dur: d(0.34), step: d(0.22) },
  // ---- phase 5: masonry, floor by floor, course by course ---------------------------
  { match: /^walls\.F(\d)/, win: floorWin(0.248, 0.052, 0.120), dur: d(0.36), step: d(0.37) },
  // ---- phase 6: openings ------------------------------------------------------------
  { match: /^openings\.windows\.F(\d)/, win: floorWin(0.405, 0.036, 0.070), dur: d(0.55) },
  { match: /^openings\.doors\.F(\d)/, win: floorWin(0.405, 0.036, 0.070), dur: d(0.55) },
  { match: /^openings\.jali\.F(\d)/, win: floorWin(0.415, 0.036, 0.072), dur: d(0.6) },
  { match: /^openings\.glass\.F(\d)/, win: floorWin(0.432, 0.036, 0.075), dur: d(0.45) },
  { match: /^pav\.openings/, win: [0.470, 0.545], dur: d(0.55) },
  { match: /^pav\.glass/, win: [0.500, 0.570], dur: d(0.45) },
  // ---- phase 7: exterior features ----------------------------------------------------
  { match: /^exterior\.chajjas/, win: [0.470, 0.575], dur: d(0.45), order: bySAndFloor(0.8, 1) },
  { match: /^exterior\.bands/, win: [0.482, 0.575], dur: d(0.45), order: bySAndFloor(1, 0.12) },
  { match: /^exterior\.corbels/, win: [0.470, 0.550], dur: d(0.4), order: bySAndFloor(1, 0.12) },
  { match: /^exterior\.steps/, win: [0.560, 0.605], dur: d(0.35), step: d(0.18) },
  { match: /^pav\.features/, win: [0.520, 0.600], dur: d(0.45), step: d(0.2) },
  // ---- phase 8: roof --------------------------------------------------------------------
  { match: /^roof\.parapets/, win: [0.556, 0.600], dur: d(0.34), step: d(0.22) },
  { match: /^roof\.mumty\.walls/, win: [0.560, 0.600], dur: d(0.34), step: d(0.2) },
  { match: /^roof\.mumty\.slab/, win: [0.603, 0.612], dur: d(0.4) },
  { match: /^tower\.columns/, win: [0.556, 0.576], dur: d(0.5) },
  { match: /^tower\.beams/, win: [0.576, 0.592], dur: d(0.45) },
  { match: /^tower\.walls/, win: [0.580, 0.610], dur: d(0.34), step: d(0.2) },
  { match: /^tower\.slab/, win: [0.594, 0.612], dur: d(0.5) },
  { match: /^tower\.tank\.walls/, win: [0.612, 0.645], dur: d(0.34), step: d(0.2) },
  { match: /^tower\.tank\.slab/, win: [0.646, 0.656], dur: d(0.4) },
  { match: /^tower\.glazing/, win: [0.618, 0.655], dur: d(0.55) },
  { match: /^tower\.glass/, win: [0.640, 0.675], dur: d(0.45) },
  { match: /^tower\.roof\.posts/, win: [0.656, 0.668], dur: d(0.34) },
  { match: /^tower\.roof\.trusses/, win: [0.664, 0.684], dur: d(0.6) },
  { match: /^tower\.roof\.purlins/, win: [0.680, 0.696], dur: d(0.4) },
  { match: /^tower\.roof\.sheets/, win: [0.692, 0.722], dur: d(0.5) },
  { match: /^tower\.roof\.ridge/, win: [0.718, 0.732], dur: d(0.35) },
  { match: /^roof\.posts/, win: [0.584, 0.616], dur: d(0.4) },
  { match: /^roof\.trusses/, win: [0.598, 0.646], dur: d(0.7) },
  { match: /^roof\.purlins/, win: [0.624, 0.668], dur: d(0.45) },
  { match: /^roof\.sheets/, win: [0.646, 0.718], dur: d(0.55) },
  { match: /^roof\.ridge/, win: [0.700, 0.735], dur: d(0.4) },
  { match: /^pav\.roof\.frame/, win: [0.582, 0.628], dur: d(0.45) },
  { match: /^pav\.roof\.tiles/, win: [0.622, 0.708], dur: d(0.34) },
  { match: /^pav\.roof\.ridge/, win: [0.708, 0.726], dur: d(0.35) },
  // ---- phase 9: finishing -------------------------------------------------------------
  { match: /^finishing\.trims/, win: [0.772, 0.832], dur: d(0.5), order: topDown },
  { match: /^finishing\.signs/, win: [0.790, 0.830], dur: d(0.8) },
  { match: /^finishing\.pipes/, win: [0.800, 0.832], dur: d(0.55) },
  { match: /^finishing\.fixtures/, win: [0.805, 0.835], dur: d(0.4) },
  // ---- phase 10: site ---------------------------------------------------------------------
  { match: /^sitework\.shed\.posts/, win: [0.792, 0.812], dur: d(0.4) },
  { match: /^sitework\.shed\.frame/, win: [0.806, 0.826], dur: d(0.45) },
  { match: /^sitework\.shed\.sheets/, win: [0.820, 0.850], dur: d(0.45) },
  { match: /^sitework\.court/, win: [0.790, 0.816], dur: d(0.5) },
  { match: /^sitework\.courtlines/, win: [0.816, 0.838], dur: d(0.45) },
  { match: /^sitework\.hoops/, win: [0.830, 0.850], dur: d(0.5) },
  { match: /^sitework\.pavers/, win: [0.794, 0.845], dur: d(0.42) },
  { match: /^sitework\.plaza/, win: [0.800, 0.858], dur: d(0.4) },
  { match: /^sitework\.apron/, win: [0.805, 0.845], dur: d(0.45) },
  { match: /^sitework\.walkway/, win: [0.800, 0.845], dur: d(0.4) },
  { match: /^sitework\.drain/, win: [0.798, 0.826], dur: d(0.45) },
  { match: /^sitework\.grass/, win: [0.838, 0.880], dur: d(0.55) },
  { match: /^sitework\.fence/, win: [0.838, 0.872], dur: d(0.4), step: d(0.15) },
  { match: /^sitework\.plants/, win: [0.850, 0.896], dur: d(0.7) },
  { match: /^sitework\.buses/, win: [0.846, 0.903], dur: d(1.3) },
  { match: /^sitework\.lamps/, win: [0.846, 0.880], dur: d(0.5) },
];

// Removal windows for temporary works
export const REMOVAL_RULES = [
  { match: /^site\.pegs/, win: [0.052, 0.080], dur: d(0.4) },
  { match: /^site\.strings/, win: [0.050, 0.075], dur: d(0.4) },
  { match: /^site\.lime/, win: [0.120, 0.170], dur: d(0.5) },
  { match: /^crane\.top/, win: [0.738, 0.760], dur: d(0.5), reverseStep: true },
  { match: /^crane\.mast/, win: [0.756, 0.788], dur: d(0.34), reverseStep: true },
  { match: /^crane\.base/, win: [0.786, 0.794], dur: d(0.34) },
];

// Finishing (plaster + paint) windows: crews work from the roof down,
// sweeping around the U. Returns [f0, f1] as film fractions.
export function finishWindow(e) {
  const floor = e.tags.floor ?? 0;
  const lvl = Math.min(4, Math.max(0, floor));
  const f0 = 0.662 + (4 - lvl) * 0.0235 + (e.tags.s ?? 0.5) * 0.026 + hash01(e.id, 'fin') * 0.004;
  return [f0, f0 + d(0.9)];
}

function ruleFor(rules, group) {
  for (const r of rules) {
    const m = group.match(r.match);
    if (m) return { r, m };
  }
  return null;
}

function windowOf(r, m) {
  if (typeof r.win === 'function') return r.win(Number(m[1] ?? 0));
  return r.win;
}

// Assign t0/t1 (and f0/f1, rm0/rm1) to every element.
export function scheduleElements(elements) {
  const groups = new Map();
  for (const e of elements) {
    if (!groups.has(e.group)) groups.set(e.group, []);
    groups.get(e.group).push(e);
  }
  const missing = [];
  for (const [g, list] of groups) {
    const hit = ruleFor(GROUP_RULES, g);
    if (!hit) { missing.push(g); continue; }
    assign(list, hit, 't0', 't1');
    const rem = ruleFor(REMOVAL_RULES, g);
    if (rem) assign(list, rem, 'rm0', 'rm1');
  }
  for (const e of elements) {
    if (e.finishable) [e.f0, e.f1] = finishWindow(e);
  }
  return { missing, groups };
}

function assign(list, { r, m }, k0, k1) {
  const [w0, w1] = windowOf(r, m);
  const dur = r.dur;
  const stepDur = r.step ?? 0;
  const orderFn = r.order || ((e) => e.order);
  const keys = list.map(orderFn);
  const kmin = Math.min(...keys), kmax = Math.max(...keys);
  const steps = list.map((e) => e.tags.step ?? 0);
  const maxStep = Math.max(0, ...steps);
  const span = Math.max(0, w1 - w0 - dur - maxStep * stepDur);
  list.forEach((e, i) => {
    const u = kmax > kmin ? (keys[i] - kmin) / (kmax - kmin) : 0;
    // parts of one physical unit (a bus, a sign) share their jitter
    const jitter = (hash01(e.tags.unit ?? e.id, e.tags.unit ? 0 : e.seed) - 0.5) * Math.min(span * 0.08, d(0.25));
    const step = r.reverseStep ? maxStep - steps[i] : steps[i];
    const t0 = clamp(w0 + span * u + jitter + step * stepDur + (e.delay ?? 0), w0, 1);
    e[k0] = t0;
    e[k1] = t0 + dur;
  });
}

export function filmSeconds() { return FILM.seconds; }
