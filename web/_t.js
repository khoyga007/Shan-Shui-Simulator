// scratch test driver for the look refactor (deleted before commit). window.__t.run(tag) -> saves shots/<tag>-*.png
const g = window.__game, G = g.G;
const post = async (name, url) => (await fetch('/shot', { method: 'POST', body: name + '|' + url })).status;
const crop = (url, cx, cy, w, h, z = 2) => new Promise((res) => { const im = new Image(); im.onload = () => {
  const c = document.createElement('canvas'); c.width = w * z; c.height = h * z; const x = c.getContext('2d');
  const k = im.width / (innerWidth + 2 * G.mx);
  x.drawImage(im, (cx - w / 2) * k, (cy - h / 2) * k, w * k, h * k, 0, 0, w * z, h * z); res(c.toDataURL('image/png')); }; im.src = url; });
window.__t = {
  post, crop,
  async run(tag, parts = 'fly,head,fire,fire2,after') {
    G.pause = true; G.ptr = true; const out = {}, want = (k) => parts.split(',').includes(k);
    G.q = false; G.rmb = true; G.clX = innerWidth * 0.85; G.clY = innerHeight * 0.45;
    let u = g.frames(150, 1 / 60, (i) => { G.clY = innerHeight * (0.45 + 0.25 * Math.sin(i / 40)); });
    if (want('fly')) out.fly = await post(tag + '-fly.png', u);
    if (want('head')) out.head = await post(tag + '-head.png', await crop(u, g.dg.hx, g.dg.hy, 460, 300, 3));
    G.rmb = false; G.tgt = null; G.q = true; G.clX = innerWidth * 0.9; G.clY = innerHeight * 0.4;
    u = g.frames(11, 1 / 60); if (want('wind')) out.wind = await post(tag + '-wind.png', u);
    u = g.frames(39, 1 / 60); if (want('fire')) out.fire = await post(tag + '-fire.png', u);
    u = g.frames(60, 1 / 60); if (want('fire2')) out.fire2 = await post(tag + '-fire2.png', u);
    if (want('firehead')) out.firehead = await post(tag + '-firehead.png', await crop(u, g.dg.hx + 150, g.dg.hy, 560, 340, 2.4));
    G.q = false; u = g.frames(40, 1 / 60); if (want('after')) out.after = await post(tag + '-after.png', u);
    u = g.frames(90, 1 / 60); if (want('after2')) out.after2 = await post(tag + '-after2.png', u);
    return out;
  },
  async sweep(tag) {   // breathe while the aim sweeps across the screen: the realistic worst case
    await this.run(tag, 'none'); G.q = true; const o = {};
    let u = g.frames(45, 1 / 60, (i) => { G.clX = innerWidth * (0.9 - 0.35 * i / 45); G.clY = innerHeight * (0.4 + 0.22 * i / 45); }); o.a = await post(tag + '-sweep1.png', u);
    u = g.frames(45, 1 / 60, (i) => { G.clX = innerWidth * (0.55 - 0.35 * i / 45); G.clY = innerHeight * (0.62 + 0.23 * i / 45); }); o.b = await post(tag + '-sweep2.png', u);
    G.q = false; u = g.frames(60, 1 / 60); o.c = await post(tag + '-sweep3.png', u); return o;
  },
  async turn(tag) {   // fly left with a loop: body crossing itself, legs, tail
    G.pause = true; G.ptr = true; G.q = false; G.rmb = true; G.clX = innerWidth * 0.2; G.clY = innerHeight * 0.6;
    const u = g.frames(140, 1 / 60, (i) => { G.clY = innerHeight * (0.5 + 0.3 * Math.sin(i / 30)); }); G.rmb = false;
    return [await post(tag + '-turn.png', u), await post(tag + '-turnhead.png', await crop(u, g.dg.hx, g.dg.hy, 460, 300, 3))];
  },
  async coil(tag, times = [15, 35, 60, 90, 130, 175, 215, 270], cw = 900, ch = 700) {   // E coil from a level flight; crops follow the coil centre
    G.pause = true; G.ptr = true; G.q = false; G.rmb = true; G.clX = innerWidth * 0.75; G.clY = innerHeight * 0.5;
    g.frames(130, 1 / 60, null, false); G.rmb = false; G.tgt = null;
    dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    let last = 0; const o = {};
    for (const t of times) { const u = g.frames(t - last); last = t; o[t] = await post(tag + '-coil' + String(t).padStart(3, '0') + '.png', await crop(u, G.ccx, G.ccy, cw, ch, 1)); }
    return o;
  },
  // variants: o.fx/fy = flight target (fraction of window), o.cx/cy = cursor at the E press, o.boost, o.q = frame to start holding Q
  async coilv(tag, o = {}, times = [45, 90, 150, 200, 240, 300, 380, 480], cw = 1300, ch = 1000) {
    G.pause = true; G.ptr = true; G.q = false; G.rmb = true; G.boost = !!o.boost; G.clX = innerWidth * (o.fx ?? 0.2); G.clY = innerHeight * (o.fy ?? 0.35);
    g.frames(o.pre ?? 130, 1 / 60, null, false); G.rmb = false; G.tgt = null; G.boost = false;
    if (o.cx != null) { G.clX = innerWidth * o.cx; G.clY = innerHeight * o.cy; g.frames(1, 1 / 60, null, false); }
    dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    let last = 0; const r = {};
    for (const t of times) { const u = g.frames(t - last, 1 / 60, (i) => { if (o.q != null && last + i >= o.q) G.q = last + i < o.q + (o.qlen ?? 90); }); last = t;
      r[t] = await post(tag + '-' + String(t).padStart(3, '0') + '.png', await crop(u, innerWidth / 2 + G.mx, innerHeight / 2 + G.my, cw, ch, 1)); }
    G.q = false; return r;
  },
  // wind-up of the breath, frame by frame, as ONE contact sheet: crops in front of the head. every = frames between shots
  async gather(tag, n = 8, every = 3, o = {}) {
    G.pause = true; G.ptr = true; G.q = false; G.rmb = true; G.clX = innerWidth * 0.95; G.clY = innerHeight * 0.5;
    g.frames(o.pre ?? 170, 1 / 60, null, false);   // level flight to the right, head settled
    if (!o.fly) { G.rmb = false; G.tgt = null; } const A = o.aim ?? 0; G.clX = g.dg.hx - G.mx + 500 * Math.cos(A); G.clY = g.dg.hy - G.my + 500 * Math.sin(A); G.q = true;
    const cw = o.cw ?? 520, ch = o.ch ?? 360, z = o.z ?? 1, cols = o.cols ?? 4, S = document.createElement('canvas'), X = S.getContext('2d');
    S.width = cw * z * cols; S.height = ch * z * Math.ceil(n / cols);
    for (let i = 0; i < n; i++) { const u = g.frames(i ? every : (o.first ?? every), 1 / 60), m = g.dg, mo = window.InkAPI.mouth(), c = await crop(u, mo.x + (o.dx ?? 60), mo.y + (o.dy ?? 0), cw, ch, z);
      await new Promise((res) => { const im = new Image(); im.onload = () => { X.drawImage(im, (i % cols) * cw * z, Math.floor(i / cols) * ch * z); res(); }; im.src = c; });
      if (o.full === i) await post(tag + '-full.png', u);
      X.fillStyle = '#c00'; X.font = '16px monospace'; X.fillText('f' + ((o.first ?? every) + i * every) + ' w' + m.wind.toFixed(2) + ' b' + m.breath.toFixed(2), (i % cols) * cw * z + 6, Math.floor(i / cols) * ch * z + 18); }
    G.q = false; return post(tag + '-sheet.png', S.toDataURL('image/png'));
  },
  // R cloud dive as one contact sheet of whole-screen frames. o.cx/cy = cursor at the R press (fraction of window)
  async dive(tag, times = [20, 60, 95, 110, 120, 130, 140, 150, 165, 180, 200, 230], o = {}) {
    G.pause = true; G.ptr = true; G.q = false; G.rmb = true; G.clX = innerWidth * 0.9; G.clY = innerHeight * 0.5;
    g.frames(o.pre ?? 150, 1 / 60, null, false); G.rmb = !!o.fly; if (!o.fly) G.tgt = null;
    G.clX = innerWidth * (o.cx ?? 0.7); G.clY = innerHeight * (o.cy ?? 0.3); g.frames(1, 1 / 60, null, false);
    dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    const z = o.z ?? 0.4, cols = o.cols ?? 4, cw = innerWidth, ch = innerHeight, S = document.createElement('canvas'), X = S.getContext('2d');
    S.width = cw * z * cols; S.height = ch * z * Math.ceil(times.length / cols); let last = 0, i = 0; const log = [];
    for (const t of times) { const u = g.frames(t - last, 1 / 60, (k) => { if (o.after) o.after(last + k); }); last = t;
      const c = await crop(u, innerWidth / 2 + G.mx, innerHeight / 2 + G.my, cw, ch, z), d = window.InkAPI.diveSt(), st = (d.away ? 'AWAY ' : d.safe ? 'safe ' : '') + d.ch.map((c) => c.toFixed(2)).join('/') + (d.ok ? ' ok' : '') + ' hp' + window.InkGame.state.hp.toFixed(0);
      await new Promise((res) => { const im = new Image(); im.onload = () => { X.drawImage(im, (i % cols) * cw * z, Math.floor(i / cols) * ch * z); res(); }; im.src = c; });
      X.fillStyle = '#c00'; X.font = '15px monospace'; X.fillText('f' + t + ' ' + st, (i % cols) * cw * z + 6, Math.floor(i / cols) * ch * z + 18); log.push('f' + t + ' ' + st); i++; }
    await post(tag + '-sheet.png', S.toDataURL('image/png')); return log;
  },
};
