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
  <Source> K.png  clumps of reeds, and a row of low shore rocks              keys <source>_w (reeds), <source>_s (rocks)
  <Source> L.png  a row of leaping fish, a row of splash rings                keys <source>_x (fish), <source>_o (rings)
  <Source> M.png  6 long level tree trunks (root left, tip right), under them    keys <source>_t (trunks, 'c' = the row of the
                  two rows of short branches (base left, tip up and right)       trunk's middle), <source>_y (branches, 'by' 'ty' = base / tip row)
  <Source> N.png  rows of foliage: pine needle fans, pine boughs, leaf dots     keys <source>_n, <source>_p, <source>_q
  <Source> O.png  rows of grass: tufts, low patches, small plants               keys <source>_u, <source>_v, <source>_z
Level strokes and bands are straightened: every column is slid up so the upper edge is level (they arc a little; bent
along a ridge, the upper edge is the ridge line). usage: python tools/build_inklines.py"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, 'web', 'assets', 'inklines'), os.path.join(ROOT, 'web', 'assets', 'strokes')
os.makedirs(OUT, exist_ok=True)
ONLY = os.environ.get('ONLY')   # ONLY=l: recut that one kind of sheet, the rest kept as they are (the whole run takes minutes)
if not ONLY:
    for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
man = json.load(open(os.path.join(OUT, 'strokes.json'))) if ONLY else {}


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


def tufts(key, ink, thr=0.1, crop=0.05):
    """sheet K: clumps of reeds in the upper rows, low shore rocks in the bottom row, each standing on its own stroke of
    ground (the bottom of a piece = the ground). Told apart by where they stand on the sheet"""
    u = ink.shape[1] / 2048
    lab, n = ndi.label(ndi.binary_dilation(ink > thr, structure=np.ones((int(31 * u) | 1, int(13 * u) | 1))))
    kw = ks = 0
    for i, s in sorted(enumerate(ndi.find_objects(lab)), key=lambda t: (t[1][0].start // int(200 * u), t[1][1].start)):
        if s[1].stop - s[1].start < 60 * u or s[0].stop - s[0].start < 40 * u: continue
        a = np.where(lab[s] == i + 1, ink[s], 0)
        rows = np.nonzero(a.max(axis=1) > crop)[0]; cols = np.nonzero(a.max(axis=0) > crop)[0]
        a = a[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]
        if (s[0].start + s[0].stop) / 2 > 0.72 * ink.shape[0]: save(key + '_s', ks, a); ks += 1
        else: save(key + '_w', kw, a); kw += 1


def fish(key, ink, thr=0.1):
    """sheet L: a row of leaping fish (head up and to the right), under it a row of splash rings with droplets over
    them. Rows found as bands of ink, pieces as runs of columns in a band. Of the lower rows only the last band is kept:
    the rings, without their droplets when those stand clear"""
    u = ink.shape[1] / 2048; on = ink > thr
    bands = [(a, b) for a, b in runs(on.any(axis=1)) if b - a > 20 * u]
    top = max(bands, key=lambda r: r[1] - r[0]); low = bands[-1]
    for (a, b), suf in ((top, '_x'), (low, '_o')):
        man.pop(key + suf, None); k = 0
        if suf == '_x':   # the fish overlap as columns (a tail under the next one's head): told apart as connected ink
            lab, n = ndi.label(ndi.binary_dilation(on[a:b], structure=np.ones((int(13 * u) | 1, int(13 * u) | 1))))
            for i, s in sorted(enumerate(ndi.find_objects(lab)), key=lambda t: t[1][1].start):
                if s[1].stop - s[1].start < 60 * u: continue
                q = np.where(lab[s] == i + 1, ink[a:b][s], 0); rows = np.nonzero(q.max(axis=1) > thr)[0]; cols = np.nonzero(q.max(axis=0) > thr)[0]
                save(key + suf, k, q[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]); k += 1
            continue
        for ca, cb in runs(ndi.binary_dilation(on[a:b].any(axis=0), structure=np.ones(int(9 * u) | 1))):
            if cb - ca < 60 * u: continue
            p = np.where(on[a:b, ca:cb].any(axis=1))[0]; q = ink[a + p[0]:a + p[-1] + 1, ca:cb]
            cols = np.nonzero(q.max(axis=0) > thr)[0]; save(key + suf, k, q[:, cols[0]:cols[-1] + 1]); k += 1


def trunks(key, ink, thr=0.12, sufs=('_t', '_y'), ylow=0.6):
    """sheet M: long trunks lying level, root at the left; straightened by their middle line (the ink's centre of weight
    per column, smoothed), which is laid on the stroke. Under them short branches, each cut whole: 'by' / 'ty' = the
    row of its base (left end) and of its tip (right end), as parts of its height"""
    u = ink.shape[1] / 2048; H, W = ink.shape; on = ink > thr
    T_, Y_ = key + sufs[0], key + sufs[1]   # sheet P is cut the same way: close branches (_bt) and twigs (_bw)
    for kk in (T_, Y_): man.pop(kk, None)
    lab, n = ndi.label(ndi.binary_dilation(on, structure=np.ones((int(5 * u) | 1, int(41 * u) | 1))))
    k = 0
    for i, s in sorted(enumerate(ndi.find_objects(lab)), key=lambda t: t[1][0].start):
        if s[1].stop - s[1].start < 0.4 * W: continue
        a = np.where(lab[s] == i + 1, ink[s], 0); h, w = a.shape; ys = np.arange(h)[:, None]
        m = a.sum(axis=0); ok = m > 0.5; xs = np.arange(w); cen = np.interp(xs, xs[ok], ((a * ys).sum(axis=0)[ok] / m[ok]))
        cen = ndi.gaussian_filter1d(ndi.median_filter(cen, size=int(121 * u) | 1, mode='nearest'), 30 * u, mode='nearest')
        padv = int(np.ceil(cen.max() - cen.min())) + 1; b = np.zeros((h + 2 * padv, w), np.float32); c0 = padv + int(round(cen.mean()))
        for x in range(w): sh = c0 - int(round(cen[x])); b[sh:sh + h, x] = a[:, x]
        rows = np.nonzero(b.max(axis=1) > thr)[0]; cols = np.nonzero(b.max(axis=0) > thr)[0]
        b = b[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]; save(T_, k, b); man[T_][-1]['c'] = round((c0 - rows[0]) / b.shape[0], 3); k += 1
    lab, n = ndi.label(ndi.binary_dilation(on, structure=np.ones((int(9 * u) | 1, int(15 * u) | 1))))
    k = 0
    for i, s in sorted(enumerate(ndi.find_objects(lab)), key=lambda t: (t[1][0].start // int(120 * u), t[1][1].start)):
        ww = s[1].stop - s[1].start
        if ww < 100 * u or ww > 0.4 * W or (s[0].start + s[0].stop) / 2 < ylow * H: continue
        a = np.where(lab[s] == i + 1, ink[s], 0); rows = np.nonzero(a.max(axis=1) > thr)[0]; cols = np.nonzero(a.max(axis=0) > thr)[0]
        a = a[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]; h, w = a.shape; e = max(2, w // 10); ys = np.arange(h)[:, None]
        cy = lambda q: float((q * ys).sum() / max(1e-6, q.sum()) / h)
        save(Y_, k, a); man[Y_][-1].update(by=round(cy(a[:, :e]), 3), ty=round(cy(a[:, -e:]), 3)); k += 1


def rowsheet(key, ink, sufs, thr=0.1, gap=9, blob=None):
    """a sheet of rows of separate pieces (N: foliage, O: grass), one kind a row: rows found as bands of ink, pieces as
    runs of columns in a band (gap: what still joins two columns into one piece).
    blob (a width for every row): pieces found instead as islands of ink, grown by that much to hold an island of
    separate dabs together. For rows whose pieces reach over or under each other (long pine needles) and so share
    columns; a piece is then cut out by its own island, without its neighbour's ends"""
    u = ink.shape[1] / 2048; on = ink > thr
    bands = [(a, b) for a, b in runs(ndi.binary_dilation(on.any(axis=1), structure=np.ones(int(25 * u) | 1))) if b - a > 40 * u]
    for j, ((a, b), suf) in enumerate(zip(bands, sufs)):
        man.pop(key + suf, None); k = 0
        if blob:
            d = int(blob[j] * u) | 1; lab, _ = ndi.label(ndi.binary_dilation(on[a:b], structure=np.ones((d, d))))
            cut = [(sl, i + 1) for i, sl in enumerate(ndi.find_objects(lab)) if max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start) >= 40 * u + d]
            pcs = [ink[a:b][sl] * (lab[sl] == i) for sl, i in sorted(cut, key=lambda c: c[0][1].start)]
        else: pcs = [ink[a:b, ca:cb] for ca, cb in runs(ndi.binary_dilation(on[a:b].any(axis=0), structure=np.ones(int(gap * u) | 1))) if cb - ca >= 40 * u]
        for i, q in enumerate(pcs):
            if i in DROP.get(key + suf, ()): continue
            rows = np.nonzero(q.max(axis=1) > thr)[0]; cols = np.nonzero(q.max(axis=0) > thr)[0]
            save(key + suf, k, q[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]); k += 1
    print(' rows', len(bands), 'of', len(sufs))


def flowers(key, path, sufs=('_fl', '_bd', '_pt')):
    """sheet Q, the one sheet in colour: rows of plum blossoms, of buds on their calyx, of loose petals. A piece keeps
    its colours: alpha = how far a pixel is from the white of the paper, its colour what gives the painted pixel back
    when laid over white. Pieces = islands of paint in a row; the drips of black dots under the buds are islands of
    their own, too small to be kept"""
    A = np.asarray(Image.open(path).convert('RGB'), dtype=np.float32); bg = np.percentile(A.reshape(-1, 3), 75, axis=0)
    al = np.clip((1 - (A / bg).min(axis=2)) * 1.6, 0, 1); col = np.clip((A - (1 - al[..., None]) * bg) / np.maximum(al[..., None], 0.02), 0, 255)
    u = A.shape[1] / 2048; on = al > 0.08; d = int(7 * u) | 1
    bands = [(a, b) for a, b in runs(ndi.binary_dilation(on.any(axis=1), structure=np.ones(int(25 * u) | 1))) if b - a > 40 * u]
    for (a, b), suf in zip(bands, sufs):
        man.pop(key + suf, None); lab, _ = ndi.label(ndi.binary_dilation(on[a:b], structure=np.ones((d, d))))
        cut = sorted(((sl, i + 1) for i, sl in enumerate(ndi.find_objects(lab)) if max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start) >= 45 * u + d), key=lambda c: c[0][1].start)
        for k, (sl, i) in enumerate(cut):
            m = al[a:b][sl] * (lab[sl] == i); rows = np.nonzero(m.max(axis=1) > 0.08)[0]; cols = np.nonzero(m.max(axis=0) > 0.08)[0]
            box = (slice(rows[0], rows[-1] + 1), slice(cols[0], cols[-1] + 1)); m = m[box]
            rgba = np.dstack([col[a:b][sl][box], np.round(m * 255)]).astype(np.uint8); fn = f'{key}{suf}-{k + 1}.png'
            Image.fromarray(rgba).save(os.path.join(OUT, fn), optimize=True)
            man.setdefault(key + suf, []).append({'f': fn, 'w': int(m.shape[1]), 'h': int(m.shape[0]), 'tone': round(float(m.mean()), 3)})
    print(' rows', len(bands), 'of', len(sufs))


# pieces of a row sheet left out, counted from the left. Muse N (v4): of its boughs the 5th and 6th came out as peaked
# thatch roofs, the 7th as two smears one over the other with stray fans beside them
DROP = {'muse_p': set(range(4, 16))}


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
    if ONLY and kind != ONLY: continue
    if kind == 'q': flowers(src, os.path.join(SRC, name)); print(name); continue
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
    elif kind == 'k': tufts(src, ink)
    elif kind == 'l': fish(src, ink)
    elif kind == 'm': trunks(src, ink)
    elif kind == 'p': trunks(src, ink, sufs=('_bt', '_bw'), ylow=0.72)   # close branches of an old plum tree, and its twigs (base left)
    elif kind == 'n': rowsheet(src, ink, ('_n', '_p', '_q'), blob=(5, 3, 15))      # pine needle fans (they stand close), pine boughs, clusters of leaf dots (loose dabs: held together by a wide blob)
    elif kind == 'o': rowsheet(src, ink, ('_u', '_v', '_z'), gap=15)     # grass tufts, low patches of grass, small plants: the bottom of a piece = the ground
    elif kind == 'b': loose(src, ink)
    print(name, L.shape[::-1], 'paper', round(bg))
for k in man: print(k, len(man[k]), [(p['w'], p['h'], p['tone']) for p in man[k]][:10])
json.dump(man, open(os.path.join(OUT, 'strokes.json'), 'w'), indent=1)
