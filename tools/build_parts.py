"""Cut the part sheets into the pieces the room assembles scenery from.

usage: python tools/build_parts.py
  in:  art/sheets/bang*.png                (separate ink pieces on white, generated with Muse)
  out: web/assets/parts/<kind>/NN.webp, web/assets/parts/parts.json, reports/parts-sheet.jpg (every piece, labelled,
       with its anchor point: check this after a rebuild)

Kinds and what is recorded for each (fractions of the piece image unless said):
  peak    one mountain. Saved WITH alpha: solid under its own skyline, fading out over the bottom third, so a near peak
          hides the ones behind it. ax, ay: the summit
  puff    pale cloud blob.  swirl: dark cloud spiral
  branch  pine branch. ax, ay: where it joins the trunk; dx, dy: which way it grows from there (unit vector)
  trunk   pine trunk, turned on its side (so it can be bent along a stroke like the river). b: ink box
  reed, rock   ax, ay: foot (bottom middle)
  bank    strip of river bank, lying flat
  streak  flowing water lines, lying flat (bent along the river).  blot: round ink blot (the moon's disc and its seas)
  every piece: tone = how dark its ink is on average, 0..1; fill = share of its box that is inked (a round blot: 0.75)
All but the peaks are saved as they are, opaque on white: the room multiplies them on, white is empty paper.
"""
import glob, json, os, shutil, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from split_sheet import pieces

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art", "sheets")
OUT = os.path.join(ROOT, "web", "assets", "parts")
GAP = {"bang1": 4, "bang2": 24, "bang3": 8, "bang4": 8, "bang5": 10}   # px: ink nearer than this is one piece (two peaks stand close; a pale cloud falls apart under 20)
# bang4-v1 came out as one reed, one rock and one bank repeated: two of each are plenty
CAP = {"bang4-v1": 2}


def kind_of(sheet, w, h, fill, dark, solid):
    if sheet == "bang1": return "peak"
    if sheet == "bang2": return "swirl" if dark > 0.06 else "puff"
    if sheet == "bang3": return "trunk" if h > 3 * w else "branch"
    if sheet == "bang5": return "streak" if w > 3 * h else "blot"
    if w > 3 * h: return "bank"
    return "rock" if fill > 0.455 else "reed"   # share of its box that is inked: rocks 0.48 and up, the bushiest grass 0.43


def main():
    if os.path.isdir(OUT): shutil.rmtree(OUT)
    man, thumbs, seen = {}, [], {}
    for path in sorted(glob.glob(os.path.join(SRC, "bang*.png"))):
        sheet = os.path.basename(path).split("-")[0]
        im = Image.open(path).convert("RGB"); W, H = im.size
        lab, ps = pieces(im, GAP[sheet], 0.0015)
        full = np.asarray(im)
        for p in ps:
            x0, y0, x1, y1 = p["box"]; m = max(8, int(0.05 * max(x1 - x0, y1 - y0)))
            bx = (max(0, x0 - m), max(0, y0 - m), min(W, x1 + m), min(H, y1 + m))
            crop = full[bx[1]:bx[3], bx[0]:bx[2]].copy(); lb = lab[bx[1]:bx[3], bx[0]:bx[2]]
            crop[(lb != p["id"]) & (lb != 0)] = 255
            lum = crop.mean(2); ink = ((255 - lum) > 28) & (lb == p["id"])
            ys, xs = np.nonzero(ink); h, w = ink.shape
            iw, ih = x1 - x0, y1 - y0
            k = kind_of(sheet, iw, ih, ink.sum() / (iw * ih), ((lum < 90) & ink).sum() / (iw * ih), ndi.binary_erosion(ink, iterations=7).sum() / ink.sum())
            ver = "-".join(os.path.basename(path).split("-")[:2]); seen[(ver, k)] = seen.get((ver, k), 0) + 1
            if seen[(ver, k)] > CAP.get(ver, 99): continue
            rec = {"w": w, "h": h, "tone": round(float((255 - lum[ink]).mean()) / 255, 3), "fill": round(float(ink.sum()) / (iw * ih), 3), "b": [round(xs.min() / w, 4), round(ys.min() / h, 4), round((xs.max() + 1) / w, 4), round((ys.max() + 1) / h, 4)]}
            img = Image.fromarray(crop)
            if k == "peak":
                top = np.full(w, np.nan)
                for c in np.unique(xs): top[c] = ys[xs == c].min()
                ok = ~np.isnan(top); cols = np.arange(w)
                top = np.interp(cols, cols[ok], top[ok]); top = ndi.uniform_filter1d(top, 9)
                yy = np.arange(h)[:, None]; a = np.clip((yy - top[None, :]) / 3.0 + 0.5, 0, 1)
                a *= ((cols >= xs.min()) & (cols <= xs.max()))[None, :]
                bot = ys.max(); a *= np.clip((bot - yy) / (0.34 * (bot - ys.min())), 0, 1)
                a = ndi.gaussian_filter(a, 2.0)
                img = Image.fromarray(np.dstack([crop, (a * 255).astype(np.uint8)]))
                c = int(np.argmin(np.where(ok, np.where(np.isnan(top), 1e9, top), 1e9)))
                rec["ax"] = round(c / w, 4); rec["ay"] = round(float(top[c]) / h, 4)
            elif k == "trunk":
                img = img.rotate(-90, expand=True); rec["w"], rec["h"] = h, w
                bx0, by0, bx1, by1 = rec["b"]; rec["b"] = [round(1 - by1, 4), bx0, round(1 - by0, 4), bx1]
            elif k == "branch":
                # the end where it joins the trunk is a single bare stroke; the other end fans out into needles.
                # Of the four sides of the ink box, take the one whose outermost strip of ink is the most compact
                best = None
                for side in "lrtb":
                    t = 0.07
                    if side == "l": s = xs <= xs.min() + t * iw
                    elif side == "r": s = xs >= xs.max() - t * iw
                    elif side == "t": s = ys <= ys.min() + t * ih
                    else: s = ys >= ys.max() - t * ih
                    spread = (np.std(ys[s]) if side in "lr" else np.std(xs[s])) / max(iw, ih)
                    # the joint lies far from where the ink's weight is
                    far = np.hypot(xs[s].mean() - xs.mean(), ys[s].mean() - ys.mean()) / max(iw, ih)
                    score = far - 3 * spread
                    if best is None or score > best[0]: best = (score, xs[s].mean(), ys[s].mean())
                ax, ay = best[1], best[2]; dx, dy = xs.mean() - ax, ys.mean() - ay; n = float(np.hypot(dx, dy))
                rec.update(ax=round(ax / w, 4), ay=round(ay / h, 4), dx=round(dx / n, 3), dy=round(dy / n, 3), len=round(2 * n / max(w, h), 3))
            elif k in ("reed", "rock"):
                low = ys >= ys.max() - 0.12 * ih
                rec["ax"] = round(float(xs[low].mean()) / w, 4); rec["ay"] = round((ys.max() + 1) / h, 4)
            d = os.path.join(OUT, k); os.makedirs(d, exist_ok=True)
            n = len(man.setdefault(k, [])) + 1
            rec["f"] = "%s/%02d.webp" % (k, n)
            img.save(os.path.join(OUT, rec["f"]), "WEBP", quality=90, method=6)
            man[k].append(rec); thumbs.append((k, n, img, rec))
    json.dump(man, open(os.path.join(OUT, "parts.json"), "w"), separators=(",", ":"))
    print({k: len(v) for k, v in man.items()}, "bytes", sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs))

    # contact sheet
    cell, cols = 200, 12; rows = (len(thumbs) + cols - 1) // cols
    sh = Image.new("RGB", (cols * cell, rows * cell), (235, 235, 235)); dr = ImageDraw.Draw(sh)
    for i, (k, n, img, rec) in enumerate(sorted(thumbs, key=lambda t: (t[0], t[1]))):
        t = Image.new("RGB", img.size, (255, 255, 255)); t.paste(img, (0, 0), img if img.mode == "RGBA" else None)
        s = min((cell - 12) / t.width, (cell - 26) / t.height); t = t.resize((max(1, int(t.width * s)), max(1, int(t.height * s))))
        ox, oy = (i % cols) * cell + 6, (i // cols) * cell + 20; sh.paste(t, (ox, oy))
        dr.text((ox, oy - 16), "%s %d" % (k, n), fill=(0, 0, 0))
        if "ax" in rec:
            px, py = ox + rec["ax"] * t.width, oy + rec["ay"] * t.height
            dr.ellipse([px - 5, py - 5, px + 5, py + 5], outline=(230, 20, 20), width=2)
            if "dx" in rec: dr.line([px, py, px + rec["dx"] * 40, py + rec["dy"] * 40], fill=(20, 60, 230), width=2)
    os.makedirs(os.path.join(ROOT, "reports"), exist_ok=True); sh.save(os.path.join(ROOT, "reports", "parts-sheet.jpg"), quality=85)


if __name__ == "__main__":
    main()
