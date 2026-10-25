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

## Deployment

- `main` is published to https://kili-skiff.github.io/survivor-rpg/ (workflow `deploy.yml`, branch `gh-pages`).
- Every pull request gets a preview at `https://kili-skiff.github.io/survivor-rpg/pr-preview/pr-<number>/`;
  the link is posted on the PR (workflow `preview.yml`). Never touch `gh-pages` by hand.

## Architecture

```
src/
  config/    Game data: weapons, items, skills, enemies, herbs, potions, segments, world/season, balancing (NO Phaser)
  logic/     Pure game logic (NO Phaser, tested): stats, XP, upgrades, spawning, segments, save data,
             hex math, seeded RNG, world generation, world progress, expeditions and journeys,
             potions (brewing, belt, buffs), device settings
  entities/  Pooled Phaser objects (Enemy, Projectile, Pickup)
  input/     InputState: one input layer for touch, keyboard, later gamepads
  systems/   Gameplay behaviour, one job per file:
    weapons/   one class per weapon + factory in index.ts
    skills/    active skills (e.g. Frost Nova)
    PlayerController, EnemySystem, PickupSystem, HerbSystem, PotionSystem, DamageNumbers
  panels/    Village panels (e.g. CauldronPanel): drawn on top of any scene, logic lives in logic/
  scenes/    Boot (placeholder graphics), WorldMap (hex map, travel), Village (stash, belt, panels),
             Game (one fight, owns run state, wires systems), UI (HUD, touch, menus during a fight)
  ui/        Display helpers (pixel density, safe area), colors
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
10. **World determinism:** The map is generated from the season seed and never saved; only player
    progress (`WorldProgress`) is saved. World generation must use `logic/rng.ts`, never `Math.random`.
    Change world generation only together with a new season (`SEASON.generatorVersion` in `config/world.ts`).
11. **Git:** Small commits, one feature per branch. Claude may be listed as co-author
    (`Co-Authored-By`), but commit messages and PR descriptions never contain session links.
12. **Village features are panels:** garden, brewing, merchant and so on each get their own panel
    on top of logic in `logic/`, so the menu village can later become a walkable one (see vision).

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
- [x] Expeditions: build carries over between segments, camps as waypoints, partial loot loss on death
- [x] Village as the starting point (simple screen: stash and "set out")
- [x] Herbs that grow in hexes by biome, gathered by standing next to them
- [x] Brewing of three potions in the village, packed into a belt and drunk with a button in a fight
- [ ] Herb garden: plant herbs and harvest more of them, growing in real time
- [ ] One class with a small skill tree
- [ ] A boss guarding a dungeon or the outer ring

### Later

- [ ] Richer expedition panel on the map: health bar and the collected weapons, items and skills
- [ ] Professions (e.g. herbalist) with skills such as faster gathering
- [ ] Walkable village: house, garden, cauldron, merchant, blacksmith as places to walk to
- [ ] Seasons with a shared seed, then leaderboards (needs a server)
- [ ] More biomes, enemies, weapons and classes
- [ ] Sound effects and music
- [ ] Real art (sprite atlas) instead of placeholders
- [ ] PWA (installable), then Capacitor (Android/iOS) and Tauri (desktop)
