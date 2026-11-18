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
    turn: 10,      // how fast the head's heading comes round to its motion, 1/s
    waveAmp: D.WAVE.amp, waveLen: D.WAVE.len,
    L: { spine: true, base: false, body: false, hit: true, trail: true, vel: true, aim: true, grid: false, text: true },
  };
  const SL = [   // key, label, min, max, step
    ['cap', 'Trần tốc độ (màn/giây)', 0.3, 8, 0.1],
    ['follow', 'Độ bám chuột (60 = dính)', 3, 60, 1],
    ['leash', 'Dây chuột (màn)', 0.05, 1.5, 0.05],
    ['sens', 'Độ nhạy chuột', 0.3, 3, 0.05],
    ['turn', 'Tốc độ quay đầu', 2, 30, 1],
    ['waveAmp', 'Sóng thân: biên độ', 0, 3, 0.1],
    ['waveLen', 'Sóng thân: bước sóng (đốt)', 8, 60, 1],
  ];
  const LAYERS = [['spine', 'Xương sống'], ['base', 'Xương gốc (chưa sóng)'], ['body', 'Bề dày thân'], ['hit', 'Hitbox đầu'], ['trail', 'Vệt bay'],
    ['vel', 'Mũi tên tốc độ'], ['aim', 'Điểm chuột + dây'], ['grid', 'Lưới'], ['text', 'Chữ trạng thái']];
  const S = JSON.parse(JSON.stringify(DEF));
  try { const o = JSON.parse(localStorage.getItem('room.v1') || 'null'); if (o) { for (const k in DEF) if (k !== 'L' && typeof o[k] === 'number') S[k] = o[k]; Object.assign(S.L, o.L || {}); } } catch { /* defaults */ }
  const save = () => { try { localStorage.setItem('room.v1', JSON.stringify(S)); } catch { /* private window */ } };

  // ---- the room: wallpaper life off, white paper ------------------------------------------
  D.props({ theme: 'light', cloudfreq: 0, calligraphy: false, audioreactive: false, rainlightning: false, dance: false });
  const st = { paused: false, scale: 1, stepReq: false, ov: true, locked: false, fps: 0, ms: 0, v: 0, vMax: 0, bend: 0, rep: false, nRep: 0 };
  try { st.nRep = +localStorage.getItem('room.rep') || 0; } catch { /* 0 */ }
  const trail = [];
  let tx = 0, ty = 0;   // the mouse point the head goes to
  const G = {
    on: true, bg: [1, 1, 1], turn: S.turn,
    tick(rdt) {
      st.fps += (1 / Math.max(rdt, 1e-3) - st.fps) * 0.08; st.ms = rdt * 1000;
      let dt = st.paused ? 0 : rdt * st.scale;
      if (st.stepReq) { dt = 1 / 60; st.stepReq = false; }
      if (dt > 0) moveHead(dt);
      return dt;
    },
    draw(dt) {
      if (dt > 0) { trail.push([G.x, G.y, D.T]); while (trail.length && D.T - trail[0][2] > 2.5) trail.shift(); }
      drawOverlay();
      if (st.rep) { st.rep = false; report(); }
    },
  };
  D.game(G); tx = G.x; ty = G.y;

  function moveHead(dt) {
    G.turn = S.turn; D.WAVE.amp = S.waveAmp; D.WAVE.len = S.waveLen;
    const H = D.H, dx = tx - G.x, dy = ty - G.y, d = Math.hypot(dx, dy);
    let mv = d * (S.follow >= 60 ? 1 : 1 - Math.exp(-dt * S.follow));
    mv = Math.min(mv, S.cap * H * dt);
    if (d > 1e-6) { G.x += dx / d * mv; G.y += dy / d * mv; }
    st.v = mv / dt / H; st.vMax = Math.max(st.vMax * (1 - dt * 0.5), st.v);
  }

  // ---- mouse: pointer lock, the head is the cursor ----------------------------------------
  const cv = D.canvas;
  cv.addEventListener('click', () => { if (!st.locked) cv.requestPointerLock?.(); });
  document.addEventListener('pointerlockchange', () => {
    st.locked = document.pointerLockElement === cv;
    hint.classList.toggle('hide', st.locked);
    if (st.locked) { tx = G.x; ty = G.y; }
  });
  document.addEventListener('mousemove', (e) => {
    if (!st.locked) return;
    const H = D.H, W = D.W;
    tx = clamp(tx + e.movementX * S.sens, 0, W); ty = clamp(ty + e.movementY * S.sens, 0, H);
    const dx = tx - G.x, dy = ty - G.y, d = Math.hypot(dx, dy), L = S.leash * H;
    if (d > L) { tx = G.x + dx / d * L; ty = G.y + dy / d * L; }
  });
  addEventListener('resize', () => { G.x = D.dg.hx; G.y = D.dg.hy; tx = G.x; ty = G.y; trail.length = 0; sizeOv(); });

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
      const R = D.rad(); c.strokeStyle = 'rgba(0,0,0,.22)';
      for (let i = 0; i < N; i += 3) { c.beginPath(); c.arc(P[i].x, P[i].y, Math.max(1.5, R * D.radAt(i / (N - 1))), 0, 6.2832); c.stroke(); }
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
    if (L.hit) { c.strokeStyle = '#d21'; c.lineWidth = 1.5; c.beginPath(); c.arc(dg.hx, dg.hy, D.rad() * 0.9, 0, 6.2832); c.stroke(); c.lineWidth = 1; }
    if (L.vel && st.v > 0.01) {
      const l = Math.min(H * 0.3, st.v * H * 0.12), a = dg.ang, ex = dg.hx + Math.cos(a) * l, ey = dg.hy + Math.sin(a) * l;
      c.strokeStyle = '#0a7'; c.lineWidth = 2; c.beginPath(); c.moveTo(dg.hx, dg.hy); c.lineTo(ex, ey);
      c.moveTo(ex, ey); c.lineTo(ex - Math.cos(a - 0.4) * 9, ey - Math.sin(a - 0.4) * 9); c.moveTo(ex, ey); c.lineTo(ex - Math.cos(a + 0.4) * 9, ey - Math.sin(a + 0.4) * 9); c.stroke(); c.lineWidth = 1;
    }
    if (L.aim) {
      c.strokeStyle = 'rgba(0,0,0,.18)'; c.setLineDash([2, 4]); c.beginPath(); c.arc(dg.hx, dg.hy, S.leash * H, 0, 6.2832); c.stroke(); c.setLineDash([]);
      c.strokeStyle = '#06c'; c.beginPath(); c.moveTo(tx - 7, ty); c.lineTo(tx + 7, ty); c.moveTo(tx, ty - 7); c.lineTo(tx, ty + 7); c.stroke();
    }
    if (L.text) {
      const lines = [
        `fps ${st.fps.toFixed(0)}  khung ${st.ms.toFixed(1)} ms  ${st.paused ? 'TẠM DỪNG' : 'x' + st.scale}`,
        `tốc độ ${st.v.toFixed(2)} màn/s  đỉnh ${st.vMax.toFixed(2)}  trần ${S.cap.toFixed(1)}`,
        `gập tối đa ${bmax.toFixed(2)} rad  sóng ${wv ? wv.w.toFixed(2) : '-'}`,
        `đầu ${dg.hx.toFixed(0)},${dg.hy.toFixed(0)}  chuột lệch ${(Math.hypot(tx - dg.hx, ty - dg.hy) / H).toFixed(2)} màn`,
        `mode ${dg.mode}  T ${D.T.toFixed(1)}  ${st.locked ? 'đang cầm' : 'chuột thả'}`,
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
      head: [+dg.hx.toFixed(1), +dg.hy.toFixed(1)], ang: +dg.ang.toFixed(3), mouse: [+tx.toFixed(1), +ty.toFixed(1)],
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
      <h3>Thời gian</h3><button id="b_pause">Tạm dừng</button><button id="b_step">1 khung</button><br>${[1, 0.5, 0.25, 0.1].map((v) => `<button class="sc" data-v="${v}">x${v}</button>`).join('')}
      <h3>Soi</h3>${ly}
      <h3>Báo em</h3><button id="b_rep">Lưu báo cáo (F8)</button>
      <h3>Phím</h3><div class="keys">Bấm màn hình: cầm đầu rồng
Esc: thả chuột     F1: ẩn bảng
F3: bật/tắt soi    G: lưới
Space/P: tạm dừng  . : 1 khung
[ ]: chậm/nhanh    F8: báo em</div>`;
    for (const [k] of SL) $('s_' + k).addEventListener('input', (e) => { S[k] = +e.target.value; sync(); save(); });
    for (const [k] of LAYERS) $('l_' + k).addEventListener('change', (e) => { S.L[k] = e.target.checked; save(); });
    $('b_def').onclick = () => { for (const k in DEF) if (k !== 'L') S[k] = DEF[k]; sync(); save(); };
    $('b_copy').onclick = () => { const t = SL.map(([k]) => `${k}=${S[k]}`).join(' '); navigator.clipboard?.writeText(t).then(() => say('Đã chép: ' + t), () => say(t)); };
    $('b_pause').onclick = () => { st.paused = !st.paused; sync(); };
    $('b_step').onclick = () => { st.paused = true; st.stepReq = true; sync(); };
    $('b_rep').onclick = () => { st.rep = true; };
    panel.querySelectorAll('.sc').forEach((b) => { b.onclick = () => { st.scale = +b.dataset.v; st.paused = false; sync(); }; });
    sync();
  }
  function sync() {
    for (const [k, , , , s] of SL) { $('s_' + k).value = S[k]; $('v_' + k).textContent = S[k].toFixed(s < 1 ? (s < 0.1 ? 2 : 1) : 0); }
    for (const [k] of LAYERS) $('l_' + k).checked = !!S.L[k];
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
    else if (k === 'g' || k === 'G') { S.L.grid = !S.L.grid; save(); sync(); }
    else if (k === ' ' || k === 'p' || k === 'P') { st.paused = !st.paused; sync(); }
    else if (k === '.') { st.paused = true; st.stepReq = true; sync(); }
    else if (k === '[' || k === ']') { const i = clamp(SCALES.indexOf(st.scale) + (k === ']' ? 1 : -1), 0, SCALES.length - 1); st.scale = SCALES[i]; st.paused = false; sync(); }
    else return;
    e.preventDefault();
  });

  window.__room = { S, st, G, trail, target: (x, y) => { tx = x; ty = y; }, report: () => { st.rep = true; } };   // test hooks
})();
