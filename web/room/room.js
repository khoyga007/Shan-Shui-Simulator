// InkDragon test room: a blank white room, the wallpaper's dragon (dragon.js, a synced copy, see tools/sync-dragon.sh),
// the head carried by the mouse, and the dev tools to look at it. No skills, no enemies: controls first (Yang 2026-11-18).
// Everything here sits outside the dragon: it only sets the head's place through __dragon.game() and reads joints back.
(() => {
  const D = window.__dragon;
  if (!D) { document.getElementById('hint').textContent = 'Không khởi động được WebGL'; return; }
  const $ = (id) => document.getElementById(id);
  const ov = $('ov'), c = ov.getContext('2d'), panel = $('panel'), hint = $('hint'), toast = $('toast');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---- settings (kept between runs) -------------------------------------------------------
  const DEF = {
    cap: 2.5,      // head speed limit, screen heights per second
    follow: 30,    // how hard the head closes on the mouse point, 1/s; 60 = glued
    leash: 0.35,   // how far the mouse point may run ahead of the head, screen heights
    sens: 1,       // mouse sensitivity
    turn: 16,      // how fast the head comes about, rad/s (a full U-turn at 16: 0.2 s)
    rho: 1.8,      // turning circle of the neck, body radii; the spine's bend limit is set to match it
    hold: 1.6,     // where on the head the mouse holds it, body radii ahead of the neck joint: 0 = neck (pts[0]), 1.6 = the eye
    waveAmp: D.WAVE.amp, waveLen: D.WAVE.len,
    track: 1,      // 1: the body lies on the track the head flew (no corner cutting, no curled tail); 0: follow-the-leader chain
    waveTurn: 0,   // how much of the body wave is kept where the body is turning: 0 = a clean arc, 1 = wriggles all the way round
    infV: 1.2,     // infinity dance: speed along the figure, screen heights per second
    infA: 0.4,     // its half width, screen heights (height of a lobe = 0.45 of that). The figure is 5.8 x this long and
                   // the body 2.25 screens: at 0.39 the dragon just bites its tail, at 0.5 it covers 78% of the 8
    L: { spine: true, base: false, body: false, hit: true, trail: true, vel: true, aim: true, grid: false, text: true },
  };
  const SL = [   // key, label, min, max, step
    ['cap', 'Trần tốc độ (màn/giây)', 0.3, 8, 0.1],
    ['follow', 'Độ bám chuột (60 = dính)', 3, 60, 1],
    ['leash', 'Dây chuột (màn)', 0.05, 1.5, 0.05],
    ['sens', 'Độ nhạy chuột', 0.3, 3, 0.05],
    ['turn', 'Tốc độ quay đầu (rad/s)', 4, 30, 1],
    ['rho', 'Bán kính vòng cua (thân)', 0.8, 4, 0.1],
    ['hold', 'Điểm cầm (0 gáy · 1.6 mắt)', 0, 3, 0.1],
    ['track', 'Thân bám vệt đầu (0 tắt · 1 bật)', 0, 1, 1],
    ['waveAmp', 'Sóng thân: biên độ', 0, 3, 0.1],
    ['waveLen', 'Sóng thân: bước sóng (đốt)', 8, 60, 1],
    ['waveTurn', 'Sóng thân khi cua (0 tắt · 1 giữ)', 0, 1, 0.1],
    ['infV', 'Múa ∞: tốc độ (màn/giây)', 0.3, 2.5, 0.1],
    ['infA', 'Múa ∞: nửa bề ngang (0.4 = vừa khít thân)', 0.25, 0.8, 0.05],
  ];
  const LAYERS = [['spine', 'Xương sống'], ['base', 'Xương gốc (chưa sóng)'], ['body', 'Bề dày thân'], ['hit', 'Hitbox đầu'], ['trail', 'Vệt bay'],
    ['vel', 'Mũi tên tốc độ'], ['aim', 'Điểm chuột + dây'], ['grid', 'Lưới'], ['text', 'Chữ trạng thái']];
  const S = JSON.parse(JSON.stringify(DEF));
  // v2: 'turn' changed meaning with the steering model, so a v1 save keeps everything but that
  try { const v2 = localStorage.getItem('room.v2'), o = JSON.parse(v2 || localStorage.getItem('room.v1') || 'null');
    if (o) { for (const k in DEF) if (k !== 'L' && typeof o[k] === 'number' && (v2 || k !== 'turn')) S[k] = o[k]; Object.assign(S.L, o.L || {}); } } catch { /* defaults */ }
  const save = () => { try { localStorage.setItem('room.v2', JSON.stringify(S)); } catch { /* private window */ } };

  // ---- the room: wallpaper life off, white paper ------------------------------------------
  D.props({ theme: 'light', cloudfreq: 0, calligraphy: false, audioreactive: false, rainlightning: false, dance: false });
  const st = { paused: false, scale: 1, stepReq: false, ov: true, locked: false, fps: 0, ms: 0, v: 0, vMax: 0, bend: 0, rep: false, nRep: 0 };
  try { st.nRep = +localStorage.getItem('room.rep') || 0; } catch { /* 0 */ }
  const trail = [];
  let tx = 0, ty = 0;   // the mouse point the head goes to
  // The dragon's own head point (dg.hx, pts[0]) is the back of the skull: eye and snout lie 1.6 to 3.6 radii ahead of it
  // (r001: the cursor sat on the neck, the face well outside the hitbox ring). So the mouse carries hc, a point on the
  // head, and the neck joint is put S.hold radii behind it along the way the head is drawn facing (pts[2] -> pts[0])
  const hc = { x: 0, y: 0 };
  let fa = 0;   // the neck's heading: it only ever moves along this
  let sv = 0;   // its speed, px/s (never negative)
  let sw = 0;   // its turn rate, rad/s
  let svS = 0;  // speed averaged over a third of a second: tells flight from a short step at a hover (whose own creep is fast)
  const face = () => { const P = D.dg.pts; return P.length >= 3 ? Math.atan2(P[0].y - P[2].y, P[0].x - P[2].x) : D.dg.ang; };
  const seat = () => { const a = fa = face(), o = S.hold * D.rad(); sv = sw = svS = 0; hc.x = D.dg.hx + Math.cos(a) * o; hc.y = D.dg.hy + Math.sin(a) * o; tx = hc.x; ty = hc.y; };
  const G = {
    on: true, bg: [1, 1, 1], ang: null, bend: 0,
    tick(rdt) {
      st.fps += (1 / Math.max(rdt, 1e-3) - st.fps) * 0.08; st.ms = rdt * 1000;
      let dt = st.paused ? 0 : rdt * st.scale;
      if (st.stepReq) { dt = 1 / 60; st.stepReq = false; }
      if (dt > 0) advance(dt);
      return dt;
    },
    draw(dt) {
      if (dt > 0) { trail.push([hc.x, hc.y, D.T]); while (trail.length && D.T - trail[0][2] > 2.5) trail.shift(); }
      drawOverlay();
      if (st.rep) { st.rep = false; report(); }
    },
  };
  D.game(G); seat();

  // ---- infinity dance (Yang 11-18: he drew a figure-8 by hand, wanted a button for it) -----------------------
  // Nothing new in the dragon: the mouse point is run round a figure-8 (x = A sin a, y = B sin 2a, about the middle of
  // the free screen) at a steady S.infV, and the usual steering follows it until the neck is on the figure (danceLock). It waits while the head is still more than 0.15 screens behind. The mouse is ignored while it runs
  const dance = { a: 0, lock: false, n: 0, ox: 0, oy: 0 };
  const dancePt = (a) => { const A = S.infA * D.H, w = D.W - (panel.classList.contains('hide') ? 0 : panel.offsetWidth); return [w / 2 + A * Math.sin(a), D.H / 2 + A * 0.45 * Math.sin(2 * a)]; };
  function setDance(on) {
    st.dance = !!on; dance.lock = false;
    if (on) {   // join the figure at a point ahead of the head, where the figure runs the head's way. (The plain nearest point
      // was often behind it: the dragon then span on the spot, 4 rad round, and the stiff body was swung 43 px a frame).
      // Weighed most: the figure there runs the way the head will arrive (straight from where it is), so it slides on
      // without a corner; a corner at the join stays in the body for a whole lap
      const wr = (x) => Math.abs(Math.atan2(Math.sin(x), Math.cos(x))) / Math.PI, H = D.H; let best = 1e9;
      for (let k = 0; k < 96; k++) {
        const a = k / 96 * 6.2832, p = dancePt(a), dx = p[0] - G.x, dy = p[1] - G.y, dn = Math.hypot(dx, dy);
        const sc = dn + H * 0.5 * wr(Math.atan2(dy, dx) - fa) + H * 0.8 * wr(Math.atan2(0.9 * Math.cos(2 * a), Math.cos(a)) - Math.atan2(dy, dx)) + (dn < 2.4 * S.rho * D.rad() ? 4 * H : 0);
        if (sc < best) { best = sc; dance.a = a; }
      }
    }
    else { tx = hc.x; ty = hc.y; }
    sync();
  }
  function danceStep(dt) {
    const A = S.infA * D.H, a = dance.a, p = dancePt(a);
    if (Math.hypot(p[0] - hc.x, p[1] - hc.y) < 0.15 * D.H) dance.a = (a + S.infV * D.H * dt / Math.max(1, A * Math.hypot(Math.cos(a), 0.9 * Math.cos(2 * a)))) % 6.2832;
    const q = dancePt(dance.a); tx = q[0]; ty = q[1];
  }
  // Steered like that, the body came out up to 48 px off the figure (the eye chases the point with a lag, the neck trails
  // the eye on the lever, both cut the curves), and Yang holds the body against the figure. So once the neck is on the
  // figure and heading its way (within 0.06 screens, 0.35 rad), it is locked to it: the neck itself runs along the line
  // at S.infV, the little it was off fades in a third of a second, and the steering is out of the loop until the dance ends
  function danceLock() {
    const H = D.H, wr = (x) => Math.atan2(Math.sin(x), Math.cos(x)); let best = 1e9, bn = 0;
    for (let k = -40; k <= 0; k++) { const a = dance.a + k * 0.02, p = dancePt(a), d = Math.hypot(p[0] - G.x, p[1] - G.y); if (d < best) { best = d; bn = a; } }
    if (best < 0.06 * H && Math.abs(wr(Math.atan2(0.9 * Math.cos(2 * bn), Math.cos(bn)) - fa)) < 0.35) {
      const p = dancePt(bn); dance.lock = true; dance.n = bn; dance.ox = G.x - p[0]; dance.oy = G.y - p[1]; }
  }
  function danceRun(dt) {
    const H = D.H, A = S.infA * H, o = S.hold * D.rad(), n = dance.n;
    dance.n = n + S.infV * H * dt / Math.max(1, A * Math.hypot(Math.cos(n), 0.9 * Math.cos(2 * n)));
    const dec = Math.exp(-dt * 3); dance.ox *= dec; dance.oy *= dec;
    const p = dancePt(dance.n), nx = p[0] + dance.ox, ny = p[1] + dance.oy, mx = nx - G.x, my = ny - G.y;
    let dA = Math.atan2(my, mx) - fa; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); dA = clamp(dA, -S.turn * dt, S.turn * dt);
    fa += dA; sw = dA / dt; sv = Math.hypot(mx, my) / dt; G.x = nx; G.y = ny; G.ang = fa; G.bend = Math.min(0.6, D.segLen() / (S.rho * D.rad()) * 1.05);
    const ox = hc.x, oy = hc.y; hc.x = G.x + Math.cos(fa) * o; hc.y = G.y + Math.sin(fa) * o; tx = hc.x; ty = hc.y;
    st.v = Math.hypot(hc.x - ox, hc.y - oy) / dt / H; st.vMax = Math.max(st.vMax * (1 - dt * 0.5), st.v); st.w = sw; svS += (sv - svS) * (1 - Math.exp(-dt * 3));
  }
  function advance(dt) {
    D.WAVE.amp = S.waveAmp; D.WAVE.len = S.waveLen; G.waveTurn = S.waveTurn; G.track = S.track >= 0.5;
    if (st.dance && dance.lock) return danceRun(dt);
    if (st.dance) danceStep(dt);
    moveHead(dt);
    if (st.dance) danceLock();
  }

  function moveHead(dt) {
    // The neck (the dragon's own head point) is flown like a swimmer: it only moves forwards, along its heading fa, and fa
    // comes round at S.turn rad/s on a circle of S.rho body radii. It heads for the mouse point and stops S.hold radii
    // short of it, so the held point hc (the eye) lands on the mouse point. Swinging fa moves hc sideways at once (lever
    // S.hold), so small moves to the side are still followed 1:1; only a mouse point that goes behind the head costs a
    // U-turn (0.2 to 0.3 s, a fifth of a screen wide).
    // Why (Yang 11-18: a sudden reversal jerked the head and the whole body changed at once): before this, hc was glued to
    // the mouse and the neck was put behind it. A reversal then pushed the neck back into the body and swung it round hc at
    // 1000 px/s. The spine is follow-the-leader with a bend limit: pulled, it trails smoothly; pushed, or with its first
    // segment turned faster than the limit lets the joints behind bend, the limit swings the front of the body round with
    // it in a frame. So: never push (speed >= 0), never turn tighter than the body can bend (G.bend = segment / rho, the
    // body threads the neck's own track).
    // - the turning circle is the full rho unless the mouse point lies inside it (near and off to the side): then just
    //   small enough to reach the point, down to half (PIV), the turn slowing with it; a point inside even that is left
    //   alone (the neck would orbit it). Not smaller than half: the body lies on the neck's track (G.track), and a pivot
    //   on a 20 px circle left a kink of 0.85 rad running down the body. Not "0.45 x distance" either: following, the
    //   mouse point is always just ahead (hold + lag), so every turn was flown on half the circle and the track came
    //   out bent 0.6 rad a joint where the body can take 0.3 (Yang's figure-8 shot: red segments, body off the 8).
    //   At a hover it IS 0.45 x distance (blend fl): on the full circle a 100 px step to the side crept too far forward
    //   and ended 74 px off, the point then inside the circle
    // - a mouse point between neck and eye, or within a quarter of S.hold of the neck: nothing to do, the cursor is on the head
    // - braking is eased at the follow rate, so a reversal at speed coasts into its U-turn instead of stopping dead
    // Tried and dropped (all with hc glued to the mouse): facing = drawn pts[2] -> pts[0] (flipped end over end at a hover,
    // 137 px a frame); joint 2 -> hc with no block (flick straight back: facing flipped in one frame, neck jumped 102 px),
    // even with the spine walked in half-segment steps (1.2 rad a frame); facing = the way hc is pulled, block measured
    // against fa (a plain circle then whipped 0.85 rad a frame); neck allowed 0.8 segment backwards then blocked, head
    // swung round hc (r001 / Yang 11-18: still jerked on every sharp reversal).
    const H = D.H, R = D.rad(), o = S.hold * R, rho = S.rho * R, PIV = 0.5;
    const dx = tx - G.x, dy = ty - G.y, dn = Math.hypot(dx, dy), k = S.follow >= 60 ? 1 / dt : (1 - Math.exp(-dt * S.follow)) / dt;
    let wW = 0, vW = 0, dA = 0, re = rho;
    if (dn > Math.max(2, 0.25 * o)) {
      dA = Math.atan2(dy, dx) - fa; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
      const e = dn - o, sD = Math.abs(Math.sin(dA)), fl = clamp(svS / (0.6 * H), 0, 1);   // fl: 0 at a hover .. 1 in flight
      re = clamp(0.45 * dn / Math.max(1e-3, 1 - fl + fl * sD), PIV * rho, rho);
      const wm = S.turn * re / rho;
      // a mouse point inside the turning circle cannot be reached by turning towards it (the neck would orbit it): left alone
      const inCircle = dn < 2 * re * sD;
      if (!inCircle && !(e <= 0 && Math.abs(dA) * dn < 1.5)) wW = clamp(k * dA, -wm, wm);
      vW = Math.max(Math.min(k * Math.max(0, e), S.cap * H) * Math.max(0, Math.cos(dA)), re * Math.abs(wW));
    }
    sv = Math.max(vW, sv * Math.exp(-dt * Math.max(20, S.follow))); svS += (sv - svS) * (1 - Math.exp(-dt * 3));
    sw += (wW - sw) * (1 - Math.exp(-dt * 60));
    sw = sv > 1e-6 ? clamp(sw, -sv / re, sv / re) : 0;
    if (wW !== 0 && Math.abs(sw * dt) > Math.abs(dA)) sw = dA / dt;   // never past the mouse point's bearing
    fa += sw * dt;
    const fx = Math.cos(fa), fy = Math.sin(fa);
    G.x += fx * sv * dt; G.y += fy * sv * dt; G.ang = fa; G.bend = Math.min(0.6, D.segLen() / rho * 1.05);
    const ox = hc.x, oy = hc.y; hc.x = G.x + fx * o; hc.y = G.y + fy * o;
    st.v = Math.hypot(hc.x - ox, hc.y - oy) / dt / H; st.vMax = Math.max(st.vMax * (1 - dt * 0.5), st.v); st.w = sw;
  }

  // ---- mouse: pointer lock, the head is the cursor ----------------------------------------
  const cv = D.canvas;
  cv.addEventListener('click', () => { if (!st.locked) cv.requestPointerLock?.(); });
  document.addEventListener('pointerlockchange', () => {
    st.locked = document.pointerLockElement === cv;
    hint.classList.toggle('hide', st.locked);
    if (st.locked) { tx = hc.x; ty = hc.y; }
  });
  document.addEventListener('mousemove', (e) => {
    if (!st.locked || st.dance) return;
    const H = D.H, W = D.W;
    tx = clamp(tx + e.movementX * S.sens, 0, W); ty = clamp(ty + e.movementY * S.sens, 0, H);
    const dx = tx - hc.x, dy = ty - hc.y, d = Math.hypot(dx, dy), L = S.leash * H;
    if (d > L) { tx = hc.x + dx / d * L; ty = hc.y + dy / d * L; }
  });
  addEventListener('resize', () => { G.x = D.dg.hx; G.y = D.dg.hy; seat(); trail.length = 0; sizeOv(); });

  // ---- overlay ----------------------------------------------------------------------------
  let dpr = 1;
  function sizeOv() { dpr = Math.min(2, devicePixelRatio || 1); ov.width = Math.round(innerWidth * dpr); ov.height = Math.round(innerHeight * dpr); }
  sizeOv();
  const bendCol = (b) => { const t = clamp(b / 0.3, 0, 1); return `hsl(${Math.round(140 - 140 * t)} 85% 42%)`; };   // green straight .. red at 0.3 rad
  function drawOverlay() {
    const W = D.W, H = D.H, dg = D.dg, P = dg.pts, N = D.N, L = S.L;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    if (!st.ov || !P.length) return;
    c.lineWidth = 1; c.font = '12px Consolas, monospace';
    if (L.grid) {
      const g = H / 10; c.strokeStyle = 'rgba(0,0,0,.09)'; c.beginPath();
      for (let x = W / 2 % g; x < W; x += g) { c.moveTo(x, 0); c.lineTo(x, H); }
      for (let y = H / 2 % g; y < H; y += g) { c.moveTo(0, y); c.lineTo(W, y); }
      c.stroke(); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillText('1 ô = 0.1 màn', 8, H - 8);
    }
    if (L.trail && trail.length > 1) {
      for (let i = 1; i < trail.length; i++) {
        c.strokeStyle = `rgba(30,110,220,${0.55 * i / trail.length})`; c.beginPath(); c.moveTo(trail[i - 1][0], trail[i - 1][1]); c.lineTo(trail[i][0], trail[i][1]); c.stroke();
      }
    }
    if (L.body) {
      c.strokeStyle = 'rgba(0,0,0,.3)';   // radAt is already in px
      for (let i = 0; i < N; i += 3) { c.beginPath(); c.arc(P[i].x, P[i].y, Math.max(1.5, D.radAt(i / (N - 1))), 0, 6.2832); c.stroke(); }
    }
    const wv = dg.wv;
    if (L.base && wv) {
      c.strokeStyle = 'rgba(200,60,200,.75)'; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(wv.bx[0], wv.by[0]);
      for (let i = 1; i < N; i++) c.lineTo(wv.bx[i], wv.by[i]);
      c.stroke(); c.setLineDash([]);
    }
    let bmax = 0;
    for (let i = 1; i < N; i++) {
      let b = 0;
      if (i >= 2) { const a1 = Math.atan2(P[i - 1].y - P[i - 2].y, P[i - 1].x - P[i - 2].x), a2 = Math.atan2(P[i].y - P[i - 1].y, P[i].x - P[i - 1].x); b = Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1))); }
      if (b > bmax) bmax = b;
      if (!L.spine) continue;
      c.strokeStyle = bendCol(b); c.lineWidth = 1.6; c.beginPath(); c.moveTo(P[i - 1].x, P[i - 1].y); c.lineTo(P[i].x, P[i].y); c.stroke();
      c.fillStyle = i % 10 === 0 ? '#000' : 'rgba(0,0,0,.55)'; c.beginPath(); c.arc(P[i].x, P[i].y, i % 10 === 0 ? 2.6 : 1.4, 0, 6.2832); c.fill();
    }
    st.bend = bmax; c.lineWidth = 1;
    if (L.hit) { c.strokeStyle = '#d21'; c.lineWidth = 1.5; c.beginPath(); c.arc(hc.x, hc.y, D.rad() * 0.9, 0, 6.2832); c.stroke(); c.lineWidth = 1;
      c.fillStyle = '#d21'; c.beginPath(); c.arc(dg.hx, dg.hy, 3, 0, 6.2832); c.fill(); }   // dot = the neck joint
    if (L.vel && st.v > 0.01) {
      const l = Math.min(H * 0.3, st.v * H * 0.12), n = trail.length, a = n > 1 ? Math.atan2(hc.y - trail[n - 2][1], hc.x - trail[n - 2][0]) : dg.ang, ex = hc.x + Math.cos(a) * l, ey = hc.y + Math.sin(a) * l;
      c.strokeStyle = '#0a7'; c.lineWidth = 2; c.beginPath(); c.moveTo(hc.x, hc.y); c.lineTo(ex, ey);
      c.moveTo(ex, ey); c.lineTo(ex - Math.cos(a - 0.4) * 9, ey - Math.sin(a - 0.4) * 9); c.moveTo(ex, ey); c.lineTo(ex - Math.cos(a + 0.4) * 9, ey - Math.sin(a + 0.4) * 9); c.stroke(); c.lineWidth = 1;
    }
    if (st.dance) {   // the figure itself, to hold the body against (the blue trail is the eye's path, 2.5 s of it)
      c.strokeStyle = 'rgba(220,120,0,.55)'; c.setLineDash([6, 5]); c.beginPath();
      for (let k = 0; k <= 120; k++) { const p = dancePt(k / 120 * 6.2832); k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }
      c.stroke(); c.setLineDash([]);
    }
    if (L.aim) {
      c.strokeStyle = 'rgba(0,0,0,.18)'; c.setLineDash([2, 4]); c.beginPath(); c.arc(hc.x, hc.y, S.leash * H, 0, 6.2832); c.stroke(); c.setLineDash([]);
      c.strokeStyle = '#06c'; c.beginPath(); c.moveTo(tx - 7, ty); c.lineTo(tx + 7, ty); c.moveTo(tx, ty - 7); c.lineTo(tx, ty + 7); c.stroke();
    }
    if (L.text) {
      const lines = [
        `fps ${st.fps.toFixed(0)}  khung ${st.ms.toFixed(1)} ms  ${st.paused ? 'TẠM DỪNG' : 'x' + st.scale}`,
        `tốc độ ${st.v.toFixed(2)} màn/s  đỉnh ${st.vMax.toFixed(2)}  trần ${S.cap.toFixed(1)}`,
        `gập tối đa ${bmax.toFixed(2)}/${G.bend.toFixed(2)} rad  quay ${(st.w || 0).toFixed(1)} rad/s  sóng ${wv ? wv.w.toFixed(2) : '-'}`,
        `đầu ${hc.x.toFixed(0)},${hc.y.toFixed(0)}  chuột lệch ${(Math.hypot(tx - hc.x, ty - hc.y) / H).toFixed(2)} màn`,
        `mode ${dg.mode}  T ${D.T.toFixed(1)}  ${st.dance ? 'ĐANG MÚA ∞' : st.locked ? 'đang cầm' : 'chuột thả'}`,
      ];
      c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(6, 6, 330, lines.length * 16 + 8);
      c.fillStyle = '#111'; lines.forEach((s, i) => c.fillText(s, 12, 22 + i * 16));
    }
  }

  // ---- report (F8): what Yang sees + the numbers, saved for Claire ------------------------
  function say(s) { toast.textContent = s; toast.classList.add('show'); clearTimeout(say.t); say.t = setTimeout(() => toast.classList.remove('show'), 2200); }
  function report() {
    const n = ++st.nRep; try { localStorage.setItem('room.rep', n); } catch { /* ok */ }
    const id = 'r' + String(n).padStart(3, '0'), dg = D.dg, wv = dg.wv;
    const m = document.createElement('canvas'); m.width = ov.width; m.height = ov.height;
    const x = m.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, m.width, m.height); x.drawImage(cv, 0, 0, m.width, m.height); x.drawImage(ov, 0, 0);
    const info = {
      id, when: new Date().toISOString(), screen: [D.W, D.H], T: +D.T.toFixed(2), settings: S, time: { paused: st.paused, scale: st.scale },
      fps: +st.fps.toFixed(1), speed: +st.v.toFixed(3), speedPeak: +st.vMax.toFixed(3), bendMax: +st.bend.toFixed(3), wave: wv ? +wv.w.toFixed(3) : null,
      head: [+hc.x.toFixed(1), +hc.y.toFixed(1)], neck: [+dg.hx.toFixed(1), +dg.hy.toFixed(1)], ang: +dg.ang.toFixed(3), turnRate: +(st.w || 0).toFixed(2), neckSpeed: +(sv / D.H).toFixed(3), bendLimit: +G.bend.toFixed(3), mouse: [+tx.toFixed(1), +ty.toFixed(1)],
      pts: dg.pts.map((p) => [+p.x.toFixed(1), +p.y.toFixed(1)]), base: wv ? Array.from(wv.bx, (v, i) => [+v.toFixed(1), +wv.by[i].toFixed(1)]) : null,
      trail: trail.map((t) => [+t[0].toFixed(0), +t[1].toFixed(0)]),
    };
    const post = (name, url) => fetch('/report', { method: 'POST', body: name + '|' + url });
    const json = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(JSON.stringify(info))));
    Promise.all([post(id + '.png', m.toDataURL('image/png')), post(id + '.json', json)])
      .then((r) => say(r.every((q) => q.ok) ? `Đã lưu báo cáo ${id}` : `Lỗi lưu ${id}`))
      .catch(() => say('Không lưu được: server không nhận (chạy bằng run-room.bat)'));
  }

  // ---- panel ------------------------------------------------------------------------------
  function build() {
    const sl = SL.map(([k, lab, a, b, s]) => `<label><span class="row"><span>${lab}</span><b id="v_${k}"></b></span><input type="range" id="s_${k}" min="${a}" max="${b}" step="${s}"></label>`).join('');
    const ly = LAYERS.map(([k, lab]) => `<label><input type="checkbox" id="l_${k}"> ${lab}</label>`).join('');
    panel.innerHTML = `<h3>Điều khiển</h3>${sl}<button id="b_def">Về mặc định</button><button id="b_copy">Chép số</button>
      <h3>Múa</h3><button id="b_inf">Múa vô cực ∞ (M)</button>
      <h3>Thời gian</h3><button id="b_pause">Tạm dừng</button><button id="b_step">1 khung</button><br>${[1, 0.5, 0.25, 0.1].map((v) => `<button class="sc" data-v="${v}">x${v}</button>`).join('')}
      <h3>Soi</h3>${ly}
      <h3>Báo em</h3><button id="b_rep">Lưu báo cáo (F8)</button>
      <h3>Phím</h3><div class="keys">Bấm màn hình: cầm đầu rồng
Esc: thả chuột     F1: ẩn bảng
F3: bật/tắt soi    G: lưới
Space/P: tạm dừng  . : 1 khung
[ ]: chậm/nhanh    F8: báo em
M: múa vô cực</div>`;
    for (const [k] of SL) $('s_' + k).addEventListener('input', (e) => { S[k] = +e.target.value; sync(); save(); });
    for (const [k] of LAYERS) $('l_' + k).addEventListener('change', (e) => { S.L[k] = e.target.checked; save(); });
    $('b_def').onclick = () => { for (const k in DEF) if (k !== 'L') S[k] = DEF[k]; sync(); save(); };
    $('b_copy').onclick = () => { const t = SL.map(([k]) => `${k}=${S[k]}`).join(' '); navigator.clipboard?.writeText(t).then(() => say('Đã chép: ' + t), () => say(t)); };
    $('b_pause').onclick = () => { st.paused = !st.paused; sync(); };
    $('b_step').onclick = () => { st.paused = true; st.stepReq = true; sync(); };
    $('b_rep').onclick = () => { st.rep = true; };
    $('b_inf').onclick = () => setDance(!st.dance);
    panel.querySelectorAll('.sc').forEach((b) => { b.onclick = () => { st.scale = +b.dataset.v; st.paused = false; sync(); }; });
    sync();
  }
  function sync() {
    for (const [k, , , , s] of SL) { $('s_' + k).value = S[k]; $('v_' + k).textContent = S[k].toFixed(s < 1 ? (s < 0.1 ? 2 : 1) : 0); }
    for (const [k] of LAYERS) $('l_' + k).checked = !!S.L[k];
    if ($('b_inf')) { $('b_inf').classList.toggle('on', !!st.dance); $('b_inf').textContent = st.dance ? 'Dừng múa (M)' : 'Múa vô cực ∞ (M)'; }
    $('b_pause').classList.toggle('on', st.paused); $('b_pause').textContent = st.paused ? 'Chạy tiếp' : 'Tạm dừng';
    panel.querySelectorAll('.sc').forEach((b) => b.classList.toggle('on', !st.paused && +b.dataset.v === st.scale));
  }
  build();

  const SCALES = [0.1, 0.25, 0.5, 1];
  addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'F1') panel.classList.toggle('hide');
    else if (k === 'F3') st.ov = !st.ov;
    else if (k === 'F8') st.rep = true;
    else if (k === 'm' || k === 'M') setDance(!st.dance);
    else if (k === 'g' || k === 'G') { S.L.grid = !S.L.grid; save(); sync(); }
    else if (k === ' ' || k === 'p' || k === 'P') { st.paused = !st.paused; sync(); }
    else if (k === '.') { st.paused = true; st.stepReq = true; sync(); }
    else if (k === '[' || k === ']') { const i = clamp(SCALES.indexOf(st.scale) + (k === ']' ? 1 : -1), 0, SCALES.length - 1); st.scale = SCALES[i]; st.paused = false; sync(); }
    else return;
    e.preventDefault();
  });

  window.__room = { S, st, G, hc, trail, tick: (dt) => advance(dt), dance: setDance, aim: () => [tx, ty], seat, target: (x, y) => { tx = x; ty = y; }, report: () => { st.rep = true; } };   // test hooks
  if (new URLSearchParams(location.search).has('bot')) { const s = document.createElement('script'); s.src = 'bot.js'; document.body.appendChild(s); }   // tools/roomtest.py
})();
