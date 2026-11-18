"""Brush-stroke sheets (web/assets/inklines/<Source>.png: 8 long level strokes each, from Muse / Gemini / GPT) -> one
piece per stroke in web/assets/strokes/, ink as alpha, plus strokes.json {source: [{f, w, h}]}.
Each stroke is straightened: every column is slid up so the stroke's upper edge is level (the sheets' strokes arc a
little; bent along a ridge, the upper edge is the ridge line). usage: python tools/build_inklines.py"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, 'web', 'assets', 'inklines'), os.path.join(ROOT, 'web', 'assets', 'strokes')
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
man = {}
for name in sorted(os.listdir(SRC)):
    if not name.lower().endswith('.png'): continue
    src = os.path.splitext(name)[0].lower()
    L = np.asarray(Image.open(os.path.join(SRC, name)).convert('L'), dtype=np.float32)
    bg = float(np.percentile(L, 75))                        # the paper (Gemini's is off-white with shading)
    bgmap = ndi.gaussian_filter(ndi.maximum_filter(L, size=61), 40)   # its slow shading, taken off
    ink = np.clip((np.minimum(bgmap, bg + 20) - 10 - L) / (bg - 40), 0, 1)
    mask = ndi.binary_dilation(ink > 0.3, structure=np.ones((5, 41)))
    lab, n = ndi.label(mask)
    boxes = [(i + 1, s) for i, s in enumerate(ndi.find_objects(lab)) if s[1].stop - s[1].start > 0.4 * L.shape[1]]
    boxes.sort(key=lambda b: b[1][0].start)
    man[src] = []
    for k, (li, s) in enumerate(boxes):
        a = np.where(lab[s] == li, ink[s], 0)
        h, w = a.shape
        top = np.full(w, np.nan)
        for x in range(w):
            ys = np.nonzero(a[:, x] > 0.35)[0]
            if len(ys): top[x] = ys[0]
        ok = ~np.isnan(top); xs = np.arange(w)
        top = np.interp(xs, xs[ok], top[ok])
        top = ndi.gaussian_filter1d(ndi.median_filter(top, size=121, mode='nearest'), 30, mode='nearest')
        sh = np.round(top - top.min()).astype(int)
        b = np.zeros_like(a)
        for x in range(w): b[:h - sh[x], x] = a[sh[x]:, x]
        rows = np.nonzero(b.max(axis=1) > 0.2)[0]; cols = np.nonzero(b.max(axis=0) > 0.2)[0]
        b = b[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]
        # where the ink sits across the stroke (0 = upper edge): the ridge line is laid at the dark upper edge
        rgba = np.zeros(b.shape + (4,), np.uint8); rgba[..., 0] = 18; rgba[..., 1] = 18; rgba[..., 2] = 24; rgba[..., 3] = np.round(b * 255)
        fn = f'{src}-{k + 1}.png'; Image.fromarray(rgba).save(os.path.join(OUT, fn), optimize=True)
        man[src].append({'f': fn, 'w': int(b.shape[1]), 'h': int(b.shape[0]), 'tone': round(float(b.mean()), 3)})
    print(src, L.shape[::-1], 'paper', round(bg), 'strokes', len(boxes), [(p['w'], p['h'], p['tone']) for p in man[src]])
json.dump(man, open(os.path.join(OUT, 'strokes.json'), 'w'), indent=1)
