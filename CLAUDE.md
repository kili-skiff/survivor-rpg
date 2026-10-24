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
  config/    Game data: weapons, items, skills, enemies, balancing (NO Phaser)
  logic/     Pure game logic: stats, XP, upgrades, spawning, save data (NO Phaser, tested)
  entities/  Pooled Phaser objects (Enemy, Projectile, Pickup)
  input/     InputState: one input layer for touch, keyboard, later gamepads
  systems/   Gameplay behaviour, one job per file:
    weapons/   one class per weapon + factory in index.ts
    skills/    active skills (e.g. Frost Nova)
    PlayerController, EnemySystem, PickupSystem, DamageNumbers
  scenes/    Boot (placeholder graphics), Game (owns run state, wires systems), UI (HUD, touch, menus)
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
10. **Git:** Small commits, one feature per branch. Claude may be listed as co-author
    (`Co-Authored-By`), but commit messages and PR descriptions never contain session links.

## Roadmap

### Milestone 1: vertical slice

A small but complete piece of the game from `docs/vision.md`. Each step is its own PR.

- [ ] Segments with a goal (e.g. survive N minutes) and a result screen
- [ ] Hex world map from a seed: rings, biomes, fog of war; tap a neighbour hex to play it
- [ ] Expeditions: build carries over between segments, camps as waypoints, partial loot loss on death
- [ ] Village as the starting point (simple screen: stash and "set out")
- [ ] Herbs dropped by biome and collected during expeditions
- [ ] Herb garden and brewing of three potions taken on an expedition
- [ ] One class with a small skill tree
- [ ] A boss guarding a dungeon or the outer ring

### Later

- [ ] Seasons with a shared seed, then leaderboards (needs a server)
- [ ] More biomes, enemies, weapons and classes
- [ ] Sound effects and music
- [ ] Real art (sprite atlas) instead of placeholders
- [ ] PWA (installable), then Capacitor (Android/iOS) and Tauri (desktop)
