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
