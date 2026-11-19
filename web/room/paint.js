// InkDragon paint (Yang 2026-11-18, evening): free drawing, the dragon is the brush stroke. No figures, no numbered
// points. Mountains only, until one stroke reads as a mountain.
//   - ink flows while the left button is held (pointer locked). The stroke is the path of the held point (the eye)
//   - lifting the pen turns the stroke into a mountain ridge. Any number of strokes
// The player gives the gesture, the code does the brushwork (side-brush, as the ridge is painted on paper):
//   ridge   the path itself, as a line of uneven weight: heavy where the hand was slow, on crests (the brush is pressed
//           where it turns) and on the shaded side; dry and broken where the hand was fast and toward the end of a
//           long stroke (the brush runs out)
//   peaks   the dragon cannot turn sharply, so every top comes out round: each crest of the path is drawn up into a point
//   wash    the belly of the brush: ink under the ridge, thinning to bare paper at the foot (the mist). The side falling
//           away to the right is the shaded one, darker
//   cun     texture strokes: a few long dry lines running down from each peak, short ones hanging on the shaded slopes
// A stroke lower on the paper is a nearer mountain: darker, and it hides what stands behind it.
// The pieced pictures (templates, river, pine, cloud, moon) are in git up to 5067f47.
// Sits on top of room.js (window.__room): wraps its draw hook, adds its own canvas (#ink, multiplied onto the paper).
(() => {
  const D = window.__dragon, Rm = window.__room;
  if (!D || !Rm) return;
  const ink = document.getElementById('ink'), cMain = ink.getContext('2d'), panel = document.getElementById('panel');
  let c = cMain;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), sm = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const S = { peak: 0.6, cun: 0.6, dry: 0.5, body: 0.5, mist: 0.5, tex: 'muse' };   // tex: whose brush strokes the ridge is laid with (muse / gemini / gpt), or 'code' = drawn by code
  const TEX = ['code', 'muse', 'gemini', 'gpt'];   // peak: how far crests are drawn up into points; cun: how many texture strokes; dry: how dry the brush
  try { Object.assign(S, JSON.parse(localStorage.getItem('paint.v2') || '{}')); } catch { /* defaults */ }
  { const q = new URLSearchParams(location.search).get('tex'); if (q) S.tex = q; }
  const save = () => { try { localStorage.setItem('paint.v2', JSON.stringify(S)); } catch { /* ok */ } };
  const freeW = () => D.W - (panel.classList.contains('hide') ? 0 : panel.offsetWidth);
  const INK = '18,18,24';

  // ---- state --------------------------------------------------------------------------------------------------------
  const st = { pen: false, stroke: [], done: [], msg: '', msgT: -9, kind: 'mountain' };   // kind: what the next stroke becomes (keys 1, 2)
  const KINDS = [['mountain', 'núi'], ['river', 'sông']];
  const say = (s) => { st.msg = s; st.msgT = D.T; };
  function reset() { st.pen = false; st.stroke = []; st.done = []; bakeKey = ''; sync(); }
  function undo() { if (st.done.pop()) { bakeKey = ''; sync(); } }
  function penDown() { if (st.pen) return; st.pen = true; st.stroke = []; }
  function penUp() {
    if (!st.pen) return; st.pen = false;
    const q = st.stroke; st.stroke = []; let L = 0; for (let i = 1; i < q.length; i++) L += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
    if (L < 0.06 * D.H) return;   // a tap, not a stroke
    st.done.push({ stroke: q, kind: st.kind, t0: D.T, seed: (Math.random() * 2147483647) | 0 }); sync();
  }
  function step(dt) {
    if (!st.pen) return;
    const hc = Rm.hc, q = st.stroke, l = q[q.length - 1], d = l ? Math.hypot(hc.x - l[0], hc.y - l[1]) : 0;
    if (!l || d > 1.5) q.push([hc.x, hc.y, l ? d / dt / D.H : 0]);   // x, y, speed in screens a second
  }

  // ---- drawing ------------------------------------------------------------------------------------------------------
  let dpr = 1;
  function size() { dpr = Math.min(2, devicePixelRatio || 1); ink.width = Math.round(innerWidth * dpr); ink.height = Math.round(innerHeight * dpr); }
  size(); addEventListener('resize', () => { size(); for (const d of st.done) d.m = null; bakeKey = ''; });
  // the stroke while it is being flown: drawn opaque on a scratch canvas and laid on at its alpha (drawn straight, the
  // overlapping round caps showed as a string of beads)
  const tmp = document.createElement('canvas'), tc = tmp.getContext('2d');
  function strokePath(q, alpha) {
    if (q.length < 2 || alpha <= 0) return;
    const w0 = D.H * 0.009; if (tmp.width !== ink.width || tmp.height !== ink.height) { tmp.width = ink.width; tmp.height = ink.height; }
    tc.setTransform(dpr, 0, 0, dpr, 0, 0); tc.clearRect(0, 0, D.W, D.H); tc.lineCap = 'round'; tc.strokeStyle = `rgb(${INK})`;
    let w = w0;
    for (let i = 1; i < q.length; i++) { w += (w0 * (1.25 - 0.8 * clamp(q[i][2] / 1.6, 0, 1)) - w) * 0.25; tc.lineWidth = Math.max(1.5, w); tc.beginPath(); tc.moveTo(q[i - 1][0], q[i - 1][1]); tc.lineTo(q[i][0], q[i][1]); tc.stroke(); }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = alpha; c.drawImage(tmp, 0, 0); c.restore();
  }
  // the stroke at even steps, hand wobble smoothed off: [x, y, speed]
  function calm(q, step, k) {
    const P = [[q[0][0], q[0][1], q[0][2]]]; let left = step;
    for (let i = 1; i < q.length; i++) { let ax = q[i - 1][0], ay = q[i - 1][1]; const bx = q[i][0], by = q[i][1]; let d = Math.hypot(bx - ax, by - ay);
      while (d >= left) { ax += (bx - ax) * left / d; ay += (by - ay) * left / d; P.push([ax, ay, q[i][2]]); d -= left; left = step; } left -= d; }
    return P.map((_, i) => { let x = 0, y = 0, v = 0, n = 0; for (let j = Math.max(0, i - k); j <= Math.min(P.length - 1, i + k); j++) { x += P[j][0]; y += P[j][1]; v += P[j][2]; n++; } return [x / n, y / n, v / n]; });
  }
  const dice = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // smooth 1-D noise from the stroke's dice: n(t, octaves) in 0..1
  const noise1 = (R) => { const g = Array.from({ length: 64 }, R), v = (t) => { const i = Math.floor(t), f = t - i, s = f * f * (3 - 2 * f); return g[i & 63] + (g[(i + 1) & 63] - g[i & 63]) * s; };
    return (t, oct) => { let a = 0, w = 1, n = 0; for (let o = 0; o < oct; o++) { a += w * v(t * (1 << o) + o * 17.3); n += w; w *= 0.5; } return a / n; }; };
  // paper tooth: specks rubbed out of the ink
  const grain = document.createElement('canvas');
  { grain.width = grain.height = 128; const g = grain.getContext('2d'), d = g.createImageData(128, 128); for (let i = 0; i < d.data.length; i += 4) { const r = Math.random(); d.data[i + 3] = Math.round(r * r * r * 255); } g.putImageData(d, 0, 0); }

  // real brush strokes (web/assets/strokes, cut and straightened by tools/build_inklines.py from the sheets Yang had
  // Muse, Gemini and GPT paint): one is bent along the whole ridge, its upper edge on the line
  const STROKES = {}; let strokesReady = false;
  fetch('../assets/strokes/strokes.json').then((r) => r.json()).then((man) => { let left = 0;
    for (const k in man) { STROKES[k] = man[k]; for (const q of man[k]) { left++; const im = new Image(); im.onload = () => { q.im = im;
        if (/_[me]$/.test(k)) try { const cv = document.createElement('canvas'); cv.width = q.w; cv.height = q.h; const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); const px = x.getImageData(0, 0, q.w, q.h).data; q.a = new Uint8Array(q.w * q.h); for (let i = 0; i < q.a.length; i++) q.a[i] = px[i * 4 + 3]; } catch { /* no mask: the mist falls back on noise */ }   // mist masks (sheets D, E) are read as numbers, not drawn
        if (--left === 0) { strokesReady = true; for (const d of st.done) d.m = null; bakeKey = ''; } }; im.src = '../assets/strokes/' + q.f; } } }).catch(() => { strokesReady = true; });
  const STEP = 3, BIN = 2;   // px between points of the calmed stroke; px per column of the wash
  // One stroke -> one mountain, on canvases cropped to it: cv (the ink) and body (what it hides of the mountains behind)
  function mountain(d) {
    const tB = performance.now(), H = D.H, R = dice(d.seed), N = noise1(R), P = calm(d.stroke, STEP, 4), n = P.length;
    if (n < 8) return null;
    // -- peaks: every crest of the path (a top, standing at least a little above both its sides) is drawn up into a point;
    //    the saddles between are cut a little deeper. A tent laid on a round top gives the break of a real summit
    const win = Math.max(4, Math.round(0.1 * H / STEP)), tr = Math.max(4, Math.round(0.055 * H / STEP)), crests = [];
    const tent = (k, h, skew) => { const r = tr; for (let i = Math.max(0, k - r); i <= Math.min(n - 1, k + r); i++) { const w = Math.pow(1 - Math.abs(i - k) / (r + 1), 1.6); P[i][1] -= h * w; P[i][0] += skew * Math.abs(h) * w; } };
    // the brush belly lies on one side of the whole stroke (below it over most of its length). Where a loop turns that side
    // upward (r008: two loops), a top is no summit of a body: left round, or the brush slices fanned out of the point
    const bellyUp = (() => { const tx = (i) => { const a = P[Math.max(0, i - 2)], b = P[Math.min(n - 1, i + 2)]; return (b[0] - a[0]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1); }; let s = 0; for (let i = 0; i < n; i++) s += tx(i); const f = s < 0 ? -1 : 1; return (k) => f * tx(k) < 0; })();
    { const y = P.map((p) => p[1]), found = [];
      for (let k = 2; k < n - 2; k++) {
        let lo = true, hi = true, l = -1e9, r = -1e9, l2 = 1e9, r2 = 1e9;
        for (let j = Math.max(0, k - win); j <= Math.min(n - 1, k + win); j++) { if (y[j] < y[k] || (y[j] === y[k] && j < k)) lo = false; if (y[j] > y[k] || (y[j] === y[k] && j < k)) hi = false; if (j < k) { l = Math.max(l, y[j]); l2 = Math.min(l2, y[j]); } else if (j > k) { r = Math.max(r, y[j]); r2 = Math.min(r2, y[j]); } }
        if (lo && Math.min(l, r) - y[k] > 0.01 * H) found.push([k, Math.min(l, r) - y[k], 1]);
        else if (hi && y[k] - Math.max(l2, r2) > 0.01 * H) found.push([k, y[k] - Math.max(l2, r2), -1]);
      }
      for (const [k, prom, up] of found) { const h = S.peak * clamp(prom * 0.9, 0.015 * H, 0.085 * H) * (0.7 + 0.6 * R()); const skew = (R() - 0.5) * 0.9; if (bellyUp(k)) continue; tent(k, up > 0 ? h : -0.45 * h, skew); if (up > 0) crests.push(k); } }
    const real = (STROKES[S.tex] || []).some((q) => q.im), shake = real ? 0.35 : 1;   // a real stroke brings its own rough edge: shaken as much as a drawn one it read as a wobbly marker line
    // -- the tremor of a hand on rough paper
    const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const L = cum[n - 1], nrm = [];
    for (let i = 0; i < n; i++) { const a = P[Math.max(0, i - 2)], b = P[Math.min(n - 1, i + 2)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; nrm.push([-(b[1] - a[1]) / l, (b[0] - a[0]) / l]); }
    // the mountain's side of the line: one side for the whole stroke, the one that looks down the paper over most of it.
    // (Chosen point by point, it jumped across on every steep stretch and the ribbon came out in shifted slabs: r005)
    { let sy = 0; for (const q of nrm) sy += q[1]; if (sy < 0) for (const q of nrm) { q[0] = -q[0]; q[1] = -q[1]; } }
    // an upright stroke is a rock face, its body beside it and not under it. Which side: the one the stroke leans over;
    // a stroke that stands plumb is read as it was drawn, as the flank of a mountain painted left to right: going up, the
    // body lies to the right, coming down, to the left
    let side = 0, cliff = 0; { let ya = 1e9, yb = -1e9, xa = 1e9, xb = -1e9, sx = 0, sy = 0; for (const p of P) { ya = Math.min(ya, p[1]); yb = Math.max(yb, p[1]); xa = Math.min(xa, p[0]); xb = Math.max(xb, p[0]); }
      for (const q of nrm) { sx += q[0]; sy += q[1]; } cliff = sm(((yb - ya) / Math.max(1, xb - xa) - 1.3) / 1.2) * sm((Math.abs(P[n - 1][1] - P[0][1]) / Math.max(1, yb - ya) - 0.5) / 0.3);   // tall and narrow, and going one way: a tall peak flown up and down is no rock face
      if (cliff > 0) { side = sy / n < 0.12 ? (P[n - 1][1] < P[0][1] ? 1 : -1) : (sx < 0 ? -1 : 1); if (sx * side < 0) for (const q of nrm) { q[0] = -q[0]; q[1] = -q[1]; } } }
    for (let i = 0; i < n; i++) { const s = cum[i], j = shake * H * (0.0035 * (N(s / (0.018 * H), 2) - 0.5) + 0.009 * (N(s / (0.07 * H) + 9, 2) - 0.5)) * 2 * sm(Math.min(s, L - s) / (0.03 * H)); P[i][0] += nrm[i][0] * j; P[i][1] += nrm[i][1] * j; }
    // -- the ridge as seen: the highest point of the path over every column. field(i0, i1) reads a stretch of the path
    //    that way: its columns, its top, the lit / shaded side
    let bx1 = -1e9, yTop = 1e9, yBase = -1e9; for (const p of P) { bx1 = Math.max(bx1, p[0]); yTop = Math.min(yTop, p[1]); yBase = Math.max(yBase, p[1]); }
    const blur = (A, it) => { let B = A.slice(); const m = A.length; for (let q = 0; q < it; q++) { const Cc = B.slice(); for (let k = 1; k < m - 1; k++) Cc[k] = (B[k - 1] + 2 * B[k] + B[k + 1]) / 4; B = Cc; } return B; };
    const boxb = (A, r) => { const m = A.length, c0 = [0]; for (let k = 0; k < m; k++) c0.push(c0[k] + A[k]); return A.map((_, k) => { const a = Math.max(0, k - r), b = Math.min(m - 1, k + r); return (c0[b + 1] - c0[a]) / (b - a + 1); }); };
    const field = (i0, i1, E = 0) => {
      let x0 = 1e9, x1 = -1e9; for (let i = i0; i <= i1; i++) { x0 = Math.min(x0, P[i][0]); x1 = Math.max(x1, P[i][0]); }
      x0 = Math.floor(x0) - E; x1 += E; const m = Math.max(2, Math.ceil((x1 - x0) / BIN) + 1), top = new Array(m).fill(1e9);
      for (let i = i0 + 1; i <= i1; i++) { const a = P[i - 1], b = P[i], k0 = (a[0] - x0) / BIN, k1 = (b[0] - x0) / BIN, lo = Math.floor(Math.min(k0, k1)), hi = Math.ceil(Math.max(k0, k1));
        for (let k = Math.max(0, lo); k <= Math.min(m - 1, hi); k++) { const f = k1 === k0 ? 0 : clamp((k - k0) / (k1 - k0), 0, 1), y = a[1] + (b[1] - a[1]) * f; if (y < top[k]) top[k] = y; } }
      if (E) { let kA = 0, kB = m - 1; while (kA < m - 1 && top[kA] > 1e8) kA++; while (kB > kA && top[kB] > 1e8) kB--;
        const q = Math.min(8, kB - kA), gA = clamp((top[kA] - top[kA + q]) / Math.max(1, q * BIN), 0.55, 2.5), gB = clamp((top[kB] - top[kB - q]) / Math.max(1, q * BIN), 0.55, 2.5);   // falling at least a little, whatever way the stroke ended
        const fall = (g0, d) => g0 * d * (1 + 0.9 * d / E) + (N(d / (0.03 * H) + 77, 2) - 0.5) * 0.02 * H * Math.min(1, d / (0.02 * H));   // bending down and uneven, not ruled
        for (let k = 0; k < kA; k++) top[k] = top[kA] + fall(gA, (kA - k) * BIN); for (let k = kB + 1; k < m; k++) top[k] = top[kB] + fall(gB, (k - kB) * BIN); }
      for (let k = 0, last = P[i0][1]; k < m; k++) { if (top[k] > 1e8) top[k] = last; else last = top[k]; }
      const ts = blur(top, 5), wide = blur(top, 40), slope = (k) => (wide[Math.min(m - 1, k + 4)] - wide[Math.max(0, k - 4)]) / (8 * BIN);
      // lit side / shaded side, turning over gently across a summit: spread over about a sixth of a screen (three box
      // passes). Straight from the slope it flipped in one column and left a plumb seam down every peak (r005)
      const rs = Math.max(4, Math.round(0.055 * H / BIN)), shade = boxb(boxb(boxb(top.map((_, k) => clamp(slope(k) * 1.3, -1, 1)), rs), rs), rs);
      return { x0, m, top, ts, shade };
    };
    // a stroke that doubles back across the paper (r006: a C, a hook, then a peak over it) is read in stretches, each
    // going one way; each stretch is a ridge with its own ink under it. A turn counts once the path has come back 2.5%
    const runs = []; { let a = 0, dir = 0, ext = P[0][0], ie = 0; const tol = 0.025 * H;
      for (let i = 1; i < n; i++) { const x = P[i][0];
        if (!dir) { if (Math.abs(x - P[0][0]) > tol) { dir = Math.sign(x - P[0][0]); ext = x; ie = i; } continue; }
        if ((x - ext) * dir > 0) { ext = x; ie = i; } else if ((ext - x) * dir > tol) { if (ie - a > 3) runs.push([a, ie]); a = ie; dir = -dir; ext = x; ie = i; } }
      runs.push([a, n - 1]); }
    // past both its ends the mountain goes on, falling away into the mist: the ink thins out there and not inside the
    // stroke. (Thinned inside, two mountains meeting end to end left a white upright gap between them: r007)
    const E = runs.length > 1 ? 0 : Math.round(0.07 * H * (1 - cliff)); bx1 += E;   // short: drawn on for 0.22 of a screen, every mountain grew a straight sharp spur at each end (Yang 11-18)
    const F = field(0, n - 1, E), bx0 = F.x0, nb = F.m, top = F.top, ts = F.ts, shAt = (k) => F.shade[clamp(k, 0, nb - 1)];
    // the two ends of the stroke thin out: the brush is set down and lifted there
    const te = Math.min(0.3, (E ? E : 0.09 * H) / Math.max(1, bx1 - bx0)), envX = (x) => { const t = clamp((x - bx0) / Math.max(1, bx1 - bx0), 0, 1); return sm(t / te) * sm((1 - t) / te); }, env = (k) => envX(bx0 + k * BIN);
    // how far the ink runs down the slope: to about the level of the stroke's lowest point, so tall peaks get long slopes
    // toward both ends the ink runs less and less far down: the mountain dies out as a wedge along its falling flank.
    // (Its ink only thinned there, column by column, so every mountain began and ended at a plumb edge: r007)
    const tD = Math.min(0.22, (E + 0.22 * H) / Math.max(1, bx1 - bx0)), envD = (x) => { const t = clamp((x - bx0) / Math.max(1, bx1 - bx0), 0, 1); return sm(t / tD) * sm((1 - t) / tD); };
    // (and a wedge of even ink has a lower edge: two mountains ending side by side stood apart by a bent pale streak, each
    // with a visible rim. So the wedge is blunt, and the lower body also pales toward the ends: mist, with no rim)
    const depthAt = (t, x) => ((yBase - t) * 1.0 + 0.17 * H) * (E ? 0.3 + 0.7 * envD(x) : 0.45 + 0.55 * envX(x)), wedge = (x) => E ? (0.05 + 0.95 * envD(x)) / (0.3 + 0.7 * envD(x)) : 1,
       depthFull = ts.map((t, k) => depthAt(t, bx0 + k * BIN)), depth = depthFull.map((v, k) => v * wedge(bx0 + k * BIN));   // depth: how far texture strokes and wash bands reach, the sharp wedge as before
    const folded = runs.length > 1, fields = folded ? runs.map(([a, b]) => field(a, b)) : [F];
    // -- canvases, cropped to the mountain
    const CL = Math.round(cliff * clamp(0.55 * (yBase - yTop), 0.1 * H, 0.3 * H)), extL = side < 0 ? CL : 0, extR = side > 0 ? CL : 0;   // how far a rock face's ink runs sideways
    const pad = Math.round(0.04 * H), ox = bx0 - pad - extL, oy = Math.floor(yTop - 0.1 * H),   // whole px: wash columns must sit on the pixel grid or their seams show as fine upright stripes
       cw = Math.ceil((bx1 - bx0 + 2 * pad + extL + extR) * dpr), chh = Math.ceil((yBase + 0.19 * H - oy) * dpr);
    const mk = () => { const cv = document.createElement('canvas'); cv.width = cw; cv.height = chh; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr); return [cv, g]; };
    const [cv, g] = mk(), [body, gb] = mk(), [rib, gr] = mk();
    const home = (x) => x.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr), raw = (x) => x.setTransform(1, 0, 0, 1, 0, 0);
    // -- wash: per column, ink thinning from the ridge to nothing at the foot. A second, shorter and darker band under
    //    the ridge with an uneven lower edge: the brush belly does not touch the paper evenly
    // drawn in device pixels, every column on whole pixels: at a display scale of 120% (Yang's, r006) columns of 2.4 px
    // left fine upright stripes all over the body
    raw(g); raw(gb); const DX = (x) => Math.round((x - ox) * dpr), DY = (y) => (y - oy) * dpr, fr = Math.max(2, Math.round(0.05 * H / BIN));
    // the other sheets of the brush in use (Muse's stand in where a source has none, as GPT): _a long dry strokes,
    // _b axe-cut strokes, _d moss dots, _c bands of wash
    const aux = (suf) => { if (S.tex === 'code') return []; const a = (STROKES[S.tex + suf] || []).filter((q) => q.im); return a.length ? a : (STROKES['muse' + suf] || []).filter((q) => q.im); };
    const kitA = aux('_a'), kitB = aux('_b'), kitC = aux('_c'), kitD = S.tex === 'code' ? [] : Object.keys(STROKES).filter((k) => k.endsWith('_d')).flatMap((k) => STROKES[k].filter((q) => q.im)),   // moss dots: every source's in one pool (Muse's are one shape repeated)
       pick = (kit) => kit[Math.floor(R() * kit.length) % kit.length];
    const qc = kitC.length ? pick(kitC) : null, qc2 = kitC.length ? pick(kitC) : null, sc1 = qc ? qc.h / (0.085 * H) : 1, sc2 = qc2 ? qc2.h / (0.2 * H) : 1, uo1 = R() * 4000, uo2 = R() * 4000;
    const pp = (v, w) => { const a = 0.07 * w, m = 2 * (w - 2 * a); v = ((v % m) + m) % m; return a + (v < m / 2 ? v : m - v); };   // over its middle only: a band thins at both ends, and turning there cut a white notch into the body   // there and back along a band: no seam where it runs out
    const bm = 0.6 + 2.4 * S.body, mid = 0.4 * S.body;   // body: how much ink the mountain's flank holds, and how far down it stays dark
    for (const f of fields) {
      // how deep the two real bands of wash hang under the ridge, column by column
      const hB = f.ts.map((t, k) => { const x = f.x0 + k * BIN, dw = depthAt(t, x) * wedge(x); return [Math.min(dw * 0.5, 0.11 * H) * (0.75 + 0.5 * N(x / (0.2 * H) + 40, 2)), Math.min(dw * 0.45, 0.2 * H) * (0.8 + 0.4 * N(x / (0.3 * H) + 61, 2))]; });
      for (let k = 0; k < f.m; k++) {
      const x = f.x0 + k * BIN, t = f.ts[k], ee = envX(x), dd = depthAt(t, x), ed = E ? envD(x) : 1, dw = dd * wedge(x), sh = f.shade[k], y0 = Math.min(f.top[k], t) - 1,
         e = ee * (1 - cliff) * (folded ? sm(Math.min(k, f.m - 1 - k) / fr) : 1),   // a stretch's ink thins toward the turn, or its end stood as a plumb edge in the body
         X = DX(x), Wd = DX(x + BIN) - X, Y0 = DY(y0), T = DY(t);
      const a0 = Math.min(0.95, 0.56 * bm * (0.85 + 0.3 * sh) * e * (0.85 + 0.3 * N(x / (0.12 * H) + 3, 2)));
      // past the end of the stroke there is no line: the ink has no upper edge there, it comes up out of nothing (mist)
      const soft = E ? 1 - sm(clamp(Math.max(bx0 + E - x, x - (bx1 - E)) / E, 0, 1) * 1.4) : 1;
      let gd = g.createLinearGradient(0, T, 0, DY(t + dd)); gd.addColorStop(0, `rgba(${INK},${(a0 * soft).toFixed(3)})`); gd.addColorStop(0.1, `rgba(${INK},${(a0 * 0.7 * (0.3 + 0.7 * soft)).toFixed(3)})`); gd.addColorStop(0.3, `rgba(${INK},${(a0 * (0.34 + mid) * ed).toFixed(3)})`); gd.addColorStop(0.6, `rgba(${INK},${(a0 * (0.1 + mid) * ed).toFixed(3)})`); gd.addColorStop(1, `rgba(${INK},0)`);
      g.fillStyle = gd; g.fillRect(X, Y0, Wd, DY(t + dd) - Y0);
      const d2 = Math.min(dw * 0.3, 0.075 * H) * (0.45 + 1.1 * N(x / (0.13 * H) + 40, 2)),   // capped: on a tall peak its lower edge showed as a level line across the body
         a2 = Math.min(0.9, 0.34 * bm * clamp(0.5 + 0.7 * sh, 0.12, 1) * e);
      gd = g.createLinearGradient(0, T, 0, DY(t + d2)); gd.addColorStop(0, `rgba(${INK},${a2.toFixed(3)})`); gd.addColorStop(0.6, `rgba(${INK},${(a2 * 0.5).toFixed(3)})`); gd.addColorStop(1, `rgba(${INK},0)`);
      if (qc) {   // a real band of wash, its dark wet edge under the ridge; a second one drawn long and faint down the body
        // each column's slice is sheared to the slope, so that its torn lower edge (about 0.8 of the way down) runs on
        // into the next column's. Laid as upright rectangles, every column stood a step lower than the one before on
        // a slope, and the band's edge came out as a staircase, steps of 7 px on a steep flank (Yang 11-19: "răng cưa")
        const kn = Math.min(f.m - 1, k + 1), [h1, h2] = hB[k], w1 = Math.max(1, BIN * sc1), w2 = Math.max(1, BIN * sc2), dT = DY(f.ts[kn]) - T,
           s1 = (dT + 0.8 * (hB[kn][0] - h1) * dpr) / Wd, s2 = (dT + 0.8 * (hB[kn][1] - h2) * dpr) / Wd;
        g.setTransform(1, s1, 0, 1, X, T - 1); g.globalAlpha = Math.min(1, 0.6 * bm * clamp(0.6 + 0.6 * sh, 0.3, 1) * e) * soft * soft; g.drawImage(qc.im, Math.min(qc.w - w1, pp((x - bx0) * sc1 + uo1, qc.w)), 0, w1, qc.h, 0, 0, Wd, h1 * dpr);
        g.setTransform(1, s2, 0, 1, X, T - 1); g.globalAlpha = Math.min(1, 0.26 * bm * e) * soft * soft; g.drawImage(qc2.im, Math.min(qc2.w - w2, pp((x - bx0) * sc2 + uo2, qc2.w)), 0, w2, qc2.h, 0, 0, Wd, h2 * dpr); g.globalAlpha = 1; raw(g);   // kept near its own size: drawn 0.4 of a screen deep on a tall peak, its torn edge stretched into spikes
      } else if (soft > 0.98) { g.fillStyle = gd; g.fillRect(X, Y0, Wd, DY(t + d2) - Y0); }
      // ink does not cover ink: right under this ridge the mountain behind is still there, running on into this one's wet
      // line and darkening it, and is lost only a little further down. (Hidden from the ridge on, the far ridge ended
      // at the near one as if cut with a knife: two pieces of paper, Yang 11-18)
      const bl = Math.min(0.4, 0.045 * H * (0.5 + 0.9 * N(x / (0.08 * H) + 130, 2)) / Math.max(1, dd));
      gd = gb.createLinearGradient(0, T, 0, DY(t + dd)); const hm = (Math.pow(sm(e), 2.5) * (E ? Math.pow(envD(x), 1.5) : 1)).toFixed(3); gd.addColorStop(0, `rgba(0,0,0,${hm})`); gd.addColorStop(0.45, `rgba(0,0,0,${hm})`); gd.addColorStop(1, `rgba(0,0,0,${(hm * (E ? sm((envD(x) - 0.35) / 0.5) : 1)).toFixed(3)})`);
      // hides as much as its own ink covers: held full while the ink thinned at a stroke's end, it left a white upright gap beside a dark band (r007)
      // over its middle it hides all the way down: under its foot lies mist, not the mountain behind. (Stopped where its
      // own ink ends, the mountain behind came back along a line the shape of this ridge; faded out there, it showed
      // through as a ghost.) Toward its ends, where it dies out as a wedge, it lets go with its own ink, or the mountain
      // behind was wiped in an upright pale band beside it
      gb.fillStyle = gd; gb.fillRect(X, Y0, Wd, chh - Y0);
    } }
    home(g); home(gb);
    // -- cun: texture strokes, each a thin line of a drying brush that bends toward the fall line and fades out
    const col = (x) => clamp(Math.round((x - bx0) / BIN), 0, nb - 1);
    const hair = (x, y, ang, len, w0, a0, to) => {
      const m = 16; g.lineCap = 'butt'; g.strokeStyle = `rgb(${INK})`;
      for (let i = 0; i < m; i++) { const f = i / m; ang += (to - ang) * 0.1 + (R() - 0.5) * 0.14; const nx = x + Math.cos(ang) * len / m, ny = y + Math.sin(ang) * len / m;
        if (R() > S.dry * 0.18 * (0.3 + f)) { g.globalAlpha = a0 * (1 - f) * (1 - f); g.lineWidth = Math.max(0.5, w0 * (1 - 0.75 * f)); g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke(); }
        x = nx; y = ny; }
      g.globalAlpha = 1;
    };
    // with real strokes loaded, a texture stroke is a piece of one (its drier far half), laid in short slices that turn
    // toward the fall line; w0 is the width of the drawn hair it stands for
    const kit0 = (STROKES[S.tex] || []).filter((q) => q.im);
    const mark = (x, y, ang, len, w0, a0, to) => {
      if (!kit0.length) return hair(x, y, ang, len, w0, a0, to);
      const q = pick(kitA.length ? kitA : kit0), m = 10, part = 0.3 + 0.3 * R(), u0 = (1 - part) * q.w, th = w0 * 3.2, sl = len / m;   // the piece runs to the stroke's own frayed end
      for (let i = 0; i < m; i++) { const f = i / m; ang += (to - ang) / m; const c0 = Math.cos(ang), s0 = Math.sin(ang);
        g.setTransform(dpr * c0, dpr * s0, -dpr * s0, dpr * c0, dpr * (x - ox), dpr * (y - oy)); const tw = th * (0.35 + 0.65 * Math.sin(3.1416 * Math.min(1, f * 1.6 + 0.12))); g.globalAlpha = a0 * Math.min(1, 0.25 + 3 * f) * (1 - 0.5 * f);   // set down thin, pressed, lifted
        g.drawImage(q.im, u0 + part * q.w * f, 0, part * q.w / m, q.h, 0, -tw / 2, sl + 0.7, tw); x += c0 * sl; y += s0 * sl; }
      g.globalAlpha = 1; home(g);
    };
    // a whole small piece, turned: an axe-cut stroke (its heavy head at x, y), a cluster of moss dots
    const stamp = (q, x, y, ang, len, a0, fat = 1) => { const c0 = Math.cos(ang), s0 = Math.sin(ang), hh = len * q.h / q.w * fat, fl = R() < 0.5 ? -1 : 1;   // mirrored across at random
      g.setTransform(dpr * c0, dpr * s0, -dpr * s0 * fl, dpr * c0 * fl, dpr * (x - ox), dpr * (y - oy)); g.globalAlpha = a0; g.drawImage(q.im, 0, -hh / 2, len, hh); g.globalAlpha = 1; home(g); };
    // axe cuts: short broad strokes hanging on the slope under the ridge, mostly on the shaded side
    if (kitB.length) for (let x = bx0 + 0.02 * H; x < bx1 - 0.02 * H; x += H * (0.02 + 0.05 * R())) {
      const k = col(x), sh = shAt(k), r1 = R(), r2 = R(), r3 = R(), r4 = R(), r5 = R();
      if (r1 > S.cun * (sh > 0 ? 0.9 : 0.35)) continue;
      const big = r5 * r5, an = 1.5708 - sh * 0.8 + (r4 - 0.5) * 0.7, ln = H * (0.014 + 0.026 * big), y = ts[k] + H * 0.012 + depth[k] * 0.32 * r3 * r3, cnt = 1 + Math.floor(R() * 4);   // a few large, many small; cut in ones to fours, side by side, each shorter than the last
      for (let j = 0; j < cnt; j++) { const l2 = ln * (1 - 0.16 * j) * (0.8 + 0.4 * R());
        stamp(kitB[Math.floor(r2 * kitB.length + j * 3) % kitB.length], x - Math.sin(an) * j * ln * 0.36 + (R() - 0.5) * ln * 0.25, y + Math.cos(an) * j * ln * 0.36 + (R() - 0.5) * ln * 0.35, an + (R() - 0.5) * 0.3, l2, (0.3 + 0.45 * R()) * (1 - 0.3 * big) * env(k), 0.7 + 0.6 * R()); }
    }
    // hemp fibres: many faint long lines down the fall line of the slope, closer and darker on the shaded side
    for (let x = bx0 + 0.01 * H; x < bx1 - 0.01 * H; x += H * (0.007 + 0.012 * R())) {
      const k = col(x), sh = shAt(k), e = env(k), r1 = R(), r2 = R(), r3 = R(), r4 = R();
      if (r1 > S.cun * 1.5 * (sh > 0 ? 1 : 0.6)) continue;
      const fall = 1.5708 - sh * 0.8;
      mark(x, ts[k] + H * (0.004 + 0.07 * r2 * r2), fall + (r3 - 0.5) * 0.9, depth[k] * (0.12 + 0.3 * r4 * r4), H * 0.0026 * (0.5 + R()), (0.2 + 0.25 * R()) * (sh > 0 ? 1 : 0.6) * e, fall + (r3 - 0.5) * 0.3);
    }
    if (kit0.length) { g.globalCompositeOperation = 'source-atop';   // broad faint drags of a dry brush down the slope, only where the wash lies: the grain of the body
      for (let x = bx0 + 0.03 * H; x < bx1 - 0.03 * H; x += H * (0.035 + 0.05 * R())) { const k = col(x), fall = 1.5708 - shAt(k) * 0.8;
        mark(x, ts[k] + H * 0.01, fall + (R() - 0.5) * 0.3, depth[k] * (0.45 + 0.4 * R()), H * 0.012 * (0.6 + 0.8 * R()), (0.1 + 0.1 * R()) * env(k) * S.cun / 0.6, fall); }
      g.globalCompositeOperation = 'source-over'; }
    for (const k of crests) {   // the spurs running down from a summit, to both sides
      const way = P[Math.min(n - 1, k + 2)][0] >= P[Math.max(0, k - 2)][0] ? 1 : -1, dc = depth[col(P[k][0])], cnt = Math.round((2 + 3 * R()) * S.cun * 1.6);
      for (let q = 0; q < cnt; q++) { const side = q === 0 ? (R() < 0.5 ? 1 : -1) * 0.25 : (q % 2 ? 1 : -1), i2 = clamp(k + way * Math.sign(side) * Math.round((q === 0 ? 0 : R()) * 0.03 * H / STEP), 0, n - 1);
        mark(P[i2][0], P[i2][1] + 0.003 * H, 1.5708 - side * (0.35 + 0.5 * R()), Math.min(0.2 * H, dc * (0.3 + 0.45 * R())), H * 0.0048 * (0.6 + 0.8 * R()), 0.6, 1.5708 - Math.sign(side) * (0.1 + 0.5 * R())); }
    }
    // -- nothing above the ridge
    // a folded stroke: ink only inside the figure the stroke itself bounds (a point is inside when the path passes over
    // it an odd number of times), so the hollow of a C stays paper instead of filling to a plumb wall (r006)
    if (folded) for (const x of [g, gb]) { x.globalCompositeOperation = 'destination-in'; x.globalAlpha = 1; x.fillStyle = '#000'; x.beginPath(); x.moveTo(P[0][0], P[0][1]); for (let i = 1; i < n; i++) x.lineTo(P[i][0], P[i][1]); x.lineTo(P[n - 1][0], yBase + 0.3 * H); x.lineTo(P[0][0], yBase + 0.3 * H); x.closePath(); x.fill('evenodd'); x.globalCompositeOperation = 'source-over'; }
    else for (const x of [g, gb]) { x.globalCompositeOperation = 'destination-out'; x.globalAlpha = 1; x.fillStyle = '#000'; x.beginPath(); x.moveTo(bx0 - pad - 5, oy - 5); x.lineTo(bx0 - pad - 5, top[0]); for (let k = 0; k < nb; k++) x.lineTo(bx0 + k * BIN, top[k]); x.lineTo(bx1 + pad + 5, top[nb - 1]); x.lineTo(bx1 + pad + 5, oy - 5); x.closePath(); x.fill(); x.globalCompositeOperation = 'source-over'; }
    // moss dots: a few clusters set on the ridge, just inside it
    if (kitD.length) for (let sd = (0.08 + 0.3 * R()) * H, i = 0; sd < L - 0.06 * H; sd += H * (0.12 + 0.5 * R()) / Math.max(0.2, S.cun / 0.6)) {
      while (i < n - 1 && cum[i] < sd) i++;
      for (let j = 0, c2 = R() < 0.4 ? 2 : 1; j < c2; j++) { const r = R(), sz = H * (0.01 + 0.03 * r * r), an = R() * 6.2832, off = sz * (0.7 + 0.8 * R()), al = (R() - 0.5) * 0.05 * H * j, cx = P[i][0] + nrm[i][0] * off + nrm[i][1] * al, cy = P[i][1] + nrm[i][1] * off - nrm[i][0] * al;
        stamp(pick(kitD), cx - Math.cos(an) * sz / 2, cy - Math.sin(an) * sz / 2, an, sz, 0.35 + 0.55 * R(), 0.7 + 0.5 * R()); } }
    // -- a rock face: ink running sideways from the stroke into the body, row by row, widening from the top into a
    //    shoulder and thinning toward the foot; texture strokes leaning down off the face
    if (CL > 2) { raw(g); raw(gb); const rise = yBase - yTop, rowsN = Math.max(2, Math.ceil(rise / BIN)), xs = new Array(rowsN).fill(null);
      for (let i = 1; i < n; i++) { const a = P[i - 1], b = P[i];
        for (let r = Math.max(0, Math.floor((Math.min(a[1], b[1]) - yTop) / BIN)); r <= Math.min(rowsN - 1, Math.ceil((Math.max(a[1], b[1]) - yTop) / BIN)); r++) { const y = yTop + r * BIN, f = b[1] === a[1] ? 0 : clamp((y - a[1]) / (b[1] - a[1]), 0, 1), x = a[0] + (b[0] - a[0]) * f; if (xs[r] === null || (x - xs[r]) * side < 0) xs[r] = x; } }
      const scr = qc ? qc.h / (0.55 * CL) : 1, wr = Math.max(1, BIN * scr);
      for (let r = 0; r < rowsN; r++) { if (xs[r] === null) continue;
        const y = yTop + r * BIN, f = r / rowsN, len = CL * sm(f / 0.3) * (0.6 + 0.8 * N(y / (0.1 * H) + 11, 2)), a = Math.min(0.95, 0.62 * bm * cliff * sm(f / 0.12) * (1 - sm((f - 0.35) / 0.65)) * (0.8 + 0.4 * N(y / (0.05 * H) + 5, 2)));
        if (len < 2) continue; const Y = Math.round((y - oy) * dpr), Hd = Math.round((y + BIN - oy) * dpr) - Y, X0 = (xs[r] - ox) * dpr, X1 = (xs[r] + side * len - ox) * dpr;
        let gd = g.createLinearGradient(X0, 0, X1, 0); gd.addColorStop(0, `rgba(${INK},${a.toFixed(3)})`); gd.addColorStop(0.15, `rgba(${INK},${(a * 0.7).toFixed(3)})`); gd.addColorStop(0.45, `rgba(${INK},${(a * (0.3 + mid)).toFixed(3)})`); gd.addColorStop(0.75, `rgba(${INK},${(a * (0.08 + mid * 0.6)).toFixed(3)})`); gd.addColorStop(1, `rgba(${INK},0)`);
        g.fillStyle = gd; g.fillRect(Math.min(X0, X1), Y, Math.abs(X1 - X0), Hd);
        if (qc) { g.setTransform(r + 1 < rowsN && xs[r + 1] !== null ? (xs[r + 1] - xs[r]) * dpr / Hd : 0, 1, side, 0, X0, Y); g.globalAlpha = Math.min(1, a * 1.5); g.drawImage(qc.im, Math.min(qc.w - wr, pp((y - yTop) * scr + uo1, qc.w)), 0, wr, qc.h, 0, 0, Hd, len * 0.6 * dpr); g.globalAlpha = 1; raw(g); }   // a real band of wash turned on its side, its wet edge on the stroke
        const fb = 1 - sm((f - 0.5) / 0.5); gd = gb.createLinearGradient(X0, 0, X1, 0); gd.addColorStop(0, `rgba(0,0,0,${Math.min(1, 1.6 * cliff * fb).toFixed(3)})`); gd.addColorStop(0.5, `rgba(0,0,0,${Math.min(1, 1.3 * cliff * fb).toFixed(3)})`); gd.addColorStop(1, 'rgba(0,0,0,0)');
        gb.fillStyle = gd; gb.fillRect(Math.min(X0, X1), Y, Math.abs(X1 - X0), Hd); }
      home(g); home(gb); g.globalCompositeOperation = 'source-atop';
      for (let r = 4; r < rowsN - 4; r += Math.max(1, Math.round((0.012 + 0.03 * R()) * H / BIN))) { if (xs[r] === null) continue; const an = 0.5 + 0.8 * R(), lean = 1.2;
        mark(xs[r] + side * 0.004 * H, yTop + r * BIN, side > 0 ? an : 3.1416 - an, CL * (0.25 + 0.5 * R()) * sm(r / rowsN / 0.3 + 0.2), H * 0.006 * (0.6 + 0.8 * R()), (0.25 + 0.3 * R()) * cliff * S.cun / 0.6, side > 0 ? lean : 3.1416 - lean); }
      g.globalCompositeOperation = 'source-over'; }
    // -- where this mountain stands before another: the far one is gone from this ridge on, and already pales a little
    //    before it reaches the ridge, leaving a thin rim of lighter paper along it. That is how it is painted: ink does
    //    not cover ink, so the far range is stopped short of the near one and lost in mist there. (Let run on under the
    //    ridge for a stretch, a6c361f, the far ridge stuck through into the near body as a dark wedge: Yang 11-19, the
    //    game must not ask the player to paint that well. Cut off sharp at the ridge it was two pieces of paper, 11-18)
    { const [halo, gh] = mk(); raw(gh); gh.filter = `blur(${(RIM * H * dpr).toFixed(1)}px)`; gh.drawImage(body, 0, 0); gh.filter = 'none';
      // the rim comes and goes along the ridge: over about half its length there is next to none (the near ridge, darker,
      // parts the two by itself). Even and full all along, it stood around every near mountain as a drawn outline (Yang 11-19)
      { const gd = gh.createLinearGradient(0, 0, cw, 0), ns = Math.max(2, Math.ceil(cw / dpr / (0.04 * H))); for (let i = 0; i <= ns; i++) { const x = ox + i / ns * cw / dpr; gd.addColorStop(i / ns, `rgba(0,0,0,${(0.12 + 0.88 * sm((N(x / (0.22 * H) + 900, 2) - 0.5) / 0.22)).toFixed(3)})`); }
        gh.globalCompositeOperation = 'destination-in'; gh.fillStyle = gd; gh.fillRect(0, 0, cw, chh); gh.globalCompositeOperation = 'source-over'; }
      raw(gb); gb.globalCompositeOperation = 'destination-over'; gb.drawImage(halo, 0, 0); gb.globalCompositeOperation = 'source-over'; home(gb); }
    // -- the ridge line: a ribbon along the path, a little more of it on the mountain's side
    const near =(i) => { let b = 1e9; for (const k of crests) b = Math.min(b, Math.abs(cum[k] - cum[i])); return b; };
    const wAt = [], dryAt = [], prAt = [];
    for (let i = 0; i < n; i++) {
      const s = cum[i], slow = 1 - clamp(P[i][2] / 1.5, 0, 1), sh = shAt(col(P[i][0])), press = 0.5 * slow + 0.4 * N(s / (0.09 * H) + 70, 2) + 0.7 * Math.exp(-Math.pow(near(i) / (0.018 * H), 2)) + 0.2 * Math.max(0, sh);
      prAt.push(press);
      const taper = (0.3 + 0.7 * sm(s / (0.02 * H))) * (0.1 + 0.9 * sm((L - s) / (0.09 * H)));
      wAt.push(H * 0.0105 * taper * (0.5 + 0.65 * press) * (0.8 + 0.4 * N(s / (0.006 * H) + 200, 1)));
      dryAt.push(clamp(S.dry * (0.2 + 0.9 * clamp(P[i][2] / 1.4, 0, 1) + 0.8 * Math.pow(s / L, 2) * clamp(L / (1.2 * H), 0.3, 1)) - 0.3 * press, 0, 0.95));
    }
    const kit = (STROKES[S.tex] || []).filter((q) => q.im);
    if (kit.length) {
      // a real stroke, cut into thin slices across and each slice turned to the line: its dark upper edge on the ridge,
      // the rest on the mountain's side; pressed wider where the hand was slow and on crests
      const Tn = P.map((_, i) => { const a = P[Math.max(0, i - 2)], b = P[Math.min(n - 1, i + 2)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; });
      const q = kit[Math.floor(R() * kit.length) % kit.length], ds = 2, back = R() < 0.25; let j = 0;
      for (let a = 0; a < L; a += ds) {
        while (j < n - 2 && cum[j + 1] < a) j++;
        const f = (a - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]), px = P[j][0] + (P[j + 1][0] - P[j][0]) * f, py = P[j][1] + (P[j + 1][1] - P[j][1]) * f;
        // the slice's frame and width turn evenly from one point of the path to the next: taken from the point behind,
        // they jumped every 3 px while the slices lie 2 px apart, and the stroke's edge came out in notches
        const lx = (A, c) => A[j][c] + (A[j + 1][c] - A[j][c]) * f, tl = Math.hypot(lx(Tn, 0), lx(Tn, 1)) || 1, tx = lx(Tn, 0) / tl, ty = lx(Tn, 1) / tl, nl = Math.hypot(lx(nrm, 0), lx(nrm, 1)) || 1, nx = lx(nrm, 0) / nl, ny = lx(nrm, 1) / nl;
        const th = H * 0.044 * (0.6 + 0.55 * clamp(prAt[j] + (prAt[j + 1] - prAt[j]) * f, 0, 1.6)) * (0.8 + 0.4 * S.dry), u = (back ? 1 - (a + ds) / L : a / L) * q.w;
        gr.setTransform(dpr * tx, dpr * ty, dpr * nx, dpr * ny, dpr * (px - ox), dpr * (py - oy));
        // on the outside of a bend the slices spread apart like a fan: each is widened by as much as the bend opens there
        const j0 = Math.max(0, j - 3), j1 = Math.min(n - 1, j + 3), dc = Math.max(1, cum[j1] - cum[j0]), ko = -((Tn[j1][0] - Tn[j0][0]) * nrm[j][0] + (Tn[j1][1] - Tn[j0][1]) * nrm[j][1]) / dc, wd = (ds + 0.8) * (1 + clamp(ko * th * 0.95, 0, 6));
        gr.drawImage(q.im, clamp(u, 0, q.w - 1), 0, Math.max(1, (ds + 0.8) / L * q.w), q.h, (ds + 0.8 - wd) / 2, -0.1 * th, wd, th);
      }
      home(gr);
      for (const k of crests) { const rr = 0.013 * H, gd = gr.createRadialGradient(P[k][0], P[k][1] + rr * 0.5, 0, P[k][0], P[k][1] + rr * 0.5, rr); gd.addColorStop(0, `rgba(${INK},0.55)`); gd.addColorStop(1, `rgba(${INK},0)`); gr.fillStyle = gd; gr.fillRect(P[k][0] - rr, P[k][1] - rr, 2 * rr, 3 * rr); }   // ink pooled where the brush was pressed and turned
    } else {
      // side-brush: the tip leaves a solid dark edge on the sky side, the belly a broad paler band on the mountain side
      const band = (out, inn, alpha, ph = 300) => { gr.globalAlpha = alpha; gr.fillStyle = `rgb(${INK})`; gr.beginPath();
        for (let i = 0; i < n; i++) { const x = P[i][0] - nrm[i][0] * wAt[i] * out, y = P[i][1] - nrm[i][1] * wAt[i] * out; if (i) gr.lineTo(x, y); else gr.moveTo(x, y); }
        for (let i = n - 1; i >= 0; i--) { const v = inn * (0.75 + 0.5 * N(cum[i] / (0.05 * H) + ph, 2)); gr.lineTo(P[i][0] + nrm[i][0] * wAt[i] * v, P[i][1] + nrm[i][1] * wAt[i] * v); }
        gr.closePath(); gr.fill(); gr.globalAlpha = 1; };
      band(0.35, 4.2, 0.1, 310); band(0.35, 3.0, 0.13, 340); band(0.35, 2.0, 0.16, 370); band(0.35, 1.2, 0.2, 400);   // paler the further from the tip
      // flying white: the hairs of a dry or fast brush leave streaks of bare paper along the stroke, in the belly
      const streaks = (u0, u1, per, gate) => { gr.globalCompositeOperation = 'destination-out'; gr.strokeStyle = '#000'; gr.lineCap = 'butt';
        for (let q = 0, cnt = Math.round(L / (per * H)); q < cnt; q++) {
          const i0 = Math.floor(R() * (n - 2)), len = Math.round(H * (0.03 + 0.12 * R()) / STEP), u = u0 + (u1 - u0) * R(), ph = R() * 90; gr.lineWidth = 0.6 + 1.3 * R(); gr.globalAlpha = 0.5 + 0.5 * R(); gr.beginPath(); let on = false;
          for (let i = i0; i < Math.min(n, i0 + len); i++) { const x = P[i][0] + nrm[i][0] * wAt[i] * u, y = P[i][1] + nrm[i][1] * wAt[i] * u;
            if (N(cum[i] / (0.03 * H) + ph, 2) < gate + 0.45 * dryAt[i]) { if (on) gr.lineTo(x, y); else { gr.moveTo(x, y); on = true; } } else on = false; }
          gr.stroke(); }
        gr.globalCompositeOperation = 'source-over'; gr.globalAlpha = 1; };
      streaks(0.5, 4.0, 0.003, 0.3);
      band(0.4, 0.6, 1);
      for (const k of crests) { const rr = 0.013 * H, gd = gr.createRadialGradient(P[k][0], P[k][1] + rr * 0.5, 0, P[k][0], P[k][1] + rr * 0.5, rr); gd.addColorStop(0, `rgba(${INK},0.55)`); gd.addColorStop(1, `rgba(${INK},0)`); gr.fillStyle = gd; gr.fillRect(P[k][0] - rr, P[k][1] - rr, 2 * rr, 3 * rr); }   // ink pooled where the brush was pressed and turned
      streaks(-0.1, 0.6, 0.02, 0.08);
    }
    gr.globalCompositeOperation = 'source-over'; gr.globalAlpha = 1;
    raw(g); g.filter = `blur(${(0.0045 * H * dpr).toFixed(1)}px)`; g.globalAlpha = 0.3; g.drawImage(rib, 0, 0); g.filter = 'none'; g.globalAlpha = 0.93; g.drawImage(rib, 0, 0);   // a soft halo first: wet ink creeping off the line
    g.globalAlpha = 0.11; g.globalCompositeOperation = 'destination-out'; g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, cw, chh); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; home(g);
    // far (high on the paper) pale, near dark
    const tone = 0.42 + 0.58 * clamp((yBase / H - 0.3) / 0.5, 0, 1);
    // -- mist (Yang 11-18: a mask of bare paper laid over the body, so the mountain stands out of mist as in a painting
    //    and the faults of its body lie under it). A sea of mist with a rolling, curling top: summits stand clear of it,
    //    the low stretches of the ridge sink to their line, both ends of the mountain are lost in it. Laid in render
    //    after this mountain's ink: it takes this mountain and those behind it, never one in front.
    //    Built coarse (one value per MQ px) and drawn enlarged: mist has no fine edge.
    //    (The first mist, 545dcc2, lay behind the ridge and only paled the far mountain: not what was meant.)
    let mist = null, mxy = [0, 0, 1]; const tMist = performance.now();
    //    Its edge is real: the top of the sea is a band of wash that mist has eaten into (sheet D, key *_m), laid level
    //    along the sea level; each end of the ridge gets a bank that drifted in from the side (sheet E, *_e). Read as
    //    masks (1 = ink stays). Brush 'code', or no sheets: the edge is rolled by noise as before, and reads as airbrush.
    if (S.mist > 0.02) { const mk = (suf) => S.tex === 'code' ? [] : Object.keys(STROKES).filter((k) => k.endsWith(suf)).flatMap((k) => STROKES[k].filter((q) => q.a)),
         kitM = mk('_m'), kitE = mk('_e').filter((q) => q.side === 'l' || q.side === 'r'), tb = kitM.length ? kitM[Math.floor(R() * kitM.length)] : null,
         tk = tb ? tb.w / (2.6 * H) : 1, tu0 = R() * 4000, tfl = R() < 0.5 ? -1 : 1, tUp = tb ? tb.b / tk : 0, tDn = tb ? (tb.h - tb.b) / tk : 0,   // a band lies 2.6 screens long (mirrored on past its end)
         smp = (q, u, v) => { const w = q.w, p = 2 * w; u = ((u % p) + p) % p; if (u >= w) u = p - u; u = clamp(u - 0.5, 0, w - 1.001); v = clamp(v, 0, q.h - 1.001); const i = u | 0, j = v | 0, fx = u - i, fy = v - j, o = j * w + i, a = q.a; return ((a[o] * (1 - fx) + a[o + 1] * fx) * (1 - fy) + (a[o + w] * (1 - fx) + a[o + w + 1] * fx) * fy) / 255; },
         MQ = tb ? 4 : 6, rise = yBase - yTop, mg = 0.2 * H, rock = cliff > 0.5, xa = bx0 - extL, xb = bx1 + extR, mx = Math.floor(xa - mg), my = Math.floor(yTop - 0.2 * H), yBot = yBase + 0.19 * H, mw = Math.ceil((xb + mg - mx) / MQ), mh = Math.ceil((yBot - my) / MQ), x1 = mx + mw * MQ;
      const sd = d.seed | 0, h2 = (ix, iy) => { let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + sd) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; },
         v2 = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), a = h2(ix, iy), b = h2(ix + 1, iy), c0 = h2(ix, iy + 1), e = h2(ix + 1, iy + 1); return a + (b - a) * sx + (c0 - a + (a - b - c0 + e) * sx) * sy; },
         f2 = (x, y, o) => { let s = 0, w = 1, t = 0; for (let i = 0; i < o; i++) { s += w * v2(x, y); t += w; w *= 0.5; x = x * 2 + 13.7; y = y * 2 + 7.1; } return s / t; };
      // each end is lost over its own length (never more than a third of the mountain: a single narrow peak keeps its top)
      // (measured from the end of the stroke, not of the ink drawn on past it: begun out there, the mist was thin where a
      // near ridge starts on a far one, and that knot of two inks stayed the darkest spot of the picture)
      const xaE = xa + E, xbE = xb - E, dlL = Math.min(H * (0.06 + 0.2 * R()) * (0.5 + S.mist), 0.33 * (xbE - xaE)), dlR = Math.min(H * (0.06 + 0.2 * R()) * (0.5 + S.mist), 0.33 * (xbE - xaE)),
         lv0 = yBase + H * (0.13 - 0.16 * S.mist) - rise * (0.3 * S.mist + 0.25 * cliff),   // the level of the sea: a tall mountain stands deeper in it
         cMin = H * (0.055 - 0.03 * S.mist), lift = 0.05 * H, A = 0.075 * H;   // cMin: what a low stretch of the ridge keeps of its body
      // two bodies of mist. The sea: all that lies under its level (cM), over the whole mountain. And a bank on each end
      // of the ridge (from cP above the line down to cD, the foot of the ink there), by which the end is lost. (As one
      // body, standing above the ridge at the ends and reaching down from there, an end high on the paper wiped an
      // upright white column out of the mountain behind it)
      const cT = new Float32Array(mw), cM = new Float32Array(mw), cE = new Float32Array(mw), cE2 = new Float32Array(mw), cS = new Float32Array(mw), cD = new Float32Array(mw), short = tb && kitE.length ? 0.45 : 1;   // cE2: the plain bank at the very end, short where a real bank does the rest
      for (let i = 0; i < mw; i++) { const x = mx + (i + 0.5) * MQ, k = clamp(Math.round((x - bx0) / BIN), 0, nb - 1), t = rock ? yTop : Math.min(top[k], ts[k]), lvl = lv0 + 0.07 * H * (2 * N(x / (0.45 * H) + 600, 2) - 1);
        cT[i] = t; cE[i] = rock ? 1 : sm((x - xaE) / dlL) * sm((xbE - x) / dlR); cE2[i] = rock ? 1 : sm((x - xaE) / (short * dlL)) * sm((xbE - x) / (short * dlR)); cM[i] = rock ? lvl : Math.max(lvl, t + cMin); cD[i] = t + depthFull[k] + 0.05 * H; cS[i] = H * (0.045 + 0.09 * N(x / (0.3 * H) + 640, 2)) * (rock ? 2 : 1); }   // cS: how soft the top of the mist is there
      const im = new ImageData(mw, mh), px = im.data, su = 1 / (0.2 * H), sv = 1 / (0.11 * H);   // banks lie longer than they are tall
      const banks = []; if (tb && kitE.length && !rock) for (const [endX, dl, sd] of [[xaE, dlL, 'l'], [xbE, dlR, 'r']]) { const p = kitE[Math.floor(R() * kitE.length)], pw = 1.8 * dl, ph = pw * p.h / p.w, i0 = clamp(Math.round((endX - mx) / MQ), 0, mw - 1);
        banks.push({ p, sd, pw, ph, flip: p.side !== sd, x0: sd === 'l' ? endX - 0.25 * pw : endX - 0.75 * pw, y0: cT[i0] + 0.03 * H - p.c * ph }); }   // the side the mist came in by lies on the end of the ridge
      const vm = new Float32Array(mh); for (let j = 0; j < mh; j++) { const y = my + (j + 0.5) * MQ; vm[j] = sm((y - my) / (0.04 * H)) * sm((yBot - y) / (0.03 * H)); }
      for (let i = 0; i < mw; i++) { const x = mx + (i + 0.5) * MQ, sw = cS[i], e = cE[i], e2 = cE2[i], t = cT[i], band = 1.3 * A + sw, dx = Math.min(x - mx, x1 - x), u = x * su, ut = tfl * x * tk + tu0, edge = dx < 0.27 * H,
           j0 = !tb ? 0 : Math.max(0, Math.floor((banks.reduce((m, bk) => x > bk.x0 && x < bk.x0 + bk.pw ? Math.min(m, bk.y0) : m, (e2 < 0.995 ? Math.min(cM[i], t - lift) : cM[i]) - tUp) - my) / MQ - 0.5));   // above the sea and the banks: nothing
        for (let j = j0; j < mh; j++) { const y = my + (j + 0.5) * MQ, relS = y - cM[i], relP = y - (t - lift), inP = e < 0.995 && relP > -band && y < cD[i];
          if (tb && relS >= tDn && !edge) { px[(j * mw + i) * 4 + 3] = Math.round(vm[j] * 255); continue; }   // deep in the sea
          let a = 1;
          if (tb) { a = relS <= -tUp ? 0 : relS >= tDn ? 1 : 1 - smp(tb, ut, tb.b + relS * tk);
            if (y < cD[i]) { const foot = sm((cD[i] - y) / (0.1 * H));
              // the plain bank only takes the line of the ridge at its very end (down to the foot of the ink it stood as an upright white column, wiped out of whatever lay behind)
              if (e2 < 0.995 && relP > -tUp) a = Math.max(a, (1 - e2) * (relP >= tDn ? 1 : 1 - smp(tb, ut + 517, tb.b + relP * tk)) * foot * sm((t + 0.1 * H - y) / (0.07 * H)));
              for (const bk of banks) { const fu = (x - bk.x0) / bk.pw, fv = (y - bk.y0) / bk.ph; if (fu <= 0 || fu >= 1 || fv <= 0 || fv >= 1) continue; const fi = bk.sd === 'l' ? fu : 1 - fu;
                a = Math.max(a, (1 - smp(bk.p, (bk.flip ? 1 - fu : fu) * bk.p.w, fv * bk.p.h)) * sm(fi / 0.1) * sm((1 - fi) / 0.14) * sm(fv / 0.14) * sm((1 - fv) / 0.14) * foot); } }   // faded on all four sides: left open on the side it came in by, the patch showed as an upright edge
            if (a < 0.004) continue;
            if (dx < 0.27 * H) a *= sm(dx / (H * (0.06 + 0.12 * v2(u + 5.2, y * sv + 1.3)))); }   // no upright edge where the mask ends
          else if (relS < -band && !inP) continue;
          else if (relS < band || dx < 0.27 * H) { const v = y * sv, wx = v2(u + 5.2, v + 1.3), wy = v2(u + 9.1, v + 7.7), nz = f2(u + 1.2 * wx, v + 1.2 * wy, 3), dsp = A * 1.6 * (2 * nz - 1) * (0.5 + wy);   // noise bent by noise: the top rolls, higher in places
            a = sm((relS + dsp) / sw); if (inP) a = Math.max(a, (1 - e) * sm((relP + dsp) / sw) * sm((cD[i] - y) / (0.1 * H)));
            a *= sm(dx / (H * (0.06 + 0.12 * wx))); }   // no upright edge where the mask ends
          a *= 1 - e * (1 - sm((y - t - 0.012 * H) / (0.03 * H)));   // away from the ends the ridge line itself stays, and what stands above it
          a *= vm[j];
          if (a > 0.004) px[(j * mw + i) * 4 + 3] = Math.round(a * 255); } }
      // the real sheets bring crisp edges and paper grain with them: read at one value per 4 px and drawn enlarged, a bank
      // of mist stood on the mountain as a cut-out with a speckled inside (Yang 11-19: "chưa được mềm và mịn"). The mask
      // is blurred once, over about 6 px of paper: the shapes of the real wash stay, their edges melt
      const sharp = document.createElement('canvas'); sharp.width = mw; sharp.height = mh; sharp.getContext('2d').putImageData(im, 0, 0);
      mist = document.createElement('canvas'); mist.width = mw; mist.height = mh; { const x = mist.getContext('2d'); if (tb) x.filter = `blur(${(MSOFT * H / MQ).toFixed(2)}px)`; x.drawImage(sharp, 0, 0); } mxy = [mx, my, MQ]; }
    return { cv, body, mist, mxy, ox, oy, bx0, ts, depth: depthFull, yBase, yTop, extL, extR, tone, peaks: crests.length, ms: Math.round(performance.now() - tB), mistMs: Math.round(performance.now() - tMist) };
  }

  // One stroke -> one river (Yang 11-19, key 2). As it is painted on paper: water is no ink at all, it is the paper left
  // bare; only the banks are drawn, in broken lines, heavier on the outside of a bend, with a little wash on the land
  // and a few thin lines of current. The stroke is the middle of the stream.
  //   width   narrow high on the paper (far), broad low on it (near). A reach running across the view is seen
  //           foreshortened: its banks lie close above each other (FORE); a reach coming down the paper shows its breadth
  //   body    the water itself: bare paper cut out of whatever stands behind (a mountain's body, its mist), soft at the rim
  // Sorted with the mountains by its lowest point: it runs in front of every mountain that ends above that.
  function river(d) {
    const tB = performance.now(), H = D.H, R = dice(d.seed), N = noise1(R), P = calm(d.stroke, STEP, 6), n = P.length;
    if (n < 8) return null;
    const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const L = cum[n - 1], FORE = 0.38, frame = (Q) => Q.map((_, i) => { const a = Q[Math.max(0, i - 3)], b = Q[Math.min(Q.length - 1, i + 3)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; });
    const tan = frame(P), nearY = (y) => clamp((y / H - 0.2) / 0.7, 0, 1), up = P[0][1] <= P[n - 1][1], far = (i) => (up ? cum[i] : L - cum[i]), nr = (i) => L - far(i), env = (i) => sm(far(i) / (0.07 * H)) * sm(nr(i) / (0.16 * H));   // up: drawn from its far end down. The far end narrows to nothing; the near end keeps its breadth and is lost in the paper
    // which way the stream bends at a point: > 0 toward the right-hand bank (B), < 0 toward the left (A)
    const bend = (i) => { const a = tan[Math.max(0, i - 8)], b = tan[Math.min(n - 1, i + 8)]; return a[0] * b[1] - a[1] * b[0]; };
    const hw = P.map((p, i) => H * (0.005 + 0.06 * Math.pow(nearY(p[1]), 1.5)) * (0.75 + 0.5 * N(cum[i] / (0.3 * H) + 3, 2)) * (0.15 + 0.85 * sm(far(i) / (0.14 * H))));
    // the two banks: not parallel, each with its own unevenness
    const bank = (sg, ph) => P.map((p, i) => { const w = hw[i] * (0.85 + 0.3 * N(cum[i] / (0.07 * H) + ph, 2)) + H * 0.004 * (N(cum[i] / (0.025 * H) + ph + 20, 2) - 0.5); return [p[0] - sg * tan[i][1] * w, p[1] + sg * tan[i][0] * w * FORE]; });
    const A = bank(-1, 100), B = bank(1, 200);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const Q of [A, B]) for (const p of Q) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const pad = Math.round(0.08 * H), ox = Math.floor(x0) - pad, oy = Math.floor(y0) - pad, cw = Math.ceil((x1 - x0 + 2 * pad + 2) * dpr), chh = Math.ceil((y1 - y0 + 2 * pad + 2) * dpr);
    const mk = () => { const cv = document.createElement('canvas'); cv.width = cw; cv.height = chh; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr); return [cv, g]; };
    const [cv, g] = mk(), [body, gb] = mk(), [wat, gw] = mk(), [wsh, gs] = mk(), [bnk, gk] = mk();
    const home = (x) => x.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr), raw = (x) => x.setTransform(1, 0, 0, 1, 0, 0);
    const water = (x) => { x.beginPath(); x.moveTo(A[0][0], A[0][1]); for (let i = 1; i < n; i++) x.lineTo(A[i][0], A[i][1]); for (let i = n - 1; i >= 0; i--) x.lineTo(B[i][0], B[i][1]); x.closePath(); };
    // -- the water: bare paper. Cut out soft: a hard-edged white band through a mountain is a strip of tape
    gw.fillStyle = '#000'; water(gw); gw.fill();
    raw(gb); gb.filter = `blur(${(0.016 * H * dpr).toFixed(1)}px)`; gb.globalAlpha = 0.6; gb.drawImage(wat, 0, 0); gb.filter = `blur(${(0.003 * H * dpr).toFixed(1)}px)`; gb.globalAlpha = 1; gb.drawImage(wat, 0, 0); gb.filter = 'none'; home(gb);
    // -- the banks. Where each is drawn at all: in stretches, by noise, and more on the outside of a bend, where the
    //    stream cuts into the land (never even along the whole river: that reads as an outline)
    const gate = (sg, ph) => (i) => N(cum[i] / (0.16 * H) + ph, 2) + clamp(-sg * bend(i) * 0.9, -0.12, 0.28);
    const kit = (STROKES[S.tex] || []).filter((q) => q.im);
    // the river's own sheets (Yang 11-19: its banks borrowed the ridge strokes of a mountain): _f banks, waterline on top,
    // flicks and pebbles hanging off it onto the land; _g hair lines of current; _r ripples; _k riverside rocks
    const own = (suf) => { if (S.tex === 'code') return []; const a = (STROKES[S.tex + suf] || []).filter((q) => q.im); return a.length ? a : (STROKES['muse' + suf] || []).filter((q) => q.im); };
    const kitF = own('_f'), kitG = own('_g'), kitR = own('_r').filter((q) => q.tone < 0.15), kitK = own('_k').concat(own('_r').filter((q) => q.tone >= 0.15)),   // a wide group of rocks is cut as a long piece like a ripple: told apart by how much ink it holds
       bankKit = kitF.length ? kitF : kit, tall = kitF.length ? 1.9 : 1, lift = kitF.length ? 0.03 : 0.12, sides = [];
    for (const [E, sg, ph] of [[A, -1, 300], [B, 1, 400]]) {
      const ga = gate(sg, ph), gz = gate(sg, ph + 37), et = frame(E), ec = [0]; for (let i = 1; i < n; i++) ec.push(ec[i - 1] + Math.hypot(E[i][0] - E[i - 1][0], E[i][1] - E[i - 1][1]));
      // a little wash on the land along the bank, where the bank is dark
      sides.push({ E, ga, sg }); gs.lineCap = 'round'; gs.strokeStyle = '#000';
      for (let i = 1; i < n; i++) { if (gz(i) < 0.56) continue; gs.lineWidth = (0.012 * H + 0.7 * hw[i]) * env(i); gs.beginPath(); gs.moveTo(E[i - 1][0], E[i - 1][1]); gs.lineTo(E[i][0], E[i][1]); gs.stroke(); }
      const tone = (i) => env(i) * (0.4 + 0.6 * nearY(E[i][1]));   // far reaches pale
      if (bankKit.length) {   // the bank line: a real stroke in thin slices, its dark edge on the water, the rest on the land
        const q = bankKit[Math.floor(R() * bankKit.length) % bankKit.length], ds = 2, per = 0.6 * H, off = R() * 2; let j = 0;
        for (let a = 0; a < ec[n - 1]; a += ds) {
          while (j < n - 2 && ec[j + 1] < a) j++;
          const al = sm((ga(j) - 0.42) / 0.12) * env(j); if (al < 0.05) continue;   // a stretch of bank begins and ends thin, the brush set down and lifted
          const f = clamp((a - ec[j]) / Math.max(1e-6, ec[j + 1] - ec[j]), 0, 1), px = E[j][0] + (E[j + 1][0] - E[j][0]) * f, py = E[j][1] + (E[j + 1][1] - E[j][1]) * f, tx = et[j][0], ty = et[j][1];
          const th = tall * al * H * (0.006 + 0.013 * nearY(py)) * (0.7 + 0.6 * N(a / (0.05 * H) + ph + 60, 2)); let v = (a / per + off) % 2; if (v > 1) v = 2 - v;
          gk.setTransform(dpr * tx, dpr * ty, -sg * dpr * ty, sg * dpr * tx, dpr * (px - ox), dpr * (py - oy));   // laid opaque: slices overlap a little, and at part alpha every overlap showed as a dark hair, the bank as a comb
          gk.drawImage(q.im, clamp(v * (q.w - 2), 0, q.w - 2), 0, Math.max(1, (ds + 0.8) / per * q.w), q.h, 0, -lift * th, ds + 0.8, th);
        }
        home(gk);
      } else { g.strokeStyle = `rgb(${INK})`; g.lineCap = 'round';
        for (let i = 1; i < n; i++) { const al = sm((ga(i) - 0.42) / 0.12) * tone(i); if (al < 0.02) continue; g.globalAlpha = al * 0.8; g.lineWidth = H * (0.0015 + 0.003 * nearY(E[i][1])) * (0.6 + 0.8 * N(cum[i] / (0.03 * H) + ph, 2)); g.beginPath(); g.moveTo(E[i - 1][0], E[i - 1][1]); g.lineTo(E[i][0], E[i][1]); g.stroke(); }
        g.globalAlpha = 1; }
    }
    // a few rocks on the banks, where a bank is drawn: standing upright, their foot on the waterline
    if (kitK.length) for (let k = 0, cnt = Math.round(L / (0.3 * H)); k < cnt; k++) { const sd = sides[R() < 0.5 ? 0 : 1], q = kitK[Math.floor(R() * kitK.length) % kitK.length]; let i = -1;
      for (let t = 0; t < 6 && i < 0; t++) { const c2 = 4 + Math.floor(R() * (n - 8)); if (sd.ga(c2) > 0.5 && env(c2) > 0.6) i = c2; }
      if (i < 0) continue; const w = H * (0.012 + 0.026 * nearY(sd.E[i][1])) * (0.7 + 0.6 * R()), h = w * q.h / q.w; gk.drawImage(q.im, sd.E[i][0] - sd.sg * tan[i][1] * w * 0.3 - w / 2, sd.E[i][1] - h * 0.82, w, h); }
    { raw(gk); const gd = gk.createLinearGradient(0, 0, 0, chh); for (let k = 0; k <= 8; k++) gd.addColorStop(k / 8, `rgba(0,0,0,${(0.78 * (0.4 + 0.6 * nearY(oy + k / 8 * chh / dpr))).toFixed(3)})`);   // far reaches pale
      gk.globalCompositeOperation = 'destination-in'; gk.fillStyle = gd; gk.fillRect(0, 0, cw, chh); raw(g); g.drawImage(bnk, 0, 0); home(g); }
    gs.globalCompositeOperation = 'destination-out'; gs.fillStyle = '#000'; water(gs); gs.fill(); gs.globalCompositeOperation = 'source-over';
    { const [w2, g2] = mk(); raw(g2); g2.filter = `blur(${(0.009 * H * dpr).toFixed(1)}px)`; g2.drawImage(wsh, 0, 0); g2.filter = 'none'; g2.globalCompositeOperation = 'source-in'; g2.fillStyle = `rgb(${INK})`; g2.fillRect(0, 0, cw, chh);
      raw(g); g.globalAlpha = 0.22; g.globalCompositeOperation = 'destination-over'; g.drawImage(w2, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; home(g); }
    // -- the current: a few thin lines along the stream, short, each keeping to its own place between the banks
    g.strokeStyle = `rgb(${INK})`; g.lineCap = 'round';
    if (kitG.length) { const [cur, gc] = mk();   // real hair lines, laid opaque and paled as one (as the banks)
      for (let k = 0, cnt = Math.round(L / (0.08 * H)); k < cnt; k++) {
        const i0 = Math.floor(R() * (n - 4)), i1 = Math.min(n - 1, i0 + Math.round(H * (0.05 + 0.15 * R()) / STEP)), u0 = (R() < 0.5 ? -1 : 1) * (0.3 + 0.45 * R()), ph = R() * 90, q = kitG[Math.floor(R() * kitG.length) % kitG.length], fr = R();
        if (i1 - i0 < 4 || hw[(i0 + i1) >> 1] < 0.012 * H) continue; const Q = [];
        for (let i = i0; i <= i1; i++) { const w = hw[i] * clamp(u0 + 0.3 * (N(cum[i] / (0.06 * H) + ph, 2) - 0.5), -0.8, 0.8); Q.push([P[i][0] - tan[i][1] * w, P[i][1] + tan[i][0] * w * FORE]); }
        const lp = cum[i1] - cum[i0], frac = clamp(lp / (0.5 * H), 0.15, 0.9), us = fr * (1 - frac) * q.w, th0 = H * (0.0022 + 0.003 * nearY(Q[0][1])) * (0.7 + 0.6 * fr), ds = 2, m = Q.length;   // th0: the height of the piece, the line in it about half of that. (At the piece's own proportions a short stretch of it came out as a grey bar)
        for (let a = 0; a < lp; a += ds) { const fi = a / lp * (m - 1), j = Math.min(m - 2, fi | 0), f = fi - j, th = th0 * (0.15 + 0.85 * sm(a / (0.3 * lp)) * sm((lp - a) / (0.3 * lp))), dx = Q[j + 1][0] - Q[j][0], dy = Q[j + 1][1] - Q[j][1], l = Math.hypot(dx, dy) || 1;
          gc.setTransform(dpr * dx / l, dpr * dy / l, -dpr * dy / l, dpr * dx / l, dpr * (Q[j][0] + dx * f - ox), dpr * (Q[j][1] + dy * f - oy)); gc.drawImage(q.im, clamp(us + a / lp * frac * q.w, 0, q.w - 2), 0, Math.max(1, (ds + 0.8) / lp * frac * q.w), q.h, 0, -th / 2, ds + 0.8, th); } }
      home(gc);
      // ripples: a few small flat waves in the broad reaches, lying level whichever way the stream runs
      if (kitR.length) for (let k = 0, cnt = Math.round(L / (0.22 * H)); k < cnt; k++) { const i = Math.floor(R() * n), q = kitR[Math.floor(R() * kitR.length) % kitR.length], u = (R() - 0.5) * 0.9, sz = R(); if (hw[i] < 0.022 * H || env(i) < 0.5) continue;
        const w = Math.min(0.09 * H, hw[i] * (0.6 + 0.6 * sz)), h = w * q.h / q.w; gc.drawImage(q.im, P[i][0] - tan[i][1] * hw[i] * u - w / 2, P[i][1] + tan[i][0] * hw[i] * u * FORE - h / 2, w, h); }
      raw(gc); const gd = gc.createLinearGradient(0, 0, 0, chh); for (let k = 0; k <= 8; k++) gd.addColorStop(k / 8, `rgba(0,0,0,${(0.6 * (0.4 + 0.6 * nearY(oy + k / 8 * chh / dpr))).toFixed(3)})`);
      gc.globalCompositeOperation = 'destination-in'; gc.fillStyle = gd; gc.fillRect(0, 0, cw, chh); raw(g); g.drawImage(cur, 0, 0); home(g);
    } else for (let k = 0, cnt = Math.round(L / (0.07 * H)); k < cnt; k++) {   // near the banks, the middle of the stream left bare (long and down the middle they were the lane lines of a road)
      const i0 = Math.floor(R() * (n - 4)), len = Math.round(H * (0.03 + 0.07 * R()) / STEP), u0 = (R() < 0.5 ? -1 : 1) * (0.4 + 0.35 * R()), ph = R() * 90, a0 = 0.1 + 0.16 * R(), w0 = 0.0011 + 0.0012 * R();
      g.beginPath(); let m = 0;
      for (let i = i0; i < Math.min(n, i0 + len); i++, m++) { const u = clamp(u0 + 0.3 * (N(cum[i] / (0.06 * H) + ph, 2) - 0.5), -0.8, 0.8), w = hw[i] * u, x = P[i][0] - tan[i][1] * w, y = P[i][1] + tan[i][0] * w * FORE; if (m) g.lineTo(x, y); else g.moveTo(x, y); }
      const im = Math.min(n - 1, i0 + (len >> 1)); g.globalAlpha = a0 * env(im) * (0.4 + 0.6 * nearY(P[im][1])) * sm(hw[im] / (0.012 * H)); g.lineWidth = H * w0 * (0.6 + 0.8 * nearY(P[im][1])); g.stroke();   // none in a far reach too narrow to hold one
    }
    g.globalAlpha = 0.11; raw(g); g.globalCompositeOperation = 'destination-out'; g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, cw, chh); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; home(g);
    return { river: true, cv, body, mist: null, mxy: [0, 0, 1], ox, oy, yBase: y1, yTop: y0, tone: 1, peaks: 0, ms: Math.round(performance.now() - tB), mistMs: 0 };
  }

  const RIM = 0.006;   // how far before a near ridge the mountain behind it begins to pale, in screen heights
  const MSOFT = 0.006;   // how far the edge of the mist is melted, in screen heights
  const MIST = 1.0;   // seconds the mist takes to gather over a mountain's body, once its ink has run down
  const REVEAL = 1.6;   // seconds the ink takes to run down from the ridge
  const bake = document.createElement('canvas'); let bakeKey = '';
  const lay = (x, m, alpha) => { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = alpha; x.drawImage(m.cv, Math.round(m.ox * dpr), Math.round(m.oy * dpr)); x.globalAlpha = 1; };
  function render() {
    const W = D.W, H = D.H, T = D.T; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    for (const d of st.done) if (d.m === undefined || d.m === null && d.m !== false) d.m = (d.kind === 'river' ? river(d) : mountain(d)) || false;
    // finished mountains do not change: baked once, far ones first, each hiding what stands behind its body
    const old = st.done.filter((d) => d.m && T - d.t0 >= REVEAL).sort((p, q) => p.m.yBase - q.m.yBase), mistA = (d) => sm((T - d.t0 - REVEAL) / MIST), key = old.map((d) => d.seed + ':' + d.t0 + ':' + Math.round(mistA(d) * 24)).join() + '|' + ink.width + 'x' + ink.height;
    if (key !== bakeKey) { bakeKey = key; bake.width = ink.width; bake.height = ink.height; const b = bake.getContext('2d');
      for (const d of old) { b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'destination-out'; b.globalAlpha = 1; b.drawImage(d.m.body, Math.round(d.m.ox * dpr), Math.round(d.m.oy * dpr)); b.globalCompositeOperation = 'source-over'; lay(b, d.m, d.m.tone);
        if (d.m.mist) { const [mx, my, q] = d.m.mxy; b.globalCompositeOperation = 'destination-out'; b.globalAlpha = mistA(d); b.imageSmoothingEnabled = true; b.imageSmoothingQuality = 'high'; b.drawImage(d.m.mist, Math.round(mx * dpr), Math.round(my * dpr), d.m.mist.width * q * dpr, d.m.mist.height * q * dpr); b.globalAlpha = 1; b.globalCompositeOperation = 'source-over'; } } }
    if (old.length) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(bake, 0, 0); c.restore(); }
    for (const d of st.done) if (d.m && T - d.t0 < REVEAL) {   // the newest: its ink still running down from the ridge
      const a = clamp((T - d.t0) / REVEAL, 0, 1), e = sm(a), m = d.m;
      if (m.river) {   // a river comes up all at once: the water clears, the banks darken
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-out'; c.globalAlpha = e; c.drawImage(m.body, Math.round(m.ox * dpr), Math.round(m.oy * dpr)); c.globalCompositeOperation = 'source-over'; lay(c, m, e); c.restore();
        strokePath(d.stroke, 0.85 * (1 - clamp(a * 3, 0, 1))); continue; }
      const nb = m.ts.length;
      c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.beginPath(); c.moveTo(m.bx0 - 0.05 * H, m.ts[0] - 0.12 * H);
      for (let k = 0; k < nb; k += 4) c.lineTo(m.bx0 + k * BIN, m.ts[k] - 0.12 * H); c.lineTo(m.bx0 + nb * BIN + 0.05 * H, m.ts[nb - 1] - 0.12 * H);
      for (let k = nb - 1; k >= 0; k -= 4) c.lineTo(m.bx0 + k * BIN + (k > nb - 5 ? 0.05 * H : 0), m.ts[k] + 0.02 * H + e * m.depth[k]); c.lineTo(m.bx0 - 0.05 * H, m.ts[0] + 0.02 * H + e * m.depth[0]); c.closePath();
      if (m.extL + m.extR > 0) c.rect(m.bx0 - m.extL - 0.05 * H, m.yTop - 0.12 * H, nb * BIN + m.extL + m.extR + 0.1 * H, 0.14 * H + e * (m.yBase - m.yTop + 0.2 * H));   // a rock face: its ink lies beside the stroke
      c.clip();
      lay(c, m, m.tone * clamp(a * 3, 0, 1)); c.restore();
      strokePath(d.stroke, 0.85 * (1 - clamp(a * 3, 0, 1)));
    }
    if (st.stroke.length > 1) strokePath(st.stroke, 0.85);
    if (T - st.msgT < 3) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.font = '15px Consolas, monospace'; const tw = c.measureText(st.msg).width, x = freeW() / 2 - tw / 2, y = H * 0.5;
      c.globalAlpha = clamp(3 - (T - st.msgT), 0, 1); c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(x - 10, y - 20, tw + 20, 30); c.fillStyle = '#111'; c.fillText(st.msg, x, y); c.globalAlpha = 1;
    }
  }
  const d0 = Rm.G.draw;
  Rm.G.draw = (dt) => { const t0 = performance.now(); if (dt > 0) step(dt); render(); d0(dt); Rm.st.jsMs = (Rm.st.jsMs || 0) * 0.9 + (performance.now() - t0) * 0.1; };   // jsMs: what paint + overlay cost a frame

  // ---- input + panel ------------------------------------------------------------------------------------------------
  document.addEventListener('mousedown', (e) => { if (e.button === 0 && Rm.st.locked) penDown(); });
  document.addEventListener('mouseup', (e) => { if (e.button === 0) penUp(); });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) penUp(); });
  const SL = [['peak', 'Vuốt đỉnh nhọn'], ['cun', 'Nét sườn núi'], ['dry', 'Độ khô / độ dày nét'], ['body', 'Độ đậm thân núi'], ['mist', 'Lượng sương (0 = tắt)']];
  const pbox = document.createElement('div');
  pbox.innerHTML = `<h3>Vẽ núi (tự do)</h3><div id="p_stat" class="keys"></div>
    <button id="p_undo">Bỏ nét cuối (Z)</button><button id="p_clear">Xóa tranh (C)</button><button id="p_again">Vẽ lại kiểu khác (X)</button><button id="p_tex"></button>
    ${SL.map(([k, name]) => `<label><span class="row"><span>${name}</span><b id="p_${k}v"></b></span><input type="range" id="p_${k}" min="0" max="1" step="0.05"></label>`).join('')}
    <div class="keys">Giữ chuột trái: hạ bút, rồng bay tới đâu vẽ tới đó
Thả chuột: nét thành núi hoặc sông
Phím 1: nét núi. Phím 2: nét sông
Vẽ cao trên giấy: xa, nhạt, sông hẹp
Vẽ thấp: gần, đậm, sông rộng</div>`;
  panel.insertBefore(pbox, panel.firstChild);
  const $ = (id) => document.getElementById(id);
  const redo = (reseed) => { for (const d of st.done) { d.m = null; if (reseed) d.seed = (Math.random() * 2147483647) | 0; } bakeKey = ''; };
  const nextTex = () => { S.tex = TEX[(TEX.indexOf(S.tex) + 1) % TEX.length]; save(); redo(false); say('Nét bút: ' + S.tex); sync(); };
  $('p_tex').onclick = nextTex;
  $('p_clear').onclick = reset; $('p_undo').onclick = undo; $('p_again').onclick = () => redo(true);
  for (const [k] of SL) $('p_' + k).addEventListener('input', (e) => { S[k] = +e.target.value; save(); redo(false); sync(); });
  function sync() {
    if (!$('p_stat')) return;
    $('p_stat').textContent = `Nét đang chọn: ${KINDS.map(([id, name], i) => (id === st.kind ? `[${i + 1} ${name}]` : `${i + 1} ${name}`)).join('  ')}\n` + (st.done.length ? `Đã vẽ ${st.done.length} nét` : 'Giấy trắng. Giữ chuột trái và bay một nét');
    $('p_tex').textContent = `Nét bút: ${S.tex} (B)`;
    for (const [k] of SL) { $('p_' + k).value = S[k]; $('p_' + k + 'v').textContent = S[k].toFixed(2); }
  }
  sync();
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'c') reset(); else if (k === 'z') undo(); else if (k === 'x') redo(true); else if (k === 'b') nextTex();
    else if (KINDS[+k - 1] && !st.pen) { st.kind = KINDS[+k - 1][0]; say('Nét: ' + KINDS[+k - 1][1]); sync(); }
  });

  window.__paint = { S, st, step, render, reset, undo, freeW, ready: () => strokesReady, pen: (on) => (on ? penDown() : penUp()),
    info: () => ({ strokes: st.done.length, pen: st.pen, peaks: st.done.map((d) => (d.m ? d.m.peaks : null)), buildMs: st.done.map((d) => (d.m ? d.m.ms : null)), mistMs: st.done.map((d) => (d.m ? d.m.mistMs : null)), S: { ...S } }) };
})();
