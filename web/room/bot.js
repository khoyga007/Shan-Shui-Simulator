// Room self-test (tools/roomtest.py, page opened with ?bot=1): flies scripted mouse paths through the real room code,
// one fixed 1/60 s frame at a time, and posts the numbers (reports/bot.json) and a strip of U-turn frames (bot-uturn.jpg).
// What it guards: a sudden reversal must not jerk the head or swing the body (Yang 11-18).
//   faceMax   most the drawn facing (joint 2 -> neck) turned in one frame, rad      (old controller: 1.2 and up)
//   jointOver most any plain joint moved in a frame beyond what the neck moved, px   (a whipped body shows here)
//   waveOff   mean sideways push of the body wave over the 2nd half of the run, px: full flying straight, ~0 in a circle
//   drawnBendMax  sharpest joint of the spine as drawn (plain + wave), rad: a zigzag tail shows here
//   tailBendAvg   mean bend of the plain spine's last 20 joints over the 2nd half, rad a joint: a tail wound into a ring sits at the bend limit
//   offFigurePx   dance, 2nd half: farthest any plain joint lay from the figure-8 line, px
//   err*      held point (eye) to mouse point, body radii
(async () => {
  const D = window.__dragon, Rm = window.__room, dbg = window.__dragonDebug;
  const post = (name, url) => fetch('/report', { method: 'POST', body: name + '|' + url });
  const json = (o) => 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1))));
  if (!D || !Rm) { post('bot.json', json({ error: 'no WebGL / room' })); return; }
  Rm.st.paused = true;
  // the paintings load on their own time; this script never yields once it starts, so wait for them here (without this the
  // pictures were there on some runs and missing on others)
  for (let i = 0; i < 200 && window.__paint && !window.__paint.ready(); i++) await new Promise((r) => setTimeout(r, 50));
  Object.assign(Rm.S, { cap: 2.5, follow: 30, leash: 0.35, sens: 1, turn: 16, hold: 1.6, rho: 1.8, accel: 6 }, JSON.parse(new URLSearchParams(location.search).get('set') || '{}'));
  const H = D.H, W = D.W, R = D.rad(), dt = 1 / 60, N = D.N, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  let T = [0, 0];
  const fr = (move, render) => {   // one frame: mouse delta (leashed like the real handler), room, dragon
    const hc = Rm.hc; T[0] += move[0]; T[1] += move[1];
    const dx = T[0] - hc.x, dy = T[1] - hc.y, d = Math.hypot(dx, dy), L = Rm.S.leash * H;
    if (d > L) { T[0] = hc.x + dx / d * L; T[1] = hc.y + dy / d * L; }
    Rm.target(T[0], T[1]); Rm.tick(dt); dbg.step(1, { dt, noRender: !render, noSnap: true });
  };
  const out = { screen: [W, H], R: +R.toFixed(1), settings: { ...Rm.S, L: undefined } };
  const strip = document.createElement('canvas'), sx = strip.getContext('2d'); strip.width = 1920; strip.height = 720; let nShot = 0;
  const shot = (label) => { Rm.G.draw(dt); const x = (nShot % 3) * 640, y = (Math.floor(nShot / 3) % 2) * 360; nShot++; sx.fillStyle = '#fff'; sx.fillRect(x, y, 640, 360);
    sx.drawImage(D.canvas, x, y, 640, 360); sx.drawImage(document.getElementById('ov'), x, y, 640, 360);
    sx.fillStyle = '#000'; sx.font = '16px Consolas'; sx.fillText(label, x + 8, y + 350); sx.strokeStyle = '#888'; sx.strokeRect(x, y, 640, 360); };
  const ONLY = new URLSearchParams(location.search).get('only');
  const run = (name, secs, mouse, pre, shots) => {
    if (ONLY && !ONLY.split(',').includes(name)) return;
    let ovAt = '', dbAt = '', offFig = 0;
    // back to the middle, heading right: the mouse point is put a little left of the goal first, then drawn right. (Not
    // "14 px towards the goal from the eye, every frame": heading away, that point lies between neck and eye, where
    // the room rightly does nothing, and the dragon flew off the screen)
    for (let i = 0; i < 260; i++) { const gx = W * 0.45 - (i < 200 ? 220 : 0) + Math.max(0, i - 200) * 0, gy = H * 0.5; T = [gx, gy]; fr([0, 0]); }
    for (let i = 0; i < 40; i++) fr([i < 30 ? 6 : 0, 0]);
    if (pre) for (let i = 0; i < pre.n; i++) fr(pre.m);
    if (name === 'infinity') Rm.dance(true);   // re-seat on the figure after the reset flight
    const tr = []; const snap = () => [Math.round(D.dg.pts[0].x), Math.round(D.dg.pts[0].y), +Rm.G.ang.toFixed(2), +Math.atan2(D.dg.pts[0].y - D.dg.pts[2].y, D.dg.pts[0].x - D.dg.pts[2].x).toFixed(2), Math.round(T[0]), Math.round(T[1])];
    if (shots) tr.push(snap());
    const vs = []; let pv = null, pn = 0, acc = 0, accN = 0, vTop = 0, accAt = '';
    let pf = null, mFace = 0, mOver = 0, mErr = 0, eSum = 0, n = 0, wSum = 0, yMax = 0, bMax = 0, dMax = 0, tailB = 0, tBack = -1; const y0 = D.dg.pts[0].y;
    for (let f = 0; f < secs * 60; f++) {
      const P = D.dg.pts, wv = D.dg.wv, old = Array.from({ length: N }, (_, i) => [wv.bx[i], wv.by[i]]), o0 = [P[0].x, P[0].y];
      const sh = shots && shots.includes(f); fr(mouse(f * dt, f), sh); if (sh) shot(`${name} +${(f / 60).toFixed(2)}s`);
      if (shots && (f < 16 || f % 6 === 0)) tr.push(snap());
      const hs = Math.hypot(P[0].x - o0[0], P[0].y - o0[1]);
      for (let i = 1; i < N; i++) { const ov = Math.hypot(wv.bx[i] - old[i][0], wv.by[i] - old[i][1]) - hs; if (ov > mOver) { mOver = ov; ovAt = `f${f} j${i} head ${hs.toFixed(1)}`; } }
      const fa = Math.atan2(P[0].y - P[2].y, P[0].x - P[2].x); if (pf != null) mFace = Math.max(mFace, Math.abs(wrap(fa - pf))); pf = fa;
      if (tBack < 0 && Math.cos(fa) < -0.95) tBack = f * dt;
      for (let i = 2; i < N; i++) { const a1 = Math.atan2(wv.by[i - 1] - wv.by[i - 2], wv.bx[i - 1] - wv.bx[i - 2]), a2 = Math.atan2(wv.by[i] - wv.by[i - 1], wv.bx[i] - wv.bx[i - 1]); const b = Math.abs(wrap(a2 - a1)); bMax = Math.max(bMax, b); if (i >= N - 20 && f >= secs * 30) tailB += b / 19 / (secs * 30); }
      { const w2 = D.dg.wv; let a = 0; for (let i = 1; i < N; i++) a += Math.hypot(P[i].x - w2.bx[i], P[i].y - w2.by[i]); if (f >= secs * 30) wSum += a / (N - 1) / (secs * 30); }
      for (let i = 2; i < N; i++) { const a1 = Math.atan2(P[i - 1].y - P[i - 2].y, P[i - 1].x - P[i - 2].x), a2 = Math.atan2(P[i].y - P[i - 1].y, P[i].x - P[i - 1].x); const b = Math.abs(wrap(a2 - a1)); if (b > dMax) { dMax = b; dbAt = `f${f} j${i} f=${[i - 2, i - 1, i].map((q) => wv.f[q].toFixed(2))} g=${[i - 1, i].map((q) => wv.g[q].toFixed(2))} off=${[i - 2, i - 1, i].map((q) => Math.hypot(P[q].x - wv.bx[q], P[q].y - wv.by[q]).toFixed(0))} seg=${[i - 1, i].map((q) => Math.hypot(wv.bx[q] - wv.bx[q - 1], wv.by[q] - wv.by[q - 1]).toFixed(0))}`; } }
      if (Rm.st.dance && f >= secs * 30) { const A = Rm.S.infA * H, cxm = (W - document.getElementById('panel').offsetWidth) / 2; let worst = 0;
        for (let i = 0; i < N; i += 3) { let b = 1e9; for (let k = 0; k < 240; k++) { const a = k / 240 * 6.2832, d = Math.hypot(cxm + A * Math.sin(a) - wv.bx[i], H / 2 + A * 0.45 * Math.sin(2 * a) - wv.by[i]); if (d < b) b = d; } if (b > worst) worst = b; }
        offFig = Math.max(offFig, worst); }
      if (f >= secs * 30) vs.push(Rm.st.v);
      { const v = Rm.st.v, nv = Math.hypot(P[0].x - o0[0], P[0].y - o0[1]) / dt / H; if (pv != null) { const a = (v - pv) / dt, an = (nv - pn) / dt; if (a > acc) { acc = a; accAt = `f${f} ${pv.toFixed(2)}->${v.toFixed(2)}`; } if (an > accN) accN = an; } pv = v; pn = nv; vTop = Math.max(vTop, v); }
      const am = Rm.st.dance ? Rm.aim() : T, er = Math.hypot(am[0] - Rm.hc.x, am[1] - Rm.hc.y); mErr = Math.max(mErr, er); eSum += er; n++; yMax = Math.max(yMax, Math.abs(P[0].y - y0));
    }
    out[name] = { faceMax: +mFace.toFixed(3), jointOver: +mOver.toFixed(1), bendMax: +bMax.toFixed(2), tailBendAvg: +tailB.toFixed(3), offFigurePx: +offFig.toFixed(0), drawnBendMax: +dMax.toFixed(2), overAt: ovAt, drawnAt: dbAt, errMaxR: +(mErr / R).toFixed(2), errAvgR: +(eSum / n / R).toFixed(2),
      errEndR: +(Math.hypot(T[0] - Rm.hc.x, T[1] - Rm.hc.y) / R).toFixed(2), sideSwingH: +(yMax / H).toFixed(2), waveOffPx: +wSum.toFixed(1), facesBackAfter: +tBack.toFixed(2) };
    { const m = vs.reduce((x, y) => x + y, 0) / Math.max(1, vs.length), sd = Math.sqrt(vs.reduce((x, y) => x + (y - m) * (y - m), 0) / Math.max(1, vs.length)); let st = 0; for (let i = 1; i < vs.length; i++) if (vs[i] < 0.3 * m && vs[i - 1] >= 0.3 * m) st++;
      Object.assign(out[name], { vMean: +m.toFixed(3), vCv: +(sd / Math.max(1e-6, m)).toFixed(2), stalls: st, lungeEye: +acc.toFixed(0), lungeNeck: +accN.toFixed(0), lungeAt: accAt, vTop: +vTop.toFixed(2), vSeq: vs.slice(0, 40).map((v) => v.toFixed(2)).join(' ') }); }
    if (shots) out[name].trace_neckXY_heading_face_mouseXY = tr.map((r) => r.join(' ')).join(' | ');
  };
  const v2 = 2 * H * dt;
  run('hover', 2, () => [0, 0]);
  run('straight', 3, () => [1.0 * H * dt, 0]);
  run('circle', 4, (t) => { const a = t * 1.2 / 0.25; return [-Math.sin(a) * 1.2 * H * dt, Math.cos(a) * 1.2 * H * dt]; });
  run('reverse2H', 1.2, () => [-v2, 0], { n: 24, m: [v2, 0] }, [4, 10, 18]);
  run('jumpBehind', 1.5, (t, f) => f === 0 ? [-(0.3 * H + 1.6 * R), 0] : [0, 0], null);
  run('zigzag', 2, (t) => [0.8 * H * dt, (Math.floor(t / 0.15) % 2 ? 1 : -1) * 3 * H * dt]);
  run('shake8Hz', 2, (t) => [(Math.floor(t * 16) % 2 ? 1 : -1) * 3 * H * dt, 0]);
  run('nudgeBack150', 1.5, (t, f) => f === 0 ? [-150, 0] : [0, 0]);
  run('nudgeSide100', 1, (t, f) => f === 0 ? [0, 100] : [0, 0]);
  // slow, careful drawing (r003: Yang drawing the figures, 'still jerky'): the eye's speed must stay steady, not stop and go
  //   vCv  spread of the eye's speed over the 2nd half / its mean;  stalls  times it dropped under 30% of the mean
  run('slowLine', 4, () => [0.2 * H * dt, 0]);
  run('slowCircle', 8, (t) => { const a = t * 0.35 / 0.17; return [-Math.sin(a) * 0.35 * H * dt, Math.cos(a) * 0.35 * H * dt]; });
  run('midCircle', 6, (t) => { const a = t * 0.7 / 0.17; return [-Math.sin(a) * 0.7 * H * dt, Math.cos(a) * 0.7 * H * dt]; });
  // 'pulling along and it suddenly shoots off' (Yang 11-18). lungeEye / lungeNeck: the most the eye's / neck's speed rose
  // in one frame, screens/s^2. A hand moves in bursts and off to the side; these do that
  run('sidePull', 2, () => [0, 0.4 * H * dt]);
  run('burstLine', 3, (t) => [(t % 0.4 < 0.2 ? 1.0 : 0.05) * H * dt, 0]);
  run('burstCircle', 6, (t) => { const a = t * 0.5 / 0.17, v = (t % 0.5 < 0.25 ? 0.9 : 0.1) * H * dt; return [-Math.sin(a) * v, Math.cos(a) * v]; });
  run('handCircle', 6, (t) => { const a = t * 0.5 / 0.17 + 0.5 * Math.sin(t * 7), v = (0.5 + 0.35 * Math.sin(t * 11)) * H * dt; return [-Math.sin(a) * v, Math.cos(a) * v]; });
  run('infinity', 12, () => [0, 0], null, [420, 540, 700]); Rm.dance(false);
  // paint (paint.js, free drawing): fly a few strokes with the pen down, the mouse point led along each a little ahead of
  // the eye; every stroke must become a mountain. bot-scene.jpg = the painting alone, bot-paint.jpg = with the dragon
  const Pt = window.__paint;
  if (Pt && (!ONLY || ONLY.split(',').includes('paint'))) {
    const ink = document.getElementById('ink'), fw = Pt.freeW(), hc = Rm.hc, pr = [];
    const go = (q) => { Rm.target(q[0], q[1]); Rm.tick(dt); dbg.step(1, { dt, noRender: true, noSnap: true }); };
    const fly = (f, speed) => {   // f(t) -> [x, y], t 0..1
      const n = 300, Lp = Array.from({ length: n + 1 }, (_, i) => f(i / n)), at = (k) => k <= n ? Lp[Math.max(0, k)] : [Lp[n][0] + (Lp[n][0] - Lp[n - 1][0]) * (k - n), Lp[n][1] + (Lp[n][1] - Lp[n - 1][1]) * (k - n)];
      const tl = Math.hypot(Lp[1][0] - Lp[0][0], Lp[1][1] - Lp[0][1]), ux = (Lp[1][0] - Lp[0][0]) / tl, uy = (Lp[1][1] - Lp[0][1]) / tl;
      const pre = [Math.max(0.03 * H, Lp[0][0] - ux * 0.25 * H), clamp01(Lp[0][1] - uy * 0.25 * H)];
      Rm.S.cap = 1.4; for (let k = 0; k < 900 && Math.hypot(pre[0] - hc.x, pre[1] - hc.y) > 0.06 * H; k++) go(pre);
      for (let k = 0; k < 600 && Math.hypot(Lp[0][0] - hc.x, Lp[0][1] - hc.y) > 0.035 * H; k++) go(at(6));
      Rm.S.cap = speed; Pt.pen(true); let s = 0, fN = 0;
      for (; fN < 60 * 25 && s < n + 12; fN++) { while (s < n + 12 && Math.hypot(at(s)[0] - hc.x, at(s)[1] - hc.y) < 0.085 * H) s++; go(at(s)); Pt.step(dt); if (s >= n && Math.hypot(Lp[n][0] - hc.x, Lp[n][1] - hc.y) < 0.03 * H) break; }
      Pt.pen(false); pr.push({ secs: +(fN / 60).toFixed(1), endOff: Math.round(Math.hypot(Lp[n][0] - hc.x, Lp[n][1] - hc.y)) });
    };
    const clamp01 = (y) => Math.max(0.05 * H, Math.min(0.95 * H, y)), cap0 = Rm.S.cap;
    Pt.reset();
    // ?fold=1: the folded stroke Yang drew in r006 (a C, a hook, a peak over it), laid down as recorded, alone
    const FOLD = [[0.6737,0.8322,0],[0.6808,0.8322,0.32],[0.6925,0.8298,0.59],[0.7089,0.8263,0.79],[0.7254,0.8181,0.83],[0.7394,0.8087,0.85],[0.7523,0.7958,0.86],[0.7629,0.7805,0.89],[0.7723,0.7641,0.94],[0.7782,0.7465,0.84],[0.7793,0.7383,0.45],[0.7817,0.7312,0.3],[0.7852,0.7277,0.23],[0.7887,0.7254,0.22],[0.7923,0.7242,0.2],[0.7958,0.723,0.17],[0.7993,0.7218,0.2],[0.8063,0.7207,0.17],[0.8099,0.7195,0.17],[0.8134,0.7183,0.21],[0.8192,0.716,0.25],[0.8251,0.7136,0.35],[0.8322,0.7101,0.36],[0.838,0.7066,0.35],[0.8451,0.7019,0.37],[0.8509,0.6995,0.34],[0.8568,0.696,0.33],[0.8627,0.6913,0.32],[0.8685,0.6878,0.33],[0.8732,0.6843,0.31],[0.8791,0.6796,0.32],[0.8838,0.6749,0.32],[0.8885,0.6714,0.31],[0.8932,0.6655,0.35],[0.8991,0.6608,0.33],[0.9038,0.6561,0.34],[0.9085,0.6502,0.35],[0.9131,0.6444,0.38],[0.9178,0.6373,0.39],[0.9225,0.6303,0.42],[0.9272,0.6232,0.39],[0.9319,0.6162,0.42],[0.9366,0.608,0.46],[0.9413,0.5998,0.44],[0.946,0.5915,0.45],[0.9495,0.5833,0.44],[0.9531,0.5751,0.44],[0.9566,0.5669,0.42],[0.9601,0.5563,0.5],[0.9624,0.5469,0.51],[0.966,0.5352,0.55],[0.9683,0.5246,0.53],[0.9707,0.5129,0.58],[0.973,0.5012,0.6],[0.9742,0.4883,0.61],[0.9742,0.4742,0.66],[0.9742,0.4613,0.64],[0.973,0.446,0.72],[0.9707,0.4319,0.7],[0.9683,0.4167,0.75],[0.966,0.4026,0.68],[0.9624,0.3873,0.71],[0.9589,0.3756,0.63],[0.9554,0.3638,0.6],[0.9507,0.3521,0.58],[0.946,0.3427,0.52],[0.9413,0.3333,0.49],[0.9366,0.3251,0.45],[0.9308,0.3169,0.45],[0.9261,0.3099,0.43],[0.9214,0.3028,0.4],[0.9167,0.2946,0.42],[0.912,0.2876,0.43],[0.9061,0.2805,0.43],[0.9014,0.2746,0.37],[0.8967,0.27,0.33],[0.8932,0.2653,0.3],[0.8885,0.2606,0.31],[0.885,0.257,0.24],[0.8803,0.2535,0.24],[0.8768,0.2512,0.24],[0.8721,0.2488,0.27],[0.865,0.2453,0.34],[0.8592,0.243,0.34],[0.8509,0.2406,0.42],[0.8427,0.2383,0.4],[0.8333,0.2371,0.44],[0.8239,0.2347,0.48],[0.8134,0.2347,0.47],[0.804,0.2347,0.46],[0.7958,0.2347,0.41],[0.7876,0.2347,0.4],[0.7793,0.2347,0.37],[0.7723,0.2347,0.35],[0.7653,0.2359,0.32],[0.7594,0.2359,0.3],[0.7523,0.2359,0.29],[0.7465,0.2371,0.13],[0.743,0.2359,0.01],[0.7406,0.2289,0.28],[0.7394,0.2195,0.42],[0.7383,0.2066,0.66],[0.7406,0.189,0.81],[0.7406,0.1831,0.29],[0.7394,0.1796,0.06],[0.7394,0.1737,0.26],[0.7441,0.1631,0.51],[0.75,0.1502,0.7],[0.7594,0.135,0.87],[0.7723,0.1185,1.01],[0.7887,0.1009,1.14],[0.8099,0.0857,1.28],[0.8369,0.0728,1.43],[0.8697,0.0657,1.59],[0.9061,0.0657,1.78],[0.946,0.0775,1.97],[0.9824,0.1033,2.16],[1.0129,0.1362,2.15],[1.0411,0.1667,2],[1.0587,0.189,1.35],[1.0716,0.2031,0.93],[1.0857,0.2101,0.74],[1.0962,0.2171,0.62],[1.1068,0.223,0.56],[1.115,0.2289,0.53],[1.1244,0.2359,0.54],[1.1338,0.2418,0.53],[1.142,0.2488,0.53],[1.1514,0.257,0.56],[1.1596,0.2641,0.56],[1.1678,0.2735,0.58],[1.1761,0.2829,0.61],[1.1831,0.2934,0.61],[1.1913,0.304,0.65],[1.1995,0.3157,0.67],[1.2066,0.3275,0.69],[1.2136,0.3415,0.73],[1.2207,0.3556,0.75],[1.2277,0.3697,0.78],[1.2336,0.385,0.75],[1.2383,0.3979,0.71],[1.243,0.412,0.7],[1.2477,0.4249,0.65],[1.2523,0.4366,0.59],[1.2559,0.4484,0.6],[1.2606,0.4601,0.62],[1.2641,0.473,0.63],[1.2676,0.4847,0.61],[1.2711,0.4977,0.65],[1.2758,0.5117,0.71],[1.2793,0.5258,0.68],[1.284,0.5387,0.65],[1.2876,0.5516,0.67],[1.2923,0.5657,0.72],[1.2969,0.581,0.77],[1.3028,0.5962,0.77],[1.3075,0.6115,0.74],[1.3122,0.6268,0.79],[1.3181,0.6432,0.8],[1.3216,0.6573,0.75],[1.3263,0.6725,0.74],[1.3322,0.6866,0.73],[1.3369,0.7019,0.75],[1.3415,0.7183,0.84],[1.3474,0.7347,0.84]];
    // ?r7=1: four overlapping mountains about as Yang drew them in r007 (near bodies over far ones, 120% display)
    const R7 = [[[0.0,0.3873,0.8],[0.0005,0.3866,0.8],[0.0014,0.3853,0.8],[0.0028,0.3832,0.8],[0.0046,0.3804,0.8],[0.0069,0.377,0.8],[0.0096,0.3729,0.8],[0.0128,0.3681,0.8],[0.0165,0.3626,0.8],[0.0206,0.3564,0.8],[0.0252,0.3495,0.8],[0.0303,0.3419,0.8],[0.0358,0.3337,0.8],[0.0417,0.3247,0.8],[0.0481,0.3151,0.8],[0.055,0.3048,0.8],[0.0624,0.2938,0.8],[0.0698,0.284,0.8],[0.0774,0.2755,0.8],[0.0852,0.2682,0.8],[0.0931,0.2622,0.8],[0.1011,0.2573,0.8],[0.1093,0.2538,0.8],[0.1176,0.2514,0.8],[0.126,0.2503,0.8],[0.1346,0.2505,0.8],[0.1433,0.2518,0.8],[0.1521,0.2545,0.8],[0.1611,0.2583,0.8],[0.1702,0.2634,0.8],[0.1795,0.2697,0.8],[0.1889,0.2773,0.8],[0.1984,0.2861,0.8],[0.208,0.2949,0.8],[0.2175,0.3036,0.8],[0.227,0.3124,0.8],[0.2366,0.3211,0.8],[0.2461,0.3298,0.8],[0.2556,0.3384,0.8],[0.2652,0.3471,0.8],[0.2747,0.3557,0.8],[0.2843,0.3643,0.8],[0.2938,0.3729,0.8],[0.3033,0.3814,0.8],[0.3129,0.3899,0.8],[0.3224,0.3984,0.8],[0.3319,0.4069,0.8],[0.3415,0.4154,0.8],[0.351,0.4238,0.8],[0.3609,0.4311,0.8],[0.371,0.4371,0.8],[0.3815,0.442,0.8],[0.3924,0.4456,0.8],[0.4035,0.4481,0.8],[0.415,0.4494,0.8],[0.4268,0.4495,0.8],[0.4389,0.4484,0.8],[0.4513,0.4461,0.8],[0.464,0.4426,0.8],[0.4771,0.4379,0.8],[0.4905,0.4321,0.8],[0.5042,0.425,0.8],[0.5182,0.4168,0.8],[0.5326,0.4073,0.8],[0.5472,0.3967,0.8],[0.5618,0.3861,0.8],[0.5762,0.3755,0.8],[0.5906,0.3649,0.8],[0.6048,0.3544,0.8],[0.6189,0.3438,0.8],[0.6329,0.3333,0.8],[0.6467,0.3229,0.8],[0.6605,0.3124,0.8],[0.6741,0.302,0.8],[0.6877,0.2916,0.8],[0.7011,0.2812,0.8],[0.7144,0.2708,0.8],[0.7275,0.2605,0.8],[0.7406,0.2502,0.8],[0.7536,0.2399,0.8],[0.7664,0.2296,0.8],[0.779,0.2207,0.8],[0.7912,0.2132,0.8],[0.8033,0.207,0.8],[0.815,0.2023,0.8],[0.8265,0.1989,0.8],[0.8376,0.1969,0.8],[0.8486,0.1962,0.8],[0.8592,0.197,0.8],[0.8696,0.1991,0.8],[0.8796,0.2026,0.8],[0.8895,0.2074,0.8],[0.899,0.2137,0.8],[0.9082,0.2213,0.8],[0.9172,0.2302,0.8],[0.9259,0.2406,0.8],[0.9344,0.2523,0.8],[0.943,0.2639,0.8],[0.9517,0.2751,0.8],[0.9607,0.2862,0.8],[0.9697,0.297,0.8],[0.979,0.3076,0.8],[0.9884,0.318,0.8],[0.9979,0.3281,0.8],[1.0076,0.338,0.8],[1.0175,0.3477,0.8],[1.0276,0.3571,0.8],[1.0378,0.3663,0.8],[1.0481,0.3753,0.8],[1.0587,0.3841,0.8],[1.0693,0.3926,0.8],[1.0802,0.4009,0.8],[1.0912,0.409,0.8],[1.1015,0.4165,0.8],[1.1111,0.4236,0.8],[1.1201,0.4301,0.8],[1.1283,0.4362,0.8],[1.1359,0.4417,0.8],[1.1428,0.4468,0.8],[1.149,0.4513,0.8],[1.1545,0.4554,0.8],[1.1593,0.4589,0.8],[1.1634,0.4619,0.8],[1.1668,0.4644,0.8],[1.1696,0.4665,0.8],[1.1716,0.468,0.8],[1.173,0.469,0.8],[1.1737,0.4695,0.8]],[[0.6573,0.3873,0.8],[0.6579,0.387,0.8],[0.6592,0.3862,0.8],[0.6611,0.3851,0.8],[0.6637,0.3837,0.8],[0.6669,0.3818,0.8],[0.6708,0.3796,0.8],[0.6752,0.3771,0.8],[0.6804,0.3741,0.8],[0.6862,0.3708,0.8],[0.6926,0.3672,0.8],[0.6996,0.3631,0.8],[0.7073,0.3587,0.8],[0.7157,0.3539,0.8],[0.7247,0.3488,0.8],[0.7343,0.3433,0.8],[0.7446,0.3374,0.8],[0.7551,0.3317,0.8],[0.7659,0.3261,0.8],[0.777,0.3207,0.8],[0.7884,0.3153,0.8],[0.8,0.3102,0.8],[0.812,0.3051,0.8],[0.8242,0.3002,0.8],[0.8366,0.2954,0.8],[0.8494,0.2908,0.8],[0.8624,0.2863,0.8],[0.8757,0.282,0.8],[0.8893,0.2777,0.8],[0.9031,0.2737,0.8],[0.9172,0.2697,0.8],[0.9316,0.2659,0.8],[0.9463,0.2623,0.8],[0.9607,0.2594,0.8],[0.975,0.2574,0.8],[0.9889,0.2562,0.8],[1.0027,0.2558,0.8],[1.0162,0.2563,0.8],[1.0295,0.2576,0.8],[1.0426,0.2597,0.8],[1.0554,0.2626,0.8],[1.068,0.2664,0.8],[1.0804,0.271,0.8],[1.0926,0.2764,0.8],[1.1045,0.2826,0.8],[1.1162,0.2897,0.8],[1.1276,0.2976,0.8],[1.1389,0.3063,0.8],[1.1499,0.3158,0.8],[1.1611,0.3254,0.8],[1.1726,0.335,0.8],[1.1843,0.3447,0.8],[1.1962,0.3544,0.8],[1.2083,0.3642,0.8],[1.2207,0.374,0.8],[1.2333,0.3838,0.8],[1.2461,0.3937,0.8],[1.2592,0.4037,0.8],[1.2725,0.4137,0.8],[1.286,0.4237,0.8],[1.2998,0.4338,0.8],[1.3138,0.4439,0.8],[1.328,0.4541,0.8],[1.3424,0.4643,0.8],[1.3571,0.4746,0.8],[1.3709,0.4842,0.8],[1.3837,0.4932,0.8],[1.3956,0.5016,0.8],[1.4066,0.5093,0.8],[1.4167,0.5163,0.8],[1.4259,0.5228,0.8],[1.4341,0.5285,0.8],[1.4415,0.5337,0.8],[1.4479,0.5382,0.8],[1.4534,0.542,0.8],[1.458,0.5452,0.8],[1.4616,0.5478,0.8],[1.4644,0.5497,0.8],[1.4662,0.551,0.8],[1.4671,0.5516,0.8]],[[0.2054,0.7042,0.8],[0.206,0.7041,0.8],[0.2071,0.7038,0.8],[0.2088,0.7034,0.8],[0.2111,0.7028,0.8],[0.214,0.7022,0.8],[0.2174,0.7013,0.8],[0.2214,0.7004,0.8],[0.226,0.6993,0.8],[0.2312,0.698,0.8],[0.2369,0.6967,0.8],[0.2432,0.6951,0.8],[0.2501,0.6935,0.8],[0.2576,0.6917,0.8],[0.2656,0.6898,0.8],[0.2742,0.6877,0.8],[0.2833,0.6855,0.8],[0.2925,0.6834,0.8],[0.3017,0.6813,0.8],[0.311,0.6792,0.8],[0.3202,0.6772,0.8],[0.3295,0.6752,0.8],[0.3388,0.6733,0.8],[0.3482,0.6714,0.8],[0.3575,0.6696,0.8],[0.3669,0.6678,0.8],[0.3763,0.666,0.8],[0.3857,0.6643,0.8],[0.3952,0.6627,0.8],[0.4046,0.6611,0.8],[0.4141,0.6595,0.8],[0.4236,0.658,0.8],[0.4332,0.6565,0.8],[0.4429,0.6544,0.8],[0.4528,0.6515,0.8],[0.4629,0.648,0.8],[0.4732,0.6438,0.8],[0.4836,0.6389,0.8],[0.4942,0.6333,0.8],[0.5051,0.627,0.8],[0.5161,0.62,0.8],[0.5273,0.6124,0.8],[0.5386,0.604,0.8],[0.5502,0.595,0.8],[0.5619,0.5853,0.8],[0.5738,0.5749,0.8],[0.5859,0.5638,0.8],[0.5982,0.552,0.8],[0.6107,0.5395,0.8],[0.623,0.5271,0.8],[0.635,0.5146,0.8],[0.6469,0.5021,0.8],[0.6585,0.4896,0.8],[0.67,0.477,0.8],[0.6812,0.4645,0.8],[0.6922,0.452,0.8],[0.703,0.4394,0.8],[0.7136,0.4269,0.8],[0.7241,0.4143,0.8],[0.7343,0.4018,0.8],[0.7443,0.3892,0.8],[0.754,0.3766,0.8],[0.7636,0.364,0.8],[0.773,0.3514,0.8],[0.7822,0.3388,0.8],[0.7911,0.3271,0.8],[0.7997,0.3165,0.8],[0.808,0.3068,0.8],[0.8161,0.2981,0.8],[0.8239,0.2904,0.8],[0.8314,0.2837,0.8],[0.8387,0.2779,0.8],[0.8456,0.2731,0.8],[0.8523,0.2694,0.8],[0.8587,0.2666,0.8],[0.8649,0.2647,0.8],[0.8707,0.2639,0.8],[0.8763,0.264,0.8],[0.8817,0.2651,0.8],[0.8867,0.2672,0.8],[0.8915,0.2703,0.8],[0.8962,0.2734,0.8],[0.9009,0.2765,0.8],[0.9056,0.2796,0.8],[0.9103,0.2826,0.8],[0.915,0.2857,0.8],[0.9196,0.2888,0.8],[0.9242,0.2919,0.8],[0.9288,0.295,0.8],[0.9334,0.298,0.8],[0.9379,0.3011,0.8],[0.9424,0.3042,0.8],[0.9469,0.3073,0.8],[0.9514,0.3104,0.8],[0.9558,0.3135,0.8],[0.9602,0.3165,0.8],[0.9646,0.3196,0.8],[0.9688,0.3225,0.8],[0.9726,0.3252,0.8],[0.9762,0.3277,0.8],[0.9795,0.33,0.8],[0.9825,0.3321,0.8],[0.9853,0.3341,0.8],[0.9877,0.3358,0.8],[0.99,0.3373,0.8],[0.9919,0.3387,0.8],[0.9935,0.3398,0.8],[0.9949,0.3408,0.8],[0.996,0.3416,0.8],[0.9968,0.3421,0.8],[0.9974,0.3425,0.8],[0.9977,0.3427,0.8]],[[0.9495,0.3439,0.8],[0.9503,0.3435,0.8],[0.9519,0.3427,0.8],[0.9543,0.3415,0.8],[0.9575,0.34,0.8],[0.9614,0.338,0.8],[0.9662,0.3356,0.8],[0.9717,0.3329,0.8],[0.9781,0.3297,0.8],[0.9852,0.3262,0.8],[0.9932,0.3222,0.8],[1.0019,0.3179,0.8],[1.0114,0.3131,0.8],[1.0217,0.308,0.8],[1.0328,0.3025,0.8],[1.0447,0.2966,0.8],[1.0574,0.2903,0.8],[1.07,0.2839,0.8],[1.0826,0.2776,0.8],[1.0951,0.2712,0.8],[1.1076,0.2647,0.8],[1.12,0.2582,0.8],[1.1323,0.2517,0.8],[1.1446,0.2452,0.8],[1.1568,0.2386,0.8],[1.1689,0.2321,0.8],[1.181,0.2254,0.8],[1.1931,0.2188,0.8],[1.205,0.2121,0.8],[1.217,0.2053,0.8],[1.2288,0.1986,0.8],[1.2406,0.1918,0.8],[1.2523,0.185,0.8],[1.2637,0.1783,0.8],[1.2747,0.1719,0.8],[1.2853,0.1656,0.8],[1.2956,0.1596,0.8],[1.3055,0.1537,0.8],[1.315,0.148,0.8],[1.3241,0.1425,0.8],[1.3329,0.1372,0.8],[1.3413,0.132,0.8],[1.3493,0.1271,0.8],[1.3569,0.1223,0.8],[1.3642,0.1178,0.8],[1.3711,0.1134,0.8],[1.3777,0.1092,0.8],[1.3838,0.1052,0.8],[1.3896,0.1014,0.8],[1.3954,0.098,0.8],[1.401,0.0951,0.8],[1.4066,0.0927,0.8],[1.4122,0.0908,0.8],[1.4176,0.0893,0.8],[1.4231,0.0882,0.8],[1.4284,0.0876,0.8],[1.4337,0.0875,0.8],[1.4389,0.0879,0.8],[1.4441,0.0887,0.8],[1.4491,0.09,0.8],[1.4542,0.0917,0.8],[1.4591,0.0939,0.8],[1.464,0.0966,0.8],[1.4689,0.0997,0.8],[1.4736,0.1033,0.8],[1.4788,0.1077,0.8],[1.4845,0.113,0.8],[1.4906,0.1191,0.8],[1.4971,0.126,0.8],[1.5041,0.1337,0.8],[1.5116,0.1422,0.8],[1.5195,0.1516,0.8],[1.5278,0.1618,0.8],[1.5366,0.1728,0.8],[1.5458,0.1847,0.8],[1.5554,0.1973,0.8],[1.5655,0.2108,0.8],[1.5761,0.2252,0.8],[1.5871,0.2403,0.8],[1.5985,0.2563,0.8],[1.6104,0.2731,0.8],[1.6222,0.2902,0.8],[1.6341,0.3076,0.8],[1.6458,0.3253,0.8],[1.6576,0.3433,0.8],[1.6693,0.3617,0.8],[1.6809,0.3803,0.8],[1.6926,0.3993,0.8],[1.7042,0.4185,0.8],[1.7157,0.4381,0.8],[1.7272,0.458,0.8],[1.7387,0.4781,0.8],[1.7501,0.4986,0.8],[1.7616,0.5194,0.8],[1.7729,0.5405,0.8],[1.7843,0.5619,0.8],[1.7956,0.5836,0.8],[1.8061,0.604,0.8],[1.816,0.623,0.8],[1.8252,0.6406,0.8],[1.8337,0.6569,0.8],[1.8414,0.6718,0.8],[1.8485,0.6854,0.8],[1.8549,0.6976,0.8],[1.8605,0.7085,0.8],[1.8655,0.718,0.8],[1.8697,0.7261,0.8],[1.8732,0.7329,0.8],[1.876,0.7383,0.8],[1.8782,0.7424,0.8],[1.8796,0.7451,0.8],[1.8803,0.7465,0.8]]];
    if (new URLSearchParams(location.search).has('fold')) Pt.st.done.push({ stroke: FOLD.map((q) => [q[0] * H, q[1] * H, q[2]]), t0: D.T, seed: 20061 });
    else if (new URLSearchParams(location.search).get('fix')) {   // ?fix=r008: strokes of an F8 report (tools/rep2fix.py), laid down as recorded
      const xr = new XMLHttpRequest(); xr.open('GET', 'fixtures/' + new URLSearchParams(location.search).get('fix') + '.json', false); xr.send();
      JSON.parse(xr.responseText).forEach((s7, i7) => Pt.st.done.push({ kind: new URLSearchParams(location.search).get('kind') || undefined, stroke: s7.map((q) => [q[0] * H, q[1] * H, q[2]]), t0: D.T, seed: 8001 + i7 })); }   // &kind=tree: laid down as that kind of stroke
    else if (new URLSearchParams(location.search).has('r7')) R7.forEach((s7, i7) => Pt.st.done.push({ stroke: s7.map((q) => [q[0] * H, q[1] * H, q[2]]), t0: D.T, seed: 7001 + i7 }));
    else {
    fly((t) => [fw * (0.1 + 0.62 * t), H * (0.34 - 0.09 * Math.sin(t * 9.42) - 0.02 * Math.sin(t * 21))], 0.7);                 // far range, three tops
    fly((t) => [fw * (0.36 + 0.6 * t), H * (0.66 - 0.24 * Math.sin(t * 3.1416) - 0.06 * Math.sin(t * 9.42))], 0.6);              // near, one big mountain with shoulders
    fly((t) => [fw * (0.04 + 0.42 * t), H * (0.82 - 0.09 * Math.sin(t * 6.2832) * (t < 0.5 ? 1 : 0.4) - 0.03 * t)], 1.5);          // low hills in front, flown fast (dry)
    fly((t) => [fw * (0.62 + 0.3 * t), H * (0.9 - 0.75 * Math.sin(t * 3.1416))], 2.0);   // a tall steep peak flown fast, as Yang drew in r005 (steep sides broke the ribbon)
    fly((t) => [fw * (0.9 + 0.03 * Math.sin(t * 5)), H * (0.75 - 0.4 * t)], 1.2);   // a nearly upright stroke
    }
    // ?river=1 (with r7): a river coming down the paper in widening bends, across the body of the near mountain
    // ?hills=1: low gentle strokes, far to near (washed hills), one of them steep enough to stay a peak
    if (new URLSearchParams(location.search).has('hills')) [[0.05, 0.9, 0.3, 0.05, 1.1], [0.7, 1.75, 0.36, 0.07, 2.3], [0.0, 1.0, 0.5, 0.08, 0.4], [0.5, 1.7, 0.62, 0.1, 3.1], [0.1, 0.75, 0.78, 0.07, 1.9], [1.2, 1.6, 0.6, 0.22, 0]].forEach(([x0, x1, y, a, ph], i) =>
      Pt.st.done.push({ stroke: Array.from({ length: 120 }, (_, k) => { const t = k / 119; return [(x0 + (x1 - x0) * t) * H, (y - a * Math.sin(3.1416 * t) * (0.75 + 0.25 * Math.sin(t * 9 + ph))) * H, 0.8]; }), t0: D.T, seed: 9301 + i }));
    // ?crag=1: flat-topped crags, flown up, across and down (far, pale one; two near ones), and a peak beside them
    if (new URLSearchParams(location.search).has('crag')) [[0.95, 1.5, 0.22, 0.6, 0], [0.1, 0.75, 0.3, 0.8, 1], [0.85, 1.35, 0.42, 0.85, 2]].forEach(([x0, x1, yt, yb, ph], i) =>
      Pt.st.done.push({ stroke: Array.from({ length: 160 }, (_, k) => { const t = k / 159, e = Math.min(1, Math.min(t, 1 - t) / 0.17), u = e * e * (3 - 2 * e); return [(x0 + (x1 - x0) * (0.06 * (3 * t * t - 2 * t * t * t) + 0.94 * t)) * H, (yb - (yb - yt) * u * (0.9 + 0.1 * Math.sin(t * 13 + ph))) * H, 0.8]; }), t0: D.T, seed: 9401 + i }));
    if (new URLSearchParams(location.search).has('river')) Pt.st.done.push({ kind: 'river', stroke: Array.from({ length: 140 }, (_, i) => { const t = i / 139; return [(0.72 + 0.3 * Math.sin(t * 7.2) * (0.25 + 0.75 * t)) * H, (0.5 + 0.46 * t) * H, 0.8]; }), t0: D.T, seed: 9001 });
    // ?lake=1 (with r7): a loop flown round, left a little open, low on the paper before the big mountain.
    // lake=2: only a little over half the loop flown (a wide gap). lake=3: flown past its own start (an overlap)
    if (new URLSearchParams(location.search).has('lake')) Pt.st.done.push({ kind: 'lake', stroke: Array.from({ length: 150 }, (_, i) => { const t = i / 149 * ({ 2: 3.8, 3: 7.1 }[new URLSearchParams(location.search).get('lake')] || 5.9); return [(1.22 + 0.3 * Math.cos(t)) * H, (0.8 + 0.15 * Math.sin(t)) * H, 0.8]; }), t0: D.T, seed: 9101 });
    // ?tree=1 (with r7): trees of several sizes (even seed = pine, odd = broadleaf), a bush, and grass along the ground
    // ?branch=1 (with r7): a long level stroke high on the paper, from the left edge = a plum branch seen close, in flower
    if (new URLSearchParams(location.search).has('branch')) Pt.st.done.push({ kind: 'tree', stroke: Array.from({ length: 90 }, (_, i) => { const t = i / 89; return [(0.03 + 1.05 * t) * H, (0.3 + 0.05 * Math.sin(t * 3.4) - 0.07 * t) * H, 0.6]; }), t0: D.T, seed: 9101 });
    if (new URLSearchParams(location.search).has('tree')) { const tr = (x, y, len, lean, seed) => Pt.st.done.push({ kind: 'tree', stroke: Array.from({ length: 60 }, (_, i) => { const t = i / 59; return [(x + lean * t * t * len + 0.03 * len * Math.sin(t * 5)) * H, (y - len * t) * H, 0.6]; }), t0: D.T, seed });
      tr(0.22, 0.95, 0.5, 0.3, 9200); tr(0.55, 0.93, 0.36, -0.25, 9201); tr(1.0, 0.6, 0.14, 0.1, 9202); tr(1.12, 0.6, 0.1, -0.1, 9203); tr(1.55, 0.96, 0.42, 0.15, 9203); tr(1.3, 0.94, 0.26, -0.3, 9204); tr(0.8, 0.95, 0.08, 0, 9205);
      const gr = (x0, x1, y, seed) => Pt.st.done.push({ kind: 'grass', stroke: Array.from({ length: 80 }, (_, i) => { const t = i / 79; return [(x0 + (x1 - x0) * t) * H, (y + 0.012 * Math.sin(t * 9)) * H, 0.6]; }), t0: D.T, seed });
      gr(0.05, 0.75, 0.955, 9300); gr(1.2, 1.7, 0.965, 9301); gr(0.9, 1.25, 0.61, 9302); }
    Rm.S.cap = cap0;
    const snap =() => { const m = document.createElement('canvas'); m.width = 1280; m.height = 720; const x = m.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 1280, 720);
      x.drawImage(D.canvas, 0, 0, 1280, 720); x.globalCompositeOperation = 'multiply'; x.drawImage(ink, 0, 0, 1280, 720); x.globalCompositeOperation = 'source-over'; x.drawImage(document.getElementById('ov'), 0, 0, 1280, 720); return m.toDataURL('image/jpeg', 0.88); };
    for (let k = 0; k < 320; k++) { Rm.tick(dt); dbg.step(1, { dt, noRender: k !== 319 && k !== 30, noSnap: true }); if (k === 30) { Rm.G.draw(0); post('bot-paint-mid.jpg', snap()); } }   // the last stroke's ink runs down (1.6 s)
    const t0 = performance.now(); Rm.G.draw(0); const bakeMs = +(performance.now() - t0).toFixed(1);
    out.paint = { ...Pt.info(), flown: pr, bakeMs };
    post('bot-paint.jpg', snap());
    { const m = document.createElement('canvas'); m.width = 1920; m.height = 1080; const x = m.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 1920, 1080); x.globalCompositeOperation = 'multiply'; x.drawImage(ink, 0, 0, 1920, 1080);
      post('bot-scene.jpg', m.toDataURL('image/jpeg', 0.92));
      // the same two seconds on: what moves (a river's current) shows as the difference between the two
      // (bot-flow-1..6.jpg: every third of a second on the way there, to follow a line of current by eye)
      for (let s = 1; s <= 6; s++) { for (let k = 0; k < 20; k++) { Rm.tick(dt); dbg.step(1, { dt, noRender: k !== 19, noSnap: true }); } Rm.G.draw(0);
        x.globalCompositeOperation = 'source-over'; x.fillRect(0, 0, 1920, 1080); x.globalCompositeOperation = 'multiply'; x.drawImage(ink, 0, 0, 1920, 1080); post(s < 6 ? `bot-flow-${s}.jpg` : 'bot-scene2.jpg', m.toDataURL('image/jpeg', 0.92)); } }
  }
  post('bot-uturn.jpg', strip.toDataURL('image/jpeg', 0.85)).then(() => post('bot.json', json(out)));
})();
