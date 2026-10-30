# Nightwatch – Survivor RPG

A survivors-like game in the spirit of Vampire Survivors, with RPG progression and active skills.
Goal: web first, native apps later (Capacitor for Android/iOS, Tauri for desktop).

**Read [docs/vision.md](docs/vision.md) before planning features.** It describes the target game
(village, hex world, expeditions, weapons, herbs and potions, seasons) and its open questions; its
section "Decided, not built yet" lists where the code still differs from the target.
The world, story and in-game terms (Embers, the Nest, watchfires) are in [docs/lore.md](docs/lore.md).

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
  map; in a fight a foldable "DEV" panel (tap its header; it also names the active modes and hides while a
  menu is open) with "clear area", "god mode" (no damage, much stronger, whole screen lit), "spawn elite" and
  "level up" (opens a level-up menu), "wild build" (every weapon and item at its highest level) and
  "invincible" (no damage taken or dealt, whole screen lit; for watching a horde in peace; replaces god mode),
  and a readout that is always visible: FPS (average, worst frame of the last half second; lights up below 50 FPS),
  living enemies and kills per minute (last 30 s); "reset save" in the
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
             potions (brewing, belt, buffs), lantern pendulum physics, merchant (gold, lanterns, recipes), ring difficulty, horde steering and enemy behaviours (swarm, behaviors), chests,
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

A small but complete piece of the game from `docs/vision.md`. Each step is its own PR. Done items
describe the game as built; some of it changes in Milestone 2 (gold, camps).

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
- [x] Spread the swarm: soft separation, sideways drift, reaction delay and varied speed, so enemies do not pile into one blob (`logic/swarm.ts`)
- [ ] Finetune the swarm (work in progress): in tight crowds enemies seem to shove each other, so smooth their movement, soften the hard overlap push and maybe shrink the personal space; values in `SWARM`. This is about how enemies move, not when they come.
- [ ] Spawn director: pacing instead of a constant stream, e.g. waves with breathers and announced events (a ring closing in, a wall from one side); see "Other ideas" in `docs/vision.md`
- [x] Behaviour per enemy type, as data in `config/enemies.ts`: the bat flies nearly straight over the crowd (`flies`), the ghoul is a pouncer (runs up, crouches over a landing circle, leaps in an arc, lands stunned; `logic/charge.ts`), the zombie and the colossus chase; types can be limited to rings (`minRing`) (`logic/behaviors.ts`). The `flank` behaviour (arc, aiming ahead) stays in the code for later types
- [ ] More behaviours and new enemy types: ranged, orbiters, runners that pass by; bat flocks that sweep from side to side (with the spawn director)
- [ ] Elites with a mechanic, their own movement and fair health (target fight length)
- [ ] Varied fight goals (kill N enemies, find the light or the dungeon, ... see `docs/vision.md`)
- [x] Tools against a crowd that piles up, as level steps of the weapons (`logic/hitEffects.ts`): knockback with a push that slows down, bolt bursts, damage as a share of health (aura, blades), earlier pierce
- [x] Wild builds, a first test batch: 19 new items without a limit (`config/passives.ts`), one-time cards (`config/boons.ts`) and the weapon Chain Lightning; values to be tuned by playing (see "Wild builds" in `docs/vision.md`)
- [ ] Follow-ups: a weapon built around crowd control (e.g. a mortar), XP that keeps up with enemy health (check in play first), tune or drop what does not feel good from the wild-build batch, more weapons

### Milestone 2: new core loop

The decisions in "Decided, not built yet" in `docs/vision.md`. They change the economy, save data
and the loop, so later content builds on them. Each step is its own PR.

- [ ] Gold becomes Embers, kept on death (chests, elites, quests and merchant pay embers)
- [ ] More watchfires on the map (one every two to three rings), so they can replace camps
- [ ] Camps go away: lit watchfires are the waypoints (rest, healing, fast travel, setting out)
- [ ] Phoenix Feather: bought with embers, takes you home after a won fight away from a watchfire
- [ ] New death rules: keep embers and everything permanent, lose level-ups, ores, herbs and finds
- [ ] Main weapons chosen in the village, each with its own special skill; the dash stays for all (replaces the planned class and skill tree)
- [ ] Ember upgrades: a flat list of permanent bonuses (e.g. health, speed, pickup radius, faster gathering)
- [ ] Ores and the blacksmith (in the village from the start): weapon upgrades and lanterns

### Milestone 3: depth

- [ ] Herb garden: plant herbs and harvest more of them, growing in real time, new plants from seeds
- [ ] Weapon fragments and seeds as finds that only count once you are home; the blacksmith forges fragments into new weapons or variants
- [ ] Event hexes marked "?" (luck, choice, challenge, encounter)
- [ ] Rescuing villagers who bring special unlocks (core systems like blacksmith, herbalist and trader are in the village from the start)
- [ ] A boss per biome, guarding a dungeon or an important place

### Milestone 4: world and endgame

- [ ] Bigger map (8–10 rings) with exciting places in every direction, not only on the way to the tower
- [ ] More biomes, enemies and main weapons
- [ ] Inside the tower: endgame mechanics still open (e.g. ever harder floors)

### Later

- [ ] Richer expedition panel on the map: health bar and the collected weapons, items and skills
- [ ] Walkable village: house, garden, cauldron, merchant, blacksmith as places to walk to
- [ ] Sound effects and music
- [ ] Real art (sprite atlas) instead of placeholders
- [ ] Seasons with a shared seed (Diablo-style: map resets, village and weapons stay); a season ranking only maybe, later (needs a server)
- [ ] PWA (installable), then Capacitor (Android/iOS) and Tauri (desktop)
