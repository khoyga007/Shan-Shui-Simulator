// InkDragon paint prototype (Yang 2026-11-18, his gameplay idea): the dragon is the brush. A figure is shown as numbered
// points on the white paper; the player flies the head through them in order with the left button held (pen down), in
// one stroke. Done right, the thing the figure stands for appears: circle -> moon, S -> river, infinity -> cloud.
// The pictures are assembled along the player's own stroke from pieces of ink paintings generated ahead with Muse
// (web/assets/parts, cut by tools/build_parts.py): peaks, cloud puffs, pine branches, reeds, rocks. Different every
// time. They bleed in outward from the stroke. No score, no levels: this is to feel the idea.
// Rules, all of them:
//   - ink flows while the left button is held (pointer locked). The stroke is the path of the held point (the eye)
//   - points count only in order, each within S.tol screens of the stroke. Closed figures end back on point 1
//   - reaching any later point before point k = missed (the dragon swung wide: it cannot turn tighter than its turning circle)
//   - lifting the pen before the last point = broken stroke. Either way the stroke fades and the figure starts over
// Sits on top of room.js (window.__room): wraps its draw hook, adds its own canvas (#ink, multiplied onto the paper).
(() => {
  const D = window.__dragon, Rm = window.__room;
  if (!D || !Rm) return;
  const ink = document.getElementById('ink'), cMain = ink.getContext('2d'), panel = document.getElementById('panel');
  let c = cMain;   // swapped to the cache canvas while finished pictures are baked
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const S = { tol: 0.055, guide: true };   // tol: how near a point the stroke must pass, screen heights
  try { Object.assign(S, JSON.parse(localStorage.getItem('paint.v1') || '{}')); } catch { /* defaults */ }
  const save = () => { try { localStorage.setItem('paint.v1', JSON.stringify(S)); } catch { /* ok */ } };

  // ---- figures: f(t), t 0..1, in px of the free paper (left of the panel). Laid out as one picture ------------------
  const freeW = () => D.W - (panel.classList.contains('hide') ? 0 : panel.offsetWidth);
  const TPL = [
    { id: 'moon', name: 'Vòng tròn → mặt trăng', closed: true, n: 8, z: 2, spread: 0.45,
      f: (t, w, H) => { const a = t * 6.2832 - 1.5708; return [0.76 * w + 0.16 * H * Math.cos(a), 0.23 * H + 0.16 * H * Math.sin(a)]; } },
    { id: 'river', name: 'Chữ S → dòng sông', closed: false, n: 7, z: 3, spread: 0.4,
      f: (t, w, H) => [w * (0.2 + 0.66 * t), H * (0.84 - 0.07 * Math.sin(t * 6.2832))] },
    { id: 'cloud', name: 'Vô cực ∞ → mây cuộn', closed: true, n: 10, z: 1, spread: 0.5,
      // the points are set off the crossing, so no point is passed twice
      f: (t, w, H) => { const a = (t + 0.05) * 6.2832, A = 0.26 * H; return [0.3 * w + A * Math.sin(a), 0.22 * H + 0.45 * A * Math.sin(2 * a)]; } },
    // two soft waves: tighter ones the dragon cannot fly (its turning circle is about a tenth of the screen)
    { id: 'mountain', name: 'Lượn sóng → dãy núi', closed: false, n: 7, z: 0, spread: 1.0,
      f: (t, w, H) => [w * (0.14 + 0.72 * t), H * (0.54 - 0.05 * Math.sin(t * 2 * 6.2832))] },
    { id: 'pine', name: 'Nét sổ ↑ → cây tùng', closed: false, n: 5, z: 4, spread: 0.7,
      f: (t, w, H) => [0.14 * w, H * (0.9 - 0.45 * t)] },
  ];
  let geo = null;   // per figure: line (dense polyline), pts (the numbered points)
  function layout() {
    const w = freeW(), H = D.H;
    geo = TPL.map((T) => ({
      line: Array.from({ length: 241 }, (_, i) => T.f(i / 240 * (T.closed ? 1 : 1), w, H)),
      pts: Array.from({ length: T.n }, (_, k) => T.f(T.closed ? k / T.n : k / (T.n - 1), w, H)),
    }));
  }

  // ---- state --------------------------------------------------------------------------------------------------------
  const st = { cur: 0, pen: false, next: 0, counting: false, over: false, stroke: [], fade: null, done: [], msg: '', msgT: -9, last: null };
  const say = (s) => { st.msg = s; st.msgT = D.T; };
  function reset(all) {
    st.pen = false; st.next = 0; st.counting = false; st.over = false; st.stroke = []; st.fade = null;
    if (all) { st.done = []; st.cur = 0; st.last = null; }
    sync();
  }
  function pick(i) { st.cur = clamp(i, 0, TPL.length - 1); st.done = st.done.filter((d) => d.i !== st.cur); st.next = 0; st.counting = false; st.over = false; st.stroke = []; sync(); }
  function penDown() { if (st.pen) return; st.pen = true; st.over = false; st.next = 0; st.counting = false; st.stroke = []; }
  function penUp() {
    if (!st.pen) return; st.pen = false;
    if (!st.over && st.stroke.length > 3) fail(st.counting ? `Đứt nét ở điểm ${st.next + 1}` : 'Chưa chạm điểm 1');
    st.over = false;
  }
  function fail(why) { st.fade = { s: st.stroke, t0: D.T }; st.stroke = []; st.next = 0; st.counting = false; st.over = true; st.last = { ok: false, why, fig: TPL[st.cur].id }; say(why + ' · vẽ lại'); }
  const dLine = (L, x, y) => { let b = 1e9; for (let i = 0; i < L.length; i++) { const d = Math.hypot(L[i][0] - x, L[i][1] - y); if (d < b) b = d; } return b; };
  function finish() {
    const T = TPL[st.cur], g = geo[st.cur], R = D.rad(); let sum = 0, mx = 0, n = 0;
    for (const p of st.stroke) if (p[3]) { const d = dLine(g.line, p[0], p[1]); sum += d; if (d > mx) mx = d; n++; }
    const avg = sum / Math.max(1, n), grade = avg < 0.5 * R ? 'nét đẹp' : avg < R ? 'nét tạm' : 'nét run';
    st.done.push({ i: st.cur, stroke: st.stroke.filter((p) => p[3]), t0: D.T, seed: (Math.random() * 2147483647) | 0 });   // the run-up before point 1 is not part of the picture
    st.last = { ok: true, fig: T.id, avgPx: +avg.toFixed(1), maxPx: +mx.toFixed(1), avgR: +(avg / R).toFixed(2), grade };
    say(`Xong: ${T.name.split('→')[1].trim()} · lệch TB ${avg.toFixed(0)} px (${grade})`);
    st.stroke = []; st.over = true; st.counting = false; st.next = 0;
    const nx = TPL.findIndex((_, i) => !st.done.some((d) => d.i === i)); if (nx >= 0) st.cur = nx;
    sync();
  }
  function step(dt) {
    if (!geo || geo.w !== freeW() || geo.H !== D.H) { layout(); geo.w = freeW(); geo.H = D.H; }
    if (!st.pen || st.over) return;
    const hc = Rm.hc, H = D.H, T = TPL[st.cur], P = geo[st.cur].pts, tol = S.tol * H, q = st.stroke, l = q[q.length - 1];
    const v = l ? Math.hypot(hc.x - l[0], hc.y - l[1]) / dt / H : 0;
    if (!l || Math.hypot(hc.x - l[0], hc.y - l[1]) > 1.5) q.push([hc.x, hc.y, v, st.counting]);
    const near = (k) => Math.hypot(P[k][0] - hc.x, P[k][1] - hc.y) < tol;
    const last = st.next >= T.n;   // closed figure: all points taken, the way back to point 1 is left
    if (near(last ? 0 : st.next)) {
      if (last || (!T.closed && st.next === T.n - 1)) return finish();
      st.next++; st.counting = true; sync();
    } else if (st.counting && !last) { for (let k = st.next + 1; k < T.n; k++) if (near(k)) return fail(`Trượt điểm ${st.next + 1}`); }
  }

  // ---- drawing ------------------------------------------------------------------------------------------------------
  let dpr = 1;
  function size() { dpr = Math.min(2, devicePixelRatio || 1); ink.width = Math.round(innerWidth * dpr); ink.height = Math.round(innerHeight * dpr); }
  size(); addEventListener('resize', () => { size(); reset(true); geo = null; });
  // The stroke is drawn opaque on a scratch canvas and laid on at its alpha: drawn straight, the overlapping round
  // caps showed as a string of beads
  const tmp = document.createElement('canvas'), tc = tmp.getContext('2d');
  function strokePath(q, alpha) {   // brush: slow = fat, fast = thin
    if (q.length < 2) return;
    const R = D.rad(); if (tmp.width !== ink.width || tmp.height !== ink.height) { tmp.width = ink.width; tmp.height = ink.height; }
    tc.setTransform(dpr, 0, 0, dpr, 0, 0); tc.clearRect(0, 0, D.W, D.H); tc.lineCap = 'round'; tc.strokeStyle = 'rgb(18,18,24)';
    let w = R * 0.8;
    for (let i = 1; i < q.length; i++) { w += (R * (0.95 - 0.6 * clamp(q[i][2] / 1.6, 0, 1)) - w) * 0.25; tc.lineWidth = Math.max(2, w); tc.beginPath(); tc.moveTo(q[i - 1][0], q[i - 1][1]); tc.lineTo(q[i][0], q[i][1]); tc.stroke(); }
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = alpha; c.drawImage(tmp, 0, 0); c.restore();
  }
  // ---- the two paintings still used whole (moon; the river, for its water) ----------------------------------------------
  // The paintings are black ink on pure white. They are drawn as they are (opaque) and multiplied together, so white
  // counts as empty paper everywhere: no cut-outs needed, and overlapping slices of one painting cannot double its ink.
  const IMG = {};
  function analyse(im) {   // where the ink is, on a 256-wide copy: box, top edge per column, all as fractions of the image
    const w = 256, h = Math.round(256 * im.height / im.width), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const x = cv.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h); const px = x.getImageData(0, 0, w, h).data;
    const dark = (i, j) => 255 - (px[(j * w + i) * 4] + px[(j * w + i) * 4 + 1] + px[(j * w + i) * 4 + 2]) / 3;
    let x0 = w, x1 = 0, y0 = h, y1 = 0; const top = new Array(w).fill(null);
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) if (dark(i, j) > 30) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; if (top[i] == null && dark(i, j) > 60) top[i] = j / h; }
    let lastT = top.find((v) => v != null) ?? 0.5; for (let i = 0; i < w; i++) { if (top[i] == null) top[i] = lastT; else lastT = top[i]; }
    const tS = top.map((_, i) => { let a = 0, n = 0; for (let k = -13; k <= 13; k++) { a += top[clamp(i + k, 0, w - 1)]; n++; } return a / n; });   // the ridge with its crags smoothed off
    return { b: [x0 / w, y0 / h, (x1 + 1) / w, (y1 + 1) / h], top: tS };
  }
  for (const n of ['moon', 'river']) { const im = new Image(); im.onload = () => { IMG[n] = { im, ...analyse(im) }; }; im.src = '../assets/scene/' + n + '.webp'; }

  // the stroke as an even, calm line (a hand wobbles; the painting must not)
  function calm(q, step, k) {
    const P = [[q[0][0], q[0][1]]]; let left = step;
    for (let i = 1; i < q.length; i++) { let ax = q[i - 1][0], ay = q[i - 1][1]; const bx = q[i][0], by = q[i][1]; let d = Math.hypot(bx - ax, by - ay);
      while (d >= left) { ax += (bx - ax) * left / d; ay += (by - ay) * left / d; P.push([ax, ay]); d -= left; left = step; } left -= d; }
    return P.map((_, i) => { let x = 0, y = 0, n = 0; for (let j = Math.max(0, i - k); j <= Math.min(P.length - 1, i + k); j++) { x += P[j][0]; y += P[j][1]; n++; } return [x / n, y / n]; });
  }
  const box = (P) => P.reduce((m, p) => [Math.min(m[0], p[0]), Math.min(m[1], p[1]), Math.max(m[2], p[0]), Math.max(m[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
  // painting's ink box onto a box on the paper (mirrored if asked)
  function fit(x, A, B, flip, rot) {
    const im = A.im, sx = (B[2] - B[0]) / ((A.b[2] - A.b[0]) * im.width), sy = (B[3] - B[1]) / ((A.b[3] - A.b[1]) * im.height);
    x.save(); x.setTransform(dpr, 0, 0, dpr, 0, 0); if (flip) { x.translate(B[0] + B[2], 0); x.scale(-1, 1); }
    if (rot) { const cx = (B[0] + B[2]) / 2, cy = (B[1] + B[3]) / 2; x.translate(cx, cy); x.rotate(rot); x.translate(-cx, -cy); }
    x.drawImage(im, B[0] - A.b[0] * im.width * sx, B[1] - A.b[1] * im.height * sy, im.width * sx, im.height * sy); x.restore();
  }
  // a long painting (river, pine on its side) bent along the line P: cut into thin slices across, each turned to the line
  function bend(x, A, P, vs, ends, rows) {
    const im = A.im, iw = im.width, ih = im.height, n = P.length, cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const L = cum[n - 1], u0 = A.b[0] * iw, s = L / ((A.b[2] - A.b[0]) * iw), pad = 0.03, bh = A.b[3] - A.b[1], r0 = (rows ? A.b[1] + rows[0] * bh : Math.max(0, A.b[1] - pad)) * ih, r1 = (rows ? A.b[1] + rows[1] * bh : Math.min(1, A.b[3] + pad)) * ih, mid = (A.b[1] + A.b[3]) / 2 * ih, ds = 3,
      wide = typeof vs === 'function' ? vs : () => vs;   // how much the painting is stretched across the line, by place along it (0..1)
    let j = 0;
    for (let a = 0; a < L; a += ds) {
      while (j < n - 2 && cum[j + 1] < a) j++;
      const f = (a - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]), px = P[j][0] + (P[j + 1][0] - P[j][0]) * f, py = P[j][1] + (P[j + 1][1] - P[j][1]) * f;
      const p0 = P[Math.max(0, j - 3)], p1 = P[Math.min(n - 1, j + 4)], th = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), co = Math.cos(th), si = Math.sin(th);
      x.setTransform(dpr * co, dpr * si, -dpr * si, dpr * co, dpr * px, dpr * py);
      const v = wide(a / L); x.drawImage(im, u0 + a / s, r0, (ds + 1.5) / s, r1 - r0, 0, (r0 - mid) * s * v, ds + 1.5, (r1 - r0) * s * v);
    }
    if (ends) {   // both ends melt away (cut square, a river or a cloud bank looks pasted on)
      const len = ends * L, big = (r1 - r0) * s * wide(0), at = (d) => { let k = 0; while (k < n - 2 && cum[k + 1] < d) k++; const f = (d - cum[k]) / Math.max(1e-6, cum[k + 1] - cum[k]); return [P[k][0] + (P[k + 1][0] - P[k][0]) * f, P[k][1] + (P[k + 1][1] - P[k][1]) * f]; };
      x.globalCompositeOperation = 'destination-out';
      for (const [e, i] of [[P[0], at(len)], [P[n - 1], at(L - len)]]) {
        const th = Math.atan2(i[1] - e[1], i[0] - e[0]), co = Math.cos(th), si = Math.sin(th), g = x.createLinearGradient(0, 0, len, 0); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.setTransform(dpr * co, dpr * si, -dpr * si, dpr * co, dpr * e[0], dpr * e[1]); x.fillStyle = g; x.fillRect(-len, -big, 2 * len, 2 * big);
      }
      x.globalCompositeOperation = 'source-over';
    }
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    return (r1 - r0) * s * wide(0.5) / 2;
  }
  // ---- scenery put together from pieces ------------------------------------------------------------------------------
  // Yang 11-18: not one ready painting per figure. The paintings are cut into pieces (tools/build_parts.py: peaks,
  // cloud puffs and swirls, pine branches and trunks, reeds, rocks, bank strips) and each picture is assembled from them
  // along the player's stroke, by dice seeded per picture: the same stroke gives a different mountain range every time.
  const PARTS = {}; let partsReady = false;
  fetch('../assets/parts/parts.json').then((r) => r.json()).then((man) => {
    let left = 0;
    for (const k in man) { PARTS[k] = man[k]; for (const p of man[k]) { left++; const im = new Image(); im.onload = () => { p.im = im; if (--left === 0) partsReady = true; }; im.src = '../assets/parts/' + p.f; } }
  });
  const dice = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const any = (R, a) => a[Math.floor(R() * a.length) % a.length];
  // one piece: its anchor (ax, ay; the middle if it has none) at (px, py), `size` px wide, turned by rot, mirrored if flip.
  // Pieces are opaque on white and multiplied on; peaks carry their own alpha and are laid over (mode 'source-over')
  function stamp(x, p, px, py, size, rot, flip, alpha, mode) {
    const s = size / p.w, co = Math.cos(rot || 0) * dpr, si = Math.sin(rot || 0) * dpr;
    x.setTransform(co, si, -si, co, px * dpr, py * dpr); x.scale(flip ? -s : s, s); x.globalAlpha = alpha ?? 1; x.globalCompositeOperation = mode || 'multiply';
    x.drawImage(p.im, -(p.ax ?? 0.5) * p.w, -(p.ay ?? 0.5) * p.h);
  }
  const plain = (x) => { x.setTransform(dpr, 0, 0, dpr, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; };
  // the stroke by arc length: at(d) -> [x, y, heading]
  function along(P) {
    const n = P.length, cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const L = cum[n - 1];
    return { L, at: (d) => { d = clamp(d, 0, L); let j = 0, lo = 0, hi = n - 2; while (lo <= hi) { const m = (lo + hi) >> 1; if (cum[m] <= d) { j = m; lo = m + 1; } else hi = m - 1; }
      const f = (d - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]), p0 = P[Math.max(0, j - 3)], p1 = P[Math.min(n - 1, j + 4)];
      return [P[j][0] + (P[j + 1][0] - P[j][0]) * f, P[j][1] + (P[j + 1][1] - P[j][1]) * f, Math.atan2(p1[1] - p0[1], p1[0] - p0[0])]; } };
  }
  const PAINT = {
    // the one painting kept whole: turned and mirrored by the dice
    moon: (x, P, R) => fit(x, IMG.moon, box(P), R() < 0.5, R() * 6.2832),

    // mountains: a peak on every crest of the stroke, its summit on the stroke, taller where the stroke climbs higher;
    // smaller peaks fill the line between; a pale far range behind. Near peaks hide far ones
    mountain: (x, P, R) => {
      const H = D.H, B = box(P), nb = Math.ceil((B[2] - B[0]) / 8) + 1, acc = new Array(nb).fill(0), cnt = new Array(nb).fill(0);
      for (const p of P) { const k = clamp(Math.round((p[0] - B[0]) / 8), 0, nb - 1); acc[k] += p[1]; cnt[k]++; }
      let last = P[0][1]; const ys = acc.map((v, k) => (cnt[k] ? (last = v / cnt[k]) : null)); for (let k = nb - 1, nx = last; k >= 0; k--) { if (ys[k] == null) ys[k] = nx; else nx = ys[k]; }
      const yAt = (cx) => ys[clamp(Math.round((cx - B[0]) / 8), 0, nb - 1)], ym = ys.reduce((a, b) => a + b, 0) / nb, peaks = [];
      const add = (cx, big, far) => {
        const p = any(R, PARTS.peak), rise = clamp((ym - yAt(cx)) / H, -0.04, 0.07);
        const wide = H * (far ? 0.18 + 0.1 * R() : big ? 0.32 + 0.1 * R() : 0.2 + 0.1 * R()) * (1 + 2.2 * rise), tall = H * (far ? 0.13 : big ? 0.27 : 0.17) * (1 + 2.2 * rise);
        const size = Math.min(wide, tall * p.w / p.h), y = yAt(cx) - (far ? H * (0.015 + 0.035 * R()) : 0);
        peaks.push({ p, x: cx, y, size, flip: R() < 0.5, far, base: y + (1 - p.ay) * p.h * size / p.w });
      };
      const w = 8; for (let k = 1; k < nb - 1; k++) { let top = true; for (let q = Math.max(0, k - w); q <= Math.min(nb - 1, k + w); q++) if (ys[q] < ys[k] - 1e-6 || (ys[q] === ys[k] && q < k)) top = false; if (top && ys[k] < ym) add(B[0] + k * 8, true, false); }
      const crests = peaks.map((q) => q.x);
      for (let cx = B[0] + H * 0.03 * R(); cx < B[2]; cx += H * (0.07 + 0.05 * R())) if (!crests.some((c) => Math.abs(c - cx) < 0.06 * H)) add(cx, false, false);
      for (let i = 0, n = 6 + Math.floor(R() * 3); i < n; i++) add(B[0] + (B[2] - B[0]) * (0.02 + 0.96 * (i + R()) / n), false, true);
      peaks.sort((a, b) => (b.far - a.far) || (a.base - b.base));
      for (const q of peaks) stamp(x, q.p, q.x, q.y, q.size, 0, q.flip, q.far ? 0.42 : 1, 'source-over');
      plain(x);
    },

    // cloud: puffs strung along the stroke, a swirl in each of the two loops
    cloud: (x, P, R) => {
      const H = D.H, B = box(P), mx = (B[0] + B[2]) / 2, A = along(P);
      for (let d = 0; d < A.L; d += H * (0.05 + 0.03 * R())) { const q = A.at(d); stamp(x, any(R, PARTS.puff), q[0] + H * 0.03 * (R() - 0.5), q[1] + H * 0.03 * (R() - 0.5), H * (0.1 + 0.07 * R()), R() * 6.2832, R() < 0.5, 0.5 + 0.35 * R()); }
      const used = [];
      for (const lobe of [P.filter((p) => p[0] < mx), P.filter((p) => p[0] >= mx)]) {
        if (lobe.length < 3) continue;
        let p; do { p = any(R, PARTS.swirl); } while (used.includes(p) && used.length < PARTS.swirl.length); used.push(p);
        const b = box(lobe), tail = p.w > 1.35 * p.h;   // the swirls with a trailing tail are laid flat, the round ones turned freely
        stamp(x, p, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2, (b[2] - b[0]) * (tail ? 1.05 : 0.72), tail ? 0.5 * (R() - 0.5) : R() * 6.2832, R() < 0.5, 0.92);
      }
      plain(x);
    },

    // pine: a trunk bent along the stroke, thinning upward; branches set on it left and right, long low down, short at
    // the top. A branch is mirrored to grow away from the trunk and turned only a little, so drooping ones still droop
    pine: (x, P, R) => {
      const H = D.H, A = along(P), tr = any(R, PARTS.trunk), thick = (tr.b[3] - tr.b[1]) * tr.h * (A.L / ((tr.b[2] - tr.b[0]) * tr.w));
      bend(x, tr, P, (t) => H * (0.05 - 0.028 * t) / thick, 0);
      const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), n = 9 + Math.floor(R() * 4), first = R() < 0.5 ? 1 : -1;
      const grow = (t, side, long, up) => {
        const q = A.at(t * A.L), p = any(R, PARTS.branch), flip = side * p.dx < 0, phi = Math.atan2(p.dy, flip ? -p.dx : p.dx), lean = q[2] + 1.5708;
        const want = (side > 0 ? -up : Math.PI + up) + lean, rot = clamp(wrap(want - phi), -0.6, 0.6);
        stamp(x, p, q[0], q[1], long / (p.len * Math.max(p.w, p.h)) * p.w, rot, flip, 1);
      };
      for (let i = 0; i < n; i++) { const t = Math.min(0.96, 0.26 + 0.72 * (i + 0.6 * R()) / n); grow(t, (i % 2 ? 1 : -1) * first, H * (0.25 - 0.13 * t) * (0.8 + 0.4 * R()), -0.1 + 0.4 * R()); }
      grow(1, first, H * 0.13, 0.5 + 0.4 * R()); grow(1, -first, H * 0.13, 0.5 + 0.4 * R()); grow(0.93, first, H * 0.12, 0.9 + 0.3 * R());
      plain(x);
    },

    // river: the water of the river painting bent along the stroke; bank strips, reeds and rocks set along both edges
    river: (x, P, R) => {
      const H = D.H, A = along(P), hw = bend(x, IMG.river, P, 0.65, 0.07, [0.2, 0.8]), things = [];
      const put = (kind, t, side, off, size, rot, alpha) => { const q = A.at(t * A.L), nx = -Math.sin(q[2]), ny = Math.cos(q[2]); things.push({ p: any(R, PARTS[kind]), x: q[0] + nx * side * off, y: q[1] + ny * side * off, size, rot: rot + (kind === 'bank' ? q[2] : 0), flip: R() < 0.5, alpha }); };
      for (const side of [-1, 1]) for (let d = A.L * (0.03 + 0.08 * R()); d < A.L * 0.94;) { const len = H * (0.15 + 0.11 * R()); if (d + len / 2 < A.L * 0.97) put('bank', (d + len / 2) / A.L, side, hw * 1.05, len, 0, side < 0 ? 0.8 : 1); d += len * (0.7 + 0.6 * R()); }
      for (let i = 0, n = 5 + Math.floor(R() * 5); i < n; i++) put('reed', 0.06 + 0.88 * (i + R()) / n, R() < 0.5 ? -1 : 1, hw * (0.95 + 0.35 * R()), H * (0.07 + 0.06 * R()), 0.25 * (R() - 0.5), 1);
      for (let i = 0, n = 3 + Math.floor(R() * 4); i < n; i++) put('rock', 0.06 + 0.88 * (i + R()) / n, R() < 0.5 ? -1 : 1, hw * (0.55 + 0.6 * R()), H * (0.03 + 0.035 * R()), 0.2 * (R() - 0.5), 1);
      things.sort((a, b) => a.y - b.y);   // the far bank first
      for (const t of things) stamp(x, t.p, t.x, t.y, t.size, t.rot, t.flip, t.alpha);
      plain(x);
    },
  };
  function picture(d) {   // the finished painting of one figure, on a canvas of its own; null until its images are in
    const T = TPL[d.i]; if (!partsReady || !IMG.moon || !IMG.river || d.stroke.length < 4) return null;
    const cv = document.createElement('canvas'); cv.width = ink.width; cv.height = ink.height; const x = cv.getContext('2d'); x.imageSmoothingQuality = 'high';
    x.setTransform(dpr, 0, 0, dpr, 0, 0); PAINT[T.id](x, calm(d.stroke, 4, 6), dice(d.seed)); return cv;
  }
  const mask = document.createElement('canvas'), mc = mask.getContext('2d');
  function bleed(d, a) {   // the painting spreading out from the stroke: a is 0..1
    if (mask.width !== ink.width || mask.height !== ink.height) { mask.width = ink.width; mask.height = ink.height; }
    const H = D.H, e = a * a * (3 - 2 * a), q = d.stroke;
    mc.setTransform(1, 0, 0, 1, 0, 0); mc.globalCompositeOperation = 'source-over'; mc.filter = 'none'; mc.clearRect(0, 0, mask.width, mask.height); mc.drawImage(d.pic, 0, 0);
    mc.globalCompositeOperation = 'destination-in'; mc.filter = `blur(${(0.02 * H * dpr).toFixed(1)}px)`; mc.setTransform(dpr, 0, 0, dpr, 0, 0);
    mc.lineCap = mc.lineJoin = 'round'; mc.lineWidth = D.rad() * 0.6 + e * TPL[d.i].spread * H; mc.beginPath(); q.forEach((p, k) => (k ? mc.lineTo(p[0], p[1]) : mc.moveTo(p[0], p[1]))); if (TPL[d.i].closed) mc.closePath(); mc.stroke();
    mc.filter = 'none'; mc.globalCompositeOperation = 'source-over';
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'multiply'; c.drawImage(mask, 0, 0); c.restore();
  }
  const REVEAL = 2.2;   // seconds a painting takes to bleed in
  const STROKE_END = 0.1;   // how much of the player's own stroke stays over the finished painting
  const bake = document.createElement('canvas'); let bakeKey = '';
  function render() {
    const W = D.W, H = D.H, T = D.T; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    if (!geo) return;
    // finished pictures do not change: baked once into a canvas (redrawing three strokes and pictures every frame cost
    // frame time for nothing). Only one still fading in is drawn live
    for (const d of st.done) if (!d.pic) d.pic = picture(d);
    const old = st.done.filter((d) => d.pic && T - d.t0 >= REVEAL).sort((p, q) => TPL[p.i].z - TPL[q.i].z), key = old.map((d) => d.i + ':' + d.t0).join() + '|' + ink.width + 'x' + ink.height;
    if (key !== bakeKey) { bakeKey = key; bake.width = ink.width; bake.height = ink.height; c = bake.getContext('2d');
      for (const d of old) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'multiply'; c.drawImage(d.pic, 0, 0); c.globalCompositeOperation = 'source-over'; c.setTransform(dpr, 0, 0, dpr, 0, 0); strokePath(d.stroke, STROKE_END); }
      c = cMain; c.setTransform(dpr, 0, 0, dpr, 0, 0); }
    if (old.length) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(bake, 0, 0); c.restore(); }
    for (const d of st.done) if (!d.pic || T - d.t0 < REVEAL) { const a = clamp((T - d.t0) / REVEAL, 0, 1); if (d.pic) bleed(d, a); strokePath(d.stroke, 0.85 - (0.85 - STROKE_END) * a); }
    if (st.fade) { const a = 1 - (T - st.fade.t0) / 0.8; if (a > 0) strokePath(st.fade.s, 0.6 * a); else st.fade = null; }
    if (st.stroke.length > 1) strokePath(st.stroke, 0.85);
    if (S.guide && !st.done.some((d) => d.i === st.cur)) {
      const g = geo[st.cur], tol = S.tol * H, Tp = TPL[st.cur];
      c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1.5; c.setLineDash([3, 7]); c.beginPath(); g.line.forEach((p, k) => k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); c.setLineDash([]);
      c.font = 'bold 13px Consolas, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      g.pts.forEach((p, k) => {
        const got = st.counting && (k < st.next), nx = k === (st.next >= Tp.n ? 0 : st.next);
        c.beginPath(); c.arc(p[0], p[1], tol, 0, 6.2832); c.fillStyle = got ? 'rgba(30,150,80,.18)' : nx ? 'rgba(210,40,30,.14)' : 'rgba(0,0,0,.05)'; c.fill();
        c.lineWidth = nx ? 2 : 1; c.strokeStyle = got ? 'rgba(30,150,80,.8)' : nx ? 'rgba(210,40,30,.9)' : 'rgba(0,0,0,.35)'; c.stroke();
        c.fillStyle = got ? '#1a7a44' : nx ? '#c22' : '#444'; c.fillText(String(k + 1), p[0], p[1]);
      });
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    }
    if (T - st.msgT < 3) {
      c.font = '15px Consolas, monospace'; const tw = c.measureText(st.msg).width, x = freeW() / 2 - tw / 2, y = H * 0.5;
      c.globalAlpha = clamp(3 - (T - st.msgT), 0, 1); c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(x - 10, y - 20, tw + 20, 30); c.fillStyle = '#111'; c.fillText(st.msg, x, y); c.globalAlpha = 1;
    }
  }
  const d0 = Rm.G.draw;
  Rm.G.draw = (dt) => { const t0 = performance.now(); if (dt > 0) step(dt); render(); d0(dt); Rm.st.jsMs = (Rm.st.jsMs || 0) * 0.9 + (performance.now() - t0) * 0.1; };   // jsMs: what paint + overlay cost a frame

  // ---- input + panel ------------------------------------------------------------------------------------------------
  document.addEventListener('mousedown', (e) => { if (e.button === 0 && Rm.st.locked) penDown(); });
  document.addEventListener('mouseup', (e) => { if (e.button === 0) penUp(); });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) penUp(); });
  const pbox = document.createElement('div');
  pbox.innerHTML = `<h3>Vẽ tranh (bản thử)</h3><div id="p_stat" class="keys"></div>
    ${TPL.map((T, i) => `<button class="pf" data-i="${i}">${i + 1}. ${T.name.split('→')[0].trim()}</button>`).join('')}<br>
    <button id="p_clear">Xóa tranh (C)</button><button id="p_guide">Ẩn/hiện mẫu (V)</button>
    <label><span class="row"><span>Độ rộng điểm (màn)</span><b id="p_tolv"></b></span><input type="range" id="p_tol" min="0.02" max="0.1" step="0.005"></label>
    <div class="keys">Giữ chuột trái: hạ bút
Qua các điểm theo số, một nét
Thả chuột giữa chừng: đứt nét
1–5: chọn hình</div>`;
  panel.insertBefore(pbox, panel.firstChild);
  const $ = (id) => document.getElementById(id);
  pbox.querySelectorAll('.pf').forEach((b) => { b.onclick = () => pick(+b.dataset.i); });
  $('p_clear').onclick = () => reset(true);
  $('p_guide').onclick = () => { S.guide = !S.guide; save(); };
  $('p_tol').addEventListener('input', (e) => { S.tol = +e.target.value; save(); sync(); });
  function sync() {
    if (!$('p_stat')) return;
    const T = TPL[st.cur], all = st.done.length === TPL.length;
    $('p_stat').textContent = all ? 'Xong cả tranh. Bấm C để vẽ lại' : `Đang vẽ: ${T.name}\nĐiểm kế: ${st.next >= T.n ? 1 : st.next + 1}/${T.n}` + (st.last ? `\nLần trước: ${st.last.ok ? `lệch TB ${st.last.avgPx} px, ${st.last.grade}` : st.last.why}` : '');
    pbox.querySelectorAll('.pf').forEach((b) => { const i = +b.dataset.i; b.classList.toggle('on', i === st.cur && !all); b.textContent = `${i + 1}. ${TPL[i].name.split('→')[0].trim()}${st.done.some((d) => d.i === i) ? ' ✓' : ''}`; });
    $('p_tol').value = S.tol; $('p_tolv').textContent = S.tol.toFixed(3);
  }
  sync();
  addEventListener('keydown', (e) => {
    const k = e.key;
    if (k.length === 1 && k >= '1' && k <= String(TPL.length)) pick(+k - 1);
    else if (k === 'c' || k === 'C') reset(true);
    else if (k === 'v' || k === 'V') { S.guide = !S.guide; save(); }
  });

  window.__paint = { S, st, TPL, step, render, pick, reset, ready: () => partsReady && !!IMG.moon && !!IMG.river, pen: (on) => (on ? penDown() : penUp()), geo: () => { if (!geo) { layout(); geo.w = freeW(); geo.H = D.H; } return geo; },
    info: () => ({ fig: TPL[st.cur].id, next: st.next, pen: st.pen, done: st.done.map((d) => TPL[d.i].id), last: st.last, tol: S.tol }) };
})();
