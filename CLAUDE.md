# Nightwatch – Survivor RPG

A survivors-like game in the spirit of Vampire Survivors, with RPG progression and active skills.
Goal: web first, native apps later (Capacitor for Android/iOS, Tauri for desktop).

**Read [docs/vision.md](docs/vision.md) before planning features.** It describes the target game
(village, hex world, expeditions, herbs and potions, seasons) and its open questions.

## Stack

- Phaser 4 (Arcade Physics), TypeScript (strict), Vite
- Tests: Vitest (game logic only), linting: ESLint, formatting: Prettier
- Node 22+

## Commands

- `npm run dev` – dev server, also reachable on the local network (phone: http://<PC-IP>:5173)
- `npm run check` – typecheck, lint, tests and build. **Run before every commit.**
- `npm run build:single` – everything in one HTML file (dist-single/) for quick sharing
- Dev mode: on in `npm run dev`, and in any build with `?dev` in the URL (e.g. a PR preview).
  Test helpers: "+herbs +gold" in the village; "reveal" (fog off on screen only) and "jump here" on the
  map; "clear area", "god mode" (no damage, much stronger, whole screen lit) and "spawn elite" in a fight; "reset save" in the
  village (second tap confirms; device settings stay; shown to everyone while `SHOW_RESET_BUTTON` in
  `src/config/build.ts` is true, so switch that off for a release); "all deeds" in the deeds panel. All dev code lives in `src/dev/`; every call into it is marked
  `// DEV:`. For a release set `DEV_TOOLS = false` in `src/dev/devMode.ts`, or delete `src/dev/` and
  the marked lines.

## Deployment

- `main` is published to https://kili-skiff.github.io/survivor-rpg/ (workflow `deploy.yml`, branch `gh-pages`).
- Every pull request gets a preview at `https://kili-skiff.github.io/survivor-rpg/pr-preview/pr-<number>/`;
  the link is posted on the PR (workflow `preview.yml`). Never touch `gh-pages` by hand.

## Architecture

```
src/
  config/    Game data: weapons, items, skills, enemies, herbs, potions, merchant, villagers and quests,
             deeds, segments, world, map tiles, character sprites, ground tiles, balancing (NO Phaser)
  logic/     Pure game logic (NO Phaser, tested): stats, XP, upgrades, spawning, segments, save data,
             hex math, seeded RNG, world generation, world progress, expeditions and journeys,
             potions (brewing, belt, buffs), lantern pendulum physics, merchant (gold, lanterns, recipes), ring difficulty, chests,
             quests, deeds, device settings
  entities/  Pooled Phaser objects (Enemy, Projectile, Pickup)
  input/     InputState: one input layer for touch, keyboard, later gamepads
  systems/   Gameplay behaviour, one job per file:
    weapons/   one class per weapon + factory in index.ts
    skills/    active skills (e.g. Frost Nova)
    PlayerController, LanternSystem (the carried lantern), EnemySystem, PickupSystem, HerbSystem, PotionSystem, LightingSystem,
    DamageNumbers
  panels/    Village panels (CauldronPanel, MerchantPanel, DeedsPanel, DialoguePanel): drawn on top of any scene,
             logic lives in logic/
  scenes/    Boot (placeholder graphics), WorldMap (hex map, travel), Village (stash, belt, panels),
             Game (one fight, owns run state, wires systems), UI (HUD, touch, menus during a fight)
  ui/        Display helpers (pixel density, safe area), colors
  dev/       Dev-only test helpers behind one switch (DEV_TOOLS); calls are marked `// DEV:`
public/assets/  Art files served as they are (tiles/ for the world map, sprites/ for fight characters,
                ground/ for the fight ground, one seamless tile per biome)
scripts/lpc/    Builds the character sheets from LPC layers (Python + Pillow; see the script's header)
scripts/ground/ Generates the ground tiles (Python + Pillow + numpy; our own art, replaceable)
```

## Rules

1. **Data-driven:** Add new weapons, items, skills and enemies in `src/config/` first.
   Behaviour goes into `src/systems/`: a new weapon is a new class in `systems/weapons/`,
   registered in `systems/weapons/index.ts`. Systems talk to the game through `CombatContext`.
   The GameScene only owns the run state and connects systems; keep gameplay logic out of it.
2. **logic/ and config/ never import Phaser.** ESLint enforces this. New logic there gets tests.
3. **Object pooling:** Reuse enemies, projectiles and pickups via Phaser groups with `maxSize`;
   never create and destroy them inside the game loop.
4. **Input only through `InputState`.** The GameScene knows nothing about keys or touch events.
5. **Scene restarts:** Scene instances are reused. Reset all state in `create()` and remove
   event listeners in the `shutdown` event.
6. **Save data:** Format changes bump `SAVE_VERSION` and extend `migrate()`.
7. **Mobile first:** Check every UI change in portrait and landscape. Scale UI sizes with `this.u`.
8. **Phaser 4:** `setTintFill()` no longer exists; use `setTint(c).setTintMode(Phaser.TintModes.FILL)`.
   Phaser ships its own guides in `node_modules/phaser/skills/`.
9. **Language:** Everything is in English: code, comments, docs, commit messages, PRs and in-game text.
10. **World determinism:** The map is generated from a seed and never saved; only player
    progress (`WorldProgress`) is saved. World generation must use `logic/rng.ts`, never `Math.random`.
    Every change to world generation bumps `SEASON.generatorVersion` in `config/world.ts`, which resets
    map progress. Seasons (a new shared map now and then) come later; don't call map resets seasons.
11. **Git:** Small commits, one feature per branch. Claude may be listed as co-author
    (`Co-Authored-By`), but commit messages and PR descriptions never contain session links.
12. **Village features are panels:** garden, brewing, merchant and so on each get their own panel
    on top of logic in `logic/`, so the menu village can later become a walkable one (see vision).
13. **Assets by others:** Only use art, sounds or fonts whose licence allows a public repo and website.
    Record each one in `CREDITS.md` (author, source, licence) when it is added.
14. **Art is swappable:** the game is 3/4 top-down. Character art is set up in `config/sprites.ts`
    (sheet, scale, hitbox height, animation speed); keep it there so better art can replace it later.
    Enemies without a sprite, or with a sheet that fails to load, show their placeholder texture.

## Workflow

- Reply in the language the user writes in; everything in the repo stays English (rule 9).
- Work on a feature branch and open a pull request. The user tests the PR preview and merges.
- The platform may append a session link to PR descriptions; remove it (rule 11).
- Before UI changes go into a PR, check them in a real browser in portrait and landscape
  (Playwright and Chromium are usually available; `window.__game` exposes the game in dev builds).

## Roadmap

### Milestone 1: vertical slice

A small but complete piece of the game from `docs/vision.md`. Each step is its own PR.

- [x] Segments with a goal (e.g. survive N minutes) and a result screen
- [x] Hex world map from a seed: rings, biomes, fog of war; tap a neighbour hex to play it
- [x] Expeditions: build carries over between segments, camps as waypoints, loot lost on death
- [x] Village as the starting point (simple screen: stash and "set out")
- [x] Herbs that grow in hexes by biome, gathered by standing next to them
- [x] Brewing of three potions in the village, packed into a belt and drunk with a button in a fight
- [x] First quest: the elder sends you to an old tower at the edge of the map (the way there;
      the tower stays sealed for now), the scout points out a camp on the way
- [x] Gold and the village merchant: lantern tiers (+light for good, the best lights up the whole screen), potion recipes, selling herbs
- [x] Ring difficulty and elite enemies (golden ring, often leave a chest)
- [x] Treasure chests (rare from anyone, likely from elites) with a slot-machine roll (gold, upgrades; equipment later)
- [x] Intro quest: at the first start the elder hands over the lantern and points to the nearest watchfire; lighting it pays gold
- [x] Deeds: exploration milestones (new rings, camps, watchfires, the tower) with small bonuses for good
- [ ] Spread the swarm: separation and varied speed, so enemies do not pile into one blob (see `docs/vision.md`)
- [ ] New enemy types with different behaviour (flanker, ranged, charger, ...)
- [ ] Elites with a mechanic, their own movement and fair health (target fight length)
- [ ] Open idea: light as a combat rule (slows or hurts enemies in the lantern's light); to be thought through
- [ ] Varied fight goals (kill N enemies, find the light or the dungeon, ... see `docs/vision.md`)
- [ ] Herb garden: plant herbs and harvest more of them, growing in real time
- [ ] One class with a small skill tree
- [ ] A boss guarding a dungeon or the outer ring

### Later

- [ ] Inside the tower: endgame mechanics still open (e.g. ever harder floors)
- [ ] Bigger map with exciting places in every direction, not only on the way to the tower
- [ ] Richer expedition panel on the map: health bar and the collected weapons, items and skills
- [ ] Professions (e.g. herbalist) with skills such as faster gathering
- [ ] Walkable village: house, garden, cauldron, merchant, blacksmith as places to walk to
- [ ] Seasons with a shared seed, then leaderboards (needs a server)
- [ ] More biomes, enemies, weapons and classes
- [ ] Sound effects and music
- [ ] Real art (sprite atlas) instead of placeholders
- [ ] PWA (installable), then Capacitor (Android/iOS) and Tauri (desktop)
