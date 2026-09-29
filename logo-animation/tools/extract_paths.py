"""Vector paths traced from the crest layers, for line-drawing animation.

Writes assets/layers/paths.json:
  shieldLeft / shieldRight: the centre line of the shield's blue border, split
  at the top centre into two halves that both end at the bottom tip, so the
  outline can be drawn symmetrically.
  borderWidth: width of the border in logo px.
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LAYERS = ROOT / 'assets' / 'layers'


def main():
    m = json.loads((LAYERS / 'manifest.json').read_text())
    L = m['layers']['shield']
    a = np.array(Image.open(LAYERS / 'shield.png'))[..., 3] > 128
    d = cv2.distanceTransform(np.pad(a, 4).astype(np.uint8), cv2.DIST_L2, 5)[4:-4, 4:-4]
    rgb = np.array(Image.open(LAYERS / 'shield.png'))[..., :3].astype(int)
    blue = a & (rgb[..., 2] > 110) & (rgb[..., 0] < 90) & (rgb[..., 2] - rgb[..., 1] > 40)
    inner = blue & (d > 4)
    width = float(np.median(d[inner & ~cv2.erode(blue.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)]))
    centre = (d > width / 2).astype(np.uint8)
    cs, _ = cv2.findContours(centre, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)[:, 0, :].astype(float)
    c[:, 0] += L['x']
    c[:, 1] += L['y']
    # smooth the pixel staircase, keep corners reasonably sharp
    k = 5
    pad = np.concatenate([c[-k:], c, c[:k]])
    ker = np.ones(2 * k + 1) / (2 * k + 1)
    c = np.stack([np.convolve(pad[:, 0], ker, 'valid'), np.convolve(pad[:, 1], ker, 'valid')], 1)
    cx = L['cx']
    top = int(np.argmin(np.abs(c[:, 0] - cx) + (c[:, 1] > c[:, 1].min() + 200) * 1e6))
    bottom = int(np.argmax(c[:, 1]))
    n = len(c)
    walk = lambda i0, i1, step: [c[i % n] for i in range(i0, i1 + (n if step > 0 and i1 < i0 else 0) + step, step)] if step > 0 else None
    fwd = [c[(top + i) % n] for i in range((bottom - top) % n + 1)]
    bwd = [c[(top - i) % n] for i in range((top - bottom) % n + 1)]
    left, right = (fwd, bwd) if np.mean([p[0] for p in fwd]) < cx else (bwd, fwd)
    simp = lambda pts: cv2.approxPolyDP(np.array(pts, np.float32)[:, None, :], 0.6, False)[:, 0, :].round(1).tolist()
    out = {'borderWidth': round(width, 1), 'shieldLeft': simp(left), 'shieldRight': simp(right)}
    (LAYERS / 'paths.json').write_text(json.dumps(out))
    print('border width', width, 'points', len(out['shieldLeft']), len(out['shieldRight']))
    del walk


if __name__ == '__main__':
    main()
