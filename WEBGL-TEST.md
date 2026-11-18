# WebGL engine test — engine A (Yang Go 2026-11-18)

Q: does dragon.js ink stay as crisp as wallpaper once camera follows dragon + LoL mouse control? Yes → WebGL chốt (Electron/Tauri later). No → blur is camera/game logic, not engine.
Budget: 1 day. Owner: Ariel codes, Claire reviews. Spike Godot (D:\Projects\InkDragonSpike) frozen = reference only.

## Setup
- `git init` D:\Projects\InkDragon. Copy `D:\Tools\DragonWallpaper\{index.html,dragon.js,assets}` → `D:\Projects\InkDragon\web\`. First commit = untouched copy (baseline for diff/screenshots).
- NEVER edit D:\Tools\DragonWallpaper — it is the published Workshop copy (id 3841314776).
- Strip/disable for game mode only (flag `?game=1`, wallpaper behaviour default-off path kept intact): autonomous cycle, pearl grab/throw, audio dance, wallpaperPropertyListener. Don't delete — gate.

## Camera (the actual test)
- World coords ≠ screen. Camera centre lerps to dragon head (slight lead in heading dir), locked, no zoom yet (zoom = later).
- Fluid stays screen-local (current W×Hh grid). On camera move by (dx,dy) px:
  - shift vel/dye/prs textures by **integer texels** per their own grid (dye grid and sim grid separately), accumulate sub-texel remainder, carry it to next frame. Copy-shift pass, NEAREST sampling, no bilinear resample → zero blur from scroll. Edge entering = clear (0).
  - sub-texel remainder → apply only as render offset in display pass (or ignore; test both, screenshot).
  - Spike suspect: resampling every frame + noise not world-anchored → smear/comb streaks at speed. Here: noise/grain coords = world (screen + camOffset snapped to dye texel), same as fdd7480 idea.
- Background (landscape/clouds/calligraphy mask): parallax scroll by camera, world-anchored. Clouds = world objects.
- Debug key `F1`: toggle camera follow off (fixed screen, wallpaper-like) → A/B screenshot same scene.

## Controls (Yang chốt 11-17, LoL-style, no WASD)
- RMB click = fly to point; RMB hold = follow cursor (reuse existing `chase` mode target, convert cursor screen→world).
- Q hold = breath toward cursor (reuse startBreath, aim = cursor world pos).
- W = tail whip (body segments push velocity sideways — splatVel along tail).
- E = coil vortex (dragon circles; reuse coil logic, swirl splat ring).
- R = cloud dive (nearest cloud; reuse cloudUpdate emerge).
- Shift/Space hold = boost, stamina bar (simple, top-left).
- W/E/R minimal placeholder ok if time short; RMB + Q + camera are must.
- Gamepad dropped for now. Context menu disabled on canvas.

## Bans / keep
- No red eye dot/glow ever. Head readability via zoom/ink.
- Fire-wall impinging jet, king gold horns, cloud emerge, mouth leak: keep as-is.

## Deliverables
1. Commits in D:\Projects\InkDragon (baseline copy, then feature commits).
2. Screenshots `D:\Projects\InkDragon\shots\`: same moment F1 off vs on, at slow + fast flight. Plus fast-turn breath.
3. FPS @1080p on GTX 1650 (dev overlay), camera on vs off.
4. Short report on bridge: does scroll keep ink crisp? which sub-texel option won? anything blurring left.

Run: serve `web/` with any static server (e.g. `npx http-server web -p 8099`), open `/?game=1`.

## Result 2026-11-18 (Claire did it herself; Ariel task cancelled)
Run: `run.bat` → http://127.0.0.1:8099/?game=1. Keys: RMB fly (hold = follow cursor) · Q breath at cursor · W whip · E coil · R dive (out at cursor) · Shift/Space boost · F1 camera follow/fixed · F2 HUD · F3 naive-resample camera (comparison only).

How (all in web/dragon.js, wallpaper path untouched when no ?game=1):
- Floating origin: positions stay canvas px; camera move → `worldShift(nx,ny)` moves every world object back by whole sim cells + `shift` pass copies vel/prs/dye by exact texels (dye grid forced = sim × 8). Leftover < 1 cell → CSS translate of an oversized canvas (4% margin), snapped to device px.
- Open edges in game (`uOpen` on divergence/gradient/vorticity/vsm/ink); impinging-jet screen-wall code off.
- Landscape: 0.35× parallax x (mirror wrap), 0.12× y, fades to paper past image top/bottom.
- Off in game: pearl, king cycle, dance/audio, rain, calligraphy, autonomous coil/breath/clouds, pointer stir; frame loop every vsync (wallpaper throttles ~30fps).

Crispness (web/crisp-test.js, mean |Laplacian| over dragon bbox, ink px only, landscape off, 1920×1080, same world flight path, 422 px/s):
| camera | lap |
|---|---|
| fixed (wallpaper-like) | 1.45 |
| follow, integer-cell shift (shipped) | 1.36 (−6%) |
| follow, naive fractional resample (F3) | 1.09 (−25%) |
Shots shots/keep/a1-a3: a3 = visible horizontal smear on body = Spike's symptom. **Conclusion: blur was the camera resample, not WebGL/engine. Integer shift fixes it.** Residual 6%: smoke scrolling off edges / crop; not visible in shots.

Perf: preview pane (hidden, emulated 1920×1080 dpr 1.2, canvas 2489×1399): game 35.7 ms/frame, original wallpaper 43.7 ms same pane → game no costlier. Pane numbers unreliable; real check = HUD fps in Chrome on GTX 1650. Wallpaper prof: render 15.5, mask upload 15.0, step 10.0, mask draw 5.8 ms → if <60fps, first cuts: mask upload (2D canvas → texSubImage each frame), canvas scale S_CAP.

Known/open:
- Mirror-wrapped landscape shows mirrored trees; needs real world art later.
- Head reads as blob when flying straight up/down (readability, not blur). No eye glow (ban).
- Coil E balls the body up; tune later (Celine feel).
- DESIGN.md still says Godot: update once Yang confirms WebGL.
