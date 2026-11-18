"""Brush sheets in web/assets/inklines/ (painted by Muse / Gemini / GPT for Yang) -> pieces in web/assets/strokes/, ink as
alpha, plus strokes.json {key: [{f, w, h, tone}]}.
  <Source>.png    8 long level strokes: the ridge line                       key <source>
  <Source> A.png  10 long thin dry strokes: hemp-fibre texture strokes       key <source>_a
  <Source> B.png  short axe-cut strokes and clusters of moss dots            keys <source>_b (strokes), <source>_d (dots)
  <Source> C.png  6 level bands of wash, dark upper edge, thinning downward  key <source>_c
Level strokes and bands are straightened: every column is slid up so the upper edge is level (they arc a little; bent
along a ridge, the upper edge is the ridge line). usage: python tools/build_inklines.py"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, 'web', 'assets', 'inklines'), os.path.join(ROOT, 'web', 'assets', 'strokes')
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
man = {}


def save(key, k, b, ext='png'):
    rgba = np.zeros(b.shape + (4,), np.uint8); rgba[..., 0] = 18; rgba[..., 1] = 18; rgba[..., 2] = 24; rgba[..., 3] = np.round(b * 255)
    fn = f'{key}-{k + 1}.{ext}'
    im = Image.fromarray(rgba)
    if ext == 'webp': im.save(os.path.join(OUT, fn), quality=88, method=6)
    else: im.save(os.path.join(OUT, fn), optimize=True)
    man.setdefault(key, []).append({'f': fn, 'w': int(b.shape[1]), 'h': int(b.shape[0]), 'tone': round(float(b.mean()), 3)})


def level(key, ink, see, edge, keep, ext='png'):
    """long level strokes / bands: see = ink level that counts when finding them, edge = level of the upper edge,
    keep = level under which the margins are cropped"""
    mask = ndi.binary_dilation(ink > see, structure=np.ones((5, 41)))
    lab, n = ndi.label(mask)
    boxes = [(i + 1, s) for i, s in enumerate(ndi.find_objects(lab)) if s[1].stop - s[1].start > 0.4 * ink.shape[1]]
    boxes.sort(key=lambda b: b[1][0].start)
    for k, (li, s) in enumerate(boxes):
        a = np.where(lab[s] == li, ink[s], 0)
        h, w = a.shape
        top = np.full(w, np.nan)
        for x in range(w):
            ys = np.nonzero(a[:, x] > edge)[0]
            if len(ys): top[x] = ys[0]
        ok = ~np.isnan(top); xs = np.arange(w)
        top = np.interp(xs, xs[ok], top[ok])
        top = ndi.gaussian_filter1d(ndi.median_filter(top, size=121, mode='nearest'), 30, mode='nearest')
        sh = np.round(top - top.min()).astype(int)
        b = np.zeros_like(a)
        for x in range(w): b[:h - sh[x], x] = a[sh[x]:, x]
        rows = np.nonzero(b.max(axis=1) > keep)[0]; cols = np.nonzero(b.max(axis=0) > keep)[0]
        save(key, k, b[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1], ext)


def loose(key, ink):
    """short strokes and dot clusters, scattered: told apart by shape (a stroke is long and low)"""
    u = ink.shape[1] / 2048
    mask = ndi.binary_dilation(ink > 0.3, structure=np.ones((int(17 * u) | 1, int(23 * u) | 1)))
    lab, n = ndi.label(mask)
    ka = kd = 0
    for i, s in enumerate(ndi.find_objects(lab)):
        hh, ww = s[0].stop - s[0].start, s[1].stop - s[1].start
        if ww < 40 * u or hh < 25 * u: continue
        a = np.where(lab[s] == i + 1, ink[s], 0)
        rows = np.nonzero(a.max(axis=1) > 0.15)[0]; cols = np.nonzero(a.max(axis=0) > 0.15)[0]
        a = a[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]
        if a.shape[1] > 1.9 * a.shape[0]: save(key + '_b', ka, a); ka += 1
        else: save(key + '_d', kd, a); kd += 1


for name in sorted(os.listdir(SRC)):
    if not name.lower().endswith('.png'): continue
    stem = os.path.splitext(name)[0].lower().split()
    src, kind = stem[0], (stem[1] if len(stem) > 1 else '')
    L = np.asarray(Image.open(os.path.join(SRC, name)).convert('L'), dtype=np.float32)
    bg = float(np.percentile(L, 75 if kind != 'c' else 97))      # the paper (Gemini's is off-white with shading)
    bgmap = ndi.gaussian_filter(ndi.maximum_filter(L, size=61 if kind != 'c' else 301), 40)   # its slow shading, taken off
    ink = np.clip((np.minimum(bgmap, bg + 20) - 10 - L) / (bg - 40), 0, 1)
    if kind == '': level(src, ink, 0.3, 0.35, 0.2)
    elif kind == 'a': level(src + '_a', ink, 0.3, 0.35, 0.2)
    elif kind == 'c': level(src + '_c', ink, 0.1, 0.3, 0.05, 'webp')
    elif kind == 'b': loose(src, ink)
    print(name, L.shape[::-1], 'paper', round(bg))
for k in man: print(k, len(man[k]), [(p['w'], p['h'], p['tone']) for p in man[k]][:10])
json.dump(man, open(os.path.join(OUT, 'strokes.json'), 'w'), indent=1)
