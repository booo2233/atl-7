# Reference analysis — De Paul Public School (drone clip `DJI_0211`)

**Source:** 21.5 s, 2560×1440, 29.97 fps. The drone starts high and front-left of
the campus, orbits towards the centre-line, then descends and pushes in on the
courtyard pavilion. All 43 frames sampled at 2 fps were used; the building
facts below are what those frames show. Dimensions are derived from the parked
school buses, which serve as scale bars: ~9.5 m long and 2.45 m wide.

## What the video shows

| Feature | Observation (timestamp) | Reconstruction |
|---|---|---|
| Plan | U-shaped block open to the south-east assembly ground (0–7 s) | U of three wings, open towards +Z |
| Asymmetry | The **left wing is much longer** than the right; it runs past the courtyard alongside the tiled assembly plaza and carries a **"DE PAUL JUNIOR COLLEGE"** board on its end (0–4 s) | Left wing = 7 courtyard bays + 5-bay junior-college extension (18 m) |
| Storeys | Four storeys (G+3) plus a roof terrace under a light metal roof on steel posts (0–10 s) | `floorCount: 4`, terrace posts 2.8 m, 20° gable |
| Courtyard facades | Continuous corridors behind **segmental arches with corbel brackets**, dark **jali (breeze-block grille)** infill, thick floor bands with a **lavender line** (9–20 s) | Arcade spandrel module + corbels + jali panels + floor bands + lavender trims |
| Right wing & extension | Courtyard face with **rectangular** jali windows and a continuous sunshade over each row (6–10 s) | `rect` style bays with continuous chajjas |
| Right wing end | Stair tower with stacked ventilation jali, a jali corridor end and a flat-roofed stair headroom on the terrace (1–5 s) | End-wall bays with jali + `mumty` |
| Back wing centre | **Tower**: glazed room at terrace level, **"DE PAUL PUBLIC SCHOOL"** board (white serif on blue-grey), grey gable roof, white tank/headroom block rising above (8–16 s) | `tower.js` |
| Cross-gables | Two **faded-red sheet gables** flanking the tower over the back corridor, with the truss visible in the gable end (6–16 s) | Red cross-gables whose ridges run into the grey back roof |
| Pavilion | Two-storey porch block in front of the tower; open stage with a **red floor**, **twin round white columns**, blue-grey plinth, steps at both front corners with a blue grille between them; three windows over the porch; **Kerala clay-tile roof**: hipped with a small front gablet, and lower hips over the side parts (10–21 s) | `pavilion.js` |
| Colours | Warm off-white plaster, lavender trims, dark window frames, maroon-brown tiles, grey galvalume sheets, faded red sheets | Material library |
| Site | Red interlocking pavers in the courtyard, a grey tiled plaza with a drain on its edge, a grey concrete apron, **red laterite soil** playground, a steel shed over a court (front-left), a green shade-net fence (right), a white two-storey house with a grey hip roof (top-left), dense tropical forest with coconut palms, tea terraces on the hill behind (0–8 s) | `site.js`, `environment.js` |
| Buses | About 16 yellow buses parked in two groups either side of the pavilion, nose-out (5–21 s) | 14 procedural buses that drive in at the end |

## Derived dimensions

| Quantity | Estimate | Basis |
|---|---|---|
| Courtyard clear width | 40 m | ≈ 535 px across the back wing in frame 6 at ≈ 13.5 px/m (pavilion roof = 20 m) |
| Courtyard depth to right-wing end | 26 m | two rows of 9.5 m buses + aisle + apron |
| Wing depth | 10 m | 7.2 m classrooms + 2.8 m corridor (regional school practice) |
| Arcade bay | 4.0 m (back), 3.7 m (sides) | 3 arches between tower and corner per side |
| Tower width | 16 m | 4 back-wing bays; the board is ≈ 13.4 m |
| Pavilion | 16 m wide (10 m core + 3 m side parts), ≈ 12.5 m deep | pavilion width ≈ tower width |
| Floor height | 3.5 m, plinth 0.6 m | typical G+3 RCC school; storey count × facade height |
| Roof | terrace eave ≈ +17.4 m, ridge ≈ +19.2 m | posts ≈ 2.8 m above the parapet line |

## Significant assumptions (where the video does not show enough)

1. **Outer facades** (west face of the left wing, north face of the back wing, east face of the right wing) are never seen. They are modelled as classroom windows with sunshades in every structural bay, continuing the visible rhythm of the end facades.
2. **Wing section**: 7.2 m classrooms + 2.8 m corridor on the courtyard side. Doors alternate with windows along the corridor walls.
3. **Structure**: RCC frame (square 400 mm columns, 300×500 beams, 150 mm slabs) on isolated footings with plinth beams, with laterite-block infill. This is standard Kerala practice and drives the construction sequence.
4. **Tower room** is glazed on all four sides; only the front is visible. The tank/headroom block sits at the back of its roof.
5. **Red cross-gables** are read as sheet roofs covering the front half of the back-wing terrace between the tower and the corners. Their ridges die into the grey back roof.
6. **Pavilion depth**, its back wall and its side parts are inferred; the video only shows the front and upper faces.
7. **Terrace roofs** of the side wings run into the back-wing roof, forming valleys at the corners. The right-wing roof stops at the stair headroom.
8. **Interiors** are not modelled. Glazing is dark and reflective, as in the video.
9. **Site layout** (plaza, court, shed, fence, walkways) follows the video's relative positions; exact sizes are estimates. The neighbouring house, the forest and the tea terraces are procedural stand-ins.
10. **Tower crane and setting-out** are temporary works added so the construction reads clearly. A real G+3 school in Kerala may be built with hoists and scaffolding instead.
11. **Bus fleet**: 14 buses in the video's two-group arrangement; the video shows about 16.
