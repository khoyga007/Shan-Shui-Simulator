# InkDragon — design (Go 2026-11-17)

Working title. 2D side-view action-adventure, **WebGL** (browser; Electron/Tauri wrap if Steam). Player = the ink-wash dragon from DragonWallpaper; game code = `web/dragon.js` (copy, `?game=1`). Godot spike D:\Projects\InkDragonSpike frozen, reference only.

Owners: Claire design + code (Yang 11-18, Max plan) · Celine controls/game-feel review. Yang plays + approves.

## Settled by Yang (don't reopen)
- 2D, side view. Same dragon, same ink/fluid look.
- Engine WebGL (Yang 11-18). Why: ink look already there; Godot blur was camera resampling, not engine; GTX 1650 ~4.6 ms/frame (WEBGL-TEST.md).

- Look (Yang 11-18): dragon = long hồn, a soft body of smoke, as in the wallpaper. No scales, no crisp parts, no ink-wash redraw (tried 881cd2f/433788b, rejected, reverted). Ink (game): body core = dense black (`QI.body/bodyK`, ink pass `uBody`), edge stays thin smoke; wallpaper pattern left it mid-grey ("xám xám bẩn bẩn").
- Breath = "vận khí", 3 beats (dragon.js `QI`, `dg.qi/gather/wind`): wind-up 0.3 s (fire waits until head is on aim, max 0.7 s; loose smoke thins, body goes dense black) → hold (body = flow obstacle + calm zone, far smoke decays fast, soft puffs fed round the body) → release (qi drains ~1 s, smoke returns). Why: fire and body ink share one flow; the jet shredded the smoke and the dragon lost its shape. Dropped: combing smoke back along the body (zebra bands).
- Gather beat "tụ khí" (Yang 11-18, `GA`, `dg.wisps/core`, shader `seg4`): during wind-up, wisps spiral into the gape (grey smoke far out → catch fire → gold at lips), ember swells in the mouth, then the jet. Wisps = kinematic points on spiral paths leaving dye as chained line segments, NOT flow (pressure solve kills any sink). Failed: point splats along path = beads; path-relative segment ends = dashes when mouth/camera moves (chain from last world point, shifted in `worldShift`); spawning in last 0.1 s = loose blobs blown by the jet.
- Controls: LoL-style mouse (11-17), see Controls.
- Eye = original fluid red eye ink (smoky, not a flat fill: Yang 11-18 "trông như miếng decal"), 3x fill rate in game, kept to the socket + a short ragged fringe (display pass, mask cut-out). Eye ink outside the socket turns grey; no eye smoke trail in game (Yang 11-18: "vẽ vừa khớp với hốc mắt"). Never remove the eye.
- Wide world + combat.
- Camera zoomed out vs wallpaper (dragon ~2100px > screen today).
- Fire-hits-wall impinging jet, king gold horns/mane tips, through-cloud emerge, mouth-seam leak: approved in wallpaper 11-17 → port as-is.

## Pillars
1. **Fluid is the weapon.** Every attack = real dye/velocity in the sim, not canned VFX. Hits leave smoke on the painting.
2. **Body is the moveset.** Long body = whip, coil, wall. Length grows with progression.
3. **Painting heals.** Corruption = dirty black ink spreading; cleared region repaints (colour/detail returns), opens paths.

## Camera
- Default: dragon spans 1/3–1/2 screen width.
- Dynamic: zoom out on speed / crowd; boss framing fits boss; idle/cutscene zooms in to wallpaper scale.
- Fluid: camera-local sim, done. Grid scrolls by whole sim cells (dye = integer multiple of sim, no resample); sub-cell rest in display shader. Dye leaving the window is dropped. Grid 128 rows; raise to ~256 only if zoom-out mushes (GTX headroom ~3x).
- Sim steps capped ~60/s (`tick()`): ink passes tuned per step; uncapped 126 fps washed the dragon out. Per-frame splats scale `dt*30`.
- Must run on the GTX: run.bat forces `--force_high_performance_gpu` (Chrome default = Intel iGPU, 37 fps).
- Measure in slice: smallest zoom where smoke/fire still read well and holds 60fps.

## Controls (Celine owns feel)
- RMB = fly to point (hold = chase cursor). Head steers to target, body trails (serpentine follow).
- Q breath at cursor (hold) · W tail whip · E coil · R cloud dive (in near dragon, out at cursor) · Shift/Space boost (stamina).
- Camera locked on dragon. Boss attacks need clear tells. Gamepad dropped for now. King form: later.

## Combat moves
| Move | Fluid mechanic | Use |
|---|---|---|
| Breath | 7-ray cone; impinging jet on walls rolls back | main dmg; bank shots behind rock |
| Whip | body segments push velocity sideways | knockback, scatter smoke enemies |
| Coil vortex | body wound into an open spiral (tail centre, head on rim), turns as one piece; swirl splats | pull small enemies in + grind; Q from the coil = turret breath |
| Cloud dive | enter cloud, emerge from another (path-follow emerge) | dodge/i-frames, traversal |
| King form | gold horns/mane, gold fire, ×2 dmg, bigger cone | timed ult, fed by pearls |
| Swallow | inhale fire/lightning projectiles | defence; refills breath |

Damage model: enemies have ink density field footprint; fire dye overlapping footprint (sampled at enemy cells, GPU→CPU readback low-res or CPU proxy) = damage. Decide in slice: readback vs analytic proxy (cone/ray tests + visuals only). Default proxy for gameplay, fluid for visuals; readback only if cheap.

## Enemies (all ink)
- Hit → dissolves to smoke in sim (dye splat + velocity burst). No sprite pop.
- Slice set (Vân Sơn): **ink wisp** (swarm, coil-vortex counter), **brush crow** (ranged ink darts, swallow/whip), **stone-shell turtle** (frontal armour, bank fire off wall behind).
- Boss slice: **Mặc Giao** — big ink serpent mirroring player, fights in clouds.

## World (6 regions, sky-metroidvania gating)
| Region | Material | Gate/ability taught |
|---|---|---|
| Vân Sơn (cloud mountains) | smoke/cloud | start; breath, cloud dive |
| Thủy Hạ (river/falls) | water | fire weak underwater; dive + vortex |
| Băng Nguyên (ice plain) | ice/snow | melt walls; wind bends fire |
| Hỏa Diệm Sơn (volcano) | lava | enemies breathe fire; swallow |
| Lôi Đỉnh (thunder peak) | storm | absorb lightning → King form |
| Mặc Uyên (ink abyss) | corruption | final; shadow-dragon boss |

Regions connected by open sky; gates = ability needs, not keys.

## Progression
- Pearls drop from enemies/shrines → grow segments (longer whip/coil), horns, fins, mane, unlock moves. Look changes with build.
- Repainted regions persist; scroll seal (red stamp) per cleared region.

## Vertical slice (first milestone)
Scope: Vân Sơn only — one scrolling area ~6 screens wide, 3 enemy types, Mặc Giao boss, breath + whip + coil + cloud dive, camera-local fluid.
Step 1 (playable, 11-18): world bounds + landmarks, 3 enemies, analytic hit proxy, dragon HP, death → restart. Boss + dynamic zoom after.
Step 1 built (`web/game.js`):
- World 12.6 U wide (U = screen height at start), ground y 0.92 U, cloud walls at edges, 8 landmark cloud banks (mask blue).
- Game zoom GZ 0.75 (`dragon.js`: rad, segLen; cloudR ×0.85). Was 0.5: head became a blob, eye a speck (Yang 11-18 "phóng to"). 1.0 = wallpaper scale, fills the screen.
- Enemies painted into mask red (= dragon's ink channel): brushwork + smoking edges free, fire overrides, death = stop painting + gentle splat.
- Wisp ×18 (HP 10): swarm, dive at head, bite 5, back off 1–1.6 s. Crow ×6 (HP 30): flank 0.75 U, wing-raise tell 0.45 s, ink dart 10 dmg (fire/whip destroy). Turtle ×3 (HP 80): walks ground, faces dragon, front fire ×0.08 + jet splashes back, back ×1.4; tell 0.7 s → lunge 14; whip flips it.
- Hits: breath = cone from mouth (len 0.9 H, half 0.34) + lip splash; whip = last 18 tail pts; coil drags/grinds non-turtles. Dragon hitbox = front 40% of body (tail is a weapon).
- Coil E (`COIL`, `gameCoil/coilHead/coilBody`, 11-18): head runs an Archimedean spiral outward from a centre at its side (cursor's side), body = exact follow of the head's track (NOT the drag chain: dragged joints cut corners, r' = sqrt(r² - s²)/joint, body heaped at the centre = black blob, Yang "cuộn chả ra cuộn"). 1.5 s wind, then rigid rotation to 3 s. Last 16 joints peel off the rim so the head reads. Qi hold on throughout (same as breath). Q once wound: whole coil swings to aim, stays wound while breathing; aim inside the coil = no turn. Camera holds the centre. Release = chain again, MAXB eased by `G.coilK`.
- Dragon HP 100, regen 3/s after 4 s unhurt. Dead/clear → end card, any key/click restarts.
- Per-frame fluid pushes from game code must scale `dt*30`: unscaled ones became fountains that blew fire into hard-edged bubbles.
- Perf GTX headless, 12 enemies + breath: 5.3 ms/frame (was 4.6 without).
- Scripted bot (nearest enemy, breath in range, whip every 1.5 s, flanks turtles): clears zones 1–3, dies in zone 4 (doesn't dodge). Human tuning pending.
Question it must answer: **does fighting with real fluid feel good?** If no → rethink before world.
Exit criteria:
- 60fps @1080p on GTX 1650 with fluid at chosen grid.
- Yang plays 10 min, says fun.
- Fire/smoke readable at default zoom.

## Out of scope for now
Story script, audio beyond placeholder, regions 2–6, save system, Steam.
