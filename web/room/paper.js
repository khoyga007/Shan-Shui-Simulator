// InkDragon test room: the paper (Yang 11-20: "mình cần nền giấy, cái này quan trọng lắm").
// A sheet of blank xuan paper (sheet AS, web/assets/paper) lies under everything: the dragon's canvas and the ink
// canvas are both MULTIPLIED onto it, so ink soaks into it and what mist rubs out of the ink is paper again, not white.
// The sheet gives fibres, flecks and the cloudiness of the pulp only: its own colour and whatever light fell on it
// are divided out (each pixel over a wide blur of the sheet), and the paper's colour is set here, so a sheet of
// another tint or unevenly lit still comes out the same paper.
//   S.k  0 = the white room as it was (no paper canvas, no blending of the dragon's canvas: costs nothing)
//        0.5 = the wallpaper's paper colour (dragon.js PAPER), 1 = twice as far from white and fibres twice as plain
// URL ?paper=<0..1> sets it for that load only (bot: paper=0 to compare with images from before the paper).
(() => {
  const cv = document.getElementById('paper'), panel = document.getElementById('panel');
  if (!cv) return;
  // W x H: the paper's own canvas, half again the sheet's size (the sheet drawn up smoothly), so a fibre's edge has more than one step in it at 1920 wide
  const W = 2625, H = 1476, TINT = [0.95, 0.935, 0.905], GF = 2.2, GC = 1.6, GRAIN = 0.011, SRC = '../assets/paper/Gemini AS.webp';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const S = { k: 0.5 };
  try { Object.assign(S, JSON.parse(localStorage.getItem('paper.v1') || '{}')); } catch { /* default */ }
  const q = new URLSearchParams(location.search), fixed = q.has('paper');
  if (fixed) S.k = clamp(+q.get('paper') || 0, 0, 1);
  const save = () => { if (!fixed) try { localStorage.setItem('paper.v1', JSON.stringify(S)); } catch { /* ok */ } };
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  let fib = null, cld = null, grn = null, ready = false, on = false, dbg = null;

  // What the sheet is taken apart into (v2. v1 = every pixel over one wide blur, times 2.4: Yang 11-20 "độ phân giải thấp vãi, có pixel".
  // The sheet came pasted through the chat, a 90 KB lossy file: between the fibres it is nothing but the squares of its own compression,
  // and v1 carried those over at the fibres' gain; its wide blur, a small copy drawn back up, was itself a lattice of 24 px cells):
  //   cld  the cloudiness of the pulp: the sheet blurred a little (past the size of a compression square) over the sheet blurred wide. Smooth by make.
  //   fib  fibres and flecks: the sheet's LIGHTNESS over the sheet blurred a little (colour is stored at half size in such a file: no hue from it),
  //        and of that only what stands clear of the noise: the noise's own size is measured (NZ, the 90th percentile of all of it; a fibre
  //        is the few percent beyond), and what is no bigger is let fall away
  //   grn  the tooth: fine grain made here, for the level stretches between fibres, which the sheet no longer gives
  function bake() {
    on = !!fib && S.k > 0.001; document.body.classList.toggle('paper', on);
    if (!on) return;
    const o = c.createImageData(W, H), d = o.data, t = 2 * S.k, b0 = 255 * (1 - t * (1 - TINT[0])), b1 = 255 * (1 - t * (1 - TINT[1])), b2 = 255 * (1 - t * (1 - TINT[2]));
    // a fleck of bark is far darker than a fibre is light: at the fibres' gain it is a brown blot that reads as a slip of the brush once ink lies
    // near it (bot, first try). So what is darker than the sheet is held to DK, what is lighter to LT (soft: a flat-topped fibre is a cut-out)
    const DK = 0.11 * Math.min(1.5, t), LT = 0.09 * Math.min(1.5, t), L = new Float32Array(256), gc = GC * t / 800, gg = GRAIN * Math.min(1.5, t) / 127;
    for (let v = 0; v < 256; v++) { const f = GF * t * (v - 128) / 400; L[v] = 1 + (f < 0 ? -DK * Math.tanh(-f / DK) : LT * Math.tanh(f / LT)); }
    for (let i = 0, j = 0, n = 0; i < d.length; i += 4, j += 3, n++) { const f = L[fib[n]] + gg * grn[n];
      d[i] = b0 * (f + gc * cld[j]); d[i + 1] = b1 * (f + gc * cld[j + 1]); d[i + 2] = b2 * (f + gc * cld[j + 2]); d[i + 3] = 255; }
    c.putImageData(o, 0, 0);
  }
  const im = new Image();
  im.onload = () => {
    const mk = () => { const m = document.createElement('canvas'); m.width = W; m.height = H; return m; }, N = W * H;
    const m = mk(), x = m.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, W, H);
    // a blur of the sheet: halved n times, then doubled back up step by step (each step of a smooth picture stays smooth, and the edge
    // is held as it is. Tried and dropped: one small copy drawn straight back up = a lattice of cells, v1; the canvas blur filter =
    // ruled lines across the whole sheet near its edges, row means off by 1.7 levels, plain in the bot picture)
    const blur = (n) => { const st = []; let cur = m; for (let l = 0; l < n; l++) { const b = document.createElement('canvas'); b.width = Math.ceil(cur.width / 2); b.height = Math.ceil(cur.height / 2); b.getContext('2d').drawImage(cur, 0, 0, b.width, b.height); st.push(b); cur = b; }
      for (let l = n - 2; l >= 0; l--) { st[l].getContext('2d').drawImage(cur, 0, 0, st[l].width, st[l].height); cur = st[l]; }
      const o = mk(), y = o.getContext('2d', { willReadFrequently: true }); y.drawImage(cur, 0, 0, W, H); return y.getImageData(0, 0, W, H).data; };
    const src = x.getImageData(0, 0, W, H).data, mid = blur(3), low = blur(6);
    const f = new Float32Array(N); cld = new Int8Array(3 * N); fib = new Uint8Array(N); grn = new Int8Array(N);
    for (let n = 0, i = 0; n < N; n++, i += 4) {
      f[n] = (0.3 * src[i] + 0.59 * src[i + 1] + 0.11 * src[i + 2]) / Math.max(8, 0.3 * mid[i] + 0.59 * mid[i + 1] + 0.11 * mid[i + 2]) - 1;
      for (let k = 0; k < 3; k++) cld[3 * n + k] = clamp(Math.round(800 * (mid[i + k] / Math.max(8, low[i + k]) - 1)), -127, 127); }
    const sm = []; for (let n = 7; n < N; n += 211) sm.push(Math.abs(f[n])); sm.sort((a, b) => a - b);
    const NZ = Math.max(0.004, sm[Math.floor(0.9 * sm.length)]), T2 = (1.6 * NZ) ** 2;
    for (let n = 0; n < N; n++) { const v = f[n], w = v * v; fib[n] = clamp(Math.round(128 + 400 * v * (w * w / (w * w + T2 * T2))), 0, 255); }
    // the tooth: grain a pixel across and grain three across, by a hash of the place (the same paper every load)
    let h = 0; const rnd = () => { h = (h + 0x6D2B79F5) | 0; let z = Math.imul(h ^ (h >>> 15), 1 | h); z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z; return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
    const cw = Math.ceil(W / 3) + 2, ch = Math.ceil(H / 3) + 2, cs = new Float32Array(cw * ch); for (let n = 0; n < cs.length; n++) cs[n] = rnd() - 0.5;
    for (let y = 0, n = 0; y < H; y++) { const gy = y / 3, y0 = gy | 0, fy = gy - y0; for (let xx = 0; xx < W; xx++, n++) { const gx = xx / 3, x0 = gx | 0, fx = gx - x0, a = y0 * cw + x0;
      grn[n] = Math.round(127 * (0.55 * (rnd() - 0.5) + 0.9 * ((cs[a] * (1 - fx) + cs[a + 1] * fx) * (1 - fy) + (cs[a + cw] * (1 - fx) + cs[a + cw + 1] * fx) * fy))); } }
    dbg = { NZ: +NZ.toFixed(4), p50: +sm[Math.floor(0.5 * sm.length)].toFixed(4), p99: +sm[Math.floor(0.99 * sm.length)].toFixed(4) };
    ready = true; bake();
  };
  im.onerror = () => { ready = true; };
  im.src = SRC;

  // a picture taken of the room (F8 report, bot) lays the paper the way the page does: covering, centred
  const draw = (x, w, h) => { if (!on) return; const s = Math.max(w / W, h / H); x.drawImage(cv, (w - W * s) / 2, (h - H * s) / 2, W * s, H * s); };

  if (panel) {
    const box = document.createElement('div');
    box.innerHTML = `<label><span class="row"><span>Nền giấy (0 = trắng)</span><b id="pp_v"></b></span><input type="range" id="pp_k" min="0" max="1" step="0.05"></label>`;
    const at = document.getElementById('p_mist');   // under the painting's own sliders (paint.js), above its page of keys
    if (at && at.closest('label')) at.closest('label').after(box); else panel.insertBefore(box, panel.firstChild);
    const sl = document.getElementById('pp_k'), sv = document.getElementById('pp_v'), sync = () => { sl.value = S.k; sv.textContent = S.k.toFixed(2); };
    let tm = 0; sl.addEventListener('input', (e) => { S.k = +e.target.value; sync(); save(); clearTimeout(tm); tm = setTimeout(bake, 30); });
    sync();
  }
  window.__paper = { S, draw, dbg: () => dbg, ready: () => ready, on: () => on, set: (k) => { S.k = clamp(k, 0, 1); bake(); } };
})();
