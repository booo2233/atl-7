"""Cut the De Paul Public School crest into animatable layers.

Reads assets/source/logo.webp (RGBA) and writes assets/layers/*.png plus
assets/layers/manifest.json (positions in logo pixel space). Elements sit on
the shield's white field, so each part is isolated with a region + colour
mask; letters are split into connected components; the banner and ribbon get
their lettering inpainted away so words can be typed back on; the shield is
rebuilt as a clean white field with its blue border (reconstructed where the
ribbon crosses it). The globe is unprojected into an equirectangular texture
for the procedural spinning globe.
"""
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'assets', 'source', 'logo.webp')
OUT = os.path.join(ROOT, 'assets', 'layers')
os.makedirs(OUT, exist_ok=True)

img = np.array(Image.open(SRC).convert('RGBA'))
H, W = img.shape[:2]
rgb = img[..., :3].astype(np.int32)
alpha = img[..., 3]
R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
mx, mn = rgb.max(-1), rgb.min(-1)
yy, xx = np.mgrid[0:H, 0:W]

visible = alpha > 8
WHITE = (mn > 212) & (mx - mn < 34)
NONWHITE = visible & ~WHITE
RED = visible & (R > 140) & (G < 120) & (B < 120) & (R - G > 70)
DARK = visible & (mx < 75)
GREEN = visible & (G > R + 8) & (G > B + 8) & (mn < 235)
RIBBON_BLUE = visible & (B > 150) & (R < 110) & (G >= 105) & (B - R > 90)
BORDER_BLUE = visible & (B > 105) & (R < 80) & (G < 124) & (B - G > 40)


def box(x0, y0, x1, y1):
    return (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)


def disk(cx, cy, r):
    return (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r


def fill_holes(mask):
    m = mask.astype(np.uint8) * 255
    h, w = m.shape
    flood = m.copy()
    ff = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(flood, ff, (0, 0), 255)
    return mask | (flood == 0)


def dilate(mask, r):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    return cv2.dilate(mask.astype(np.uint8), k) > 0


def erode(mask, r):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    return cv2.erode(mask.astype(np.uint8), k) > 0


def components(mask, min_area=20):
    n, lab, stats, cent = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    out = []
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            out.append(lab == i)
    return out


manifest = {'size': [W, H], 'layers': {}}
taken = np.zeros((H, W), bool)


def save(name, mask, source=None, feather=True, extra=None):
    """Save the masked pixels of `source` (default: original) as a cropped PNG."""
    global taken
    src = img if source is None else source
    m = mask & (src[..., 3] > 0)
    if not m.any():
        print('EMPTY layer', name)
        return None
    ys, xs = np.nonzero(m)
    x0, x1 = max(0, xs.min() - 2), min(W, xs.max() + 3)
    y0, y1 = max(0, ys.min() - 2), min(H, ys.max() + 3)
    crop = src[y0:y1, x0:x1].copy()
    a = np.where(m[y0:y1, x0:x1], crop[..., 3], 0).astype(np.float32)
    if feather:
        # soften the 1px rim so white fringes do not glow over dark stages
        inner = erode(m[y0:y1, x0:x1], 1)
        rim = m[y0:y1, x0:x1] & ~inner
        a[rim] *= 0.55
    crop[..., 3] = a.astype(np.uint8)
    Image.fromarray(crop).save(os.path.join(OUT, f'{name}.png'))
    entry = {'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0)}
    if extra:
        entry.update(extra)
    manifest['layers'][name] = entry
    taken |= mask
    return entry


def centroid(mask):
    ys, xs = np.nonzero(mask)
    return float(xs.mean()), float(ys.mean())


# ---------------------------------------------------------------------------
# Red ring (drawn as a vector circle in the animation): fit centre + radius
# robust fit: start from the visual estimate, keep only thin-ring pixels
cx, cy, rr = 592.0, 440.0, 255.0
for _ in range(6):
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    sel = RED & (np.abs(d - rr) < 10) & (yy < cy + 150)
    ys, xs = np.nonzero(sel)
    A = np.c_[2 * xs, 2 * ys, np.ones_like(xs)]
    bvec = xs ** 2 + ys ** 2
    cx, cy, c = np.linalg.lstsq(A, bvec, rcond=None)[0]
    rr = math.sqrt(c + cx * cx + cy * cy)
d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
ring_mask = RED & (np.abs(d - rr) < 7)
prof = [int((ring_mask & (np.abs(d - (rr + o)) < 0.5)).sum()) for o in np.arange(-6, 6.5, 0.5)]
width = sum(1 for v in prof if v > max(prof) * 0.35) * 0.5
manifest['ring'] = {'cx': float(cx), 'cy': float(cy), 'r': float(rr), 'width': float(max(4.5, width)), 'color': [210, 24, 22]}
print('ring', manifest['ring'])

# Globe: centre / radius from the extent of globe pixels inside the ring
gzone = disk(594, 441, 172) & NONWHITE & ~RED & (yy < 606) & ~disk(cx, cy - rr + 40, 45)
ys, xs = np.nonzero(gzone)
gx0, gx1, gy0, gy1 = xs.min(), xs.max(), ys.min(), ys.max()
gcx, gcy = (gx0 + gx1) / 2, (gy0 + gy1) / 2
gr = ((gx1 - gx0) + (gy1 - gy0)) / 4
manifest['globe'] = {'cx': float(gcx), 'cy': float(gcy), 'r': float(gr)}
print('globe', manifest['globe'])
globe_mask = disk(gcx, gcy, gr + 1.5) & visible
save('globe', globe_mask, feather=False, extra={'cx': float(gcx), 'cy': float(gcy), 'r': float(gr)})

# Stars inside the ring
star_mask = RED & disk(cx, cy, rr - 12) & ~disk(gcx, gcy, gr + 3)
stars = sorted(components(dilate(star_mask, 1) & NONWHITE & ~disk(gcx, gcy, gr + 2), 80), key=lambda m: math.atan2(centroid(m)[1] - cy, centroid(m)[0] - cx))
manifest['stars'] = []
for i, m in enumerate(stars):
    sx, sy = centroid(m)
    e = save(f'star{i}', m, extra={'cx': sx, 'cy': sy})
    manifest['stars'].append(f'star{i}')
print('stars', len(stars))

# Top banner ("FOR GOD & COUNTRY")
banner = fill_holes(RED & (yy < 150)) & visible & (yy < 150)
banner = dilate(banner, 1) & visible & (yy < 150) & ~BORDER_BLUE
banner_letters = [m for m in components(banner & (mn > 150) & ~RED, 25)]
banner_letters.sort(key=lambda m: centroid(m)[0])
letters_union = np.zeros_like(banner)
for m in banner_letters:
    letters_union |= m
b_base = img.copy()
inp_mask = (dilate(letters_union, 3) & banner).astype(np.uint8) * 255
b_base[..., :3] = cv2.inpaint(np.ascontiguousarray(img[..., :3]), inp_mask, 6, cv2.INPAINT_TELEA)
save('banner', banner, source=b_base, feather=False)
manifest['bannerLetters'] = []
for i, m in enumerate(banner_letters):
    lx, ly = centroid(m)
    save(f'bl{i}', dilate(m, 1) & banner, extra={'cx': lx, 'cy': ly})
    manifest['bannerLetters'].append(f'bl{i}')
print('banner letters', len(banner_letters))

# Ribbon ("DE PAUL PUBLIC SCHOOL")
rzone = box(0, 890, W, 1165)
r_core = RIBBON_BLUE & rzone
r_dark = DARK & dilate(r_core, 26) & rzone
ribbon = fill_holes(r_core | r_dark) & rzone
ribbon = dilate(ribbon, 1) & visible & rzone
ribbon_letters = components(ribbon & (mn > 150) & ~dilate(r_dark, 1), 40)
# thin slivers are white field seen between ribbon and shield border, not letters
slivers = [m for m in ribbon_letters if np.nonzero(m)[1].ptp() < 12]
ribbon_letters = [m for m in ribbon_letters if np.nonzero(m)[1].ptp() >= 12]
for m in slivers:
    ribbon &= ~dilate(m, 1)
ribbon_letters.sort(key=lambda m: centroid(m)[0])
rl_union = np.zeros_like(ribbon)
for m in ribbon_letters:
    rl_union |= m
r_base = img.copy()
inp = (dilate(rl_union, 3) & ribbon).astype(np.uint8) * 255
r_base[..., :3] = cv2.inpaint(np.ascontiguousarray(img[..., :3]), inp, 7, cv2.INPAINT_TELEA)
save('ribbon', ribbon, source=r_base, feather=False)
manifest['ribbonLetters'] = []
for i, m in enumerate(ribbon_letters):
    lx, ly = centroid(m)
    save(f'rl{i}', dilate(m, 1) & ribbon, extra={'cx': lx, 'cy': ly})
    manifest['ribbonLetters'].append(f'rl{i}')
print('ribbon letters', len(ribbon_letters))

# Laurels (left / right branches)
laurel_zone = box(200, 195, W, 780) & ~disk(gcx, gcy, gr + 4)
laurel = GREEN & laurel_zone & ~RED
laurel = dilate(laurel, 1) & NONWHITE & laurel_zone & ~RED & ~dilate(star_mask, 2)
# remove the book (navy/blue) from the laurel candidates
book_zone = box(448, 598, 735, 792)
navy = visible & (B > R + 25) & (G < 170) & ~GREEN
book = fill_holes((navy | DARK) & book_zone) & book_zone & ~GREEN
book = dilate(book, 1) & book_zone & visible & ~(GREEN & ~dilate(navy | DARK, 1))
laurel &= ~book
left = laurel & (xx < gcx)
right = laurel & (xx >= gcx)
save('laurelL', left, extra={'baseX': 470, 'baseY': 760})
save('laurelR', right, extra={'baseX': 715, 'baseY': 760})
save('book', book, extra={'spineX': 590})

# Torch circle (left) and Olympic rings circle (right)
def circle_group(prefix, ccx, ccy):
    ring_d = np.sqrt((xx - ccx) ** 2 + (yy - ccy) ** 2)
    outer = NONWHITE & (ring_d < 100)
    purple = outer & (B > R + 45) & (R > 20) & (G < 90) & (ring_d > 76)
    rds = ring_d[purple]
    manifest[f'{prefix}Circle'] = {'cx': ccx, 'cy': ccy, 'r': float(np.median(rds)), 'width': 6.5, 'color': [54, 43, 124]}
    inner = NONWHITE & (ring_d < 80)
    return inner

# refine the two circle centres from their purple outlines
def fit_circle(zone):
    ys, xs = np.nonzero(zone)
    A = np.c_[2 * xs, 2 * ys, np.ones_like(xs)]
    bvec = xs ** 2 + ys ** 2
    ccx, ccy, cc = np.linalg.lstsq(A, bvec, rcond=None)[0]
    return float(ccx), float(ccy), math.sqrt(cc + ccx * ccx + ccy * ccy)

purple_all = visible & (B > R + 45) & (R > 20) & (G < 90) & (B > 90)
tcx, tcy, tr = fit_circle(purple_all & box(210, 725, 410, 935))
ocx, ocy, orr = fit_circle(purple_all & box(760, 725, 960, 935))
manifest['torchCircle'] = {'cx': tcx, 'cy': tcy, 'r': tr, 'width': 7.0, 'color': [52, 42, 122]}
manifest['ringsCircle'] = {'cx': ocx, 'cy': ocy, 'r': orr, 'width': 7.0, 'color': [52, 42, 122]}
print('circles', manifest['torchCircle'], manifest['ringsCircle'])
tin = NONWHITE & disk(tcx, tcy, tr - 7)
flame = tin & (R > 180) & (B < 190) & ~GREEN & (yy < tcy + 30)
flame = fill_holes(dilate(flame, 1) & tin)
holder = tin & ~dilate(flame, 3) & ~((R > 200) & (B < 215) & (G < 235) & ~GREEN)
save('torchFlame', flame, extra={'baseX': float(tcx), 'baseY': float(centroid(flame)[1] + 30)})
save('torchHolder', holder)
oin = NONWHITE & disk(ocx, ocy, orr - 7)
olympic = []
cols = {
    'blue': oin & (B > R + 50) & (B > 120),
    'black': oin & (mx < 90),
    'red': oin & RED,
    'yellow': oin & (R > 170) & (G > 150) & (B < 120),
    'green': oin & (G > R + 30) & (G > B + 10),
}
manifest['olympic'] = []
for name, m in cols.items():
    m = dilate(m, 1) & oin
    if m.sum() < 30:
        continue
    ccx, ccy = centroid(m)
    save(f'oring_{name}', m, extra={'cx': ccx, 'cy': ccy})
    manifest['olympic'].append(f'oring_{name}')

# Lamp (diya) + flame
lamp_zone = box(488, 790, 690, 902)
lamp_all = NONWHITE & lamp_zone
lflame = lamp_all & (R > 190) & (B < 200) & (yy < 872) & ~DARK
lflame = fill_holes(dilate(lflame, 1) & lamp_all)
save('lampFlame', lflame, extra={'baseX': float(centroid(lflame)[0]), 'baseY': float(np.nonzero(lflame)[0].max())})
save('lamp', lamp_all & ~dilate(lflame, 3))

# RAJAMUDY letters
raj_zone = box(430, 1080, 740, 1138)
raj = NONWHITE & raj_zone & ~ribbon
raj_letters = sorted(components(raj, 25), key=lambda m: centroid(m)[0])
manifest['rajLetters'] = []
for i, m in enumerate(raj_letters):
    lx, ly = centroid(m)
    save(f'raj{i}', m, extra={'cx': lx, 'cy': ly})
    manifest['rajLetters'].append(f'raj{i}')
print('rajamudy letters', len(raj_letters))

# IDUKKI pill and the blue ornaments
pill_zone = box(450, 1150, 730, 1222)
pill = fill_holes(visible & (B > R + 40) & (R < 90) & (G < 60) & pill_zone) & pill_zone
pill = dilate(pill, 1) & NONWHITE & pill_zone | (fill_holes(pill) & pill_zone)
save('pill', pill, extra={'cx': float(centroid(pill)[0]), 'cy': float(centroid(pill)[1])})
orn_box = box(245, 1128, 940, 1232)
orn_zone = orn_box & ~dilate(pill, 3)
# pieces of the flourish are separate blobs; a blob running out of the zone
# is the shield border, tiny specks are compression noise
zone_edge = orn_box & ~erode(orn_box, 1)
orn = np.zeros_like(orn_zone)
for m in components(NONWHITE & orn_zone & ~ribbon, 14):
    if (m & zone_edge).any() or ((B[m] - R[m]) > 50).mean() < 0.3:
        continue
    orn |= m
save('ornL', orn & (xx < 590), extra={'anchorX': 452})
save('ornR', orn & (xx >= 590), extra={'anchorX': 728})

# ---------------------------------------------------------------------------
# Shield: silhouette without banner / ribbon, rebuilt border, white field
shield = img.copy()
shield[banner] = 0
remove = ribbon.copy()
shield[remove] = 0
sil = shield[..., 3] > 8
# rebuild the side borders where the ribbon crossed them
white_px = img[(mn > 240) & box(250, 300, 900, 700) & visible]
field = np.median(white_px[:, :3], axis=0).astype(np.uint8)
border_px = img[BORDER_BLUE & box(150, 300, 230, 800)]
border_col = np.median(border_px[:, :3], axis=0).astype(np.uint8)
manifest['colors'] = {'field': field.tolist(), 'border': border_col.tolist()}


def edges_row(y, side):
    """Outer and inner x of the shield's border band on row y (outermost run only)."""
    row = BORDER_BLUE[y] & (shield[y, :, 3] > 0)
    idx = np.nonzero(row)[0]
    if side == 'L':
        idx = idx[idx < W // 2]
        if len(idx) < 4:
            return None
        start = idx[0]
        end = start
        for v in idx[1:]:
            if v - end > 2:
                break
            end = v
        return (start, end) if end - start >= 6 else None
    idx = idx[idx >= W // 2][::-1]
    if len(idx) < 4:
        return None
    start = idx[0]
    end = start
    for v in idx[1:]:
        if end - v > 2:
            break
        end = v
    return (start, end) if start - end >= 6 else None


rib_d = dilate(ribbon, 6)
for side in ('L', 'R'):
    ref = [edges_row(y, side) for y in range(700, 880)]
    ref = [e for e in ref if e is not None]
    lo = min(min(e) for e in ref) - 8
    hi = max(max(e) for e in ref) + 8
    gap = [y for y in range(860, 1260) if rib_d[y, lo:hi + 1].any()]
    if not gap:
        continue
    ya, yb = min(gap) - 1, max(gap) + 1
    ea, eb = edges_row(ya, side), edges_row(yb, side)
    while ea is None and ya > 700:
        ya -= 1
        ea = edges_row(ya, side)
    while eb is None and yb < 1290:
        yb += 1
        eb = edges_row(yb, side)
    for y in range(ya + 1, yb):
        t = (y - ya) / (yb - ya)
        o = ea[0] + (eb[0] - ea[0]) * t
        i = ea[1] + (eb[1] - ea[1]) * t
        # clear whatever the ribbon removal left on this row near the border
        span = slice(int(min(o, i)) - 12, int(max(o, i)) + 13)
        cleared = shield[y, span]
        cleared[(cleared[..., 3] > 0) & ~((cleared[..., :3] == field).all(-1))] = 0
        x0, x1 = int(round(min(o, i))), int(round(max(o, i)))
        shield[y, x0:x1 + 1, :3] = border_col
        shield[y, x0:x1 + 1, 3] = 255
    print('rebuilt border', side, ya, yb, ea, eb)
# fill the whole shield interior row by row (between the two borders)
for y in range(140, H):
    row = (shield[y, :, 3] > 8) & BORDER_BLUE[y] | ((shield[y, :, :3] == border_col).all(-1) & (shield[y, :, 3] > 0))
    xs_ = np.nonzero(row)[0]
    if len(xs_) < 2:
        continue
    left_in = xs_[xs_ < W // 2]
    right_in = xs_[xs_ >= W // 2]
    if len(left_in) and len(right_in):
        a0, b0 = left_in.max(), right_in.min()
        seg = slice(a0 + 1, b0)
        interior = ~((shield[y, seg, 3] > 0) & (BORDER_BLUE[y, seg] | (shield[y, seg, :3] == border_col).all(-1)))
        s = shield[y, seg]
        s[interior, :3] = field
        s[interior, 3] = 255
# anything inside the silhouette that is not border becomes field white
# close the holes the ribbon removal punched into the field
sil_ = shield[..., 3] > 8
holes_ = fill_holes(sil_) & ~sil_
shield[holes_, :3] = field
shield[holes_, 3] = 255
n_, lab_, st_, _ = cv2.connectedComponentsWithStats((shield[..., 3] > 8).astype(np.uint8), 8)
main_ = 1 + int(np.argmax(st_[1:, cv2.CC_STAT_AREA]))
shield[lab_ != main_] = 0
dist = cv2.distanceTransform((shield[..., 3] > 8).astype(np.uint8), cv2.DIST_L2, 5)
deep = (dist > 26)
shield[deep, :3] = field
shield[deep, 3] = 255
save('shield', shield[..., 3] > 0, source=shield, feather=False, extra={'cx': W / 2, 'cy': 700})

# ---------------------------------------------------------------------------
# Globe texture: unproject the visible hemisphere to lon/lat
TW, TH = 1024, 512
tex = np.zeros((TH, TW, 3), np.uint8)
lat = (0.5 - (np.arange(TH) + 0.5) / TH) * math.pi
lon = ((np.arange(TW) + 0.5) / TW - 0.5) * 2 * math.pi
LON, LAT = np.meshgrid(lon, lat)
# visible hemisphere = lon in [-90, 90]; the back hemisphere mirrors it
lon_f = np.where(np.abs(LON) <= math.pi / 2, LON, np.sign(LON) * math.pi - LON)
px_ = gcx + gr * np.cos(LAT) * np.sin(lon_f)
py_ = gcy - gr * np.sin(LAT)
src = np.ascontiguousarray(img[..., :3])
tex = cv2.remap(src, px_.astype(np.float32), py_.astype(np.float32), cv2.INTER_LINEAR)
# remove the baked gold wire grid (thin gold lines) by inpainting, keep continents
hsv = cv2.cvtColor(tex, cv2.COLOR_RGB2HSV)
gold = ((hsv[..., 0] > 8) & (hsv[..., 0] < 30) & (hsv[..., 1] > 70) & (hsv[..., 2] > 120)).astype(np.uint8)
thick_blobs = cv2.morphologyEx(gold, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
lines = (gold > 0) & ~(thick_blobs > 0)
tex_clean = cv2.inpaint(tex, (dilate(lines, 1) * 255).astype(np.uint8), 4, cv2.INPAINT_TELEA)
# fade the stretched limb band towards ocean
ocean = np.array([214, 228, 238], np.uint8)
limb = np.clip((np.abs(lon_f) - math.radians(62)) / math.radians(24), 0, 1)[..., None]
tex_out = (tex_clean * (1 - limb * 0.85) + ocean * (limb * 0.85)).astype(np.uint8)
Image.fromarray(tex_out).save(os.path.join(OUT, 'globe_tex.jpg'), quality=92)
manifest['globeTexture'] = {'file': 'globe_tex.jpg', 'w': TW, 'h': TH}

with open(os.path.join(OUT, 'manifest.json'), 'w') as f:
    json.dump(manifest, f, indent=1)
print('layers', len(manifest['layers']))
