"""Cut a part sheet (separate ink pieces on white) into its pieces.

usage: python tools/split_sheet.py <sheet.png> [--out DIR] [--gap PX] [--min FRAC]
  Finds the pieces as connected blobs of ink. --gap: ink closer than this (px at full size) counts as one piece
  (default 1.2% of the long side), --min: blobs smaller than this fraction of the sheet are dropped as specks.
  Prints one line per piece (box, share of the sheet) and writes <sheet>-boxes.jpg next to the sheet.
  With --out, saves each piece as DIR/<name>-NN.webp, cropped with a white margin, ink of other pieces wiped.
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi


def pieces(im, gap=None, min_frac=0.002):
    a = np.asarray(im.convert("L")).astype(np.int16)
    h, w = a.shape
    ink = (255 - a) > 28
    gap = gap or max(3, int(0.012 * max(w, h)))
    lab, n = ndi.label(ndi.binary_dilation(ink, iterations=gap // 2))
    out = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        m = (lab[sl] == i) & ink[sl]
        if m.sum() < min_frac * w * h:
            continue
        ys, xs = np.nonzero(m)
        y0, x0 = sl[0].start + ys.min(), sl[1].start + xs.min()
        y1, x1 = sl[0].start + ys.max() + 1, sl[1].start + xs.max() + 1
        out.append({"id": i, "box": (x0, y0, x1, y1), "ink": int(m.sum()),
                    "edge": x0 <= 1 or y0 <= 1 or x1 >= w - 1 or y1 >= h - 1})
    out.sort(key=lambda p: (round(p["box"][1] / (h / 4)), p["box"][0]))   # reading order, rows of a quarter sheet
    return lab, out


def main():
    a = sys.argv[1:]
    out = gap = None; mn = 0.002
    if "--out" in a: i = a.index("--out"); out = a[i + 1]; del a[i:i + 2]
    if "--gap" in a: i = a.index("--gap"); gap = int(a[i + 1]); del a[i:i + 2]
    if "--min" in a: i = a.index("--min"); mn = float(a[i + 1]); del a[i:i + 2]
    path = a[0]; im = Image.open(path).convert("RGB"); w, h = im.size
    lab, ps = pieces(im, gap, mn)
    name = os.path.splitext(os.path.basename(path))[0]
    print("%s %dx%d: %d pieces" % (name, w, h, len(ps)))
    pv = im.copy(); d = ImageDraw.Draw(pv)
    for k, p in enumerate(ps, 1):
        x0, y0, x1, y1 = p["box"]
        print("  %2d box=%4d,%4d %4dx%-4d ink=%.1f%%%s" % (k, x0, y0, x1 - x0, y1 - y0, 100 * p["ink"] / (w * h), "  TOUCHES EDGE" if p["edge"] else ""))
        d.rectangle([x0, y0, x1, y1], outline=(220, 30, 30), width=4); d.text((x0 + 8, y0 + 6), str(k), fill=(220, 30, 30))
        if out:
            os.makedirs(out, exist_ok=True)
            m = max(8, int(0.04 * max(x1 - x0, y1 - y0)))
            bx = (max(0, x0 - m), max(0, y0 - m), min(w, x1 + m), min(h, y1 + m))
            crop = np.asarray(im.crop(bx)).copy()
            other = (lab[bx[1]:bx[3], bx[0]:bx[2]] != p["id"]) & (lab[bx[1]:bx[3], bx[0]:bx[2]] != 0)
            crop[other] = 255
            Image.fromarray(crop).save(os.path.join(out, "%s-%02d.webp" % (name, k)), "WEBP", quality=92, method=6)
    pv.thumbnail((1600, 1600)); pv.save(os.path.splitext(path)[0] + "-boxes.jpg", quality=88)


if __name__ == "__main__":
    main()
