# InkDragon — design (Go 2026-11-17)

Working title. 2D side-view action-adventure, Godot 4. Player = the ink-wash dragon from DragonWallpaper (D:\Tools\DragonWallpaper\dragon.js), already ported to Godot in D:\Projects\InkDragonSpike (Ariel, 28ca6e1).

Owners: Claire design + review · Ariel Godot code · Celine controls/game-feel. Yang plays + approves.

## Settled by Yang (don't reopen)
- 2D, side view, Godot. Same dragon, same ink/fluid look.
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
- Fluid cost: grid ~128 rows today; zoomed out → fewer cells per body → mush. Plan both:
  - raise grid to ~256 rows (≈4× cost) — Ariel benchmarks on GTX 1650 4GB, target 60fps @1080p;
  - camera-local sim: grid covers viewport + margin, scrolls with camera (advect-offset on scroll), world size free. Dye leaving the window is dropped.
- Measure in slice: smallest zoom where smoke/fire still read well and holds 60fps.

## Controls (Celine owns feel)
- Move: stick/WASD = head steering target (dragon follows path, body trails). Not direct velocity — keep the serpentine follow.
- Boost: hold, short stamina.
- Fire breath (hold) · Tail/body whip (tap) · Coil vortex (hold, dragon circles) · Cloud dive (near cloud) · King form (when pearl meter full).
- Gamepad first, KB+M supported. Mouse aim optional for breath.

## Combat moves
| Move | Fluid mechanic | Use |
|---|---|---|
| Breath | 7-ray cone; impinging jet on walls rolls back | main dmg; bank shots behind rock |
| Whip | body segments push velocity sideways | knockback, scatter smoke enemies |
| Coil vortex | dragon loops → splat swirl ring; vorticity up | pull smoke/projectiles to centre, then breath = combo |
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
Scope: Vân Sơn only — one scrolling area ~6 screens wide, 3 enemy types, Mặc Giao boss, breath + whip + coil + cloud dive, dynamic camera, camera-local fluid.
Question it must answer: **does fighting with real fluid feel good?** If no → rethink before world.
Exit criteria:
- 60fps @1080p on GTX 1650 with fluid at chosen grid.
- Yang plays 10 min, says fun.
- Fire/smoke readable at default zoom.

## Out of scope for now
Story script, audio beyond placeholder, regions 2–6, save system, Steam.
