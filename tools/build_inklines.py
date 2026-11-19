"""Brush sheets in web/assets/inklines/ (painted by Muse / Gemini / GPT for Yang) -> pieces in web/assets/strokes/, ink as
alpha, plus strokes.json {key: [{f, w, h, tone}]}.
  <Source>.png    8 long level strokes: the ridge line                       key <source>
  <Source> A.png  10 long thin dry strokes: hemp-fibre texture strokes       key <source>_a
  <Source> B.png  short axe-cut strokes and clusters of moss dots            keys <source>_b (strokes), <source>_d (dots)
  <Source> C.png  6 level bands of wash, dark upper edge, thinning downward  key <source>_c
  <Source> D.png  5 level bands of grey wash, mist eating in from below      key <source>_m  (masks, not ink)
  <Source> E.png  3 x 2 grey patches, a bank of mist drifted into each       key <source>_e  (masks, not ink)
  <Source> F.png  8 long level river banks, waterline on top                 key <source>_f
  <Source> G.png  10 hair-thin level lines of current                        key <source>_g
  <Source> H.png  riverside rocks and short ripples, scattered               keys <source>_k (rocks), <source>_r (ripples)
  <Source> I.png  long level lake shores, waterline on top, dark then pale   key <source>_i
  <Source> J.png  rows of level dashes of still water                        key <source>_j
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


def level(key, ink, see, edge, keep, ext='png', grow=(5, 41), gain=0):
    """long level strokes / bands: see = ink level that counts when finding them, edge = level of the upper edge,
    keep = level under which the margins are cropped"""
    mask = ndi.binary_dilation(ink > see, structure=np.ones(grow))   # grow: what still belongs to a stroke (a bank's flicks and pebbles hang loose under it)
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
        b = b[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]
        if gain: b = np.clip(b * gain / max(1e-6, float(np.percentile(b[b > keep], 95))), 0, 1)   # pale hairlines brought up to a common strength
        save(key, k, b, ext)


def loose(key, ink, thr=0.3, crop=0.15, long='_b', comp='_d', gain=0, minh=25):
    """short strokes and dot clusters, scattered: told apart by shape (a stroke is long and low)"""
    u = ink.shape[1] / 2048
    mask = ndi.binary_dilation(ink > thr, structure=np.ones((int(17 * u) | 1, int(23 * u) | 1)))
    lab, n = ndi.label(mask)
    ka = kd = 0
    for i, s in enumerate(ndi.find_objects(lab)):
        hh, ww = s[0].stop - s[0].start, s[1].stop - s[1].start
        if ww < 40 * u or hh < minh * u: continue
        a = np.where(lab[s] == i + 1, ink[s], 0)
        rows = np.nonzero(a.max(axis=1) > crop)[0]; cols = np.nonzero(a.max(axis=0) > crop)[0]
        if not len(rows) or not len(cols): continue
        a = a[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]
        if a.shape[1] > 1.9 * a.shape[0]: save(key + long, ka, np.clip(a * gain / max(1e-6, float(a.max())), 0, 1) if gain else a); ka += 1
        else: save(key + comp, kd, a); kd += 1


# -- mist (sheets D and E): not ink to lay down but a mask. A flat grey wash that mist has eaten into: grey = the ink
#    of the mountain stays, white = mist. Saved as the others (grey in alpha, 1 = ink stays), read as numbers by paint.js
SKIP = {'muse_m': {0, 1}, 'muse_e': 'all'}   # Muse's came out as Western watercolour blooms (crinkled cauliflower rims), not mist


def runs(on):
    idx = np.nonzero(on)[0]
    if not len(idx): return []
    cut = np.nonzero(np.diff(idx) > 1)[0]
    return list(zip(np.r_[idx[0], idx[cut + 1]], np.r_[idx[cut], idx[-1]] + 1))


def shrink(a, wide):
    h, w = a.shape
    return np.asarray(Image.fromarray(np.round(a * 255).astype(np.uint8)).resize((wide, max(8, round(h * wide / w))), Image.LANCZOS), np.float32) / 255


def mist_bands(key, d):
    """sheet D: level bands, flat grey above, mist below; the rolling line between them is the top of a sea of mist.
    'b' in the manifest: the mean row of that line (the level the game lays on its own sea level)"""
    H, W = d.shape; x0, x1 = int(0.06 * W), int(0.94 * W)   # the ends of a band taper or pool: cut off
    r = ndi.uniform_filter1d(d[:, x0:x1].mean(axis=1), 9)
    rr = [(a, b) for a, b in runs(r > 0.35 * r.max()) if b - a > 0.03 * H]
    k = 0
    for i, (a, b) in enumerate(rr):
        end = rr[i + 1][0] - int(0.012 * H) if i + 1 < len(rr) else H
        if i in SKIP.get(key, ()): continue
        top = a + int(0.012 * H)
        g = float(np.median(d[top:top + max(4, int(0.3 * (b - a))), x0:x1]))   # the flat grey of this band = ink 1
        ink = np.clip((d[top:end, x0:x1] - 0.06 * g) / (0.84 * g), 0, 1)
        h = ink.shape[0]; y = np.arange(h)[:, None]
        ink = np.maximum(ink, np.clip(1 - y / (0.06 * h), 0, 1)) * np.clip((h - 1 - y) / (0.12 * h), 0, 1)   # all ink along the top, all mist along the bottom: no seam where the band ends
        ink = shrink(ink, 1400)
        save(key, k, ink, 'webp'); man[key][-1]['b'] = round(float(ink.sum(axis=0).mean()), 1); k += 1


def mist_patches(key, d):
    """sheet E: a grid of grey patches, a bank of mist drifted into each. 'side': the side it came in by (l r t b),
    'c': where along that side (0..1)"""
    if SKIP.get(key) == 'all': return
    H, W = d.shape; lim = 0.12 * np.percentile(d, 90)
    cs = [(a, b) for a, b in runs(ndi.uniform_filter1d(d.mean(axis=0), 9) > lim) if b - a > 0.1 * W]
    rs = [(a, b) for a, b in runs(ndi.uniform_filter1d(d.mean(axis=1), 9) > lim) if b - a > 0.1 * H]
    k = 0
    for ra, rb in rs:
        for ca, cb in cs:
            a = d[ra:rb, ca:cb]; ih, iw = int(0.04 * a.shape[0]), int(0.04 * a.shape[1]); a = a[ih:-ih, iw:-iw]
            g = float(np.percentile(a, 80))
            ink = np.clip((a - 0.06 * g) / (0.84 * g), 0, 1); m = 1 - ink; h, w = m.shape; sh, sw = int(0.08 * h), int(0.08 * w)
            strips = {'l': m[:, :sw].mean(axis=1), 'r': m[:, -sw:].mean(axis=1), 't': m[:sh].mean(axis=0), 'b': m[-sh:].mean(axis=0)}
            side = max(strips, key=lambda s: strips[s].mean()); st = strips[side]
            c = float((st * np.arange(len(st))).sum() / max(1e-6, st.sum()) / len(st))
            save(key, k, shrink(ink, 360), 'webp'); man[key][-1].update(side=side if st.mean() > 0.12 else '', c=round(c, 3)); k += 1


for name in sorted(os.listdir(SRC)):
    if not name.lower().endswith('.png'): continue
    stem = os.path.splitext(name)[0].lower().split()
    src, kind = stem[0], (stem[1] if len(stem) > 1 else '')
    L = np.asarray(Image.open(os.path.join(SRC, name)).convert('L'), dtype=np.float32)
    if kind in ('d', 'e'):
        dark = np.clip(float(np.percentile(L, 97)) - L, 0, None)
        (mist_bands if kind == 'd' else mist_patches)(src + ('_m' if kind == 'd' else '_e'), dark)
        print(name, L.shape[::-1]); continue
    bg = float(np.percentile(L, 75 if kind != 'c' else 97))      # the paper (Gemini's is off-white with shading)
    bgmap = ndi.gaussian_filter(ndi.maximum_filter(L, size=61 if kind != 'c' else 301), 40)   # its slow shading, taken off
    ink = np.clip((np.minimum(bgmap, bg + 20) - 10 - L) / (bg - 40), 0, 1)
    if kind == '': level(src, ink, 0.3, 0.35, 0.2)
    elif kind == 'a': level(src + '_a', ink, 0.3, 0.35, 0.2)
    elif kind == 'c': level(src + '_c', ink, 0.1, 0.3, 0.05, 'webp')
    elif kind == 'f': level(src + '_f', ink, 0.3, 0.35, 0.12, grow=(27, 41))            # river banks: upper edge = the waterline
    elif kind == 'g': level(src + '_g', ink, 0.12, 0.12, 0.05, grow=(5, 121), gain=0.9)   # lines of current, hair-thin and pale
    elif kind == 'h': loose(src, ink, thr=0.1, crop=0.05, long='_r', comp='_k', gain=0.9)   # ripples (long, low) and riverside rocks
    elif kind == 'i': level(src + '_i', ink, 0.1, 0.12, 0.05, grow=(15, 41))               # lake shores: dark near ones, pale far ones (told apart by tone)
    elif kind == 'j': loose(src, ink, thr=0.1, crop=0.05, long='_j', comp='_jx', gain=0.9, minh=0)   # still water: single level dashes, pointed at both ends
    elif kind == 'b': loose(src, ink)
    print(name, L.shape[::-1], 'paper', round(bg))
for k in man: print(k, len(man[k]), [(p['w'], p['h'], p['tone']) for p in man[k]][:10])
json.dump(man, open(os.path.join(OUT, 'strokes.json'), 'w'), indent=1)
