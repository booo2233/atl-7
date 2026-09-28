# De Paul Public School — a procedural construction film

A 30-second architectural film, generated entirely by code, in which the school
from the reference drone clip (`DJI_0211`) is built from an empty hillside
terrace: setting out, foundations, a frame that rises floor by floor, slabs,
laterite walls laid course by course, windows and jali grilles, arcades and
sunshades, steel roofs and clay tiles, plaster and paint, then paving,
landscaping and the school-bus fleet.

- **No stock footage, image generators or pre-rendered video.** Every surface
  is procedural. Textures are painted on `<canvas>` from seeded noise, all
  geometry is generated, and each frame is a pure function of its frame number.
- **Renderer:** Three.js (WebGL 2). It runs in real time in a browser. A
  headless Chromium capture renders it offline, frame by frame, and pipes the
  frames into ffmpeg (H.264).

```
npm install                      # three + playwright
npm run serve                    # http://127.0.0.1:8080  -> interactive player
node tools/validate.mjs --out docs/validation-report   # automatic validation
node tools/render.mjs --preset preview                 # 1280x720 draft film
node tools/render.mjs --preset hd                      # 1920x1080
node tools/render.mjs --preset final                   # 3840x2160 UHD master
node tools/render.mjs --stills 0,0.25,0.5,0.75,0.97 --w 1920 --h 1080   # stills
```

The renderer needs `ffmpeg` on `PATH`, or `FFMPEG=/path/to/ffmpeg`, or
`pip install imageio-ffmpeg`. Headless Chromium uses SwiftShader (CPU WebGL)
when there is no GPU; on a 4-core CPU a frame takes about 9 s at 1080p and
about 25 s at 4K. A GPU makes the render near real-time.

The player (`index.html`) offers play/pause, a scrubber, playback speed, the
edited film or any single camera (**CAM 1–4**), a free orbit camera, a
caption toggle, and a live **film length** field that retimes the whole
construction.

## Project layout

```
index.html                    player / render-mode page (import map -> node_modules/three)
src/config.js                 PARAMETERS: building dimensions, film length, phases
src/core/                     math (seeded RNG, easing), geometry helpers, module registry
src/building/                 the reconstruction (pure data, runs in Node too)
  layout.js                   structural grid + facade runs derived from parameters
  structure.js                create_foundation / create_columns / create_beams / create_floor_slab
  envelope.js                 create_walls / create_windows / create_doors / jali / arcades /
                              chajjas (create_balconies) / floor bands / parapets / trims / pipes
  pavilion.js                 porch block, twin columns, stage, grilles (railings), clay-tile roof
  roof.js                     create_roof: terrace steel roofs, red cross-gables, stair headroom
  tower.js                    glazed tower room, tower roof, tank block, school name boards
  site.js                     create_site: setting-out, paving, plaza, court, shed, fence, turf,
                              planting, buses
  crane.js                    temporary tower crane + its runtime rig
src/construction/
  schedule.js                 setup_construction_animation: phases -> groups -> element timing
  runtime.js                  per-frame instancing + motion per animation_type + finishing
  validate.js                 automatic validation and repair
src/render/                   procedural textures + PBR materials (raw -> finished shader)
src/world/                    terrain height field, forest, sky, sun, haze, neighbour house
src/film/                     cameras + edit, post-processing, HUD captions, film orchestrator
tools/                        serve.mjs, render.mjs (offline capture), validate.mjs, bench.mjs
docs/                         reference analysis, validation report, systems notes
```

## Procedural systems

### 1. Parameters → layout
`src/config.js` exposes the brief's controls, among them `courtyardWidth`,
`wingDepth` (building depth), `floorHeight`, `floorCount`, `wallThickness`,
`windowWidth`, `windowHeight`, `windowSpacing` (bay), `columnWidth`,
`slabThickness`, `parapetHeight`, `roofPitchDeg` (roof height) and
`chajjaDepth` (balcony/sunshade depth). The film length and phase windows sit
alongside them. `layout.js` derives from these:
- the structural grid (102 column nodes, 167 beam lines, 66 slab cells)
- eleven **facade runs**: outer, corridor wall, courtyard edge and end, per wing

Change a parameter and the whole school regenerates.

### 2. Modules (instancing)
Each repeated piece is a **module**: a parametric geometry cached by its
parameters (`boxModule`, `windowFrame`, `jaliPanel`, `spandrel`, `corbel`,
`chajja`, `roofTruss`, `roofSheet`, `porchColumn` …). About 550 unique
geometries serve 8,200 placed elements. Every (module, material) pair becomes
one `THREE.InstancedMesh`, so 276 windows are one draw call per material.

### 3. Construction elements
Every placed piece is an `Element` carrying the brief's animation attributes:

| brief attribute | element field |
|---|---|
| construction_start / construction_end | `t0` / `t1` (fractions of the film) |
| construction_duration | `t1 − t0` |
| construction_order | `order` (usually the crew's path around the U) |
| construction_group | `group` (e.g. `frame.columns.F2`, `walls.F0`, `roof.sheets`) |
| animation_type | `anim.type` |
| delay | `delay` + `tags.step` (e.g. masonry course index) |
| random_seed | `seed` (deterministic jitter, shading variation) |
| — | `f0/f1` plaster-and-paint window, `rm0/rm1` removal window (temporary works) |

### 4. Schedule (retimes itself)
`schedule.js` holds a rule table mapping construction groups to time windows,
all expressed as fractions of the film. Inside each window, elements are
staggered by their order and step, with deterministic jitter. Changing
`FILM.seconds`, or the *Length* field in the player, retimes the construction,
the cameras and the captions together.

Phase windows (fractions of 30 s):
1. site (0–0.06)
2. foundation (0.05–0.165)
3. frame (0.15–0.42)
4. slabs (0.175–0.435)
5. walls (0.25–0.52)
6. openings (0.40–0.60)
7. exterior features (0.47–0.62)
8. roof (0.56–0.745)
9. finishing (0.66–0.835)
10. site works (0.79–0.905)

The completed school then holds on the hero camera.

### 5. Motion per category (`runtime.js`)

| animation_type | used for | motion |
|---|---|---|
| `emerge` | footings, stage plinth | rises out of the ground |
| `rise` | columns, pedestals, posts, pipes | grows upward from its base (formwork pour) |
| `slide` | beams, purlins | slides in along its axis from a raised position, slight overshoot |
| `pour` | slab panels, pavilion slabs | deck placed then thickens, panel by panel across the floor |
| `lay` | masonry courses, parapets, steps | each course is lowered onto the one below |
| `drop` | spandrels, pavers, ridge caps | lowered into place and settles |
| `install` | windows, doors, jali, chajjas, bands, signs | pushed into the opening along the wall normal |
| `lift` | roof trusses, crane jib | lowered by the crane from 6–8 m with a small swing and settle |
| `sheet` | corrugated sheets | laid bay by bay, tilting down onto the purlins |
| `tile` | clay-tile courses | laid eave to ridge |
| `unroll` | lavender trims, lime lines, turf, court lines | unrolls along its length |
| `grow` | planting | grows with a soft overshoot |
| `drive` | buses | reverse into their bays |
| `mast` | crane sections | stacked one by one |

Finishing is a material transition, not a fade. Each instance has an
`aFinish` attribute. The shader sweeps a noisy, darker "wet" plaster edge down
each element, from raw laterite or concrete to painted plaster. Crews work top
down around the U.

### 6. Temporary works
Setting-out pegs, strings and lime lines appear first and are removed once the
footings start. A **tower crane** is erected section by section. Its slew
angle, trolley radius and hook height are computed from the centroid of the
elements being installed at each moment, so it tracks the active work. At the
end it parks over the open courtyard and is dismantled top-down, before the
paving goes in.

### 7. Automatic validation (`validate.js`, `tools/validate.mjs`)
Dependencies are **derived from geometry**, not authored by hand:
- **Bottom support:** what an element rests on must be complete before it starts.
- **Lateral support:** beams, spandrels and sunshades need the frame they attach to.
- **Openings:** every wall piece around a window must be complete first; glass follows its frame.
- **Coverings:** roof coverings follow their framing.
- **Finishes:** trims and signs follow the host's paint; paint follows the build; removals follow installation.

A construction-rank hierarchy stops infill (e.g. a wall under a beam) from being
treated as support. Violations are **repaired automatically** by delaying the
dependent element, iterated to a fixed point, and a second pass re-validates.

The validator also reports:
- floating elements
- interpenetrating solids (AABB, with intended embeds whitelisted)
- windows before walls
- the roof starting before the top slab
- motions shorter than 8 frames (snapping)
- invalid timing
- checkpoint counts at frame 1, early, mid, facade, near completion and final: empty site at frame 1, monotonic growth, everything complete and all temporary works removed at the end

See `docs/validation-report.md`.

### 8. Cinematography
There are four camera rigs, each on its own C1-continuous Hermite path that
lasts the whole film. The edit cuts between them at construction milestones:

| Camera | Shot | Segment |
|---|---|---|
| CAM 1 | wide establishing (front-left, like the drone) | site → foundation → first columns |
| CAM 3 | elevated three-quarter | the frame rising floor by floor |
| CAM 2 | courtyard facade, with shallow depth of field | walls, arcades, jali, windows, porch |
| CAM 3 | crane-up | trusses and roof covering |
| CAM 4 | hero | finishing, site works, and the hold on the completed school |

Any single camera can also be rendered for the whole film (`--camera CAM_1`).

### 9. Look
- Physically based materials; the sky's image-based lighting comes from the Preetham sky.
- Sun with a 4096² PCF-soft shadow map, exponential haze, and ACES filmic tone mapping.
- Ground-truth AO at half resolution. The foliage is excluded from it, since its canopy shading already carries occlusion.
- Depth of field that reuses the AO depth buffer, plus MSAA or SMAA.
- Chunked, instanced forest (broadleaf canopies with a clump shader, coconut palms), with tea terraces painted on the terrain.

## Assumptions
See [`docs/REFERENCE_ANALYSIS.md`](docs/REFERENCE_ANALYSIS.md) for the
measurements and every significant assumption made where the video does not
show the building.
