# De Paul Public School — crest reveal

A 15-second motion-graphics build-out of the school crest, generated entirely
by code: 1920×1080, 60 fps, H.264, with a synthesised stereo soundtrack.

**Output:** `output/de-paul-crest_1920x1080_60fps.mp4`

## The sequence

| time (s) | what happens |
|---|---|
| 0.0–1.3 | A point of light flashes and a gold wire globe draws itself: meridians race pole to pole, parallels wrap round. The globe spins and wobbles on its axis, fills with glass, and its continents dissolve in. |
| 0.3–2.3 | A spark orbits the globe, spirals out and becomes a comet. The comet draws the red ring in one lap, shedding sparks. |
| 2.3–3.2 | The ring bursts at the top and throws out the seven stars. They arc round in mirrored pairs and lock into place, each with a flash and a shockwave. |
| 2.9–4.3 | The laurels grow up both sides of the ring from their stems; the book opens with a fan of light. |
| 3.8–4.9 | The shield grows outward from inside the crest, then lands with a backlit rim flash and a camera kick. |
| 4.5–5.8 | The purple roundels draw on. The torch rises and ignites, the Olympic rings pop in, and the lamp lights. |
| 5.3–7.8 | The ribbon unfurls from the centre with a travelling wave, and its letters pop on. The motto banner drops in and swings to rest, then its letters land. |
| 7.3–8.3 | RAJAMUDY tracks in, the IDUKKI pill expands and the flourishes grow outward. |
| 9.0–15 | The globe spins down to the crest's own view and hands over to the original globe art under a glint. A light sweep crosses the crest, the stars twinkle, and light rays turn behind it during a slow push-in. |

The camera starts close on the globe and pulls back to the full crest as it
is built.

## How it works

- **`tools/extract_layers.py`** cuts the crest (`assets/source/logo.webp`)
  into 66 layers in `assets/layers/`, using colour masks, connected
  components and inpainting. The layers are: shield, ring and stars, laurels,
  book, globe, the emblems, the ribbon and banner, and every letter on its own.
  `manifest.json` records their positions, pivots and fitted circles. The
  red ring and the purple roundels are redrawn as vectors from the fitted
  circles, so they can be drawn on.
- **`tools/build_globe.py`** paints the spinning globe's equirectangular
  texture in the crest's palette. The coastlines are Natural Earth 1:50m land
  (public domain), from the `world-atlas` package.
- **`src/logo.js`** is the animation, in Canvas 2D. Every frame is a pure
  function of its frame number. The globe is ray-cast per pixel: an
  orthographic sphere with glass shading, analytically antialiased gold wires
  on both faces, motion blur on the spin, and a noise-dissolve paint-in.
  Everything else is the layers, animated with eased transforms, conic,
  radial and linear reveal masks, and strip-based cloth waves. Additive
  effects (comet, sparks, flashes, glows) go on their own layer, which is
  bloomed at two scales.
- **`tools/sound.py`** synthesises the soundtrack with numpy from the
  animation's own event table. The sounds are filtered-noise whooshes,
  pitch-dropping booms, inharmonic tings and chimes, granular rustles and a
  D-major pad, run through a synthetic stereo reverb.
- **`tools/render.mjs`** drives headless Chromium. It renders frames in
  parallel workers, reads back raw RGBA, encodes the chunks with ffmpeg,
  joins them and muxes in the audio.

```
python3 tools/extract_layers.py          # layers + manifest (already committed)
python3 tools/build_globe.py land-50m.json
node tools/render.mjs --stills 1,2.6,4.5  # quick stills -> output/stills
node tools/render.mjs --mute --out output/video_only.mp4
python3 tools/sound.py                    # output/soundtrack.wav from output/events.json
node tools/render.mjs                     # full film with the soundtrack muxed in
```

Open `index.html` through any static server to play the animation live, with
play/pause and a scrubber. The render takes about 2.5 minutes on a 4-core CPU
with no GPU.
