// Ink crispness A/B for the WebGL camera test. Load on /?game=1:  const m = await import('/crisp-test.js'); await m.run(true, false)
// Metric: mean |Laplacian| of luminance over the dragon's bounding box (ink pixels only, paper skipped). Higher = sharper.
// worldPath: the loop is fixed in the world (same flight as the fixed camera), so only the camera differs
export function run(follow, boost, resample = false, worldPath = false, warm = 240) {
  const g = window.__game, G = g.G, cv = document.getElementById('dragon-canvas');
  if (!g) throw new Error('open /?game=1');
  G.pause = true; G.follow = follow; G.resample = resample; G.noLand = true;   // landscape off: only ink is measured
  const c2 = document.createElement('canvas'), x2 = c2.getContext('2d', { willReadFrequently: true });
  const lap = () => {
    const [W] = g.size(), k = cv.width / W;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of g.dg.pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const pad = 80;
    x0 = Math.max(0, (x0 - pad) * k) | 0; y0 = Math.max(0, (y0 - pad) * k) | 0;
    x1 = Math.min(cv.width, (x1 + pad) * k) | 0; y1 = Math.min(cv.height, (y1 + pad) * k) | 0;
    const w = x1 - x0, h = y1 - y0; if (w < 10 || h < 10) return null;
    c2.width = w; c2.height = h; x2.drawImage(cv, x0, y0, w, h, 0, 0, w, h);
    const d = x2.getImageData(0, 0, w, h).data, L = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) L[i] = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2];
    let s = 0, n = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x; if (L[i] > 200) continue;
      s += Math.abs(4 * L[i] - L[i - 1] - L[i + 1] - L[i - w] - L[i + w]); n++;
    }
    return n ? s / n : null;
  };
  // fly a loop round the screen centre at full chase speed
  const drive = (i, T) => {
    G.rmb = true; G.ptr = true; G.boost = boost; G.stam = 1;
    const ox = Math.cos(T * 0.7) * innerHeight * 0.38, oy = Math.sin(T * 0.7) * innerHeight * 0.3;
    G.clX = innerWidth / 2 + ox - (worldPath ? G.camX + G.accX : 0); G.clY = innerHeight / 2 + oy - (worldPath ? G.camY + G.accY : 0);
  };
  g.frames(warm, 1 / 60, drive, false);
  const vals = []; let spd = 0;
  for (let j = 0; j < 8; j++) {
    const h0x = g.dg.hx + G.camX, h0y = g.dg.hy + G.camY;
    g.frames(30, 1 / 60, drive, false);
    spd += Math.hypot(g.dg.hx + G.camX - h0x, g.dg.hy + G.camY - h0y) / 0.5;
    vals.push(lap());
  }
  const v = vals.filter((x) => x != null);
  return { follow, boost, resample, worldPath, lap: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3), samples: v.map((x) => +x.toFixed(2)), speedPxS: Math.round(spd / 8), shifts: G.shifts };
}

// Save the current frame (re-rendered now) to D:\Projects\InkDragon\shots via the local sink on :8098.
// crop: 'head' = 1200x760 device px round the head, 'full' = whole canvas minus the hidden margin.
export async function shoot(name, crop = 'head', land = true) {
  const g = window.__game, G = g.G, cv = document.getElementById('dragon-canvas');
  G.noLand = !land; g.frames(0, 1 / 60, null, false);
  const [W] = g.size(), k = cv.width / W;
  let x, y, w, h;
  if (crop === 'head') { w = 1200; h = 760; x = g.dg.hx * k - w / 2; y = g.dg.hy * k - h / 2; }
  else { x = G.mx * k; y = G.my * k; w = cv.width - 2 * x; h = cv.height - 2 * y; }
  x = Math.max(0, Math.min(cv.width - w, x)) | 0; y = Math.max(0, Math.min(cv.height - h, y)) | 0;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(cv, x, y, w, h, 0, 0, w, h);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const res = await fetch('http://127.0.0.1:8098/' + name + '.png', { method: 'POST', body: blob });
  return res.ok ? name + '.png ' + blob.size : 'fail ' + res.status;
}
