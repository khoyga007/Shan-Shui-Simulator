// InkDragon playable slice: Vân Sơn world, ink enemies, dragon HP, death / clear -> restart.
// Runs only on /?game=1. dragon.js calls the hooks: InkGame.update(dt) after the camera, InkGame.mask(ctx) inside drawMask,
// InkGame.bound(dg) after the steering target is set.
//
// Enemies are painted INTO the fluid mask (red channel = ink shape, the same channel the dragon's body uses). The ink pass pulls the
// dye toward brushwork inside the mask and the stir pass churns its edges, so every enemy is real ink with smoking edges; fire in the
// dye overrides it; when one dies it stops being drawn and its ink drifts off as smoke (plus a burst splat).
// Coordinates: world px, fixed. Screen (= dragon / mask space) = world - G.cam. Distances in U = canvas height at start.
(() => {
  if (!/[?&]game=1(&|$)/.test(location.search)) return;
  const A = () => window.InkAPI;
  const TAU = Math.PI * 2, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const hyp = Math.hypot;

  let U = 0;                 // world unit (px), fixed at start so the world doesn't stretch on resize
  let ens = [], darts = [], banks = [];
  const S = { hp: 100, hurtT: -9, dead: false, won: false, endT: 0, kills: 0, total: 0 };
  // world (in U): ground line at y = 1 (bottom of the first screen), sky up to -1.4. x from -1.2 to 11.4 (~7 screens at 16:9)
  const WB = { x0: -1.2, x1: 11.4, y0: -1.4, y1: 0.92 };

  // HORDE TEST (/?game=1&horde=150, Yang 11-18: roguelike in the horde-survival mould; this only answers "how many can the
  // machine draw, and does the picture turn to mud"). Keeps H.n wisps alive: they stream in from off screen, always after the
  // head, slower than the dragon so it can kite them, and shove each other apart so they crowd instead of stacking into one
  // dot. No level, no win; the dragon takes no damage unless &dmg=1 (150 biters kill it in a second: a hitbox question for
  // later)
  const QS = new URLSearchParams(location.search);
  // r = wisp radius (U), ink = how black it is painted (1 = as black as the dragon): &hr= and &hink= to compare looks
  const H = { n: Math.max(0, +QS.get('horde') || 0), dmg: QS.get('dmg') === '1', r: +QS.get('hr') || 0.032, ink: +QS.get('hink') || 1, t: 0, acc: 0, burst: 0, alive: 0 };
  // in the game window (run.bat has no address bar): F4 = horde test on/off, [ ] = count -/+ 25, , . = wisps smaller / bigger
  addEventListener('keydown', (e) => {
    if (e.code === 'F4') { e.preventDefault(); H.n = H.n ? 0 : 150; if (H.n && !QS.get('hr')) H.r = 0.016; if (U) reset(); return; }
    if (!H.n) return;
    if (e.code === 'BracketLeft') H.n = Math.max(25, H.n - 25); else if (e.code === 'BracketRight') H.n = Math.min(800, H.n + 25);
    else if (e.code === 'Comma' || e.code === 'Period') { H.r = clamp(H.r * (e.code === 'Comma' ? 0.85 : 1 / 0.85), 0.008, 0.04); for (const w of ens) if (w.horde) w.r = H.r; }
  });
  function hordeStep(dt, a, G) {
    H.t += dt; H.burst = 0;
    if (ens.some((e) => e.hp <= 0)) ens = ens.filter((e) => e.hp > 0);
    const want = Math.min(H.n, 30 + H.t * H.n / 12);   // fills over ~12 s, then the dead are replaced
    H.acc = Math.min(6, H.acc + dt * Math.max(25, H.n / 3));
    const cx = G.camX + a.W / 2, cy = G.camY + a.H / 2, rad = hyp(a.W, a.H) / 2 + 0.12 * U;
    const place = (e) => {   // a spot on a ring just off screen; near a world wall the clamp can land it in view: try again
      for (let k = 0; k < 6; k++) {
        const t = rnd(0, TAU); e.x = clamp(cx + Math.cos(t) * rad, WB.x0 * U, WB.x1 * U); e.y = clamp(cy + Math.sin(t) * rad, WB.y0 * U, WB.y1 * U);
        if (Math.abs(e.x - cx) > a.W / 2 || Math.abs(e.y - cy) > a.H / 2) break;
      }
      e.hx = e.x; e.hy = e.y; e.vx = e.vy = 0;
    };
    while (ens.length < want && H.acc >= 1 && !S.dead) {
      H.acc -= 1;
      const e = WISP(0, 0); e.horde = true; e.r = H.r; e.sp = rnd(0.22, 0.32); place(e); ens.push(e);
    }
    // left far behind (the dragon outruns them): back onto the ring ahead, or the horde thins out for good
    for (const e of ens) if (e.horde && hyp(e.x - cx, e.y - cy) > rad * 1.5) place(e);
    // crowding: wisps closer than ~2 radii push each other apart (all pairs: 300 wisps = 45k checks, ~0.3 ms)
    const m = 2.4 * H.r * U, m2 = m * m;
    for (let i = 0; i < ens.length; i++) { const p = ens[i]; if (!p.horde) continue;
      for (let j = i + 1; j < ens.length; j++) { const q = ens[j], dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy;
        if (d2 < m2 && d2 > 1e-6) { const d = Math.sqrt(d2), f = (m - d) / d * 6 * dt; p.x -= dx * f; p.y -= dy * f; q.x += dx * f; q.y += dy * f; } } }
    H.alive = ens.length;
  }
  H.fill = () => {   // bench: the whole horde on screen at once, unkillable, so the count holds while it is timed
    const a = A(), G = a.G; H.t = 1e3;
    while (ens.length < H.n) { const e = WISP(0, 0); e.horde = true; e.r = H.r; e.sp = rnd(0.22, 0.32); e.x = e.hx = G.camX + rnd(0.05, 0.95) * a.W; e.y = e.hy = G.camY + rnd(0.05, 0.95) * a.H; e.hp = e.max = 1e6; ens.push(e); }
  };

  // ---- spawn ---------------------------------------------------------------------------------------------------------------
  const WISP = (x, y) => ({ k: 'wisp', x, y, vx: 0, vy: 0, hx: x, hy: y, r: 0.032, hp: 10, max: 10, ph: rnd(0, TAU), hitCd: 0, flash: 0 });
  const CROW = (x, y) => ({ k: 'crow', x, y, vx: 0, vy: 0, hx: x, hy: y, r: 0.07, hp: 30, max: 30, ph: rnd(0, TAU), shotT: rnd(1, 2.5), wind: 0, side: Math.random() < 0.5 ? -1 : 1, flash: 0 });
  const TURT = (x, y) => ({ k: 'turtle', x, y, vx: 0, vy: 0, hx: x, hy: y, r: 0.13, hp: 80, max: 80, face: -1, lungeT: rnd(2, 4), tell: 0, lunge: 0, hitCd: 0, flash: 0, spin: 0 });
  function spawnAll() {
    ens = []; darts = [];
    A().G.steer = !!H.n;   // horde test flies with the new controls (mouse steers the head, fire goes forward)
    if (H.n) { H.t = 0; H.acc = 0; S.total = Infinity; S.kills = 0; return; }   // horde test: hordeStep feeds them in
    const swarm = (cx, cy, n) => { for (let i = 0; i < n; i++) ens.push(WISP(cx + rnd(-0.35, 0.35), cy + rnd(-0.25, 0.25))); };
    // the dragon starts ~2 U long, tail trailing right of the first screen: zone 1 sits past it
    swarm(3.6, 0.1, 7);                                                     // zone 1: wisps only
    swarm(5.6, -0.3, 5); ens.push(CROW(6.0, -0.5), CROW(5.4, 0.2));         // zone 2: crows join
    ens.push(TURT(7.8, 0.55), TURT(8.5, 0.4), CROW(8.2, -0.4));             // zone 3: turtles
    swarm(10.3, 0.0, 6); ens.push(TURT(10.0, 0.6), CROW(10.6, -0.6), CROW(9.9, -0.2));   // zone 4: everything
    for (const e of ens) { e.x *= U; e.y *= U; e.hx = e.x; e.hy = e.y; }
    S.total = ens.length; S.kills = 0;
  }
  function makeBanks() {   // landmark cloud banks (pale wash, mask blue) + walls of cloud at the world edge
    banks = [];
    const at = [[0.9, -0.55], [2.6, -0.9], [3.9, 0.45], [5.9, -0.35], [6.8, 0.6], [8.9, -0.85], [9.3, 0.25], [10.9, -0.3]];
    for (const [x, y] of at) banks.push({ x: x * U, y: y * U, puffs: Array.from({ length: 7 }, () => ({ dx: rnd(-0.32, 0.32) * U, dy: rnd(-0.08, 0.08) * U, r: rnd(0.1, 0.2) * U, ph: rnd(0, TAU) })) });
    for (let y = WB.y0; y <= WB.y1 + 0.2; y += 0.28) for (const x of [WB.x0 - 0.15, WB.x1 + 0.15])
      banks.push({ x: x * U, y: y * U, wall: true, puffs: [{ dx: 0, dy: 0, r: 0.3 * U, ph: rnd(0, TAU) }] });
  }
  function reset() {
    const a = A(); U = a.H; S.hp = 100; S.hurtT = -9; S.dead = S.won = false; a.G.dead = false; a.G.dvC = [0, 0]; a.G.dvG = 0;
    spawnAll(); if (!banks.length) makeBanks(); ui.end.style.opacity = 0; ui.end.style.pointerEvents = 'none';
  }

  // ---- dragon queries ----------------------------------------------------------------------------------------------------
  const scr = (o) => { const G = A().G; return { x: o.x - G.camX, y: o.y - G.camY }; };
  function nearBody(x, y, r) {   // dragon segment hit by a circle at screen (x, y): index or -1. Head, neck, chest only (front 40%):
    const a = A(), p = a.dg.pts, n = p.length;   // the body is ~2 screens long; the tail is a weapon, not a hitbox
    for (let i = 0; i < n * 0.4; i += 2) { const q = p[i], R = a.radAt(i / (n - 1)); if (hyp(q.x - x, q.y - y) < r + R * 0.9) return i; }
    return -1;
  }
  function breathCone() {   // analytic proxy for the fire: cone from the mouth, the way the jet leaves it
    const a = A(), dg = a.dg;
    if (!(dg.breath > 0 && dg.jaw > 0.4)) return null;
    const m = a.mouth(); return { x: m.x, y: m.y, a: m.a, len: a.H * 0.9, half: 0.34 };
  }
  function inCone(c, x, y, r) {
    const dx = x - c.x, dy = y - c.y, d = hyp(dx, dy); if (d > c.len + r) return 0;
    if (d < r + A().rad() * 1.4) return 1;   // splash at the lips: anything right on the mouth burns too
    let da = Math.atan2(dy, dx) - c.a; da = Math.atan2(Math.sin(da), Math.cos(da));
    const half = c.half + Math.atan2(r, Math.max(d, 1));
    return Math.abs(da) < half ? 1 - 0.5 * (d / c.len) : 0;   // weaker at the far end of the jet
  }
  const whipOn = () => { const a = A(); return a.T - a.G.whip < 0.45; };
  const coilOn = () => { const a = A(); return a.T < a.G.coil; };

  // ---- damage -------------------------------------------------------------------------------------------------------------
  function hurtDragon(n, sx, sy) {
    if (S.dead || S.won || A().G.safe || (H.n && !H.dmg)) return;   // cloud dive (R): nothing lands. Horde test: off unless &dmg=1
    S.hp = Math.max(0, S.hp - n); S.hurtT = A().T; ui.flash();
    const a = A(); a.ink(sx, sy, 0.0009, 0.6);   // a dab of ink where it hit
    if (S.hp <= 0) die();
  }
  function hurtEnemy(e, n, kx, ky) {
    if (e.hp <= 0) return;
    e.hp -= n; e.flash = 0.15;
    if (kx || ky) { e.vx += kx; e.vy += ky; }
    if (e.hp <= 0) kill(e);
  }
  function kill(e) {   // dissolve: stop painting it, its ink bursts out as smoke
    const a = A(), s = scr(e), R = e.r * U;
    // gentle: ~the dragon's own wake. A strong burst (1.6 U/s) blew the surrounding fire into a hard-edged bubble
    // horde: a sweep of fire kills a dozen in one frame, and every 4 ink dabs cost a full-size pass over the dye. 2 dabs a
    // kill, at most 8 a frame
    const nb = !H.n ? 6 : (H.burst += 2) <= 8 ? 2 : 0;
    for (let i = 0; i < nb; i++) {
      const t = i / nb * TAU + rnd(-0.4, 0.4), sp = rnd(0.15, 0.3) * U;
      a.push(s.x + Math.cos(t) * R * 0.5, s.y + Math.sin(t) * R * 0.5, Math.cos(t) * sp, Math.sin(t) * sp, 0.0004 * (e.r / 0.05));
      a.ink(s.x + Math.cos(t) * R * 0.6, s.y + Math.sin(t) * R * 0.6, 0.0005 * (e.r / 0.05), 0.45);
    }
    S.kills++;
    if (S.kills >= S.total) win();
  }
  function die() {
    const a = A(); S.dead = true; S.endT = a.T; a.G.dead = true;
    ui.endMsg('Long Hồn tan vào mực', 'Click hoặc bấm phím bất kỳ để chơi lại');
  }
  function win() { S.won = true; S.endT = A().T; ui.endMsg('Vân Sơn đã sạch mực', `${S.total} quái · click hoặc bấm phím bất kỳ để chơi lại`); }

  // ---- per-frame -----------------------------------------------------------------------------------------------------------
  function update(dt) {
    const a = A(); if (!a || !a.dg.pts.length) return;
    if (!U) reset();
    const G = a.G, T = a.T, dg = a.dg, head = { x: dg.hx + G.camX, y: dg.hy + G.camY };   // head in world
    if (!S.dead && T - S.hurtT > 4) S.hp = Math.min(100, S.hp + dt * 3);
    const cone = S.dead ? null : breathCone();
    if (H.n) hordeStep(dt, a, G);
    // R cloud dive. gone = in the cloud: enemies lose it (no chase, no aim, no wind-up) and pass through it. Out of the cloud
    // it is still safe (G.safe, hurtDragon) till the player steers again: bites and darts bounce off. Skipped instead, the
    // wisps sat on the head through that time and all bit in the frame it ended (30 HP at once)
    const gone = G.away;
    const whip = whipOn(), coil = coilOn();
    const tail = whip ? a.dg.pts.slice(-18).map((p) => ({ x: p.x + G.camX, y: p.y + G.camY })) : null;
    const cc = coil ? { x: G.ccx + G.camX, y: G.ccy + G.camY } : null;
    const view = { x0: G.camX - 0.6 * U, x1: G.camX + a.W + 0.6 * U, y0: G.camY - 0.6 * U, y1: G.camY + a.H + 0.6 * U };

    for (const e of ens) {
      if (e.hp <= 0) continue;
      const on = e.x > view.x0 - U && e.x < view.x1 + U && e.y > view.y0 - U && e.y < view.y1 + U;   // only near the camera wakes up
      // asleep: drift home. Frozen in place, a wisp the fire blew out of the wake range stayed lost off-screen for good
      if (!on) { e.vx = e.vy = 0; e.x += (e.hx - e.x) * Math.min(1, dt * 0.4); e.y += (e.hy - e.y) * Math.min(1, dt * 0.4); continue; }
      e.flash = Math.max(0, e.flash - dt); e.hitCd = Math.max(0, (e.hitCd || 0) - dt);
      const dx = head.x - e.x, dy = head.y - e.y, d = hyp(dx, dy) || 1, R = e.r * U;
      if (e.k === 'wisp') {   // swarm: orbit home; dive at the head when close, bite, fall back (the window to burn it), dive again
        e.ph += dt * 2.2; e.back = Math.max(0, (e.back || 0) - dt);
        const chase = (e.horde || d < 1.3 * U) && !S.dead && !gone;
        let tx, ty;
        if (chase && e.back > 0) { tx = head.x - dx / d * 0.6 * U; ty = head.y - dy / d * 0.6 * U; }   // hover off, out of bite range
        else if (chase) { tx = head.x; ty = head.y; }   // straight dive: was an orbit round the head, inside it, so it sat on the head where the fire can't reach
        else { tx = e.hx + Math.cos(e.ph) * 0.22 * U; ty = e.hy + Math.sin(e.ph * 1.4) * 0.16 * U; }
        const acc = chase ? 3.2 : 2.0;
        e.vx += ((tx - e.x) * acc - e.vx) * Math.min(1, dt * 2.5); e.vy += ((ty - e.y) * acc - e.vy) * Math.min(1, dt * 2.5);
        const sp = hyp(e.vx, e.vy), mx = (e.horde ? e.sp : chase ? 0.75 : 0.4) * U; if (sp > mx) { e.vx *= mx / sp; e.vy *= mx / sp; }
      } else if (e.k === 'crow') {   // hover off the dragon's flank, wind up (tell), throw an ink dart at the head
        e.ph += dt * 9;
        const want = 0.75 * U, ang = Math.atan2(-dy, -dx) + e.side * 0.5;
        // gone: hangs where it is. Its shot is put back so the dragon gets the whole wing-raise tell when it is out again
        const tx = gone ? e.x : d < 2 * U ? head.x + Math.cos(ang) * want : e.hx, ty = gone ? e.y : (d < 2 * U ? head.y + Math.sin(ang) * want : e.hy) - 0.15 * U;
        if (gone) e.shotT = Math.max(e.shotT, 0.9);
        e.vx += ((tx - e.x) * 1.6 - e.vx) * Math.min(1, dt * 2); e.vy += ((ty - e.y) * 1.6 - e.vy) * Math.min(1, dt * 2);
        if (d < 1.6 * U && !S.dead && !gone) {
          e.shotT -= dt;
          if (e.shotT < 0.45 && !e.wind) e.wind = 1;
          if (e.shotT <= 0) {
            const ax = head.x - e.x, ay = head.y - e.y, l = hyp(ax, ay) || 1, v = 0.95 * U;   // aimed where the head is now: dodgeable
            darts.push({ x: e.x, y: e.y, vx: ax / l * v, vy: ay / l * v, life: 2.6 });
            e.shotT = rnd(2.0, 3.0); e.wind = 0;
            if (Math.random() < 0.3) e.side = -e.side;
          }
        } else e.wind = 0;
      } else {   // turtle: walks the ground toward the dragon, armour faces it; tell (rear up), then lunge
        const tgtF = Math.sign(dx) || 1;
        if (!e.lunge && !e.tell && !gone) e.face += (tgtF - e.face) * Math.min(1, dt * 1.5);
        if (d < 1.4 * U && !S.dead && !gone) {
          e.lungeT -= dt;
          if (e.lungeT <= 0 && !e.tell && !e.lunge) e.tell = 0.7;
        }
        if (e.tell) { e.tell -= dt; e.vx *= 0.9; if (e.tell <= 0) { e.tell = 0; e.lunge = 0.45; e.vx = Math.sign(e.face) * 1.6 * U; e.vy = clamp(dy, -0.6 * U, 0.6 * U) * 1.2; } }
        else if (e.lunge) { e.lunge -= dt; if (e.lunge <= 0) { e.lunge = 0; e.lungeT = rnd(2.5, 4); } }
        else { e.vx += (Math.sign(e.face) * 0.18 * U - e.vx) * Math.min(1, dt * 1.5); e.vy += ((Math.min(e.hy, head.y + 0.2 * U) - e.y) * 1.2 - e.vy) * Math.min(1, dt * 1.5); }
        e.spin = Math.max(0, e.spin - dt);
      }
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.vx *= Math.pow(0.6, dt); e.vy *= Math.pow(0.6, dt);
      e.x = clamp(e.x, WB.x0 * U, WB.x1 * U); e.y = clamp(e.y, WB.y0 * U, WB.y1 * U);

      // dragon attacks
      if (cone) {
        const s = scr(e), f = inCone(cone, s.x, s.y, R);
        if (f) {
          let dmg = 46 * f * dt;
          if (e.k === 'turtle') {   // stone shell in front: fire going against its face only chips it
            const fx = Math.cos(cone.a), back = fx * Math.sign(e.face) > 0.2;   // fire travelling the way it faces = hits its back
            dmg *= back ? 1.4 : 0.08;
            if (!back) {   // the shell throws the fire back: the jet splashes off its face, so the armour reads without a UI
              // per frame, so scaled by dt*30 like the dragon's wake; 0.9 U/s unscaled was a fountain that blew the fire into a bubble
              const sx = s.x + Math.sign(e.face) * R * 0.9, v = 0.3 * U * clamp(dt * 30, 0.05, 1.5);
              a.push(sx, s.y - R * 0.3, -Math.cos(cone.a) * v, -Math.abs(Math.sin(cone.a)) * v - 0.1 * U, 0.0005);
            }
          }
          hurtEnemy(e, dmg, 0, 0);
          if (e.k === 'wisp') { e.vx += Math.cos(cone.a) * U * 2 * dt; e.vy += Math.sin(cone.a) * U * 2 * dt; }
        }
      }
      if (tail && e.hitCd <= 0) for (const p of tail) if (hyp(p.x - e.x, p.y - e.y) < R + a.rad() * 0.8) {
        const kx = (e.x - head.x) / d, ky = (e.y - head.y) / d;
        hurtEnemy(e, e.k === 'wisp' ? 99 : e.k === 'crow' ? 22 : 18, kx * 1.4 * U, ky * 1.4 * U);
        e.hitCd = 0.5; if (e.k === 'turtle') { e.face = -e.face; e.spin = 0.6; e.tell = 0; e.lunge = 0; }   // whip flips the turtle: back exposed
        break;
      }
      if (cc) {   // coil vortex drags small enemies in and grinds them
        const cx = cc.x - e.x, cy = cc.y - e.y, cd = hyp(cx, cy);
        const d = a.G.cw ? a.G.cw.dir : 1;   // swept round the same way the coil turns
        if (cd < 0.5 * U && e.k !== 'turtle') { e.vx += cx / cd * U * 3 * dt + d * cy / cd * U * 2 * dt; e.vy += cy / cd * U * 3 * dt - d * cx / cd * U * 2 * dt; hurtEnemy(e, 22 * dt, 0, 0); }
      }
      // enemy contact on the dragon
      if (e.hp > 0 && e.k !== 'crow' && e.hitCd <= 0 && !S.dead && !gone) {   // surfaced but still safe: it bounces off, no damage (hurtDragon)
        const s = scr(e), i = nearBody(s.x, s.y, R);
        if (i >= 0) {
          const dmg = e.k === 'wisp' ? 5 : e.lunge ? 14 : 6;
          hurtDragon(dmg, s.x, s.y); e.hitCd = e.k === 'wisp' ? 0.9 : 1.0; if (e.k === 'wisp') e.back = rnd(1.0, 1.6);
          const p = a.dg.pts[i], bx = s.x - p.x, by = s.y - p.y, bl = hyp(bx, by) || 1;
          e.vx = bx / bl * 0.8 * U; e.vy = by / bl * 0.8 * U; if (e.k === 'turtle') { e.lunge = 0; e.lungeT = rnd(3, 4.5); }   // bounced off: a beat before the next
        }
      }
    }
    for (const t of darts) {   // ink darts: hit the body; fire burns them, the whip swats them
      t.life -= dt; t.x += t.vx * dt; t.y += t.vy * dt;
      const s = scr(t);
      if (cone && inCone(cone, s.x, s.y, 0.02 * U)) t.life = 0;
      if (tail && tail.some((p) => hyp(p.x - t.x, p.y - t.y) < a.rad())) t.life = 0;
      if (t.life > 0 && !S.dead && !gone && nearBody(s.x, s.y, 0.012 * U) >= 0) { hurtDragon(10, s.x, s.y); t.life = 0; }
      if (t.life > 0) a.ink(s.x, s.y, 0.00012, 0.35);   // streak
    }
    darts = darts.filter((t) => t.life > 0);
    // guide: nothing alive on screen -> point at the nearest living enemy (Yang 11-18: cleared zone 1, saw no more enemies;
    // the zones sit ~1 screen apart with nothing to say which way)
    let near = null, nd = Infinity, seen = false;
    for (const e of ens) {
      if (e.hp <= 0) continue;
      const sx = e.x - G.camX - G.mx - G.remX, sy = e.y - G.camY - G.my - G.remY;   // CSS px
      const mg = Math.min(innerWidth, innerHeight) * 0.1;   // fully in view, not just poking in at the edge
      if (sx > mg && sx < innerWidth - mg && sy > mg && sy < innerHeight - mg) { seen = true; break; }
      const d = hyp(e.x - head.x, e.y - head.y); if (d < nd) { nd = d; near = { sx, sy }; }
    }
    ui.update(seen || S.dead || S.won || H.n ? null : near);
  }

  // ---- painting (mask: red = ink shape, blue = cloud wash) -----------------------------------------------------------------
  function mask(c) {
    const a = A(); if (!a || !U) return;
    const G = a.G, T = a.T, x0 = -0.5 * U, x1 = a.W + 0.5 * U, y0 = -0.5 * U, y1 = a.H + 0.5 * U;
    c.save();
    c.globalCompositeOperation = 'lighter';   // clouds: opaque radial gradients (mask upload isn't premultiplied)
    for (const b of banks) {
      const bx = b.x - G.camX, by = b.y - G.camY; if (bx < x0 - U || bx > x1 + U || by < y0 - U || by > y1 + U) continue;
      for (const p of b.puffs) {
        const x = bx + p.dx + Math.sin(T * 0.3 + p.ph) * p.r * 0.12, y = by + p.dy + Math.cos(T * 0.25 + p.ph) * p.r * 0.08;
        const g = c.createRadialGradient(x, y, 0, x, y, p.r); g.addColorStop(0, `rgb(0,0,${b.wall ? 170 : 120})`); g.addColorStop(1, 'rgb(0,0,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, p.r, 0, TAU); c.fill();
      }
    }
    c.globalCompositeOperation = 'source-over'; c.fillStyle = '#f00'; c.strokeStyle = '#f00'; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const e of ens) {
      if (e.hp <= 0) continue;
      const s = scr(e); if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
      const R = e.r * U, j = e.flash > 0 ? R * 0.15 : 0;   // hit: shape shudders
      const x = s.x + rnd(-j, j), y = s.y + rnd(-j, j);
      c.globalAlpha = (0.55 + 0.45 * clamp(e.hp / e.max * 1.5, 0, 1)) * (e.horde ? H.ink : 1);   // worn down = thinner ink
      if (e.k === 'wisp') {   // tadpole: head blob + tail streaming back along its motion
        const v = hyp(e.vx, e.vy) || 1, ux = -e.vx / v, uy = -e.vy / v;
        c.beginPath(); c.arc(x, y, R, 0, TAU); c.fill();
        c.lineWidth = R * 0.9; c.beginPath(); c.moveTo(x, y);
        c.quadraticCurveTo(x + ux * R * 2 + uy * Math.sin(T * 8 + e.ph) * R, y + uy * R * 2 - ux * Math.sin(T * 8 + e.ph) * R, x + ux * R * 3.2, y + uy * R * 3.2); c.stroke();
      } else if (e.k === 'crow') {   // body + flapping brush wings; wind-up = wings raised high and shaking
        const fl = e.wind ? -0.9 + Math.sin(T * 40) * 0.1 : Math.sin(e.ph) * 0.7, f = Math.sign(e.vx) || 1;
        c.beginPath(); c.ellipse(x, y, R * 0.75, R * 0.38, 0, 0, TAU); c.fill();
        c.beginPath(); c.arc(x + f * R * 0.75, y - R * 0.2, R * 0.3, 0, TAU); c.fill();   // head
        c.lineWidth = R * 0.12; c.beginPath(); c.moveTo(x + f * R, y - R * 0.2); c.lineTo(x + f * R * 1.5, y - R * 0.05); c.stroke();   // beak
        c.lineWidth = R * 0.32;
        for (const w of [-0.15, 0.2]) { c.beginPath(); c.moveTo(x + w * R, y - R * 0.1); c.quadraticCurveTo(x - f * R * 0.4, y + fl * R * 1.2, x - f * R * 1.3, y + fl * R * 1.6 + w * R); c.stroke(); }
        c.lineWidth = R * 0.25; c.beginPath(); c.moveTo(x - f * R * 0.6, y); c.lineTo(x - f * R * 1.3, y + R * 0.25); c.stroke();   // tail
      } else {   // turtle: stone dome with plate gaps, head out the front, stubby legs; tell = rears back
        const f = Math.sign(e.face) || 1, rear = e.tell ? 0.25 : 0, sp = e.spin ? Math.sin(T * 30) * 0.15 : 0;
        c.save(); c.translate(x, y); c.rotate(-f * rear + sp);
        c.beginPath(); c.ellipse(0, 0, R, R * 0.62, 0, Math.PI, TAU); c.closePath(); c.fill();   // dome
        c.fillRect(-R * 1.0, -R * 0.02, R * 2.0, R * 0.16);   // rim
        c.beginPath(); c.arc(f * R * 1.18, -R * 0.12, R * 0.26, 0, TAU); c.fill();   // head
        c.lineWidth = R * 0.24; for (const l of [-0.6, 0.5]) { c.beginPath(); c.moveTo(l * R, R * 0.12); c.lineTo(l * R + Math.sin(T * 6 + l) * R * 0.1, R * 0.42); c.stroke(); }
        c.globalCompositeOperation = 'destination-out'; c.lineWidth = R * 0.07;   // plate gaps so it reads as a shell
        c.beginPath(); c.moveTo(-R * 0.55, -R * 0.05); c.lineTo(-R * 0.35, -R * 0.5); c.moveTo(R * 0.55, -R * 0.05); c.lineTo(R * 0.35, -R * 0.5);
        c.moveTo(-R * 0.35, -R * 0.5); c.lineTo(R * 0.35, -R * 0.5); c.moveTo(0, -R * 0.05); c.lineTo(0, -R * 0.5); c.stroke();
        c.globalCompositeOperation = 'source-over'; c.restore();
      }
    }
    c.globalAlpha = 1; c.lineWidth = 0.016 * U;
    for (const t of darts) {
      const s = scr(t), l = hyp(t.vx, t.vy) || 1;
      c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - t.vx / l * 0.07 * U, s.y - t.vy / l * 0.07 * U); c.stroke();
    }
    c.restore();
  }

  function bound(dg) {   // keep the steering target inside the world: the cloud walls at the edge
    const a = A(); if (!U) return; const G = a.G;
    dg.tx = clamp(dg.tx, WB.x0 * U - G.camX, WB.x1 * U - G.camX); dg.ty = clamp(dg.ty, WB.y0 * U - G.camY, WB.y1 * U - G.camY);
  }

  // ---- player UI: ink HP stroke top centre, enemies left, end card -----------------------------------------------------------
  const ui = (() => {
    const box = document.createElement('div');
    Object.assign(box.style, { position: 'fixed', left: '50%', top: '14px', transform: 'translateX(-50%)', width: '320px', pointerEvents: 'none', zIndex: 3, font: '13px/1.3 Georgia, serif', color: '#2a2622', textAlign: 'center' });
    box.innerHTML = '<div style="height:10px;background:rgba(40,36,32,.12);border-radius:5px;overflow:hidden"><div id="ig-hp" style="height:100%;width:100%;background:#2a2622;border-radius:5px;transition:width .15s"></div></div><div id="ig-left" style="margin-top:4px;opacity:.75;white-space:pre-line"></div>' +
      // R cloud dive: two ink dots = the two charges, each fills like a pie while it comes back; the row is pale while R can't be used
      '<div id="ig-dive" style="margin-top:7px;display:flex;gap:7px;justify-content:center;align-items:center;transition:opacity .2s"><span style="opacity:.75">R</span>' +
      '<i style="width:13px;height:13px;border-radius:50%;border:1.5px solid #2a2622"></i>'.repeat(2) + '</div>';
    const veil = document.createElement('div');   // hurt: the edges of the painting darken briefly
    Object.assign(veil.style, { position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2, boxShadow: 'inset 0 0 160px 40px rgba(20,18,16,.55)', opacity: 0, transition: 'opacity .35s' });
    const end = document.createElement('div');
    Object.assign(end.style, { position: 'fixed', inset: 0, zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(242,237,228,.78)', font: '15px/1.5 Georgia, serif', color: '#2a2622', opacity: 0, transition: 'opacity .8s', pointerEvents: 'none' });
    end.innerHTML = '<div id="ig-t" style="font-size:42px;letter-spacing:.04em"></div><div id="ig-s" style="margin-top:10px;opacity:.7"></div>';
    // guide arrow: a dry-brush chevron on the screen edge, toward the nearest enemy, with how far off it is
    const arrow = document.createElement('div');
    Object.assign(arrow.style, { position: 'fixed', left: 0, top: 0, width: '0', height: '0', pointerEvents: 'none', zIndex: 3, opacity: 0, transition: 'opacity .4s', font: '13px Georgia, serif', color: '#2a2622' });
    arrow.innerHTML = '<svg id="ig-chev" width="80" height="80" viewBox="-28 -28 56 56" style="position:absolute;left:-40px;top:-40px;overflow:visible">' +
      '<path d="M-10,-17 Q4,-6 14,0 Q4,6 -10,17" fill="none" stroke="#2a2622" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>' +
      '<path d="M-20,-11 Q-8,-4 0,0 Q-8,4 -20,11" fill="none" stroke="#2a2622" stroke-width="3.5" stroke-linecap="round" opacity=".45"/></svg>' +
      '<div id="ig-dist" style="position:absolute;transform:translate(-50%,-50%);white-space:nowrap;opacity:.7"></div>';
    const add = () => { document.body.append(veil, box, end, arrow); };
    if (document.body) add(); else addEventListener('DOMContentLoaded', add);
    const q = (id) => document.getElementById(id);
    const again = () => { if ((S.dead || S.won) && A().T - S.endT > 1.2) reset(); };
    addEventListener('keydown', again); addEventListener('pointerdown', again);
    let ft = 0;
    return {
      end,
      flash() { veil.style.opacity = 1; clearTimeout(ft); ft = setTimeout(() => (veil.style.opacity = 0), 140); },
      endMsg(t, s) { q('ig-t').textContent = t; q('ig-s').textContent = s; end.style.opacity = 1; },
      update(near) {
        const hp = q('ig-hp'), left = q('ig-left'); if (!hp) return;
        hp.style.width = S.hp.toFixed(1) + '%';
        left.textContent = H.n ? `Thử bầy đàn · ${H.alive}/${H.n} con · diệt ${S.kills} · ${A().G.fps.toFixed(0)} fps
chuột lái · Q lửa · W đuôi · E cuộn · R lặn · Shift tăng tốc
[ ] số quái · , . cỡ quái (${(H.r / 0.032 * 100).toFixed(0)}%) · F4 tắt` : `Vân Sơn · còn ${S.total - S.kills}/${S.total} quái mực`;
        const dv = A().diveSt(), row = q('ig-dive'); row.style.opacity = dv.ok ? 1 : 0.4;
        dv.ch.forEach((f, i) => { const k = Math.round(f * 50) * 2, el = row.children[i + 1];
          if (el._k !== k) { el._k = k; el.style.background = k >= 100 ? '#2a2622' : `conic-gradient(rgba(42,38,34,.5) ${k}%, transparent 0)`; } });
        if (!near) { arrow.style.opacity = 0; return; }
        // on an inset ellipse round the screen centre, in the enemy's direction; pulses so it reads as a call, not a HUD part
        const cx = innerWidth / 2, cy = innerHeight / 2, ang = Math.atan2(near.sy - cy, near.sx - cx);
        const rx = cx - 80, ry = cy - 80, ex = Math.cos(ang), ey = Math.sin(ang), k = 1 / Math.max(Math.abs(ex) / rx, Math.abs(ey) / ry);
        const t = A().T, bob = Math.sin(t * 5) * 6;
        arrow.style.transform = `translate(${cx + ex * (k + bob)}px, ${cy + ey * (k + bob)}px)`;
        q('ig-chev').style.transform = `rotate(${ang}rad)`;
        const dl = q('ig-dist'); dl.style.left = (-ex * 60) + 'px'; dl.style.top = (-ey * 60) + 'px';
        dl.textContent = (Math.hypot(near.sx - cx, near.sy - cy) / innerWidth).toFixed(1) + ' màn';
        arrow.style.opacity = 0.75 + 0.25 * Math.sin(t * 5);
      },
    };
  })();

  window.InkGame = { update, mask, bound, reset, state: S, horde: H, get enemies() { return ens; }, get darts() { return darts; }, get U() { return U; } };
})();
