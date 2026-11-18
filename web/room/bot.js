// Room self-test (tools/roomtest.py, page opened with ?bot=1): flies scripted mouse paths through the real room code,
// one fixed 1/60 s frame at a time, and posts the numbers (reports/bot.json) and a strip of U-turn frames (bot-uturn.jpg).
// What it guards: a sudden reversal must not jerk the head or swing the body (Yang 11-18).
//   faceMax   most the drawn facing (joint 2 -> neck) turned in one frame, rad      (old controller: 1.2 and up)
//   jointOver most any plain joint moved in a frame beyond what the neck moved, px   (a whipped body shows here)
//   waveOff   mean sideways push of the body wave over the 2nd half of the run, px: full flying straight, ~0 in a circle
//   drawnBendMax  sharpest joint of the spine as drawn (plain + wave), rad: a zigzag tail shows here
//   tailBendAvg   mean bend of the plain spine's last 20 joints over the 2nd half, rad a joint: a tail wound into a ring sits at the bend limit
//   err*      held point (eye) to mouse point, body radii
(() => {
  const D = window.__dragon, Rm = window.__room, dbg = window.__dragonDebug;
  const post = (name, url) => fetch('/report', { method: 'POST', body: name + '|' + url });
  const json = (o) => 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1))));
  if (!D || !Rm) { post('bot.json', json({ error: 'no WebGL / room' })); return; }
  Rm.st.paused = true;
  Object.assign(Rm.S, { cap: 2.5, follow: 30, leash: 0.35, sens: 1, turn: 16, hold: 1.6, rho: 1.8 }, JSON.parse(new URLSearchParams(location.search).get('set') || '{}'));
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
    let ovAt = '', dbAt = '';
    // back to the middle, heading right: the mouse point is put a little left of the goal first, then drawn right. (Not
    // "14 px towards the goal from the eye, every frame": heading away, that point lies between neck and eye, where
    // the room rightly does nothing, and the dragon flew off the screen)
    for (let i = 0; i < 260; i++) { const gx = W * 0.45 - (i < 200 ? 220 : 0) + Math.max(0, i - 200) * 0, gy = H * 0.5; T = [gx, gy]; fr([0, 0]); }
    for (let i = 0; i < 40; i++) fr([i < 30 ? 6 : 0, 0]);
    if (pre) for (let i = 0; i < pre.n; i++) fr(pre.m);
    if (name === 'infinity') Rm.dance(true);   // re-seat on the figure after the reset flight
    const tr = []; const snap = () => [Math.round(D.dg.pts[0].x), Math.round(D.dg.pts[0].y), +Rm.G.ang.toFixed(2), +Math.atan2(D.dg.pts[0].y - D.dg.pts[2].y, D.dg.pts[0].x - D.dg.pts[2].x).toFixed(2), Math.round(T[0]), Math.round(T[1])];
    if (shots) tr.push(snap());
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
      const am = Rm.st.dance ? Rm.aim() : T, er = Math.hypot(am[0] - Rm.hc.x, am[1] - Rm.hc.y); mErr = Math.max(mErr, er); eSum += er; n++; yMax = Math.max(yMax, Math.abs(P[0].y - y0));
    }
    out[name] = { faceMax: +mFace.toFixed(3), jointOver: +mOver.toFixed(1), bendMax: +bMax.toFixed(2), tailBendAvg: +tailB.toFixed(3), drawnBendMax: +dMax.toFixed(2), overAt: ovAt, drawnAt: dbAt, errMaxR: +(mErr / R).toFixed(2), errAvgR: +(eSum / n / R).toFixed(2),
      errEndR: +(Math.hypot(T[0] - Rm.hc.x, T[1] - Rm.hc.y) / R).toFixed(2), sideSwingH: +(yMax / H).toFixed(2), waveOffPx: +wSum.toFixed(1), facesBackAfter: +tBack.toFixed(2) };
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
  run('infinity', 8, () => [0, 0], null, [200, 300, 420]); Rm.dance(false);
  post('bot-uturn.jpg', strip.toDataURL('image/jpeg', 0.85)).then(() => post('bot.json', json(out)));
})();
