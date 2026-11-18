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
  const S = { peak: 0.6, cun: 0.6, dry: 0.5 };   // peak: how far crests are drawn up into points; cun: how many texture strokes; dry: how dry the brush
  try { Object.assign(S, JSON.parse(localStorage.getItem('paint.v2') || '{}')); } catch { /* defaults */ }
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

  const STEP = 3, BIN = 2;   // px between points of the calmed stroke; px per column of the wash
  // One stroke -> one mountain, on canvases cropped to it: cv (the ink) and body (what it hides of the mountains behind)
  function mountain(d) {
    const tB = performance.now(), H = D.H, R = dice(d.seed), N = noise1(R), P = calm(d.stroke, STEP, 4), n = P.length;
    if (n < 8) return null;
    // -- peaks: every crest of the path (a top, standing at least a little above both its sides) is drawn up into a point;
    //    the saddles between are cut a little deeper. A tent laid on a round top gives the break of a real summit
    const win = Math.max(4, Math.round(0.1 * H / STEP)), tr = Math.max(4, Math.round(0.055 * H / STEP)), crests = [];
    const tent = (k, h, skew) => { const r = tr; for (let i = Math.max(0, k - r); i <= Math.min(n - 1, k + r); i++) { const w = Math.pow(1 - Math.abs(i - k) / (r + 1), 1.6); P[i][1] -= h * w; P[i][0] += skew * Math.abs(h) * w; } };
    { const y = P.map((p) => p[1]), found = [];
      for (let k = 2; k < n - 2; k++) {
        let lo = true, hi = true, l = -1e9, r = -1e9, l2 = 1e9, r2 = 1e9;
        for (let j = Math.max(0, k - win); j <= Math.min(n - 1, k + win); j++) { if (y[j] < y[k] || (y[j] === y[k] && j < k)) lo = false; if (y[j] > y[k] || (y[j] === y[k] && j < k)) hi = false; if (j < k) { l = Math.max(l, y[j]); l2 = Math.min(l2, y[j]); } else if (j > k) { r = Math.max(r, y[j]); r2 = Math.min(r2, y[j]); } }
        if (lo && Math.min(l, r) - y[k] > 0.01 * H) found.push([k, Math.min(l, r) - y[k], 1]);
        else if (hi && y[k] - Math.max(l2, r2) > 0.01 * H) found.push([k, y[k] - Math.max(l2, r2), -1]);
      }
      for (const [k, prom, up] of found) { const h = S.peak * clamp(prom * 0.9, 0.015 * H, 0.085 * H) * (0.7 + 0.6 * R()); tent(k, up > 0 ? h : -0.45 * h, (R() - 0.5) * 0.9); if (up > 0) crests.push(k); } }
    // -- the tremor of a hand on rough paper
    const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const L = cum[n - 1], nrm = [];
    for (let i = 0; i < n; i++) { const a = P[Math.max(0, i - 2)], b = P[Math.min(n - 1, i + 2)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; nrm.push([-(b[1] - a[1]) / l, (b[0] - a[0]) / l]); }
    // the mountain's side of the line: one side for the whole stroke, the one that looks down the paper over most of it.
    // (Chosen point by point, it jumped across on every steep stretch and the ribbon came out in shifted slabs: r005)
    { let sy = 0; for (const q of nrm) sy += q[1]; if (sy < 0) for (const q of nrm) { q[0] = -q[0]; q[1] = -q[1]; } }
    for (let i = 0; i < n; i++) { const s = cum[i], j = H * (0.0035 * (N(s / (0.018 * H), 2) - 0.5) + 0.009 * (N(s / (0.07 * H) + 9, 2) - 0.5)) * 2 * sm(Math.min(s, L - s) / (0.03 * H)); P[i][0] += nrm[i][0] * j; P[i][1] += nrm[i][1] * j; }
    // -- the ridge as seen: the highest point of the path over every column
    let bx0 = 1e9, bx1 = -1e9, yTop = 1e9, yBase = -1e9; for (const p of P) { bx0 = Math.min(bx0, p[0]); bx1 = Math.max(bx1, p[0]); yTop = Math.min(yTop, p[1]); yBase = Math.max(yBase, p[1]); }
    bx0 = Math.floor(bx0); const nb = Math.max(2, Math.ceil((bx1 - bx0) / BIN) + 1), top = new Array(nb).fill(1e9);
    for (let i = 1; i < n; i++) { const a = P[i - 1], b = P[i], k0 = (a[0] - bx0) / BIN, k1 = (b[0] - bx0) / BIN, lo = Math.floor(Math.min(k0, k1)), hi = Math.ceil(Math.max(k0, k1));
      for (let k = Math.max(0, lo); k <= Math.min(nb - 1, hi); k++) { const f = k1 === k0 ? 0 : clamp((k - k0) / (k1 - k0), 0, 1), y = a[1] + (b[1] - a[1]) * f; if (y < top[k]) top[k] = y; } }
    for (let k = 0, last = P[0][1]; k < nb; k++) { if (top[k] > 1e8) top[k] = last; else last = top[k]; }
    const blur = (A, it) => { let B = A.slice(); for (let q = 0; q < it; q++) { const Cc = B.slice(); for (let k = 1; k < nb - 1; k++) Cc[k] = (B[k - 1] + 2 * B[k] + B[k + 1]) / 4; B = Cc; } return B; };
    const ts = blur(top, 5), wide = blur(top, 40), slope = (k) => (wide[Math.min(nb - 1, k + 4)] - wide[Math.max(0, k - 4)]) / (8 * BIN);
    // lit side / shaded side, turning over gently across a summit (taken straight from the slope it flipped in one
    // column under a steep peak and left a ruled upright seam: r005)
    const shade = blur(top.map((_, k) => clamp(slope(k) * 1.3, -1, 1)), 60), shAt = (k) => shade[clamp(k, 0, nb - 1)];
    // the two ends of the stroke thin out: the brush is set down and lifted there
    const te = Math.min(0.3, 0.09 * H / Math.max(1, bx1 - bx0)), env = (k) => { const t = k / (nb - 1); return sm(t / te) * sm((1 - t) / te); };
    // how far the ink runs down the slope: to about the level of the stroke's lowest point, so tall peaks get long slopes
    const depth = ts.map((t, k) => ((yBase - t) * 1.0 + 0.17 * H) * (0.45 + 0.55 * env(k)));
    // -- canvases, cropped to the mountain
    const pad = Math.round(0.04 * H), ox = bx0 - pad, oy = Math.floor(yTop - 0.1 * H),   // whole px: wash columns must sit on the pixel grid or their seams show as fine upright stripes
       cw = Math.ceil((bx1 - bx0 + 2 * pad) * dpr), chh = Math.ceil((yBase + 0.19 * H - oy) * dpr);
    const mk = () => { const cv = document.createElement('canvas'); cv.width = cw; cv.height = chh; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr); return [cv, g]; };
    const [cv, g] = mk(), [body, gb] = mk(), [rib, gr] = mk();
    const home = (x) => x.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr), raw = (x) => x.setTransform(1, 0, 0, 1, 0, 0);
    // -- wash: per column, ink thinning from the ridge to nothing at the foot. A second, shorter and darker band under
    //    the ridge with an uneven lower edge: the brush belly does not touch the paper evenly
    for (let k = 0; k < nb; k++) {
      const x = bx0 + k * BIN, t = ts[k], dd = depth[k], e = env(k), sh = shAt(k), y0 = Math.min(top[k], t) - 1;
      const a0 = 0.56 * (0.8 + 0.4 * sh) * e * (0.85 + 0.3 * N(x / (0.12 * H) + 3, 2));
      let gd = g.createLinearGradient(0, t, 0, t + dd); gd.addColorStop(0, `rgba(${INK},${a0.toFixed(3)})`); gd.addColorStop(0.1, `rgba(${INK},${(a0 * 0.7).toFixed(3)})`); gd.addColorStop(0.3, `rgba(${INK},${(a0 * 0.34).toFixed(3)})`); gd.addColorStop(0.6, `rgba(${INK},${(a0 * 0.1).toFixed(3)})`); gd.addColorStop(1, `rgba(${INK},0)`);
      g.fillStyle = gd; g.fillRect(x, y0, BIN, t + dd - y0);
      const d2 = Math.min(dd * 0.3, 0.075 * H) * (0.45 + 1.1 * N(x / (0.13 * H) + 40, 2)),   // capped: on a tall peak its lower edge showed as a level line across the body
         a2 = 0.34 * clamp(0.5 + 0.7 * sh, 0.12, 1) * e;
      gd = g.createLinearGradient(0, t, 0, t + d2); gd.addColorStop(0, `rgba(${INK},${a2.toFixed(3)})`); gd.addColorStop(0.6, `rgba(${INK},${(a2 * 0.5).toFixed(3)})`); gd.addColorStop(1, `rgba(${INK},0)`);
      g.fillStyle = gd; g.fillRect(x, y0, BIN, t + d2 - y0);
      gd = gb.createLinearGradient(0, t, 0, t + dd); gd.addColorStop(0, `rgba(0,0,0,${(0.95 * e).toFixed(3)})`); gd.addColorStop(0.6, `rgba(0,0,0,${(0.92 * e).toFixed(3)})`); gd.addColorStop(1, 'rgba(0,0,0,0)');
      gb.fillStyle = gd; gb.fillRect(x, y0, BIN, t + dd - y0);
    }
    // -- cun: texture strokes, each a thin line of a drying brush that bends toward the fall line and fades out
    const col = (x) => clamp(Math.round((x - bx0) / BIN), 0, nb - 1);
    const hair = (x, y, ang, len, w0, a0, to) => {
      const m = 16; g.lineCap = 'butt'; g.strokeStyle = `rgb(${INK})`;
      for (let i = 0; i < m; i++) { const f = i / m; ang += (to - ang) * 0.1 + (R() - 0.5) * 0.14; const nx = x + Math.cos(ang) * len / m, ny = y + Math.sin(ang) * len / m;
        if (R() > S.dry * 0.18 * (0.3 + f)) { g.globalAlpha = a0 * (1 - f) * (1 - f); g.lineWidth = Math.max(0.5, w0 * (1 - 0.75 * f)); g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke(); }
        x = nx; y = ny; }
      g.globalAlpha = 1;
    };
    // hemp fibres: many faint long lines down the fall line of the slope, closer and darker on the shaded side
    for (let x = bx0 + 0.01 * H; x < bx1 - 0.01 * H; x += H * (0.007 + 0.012 * R())) {
      const k = col(x), sh = shAt(k), e = env(k), r1 = R(), r2 = R(), r3 = R(), r4 = R();
      if (r1 > S.cun * 1.5 * (sh > 0 ? 1 : 0.6)) continue;
      const fall = 1.5708 - sh * 0.8;
      hair(x, ts[k] + H * (0.004 + 0.07 * r2 * r2), fall + (r3 - 0.5) * 0.9, depth[k] * (0.12 + 0.3 * r4 * r4), H * 0.0026 * (0.5 + R()), (0.2 + 0.25 * R()) * (sh > 0 ? 1 : 0.6) * e, fall + (r3 - 0.5) * 0.3);
    }
    for (const k of crests) {   // the spurs running down from a summit, to both sides
      const way = P[Math.min(n - 1, k + 2)][0] >= P[Math.max(0, k - 2)][0] ? 1 : -1, dc = depth[col(P[k][0])], cnt = Math.round((2 + 3 * R()) * S.cun * 1.6);
      for (let q = 0; q < cnt; q++) { const side = q === 0 ? (R() < 0.5 ? 1 : -1) * 0.25 : (q % 2 ? 1 : -1), i2 = clamp(k + way * Math.sign(side) * Math.round((q === 0 ? 0 : R()) * 0.03 * H / STEP), 0, n - 1);
        hair(P[i2][0], P[i2][1] + 0.003 * H, 1.5708 - side * (0.35 + 0.5 * R()), dc * (0.3 + 0.45 * R()), H * 0.0048 * (0.6 + 0.8 * R()), 0.6, 1.5708 - Math.sign(side) * (0.1 + 0.5 * R())); }
    }
    // -- nothing above the ridge
    for (const x of [g, gb]) { x.globalCompositeOperation = 'destination-out'; x.globalAlpha = 1; x.fillStyle = '#000'; x.beginPath(); x.moveTo(bx0 - pad - 5, oy - 5); x.lineTo(bx0 - pad - 5, top[0]); for (let k = 0; k < nb; k++) x.lineTo(bx0 + k * BIN, top[k]); x.lineTo(bx1 + pad + 5, top[nb - 1]); x.lineTo(bx1 + pad + 5, oy - 5); x.closePath(); x.fill(); x.globalCompositeOperation = 'source-over'; }
    // -- the ridge line: a ribbon along the path, a little more of it on the mountain's side
    const near = (i) => { let b = 1e9; for (const k of crests) b = Math.min(b, Math.abs(cum[k] - cum[i])); return b; };
    const wAt = [], dryAt = [];
    for (let i = 0; i < n; i++) {
      const s = cum[i], slow = 1 - clamp(P[i][2] / 1.5, 0, 1), sh = shAt(col(P[i][0])), press = 0.5 * slow + 0.4 * N(s / (0.09 * H) + 70, 2) + 0.7 * Math.exp(-Math.pow(near(i) / (0.018 * H), 2)) + 0.2 * Math.max(0, sh);
      const taper = (0.3 + 0.7 * sm(s / (0.02 * H))) * (0.1 + 0.9 * sm((L - s) / (0.09 * H)));
      wAt.push(H * 0.0105 * taper * (0.5 + 0.65 * press) * (0.8 + 0.4 * N(s / (0.006 * H) + 200, 1)));
      dryAt.push(clamp(S.dry * (0.2 + 0.9 * clamp(P[i][2] / 1.4, 0, 1) + 0.8 * Math.pow(s / L, 2) * clamp(L / (1.2 * H), 0.3, 1)) - 0.3 * press, 0, 0.95));
    }
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
    gr.globalCompositeOperation = 'source-over'; gr.globalAlpha = 1;
    raw(g); g.filter = `blur(${(0.0045 * H * dpr).toFixed(1)}px)`; g.globalAlpha = 0.3; g.drawImage(rib, 0, 0); g.filter = 'none'; g.globalAlpha = 0.93; g.drawImage(rib, 0, 0);   // a soft halo first: wet ink creeping off the line
    g.globalAlpha = 0.11; g.globalCompositeOperation = 'destination-out'; g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, cw, chh); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; home(g);
    // far (high on the paper) pale, near dark
    const tone = 0.42 + 0.58 * clamp((yBase / H - 0.3) / 0.5, 0, 1);
    return { cv, body, ox, oy, bx0, ts, depth, yBase, tone, peaks: crests.length, ms: Math.round(performance.now() - tB) };
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
      for (let k = nb - 1; k >= 0; k -= 4) c.lineTo(m.bx0 + k * BIN + (k > nb - 5 ? 0.05 * H : 0), m.ts[k] + 0.02 * H + e * m.depth[k]); c.lineTo(m.bx0 - 0.05 * H, m.ts[0] + 0.02 * H + e * m.depth[0]); c.closePath(); c.clip();
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
  const SL = [['peak', 'Vuốt đỉnh nhọn'], ['cun', 'Nét sườn núi'], ['dry', 'Độ khô của bút']];
  const pbox = document.createElement('div');
  pbox.innerHTML = `<h3>Vẽ núi (tự do)</h3><div id="p_stat" class="keys"></div>
    <button id="p_undo">Bỏ nét cuối (Z)</button><button id="p_clear">Xóa tranh (C)</button><button id="p_again">Vẽ lại kiểu khác (X)</button>
    ${SL.map(([k, name]) => `<label><span class="row"><span>${name}</span><b id="p_${k}v"></b></span><input type="range" id="p_${k}" min="0" max="1" step="0.05"></label>`).join('')}
    <div class="keys">Giữ chuột trái: hạ bút, rồng bay tới đâu vẽ tới đó
Thả chuột: nét thành núi
Vẽ cao trên giấy: núi xa, nhạt
Vẽ thấp: núi gần, đậm</div>`;
  panel.insertBefore(pbox, panel.firstChild);
  const $ = (id) => document.getElementById(id);
  const redo = (reseed) => { for (const d of st.done) { d.m = null; if (reseed) d.seed = (Math.random() * 2147483647) | 0; } bakeKey = ''; };
  $('p_clear').onclick = reset; $('p_undo').onclick = undo; $('p_again').onclick = () => redo(true);
  for (const [k] of SL) $('p_' + k).addEventListener('input', (e) => { S[k] = +e.target.value; save(); redo(false); sync(); });
  function sync() {
    if (!$('p_stat')) return;
    $('p_stat').textContent = st.done.length ? `Đã vẽ ${st.done.length} nét` : 'Giấy trắng. Giữ chuột trái và bay một nét';
    for (const [k] of SL) { $('p_' + k).value = S[k]; $('p_' + k + 'v').textContent = S[k].toFixed(2); }
  }
  sync();
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'c') reset(); else if (k === 'z') undo(); else if (k === 'x') redo(true);
  });

  window.__paint = { S, st, step, render, reset, undo, freeW, ready: () => true, pen: (on) => (on ? penDown() : penUp()),
    info: () => ({ strokes: st.done.length, pen: st.pen, peaks: st.done.map((d) => (d.m ? d.m.peaks : null)), buildMs: st.done.map((d) => (d.m ? d.m.ms : null)), S: { ...S } }) };
})();
