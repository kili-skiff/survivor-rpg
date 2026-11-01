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
  Test helpers: "+herbs +gold" and "arena" in the village (the test arena: a fight outside the map that
  saves nothing, the whole screen lit, no goal; falling only counts and refills health; switch between a
  horde of a chosen ring and standing dummies; the readout adds damage per second, total damage, kills per
  minute and the share of each weapon and modifier effect in a box on the right (tap to fold it); "reset", "leave"; "log"
  saves a measurement with its build, "copy" copies all of them as text; dummies have a normal enemy's health
  and fill up instead of dying; `dev/arenaLogic.ts`); "reveal" (fog off on screen only) and "jump here" on the
  map; in a fight a foldable "DEV" panel (its header shows the frame rate and enemies and names the active
  modes; tapped, it shows the details and the buttons in short groups; it hides while a menu is open) with
  "clear" (wins the fight), "god" (no damage, much stronger, whole screen lit), "elite" (spawns one) and
  "level up" (opens a level-up menu), "wild" (every weapon and item at its highest level), "🎲 build L10"
  with − and + (a random build as a real run could bring at that level: three cards per level-up, one taken
  the way a typical player leans, a random modifier at modifier levels), "pick upgrade"
  (a paused list of every upgrade that could come now, each weapon level step on its own, and a "mods" tab
  with the modifiers of the main weapon; tap to take it),
  "weapon" (swaps the main weapon for the next one at level 1) and
  "invincible" (no damage taken or dealt, whole screen lit; for watching a horde in peace; replaces god mode),
  a damage meter on the right in every fight (damage per second, kills per minute, total, a bar per weapon and
  modifier effect; tap to fold it; `dev/DevDamageBox.ts`),
  and a readout that is always visible: FPS (average, worst frame of the last half second; lights up below 50 FPS),
  living enemies, kills per minute (last 30 s) and the spawn director's phase with its pressure; "reset save" in the
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
             deeds, segments, world, map tiles, map fog, footsteps, character sprites, ground tiles, balancing (NO Phaser)
  logic/     Pure game logic (NO Phaser, tested): stats, XP, upgrades, spawning, segments, save data,
             hex math, seeded RNG, world generation, world progress, expeditions and journeys, footsteps,
             potions (brewing, belt, buffs), lantern pendulum physics, merchant (gold, lanterns, recipes), ring difficulty, horde steering and enemy behaviours (swarm, behaviors), the spawn director (waves, breathers, rings and walls), chests,
             quests, deeds, device settings, fog noise
  entities/  Pooled Phaser objects (Enemy, Projectile, Pickup)
  input/     InputState: one input layer for touch, keyboard, later gamepads
  systems/   Gameplay behaviour, one job per file:
    weapons/   one class per weapon + factory in index.ts
    skills/    active skills (e.g. Frost Nova)
    PlayerController, PlayerHealthBar (small bar under the player's feet), LanternSystem (the carried lantern), EnemySystem, PickupSystem, HerbSystem, PotionSystem, LightingSystem,
    DamageNumbers
  panels/    Village panels (CauldronPanel, MerchantPanel, DeedsPanel, DialoguePanel): drawn on top of any scene,
             logic lives in logic/
  scenes/    Boot (placeholder graphics), WorldMap (hex map, travel), Village (stash, belt, panels),
             Game (one fight, owns run state, wires systems), UI (HUD, touch, menus during a fight)
  ui/        Display helpers (pixel density, safe area), colors, the drifting night fog on the world map (mapFog)
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
- **Plan before building.** For every feature, first lay out the plan (what, how, which files, open
  questions) and wait for the user's go before writing code. Small fixes and number tweaks the user asks
  for directly are the exception.
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
- [ ] Finetune the swarm (work in progress): in tight crowds enemies seem to shove each other, so smooth their movement, soften the hard overlap push and maybe shrink the personal space; values in `SWARM`. This is about how enemies move, not when they come. Done so far: flyers (bats) keep their distance among themselves instead of stacking into one point, and each enemy sways and steps at its own pace (`rhythmJitter`). A loose blob around the player is fine, it belongs to the genre.
- [x] Spawn director: pacing instead of a constant stream: build-up, announced surge (a swarm from one side, later a ring or a wall) and a breather; the strength of the stream is a smooth curve per ring and fight time (`SPAWN`, `logic/spawning.ts`) (`logic/director.ts`, values in `config/director.ts`)
- [x] Behaviour per enemy type, as data in `config/enemies.ts`: the bat flies nearly straight over the crowd (`flies`), the ghoul is a pouncer (runs up, crouches over a landing circle, leaps in an arc, lands stunned; `logic/charge.ts`), the zombie and the colossus chase; types can be limited to rings (`minRing`) (`logic/behaviors.ts`). The `flank` behaviour (arc, aiming ahead) stays in the code for later types
- [ ] More behaviours and new enemy types: ranged, orbiters, runners that pass by; bat flocks that sweep from side to side (a surge kind of the spawn director)
- [ ] Elites with a mechanic, their own movement and fair health (target fight length)
- [ ] Varied fight goals (see `docs/vision.md`): each hex has a goal, shown on the map and rolled anew per expedition (`logic/goals.ts`, `config/goals.ts`). Built: survive, hunt (kill N), find the light (a cold watchfire hex: find the fire in the dark and light it by standing next to it, `systems/WatchfireSystem.ts`). Maybe later: hunt an elite
- [x] Tools against a crowd that piles up, as level steps of the weapons (`logic/hitEffects.ts`): knockback with a push that slows down, bolt bursts, damage as a share of health (aura, blades), earlier pierce
- [x] Wild builds, a first test batch: 19 new items without a limit (`config/passives.ts`), one-time cards (`config/boons.ts`) and the weapon Chain Lightning; values to be tuned by playing (see "Wild builds" in `docs/vision.md`)
- [x] Card rarity (common, magic, legendary: frame colour and how often offered, `config/rarity.ts`) and weapon level steps in a random order (`weaponSteps`)
- [x] Fight scaling: enemy health from the ring, only a gentle rise within a fight; Arcane Bolt focus fire with a target lock that lets a very close enemy take over (`logic/focus.ts`)
- [x] Hex rewards like the doors in Hades: each hex shows what clearing it brings (gold, chest, rare card, full health, herb harvest), rolled per expedition (`config/rewards.ts`, `logic/rewards.ts`)
- [ ] Follow-ups: a weapon built around crowd control (e.g. a mortar), XP that keeps up with enemy health (check in play first), tune or drop what does not feel good from the wild-build batch, more weapons

### Milestone 2: weapons and lasting progress

Why players go out again and again: a main weapon as the backbone of the build, progress that lasts beyond a
death, and reasons to go in every direction (see "Long-term motivation" in `docs/vision.md`). Each step is
its own PR, in this order.

Phase 1, main weapons (the main weapon is the backbone of the build and its upgrades are clearly felt; the wildness of a build comes from the extras from cards):

- [x] Main weapons: the armory in the village to choose one before an expedition (free for now, saved as `mainWeapon`), Arcane Bolt and a second one, the boomerang (flies a wide loop out and back, hits both ways; `systems/weapons/BoomerangWeapon.ts`). Main weapons come only from the armory; cards bring their level steps. Dev: "pick upgrade" and "main weapon" to try steps and compare weapons
- [x] Modifiers for main weapons, like the Daedalus hammer in Hades: at level 5, 10, 15 … a choice of three modifiers of the main weapon replaces the cards (`config/modifiers.ts`, `logic/modifiers.ts`). Bolt: Heavy Bolt or Volley, Ricochet, Spark Chain, Blast Tip, Frost Bolt. Boomerang: Whirl or Undertow, Wide Blade, Orbit, Keen Edge, Ember Trail. Most stack, the opposites exclude each other; values in `MOD`, to be tuned by playing
- [x] A dev test arena that compares weapons: damage per second, kills per minute and the share of each weapon and modifier effect, against a horde of a chosen ring or standing dummies
- [x] Balance pass measured in the arena: the main weapon's card is drawn 6 times as often and is sure to come after two level-ups without it, so it comes in about every second level-up (`MAIN_WEAPON_OFFER`; chests draw from the plain pool); Chain Lightning about 20% less damage, aura and blades as they were; weak modifiers stronger, Ember Trail and Orbit weaker. Target for a grown build: the main weapon deals about 35–50%, the extras the rest. Fine-tuning by playing
- [ ] More extra weapons for wild builds (e.g. a mortar against crowds, a weapon that leaves traps)

Phase 2, lasting progress:

- [ ] Gold becomes Embers, kept on death (chests, elites, quests, hex rewards and the merchant pay embers)
- [ ] The ember shop in the village: permanent upgrades (a flat list) and unlocks of extra weapons and cards
- [ ] Scaling pass once upgrades exist: rings 1–2 easy, from ring 3 on harder, a target per ring

Phase 3, reasons for every direction:

- [ ] Rescuing villagers (start with 2–3): the village grows, each brings something new
- [ ] A boss per biome that drops weapon fragments; fragments unlock further main weapons (e.g. sword, spear)

The goal at the end: the old tower (Milestone 4). Also part of the new loop, after the phases above: more
watchfires that replace camps as waypoints, the Phoenix Feather, the new death rules (keep embers and
everything permanent, lose level-ups and finds), a special skill per main weapon, ores and the blacksmith.

### Milestone 3: depth

- [ ] Herb garden: plant herbs and harvest more of them, growing in real time, new plants from seeds
- [ ] Event hexes marked "?" (luck, choice, challenge, encounter)
- [ ] More bosses, guarding dungeons or important places; seeds as finds that only count once you are home

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
