// =============================================================================
//  PARAMETERS / CONTROL SECTION
//  Every dimension of the reconstructed school and every timing of the film is
//  derived from the values below. Edit them and reload: the building, the
//  construction schedule, the cameras and the validation all regenerate.
//
//  World convention (Three.js, Y-up, metres):
//    +X = east (right, looking at the school from its open courtyard side)
//    +Y = up
//    +Z = south (towards the assembly ground / the viewer)
//  The U-shaped block opens towards +Z. Origin = centre of the courtyard's
//  front edge at finished courtyard level.
// =============================================================================

export const BUILDING = {
  // ---- plan ----------------------------------------------------------------
  courtyardWidth: 40.0,      // clear width between the two side wings
  courtyardDepth: 26.0,      // back wing inner face -> front end of right wing
  wingDepth: 10.0,           // building_depth of every wing (classroom + corridor)
  corridorDepth: 2.8,        // corridor on the courtyard side of each wing
  leftWingExtension: 18.0,   // "Junior College" block: left wing continues forward
  backBays: 10,              // structural bays across the courtyard (4.0 m each)
  courtyardSideBays: 7,      // bays of each side wing along the courtyard
  extensionBays: 5,          // bays of the junior-college extension
  towerBays: 4,              // central bays of the back wing forming the tower

  // ---- sections --------------------------------------------------------------
  floorCount: 4,             // G + 3
  floorHeight: 3.5,          // floor_height (floor-to-floor)
  plinthHeight: 0.6,         // ground floor level above courtyard
  slabThickness: 0.15,       // slab_thickness
  beamDepth: 0.5,
  beamWidth: 0.3,
  columnWidth: 0.40,         // column_width (square RCC columns)
  wallThickness: 0.23,       // wall_thickness (laterite block + plaster)
  footingSize: 1.6,

  // ---- openings ---------------------------------------------------------------
  windowWidth: 2.1,          // window_width (classroom windows, outer facades)
  windowHeight: 1.5,         // window_height
  sillHeight: 0.9,
  windowSpacing: 4.0,        // window_spacing = structural bay
  doorWidth: 1.0,
  doorHeight: 2.1,
  corridorParapet: 1.0,      // solid parapet of the courtyard arcades
  archSpring: 2.25,          // arch springing height above floor
  archRise: 0.42,            // segmental arch rise
  chajjaDepth: 0.6,          // sunshade projection over outer windows
  bandDepth: 0.28,           // continuous floor band on courtyard facades

  // ---- roof ---------------------------------------------------------------------
  parapetHeight: 1.0,        // parapet_height (roof terrace)
  terracePostHeight: 2.8,    // steel posts carrying the metal terrace roof
  roofPitchDeg: 20,          // roof_height derives from pitch x half span
  roofOverhang: 0.9,
  redGablePitchDeg: 17,

  // ---- pavilion (central porch block in the courtyard) ------------------------
  pavilion: {
    coreHalfWidth: 5.0,      // central two-storey block
    sideWidth: 3.0,          // lower side parts
    front: -14.9,            // z of the upper room front wall
    sideFront: -17.4,        // z of the side parts' front walls
    stageFront: -13.1,
    stageHeight: 0.9,
    firstFloor: 4.6,
    eave: 8.0,
    pitchDeg: 30,
  },
};

export const FILM = {
  fps: 24,
  seconds: 30,               // total film length: the whole schedule retimes to it
  width: 3840,               // final render target (UHD)
  height: 2160,
  previewWidth: 1280,
  previewHeight: 720,
  seed: 20260928,
  captions: true,
};

// Construction phases, expressed as fractions of the film (0..1). The schedule
// (src/construction/schedule.js) places every element inside its phase window
// and staggers it procedurally, so changing FILM.seconds retimes everything.
export const PHASES = [
  { id: 1, key: 'site',       label: 'Empty site & setting out',         start: 0.000, end: 0.060 },
  { id: 2, key: 'foundation', label: 'Foundation',                        start: 0.050, end: 0.165 },
  { id: 3, key: 'frame',      label: 'Structural frame',                  start: 0.150, end: 0.420 },
  { id: 4, key: 'slabs',      label: 'Floor slabs',                       start: 0.175, end: 0.435 },
  { id: 5, key: 'walls',      label: 'Masonry walls',                     start: 0.250, end: 0.520 },
  { id: 6, key: 'openings',   label: 'Windows, doors & jali',             start: 0.400, end: 0.600 },
  { id: 7, key: 'exterior',   label: 'Sunshades, arcades & porch',        start: 0.470, end: 0.620 },
  { id: 8, key: 'roof',       label: 'Roof structure & covering',         start: 0.560, end: 0.745 },
  { id: 9, key: 'finishing',  label: 'Plaster, paint & facade details',   start: 0.660, end: 0.835 },
  { id: 10, key: 'site',      label: 'Site works & landscaping',          start: 0.790, end: 0.905 },
];

export const HOLD_START = 0.905; // completed school holds on screen after this

// Derived helpers ----------------------------------------------------------------
export function floorLevel(f) {
  // finished floor level (top of slab) of floor f; f = floorCount -> roof slab
  return BUILDING.plinthHeight + f * BUILDING.floorHeight;
}
export const ROOF_LEVEL = floorLevel(BUILDING.floorCount);
