// InkDragon paint prototype (Yang 2026-11-18, his gameplay idea): the dragon is the brush. A figure is shown as numbered
// points on the white paper; the player flies the head through them in order with the left button held (pen down), in
// one stroke. Done right, the thing the figure stands for appears: circle -> moon, S -> river, infinity -> cloud.
// Placeholder pictures only (drawn here with plain canvas shapes), no score, no levels: this is to feel the idea.
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
    { id: 'moon', name: 'Vòng tròn → mặt trăng', closed: true, n: 8,
      f: (t, w, H) => { const a = t * 6.2832 - 1.5708; return [0.74 * w + 0.17 * H * Math.cos(a), 0.27 * H + 0.17 * H * Math.sin(a)]; } },
    { id: 'river', name: 'Chữ S → dòng sông', closed: false, n: 7,
      f: (t, w, H) => [w * (0.2 + 0.66 * t), H * (0.76 - 0.11 * Math.sin(t * 6.2832))] },
    { id: 'cloud', name: 'Vô cực ∞ → mây cuộn', closed: true, n: 10,
      // the points are set off the crossing, so no point is passed twice
      f: (t, w, H) => { const a = (t + 0.05) * 6.2832, A = 0.26 * H; return [0.32 * w + A * Math.sin(a), 0.3 * H + 0.45 * A * Math.sin(2 * a)]; } },
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
    st.done.push({ i: st.cur, stroke: st.stroke.filter((p) => p[3]), t0: D.T });   // the run-up before point 1 is not part of the picture
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
  function scene(i, a) {   // placeholder pictures
    const w = freeW(), H = D.H, L = geo[i].line; c.save(); c.globalAlpha = a;
    if (TPL[i].id === 'moon') {
      const cx = 0.74 * w, cy = 0.27 * H, r = 0.17 * H, g = c.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
      g.addColorStop(0, 'rgba(250,236,170,.95)'); g.addColorStop(1, 'rgba(226,196,110,.85)'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r * 0.93, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(190,160,90,.35)'; for (const [x, y, s] of [[-0.3, -0.2, 0.16], [0.25, 0.1, 0.22], [-0.1, 0.4, 0.12]]) { c.beginPath(); c.arc(cx + x * r, cy + y * r, s * r, 0, 6.2832); c.fill(); }
    } else if (TPL[i].id === 'river') {
      const path = () => { c.beginPath(); L.forEach((p, k) => k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); };
      c.lineCap = 'round'; c.strokeStyle = 'rgba(120,170,205,.55)'; c.lineWidth = 0.085 * H; path(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.setLineDash([0.03 * H, 0.04 * H]);
      for (const o of [-0.02, 0.012]) { c.save(); c.translate(0, o * H); path(); c.stroke(); c.restore(); }
      c.setLineDash([]);
    } else {
      c.fillStyle = 'rgba(150,160,175,.4)';
      for (let k = 0; k < 240; k += 12) { const p = L[k], r = H * (0.045 + 0.02 * Math.sin(k * 1.7)); c.beginPath(); c.arc(p[0], p[1] - r * 0.3, r, 0, 6.2832); c.fill(); }
    }
    c.globalAlpha = a * 0.7; c.fillStyle = '#555'; c.font = '11px Consolas, monospace';
    const b = L.reduce((m, p) => [Math.min(m[0], p[0]), Math.max(m[1], p[1])], [1e9, -1e9]); c.fillText('hình tạm: ' + TPL[i].name.split('→')[1].trim(), b[0], b[1] + 0.07 * H);
    c.restore();
  }
  const bake = document.createElement('canvas'); let bakeKey = '';
  function render() {
    const W = D.W, H = D.H, T = D.T; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    if (!geo) return;
    // finished pictures do not change: baked once into a canvas (redrawing three strokes and pictures every frame cost
    // frame time for nothing). Only one still fading in is drawn live
    const old = st.done.filter((d) => T - d.t0 >= 1.5), key = old.map((d) => d.i + ':' + d.t0).join() + '|' + ink.width + 'x' + ink.height;
    if (key !== bakeKey) { bakeKey = key; bake.width = ink.width; bake.height = ink.height; c = bake.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const d of old) { scene(d.i, 1); strokePath(d.stroke, 0.4); } c = cMain; }
    if (old.length) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(bake, 0, 0); c.restore(); }
    for (const d of st.done) if (T - d.t0 < 1.5) { const a = clamp((T - d.t0) / 1.5, 0, 1); scene(d.i, a); strokePath(d.stroke, 0.85 - 0.45 * a); }
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
  const box = document.createElement('div');
  box.innerHTML = `<h3>Vẽ tranh (bản thử)</h3><div id="p_stat" class="keys"></div>
    ${TPL.map((T, i) => `<button class="pf" data-i="${i}">${i + 1}. ${T.name.split('→')[0].trim()}</button>`).join('')}<br>
    <button id="p_clear">Xóa tranh (C)</button><button id="p_guide">Ẩn/hiện mẫu (V)</button>
    <label><span class="row"><span>Độ rộng điểm (màn)</span><b id="p_tolv"></b></span><input type="range" id="p_tol" min="0.02" max="0.1" step="0.005"></label>
    <div class="keys">Giữ chuột trái: hạ bút
Qua các điểm theo số, một nét
Thả chuột giữa chừng: đứt nét
1 2 3: chọn hình</div>`;
  panel.insertBefore(box, panel.firstChild);
  const $ = (id) => document.getElementById(id);
  box.querySelectorAll('.pf').forEach((b) => { b.onclick = () => pick(+b.dataset.i); });
  $('p_clear').onclick = () => reset(true);
  $('p_guide').onclick = () => { S.guide = !S.guide; save(); };
  $('p_tol').addEventListener('input', (e) => { S.tol = +e.target.value; save(); sync(); });
  function sync() {
    if (!$('p_stat')) return;
    const T = TPL[st.cur], all = st.done.length === TPL.length;
    $('p_stat').textContent = all ? 'Xong cả tranh. Bấm C để vẽ lại' : `Đang vẽ: ${T.name}\nĐiểm kế: ${st.next >= T.n ? 1 : st.next + 1}/${T.n}` + (st.last ? `\nLần trước: ${st.last.ok ? `lệch TB ${st.last.avgPx} px, ${st.last.grade}` : st.last.why}` : '');
    box.querySelectorAll('.pf').forEach((b) => { const i = +b.dataset.i; b.classList.toggle('on', i === st.cur && !all); b.textContent = `${i + 1}. ${TPL[i].name.split('→')[0].trim()}${st.done.some((d) => d.i === i) ? ' ✓' : ''}`; });
    $('p_tol').value = S.tol; $('p_tolv').textContent = S.tol.toFixed(3);
  }
  sync();
  addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === '1' || k === '2' || k === '3') pick(+k - 1);
    else if (k === 'c' || k === 'C') reset(true);
    else if (k === 'v' || k === 'V') { S.guide = !S.guide; save(); }
  });

  window.__paint = { S, st, TPL, step, render, pick, reset, pen: (on) => (on ? penDown() : penUp()), geo: () => { if (!geo) { layout(); geo.w = freeW(); geo.H = D.H; } return geo; },
    info: () => ({ fig: TPL[st.cur].id, next: st.next, pen: st.pen, done: st.done.map((d) => TPL[d.i].id), last: st.last, tol: S.tol }) };
})();
