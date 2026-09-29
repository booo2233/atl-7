"""Paint the equirectangular texture for the spinning globe.

Coastlines: Natural Earth 1:50m land (public domain), via the world-atlas
TopoJSON package. The land is painted in the crest's palette (golden greens,
olive, laterite brown) with fractal noise, so the spinning globe reads as the
same globe that sits in the logo.

Output: assets/layers/globe_land.png  (RGBA, alpha = land coverage)
        assets/layers/globe_noise.png (L, dissolve noise used for the paint-in)

usage: python3 tools/build_globe.py path/to/land-50m.json
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'layers'
W, H = 2048, 1024
SS = 2  # supersampling for antialiased coastlines


def decode_topojson(path):
    topo = json.loads(Path(path).read_text())
    sx, sy = topo['transform']['scale']
    tx, ty = topo['transform']['translate']
    arcs = []
    for arc in topo['arcs']:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)

    def ring(indices):
        pts = []
        for i in indices:
            a = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts.extend(a if not pts else a[1:])
        return pts

    polys = []
    for g in topo['objects']['land']['geometries']:
        groups = g['arcs'] if g['type'] == 'MultiPolygon' else [g['arcs']]
        for poly in groups:
            polys.append([ring(r) for r in poly])
    return polys


def unwrap(r):
    """Make a ring continuous in longitude; close pole-encircling rings via the pole."""
    out = [list(r[0])]
    for lon, lat in r[1:]:
        prev = out[-1][0]
        while lon - prev > 180:
            lon -= 360
        while lon - prev < -180:
            lon += 360
        out.append([lon, lat])
    span = out[-1][0] - out[0][0]
    if abs(span) > 180:  # encircles a pole (Antarctica)
        pole = -90 if sum(p[1] for p in out) < 0 else 90
        out += [[out[-1][0], pole], [out[0][0], pole]]
    return out


def fbm(h, w, seed, octaves=5, base=8):
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        gh, gw = base * 2 ** o // 2 + 2, base * 2 ** o + 2
        g = rng.random((gh, gw)).astype(np.float32)
        g[:, -1] = g[:, 0]  # wrap in longitude
        out += amp * cv2.resize(g, (w, h), interpolation=cv2.INTER_CUBIC)
        tot += amp
        amp *= 0.55
    out /= tot
    return (out - out.min()) / (out.max() - out.min())


def blob(lon, lat, lon0, lat0, slon, slat):
    return np.exp(-(((lon - lon0) / slon) ** 2 + ((lat - lat0) / slat) ** 2))


def main():
    polys = decode_topojson(sys.argv[1])
    big = Image.new('L', (W * SS, H * SS), 0)
    d = ImageDraw.Draw(big)
    for poly in polys:
        for k, r in enumerate(poly):
            ring = unwrap(r)
            for off in (-360, 0, 360):
                xy = [((lon + off + 180) / 360 * W * SS, (90 - lat) / 180 * H * SS) for lon, lat in ring]
                d.polygon(xy, fill=255 if k == 0 else 0)
    mask = np.array(big.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255

    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    lon = xx / W * 360 - 180
    lat = 90 - yy / H * 180

    n1 = fbm(H, W, 3, 6, 6)
    n2 = fbm(H, W, 11, 5, 12)

    # palette sampled from the crest's globe
    green = np.array([74, 112, 30], np.float32)
    deep = np.array([38, 82, 26], np.float32)
    gold = np.array([196, 178, 52], np.float32)
    brown = np.array([150, 102, 48], np.float32)
    ice = np.array([232, 236, 226], np.float32)

    arid = (blob(lon, lat, 12, 23, 22, 8) + blob(lon, lat, 45, 23, 12, 9) + blob(lon, lat, 132, -25, 14, 8)
            + blob(lon, lat, -110, 30, 9, 7) + blob(lon, lat, 100, 42, 16, 6) + blob(lon, lat, 20, -24, 7, 6)
            + blob(lon, lat, -68, -30, 5, 12) + blob(lon, lat, 62, 36, 10, 6))
    arid = np.clip(arid * (0.55 + 0.9 * n2), 0, 1) * 0.85
    tropic = np.clip(np.exp(-(lat / 14) ** 2) * (1 - arid), 0, 1)
    north = np.clip((np.abs(lat) - 42) / 20, 0, 1) * (1 - arid)
    polar = np.clip((np.abs(lat) - 64) / 8, 0, 1)
    greenland = blob(lon, lat, -41, 74, 16, 9)
    polar = np.clip(np.maximum(polar, greenland), 0, 1)

    col = green[None, None] * np.ones((H, W, 1), np.float32)
    col = col * (1 - tropic[..., None]) + deep * tropic[..., None]
    col = col * (1 - north[..., None]) + gold * north[..., None]
    col = col * (1 - arid[..., None]) + brown * arid[..., None]
    col = col * (1 - polar[..., None]) + ice * polar[..., None]
    # painterly variation: warm/cool drift and brightness grain
    col *= (0.78 + 0.44 * n1)[..., None]
    col += ((n2 - 0.5) * 38)[..., None] * np.array([1.0, 0.9, 0.3], np.float32)
    # darker rim along the coasts gives the continents a crisp edge
    dist = cv2.distanceTransform((mask > 0.5).astype(np.uint8), cv2.DIST_L2, 3)
    col *= (0.72 + 0.28 * np.clip(dist / 5, 0, 1))[..., None]
    col = np.clip(col, 0, 255)

    rgba = np.dstack([col, mask * 255]).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(OUT / 'globe_land.png', optimize=True)
    noise = fbm(H // 2, W // 2, 29, 5, 10)
    Image.fromarray((noise * 255).astype(np.uint8), 'L').save(OUT / 'globe_noise.png', optimize=True)
    print('globe_land.png', rgba.shape, 'land fraction %.3f' % mask.mean())


if __name__ == '__main__':
    main()
