// DragonWallpaper — "Long Hồn Vũ Khúc" (Ink Dragon) for Wallpaper Engine
// Sumi-e fluid simulation with hidden offscreen mask (mcv/hcv -> maskTex -> stir/ink shaders).
// Light: black ink on paper, vermilion/gold fire. Dark: glowing silver smoke, neon orange/pink fire.
// Autonomous Long-Hoả -> Long Vương cycle + mouse pearl grab/throw, click-to-breathe, cursor chase/sniff, and audio reactivity.
(() => {
  const CAP_DARK = 0.88;
  const PAPER = [0.95, 0.935, 0.905], NIGHT = [0.025, 0.025, 0.045];

  // ---- configuration & presets -----------------------------------------------------------
  const QUALITY_PRESETS = {
    low: { SIM_H: 96, DYE_H: 720, MASK_H: 360, ITER: 14, S_CAP: 1.0 },
    medium: { SIM_H: 128, DYE_H: 1024, MASK_H: 480, ITER: 20, S_CAP: 1.25 },
    high: { SIM_H: 160, DYE_H: 1440, MASK_H: 540, ITER: 24, S_CAP: 1.5 },
  };
  const cfg = {
    theme: 'light',
    quality: 'medium',
    essFill: 7,
    cloudFreq: 60,
    rainLightning: true,
    calligraphy: true,
    audioReactive: true,
    dance: true,
    blackInk: true,   // dense black body core (light theme); off = the first look, mottled grey smoke
  };
  let SIM_H = 128, DYE_H = 1024, MASK_H = 480, ITER = 20, S_CAP = 1.25;
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const resolveDark = () => (cfg.theme === 'dark' ? true : cfg.theme === 'light' ? false : mq.matches);

  // ---- shaders (uv y up) ------------------------------------------------------------
  const VERT = `precision highp float; attribute vec2 a; uniform vec2 uTx;
varying vec2 v, vL, vR, vT, vB;
void main(){ v = a * .5 + .5; vL = v - vec2(uTx.x, 0.); vR = v + vec2(uTx.x, 0.); vT = v + vec2(0., uTx.y); vB = v - vec2(0., uTx.y);
  gl_Position = vec4(a, 0., 1.); }`;
  const H = 'precision highp float; varying vec2 v, vL, vR, vT, vB;\n';
  const NOISE = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
// octaves rotated against each other (~37 deg): unrotated value noise shows its square grid as blocky blotches
const mat2 RO = mat2(.8, .6, -.6, .8);
float fbm(vec2 p){ return .5 * vnoise(p) + .3 * vnoise(RO * p * 2.1 + 7.3) + .2 * vnoise(RO * RO * p * 4.3 + 1.7); }
`;
  const BIL = `vec4 bil(sampler2D s, vec2 uv, vec2 tx){
  vec2 st = uv / tx - .5, i = floor(st), f = fract(st);
  vec4 a = texture2D(s, (i + vec2(.5, .5)) * tx), b = texture2D(s, (i + vec2(1.5, .5)) * tx);
  vec4 c = texture2D(s, (i + vec2(.5, 1.5)) * tx), d = texture2D(s, (i + vec2(1.5, 1.5)) * tx);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`;
  const FS = {
    clear: H + 'uniform sampler2D t0; uniform float uK; void main(){ gl_FragColor = uK * texture2D(t0, v); }',
    splat: H + `uniform sampler2D t0; uniform float uAsp, uR; uniform vec2 uP; uniform vec4 uC;
void main(){ vec2 p = v - uP; p.x *= uAsp; gl_FragColor = vec4(texture2D(t0, v).xyz + exp(-dot(p, p) / uR) * uC.xyz, 1.); }`,
    splat4: H + `uniform sampler2D t0; uniform float uAsp; uniform vec4 uP[4], uC[4];
void main(){ vec4 a = texture2D(t0, v);
  for (int i = 0; i < 4; i++) { vec2 p = v - uP[i].xy; p.x *= uAsp; a += exp(-dot(p, p) / max(uP[i].z, 1e-6)) * uC[i] * uP[i].w; }
  float s = max(a.x, max(a.y, a.z)); a.rgb *= min(1., 5. / max(s, 1e-4));   // a long breath piles up dye without bound: cap it, keeping the hue
  a.a = clamp(a.a, 0., 3.2);
  gl_FragColor = a; }`,
    // dye laid along line segments (the gathering wisps). uA = start.xy, end.zw; uC = colour, w = radius. A thin core with a
    // faint wide veil; along the segment the weight ramps over +-sqrt(r) past each end, so chained segments add up to one even
    // stroke (round caps doubled up at every joint: a string of beads)
    seg4: H + `uniform sampler2D t0; uniform float uAsp; uniform vec4 uA[4], uC[4];
void main(){ vec4 a = texture2D(t0, v);
  for (int i = 0; i < 4; i++) { vec2 pa = v - uA[i].xy, ba = uA[i].zw - uA[i].xy; pa.x *= uAsp; ba.x *= uAsp;
    float L = max(length(ba), 1e-5), r = max(uC[i].w, 1e-7), e = sqrt(r); vec2 u = ba / L;
    float s = dot(pa, u), d = pa.x * u.y - pa.y * u.x;
    float al = clamp((s + e) / (2. * e), 0., 1.) * clamp((L - s + e) / (2. * e), 0., 1.);
    a.rgb += uC[i].rgb * al * (exp(-d * d / r) + .22 * exp(-d * d / (r * 9.))); }
  float s = max(a.x, max(a.y, a.z)); a.rgb *= min(1., 5. / max(s, 1e-4));
  gl_FragColor = a; }`,
    advect: H + BIL + `uniform sampler2D t0, t1; uniform vec2 uSrcTx, uVelTx; uniform float uDt, uDiss, uManual;
void main(){
  vec2 vel = uManual > .5 ? bil(t0, v, uVelTx).xy : texture2D(t0, v).xy;
  vec2 c = v - uDt * vel * uVelTx;
  vec4 r = uManual > .5 ? bil(t1, c, uSrcTx) : texture2D(t1, c);
  gl_FragColor = r / (1. + uDiss * uDt);
}`,
    divergence: H + `uniform sampler2D t0;
void main(){
  float l = texture2D(t0, vL).x, r = texture2D(t0, vR).x, t = texture2D(t0, vT).y, b = texture2D(t0, vB).y;
  vec2 c = texture2D(t0, v).xy;
  if (vL.x < 0.) l = -c.x; if (vR.x > 1.) r = -c.x; if (vT.y > 1.) t = -c.y; if (vB.y < 0.) b = -c.y;
  gl_FragColor = vec4(.5 * (r - l + t - b), 0., 0., 1.);
}`,
    curl: H + `uniform sampler2D t0;
void main(){
  float l = texture2D(t0, vL).y, r = texture2D(t0, vR).y, t = texture2D(t0, vT).x, b = texture2D(t0, vB).x;
  gl_FragColor = vec4(.5 * (r - l - t + b), 0., 0., 1.);
}`,
    vorticity: H + `uniform sampler2D t0, t1; uniform float uCurl, uDt, uCMax;
void main(){
  float l = texture2D(t1, vL).x, r = texture2D(t1, vR).x, t = texture2D(t1, vT).x, b = texture2D(t1, vB).x, c = texture2D(t1, v).x;
  vec2 f = .5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
  float edgeD = min(min(v.x, 1. - v.x), min(v.y, 1. - v.y));
  float nearW = 1. - smoothstep(.0, .18, edgeD);
  f /= length(f) + .0001; f *= uCurl * clamp(c, -uCMax * (1. + nearW), uCMax * (1. + nearW)); f.y *= -1.;   // capped: in the jet's shear layer the curl is huge and the confinement blew cell-sized eddies up into noise
  // screen edge = solid wall (Yang 11-17: fire hitting it must splat, split along the wall and roll back in curls). The old
  // .68 sponge over 4.5% ate the jet before it reached the wall. Now only a thin, mild sponge, and the roll-up eddies that
  // peel off the wall get extra confinement so they read as curls
  f *= 1. + 2.4 * nearW * smoothstep(.5, 4., abs(c));
  float sponge = pow(mix(.93, 1., smoothstep(0., .012, edgeD)), clamp(uDt * 30., .15, 1.5));
  vec2 vel = (texture2D(t0, v).xy + f * uDt) * sponge;
  gl_FragColor = vec4(clamp(vel, -1000., 1000.), 0., 1.);
}`,
    // velocity the dye rides on: where the flow is fast (the fire jet) it is averaged over ~3 cells. The jet moves many cells a
    // frame, so cell-sized noise in the velocity shredded the fire into marbled filaments every frame (Yang 11-17: fire looks
    // wormy). Slow smoke keeps the raw field and all its detail. Done once on the small sim grid, not per dye pixel
    // also wherever fire is (dilated 3 cells): slow fire at the jet's edge rode the raw field, whose odd/even cell noise printed a
    // checkerboard along the flame edge (Yang 11-17: centre smooth, edge pixelated). Smoke away from fire keeps full detail
    vsm: H + `uniform sampler2D t0, t1; uniform vec2 uSmR; uniform float uDk;
float fireAt(vec2 p){ vec3 d = max(texture2D(t1, p).rgb, 0.); float s = max(d.r, max(d.g, d.b));
  float f = uDk > .5 ? (d.r - d.b) / (s + 1e-4) - .15 : (d.g - d.r - .28 * max(d.b - d.g, 0.)) / (s + 1e-4);
  return clamp(f * 2., 0., 1.) * smoothstep(.01, .08, s); }
void main(){
  vec2 c = texture2D(t0, v).xy;
  vec2 ex = vec2(vR.x - v.x, 0.) * 3., ey = vec2(0., vT.y - v.y) * 3.;
  float fire = max(max(fireAt(v), max(fireAt(v + ex), fireAt(v - ex))), max(max(fireAt(v + ey), fireAt(v - ey)), max(fireAt(v + ex + ey), fireAt(v - ex - ey))));
  float w = max(smoothstep(uSmR.x, uSmR.y, length(c)), fire);
  // near the screen-edge wall the fire keeps the raw field: the averaging erased the roll-back curls the wall peels off
  w *= mix(.75, 1., smoothstep(.03, .2, min(min(v.x, 1. - v.x), min(v.y, 1. - v.y))));   // only a little: much less and the wall film printed the cell checkerboard again
  vec2 dx = vec2(vR.x - v.x, 0.) * 3.5, dy = vec2(0., vT.y - v.y) * 3.5;
  vec2 a = (texture2D(t0, v + dx).xy + texture2D(t0, v - dx).xy + texture2D(t0, v + dy).xy + texture2D(t0, v - dy).xy
    + texture2D(t0, v + dx + dy).xy + texture2D(t0, v - dx - dy).xy + texture2D(t0, v + dx - dy).xy + texture2D(t0, v - dx + dy).xy) * .125;
  gl_FragColor = vec4(mix(c, a, w), 0., 1.);
}`,
    pressure: H + `uniform sampler2D t0, t1;
void main(){
  float l = texture2D(t0, vL).x, r = texture2D(t0, vR).x, t = texture2D(t0, vT).x, b = texture2D(t0, vB).x;
  gl_FragColor = vec4((l + r + b + t - texture2D(t1, v).x) * .25, 0., 0., 1.);
}`,
    gradient: H + `uniform sampler2D t0, t1;
void main(){
  float l = texture2D(t0, vL).x, r = texture2D(t0, vR).x, t = texture2D(t0, vT).x, b = texture2D(t0, vB).x;
  vec2 u = texture2D(t1, v).xy - vec2(r - l, t - b);
  // no-penetration wall at the screen edge: the normal component dies in the boundary ring, tangential slides free
  if (vL.x < 0. || vR.x > 1.) u.x = 0.;
  if (vB.y < 0. || vT.y > 1.) u.y = 0.;
  gl_FragColor = vec4(u, 0., 1.);
}`,
    // velocity: mask edges curl and push outward -> the outline keeps smoking off
    stir: H + NOISE + `uniform sampler2D t0, t1; uniform float uAmp, uT, uDt;
void main(){
  vec2 vel = texture2D(t0, v).xy;
  float l = texture2D(t1, vL).r, r = texture2D(t1, vR).r, t = texture2D(t1, vT).r, b = texture2D(t1, vB).r;
  vec2 g = vec2(r - l, t - b);
  float n = fbm(v * 9. + vec2(uT * .35, -uT * .22)) * 2. - 1.;
  vec2 f = vec2(-g.y, g.x) * n * 2.0 - g * .7;
  vec4 mc = texture2D(t1, v); float m = mc.r;
  // Long Vương's antler (mask R+G) churns at its own outline too, and is not calmed inside, so its gold ink smokes like the body's edge
  vec4 cL = texture2D(t1, vL), cR = texture2D(t1, vR), cT = texture2D(t1, vT), cB = texture2D(t1, vB);
  vec2 gc = vec2(min(cR.r, cR.g) - min(cL.r, cL.g), min(cT.r, cT.g) - min(cB.r, cB.g));
  float c = min(mc.r, mc.g);
  f += vec2(-gc.y, gc.x) * n * 3. + gc * .5;
  float damp = pow(1. - m * .6 * (1. - c * .8), clamp(uDt * 30., .15, 1.5));
  gl_FragColor = vec4(clamp((vel + f * uAmp * uDt * 60.) * damp, -1000., 1000.), 0., 1.);   // calm inside the body, turbulent at its edge
}`,
    // dye: re-ink inside the mask toward the body colour, brush-textured
    ink: H + NOISE + BIL + `uniform sampler2D t0, t1, t2; uniform vec3 uInk, uGold, uEyeInk; uniform vec2 uVelTx, uDyeTx, uEye; uniform float uK, uT, uDk, uManual, uDiff, uEyeR, uAsp, uEyeA, uBody, uBodyK;
float fireOf(vec3 d){ return clamp(((uDk > .5 ? d.r - d.b : max(d.g, d.b) - d.r) / (max(d.r, max(d.g, d.b)) + 1e-4) - .04) * 1.35, 0., 1.); }
void main(){
  vec4 d = texture2D(t0, v);
  float ds = max(d.r, max(d.g, d.b));
  vec4 gm0 = texture2D(t1, v), gm1 = texture2D(t1, v + vec2(.012, 0.)), gm2 = texture2D(t1, v - vec2(.012, 0.)), gm3 = texture2D(t1, v + vec2(0., .012)), gm4 = texture2D(t1, v - vec2(0., .012));
  float goldM = smoothstep(.1, .45, max(min(gm0.r, gm0.g), max(max(min(gm1.r, gm1.g), min(gm2.r, gm2.g)), max(min(gm3.r, gm3.g), min(gm4.r, gm4.g)))));
  float fire = fireOf(d.rgb) * (1. - goldM);
  // fire diffuses like smoke. Advection alone keeps every fold of the jet razor sharp, which showed as marbled, wormy bands with
  // hard contours (Yang 11-17). Wide cross blur, turned and resized each frame so no wavelength survives, weighted by the fire in
  // the pixel OR round it: a pixel with no dye yet has to take fire from its neighbours or the outer edge stays a cut line
  {
    float a = hash(vec2(uT * 91.7, 3.1)) * 1.5708, rr = .9 + 2.2 * hash(vec2(7.7, uT * 57.3));
    vec2 o1 = vec2(cos(a), sin(a)) * rr * uDyeTx, o2 = vec2(-sin(a), cos(a)) * rr * uDyeTx;
    vec4 dn4 = (texture2D(t0, v + o1) + texture2D(t0, v - o1) + texture2D(t0, v + o2) + texture2D(t0, v - o2)) * .25;
    float fn = fireOf(dn4.rgb) * (1. - goldM);
    d.rgb = mix(d.rgb, dn4.rgb, max(fire, fn) * clamp(uK * uDiff, 0., .45));
    float ea_n = clamp(max(d.a, dn4.a) * 1.2, 0., 1.);
    if (ea_n > .005) {
      vec2 v_dir = texture2D(t2, v).xy * uVelTx;
      vec2 v_smear = clamp(v_dir * .024, vec2(-.015), vec2(.015));
      float a_smear = (dn4.a + texture2D(t0, v - v_smear * .5).a + texture2D(t0, v - v_smear).a + texture2D(t0, v - v_smear * 1.5).a + texture2D(t0, v + v_smear * .5).a) * .2;
      d.a = mix(d.a, a_smear, clamp(.65 + ea_n * .30, 0., .92));
    }
    ds = max(d.r, max(d.g, d.b));
    // burn-out goes by the fire round the pixel, not in it: judged per pixel it ate the fire-rich layers of a fire/ink mix and
    // left the rest standing, which carved contour lines between them
    fire = max(fireOf(d.rgb), fn) * (1. - goldM);
  }
  // speed read wide (5 taps, 2.5 sim cells apart) and the stagnant burn-out kept gentle: read at one cell with a steep ramp, the
  // patchy speed of the turbulent jet end burnt the fire into crumbs the size of the velocity grid
  vec2 sx = vec2(uVelTx.x * 2.5, 0.), sy = vec2(0., uVelTx.y * 2.5);
  float spd = uManual > .5
    ? (length(bil(t2, v, uVelTx).xy) + length(bil(t2, v + sx, uVelTx).xy) + length(bil(t2, v - sx, uVelTx).xy) + length(bil(t2, v + sy, uVelTx).xy) + length(bil(t2, v - sy, uVelTx).xy)) * .2
    : (length(texture2D(t2, v).xy) + length(texture2D(t2, v + sx).xy) + length(texture2D(t2, v - sx).xy) + length(texture2D(t2, v + sy).xy) + length(texture2D(t2, v - sy).xy)) * .2;
  float edgeD = min(min(v.x, 1. - v.x), min(v.y, 1. - v.y));
  float still = (1. - smoothstep(12., 120., spd)) * .4 * mix(.3, 1., smoothstep(.03, .2, edgeD));   // fire sliding along the wall is slow by nature: let it live to roll back
  float wall = (1. - smoothstep(0., .012, edgeD)) * .35;   // was 4.5% band at full kill: the fire died before it could splat along the wall
  float killF = fire * max(still, wall);
  // fast path: far from the silhouette (beyond the noise warp reach) only the thinning applies; skips 4 fbm calls on most of the screen
  vec4 n0 = texture2D(t1, v) + texture2D(t1, v + vec2(.035, 0.)) + texture2D(t1, v - vec2(.035, 0.)) + texture2D(t1, v + vec2(0., .035)) + texture2D(t1, v - vec2(0., .035));
  float near = n0.r + n0.b;
  if (near < .002) {
    float fk = clamp(uK, 0., 1.);
    vec3 fd = d.rgb * (1. - fk * (.45 + killF * 1.85));
    float fa_e = max(d.a, 0.) * (1. - fk * (.95 + still * 1.45));
    gl_FragColor = vec4(fd, fa_e); return;   // decay only: a constant subtract here cut hard-edged holes into the fire
  }
  vec2 wv =v + (vec2(fbm(v * 14. + uT * .2), fbm(v * 14. + 5.2 - uT * .17)) - .5) * .025;
  // mask read through a small 5-tap blur: at 480 px the hidden skeleton's edges were crisp enough to show through the ink
  vec2 ox = vec2(vR.x - v.x, 0.) * 2.5, oy = vec2(0., vT.y - v.y) * 2.5;
  vec4 mm = (texture2D(t1, wv) * 2. + texture2D(t1, wv + ox) + texture2D(t1, wv - ox) + texture2D(t1, wv + oy) + texture2D(t1, wv - oy)) / 6.;
  float m = mm.r;
  // the eye and the clouds share mask blue. Near the eye, the cloud level is read on a ring just outside the eye (lowest of 6
  // taps: the eye can reach some of them, the cloud covers all) and taken off, so only the eye's own blue lights the eye. Without
  // it, Long Vương diving into a cloud lit the whole eye area as one big gold disc (Yang 11-17). Soft area edge, no step
  float isEyeArea = (1. - smoothstep(2.2, 2.6, length((v - uEye) * vec2(uAsp, 1.)) / max(uEyeR, 1e-5))) * step(.01, uEyeA);
  float cloudB = 1.;
  if (isEyeArea > 0.) for (int i = 0; i < 6; i++) { float a = float(i) * 1.0472; cloudB = min(cloudB, texture2D(t1, uEye + vec2(cos(a) / uAsp, sin(a)) * uEyeR * 2.4).b); }
  // second test: the eye is cut out of the head ink (red gone), a cloud over the head leaves the red in place
  float eyeOnly = max(mm.b * (1. - smoothstep(.3, .8, texture2D(t1, wv).r)) - cloudB, 0.) / max(1. - cloudB, .2);   // red read unblurred: the eye is only a few texels
  vec4 b1 = texture2D(t1, wv + ox * 2.8), b2 = texture2D(t1, wv - ox * 2.8), b3 = texture2D(t1, wv + oy * 2.8), b4 = texture2D(t1, wv - oy * 2.8);
  float eyeBroad = max((b1.b * (1. - smoothstep(.3, .8, b1.r)) + b2.b * (1. - smoothstep(.3, .8, b2.r)) + b3.b * (1. - smoothstep(.3, .8, b3.r)) + b4.b * (1. - smoothstep(.3, .8, b4.r))) * .25 - cloudB, 0.) / max(1. - cloudB, .2);
  // * uEyeA: as the head sinks into a cloud the eye ink fades with it (Yang 11-17: a round glowing blob, the eye, stayed lit
  // inside the cloud: isEyeArea only switches off at uEyeA < .01, so the eye kept painting at full strength until then)
  float eyeM = clamp(max(eyeOnly, eyeBroad * .88) * isEyeArea * (1. - smoothstep(.45, .96, m) * .55), 0., 1.) * smoothstep(.0, .6, uEyeA);
  float cb = mm.b * (1. - isEyeArea) + min(mm.b, cloudB) * isEyeArea;   // the cloud carries on through the eye area
  // Long Vương's antler (mask yellow = R+G): inked like the body, same brush and smoke, but in gold ink (Yang: it has to be ink too)
  // wide, warped, patchy: sampled through a 2x larger blur and broken up by the streak noise, so the gold bleeds into the black
  // and drifts instead of tracing the antler's outline
  vec2 cwv = wv + (vec2(fbm(v * 22. - uT * .3), fbm(v * 22. + 3.1 + uT * .25)) - .5) * .03;
  vec4 cm4 = (texture2D(t1, cwv) * 2. + texture2D(t1, cwv + ox * 2.) + texture2D(t1, cwv - ox * 2.) + texture2D(t1, cwv + oy * 2.) + texture2D(t1, cwv - oy * 2.)) / 6.;
  float cw = smoothstep(.15, .75, min(cm4.r, cm4.g)) * (.45 + .55 * fbm(v * 18. + vec2(uT * .15, -uT * .1)));
  vec3 ink = mix(uInk, uGold, cw);
  float e = clamp(abs(texture2D(t1, v + ox).r - texture2D(t1, v - ox).r) + abs(texture2D(t1, v + oy).r - texture2D(t1, v - oy).r), 0., 1.);
  float eye_e = isEyeArea * (1. - cloudB) * smoothstep(.0, .6, uEyeA) * clamp(abs(texture2D(t1, v + ox).b - texture2D(t1, v - ox).b) + abs(texture2D(t1, v + oy).b - texture2D(t1, v - oy).b), 0., 1.);
  float streak = smoothstep(.25, .85, fbm(RO * vec2(v.x * 16., v.y * 9.) + vec2(uT * .12, -uT * .07)));
  float grain = vnoise(RO * RO * v * 90. + uT * .3) - .5;   // fine ink grain so the inside reads as brushwork, not soft clouds
  float wisp = smoothstep(.4, .8, fbm(v * 30. + vec2(uT * .4, -uT * .3)));
  float bristle = smoothstep(.35, .75, vnoise(RO * v * vec2(260., 38.) + vec2(uT * .05, 0.)));   // dry brush: long thin bristle gaps
  float rim = smoothstep(.12, .45, m) * (1. - smoothstep(.45, .8, m));
  // uBody: the core of the body is dense black ink. The pattern alone averaged k ~1.6 with patches down to ~1.1, and the moving
  // body never reached even that: mid-grey, never black (Yang 11-18: "xám xám bẩn bẩn"). Core only (m > ~.5), and it fills
  // faster there (uBodyK): the edge stays thin smoke
  vec3 tgt = ink * mix(.72 + .7 * streak + .3 * grain, 1.5 + .3 * streak + .12 * grain, uBody * smoothstep(.45, .95, m)) * (uDk > .5 ? 1. : 1.15)   /* one tone: Yang 11-16 dropped back/belly, the smoke is there to hide the skeleton */ * (1. - rim * (1. - bristle) * .6);
  vec3 eyeTgt = uEyeInk * (.78 + .55 * streak + .22 * grain) * (.85 + .3 * wisp);
  float k = clamp(uK, 0., 1.);
  float m_comb = max(m, eyeM);
  vec3 o = d.rgb * (1. - (1. - m_comb) * k * (.45 + killF * 1.85));          // outside the silhouette stagnant/wall fire burns out fast
  float ink_mix = clamp(smoothstep(.12, .9, m) * k * 2. * (1. + uBodyK * smoothstep(.5, .95, m)), 0., 1.) * (1. - fire * .82);
  o = mix(o, tgt, ink_mix);            // inside it is pulled back to the brush pattern: shape holds
  o = mix(o, eyeTgt, clamp(smoothstep(.06, .62, eyeM) * k * 2.6, 0., 1.));
  // cloud (mask blue): a paler, billowing wash held in place the same way as the body
  float bill = fbm(v * 7. + vec2(uT * .05, -uT * .03));
  o = mix(o, uInk * (.25 + .55 * bill), clamp(smoothstep(.04, .8, cb) * k * 1.5, 0., 1.));
  vec3 rimGlow = max(ink * e * 1.3 * wisp - o, 0.) + max(uEyeInk * eye_e * 1.15 * wisp - o, 0.);
  float eye_src = smoothstep(.04, .58, eyeM) * (.90 + .45 * wisp + .22 * streak) * 1.40 * uEyeA;
  float detached = 1. - smoothstep(.02, .35, eyeM);
  float ea = max(d.a, 0.) * (1. - k * (1.25 + m * (3. + 2.2 * detached) + still * 1.15));
  ea = clamp(mix(ea, max(ea, eye_src), clamp(smoothstep(.05, .58, eyeM) * k * 4.8, 0., 1.)), 0., 2.2);
  // eye already left in the dye where the head now sits in a cloud: wash it out fast, colour and glow both
  float hidEye = (1. - smoothstep(2.2, 3.4, length((v - uEye) * vec2(uAsp, 1.)) / max(uEyeR, 1e-5))) * (1. - smoothstep(.0, .6, uEyeA));
  ea *= 1. - hidEye * .25;
  o = mix(o, uInk * (.25 + .55 * bill), hidEye * k * .5 * smoothstep(.04, .8, mm.b));
  gl_FragColor = vec4(o + rimGlow * k, ea);   // edge wisps: soft, or they trace the skeleton
}`,
    display: H + NOISE + BIL + `uniform sampler2D t0, t1, t2, t3; uniform float uLand; uniform vec2 uLandS, uDyeTx; uniform float uDark, uCap, uT, uAsp, uEyeR, uEyeA, uCalli, uManual; uniform vec2 uEye; uniform vec4 uGape, uPearl; uniform vec2 uPK; uniform vec3 uBg, uInk; uniform vec3 uRing; uniform vec4 uStorm; uniform float uBoltY; uniform vec4 uKing, uGlow; uniform vec2 uMud;
float gp(vec2 p){ vec4 t = texture2D(t1, p); return t.g * (1. - t.r); }
void main(){
  vec4 dye4 = uManual > .5 ? bil(t0, v, uDyeTx) : texture2D(t0, v);
  vec3 d = max(dye4.rgb, 0.);
  float eg = max(dye4.a, 0.);
  vec3 col;
  // paper with calligraphy (r) and a red seal (g), dry-brush broken; the smoke drifts over it
  vec4 cg = uCalli > .5 ? texture2D(t2, v) : vec4(0.);
  vec3 bg = uBg;
  if (uLand > .5) {   // landscape, cover-fit, bottom-anchored (mountains sit low). Light: the painting is the paper, tinted
    // to the theme's paper. Dark: inverted to faint moonlit grey ridges on the night
    vec3 im = texture2D(t3, vec2(.5 + (v.x - .5) * uLandS.x, v.y * uLandS.y)).rgb;
    float m = clamp((.975 - dot(im, vec3(.3, .59, .11))) / .4, 0., 1.);
    bg = uDark > .5 ? uBg + vec3(.085, .092, .12) * m : im * uBg / vec3(.985, .972, .94);
  }
  // Long Vương storm (uKing.y): the paper goes lead-grey, the night darker
  bg *= uDark > .5 ? vec3(1. - .45 * uKing.y) : mix(vec3(1.), vec3(.5, .52, .58), uKing.y);
  // lightning (uStorm.x = flash, y = strike x in aspect units, z = seed): the sky flashes and a jagged bolt cracks down from
  // the top, behind the smoke so the dragon stands dark against it. Ink-brush bolt: wobbly core, soft bloom, a side fork
  if (uStorm.x > .01) {
    vec2 pv = v * vec2(uAsp, 1.); float yy = 1. - v.y, top = 1. - uBoltY;
    float bx = uStorm.y + (fbm(vec2(yy * 7., uStorm.z)) - .5) * .22 + (vnoise(vec2(yy * 38., uStorm.z + 3.)) - .5) * .035;
    float fade = smoothstep(top + .04, top - .06, yy);   // dies out at its end
    float dx = abs(pv.x - bx), core = exp(-dx * dx / 5e-6) * fade, bloom = exp(-dx * 24.) * fade;
    float fy = top * .45, fk = step(fy, yy) * smoothstep(top * .85, fy, yy);   // fork leaves the bolt halfway down
    float fx = uStorm.y + (fbm(vec2(fy * 7., uStorm.z)) - .5) * .22 + (yy - fy) * .55 + (vnoise(vec2(yy * 40., uStorm.z + 8.)) - .5) * .03;
    float fdx = abs(pv.x - fx); core = max(core, exp(-fdx * fdx / 3e-6) * fk * .8); bloom = max(bloom, exp(-fdx * 30.) * fk * .6);
    float sky = .55 + .45 * exp(-length(vec2(pv.x - uStorm.y, yy) * vec2(1., 1.6)) * 1.5);   // brightest round the strike
    vec3 lc = uDark > .5 ? vec3(.78, .84, 1.) : vec3(1., 1., .98);
    float occ = 1. - smoothstep(.08, .5, max(d.r, max(d.g, d.b)));   // the bolt stays behind the dragon (dark mode adds smoke over bg)
    bg = mix(bg, lc, clamp(uStorm.x * (sky * (uDark > .5 ? .35 : .55) + (bloom * .5 + core) * occ), 0., 1.));
  }
  if (cg.r + cg.g > .004) {   // noise only where there is writing
    vec2 pv = v * vec2(uAsp, 1.);
    float dry = smoothstep(.18, .62, vnoise(pv * vec2(90., 420.)) * .6 + vnoise(pv * 260.) * .4);
    float ink = cg.r * mix(.35, 1., dry), seal = cg.g * mix(.7, 1., vnoise(pv * 300.));
    bg = uDark > .5 ? bg + vec3(.075, .078, .095) * ink : bg * (1. - ink * .2);
    bg = mix(bg, uDark > .5 ? vec3(.42, .06, .05) : vec3(.74, .13, .08), seal * (uDark > .5 ? .55 : .7));
  }
  vec4 mk_val = texture2D(t1, v);
  float hornOcc = smoothstep(.08, .35, mk_val.r * mk_val.g);
  if (uDark > .5) {
    float s = max(d.r, max(d.g, d.b));
    float df = clamp(((d.r - d.b) / (s + 1e-4) - .15) * 1.6, 0., 1.);
    vec3 h = pow(d / (s + .0001), vec3(mix(2.6, 1.9, df)));
    float b = 1. - exp(-s * 4.5);
    float fCurl = .86 + .28 * fbm(v * vec2(uAsp, 1.) * 14. + vec2(uT * 2.4, -uT * 1.8));
    float bH = clamp(b * fCurl, 0., 1.);
    vec3 fireCore = mix(vec3(1., .62, .12), vec3(1., .82, .24), uKing.x);
    vec3 fireWhite = mix(vec3(1., .92, .58), vec3(1., .97, .74), uKing.x);
    vec3 g = h * b + fireCore * pow(bH, 2.8) * df * (1. - hornOcc) * .55 + fireWhite * pow(bH, 5.5) * df * (1. - hornOcc) * .45 + vec3(pow(b, 6.) * .28);
    col = bg + clamp(g, 0., 1.) * (1. - bg);
    col *= uCap; col = max(col, bg);
  } else {
    float s = max(d.r, max(d.g, d.b)), sk = s < 1.5 ? s : 1.5 + 1.3 * (1. - exp(-(s - 1.5) / 1.3));
    vec3 k = d * (sk / max(s, 1e-4));
    col = bg * exp(-k);
    vec3 kf = max(k - vec3(min(k.r, min(k.g, k.b))), 0.);
    float fa = 1. - exp(-max(kf.g, kf.b) * uMud.x);
    col = mix(col, bg * exp(-kf - (k - kf) * uMud.y), fa * smoothstep(.02, .3, k.r) * (1. - uKing.x * .35));
    // smooth continuous blackbody radiance over broad fire dye (no hard cutoffs, ignores blue-heavy antlers)
    float fireCol = max(d.g - d.r - .28 * max(d.b - d.g, 0.), 0.) * (1. - hornOcc);
    if (fireCol > .01) {
      float fl = 1. - exp(-fireCol * 1.45);
      float fCurl = .84 + .32 * fbm(v * vec2(uAsp, 1.) * 14. + vec2(uT * 2.4, -uT * 1.8));
      float fH = clamp(fl * fCurl, 0., 1.15);
      vec3 fRed = mix(vec3(1., .24, .02), vec3(.88, .11, .04), uKing.x);
      vec3 fGold = mix(vec3(1., .68, .10), vec3(1., .24, .06), uKing.x);
      vec3 fWhite = mix(vec3(1., .93, .56), vec3(1., .62, .26), uKing.x);
      col = mix(col, fRed, clamp(pow(fl, 1.15) * .76, 0., .82));
      col = mix(col, fGold, clamp(pow(fH, 1.95) * mix(.85, .78, uKing.x), 0., .88));
      col = mix(col, fWhite, clamp(pow(fH, 3.8) * mix(.78, .58, uKing.x), 0., .82));
    }
    col *= mix(.97, 1., smoothstep(1.25, .35, length(v - .5)));
  }
  // Long Vương (uKing.x): gilt ink. The thin smoke (edges, wisps, the trail) takes a shimmering gold leaf; dense ink stays black,
  // so it reads as gold-flecked sumi-e rather than a yellow dragon
  if (uKing.x > .01) {
    float s = max(d.r, max(d.g, d.b)), mk = texture2D(t1, v).r;
    // never read the mask's edge for this: a gold band along it drew the hidden skeleton. Only the smoke itself is gilt
    float wsp = smoothstep(.04, .25, s) * (1. - smoothstep(.5, 1.2, s)) * (1. - smoothstep(.15, .55, mk));   // thin smoke off the body
    vec2 pv = v * vec2(uAsp, 1.);
    // gold-leaf flecks. Rotated fbm, soft threshold: plain value noise at 110/screen cut hard showed its lattice as ~10 px
    // squares (Yang: fire looks pixelated - fire thins the smoke, so the flecks crowd round it)
    float fleck = smoothstep(.42, .78, fbm(RO * pv * 48. + vec2(uT * .25, -uT * .2)) * .7 + fbm(RO * RO * pv * 17. - uT * .12) * .3);
    // only grey ink gets the gold leaf: fire dye is strongly coloured (light: green/blue taken, red kept). Flecked fire read as
    // a speckled mess (Yang: looks like vomit)
    float neutral = 1. - smoothstep(.15, .5, (max(d.g, d.b) - d.r) / (s + 1e-4));
    float g = clamp(wsp * (.25 + fleck) * uKing.x * neutral, 0., 1.);
    // dark: never add light here. Adding it lit the thin band hugging the mask edge into a glittering outline of the body
    // (Yang: dark king looks exposed). Only tint the smoke already there, broad soft patches, nothing at the mask edge
    if (uDark > .5) {
      float soft = smoothstep(.5, .75, fbm(pv * 9. + vec2(uT * .1, -uT * .08))) * (1. - smoothstep(.02, .2, mk));
      vec3 sm = max(col - bg, 0.); col = bg + mix(sm, sm * vec3(1.25, .95, .45), clamp(soft * smoothstep(.04, .3, s) * uKing.x * .8, 0., 1.));
    } else {
      col = mix(col, vec3(.9, .68, .24), g * .5);
      // the gold ink itself (antler, gilt smoke): absorbance on grey paper reads khaki, so it is lit toward leaf gold. Read off the
      // dye hue only, never the mask; fire (display fire test) is left alone
      float fc = max(d.g - d.r - .28 * max(d.b - d.g, 0.), 0.);
      float gi = (1. - neutral) * (1. - smoothstep(0., .06, fc)) * smoothstep(.05, .35, s);
      col = mix(col, vec3(.98, .76, .22) * (.78 + .3 * fleck), clamp(gi * .55 * uKing.x, 0., .85));
    }
  }
  // the antler gets no overlay here: it is gold ink in the fluid only (ink pass), veiled by smoke like the body. A gold sheen
  // drawn from the mask showed its silhouette crisp (Yang: hide it like the body)
  // gold light in the body (swallow / glow / cocoon): xy = pos, z = radius, w = amount
  if (uGlow.w > .01) {
    vec2 gq = (v - uGlow.xy) * vec2(uAsp, 1.); float gg = exp(-dot(gq, gq) / (uGlow.z * uGlow.z)) * uGlow.w;
    if (uDark > .5) col += vec3(1., .8, .4) * gg * .8; else col = mix(col, vec3(1., .82, .42), clamp(gg * .75, 0., .75));
  }
  // rain (uStorm.w): sumi-e rain — drifting squalls, wind gust, 3 depth layers with ink-tapered strokes, mist veil, splash & lightning catch
  if (uStorm.w > .01) {
    vec2 pv = v * vec2(uAsp, 1.);
    float gust = .13 + .08 * sin(uT * .27) + .04 * sin(uT * .63 + 1.4);
    float patchN = fbm(vec2(pv.x * 2.1 - uT * .16, pv.y * 1.1 + uT * .20));
    float band = smoothstep(.24, .78, patchN);
    float mist = .6 * patchN + .4 * vnoise(RO * vec2(pv.x * 3.8 + pv.y * gust * 1.6 - uT * .28, pv.y * 1.8 + uT * .38));
    float veil = smoothstep(.34, .84, mist) * smoothstep(.96, .12, v.y);
    float rn = 0.;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float scX = 165. - fi * 58. + fi * fi * 2.5;
      float scY = 5.2 - fi * 1.72;
      float spd = 1.5 + fi * 1.35;
      float hw0 = .145 - fi * .018;
      float wt = .34 + fi * .28;
      float tilt = gust * (.72 + .14 * fi);
      vec2 q = vec2(pv.x + pv.y * tilt, pv.y) * vec2(scX, scY);
      float ix = floor(q.x), fx = fract(q.x);
      float colH = hash(vec2(ix + fi * 37.1, 4.3));
      q.y += uT * spd * (.82 + .36 * colH) + colH * 19.7;
      float iy = floor(q.y), fy = fract(q.y);
      float h1 = hash(vec2(ix * 1.13 + fi * 17.3, iy * 1.71 + 3.7));
      float h2 = hash(vec2(ix * 2.41 + 9.2, iy * 1.37 + fi * 23.1));
      float h3 = hash(vec2(ix * 3.17 + fi * 11.9, iy * 2.13 + 7.4));
      float h4 = fract(h1 * 17.3 + h2 * 31.7);
      float dens = mix(.28 - fi * .09, .70 - fi * .19, band);
      float on = smoothstep(1. - dens, 1. - dens + .08, h3) * (.48 + .52 * h2);
      float y0 = .05 + .22 * h2, len = .28 + .40 * h4;
      float u = clamp((fy - y0) / max(len, 1e-3), 0., 1.);
      float maskY = step(y0, fy) * step(fy, y0 + len);
      float jx = .5 + (h1 - .5) * .64 + (fy - .5) * (h2 - .5) * .04;
      float hw = hw0 * (.82 + .36 * h4) * mix(1.08, .28, pow(u, .75));
      float dx = abs(fx - jx);
      float taper = smoothstep(0., .08, u) * smoothstep(1., .15, u) * mix(1., .18, pow(u, 1.15)) * maskY;
      rn += on * smoothstep(hw, hw * .30, dx) * taper * wt;
    }
    if (v.y < .07) {
      float sp = smoothstep(.07, .0, v.y) * smoothstep(.52, .85, fbm(vec2(pv.x * 42. - uT * .5, v.y * 90. + uT * 3.2)));
      rn += sp * .32;
    }
    float flash = 1. + uStorm.x * 1.4;
    rn = clamp(rn * flash, 0., 1.) * uStorm.w;
    veil *= uStorm.w;
    if (uDark > .5) col += vec3(.62, .70, .82) * (rn * .38 + veil * .075 * flash);
    else col *= mix(vec3(1.), vec3(.60, .63, .68), clamp(rn * .85 + veil * .22, 0., 1.));
  }
  // fluid-advected smoky dragon eye + motion light trail (single pure red / gold hue, no pupil cutout)
  if (eg > .002) {
    vec3 eyeCol = mix(vec3(.95, .05, .01), vec3(.95, .62, .02), uKing.x);
    vec3 eyeMid = mix(vec3(1., .14, .02), vec3(1., .80, .06), uKing.x);
    vec3 eyeHot = mix(vec3(1., .24, .04), vec3(1., .88, .16), uKing.x);
    float pulse = (.92 + .08 * sin(uT * 3.1)) * uEyeA;
    float e_p = eg * pulse;
    float haloG = 1. - exp(-e_p * 1.15);
    float bodyEye = 1. - exp(-max(e_p - .14, 0.) * 2.10);
    float hotG = pow(clamp((e_p - .62) * .70, 0., 1.), 1.6);

    col = mix(col, eyeCol, clamp(haloG * .78, 0., .84));
    col = mix(col, eyeMid, clamp(bodyEye * .80, 0., .86));
    col += eyeHot * hotG * (uDark > .5 ? .10 : .12);
  }
  // fire glow in the open mouth (xy = pos, z = radius, w = how open)
  // open-mouth glow: warped, blurred, flickering - no hard wedge edge. Only near an open mouth (5 fetches + 3 noises a pixel)
  if (uGape.w > .01 && length((v - uGape.xy) * vec2(uAsp, 1.)) < uGape.z * 4.) {
  vec2 wg = v + (vec2(vnoise(v * 40. + uT * 3.), vnoise(v * 40. - uT * 2.7 + 9.)) - .5) * .02;
  vec2 o1 = vec2(uGape.z * .55 / uAsp, 0.), o2 = vec2(0., uGape.z * .55);
  float gm = (gp(wg) * 2. + gp(wg + o1) + gp(wg - o1) + gp(wg + o2) + gp(wg - o2)) / 6.;   // throat glow: green where the body is cut away (the belly is green on red)
  gm *= .55 + .7 * vnoise(v * 70. + vec2(uT * 7., -uT * 5.));
  float gl = smoothstep(.08, .72, gm) * uGape.w * .72;
  vec3 gOut = mix(vec3(1., .28, .03), mix(vec3(.90, .14, .04), vec3(1., .65, .10), uDark), uKing.x);
  vec3 gIn = mix(vec3(1., .9, .55), mix(vec3(1., .55, .24), vec3(1., .94, .65), uDark), uKing.x);
  col = mix(col, mix(gOut, gIn, smoothstep(.3, .9, gm)), clamp(gl * .85, 0., .88));
  col += gOut * gl * .35 * uDark;
  }
  // pearl (xy = pos, z = radius, w = glow): crisp orb with a swirling core; the body passes in front of it
  vec2 pq = (v - uPearl.xy) * vec2(uAsp, 1.) / uPearl.z;
  float pr = length(pq);
  if (pr < 7.) {   // halo is gone by ~6 radii: skip the orb's noise and fetch on the rest of the screen
  float occ = 1. - texture2D(t1, v).r * .8 * uRing.z;   // uRing.z = 0 while it sits in the mouth: in front of the jaws
  float core = smoothstep(1., .82, pr) * occ, halo = exp(-pr * pr * .3) * occ;
  float sw = vnoise(pq * 2.6 + vec2(uT * .9, -uT * .7)) * .6 + vnoise(pq * 5. - uT * 1.3) * .4;
  float spec = exp(-dot(pq - vec2(-.32, .34), pq - vec2(-.32, .34)) * 22.);
  if (uDark > .5) {
    vec3 pc = mix(vec3(.45, .75, 1.), vec3(.95, 1., 1.), smoothstep(.85, 0., pr));
    col += pc * halo * .4 * uPearl.w;
    col = mix(col, pc * (.8 + .35 * sw), core);
  } else {
    vec3 pc = mix(vec3(.93, .55, .2), vec3(1., .9, .62), smoothstep(.9, .05, pr));
    col *= 1. - halo * .12 * uPearl.w;                                   // faint ink-wash aura
    col = mix(col, pc * (.85 + .25 * sw), core);
    col *= 1. - exp(-pow((pr - 1.) * 9., 2.)) * .3 * occ;                // thin brush rim
  }
  // dragon fire soaked up (uPK.x = how full, y = ripe): warms a little as it fills, then turns cinnabar-gold - a gold heart,
  // a vermilion rim, a slow ember swirl and a beating glow
  {
    float fill = uPK.x * .3 * (1. - uPK.y), rp = uPK.y, beat = .75 + .25 * sin(uT * 5.);
    vec3 rc = mix(vec3(.82, .1, .05), vec3(1., .86, .38), smoothstep(.95, .1, pr + (sw - .5) * .35));
    col = mix(col, rc * (.85 + .3 * sw), core * fill);
    if (rp > .01) {
      col = mix(col, rc * (.9 + .3 * sw), core * rp);
      if (uDark > .5) col += vec3(1., .45, .15) * halo * .55 * rp * beat; else col = mix(col, vec3(.85, .2, .08), clamp(halo * .22 * rp * beat, 0., .3));
    }
  }
  // swallowed fire: the orb runs hot (uPearl.w above its resting glow)
  float heat = clamp((uPearl.w - 1.6) / 3., 0., 1.);
  if (uDark > .5) col += vec3(1., .6, .25) * halo * heat * .7;
  else col = mix(col, vec3(1., .7, .32), clamp(halo * heat * .55, 0., .6));
  col += vec3(1.) * spec * core * .55;
  }
  // then a ring bursts out of it (uRing.xy = radius in pearl radii, strength); only on the ring's band
  if (uRing.y > .005 && abs(pr - uRing.x) < 3.) {
    float rg = exp(-pow((pr - uRing.x) * 1.4, 2.)) * uRing.y * (.55 + .9 * vnoise(pq * .7 + uT * .8));
    if (uDark > .5) col += vec3(.6, .85, 1.) * rg * .9; else col *= 1. - rg * .32;
  }
  gl_FragColor = vec4(col, 1.);
}`,
  };

  // ---- palette -----------------------------------------------------------------------
  const GOLD_INK = { light: [0.03, 0.2, 0.85], dark: [0.44, 0.38, 0.27] };
  const BODY = { light: [1.3, 1.27, 1.21], dark: [0.36, 0.42, 0.56] };
  // body core (Yang 11-18, light theme): body = how far the core goes to dense ink, fill = how much faster the core is re-inked
  const CORE = { body: 0.8, fill: 1 };
  // gathering beat ("tụ khí", Yang 11-18: wisps of energy smoke drawn into the open mouth, then spat out). wind = s of wind-up
  // before the breath; rate/burst = wisps per s / at the start; r0..r1 = start distance (head radii); str/rad = ink strength /
  // splat size of a wisp; core = ember in the mouth; ink = grey of a wisp far out, ig0..ig1 = where along its way it catches fire; wob = path wobble
  const GA = { wind: 0.3, rate: 50, burst: 7, r0: 2.6, r1: 5.8, str: 0.8, rad: 0.00002, core: 0.5, ink: 0.3, ig0: 0.2, ig1: 0.55, wob: 0.16 };
  const FIRE = {
    light: [[0.08, 0.72, 0.88], [0.02, 0.3, 0.9]],
    dark: [[1.0, 0.62, 0.12], [1.0, 0.3, 0.05]],
    kingLight: [[0.0, 1.1, 0.8], [0.0, 0.16, 0.45]],
    kingDark: [[0.9, 0.7, 0.14], [0.85, 0.46, 0.06]],
  };

  // ---- GL ------------------------------------------------------------------------------
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const CFG = { velDiss: 0.5, dyeDiss: 0.9, pressK: 0.8, curl: 14, force: 2600, rMove: 0.0014 };
  let cv = null, gl = null, P = {}, half = 0, linear = false, quad = null;
  let vel = null, dye = null, prs = null, div = null, crl = null;
  let simW = 0, simH = 0, dyeW = 0, dyeH = 0, maskTex = null, mcv = null, mx = null;
  let raf = 0, last = 0, T = 0, W = 0, Hh = 0, S = 1, dark = false;
  let mounted = false, ptrT = -99, lastAct = 0;
  // game port: a page that wants to fly the dragon itself hands over an object through __dragon.game(o). While o.on is set
  // the wallpaper's own life stops (pearl, auto coil / breath, clouds, King, dance, cursor chase, click-to-breathe, the
  // painted backdrop) and the head sits where o.x, o.y say; body, wave, smoke and drawing run unchanged. The wallpaper never
  // sets it, so nothing here touches it
  let GM = null;
  const gmOn = () => !!(GM && GM.on);
  const ptr = { x: 0, y: 0, px: 0, py: 0, init: false, moved: false };
  let audioBass = 0, audioMid = 0, audioEnergy = 0, prevAudioBass = 0, audioAt = -99, lastAudioPeak = -99;
  // ---- dance to music (Yang 11-17) ------------------------------------------------------------------------------
  // WE hands us a 64-band spectrum ~30x/s, not raw audio: beats = bass flux against its own running mean; tempo = median
  // of recent beat gaps; phase runs freely at that tempo and is pulled toward each detected beat, so the body wave stays
  // smooth but lands on the beat. fast/slow energy -> calm vs drop; treble -> tail-tip flutter
  const dn = { peak: 0.2, beatFx: 0, ph2: 0, ph4: 0, kickS: 0, amt: 0, fast: 0, slow: 0, hi: 0, bAvg: 0, lastBeat: -9, period: 0.5, ivs: [], phase: 0, kick: 0, loud: -99, drop: -99, lastDrop: -99, t8: 0 };
  function danceAudio(bass, mid, hi) {
    // auto-gain: real WE levels vary a lot by system volume / track, so everything runs on levels relative to the recent peak
    dn.peak = Math.max(dn.peak * 0.997, bass, 0.04); const g = 1 / dn.peak;
    bass *= g; mid = Math.min(1.5, mid * g); hi = Math.min(1.5, hi * g);
    dn.fast += (bass * 0.6 + mid * 0.4 - dn.fast) * 0.3;
    dn.slow += (dn.fast - dn.slow) * 0.015;
    dn.hi += (hi - dn.hi) * 0.4;
    const flux = bass - dn.bAvg; dn.bAvg += (bass - dn.bAvg) * 0.08;
    if (flux > Math.max(0.12, dn.bAvg * 0.3) && T - dn.lastBeat > 0.26) {
      const iv = T - dn.lastBeat; dn.lastBeat = T; dn.kick = 1; dn.beatFx = 1;
      if (iv > 0.26 && iv < 1.3) { dn.ivs.push(iv); if (dn.ivs.length > 9) dn.ivs.shift();
        const sv = [...dn.ivs].sort((a, b) => a - b); dn.period = sv[sv.length >> 1]; }
      dn.phase += wrapA(-dn.phase) * 0.6;   // nudge the free-running phase onto the beat
    }
    if (dn.fast > 0.12 && dn.peak > 0.045) dn.loud = T;
    if (dn.fast > Math.max(0.7, dn.slow * 1.45) && T - dn.lastDrop > 10) { dn.drop = T; dn.lastDrop = T; }
  }

  function program(src) {
    const sh = (type, s) => {
      const o = gl.createShader(type); gl.shaderSource(o, s); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, src));
    gl.bindAttribLocation(p, 0, 'a'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    return { p, u: (n) => (n in u ? u[n] : (u[n] = gl.getUniformLocation(p, n))) };
  }
  function target(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const f = linear ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, half, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('half-float render target unsupported');
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    return { fb, tex, w, h, tx: [1 / w, 1 / h] };
  }
  function pair(w, h) {
    const o = { a: target(w, h), b: target(w, h), w, h, tx: [1 / w, 1 / h] };
    o.swap = () => { const t = o.a; o.a = o.b; o.b = t; };
    return o;
  }
  function freeTargets() {
    for (const t of [vel?.a, vel?.b, dye?.a, dye?.b, prs?.a, prs?.b, div, crl]) if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
    vel = dye = prs = div = crl = null;
  }
  function buildTargets() {
    freeTargets();
    const asp = Math.max(0.3, W / Math.max(1, Hh));
    simH = SIM_H; simW = Math.round(SIM_H * asp); dyeH = DYE_H; dyeW = Math.round(DYE_H * asp);
    vel = pair(simW, simH); prs = pair(simW, simH); div = target(simW, simH); crl = target(simW, simH); dye = pair(dyeW, dyeH);
    mcv.height = MASK_H; mcv.width = Math.round(MASK_H * asp);
  }
  function initGL() {
    gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
    if (!gl) return false;
    const ext = gl.getExtension('OES_texture_half_float');
    if (!ext) throw new Error('no OES_texture_half_float');
    half = ext.HALF_FLOAT_OES;
    linear = !!gl.getExtension('OES_texture_half_float_linear');
    gl.getExtension('EXT_color_buffer_half_float');
    for (const k in FS) P[k] = program(FS[k]);
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    maskTex = gl.createTexture(); maskTexW = maskTexH = 0;
    gl.bindTexture(gl.TEXTURE_2D, maskTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return true;
  }
  function pass(name, out, texs, uni, tx) {
    const pr = P[name];
    gl.useProgram(pr.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null);
    gl.viewport(0, 0, out ? out.w : cv.width, out ? out.h : cv.height);
    gl.uniform2fv(pr.u('uTx'), tx || (out ? out.tx : [1 / cv.width, 1 / cv.height]));
    texs.forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(pr.u('t' + i), i); });
    for (const k in uni) { const v = uni[k], l = pr.u(k); if (typeof v === 'number') gl.uniform1f(l, v); else if (v.length === 2) gl.uniform2fv(l, v); else if (v.length === 3) gl.uniform3fv(l, v); else gl.uniform4fv(l, v); }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---- dragon ----------------------------------------------------------------------------
  const N = 76;
  // serpentine flight: amp = sideways swing of the spine (body radii), len = wavelength (joints; the body is 76), drift = how
  // fast the wave creeps down a hovering body (rad/s)
  const WAVE = { amp: 1.3, len: 24, drift: 0.9 };
  const HS = 1.0;
  const dg = { roll: 0, rollT: 0, pts: [], prev: [], hx: 0, hy: 0, ang: 0, tx: 0, ty: 0, nextWander: 0, breath: 0, after: 0, angV: 0, bx: 0, by: 0, roar: 0, roarPearl: false, breathPearl: false, jaw: 0, fire: 0, mode: '', prevEyeX: 0, prevEyeY: 0, hasPrevEye: false, wind: 0, core: 0, wispAcc: 0, wisps: [] };
  const segLen = () => Math.max(12, Hh * 0.03) * (1 + 0.3 * kg.amt);
  const rad = () => Math.max(14, Hh * 0.056) * (1 + 0.3 * kg.amt);
  function dragonInit() {
    dg.hx = W * 0.62; dg.hy = Hh * 0.42; dg.ang = Math.PI * 0.85;
    dg.hasPrevEye = false; dg.prevEyeX = 0; dg.prevEyeY = 0;
    dg.pts = []; dg.prev = []; dg.roll = dg.rollT = Math.cos(dg.ang) < 0 ? 1 : 0;
    const s = segLen();
    for (let i = 0; i < N; i++) {
      const a = dg.ang + Math.PI + Math.sin(i * 0.22) * 0.9;
      const p = i ? { x: dg.pts[i - 1].x + Math.cos(a) * s, y: dg.pts[i - 1].y + Math.sin(a) * s } : { x: dg.hx, y: dg.hy };
      dg.pts.push(p); dg.prev.push({ x: p.x, y: p.y });
    }
    pl.x = pl.hx = W * 0.3; pl.y = pl.hy = Hh * 0.38; pl.vx = pl.vy = 0; pl.caught = -9; pl.inside = false;
    pl.held = 0; pl.charge = 0; pl.ess = 0; pl.ripe = 0; pl.ripeAmt = 0;
    dg.roar = 0; dg.roarPearl = false; dg.breath = 0; dg.breathPearl = false; dg.wind = 0;
    coilUntil = -9; nextCoil = T + 18 + Math.random() * 10; nextAutoBreath = T + 12 + Math.random() * 6; wasAutoCoil = false;
    Object.assign(kg, { ph: 'off', amt: 0, storm: 0, C: null, burst: false, puffs: [] }); sealKing = false;
    pickHome();
  }

  // ---- pearl -----------------------------------------------------------------------------
  const pl = { x: 0, y: 0, vx: 0, vy: 0, hx: 0, hy: 0, nextHome: 0, caught: -9, drag: false, thrown: -9, held: 0, charge: 0, hot: -9, flare: -9, flareAmt: 0, ess: 0, ripe: 0, ripeAmt: 0 };
  function pickHome() {
    const m = Math.min(W, Hh) * 0.16;
    for (let k = 0; k < 10; k++) {
      pl.hx = m + Math.random() * (W - 2 * m); pl.hy = m + Math.random() * (Hh - 2 * m);
      if (Math.hypot(pl.hx - dg.hx, pl.hy - dg.hy) > Hh * 0.55) break;
    }
    pl.nextHome = T + 14 + Math.random() * 8;
  }
  function spit() {
    pl.held = 0; pl.vx = Math.cos(dg.ang) * Hh * 0.8; pl.vy = Math.sin(dg.ang) * Hh * 0.8; pl.caught = T + 1; pickHome();
  }
  function pearlUpdate(dt) {
    const autoCoil = T < coilUntil;
    pl.ripeAmt += ((pl.ripe ? 1 : 0) - pl.ripeAmt) * Math.min(1, dt * 2.5);
    if (pl.drag) {
      const tx = ptr.x * W, ty = (1 - ptr.y) * Hh, k = Math.min(1, dt * 14), dtm = Math.max(dt, 1e-4);
      pl.vx += ((tx - pl.x) / dtm - pl.vx) * k; pl.vy += ((ty - pl.y) / dtm - pl.vy) * k;
      pl.x = tx; pl.y = ty; pl.nextHome = T + 6; return;
    }
    if (pl.inside) {
      if (kg.ph === 'swallow') { const g = gape(); pl.x = g.x; pl.y = g.y; } else { pl.x = W / 2; pl.y = Hh * 0.45; }
      pl.vx = pl.vy = 0; return;
    }
    if (pl.held) {
      const g = gape(); pl.x = g.x; pl.y = g.y; pl.vx = pl.vy = 0;
      if (T > pl.held || autoCoil || dg.roar || cl.ph !== 'off') spit();
      return;
    }
    if (autoCoil || pl.ripe || dg.roarPearl || (dg.breath > 0 && dg.breathPearl)) pl.nextHome = Math.max(pl.nextHome, T + 4);
    else if (T > pl.nextHome) pickHome();
    const tx = pl.hx + Math.sin(T * 0.7) * Hh * 0.05, ty = pl.hy + Math.cos(T * 0.93) * Hh * 0.04;
    pl.vx += ((tx - pl.x) * 0.5 - pl.vx * 1.3) * dt; pl.vy += ((ty - pl.y) * 0.5 - pl.vy * 1.3) * dt;
    pl.x += pl.vx * dt; pl.y += pl.vy * dt;
    const m = rad() * 1.5;
    if (pl.x < m || pl.x > W - m) pl.vx *= -0.55;
    if (pl.y < m || pl.y > Hh - m) pl.vy *= -0.55;
    pl.x = clamp(pl.x, m, W - m); pl.y = clamp(pl.y, m, Hh - m);
    const ex = pl.x - dg.hx, ey = pl.y - dg.hy, d = Math.hypot(ex, ey) || 1;
    if (pl.ripe) {
      if (d < rad() * 2.6 && dg.breath <= 0 && cl.ph === 'off' && !dg.reel && kg.ph === 'off') { pl.ripe = 0; pl.ess = 0; kingStart(); }
      return;
    }
    if (!autoCoil && dg.breath <= 0 && !dg.roar && d < rad() * 2.6 && T - pl.caught > 1.5) {
      if (T - pl.thrown < 6 || (cl.ph === 'off' && Math.random() < 0.55)) { pl.held = T + 3.5 + Math.random() * 2; pl.thrown = -9; pl.caught = T; return; }
      const ux = ex / d + Math.cos(dg.ang + 0.9 * (Math.random() < 0.5 ? -1 : 1)), uy = ey / d + Math.sin(dg.ang + 0.9 * (Math.random() < 0.5 ? -1 : 1)), l = Math.hypot(ux, uy) || 1;
      pl.vx += ux / l * Hh * 0.9; pl.vy += uy / l * Hh * 0.9; pl.caught = T; pickHome();
    }
  }

  // ---- autonomous coil/breath + sniff ----------------------------------------------------
  const sn = { done: true, at: 0, step: 0 };
  let coilUntil = -9, nextCoil = 18 + Math.random() * 10, nextAutoBreath = 12 + Math.random() * 6, wasAutoCoil = false;

  // ---- cloud & Long Vương ---------------------------------------------------------------
  const cl = { ph: 'off', next: 25, t: 0, headIn: 0, A: null, B: null, fade: 1, out: 0, emer: false };
  const cloudR = () => Hh * 0.2;
  const KING_T = 60;
  const kg = { ph: 'off', t: 0, amt: 0, storm: 0, rain: 0, bolt: 0, nextBolt: 0, bx: 0.5, bs: 0, by: 0.3, last: -1e9, coc: 0, cx: 0, cy: 0, burst: false, puffs: [], nextPuff: 0 };
  const kd = { ph: 'off', hop: 0, total: 0, tx: 0, ty: 0, arc: 0, t: 0, bursts: [] };
  const COC = [];
  for (let i = 0; i < N; i += 4) COC.push([i, 0.1 + 0.06 * Math.sin(i * 1.7) ** 2 - 0.04 * i / N, Math.sin(i * 2.3) * 0.55]);
  function kingStart() {
    kg.ph = 'swallow'; kg.t = T; kd.ph = 'off'; kd.bursts.length = 0; pl.held = 0; pl.inside = true; pl.thrown = -9;
    dg.roar = 0; dg.roarPearl = false; dg.breath = 0; dg.breathPearl = false; dg.wind = 0;
  }
  function cloudMouthBurst(x, y, ang, dir = 1) {
    const R = cloudR();
    for (let j = 0; j < 6; j++) {
      const a = ang + (Math.random() - 0.5) * 1.15, d = R * (0.2 + Math.random() * 0.55);
      kg.puffs.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r: Hh * (0.045 + Math.random() * 0.04), t0: T, sw: true });
    }
    kd.bursts.push({ x, y, ang, dir });
  }
  function pickFarSpot(ax, ay, minD) {
    const m = Math.min(W, Hh) * 0.22;
    const x0 = Math.max(m, W * 0.16), x1 = Math.min(W - m, W * 0.84);
    const y0 = Math.max(m, Hh * 0.18), y1 = Math.min(Hh - m, Hh * 0.82);
    let best = [clamp(W - ax, x0, x1), clamp(Hh - ay, y0, y1)], bestD = 0;
    for (let k = 0; k < 16; k++) {
      const biasX = ax > W * 0.5 ? (x0 + (x1 - x0) * (0.05 + Math.random() * 0.55)) : (x0 + (x1 - x0) * (0.4 + Math.random() * 0.55));
      const bx = k < 10 ? biasX : x0 + Math.random() * (x1 - x0);
      const by = y0 + Math.random() * (y1 - y0);
      const d = Math.hypot(bx - ax, by - ay);
      if (d > bestD) { bestD = d; best = [bx, by]; }
      if (d >= minD) return [bx, by];
    }
    return best;
  }
  function kingDiveStart() {
    kd.ph = 'dive'; kd.hop = 0; kd.total = 2 + Math.floor(Math.random() * 3); kd.t = T; kd.bursts.length = 0;
    const ax = clamp(kg.cx || dg.hx, W * 0.16, W * 0.84), ay = clamp(kg.cy || dg.hy, Hh * 0.18, Hh * 0.82);
    cl.A = cloudSpot(ax, ay); cl.A.hide = 1; cl.A.amt = 0.55; cl.A.on = true;   // the cocoon still covers this spot: the cloud thickens under it
    cl.B = null; cl.ph = 'enter'; cl.t = T; cl.headIn = T; cl.path = null; cl.fade = 1;
    dg.roar = 0; dg.roarPearl = false; dg.breath = 0; dg.breathPearl = false; dg.wind = 0;
    cloudMouthBurst(cl.A.x, cl.A.y, dg.ang + Math.PI, -1);
  }
  function kingUpdate(dt) {
    const e = T - kg.t;
    if (kg.ph === 'swallow' && e > 0.9) { kg.ph = 'glow'; kg.t = T; }
    else if (kg.ph === 'glow' && e > 1.6) {
      kg.ph = 'morph'; kg.t = T; kg.cx = clamp(dg.hx, W * 0.28, W * 0.72); kg.cy = clamp(dg.hy, Hh * 0.32, Hh * 0.68);
    } else if (kg.ph === 'morph' && e > 3.2) {
      kg.ph = 'king'; kg.t = T; kg.cx = dg.hx; kg.cy = dg.hy; kg.burst = true; kingSeal(true);
      if (cfg.cloudFreq > 0) kingDiveStart();
    } else if (kg.ph === 'king' && e > KING_T) {
      kg.ph = 'revert'; kg.t = T; kd.ph = 'off';
      if (cl.ph !== 'off') { cl.ph = 'off'; cl.fade = 1; if (cl.A) { cl.A.on = false; cl.A.hide = 0; } if (cl.B) { cl.B.on = false; cl.B.hide = 0; } }
      pl.inside = false; const g = gape(); pl.x = g.x; pl.y = g.y; spit();
    } else if (kg.ph === 'revert' && e > 3) { kg.ph = 'off'; kg.last = T; kingSeal(false); }
    kg.coc = kg.ph === 'morph' ? Math.min(1, (T - kg.t) / 1.4) : Math.max(0, kg.coc - dt / 0.8);
    kg.amt = clamp(kg.amt + (kg.ph === 'king' ? dt / 0.6 : -dt / 3), 0, 1);
    const st = kg.ph === 'morph' ? 1 : kg.ph === 'king' ? 0.6 : 0;
    const wantRain = cfg.rainLightning ? (kg.ph === 'king' ? 1 : kg.ph === 'morph' ? 0.35 : 0) : 0;
    kg.rain += (wantRain - kg.rain) * Math.min(1, dt * (kg.ph === 'revert' || kg.ph === 'off' ? 0.6 : 0.8));
    if (cfg.rainLightning && kg.ph === 'king' && (kg.burst || (kd.ph === 'off' && T > kg.nextBolt))) {
      kg.bolt = T; kg.nextBolt = T + 3 + Math.random() * 5; kg.bs = Math.random() * 100;
      kg.bx = 0.12 + Math.random() * 0.76; kg.by = 0.15 + Math.random() * 0.4;
    }
    if (!cfg.rainLightning) kg.bolt = -99;
    kg.storm += (st - kg.storm) * Math.min(1, dt * (kg.ph === 'morph' ? 0.9 : 0.5));
    if (kg.ph === 'king' && T > kg.nextPuff) {
      kg.nextPuff = T + 0.45; const p = dg.pts[Math.round(N * (0.45 + Math.random() * 0.4))];
      kg.puffs.push({ x: p.x + (Math.random() - 0.5) * rad() * 2, y: p.y + (Math.random() - 0.5) * rad() * 2, r: Hh * (0.035 + Math.random() * 0.03), t0: T, sw: true });
    }
    kg.puffs = kg.puffs.filter((q) => T - q.t0 < 5);
  }
  function boltFlash() {
    if (!cfg.rainLightning) return 0;
    const e = T - kg.bolt; if (e < 0 || e > 0.7) return 0;
    return Math.max(Math.exp(-e * 9), 0.7 * Math.exp(-Math.abs(e - 0.16) * 30), 0.45 * Math.exp(-Math.abs(e - 0.34) * 26));
  }
  function kingGlow() {
    const e = T - kg.t;
    if (kg.ph === 'swallow') { const g = gape(); return [g.x, g.y, rad() * 0.8, Math.min(1, e / 0.9)]; }
    if (kg.ph === 'glow') { const p = dg.pts[Math.min(N - 1, Math.floor(e / 1.6 * (N - 1)))]; return [p.x, p.y, rad() * 1.7, 1]; }
    if (kg.ph === 'morph') { const p = dg.pts[Math.round(N * 0.2)]; kg.gx = p.x; kg.gy = p.y; return [p.x, p.y, cloudR() * 0.7, clamp(e / 3.2, 0, 1) * 0.7]; }
    // the cocoon's light dies away over the burst, growing as it goes; cut to nothing in one frame it read as a dropped frame (Yang 11-17)
    if (kg.ph === 'king' && e < 0.9 && kg.gx != null) { const u = e / 0.9; return [kg.gx, kg.gy, cloudR() * (0.7 + 0.9 * u), 0.7 * (1 - u) * (1 - u)]; }
    return [0, 0, 1, 0];
  }
  function cloudSpot(x, y) { const m = Math.min(W, Hh) * 0.24; const R = cloudR(), puffs = [];
    for (let j = 0; j < 8; j++) { const a = j / 8 * Math.PI * 2 + Math.random() * 0.6, r = j ? R * (0.35 + Math.random() * 0.3) : 0;
      puffs.push({ dx: Math.cos(a) * r * 1.4, dy: Math.sin(a) * r * 0.7, r: R * (0.45 + Math.random() * 0.25), ph: Math.random() * 6 }); }
    return { x: clamp(x, m, W - m), y: clamp(y, m, Hh - m), hide: 0, on: true, amt: 0, puffs }; }
  // eye = true: the eye is a bright dot, so it must be gone before it reaches the cloud's visible rim. With the body's ramp
  // (full hide only inside 0.55R) a slow dive left it lit at the rim, a round glowing blob in the cloud (Yang 11-17)
  function visAt(x, y, eye = false) {
    let h = 0;
    for (const c of [cl.A, cl.B]) if (c && c.hide > 0) { const R = cloudR(), d = Math.hypot(x - c.x, y - c.y);   // c.soft: the cloud the body reels out of, a long ramp so no cut end shows at the rim
      h = Math.max(h, c.hide * (eye ? clamp((R * 1.15 - d) / (R * 0.3), 0, 1) : c.soft ? ((u) => u * u * (3 - 2 * u))(clamp((R * 1.3 - d) / (R * 0.8), 0, 1)) : clamp((R * 0.95 - d) / (R * 0.4), 0, 1))); }
    // King's cloud hops: the part of the body not yet out of cloud B lies straight on behind it (coilAt). It is not out yet, so
    // it does not show: hidden in a corridor running back from the cloud. Shown, a length of body stood behind the cloud
    // the moment the head came out of it (Yang 11-18)
    if (cl.B && cl.B.back && kd.ph === 'dive') { const c = cl.B, R = cloudR(), ux = x - c.x, uy = y - c.y, al = ux * c.back[0] + uy * c.back[1], off = Math.abs(ux * c.back[1] - uy * c.back[0]);
      h = Math.max(h, clamp(al / (R * 0.5) + 0.5, 0, 1) * clamp((R * 1.6 - off) / (R * 0.5), 0, 1)); }
    if (kg.coc > 0.01) for (const [i, rr] of COC) { const R = rr * Hh * 0.8, p = dg.pts[i], d = Math.hypot(x - p.x, y - p.y); h = Math.max(h, kg.coc * clamp((R * 1.1 - d) / (R * 0.5), 0, 1)); }
    return cl.fade * (1 - h);
  }
  function cloudUpdate(dt, free, chasing) {
    const R = cloudR();
    if (cl.emer) { const B = cl.B;   // the King's last cloud stays, hiding the tail, till the reel has paid the whole body out
      if (!B || cl.ph !== 'off') cl.emer = false;
      else if (dg.reel) { B.hide = 1; B.on = true; }
      else { B.on = false; B.hide = Math.max(0, B.hide - dt / 0.6); if (B.hide <= 0) cl.emer = false; } }
    if (kd.ph === 'dive') {
      if (cfg.cloudFreq <= 0) {
        cl.ph = 'off'; kd.ph = 'off'; cl.fade = 1; cl.path = null;
        if (cl.A) { cl.A.on = false; cl.A.hide = 0; }
        if (cl.B) { cl.B.on = false; cl.B.hide = 0; }
        return;
      }
      if (cl.ph === 'enter') {
        const A = cl.A;
        A.hide = Math.min(1, A.hide + dt / 0.35);
        if (cl.B && cl.B !== A && cl.B.hide > 0 && !cl.B.back) cl.B.hide = Math.max(0, cl.B.hide - dt / 0.5);
        const tailD = Math.hypot(dg.pts[N - 1].x - A.x, dg.pts[N - 1].y - A.y);
        if (tailD < R * 0.42) cl.fade = 0;
        else if (T - cl.headIn > 1.35) cl.fade = Math.max(0, 1 - (T - cl.headIn - 1.35) / 0.35);
        if (cl.fade <= 0) {
          cl.ph = 'hidden'; cl.t = T; cl.path = null; A.on = false;
          kd.hop++;
          const [bx, by] = pickFarSpot(A.x, A.y, Math.hypot(W, Hh) * 0.38);
          cl.B = cloudSpot(bx, by); cl.B.hide = 1; cl.B.amt = 0.12; cl.B.on = true;   // gathers while the dragon is away (below)
        }
      } else if (cl.ph === 'hidden') {
        if (cl.B) cl.B.amt = Math.min(0.9, cl.B.amt + dt * 1.5);
        if (T - cl.t > 0.55) {
          cl.ph = 'emerge'; cl.t = T; cl.fade = 0;
          if (cl.A) cl.A.hide = 0;
          if (kd.hop < kd.total) {
            const [ax, ay] = pickFarSpot(cl.B.x, cl.B.y, Math.hypot(W, Hh) * 0.40);
            cl.A = cloudSpot(ax, ay); cl.A.hide = 0; cl.A.amt = 0.2; cl.A.on = true;
            kd.tx = ax; kd.ty = ay;
            const chordA = Math.atan2(ay - cl.B.y, ax - cl.B.x);
            let arc = (kd.hop % 2 ? 1 : -1) * (0.45 + Math.random() * 0.35);
            const testX = cl.B.x + Math.cos(chordA + arc) * Hh * 0.38, testY = cl.B.y + Math.sin(chordA + arc) * Hh * 0.38;
            if (testX < W * 0.1 || testX > W * 0.9 || testY < Hh * 0.1 || testY > Hh * 0.9) arc = -arc;
            kd.arc = arc;
            const launchA = chordA + arc;
            coilAt(cl.B.x, cl.B.y, launchA);
            cloudMouthBurst(cl.B.x, cl.B.y, launchA, 1);
          } else {
            cl.A = null;
            kd.tx = W * (0.38 + Math.random() * 0.24); kd.ty = Hh * (0.36 + Math.random() * 0.24);
            const launchA = Math.atan2(kd.ty - cl.B.y, kd.tx - cl.B.x) + (Math.random() - 0.5) * 0.45;
            coilAt(cl.B.x, cl.B.y, launchA);
            cloudMouthBurst(cl.B.x, cl.B.y, launchA, 1);
            if (cfg.rainLightning) {
              kg.bolt = T; kg.nextBolt = T + 3.5 + Math.random() * 4.5; kg.bs = Math.random() * 100;
              kg.bx = clamp(cl.B.x / Math.max(1, Hh), 0.12, Math.max(0.2, W / Math.max(1, Hh) - 0.12));
              kg.by = 0.16 + Math.random() * 0.24;
            }
          }
        }
      } else if (cl.ph === 'emerge') {
        const B = cl.B, e = T - cl.t;
        cl.fade = Math.min(1, e / 0.22);
        const last = !!(dg.reel && dg.reel.stack) || !!B.back;   // the cloud holds while body is still coming out of it (last hop: till the tail is out; a hop: till the dragon is gone into the next cloud)
        if (e > 0.35 && !last) B.on = false;
        if (e > 0.85 && !last) B.hide = Math.max(0, 1 - (e - 0.85) / 0.5);   // holds till most of the body has left: let go early, the coil still inside showed all at once
        if (kd.hop < kd.total && cl.A) {
          const dA = Math.hypot(dg.hx - cl.A.x, dg.hy - cl.A.y);
          if ((e > 0.45 && dA < R * 0.72) || e > 2.6) {
            cl.ph = 'enter'; cl.t = T; cl.headIn = T; cl.path = null;
            cl.A.hide = 0.15; if (!B.back) B.on = false;   // B goes on hiding the tail still in it (a hop cloud: kept whole, see 'enter')
            cloudMouthBurst(cl.A.x, cl.A.y, dg.ang + Math.PI, -1);
          }
        } else if (e > 1.4) {
          if (dg.reel && dg.reel.stack) cl.emer = true; else B.hide = 0;   // tail still inside: cloudUpdate's first lines keep the cloud
          cl.ph = 'off'; kd.ph = 'off'; cl.fade = 1;
          cl.next = cfg.cloudFreq > 0 ? T + cfg.cloudFreq * (0.75 + Math.random() * 0.5) : 1e9;
        }
      }
      return;
    }
    if (cl.ph === 'off') {
      if (cfg.cloudFreq > 0 && T > cl.next && free && !pl.ripe && !dg.reel) {
        cl.A = cloudSpot(dg.hx + Math.cos(dg.ang) * Hh * 0.5, dg.hy + Math.sin(dg.ang) * Hh * 0.5);
        cl.ph = 'enter'; cl.t = T; cl.headIn = 0;
      }
    } else if (cl.ph === 'enter') {
      const A = cl.A;
      A.hide = Math.min(1, (T - cl.t) / 1.2);
      if (!cl.headIn && Math.hypot(dg.hx - A.x, dg.hy - A.y) < R * 0.45) cl.headIn = T;
      if (cl.headIn) { const d = (i) => Math.hypot(dg.pts[i].x - A.x, dg.pts[i].y - A.y);
        if (d(N - 1) < R * 0.35) cl.fade = 0;
        else if (T - cl.headIn > 12) cl.fade = Math.max(0, 1 - (T - cl.headIn - 12) / 1.5); }
      if ((chasing || T < coilUntil || cfg.cloudFreq <= 0 || T - cl.t > 14) && !cl.headIn) {
        A.on = false; A.hide = 0; cl.ph = 'off';
        cl.next = cfg.cloudFreq > 0 ? T + Math.min(20, cfg.cloudFreq * 0.5) : 1e9;
        return;
      }
      if (cl.headIn && cl.fade <= 0) {
        cl.ph = 'hidden'; cl.t = T; A.on = false;
        let bx = 0, by = 0;
        for (let k = 0; k < 12; k++) { bx = Math.random() * W; by = Math.random() * Hh; if (Math.hypot(bx - A.x, by - A.y) > Math.max(W, Hh) * 0.45) break; }
        cl.B = cloudSpot(bx, by); cl.B.hide = 1;
      }
    } else if (cl.ph === 'hidden') {
      if (T - cl.t > 1.6) {
        cl.ph = 'emerge'; cl.t = T; if (cl.A) cl.A.hide = 0;
        coilAt(cl.B.x, cl.B.y, Math.atan2(Hh / 2 - cl.B.y, W / 2 - cl.B.x) + (Math.random() - 0.5));
      }
    } else if (cl.ph === 'emerge') {
      // the body waits inside the cloud and reels out along the head's track (coilAt); the cloud holds, hiding what is still
      // inside, till the tail is out, then thins away. On a timer it let go with most of the body still in it (Yang 11-18)
      const B = cl.B, e = T - cl.t;
      cl.fade = Math.min(1, e / 0.8);
      if (dg.reel && e < 22) { B.hide = 1; B.on = true; }
      else { dg.reel = null; B.on = false; B.hide = Math.max(0, B.hide - dt / 1.2);
        if (B.hide <= 0) { cl.ph = 'off'; cl.fade = 1; cl.next = cfg.cloudFreq > 0 ? T + cfg.cloudFreq * (0.75 + Math.random() * 0.5) : 1e9; } }
    }
  }
  function coilAt(x, y, ang) {   // place the whole body wound up tight inside a cloud, head pointing out
    dg.hx = x; dg.hy = y; dg.ang = ang;
    // wound tight and centred on the cloud, so every joint lies in the cloud's hiding core and the body only shows as it leaves.
    // Wound from the head at the cloud's centre, the coil reached 0.9 cloud radii out and half of it popped into view in one
    // frame, a black disc beside the cloud (Yang 11-17: the king's transformation is not smooth)
    const s = segLen(), rr = cloudR() * 0.24;
    let a = ang + Math.PI, px = x, py = y, mx0 = 0, my0 = 0;
    for (let i = 0; i < N; i++) {
      if (i) { a += s / rr * 0.9; px += Math.cos(a) * s; py += Math.sin(a) * s; }
      dg.pts[i].x = px; dg.pts[i].y = py; mx0 += px / N; my0 += py / N;
    }
    for (let i = 0; i < N; i++) { dg.pts[i].x += x - mx0; dg.pts[i].y += y - my0; dg.prev[i].x = dg.pts[i].x; dg.prev[i].y = dg.pts[i].y; }
    dg.hx = dg.pts[0].x; dg.hy = dg.pts[0].y;
    dg.roll = dg.rollT = Math.cos(ang) < 0 ? 1 : 0;
    // Long Vương's cloud hops: the body reels out of the cloud along the head's own track instead of being dragged straight at
    // its neighbour. Dragged, the wound coil kept its loops and the tail left the cloud still curled up (Yang 11-17)
    // The body is longer than a hop (~2100 px vs ~850 px of head travel before the next cloud), so it cannot reel all the way
    // out of one cloud. It passes THROUGH the cloud instead: the part not yet out lies straight on behind it, at full spacing,
    // so the whole body always shows its length. Stacked on one point (first try), follow-the-leader could never pull the
    // joints apart and the body stayed balled up in the cloud (Yang 11-17: "người không chui ra hết")
    // Out of a plain cloud dive, and out of the King's LAST cloud, there is no next cloud to hurry to, so the part not yet out waits
    // INSIDE the cloud, on its centre, hidden, and the reel runs till the tail is out (stack). Wound up in the cloud instead, the
    // spine's bend limit (0.2 rad a joint) sprang the coil open to a ring wider than the cloud's hiding core, and the whole body
    // stood round the cloud at once (Yang 11-18: "vẫn bị hiện cả thân trước")
    const hopOn = kd.ph === 'dive' && kd.hop < kd.total;
    { const bx = -Math.cos(ang), by = -Math.sin(ang);
      if (!hopOn) { dg.hx = x; dg.hy = y; if (cl.B) cl.B.soft = true; } else if (cl.B) cl.B.back = [bx, by];
      dg.reel = { t0: T, bx, by, P: [[dg.hx, dg.hy]], stack: !hopOn };
      for (let i = 0; i < N; i++) { const k = hopOn ? s * i : 0, px2 = dg.hx + bx * k, py2 = dg.hy + by * k; dg.pts[i].x = dg.prev[i].x = px2; dg.pts[i].y = dg.prev[i].y = py2; } }
  }
  function cloudFeed(kx, ky, dt) {   // clouds live in the mask (blue); here only their amount and a slow roll of the water
    for (const c of [cl.A, cl.B]) {
      if (!c) continue;
      c.amt = clamp(c.amt + (c.on ? dt / 1.2 : -dt / 2), 0, 1);
      if (c.amt > 0.05) { const a = T * 0.7, sp = Hh * 0.04 * c.amt; splatVel(c.x / W, 1 - c.y / Hh, Math.cos(a) * sp * kx, Math.sin(a) * sp * ky, 0.0025); }
    }
    // auspicious cloud puffs: a three-point vortex as each forms, so the smoke round it curls into a spiral
    for (const q of kg.puffs) if (q.sw) { q.sw = false;
      for (let j = 0; j < 3; j++) { const a = j * Math.PI * 2 / 3, r = q.r * 0.7, sp = Hh * 0.35;
        splatVel((q.x + Math.cos(a) * r) / W, 1 - (q.y + Math.sin(a) * r) / Hh, -Math.sin(a) * sp * kx, -Math.cos(a) * sp * ky, 0.0004); } }
    if (kd.bursts.length) {
      const col = dark ? [0.22, 0.25, 0.38] : [0.06, 0.07, 0.09];
      for (const b of kd.bursts.splice(0)) {
        const sp = Hh * (b.dir > 0 ? 1.55 : 0.9) * b.dir;
        for (let j = 0; j < 4; j++) {
          const a = b.ang + (j - 1.5) * 0.34;
          const bx = b.x + Math.cos(b.ang) * cloudR() * 0.32, by = b.y + Math.sin(b.ang) * cloudR() * 0.32;
          splat(bx / W, 1 - by / Hh, Math.cos(a) * sp * kx, -Math.sin(a) * sp * ky, col, 0.0011);
        }
      }
    }
  }
  function drawClouds(c) {   // opaque gradients on purpose: the mask upload is not premultiplied, so alpha would not reach the shader
    c.globalCompositeOperation = 'lighter';
    for (const q of kg.puffs) {   // rises in ~0.8 s, lingers, thins out by 5 s
      const e = T - q.t0, a = Math.min(1, e / 0.8) * (1 - Math.max(0, (e - 2.5) / 2.5)), r = q.r * (0.7 + e * 0.12);
      if (a <= 0.01) continue;
      const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, r); g.addColorStop(0, `rgb(0,0,${Math.round(120 * a)})`); g.addColorStop(1, 'rgb(0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, r, 0, Math.PI * 2); c.fill();
    }
    if (kg.coc > 0.01) for (const [i, rr, off] of COC) {   // cocoon: rides the joints; blows outward as it thins after the burst
      const p = dg.pts[i], q = dg.pts[Math.min(N - 1, i + 1)], dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
      const r = rr * Hh * (kg.ph === 'morph' ? 0.6 + 0.5 * kg.coc : 1.1 + (1 - kg.coc) * 0.8);
      const x = p.x - dy / l * off * r + Math.sin(T * 0.8 + i) * r * 0.12, y = p.y + dx / l * off * r + Math.cos(T * 0.6 + i) * r * 0.1;
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgb(0,0,${Math.round(105 * kg.coc)})`); g.addColorStop(1, 'rgb(0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    for (const cc of [cl.A, cl.B]) {
      if (!cc || cc.amt <= 0.01) continue;
      for (const p of cc.puffs) {
        const x = cc.x + p.dx + Math.sin(T * 0.4 + p.ph) * p.r * 0.15, y = cc.y + p.dy + Math.cos(T * 0.33 + p.ph) * p.r * 0.1, r = p.r * (0.6 + 0.4 * cc.amt);
        const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgb(0,0,${Math.round(150 * cc.amt)})`); g.addColorStop(1, 'rgb(0,0,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
    }
    c.globalCompositeOperation = 'source-over'; c.fillStyle = '#f00';
  }

  function wrapA(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
  const headFlip = () => Math.cos(dg.roll * Math.PI);
  const HEAD = {
    skull: { x: -3.847, y: -2.71, w: 6.731, h: 3.697, u: 'data:image/png;base64,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' },
    eye: { x: 1.036, y: -0.262, w: 0.359, h: 0.255, u: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAMCAYAAACEJVa/AAAA8UlEQVR42pWSP0pDQRCHv/eevEIRGxtvILmDiIJHEITUllZWOUCKQBobT5HGA1h7AAVt7DyCIuaPn808GNYkxoVhZ5edj9/8dhAqAKEn7EZeCQ3/WcKl8CE8CxfpvtkIJpwKFnEvHBewah1kRxgI04h5gObCnXCSYasgnSfDKP4SZknVQhgLe/Gu/qUqTGwjv0nFs6RK4U3op7p6GaiJfCR8JtCigN0mVVvLWqtjPwxzu8LvAHZtPgoHK33Kl8KV8Fr8XKfyRThb92N1MnxbOBceorVyHI7+mqGmOPeEa+FJeBcmwv4mw1iVwya04VsL8AM7Eq7d8fpuaQAAAABJRU5ErkJggg==' },
    jaw: { x: -0.549, y: -0.389, w: 3.076, h: 1.366, u: 'data:image/png;base64,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' },
    // Long Vương's imperial antler + brow flame horn (Yang's second drawing, same frame): drawn yellow (R+G) into the mask only while king, so the
    // display can tell it from ink (R) and the throat (G without R) and lay bright gold on it. root = skull top between them.
    crown: { x: -4.005, y: -2.71, w: 6.972, h: 3.69, root: [0.519, -0.614], u: 'data:image/png;base64,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' },
    hinge: [0.178, 0.272], eyeAt: [1.214, -0.135], upTip: [2.686, 0.89], loTip: [2.513, 0.666],
    under: [[2.41, 0.935], [2.103, 0.907], [1.795, 0.831], [1.488, 0.804], [1.181, 0.783], [0.874, 0.769], [0.566, 0.707], [0.259, 0.707], [-0.048, 0.638], [-0.356, 0.383]],
  };
  let eyeBlueCv = null;
  function buildEyeBlue(im) {
    if (eyeBlueCv || !im || !(im.naturalWidth || im.width)) return;
    const ec = document.createElement('canvas');
    ec.width = im.naturalWidth || im.width; ec.height = im.naturalHeight || im.height;
    const ex = ec.getContext('2d');
    ex.drawImage(im, 0, 0);
    ex.globalCompositeOperation = 'source-in';
    ex.fillStyle = '#00f';
    ex.fillRect(0, 0, ec.width, ec.height);
    eyeBlueCv = ec;
  }
  for (const k of ['skull', 'eye', 'jaw', 'crown']) {
    const im = new Image();
    if (k === 'eye') im.onload = () => buildEyeBlue(im);
    im.src = HEAD[k].u; HEAD[k].im = im;
    if (k === 'eye' && im.complete) buildEyeBlue(im);
  }
  const sprite = (c, s, R) => { if (s.im.complete && s.im.naturalWidth) c.drawImage(s.im, s.x * R, s.y * R, s.w * R, s.h * R); };
  function updateRoll(dt) {
    if (dg.pts.length < 3) return;
    const ca = Math.cos(Math.atan2(dg.pts[0].y - dg.pts[2].y, dg.pts[0].x - dg.pts[2].x));
    if (ca < -0.3) dg.rollT = 1; else if (ca > 0.3) dg.rollT = 0;
    const d = dg.rollT - dg.roll, stp = dt * 1.6;
    dg.roll += Math.abs(d) <= stp ? d : Math.sign(d) * stp;
  }
  function dragonUpdate(dt) {
    updateRoll(dt);
    const gm = gmOn();
    if (!gm) { pearlUpdate(dt); kingUpdate(dt); }
    const R = rad(), idle = T - ptrT;
    const chasing = !gm && idle < 2.5 && ptr.init;
    const px = ptr.x * W, py = (1 - ptr.y) * Hh;

    let autoCoil = T < coilUntil;
    if (wasAutoCoil && !autoCoil) {
      if (kg.ph === 'off' && cl.ph === 'off' && !pl.drag && !pl.held && !pl.inside && !pl.ripe) {
        dg.roar = T + 4.8;
        pl.caught = T + 5.5;
        dg.roarPearl = true;
        nextAutoBreath = T + 11 + Math.random() * 5;
      }
    }
    const freeAuto = !gm && kg.ph === 'off' && cl.ph === 'off' && !chasing && !pl.drag && !pl.held && !pl.ripe && dg.breath <= 0 && !dg.roar && dn.amt < 0.3;   // no auto coil / auto breath while dancing
    if (freeAuto && !autoCoil) {
      if (T > nextCoil) {
        coilUntil = T + 4.5 + Math.random() * 3.0;
        nextCoil = coilUntil + 18 + Math.random() * 10;
        autoCoil = true;
      } else if (T > nextAutoBreath) {
        const distPl = Math.hypot(pl.x - dg.hx, pl.y - dg.hy);
        if (distPl < Hh * 1.25 || T > nextAutoBreath + 3) {
          dg.roar = T + 4.8;
          pl.caught = T + 5.5;
          dg.roarPearl = true;
          nextAutoBreath = T + 11 + Math.random() * 5;
        }
      }
    }
    wasAutoCoil = autoCoil;

    if (dg.breath > 0 && dg.breathPearl) {
      dg.bx = pl.x;
      dg.by = pl.y;
      pl.nextHome = Math.max(pl.nextHome, T + 2);
      pl.caught = Math.max(pl.caught, T + 0.5);
    }

    cloudUpdate(dt, !gm && kg.ph === 'off' && !chasing && !autoCoil && !dg.roar && dg.breath <= 0 && !pl.held && !pl.drag && (sn.done || idle < 6), chasing);
    if (cl.ph === 'hidden') { for (let i = 0; i < N; i++) { dg.prev[i].x = dg.pts[i].x; dg.prev[i].y = dg.pts[i].y; } dg.mode = 'hidden'; return; }
    if (cl.ph === 'enter' && cl.headIn) {
      if (!cl.path) { const P = [[cl.A.x, cl.A.y], ...dg.pts.map((p) => [p.x, p.y])], L = [0];
        for (let k = 1; k < P.length; k++) L.push(L[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
        cl.path = { P, L }; cl.reel = 0; }
      const { P, L } = cl.path; cl.reel += Hh * (kd.ph === 'dive' ? 1.60 : 0.5) * dt;
      for (let i = 0; i < N; i++) { dg.prev[i].x = dg.pts[i].x; dg.prev[i].y = dg.pts[i].y; }
      let k = 1;
      for (let i = 0; i < N; i++) {
        const want = Math.max(0, L[i + 1] - cl.reel); while (k < L.length - 1 && L[k] < want) k++;
        const f = L[k] > L[k - 1] ? clamp((want - L[k - 1]) / (L[k] - L[k - 1]), 0, 1) : 0;
        dg.pts[i].x = P[k - 1][0] + (P[k][0] - P[k - 1][0]) * f; dg.pts[i].y = P[k - 1][1] + (P[k][1] - P[k - 1][1]) * f;
        if (want <= 0) { dg.pts[i].x = P[0][0]; dg.pts[i].y = P[0][1]; }
      }
      const h = dg.pts[0], h2 = dg.pts[Math.min(N - 1, 2)];
      dg.hx = h.x; dg.hy = h.y; if (Math.hypot(h.x - h2.x, h.y - h2.y) > 1) dg.ang = Math.atan2(h.y - h2.y, h.x - h2.x);
      dg.mode = 'dive'; return;
    }
    cl.path = null;
    const diving = kd.ph === 'dive' || cl.ph === 'enter' || (cl.ph === 'emerge' && T - cl.t < 2.5);
    const sniffing = !gm && kd.ph === 'off' && !chasing && !autoCoil && !dg.roar && !sn.done && idle > 6 && dg.breath <= 0;
    let mode = 'pearl', near = false;
    {
      const on = !gm && cfg.audioReactive && cfg.dance && T - dn.loud < 2.5 && T - dn.lastBeat < 4;
      dn.amt += ((on ? 1 : 0) - dn.amt) * Math.min(1, dt * (on ? 0.7 : 0.45));
      if (T - audioAt > 0.25) { const dec = Math.exp(-dt * 4); dn.fast *= dec; dn.hi *= dec; }
      dn.phase = (dn.phase + dt * Math.PI * 2 / dn.period) % (Math.PI * 2);
      dn.kick *= Math.exp(-dt * 6);
      // smooth, flowing motion (Yang: per-beat jolts looked like a seizure): body crest every 2 beats, head swing every 4,
      // both free-running at the tempo so they never jump; the kick is low-passed into a soft swell
      dn.ph2 = (dn.ph2 + dt * Math.PI * 2 / (dn.period * 2)) % (Math.PI * 2);
      dn.ph4 = (dn.ph4 + dt * Math.PI * 2 / (dn.period * 4)) % (Math.PI * 2);
      dn.kickS += (dn.kick - dn.kickS) * Math.min(1, dt * 3);
      dn.t8 += dt * Math.PI * 2 / (dn.period * 32) * (T - dn.drop < 5 ? 1.7 : 1) * dn.amt;   // one figure-8 per 32 beats
    }
    const danceE = clamp(dn.fast * 1.2, 0, 1);
    let gv = 0;   // game: speed the head was carried at this frame, px/s
    if (gm) {
      // the head is where the game puts it. Its heading is the game's (GM.ang) when it gives one; else it follows the way
      // the head is being moved (eased, GM.turn 1/s) and holds when it stands still
      const idt = 1 / Math.max(dt, 1e-3), vx = (GM.x - dg.hx) * idt, vy = (GM.y - dg.hy) * idt; gv = Math.hypot(vx, vy);
      if (GM.ang != null) { dg.angV = wrapA(GM.ang - dg.ang) * idt; dg.ang = GM.ang; }
      else if (gv > Hh * 0.03) { const dA = wrapA(Math.atan2(vy, vx) - dg.ang) * Math.min(1, dt * (GM.turn || 10)); dg.angV = dA * idt; dg.ang += dA; }
      else dg.angV = 0;
      mode = 'game';
    } else if (kd.ph === 'dive') {
      if (kd.hop < kd.total && cl.A) {
        const dA = Math.hypot(cl.A.x - dg.hx, cl.A.y - dg.hy);
        const tot = Math.max(1, Math.hypot(cl.A.x - (cl.B ? cl.B.x : dg.hx), cl.A.y - (cl.B ? cl.B.y : dg.hy)));
        const frac = clamp(dA / tot, 0, 1);
        const toA = Math.atan2(cl.A.y - dg.hy, cl.A.x - dg.hx);
        const perp = toA + Math.sign(kd.arc || 1) * Math.PI * 0.5;
        const arcOff = Math.sin(frac * Math.PI * 0.75) * Math.min(W, Hh) * 0.22 * (frac > 0.2 ? 1 : frac / 0.2);
        dg.tx = clamp(cl.A.x + Math.cos(perp) * arcOff, W * 0.1, W * 0.9);
        dg.ty = clamp(cl.A.y + Math.sin(perp) * arcOff, Hh * 0.1, Hh * 0.9);
      } else {
        dg.tx = kd.tx; dg.ty = kd.ty;
      }
      mode = 'kdive';
    } else if (diving) {
      if (cl.ph === 'enter') { const A = cl.A, oa = Math.atan2(dg.hy - A.y, dg.hx - A.x) + (cl.headIn ? 1.2 : 0), r = cl.headIn ? cloudR() * 0.3 : 0; dg.tx = A.x + Math.cos(oa) * r; dg.ty = A.y + Math.sin(oa) * r; }
      else { dg.tx = dg.hx + Math.cos(dg.ang) * Hh; dg.ty = dg.hy + Math.sin(dg.ang) * Hh; }
      mode = 'cloud';
    } else if (kg.ph === 'morph') {
      const oa = Math.atan2(dg.hy - kg.cy, dg.hx - kg.cx) + 1.0, r = Hh * 0.09;
      dg.tx = kg.cx + Math.cos(oa) * r; dg.ty = kg.cy + Math.sin(oa) * r; mode = 'coil';
    } else if (kg.ph === 'swallow' || kg.ph === 'glow') { dg.tx = dg.hx + Math.cos(dg.ang) * Hh; dg.ty = dg.hy + Math.sin(dg.ang) * Hh; mode = 'swallow'; }
    else if (pl.ripe && kg.ph === 'off' && !pl.drag && dg.breath <= 0 && T - pl.ripe > 1.2) { dg.tx = pl.x; dg.ty = pl.y; mode = 'fetch'; }
    else if (T - pl.thrown < 6 && !pl.drag) { dg.tx = pl.x; dg.ty = pl.y; mode = 'fetch'; }
    else if (chasing) { dg.tx = px; dg.ty = py; mode = 'chase'; }
    else if (autoCoil) {
      const oa = Math.atan2(dg.hy - pl.y, dg.hx - pl.x) + 0.8, r = Hh * 0.26;
      dg.tx = pl.x + Math.cos(oa) * r; dg.ty = pl.y + Math.sin(oa) * r; mode = 'think';
    } else if (sniffing) {
      dg.tx = px; dg.ty = py; mode = 'sniff';
      const sx = px - dg.hx, sy = py - dg.hy;
      near = Math.hypot(sx, sy) < R * 3.2;
      if (near && !sn.at) sn.at = T;
      if (sn.at) sniffFx(T - sn.at, px, py);
      if (sn.at && T - sn.at > 2.8) { sn.done = true; sn.at = 0; pickHome(); }
    } else if (pl.held && dn.amt <= 0.05) {
      dg.tx = W / 2 + Math.cos(T * 0.45) * W * 0.32; dg.ty = Hh / 2 + Math.sin(T * 0.45) * Hh * 0.28; mode = 'hold';
    } else if (kg.amt > 0 && dn.amt <= 0.05) {
      dg.tx = W / 2 + Math.cos(T * 0.22) * W * 0.3; dg.ty = Hh / 2 + Math.sin(T * 0.31) * Hh * 0.22; mode = 'king';
    } else if (dn.amt > 0.05) {   // dance: chase a point riding a figure-8 across the screen, wider when the music is loud
      const a = dn.t8, sx = W * (0.3 + 0.06 * danceE), sy = Hh * (0.26 + 0.05 * danceE);
      dg.tx = W / 2 + Math.sin(a) * sx; dg.ty = Hh * 0.47 + Math.sin(2 * a) * sy; mode = 'dance';
      // a big drop: a short burst of fire thrown up at the sky
      if (T - dn.drop < 0.2 && dn.amt > 0.5 && dg.breath <= 0 && !dg.roar && kg.ph === 'off' && cl.ph === 'off' && !pl.held && !pl.drag) {
        dn.drop = -99; startBreath(dg.hx + Math.cos(dg.ang) * Hh * 0.35, dg.hy - Hh * 0.55, 1.1);
      }
    } else { dg.tx = pl.x; dg.ty = pl.y; }
    dg.mode = mode;
    let want = Math.atan2(dg.ty - dg.hy, dg.tx - dg.hx);
    const distPl = Math.hypot(pl.x - dg.hx, pl.y - dg.hy);
    const headA = dg.pts.length >= 3 ? Math.atan2(dg.pts[0].y - dg.pts[2].y, dg.pts[0].x - dg.pts[2].x) : dg.ang;
    if (dg.roar) {
      want = Math.atan2(pl.y - dg.hy, pl.x - dg.hx);
      if ((Math.abs(wrapA(want - dg.ang)) < 0.25 && Math.abs(wrapA(want - headA)) < 0.3 && (!dg.roarPearl || distPl < Hh * 0.8)) || T > dg.roar) {
        startBreath(pl.x, pl.y, 2.4, !!dg.roarPearl);
        dg.roar = 0;
        dg.roarPearl = false;
      }
    }
    if (dg.breath > 0) want = Math.atan2(dg.by - dg.hy, dg.bx - dg.hx);
    const turn = (dg.breath > 0 || dg.roar ? 2.6 : mode === 'kdive' ? 4.8 : mode === 'sniff' ? (near ? 1.4 : 0.9) : mode === 'chase' ? 0.9 : mode === 'fetch' ? 1.6 : mode === 'think' ? 0.7 : mode === 'cloud' ? 1.0 : mode === 'coil' ? 2.4 : mode === 'king' ? 0.6 : mode === 'dance' ? 0.75 : 0.85) * dt;
    if (!gm) {   // turns ease in and out (Yang 11-17: tight turns are fine, sudden ones are not): in relaxed modes the turn rate
        // itself is smoothed, so the head rolls into a curve instead of snapping onto it; urgent modes (breath aim, dives,
        // coil) keep the direct clamp
      const dA = clamp(wrapA(want - dg.ang), -turn, turn);
      const relaxed = dg.breath <= 0 && !dg.roar && (mode === 'pearl' || mode === 'dance' || mode === 'hold' || mode === 'king' || mode === 'fetch' || mode === 'chase');
      if (relaxed) { dg.angV += (dA / Math.max(dt, 1e-3) - dg.angV) * Math.min(1, dt * 3.5); dg.ang += dg.angV * dt; }
      else { dg.angV = dA / Math.max(dt, 1e-3); dg.ang += dA; }
    }
    if (mode === 'dance') dg.ang += Math.sin(dn.ph4) * (0.55 + 0.35 * danceE) * dn.amt * dt;   // slow side-to-side head swing, one cycle per 4 beats
    if (!gm) dg.ang += Math.sin(T * 1.05) * (mode === 'kdive' ? 0.22 : mode === 'sniff' && near ? 0.3 : (dg.breath > 0 && dg.breathPearl) ? 0.2 : 1.15) * (1 - 0.45 * kg.amt) * dt;
    const calm = !autoCoil && T - lastAct > 20 && mode === 'pearl';
    const aimOff = Math.abs(wrapA(want - headA));
    const sp0 = Hh * (
      mode === 'kdive' ? (() => {
        const ke = T - cl.t;
        if (kd.hop >= kd.total) return 1.42 - 1.24 * clamp((ke - 0.25) / 1.1, 0, 1);
        const dA = cl.A ? Math.hypot(cl.A.x - dg.hx, cl.A.y - dg.hy) : Hh;
        const slowApproach = dA < cloudR() * 2.1 ? 0.62 + 0.35 * clamp((dA - cloudR() * 0.7) / (cloudR() * 1.4), 0, 1) : 1.0;
        const burst = ke < 0.45 ? 1.45 - ke * 0.55 : Math.max(0.88, 1.2 - (ke - 0.45) * 0.28);
        return burst * slowApproach;
      })() :
      dg.roar && dg.roarPearl && distPl > Hh * 0.65 ? 0.26 :
      dg.roar ? 0.1 :
      dg.breath > 0 && dg.breathPearl && aimOff > 0.32 ? 0.09 :
      dg.breath > 0 && dg.breathPearl && distPl < R * 4.5 ? 0.025 :
      dg.breath > 0 ? 0.05 :
      mode === 'sniff' ? (near ? 0.035 : 0.13) :
      mode === 'think' ? (distPl > Hh * 0.4 ? 0.16 : 0.085) :
      mode === 'cloud' ? 0.1 :
      mode === 'fetch' ? 0.28 :
      mode === 'hold' ? 0.1 :
      mode === 'coil' ? 0.16 :
      mode === 'swallow' ? 0.06 :
      mode === 'king' ? 0.085 :
      mode === 'dance' ? 0.15 + 0.06 * danceE + 0.03 * dn.kickS :
      calm ? 0.11 : chasing ? 0.2 : 0.16
    );
    // tail still in the cloud it came out of: the head keeps moving, whatever it is up to, so the body is drawn out in ~7 s
    // (at the idle 0.1-0.16 it took 15-20 s, the cloud hanging there all the while). Not while it breathes or roars
    const sp = gm ? gv : dg.reel && dg.reel.stack && dg.breath <= 0 && !dg.roar ? Math.max(sp0, Hh * 0.3) : sp0;
    const spdN = sp / Math.max(1, Hh);
    const idleW = clamp(1 - (spdN - 0.06) / 0.14, 0.35, 1.0);
    const driftX = (Math.cos(T * 0.67) * 0.6 + Math.sin(T * 1.13 + 0.8) * 0.4) * Hh * 0.022 * idleW;
    const driftY = (Math.sin(T * 0.53 + 0.4) * 0.6 + Math.cos(T * 0.89 + 1.7) * 0.4) * Hh * 0.022 * idleW;
    if (gm) { dg.hx = GM.x; dg.hy = GM.y; }
    else {
      dg.hx += (Math.cos(dg.ang) * sp + driftX) * dt;
      dg.hy += (Math.sin(dg.ang) * sp + driftY) * dt;
    }
    const m = Math.min(W, Hh) * 0.14;
    if (!gm && (dg.hx < m || dg.hx > W - m || dg.hy < m || dg.hy > Hh - m)) dg.ang += clamp(wrapA(Math.atan2(Hh / 2 - dg.hy, W / 2 - dg.hx) - dg.ang), -1.4 * dt, 1.4 * dt);
    const s = segLen();
    for (let i = 0; i < N; i++) { dg.prev[i].x = dg.pts[i].x; dg.prev[i].y = dg.pts[i].y; }
    // the spine is solved on the plain joints (wv.b*); what is drawn is those pushed sideways by the flight wave (below). A joint
    // still where the wave left it goes back to its plain place; one that other code has moved since (cloud dive path, coil
    // pose, reset) is taken as it stands and its wave starts again from nothing (g), so nothing jumps
    const wv = dg.wv || (dg.wv = { bx: new Float64Array(N), by: new Float64Array(N), dx: new Float64Array(N).fill(NaN), dy: new Float64Array(N), g: new Float64Array(N), f: new Float64Array(N), D: 0, ph: 0, w: 0 });
    let wExt = false;
    for (let i = 1; i < N; i++) { const p = dg.pts[i]; if (p.x === wv.dx[i] && p.y === wv.dy[i]) { p.x = wv.bx[i]; p.y = wv.by[i]; } else { wv.g[i] = 0; wExt = true; } }
    let wOut = Infinity;   // first joint still inside the cloud the body is reeling out of
    dg.pts[0].x = dg.hx; dg.pts[0].y = dg.hy;
    if (dg.reel && (dg.reel.stack ? cl.ph === 'enter' || cl.ph === 'hidden' || T - dg.reel.t0 > 30 : cl.ph !== 'emerge' || T - dg.reel.t0 > 4)) dg.reel = null;
    // joint i sits i*s back along the head's track R.P; joints not yet out wait at the cloud's centre (stack) or lie straight on
    // behind it (a King's hop)
    const onTrack = (R) => {
      const P = R.P;   // a hovering head adds no track: without this the 2000-point cap could cut the cloud's end off
      if (P.length > 1 && Math.hypot(dg.hx - P[1][0], dg.hy - P[1][1]) < 2) P[0] = [dg.hx, dg.hy];
      else { R.L = (R.L || 0) + Math.hypot(dg.hx - P[0][0], dg.hy - P[0][1]); P.unshift([dg.hx, dg.hy]); }
      let k = 0, acc = 0;
      for (let i = 1; i < N; i++) {
        const want = i * s;
        while (k < P.length - 1) { const sl = Math.hypot(P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]); if (acc + sl >= want) break; acc += sl; k++; }
        if (k >= P.length - 1) { if (wOut > i) wOut = i; const ex2 = R.stack ? 0 : want - acc, E = P[P.length - 1]; dg.pts[i].x = E[0] + R.bx * ex2; dg.pts[i].y = E[1] + R.by * ex2; continue; }
        const sl = Math.hypot(P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]) || 1, f = (want - acc) / sl;
        dg.pts[i].x = P[k][0] + (P[k + 1][0] - P[k][0]) * f; dg.pts[i].y = P[k][1] + (P[k + 1][1] - P[k][1]) * f;
      }
      if (P.length > 2000) P.length = 2000;
    };
    const follow = (Q) => {   // follow-the-leader down the joints Q, with the idle sway and the bend limit
    for (let i = 1; i < N; i++) {
      const a = Q[i - 1], b = Q[i];
      let ex = b.x - a.x, ey = b.y - a.y, l = Math.hypot(ex, ey) || 1;
      const nx = -ey / l, ny = ex / l, u = i / (N - 1);
      const env = Math.pow(u, 0.7) * (0.55 + 0.85 * u * u);
      const wv = Math.sin(T * 1.45 - i * 0.14) * 0.7 + Math.sin(T * 0.95 - i * 0.22 + 1.3) * 0.3;
      let lat = Hh * 0.038 * idleW * env * (1 - 0.25 * kg.amt) * wv * dt;
      if (dn.amt > 0.01) {   // dance: one wave crest per beat running head -> tail, a jolt on each kick, treble shivers the tail tip
        const de = 0.45 + 0.55 * u;
        lat += Hh * dn.amt * dt * (de * (0.07 + 0.05 * danceE + 0.04 * dn.kickS) * Math.sin(dn.ph2 - i * 0.11)
          + (u > 0.6 ? (u - 0.6) * 0.18 * Math.min(1, dn.hi) * Math.sin(T * 6 - i * 0.35) : 0));
      }
      ex += nx * lat; ey += ny * lat;
      // spine stiffness (Yang 11-17: tight turns folded the body onto itself): each joint may bend at most MAXB from the
      // segment before it, so a sharp head turn becomes a wide arc down the body instead of a kink. The coil pose needs
      // ~0.11 rad/joint, well inside the limit
      if (i >= 2) {
        const z = Q[i - 2], pa = Math.atan2(a.y - z.y, a.x - z.x), na = Math.atan2(ey, ex), d = wrapA(na - pa), MAXB = gm && GM.bend > 0 ? GM.bend : 0.2;   // a game may set its own limit, to match the turning circle it flies the head on
        if (Math.abs(d) > MAXB) { const ca = pa + Math.sign(d) * MAXB; ex = Math.cos(ca); ey = Math.sin(ca); }
      }
      l = Math.hypot(ex, ey) || 1;
      b.x = a.x + ex / l * s; b.y = a.y + ey / l * s;
    }
    };
    if (dg.xf && (dg.reel || wExt)) dg.xf = null;
    if (dg.reel) {
      onTrack(dg.reel);
      // whole body out, tail clear of the cloud's core: the reel lets go (was: acc within 1 px of the body length, which only
      // came true by chance, some frames to a second late). The reeled body lies on the head's track, and that may bend far
      // more than the spine's limit (a head turning near the screen edge at reel speed: 0.35 rad a joint; a breath on the spot:
      // a right angle). Handed straight to follow-the-leader, the limit bit in one frame and swung all the body behind the bend
      // round at once, 130 px at the tail. So for 2 s both run, the track and a follow-the-leader copy (xf.F), and the body
      // is cross-faded from the one to the other
      if (dg.reel.stack && wOut === Infinity && (dg.reel.L || 0) >= (N - 1) * s + cloudR() * 0.6) {
        dg.xf = { P: dg.reel.P, L: dg.reel.L, stack: true, bx: 0, by: 0, t: 0, F: dg.pts.map((q) => ({ x: q.x, y: q.y })) }; dg.reel = null; }
    } else if (dg.xf) {
      const X = dg.xf, F = X.F; X.t += dt / 2;
      onTrack(X); F[0].x = dg.hx; F[0].y = dg.hy; follow(F);
      const m = X.t >= 1 ? 1 : X.t * X.t * (3 - 2 * X.t);
      for (let i = 1; i < N; i++) { dg.pts[i].x += (F[i].x - dg.pts[i].x) * m; dg.pts[i].y += (F[i].y - dg.pts[i].y) * m; }
      if (X.t >= 1) dg.xf = null;
    } else {
      if (gm) {   // game: a head carried more than a segment in one frame straight back lands beyond joint 1, and the chain
        // turns inside out (the facing flipped in a frame). So the head is walked there in half-segment steps
        const ox = dg.prev[0].x, oy = dg.prev[0].y, n = Math.min(12, Math.ceil(Math.hypot(dg.hx - ox, dg.hy - oy) / (s * 0.5)));
        for (let k = 1; k < n; k++) { dg.pts[0].x = ox + (dg.hx - ox) * k / n; dg.pts[0].y = oy + (dg.hy - oy) * k / n; follow(dg.pts); }
        dg.pts[0].x = dg.hx; dg.pts[0].y = dg.hy;
      }
      follow(dg.pts);
    }
    // serpentine flight (Yang 11-18: flying, the body ran dead straight; it must wind in waves). Follow-the-leader pulls itself
    // straight behind a moving head, and the idle sway above (lat) fades with speed, so at cruising speed nothing was left.
    // The wave is a layer on top of the solved spine: each joint is shown pushed along the spine's normal. Its phase runs on
    // the distance flown (D, in joints), so the wave stands still in the air and the body threads through its bends like a
    // snake instead of shaking side to side; a slow drift keeps it creeping tailward at a hover. The head end stays put
    // (ramp over the first 30%), joints not yet out of a cloud stay put (wOut). Full from a slow cruise (0.08 Hh/s) up; a
    // breath, where the dragon all but stands, keeps a third to a half
    {
      wv.D += sp * dt / s; wv.ph += WAVE.drift * dt;
      const mm = mode === 'coil' ? 0.25 : mode === 'kdive' || mode === 'dance' ? 0.6 : mode === 'sniff' || mode === 'think' || mode === 'swallow' ? 0.5 : 1;
      wv.w += (clamp((spdN - 0.02) / 0.06, 0.35, 1) * mm - wv.w) * Math.min(1, dt * 1.2);
      const A = rad() * WAVE.amp * wv.w, kq = 2 * Math.PI / WAVE.len;
      for (let i = 0; i < N; i++) { wv.bx[i] = dg.pts[i].x; wv.by[i] = dg.pts[i].y; }
      // game (GM.waveTurn 0..1, Yang 11-18: flown in a circle the body still wriggled instead of going round): the wave is for
      // flying straight. Where the plain spine itself bends, a joint keeps only GM.waveTurn of it: all of it up to 0.025 rad a
      // joint (a curve 1.2 screens across), none from 0.075 (0.4 screens). CQ = that share lost, per joint: bend over the 8
      // joints round it, then blurred twice over 11 joints. Unblurred, the spine's bend limit makes it a step (a run of
      // joints at the limit next to straight ones), neighbours kept 0 and 0.96 of the wave, and the drawn spine broke into
      // a zigzag there (0.9 rad at one joint; Yang's figure-8 shot showed it at the tail). The wallpaper never sets it
      let CQ = null;
      if (gm && GM.waveTurn < 1) {
        const A0 = wv.q0 || (wv.q0 = new Float64Array(N)), A1 = wv.q1 || (wv.q1 = new Float64Array(N));
        for (let i = 0; i < N; i++) {
          const c = clamp(i, 4, N - 5), ax = wv.bx[c] - wv.bx[c - 4], ay = wv.by[c] - wv.by[c - 4], cx = wv.bx[c + 4] - wv.bx[c], cy = wv.by[c + 4] - wv.by[c];
          const q = clamp((Math.abs(Math.atan2(ax * cy - ay * cx, ax * cx + ay * cy)) / 4 - 0.025) / 0.05, 0, 1); A0[i] = q * q * (3 - 2 * q);
        }
        for (let pass = 0; pass < 2; pass++) { const src = pass ? A1 : A0, dst = pass ? A0 : A1;
          for (let i = 0; i < N; i++) { let a = 0; for (let k = -5; k <= 5; k++) a += src[clamp(i + k, 0, N - 1)]; dst[i] = a / 11; } }
        CQ = A0;
      }
      for (let i = 1; i < N; i++) {
        const g = wv.g[i] = Math.min(1, wv.g[i] + dt / 1.5), u = i / (N - 1), j1 = Math.min(N - 1, i + 1);
        const tx = wv.bx[i - 1] - wv.bx[j1], ty = wv.by[i - 1] - wv.by[j1], l = Math.hypot(tx, ty);
        if (l > 1e-3) {
          // none for joints still in the cloud or bunched up; eased in time, as wOut jumps when the last joint comes out
          const cf = CQ ? 1 - (1 - Math.max(0, GM.waveTurn)) * CQ[i] : 1;
          const e = clamp(u / 0.3, 0, 1), fo = wv.f[i] += clamp(cf * clamp((wOut - i) / 8, 0, 1) * clamp(2 * l / ((j1 - i + 1) * s) - 0.5, 0, 1) - wv.f[i], -dt * 4, dt * 2);
          const off = A * e * e * (3 - 2 * e) * (0.8 + 0.4 * u) * g * g * (3 - 2 * g) * fo * Math.sin(kq * (wv.D - i) + wv.ph);
          dg.pts[i].x -= ty / l * off; dg.pts[i].y += tx / l * off;
        } else wv.f[i] = 0;
        wv.dx[i] = dg.pts[i].x; wv.dy[i] = dg.pts[i].y;
      }
    }
    const wasBreath = dg.breath > 0;
    if (dg.breath > 0 && dg.wind > 0) {   // gather beat: jaws half open, wisps drawn in (see the wisps in step), no fire yet
      dg.wind += dt;
      // the fire waits until the head has come round to the aim (or 0.7 s): lit at once, it sprayed a fan of fire across the
      // screen while the head was still turning
      const hA = dg.pts.length >= 3 ? Math.atan2(dg.pts[0].y - dg.pts[2].y, dg.pts[0].x - dg.pts[2].x) : dg.ang;
      const off = Math.abs(wrapA(Math.atan2(dg.by - dg.hy, dg.bx - dg.hx) - hA));
      if (dg.wind >= GA.wind && (off < 0.45 || dg.wind > 0.7)) dg.wind = 0;
    } else { dg.wind = 0; dg.breath = Math.max(0, dg.breath - dt); }
    if (wasBreath && dg.breath <= 0) dg.after = 2.8;   // leftover wisps leak from the lip seam once the jaws shut
    if (dg.breath <= 0) dg.breathPearl = false;
    dg.jaw += ((dg.breath > 0 ? (dg.wind > 0 ? 0.5 : 1) : kg.ph === 'swallow' ? (T - kg.t < 0.45 ? 0.7 : 0) : pl.held ? 0.42 : 0) - dg.jaw) * Math.min(1, dt * 8);
    dg.fire += ((dg.breath > 0 && !(dg.wind > 0) ? 1 : 0) - dg.fire) * Math.min(1, dt * 8);
  }
  function startBreath(x, y, dur, pearl = false) {
    dg.bx = x; dg.by = y;
    if (dg.breath <= 0) dg.wind = 1e-3;   // a fresh breath gathers first; one already burning just carries on
    dg.breath = dur * (kg.amt > 0.5 ? 1.8 : 1);
    dg.breathPearl = !!pearl;
  }
  function sniffFx(t, px, py) {
    const n = headPt(2.75, -0.3), kx = simW / Math.max(1, W), ky = simH / Math.max(1, Hh), b = dark ? BODY.dark : BODY.light;
    if ((t > 0.3 && t < 0.75) || (t > 1.1 && t < 1.55)) {
      const l = Math.max(1, Math.hypot(n.x - px, n.y - py)), ux = (n.x - px) / l, uy = (n.y - py) / l, sp = Hh * 0.7;
      splat(px / W, 1 - py / Hh, ux * sp * kx, -uy * sp * ky, b.map(v => v * 0.12), 0.0004);
      splatVel((px + n.x) / 2 / W, 1 - (py + n.y) / 2 / Hh, ux * sp * kx, -uy * sp * ky, 0.0007);
    }
    if (t > 2.0 && t < 2.2) {
      const a = Math.atan2(dg.pts[0].y - dg.pts[2].y, dg.pts[0].x - dg.pts[2].x), sp = Hh * 1.4;
      for (const s of [-0.9, 0.9]) splat(n.x / W, 1 - n.y / Hh, Math.cos(a + s) * sp * kx, -Math.sin(a + s) * sp * ky, b.map(v => v * 0.35), 0.0005);
    }
  }

  const radAt = (t) => {   // body thickness profile, t = 0 head .. 1 tail
    const R = rad();
    if (t < 0.06) return R * (0.75 + t / 0.06 * 0.25);
    return R * Math.max(0.1, 1 - Math.pow((t - 0.06) / 0.94, 1.25) * 0.9) * (0.93 + 0.07 * Math.sin(t * 40));   // tapers from the chest on, like a brush stroke lifting off
  };
  function drawMask() {
    const k = mcv.height / Math.max(1, Hh);
    let c = mx;   // switched to the head layer while the head is drawn (taper/strand/sprite all draw into c)
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, mcv.width, mcv.height);
    c.setTransform(k, 0, 0, -k, 0, mcv.height);   // drawn upside down = GL's row order, so the upload needs no FLIP_Y
    c.fillStyle = '#f00'; c.strokeStyle = '#f00'; c.lineCap = 'round'; c.lineJoin = 'round';
    const pts = dg.pts, R = rad();
    // body tube, drawn tail -> head so the part nearer the head lies on top. Where the body crosses itself the front coil is
    // ringed by a thin gap (erased a little wider than the tube) so the two read apart as ink-paper-ink instead of one blob.
    // The gap would also bite into the segment's own neighbours just drawn, so those few are redrawn right after it.
    const segA = (t, i) => (t > 0.68 ? 0.45 + 0.55 * Math.pow(1 - (t - 0.68) / 0.32, 1.6) : 1) * visAt(pts[i].x, pts[i].y);   // last third: shape loosens, but stays joined to the flame tuft
    const seg = (i, w, al) => { c.lineWidth = w; c.globalAlpha = al; c.beginPath(); c.moveTo(pts[i - 1].x, pts[i - 1].y); c.lineTo(pts[i].x, pts[i].y); c.stroke(); };
    const GAP = R * 0.5, NB = 6;
    for (let i = N - 1; i >= 1; i--) {
      const t = i / (N - 1), al = segA(t, i);
      if (al > 0.02) {
        c.globalCompositeOperation = 'destination-out';
        seg(i, radAt(t) * 2 + GAP * 2 + R * 1.3, al * 0.4);   // soft shade: the coil behind fades lighter where it passes under
        seg(i, radAt(t) * 2 + GAP * 2, al);
        c.globalCompositeOperation = 'source-over';
        for (let j = Math.min(N - 1, i + NB); j > i; j--) { const tj = j / (N - 1); seg(j, radAt(tj) * 2, segA(tj, j)); }
      }
      seg(i, radAt(t) * 2, al);
    }
    c.globalAlpha = 1;
    const nrm = (i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l, dx / l, dy / l]; };
    // back / belly per body segment: the back is whichever side of the tube faces up on screen, the belly the side facing down.
    // (Fixed sides put the spikes under the belly and legs on the back when the dragon swam leftwards; taking the side from the
    // head's roll failed too wherever the body coils away from the head's heading.) bs() passes 0 where a segment is vertical,
    // so spikes and legs fold into the body there and come out on the other side.
    const bs = (ny) => -Math.max(-1, Math.min(1, ny * 4));   // back = +n * bs
    // dorsal fins (Yang's sketch 11-17): separate wave crests, not a saw. Each fin: long gentle S-curved front edge rising toward the
    // tail to a sharp tip, then a steep concave back edge curling down to a small hook at the foot; feet nearly touch. Outline in
    // (u along the back toward the tail, v up off the back), laid onto the spine by arc length so every fin bends with the body
    {
      const FIN_F = [[0, 0], [.12, .2], [.3, .35], [.5, .48], [.7, .65], [.88, .85], [1, 1]];
      const FIN_B = [[.9, .82], [.8, .62], [.76, .45], [.78, .25], [.85, .1], [.9, .04], [.97, 0]];
      const FIN_BARB = [[.9, .82], [.8, .62], [.76, .45], [.77, .22], [.84, .2], [.85, .06], [.92, .1], [.97, 0]];   // third fin: a barb at the foot
      const iEnd = Math.round(N * 0.66), cum = [0];
      for (let i = 1; i < N; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      const at = (s) => {   // spine point, back normal and radius at arc length s
        let i = 1; while (i < N - 1 && cum[i] < s) i++;
        const f = Math.max(0, Math.min(1, (s - cum[i - 1]) / Math.max(1e-3, cum[i] - cum[i - 1])));
        const [nxa, nya] = nrm(i - 1), [nxb, nyb] = nrm(i), nx0 = nxa + (nxb - nxa) * f, ny0 = nya + (nyb - nya) * f, b = bs(ny0);
        return [pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f, nx0 * b, ny0 * b, radAt((i - 1 + f) / (N - 1))];
      };
      // fins go to their own layer, then onto the mask through a soft ring of offset copies: smoke veils them (Yang: don't show the
      // silhouette). One ring for all fins; a canvas blur filter per fin cost ~3 ms a frame
      if (!fcv || fcv.width !== mcv.width || fcv.height !== mcv.height) { fcv = document.createElement('canvas'); fcv.width = mcv.width; fcv.height = mcv.height; fx = fcv.getContext('2d'); }
      fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, fcv.width, fcv.height); fx.setTransform(k, 0, 0, -k, 0, mcv.height); fx.fillStyle = '#f00';
      let s = cum[3], fi = 0;
      while (s < cum[iEnd]) {
        const [, , , , r0] = at(s), q = s / cum[iEnd];
        const sz = Math.min(1, 0.55 + q * 1.6) * (1 - 0.35 * Math.max(0, q - 0.7) / 0.3);   // small at the nape, full mid-back, shrinking toward the tail
        const L = r0 * 1.5 * sz, H = r0 * 0.9 * sz, sway = Math.sin(T * 2.4 - fi * 0.9) * 0.08;
        const out = FIN_F.concat(fi % 3 === 2 ? FIN_BARB : FIN_B);
        fx.beginPath();
        out.forEach(([u, v], j) => {
          const [x, y, nx, ny, r] = at(s + u * L), lean = sway * v * v * L;   // tip flutters, foot stays put
          const [, , tx, ty] = nrm(Math.min(N - 1, Math.max(0, Math.round((s + u * L) / cum[N - 1] * (N - 1)))));
          const px = x + nx * (r * 0.8 + v * H) + tx * lean, py = y + ny * (r * 0.8 + v * H) + ty * lean;
          j ? fx.lineTo(px, py) : fx.moveTo(px, py);
        });
        fx.closePath();
        const [mx0, my0] = at(s + L * 0.5);
        fx.globalAlpha = visAt(mx0, my0); fx.fill();
        s += L * 0.97; fi++;
      }
      const d = radAt(0.35) * k * FIN_SOFT;
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = FIN_CORE; c.drawImage(fcv, 0, 0);
      if (FIN_RING > 0) { c.globalAlpha = FIN_RING; } if (FIN_RING > 0) for (let j = 0; j < 8; j++) c.drawImage(fcv, Math.cos(j * Math.PI / 4) * d, Math.sin(j * Math.PI / 4) * d);
      c.restore();
    }
    // tapered filled stroke along a polyline: pointed, no round caps (round caps read as paddles once blurred)
    const taper = (P, w0, w1, prof) => {   // prof(q) overrides the linear w0 -> w1 width
      const n = P.length, Lp = [], Rp = [];
      for (let k = 0; k < n; k++) {
        const a = P[Math.max(0, k - 1)], b = P[Math.min(n - 1, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        const w = (prof ? prof(k / (n - 1)) : w0 + (w1 - w0) * k / (n - 1)) / 2, ox = -dy / l * w, oy = dx / l * w;
        Lp.push([P[k][0] + ox, P[k][1] + oy]); Rp.push([P[k][0] - ox, P[k][1] - oy]);
      }
      c.beginPath(); c.moveTo(Lp[0][0], Lp[0][1]); for (const q of Lp.slice(1)) c.lineTo(q[0], q[1]);
      for (const q of Rp.reverse()) c.lineTo(q[0], q[1]); c.closePath(); c.fill();
    };
    const curve = (x0, y0, x1, y1, x2, y2, n) => { const P = []; for (let k = 0; k <= n; k++) { const u = k / n, v = 1 - u; P.push([v * v * x0 + 2 * v * u * x1 + u * u * x2, v * v * y0 + 2 * v * u * y1 + u * u * y2]); } return P; };
    // whisker / hair strand: heading turns by curl over its length, a wave travels from root to tip and grows toward the tip
    // ww = whip: more points, a shorter wave (two crests along the strand) plus a slower sway, so long whiskers ripple like silk
    const strand = (x0, y0, a0, curl, L, ph, ww) => { const n = ww ? 44 : 18, P = [[x0, y0]], st = L / n; let x = x0, y = y0;
      for (let k = 1; k <= n; k++) { const u = k / n,
          a = a0 + curl * u + (ww ? Math.sin(T * 2.2 - u * 11 + ph) * 0.42 * u + Math.sin(T * 0.9 - u * 3 + ph * 1.7) * 0.18
                                   : Math.sin(T * 2.6 - u * 5 + ph) * 0.55 * u);
        x += Math.cos(a) * st; y += Math.sin(a) * st; P.push([x, y]); }
      return P; };
    // legs (Yang's sketch): fat oval thigh at the hip, round knee, long tapering shin, eagle foot with three forward toes and a
    // rear one, each toe bent once and ending in a hooked talon, a tuft of hair streaming back off the knee. Built in a local frame
    // per leg, (p forward, q toward the belly, units of body radius r); the belly is the segment's screen-down side (bs), so legs
    // never stick out of the back. Each pair paddles: hip swings, knee folds, toes clench on the back-stroke; far leg in counter-phase.
    for (const [t, far] of [[0.16, 0], [0.22, 1], [0.5, 0], [0.56, 1]]) {
      const i = Math.round(t * (N - 1)), [nx, ny, tx, ty] = nrm(i), r = radAt(t) * (far ? 0.85 : 1);
      const fx = -tx, fy = -ty, bx = -nx * bs(ny), by = -ny * bs(ny);   // forward, belly
      const W = (p, q) => [pts[i].x + (fx * p + bx * q) * r, pts[i].y + (fy * p + by * q) * r];
      const D = (ang, L) => [Math.cos(ang) * L, Math.sin(ang) * L];   // local direction: 0 = forward, PI/2 = down, PI = back
      const ph = T * 3 + i * 0.7 + far * Math.PI, sw = Math.sin(ph), cl = 0.5 + 0.5 * Math.sin(ph - 0.9);   // swing, clench
      c.globalAlpha = visAt(pts[i].x, pts[i].y);
      const hip = [0, 0.7], a1 = 1.85 + 0.5 * sw, d1 = D(a1, 1.35), knee = [hip[0] + d1[0], hip[1] + d1[1]];
      const a2 = a1 - 1.15 - 0.35 * Math.sin(ph + 0.8), d2 = D(a2, 1.3), ank = [knee[0] + d2[0], knee[1] + d2[1]];
      // thigh: oval along the bone, a little past both ends
      { const m = W((hip[0] + knee[0]) / 2, (hip[1] + knee[1]) / 2), e = W(knee[0], knee[1]), h0 = W(hip[0], hip[1]);
        c.beginPath(); c.ellipse(m[0], m[1], r * 0.95, r * 0.55, Math.atan2(e[1] - h0[1], e[0] - h0[0]), 0, Math.PI * 2); c.fill(); }
      { const k = W(knee[0], knee[1]); c.beginPath(); c.arc(k[0], k[1], r * 0.36, 0, Math.PI * 2); c.fill(); }
      taper([knee, [knee[0] + d2[0] * 0.5, knee[1] + d2[1] * 0.5], ank].map(([p, q]) => W(p, q)), r * 0.5, r * 0.28);
      // knee tuft: three locks streaming back and up off the joint
      for (let j = 0; j < 3; j++) { const k = W(knee[0] - 0.1, knee[1] - 0.05), back = Math.atan2(-fy * 0.9 - by * (0.35 - j * 0.3), -fx * 0.9 - bx * (0.35 - j * 0.3));
        taper(strand(k[0], k[1], back, (j - 1) * 0.3, r * (1.3 + 0.35 * (j === 1)), i + j), r * 0.34, 0); }
      // foot: toes fan forward-down from the ankle; the rear toe points back. Bend and hook grow when the foot clenches
      const a3 = a2 + 0.25;
      for (const [off, L] of [[-0.55, 0.5], [-0.05, 0.58], [0.45, 0.5], [Math.PI - 0.9, 0.32]]) {
        const ta = a3 + off * (1 - cl * 0.35), bend = 0.45 + cl * 0.5, P = [ank];
        let q = ank, ang = ta;
        for (const [seg, turn] of [[L, 0], [L * 0.7, bend], [0.28, bend + 0.7]]) { ang = ta + turn; const d = D(ang, seg); q = [q[0] + d[0], q[1] + d[1]]; P.push(q); }
        taper(P.map(([p, qq]) => W(p, qq)), r * 0.3, 0);
      }
    }
    // tail tuft (Yang's sketch): ONE slim, sleek plume off the tip, spear-shaped: grows out of the last bit of tail, swells a
    // little, then draws out into a long point. Both edges are serrated with a few backward-raking notches, staggered between
    // top and bottom, like a flame. Centreline follows the tail's last tangent with a wave running down it. u along, v across.
    { const j = Math.max(1, N - 1 - Math.round(R * 0.5 / segLen())), [nx, ny, tx, ty] = nrm(Math.min(N - 2, j)), J = pts[j], r = R * 0.5, L = 6.5, n = 40;
      const saw = (q, ph) => { const x = (q * 3.2 + ph) % 1; return x < 0.8 ? x / 0.8 : (1 - x) / 0.2; };   // slow rise, sharp drop = notch raking back
      const half = (q) => (q < 0.25 ? 0.25 + 0.75 * Math.sin(q / 0.25 * Math.PI / 2) : Math.pow((1 - q) / 0.75, 1.15)) * 0.6;
      const C = [], Tp = [], Bp = []; let u = 0, v = 0;
      for (let k = 0; k <= n; k++) { const q = k / n, ang = Math.sin(T * 2.4 - q * 4 ) * 0.22 * q;
        C.push([u, v]); u += Math.cos(ang) * L / n; v += Math.sin(ang) * L / n; }
      for (let k = 0; k <= n; k++) {
        const q = k / n, a = C[Math.max(0, k - 1)], b = C[Math.min(n, k + 1)], du = b[0] - a[0], dv = b[1] - a[1], l = Math.hypot(du, dv) || 1;
        const g = q > 0.2 && q < 0.85 ? 1 : 0, wt = half(q) * (1 + 0.45 * g * saw(q, 0.1)), wb = half(q) * (1 + 0.45 * g * saw(q, 0.55));
        Tp.push([C[k][0] - dv / l * wt, C[k][1] + du / l * wt]); Bp.push([C[k][0] + dv / l * wb, C[k][1] - du / l * wb]);
      }
      const W = ([uu, vv]) => [J.x + tx * uu * r + nx * vv * r, J.y + ty * uu * r + ny * vv * r];
      c.globalAlpha = 0.8 * visAt(J.x, J.y);
      c.beginPath(); let q0 = W(Tp[0]); c.moveTo(q0[0], q0[1]);
      for (const p of Tp.slice(1)) { const w = W(p); c.lineTo(w[0], w[1]); }
      for (const p of Bp.reverse()) { const w = W(p); c.lineTo(w[0], w[1]); }
      c.closePath(); c.fill(); c.globalAlpha = 1; }
    // head, in head space: +x forward, +y = right side
    const a = Math.atan2(pts[0].y - pts[2].y, pts[0].x - pts[2].x);
    c.globalAlpha = visAt(pts[0].x, pts[0].y);
    if (c.globalAlpha <= 0.01) { c.globalAlpha = 1; drawClouds(c); return; }
    // the head goes to its own layer first, so it can be ringed by the same gap as a front coil when it swings over the body
    if (!hcv || hcv.width !== mcv.width || hcv.height !== mcv.height) { hcv = document.createElement('canvas'); hcv.width = mcv.width; hcv.height = mcv.height; hx = hcv.getContext('2d'); }
    hx.setTransform(1, 0, 0, 1, 0, 0); hx.clearRect(0, 0, hcv.width, hcv.height); hx.setTransform(k, 0, 0, -k, 0, mcv.height);
    hx.fillStyle = '#f00'; hx.strokeStyle = '#f00'; hx.lineCap = 'round'; hx.lineJoin = 'round'; hx.globalAlpha = c.globalAlpha;
    c = hx;
    c.save(); c.translate(pts[0].x, pts[0].y); c.rotate(a);
    const flip = headFlip();   // keep the head upright: horns up on screen, rolled over smoothly
    c.scale(HS, HS * flip);   // head reads bigger than the body tube
    // mouth opening (Yang): BOTH jaws part about the hinge in the cheek: the whole upper head (skull, snout, horn, eye, crest,
    // whiskers) tilts up by JU, the lower jaw + cheek drops by JL
    const jaw = dg.jaw * 0.95, JU = jaw * JAW_UP, JL = jaw - JU;
    const [HX, HY] = HEAD.hinge, PX = HX * R, PY = HY * R;
    const rotAt = (ang) => { const cs = Math.cos(ang), sn = Math.sin(ang); return (x, y) => [PX + (x * cs - y * sn) * R, PY + (x * sn + y * cs) * R]; };
    const lj = rotAt(JL), uj = rotAt(-JU);   // lower-jaw / upper-head frames (R units, from the hinge) -> head space
    const upper = (fn) => { c.save(); c.translate(PX, PY); c.rotate(-JU); c.translate(-PX, -PY); fn(); c.restore(); };
    upper(() => {
    // hair (Yang's sketch): a crest of flame-like spikes along the top of the skull, brow to nape, taller and flatter toward the back,
    // plus thick wavy locks streaming back from the rear of the skull, fanned top to bottom. Roots sit on the skull outline
    // (sampled from Yang's drawing) so the hair grows out of the silhouette instead of hiding inside it.
    const CREST = [[1.07, -0.81], [0.74, -0.95], [0.41, -1.05], [0.09, -1.1], [-0.24, -1.09], [-0.5, -0.85], [-0.75, -0.62]];
    const KA = kg.amt;   // Long Vương: crest and mane half as long again, whiskers a third longer
    CREST.forEach(([x, y], j) => { const u = j / (CREST.length - 1);
      taper(strand(R * x, R * (y + 0.08), -1.95 - u * 0.65, -0.35, R * (0.75 + u * 0.95) * (1 + 0.5 * KA), j * 1.1), R * (0.55 + u * 0.15) * (1 + 0.2 * KA), 0); });
    const NAPE = [[-0.78, -0.66], [-0.87, -0.41], [-0.92, -0.17], [-0.86, 0.07], [-0.72, 0.31], [-0.45, 0.5]];
    // Yang: "dày lên" -- two layers: long thick locks, plus a shorter, wider-fanned undercoat so the nape reads as a full mane
    for (let j = 0; j < 26; j++) { const lay = j < 16 ? 0 : 1, n = lay ? 10 : 16, k = lay ? j - 16 : j;
      const t = (k + lay * 0.5) / n * (NAPE.length - 1), i = Math.min(NAPE.length - 2, Math.floor(t)), f = Math.min(1, t - i);
      const x = NAPE[i][0] + (NAPE[i + 1][0] - NAPE[i][0]) * f, y = NAPE[i][1] + (NAPE[i + 1][1] - NAPE[i][1]) * f;
      const L = R * (lay ? 1.3 + 0.5 * Math.abs(Math.sin(k * 2.7)) : 2.4 + 1.0 * Math.abs(Math.sin(k * 1.9 + 0.5))) * (1 + 0.5 * KA);
      const SP = strand(R * (x + 0.15), R * y, Math.PI - y * (lay ? 1.15 : 0.8), (k % 2 ? 0.3 : -0.3), L, k * 0.65 + lay), w0 = R * (lay ? 0.55 : 0.6);
      taper(SP, w0, 0);
      // Long Vương (Yang 11-17): the mane catches imperial gold only at its tips, and only in flickers. The last ~third of a lock
      // is redrawn in mask yellow (= gold ink, same path as the antler), each lock on its own slow flicker so a few tips glint at a
      // time instead of the whole mane lighting up
      if (KA > 0.01) {
        const fl = Math.max(0, Math.sin(T * (1.7 + 0.4 * Math.sin(k * 3.1)) + k * 2.3 + lay * 1.4) * 1.6 - 0.45);
        const ga = c.globalAlpha, gA = ga * KA * Math.min(1, fl);
        if (gA > 0.02) {
          const s0 = Math.floor((SP.length - 1) * 0.62);
          c.fillStyle = '#ff0'; c.globalAlpha = gA;
          taper(SP.slice(s0), w0 * (1 - s0 / (SP.length - 1)) * 1.08, 0);
          c.fillStyle = '#f00'; c.globalAlpha = ga;
        }
      }
    }
      // skull, snout, horn: Yang's silhouette (also covers the cheek area, so no hole shows behind it when the jaw swings)
      sprite(c, HEAD.skull, R);
      // Long Vương: the imperial antler grows out of the brow with the burst (scaled up from its root) and withdraws on revert
      if (kg.amt > 0.01) { const [rx, ry] = HEAD.crown.root, s = 0.5 + 0.5 * kg.amt, ga = c.globalAlpha;
        c.save(); c.translate(rx * R, ry * R); c.scale(s, s); c.translate(-rx * R, -ry * R); c.globalAlpha = ga * Math.min(1, kg.amt * 1.6);
        sprite(c, HEAD.crown, R); c.restore(); }
    });
    // gape = triangle hinge / upper-jaw tip / lower-jaw tip, so cut and jaws always line up
    const U0 = uj(HEAD.upTip[0] - HX, HEAD.upTip[1] - HY);
    if (dg.jaw > 0.08) {   // clear the gape, glow the throat
      const L0 = lj(HEAD.loTip[0], HEAD.loTip[1]);
      c.beginPath(); c.moveTo(PX, PY); c.lineTo(U0[0], U0[1]); c.lineTo(L0[0], L0[1]); c.closePath();
      c.globalCompositeOperation = 'destination-out'; c.fill();
      const gr = c.createLinearGradient(PX, PY, U0[0], U0[1]); gr.addColorStop(0, 'rgb(0,255,0)'); gr.addColorStop(1, 'rgb(0,30,0)');
      c.globalCompositeOperation = 'lighter'; c.fillStyle = gr; c.fill();
      c.globalCompositeOperation = 'source-over'; c.fillStyle = '#f00';
      // upper fang hanging into the gape, 3/4 of the way to the snout tip
      const fx = PX + (U0[0] - PX) * 0.75, fy = PY + (U0[1] - PY) * 0.75, d = -JU;
      const fp = (u, v) => [fx + (u * Math.cos(d) - v * Math.sin(d)) * R, fy + (u * Math.sin(d) + v * Math.cos(d)) * R];
      const F = [fp(-0.12, -0.04), fp(0.02, 0.32), fp(0.14, 0.02)];
      c.beginPath(); c.moveTo(F[0][0], F[0][1]); c.lineTo(F[1][0], F[1][1]); c.lineTo(F[2][0], F[2][1]); c.fill();
    }
    // lower jaw + cheek (one piece), drawn after the cut, rotating about the hinge in the cheek; a fang; beard below
    { c.save(); c.translate(PX, PY); c.rotate(JL); sprite(c, HEAD.jaw, R); c.restore();
      if (dg.jaw > 0.08) { const f = [[1.8, 0.5], [1.92, 0.2], [2.04, 0.5]].map(([x, y]) => lj(x, y));
        c.beginPath(); c.moveTo(f[0][0], f[0][1]); c.lineTo(f[1][0], f[1][1]); c.lineTo(f[2][0], f[2][1]); c.fill(); }
      // beard (Yang's sketch): a ragged fringe of short wedges along the whole underside of the lower jaw, chin to under the cheek,
      // hanging down-back, all about the same short length
      HEAD.under.forEach(([x, y], j) => { const u = j / (HEAD.under.length - 1), p = lj(x, y - 0.04), L = R * (0.45 + 0.12 * Math.sin(j * 2.3 + 0.7) + u * 0.2);
        taper(strand(p[0], p[1], 2.0 + u * 0.25 + JL, 0.3, L, j * 0.8), R * 0.3, 0); }); }
    upper(() => {
    // long whiskers (Yang's sketch): a pair from the upper lip at the snout tip, streaming almost straight back along the mouth line
    // and well past the head, dipping a little so they clear the underside of the neck
    taper(strand(R * 2.75, R * 0.66, Math.PI - 0.05, -0.06, R * 10.0 * (1 + 0.3 * kg.amt), 0, 1), R * 0.2, R * 0.02);
    taper(strand(R * 2.7, R * 0.78, Math.PI - 0.13, 0.05, R * 9.0 * (1 + 0.3 * kg.amt), 2.1, 1), R * 0.18, R * 0.02);
      // eye: cut hole from head ink and mark feathered eye shape in mask.b
      c.globalCompositeOperation = 'destination-out';
      sprite(c, HEAD.eye, R);
      c.globalCompositeOperation = 'source-over';
      if (!eyeBlueCv && HEAD.eye.im.complete) buildEyeBlue(HEAD.eye.im);
      if (eyeBlueCv) c.drawImage(eyeBlueCv, HEAD.eye.x * R, HEAD.eye.y * R, HEAD.eye.w * R, HEAD.eye.h * R);
    });
    c.globalCompositeOperation = 'source-over';
    c.restore(); c.globalAlpha = 1;
    c = mx;
    // head layer -> mask: erase a soft halo around the head, give the neck back, then lay the head on top
    { const d = GAP * k;
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-out';
      c.globalAlpha = 0.25; for (let j = 0; j < 8; j++) c.drawImage(hcv, Math.cos(j * Math.PI / 4) * d * 2.2, Math.sin(j * Math.PI / 4) * d * 2.2);
      c.globalAlpha = 0.55; for (let j = 0; j < 8; j++) c.drawImage(hcv, Math.cos(j * Math.PI / 4) * d * 0.85, Math.sin(j * Math.PI / 4) * d * 0.85);
      c.restore(); c.globalCompositeOperation = 'source-over';
      for (let j = Math.min(N - 1, 15); j >= 1; j--) { const tj = j / (N - 1); seg(j, radAt(tj) * 2, segA(tj, j)); }
      c.globalAlpha = 1;
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(hcv, 0, 0); c.restore(); }
    drawClouds(c);
  }
  let hcv = null, hx = null;   // head layer
  let fcv = null, fx = null;   // dorsal fin layer
  const FIN_SOFT = 0, FIN_CORE = 1, FIN_RING = 0;
  // ---- calligraphy: a big running-script column 龍魂舞曲 (Long Hồn Vũ Khúc, "dance of the dragon soul", Yang's title in Chinese word order), a small column 飛龍在天,
  // and a red seal 墨龍 with the characters cut out. r = ink, g = seal. Redrawn only on resize. System fonts only.
  const FONT = '"STXingkai","华文行楷","STKaiti","KaiTi","Kaiti SC",serif';
  let calTex = null, sealKing = false;
  function kingSeal(on) { sealKing = on; if (gl) buildCalli(); }
  function buildCalli() {
    const w = cv.width, h = cv.height, k = h / Math.max(1, Hh), c = document.createElement('canvas').getContext('2d');
    c.canvas.width = w; c.canvas.height = h;
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'lighter'; c.textAlign = 'center'; c.textBaseline = 'middle';
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const column = (txt, x, y, size, alpha) => {
      c.fillStyle = `rgba(255,0,0,${alpha})`;
      for (const ch of txt) {
        const sz = size * (0.92 + rnd() * 0.18);
        c.save(); c.translate(x + (rnd() - 0.5) * size * 0.08, y + sz / 2); c.rotate((rnd() - 0.5) * 0.12);
        c.font = `${Math.round(sz)}px ${FONT}`; c.fillText(ch, 0, 0); c.restore();
        y += sz * 0.98;
      }
      return y;
    };
    const big = Hh * 0.12 * k, small = Hh * 0.042 * k, x0 = w - big * 0.85;
    column('龍魂舞曲', x0, h * 0.08, big, 1);
    const ys = column('飛龍在天', x0 - big * 0.95, h * 0.13, small, 0.9);
    // seal: square, slightly rough edge, characters knocked out
    const ss = small * 1.5, sc = document.createElement('canvas').getContext('2d');
    sc.canvas.width = sc.canvas.height = Math.ceil(ss);
    sc.fillStyle = '#0f0'; sc.beginPath();
    sc.moveTo(ss * 0.03, ss * 0.05); sc.lineTo(ss * 0.97, ss * 0.02); sc.lineTo(ss * 0.98, ss * 0.96); sc.lineTo(ss * 0.04, ss * 0.98); sc.closePath(); sc.fill();
    sc.globalCompositeOperation = 'destination-out'; sc.textAlign = 'center'; sc.textBaseline = 'middle';
    sc.font = `${Math.round(ss * 0.44)}px "STKaiti","KaiTi",serif`;
    const [s1, s2] = sealKing ? ['龍', '王'] : ['墨', '龍'];   // Long Vương: the seal reads 龍王
    sc.fillText(s1, ss * 0.5, ss * 0.28); sc.fillText(s2, ss * 0.5, ss * 0.72);
    c.drawImage(sc.canvas, x0 - big * 0.95 - ss / 2, ys + small * 0.4);
    if (!calTex) {
      calTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, calTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindTexture(gl.TEXTURE_2D, calTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c.canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }
  let maskTexW = 0, maskTexH = 0;
  function uploadMask() {   // overwrite in place; reallocate only when the size changes
    gl.bindTexture(gl.TEXTURE_2D, maskTex);
    if (maskTexW !== mcv.width || maskTexH !== mcv.height) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mcv); maskTexW = mcv.width; maskTexH = mcv.height; }
    else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, mcv);
  }
  // eye position in CSS px (HEAD.eyeAt, head space, at head scale HS, horns-up flip)
  function headPt(lx, ly) {   // head space (units of R, x forward, y down-right) -> CSS px; matches drawMask's scale 1.35 + flip
    if (dg.pts.length < 3) return { x: -1e4, y: -1e4 };   // render can run before dragonInit
    const p0 = dg.pts[0], p2 = dg.pts[2], a = Math.atan2(p0.y - p2.y, p0.x - p2.x), R = rad() * HS;
    const f = headFlip(), x = lx * R, y = ly * R * f;
    return { x: p0.x + Math.cos(a) * x - Math.sin(a) * y, y: p0.y + Math.sin(a) * x + Math.cos(a) * y };
  }
  const JAW_UP = 0.4;   // share of the mouth opening taken by the upper head tilting up; the rest drops the lower jaw
  const aboutHinge = (x, y, ang) => { const [hx, hy] = HEAD.hinge, dx = x - hx, dy = y - hy, cs = Math.cos(ang), sn = Math.sin(ang); return [hx + dx * cs - dy * sn, hy + dx * sn + dy * cs]; };
  const eye = () => { const p = aboutHinge(HEAD.eyeAt[0], HEAD.eyeAt[1], -dg.jaw * 0.95 * JAW_UP); return headPt(p[0], p[1]); };
  // mouth point for fire / pearl / throat glow: between the two jaw tips, just inside the lips. (The old triangle centroid sat a
  // third of the way from the hinge, which is under the eye, so the fire came out of the cheek.)
  const gape = () => { const j = dg.jaw * 0.95, ju = j * JAW_UP, [hx, hy] = HEAD.hinge, [lx, ly] = HEAD.loTip;
    const u = aboutHinge(HEAD.upTip[0], HEAD.upTip[1], -ju), l = [hx + lx * Math.cos(j - ju) - ly * Math.sin(j - ju), hy + lx * Math.sin(j - ju) + ly * Math.cos(j - ju)];
    return headPt(hx + ((u[0] + l[0]) / 2 - hx) * 0.82, hy + ((u[1] + l[1]) / 2 - hy) * 0.82); };
  // mouth origin inside open gape connecting throat glow smoothly into breath cone
  function mouth() {
    const hP = headPt(HEAD.hinge[0], HEAD.hinge[1]), g = gape();
    const ox = hP.x + (g.x - hP.x) * 0.82, oy = hP.y + (g.y - hP.y) * 0.82;
    const dx = g.x - hP.x, dy = g.y - hP.y;
    const a = (dx * dx + dy * dy) > 1e-4 ? Math.atan2(dy, dx) : (dg.pts.length >= 3 ? Math.atan2(dg.pts[0].y - dg.pts[2].y, dg.pts[0].x - dg.pts[2].x) : dg.ang);
    return { x: ox, y: oy, a };
  }

  // ---- simulation ------------------------------------------------------------------------
  function splatVel(x, y, dx, dy, r) {
    pass('splat', vel.b, [vel.a.tex], { uP: [x, y], uR: r, uAsp: cv.width / Math.max(1, cv.height), uC: [dx, dy, 0, 0] }); vel.swap();
  }
  function splat(x, y, dx, dy, color, r) {
    splatVel(x, y, dx, dy, r);
    dyeQ.push([x, y, r, color]);
  }
  const dyeQ = [], segQ = [];   // segQ: [x0, y0, x1, y1, r, colour]
  function flushDye() {
    while (segQ.length) {
      const b = segQ.splice(0, 4), A4 = new Float32Array(16), C4 = new Float32Array(16);
      b.forEach(([x0, y0, x1, y1, r, c], i) => { A4.set([x0, y0, x1, y1], i * 4); C4.set([c[0], c[1], c[2], r], i * 4); });
      const pr = P.seg4; gl.useProgram(pr.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, dye.b.fb); gl.viewport(0, 0, dye.b.w, dye.b.h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, dye.a.tex); gl.uniform1i(pr.u('t0'), 0);
      gl.uniform1f(pr.u('uAsp'), cv.width / Math.max(1, cv.height));
      gl.uniform4fv(pr.u('uA[0]'), A4); gl.uniform4fv(pr.u('uC[0]'), C4);
      gl.drawArrays(gl.TRIANGLES, 0, 3); dye.swap();
    }
    while (dyeQ.length) {
      const b = dyeQ.splice(0, 4), P4 = new Float32Array(16), C4 = new Float32Array(16);
      b.forEach(([x, y, r, c, ea], i) => { P4.set([x, y, r, 1], i * 4); C4.set([c[0], c[1], c[2], ea || 0], i * 4); });
      const pr = P.splat4; gl.useProgram(pr.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, dye.b.fb); gl.viewport(0, 0, dye.b.w, dye.b.h);
      gl.uniform2fv(pr.u('uTx'), dye.tx);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, dye.a.tex); gl.uniform1i(pr.u('t0'), 0);
      gl.uniform1f(pr.u('uAsp'), cv.width / Math.max(1, cv.height));
      gl.uniform4fv(pr.u('uP[0]'), P4); gl.uniform4fv(pr.u('uC[0]'), C4);
      gl.drawArrays(gl.TRIANGLES, 0, 3); dye.swap();
    }
  }
  function step(dt) {
    pass('curl', crl, [vel.a.tex], {});
    pass('vorticity', vel.b, [vel.a.tex, crl.tex], { uCurl: CFG.curl, uCMax: 12, uDt: dt }); vel.swap();
    pass('stir', vel.b, [vel.a.tex, maskTex], { uAmp: T < coilUntil ? 8 : 6, uT: T, uDt: dt }); vel.swap();
    pass('divergence', div, [vel.a.tex], {});
    pass('clear', prs.b, [prs.a.tex], { uK: CFG.pressK }); prs.swap();
    for (let i = 0; i < ITER; i++) { pass('pressure', prs.b, [prs.a.tex, div.tex], {}); prs.swap(); }
    pass('gradient', vel.b, [prs.a.tex, vel.a.tex], {}); vel.swap();
    pass('advect', vel.b, [vel.a.tex, vel.a.tex], { uDt: dt, uDiss: CFG.velDiss, uSrcTx: vel.tx, uVelTx: vel.tx, uManual: linear ? 0 : 1 }); vel.swap();
    pass('vsm', crl, [vel.a.tex, dye.a.tex], { uSmR: [50, 180], uDk: dark ? 1 : 0 });   // crl is free again until the next step's curl pass
    pass('advect', dye.b, [crl.tex, dye.a.tex], { uDt: dt, uDiss: CFG.dyeDiss, uSrcTx: dye.tx, uVelTx: vel.tx, uManual: linear ? 0 : 1 }, vel.tx); dye.swap();
    const e = eye();
    const ea = visAt(dg.pts[0]?.x ?? 0, dg.pts[0]?.y ?? 0, true);
    const eyeNorm = dark ? [1.15, 0.30, 0.04] : [0.03, 1.28, 2.1];
    const eyeKing = dark ? [1.22, 0.85, 0.16] : [0.02, 0.50, 1.9];
    const ka = kg.amt;
    const eyeInk = [
      eyeNorm[0] + (eyeKing[0] - eyeNorm[0]) * ka,
      eyeNorm[1] + (eyeKing[1] - eyeNorm[1]) * ka,
      eyeNorm[2] + (eyeKing[2] - eyeNorm[2]) * ka,
    ];
    pass('ink', dye.b, [dye.a.tex, maskTex, vel.a.tex], {
      uInk: dark ? BODY.dark : BODY.light,
      uGold: dark ? GOLD_INK.dark : GOLD_INK.light,
      uEyeInk: eyeInk,
      uK: dt * 4, uT: T, uDk: dark ? 1 : 0, uDiff: 6,
      uVelTx: vel.tx, uDyeTx: dye.tx, uManual: linear ? 0 : 1,
      uEye: [e.x / W, 1 - e.y / Hh],
      uEyeR: rad() * 0.34 / Math.max(1, Hh),
      uAsp: W / Math.max(1, Hh),
      uEyeA: ea, uBody: dark || !cfg.blackInk ? 0 : CORE.body, uBodyK: dark || !cfg.blackInk ? 0 : CORE.fill,   // user option; light theme only: on the dark one a dense core is a flat bright slab, the silver smoke loses its grain
    }, [1 / mcv.width, 1 / mcv.height]); dye.swap();
  }

  // ---- landscape backdrop (file:// & http:// safe via Image) ------------------------------
  let landBmp = null, landTex = null;
  {
    const img = new Image();
    img.onload = () => {
      landBmp = img;
      if (gl && landTex) { gl.deleteTexture(landTex); landTex = null; }
    };
    img.src = 'assets/landscape.webp';
  }
  function landUp() {
    if (!landBmp || landTex) return;
    const iw = landBmp.naturalWidth || landBmp.width, ih = landBmp.naturalHeight || landBmp.height;
    if (!iw || !ih) return;
    landTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, landTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, landBmp);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }
  const landFit = () => {
    if (!landBmp) return [1, 1];
    const iw = landBmp.naturalWidth || landBmp.width, ih = landBmp.naturalHeight || landBmp.height;
    if (!iw || !ih) return [1, 1];
    const ia = iw / ih, sa = W / Math.max(1, Hh);
    return sa > ia ? [1, ia / sa] : [sa / ia, 1];
  };

  function render() {
    const e = eye();
    landUp();
    const audioBoost = cfg.audioReactive && audioEnergy > 0.01 ? audioBass * 1.4 : 0;
    pass('display', null, [dye.a.tex, maskTex, calTex, landTex || calTex], {
      uLand: landTex && !gmOn() ? 1 : 0, uMud: [1.6, .25],
      uLandS: landFit(),
      uDyeTx: dye.tx,
      uManual: linear ? 0 : 1,
      uEyeA: visAt(dg.pts[0]?.x ?? 0, dg.pts[0]?.y ?? 0, true),
      uDark: dark ? 1 : 0,
      uCap: CAP_DARK,
      uBg: gmOn() && GM.bg ? GM.bg : dark ? NIGHT : PAPER,
      uInk: dark ? BODY.dark : BODY.light,
      uT: T,
      uCalli: cfg.calligraphy && !gmOn() ? 1 : 0,
      uAsp: W / Math.max(1, Hh),
      uEye: [e.x / W, 1 - e.y / Hh],
      uEyeR: rad() * 0.34 / Math.max(1, Hh),
      uGape: (() => { const g = gape(); return [g.x / W, 1 - g.y / Hh, rad() * 0.9 / Math.max(1, Hh), clamp(Math.min(dg.jaw, dg.fire), 0, 1)]; })(),
      uKing: [kg.amt, kg.storm, 0, 0],
      uStorm: [cfg.rainLightning ? boltFlash() : 0, kg.bx * W / Math.max(1, Hh), kg.bs, cfg.rainLightning ? kg.rain : 0],
      uBoltY: 1 - kg.by,
      uGlow: (() => { const g = kingGlow(); return [g[0] / W, 1 - g[1] / Hh, g[2] / Math.max(1, Hh), g[3]]; })(),
      ...(() => {
        const fl = Math.max(0, 1 - (T - pl.flare) / 0.9), a = pl.flareAmt;
        const ps = gmOn() ? 1e-4 : !pl.inside ? 1 : kg.ph === 'swallow' ? Math.max(1e-3, 1 - (T - kg.t) / 0.9) : 1e-3;
        return {
          uPearl: [
            pl.x / W,
            1 - pl.y / Hh,
            ps * rad() * 0.5 * (1 + 0.18 * pl.charge + 0.3 * fl * a) / Math.max(1, Hh),
            (T < coilUntil ? 1.4 + 0.6 * Math.sin(T * 4) : 1) + pl.charge * 2.6 + fl * fl * a * 3 + audioBoost,
          ],
          uRing: [1 + (1 - fl) * 22, gmOn() ? 0 : fl * Math.min(1, a), pl.held ? 0 : 1],
          uPK: [pl.ess, pl.ripeAmt],
        };
      })(),
    });
  }

  function inputs(dt) {
    dragonUpdate(dt);
    const kx = simW / Math.max(1, W), ky = simH / Math.max(1, Hh);
    if (cl.ph !== 'hidden') for (let i = 0; i < N; i += 3) {
      const p = dg.pts[i], q = dg.prev[i], vx = (p.x - q.x) / dt, vy = (p.y - q.y) / dt;
      splatVel(p.x / W, 1 - p.y / Hh, vx * kx * 0.5, -vy * ky * 0.5, 0.0006);
    }
    cloudFeed(kx, ky, dt);
    {
      const gold = dark ? [0.5, 0.38, 0.12] : [0.04, 0.16, 0.6];
      if (kg.burst) {
        kg.burst = false;
        for (let j = 0; j < 16; j++) {
          const a = j / 16 * Math.PI * 2, r = cloudR() * 0.35, sp = Hh * 1.8;
          const x = (kg.cx + Math.cos(a) * r) / W, y = 1 - (kg.cy + Math.sin(a) * r) / Hh;
          if (j % 2) splatVel(x, y, Math.cos(a) * sp * kx, -Math.sin(a) * sp * ky, 0.0012);
          else splat(x, y, Math.cos(a) * sp * kx, -Math.sin(a) * sp * ky, gold, 0.0006);
        }
        for (const [i, rr] of COC) {
          const p = dg.pts[i], sp = Hh * 0.9;
          for (let j = 0; j < 4; j++) {
            const a = j * Math.PI / 2 + i, r = rr * Hh * 0.6;
            splatVel((p.x + Math.cos(a) * r) / W, 1 - (p.y + Math.sin(a) * r) / Hh, Math.cos(a) * sp * kx, -Math.sin(a) * sp * ky, 0.0008);
          }
        }
      }
      const eyeVis = visAt(dg.pts[0]?.x ?? 0, dg.pts[0]?.y ?? 0, true);
      if (cl.ph !== 'hidden' && dg.pts.length >= 3 && eyeVis > 0.05) {
        const epNow = eye();
        const rate = clamp(dt * 30, 0.25, 1.5);
        const fNorm = dark ? [1.0, 0.50, 0.096] : [0.03, 1.05, 1.75];
        const fKing = dark ? [1.0, 0.78, 0.16] : [0.02, 0.45, 1.65];
        const eyeSmk = [0, 1, 2].map((i) => fNorm[i] + (fKing[i] - fNorm[i]) * kg.amt);
        if (dg.hasPrevEye) {
          const dpX = epNow.x - dg.prevEyeX, dpY = epNow.y - dg.prevEyeY;
          const distE = Math.hypot(dpX, dpY);
          const eyeSpd = distE / (Math.max(dt, 1e-4) * Hh);
          const motionBoost = clamp(eyeSpd * 1.15, 0, 1.6);
          const steps = Math.min(10, Math.max(1, Math.ceil(distE / Math.max(rad() * 0.07, 2.5))));
          for (let s = 0; s < steps; s++) {
            const tS = (s + 1) / steps;
            const spX = dg.prevEyeX + dpX * tS, spY = dg.prevEyeY + dpY * tS;
            const rS = 0.000018 + 0.000010 * kg.amt + 0.000024 * motionBoost;
            const strS = (0.08 + 0.48 * motionBoost + 0.05 * kg.amt) * eyeVis * rate / steps;
            const eyeA = (0.06 + 1.15 * motionBoost + 0.05 * kg.amt) * (0.65 + 0.45 * tS) * eyeVis * rate / steps;
            dyeQ.push([spX / W, 1 - spY / Hh, rS, eyeSmk.map((v) => v * strS), eyeA]);
          }
          if (distE > 0.6) {
            const invX = -dpX / distE, invY = -dpY / distE;
            const perpX = -invY, perpY = invX;
            const wiggle = Math.sin(T * 12.5) * 0.55;
            const ampP = clamp(eyeSpd * Hh * 0.55, 28, Hh * 0.9) * rate;
            splatVel(epNow.x / W, 1 - epNow.y / Hh, (invX * 0.78 + perpX * wiggle) * ampP * kx, -(invY * 0.78 + perpY * wiggle) * ampP * ky, 0.00038);
          }
        }
        dg.prevEyeX = epNow.x; dg.prevEyeY = epNow.y; dg.hasPrevEye = true;
      } else {
        dg.hasPrevEye = false;
      }
    }
    {
      const v = Math.hypot(pl.vx, pl.vy);
      if (v > Hh * 0.05) splat(pl.x / W, 1 - pl.y / Hh, pl.vx * kx * 0.6, -pl.vy * ky * 0.6, dark ? [0.04, 0.07, 0.1] : [0.01, 0.025, 0.07], 0.0003);
    }
    {
      const p = dg.pts[N - 1], q = dg.pts[N - 4], ex = p.x - q.x, ey = p.y - q.y, l = Math.hypot(ex, ey) || 1;
      const b = dark ? BODY.dark : BODY.light, sp = Hh * 0.25;
      splat(p.x / W, 1 - p.y / Hh, ex / l * sp * kx, -ey / l * sp * ky, b.map(v => v * 0.22), 0.00035);
    }
    {
      const v = Math.hypot(dg.pts[0].x - dg.prev[0].x, dg.pts[0].y - dg.prev[0].y) / Math.max(dt, 1e-3) / Hh, b = dark ? BODY.dark : BODY.light;
      if (cl.ph === 'off' && kg.coc <= 0 && Math.random() < 0.06 + v * 0.5) {
        const i = 3 + Math.floor(Math.random() * (N * 0.6)), p = dg.pts[i], q = dg.pts[i + 1], dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
        const side = Math.random() < 0.5 ? -1 : 1, r = radAt(i / (N - 1));
        for (let j = 0, n = 1 + (Math.random() * 3 | 0); j < n; j++) {
          const o = r * (1.4 + Math.random() * 1.6), along = (Math.random() - 0.5) * r * 2;
          const x = p.x - dy / l * o * side + dx / l * along, y = p.y + dx / l * o * side + dy / l * along;
          dyeQ.push([x / W, 1 - y / Hh, 0.000012 + Math.random() * 0.00004, b.map(c => c * (dark ? 1.2 : 2.2))]);
        }
      }
    }
    // gathering beat ("tụ khí", Yang 11-18): while the jaws open for the breath, thin wisps of fire-smoke are drawn in from
    // the air in front of the head and spiral into the mouth, where an ember swells; then the breath goes off. A converging
    // FLOW cannot do this (the pressure solve removes any sink), so each wisp is a point on a set spiral path round the mouth
    // that leaves dye along its way: the fluid only blurs and curls the trail
    if (dg.pts.length >= 3) {
      const m = mouth(), R = rad(), pal = kg.amt > 0.5 ? (dark ? FIRE.kingDark : FIRE.kingLight) : dark ? FIRE.dark : FIRE.light;
      const winding = dg.breath > 0 && dg.wind > 0 && cl.ph === 'off', perF = clamp(dt * 30, 0.05, 1.5);
      dg.core = winding ? clamp(dg.wind / GA.wind, 0, 1) : Math.max(0, dg.core - dt * 9);
      if (winding) {
        // none set off in the last 0.1 s before the fire (still on its way in when the jet lit, it was blown about as loose blobs);
        // a wind-up drawn out by the head still turning keeps a thinner stream going
        const left = GA.wind - dg.wind;
        if (dg.wind <= dt * 1.5) dg.wispAcc += GA.burst;
        dg.wispAcc += dt * (left > 0.1 ? GA.rate : left > 0 ? 0 : GA.rate * 0.35);
        while (dg.wispAcc >= 1) { dg.wispAcc--;
          const side = Math.random() < 0.5 ? -1 : 1, aE = side * Math.random() * 0.75;   // arrives through the open gape, not through the jaw
          dg.wisps.push({ p: 0, life: clamp(left, 0.14, GA.wind) * (0.85 + 0.15 * Math.random()), aE, aS: m.a + aE + side * (0.6 + Math.random() * 1.1),
            r: R * (GA.r0 + Math.random() * (GA.r1 - GA.r0)), k: 0.35 + 1.0 * Math.random() * Math.random() + 0.3 * Math.random(), f: Math.random(), ph: Math.random() * 6.283 });
        }
        for (let j = 0; j < 2; j++) {   // the ember: swells in the mouth as the wisps arrive
          const tr = R * Math.random() * 0.3 * dg.core, ta = Math.random() * 6.283;
          dyeQ.push([(m.x + Math.cos(ta) * tr) / W, 1 - (m.y + Math.sin(ta) * tr) / Hh, 0.00006 + 0.0002 * dg.core, pal[0].map((v) => v * GA.core * dg.core * perF * (left < 0 ? 0.35 : 1))]);   // held past its time (head still turning): only kept alive, or it swells into a blob over the snout
        }
      }
      // the path wobbles (smoke, not a ruled arc): the swing dies out as the wisp closes in on the lips. It starts from a bearing
      // fixed in the air (aS) and comes round to the gape's own bearing (m.a + aE), so a turning head does not swing the far ends
      // round with it
      const at = (w, p) => { const q = 1 - p, r = w.r * Math.pow(q, 0.6) * (1 + GA.wob * 0.5 * q * Math.sin(p * 11 + w.ph)), aG = m.a + w.aE,
        a = aG + wrapA(w.aS - aG) * Math.pow(q, 1.6) + GA.wob * q * Math.sin(p * 7 + w.ph * 1.7);
        return [m.x + Math.cos(a) * r, m.y + Math.sin(a) * r]; };
      for (let i = dg.wisps.length - 1; i >= 0; i--) {
        const w = dg.wisps[i], p0 = w.p; w.p = Math.min(1, w.p + dt / w.life);
        if (w.lx == null) [w.lx, w.ly] = at(w, p0);
        // each stretch runs on from where the last one ended in the air (lx, ly), not from where the path says it was: with the
        // mouth moving those differ and the stroke broke into dashes
        const x0 = w.lx, y0 = w.ly, [x1, y1] = at(w, w.p), pm = (p0 + w.p) / 2; w.lx = x1; w.ly = y1;
        // far out a wisp is grey smoke; it catches fire on the way in (ig) and is gold by the time it reaches the lips
        const ig = clamp((pm - GA.ig0) / (GA.ig1 - GA.ig0), 0, 1), fade = Math.min(1, pm * 6) * w.k, bI = dark ? BODY.dark : BODY.light;
        const col = pal[0].map((v, c) => ((v + (pal[1][c] - v) * w.f * pm) * GA.str * ig * (0.5 + 0.5 * pm) + bI[c] * GA.ink * (1 - ig)) * fade);
        segQ.push([x0 / W, 1 - y0 / Hh, x1 / W, 1 - y1 / Hh, GA.rad * (1.6 - 1.0 * pm) * (0.5 + w.k), col]);
        if (w.p >= 1) dg.wisps.splice(i, 1);
      }
    }
    // after-breath (Yang 11-17): once the jaws close, a little leftover fire and smoke seeps out of the lip seam in small puffs,
    // thinning out over ~3 s. Puffs start anywhere along the seam (hinge -> lip tips), drift up and a bit forward
    if (dg.after > 0 && dg.breath <= 0) {
      dg.after = Math.max(0, dg.after - dt);
      const k = dg.after / 2.8, shut = clamp(1 - dg.jaw / 0.35, 0, 1);
      if (shut > 0 && Math.random() < (0.25 + 0.75 * k) * shut * clamp(dt * 45, 0.3, 1.5)) {
        const m = mouth(), pal = kg.amt > 0.5 ? (dark ? FIRE.kingDark : FIRE.kingLight) : dark ? FIRE.dark : FIRE.light;
        const [hx, hy] = HEAD.hinge, tx = (HEAD.upTip[0] + HEAD.loTip[0]) / 2, ty = (HEAD.upTip[1] + HEAD.loTip[1]) / 2;
        // mostly from the front of the seam, at the lips, nudged just outside the silhouette (inside the head the ink hides it and
        // the dots read as a dotted line); soft wide puffs that rise, not pinpoints
        const u = 0.72 + Math.random() * 0.36, p0 = headPt(hx + (tx - hx) * u, hy + (ty - hy) * u), R = rad();
        const fx = Math.cos(m.a), fy = Math.sin(m.a), p = { x: p0.x + fx * R * 0.25, y: p0.y + fy * R * 0.25 - R * 0.15 };
        const sp = Hh * (0.2 + 0.18 * Math.random()) * (0.55 + 0.45 * k);
        const vx = fx * 0.5 + (Math.random() - 0.5) * 0.6, vy = fy * 0.5 - 0.9, vl = Math.hypot(vx, vy) || 1;
        splatVel(p.x / W, 1 - p.y / Hh, vx / vl * sp * kx, -vy / vl * sp * ky, 0.0007 + Math.random() * 0.0005);
        const ember = Math.random() < 0.1 + 0.45 * k;
        const col = ember ? pal[0].map((v, c) => (v + (pal[1][c] - v) * Math.random() * 0.5) * (dark ? 0.36 : 0.45) * (0.5 + 0.5 * k))
                          : (dark ? BODY.dark : BODY.light).map((v) => v * (dark ? 0.3 : 0.5));
        dyeQ.push([p.x / W, 1 - p.y / Hh, 0.00016 + Math.random() * 0.00026, col]);
      }
    }
    if (dg.breath > 0 && !(dg.wind > 0) && dg.jaw > 0.4) {
      const m = mouth(), pal = kg.amt > 0.5 ? (dark ? FIRE.kingDark : FIRE.kingLight) : dark ? FIRE.dark : FIRE.light;
      const KB = kg.amt > 0.5, rateF = clamp(dt * 30, 0.25, 1.5), sp = Hh * 3.2 * (KB ? 1.3 : 1) * 1.2 * rateF;
      const a0 = m.a + Math.sin(T * 10) * 0.11 + Math.sin(T * 23) * 0.04, R = rad();
      const ca = Math.cos(a0), sa = Math.sin(a0);
      const JW = (KB ? 1.8 : 1) * 1.45, CL = (KB ? 6 : 4) * 1.45;
      splatVel((m.x + ca * R * 0.95) / W, 1 - (m.y + sa * R * 0.95) / Hh, ca * sp * kx, -sa * sp * ky, 0.0011 * JW);
      // cone (Yang 11-17: "jet rộng ra kiểu hình nón"): a fan of rays, each pushing outward along its own angle, so the flow
      // diverges from the mouth instead of collapsing into one column. Rays farther out sit farther from the mouth and are wider
      const HALF = 0.9 * (KB ? 1.2 : 1), WC = 0.55, WS = 0.25;
      // a ray that would blow into the dragon's own coils is turned down (fire splashed up through the body otherwise)
      const bodyGap = (x, y) => { let d = 1e9; for (let i = 6; i < dg.pts.length; i += 3) d = Math.min(d, Math.hypot(dg.pts[i].x - x, dg.pts[i].y - y)); return clamp((d - R * 0.6) / (R * 1.2), 0, 1); };
      for (const u of [-1, -2 / 3, -1 / 3, 0, 1 / 3, 2 / 3, 1]) { const af = a0 + u * HALF + 0.06 * Math.sin(T * 15 + u * 3), cf = Math.cos(af), sf = Math.sin(af), w = WC + WS * Math.abs(u);
        const x1 = m.x + cf * R * 2.1, y1 = m.y + sf * R * 2.1, x2 = m.x + cf * R * 4.6, y2 = m.y + sf * R * 4.6, w1 = w * bodyGap(x1, y1), w2 = w * bodyGap(x2, y2);
        if (w1 > 0.01) splatVel(x1 / W, 1 - y1 / Hh, cf * sp * 0.7 * w1 * kx, -sf * sp * 0.7 * w1 * ky, 0.0030 * JW);
        if (w2 > 0.01) splatVel(x2 / W, 1 - y2 / Hh, cf * sp * 0.45 * w2 * kx, -sf * sp * 0.45 * w2 * ky, 0.0060 * JW); }
      if (KB) splatVel((m.x + ca * R * 4.8) / W, 1 - (m.y + sa * R * 4.8) / Hh, ca * sp * 0.55 * kx, -sa * sp * 0.55 * ky, 0.008);
      // impinging jet (Yang 11-17, sketch: fire hitting the screen edge splats, runs both ways along it, peels off and rolls back
      // toward the dragon). The 128-row grid smears the wall's stagnation pressure into a thin film, so it is helped here: where
      // the jet axis meets the edge, the flow is turned into two wall jets, and a bit farther out each one is bent off the wall
      // and back, which seeds the roll-up eddy; vorticity confinement near the wall then keeps it curling
      {
        const tx = ca > 1e-3 ? (W - m.x) / ca : ca < -1e-3 ? -m.x / ca : 1e9, ty = sa > 1e-3 ? (Hh - m.y) / sa : sa < -1e-3 ? -m.y / sa : 1e9;
        const dist = Math.min(tx, ty), reach = Hh * 1.1;
        if (dist > R * 2 && dist < reach) {
          const px = m.x + ca * dist, py = m.y + sa * dist;
          const nx = tx < ty ? -Math.sign(ca) : 0, ny = tx < ty ? 0 : -Math.sign(sa);   // wall normal, pointing back in
          const t1x = -ny, t1y = nx;                                                     // wall tangent
          const along = ca * t1x + sa * t1y;                                             // oblique hit: more goes the way it leans
          const k = Math.pow(1 - dist / reach, 0.6) * 0.75, L = R * (2.2 + 2.5 * (dist / reach)), ws = 0.0045 * JW;
          for (const s of [1, -1]) {
            const g = k * (1 + 0.65 * along * s);
            if (g < 0.02) continue;
            const tX = t1x * s, tY = t1y * s;
            const ax = px + nx * R * 0.6 + tX * L * 0.5, ay = py + ny * R * 0.6 + tY * L * 0.5;
            splatVel(ax / W, 1 - ay / Hh, tX * sp * 0.55 * g * kx, -tY * sp * 0.55 * g * ky, ws);
            const bx = px + tX * L * 1.25 + nx * R * 1.4, by = py + tY * L * 1.25 + ny * R * 1.4;   // peel off the wall
            splatVel(bx / W, 1 - by / Hh, (nx * 0.8 + tX * 0.25) * sp * 0.4 * g * kx, -(ny * 0.8 + tY * 0.25) * sp * 0.4 * g * ky, ws * 0.8);
            const cx2 = px + tX * L * 0.9 + nx * R * 2.8, cy2 = py + tY * L * 0.9 + ny * R * 2.8;   // and back toward the dragon
            splatVel(cx2 / W, 1 - cy2 / Hh, (-tX * 0.75 + nx * 0.2) * sp * 0.3 * g * kx, -(-tY * 0.75 + ny * 0.2) * sp * 0.3 * g * ky, ws * 0.7);
          }
        }
      }
      {
        const hfX = Math.cos(m.a), hfY = Math.sin(m.a), hbX = -hfX, hbY = -hfY, fl = headFlip();
        const hpX = -hfY * fl, hpY = hfX * fl, backSp = Hh * 0.72 * rateF;
        const pBrow = headPt(1.05, -0.82), pChin = headPt(1.00, 1.05);
        const pCheekX = dg.pts[0].x + hbX * R * 0.65, pCheekY = dg.pts[0].y + hbY * R * 0.65;
        const pNeckX = dg.pts[2].x + hbX * R * 0.50, pNeckY = dg.pts[2].y + hbY * R * 0.50;
        const vBrowX = hbX * 0.86 * backSp - hpX * 0.35 * backSp, vBrowY = hbY * 0.86 * backSp - hpY * 0.35 * backSp;
        const vChinX = hbX * 0.86 * backSp + hpX * 0.35 * backSp, vChinY = hbY * 0.86 * backSp + hpY * 0.35 * backSp;
        splatVel(pBrow.x / W, 1 - pBrow.y / Hh, vBrowX * kx, -vBrowY * ky, 0.0048);
        splatVel(pChin.x / W, 1 - pChin.y / Hh, vChinX * kx, -vChinY * ky, 0.0048);
        splatVel(pCheekX / W, 1 - pCheekY / Hh, hbX * 0.90 * backSp * kx, -hbY * 0.90 * backSp * ky, 0.0055);
        splatVel(pNeckX / W, 1 - pNeckY / Hh, hbX * 0.72 * backSp * kx, -hbY * 0.72 * backSp * ky, 0.0060);
        const bCol = dark ? BODY.dark : BODY.light;
        for (let j = 0; j < 4; j++) {
          const sideF = j < 2 ? -1 : 1;
          const pw = headPt(0.35 + Math.random() * 0.75, (sideF > 0 ? 0.85 : -0.68) + (Math.random() - 0.5) * 0.20);
          dyeQ.push([pw.x / W, 1 - pw.y / Hh, 0.00042 + Math.random() * 0.00024, bCol.map((v) => v * (dark ? 0.40 : 0.72) * rateF)]);
        }
      }
      for (let j = 0; j < 6; j++) {
        const tr = R * (0.0 + Math.random() * 0.75), ta = m.a + (Math.random() - 0.5) * 0.22;
        const tcol = pal[0].map((v) => v * (dark ? 0.58 : 0.78) * (KB ? 1.15 : 1) * rateF);
        dyeQ.push([(m.x + Math.cos(ta) * tr) / W, 1 - (m.y + Math.sin(ta) * tr) / Hh, 0.00024 + Math.random() * 0.00020, tcol]);
      }
      for (let j = 0, nP = KB ? 28 : 18; j < nP; j++) {
        const t = Math.random(), r = R * (0.25 + t * CL), a = m.a + (Math.random() - 0.5) * (0.24 + t * 0.85) * (KB ? 1.35 : 1) * 1.9, f = Math.min(1, t * 1.3 + Math.random() * 0.3);
        const flicker = 0.68 + 0.64 * Math.random();
        const col = pal[0].map((v, c) => (v + (pal[1][c] - v) * f) * (dark ? 0.52 : 0.70) * (KB ? 1.2 : 1) * (1 - t * 0.4) * flicker * rateF);
        dyeQ.push([(m.x + Math.cos(a) * r) / W, 1 - (m.y + Math.sin(a) * r) / Hh, (0.00065 + Math.random() * 0.00090) * (0.85 + t * 1.3) * (KB ? 1.5 : 1) * 1.25, col]);
      }
      const ex = pl.x - m.x, ey = pl.y - m.y, ed = Math.hypot(ex, ey);
      const g = gape(), gd = Math.hypot(pl.x - g.x, pl.y - g.y);
      const inCone = ed < Hh * 0.95 && (Math.abs(wrapA(Math.atan2(ey, ex) - m.a)) < 0.45 || gd < rad() * 2.4);
      if (!pl.held && !pl.drag && !pl.inside && inCone) {
        pl.charge = Math.min(1.5, pl.charge + dt * 1.3); pl.hot = T;
        if (kg.ph === 'off' && !pl.ripe) {
          pl.ess = Math.min(1, pl.ess + dt / cfg.essFill);
          if (pl.ess >= 1) { pl.ripe = T; pl.flare = T; pl.flareAmt = 1.3; }
        }
        for (let j = 0; j < 3; j++) {
          const a = j * Math.PI * 2 / 3 + T * 2, r = rad() * 1.1, sp2 = Hh * 0.45;
          splatVel((pl.x + Math.cos(a) * r) / W, 1 - (pl.y + Math.sin(a) * r) / Hh, -Math.sin(a) * sp2 * kx, -Math.cos(a) * sp2 * ky, 0.0003);
        }
      }
    }
    if (pl.charge > 0 && T - pl.hot > 0.3) {
      if (pl.charge > 0.2) {
        const a0 = pl.charge, col = dark ? [0.2, 0.36, 0.55] : [0.1, 0.26, 0.45];
        for (let j = 0; j < 12; j++) {
          const a = j / 12 * Math.PI * 2, r = rad() * 0.7, sp = Hh * 1.2 * Math.min(1.2, a0);
          const x = (pl.x + Math.cos(a) * r) / W, y = 1 - (pl.y + Math.sin(a) * r) / Hh;
          if (j % 3) splatVel(x, y, Math.cos(a) * sp * kx, -Math.sin(a) * sp * ky, 0.0004);
          else splat(x, y, Math.cos(a) * sp * kx, -Math.sin(a) * sp * ky, col.map(v => v * 0.35 * Math.min(1, a0)), 0.0003);
        }
        pl.flare = T; pl.flareAmt = Math.min(1.3, a0);
      }
      pl.charge = 0;
    }
    // audio-reactive smoothing decay + pearl vortex / bass peak
    if (T - audioAt > 0.25) {
      const dec = Math.exp(-dt * 5);
      audioBass *= dec; audioMid *= dec;
      audioEnergy = audioBass * 0.6 + audioMid * 0.4;
    }
    if (dn.beatFx && dn.amt > 0.3 && cl.ph !== 'hidden') {   // dance beat: the whole body breathes out a ring of ink, visible on any song
      const bc = kg.amt > 0.5 ? (dark ? [0.45, 0.34, 0.12] : [0.04, 0.15, 0.55]) : (dark ? BODY.dark : BODY.light);
      for (let j = 0; j < 7; j++) {
        const i = 2 + Math.floor((j + Math.random()) * (N - 6) / 7), p = dg.pts[i], q = dg.pts[i + 1];
        const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1, side = j % 2 ? 1 : -1, r = radAt(i / (N - 1)), spB = Hh * 0.22;
        const x = p.x - dy / l * r * 1.1 * side, y = p.y + dx / l * r * 1.1 * side;
        splat(x / W, 1 - y / Hh, -dy / l * side * spB * kx, -(dx / l * side) * spB * ky, bc.map((v) => v * (dark ? 0.16 : 0.26) * dn.amt), 0.0006);
      }
    }
    dn.beatFx = 0;
    if (cfg.audioReactive && audioEnergy > 0.01 && !gmOn()) {
      if (!pl.inside && cl.ph !== 'hidden' && (audioBass - prevAudioBass > 0.05 || audioBass > 0.28)) {
        const spA = Hh * (0.22 + 0.35 * Math.min(1, audioBass)), radA = rad() * 1.15;
        for (let j = 0; j < 3; j++) {
          const a = j * Math.PI * 2 / 3 + T * 2.5;
          splatVel((pl.x + Math.cos(a) * radA) / W, 1 - (pl.y + Math.sin(a) * radA) / Hh, -Math.sin(a) * spA * kx, -Math.cos(a) * spA * ky, 0.00035);
        }
      }
      if (audioBass > 0.55 && T - lastAudioPeak > 4 && dn.amt < 0.3) {   // dancing has its own drop move
        lastAudioPeak = T;
        const chasingNow = (T - ptrT) < 2.5 && ptr.init;
        const idleNow = kg.ph === 'off' && cl.ph === 'off' && !chasingNow && !pl.drag && !pl.held && !pl.ripe && dg.breath <= 0 && !dg.roar && T >= coilUntil;
        if (idleNow && Math.hypot(pl.x - dg.hx, pl.y - dg.hy) < Hh * 0.85) {
          dg.roar = T + 2.5; pl.caught = T + 3.5; dg.roarPearl = true;
          nextAutoBreath = T + 12 + Math.random() * 6;
        } else if (cl.ph !== 'hidden') {
          const b = kg.amt > 0.5 ? (dark ? [0.45, 0.34, 0.12] : [0.04, 0.15, 0.55]) : (dark ? BODY.dark : BODY.light);
          const ox = pl.inside ? dg.hx : pl.x, oy = pl.inside ? dg.hy : pl.y;
          for (let j = 0; j < 4; j++) {
            const a = j * Math.PI * 0.5 + T, spP = Hh * 0.45;
            splat((ox + Math.cos(a) * rad() * 0.8) / W, 1 - (oy + Math.sin(a) * rad() * 0.8) / Hh, Math.cos(a) * spP * kx, -Math.sin(a) * spP * ky, b.map((v) => v * 0.18), 0.0004);
          }
        }
      }
    }
    prevAudioBass = audioBass;

    if (ptr.moved) {
      ptr.moved = false;
      let dx = ptr.x - ptr.px, dy = ptr.y - ptr.py;
      ptr.px = ptr.x; ptr.py = ptr.y;
      const asp = cv.width / Math.max(1, cv.height);
      if (asp < 1) dx *= asp; else dy /= asp;
      if (Math.hypot(dx, dy) > 1e-5) splatVel(ptr.x, ptr.y, dx * CFG.force, dy * CFG.force, CFG.rMove);
    }
    if (T < coilUntil || dg.breath > 0 || dg.roar) lastAct = T;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const el = now - last;
    const active = T < coilUntil || T - ptrT < 3 || dg.breath > 0 || dg.roar || kg.ph !== 'off';
    if (el < (gmOn() ? 15 : active ? 31 : (T - lastAct < 20 ? 36 : 42))) return;
    let dt = Math.min(el / 1000, 0.1);
    last = now;
    if (gmOn()) {   // the game owns time: tick(real dt) moves the head and answers with the dt to simulate (0 = paused)
      if (GM.tick) { const g = GM.tick(dt); if (g != null) dt = g; }
      if (!(dt > 0)) { if (GM.draw) GM.draw(0); return; }
      T += dt;
      inputs(dt); flushDye(); drawMask(); uploadMask(); step(Math.min(dt, 1 / 15)); render();
      if (GM.draw) GM.draw(dt);
      return;
    }
    T += dt;
    inputs(dt); flushDye(); drawMask(); uploadMask(); step(Math.min(dt, 1 / 15)); render();
  }
  function resize() {
    W = innerWidth; Hh = innerHeight; S = Math.min(S_CAP, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(W * S)); cv.height = Math.max(1, Math.round(Hh * S));
    if (!gl) return;
    if (!vel || Math.abs(simW / simH - W / Math.max(1, Hh)) > 0.02) { buildTargets(); dragonInit(); }
    buildCalli();
    render();
  }

  // ---- pointer interactions --------------------------------------------------------------
  const onMove = (e) => {
    const x = e.clientX / Math.max(1, innerWidth), y = 1 - e.clientY / Math.max(1, innerHeight);
    if (!ptr.init) { ptr.init = true; ptr.px = x; ptr.py = y; }
    if (gmOn()) return;
    ptr.x = x; ptr.y = y; ptr.moved = true; ptrT = T; lastAct = T; sn.done = false; sn.at = 0;
    if (pl.drag) { if (!(e.buttons & 1)) onUp(); return; }
    setGrab(overPearl(e) ? '1' : '');
  };
  function overPearl(e) {
    if (!gl || !vel || cl.ph === 'hidden' || kd.ph !== 'off' || pl.inside || visAt(pl.x, pl.y) < 0.3) return false;
    return Math.hypot(e.clientX - pl.x, e.clientY - pl.y) < Math.max(16, rad() * 0.85);
  }
  const setGrab = (v) => {
    const de = document.documentElement;
    if (v) de.setAttribute('data-grab', v);
    else de.removeAttribute('data-grab');
  };
  const onDown = (e) => {
    if (!gl || !vel || cl.ph === 'hidden' || kd.ph !== 'off' || gmOn()) return;
    if (e.button === 0 && overPearl(e)) {
      if (pl.held) { pl.held = 0; pl.caught = T + 1; }
      pl.drag = true; pl.vx = pl.vy = 0; pl.thrown = -9; sn.done = true; setGrab('2'); lastAct = T; return;
    }
    if (e.button === 0 || e.pointerType !== 'mouse') {
      dg.roar = 0; dg.roarPearl = false;
      startBreath(e.clientX, e.clientY, 2.4, false);
      lastAct = T;
    }
  };
  const onUp = () => {
    if (!pl.drag) return;
    pl.drag = false; setGrab('');
    const v = Math.hypot(pl.vx, pl.vy), cap = Hh * 3;
    if (v > cap) { pl.vx *= cap / v; pl.vy *= cap / v; }
    if (v > Hh * 0.35) { pl.thrown = T; pl.caught = T - 1; }
    const m = Math.min(W, Hh) * 0.16;
    pl.hx = clamp(pl.x + pl.vx / 1.3, m, W - m); pl.hy = clamp(pl.y + pl.vy / 1.3, m, Hh - m); pl.nextHome = T + 9;
  };
  const noSelect = (e) => { if (pl.drag) e.preventDefault(); };

  function clearDye() {
    for (const t of [dye.a, dye.b]) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, t.w, t.h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  }
  function setMode() {
    const was = dark;
    dark = resolveDark();
    if (gl && dye && was !== dark) clearDye();
    if (gl && dye) render();
  }
  function start() { if (!raf && gl) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  let statsRes = null;
  function ensureStats() {
    if (statsRes) return statsRes;
    const SW = 160, SH = 90;
    const pr = program(H + `uniform sampler2D t0, t1; uniform vec2 uTx; uniform float uDk, uPass;
void main(){
  if (uPass > 1.5) {
    float area = 0., edgeArea = 0., maxV = 0.;
    for (int iy = 0; iy < 4; iy++) {
      for (int ix = 0; ix < 4; ix++) {
        vec2 uv = clamp(v + vec2((float(ix) + .5) / 4. - .5, (float(iy) + .5) / 4. - .5) * uTx, 0., 1.);
        vec3 d = max(texture2D(t0, uv).rgb, 0.);
        float s = max(d.r, max(d.g, d.b));
        float diff = uDk > .5 ? (d.r - d.b) : (max(d.g, d.b) - d.r);
        if (s > .05 && diff > .25 * s) {
          area += 1.;
          if (uv.x < .08 || uv.x > .92 || uv.y < .08 || uv.y > .92) edgeArea += 1.;
        }
        maxV = max(maxV, length(texture2D(t1, uv).xy));
      }
    }
    gl_FragColor = vec4(area / 16., clamp(maxV / 1500., 0., 1.), clamp(maxV / 100., 0., 1.), edgeArea / 16.);
    return;
  }
  float sumV = 0., maxV = 0.;
  for (int iy = 0; iy < 4; iy++) {
    for (int ix = 0; ix < 4; ix++) {
      vec2 uv = clamp(v + vec2((float(ix) + .5) / 4. - .5, (float(iy) + .5) / 4. - .5) * uTx, 0., 1.);
      vec3 d = max(texture2D(t0, uv).rgb, 0.);
      float s = max(d.r, max(d.g, d.b));
      float val = s;
      if (uPass > .5) {
        float diff = uDk > .5 ? (d.r - d.b) : (max(d.g, d.b) - d.r);
        val = (s > 1e-4 && diff > .15 * s) ? s : 0.;
      }
      sumV += val;
      maxV = max(maxV, val);
    }
  }
  float avgV = sumV / 16.;
  gl_FragColor = vec4(clamp(avgV / 5., 0., 1.), clamp(avgV / .2, 0., 1.), clamp(maxV / 5., 0., 1.), clamp(maxV / .2, 0., 1.));
}`);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SW, SH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    statsRes = { pr, tex, fb, w: SW, h: SH, tx: [1 / SW, 1 / SH], buf: new Uint8Array(SW * SH * 4) };
    return statsRes;
  }
  function readDyeStats() {
    if (!gl || !dye || !vel) return { dyeSum: 0, dyeMax: 0, fireSum: 0, fireMax: 0, fireAreaPct: 0, edgeFirePct: 0, inkSum: 0, velMax: 0 };
    const st = ensureStats(), { pr, fb, w, h, tx, buf } = st, n = w * h;
    const decVal = (hi, lo) => (lo < 250 ? (lo / 255) * 0.2 : (hi / 255) * 5.0);
    const decVel = (hi, lo) => (lo < 250 ? (lo / 255) * 100.0 : (hi / 255) * 1500.0);
    const runPass = (uPass) => {
      gl.useProgram(pr.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.viewport(0, 0, w, h);
      gl.uniform2fv(pr.u('uTx'), tx);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, dye.a.tex); gl.uniform1i(pr.u('t0'), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, vel.a.tex); gl.uniform1i(pr.u('t1'), 1);
      gl.uniform1f(pr.u('uDk'), dark ? 1 : 0);
      gl.uniform1f(pr.u('uPass'), uPass);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    };
    let dyeSum = 0, dyeMax = 0, fireSum = 0, fireMax = 0, areaSum = 0, edgeAreaSum = 0, velMax = 0;
    runPass(0);
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      dyeSum += decVal(buf[k], buf[k + 1]);
      const m = decVal(buf[k + 2], buf[k + 3]);
      if (m > dyeMax) dyeMax = m;
    }
    runPass(1);
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      fireSum += decVal(buf[k], buf[k + 1]);
      const m = decVal(buf[k + 2], buf[k + 3]);
      if (m > fireMax) fireMax = m;
    }
    runPass(2);
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      areaSum += buf[k] / 255;
      edgeAreaSum += buf[k + 3] / 255;
      const v = decVel(buf[k + 1], buf[k + 2]);
      if (v > velMax) velMax = v;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return {
      dyeSum: +dyeSum.toFixed(2),
      dyeMax: +dyeMax.toFixed(4),
      fireSum: +fireSum.toFixed(2),
      fireMax: +fireMax.toFixed(4),
      fireAreaPct: +(areaSum / n * 100).toFixed(3),
      edgeFirePct: +(edgeAreaSum / n * 100).toFixed(3),
      inkSum: +Math.max(0, dyeSum - fireSum).toFixed(2),
      velMax: +velMax.toFixed(2),
    };
  }
  const onLost = (e) => { e.preventDefault(); stop(); vel = dye = prs = div = crl = statsRes = null; };
  const onRestored = () => { try { calTex = null; landTex = null; if (initGL()) { buildTargets(); resize(); start(); } } catch { /* stays plain */ } };

  // ---- Wallpaper Engine properties & URL params ------------------------------------------
  function parseUrlParams() {
    try {
      const sp = new URLSearchParams(window.location.search || '');
      const p = {};
      const get = (...keys) => { for (const k of keys) if (sp.has(k)) return sp.get(k); return null; };
      const boolVal = (s) => (s === '1' || s === 'true' ? true : s === '0' || s === 'false' ? false : null);
      const th = get('theme', 'mode');
      if (th) p.theme = th.toLowerCase();
      const dk = boolVal(get('dark'));
      if (dk !== null) p.dark = dk;
      const ql = get('quality');
      if (ql) p.quality = ql.toLowerCase();
      const ef = get('essfill', 'essFill');
      if (ef !== null) p.essfill = Number(ef);
      const cf = get('cloudfreq', 'cloudFreq');
      if (cf !== null) p.cloudfreq = Number(cf);
      const rl = boolVal(get('rainlightning', 'rainLightning'));
      if (rl !== null) p.rainlightning = rl;
      const ca = boolVal(get('calligraphy'));
      if (ca !== null) p.calligraphy = ca;
      const ar = boolVal(get('audioreactive', 'audioReactive'));
      if (ar !== null) p.audioreactive = ar;
      const dc = boolVal(get('dance'));
      if (dc !== null) p.dance = dc;
      const bi = boolVal(get('blackink', 'blackInk'));
      if (bi !== null) p.blackink = bi;
      return p;
    } catch { return {}; }
  }

  function applyProps(props) {
    if (!props || typeof props !== 'object') return;
    const val = (k) => {
      if (!(k in props)) return undefined;
      const x = props[k];
      return x && typeof x === 'object' && 'value' in x ? x.value : x;
    };
    const toBool = (v) => (typeof v === 'string' ? v !== 'false' && v !== '0' && v !== '' : !!v);
    let themeChanged = false, qualityChanged = false, needRender = false;

    const rawTheme = val('theme');
    if (rawTheme !== undefined) {
      if (typeof rawTheme === 'boolean') { cfg.theme = rawTheme ? 'dark' : 'light'; themeChanged = true; }
      else {
        const th = String(rawTheme).toLowerCase();
        if (th === 'light' || th === 'dark' || th === 'auto') { cfg.theme = th; themeChanged = true; }
      }
    }
    const rawDark = val('dark');
    if (typeof rawDark === 'boolean') {
      cfg.theme = rawDark ? 'dark' : 'light';
      themeChanged = true;
    }
    const rawQual = val('quality');
    if (rawQual !== undefined) {
      const q = String(rawQual).toLowerCase();
      if (QUALITY_PRESETS[q] && (cfg.quality !== q || !vel)) {
        cfg.quality = q;
        const p = QUALITY_PRESETS[q];
        SIM_H = p.SIM_H; DYE_H = p.DYE_H; MASK_H = p.MASK_H; ITER = p.ITER; S_CAP = p.S_CAP;
        qualityChanged = true;
      }
    }
    const rawEss = val('essfill') ?? val('essFill');
    if (rawEss !== undefined && Number.isFinite(Number(rawEss))) {
      cfg.essFill = clamp(Number(rawEss), 2, 30);
    }
    const rawCloud = val('cloudfreq') ?? val('cloudFreq');
    if (rawCloud !== undefined && Number.isFinite(Number(rawCloud))) {
      cfg.cloudFreq = clamp(Number(rawCloud), 0, 180);
      cl.next = cfg.cloudFreq > 0 ? T + cfg.cloudFreq * (0.75 + Math.random() * 0.5) : 1e9;
    }
    const rawRain = val('rainlightning') ?? val('rainLightning');
    if (rawRain !== undefined) { cfg.rainLightning = toBool(rawRain); needRender = true; }
    const rawCalli = val('calligraphy');
    if (rawCalli !== undefined) { cfg.calligraphy = toBool(rawCalli); needRender = true; }
    const rawAudio = val('audioreactive') ?? val('audioReactive');
    if (rawAudio !== undefined) { cfg.audioReactive = toBool(rawAudio); }
    const rawDance = val('dance');
    if (rawDance !== undefined) { cfg.dance = toBool(rawDance); }
    const rawBlack = val('blackink') ?? val('blackInk');
    if (rawBlack !== undefined) { cfg.blackInk = toBool(rawBlack); }   // no redraw needed: the body is re-inked every frame, it drifts to the new tone in about a second

    if (themeChanged) setMode();
    if (qualityChanged && gl) {
      S = Math.min(S_CAP, window.devicePixelRatio || 1);
      cv.width = Math.max(1, Math.round(W * S));
      cv.height = Math.max(1, Math.round(Hh * S));
      buildTargets();
      buildCalli();
      needRender = true;
    }
    if (needRender && gl && dye) render();
  }

  function onAudioSamples(samples) {
    if (!samples || !samples.length) return;
    let bSum = 0, mSum = 0;
    const len = samples.length;
    if (len >= 128) {
      for (let i = 0; i < 64; i++) {
        const l = clamp(Number(samples[i]) || 0, 0, 1.5);
        const r = clamp(Number(samples[i + 64]) || 0, 0, 1.5);
        if (i < 12) bSum += l + r;
        else mSum += l + r;
      }
      bSum /= 24;
      mSum /= 104;
    } else {
      const nB = Math.min(12, len), nM = Math.max(1, len - nB);
      for (let i = 0; i < len; i++) {
        const v = clamp(Number(samples[i]) || 0, 0, 1.5);
        if (i < 12) bSum += v; else mSum += v;
      }
      bSum /= Math.max(1, nB);
      mSum /= nM;
    }
    let hSum = 0, nH = 0;
    if (len >= 128) for (let i = 40; i < 64; i++) { hSum += clamp(Number(samples[i]) || 0, 0, 1.5) + clamp(Number(samples[i + 64]) || 0, 0, 1.5); nH += 2; }
    else for (let i = Math.floor(len * 0.6); i < len; i++) { hSum += clamp(Number(samples[i]) || 0, 0, 1.5); nH++; }
    danceAudio(bSum, mSum, nH ? hSum / nH : 0);
    audioBass += (bSum - audioBass) * 0.45;
    audioMid += (mSum - audioMid) * 0.35;
    audioEnergy = audioBass * 0.6 + audioMid * 0.4;
    audioAt = T;
  }

  let audioRegistered = false;
  function registerAudio() {
    if (!audioRegistered && typeof window.wallpaperRegisterAudioListener === 'function') {
      audioRegistered = true;
      window.wallpaperRegisterAudioListener(onAudioSamples);
    }
  }

  applyProps(parseUrlParams());
  window.wallpaperPropertyListener = {
    applyUserProperties(props) { applyProps(props); },
  };
  registerAudio();
  mq.addEventListener('change', () => { if (cfg.theme === 'auto') setMode(); });

  function mount() {
    if (mounted) return;
    registerAudio();
    cv = document.getElementById('dragon-canvas');
    if (!cv) return;
    mcv = document.createElement('canvas'); mx = mcv.getContext('2d');
    W = innerWidth; Hh = innerHeight; S = Math.min(S_CAP, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(W * S)); cv.height = Math.max(1, Math.round(Hh * S));
    dark = resolveDark();
    try { if (!initGL()) throw new Error('no webgl'); buildTargets(); }
    catch { gl?.getExtension('WEBGL_lose_context')?.loseContext(); gl = null; return; }
    mounted = true;
    setMode();
    dragonInit();
    if (cfg.cloudFreq > 0) cl.next = cfg.cloudFreq * (0.4 + Math.random() * 0.3);
    else cl.next = 1e9;
    cv.addEventListener('webglcontextlost', onLost); cv.addEventListener('webglcontextrestored', onRestored);
    resize();
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerdown', onDown, { passive: true });
    addEventListener('pointerup', onUp, { passive: true });
    addEventListener('pointercancel', onUp, { passive: true });
    addEventListener('blur', onUp);
    addEventListener('mousedown', noSelect, true);
    addEventListener('selectstart', noSelect, true);
    addEventListener('resize', resize);
    start();

    window.__dragon = {
      // o = { on, x, y, ang, turn, bend, waveTurn, bg, tick(dt) -> dt, draw(dt) }; null hands the dragon back to the wallpaper
      game(o) {
        GM = o || null;
        if (GM) { if (GM.x == null) { GM.x = dg.hx; GM.y = dg.hy; } coilUntil = -9; dg.roar = 0; dg.breath = 0; dg.wind = 0; pl.drag = false; setGrab(''); }
        return window.__dragon;
      },
      dg, N, WAVE, rad, radAt, segLen, eye, mouth, cfg, props: applyProps,
      get T() { return T; }, get W() { return W; }, get H() { return Hh; }, get dark() { return dark; }, get canvas() { return cv; },
    };
    window.dispatchEvent(new Event('dragonready'));
    window.__dragonDebug = {
      step(n = 1, opts = {}) {
        const dt = opts.dt > 0 ? opts.dt : 1 / 30;
        if (opts.theme != null) applyProps({ theme: opts.theme });
        if (opts.dark != null) applyProps({ dark: !!opts.dark });
        if (opts.quality != null) applyProps({ quality: opts.quality });
        if (opts.essfill != null || opts.essFill != null) applyProps({ essfill: opts.essfill ?? opts.essFill });
        if (opts.cloudfreq != null || opts.cloudFreq != null) applyProps({ cloudfreq: opts.cloudfreq ?? opts.cloudFreq });
        if (opts.rainlightning != null || opts.rainLightning != null) applyProps({ rainlightning: opts.rainlightning ?? opts.rainLightning });
        if (opts.calligraphy != null) applyProps({ calligraphy: opts.calligraphy });
        if (opts.blackink != null || opts.blackInk != null) applyProps({ blackink: opts.blackink ?? opts.blackInk });
        if (opts.audioreactive != null || opts.audioReactive != null) applyProps({ audioreactive: opts.audioReactive ?? opts.audioreactive });
        if (opts.coilUntil != null) coilUntil = opts.coilUntil;
        if (opts.cloud) cl.next = T;
        if (opts.bolt) kg.nextBolt = T;
        if (opts.king && kg.ph === 'off') { kg.last = -1e9; kingStart(); }
        if (opts.ess != null) { pl.ess = opts.ess; if (pl.ess >= 1 && !pl.ripe) { pl.ripe = T; pl.flare = T; pl.flareAmt = 1.3; } }
        if (opts.throw) {
          const [x, y, vx, vy] = opts.throw;
          pl.drag = false; pl.x = x; pl.y = y; pl.vx = vx; pl.vy = vy; pl.thrown = T; pl.caught = T - 1;
          pl.hx = clamp(x + vx / 1.3, 50, W - 50); pl.hy = clamp(y + vy / 1.3, 50, Hh - 50); pl.nextHome = T + 9;
        }
        if (opts.roar) { dg.roar = T + 2.5; pl.caught = T + 3.5; dg.roarPearl = true; }
        if (opts.breathe) startBreath(opts.breathe[0], opts.breathe[1], 2.4, !!opts.breathePearl);
        if (opts.audio) onAudioSamples(opts.audio);
        if (opts.coil) {
          const [cx, cy] = opts.coil, s = segLen(), rr = s * N / (2 * Math.PI * 1.35);
          const pose = () => {
            for (let i = 0; i < N; i++) {
              const a = -i * s / rr + Math.PI;
              dg.pts[i].x = cx + Math.cos(a) * rr + i * s * 0.35;
              dg.pts[i].y = cy + Math.sin(a) * rr;
            }
          };
          pose(); drawMask(); const m = mcv.toDataURL('image/png');
          if (!opts.run) return m;
          for (let i = 0; i < opts.run; i++) { T += dt; pose(); flushDye(); drawMask(); uploadMask(); step(dt); }
          render(); return [m, cv.toDataURL('image/png')];
        }
        if (opts.ptr) {
          ptr.init = true; ptr.x = ptr.px = opts.ptr[0] / W; ptr.y = ptr.py = 1 - opts.ptr[1] / Hh;
          ptrT = T - (opts.idle || 0); sn.done = false; sn.at = 0;
        }
        for (let i = 0; i < n; i++) {
          T += dt;
          inputs(dt); flushDye(); drawMask(); uploadMask(); step(dt);
        }
        if (!opts.noRender) render();
        return opts.noSnap ? null : cv.toDataURL('image/png');
      },
      perf(n = 20) {
        const b = new Uint8Array(4), t0 = performance.now();
        for (let i = 0; i < n; i++) {
          inputs(1 / 30); flushDye(); drawMask(); uploadMask(); step(1 / 30); render();
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
        }
        const ms = (performance.now() - t0) / n;
        return { ms: +ms.toFixed(2), fps: +(1000 / Math.max(0.01, ms)).toFixed(1), quality: cfg.quality, dark, w: cv.width, h: cv.height, sim: [simW, simH], dye: [dyeW, dyeH], mask: [mcv.width, mcv.height], iter: ITER, linear };
      },
      prof(n = 20) {
        const b = new Uint8Array(4), sync = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); };
        const t = { inputs: 0, mask: 0, upload: 0, step: 0, render: 0 };
        const run = (k, fn) => { const t0 = performance.now(); fn(); sync(); t[k] += performance.now() - t0; };
        for (let i = 0; i < n; i++) {
          run('inputs', () => { inputs(1 / 30); flushDye(); });
          run('mask', drawMask);
          run('upload', uploadMask);
          run('step', () => step(1 / 30));
          run('render', render);
        }
        for (const k in t) t[k] = +(t[k] / n).toFixed(2);
        return t;
      },
      dbg() {
        return {
          T: +T.toFixed(2),
          mode: dg.mode,
          autoCoil: T < coilUntil,
          coilUntil: +coilUntil.toFixed(2),
          nextCoil: +nextCoil.toFixed(2),
          nextAutoBreath: +nextAutoBreath.toFixed(2),
          roar: +dg.roar.toFixed(2),
          roarPearl: !!dg.roarPearl,
          breath: +dg.breath.toFixed(2),
          breathPearl: !!dg.breathPearl,
          head: [Math.round(dg.hx), Math.round(dg.hy)],
          mid: dg.pts[38] ? [Math.round(dg.pts[38].x), Math.round(dg.pts[38].y)] : [0, 0],
          tail: dg.pts[N - 1] ? [Math.round(dg.pts[N - 1].x), Math.round(dg.pts[N - 1].y)] : [0, 0],
          pts: dg.pts.map((p) => [+p.x.toFixed(1), +p.y.toFixed(1)]),
          pearl: [Math.round(pl.x), Math.round(pl.y)],
          sniffAt: sn.at && +(T - sn.at).toFixed(2),
          sniffDone: sn.done,
          cloud: cl.ph,
          linear,
          kingDive: kd.ph,
          kingHop: kd.hop,
          kingTotal: kd.total,
          ess: +pl.ess.toFixed(3),
          ripe: !!pl.ripe,
          king: kg.ph,
          kingAmt: +kg.amt.toFixed(2),
          coc: +kg.coc.toFixed(2),
          rain: +kg.rain.toFixed(2),
          storm: +kg.storm.toFixed(2),
          sealKing,
          bodyVis: [10, 30, 50, 70].map((i) => +visAt(dg.pts[i].x, dg.pts[i].y).toFixed(2)),
          fade: +cl.fade.toFixed(2),
          headVis: +visAt(dg.hx, dg.hy).toFixed(2),
          eyeVis: +visAt(dg.pts[0]?.x ?? 0, dg.pts[0]?.y ?? 0, true).toFixed(2),
          headCloudD: cl.A ? +(Math.hypot(dg.hx - cl.A.x, dg.hy - cl.A.y) / cloudR()).toFixed(2) : -1,
          held: pl.held ? +(pl.held - T).toFixed(1) : 0,
          charge: +pl.charge.toFixed(2),
          flare: +(T - pl.flare).toFixed(2),
          jaw: +dg.jaw.toFixed(2),
          dive: cl.A ? [0, Math.round(N * 0.35), Math.round(N * 0.7), N - 1].map((i) => +(Math.hypot(dg.pts[i].x - cl.A.x, dg.pts[i].y - cl.A.y) / cloudR()).toFixed(2)) : null,
          headIn: cl.headIn ? +(T - cl.headIn).toFixed(1) : 0,
          dark,
          cfg: { ...cfg },
          sim: [simW, simH],
          dye: [dyeW, dyeH],
          maskSize: [mcv.width, mcv.height],
          iter: ITER,
          audioBass: +audioBass.toFixed(3),
          audioMid: +audioMid.toFixed(3),
          landLoaded: !!(landBmp && (landBmp.naturalWidth || landBmp.width) > 0),
          landTex: !!landTex,
          headLoaded: ['skull', 'eye', 'jaw', 'crown'].every((k) => HEAD[k].im.complete && HEAD[k].im.naturalWidth > 0),
        };
      },
      setProps(p) {
        applyProps(p);
        return { ...cfg, dark };
      },
      dyeStats: readDyeStats,
      spine() { const wv = dg.wv; return { pts: dg.pts.map((p) => [p.x, p.y]), base: wv ? dg.pts.map((p, i) => [wv.bx[i], wv.by[i]]) : null, w: wv ? wv.w : 0, xf: dg.xf ? dg.xf.t : 0, reel: dg.reel ? (dg.reel.stack ? 2 : 1) : 0 }; },   // drawn joints / plain joints under the flight wave
      mask() {
        return mcv.toDataURL('image/png');
      },
    };
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
})();
