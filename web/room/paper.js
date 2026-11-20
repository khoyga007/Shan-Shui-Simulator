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
  const W = 1750, H = 984, TINT = [0.95, 0.935, 0.905], GAIN = 2.4, SRC = '../assets/paper/Gemini AS.webp';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const S = { k: 0.5 };
  try { Object.assign(S, JSON.parse(localStorage.getItem('paper.v1') || '{}')); } catch { /* default */ }
  const q = new URLSearchParams(location.search), fixed = q.has('paper');
  if (fixed) S.k = clamp(+q.get('paper') || 0, 0, 1);
  const save = () => { if (!fixed) try { localStorage.setItem('paper.v1', JSON.stringify(S)); } catch { /* ok */ } };
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  let src = null, low = null, ready = false, on = false;

  function bake() {
    on = !!src && S.k > 0.001; document.body.classList.toggle('paper', on);
    if (!on) return;
    const o = c.createImageData(W, H), d = o.data, t = 2 * S.k, g = GAIN * t, b0 = 255 * (1 - t * (1 - TINT[0])), b1 = 255 * (1 - t * (1 - TINT[1])), b2 = 255 * (1 - t * (1 - TINT[2]));
    // a fleck of bark is far darker than a fibre is light: carried over at the fibres' gain it is a brown blot that reads as
    // a slip of the brush once ink lies near it (bot, first try). So what is darker than the sheet is held to DK, what is lighter to LT
    const DK = 0.1 * Math.min(1.5, t), LT = 0.07 * Math.min(1.5, t), f = (v) => { v *= g; return v < 0 ? -DK * Math.tanh(-v / DK) : LT * Math.tanh(v / LT); };
    for (let i = 0; i < d.length; i += 4) {
      d[i] = b0 * (1 + f(src[i] / Math.max(8, low[i]) - 1)); d[i + 1] = b1 * (1 + f(src[i + 1] / Math.max(8, low[i + 1]) - 1)); d[i + 2] = b2 * (1 + f(src[i + 2] / Math.max(8, low[i + 2]) - 1)); d[i + 3] = 255; }
    c.putImageData(o, 0, 0);
  }
  const im = new Image();
  im.onload = () => {
    const m = document.createElement('canvas'); m.width = W; m.height = H; const x = m.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0, W, H); src = x.getImageData(0, 0, W, H).data;
    // the sheet's own light and colour: the sheet blurred wide. Drawn small and back up (twice over, each softened by the
    // scaling): a canvas blur filter fades toward the edges of the sheet, where there is nothing beyond to average in
    const s = document.createElement('canvas'); s.width = Math.round(W / 24); s.height = Math.round(H / 24); const y = s.getContext('2d'); y.imageSmoothingQuality = 'high';
    y.drawImage(m, 0, 0, s.width, s.height); x.imageSmoothingQuality = 'high'; x.drawImage(s, 0, 0, W, H); y.drawImage(m, 0, 0, s.width, s.height); x.drawImage(s, 0, 0, W, H);
    low = x.getImageData(0, 0, W, H).data; ready = true; bake();
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
  window.__paper = { S, draw, ready: () => ready, on: () => on, set: (k) => { S.k = clamp(k, 0, 1); bake(); } };
})();
