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
  const S = { peak: 0.6, cun: 0.6, dry: 0.5, body: 0.5, tex: 'muse' };   // tex: whose brush strokes the ridge is laid with (muse / gemini / gpt), or 'code' = drawn by code
  const TEX = ['code', 'muse', 'gemini', 'gpt'];   // peak: how far crests are drawn up into points; cun: how many texture strokes; dry: how dry the brush
  try { Object.assign(S, JSON.parse(localStorage.getItem('paint.v2') || '{}')); } catch { /* defaults */ }
  { const q = new URLSearchParams(location.search).get('tex'); if (q) S.tex = q; }
  const save = () => { try { localStorage.setItem('paint.v2', JSON.stringify(S)); } catch { /* ok */ } };
  const freeW = () => D.W - (panel.classList.contains('hide') ? 0 : panel.offsetWidth);
  const INK = '18,18,24';

  // ---- state --------------------------------------------------------------------------------------------------------
  const st = { pen: false, stroke: [], done: [], msg: '', msgT: -9 };
  const say = (s) => { st.msg = s; st.msgT = D.T; };
  function reset() { st.pen = false; st.stroke = []; st.done = []; bakeKey = ''; sync(); }
  function undo() { if (st.done.pop()) { bakeKey = ''; sync(); } }
  function penDown() { if (st.pen) return; st.pen = true; st.stroke = []; }
  function penUp() {
    if (!st.pen) return; st.pen = false;
    const q = st.stroke; st.stroke = []; let L = 0; for (let i = 1; i < q.length; i++) L += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
    if (L < 0.06 * D.H) return;   // a tap, not a stroke
    st.done.push({ stroke: q, t0: D.T, seed: (Math.random() * 2147483647) | 0 }); sync();
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
    for (const k in man) { STROKES[k] = man[k]; for (const q of man[k]) { left++; const im = new Image(); im.onload = () => { q.im = im; if (--left === 0) { strokesReady = true; for (const d of st.done) d.m = null; bakeKey = ''; } }; im.src = '../assets/strokes/' + q.f; } } }).catch(() => { strokesReady = true; });
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
    const depthAt = (t, x) => ((yBase - t) * 1.0 + 0.17 * H) * (E ? 0.05 + 0.95 * envD(x) : 0.45 + 0.55 * envX(x)), depth = ts.map((t, k) => depthAt(t, bx0 + k * BIN));
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
    for (const f of fields) for (let k = 0; k < f.m; k++) {
      const x = f.x0 + k * BIN, t = f.ts[k], ee = envX(x), dd = depthAt(t, x), sh = f.shade[k], y0 = Math.min(f.top[k], t) - 1,
         e = ee * (1 - cliff) * (folded ? sm(Math.min(k, f.m - 1 - k) / fr) : 1),   // a stretch's ink thins toward the turn, or its end stood as a plumb edge in the body
         X = DX(x), Wd = DX(x + BIN) - X, Y0 = DY(y0), T = DY(t);
      const a0 = Math.min(0.95, 0.56 * bm * (0.85 + 0.3 * sh) * e * (0.85 + 0.3 * N(x / (0.12 * H) + 3, 2)));
      // past the end of the stroke there is no line: the ink has no upper edge there, it comes up out of nothing (mist)
      const soft = E ? 1 - sm(clamp(Math.max(bx0 + E - x, x - (bx1 - E)) / E, 0, 1) * 1.4) : 1;
      let gd = g.createLinearGradient(0, T, 0, DY(t + dd)); gd.addColorStop(0, `rgba(${INK},${(a0 * soft).toFixed(3)})`); gd.addColorStop(0.1, `rgba(${INK},${(a0 * 0.7 * (0.3 + 0.7 * soft)).toFixed(3)})`); gd.addColorStop(0.3, `rgba(${INK},${(a0 * (0.34 + mid)).toFixed(3)})`); gd.addColorStop(0.6, `rgba(${INK},${(a0 * (0.1 + mid)).toFixed(3)})`); gd.addColorStop(1, `rgba(${INK},0)`);
      g.fillStyle = gd; g.fillRect(X, Y0, Wd, DY(t + dd) - Y0);
      const d2 = Math.min(dd * 0.3, 0.075 * H) * (0.45 + 1.1 * N(x / (0.13 * H) + 40, 2)),   // capped: on a tall peak its lower edge showed as a level line across the body
         a2 = Math.min(0.9, 0.34 * bm * clamp(0.5 + 0.7 * sh, 0.12, 1) * e);
      gd = g.createLinearGradient(0, T, 0, DY(t + d2)); gd.addColorStop(0, `rgba(${INK},${a2.toFixed(3)})`); gd.addColorStop(0.6, `rgba(${INK},${(a2 * 0.5).toFixed(3)})`); gd.addColorStop(1, `rgba(${INK},0)`);
      if (qc) {   // a real band of wash, its dark wet edge under the ridge; a second one drawn long and faint down the body
        const h1 = Math.min(dd * 0.5, 0.11 * H) * (0.75 + 0.5 * N(x / (0.2 * H) + 40, 2)), w1 = Math.max(1, BIN * sc1), w2 = Math.max(1, BIN * sc2);
        g.globalAlpha = Math.min(1, 0.6 * bm * clamp(0.6 + 0.6 * sh, 0.3, 1) * e) * soft * soft; g.drawImage(qc.im, Math.min(qc.w - w1, pp((x - bx0) * sc1 + uo1, qc.w)), 0, w1, qc.h, X, T - 1, Wd, h1 * dpr);
        g.globalAlpha = Math.min(1, 0.26 * bm * e) * soft * soft; g.drawImage(qc2.im, Math.min(qc2.w - w2, pp((x - bx0) * sc2 + uo2, qc2.w)), 0, w2, qc2.h, X, T - 1, Wd, Math.min(dd * 0.45, 0.2 * H) * (0.8 + 0.4 * N(x / (0.3 * H) + 61, 2)) * dpr); g.globalAlpha = 1;   // kept near its own size: drawn 0.4 of a screen deep on a tall peak, its torn edge stretched into spikes
      } else if (soft > 0.98) { g.fillStyle = gd; g.fillRect(X, Y0, Wd, DY(t + d2) - Y0); }
      gd = gb.createLinearGradient(0, T, 0, DY(t + dd)); const hm = (Math.pow(sm(e), 2.5) * (E ? Math.pow(envD(x), 1.5) : 1)).toFixed(3); gd.addColorStop(0, `rgba(0,0,0,${(hm * soft).toFixed(3)})`); gd.addColorStop(0.15, `rgba(0,0,0,${hm})`); gd.addColorStop(0.6, `rgba(0,0,0,${hm})`);   // and a little less: where its ink is thin the two lie over each other, or a pale sliver stood between them   // hides as much as its own ink covers: held full while the ink thinned at a stroke's end, it left a white upright gap beside a dark band (r007) gd.addColorStop(1, 'rgba(0,0,0,0)');
      gb.fillStyle = gd; gb.fillRect(X, Y0, Wd, DY(t + dd) - Y0);
    }
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
        if (qc) { g.setTransform(0, 1, side, 0, X0, Y); g.globalAlpha = Math.min(1, a * 1.5); g.drawImage(qc.im, Math.min(qc.w - wr, pp((y - yTop) * scr + uo1, qc.w)), 0, wr, qc.h, 0, 0, Hd, len * 0.6 * dpr); g.globalAlpha = 1; raw(g); }   // a real band of wash turned on its side, its wet edge on the stroke
        const fb = 1 - sm((f - 0.5) / 0.5); gd = gb.createLinearGradient(X0, 0, X1, 0); gd.addColorStop(0, `rgba(0,0,0,${Math.min(1, 1.6 * cliff * fb).toFixed(3)})`); gd.addColorStop(0.5, `rgba(0,0,0,${Math.min(1, 1.3 * cliff * fb).toFixed(3)})`); gd.addColorStop(1, 'rgba(0,0,0,0)');
        gb.fillStyle = gd; gb.fillRect(Math.min(X0, X1), Y, Math.abs(X1 - X0), Hd); }
      home(g); home(gb); g.globalCompositeOperation = 'source-atop';
      for (let r = 4; r < rowsN - 4; r += Math.max(1, Math.round((0.012 + 0.03 * R()) * H / BIN))) { if (xs[r] === null) continue; const an = 0.5 + 0.8 * R(), lean = 1.2;
        mark(xs[r] + side * 0.004 * H, yTop + r * BIN, side > 0 ? an : 3.1416 - an, CL * (0.25 + 0.5 * R()) * sm(r / rowsN / 0.3 + 0.2), H * 0.006 * (0.6 + 0.8 * R()), (0.25 + 0.3 * R()) * cliff * S.cun / 0.6, side > 0 ? lean : 3.1416 - lean); }
      g.globalCompositeOperation = 'source-over'; }
    // -- the ridge line: a ribbon along the path, a little more of it on the mountain's side
    const near = (i) => { let b = 1e9; for (const k of crests) b = Math.min(b, Math.abs(cum[k] - cum[i])); return b; };
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
        const p0 = P[Math.max(0, j - 2)], p1 = P[Math.min(n - 1, j + 3)], tl = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1, tx = (p1[0] - p0[0]) / tl, ty = (p1[1] - p0[1]) / tl;
        const th = H * 0.044 * (0.6 + 0.55 * clamp(prAt[j], 0, 1.6)) * (0.8 + 0.4 * S.dry), u = (back ? 1 - (a + ds) / L : a / L) * q.w;
        gr.setTransform(dpr * tx, dpr * ty, dpr * nrm[j][0], dpr * nrm[j][1], dpr * (px - ox), dpr * (py - oy));
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
    return { cv, body, ox, oy, bx0, ts, depth, yBase, yTop, extL, extR, tone, peaks: crests.length, ms: Math.round(performance.now() - tB) };
  }

  const REVEAL = 1.6;   // seconds the ink takes to run down from the ridge
  const bake = document.createElement('canvas'); let bakeKey = '';
  const lay = (x, m, alpha) => { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = alpha; x.drawImage(m.cv, Math.round(m.ox * dpr), Math.round(m.oy * dpr)); x.globalAlpha = 1; };
  function render() {
    const W = D.W, H = D.H, T = D.T; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    for (const d of st.done) if (d.m === undefined || d.m === null && d.m !== false) d.m = mountain(d) || false;
    // finished mountains do not change: baked once, far ones first, each hiding what stands behind its body
    const old = st.done.filter((d) => d.m && T - d.t0 >= REVEAL).sort((p, q) => p.m.yBase - q.m.yBase), key = old.map((d) => d.seed + ':' + d.t0).join() + '|' + ink.width + 'x' + ink.height;
    if (key !== bakeKey) { bakeKey = key; bake.width = ink.width; bake.height = ink.height; const b = bake.getContext('2d');
      for (const d of old) { b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'destination-out'; b.globalAlpha = 1; b.drawImage(d.m.body, Math.round(d.m.ox * dpr), Math.round(d.m.oy * dpr)); b.globalCompositeOperation = 'source-over'; lay(b, d.m, d.m.tone); } }
    if (old.length) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(bake, 0, 0); c.restore(); }
    for (const d of st.done) if (d.m && T - d.t0 < REVEAL) {   // the newest: its ink still running down from the ridge
      const a = clamp((T - d.t0) / REVEAL, 0, 1), e = sm(a), m = d.m, nb = m.ts.length;
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
  const SL = [['peak', 'Vuốt đỉnh nhọn'], ['cun', 'Nét sườn núi'], ['dry', 'Độ khô / độ dày nét'], ['body', 'Độ đậm thân núi']];
  const pbox = document.createElement('div');
  pbox.innerHTML = `<h3>Vẽ núi (tự do)</h3><div id="p_stat" class="keys"></div>
    <button id="p_undo">Bỏ nét cuối (Z)</button><button id="p_clear">Xóa tranh (C)</button><button id="p_again">Vẽ lại kiểu khác (X)</button><button id="p_tex"></button>
    ${SL.map(([k, name]) => `<label><span class="row"><span>${name}</span><b id="p_${k}v"></b></span><input type="range" id="p_${k}" min="0" max="1" step="0.05"></label>`).join('')}
    <div class="keys">Giữ chuột trái: hạ bút, rồng bay tới đâu vẽ tới đó
Thả chuột: nét thành núi
Vẽ cao trên giấy: núi xa, nhạt
Vẽ thấp: núi gần, đậm</div>`;
  panel.insertBefore(pbox, panel.firstChild);
  const $ = (id) => document.getElementById(id);
  const redo = (reseed) => { for (const d of st.done) { d.m = null; if (reseed) d.seed = (Math.random() * 2147483647) | 0; } bakeKey = ''; };
  const nextTex = () => { S.tex = TEX[(TEX.indexOf(S.tex) + 1) % TEX.length]; save(); redo(false); say('Nét bút: ' + S.tex); sync(); };
  $('p_tex').onclick = nextTex;
  $('p_clear').onclick = reset; $('p_undo').onclick = undo; $('p_again').onclick = () => redo(true);
  for (const [k] of SL) $('p_' + k).addEventListener('input', (e) => { S[k] = +e.target.value; save(); redo(false); sync(); });
  function sync() {
    if (!$('p_stat')) return;
    $('p_stat').textContent = st.done.length ? `Đã vẽ ${st.done.length} nét` : 'Giấy trắng. Giữ chuột trái và bay một nét';
    $('p_tex').textContent = `Nét bút: ${S.tex} (B)`;
    for (const [k] of SL) { $('p_' + k).value = S[k]; $('p_' + k + 'v').textContent = S[k].toFixed(2); }
  }
  sync();
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'c') reset(); else if (k === 'z') undo(); else if (k === 'x') redo(true); else if (k === 'b') nextTex();
  });

  window.__paint = { S, st, step, render, reset, undo, freeW, ready: () => strokesReady, pen: (on) => (on ? penDown() : penUp()),
    info: () => ({ strokes: st.done.length, pen: st.pen, peaks: st.done.map((d) => (d.m ? d.m.peaks : null)), buildMs: st.done.map((d) => (d.m ? d.m.ms : null)), S: { ...S } }) };
})();
