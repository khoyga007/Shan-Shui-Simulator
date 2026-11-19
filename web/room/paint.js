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
  const st = { pen: false, stroke: [], done: [], msg: '', msgT: -9, kind: 'earth' };   // kind: the element of the next stroke (keys 1 to 3)
  // Three strokes, not five (Yang 11-19): Địa (earth: mountains, later rocks and banks), Thuỷ (water: river, lake), Mộc
  // (wood: trees, grass). The element is chosen; what the stroke becomes within it is read from how it was flown (guess).
  // A fourth, Thiên (sky: sun flown clockwise, moon counter-clockwise, clouds, birds), is to come.
  const KINDS = [['earth', 'Địa', 'núi, bờ đất, đá'], ['water', 'Thuỷ', 'sông, hồ, mặt nước'], ['wood', 'Mộc', 'cây, cỏ']];
  const SUBS = { earth: ['mountain', 'bank', 'rock'], water: ['river', 'lake', 'sea'], wood: ['tree', 'grass'] }, SUBN = { mountain: 'núi', bank: 'bờ đất', rock: 'mỏm đá', river: 'sông', lake: 'hồ', sea: 'mặt nước', tree: 'cây', grass: 'cỏ' }, ELN = { earth: 'Địa', water: 'Thuỷ', wood: 'Mộc' };
  // water: a loop that comes back to its start (its last quarter passing near its first; flown past the start counts) is
  // a lake, else a river. wood: a stroke that stands is a tree (the stroke its trunk), one that lies is grass (its ground);
  // the slope is the one `tree` uses for a branch seen close, which is now reached by turning a lying stroke into a tree
  function guess(el, q, L) {
    const n = q.length, a = q[0], b = q[n - 1];
    let xa = 1e9, xb = -1e9, ya = 1e9, yb = -1e9; for (const p of q) { xa = Math.min(xa, p[0]); xb = Math.max(xb, p[0]); ya = Math.min(ya, p[1]); yb = Math.max(yb, p[1]); }
    // water flown level across most of the paper is no river: it is the waterline, the far shore above it, the near one below
    if (el === 'water' && xb - xa >= 0.7 * freeW() && yb - ya < 0.08 * (xb - xa)) return 'sea';
    if (el === 'water') { const k = Math.max(1, n >> 2); let g = 1e9; for (let i = 0; i < k; i++) for (let j = n - k; j < n; j++) g = Math.min(g, Math.hypot(q[i][0] - q[j][0], q[i][1] - q[j][1])); return L > 0.3 * D.H && g < Math.max(SNAP * D.H, 0.15 * L) ? 'lake' : 'river'; }
    if (el === 'wood') return Math.abs(b[1] - a[1]) > 0.58 * Math.abs(b[0] - a[0]) ? 'tree' : 'grass';
    // earth (Yang 11-19: "dùng chính đường thuỷ ngăn cách phản chiếu để phân biệt"): water parts the far shore from the near.
    // A stroke flown beyond the water is a mountain; one flown on this side of it (most of its points below a waterline,
    // or in or before a lake) is near land: short, a rock; else an earth bank. No water on the paper yet: a mountain.
    // (Before, by shape alone: a low arc could be a far hill or a near bank, and the guess was often wrong.)
    if (!nearSide(q)) return 'mountain';
    return xb - xa < 0.3 * D.H && L < 0.55 * D.H ? 'rock' : 'bank';
  }
  const meanY = (d) => (d.my === undefined ? (d.my = d.stroke.reduce((a, p) => a + p[1], 0) / d.stroke.length) : d.my);
  function nearSide(q) {
    for (const o of st.done) { let c2 = 0;
      if (o.kind === 'sea') { const y = meanY(o); for (const p of q) if (p[1] > y) c2++; }
      else if (o.kind === 'lake') { if (!o.bb) { let xa = 1e9, xb = -1e9, ya = 1e9; for (const p of o.stroke) { xa = Math.min(xa, p[0]); xb = Math.max(xb, p[0]); ya = Math.min(ya, p[1]); } o.bb = [xa, xb, ya]; } for (const p of q) if (p[0] > o.bb[0] && p[0] < o.bb[1] && p[1] > o.bb[2]) c2++; }
      if (c2 > q.length / 2) return true; }
    return false;
  }
  // guessed wrong: the key of the element again turns the last stroke into the next thing of that element
  function turn() { const d = st.done[st.done.length - 1], subs = d && SUBS[d.el]; if (!subs || subs.length < 2 || d.el !== st.kind) return false; const nk = subs[(subs.indexOf(d.kind) + 1) % subs.length]; if (d.el === 'wood') { const pl = plant(d.stroke, nk); if (pl.kind !== nk) { say(pl.kind ? 'Nét này không nằm trên đất nên không đổi thành ' + SUBN[nk] + ' được' : pl.msg); return true; } d.stroke = pl.q; d.root = pl.root; } d.kind = nk; d.m = null; bakeKey = ''; say(ELN[d.el] + ': đổi nét cuối thành ' + SUBN[d.kind]); return true; }
  const say = (s) => { st.msg = s; st.msgT = D.T; };
  function reset() { st.pen = false; st.stroke = []; st.done = []; bakeKey = ''; if (typeof throwGrove === 'function') throwGrove(); sync(); }
  function undo() { if (st.done.pop()) { bakeKey = ''; sync(); } }
  function penDown() { if (st.pen) return; st.pen = true; st.stroke = []; }
  // Wood grows on land only (Yang 11-19: "cây chỉ có thể vẽ ở trên đất, cỏ cũng vậy"). ground: the land under a point: a bank
  // or a rock whose top is near it (from 10% of a screen above its top down to its foot; the nearest top wins), else the
  // body of a mountain. plant: a tree's root (the lowest point of its stroke) is set on the top of that bank or rock, the
  // whole stroke moved with it (flown by hand the root hung in the air or deep in the bank's face); on a mountain it stays
  // where flown. Grass: its points off the land are dropped, the rest laid on the top. No land under it: nothing is drawn
  // and the reason is said. But a long level stroke off the land is a branch seen close (it grows in from the paper's
  // edge, not from the ground), as before by turning a lying stroke into a tree.
  // Land counts only where its ink is seen (Yang 11-19: "cỏ đang mọc phi logic": tufts stood on the water, where a bank's upper line ran on but its body had thinned to nothing).
  function inkOn(m, k) { if (!m.inkB) { m.inkB = new Uint8Array(m.ts.length); m.inkY = Array.from(m.ts); try { const c = m.cv, im = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, H = D.H; for (let j = 0; j < m.ts.length; j++) { const px = Math.round((m.bx0 + (j + 0.5) * BIN - m.ox) * dpr); m.inkY[j] = m.ts[j]; if (px >= 0 && px < c.width) for (let py = Math.max(0, Math.round((m.ts[j] - 0.012 * H - m.oy) * dpr)), pe = Math.min(c.height - 1, Math.round((m.ts[j] + 0.03 * H - m.oy) * dpr)); py <= pe; py++) if (im[4 * (py * c.width + px) + 3] > 110) { m.inkB[j] = 1; m.inkY[j] = py / dpr + m.oy; break; } }   /* inkY: where the ink of the upper edge really starts (the built line lies a little under the flown one: tufts set on the flown line stood in the air) */ } catch (e) { m.inkB.fill(1); } } return m.inkB[k]; }
  function ground(x, y) { const H = D.H; let best = null;
    for (const o of st.done) { const m = o.m; if (!m || !m.ts || m.river) continue; const k = Math.floor((x - m.bx0) / BIN); if (k < 0 || k >= m.ts.length) continue; const t = m.ts[k];
      if (m.solid) { if (inkOn(m, k) && m.yBase - t > Math.max(0.018 * H, 0.25 * (m.yBase - m.yTop)) /* not on the thin tip where a bank runs out into the water (r017) */ && y > t - 0.05 * H && y < m.yBase) { const e = Math.abs(y - t); if (!best || !best.solid || e < best.e) best = { y: t, e, solid: true, iy: m.inkY[k], sl: Math.atan2(m.inkY[Math.min(m.ts.length - 1, k + 3)] - m.inkY[Math.max(0, k - 3)], (Math.min(m.ts.length - 1, k + 3) - Math.max(0, k - 3)) * BIN || 1) }; } }
      else if (!best && y > t && y < m.yBase && !st.done.some((w) => w.m && w.m.wat && inWater(w.m, x, y))) best = { y, e: 0, solid: false }; }   // (a mountain's body runs on under the water before it: that is water, not land)
    return best; }
  function plant(q0, kind) { const H = D.H, q = q0.map((p) => p.slice());
    if (kind === 'tree') { const r = q.reduce((a, p) => (p[1] > a[1] ? p : a), q[0]), g = ground(r[0], r[1]); if (!g) return { msg: 'Cây chỉ mọc trên đất: vẽ nét Địa (phím 1) trước, rồi vẽ cây từ mặt đất lên' };
      if (g.solid && r[1] < g.y + 0.006 * H) { const dy = g.y + 0.006 * H - r[1]; for (const p of q) p[1] += dy; }   /* only a root hanging in the air above the land is brought down to it. A root flown on the land's face stays there: "on land" is anywhere on it, not on its upper edge (Yang 11-19: every tree had been lined up on the bank's top line) */
      return { kind, q, root: [r[0], r[1]] }; }
    const on = q.map((p) => ground(p[0], p[1])), keep = q.filter((p, i) => on[i]);
    if (keep.length < 0.5 * q.length || keep.length < 4) { const a = q[0], b = q[q.length - 1]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.3 * D.W) return { kind: 'tree', q, root: [a[0], a[1]], branch: true, msg: 'Mộc: cành (nét ngang dài, không nằm trên đất)' };
      return { msg: 'Cỏ chỉ mọc trên đất: vẽ nét Địa (phím 1) trước, rồi vẽ cỏ dọc mặt đất' }; }
    let i = 0; for (const p of q) { const g = on[i++]; if (g && g.solid && p[1] < g.y + 0.002 * H) p[1] = g.y + 0.002 * H; } const kq = q.filter((p, j) => on[j]), mid = kq[kq.length >> 1]; return { kind, q: kq, root: [mid[0], mid[1]] }; }
  function penUp() {
    if (!st.pen) return; st.pen = false;
    const q = st.stroke; st.stroke = []; let L = 0; for (let i = 1; i < q.length; i++) L += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
    if (L < 0.06 * D.H) return;   // a tap, not a stroke
    let kind = guess(st.kind, q, L), root;
    if (st.kind === 'wood') { const pl = plant(q, kind); if (!pl.kind) { say(pl.msg); return; } kind = pl.kind; root = pl.root; q.length = 0; q.push(...pl.q); if (pl.msg) { st.done.push({ stroke: q, kind, el: st.kind, root, t0: D.T, seed: (Math.random() * 2147483647) | 0 }); say(pl.msg); sync(); return; } }
    st.done.push({ stroke: q, kind, el: st.kind, root, t0: D.T, seed: (Math.random() * 2147483647) | 0 }); if (SUBS[st.kind].length > 1) say(ELN[st.kind] + ': ' + SUBN[kind] + ' (bấm ' + (KINDS.findIndex((k) => k[0] === st.kind) + 1) + ' lần nữa để đổi)'); sync();
  }
  function step(dt) {
    if (!st.pen || Rm.st.mouse) return;   // dragon off: the mouse lays the points itself (mPt)
    const hc = Rm.hc, q = st.stroke, l = q[q.length - 1], d = l ? Math.hypot(hc.x - l[0], hc.y - l[1]) : 0;
    if (!l || d > 1.5) q.push([hc.x, hc.y, l ? d / dt / D.H : 0]);   // x, y, speed in screens a second
  }

  // ---- drawing ------------------------------------------------------------------------------------------------------
  let dpr = 1;
  function size() { dpr = Math.min(2, devicePixelRatio || 1); ink.width = Math.round(innerWidth * dpr); ink.height = Math.round(innerHeight * dpr); }
  size(); addEventListener('resize', () => { size(); for (const d of st.done) d.m = null; bakeKey = ''; });
  // the stroke while it is being flown: drawn opaque on a scratch canvas and laid on at its alpha (drawn straight, the
  // overlapping round caps showed as a string of beads)
  // Now and then a fish leaps (Yang 11-19; sheet L: _x fish, _o splash rings). Rare: one water has one leap in a
  // period of 11 to 20 seconds, and one period in five has none. A leap: a ring spreads where the fish leaves the
  // water, the fish goes over in a low arc, turning with its flight (as painted its head points up and to the right,
  // FISH), and a second ring spreads where it falls. Nothing is kept between frames but the leap of the period we are
  // in: everything follows from T and the water's seed, so a bake or a resize changes nothing.
  // spot(r1, r2, sg) -> { x0, y0, span, hgt, sz } where a leap can be made (both ends in the water), or null.
  // ?leap=1: one every three seconds, to look at them.
  // Mist of blobs (key V, ?mist=old = the one whole mask as before). MB: n wisps per screen-height squared of mask, their
  // length (w0 + w1 r^2, in screen heights), how much one takes (a0 + a1 r^3). wisp(): the one soft blob all are drawn
  // with, a flat puff whose dense core lies toward one end and which fades to nothing on every side.
  let MBLOB = new URLSearchParams(location.search).get('mist') !== 'old', WISP = null;
  const MB = { n: 2200, w0: 0.07, w1: 0.26, a0: 0.12, a1: 0.6, eb: 14, ab: 0.5, em: 20, am: 0.2 };   // eb, em: large and middling wisps per screen height of mist top; ab, am: how much one takes at least
  const wisp = () => { if (WISP) return WISP; const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d'); x.scale(2, 1);
    const gd = x.createRadialGradient(22, 32, 0, 32, 32, 32); for (const [p, a] of [[0, 1], [0.2, 0.8], [0.45, 0.42], [0.7, 0.14], [0.88, 0.03], [1, 0]]) gd.addColorStop(p, `rgba(0,0,0,${a})`); x.fillStyle = gd; x.fillRect(0, 0, 64, 64); return (WISP = c); };
  const FISH = -0.66, LEAPS = new URLSearchParams(location.search).has('leap');
  function leaper(seed, spot) {
    const per = LEAPS ? 2.9 : 11 + (seed % 1000) / 1000 * 9, off = LEAPS ? 0 : (seed % 777) / 777 * per, du = 0.75, kit = (suf) => (S.tex === 'code' ? [] : (STROKES['muse' + suf] || []).filter((q) => q.im)),
      h = (k, j) => { const v = Math.sin(k * 127.1 + j * 311.7 + (seed % 9973)) * 43758.5453; return v - Math.floor(v); }; let ck = -1, J = null;
    return (T, x) => { const k = Math.floor((T + off) / per), t = T + off - k * per; if (t > du + 2) return;
      if (k !== ck) { const kx = kit('_x'), ko = kit('_o'); if (!kx.length) return; ck = k; J = null;
        if (LEAPS || h(k, 0) > 0.2) for (let a = 0; a < 8 && !J; a++) J = spot(h(k, 3 * a + 1), h(k, 3 * a + 2), h(k, 3 * a + 3) < 0.5 ? -1 : 1);
        if (J) { J.sg = J.sg || 1; J.q = kx[Math.floor(h(k, 40) * kx.length) % kx.length]; J.o = ko.length ? [ko[Math.floor(h(k, 41) * ko.length) % ko.length], ko[Math.floor(h(k, 42) * ko.length) % ko.length]] : null; } }
      if (!J) return; const tone = 0.5 + 0.5 * clamp((J.y0 / D.H - 0.2) / 0.7, 0, 1);
      if (J.o) for (const [cx, t1, q] of [[J.x0, t, J.o[0]], [J.x0 + J.sg * J.span, t - du, J.o[1]]]) { const l = t1 / 2; if (l <= 0 || l >= 1) continue;
        const w = J.sz * 1.5 * (0.4 + 1.5 * l), hh = w * q.h / q.w; x.globalAlpha = 0.8 * tone * sm(l / 0.1) * (1 - l); x.drawImage(q.im, cx - w / 2, J.y0 - hh / 2, w, hh); }
      if (t < du) { const p = t / du, grow = sm(p / 0.15) * sm((1 - p) / 0.15), w = J.sz * (0.5 + 0.5 * grow), q = J.q, hh = w * q.h / q.w;   // it comes out of the water small and goes back into it small
        x.save(); x.translate(J.x0 + J.sg * J.span * p, J.y0 - J.hgt * 4 * p * (1 - p)); x.scale(J.sg, 1); x.rotate(Math.atan2(-J.hgt * 4 * (1 - 2 * p), J.span) - FISH);
        x.globalAlpha = 0.9 * tone * sm(p / 0.08) * sm((1 - p) / 0.08); x.drawImage(q.im, -w / 2, -hh / 2, w, hh); x.restore(); }
      x.globalAlpha = 1; };
  }
  // a piece standing upright, w wide, the middle of its foot at (bx, by): a clump of reeds, a shore rock
  const stand = (x, q, bx, by, w, flip) => { const h = w * q.h / q.w; x.save(); x.translate(bx, by); if (flip) x.scale(-1, 1); x.drawImage(q.im, -w / 2, -h, w, h); x.restore(); };
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
  // A stroke flown low and gentle is no peak: a rounded hill laid in with wet wash (Yang 11-19, reference paintings: one
  // kind of mountain was not enough). hill 0..1 from the stroke's shape: its rise against its run. Such a hill gets no
  // summit drawn up into a point, next to no texture strokes, and a ridge line that is wet, pale and soft.
  const hillS = (h, rk = 0) => Object.assign({}, S, { peak: S.peak * (1 - h) * (1 - rk), cun: S.cun * (1 - 0.92 * h), dry: S.dry * (1 - 0.8 * h) });
  function mountain(d) {
    const tB = performance.now(), H = D.H, R = dice(d.seed), N = noise1(R), P = calm(d.stroke, STEP, 4), n = P.length;
    if (n < 8) return null;
    let hill = 0; { let sy = 0, sx = 0; for (let i = 1; i < n; i++) { sy += Math.abs(P[i][1] - P[i - 1][1]); sx += Math.abs(P[i][0] - P[i - 1][0]); } hill = 1 - sm((sy / Math.max(1, sx) - 0.3) / 0.2); }   // how steep its slopes are on the whole, up and down alike: by rise against run, a long range of peaks flown in one stroke counted as flat and lost its summits
    // A stroke flown up steeply, level across, and steeply down again is a flat-topped crag (the karst walls of Yang's
    // reference paintings): rock 0..1 = steep on the whole, and a good part of its length lying along its top. No summit is
    // drawn up out of it; its face is hung with long drags of a half-dry brush (sheet W, _cf), dark at the top, running dry downward.
    let rock = 0; { let ya = 1e9, yb = -1e9, sy = 0, sx = 0, fl = 0; for (const p of P) { ya = Math.min(ya, p[1]); yb = Math.max(yb, p[1]); } for (let i = 1; i < n; i++) { sy += Math.abs(P[i][1] - P[i - 1][1]); sx += Math.abs(P[i][0] - P[i - 1][0]); if (P[i][1] < ya + 0.22 * (yb - ya)) fl++; }
      rock = (1 - hill) * sm((fl / n - 0.32) / 0.13) * sm((sy / Math.max(1, sx) - 0.55) / 0.3); }
    // Near land (Yang 11-19): an earth bank and a rock are built as a mountain is, from the stroke, which is their upper
    // outline (first they were whole painted pieces set where the stroke lay: "mọi thứ đều sinh ra từ nét vẽ mà đá với gò đất
    // lại là asset?"). What differs: no summit drawn up, no mist, no forest or scrub (tiny trees say "far"), and the ink is cut
    // off on a dead-level foot, the water's edge, with the thing's own image under it. A bank: soft, washed, few strokes.
    // A rock: its top broken into short ledges, dry line, many strokes.
    const land = d.kind === 'bank' || d.kind === 'rock' ? d.kind : null;
    if (land) { hill = land === 'bank' ? 0.5 : 0; rock = 0; }
    const S = land ? Object.assign({}, hillS(0, 0), { peak: 0, mist: 0, body: hillS(0, 0).body * (land === 'rock' ? 0.55 : 0.4), cun: clamp(hillS(0, 0).cun * (land === 'rock' ? 0.6 : 0.3), 0, 1), dry: hillS(0, 0).dry * (land === 'rock' ? 1 : 0.65) }) : hillS(hill, rock);
    if (land === 'rock') { let ya = 1e9, yb = -1e9; for (const p of P) { ya = Math.min(ya, p[1]); yb = Math.max(yb, p[1]); } const hgt = Math.max(0.02 * H, yb - ya), Rc = dice(d.seed ^ 0x3d71); let of = new Array(n).fill(0);
      for (let i = 0; i < n;) { const m = Math.max(3, Math.round(n * (0.08 + 0.2 * Rc()))), off = (Rc() - 0.5) * 0.3, tilt = (Rc() - 0.5) * 0.3; for (let j = i; j < Math.min(n, i + m); j++) of[j] = off + tilt * ((j - i) / m - 0.5); i += m; }
      of = of.map((v, k) => (of[Math.max(0, k - 1)] + 2 * v + of[Math.min(n - 1, k + 1)]) / 4);
      for (let j = 0; j < n; j++) P[j][1] += hgt * of[j] * sm((ya + 0.45 * hgt - P[j][1]) / (0.3 * hgt)); }
    // a rock: both ends come down to the water: left as flown, the level foot cut them off plumb, a slab.
    // A bank keeps the line it was flown, as a mountain does (Yang 11-19, of a stroke whose ends the game had bent down into
    // a closed mound, its foot pushed below the paper: "bờ đất phải hoạt động như nét vẽ núi ấy nhé, không được tự crop")
    if (land === 'rock') { let yb = -1e9, ya = 1e9; for (const p of P) { yb = Math.max(yb, p[1]); ya = Math.min(ya, p[1]); } const low = yb + (land === 'bank' ? clamp(0.05 * Math.abs(P[n - 1][0] - P[0][0]), 0.02 * H, 0.07 * H) : 0), te = land === 'bank' ? 0.16 : 0.22;
      for (let j = 0; j < n; j++) { const t = j / (n - 1), e = sm(Math.min(t, 1 - t) / te); P[j][1] = low + (P[j][1] - low) * (0.04 + 0.96 * e); } }
    // A crag's top is broken rock, not the round cap the flight leaves (Yang 11-19: "làm đi em"): along the stretch that lies near
    // the top, the line is cut into ledges of uneven length, each standing a little higher or lower than the last and tilted its
    // own way, with a sudden step between two; now and then a narrow notch, or a horn standing up. Sides and foot stay as flown.
    if (rock > 0.05) { let ya = 1e9, yb = -1e9; for (const p of P) { ya = Math.min(ya, p[1]); yb = Math.max(yb, p[1]); } const hgt = yb - ya, Rc = dice(d.seed ^ 0x2c9f); let of = new Array(n).fill(0);
      for (let i = 0; i < n;) { const len = Math.max(4, Math.round(H * (0.015 + 0.055 * Rc() * Rc()) / STEP)), kind = Rc(), off = kind < 0.1 ? 0.016 + 0.02 * Rc() : kind < 0.24 ? -(0.018 + 0.022 * Rc()) : (Rc() - 0.42) * 0.03, tilt = (Rc() - 0.5) * 0.024, m = kind < 0.24 ? Math.min(len, Math.max(4, Math.round(0.016 * H / STEP))) : len;
        for (let j = i; j < Math.min(n, i + m); j++) of[j] = off + tilt * ((j - i) / m - 0.5);
        i += m; }
      for (let q = 0; q < 2; q++) of = of.map((v, k) => (of[Math.max(0, k - 1)] + 2 * v + of[Math.min(n - 1, k + 1)]) / 4);   // a step, not a plumb drop: flown straight down, the ridge stroke stood on end there as a black block (bot still: battlements)
      for (let j = 0; j < n; j++) P[j][1] += 0.4 * H * rock * sm((ya + 0.3 * hgt - P[j][1]) / (0.14 * hgt)) * of[j]; }   // 0.4: only uneven now. What bristles on the tops in the paintings is no broken rock: it is the trees and scrub growing there, seen from afar (Yang 11-19), dotted on below
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
    { const kitCF = (STROKES.muse_cf || []).filter((q) => q.im).slice(-6);   // the sheet's upper four (crag-top edges) came out as blocks: left out
      // Not the crag alone: any mountain's flank was a smooth grey slide ("thân núi quá trơn nhẵn", Yang 11-19). The same dry drags,
      // thinner, paler and shorter, are laid down every slope as its texture strokes (hemp-fibre cun): from the ridge and from
      // a way below it, running down and outward with the fall of the slope. A hill of wash keeps next to none.
      const tx = Math.max(rock, 0.75 * (1 - hill) * Math.min(1.4, S.cun / 0.6));
      // On a crag they were a barcode ("đường kẻ sọc trông sai sai", Yang 11-19): every drag plumb, from the very top, evenly spaced,
      // and a 1600 px sample squeezed into a short streak, its dry hairs ruled lines. Now: gathered into fissures with bare faces of
      // rock between (noise along the crag), each stretch of wall leaning its own way, a good half beginning lower down the
      // face, lengths from short to long, and wider, so the dry hairs of the sample are no longer ruled hairlines.
      if (tx > 0.05 && kitCF.length) { for (let x = bx0 + 0.01 * H * R(); x < bx1; x += H * (0.008 + 0.022 * R()) / (0.5 + 0.5 * tx)) { const k = col(x), q = kitCF[Math.floor(R() * kitCF.length) % kitCF.length], lo = 1 - rock, r1 = R(), r2 = R(), r3 = R(), r4 = R(), r5 = R();
          if (r5 > lo + rock * (0.22 + 0.78 * sm((N(x / (0.075 * H) + 311, 2) - 0.4) / 0.16))) continue;
          const swc = q.w * (1 - 0.35 * rock * r4),   // the dark, solid end and most of the dry run: cut shorter than that, a streak was a black bar
             // (on a slope, begun up to half way down and up to 0.6 of the depth long, a drag ran out below the foot of the wood: a fan
             // of ruled dry hairs standing in the mist, some down past the end of the mist mask. It now ends by 0.45 of the depth)
             len = Math.min(0.6 * H, depth[k] * (lo * (0.5 + 0.7 * r1) * 0.5 + rock * (0.3 + 0.75 * r1)), rock > 0.5 ? 1e9 : Math.max(0.03 * H, depth[k] * (0.45 - 0.5 * lo * r3 * r3))), wd = clamp(len * q.h / swc * (1.4 + 2 * r2 + 2.5 * rock * r2), 0.008 * H, (0.035 + 0.055 * rock) * H),
            sl = clamp((ts[Math.min(nb - 1, k + 6)] - ts[Math.max(0, k - 6)]) / (12 * BIN), -1.1, 1.1), an = Math.atan2(1, lo * (0.75 * sl + 0.25 * (R() - 0.5)) + rock * ((N(x / (0.2 * H) + 97, 1) - 0.5) * 0.5 + 0.14 * (R() - 0.5))), c0 = Math.cos(an), s0 = Math.sin(an), fl = R() < 0.5 ? 1 : -1,
            y = ts[k] - 0.006 * H + depth[k] * (lo * 0.5 * r3 * r3 + rock * (r3 < 0.45 ? 0 : 0.65 * (r3 - 0.45) / 0.55));
          g.setTransform(dpr * c0, dpr * s0, -dpr * s0 * fl, dpr * c0 * fl, dpr * (x - ox), dpr * (y - oy)); const low = rock * (r3 < 0.45 ? 0 : 1);   // begun down the face, away from the dark of the top: pale and narrow, or its solid end stood on the wall as a black slab
          g.globalAlpha = tx * (0.25 + 0.6 * R()) * (1 - 0.6 * lo) * (1 - 0.55 * low); g.drawImage(q.im, 0, 0, swc, q.h, 0, -wd * (0.5 - 0.22 * low), len, wd * (1 - 0.44 * low)); }
        g.globalAlpha = 1; home(g); }
      // Sheet X, the cun proper (Yang's gen 11-19), mixed in with the drags: hemp-fibre lines (_xh, pale, many, down the slope),
      // axe-cut chops (_xa, few, dark, slanting with the slope, high on the flank), folded-belt strokes (_xf, on a crag's
      // face only: its ledges), clusters of moss dots (_xm, small, along the ridge and in the folds). Each row at its own size.
      const kx = (suf) => (STROKES['muse_' + suf] || []).filter((q) => q.im), kXH = kx('xh'), kXA = kx('xa'), kXF = kx('xf'), kXM = kx('xm'), dn = (0.5 + 0.5 * tx) * (1 - hill);
      const slAt = (k) => clamp((ts[Math.min(nb - 1, k + 6)] - ts[Math.max(0, k - 6)]) / (12 * BIN), -1.1, 1.1);
      const stamp = (q, x, y, an, len, al, fl = 1) => { const c0 = Math.cos(an), s0 = Math.sin(an), hh = len * q.h / q.w; g.setTransform(dpr * c0, dpr * s0, -dpr * s0 * fl, dpr * c0 * fl, dpr * (x - ox), dpr * (y - oy)); g.globalAlpha = Math.min(1, al); g.drawImage(q.im, 0, -hh / 2, len, hh); };
      const sow = (kit, stepH, f) => { if (kit.length && dn > 0.05) for (let x = bx0 + stepH * H * R(); x < bx1; x += H * stepH * (0.5 + R()) / dn) { const k = col(x); if (depth[k] > 0.03 * H) f(kit[Math.floor(R() * kit.length) % kit.length], x, k, slAt(k)); } };
      sow(kXH, 0.011, (q, x, k, sl) => stamp(q, x, ts[k] + 0.004 * H + depth[k] * 0.6 * R() * R(), Math.atan2(1, 0.85 * sl + 0.3 * (R() - 0.5)), Math.min(depth[k] * 0.5, H * (0.035 + 0.07 * R())), (0.55 + 0.45 * R()) * 1.6, R() < 0.5 ? 1 : -1));
      sow(kXA, 0.05, (q, x, k, sl) => { const sg = sl < 0 ? -1 : 1; stamp(q, x, ts[k] + 0.012 * H + depth[k] * 0.3 * R() * R(), Math.atan2(Math.abs(sl) + 0.35 + 0.3 * R(), sg), Math.min(depth[k] * 0.3, H * (0.022 + 0.035 * R())), 0.3 + 0.4 * R(), sg); });
      if (rock > 0.3) sow(kXF, 0.07, (q, x, k) => stamp(q, x, ts[k] + depth[k] * (0.08 + 0.5 * R()), 0.15 * (R() - 0.5), H * (0.03 + 0.04 * R()), rock * (0.3 + 0.35 * R()), 1));
      sow(kXM, 0.08, (q, x, k) => stamp(q, x, ts[k] + 0.006 * H + depth[k] * 0.25 * R() * R(), 6.28 * R(), H * (0.012 + 0.012 * R()), 0.5 + 0.4 * R()));
      g.globalAlpha = 1; home(g); }
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
    raw(g); g.filter = `blur(${(0.0045 * H * dpr).toFixed(1)}px)`; g.globalAlpha = 0.3 + 0.25 * hill; g.drawImage(rib, 0, 0); if (hill > 0.5) g.filter = `blur(${(0.0016 * H * dpr * hill).toFixed(1)}px)`; else g.filter = 'none'; g.globalAlpha = 0.93 - 0.5 * hill; g.drawImage(rib, 0, 0); g.filter = 'none';   // a soft halo first: wet ink creeping off the line
    g.globalAlpha = 0.11; g.globalCompositeOperation = 'destination-out'; g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, cw, chh); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; home(g);
    // -- what grows on the ridge, seen from afar: the bristling edge of the mountains in Yang's reference paintings is trees and
    //    scrub, not rock. Dotted on over the finished line, standing up out of it: short upright dabs (trunks no longer than a
    //    grain of rice), clusters of moss dots and of leaf dots sitting on them. In stands with bare stretches between, thick on
    //    the tops, thinning down the shoulders; a crag wears the most, a peak less, a hill of wash a few.
    { const kM = (STROKES.muse_xm || []).filter((q) => q.im), amt = land ? 0 : (0.5 + 0.5 * rock) * (1 - 0.55 * hill), Rv = dice(d.seed ^ 0x77e1), span = Math.max(1, yBase - yTop);
      g.strokeStyle = g.fillStyle = `rgb(${INK})`; g.lineCap = 'round';
      // First try (bot still): few, large, far apart, clusters of leaf dots as tall as a tree: bubbles and matchsticks. A stand is
      // many small dabs crowding each other, each one press of the brush tip: upright grains, round dots, a small moss cluster.
      for (let x = bx0 + 0.02 * H; x < bx1 - 0.02 * H; x += H * (0.0016 + 0.0034 * Rv())) { const k = col(x), hi = 0.3 + 0.7 * sm((yBase - top[k]) / span / 0.6), stand = sm((N(x / (0.05 * H) + 500, 2) - 0.4) / 0.14);
        if (depth[k] < 0.05 * H || Rv() > amt * hi * (0.04 + 0.96 * stand)) continue;
        const r = Rv(), sz = H * (0.0035 + 0.006 * Rv() * Rv()) * (0.75 + 0.5 * stand), y = top[k] + 0.002 * H - sz * 1.2 * Rv() * stand; g.globalAlpha = 0.55 + 0.4 * Rv();
        if (r < 0.55) { g.beginPath(); g.ellipse(x, y - sz * 0.5, sz * (0.22 + 0.2 * Rv()), sz * (0.6 + 0.5 * Rv()), (Rv() - 0.5) * 0.7, 0, 6.2832); g.fill(); }
        else if (r < 0.85 || !kM.length || (S.tex !== 'code' && (STROKES.muse_yl || []).length)) {   /* with sheet Y's tree lines on the crest the large moss clusters read as bubbles beside them */ g.beginPath(); g.ellipse(x, y - sz * 0.3, sz * (0.3 + 0.25 * Rv()), sz * (0.28 + 0.2 * Rv()), Rv() * 3, 0, 6.2832); g.fill(); }
        else { const q = kM[Math.floor(Rv() * kM.length) % kM.length], w = sz * (2.2 + 1.5 * Rv()), h = w * q.h / q.w; g.drawImage(q.im, x - w / 2, y - h * 0.8, w, h); } }
      // -- and down from the ridge the forest itself (Yang 11-19, a painting of wooded peaks in cloud: "bức 1", and "của họ đậm hơn"):
      //    the mountain is not outlined and textured so much as grown over, its dark the dark of trees. Thousands of small dabs
      //    crowded from the top down, thickest under the ridge, breaking up into stands and then into single trees before the
      //    mist; mostly upright grains (conifers stand), some round. A near mountain (low on the paper) wears them larger,
      //    blacker and further down, a far one small and few: the depth of the painting is in that difference.
      { const near = clamp((yBase / H - 0.3) / 0.5, 0, 1), fa = land ? 0 : (1 - 0.7 * hill) * (1 - 0.4 * rock), Rf = dice(d.seed ^ 0x51f3), reach = 0.72 + 0.23 * near, s0 = H * (0.0045 + 0.004 * near);
        let area = 0; for (let k = 0; k < nb; k++) area += depth[k] * BIN; const cnt = Math.min(16000, Math.round(fa * (0.55 + 0.75 * near) * area * reach / (s0 * s0) * 1.1));
        // Clean ovals alone were a leopard's coat (bot still). Three layers now: a soft dark ground where the wood is thick (the
        // wet ink the trees stand in), over it real brush dabs (sheet X's moss clusters, small, upright), and only then the grains.
        const at = (pw) => { const x = bx0 + (bx1 - bx0) * Rf(), k = col(x), t = Math.pow(Rf(), pw), dp = depth[k]; if (dp < 0.05 * H) return null; const y = top[k] + dp * reach * t,
            patch = sm((N(x / (0.07 * H) + y / (0.11 * H) + 900, 2) - 0.3 - 0.32 * t) / 0.14), hi = 0.35 + 0.65 * sm((yBase - top[k]) / span / 0.5); return Rf() > patch * hi * (1 - 0.75 * t) ? null : [x, y, t]; };
        for (let q = 0; q < cnt / 14; q++) { const a = at(1.6); if (!a) continue; const [x, y, t] = a, r = H * (0.012 + 0.016 * Rf()), gd = g.createRadialGradient(x, y, 0, x, y, r); gd.addColorStop(0, `rgba(${INK},${(0.16 * (0.5 + 0.5 * near) * (1 - 0.6 * t)).toFixed(3)})`); gd.addColorStop(1, `rgba(${INK},0)`); g.globalAlpha = 1; g.fillStyle = gd; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
        g.fillStyle = `rgb(${INK})`;
        // Sheet Y (11-19): the wood as real brushwork. Code dabs, however layered, stayed a pattern of dot clusters. Now forest
        // patches (a wet mass with tree tops standing out of its upper edge) lie down the flank, each lower one over the foot of
        // the one above as ridge behind ridge; the same in pale ink where the wood thins toward the mist and on far mountains;
        // single far trees at its edge; and on the crest itself tree lines turned to the slope (not where it is steep: trees
        // stand upright). Pieces keep upright: mirrored, never rotated, but for the tree lines.
        const ky = (suf) => S.tex === 'code' || land ? [] : (STROKES['muse_' + suf] || []).filter((q) => q.im), kYL = ky('yl'), kYF = ky('yf'), kYT = ky('yt'), kYP = ky('yp'), kZA = ky('za'), kZB = ky('zb'), kZC = ky('zc'), pk = (K) => K[Math.floor(Rf() * K.length) % K.length];
        // (Yang 11-19, of an upright peak banded with forest from top to foot: "núi thẳng này làm sao mà cây mọc được như vậy?" Nothing
        // grows on a rock face. Where the ridge runs steeper than about 68 degrees (a plain peak's flank at 55 to 60 keeps its wood: at 60 the big mountain of the bot still lost half its coat) the flank under it is bare rock; and under a
        // gentle stretch between steep ones (the summit of a pillar) the wood only reaches down as far as that stretch is wide: a
        // cap on the top, not a coat down the face. A mountain with no steep side is wooded as before.)
        const sd = Math.max(1, Math.round(0.03 * H / BIN)), slp = new Float32Array(nb), drop = new Float32Array(nb);
        for (let k = 0; k < nb; k++) { const a = Math.max(0, k - sd), b = Math.min(nb - 1, k + sd); slp[k] = Math.abs(top[b] - top[a]) / Math.max(1, (b - a) * BIN); }
        // a rock face is a steep run that also falls a long way: a short steep hook (the end of a stroke, a notch in the ridge) is
        // no face, and taken for one it stripped a wooded mountain bare in a wedge under it (bot still)
        for (let k = 0; k < nb;) { if (slp[k] <= 2.6) { k++; continue; } let e = k; while (e < nb - 1 && slp[e + 1] > 2.6) e++; if (Math.abs(top[e] - top[k]) < 0.16 * H) for (let i = k; i <= e; i++) slp[i] = 1.4; k = e + 1; }
        // (only a stretch with a face on BOTH sides is a summit to be capped: with a face on one side only, the limit cut a bare wedge into the wooded flank beside it)
        { let dd = 1e9; for (let k = 0; k < nb; k++) { dd = slp[k] > 2.6 ? 0 : dd + BIN; drop[k] = dd; } dd = 1e9; for (let k = nb - 1; k >= 0; k--) { dd = slp[k] > 2.6 ? 0 : dd + BIN; drop[k] = drop[k] < 1e8 && dd < 1e8 ? Math.min(drop[k], dd) * 0.9 : 1e9; } }
        const grow = (k, y) => (1 - sm((slp[k] - 2.1) / 0.6)) * (1 - sm((y - top[k] - drop[k] + 0.02 * H) / (0.03 * H)));
        // (Yang 11-19, of a low hill dotted with separate forest patches: "texture từng mảng rừng như này trông nó hơi giả tạo". A
        // mountain that wears less wood (a hill of wash, a crag) wore it as the same few pieces scattered thin, each an island with
        // its own halo of dabs: stamps. Less wood is now a shallower wood: one whole band under the ridge, as dense as any, that
        // stops sooner. No islands.)
        const reachY = reach * clamp(fa, 0.22, 1);
        if (kYF.length) { const w0 = H * (0.05 + 0.055 * near), lay = [], tries = Math.min(7500, Math.round(area * reachY / (w0 * w0 * 0.5) * 4.6 * (kZA.length || kZB.length ? 0.85 : 1)))   /* x10 with the darker ground was one flat black (Yang: "chưa đạt"): the mark is the stretch he ticked green, dark stands crowding each other with tree tops and grey showing between, and that evenly everywhere */,   // (Yang 11-19: "phủ dày hơn": further down, whole over the upper half, far mountains too)
            // (first still: islands of wood afloat on a bare flank, some hanging out over the mountain's side, single trees as large as
            // clover leaves. Under the ridge the wood is now whole, stands only further down; a piece needs the mountain under both its ends)
            atY = (pw, w) => { const x = bx0 + (bx1 - bx0) * Rf(), k = col(x), t = Math.pow(Rf(), pw), dp = depthFull[k]; if (dp < 0.05 * H) return null; const y = top[k] + dp * reachY * t, ka = col(x - 0.42 * w), kb = col(x + 0.42 * w);   // depthFull: the wedge-cut depth left the long shoulders of a mountain bare (Yang 11-19: "vẫn còn chỗ chưa được phủ")
              if (x - 0.5 * w < bx0 - 0.035 * H - extL || x + 0.5 * w > bx1 + 0.035 * H + extR /* a piece reaching past the mountain's own canvas was cut off straight */ || y > yBase + 0.07 * H || depthFull[ka] < 0.03 * H || depthFull[kb] < 0.03 * H ||   /* below that the mist mask ends: wood showed under the sea of mist */ y < Math.max(top[ka], top[kb]) - 0.004 * H) return null;
              const patch = sm((N(x / (0.07 * H) + y / (0.11 * H) + 900, 2) - 0.2 - 0.3 * t) / 0.14), hi = 0.55 + 0.45 * sm((yBase - top[k]) / span / 0.5); /* Yang 11-19, a red cross on a stretch of thin wood with single trees showing, a green tick on the solid dark mass: "không được có điểm thưa như kia". The wood is whole everywhere: no stands, no thinning down the flank or on low stretches of the ridge */ return Rf() > (1 - 0.12 * t) * grow(k, y) ? null : [x, y, t]; }, put = (m, x, y, w, yo, al, ang, mir) => { const h = w * m.h / m.w; g.save(); g.translate(x, y); if (ang) g.rotate(ang); if (mir === undefined ? Rf() < 0.5 : mir) g.scale(-1, 1); g.globalAlpha = al; g.drawImage(m.im, -w / 2, -h * yo, w, h); g.restore(); };
          // (Yang 11-19, of the gaps between the stands low on the flank: "không nên nhạt mực như vậy, cho nó đen hẳn đi hoặc thêm
          // texture". The flat pale wash of the body showed through. Under the wood now its own ground: dark wet ink pooled over
          // the whole wooded reach (only where the mountain already has ink), paling toward the mist, and in it pale forest patches
          // laid large as brushwork, so a gap reads as deeper wood in shade, not as bare paper-grey)
          // (it was laid source-atop and did nothing: ink over ink with the alpha kept is no change. Now laid plainly, kept under
          // the ridge line by a clip, at UND of its strength: at full strength the wood closes to one flat black)
          { const UND = 0.4; g.save(); g.beginPath(); g.moveTo(bx0 - 0.1 * H, yBase + 0.4 * H); g.lineTo(bx0 - 0.1 * H, top[0]); for (let k = 0; k < nb; k++) g.lineTo(bx0 + k * BIN, top[k] + 0.004 * H); g.lineTo(bx1 + 0.1 * H, top[nb - 1]); g.lineTo(bx1 + 0.1 * H, yBase + 0.4 * H); g.closePath(); g.clip(); const rr = H * (0.03 + 0.03 * near), nG = Math.min(1400, Math.round(area * reachY / (rr * rr) * 2.2));
            for (let q = 0; q < nG; q++) { const x = bx0 + (bx1 - bx0) * Rf(), k = col(x), t = Math.pow(Rf(), 1.1), dp = depthFull[k]; if (dp < 0.04 * H) continue; const y = top[k] + dp * reachY * t; if (y > yBase + 0.07 * H) continue; const r = rr * (0.7 + 0.8 * Rf()),
                al = grow(k, y) * (0.15 + 0.12 * near) * (1 - 0.2 * t) * (0.55 + 0.9 * N(x / (0.09 * H) + y / (0.13 * H) + 1300, 2)), gd = g.createRadialGradient(x, y, 0, x, y, r);
              gd.addColorStop(0, `rgba(${INK},${(UND * al).toFixed(3)})`); gd.addColorStop(1, `rgba(${INK},0)`); g.globalAlpha = 1; g.fillStyle = gd; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
            g.restore(); g.fillStyle = `rgb(${INK})`;
            if (kYP.length) for (let q = 0; q < tries * 0.35; q++) { const r1 = Rf(), w = w0 * (1.1 + 1.1 * r1), a = atY(1.1, w); if (!a) continue; put(pk(kYP), a[0], a[1], w, 0.5, 1, 0); put(pk(kYP), a[0] + w * (Rf() - 0.5) * 0.5, a[1] + w * 0.1, w * 0.8, 0.5, 0.9, 0); } }
          for (let q = 0; q < tries; q++) { const r1 = Rf(), a = atY(1.0, w0 * (0.7 + 0.8 * r1)); if (!a) continue; const [x, y, t] = a, pale = kYP.length && Rf() < 0.03 + 0.15 * t * t + 0.08 * (1 - near); if (!pale && t < 0.8 && drop[col(x)] > 1e8 && (kZA.length || kZB.length)) {
              // Sheet Z (11-19; Yang of sheet Y's patches in use: "texture từng mảng rừng trông hơi giả tạo": five mounds of one size, each
              // in its own halo of dabs, repeated). Long woods, laid about twice as wide: level ones where the ridge above runs level, the
              // slanting ones where it climbs, turned the way it climbs (never rotated: the tree tops stand). Not at the foot (their
              // lower edge runs out in long drips), not on a capped summit, and only where the mountain is under both ends.
              const wz = w0 * (1.5 + 1.1 * r1), ka = col(x - 0.42 * wz), kb = col(x + 0.42 * wz), sl = (top[kb] - top[ka]) / (0.84 * wz), as = Math.abs(sl), r3 = Rf();
              if (x - 0.5 * wz > bx0 - 0.035 * H - extL && x + 0.5 * wz < bx1 + 0.035 * H + extR && depthFull[ka] > 0.03 * H && depthFull[kb] > 0.03 * H && slp[ka] < 2.1 && slp[kb] < 2.1 && y > top[col(x)] + 0.17 * wz /* (0.25 left a bare strip between the ridge and the slanting woods under it) */ /* the sheet's tree tops are stout: over the ridge they stood as a row of fingers. The ridge keeps sheet Y's tree lines */) {
                if (kZB.length && as > 0.45 && as < 1.6 && r3 < 0.6) { lay.push([y, x, t, pk(kZB), 4, r1, Rf(), sl > 0]); continue; }
                if (kZA.length && as < 0.4 && y > Math.max(top[ka], top[kb]) + 0.18 * wz && r3 < 0.55) { lay.push([y, x, t, pk(kZA), 3, r1, Rf()]); continue; } } }
            lay.push([y, x, t, pale ? pk(kYP) : kZC.length && Rf() < 0.07 ? pk(kZC) : pk(kYF), pale ? 1 : 0, r1, Rf()]); }
          if (kYT.length) for (let q = 0; q < tries * 0.5; q++) { const a = atY(0.8, 0); if (!a) continue; const [x, y, t] = a; if (t < 0.93) continue;   /* single trees only at the very foot, where the wood meets the mist */ lay.push([y, x, t, pk(kYT), 2, Rf(), Rf()]); }
          // (Yang 11-19, r012, a red ring on the flank of a near mountain: "sao lại có lằn ranh này?" On a slope no piece may sit right
          // under the ridge (its downhill end would hang out over it), so a strip there stayed bare: the smooth band of the ridge
          // stroke and a wedge of pale body under it, their edge against the wood a line running down the mountain. Now small
          // patches in two rows along that strip, clipped to what lies under the ridge line so nothing hangs out; the wood below
          // is laid over their feet. (source-atop did nothing here: ink over ink with the alpha kept is no change.)
          { g.save(); g.beginPath(); g.moveTo(bx0 - 0.1 * H, yBase + 0.4 * H); g.lineTo(bx0 - 0.1 * H, top[0]); for (let k = 0; k < nb; k++) g.lineTo(bx0 + k * BIN, top[k] + 0.002 * H); g.lineTo(bx1 + 0.1 * H, top[nb - 1]); g.lineTo(bx1 + 0.1 * H, yBase + 0.4 * H); g.closePath(); g.clip();
            for (let row = 0; row < 2; row++) for (let x = bx0 + 0.02 * H; x < bx1 - 0.02 * H;) { const w = w0 * (0.6 + 0.5 * Rf()), k = col(x), y = top[k] + w * (0.12 + 0.4 * row + 0.4 * Rf()), r2 = Rf(), al = (0.55 + 0.4 * Rf()) * (0.65 + 0.35 * near);
              if (depthFull[k] > (0.05 + 0.04 * row) * H && y < yBase + 0.07 * H && r2 < grow(k, y)) put(pk(kYF), x, y, w, 0.5, al, 0); x += w * 0.3; }
            g.restore(); g.globalAlpha = 1; }
          lay.sort((p, q) => p[0] - q[0]);
          for (const [y, x, t, m, kind, r1, r2, mir] of lay) {
            if (kind >= 3) put(m, x, y, w0 * (1.5 + 1.1 * r1) * (1 - 0.25 * t), kind === 3 ? 0.5 : 0.5, (0.55 + 0.4 * r2) * (0.65 + 0.35 * near) * (1 - 0.12 * t), 0, kind === 4 ? mir : undefined);
            else if (kind === 2) put(m, x, y, w0 * (0.09 + 0.08 * r1), 0.95, (0.35 + 0.45 * r2) * (0.6 + 0.4 * near) * (1 - 0.4 * t), 0);
            else put(m, x, y, w0 * (0.7 + 0.8 * r1) * (1 - 0.3 * t), 0.55, kind ? 0.6 + 0.4 * r2 : (0.55 + 0.4 * r2) * (0.65 + 0.35 * near) * (1 - 0.12 * t), 0); }
          if (kYL.length && !land) for (let x = bx0 + 0.04 * H; x < bx1 - 0.04 * H;) { const m = pk(kYL), w = H * (0.045 + 0.05 * Rf()) * (0.7 + 0.5 * near) * Math.min(1.6, m.w / m.h / 2.6), k = col(x), k1 = col(x - w / 2), k2 = col(x + w / 2), ang = Math.atan2(top[k2] - top[k1], w),
              stand = sm((N(x / (0.05 * H) + 500, 2) - 0.4) / 0.14), hi = 0.3 + 0.7 * sm((yBase - top[k]) / span / 0.6);
            if (Math.abs(ang) > 0.7 || depthFull[k] < 0.06 * H || Rf() > fa * hi * (0.2 + 0.8 * stand)) { x += w * 0.45; continue; }
            put(m, x, (top[k1] + top[k2] + 2 * top[k]) / 4, w, 0.6, (0.6 + 0.35 * Rf()) * (0.65 + 0.35 * near), ang); x += w * (0.55 + 0.5 * Rf()); }
          g.globalAlpha = 1; }
        else {
        if (kM.length) for (let q = 0; q < cnt / 5; q++) { const a = at(1.35); if (!a) continue; const [x, y, t] = a, m = kM[Math.floor(Rf() * kM.length) % kM.length], w = s0 * (2.2 + 2.6 * Rf()) * (1 - 0.3 * t), h = w * m.h / m.w * (1 + 0.5 * Rf()); g.globalAlpha = (0.3 + 0.5 * Rf()) * (0.6 + 0.4 * near) * (1 - 0.5 * t); g.drawImage(m.im, x - w / 2, y - h / 2, w, h); }
        for (let q = 0; q < cnt / 2.5; q++) { const a = at(1.35); if (!a) continue; const [x, y, t] = a, sz = s0 * (0.4 + 0.8 * Rf() * Rf()) * (1 - 0.3 * t); g.globalAlpha = (0.3 + 0.5 * Rf()) * (0.6 + 0.4 * near) * (1 - 0.5 * t); g.beginPath();
          if (Rf() < 0.7) g.ellipse(x, y, sz * (0.3 + 0.25 * Rf()), sz * (0.75 + 0.6 * Rf()), (Rf() - 0.5) * 0.5, 0, 6.2832); else g.ellipse(x, y, sz * (0.45 + 0.3 * Rf()), sz * (0.4 + 0.25 * Rf()), Rf() * 3, 0, 6.2832);
          g.fill(); } } }
      g.globalAlpha = 1; }
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
            // an end that comes down near the level of the sea is lost in it whole: between the bank on the ridge line and the
            // sea a strip of foot showed through, cut off from its mountain (a grey smudge at the left foot, bot still r7).
            // Not for an end high above the sea: mist from there down is the upright white column again
            if (e2 < 0.995) a = Math.max(a, (1 - e2) * (1 - sm((cM[i] - t - 0.06 * H) / (0.1 * H))) * sm((y - t - 0.005 * H) / (0.03 * H)));
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
      let mq = MQ; const KQ = 2; mist = document.createElement('canvas'); mist.width = mw; mist.height = mh; { const x = mist.getContext('2d');
        if (!MBLOB) { if (tb) x.filter = `blur(${(MSOFT * H / MQ).toFixed(2)}px)`; x.drawImage(sharp, 0, 0); }
        else {
          // Mist with depth (Yang 11-19: mist is no lump of pure white; as particle smoke is built, many soft blobs, dense at
          // one end and fading, lying over each other). The mask above is no longer the mist, it is where mist may lie and
          // how thick: thousands of flat pale wisps are laid by it, each taking only a little of the ink under it. Where many
          // lie it is white, where few the mountain shows through pale; wisps also stray up above the sea, thinner the
          // higher. Only well under the level of the sea (the old mask moved down and melted) is it whole, as before.
          const kA = (suf) => S.tex === 'code' ? [] : (STROKES['muse' + suf] || []).filter((q) => q.im), kW = kA('_aw'), kP = kA('_ap'), kV = kA('_av');   // sheet AA (11-19): real wet touches as the wisps: long trailing ones, puffs (laid flat), torn veils. Brush 'code': the one drawn blob
          // Laid in three kinds (Yang 11-19, of the first lay: "chưa thấy khác lắm": thousands of small faint wisps average
          // out, whatever their shape, and the sheet could not be seen). Deep in the sea the many small ones, as before, for
          // an even white. Along its top few and large ones, each taking much: tongues of mist whose shape reads. And
          // above that, middling ones lying across the body, paler the higher. The top is drawn finer than the mask is
          // read (KQ px of mist per value), or the shapes of the large ones were lost again.
          const Rm = dice(d.seed ^ 0x3b17), SP = wisp(), q = 1 / MQ, dn = 0.035 * H * q, upM = 0.05 * H * q;
          mist.width = mw * KQ; mist.height = mh * KQ; mq = MQ / KQ; x.setTransform(KQ, 0, 0, KQ, 0, 0);
          // The whole white no longer follows the old mask moved down a little (its shape was all one saw, the wisps only
          // frayed its rim): in each column it begins D0 under the top of the mist and grows over D1, so a broad band under
          // the top, and a bank on the end of a ridge altogether, is left to the wisps. eY, eZ: the first and second top
          // of mist in a column (a bank above, the sea under it), from above.
          const eY = new Float32Array(mw).fill(-1), eZ = new Float32Array(mw).fill(-1), deep = new ImageData(mw, mh), dp = deep.data, D0 = 0.025 * H * q, D1 = 0.09 * H * q;
          for (let i = 0; i < mw; i++) { let run = 0; for (let j = 0; j < mh; j++) { const a = px[(j * mw + i) * 4 + 3]; if (a > 110) { if (!run) { if (eY[i] < 0) eY[i] = j; else if (eZ[i] < 0) eZ[i] = j; } run++; } else if (a < 40) run = 0;
            if (run > D0) dp[(j * mw + i) * 4 + 3] = Math.round(a * sm((run - D0) / D1)); } }
          sharp.getContext('2d').putImageData(deep, 0, 0); x.filter = `blur(${(0.022 * H * q * KQ).toFixed(2)}px)`; x.drawImage(sharp, 0, 0); x.filter = 'none';
          const col = (v) => clamp(Math.round(v), 0, mw - 1), keepAt = (bx, top) => 1 - cE[col(bx)] * (1 - sm((my + top * MQ - cT[col(bx)] - 0.012 * H) / (0.03 * H))),   // none over the line of the ridge away from its ends
            put = (m, bx, by, w, h, al, fl, rot) => { x.globalAlpha = Math.min(1, al * (m ? clamp(0.2 / m.tone, 0.6, 1.6) : 1)); x.setTransform(KQ * fl, 0, 0, KQ, KQ * bx, KQ * by); x.rotate(rot * fl); x.drawImage(m ? m.im : SP, -w / 2, -h / 2, w, h); };
          const len = mw * MQ / H, nBig = Math.round(len * MB.eb), nMid = Math.round(len * MB.em);
          for (let b = 0; b < nBig + nMid; b++) { const big = b < nBig, bx = Rm() * mw, r1 = Rm(), r2 = Rm(), r3 = Rm(), r4 = Rm(), r5 = Rm(), r6 = Rm(), r7 = Rm(), r8 = Rm(), e = r8 < 0.5 && eZ[col(bx)] >= 0 ? eZ[col(bx)] : eY[col(bx)]; if (e < 0) continue;
            const kit = big ? (r6 < 0.3 && kV.length ? kV : kW.length ? kW : kP) : (r6 < 0.5 && kP.length ? kP : kW), m = kit.length ? kit[Math.floor(r7 * kit.length) % kit.length] : null,
              w = Math.min(0.6 * mw, H * q * (big ? 0.26 + 0.46 * r1 : 0.11 + 0.24 * r1)), h = (m ? w * clamp(m.h / m.w * (kit === kP ? 0.5 : 1), 0.1, big ? 0.22 : 0.3) : w * (0.18 + 0.14 * r2)) * (0.85 + 0.3 * r2),
              by = big ? e + H * q * (-0.01 + 0.13 * r3) : e - H * q * (0.012 + 0.1 * r3), ed = Math.min(bx, mw - bx) - 0.5 * w; if (ed <= 0) continue;
            const ea = eY[col(bx - 0.25 * w)], eb = eY[col(bx + 0.25 * w)], rot = (ea < 0 || eb < 0 ? 0 : 0.7 * clamp(Math.atan2(eb - ea, 0.5 * w), -0.3, 0.3)) + (r5 - 0.5) * 0.16,   // it lies along the top of the mist there
              keep = sm(ed / (0.1 * H * q)) * Math.min(keepAt(bx, by - 0.35 * h), keepAt(bx - 0.3 * w, by - 0.35 * h), keepAt(bx + 0.3 * w, by - 0.35 * h)); if (keep < 0.02) continue;
            put(m, bx, by, w, h, keep * (big ? (MB.ab + 0.35 * r5) * (0.65 + 0.35 * r3) :(MB.am + 0.2 * r5) * (1 - 0.6 * r3)), r4 < 0.5 ? -1 : 1, rot); }
          const cnt = Math.min(7000, Math.round(mw * mh * MQ * MQ / (H * H) * MB.n));
          for (let b = 0; b < cnt; b++) { const bx = Rm() * mw, by = Rm() * mh, r0 = Rm(), up = upM * r0 * r0, r1 = Rm(), r2 = Rm(), r3 = Rm(), r4 = Rm(), r5 = Rm(),
              f = px[(clamp(Math.round(by + up), 0, mh - 1) * mw + clamp(bx | 0, 0, mw - 1)) * 4 + 3] / 255 * (1 - 0.75 * up / upM); if (f < 0.02) continue;
            const r6 = Rm(), r7 = Rm(), kit = r1 > 0.55 && kW.length ? kW : r6 < 0.4 && kV.length ? kV : kP.length ? kP : kW, m = kit.length ? kit[Math.floor(r7 * kit.length) % kit.length] : null,
              w = H * (MB.w0 + MB.w1 * r1 * r1) * q, h = m ? w * clamp(m.h / m.w * (kit === kP ? 0.4 : kit === kV ? 0.7 : 1), 0.1, 0.42) * (0.8 + 0.4 * r2) : w * (0.16 + 0.22 * r2), ci = clamp(bx | 0, 0, mw - 1), ed = Math.min(bx, mw - bx) - 0.5 * w; if (ed <= 0) continue;   // a wisp cut by the edge of the mask stood as an upright line
            // (and none over the line of the ridge away from its ends: straying up, they veiled the stroke the player drew)
            const keep = sm(ed / (0.1 * H * q)) * (1 - cE[ci] * (1 - sm((my + (by - 0.35 * h) * MQ - cT[ci] - 0.012 * H) / (0.03 * H)))), clump = 0.55 + 1.15 * sm((f2(bx * MQ / (0.2 * H) + 31, by * MQ / (0.07 * H) + 17, 2) - 0.36) / 0.3);   // gathered in banks, thin between
            if (keep < 0.02) continue; put(m, bx, by, w, h, f * (0.3 + 0.7 * f) * keep * (MB.a0 + MB.a1 * r3 * r3 * r3) * clump, r4 < 0.5 ? -1 : 1, (r5 - 0.5) * 0.24); }   // thinned toward the top: there the large ones speak
          x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; } } mxy = [mx, my, mq]; }
    if (land) {   // the level foot, the line of the water along it (sheet F: a river bank's dark edge), its image below, a few dashes of still water (sheet J)
      let yb = -1e9, ya = 1e9; for (const p of P) { yb = Math.max(yb, p[1]); ya = Math.min(ya, p[1]); }
      // a bank: the stroke is its upper line and stays as flown; the earth hangs under it, a little below the stroke's lowest
      // point, never below the paper. An end that stands above the foot runs out thin (it stood cut off plumb, a slab)
      const foot = Math.max(yb + 0.003 * H, Math.min(yb + 0.003 * H + (land === 'bank' ? clamp(0.05 * (bx1 - bx0), 0.02 * H, 0.07 * H) : 0), H - 0.03 * H)), fy = Math.round((foot - oy) * dpr), cw2 = cv.width, ch2 = cv.height, hl = Math.max(0.02 * H, foot - ya), cx = (bx0 + bx1) / 2,
        // a foot at the very bottom of the paper has no room for water under it: cut level there it stood as a bare ruled line
        // with a white strip below (Yang r013). Such a piece stands on the paper's edge as ground: its ink thins out to nothing
        // over a band above the foot, no waterline, no image, no dashes
        // Likewise a piece standing ON other land (its foot on that land's body at this place: under its upper line THERE, not
        // merely under its highest point, which took a rock in the water beside a sloping bank for one on it and left its
        // foot a bare cut, Yang r014)
        onLand = st.done.some((o) => { if (o === d || !o.m || !o.m.solid) return false; const k = Math.floor((cx - o.m.bx0) / BIN); return k >= 0 && k < o.m.ts.length && foot > o.m.ts[k] + 0.004 * H && foot < o.m.yBase + 0.012 * H; }),
        ground = onLand || H - foot < 0.07 * H, fdG = Math.round(clamp(0.3 * hl, 0.035 * H, 0.11 * H) * dpr);
      // Marks of its own kind (Yang 11-19: rock and earth were built from the same kits, differing only in amounts: "hao hao nhau,
      // khó phân biệt"). Sheets AG and AH, Muse's and Gemini's both: brush MARKS laid over the built body, never a whole shape.
      //   rock   black, dry, angular: large axe-cuts slanting down its face, small chops, dry scrapes low down, blunt dots on its edge
      //   earth  grey, soft, lying: hemp-fibre bundles along the slope, a soft fold or two, rice dots under the upper line, grass on it
      // The shared cun of the mountain builder is turned down for both (S.cun above). Laid inside the body only; dots and grass stand on the edge.
      { const K = (sf) => (STROKES['muse' + sf] || []).concat(STROKES['gemini' + sf] || []).filter((q) => q.im && q.tone > 0.02 && q.w > 60), Rk = dice(d.seed ^ 0x6a2d), pk = (kit) => kit[Math.floor(Rk() * kit.length) % kit.length], w = bx1 - bx0,
          tm = document.createElement('canvas'), bin = (x) => clamp(Math.floor((x - bx0) / BIN), 1, ts.length - 2), topAt = (x) => ts[bin(x)], slopeAt = (x) => Math.atan2(ts[bin(x) + 1] - ts[bin(x) - 1], 2 * BIN),
          mark = (G, q, x, y, mw, rot, al, fx, ax, ay) => { const mh = mw * q.h / q.w; G.save(); G.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr); G.translate(x, y); G.rotate(rot); G.scale(fx, 1); G.globalAlpha = al; G.drawImage(q.im, -ax * mw, -ay * mh, mw, mh); G.restore(); };
        tm.width = cw2; tm.height = ch2; const xm = tm.getContext('2d'), gc = cv.getContext('2d'), each = (n, f) => { for (let i = 0; i < n; i++) { const x = bx0 + (0.06 + 0.88 * (i + Rk()) / n) * w, top = topAt(x), dep = foot - top; if (dep > 0.008 * H) f(x, top, dep); } };
        if (ts.length > 3 && aux('_f').length) {
          if (land === 'rock') { const kA = K('_ga'), kS = K('_gs'), kD = K('_gd'), kM = K('_gm'), nA = clamp(Math.round(w / (0.45 * hl)), 2, 8);
            if (kD.length) each(1 + Math.floor(w / (0.2 * H)), (x, top, dep) => mark(xm, pk(kD), x, top + dep * (0.45 + 0.4 * Rk()), clamp(w * (0.25 + 0.3 * Rk()), 0.03 * H, 0.25 * H), (Rk() - 0.5) * 0.3, 0.35 + 0.25 * Rk(), Rk() < 0.5 ? -1 : 1, 0.5, 0.5));
            if (kA.length) each(nA, (x, top, dep) => { const fx = Rk() < 0.5 ? -1 : 1; mark(xm, pk(kA), x, top + dep * (0.2 + 0.45 * Rk()), clamp(dep * (0.5 + 0.6 * Rk()), 0.02 * H, 0.22 * H), fx * (0.5 + 0.5 * Rk()), 0.5 + 0.4 * Rk(), fx, 0.3, 0.5); });
            if (kS.length) each(2 * nA + 2, (x, top, dep) => { const fx = Rk() < 0.5 ? -1 : 1; mark(xm, pk(kS), x, top + dep * (0.1 + 0.75 * Rk()), clamp(dep * (0.15 + 0.2 * Rk()), 0.01 * H, 0.06 * H), fx * (0.3 + 0.7 * Rk()), 0.6 + 0.35 * Rk(), fx, 0.3, 0.5); });
            xm.setTransform(1, 0, 0, 1, 0, 0); xm.globalCompositeOperation = 'destination-in'; xm.drawImage(body, 0, 0); gc.save(); gc.setTransform(1, 0, 0, 1, 0, 0); gc.globalAlpha = 1; gc.drawImage(tm, 0, 0); gc.restore();
            if (kM.length) each(1 + Math.floor(Rk() * 3), (x, top) => { const mw = clamp(0.2 * hl, 0.012 * H, 0.035 * H); mark(gc, pk(kM), x, top + 0.15 * mw, mw, Rk() * 6.283, 0.85, 1, 0.5, 0.5); }); }
          else { const kH = K('_eh'), kC = K('_ec'), kR = K('_ed'), kG = K('_eg');
            // Near earth is the darkest thing on the paper (Yang 11-19: grey and full of thin lines it read as weak; "tô đậm nó đen lại và chỉ để lại 1 chút chỗ mờ"):
            // one dark wash over the whole body, heavy under the upper line, thinning to a pale strip along the foot. Few marks on top of it.
            // Not a flat fill (Yang 11-19: "thay vì chỉ phủ bằng tô đậm thì mình nên phủ nhiều texture lên"): the dark is built of brush marks. A thin
            // wash underneath only so no paper shows between them; over it rows of wet earth strokes (AH _ec, and sheet AK's broad dark washes _kw
            // when it is there), many, overlapping, lying along the slope, heavy under the upper line and fewer and paler downward; in the
            // lower part dry scrapes (AG _gd, AK _kd), so the dark breaks up into the pale strip instead of fading smoothly.
            { const gd = xm.createLinearGradient(0, (ya - oy) * dpr, 0, fy); gd.addColorStop(0, `rgba(${INK},0.38)`); gd.addColorStop(0.6, `rgba(${INK},0.28)`); gd.addColorStop(0.86, `rgba(${INK},0.1)`); gd.addColorStop(1, `rgba(${INK},0)`); xm.fillStyle = gd; xm.fillRect(0, 0, cw2, fy); }
            { const kW = K('_kw').length ? K('_kw').concat(STROKES.muse_ec || []).filter((q) => q.im) : K('_ec'), kDr = K('_kd').concat(K('_gd')), kGy = K('_kg'), kMo = K('_km'), kLv = K('_kl'), nr = clamp(Math.round(hl / (0.012 * H)), 3, 9), sdm = () => (Rk() < 0.5 ? -1 : 1);
              if (kW.length) for (let r = 0; r < nr; r++) { const fr = (r + 0.5) / nr; each(clamp(Math.round(w / ((kGy.length ? 0.13 : 0.07) * H) * (1 - 0.5 * fr)), kGy.length ? 2 : 4, kGy.length ? 22 : 40), (x, top, dep) => mark(xm, pk(kGy.length && fr > 0.55 && Rk() < 0.7 ? kGy : kW), x, top + dep * clamp(fr + (Rk() - 0.5) / nr, 0.02, 0.98), clamp((0.1 + 0.14 * Rk()) * H, 0.04 * H, 0.7 * w), slopeAt(x) * (1 - fr) + (Rk() - 0.5) * 0.12, (1 - 0.78 * fr * fr) * (0.6 + 0.4 * Rk()), sdm(), 0.5, 0.5)); }
              if (kDr.length) each(clamp(Math.round(w / (0.1 * H)), 2, 16), (x, top, dep) => mark(xm, pk(kDr), x, top + dep * (0.5 + 0.4 * Rk()), clamp((0.08 + 0.1 * Rk()) * H, 0.04 * H, 0.6 * w), (Rk() - 0.5) * 0.1, 0.45 + 0.35 * Rk(), sdm(), 0.5, 0.5));
              // sheet AK's small marks: level dabs strewn through the upper half, a few clusters of wet moss dots under the upper line
              if (kLv.length) each(clamp(Math.round(w / (0.09 * H)), 2, 24), (x, top, dep) => mark(xm, pk(kLv), x, top + dep * (0.08 + 0.5 * Rk()), (0.025 + 0.03 * Rk()) * H, slopeAt(x) + (Rk() - 0.5) * 0.1, 0.6 + 0.4 * Rk(), sdm(), 0.5, 0.5));
              if (kMo.length) each(clamp(Math.round(w / (0.35 * H)), 1, 5), (x, top, dep) => mark(xm, pk(kMo), x, top + dep * (0.06 + 0.2 * Rk()), (0.022 + 0.02 * Rk()) * H, (Rk() - 0.5) * 0.6, 0.9, sdm(), 0.5, 0.5)); }
            if (kC.length) each(Math.round(w / (0.3 * H)) + 1, (x, top, dep) => mark(xm, pk(kC), x, top + dep * (0.3 + 0.4 * Rk()), clamp((0.12 + 0.18 * Rk()) * H, 0.04 * H, 0.6 * w), slopeAt(x) + (Rk() - 0.5) * 0.15, 0.3 + 0.2 * Rk(), Rk() < 0.5 ? -1 : 1, 0.5, 0.5));
            if (kH.length) each(clamp(Math.round(w / (0.3 * H)), 1, 5), (x, top, dep) => { const fx = Rk() < 0.5 ? -1 : 1; mark(xm, pk(kH), x, top + dep * (0.2 + 0.5 * Rk()), clamp((0.1 + 0.16 * Rk()) * H, 0.04 * H, 0.6 * w), slopeAt(x) + fx * 0.28 + (Rk() - 0.5) * 0.2, 1, fx, 0.5, 0.5); });
            if (kR.length) each(Math.round(w / (0.22 * H)) + 1, (x, top, dep) => mark(xm, pk(kR), x, top + dep * (0.1 + 0.3 * Rk()), (0.04 + 0.04 * Rk()) * H, slopeAt(x), 0.55 + 0.25 * Rk(), Rk() < 0.5 ? -1 : 1, 0.5, 0.5));
            xm.setTransform(1, 0, 0, 1, 0, 0); xm.globalCompositeOperation = 'destination-in'; xm.drawImage(body, 0, 0); gc.save(); gc.setTransform(1, 0, 0, 1, 0, 0); gc.globalAlpha = 1; gc.drawImage(tm, 0, 0); gc.restore();
            if (kG.length) each(Math.round(w / (0.18 * H)), (x, top, dep) => dep > 0.3 * hl && gc.getImageData(Math.round((x - ox) * dpr), Math.round((top + 0.016 * H - oy) * dpr), 1, 1).data[3] > 70 && mark(gc, pk(kG), x, top + 0.004 * H, (0.02 + 0.02 * Rk()) * H, 0.5 * slopeAt(x), 0.7 + 0.3 * Rk(), Rk() < 0.5 ? -1 : 1, 0.5, 0.95)); } } }
      if (land === 'bank') { const nb = ts.length, fw = clamp(0.12 * (bx1 - bx0), 0.02 * H, 0.1 * H);
        for (const cx2 of [cv, body]) { const x = cx2.getContext('2d'); x.save(); x.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = 1;
          for (const [xe, sg, te] of [[bx0, 1, ts[0]], [bx0 + nb * BIN, -1, ts[nb - 1]]]) { const gd = x.createLinearGradient(xe, 0, xe + sg * fw, 0); gd.addColorStop(0, 'rgba(0,0,0,1)'); gd.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gd; x.fillRect(Math.min(xe - sg * 0.3 * H, xe + sg * fw), te + 0.008 * H, fw + 0.3 * H, H); }
          x.restore(); } }
      for (const cx2 of [cv, body]) { const x = cx2.getContext('2d'); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = 1; if (ground) { const gd = x.createLinearGradient(0, fy - fdG, 0, fy); gd.addColorStop(0, 'rgba(0,0,0,0)'); gd.addColorStop(0.55, 'rgba(0,0,0,0.45)'); gd.addColorStop(1, 'rgba(0,0,0,1)'); x.fillStyle = gd; x.fillRect(0, fy - fdG, cw2, fdG); }
        x.fillStyle = '#000'; x.fillRect(0, fy, cw2, ch2); x.restore(); }
      const t = document.createElement('canvas'); t.width = cw2; t.height = ch2; const x = t.getContext('2d'), gx = cv.getContext('2d'), kf = aux('_f');
      if (kf.length && !ground) { const q = kf[Math.floor(R() * kf.length) % kf.length], hF = Math.min(0.014 * H, (bx1 - bx0) * q.h / q.w) * dpr; x.globalAlpha = 0.75; x.drawImage(q.im, (bx0 - ox) * dpr, fy - hF * 0.9, (bx1 - bx0) * dpr, hF);
        x.globalAlpha = 1; x.globalCompositeOperation = 'destination-in'; x.drawImage(body, 0, Math.round(0.004 * H * dpr)); x.globalCompositeOperation = 'destination-out'; x.fillRect(0, fy, cw2, ch2); x.globalCompositeOperation = 'source-over';
        gx.save(); gx.setTransform(1, 0, 0, 1, 0, 0); gx.globalAlpha = 1; gx.drawImage(t, 0, 0); gx.restore(); x.clearRect(0, 0, cw2, ch2); }
      const rh = ground ? 0 : Math.min(0.5 * hl, 0.07 * H, (ch2 - fy) / dpr - 2);
      if (rh > 0.004 * H) { const k = rh / hl; x.setTransform(1, 0, 0, -k, 0, fy * (1 + k)); x.drawImage(cv, 0, 0, cw2, fy, 0, 0, cw2, fy); x.setTransform(1, 0, 0, 1, 0, 0);
        x.globalCompositeOperation = 'destination-out'; const gd = x.createLinearGradient(0, fy, 0, fy + rh * dpr); gd.addColorStop(0, 'rgba(0,0,0,0.35)'); gd.addColorStop(1, 'rgba(0,0,0,1)'); x.fillStyle = gd; x.fillRect(0, fy, cw2, ch2);
        x.fillStyle = '#000'; for (let y = fy + 2 * dpr; y < fy + rh * dpr; y += (2 + 7 * R()) * dpr) { x.globalAlpha = 0.5 + 0.5 * R(); x.fillRect(0, y, cw2, Math.max(1, (0.6 + 1.2 * R()) * dpr)); } x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
        gx.save(); gx.setTransform(1, 0, 0, 1, 0, 0); gx.globalAlpha = 1; gx.filter = `blur(${(0.0012 * H * dpr).toFixed(2)}px)`; gx.drawImage(t, 0, 0); gx.filter = 'none'; gx.restore();
        const kj = aux('_j'); if (kj.length) { gx.save(); gx.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr); const w = bx1 - bx0;
          for (let k2 = 0, nd = land === 'bank' ? 4 + Math.floor(3 * R()) : 2 + Math.floor(2 * R()); k2 < nd; k2++) { const j = kj[Math.floor(R() * kj.length) % kj.length], dw = clamp(w * (land === 'bank' ? 0.08 + 0.2 * R() : 0.3 + 0.5 * R()), 0.02 * H, 0.3 * H), dh = Math.min(dw * j.h / j.w, 0.006 * H);
            gx.globalAlpha = 0.3 + 0.35 * R(); gx.drawImage(j.im, bx0 + R() * Math.max(1, w - dw), foot + (k2 ? R() : 0.1) * rh - dh / 2, dw, dh); } gx.restore(); } }
      // Mist along its foot, as a mountain has (Yang 11-19: "cái chân của nó mình cũng phủ sương lên như núi ấy"). The mountain's own mist
      // is a sea that eats into the body and is tied to its ridge; near land gets a plain one: wisps of sheet AA laid along the foot, most
      // of them low, a few rising a little way up the face. Laid as every mist is (taken out of what is painted before it: the body's
      // lower part, its image in the water), so wood standing on it stays in front. Amount = the mist slider; none at 0.
      let lm = null, lxy = mxy; { const kA = (STROKES.muse_aw || []).concat(STROKES.muse_ap || [], STROKES.muse_av || []).filter((q) => q.im), mAmt = hillS(0, 0).mist;
        if (kA.length && mAmt > 0.02) { const Q2 = 2, x0 = bx0 - 0.15 * H, x1 = bx1 + 0.15 * H, band = clamp(0.5 * hl, 0.03 * H, 0.12 * H), y0 = foot - band - 0.06 * H, y1 = foot + 0.06 * H, Rf = dice(d.seed ^ 0x4e1b);
          lm = document.createElement('canvas'); lm.width = Math.ceil((x1 - x0) / Q2); lm.height = Math.ceil((y1 - y0) / Q2); const xg = lm.getContext('2d');
          for (let i = 0, nm = Math.round((bx1 - bx0) / (0.045 * H) * (0.5 + mAmt)); i < nm; i++) { const q = kA[Math.floor(Rf() * kA.length) % kA.length], mw2 = H * (0.14 + 0.3 * Rf()), mh2 = Math.min(mw2 * q.h / q.w, band * (0.5 + 0.7 * Rf())), r = Rf(), cx3 = bx0 + Rf() * (bx1 - bx0), cy3 = foot + 0.008 * H - band * 0.9 * r * r;
            xg.save(); xg.translate((cx3 - x0) / Q2, (cy3 - y0) / Q2); xg.scale(Rf() < 0.5 ? -1 : 1, 1); xg.globalAlpha = Math.min(1, (0.3 + 0.4 * Rf()) * (1 - 0.5 * r) * (0.6 + 0.8 * mAmt) * clamp(0.2 / Math.max(0.02, q.tone), 0.6, 1.6)); xg.drawImage(q.im, -mw2 / 2 / Q2, -mh2 / 2 / Q2, mw2 / Q2, mh2 / Q2); xg.restore(); }
          lxy = [x0, y0, Q2]; } }
      return { cv, body, mist: lm, mxy: lxy, ox, oy, bx0, ts, depth: depthFull.map((v, k2) => Math.min(v, foot + rh - ts[k2] + 0.02 * H)), yBase: foot, yTop, extL, extR, tone, solid: true, cx, peaks: 0, ms: Math.round(performance.now() - tB), mistMs: 0 }; }
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
    const kitF = own('_f'), kitG = own('_g'), kitR = own('_r').filter((q) => q.tone < 0.15), kitW = own('_w'), kitK = own('_s').length ? own('_s') : own('_k').concat(own('_r').filter((q) => q.tone >= 0.15)),   // _s: the dry-brush shore rocks of sheet K, before sheet H's (outlined as with a marker). Of H, a wide group of rocks is cut as a long piece like a ripple: told apart by how much ink it holds
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
    // a few rocks on the banks, where a bank is drawn: upright, and wholly on the land, just clear of the bank line.
    // (Set with their foot on the line, a rock on the near bank stood up into the water and one on a level reach sat
    // across the line: Yang 11-19, now in the stream, now on the stroke)
    if (kitK.length) for (let k = 0, cnt = Math.round(L / (0.3 * H)); k < cnt; k++) { const sd = sides[R() < 0.5 ? 0 : 1], q = kitK[Math.floor(R() * kitK.length) % kitK.length]; let i = -1;
      for (let t = 0; t < 6 && i < 0; t++) { const c2 = 4 + Math.floor(R() * (n - 8)); if (sd.ga(c2) > 0.5 && env(c2) > 0.6) i = c2; }
      if (i < 0) continue; const w = H * (0.012 + 0.026 * nearY(sd.E[i][1])) * (0.7 + 0.6 * R()), h = w * q.h / q.w; const ex = -sd.sg * tan[i][1], ey = sd.sg * tan[i][0], out = 0.5 * (Math.abs(ex) * w + Math.abs(ey) * h) + 0.003 * H;   // out: from the bank line to the rock's middle, half the rock's size across the bank and a hair more
        gk.drawImage(q.im, sd.E[i][0] + ex * out - w / 2, sd.E[i][1] + ey * out - h / 2, w, h); }
    // reeds on the banks (sheet K, shared with the lake's shores): a few clumps where a bank is drawn, upright, foot on
    // the land at the bank line. On the near bank a clump stands before the water: never taller than most of the stream is wide
    if (kitW.length) for (let k = 0, cnt = Math.round(L / (0.22 * H)); k < cnt; k++) { const sd = sides[R() < 0.5 ? 0 : 1]; let i = -1;
      for (let t = 0; t < 6 && i < 0; t++) { const c2 = 4 + Math.floor(R() * (n - 8)); if (sd.ga(c2) > 0.5 && env(c2) > 0.6) i = c2; }
      if (i < 0) continue; const ex = -sd.sg * tan[i][1], ey = sd.sg * tan[i][0];
      for (let j = 0, jn = 1 + Math.floor(R() * 3); j < jn; j++) { const q = kitW[Math.floor(R() * kitW.length) % kitW.length], i2 = clamp(i + Math.round((R() - 0.5) * 14), 2, n - 3), p = sd.E[i2]; let w = H * (0.014 + 0.026 * nearY(p[1])) * (0.6 + 0.7 * R()); const fl = R() < 0.5;
        if (ey > 0.3) w = Math.min(w, 1.6 * hw[i2] * q.w / q.h); if (w < 0.006 * H) continue;
        const dd = Math.abs(ex) * w / 2 + 0.003 * H; stand(gk, q, p[0] + ex * dd, p[1] + ey * dd, w, fl); } }
    { raw(gk); const gd = gk.createLinearGradient(0, 0, 0, chh); for (let k = 0; k <= 8; k++) gd.addColorStop(k / 8, `rgba(0,0,0,${(0.78 * (0.4 + 0.6 * nearY(oy + k / 8 * chh / dpr))).toFixed(3)})`);   // far reaches pale
      gk.globalCompositeOperation = 'destination-in'; gk.fillStyle = gd; gk.fillRect(0, 0, cw, chh); raw(g); g.drawImage(bnk, 0, 0); home(g); }
    gs.globalCompositeOperation = 'destination-out'; gs.fillStyle = '#000'; water(gs); gs.fill(); gs.globalCompositeOperation = 'source-over';
    { const [w2, g2] = mk(); raw(g2); g2.filter = `blur(${(0.009 * H * dpr).toFixed(1)}px)`; g2.drawImage(wsh, 0, 0); g2.filter = 'none'; g2.globalCompositeOperation = 'source-in'; g2.fillStyle = `rgb(${INK})`; g2.fillRect(0, 0, cw, chh);
      raw(g); g.globalAlpha = 0.22; g.globalCompositeOperation = 'destination-over'; g.drawImage(w2, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; home(g); }
    // -- the current: a few thin lines along the stream, short, each keeping to its own place between the banks
    g.strokeStyle = `rgb(${INK})`; g.lineCap = 'round';
    // With real hair lines (sheet G) the current MOVES (Yang 11-19): the lines are not baked with the river but drawn
    // each frame on a layer of their own (live), by flow(T). Each line keeps to its own streamline (a fixed path
    // between the banks) and drifts down it, far to near: it swells out of nothing, runs a stretch, thins to nothing
    // again, and begins anew (its period per, its place in it t0). Fading is done by THICKNESS, not alpha: the slices
    // are laid opaque (at part alpha every overlap of two slices showed as a dark hair), and a line under a pixel thick
    // pales by itself. The whole layer is then paled with depth, as the banks.
    let live = null, flow = null;
    if (kitG.length) { const [lv, gl] = mk(), seg = L / (n - 1), dir = up ? 1 : -1, lines = []; live = lv;
      // What makes it read as water and not as marks sliding over the paper (Yang 11-19, first try: all lines at one
      // even speed, each rigid):
      //   speed   the stream runs fast where it is narrow and slow where it is broad. Lines live in 'tau', the time
      //           the water takes to get there (tauc: tau at each point of the stroke), so a line stretches out and
      //           hurries through a narrow reach, and bunches up and idles in a pool. Mid-stream runs faster than
      //           the water along the banks (per).
      //   shape   its streamline is not fixed: a wave of sideways drift runs down the river faster than the lines,
      //           through them, so each one wriggles as it goes
      //   stroke  heavy at its head (downstream), a long thin tail behind
      let hm = 0; for (const w of hw) hm += w / n; const tauc = [0]; for (let i = 1; i < n; i++) tauc.push(tauc[i - 1] + seg / clamp(Math.sqrt(hm / Math.max(1e-3, (hw[i] + hw[i - 1]) / 2)), 0.6, 1.8)); const Tt = tauc[n - 1];
      const idx = (tau) => { let a = 0, b = n - 1; while (b - a > 1) { const m = (a + b) >> 1; if (tauc[m] <= tau) a = m; else b = m; } return a + clamp((tau - tauc[a]) / Math.max(1e-6, tauc[b] - tauc[a]), 0, 1); };
      for (let k = 0, cnt = Math.round(L / (0.045 * H)); k < cnt; k++) { const u0 = (R() < 0.5 ? -1 : 1) * (0.12 + 0.63 * R());
        lines.push({ a0: R() * Tt, len: H * (0.04 + 0.11 * R()), u0, ph: R() * 90, q: kitG[Math.floor(R() * kitG.length) % kitG.length], fr: R(), per: (4.5 + 3.5 * R()) * (0.7 + 0.6 * Math.abs(u0)), t0: R(), run: H * (0.28 + 0.3 * R()) }); }
      const gd = gl.createLinearGradient(0, 0, 0, chh); for (let k = 0; k <= 8; k++) gd.addColorStop(k / 8, `rgba(0,0,0,${(0.6 * (0.4 + 0.6 * nearY(oy + k / 8 * chh / dpr))).toFixed(3)})`);
      flow = (T) => { raw(gl); gl.globalCompositeOperation = 'source-over'; gl.clearRect(0, 0, cw, chh);
        for (const ln of lines) { const s = (T / ln.per + ln.t0) % 1, tS = ln.a0 + dir * (s - 0.5) * ln.run; if (tS < 0 || tS + ln.len > Tt) continue;
          const im = clamp(Math.round(idx(tS + ln.len / 2)), 0, n - 1), life = sm(s / 0.2) * sm((1 - s) / 0.25) * env(im) * sm((hw[im] - 0.008 * H) / (0.008 * H)); if (life < 0.04) continue;   // none in a far reach too narrow to hold one
          const m = Math.max(3, Math.round(ln.len / 8)), Q = [], cl = [0];
          for (let j = 0; j <= m; j++) { const fi = Math.min(n - 1.001, idx(tS + ln.len * j / m)), i = fi | 0, f = fi - i, tx = tan[i][0] + (tan[i + 1][0] - tan[i][0]) * f, ty = tan[i][1] + (tan[i + 1][1] - tan[i][1]) * f,
            w = (hw[i] + (hw[i + 1] - hw[i]) * f) * clamp(ln.u0 + 0.34 * (N(fi * seg / (0.05 * H) + ln.ph + 9000 - dir * T * 0.55, 2) - 0.5), -0.82, 0.82); Q.push([P[i][0] + (P[i + 1][0] - P[i][0]) * f - ty * w, P[i][1] + (P[i + 1][1] - P[i][1]) * f + tx * w * FORE]);
            if (j) cl.push(cl[j - 1] + Math.hypot(Q[j][0] - Q[j - 1][0], Q[j][1] - Q[j - 1][1])); }
          const q = ln.q, lp = cl[m], frac = clamp(lp / (0.5 * H), 0.15, 0.9), us = ln.fr * (1 - frac) * q.w, th0 = life * H * (0.0024 + 0.0032 * nearY(Q[0][1])) * (0.7 + 0.6 * ln.fr), ds = 3; let j = 0;   // th0: the height of the piece, the line in it about half of that
          for (let a = 0; a < lp; a += ds) { while (j < m - 1 && cl[j + 1] < a) j++; const x = dir > 0 ? a / lp : 1 - a / lp, th = th0 * (0.1 + 0.9 * sm(x / 0.65) * sm((1 - x) / 0.14)), dx = Q[j + 1][0] - Q[j][0], dy = Q[j + 1][1] - Q[j][1], l = Math.hypot(dx, dy) || 1, f = a - cl[j];
            gl.setTransform(dpr * dx / l, dpr * dy / l, -dpr * dy / l, dpr * dx / l, dpr * (Q[j][0] + dx / l * f - ox), dpr * (Q[j][1] + dy / l * f - oy)); gl.drawImage(q.im, clamp(us + a / lp * frac * q.w, 0, q.w - 2), 0, Math.max(1, (ds + 0.8) / lp * frac * q.w), q.h, 0, -th / 2, ds + 0.8, th); } }
        raw(gl); gl.globalCompositeOperation = 'destination-in'; gl.fillStyle = gd; gl.fillRect(0, 0, cw, chh); gl.globalCompositeOperation = 'source-over'; home(gl); leap(T, gl); };
      // a fish leaps across the stream where it is broad enough to hold the leap
      const leap = leaper(d.seed, (r1, r2, sg) => { const i = 4 + Math.floor(r1 * (n - 8)); if (hw[i] < 0.02 * H || env(i) < 0.7) return null;
        const sz = H * (0.016 + 0.024 * nearY(P[i][1])), span = Math.min(sz * (1.6 + r2), hw[i] * 1.1); return { x0: P[i][0] - sg * span / 2, y0: P[i][1], span, sz, sg, hgt: span * (0.45 + 0.25 * r2) }; }); }
    if (kitG.length) { const [cur, gc] = mk();   // ripples and such: laid opaque and paled as one (as the banks)
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
    return { river: true, live, flow, cv, body, mist: null, mxy: [0, 0, 1], ox, oy, yBase: y1, yTop: y0, tone: 1, peaks: 0, ms: Math.round(performance.now() - tB), mistMs: 0 };
  }

  // One stroke -> one lake (Yang 11-19, key 3). The stroke is the shore: flown round, its ends joined if left open. Still
  // water is bare paper, as the river's. What tells it from a river:
  //   shape   seen from the side a lake lies flat: a round loop is pressed down to about 0.42 of its breadth (SQ)
  //   shores  the near shore (the lower side of the loop, land in front of the water) dark and full; the far shore thin
  //           and pale, and gone in stretches (mist). Own sheet I: dark strokes for the near shore, pale for the far
  //   water   level dashes (sheet J), pointed at both ends, never turned: larger and darker toward the near shore, few
  //           and faint toward the far one
  function lake(d) {
    const tB = performance.now(), H = D.H, R = dice(d.seed), N = noise1(R); let P0 = calm(d.stroke, STEP, 6);
    if (P0.length < 12) return null;
    // -- closing the loop (Yang 11-19: the ends snap together). Flown past its own start, the overlap is cut where head
    //    and tail come nearest; what gap is left is bridged by a curve that leaves along the tail and arrives along the
    //    head (a straight chord left a flat side and two corners)
    { const m = P0.length, q = m >> 2; let bi = 0, bj = m - 1, bd = 1e9;
      for (let i = 0; i <= q; i++) for (let j = m - 1 - q; j < m; j++) { const dd = Math.hypot(P0[j][0] - P0[i][0], P0[j][1] - P0[i][1]); if (dd < bd) { bd = dd; bi = i; bj = j; } }
      if (bd < SNAP * H && bj - bi > 12) P0 = P0.slice(bi, bj + 1); }
    { const m = P0.length, a = P0[m - 1], b = P0[0], gap = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.floor(gap / STEP);
      const u = (p, q) => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [(q[0] - p[0]) / l * gap * 1.4, (q[1] - p[1]) / l * gap * 1.4]; }, ta = u(P0[Math.max(0, m - 6)], a), tb = u(b, P0[Math.min(m - 1, 5)]);
      for (let i = 1; i < k; i++) { const t = i / k, t2 = t * t, t3 = t2 * t, h0 = 2 * t3 - 3 * t2 + 1, h1 = t3 - 2 * t2 + t, h2 = 3 * t2 - 2 * t3, h3 = t3 - t2;
        P0.push([h0 * a[0] + h1 * ta[0] + h2 * b[0] + h3 * tb[0], h0 * a[1] + h1 * ta[1] + h2 * b[1] + h3 * tb[1]]); } }
    const n = P0.length, wrap = (A, i) => A[((i % n) + n) % n];
    let xa = 1e9, xb = -1e9, ya = 1e9, yb = -1e9; for (const p of P0) { xa = Math.min(xa, p[0]); xb = Math.max(xb, p[0]); ya = Math.min(ya, p[1]); yb = Math.max(yb, p[1]); }
    const cy = (ya + yb) / 2, SQ = clamp(0.42 * (xb - xa) / Math.max(1, yb - ya), 0.5, 1);
    const P = P0.map((_, i) => { let x = 0, y = 0; for (let j = -5; j <= 5; j++) { const q = wrap(P0, i + j); x += q[0]; y += q[1]; } return [x / 11, cy + (y / 11 - cy) * SQ]; });   // the join rounded off with the rest
    ya = cy - (cy - ya) * SQ; yb = cy + (yb - cy) * SQ;
    let area = 0; for (let i = 0; i < n; i++) { const a = P[i], b = wrap(P, i + 1); area += a[0] * b[1] - b[0] * a[1]; }
    const or = area > 0 ? 1 : -1, cum = [0]; for (let i = 1; i <= n; i++) { const a = P[i - 1], b = wrap(P, i); cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    const Lp = cum[n], tan = P.map((_, i) => { const a = wrap(P, i - 3), b = wrap(P, i + 3), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }),
       out = tan.map((t) => [or * t[1], -or * t[0]]), nearY = (y) => clamp((y / H - 0.2) / 0.7, 0, 1), wN = (i) => 0.5 + 0.5 * out[i][1];   // out: toward the land. wN: 1 on the near shore, 0 on the far one
    const pad = Math.round(0.08 * H), ox = Math.floor(xa) - pad, oy = Math.floor(ya) - pad, cw = Math.ceil((xb - xa + 2 * pad + 2) * dpr), chh = Math.ceil((yb - ya + 2 * pad + 2) * dpr);
    const mk = () => { const cv = document.createElement('canvas'); cv.width = cw; cv.height = chh; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr); return [cv, g]; };
    const [cv, g] = mk(), [body, gb] = mk(), [wat, gw] = mk(), [shr, gk] = mk(), [dsh, gc] = mk();
    const home = (x) => x.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr), raw = (x) => x.setTransform(1, 0, 0, 1, 0, 0);
    gw.fillStyle = '#000'; gw.beginPath(); gw.moveTo(P[0][0], P[0][1]); for (let i = 1; i < n; i++) gw.lineTo(P[i][0], P[i][1]); gw.closePath(); gw.fill();
    raw(gb); gb.filter = `blur(${(0.016 * H * dpr).toFixed(1)}px)`; gb.globalAlpha = 0.6; gb.drawImage(wat, 0, 0); gb.filter = `blur(${(0.003 * H * dpr).toFixed(1)}px)`; gb.globalAlpha = 1; gb.drawImage(wat, 0, 0); gb.filter = 'none'; home(gb);
    const tones = (y, k) => { const gd = g.createLinearGradient(0, 0, 0, chh); for (let i = 0; i <= 8; i++) gd.addColorStop(i / 8, `rgba(0,0,0,${(k * (0.45 + 0.55 * nearY(oy + i / 8 * chh / dpr))).toFixed(3)})`); return gd; };
    const fade = (x, k) => { raw(x); x.globalCompositeOperation = 'destination-in'; x.fillStyle = tones(0, k); x.fillRect(0, 0, cw, chh); x.globalCompositeOperation = 'source-over'; home(x); };
    // -- the shores: slices of a real stroke laid opaque, its waterline on the loop, the rest on the land; a stretch
    //    begins and ends thin (as the river's banks)
    const own = (suf) => { if (S.tex === 'code') return []; const a = (STROKES[S.tex + suf] || []).filter((q) => q.im); return a.length ? a : (STROKES['muse' + suf] || []).filter((q) => q.im); };
    const kitI = own('_i'), base = kitI.length ? kitI : own('_f').length ? own('_f') : (STROKES[S.tex] || []).filter((q) => q.im), dark = base.filter((q) => q.tone >= 0.2), pale = base.filter((q) => q.tone < 0.2);
    const shore = (kit, part, thick, ph) => { if (!kit.length) return;
      const q = kit[Math.floor(R() * kit.length) % kit.length], ds = 2, per = 0.7 * H, off = R() * 2; let j = 0;
      for (let a = 0; a < Lp; a += ds) { while (j < n - 1 && cum[j + 1] < a) j++;
        const al = part(j) * sm((N(cum[j] / (0.18 * H) + ph, 2) + 0.28 * wN(j) - 0.5) / 0.12); if (al < 0.05) continue;
        const f = clamp((a - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]), 0, 1), b = wrap(P, j + 1), px = P[j][0] + (b[0] - P[j][0]) * f, py = P[j][1] + (b[1] - P[j][1]) * f;
        const th = thick * al * H * (0.012 + 0.02 * nearY(py)) * (0.7 + 0.6 * N(a / (0.05 * H) + ph + 60, 2)); let v = (a / per + off) % 2; if (v > 1) v = 2 - v;
        gk.setTransform(dpr * tan[j][0], dpr * tan[j][1], dpr * out[j][0], dpr * out[j][1], dpr * (px - ox), dpr * (py - oy));
        gk.drawImage(q.im, clamp(v * (q.w - 2), 0, q.w - 2), 0, Math.max(1, (ds + 0.8) / per * q.w), q.h, 0, -0.03 * th, ds + 0.8, th); }
      home(gk); };
    shore(dark.length ? dark : base, (i) => sm((wN(i) - 0.3) / 0.25), 1, 300);
    shore(pale.length ? pale : base, (i) => sm((0.7 - wN(i)) / 0.25), pale.length ? 0.75 : 0.4, 400);
    // -- reeds and a rock or two on the shores (Yang 11-19; sheet K: _w reeds, _s rocks): upright, foot on the shore line.
    //    Two or three clumps on the near shore (standing before the water), a few small pale ones on the far; most of
    //    the shore left bare. A rock lies wholly on the land, just clear of the line (as the river's)
    { const kitW = own('_w'), kitS = own('_s'), pick = (kit) => kit[Math.floor(R() * kit.length) % kit.length], idx = (i) => ((i % n) + n) % n,
        spot = (ok) => { for (let t = 0; t < 14; t++) { const i = Math.floor(R() * n) % n; if (ok(i)) return i; } return -1; }, per = n / Math.max(1, Lp);   // per: points to a pixel of shore
      if (kitW.length) { for (let c2 = 0, cn = 2 + Math.floor(R() * 2); c2 < cn; c2++) { const i0 = spot((i) => wN(i) > 0.62); if (i0 < 0) continue;
          for (let k = 0, kn = 2 + Math.floor(R() * 3); k < kn; k++) { const i = idx(i0 + Math.round((R() - 0.5) * 0.1 * H * per)), p = P[i], w = H * (0.02 + 0.03 * nearY(p[1])) * (0.55 + 0.7 * R());
            stand(gk, pick(kitW), p[0] + out[i][0] * 0.004 * H, p[1] + out[i][1] * 0.004 * H, w, R() < 0.5); }
          if (kitS.length && R() < 0.6) { const i = idx(i0 + Math.round((R() < 0.5 ? -1 : 1) * (0.05 + 0.04 * R()) * H * per)), p = P[i], q = pick(kitS), w = H * (0.022 + 0.03 * nearY(p[1])) * (0.7 + 0.5 * R()), h = w * q.h / q.w, dd = 0.5 * (Math.abs(out[i][0]) * w + Math.abs(out[i][1]) * h) + 0.003 * H;
            stand(gk, q, p[0] + out[i][0] * dd, p[1] + out[i][1] * dd + h / 2, w, R() < 0.5); } }
        gk.globalAlpha = 0.55; for (let c2 = 0, cn = 1 + Math.floor(R() * 2); c2 < cn; c2++) { const i = spot((j) => wN(j) < 0.3); if (i < 0) continue; const p = P[i];
          stand(gk, pick(kitW), p[0] + out[i][0] * 0.002 * H, p[1] + out[i][1] * 0.002 * H, H * 0.014 * (0.7 + 0.6 * R()), R() < 0.5); } gk.globalAlpha = 1; } }
    fade(gk, pale.length ? 0.85 : 0.6); raw(g); g.drawImage(shr, 0, 0); home(g);
    // -- still water: level dashes scattered over the lake, kept clear of the shores
    const inside = (x, y) => { let c2 = false; for (let i = 0, j = n - 1; i < n; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c2 = !c2; } return c2; };
    const kitJ = own('_j'), tries = Math.round(Math.abs(area) / 2 / (0.0022 * H * H));
    for (let k = 0; k < tries; k++) { const x = xa + R() * (xb - xa), y = ya + R() * (yb - ya), fy = (y - ya) / Math.max(1, yb - ya), r1 = R(), r2 = R(), len = H * (0.02 + 0.07 * fy) * (0.6 + 0.8 * r1);
      if (r2 > 0.25 + 0.75 * fy || !inside(x - len * 0.7, y) || !inside(x + len * 0.7, y) || !inside(x, y - 0.012 * H) || !inside(x, y + 0.012 * H)) continue;
      if (kitJ.length) { const q = kitJ[Math.floor(R() * kitJ.length) % kitJ.length], hh = Math.min(len * q.h / q.w, H * (0.0025 + 0.003 * fy)); gc.drawImage(q.im, x - len / 2, y - hh / 2, len, hh); }
      else { gc.strokeStyle = '#000'; gc.lineWidth = H * 0.0014; gc.beginPath(); gc.moveTo(x - len / 2, y); gc.lineTo(x + len / 2, y); gc.stroke(); } }
    { raw(gc); gc.globalCompositeOperation = 'source-in'; gc.fillStyle = `rgb(${INK})`; gc.fillRect(0, 0, cw, chh); gc.globalCompositeOperation = 'source-over'; home(gc); }
    fade(gc, 0.6); raw(g); g.drawImage(dsh, 0, 0);
    g.globalAlpha = 0.11; g.globalCompositeOperation = 'destination-out'; g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, cw, chh); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; home(g);
    // a fish leaps now and then, on a layer of its own redrawn each frame (as the river's current)
    const [live, gl] = mk(), leap = leaper(d.seed, (r1, r2, sg) => { const x = xa + r1 * (xb - xa), y = ya + (0.25 + 0.7 * r2) * (yb - ya), sz = H * (0.016 + 0.024 * nearY(y)), span = sz * (1.6 + r2);
        if (!inside(x, y - 0.01 * H) || !inside(x, y + 0.01 * H) || !inside(x + sg * span, y - 0.01 * H) || !inside(x + sg * span, y + 0.01 * H)) return null; return { x0: x, y0: y, span, sz, sg, hgt: span * (0.45 + 0.25 * r2) }; }),
      flow = (T) => { raw(gl); gl.clearRect(0, 0, cw, chh); home(gl); leap(T, gl); };
    // for the image in the water (mirror): the far shore, column by column of the layer (the highest point of the loop
    // there; found from the loop itself: read back from the mask it took a second), smoothed, a notch would tear the image
    const top = new Float32Array(cw).fill(1e9); for (let i = 0; i < n; i++) { const a = P[i], b = wrap(P, i + 1), xA = (a[0] - ox) * dpr, xB = (b[0] - ox) * dpr, x0 = Math.max(0, Math.floor(Math.min(xA, xB))), x1 = Math.min(cw - 1, Math.ceil(Math.max(xA, xB)));
      for (let x = x0; x <= x1; x++) { const f = Math.abs(xB - xA) < 1e-6 ? 0 : clamp((x - xA) / (xB - xA), 0, 1), y = ((a[1] + (b[1] - a[1]) * f) - oy) * dpr; if (y < top[x]) top[x] = y; } }
    const kS = Math.round(0.012 * H * dpr), topS = top.map((_, x) => { let a = 0, c2 = 0; for (let j = -kS; j <= kS; j++) { const v = top[x + j]; if (v < 1e8) { a += v; c2++; } } return top[x] < 1e8 && c2 ? a / c2 : -1; });
    return { river: true, wat, top: topS, w0: (ya - oy) * dpr, w1: (yb - oy) * dpr, live, flow, cv, body, mist: null, mxy: [0, 0, 1], ox, oy, yBase: yb, yTop: ya, tone: 1, peaks: 0, ms: Math.round(performance.now() - tB), mistMs: 0 };
  }

  // The waterline (Yang 11-19): a Thuỷ stroke flown level across most of the paper. Not a river and not a lake: it is
  // set dead level (at the stroke's mean height; water that leans or bends reads wrong) and runs from edge to edge. All
  // that is farther stands above it and shows upside down in it (mirror), the water reaching to the foot of the paper and
  // paling into it. No shore is drawn: a thin broken line where water meets the far land, a few level dashes on the water.
  // What is drawn lower than the line stands before the water (zk).
  function sea(d) {
    const tB = performance.now(), H = D.H, W = D.W, R = dice(d.seed), y = clamp(Math.round(meanY(d)), 0.08 * H, 0.94 * H);
    const pad = Math.round(0.03 * H), ox = 0, oy = y - pad, cw = Math.ceil(W * dpr), chh = Math.ceil((H - oy) * dpr);
    const mk = () => { const cv = document.createElement('canvas'); cv.width = cw; cv.height = chh; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr); return [cv, g]; };
    const [cv, g] = mk(), [body, gb] = mk(), [wat, gw] = mk(), raw = (x) => x.setTransform(1, 0, 0, 1, 0, 0);
    gw.fillStyle = '#000'; gw.fillRect(-10, y, W + 20, H - y + 10);
    raw(gb); gb.filter = `blur(${(0.0025 * H * dpr).toFixed(1)}px)`; gb.drawImage(wat, 0, 0); gb.filter = 'none';
    const kitJ = (STROKES[S.tex + '_j'] || []).filter((q) => q.im).length ? STROKES[S.tex + '_j'].filter((q) => q.im) : (STROKES.muse_j || []).filter((q) => q.im);
    const dash = (x, yy, len, hh, a) => { g.globalAlpha = a; if (kitJ.length) { const q = kitJ[Math.floor(R() * kitJ.length) % kitJ.length]; g.drawImage(q.im, x - len / 2, yy - hh / 2, len, Math.min(hh, len * q.h / q.w)); } else g.fillRect(x - len / 2, yy - hh / 4, len, hh / 2); };
    // where water meets the far land: long thin stretches, with gaps
    for (let x = -0.1 * H; x < W;) { const len = H * (0.12 + 0.35 * R()); if (R() < 0.7) dash(x + len / 2, y + 0.001 * H, len, 0.003 * H, 0.2 + 0.25 * R()); x += len * (0.8 + 0.5 * R()); }
    // on the water: few, larger toward the near side, none in the lowest stretch (the water pales into the paper)
    for (let k = 0, kn = Math.round(W * (H - y) / (0.02 * H * H)); k < kn; k++) { const f = R(), x = R() * W, r1 = R(), r2 = R(); if (r2 > 0.2 + 0.5 * f || f > 0.9) continue;
      dash(x, y + (0.02 + 0.98 * f) * (H - y), H * (0.025 + 0.08 * f) * (0.6 + 0.8 * r1), H * (0.0025 + 0.003 * f), (0.3 + 0.3 * r1) * (1 - f * f)); }
    g.globalAlpha = 1; raw(g); g.globalCompositeOperation = 'source-in'; g.fillStyle = `rgb(${INK})`; g.fillRect(0, 0, cw, chh); g.globalCompositeOperation = 'source-over';
    return { river: true, sea: true, wat, top: new Float32Array(cw).fill(pad * dpr), w0: pad * dpr, w1: chh, live: null, flow: null, cv, body, mist: null, mxy: [0, 0, 1], ox, oy, yBase: y, yTop: y, tone: 1, peaks: 0, ms: Math.round(performance.now() - tB), mistMs: 0 };
  }

  // One stroke -> one tree (Yang 11-19, key 4). The stroke is the trunk: its lower end the root, its upper end the top,
  // bent as it was flown; the code grows the branches and hangs the foliage. Own sheets: M (_t trunks lying level, root
  // at the left, 'c' = the row of the middle line; its short branch pieces _y are not used: a branch is grown), N (_n pine
  // needle fans, _p pine boughs, flat underneath; _q clusters of leaf dots).
  //   kind    a pine (branches standing off the trunk, a bough on the end of each) or a broadleaf tree (branches
  //           forking off at a shallow angle, a cluster of leaf dots at the end of each): one or the other, by the stroke's seed (X draws it the other way)
  //   size    everything follows the length of the stroke: a long one is a tall tree, a short one a bush
  // Ink over ink: a tree hides nothing behind it. No drawn-by-code version: always Muse's sheets, whatever the brush.
  const kitOf = (suf) => (STROKES['muse' + suf] || []).filter((q) => q.im);
  let limbSc = null;   // the sheet limbs are laid on before they go onto a tree (see limbRaw)
  const FORCE = new URLSearchParams(location.search).get('tk');   // ?tk=willow: every tree of that kind, to look at it
  // lead kind -> its company. Pine with mixed leaf trees; a leaf grove of two or three dottings; willow by the water with
  // a bare tree; bamboo with an old dry tree (kumu zhushi); the wintry grove (hanlin) with the evergreens that outlast it.
  const GROVES = { pine: ['dots', 'mi'], dots: ['jiezi', 'bare'], jiezi: ['dots', 'mi'], mi: ['jiezi', 'dots'], willow: ['bare', 'dots'], bamboo: ['bare'], bare: ['pine', 'bamboo'] };
  const throwGrove = () => { const k = Object.keys(GROVES), g = new URLSearchParams(location.search).get('grove'); st.grove = GROVES[g] ? g : k[Math.floor(Math.random() * k.length)]; };
  throwGrove();
  function tree(d) {
    const tB = performance.now(), H = D.H, R = dice(d.seed), P = calm(d.stroke, STEP, 5), n = P.length;
    if (n < 6) return null;
    // A stroke flown level and long is no tree lying down: it is a branch seen close, as in bird-and-flower painting
    // (zhezhi, the "broken-off branch"; Yang 11-19). Sheets P (_bt old plum branches, _bw twigs, base left) and Q, the
    // one sheet in colour (_fl blossoms, _bd buds on their calyx, _pt loose petals). Thick where the flight began.
    const kitBT = kitOf('_bt').filter((q) => /-(1|4)\.png$/.test(q.f)),   // only the two that were painted nearly straight (the stout one, the wiry one). The elbowed ones, straightened by the cutter and cut into slices along a path, break into shards; the bends come from the flight instead
       run0 = Math.hypot(P[n - 1][0] - P[0][0], P[n - 1][1] - P[0][1]), zhe = kitBT.length > 0 && run0 > 0.3 * D.W && Math.abs(P[n - 1][1] - P[0][1]) < 0.58 * Math.abs(P[n - 1][0] - P[0][0]);
    if (zhe) { const Rz = dice(d.seed ^ 0x5bd1), nk = 3 + Math.floor(Rz() * 3), kn = [0]; for (let k = 1; k < nk; k++) kn.push((k % 2 ? 1 : -1) * (0.006 + 0.009 * Rz()) * D.H * (Rz() < 0.8 ? 1 : -0.4)); kn.push(0);   // an old branch is angular: bent at a few elbows, to one side and the other by turns
      const P0 = P.map((q) => q.slice());   // moved off the path as it was flown: by a point's already moved neighbour the direction was wrong at every step, the path shook from point to point and the stroke laid along it was torn into a comb of splinters ("nét vẽ bị tách", Yang 11-19)
      for (let i = 1; i < n - 1; i++) { const t = i / (n - 1) * nk, k = Math.min(nk - 1, Math.floor(t)), z = kn[k] + (kn[k + 1] - kn[k]) * (0.5 - 0.5 * Math.cos(3.1416 * (t - k))), a = P0[Math.max(0, i - 3)], b = P0[Math.min(n - 1, i + 3)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; P[i] = [P0[i][0] - (b[1] - a[1]) / l * z, P0[i][1] + (b[0] - a[0]) / l * z, P0[i][2]]; } }
    else if (P[0][1] < P[n - 1][1]) P.reverse();
    // An old pine's trunk is never the line it was flown: it winds, swung one way and back two or three times on its way up
    // (Yang 11-19, his reference paintings: "gần rồi"; the trunk was what still stood straight). Root and top stay where they
    // were flown; the swing is widest in the lower middle. Off the path as flown, not off the moved neighbour (see zhe).
    { const g0 = GROVES[st.grove] || GROVES.pine, h0 = ((Math.abs(d.seed) * 2654435761) >>> 0) % 100;
      if (!zhe && (FORCE || (h0 < 70 ? st.grove : g0[h0 % g0.length])) === 'pine') { const Rt = dice(d.seed ^ 0x71a3), P0 = P.map((q) => q.slice()); let L0 = 0; for (let i = 1; i < n; i++) L0 += Math.hypot(P0[i][0] - P0[i - 1][0], P0[i][1] - P0[i - 1][1]);
        const A = (0.05 + 0.045 * Rt()) * L0 * (Rt() < 0.5 ? 1 : -1), fq = 1.1 + 0.7 * Rt(), ph = 0.6 * Rt(), A2 = 0.3 * A * (Rt() - 0.5), W = Math.max(3, Math.round(n / 10));
        for (let i = 1; i < n - 1; i++) { const t = i / (n - 1), env = Math.pow(Math.sin(3.1416 * Math.pow(t, 0.75)), 0.8), z = env * (A * Math.sin(6.2832 * (fq * t + ph)) + A2 * Math.sin(6.2832 * (2.7 * fq * t + ph * 3))), a = P0[Math.max(0, i - W)], b = P0[Math.min(n - 1, i + W)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; P[i] = [P0[i][0] - (b[1] - a[1]) / l * z, P0[i][1] + (b[0] - a[0]) / l * z, P0[i][2]]; } } }
    // A trunk cannot turn tighter than about its own thickness (Yang 11-19, two trees flown with a hook near the root: on the outside of
    // the bend the slices of the stroke fanned open into white slits, on the inside they piled into a fold with a flat cut, a snapped
    // stick). The path is eased where it turns too tight, there only: points whose bend is tighter than the least radius are drawn toward
    // their neighbours until none is. Root and top stay.
    { let L0 = 0; for (let i = 1; i < n; i++) L0 += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      const Rm = 1.1 * clamp(0.1 * L0, 0.012 * D.H, 0.08 * D.H), k = Math.max(1, Math.round(0.5 * Rm / Math.max(0.5, L0 / (n - 1))));
      for (let it = 0; it < 400; it++) { const hot = new Uint8Array(n); let any = false;
        for (let i = 1; i < n - 1; i++) { const a = P[Math.max(0, i - k)], b = P[i], c = P[Math.min(n - 1, i + k)], ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ac = Math.hypot(c[0] - a[0], c[1] - a[1]);
          if (2 * Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) > ab * bc * ac / Rm || ac < 0.6 * (ab + bc)) { any = true; for (let q = Math.max(1, i - k); q <= Math.min(n - 2, i + k); q++) hot[q] = 1; } }
        if (!any) break; const B = P.map((q) => q.slice()); for (let i = 1; i < n - 1; i++) if (hot[i]) { P[i][0] = (B[i - 1][0] + 2 * B[i][0] + B[i + 1][0]) / 4; P[i][1] = (B[i - 1][1] + 2 * B[i][1] + B[i + 1][1]) / 4; } } }
    const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const L = cum[n - 1], kitT = kitOf('_t'), kitN = kitOf('_n'), kitP = kitOf('_p'), kitQ = kitOf('_q'), kitU = kitOf('_tu'), kitLJ = kitOf('_lj'), kitLM = kitOf('_lm'), kitWL = kitOf('_wl').concat(kitOf('_wb')).filter((q) => q.tone > 0.03), kitBS = kitOf('_bs').filter((q) => q.h < 0.06 * q.w), kitBL = kitOf('_bl'), pick = (kit) => kit[Math.floor(R() * kit.length) % kit.length];
    if (!kitT.length) return null;
    // which tree: thrown by the stroke's seed (X throws again). Sheets R (_lj drooping leaf strokes, _lm level Mi dots), S (_wl willow
    // curtains), T (_bs bamboo stalks, _bl its leaves), U (_tu trunks, one pass of a wide brush each; with M's)
    // Not any tree next to any tree (Yang 11-19: seven kinds in one grove). As the old manuals group them: one kind leads a
    // painting (about 7 trees in 10), one or two that go with it keep it company. The painting's grove is thrown when the
    // paper is cleared (st.grove; ?grove=pine picks it); the stroke's seed then says which of the grove this tree is.
    const gv = GROVES[st.grove] || GROVES.pine, hs = ((Math.abs(d.seed) * 2654435761) >>> 0) % 100;
    let kind = hs < 70 ? st.grove : gv[hs % gv.length]; if (FORCE) kind = FORCE;
    if ((kind === 'jiezi' && !kitLJ.length) || (kind === 'mi' && !kitLM.length) || (kind === 'bamboo' && !kitBS.length)) kind = 'dots';
    const pine = kind === 'pine', bare = kind === 'bare', wil = kind === 'willow', tan = P.map((_, i) => { const a = P[Math.max(0, i - 3)], b = P[Math.min(n - 1, i + 3)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; });
    let xa = 1e9, xb = -1e9, ya = 1e9, yb = -1e9; for (const p of P) { xa = Math.min(xa, p[0]); xb = Math.max(xb, p[0]); ya = Math.min(ya, p[1]); yb = Math.max(yb, p[1]); }
    const pad = Math.round(clamp(0.8 * L, 0.1 * H, 0.42 * H)), ox = Math.floor(xa) - pad, oy = Math.floor(ya) - pad, cw = Math.ceil((xb - xa + 2 * pad + 2) * dpr), chh = Math.ceil((yb - ya + 2 * pad + 2) * dpr);   // room on every side, under the root too: a trunk flown level or bent over hangs its foliage below its own root (r010: cut off along a ruled line)
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = chh; const g = cv.getContext('2d'), home = () => g.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr); home();
    // -- limbs. Trunk and branches are the same thing at different sizes: a stretch of a real trunk (from u0 of the piece
    //    to its tip, so every limb runs out to a point; further along the piece = thinner) in thin slices along a path
    const kitAll = kitT.concat(kitU), kitDry = kitAll.filter((q) => q.tone < 0.42), kitFull = kitAll.filter((q) => q.tone >= 0.42), qT = pick(zhe ? kitBT : kind === 'bamboo' ? kitBS : bare && kitDry.length ? kitDry : kitAll)   /* bare wood = a dry, streaky stroke. On a big tree its streaks, enlarged, were a bundle of cables with paper between them, a lattice where limbs lie over each other; a full stroke instead was smooth and coarse, a pole (Yang 11-19, both). So: the dry stroke stays, and a big bare tree gets a thinner, paler full stroke laid under every limb (back, below): the streaks keep their grain but stand on wood, not on paper */, fl = R() < 0.5 ? -1 : 1, th0 = zhe ? clamp(0.85 * L * qT.h / qT.w, 0.025 * H, 0.07 * H) : clamp((pine ? 1.9 : 1.6) * L * qT.h / qT.w, 0.006 * H, (pine ? 0.08 : 0.075) * H);   // an old pine is sparse but never gaunt: a stout trunk, stout limbs (as thin as a pole it looked sickly, Yang 11-19)
    const wrapR = (v) => Math.atan2(Math.sin(v), Math.cos(v));
    const limbRaw = (Q, u0, G = g, X = ox, Y = oy, q_ = qT, th_ = th0) => { if (!limbSc || limbSc.width < G.canvas.width || limbSc.height < G.canvas.height) { limbSc = document.createElement('canvas'); limbSc.width = G.canvas.width; limbSc.height = G.canvas.height; } const sc = limbSc, sx = sc.getContext('2d'); let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; const m = Q.length, cl = [0]; for (let i = 1; i < m; i++) cl.push(cl[i - 1] + Math.hypot(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1])); const Lq = cl[m - 1], ds = 2, tn = Q.map((_, i) => { const A = Q[Math.max(0, i - 3)], B = Q[Math.min(m - 1, i + 3)], l = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; return [(B[0] - A[0]) / l, (B[1] - A[1]) / l]; }); let j = 0;   // tn: the way the path runs at each of its points. A slice is turned by the two nearest, blended: turned by its segment alone every slice of a segment stood the same way and the next segment's a little otherwise, and a dry stroke's streaks, far from the middle of a thick trunk, broke at every point into steps (a bundle of kinked cables, Yang 11-19)
      for (let a = 0; a < Lq; a += ds) { while (j < m - 2 && cl[j + 1] < a) j++; const f = clamp((a - cl[j]) / Math.max(1e-6, cl[j + 1] - cl[j]), 0, 1), T0 = tn[j], T1 = tn[j + 1], vx = T0[0] + (T1[0] - T0[0]) * f, vy = T0[1] + (T1[1] - T0[1]) * f, l = Math.hypot(vx, vy) || 1, tx = vx / l, ty = vy / l, ex = Math.min(4, 0.85 * th_ * Math.abs(T0[0] * T1[1] - T0[1] * T1[0]) * ds / Math.max(1, cl[j + 1] - cl[j]));   // ex: on a bend the slices fan apart on the outer side: each a little wider there, so no paper shows between them
        // Laid on a sheet of its own first, each slice wiping its place before it is drawn (Yang 11-19: "sao lại có cái vân ngang này?"): straight
        // onto the tree every overlap of two slices took the ink twice, and a grey stroke came out ribbed across like a washboard, worst on
        // bends, where the slices are widened to close the fan. Wiped first, an overlap holds one slice's ink only.
        const cxs = dpr * (Q[j][0] + (Q[j + 1][0] - Q[j][0]) * f - X), cys = dpr * (Q[j][1] + (Q[j + 1][1] - Q[j][1]) * f - Y), rr = th_ * dpr + 6; bx0 = Math.min(bx0, cxs - rr); by0 = Math.min(by0, cys - rr); bx1 = Math.max(bx1, cxs + rr); by1 = Math.max(by1, cys + rr);
        sx.setTransform(dpr * tx, dpr * ty, -fl * dpr * ty, fl * dpr * tx, cxs, cys); sx.clearRect(-ex / 2, -q_.c * th_, ds + 0.3 + ex, th_);
        sx.globalCompositeOperation = 'lighter';   // added, not laid over: along the wiped edge a pixel keeps part of the old slice and gets the rest from the new one, and laid over, the two parts made less than one whole (a pale hair across the trunk at every slice)
        sx.drawImage(q_.im, clamp((u0 + (1 - u0) * a / Lq) * q_.w, 0, q_.w - 2), 0, Math.max(1, (ds + 0.3) / Lq * (1 - u0) * q_.w), q_.h, -ex / 2, -q_.c * th_, ds + 0.3 + ex, th_); sx.globalCompositeOperation = 'source-over'; }
      sx.setTransform(1, 0, 0, 1, 0, 0);
      if (bx1 > bx0) { bx0 = Math.max(0, Math.floor(bx0)); by0 = Math.max(0, Math.floor(by0)); const bw = Math.min(sc.width, Math.ceil(bx1)) - bx0, bh = Math.min(sc.height, Math.ceil(by1)) - by0;
        if (bw > 0 && bh > 0) { G.save(); G.setTransform(1, 0, 0, 1, 0, 0); G.drawImage(sc, bx0, by0, bw, bh, bx0, by0, bw, bh); G.restore(); sx.clearRect(bx0, by0, bw, bh); } }
      G.setTransform(dpr, 0, 0, dpr, -X * dpr, -Y * dpr); };
    const back = bare && !zhe && kitFull.length && L >= 0.3 * H ? kitFull[((Math.abs(d.seed) * 40503) >>> 0) % kitFull.length] : null,
      limb = (Q, u0, G = g, X = ox, Y = oy, q_ = qT, th_ = th0) => { if (back && q_ === qT) { const al = G.globalAlpha; G.globalAlpha = al * 0.5; limbRaw(Q, u0, G, X, Y, back, th_ * 0.62); G.globalAlpha = al; } limbRaw(Q, u0, G, X, Y, q_, th_); };
    limb(P, 0);
    // -- roots (Yang 11-19: "mấy cái cây này đâu có rễ?"; a sheet of whole tree feet came out as Western pen drawing, and he
    //    chose: grown by code from the brush strokes, as the branches are, no pasted foot). A root is a limb: the thin end
    //    of the trunk's own stroke laid along a path that leaves the trunk a little above its cut, to one side and the
    //    other by turns, runs down and out, lies over toward level along the ground and dips at its end like a claw.
    //    The thick starts overlap the trunk's blunt cut and hide it. Bamboo: a fan of short dry whiskers under the cane.
    //    Dice of its own, so the tree above it is the tree it was.
    if (!zhe) { const Rr = dice(d.seed ^ 0x3c19), bam = kind === 'bamboo', kD = kitDry.length ? kitDry : kitAll, qR = bam ? kD[Math.floor(Rr() * kD.length) % kD.length] : qT, thR = bam ? Math.max(0.6 * th0, 0.004 * H) : th0,
        ux = tan[0][0], uy = tan[0][1], nr = bam ? 4 + Math.floor(Rr() * 3) : 3 + Math.floor(Rr() * 2) + (th0 > 0.02 * H ? 1 : 0) + (th0 > 0.045 * H ? 1 : 0); let sd = Rr() < 0.5 ? -1 : 1;
      // (First: two or three, straight, one each side: a chicken's foot, Yang 11-19 "chỉnh tiếp".) More of them, unequal; each winds
      // as it goes, lies over to level, and plunges at its end; one in two forks a rootlet off its lower side; now and then a
      // short one comes straight toward the viewer
      const root = (x, y, a, len, u0, s, depth) => { const m = Math.max(6, Math.round(len / 3)), Q = [[x, y]], aT = (s > 0 ? 0 : Math.PI) + s * (0.02 + 0.25 * Rr()), wA = 0.18 + 0.24 * Rr(), wf = 0.8 + 0.9 * Rr(), wp = 6.283 * Rr(), ek = Math.round(m * (0.25 + 0.45 * Rr())), et = (Rr() - 0.5) * 0.9, dip = 0.45 + 0.6 * Rr();
        for (let i = 1; i <= m; i++) { const f = i / m;
          a += (f < 0.65 ? 3.2 * wrapR(aT - a) / m : s * dip / (0.35 * m)) + wA * 6.283 * wf / m * Math.cos(6.283 * wf * f + wp) + (Rr() - 0.5) * 0.14 + (i === ek ? et : 0);
          x += Math.cos(a) * len / m; y += Math.sin(a) * len / m; Q.push([x, y]); }
        limb(Q, u0, g, ox, oy, qR, thR);
        if (depth < 1 && len > 0.02 * H && Rr() < 0.55) { const k = Math.round(m * (0.3 + 0.3 * Rr())); root(Q[k][0], Q[k][1], Math.atan2(Q[k + 1][1] - Q[k][1], Q[k + 1][0] - Q[k][0]) + s * (0.45 + 0.5 * Rr()), len * (0.35 + 0.25 * Rr()), Math.min(0.9, u0 + 0.18 + 0.1 * Rr()), s, depth + 1); } };
      for (let k = 0; k < nr; k++) { sd = Rr() < 0.8 ? -sd : sd; const up = bam ? 0.05 : 0.08 + 0.4 * Rr(), x0 = P[0][0] + ux * up * th0 + (bam ? (k / (nr - 1) - 0.5) * 0.5 * th0 : sd * 0.14 * th0), y0 = P[0][1] + uy * up * th0;
        if (bam) { const len = (0.012 + 0.016 * Rr()) * H, m = 6, Q = [[x0, y0]]; let a = 1.5708 + (k / (nr - 1) - 0.5) * 1.7 + (Rr() - 0.5) * 0.3, x = x0, y = y0;
          for (let i = 1; i <= m; i++) { a += (Rr() - 0.5) * 0.2 + (a < 1.5708 ? -0.25 : 0.25) / m; x += Math.cos(a) * len / m; y += Math.sin(a) * len / m; Q.push([x, y]); }
          g.globalAlpha = 0.75; limb(Q, 0.72 + 0.15 * Rr(), g, ox, oy, qR, thR); g.globalAlpha = 1; continue; }
        const front = k >= 2 && Rr() < 0.3, len = Math.max(0.02 * H, th0 * (front ? 0.7 + 0.5 * Rr() : 1.1 + 1.7 * Rr()) * (k < 2 ? 1 : 0.75));
        root(x0, y0, 1.5708 - sd * (front ? 0.1 + 0.25 * Rr() : 0.3 + 0.75 * Rr()), len, 0.38 + 0.3 * Rr() + (k < 2 ? 0 : 0.1), sd, front ? 1 : 0); } }
    // The branch is alive (Yang 11-19: swaying in the wind, a petal or a blossom letting go now and then). The old wood
    // is painted once and stays; every twig is a small painting of its own (its wood, its blossoms), turned a little
    // about the point it grows from, each frame, on a layer of its own (as a river's current): a shoot on an old side
    // branch turns with that branch and then by itself. Gusts come and go; the swing runs along the branch as a wave.
    if (zhe) { const kitF = kitOf('_fl'), kitB = kitOf('_bd'), kitL = kitOf('_pt'), nodes = [], blooms = [], Ra = dice(d.seed ^ 0x2f6b), wdir = Ra() < 0.5 ? -1 : 1; let sg = g;
      const stamp = (q, x, y, w, rot, al, ax, ay, fy) => { const h = w * q.h / q.w; sg.save(); sg.translate(x, y); sg.rotate(rot); sg.scale(1, fy || 1); sg.globalAlpha = al; sg.drawImage(q.im, -ax * w, -ay * h, w, h); sg.restore(); sg.globalAlpha = 1; };
      const grainOn = (x, w, h) => { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 0.11; x.globalCompositeOperation = 'destination-out'; x.fillStyle = x.createPattern(grain, 'repeat'); x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; };
      const pt = (t) => { const i = clamp(Math.round(t * (n - 1)), 0, n - 1); return [P[i][0], P[i][1], Math.atan2(tan[i][1], tan[i][0])]; };
      // blossoms and buds, sparse and uneven: buds toward the ends of the twigs (the youngest wood), open flowers
      // further in; a bud stands on its calyx, away from the twig; a flower faces any way. Two or three bunch together now and then
      const bloom = (spots) => { for (const [x, y, a, f] of spots) { if (R() < 0.18) continue; const bud = kitB.length && R() < 0.25 + 0.5 * f, jn = R() < 0.25 ? 2 : 1;
        for (let j = 0; j < jn; j++) { const ox2 = j ? (R() - 0.5) * 0.035 * H : 0, oy2 = j ? (R() - 0.5) * 0.035 * H : 0, sd = R() < 0.5 ? 1 : -1;
          if (bud) { const w = (0.017 + 0.012 * R()) * H; stamp(pick(kitB), x + ox2 - Math.sin(a) * sd * w * 0.3, y + oy2 + Math.cos(a) * sd * w * 0.3 * -1, w, a + (sd > 0 ? 0 : Math.PI) + (R() - 0.5) * 0.7, 0.95, 0.5, 0.85); }
          else if (kitF.length) { const w = (0.026 + 0.02 * R()) * H; stamp(pick(kitF), x + ox2, y + oy2, w, R() * 6.283, 0.92, 0.5, 0.5); blooms.push([x + ox2, y + oy2]); } } } };
      // twigs: young shoots, most of them rising off the upper side, a few hanging; longer near the base of the branch
      const nT = clamp(Math.round(L / (0.085 * H)), 3, 10), up = Math.cos(pt(0.5)[2]) > 0 ? -1 : 1;   // which turn of the tangent points up the paper
      // (First: each twig one stroke of the sheet stamped on, straight and thick at its base: "mấy cái gai to đùng", Yang.)
      // A twig is grown: thin from its start (the thin end of the branch's own stroke), long, and each its own way,
      // straight, or in one slow curve (mostly turning up toward the light), or with an elbow; it forks now and then
      const wr = (v) => Math.atan2(Math.sin(v), Math.cos(v)), twig = (x, y, ang, len, u0, depth, into) => { const x0 = x, y0 = y, m = Math.max(7, Math.round(len / 5)), Q = [[x, y]], way = R(), toUp = Math.sign(wr(-1.5708 - ang)) || 1, dir = R() < 0.72 ? toUp : -toUp;
        const bend = way < 0.25 ? 0 : way < 0.8 ? dir * (0.35 + 0.8 * R()) : 0, ek = way >= 0.8 ? Math.round(m * (0.3 + 0.35 * R())) : -1, et = dir * (0.4 + 0.5 * R()); let a = ang;
        for (let i = 1; i <= m; i++) { a += bend / m * (0.5 + i / m) + (R() - 0.5) * 0.05 + (i === ek ? et : 0); x += Math.cos(a) * len / m; y += Math.sin(a) * len / m; Q.push([x, y]); }
        let qa = 1e9, qb = -1e9, qc = 1e9, qd = -1e9; for (const q of Q) { qa = Math.min(qa, q[0]); qb = Math.max(qb, q[0]); qc = Math.min(qc, q[1]); qd = Math.max(qd, q[1]); }
        const pd = 0.055 * H + th0, tx = Math.floor(qa - pd), ty = Math.floor(qc - pd), tc = document.createElement('canvas'); tc.width = Math.ceil((qb - qa + 2 * pd) * dpr); tc.height = Math.ceil((qd - qc + 2 * pd) * dpr); const tg = tc.getContext('2d');
        limb(Q, u0, tg, tx, ty);
        const spots = []; for (let j = 0, jn = 1 + Math.floor(R() * (len > 0.1 * H ? 4 : 2)); j < jn; j++) { const f = 0.3 + 0.7 * (j + R()) / jn, q = Q[Math.round(f * m)]; spots.push([q[0], q[1], a, f]); }
        sg = tg; bloom(spots); sg = g; grainOn(tg, tc.width, tc.height);
        // old wood is stiff, a young shoot gives; the phase follows the place along the branch, so a gust runs along it
        const nd = { cv: tc, x: tx, y: ty, w: tc.width / dpr, h: tc.height / dpr, ax: x0, ay: y0, amp: depth === 0 ? 0.01 + 0.006 * Ra() : 0.026 + 0.03 * Ra(), fq: depth === 0 ? 0.7 : 0.9 + 0.5 * Ra(), ph: x0 / (0.3 * H) + 1.5 * Ra(), kids: [] }; into.push(nd);
        // an old side branch (depth 0) always carries young shoots, two to four, to either side; a shoot forks now and then
        for (let j = 0, nf = depth === 0 ? 2 + Math.floor(R() * 3) : depth < 2 && len > 0.07 * H && R() < 0.6 ? 1 : 0; j < nf; j++) { const k = clamp(Math.round(m * (depth === 0 ? 0.2 + 0.7 * (j + R()) / nf : 0.25 + 0.4 * R())), 1, m - 1);
          twig(Q[k][0], Q[k][1], Math.atan2(Q[k + 1][1] - Q[k][1], Q[k + 1][0] - Q[k][0]) + (R() < 0.5 ? -1 : 1) * (0.35 + 0.6 * R()), len * (depth === 0 ? 0.3 + 0.35 * R() : 0.4 + 0.3 * R()), depth === 0 ? clamp(u0 + (1 - u0) * (0.45 + 0.3 * k / m) + 0.05 * R(), 0, 0.94) : Math.min(0.95, u0 + 0.07), depth + 1, nd.kids); } };
      // Not every one a thin young shoot (Yang 11-19): one in three is an old side branch, thick where it leaves the
      // main one (nearly as thick as the main branch is there) and tapering, longer, bearing shoots of its own.
      // At least one such on every branch, in its inner half
      const oldK = Math.floor(R() * Math.max(1, nT / 2));
      for (let k = 0; k < nT; k++) { const t = 0.1 + 0.85 * (k + 0.15 + 0.7 * R()) / nT, [x, y, a] = pt(t), sd = R() < 0.75 ? up : -up, old = k === oldK || (t < 0.8 && R() < 0.28);
        if (old) twig(x, y, a + sd * (0.35 + 0.55 * R()), clamp(L * (0.22 + 0.2 * R()) * (1 - 0.35 * t), 0.1 * H, 0.42 * H), clamp(t + 0.12 + 0.2 * R(), 0.2, 0.75), 0, nodes);
        else twig(x, y, a + sd * (0.35 + 0.75 * R()), clamp(L * (0.1 + 0.2 * R()) * (1 - 0.4 * t), 0.05 * H, 0.3 * H), clamp(0.72 + 0.16 * t + 0.06 * R(), 0, 0.93), 1, nodes); }
      { const sp = []; for (let k = 0, kn2 = Math.round(L / (0.16 * H)); k < kn2; k++) { const [x, y, a] = pt(0.2 + 0.75 * R()); sp.push([x, y, a, 0.4]); } home(); bloom(sp); }   // and a few on the old wood itself: these stay still
      grainOn(g, cw, chh);
      // -- each frame: the twigs, turned; and what falls. A petal lets go of a blossom now and then (three places in
      //    the air at most, each with its own period, one period in four empty), sinks slowly, drifting with the wind,
      //    swinging and turning over as it goes, and fades before it lands; one in seven is a whole blossom, falling
      //    faster and straighter. All from T and the seed, nothing kept between frames. (?leap=1: many, to look at them.)
      const live = document.createElement('canvas'); live.width = cw; live.height = chh; const gl = live.getContext('2d'), hs = (k, j) => { const v = Math.sin(k * 127.1 + j * 311.7 + (d.seed % 9973)) * 43758.5453; return v - Math.floor(v); };
      const put = (nd, T, gust) => { gl.translate(nd.ax, nd.ay); gl.rotate(nd.amp * gust * (0.5 * wdir + Math.sin(T * 1.7 * nd.fq - nd.ph) + 0.35 * Math.sin(T * 2.9 * nd.fq - 2.3 * nd.ph))); gl.translate(-nd.ax, -nd.ay); gl.drawImage(nd.cv, nd.x, nd.y, nd.w, nd.h); for (const k of nd.kids) { gl.save(); put(k, T, gust); gl.restore(); } };
      const flow = (T) => { gl.setTransform(1, 0, 0, 1, 0, 0); gl.clearRect(0, 0, cw, chh); const gust = 0.6 + 0.4 * Math.sin(T * 0.43 + 1.1 * Math.sin(T * 0.17));
        for (const nd of nodes) { gl.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr); put(nd, T, gust); }
        gl.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr); if (!blooms.length || !kitL.length) return;
        for (let s = 0, sn = LEAPS ? 8 : 3; s < sn; s++) { const per = LEAPS ? 4 + 2 * hs(s, 900) : 5 + 6 * hs(s, 900), tt = T + per * hs(s, 901), k = Math.floor(tt / per), t = tt - k * per, e = k * 13 + s * 7, du = 3.4 + 1.4 * hs(e, 1);
          if (t > du || (!LEAPS && hs(e, 2) > 0.75)) continue;
          const b = blooms[Math.floor(hs(e, 3) * blooms.length) % blooms.length], whole = kitF.length > 0 && hs(e, 4) < 0.14, kit = whole ? kitF : kitL, q = kit[Math.floor(hs(e, 5) * kit.length) % kit.length], w = whole ? 0.03 * H : (0.011 + 0.009 * hs(e, 6)) * H, hh = w * q.h / q.w, ph = 6.283 * hs(e, 7), sp = hs(e, 8) < 0.5 ? -1 : 1;
          const fall = H * (whole ? 0.13 : 0.07 + 0.03 * hs(e, 9)) * t * t / (t + 0.6), x = b[0] + H * (wdir * (whole ? 0.008 : 0.022) * t + (whole ? 0.004 : 0.013) * Math.sin(t * 2.3 + ph)), y = b[1] + fall;
          gl.save(); gl.translate(x, y); gl.rotate(ph + sp * t * (whole ? 0.5 : 1.3)); gl.scale(1, whole ? 1 : 0.3 + 0.7 * Math.abs(Math.cos(t * 2.1 + ph))); gl.globalAlpha = 0.85 * sm(t / 0.3) * sm((1 - t / du) / 0.25); gl.drawImage(q.im, -w / 2, -hh / 2, w, hh); gl.restore(); }
        gl.globalAlpha = 1; };
      // nearest thing on the paper: laid over everything else (yBase past any other), at full strength
      return { river: true, live, flow, cv, body: NOBODY, mist: null, mxy: [0, 0, 1], ox, oy, yBase: 1e9 + yb, yTop: ya, tone: 1, peaks: 0, ms: Math.round(performance.now() - tB), mistMs: 0 }; }
    // -- branches, as Yang drew one (11-19, in Paint: "it has to be random"): a branch FORKS off its limb at a shallow
    //    angle and runs on beside it toward the tip, bending as it goes; to either side, below the limb as well as
    //    above; long (up to half the limb); now and then it forks again. Each ends in foliage. Nothing even: place,
    //    side, angle, length and bend are all thrown.
    //    (Before: short straight pieces stuck on the trunk left and right by turns at one fixed rise. On a trunk flown
    //    level that was a row of crossed pairs, XXXX, then a row of stakes: "mọc có pattern quá")
    //    How a tree grows (Yang 11-19: the sketch was only a token, "em thừa biết cái cây nó mọc như nào"):
    //      light    a shoot turns up toward the light as it grows: every branch bends upward along its length, most at
    //               its tip (trop). Which way is up is the paper's, not the trunk's: a leaning tree rights its branches
    //      age      low branches are the oldest: longest, and borne down by their weight, they stand wide off the
    //               trunk. Toward the top they are young: short and steep. That is what rounds a crown
    //      broadleaf  the trunk gives itself up into a few great limbs that fork again (no single leader)
    //      pine     one leader to the top; branches in whorls, tier over tier, a pair at about one height, standing
    //               level and lifting only at the tip; the tiers shorten upward
    //      bare     nothing on the lowest part of the trunk (shed in the shade of the crown)
    // -- wind (Yang 11-19: "có mỗi cây liễu là có chuyển động hả?"). The wood is painted once; every piece of foliage (a pine bough, a
    //    cluster of leaves, a bamboo's leaf group) is kept as a place and a turn, and laid each frame on a layer of its own, turned
    //    and shifted a little about where it sits: stiff needles hardly, hanging leaves more; a gust runs through the tree as a wave
    const sway = [], curt = [], Rs = dice(d.seed ^ 0x77aa), wd = Rs() < 0.5 ? -1 : 1,
      spr = (q, x, y, w, ax, ay, rot, fx, al, amp) => sway.push({ im: q.im, x, y, w, h: w * q.h / q.w, ax, ay, rot, fx, al, amp: amp * (0.7 + 0.6 * Rs()), ph: x / (0.2 * H) + 2 * Rs() }),
      mkLive = (tone) => { if (!sway.length && !curt.length) return [null, null]; const live = document.createElement('canvas'); live.width = cw; live.height = chh; const gl = live.getContext('2d');
        return [live, (T) => { gl.setTransform(1, 0, 0, 1, 0, 0); gl.clearRect(0, 0, cw, chh); const gust = 0.6 + 0.4 * Math.sin(T * 0.43 + 1.1 * Math.sin(T * 0.17));
          for (const c of sway) { const sw = c.amp * gust * (0.6 * wd + Math.sin(T * 1.5 - c.ph) + 0.3 * Math.sin(T * 2.7 - 1.9 * c.ph)); gl.setTransform(dpr, 0, 0, dpr, (sw * c.w * 0.5 - ox) * dpr, -oy * dpr); gl.translate(c.x, c.y); gl.rotate(c.rot + sw); gl.scale(c.fx, 1); gl.globalAlpha = c.al * tone; gl.drawImage(c.im, -c.ax * c.w, -c.ay * c.h, c.w, c.h); }
          gl.globalAlpha = tone;
          for (const c of curt) { gl.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr); gl.translate(c.x0, c.y0); gl.transform(1, 0, c.amp * gust * (0.6 * wd + Math.sin(T * 1.3 - c.ph) + 0.3 * Math.sin(T * 2.3 - 1.9 * c.ph)), 1, 0, 0); gl.translate(-c.x0, -c.y0); gl.drawImage(c.cv, c.x, c.y, c.w, c.h); }
          gl.globalAlpha = 1; }]; };
    // -- bamboo: the stroke is a stalk, jointed (the sheet's own nodes); a clump: one to three more beside it, shorter,
    //    paler, leaning their own way. Leaves in groups on short twigs off the upper nodes, hanging, more toward the top
    if (kind === 'bamboo') { const leafAt = [], hang = (Q, Lq, al) => { const m = Q.length - 1; for (let j = 0, jn = clamp(Math.round(Lq / (0.055 * H)), 2, 9); j < jn; j++) { const q = Q[Math.round((0.3 + 0.7 * Math.pow((j + R()) / jn, 0.7)) * m)]; leafAt.push([q[0], q[1], al, R() < 0.5 ? -1 : 1]); } };
      for (let k = 0, kn = Math.floor(R() * 3) + (L > 0.25 * H ? 1 : 0); k < kn; k++) { const dx = (R() < 0.5 ? -1 : 1) * (0.012 + 0.022 * R()) * H * (1 + 0.6 * k), lean = (R() - 0.5) * 0.24, cut = 0.5 + 0.45 * R(), m = Math.max(5, Math.round((n - 1) * cut)), Q = [], al = 0.4 + 0.3 * R();
        for (let i = 0; i <= m; i++) Q.push([P[i][0] + dx + lean * (P[0][1] - P[i][1]), P[i][1]]);
        g.globalAlpha = al; limb(Q, 0); g.globalAlpha = 1; hang(Q, L * cut, al); }
      hang(P, L, 1); leafAt.push([P[n - 1][0], P[n - 1][1], 1, 0]);
      for (const [x, y, al, sd] of leafAt) { if (!kitBL.length) break; const q = pick(kitBL), w = clamp(L * (0.12 + 0.1 * R()), 0.035 * H, 0.1 * H), h = w * q.h / q.w, tl = sd ? (0.008 + 0.02 * R()) * H : 0, ax = x + sd * tl, ay = y - tl * (0.2 + 0.5 * R());
        if (sd) { g.strokeStyle = `rgba(${INK},${(0.8 * al).toFixed(2)})`; g.lineWidth = Math.max(0.7, 0.0013 * H); g.beginPath(); g.moveTo(x, y); g.lineTo(ax, ay); g.stroke(); }
        { const rt = sd * (0.1 + 0.5 * R()), fx = R() < 0.5 ? -1 : 1; spr(q, ax, ay, w, 0.5, 0.06, rt, fx, al * (0.75 + 0.25 * R()), 0.09); } }
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.11; g.globalCompositeOperation = 'destination-out'; g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, cw, chh); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      const tone = 0.45 + 0.55 * clamp((yb / H - 0.2) / 0.7, 0, 1), [live, flow] = mkLive(tone); return { river: true, live, flow, cv, body: NOBODY, mist: null, mxy: [0, 0, 1], ox, oy, yBase: yb, yTop: ya, tone, peaks: 0, ms: Math.round(performance.now() - tB), mistMs: 0 }; }
    const tips = [], wrapA = (v) => Math.atan2(Math.sin(v), Math.cos(v));
    const grow = (x, y, ang, len, u0, depth) => { const m = Math.max(6, Math.round(len / 4)), Q = [[x, y]], sway = (R() - 0.5) * 0.7 / m, lvl = Math.cos(ang) < 0 ? Math.PI : 0, dsg = lvl ? -1 : 1, trop = pine ? 0 : (0.35 + 0.5 * R()) * (wil ? 0 : 1); let a = ang;
      // a pine branch is crooked by elbows: one to three sharp turns, down then up by turns, straight between them.
      // (Small random turns all along were smoothed away by the pull to level and did not read at a small size)
      const ne = 1 + (R() < 0.6) + (len > 0.1 * H && R() < 0.5), el = pine || bare ? Array.from({ length: ne }, (_, j) => Math.max(1, Math.round(m * (0.12 + 0.6 * (j + 0.3 + 0.4 * R()) / ne)))) : []; let es = R() < 0.7 ? 1 : -1; const wph = 6.283 * R();
      for (let i = 1; i <= m; i++) { const f = i / m;
        a += sway + (R() - 0.5) * 0.09 + (pine ? 1.6 * wrapA(lvl + dsg * (0.3 * Math.sin(3.1416 * Math.min(1, f / 0.75)) - 0.65 * sm((f - 0.7) / 0.3)) - a) / m + (el.includes(i) ? dsg * (es = -es) * -(0.5 + 0.4 * R()) : 0) :trop * 2 * f * wrapA(-1.5708 - a) / m);   // a pine's: level, sagging in its middle under its own weight, lifting at the tip, and crooked (a sudden turn here and there)
        if (pine) a += 0.5 * 8 / m * Math.cos(8 * f + wph);   // an old pine's limb winds to and fro all along (Yang's paintings, 11-19), on top of its elbows
        if (bare) a += (R() - 0.5) * 0.14 + (el.includes(i) ? (es = -es) * (0.35 + 0.5 * R()) : 0);   // bare wood shows how it grew: by fits and turns, an elbow where a shoot died and a side bud took over. (In one smooth bow each, on a smooth pole: antlers, "mất tự nhiên", Yang 11-19)
        if (wil) a += 2.4 * f * wrapA(lvl + dsg * 0.75 - a) / m;   // a willow's limb: up and out of the trunk, then over and down under its own weight, more and more toward its end
        if (!wil && Math.sin(a) > 0.3) a += (Math.cos(a) > 0 ? -1 : 1) * 0.07;   // a branch does not droop far: turned back toward level
        x += Math.cos(a) * len / m; y += Math.sin(a) * len / m; Q.push([x, y]); }
      limb(Q, u0); tips.push({ x, y, len, a, Q });
      for (let fk = 0, fkn = bare ? 2 : 1; fk < fkn; fk++) if (depth < (bare ? 3 : 2) && len > (bare ? 0.03 : 0.06) * H && R() < (pine ? 0.3 : bare ? 0.85 : 0.65)) { const k = Math.round(m * (0.3 + 0.35 * R())); grow(Q[k][0], Q[k][1], Math.atan2(Q[k + 1][1] - Q[k][1], Q[k + 1][0] - Q[k][0]) + (R() < 0.5 ? -1 : 1) * (0.35 + 0.5 * R()), len * (bare ? 0.55 + 0.4 * R() : 0.4 + 0.35 * R()), bare ? Math.min(0.97, u0 + 0.5 * (1 - u0)) : Math.min(0.93, u0 + 0.12), depth + 1); } };   // a bare tree's forks: long and thinning fast, down to hairs
    const at = (t) => { const i = clamp(Math.round(t * (n - 1)), 0, n - 1); return [P[i], Math.atan2(tan[i][1], tan[i][0]), tan[i]]; };
    if (pine) { const nt = clamp(Math.round(L / (0.11 * H)), 1, 4); let sg = R() < 0.5 ? -1 : 1;
      for (let k = 0; k < nt; k++) { const t0 = nt === 1 ? 0.6 : 0.34 + 0.56 * (k + 0.2 + 0.6 * R()) / nt, len0 = L * (0.44 - 0.26 * t0);
        // a whorl stands all round the trunk, three to five branches. Seen from the side: one or two at full length to
        // left and right, the others (coming toward the eye or going away) short, and tilted a little up or down
        for (let j = 0, jn = 2 + Math.floor(R() * 3); j < jn; j++, sg = -sg) { const t = clamp(t0 + (R() - 0.5) * 0.09, 0.25, 0.95), [p, base, tn] = at(t), lean = Math.abs(tn[0]) > 0.75, full = j < 2 ? 0.7 + 0.5 * R() : 0.25 + 0.35 * R();   // lean: a trunk flown nearly level, its branches stand up off it
          if (j === 1 && R() < 0.25) continue;   // a tier with one side bare
          grow(p[0], p[1], lean ? base - Math.sign(tn[0]) * (0.7 + 0.5 * R()) * (j ? 0.6 : 1) : (sg > 0 ? 0 : Math.PI) + sg * (j < 2 ? -0.3 + 0.45 * R() : -0.6 + 1.0 * R()), clamp(len0 * full, 0.025 * H, 0.26 * H), clamp(0.4 + 0.45 * t, 0, 0.88), 1); } }
    } else { const nb = clamp(Math.round(L / (0.07 * H)), 1, 6), ts = Array.from({ length: nb }, () => R()).sort((p, q) => p - q); let sg = R() < 0.5 ? -1 : 1;
      for (let k = 0; k < nb; k++) { const t = nb === 1 ? 0.6 : 0.24 + 0.7 * (0.6 * ts[k] + 0.4 * (k + 0.5) / nb), [p, base] = at(t), phi = clamp(0.95 - 0.6 * t + (R() - 0.5) * 0.35, 0.25, 1.1);   // wide below, steep above
        if (R() < 0.7) sg = -sg; let ang = base + sg * phi; if (Math.sin(ang) > 0.35) ang = base - sg * phi;   // out of the upper side of a leaning trunk
        grow(p[0], p[1], ang, clamp(L * (0.52 - 0.32 * t) * (0.55 + 0.7 * R()) * (bare ? 1.35 : 1), 0.03 * H, (bare ? 0.38 : 0.3) * H), bare ? clamp(0.62 + 0.3 * t, 0, 0.93) : clamp(0.35 + 0.5 * t, 0, 0.88), 1); } }   // bare: nothing hides a limb, so it must be right: clearly thinner than the trunk where it leaves it (on a stout trunk they were fingers on a fist), and long
    if (pine) for (const sg2 of [-1, 1]) { const [p] = at(0.9 + 0.06 * R()); grow(p[0], p[1], -1.5708 + sg2 * (0.7 + 0.5 * R()), clamp(L * (0.13 + 0.08 * R()), 0.03 * H, 0.14 * H), 0.8, 1); }   // a head to the crown: two short limbs splayed up and out under the top
    tips.push({ x: P[n - 1][0], y: P[n - 1][1], len: clamp(0.35 * L, 0.04 * H, 0.2 * H), a: -1.57 });
    const leafKit = kind === 'jiezi' ? kitLJ : kind === 'mi' ? kitLM : kitQ, rotK = kind === 'jiezi' ? 0.25 : kind === 'mi' ? 0.1 : 0.5;   // drooping leaves hang, Mi dots lie level: hardly turned
    // -- foliage: at the end of every limb, each of its own size; here and there a second one beside it
    if (pine) { const turn = (q, x, y, w, ang, flip, al) => { spr(q, x, y, w, 0.5, 0.8, ang, flip ? -1 : 1, al, 0.022); };   // a bough lies on the end of its branch, its flat dark underside a little below it
      for (const t of tips) { if (kitN.length && R() < 0.4) turn(pick(kitN), t.x + Math.cos(t.a) * 0.02 * H, t.y + Math.sin(t.a) * 0.02 * H, clamp(t.len * (0.3 + 0.3 * R()), 0.02 * H, 0.07 * H), (R() - 0.5) * 1.2, R() < 0.5, 0.85);
        // needles grow along the outer half of a branch, on its side shoots: a band of boughs lying on it from the
        // middle to the end, the largest at the end. (One bough at the very tip: a lollipop on a bare pole)
        if (kitP.length) { const w0 = clamp(t.len * (0.42 + 0.25 * R()), 0.035 * H, 0.1 * H), cnt = t.Q ? clamp(Math.round(t.len / (0.085 * H)), 1, 3) : 1;   /* Yang 11-19: "thân cây tùng quá mập, lá tùng quá dày": trunk 2.7 -> 1.9, pads fewer and smaller so sky shows between the tiers */   // pads all along the limb, in to near the trunk, overlapping into a tier; the gaps are between the tiers
          for (let k = cnt - 1; k >= 0; k--) { const f = cnt === 1 ? 1 : 1 - 0.62 * k / (cnt - 0.5) + (k ? (R() - 0.5) * 0.08 : 0), q = t.Q ? t.Q[clamp(Math.round(f * (t.Q.length - 1)), 0, t.Q.length - 1)] : [t.x, t.y];
            wp = w0 * (k ? 0.65 + 0.35 * R() : 1);
            // In the paintings the needles are broad domed masses lying ON the limbs, wide enough to run into one another, the limb seen
            // under them; a fringe of needle fans stands out round the top of each mass (behind it: laid first)
            if (kitN.length) for (let z = 0, zn = Math.floor(R() * 1.5); z < zn; z++) turn(pick(kitN), q[0] + (R() - 0.5) * wp * 0.85, q[1] - wp * (0.08 + 0.2 * R()), wp * (0.35 + 0.25 * R()), (R() - 0.5) * 1.0, R() < 0.5, 0.8);
            turn(pick(kitP), q[0], q[1] - 0.006 * H, wp, (R() - 0.5) * 0.3, R() < 0.5, 0.62 + 0.38 * R()); } } }   // not all at full strength: where masses overlap they still read as layers (all black they ran into one blot)
    } else if (wil) { // A willow (Yang 11-19, with paintings: "cành liễu đâu có mọc như thế"). Its limbs arch over (grow); from them hang the
      // withes, one by one: each leaves its limb the way the limb runs, turns over within a few steps and falls straight,
      // long (down toward the ground, none the same length), leaning a little with the wind, narrow leaves to either
      // side along its lower part; some dark, some pale (those behind). Each a strip of its own, swung each frame.
      // (First: the sheet's ready-made curtains hung on limbs that stood up like a bare tree's: flat-topped combs.)
      const wd0 = R() < 0.5 ? -1 : 1, rootY = P[0][1];
      for (const t of tips) { const Q = t.Q || [[t.x, t.y + 1], [t.x, t.y]], cnt = t.Q ? clamp(Math.round(t.len / (0.013 * H)), 3, 18) : 3;
        for (let k = 0; k < cnt; k++) { const i = clamp(Math.round((t.Q ? 0.2 + 0.8 * (k + R()) / cnt : 1) * (Q.length - 1)), 1, Q.length - 1), p = Q[i], b0 = Q[i - 1];
          let a = Math.atan2(p[1] - b0[1], p[0] - b0[0]) + (R() - 0.5) * 0.8; if (Math.sin(a) < -0.25) a = Math.cos(a) < 0 ? Math.PI + 0.25 : -0.25;
          const len = clamp(Math.min(L * (0.3 + 0.5 * R()), (rootY - p[1]) * (0.65 + 0.4 * R())), 0.04 * H, 0.6 * H), m = Math.max(8, Math.round(len / (0.012 * H))), tgt = 1.5708 - wd0 * (0.05 + 0.1 * R()), crv = (R() - 0.5) * 0.2 / m, W = [[p[0], p[1]]], al = 0.35 + 0.65 * R(); let x = p[0], y = p[1], xa2 = x, xb2 = x;
          for (let j = 1; j <= m; j++) { a += 0.3 * wrapA(tgt - a) + crv + (R() - 0.5) * 0.09; x += Math.cos(a) * len / m; y += Math.sin(a) * len / m; W.push([x, y]); xa2 = Math.min(xa2, x); xb2 = Math.max(xb2, x); }
          const pd = 0.022 * H, tx = Math.floor(xa2 - pd), ty = Math.floor(p[1] - pd), wc = document.createElement('canvas'); wc.width = Math.ceil((xb2 - xa2 + 2 * pd) * dpr); wc.height = Math.ceil((y - p[1] + 2 * pd) * dpr); const wg = wc.getContext('2d'); wg.setTransform(dpr, 0, 0, dpr, -tx * dpr, -ty * dpr);
          // (Drawn evenly it was "quá sạch và sleek", Yang 11-19.) A brush line: its weight comes and goes with the hand's
          // pressure, the ink thins as the brush empties and breaks off here and there (dry), heavier where it was set down
          wg.strokeStyle = wg.fillStyle = `rgb(${INK})`; wg.lineCap = 'butt'; let pr = 0.5 + 0.5 * R(), dry = R() < 0.5 ? 0.5 + 0.5 * R() : 2;
          for (let j = 1; j <= m; j++) { pr = clamp(pr + (R() - 0.5) * 0.3, 0.2, 1.2); const f = j / m, sub = 3; if (f > dry && R() < 0.35) continue;
            for (let q = 0; q < sub; q++) { const f0 = q / sub, f1 = (q + 1.25) / sub, lx = (t2) => W[j - 1][0] + (W[j][0] - W[j - 1][0]) * t2, ly = (t2) => W[j - 1][1] + (W[j][1] - W[j - 1][1]) * t2;
              wg.globalAlpha = al * (0.6 + 0.33 * pr) * (f > dry ? 0.55 : 1); wg.lineWidth = Math.max(0.5, H * (0.0026 - 0.0016 * f) * (0.45 + 0.75 * pr) * (j === 1 && q === 0 ? 1.8 : 1)); wg.beginPath(); wg.moveTo(lx(f0), ly(f0)); wg.lineTo(lx(f1) + (R() - 0.5) * 0.0008 * H, ly(f1)); wg.stroke(); } }
          const dens = R() < 0.2 ? 0.3 : 0.6 + 0.4 * R(); let sd = R() < 0.5 ? -1 : 1;
          for (let u = 0.15 + 0.15 * R(); u < 1; u += (0.006 + 0.009 * R()) * H / dens / len) { const fj = u * m, j = Math.min(m - 1, Math.floor(fj)), fr = fj - j, px = W[j][0] + (W[j + 1][0] - W[j][0]) * fr, py = W[j][1] + (W[j + 1][1] - W[j][1]) * fr, ll = (0.007 + 0.008 * R()) * H * (0.7 + 0.5 * u);
            if (R() < 0.8) sd = -sd; wg.save(); wg.translate(px, py); wg.rotate(Math.atan2(W[j + 1][1] - W[j][1], W[j + 1][0] - W[j][0]) + sd * (0.3 + 0.5 * R())); wg.globalAlpha = al * (0.65 + 0.35 * R());
            // a leaf = the brush tip pressed and drawn off: fat near where it was set down, uneven, bent, no two alike; now and then pressed twice
            const fat = 0.12 + 0.2 * R(), bel = 0.25 + 0.3 * R(), bow = (R() - 0.5) * 0.35 * ll, lop = 0.6 + 0.8 * R();
            for (let z = 0, zn = R() < 0.25 ? 2 : 1; z < zn; z++) { wg.beginPath(); wg.moveTo(0, 0); wg.quadraticCurveTo(ll * bel, -ll * fat + bow, ll * (1 - 0.15 * z), bow * 0.6); wg.quadraticCurveTo(ll * bel, ll * fat * lop + bow, 0, 0); wg.fill(); wg.rotate((R() - 0.5) * 0.3); } wg.restore(); }
          wg.setTransform(1, 0, 0, 1, 0, 0); wg.globalAlpha = 0.3; wg.globalCompositeOperation = 'destination-out'; wg.fillStyle = wg.createPattern(grain, 'repeat'); wg.fillRect(0, 0, wc.width, wc.height); wg.globalCompositeOperation = 'source-over';   // the paper's tooth shows through thin ink
          curt.push({ cv: wc, x: tx, y: ty, w: wc.width / dpr, h: wc.height / dpr, x0: p[0], y0: p[1], ph: p[0] / (0.2 * H) + 2 * R(), amp: 0.03 + 0.04 * R() }); } }
    } else if (!bare && leafKit.length) { // one kind of leaf to a tree (the sheet's clusters differ: round dabs, level dashes, slanting ones), and a dab keeps
      // its size: a small cluster is not blown up to fill a large crown, several of it are laid there instead
      const qT = pick(leafKit), cap = qT.w * H / 1300, puff = (x, y, w0) => { const w = Math.min(w0, cap), h = w * qT.h / qT.w, nr = clamp(Math.round((w0 / w) ** 2 * 0.7), 1, 6);
        for (let i = 0; i < nr; i++) { const ox = nr > 1 ? (R() - 0.5) * (w0 - w * 0.6) : 0, oy = nr > 1 ? (R() - 0.5) * (w0 - w * 0.6) * 0.8 : 0; { const rt = (R() - 0.5) * rotK, fx = R() < 0.5 ? -1 : 1; spr(qT, x + ox, y + oy, w, 0.5, 0.5, rt, fx, 0.65 + 0.35 * R(), kind === 'jiezi' ? 0.07 : 0.04); } } g.globalAlpha = 1; };
      for (const t of tips) { const w = clamp(t.len * (0.55 + 0.55 * R()), 0.035 * H, 0.15 * H);   // no larger: blown up on a tall tree the dabs were blots, flung far from the tree (r010)
        puff(t.x, t.y, w); if (R() < 0.4) puff(t.x + (R() - 0.5) * w * 0.9, t.y + (R() - 0.5) * w * 0.7, w * (0.6 + 0.4 * R())); } }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.11; g.globalCompositeOperation = 'destination-out'; g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(0, 0, cw, chh); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const tone = 0.45 + 0.55 * clamp((yb / H - 0.2) / 0.7, 0, 1), [live, flow] = mkLive(tone);
    return { river: true, live, flow, cv, body: NOBODY, mist: null, mxy: [0, 0, 1], ox, oy, yBase: yb, yTop: ya, tone, peaks: 0, ms: Math.round(performance.now() - tB), mistMs: 0 };
  }
  const NOBODY = document.createElement('canvas'); NOBODY.width = NOBODY.height = 1;   // what a tree or grass hides of the things behind it: nothing

  // One stroke -> grass (Yang 11-19, key 5). The stroke is a stretch of ground: tufts stand along it, upright whichever
  // way it runs, in groups with bare ground between (never an even row). Sheet O: _u single tufts, _v low patches with
  // their dashes of ground, _z small plants (a few). Small and pale high on the paper, larger and dark low on it.
  function grass(d) {
    const tB = performance.now(), H = D.H, R = dice(d.seed), N = noise1(R), P = calm(d.stroke, STEP, 4), n = P.length;
    if (n < 4) return null;
    const kitU = kitOf('_u'), kitV = kitOf('_v'), kitZ = kitOf('_z'), nearY = (y) => clamp((y / H - 0.2) / 0.7, 0, 1), g0 = d.root && ground(d.root[0], d.root[1]), farK = g0 && !g0.solid ? 0.45 : 1;   // on a far mountain's side grass is small and pale, not the size of its forest
    if (!kitU.length) return null;
    const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    let xa = 1e9, xb = -1e9, ya = 1e9, yb = -1e9; for (const p of P) { xa = Math.min(xa, p[0]); xb = Math.max(xb, p[0]); ya = Math.min(ya, p[1]); yb = Math.max(yb, p[1]); }
    const pad = Math.round(0.1 * H), ox = Math.floor(xa) - pad, oy = Math.floor(ya) - pad, cw = Math.ceil((xb - xa + 2 * pad + 2) * dpr), chh = Math.ceil((yb - ya + 2 * pad + 2) * dpr);
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = chh; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr);
    const set = []; let i = 0;
    for (let s = R() * 0.02 * H; s < cum[n - 1]; s += H * (0.018 + 0.045 * R())) { while (i < n - 1 && cum[i] < s) i++;
      const r = R(), r2 = R(), r3 = R(), r4 = R(), r5 = R(); if (N(s / (0.16 * H) + 5, 2) < 0.4 && cum[n - 1] > 0.2 * H) continue;   // a short stroke is one group: no bare stretch in it
      const kit = r < 0.6 || !kitV.length ? kitU : r < 0.9 || !kitZ.length ? kitV : kitZ; let y = P[i][1] + (r2 - 0.5) * 0.008 * H; let rot = 0; { const g1 = ground(P[i][0], y); if (g1 && g1.solid && y < g1.iy + 0.012 * H) { y = g1.iy + 0.007 * H + (r2 - 0.5) * 0.004 * H; rot = clamp(g1.sl, -0.6, 0.6); }   /* and it leans with the slope of the edge (Yang 11-19): a patch's own dash of ground lies along it */   /* on the upper edge: its foot in the ink of the edge, not above it */ const hw0 = 0.5 * H * (0.016 + 0.036 * nearY(y)) * (kit === kitV ? 1.6 : 1); if (!ground(P[i][0], y) || !ground(P[i][0] - hw0, y) || !ground(P[i][0] + hw0, y)) continue; }   /* land under the whole tuft, not only its middle: none hangs over the edge */   // every tuft is asked again when built, whatever way the stroke came in (Yang 11-19: "vẫn có vài ngọn cỏ mọc ngoài phạm vi của rìa đất")
      set.push({ rot, q: kit[Math.floor(r5 * kit.length) % kit.length], x: P[i][0], y, w: H * (0.016 + 0.036 * nearY(y)) * (0.6 + 0.8 * r3) * (kit === kitV ? 1.6 : 1) * farK, fl: r4 < 0.5, a: (0.45 + 0.55 * nearY(y)) * (0.7 + 0.3 * r4) * (farK < 1 ? 0.6 : 1) }); }
    set.sort((p, q) => p.y - q.y);
    for (const t of set) { g.globalAlpha = t.a; g.save(); g.translate(t.x, t.y); g.rotate(t.rot); stand(g, t.q, 0, 0, t.w, t.fl); g.restore(); } g.globalAlpha = 1;
    return { river: true, live: null, flow: null, cv, body: NOBODY, mist: null, mxy: [0, 0, 1], ox, oy, yBase: yb, yTop: ya, tone: 1, peaks: 0, ms: Math.round(performance.now() - tB), mistMs: 0 };
  }

  const SNAP = 0.05;   // how near its start a lake's stroke must end for the two to be drawn together, in screen heights
  const RIM = 0.006;  // how far before a near ridge the mountain behind it begins to pale, in screen heights
  const MSOFT = 0.006;   // how far the edge of the mist is melted, in screen heights
  const MIST = 1.0;   // seconds the mist takes to gather over a mountain's body, once its ink has run down
  const REVEAL = 1.6;   // seconds the ink takes to run down from the ridge
  const bake = document.createElement('canvas'); let bakeKey = '';
  const lay = (x, m, alpha) => { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = alpha; x.drawImage(m.cv, Math.round(m.ox * dpr), Math.round(m.oy * dpr)); x.globalAlpha = 1; };
  // Still water mirrors what stands behind it (Yang 11-19: water drawn with the Thuỷ stroke parts the near from the far and
  // shows the whole mountain upside down; a lake only, a river runs). Taken from the bake as it stands when the lake is
  // laid (all that is farther, mist and all): column by column the picture above the far shore is turned over about the
  // shore at that column, so an image hangs from the shore it belongs to, and squeezed (the water is seen aslant). Then,
  // level band by level band: shifted sideways by a ripple that grows toward the near shore, paler the nearer, with a
  // band left out here and there (a streak of light on the water). Kept inside the water, laid a little blurred.
  const MXY = { x: -1, y: -1 };   // the pointer (dragon off: it leaves the rings)
  let BOTRIP = null;   // the bot: a point standing in for the dragon's head (__paint.ripAt)
  let MIRROR = true;   // key M: the image in the water on and off, to compare
  function mirror(b, m, yFar) {
    const tM = performance.now();
    const w = m.wat.width, h = m.wat.height, X0 = Math.round(m.ox * dpr), Y0 = Math.round(m.oy * dpr), H = D.H;
    if (!m.r1) { const mk2 = () => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }; m.r1 = mk2(); m.r2 = mk2(); }
    const g1 = m.r1.getContext('2d'), g2 = m.r2.getContext('2d'), sw = Math.max(2, Math.round(2 * dpr)), MIRK = clamp(0.92 * (m.w1 - m.w0) / Math.max(1, Y0 + m.w0 - yFar * dpr), 0.3, m.sea ? 0.66 : 0.62), wEnd = m.sea ? Math.min(m.w1, m.w0 + Math.max(0.12 * D.H * dpr, 1.1 * MIRK * (Y0 + m.w0 - yFar * dpr))) : m.w1;   // (a waterline: the image pales out over its own length, not over the whole water down to the foot of the paper) squeezed further where the tallest thing behind would not fit: the whole of it shows, top and all (a lake under a great mountain showed only its foot, an even grey)
    g1.setTransform(1, 0, 0, 1, 0, 0); g1.clearRect(0, 0, w, h);
    // the picture above the water, copied out once: read strip by strip from the canvas being painted, every strip waited on the painting (0.6 s)
    const sy0 = Math.max(0, Math.floor(yFar * dpr) - 4), shh = Math.max(1, Math.ceil(Y0 + m.w1) - sy0); if (!m.r3) m.r3 = document.createElement('canvas'); if (m.r3.width !== w || m.r3.height !== shh) { m.r3.width = w; m.r3.height = shh; }
    { const g3 = m.r3.getContext('2d'); g3.clearRect(0, 0, w, shh); g3.drawImage(bake, X0, sy0, w, shh, 0, 0, w, shh); }
    for (let x = 0; x < w; x += sw) { const t = m.top[Math.min(w - 1, x + (sw >> 1))]; if (t < 0) continue;
      const sh = Math.min(Math.floor(Y0 + t) - sy0, Math.ceil((h - t) / MIRK)); if (sh < 2) continue;
      g1.setTransform(1, 0, 0, -MIRK, 0, t); g1.drawImage(m.r3, x, Math.floor(Y0 + t) - sy0 - sh, sw, sh, x, -sh, sw, sh); }
    // the turned image is blurred once, here (r4); the bands are only listed (y, how far toward the near side, how dark):
    // drawMir lays them, shifted for the instant, every frame. Still water (?wave=0): laid once, into the bake, as before
    if (!m.r4) { m.r4 = document.createElement('canvas'); m.r4.width = w; m.r4.height = h; }
    { const g4 = m.r4.getContext('2d'); g4.setTransform(1, 0, 0, 1, 0, 0); g4.clearRect(0, 0, w, h); g4.filter = `blur(${(0.0016 * H * dpr).toFixed(2)}px)`; g4.drawImage(m.r1, 0, 0); g4.filter = 'none'; }
    const bh = Math.max(1, Math.round(0.0022 * H * dpr)), R = dice(m.w0 * 7919 + w); m.per = 0.011 * H * dpr; m.bh = bh; m.bd = [];
    for (let y = Math.floor(m.w0); y < wEnd; y += bh) { const f = (y - m.w0) / (wEnd - m.w0), r = R(); if (!m.sea && r < 0.02 + 0.07 * f) continue;   // (not on a waterline: a band left out ran from edge to edge of the paper, a ruled white line)
      m.bd.push([y, f, (m.sea ? 0.74 * Math.pow(1 - f, 1.25) : 0.6 - 0.42 * f) * (0.93 + 0.07 * r)]); }   // (nearly even: the bands are no longer blurred together after they are laid, and 0.8 to 1 showed as scan lines)
    { const n = Math.round(clamp(w * (h - m.w0) / (0.012 * H * H * dpr * dpr), 4, 60)), Rg = dice(m.w0 * 31 + w * 7); m.gl = Array.from({ length: n }, (_, i) => ({ p: 2.6 + 2.4 * Rg(), ph: Rg(), sd: 1000 + i * 17, v: (Rg() - 0.5) * 0.05 })); }
    if (!WAVES) { drawMir(m, 0); b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1; b.drawImage(m.r2, X0, Y0); }
    m.mirMs = +(performance.now() - tM).toFixed(1);
  }
  // Moving water (Yang 11-19: "hiệu ứng sóng nước, vật lý mặt nước"). The image in the water is laid anew every frame:
  //   swell    each level band is shifted sideways by two waves that travel down the water at different speeds and
  //            lengths (the still picture had one, frozen), more toward the near side
  //   ripples  where the dragon's head comes over water, and then every 5% of a screen height it travels over it, a
  //            ring spreads from under it: two rings one after the other (sheet L's splash rings, _o; an ellipse without
  //            them), wider on near water, stronger the faster the head went, gone in RIPL seconds. While a ring lives
  //            the bands about its level swing wider (the image there breaks up). Nothing over land standing in the water.
  // Not a simulation of a surface: rings do not meet a shore or each other. rip: the rings alive, { x, y, t0, s, m, k }.
  const WAVES = new URLSearchParams(location.search).get('wave') !== '0', RIPL = 2.4; let rip = [], ripLast = null;
  function drawMir(m, T) {
    const g2 = m.r2.getContext('2d'), w = m.wat.width, h = m.wat.height, H = D.H, per = m.per, bh = m.bh, rs = rip.filter((q) => q.m === m && T > q.t0 && T < q.t0 + RIPL + 0.4);
    g2.setTransform(1, 0, 0, 1, 0, 0); g2.globalCompositeOperation = 'source-over'; g2.clearRect(0, 0, w, h);
    for (const [y, f, a] of m.bd) { let ag = 1; for (const q of rs) { const l = (T - q.t0) / RIPL, dy = (y - (q.y - m.oy) * dpr) / (0.03 * H * dpr); if (l < 1) ag += 1.5 * q.s * (1 - l) * Math.exp(-dy * dy); }
      const ph = y / per + 5 * Math.sin(y / (3.7 * per));
      g2.globalAlpha = a * (1 - (0.12 + 0.3 * f) * (0.5 + 0.5 * Math.sin(0.31 * ph + 1.6 * T)) * Math.min(ag, 2)) /* streaks of light travelling down the water */; g2.drawImage(m.r4, 0, y, w, bh, ((0.002 + 0.01 * f) * Math.sin(ph - 2.2 * T) + (0.001 + 0.006 * f) * Math.sin(0.43 * ph + 1.1 * T + 2)) * ag * H * dpr, y, w, bh); }
    // glints: short level ripple marks that come up, drift a little and go, all over the water, whether or not anything
    // is mirrored in it (Yang 11-19, of the swell alone: "anh chả thấy gì cả": a pale blurred image shifted by a few px
    // does not read as moving, and water with nothing behind it had nothing to shift). Sheet H's pale ripples (_r); a
    // thin line without them. Each has its own period and place; larger and darker toward the near side.
    { const kI = S.tex === 'code' ? [] : (STROKES.muse_is || []).concat(STROKES.gemini_is || [], STROKES.muse_il || []).filter((q) => q.im && q.w > 8 * q.h), kj = kI.length || S.tex === 'code' ? kI : (STROKES.muse_j || []).filter((q) => q.im); g2.strokeStyle   // sheet AI (11-19): single water lines with the slow waver J's straight dashes lacked; J if AI is not there = `rgb(${INK})`;
      for (const q of m.gl) { const u = T / q.p + q.ph, l = u - Math.floor(u), n = Math.floor(u), a = Math.sin(3.1416 * l); if (a < 0.05) continue;
        const R = dice(q.sd + n * 131), x = R() * w, y = m.w0 + (0.03 + 0.97 * Math.pow(R(), 1.3)) * (h - m.w0), f = (y - m.w0) / Math.max(1, h - m.w0), wd = H * dpr * (0.025 + 0.075 * f) * (0.7 + 0.6 * R()), cx = x + q.v * (l - 0.5) * H * dpr * (0.4 + f);
        // a water line of sheet J (single level dashes of still water, the lake's own), one at a time. Not sheet H's ripples (stacks
        // of level lines: current marks, they read as stamps) and not humps drawn here (Yang 11-19: the m shape was wrong: still
        // water in the manuals is bare paper and a few long thin level lines). A thin line without the sheet.
        g2.globalAlpha = Math.min(1, (0.45 + 0.45 * f) * a * a); const wl = wd * 1.6;
        if (kj.length) { const o = kj[Math.floor(R() * kj.length) % kj.length], hh = Math.min(wl * o.h / o.w, 0.12 * wl); g2.drawImage(o.im, cx - wl / 2, y - hh / 2, wl, hh); }
        else { g2.lineWidth = Math.max(1, 0.0011 * H * dpr); g2.beginPath(); g2.moveTo(cx - wl / 2, y); g2.lineTo(cx + wl / 2, y); g2.stroke(); } } }
    const ko = S.tex === 'code' ? [] : (STROKES.muse_o || []).filter((q) => q.im);
    for (const q of rs) for (const dl of [0, 0.4]) { const l = (T - q.t0 - dl) / RIPL; if (l <= 0 || l >= 1) continue;
      const nr = clamp((q.y / H - 0.3) / 0.6, 0, 1), wd = H * (0.02 + (0.1 + 0.12 * nr) * l) * (dl ? 0.7 : 1) * dpr, cx = (q.x - m.ox) * dpr, cy = (q.y - m.oy) * dpr; g2.globalAlpha = 0.9 * q.s * sm(l / 0.08) * Math.pow(1 - l, 1.4);
      if (ko.length) { const o = ko[q.k % ko.length], hh = Math.min(wd * o.h / o.w, 0.3 * wd); g2.drawImage(o.im, cx - wd / 2, cy - hh / 2, wd, hh); }
      else { g2.strokeStyle = `rgb(${INK})`; g2.lineWidth = Math.max(1, 0.0012 * H * dpr); g2.beginPath(); g2.ellipse(cx, cy, wd / 2, 0.14 * wd, 0, 0, 6.2832); g2.stroke(); } }
    g2.globalAlpha = 1; g2.globalCompositeOperation = 'destination-in'; g2.drawImage(m.wat, 0, 0); g2.globalCompositeOperation = 'source-over';
  }
  // is (x, y) on this water (a waterline: below the line; a lake: by its mask, read once at an eighth of its size)
  const inWater = (m, x, y) => { if (m.sea) return y > m.yBase + 0.004 * D.H;
    if (!m.wm) { const cv = document.createElement('canvas'); cv.width = Math.ceil(m.wat.width / 8); cv.height = Math.ceil(m.wat.height / 8); const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(m.wat, 0, 0, cv.width, cv.height); m.wm = { w: cv.width, h: cv.height, d: g.getImageData(0, 0, cv.width, cv.height).data }; }
    const px = Math.floor((x - m.ox) * dpr / 8), py = Math.floor((y - m.oy) * dpr / 8); return px >= 0 && py >= 0 && px < m.wm.w && py < m.wm.h && m.wm.d[(py * m.wm.w + px) * 4 + 3] > 128; };
  const onSolid = (m, x, y) => { if (!m.solid) return false; const k = Math.floor((x - m.bx0) / BIN); return k >= 0 && k < m.ts.length && y > m.ts[k] && y < m.yBase; };
  // far ones first; but a bank or a rock whose foot lies in a lake's water stands in that lake, so it is laid after it (by
  // its foot alone it lay behind the lake's near shore, and the water wiped it out)
  // A mountain most of which was flown above a waterline stands beyond that water, though its ends dip below the line (by
  // its foot alone it stood before the water, unmirrored, and painted over it).
  const zk = (d) => { if (d.m.solid) return st.done.reduce((z, o) => (o.m && o.m.wat && d.m.yBase > o.m.yTop && d.m.yBase <= o.m.yBase && d.m.cx > o.m.ox && d.m.cx < o.m.ox + o.m.wat.width / dpr ? Math.max(z, o.m.yBase + 0.5) : z), d.m.yBase);
    // A tree or grass rooted on a bank or a rock stands on it, before it (Yang 11-19: "sao cây luôn tự snap ra đằng sau đất thế?
    // mất cả gốc rồi": by its root alone it lay behind the land, whose foot is lower on the paper, and the land's body wiped its trunk out)
    if (d.kind === 'tree' || d.kind === 'grass') { if (!d.root) d.root = d.stroke.reduce((r, p) => (p[1] > r[1] ? p : r), d.stroke[0]); let z = d.m.yBase;
      for (const o of st.done) { const m = o.m; if (!m || !m.solid) continue; const k = Math.floor((d.root[0] - m.bx0) / BIN); if (k >= 0 && k < m.ts.length && d.root[1] > m.ts[k] - 0.04 * D.H && d.root[1] < m.yBase + 0.02 * D.H) z = Math.max(z, zk(o) + 0.6); } return z; }
    let z = d.m.yBase; if (!d.m.river) for (const o of st.done) if (o.m && o.m.sea && z > o.m.yBase && meanY(d) < o.m.yBase) z = o.m.yBase - 0.5 + 0.4 * clamp((d.m.yBase - o.m.yBase) / D.H, 0, 1); return z; };
  // Near land begun or ended close to a side of the paper runs off that side (Yang 11-19: "nét đất mà bắt đầu từ sát cạnh
  // thì nó tự snap"): flown by hand the stroke starts a little inside the edge, and the bank ended there in a faded stump with
  // bare paper beside it. The end is carried on, level, to beyond the edge. Once a stroke. The right side: the paper's, under the panel.
  function snapEdge(d) { if (d.snapped || ['river', 'lake', 'sea', 'tree', 'grass'].includes(d.kind)) return;   /* all of stroke Địa, mountains too (Yang: "có, cả núi"): a range runs off the paper at the height it had there */ d.snapped = true; const q = d.stroke, H = D.H, near = 0.07 * H, out = 0.08 * H;
    for (const end of [0, 1]) { const p = end ? q[q.length - 1] : q[0], x = p[0] < near ? -out : p[0] > freeW() - near ? D.W + out : null; if (x === null) continue;
      const add = []; for (let k = 1; k <= 6; k++) add.push([p[0] + (x - p[0]) * k / 6, p[1], p[2]]); if (end) q.push(...add); else q.unshift(...add.reverse()); } d.my = undefined; }
  function render() {
    const W = D.W, H = D.H, T = D.T; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    for (const d of st.done) if (d.m === undefined || d.m === null && d.m !== false) { snapEdge(d); d.m = ({ river, lake, sea, tree, grass }[d.kind] || mountain)(d) || false; }
    // finished mountains do not change: baked once, far ones first, each hiding what stands behind its body
    const old = st.done.filter((d) => d.m && T - d.t0 >= REVEAL).sort((p, q) => zk(p) - zk(q)), mistA = (d) => sm((T - d.t0 - REVEAL) / MIST), key = old.map((d) => d.seed + ':' + d.t0 + ':' + Math.round(mistA(d) * 24)).join() + '|' + ink.width + 'x' + ink.height;
    if (key !== bakeKey) { bakeKey = key; bake.width = ink.width; bake.height = ink.height; const b = bake.getContext('2d');
      // The mist at a land's foot lies over what grows on that land too (Yang 11-19: roots and grass at the foot stood out sharp before the mist): the land's
      // mist is held back until the last tree or tuft rooted on it has been laid, then wiped through all of them at once (once: wiping per plant would thin the land each time).
      const hostOf = (d) => { if ((d.kind !== 'tree' && d.kind !== 'grass') || !d.root) return null; let h = null, hz = -1e9; for (const o of old) { const m = o.m; if (!m.solid || !m.mist) continue; const k = Math.floor((d.root[0] - m.bx0) / BIN); if (k >= 0 && k < m.ts.length && d.root[1] > m.ts[k] - 0.04 * H && d.root[1] < m.yBase + 0.02 * H && zk(o) > hz) { hz = zk(o); h = o; } } return h; },
        lastOf = new Map(), mistOn = (d) => { const [mx, my, q] = d.m.mxy; b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'destination-out'; b.globalAlpha = mistA(d); b.imageSmoothingEnabled = true; b.imageSmoothingQuality = 'high'; b.drawImage(d.m.mist, Math.round(mx * dpr), Math.round(my * dpr), d.m.mist.width * q * dpr, d.m.mist.height * q * dpr); b.globalAlpha = 1; b.globalCompositeOperation = 'source-over'; };
      old.forEach((d, i) => { const h = hostOf(d); if (h) lastOf.set(h, i); });
      old.forEach((d, i) => { b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'destination-out'; b.globalAlpha = 1; b.drawImage(d.m.body, Math.round(d.m.ox * dpr), Math.round(d.m.oy * dpr)); b.globalCompositeOperation = 'source-over'; if (d.m.wat && MIRROR) mirror(b, d.m, old.reduce((y, o) => (o !== d && (!o.m.river || o.m.solid) && zk(o) <= zk(d) && o.m.ox < d.m.ox + d.m.wat.width / dpr && o.m.ox + o.m.cv.width / dpr > d.m.ox ? Math.min(y, o.m.yTop) : y), d.m.yTop)); lay(b, d.m, d.m.tone);
        if (d.m.mist && !lastOf.has(d)) mistOn(d); for (const [h, j] of lastOf) if (j === i) mistOn(h); }); }
    if (old.length) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(bake, 0, 0); c.restore(); }
    // moving water: each river's layer of current, redrawn for this instant, cut away where anything nearer stands
    // before it (the bodies of everything after it in the bake), and laid over the bake
    const flowOf = (d, a, k) => { const m = d.m; m.flow(T); const x = m.live.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'destination-out';
      for (let j = k + 1; j < old.length && k >= 0; j++) { const o = old[j].m, dx = Math.round((o.ox - m.ox) * dpr), dy = Math.round((o.oy - m.oy) * dpr); if (dx < m.live.width && dy < m.live.height && dx + o.body.width > 0 && dy + o.body.height > 0) x.drawImage(o.body, dx, dy); }
      x.globalCompositeOperation = 'source-over'; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = a; c.drawImage(m.live, Math.round(m.ox * dpr), Math.round(m.oy * dpr)); c.restore(); };
    old.forEach((d, k) => { if (d.m.flow) flowOf(d, 1, k); });
    if (WAVES && MIRROR) {
      rip = rip.filter((q) => T >= q.t0 && T - q.t0 < RIPL + 0.5);
      if (!(Rm.st.mouse && st.pen) || BOTRIP) { const hc = BOTRIP || (Rm.st.mouse ? MXY : Rm.hc),   // dragon off: the pointer skims the water
         wd = [...old].reverse().find((d) => d.m.wat && d.m.bd && inWater(d.m, hc.x, hc.y));
        if (wd && !old.some((d) => onSolid(d.m, hc.x, hc.y))) { const dd = ripLast ? Math.hypot(hc.x - ripLast[0], hc.y - ripLast[1]) : -1;
          if (dd < 0 || dd > 0.05 * H) { rip.push({ x: hc.x, y: hc.y, t0: T, s: dd < 0 ? 0.7 : clamp(0.45 + 0.5 * dd / Math.max(0.016, T - ripLast[2]) / H, 0.45, 1), m: wd.m, k: (Math.random() * 97) | 0 }); if (rip.length > 16) rip.shift(); ripLast = [hc.x, hc.y, T]; } }
        else ripLast = null; }
      old.forEach((d, k) => { const m = d.m; if (!m.wat || !m.bd) return; const t1 = performance.now(); drawMir(m, T); const x = m.r2.getContext('2d'); x.globalCompositeOperation = 'destination-out';
        for (let j = k + 1; j < old.length; j++) { const o = old[j].m, dx = Math.round((o.ox - m.ox) * dpr), dy = Math.round((o.oy - m.oy) * dpr); if (dx < m.r2.width && dy < m.r2.height && dx + o.body.width > 0 && dy + o.body.height > 0) x.drawImage(o.body, dx, dy); }
        x.globalCompositeOperation = 'source-over'; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = sm((T - d.t0 - REVEAL) / 1.2); c.drawImage(m.r2, Math.round(m.ox * dpr), Math.round(m.oy * dpr)); c.restore(); m.wavMs = +(performance.now() - t1).toFixed(2); }); }
    for (const d of st.done) if (d.m && T - d.t0 < REVEAL) {   // the newest: its ink still running down from the ridge
      const a = clamp((T - d.t0) / REVEAL, 0, 1), e = sm(a), m = d.m;
      if (m.river) {   // a river comes up all at once: the water clears, the banks darken
        c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-out'; c.globalAlpha = e; c.drawImage(m.body, Math.round(m.ox * dpr), Math.round(m.oy * dpr)); c.globalCompositeOperation = 'source-over'; lay(c, m, e * m.tone); c.restore(); if (m.flow) flowOf(d, e, -1);
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
    if (st.pen && st.kind === 'water' && st.stroke.length > 8) {   // where the loop began: a faint dot, dark once the head is back near enough to close on release
      const q = st.stroke, a = q[0], b = q[q.length - 1]; let L = 0; for (let i = 1; i < q.length; i++) L += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
      if (L > 0.3 * H) { const near = Math.hypot(b[0] - a[0], b[1] - a[1]) < SNAP * H; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.beginPath(); c.arc(a[0], a[1], H * (near ? 0.012 : 0.007), 0, 6.2832); c.fillStyle = `rgba(${INK},${near ? 0.6 : 0.25})`; c.fill(); }
    }
    if (T - st.msgT < 3) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.font = '15px Consolas, monospace'; const tw = c.measureText(st.msg).width, x = freeW() / 2 - tw / 2, y = H * 0.5;
      c.globalAlpha = clamp(3 - (T - st.msgT), 0, 1); c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(x - 10, y - 20, tw + 20, 30); c.fillStyle = '#111'; c.fillText(st.msg, x, y); c.globalAlpha = 1;
    }
  }
  const d0 = Rm.G.draw;
  Rm.G.draw = (dt) => { const t0 = performance.now(); if (dt > 0) step(dt); render(); d0(dt); Rm.st.jsMs = (Rm.st.jsMs || 0) * 0.9 + (performance.now() - t0) * 0.1; };   // jsMs: what paint + overlay cost a frame

  // ---- input + panel ------------------------------------------------------------------------------------------------
  // Dragon off (key D; Yang 11-19, for now, to judge the strokes without flying them): the dragon is hidden (it still
  // flies, unseen) and the stroke is what the mouse itself draws, button held. Speed as the dragon's would be read,
  // capped at the dragon's own limit: a mouse crosses the paper far faster, and every stroke came out bone dry.
  let mT = 0, mV = 0;
  document.addEventListener('mousemove', (e) => { MXY.x = e.clientX; MXY.y = e.clientY; });
  const mPt = (e) => { if (!st.pen || !Rm.st.mouse) return; const q = st.stroke, l = q[q.length - 1], d = l ? Math.hypot(e.clientX - l[0], e.clientY - l[1]) : 0; if (l && d <= 1.5) return;
    const dt = Math.max(0.004, (e.timeStamp - mT) / 1000); mT = e.timeStamp; mV = l ? 0.6 * mV + 0.4 * Math.min(Rm.S.cap, d / dt / D.H) : 0; q.push([e.clientX, e.clientY, mV]); };
  const setMouse = (on, quiet) => { penUp(); Rm.st.mouse = on; try { localStorage.setItem('room.mouse', on ? '1' : '0'); } catch { /* private window */ }
    if (on && document.pointerLockElement) document.exitPointerLock(); D.canvas.style.opacity = on ? 0 : 1; document.body.style.cursor = on ? 'crosshair' : '';
    document.getElementById('hint').classList.toggle('hide', on || Rm.st.locked); if (!quiet) say(on ? 'Tắt rồng: giữ chuột trái và kéo để vẽ' : 'Bật rồng: bấm vào màn hình để cầm đầu rồng'); sync(); };
  document.addEventListener('mousedown', (e) => { if (e.button !== 0) return; if (Rm.st.mouse) { if (!e.target.closest('#panel')) { penDown(); mT = e.timeStamp; mPt(e); } } else if (Rm.st.locked) penDown(); });
  document.addEventListener('mousemove', mPt);
  document.addEventListener('mouseup', (e) => { if (e.button === 0) penUp(); });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) penUp(); });
  const SL = [['peak', 'Vuốt đỉnh nhọn'], ['cun', 'Nét sườn núi'], ['dry', 'Độ khô / độ dày nét'], ['body', 'Độ đậm thân núi'], ['mist', 'Lượng sương (0 = tắt)']];
  const pbox = document.createElement('div');
  pbox.innerHTML = `<h3>Vẽ núi (tự do)</h3><div id="p_stat" class="keys"></div>
    <button id="p_undo">Bỏ nét cuối (Z)</button><button id="p_clear">Xóa tranh (C)</button><button id="p_again">Vẽ lại kiểu khác (X)</button><button id="p_tex"></button><button id="p_mouse"></button>
    ${SL.map(([k, name]) => `<label><span class="row"><span>${name}</span><b id="p_${k}v"></b></span><input type="range" id="p_${k}" min="0" max="1" step="0.05"></label>`).join('')}
    <div class="keys">Giữ chuột trái: hạ bút, rồng bay tới đâu vẽ tới đó
Phím D: tắt rồng, vẽ thẳng bằng chuột
Phím 1: nét Địa. Vẽ bên kia mặt nước (hoặc chưa có nước): núi. Vẽ bên này mặt nước, trong hay trước hồ: nét dài ra bờ đất, nét ngắn ra mỏm đá
Phím 2: nét Thuỷ. Bay một đường: sông. Bay một vòng về chỗ cũ: hồ. Bay thẳng ngang gần hết giấy: mặt nước soi bóng
Phím 3: nét Mộc. Nét dựng đứng: cây (nét = thân, gốc ở dưới). Nét nằm ngang: cỏ (nét = dải đất)
Game đoán sai: bấm lại phím đó để đổi nét cuối (núi/bờ đất/đá, sông/hồ/mặt nước, cây/cỏ; cây nằm ngang = cành)
Vẽ cao trên giấy: xa, nhạt, sông hẹp
Vẽ thấp: gần, đậm, sông rộng</div>`;
  panel.insertBefore(pbox, panel.firstChild);
  const $ = (id) => document.getElementById(id);
  const redo = (reseed) => { for (const d of st.done) { d.m = null; if (reseed) d.seed = (Math.random() * 2147483647) | 0; } bakeKey = ''; };
  const nextTex = () => { S.tex = TEX[(TEX.indexOf(S.tex) + 1) % TEX.length]; save(); redo(false); say('Nét bút: ' + S.tex); sync(); };
  $('p_tex').onclick = nextTex; $('p_mouse').onclick = () => setMouse(!Rm.st.mouse);
  $('p_clear').onclick = reset; $('p_undo').onclick = undo; $('p_again').onclick = () => redo(true);
  for (const [k] of SL) $('p_' + k).addEventListener('input', (e) => { S[k] = +e.target.value; save(); redo(false); sync(); });
  function sync() {
    if (!$('p_stat')) return;
    $('p_stat').textContent = `Nét đang chọn: ${KINDS.map(([id, name, what], i) => (id === st.kind ? `[${i + 1} ${name}: ${what}]` : `${i + 1} ${name}`)).join('  ')}\n` + (st.done.length ? `Đã vẽ ${st.done.length} nét` : 'Giấy trắng. Giữ chuột trái và bay một nét') + `\nCây bức này: ${[st.grove].concat(GROVES[st.grove] || []).map((g, i) => ({ pine: 'thông', dots: 'lá chấm', jiezi: 'lá rủ', mi: 'chấm Mễ', willow: 'liễu', bamboo: 'trúc', bare: 'cây khô' }[g] + (i ? '' : ' (chính)'))).join(', ')}`;
    $('p_tex').textContent = `Nét bút: ${S.tex} (B)`; $('p_mouse').textContent = Rm.st.mouse ? 'Bật rồng (D)' : 'Tắt rồng, vẽ bằng chuột (D)'; $('p_mouse').classList.toggle('on', !!Rm.st.mouse);
    for (const [k] of SL) { $('p_' + k).value = S[k]; $('p_' + k + 'v').textContent = S[k].toFixed(2); }
  }
  sync();
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'c') reset(); else if (k === 'z') undo(); else if (k === 'x') redo(true); else if (k === 'b') nextTex(); else if (k === 'd') setMouse(!Rm.st.mouse); else if (k === 'm') { MIRROR = !MIRROR; bakeKey = ''; say('Bóng nước: ' + (MIRROR ? 'bật' : 'tắt')); } else if (k === 'v') { MBLOB = !MBLOB; redo(false); say('Sương: ' + (MBLOB ? 'nhiều lớp (blob)' : 'cũ (một mảng)')); }
    else if (KINDS[+k - 1] && !st.pen) { if (st.kind !== KINDS[+k - 1][0] || !turn()) { st.kind = KINDS[+k - 1][0]; say('Nét ' + KINDS[+k - 1][1] + ': ' + KINDS[+k - 1][2]); } sync(); }
  });

  try { if (localStorage.getItem('room.mouse') === '1' && !new URLSearchParams(location.search).has('bot')) setMouse(true, true); } catch { /* dragon on */ }

  window.__paint = { S, st, step, render, reset, undo, freeW, guess, ripAt: (p) => { BOTRIP = p; }, plant, wavMs: () => st.done.map((d) => (d.m && d.m.wavMs) || 0), ready: () => strokesReady, pen: (on) => (on ? penDown() : penUp()),
    info: () => ({ strokes: st.done.length, pen: st.pen, peaks: st.done.map((d) => (d.m ? d.m.peaks : null)), buildMs: st.done.map((d) => (d.m ? d.m.ms : null)), mistMs: st.done.map((d) => (d.m ? d.m.mistMs : null)), mirMs: st.done.map((d) => (d.m && d.m.mirMs) || 0), S: { ...S } }) };
})();
