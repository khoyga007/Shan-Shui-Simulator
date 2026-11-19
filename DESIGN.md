# Gameplay direction 2026-11-18 (Yang): dragon = brush

Supersedes combat/horde below unless Yang revives it. Prototype live in white room: `web/room/paint.js`.
- Figure = numbered points on white paper. Fly head through them in order, left button held = pen down, one stroke.
- Done -> scenery appears. circle=moon, S=river, infinity=cloud (down-stroke=waterfall/pine: not built).
- Fail: pen lifted early (broken stroke); any later point reached before the next one (missed: dragon swung wide).
- Dragon turning circle (rho) is the difficulty knob. Point tolerance `tol` 0.055 H ~ 1 body radius (R = 60 px at 1080p).
- Settled by Yang: live steering (head = cursor), hold-to-ink, placeholder art first.
- Not built: no-retrace rule, score, levels, real art. Keys 1/2/3 figure, C clear, V guide.
- Bot (`tools/roomtest.py "" paint`): pilot leads 0.09 H at cap 1.2 H/s; deviation moon 18 px, river 9, cloud 20.
  Lead 0.13 H cuts inside and misses; cap 2.5 runs wide on the cloud. Flight line is sensitive to lead distance.
- Known control flaw hit by bot: point beside the neck (inside turning circle) = dragon parks. Player must fly out and back.

# InkDragon — design (Go 2026-11-17)

Working title. 2D side-view action-adventure, **WebGL** (browser; Electron/Tauri wrap if Steam). Player = the ink-wash dragon from DragonWallpaper; game code = `web/dragon.js` (copy, `?game=1`). Godot spike D:\Projects\InkDragonSpike frozen, reference only.

Owners: Claire design + code (Yang 11-18, Max plan) · Celine controls/game-feel review. Yang plays + approves.

## Settled by Yang (don't reopen)
- **RESET 2026-11-18 late (overrides everything below where it conflicts):** game did not show the dragon off; dragon must be IDENTICAL to the wallpaper. One dragon source = `D:\Tools\DragonWallpaper\dragon.js`; game port inside it (`__dragon.game(o)`, `GM`, `gmOn()`): while `o.on`, wallpaper life is off (pearl, auto coil/breath, clouds, King, dance, cursor chase, click fire, backdrop) and head sits at `o.x,o.y`; `o.tick(dt)` returns sim dt (0 = pause), `o.draw(dt)` after render; 60 fps gate. `web/room/dragon.js` = synced copy (`tools/sync-dragon.sh`), never hand-edit. Fork `web/dragon.js` + `game.js` (Vân Sơn, F4 horde) = frozen, kept for reference.
- Controls first, ALL skills dropped until controls feel right (Yang: controls decide almost everything). Head = the mouse cursor: pointer lock, mouse delta moves a point, head closes on it under a speed cap (`room.js` `S.cap/follow/leash/sens/turn`, defaults = Claire's picks, Yang tunes by sliders).
  - **Steering model (11-18, after Yang: sudden reversal jerked head + whole body):** neck (`pts[0]`, `G.x/y`) flown like a swimmer: moves only forwards along heading `fa`, turns at `S.turn` rad/s (16) on a circle of `S.rho` body radii (1.8); aims at the mouse point, stops `S.hold` R short so the eye (`hc`) lands on it. Lever `S.hold` → sideways mouse moves still 1:1; mouse point behind the head = U-turn (0.2–0.28 s, 0.2 screen wide). Game port takes `GM.ang` (heading) + `GM.bend` (spine limit = segment / rho, body threads the neck's track; wallpaper stays 0.2). Root cause of the jerk: glued-to-mouse head pushed the neck back into the chain and swung it round the hold point; follow-the-leader + bend limit swings the front body in one frame when pushed or when segment 0 turns faster than joints can bend. RULE: never push the chain, never turn tighter than `GM.bend` allows. Known cost: mouse point pulled straight back does nothing until it passes the neck (~1.25 × hold); pivots on the spot run at 0.35 × turn. Tried+dropped list in `room.js` `moveHead`.
  - Body wave in turns (Yang r002, 11-18: flown in a circle the body wriggled instead of going round): flight wave = straight-flight only. `GM.waveTurn` (room `S.waveTurn`, default 0): per joint, wave faded by the plain spine's own bend there, full ≤ 0.025 rad/joint, none ≥ 0.075. Bot: circle wave offset 43.7 → 0.9 px, straight keeps it. Wallpaper unchanged (never sets it).
  - Wave fade must be smooth ALONG the body: per-joint fade gave neighbours 0 vs 0.96 (bend limit makes the plain spine's bend a step) → drawn spine zigzag, 0.9 rad at a joint (Yang's figure-8 shot, tail). Now `CQ` = bend over 8 joints, blurred 2× over 11. Bot `drawnBendMax` 0.33–0.46 everywhere (unblurred 0.7–1.9).
  - Infinity dance (Yang 11-18, button + `M`): room only, nothing new in the dragon. Mouse point runs a figure-8 (x = A sin a, y = 0.45 A sin 2a; `S.infW` 0.5, `S.infV` 1.2 screens/s), normal steering follows; mouse ignored while on. Joins the figure AHEAD of the head where the figure runs the head's way (nearest point was often behind → spin on the spot, body swung 43 px/frame). Body lobes sit inside the head's path: follow-the-leader cuts corners (r² − s² per joint), same as when Yang draws it by hand.
  - **Body on the head's track (`GM.track`, room `S.track` default 1; Yang 11-18 "đuôi vẫn bị xoắn"):** joint i lies i·s back along the path the neck flew (`dg.gt`, reuses `onTrack`), not follow-the-leader. Why: dragged chain cuts every corner (r² − s² per joint) → far joints run out of radius in a tight turn, bend limit winds them into a ring that sits in the tail; figure-8 body was smaller than the head's 8. Needs the swimmer steering (forward-only, bounded circle): track kinks are drawn as kinks. Arc midpoint inserted per frame + 3 smoothing passes. Pivot circle floored at 0.5 rho + "mouse point inside the turning circle = left alone" (20 px pivots left a 0.85 rad kink running down the body; now 0.6). Bot: `jointOver` 0 in every scenario (chain: up to 16–43), infinity `tailBendAvg` 0.27 → 0.10. Lost in this mode: idle sway `lat` + bend limit (both live in `follow`). `S.track` 0 = old chain for comparison.
  - Body vs figure-8 (Yang 11-18, shot: body off the 8, red segments, straight tail): (1) turning circle was `0.45 × distance` → following, point is always just ahead → every turn flown on half the circle, track bent 0.6 where body takes 0.3. Now full rho in flight, shrunk only to reach a near side point; hover steps keep `0.45 × distance` (blend on speed averaged 1/3 s, `svS`; plain speed fails, pivot creep is fast). (2) Dance LOCKS the neck onto the figure once on it (`danceLock/danceRun`, ≤0.06 screen, ≤0.35 rad): steering out of the loop, body off the line 48 → 8 px (bot `offFigurePx`). (3) Size key `infA` default 0.4: figure = 5.8·A long, body 2.25 screens → 0.39 closes the 8 (0.5 covered 78%). (4) Orange dashed guide = the figure; blue trail = eye path, 2.5 s. Straight tail in his shot = approach path before the join, gone after one lap.
  - Self-test: `python tools/roomtest.py ['{"turn":20}']` → headless Chrome, `web/room/bot.js` (`?bot=1`), numbers to stdout + `reports/bot-uturn.jpg`. Guards: `faceMax` ≤ ~0.33 rad/frame (old: 1.2+), `jointOver` ≈ 0 on reverse/zigzag. Pane browser has no WebGL here; use this.
- Test room `web/room/` (run-room.bat, port 8099, devserver with POST /report): pure white, dragon only, debug overlay (spine by bend, plain spine, body radius, head hitbox, trail, velocity, mouse point + leash, grid, state text), pause/step/slow-mo, F8 = report → `reports/rNNN.png + .json` (gitignored). Enemies later = skeleton + placeholder only. Shell later = Tauri (Rust = shell only).
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
- DIRECTION (Yang 11-18): roguelike, horde-survival mould (he named Vampire Survivors; mechanics only). Fixed Vân Sơn level / multi-region plan below = superseded where it conflicts; nothing rebuilt yet. Open, his call: auto-attack vs manual Q/W/E/R (Claire leans manual), hitbox (head only + body as weapon), move-while-breathing, camera pull-back.
- Controls for the roguelike = "lái đầu rồng" (Yang picked 11-18 over WASD+mouse-aim; prototype, on only with the horde test via `G.steer`): mouse steers the head always, no button (cursor near head = throttle down to 45% → tight circling); Q = fire straight along the head while still flying (`STEER`: speed 0.26 H/s vs cruise 0.36, turn 1.25 rad/s, sway 0.3), head never turns to an aim point, no wait-for-aim; W tail = rear, E coil = around (coil+Q still turns to cursor), R dive = escape, Shift boost (full speed regardless of cursor distance). Why: fire leaves the mouth, so aim ≡ heading; separate aim made the head crane round and stall. Cost: no firing backwards — loop round or use tail/coil. Known: Q pressed mid-turn sweeps a fan of flame (it is the mechanic now); body flies through its own flame residue (slight orange haze on the back). Old RMB/aim controls untouched in the fixed level.
- Dragon hitbox = HEAD only (Yang 11-18; was front 40%): skull joints 0..6 + snout circle ahead of joint 0 (`nearBody`, game.js). Neck/body/tail take nothing. Body-as-weapon (touching body hurts enemies) = proposed, NOT approved/built. Horde test: damage off by default, `\` toggles.
- Horde test (game.js `H`, `hordeStep`): F4 in game or `&horde=N` — keeps N wisps alive, spawn on off-screen ring, always chase head at 0.22–0.32 U/s (< dragon 0.36), all-pairs separation, recycled onto the ring if outrun; dragon takes no damage unless `&dmg=1`; `[ ]` count ±25, `, .` size, `&hr=` radius, `&hink=` paint alpha. Kill burst in horde = 2 dabs, max 8/frame (every 4 dye dabs = one full-res dye pass). Bench: `&bench=1&horde=N` (N unkillable on screen + fire).
  - Perf, headless GTX 1650 1080p, throughput ms/frame (noisy ±1): 12 enemies 2.8–4.1 · 100: 4.8 · 200: 5.8 · 300: 4.7–4.9 · 500: 5.8 · 800: 9.2. Count is NOT the limit; cost at 800 is the O(N²) separation in JS (gameFrame 1.0 → 4.7 ms), grid would fix.
  - Yang 11-18 after seeing this: enemy shapes are placeholders, he draws sprites himself later → do NOT fix the ink look for enemies; plan a sprite layer (not the fluid mask) when real enemies come.
  - Look (placeholder ink only). r 0.032 (current wisp): 200 fuse into one black mass, dragon swallowed (shots/keep/horde-big-*.png). r 0.016: readable in the open as black tadpole strokes, still clumps black where they stack on the body (horde-small-*.png). `hink` 0.45 did NOT make them paler: ink pass pulls dye to full brushwork wherever mask red is set — grey enemies need a shader change (own mask level/channel), not a paint value.
- Cloud dive rules (R, game; Yang 11-18): 2 charges, each back 14 s after spent (own clock, parallel); shared cd 5 s from the press (dive itself ~3.2 s; tail-in-cloud lock ends ~4.6 s, so 5 s is the binding number). `DIVE` in dragon.js. `G.away` = press → head out of exit cloud (~1.85 s): untargetable — wisps stop chasing, crows hang + shot timer pushed back to ≥0.9 s (full tell on return), turtles stop turning/lunging, darts + bodies pass through. `G.safe` = whole dive until control returns (~3.2 s): no damage; once visible, bites/darts bounce off harmlessly. Why longer than away: ending with away, dragon was bitten on autopilot before steerable; and with contacts skipped instead of bounced, 6 wisps sat on the head and bit the same frame (30 HP). Exit = cursor at the press (locked), clamped to world walls, screen margin 12% (was 24%: cursor in the outer band got pulled in); camera glides to the exit while the dragon is hidden. W whip locked during dive/tail-in-cloud. HUD: `R` + 2 ink dots under HP bar, pie-fill while recharging, row pale when R unusable.
- Cloud dive exit (R, game): body reels out of the exit cloud along the head's track; joints not yet out wait INSIDE the cloud (stacked at its centre, hidden by a long soft ramp 0.5–1.3 R), cloud stays until the tail is out (`G.emer`), player gets control back after 1.4 s, E/R locked while `dg.reel`. Why: unreeled body was laid straight behind the cloud and showed all at once ("pop out of nowhere"). Idle head speed 0.3 while reeling so the tail does not sit in the cloud.

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
- Q breath at cursor (hold) · W tail whip · E coil · R cloud dive (in near dragon, out at cursor; immune + untargetable; 2 charges) · Shift/Space boost (stamina).
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
- Hits: breath = cone from mouth (len 0.9 H, half 0.34) + lip splash; whip = last 18 tail pts; coil drags/grinds non-turtles. Dragon hitbox = head only (see top).
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

## Strokes = five elements (Yang 11-19)

Player picks ELEMENT, game reads sub-kind from how stroke was flown. Replaces five kind keys.

| key | element | makes | read from |
|---|---|---|---|
| 1 | Địa (earth) | mountain; later rock, bank, cliff | (todo) arch / small closed / long low |
| 2 | Thuỷ (water) | river, lake | loop back to start = lake, else river |
| 3 | Mộc (wood) | tree, grass | standing = tree, lying = grass |
| 4 (todo) | Thiên (sky) | sun, moon, cloud, birds | loop CLOCKWISE = sun, COUNTER-CLOCKWISE = moon (Yang's rule; sign of loop area) |

- Wrong guess: same element key again turns last stroke to next sub-kind (`turn`, paint.js). Lying stroke turned to tree = close branch (zhezhi).
- Name Địa kept (pair Thiên/Địa), not Thổ. Not ngũ hành.
- FIFTH element added by Yang 11-19: Nhan (man) = people, houses; also takes bridge, boat, pavilion. Key 5 (todo, after Thien). Thien/Dia/Nhan = tam tai. Sub-kind rules NOT yet agreed (Claire's proposal only: closed box/roof shape = house, short standing stroke = person, level stroke over water = bridge, short level stroke on water = boat).
- Idea parked: loop direction as modifier for other elements (e.g. water loop cw/ccw).

Order agreed: (1) merge keys DONE -> (2) NEAR tier for Địa -> (3) water reflection for Thuỷ -> (4) Thiên.

### Depth (why 2 and 3)
All mountains read FAR (bình viễn only): tiny ridge trees fix scale, body = flat wash, low-on-paper only darkens. Need tầng cảnh: near/mid/far differ in DRAWING (tree size, rock faces, slope strokes), not tone alone.
Water as layer divider + whole-mountain mirror image = modern ink style (classical leaves water blank); Yang wants it. Water comes from player's Thuỷ stroke (Claire's lean, Yang not yet confirmed), what stands above it mirrors.
