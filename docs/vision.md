# Nightwatch – Game Vision

This document describes where the game is heading. It is a living document: decisions get
moved from "Open questions" into the sections above once they are made.

## Pitch

A survivors-like with roguelite progression and RPG depth, in the spirit of Hades and Diablo 2.
You leave your village to explore a large hex-based world made of short survivor battles, find
points of interest, gather herbs and ores, and come back stronger: with better weapons, a brighter
lantern, a growing herb garden and potions for the next expedition.

The world and story are in [lore.md](lore.md). The game must be fun even if the story is ignored;
the story is sprinkled in lightly and never forced.

## Decided, not built yet

Decisions from the lore and design session (October 2026) that the current code does not follow yet.
The sections below already describe the target; this list is the to-do for the code.

- **Gold becomes Embers** (same role: the long-term currency, spent at traders). Unlike gold today,
  embers are **kept on death**.
- **Camps go away.** Lit watchfires take over their role: rest, healing, waypoints and fast travel
  between each other and the village.
- **Death:** you always wake up in the village (the Nest). Kept: embers, permanent upgrades, weapons,
  lanterns, rescued villagers, potions in the belt. Lost: level-ups, ores, herbs, seeds and weapon
  fragments of the current expedition.
- **One character, no class and no skill tree.** Build identity comes from the **main weapon**,
  chosen before an expedition, each with its own special skill (see Weapons). Permanent bonuses are a
  flat list bought with embers.
- **Phoenix Feather** instead of portal scrolls: bought with embers, takes you home with everything
  you carry after a cleared hex, away from a watchfire. It is no escape from a fight in progress.
- **Event hexes** marked with "?" (see The world).
- **Core systems are in the village from the start** (blacksmith, herbalist, trader). Villagers you
  rescue only bring special unlocks (see Village).

## Core loop

1. **Prepare in the village:** pick your main weapon, upgrade weapons and lantern, plant and harvest
   herbs, brew potions.
2. **Set out on an expedition** across the hex map, from the village or a lit watchfire.
3. **Fight through hexes:** each hex is a short survivor segment (about 3–5 minutes).
4. **Rest at lit watchfires** between hexes, or decide whether to push further or turn back.
5. **Return or die:** bring your finds home, or lose them and wake up in the village. Embers and
   everything permanent stay.
6. **Grow stronger** and reach further next time.

## The world

- **Hex map** with the home village in the center.
- **Distance means danger:** rings further out are harder and hold rarer rewards.
- **Biomes** (e.g. forest, swamp, mountains) decide which enemies and herbs appear in a hex.
- Biomes form **large regions** of many hexes. Every biome has a region right next to the village,
  so every common herb can be found early; further out the regions get larger.
- Later: **special biomes** that only appear far out (only as outer regions, from a minimum ring),
  with their own enemies and herbs, as a reason to travel further.
- **Fog of war:** unexplored hexes are hidden.
- **Points of interest** are rare and spread out (never next to each other) and sit on some hexes: watchfires, merchants with special goods, dungeon
  entrances, places where villagers wait to be rescued, and occasionally an outpost or a second village.
- **Hexes reset after an expedition:** a hex cleared on an expedition is used up (it stays lit on the
  map while the rest is dimmed) and can be walked through without a fight; when you return home everything fills again.
- **Waypoints are lit watchfires.** You rest and heal there, travel between lit watchfires and the
  village, and can start expeditions from them. Camps go away. A watchfire reveals the land around it
  on the map, but hexes stay dark in a fight: watchfires give orientation, not protection.
- **A large map:** one map per season (from a seed), about 8–10 rings (217–331 hexes). Lit watchfires
  stay lit for the whole season, so a season feels like a campaign over weeks. To keep a big map from
  feeling empty or like a chore:
  - not every hex is a fight (travel hexes, events, special places),
  - a watchfire every two to three rings, so short phone sessions can reach the front quickly,
  - biomes as regions in every direction, so every direction pays off,
  - fixed anchors (village, villager places, bosses, the tower) with the rest generated around them.

**Hex rewards** (built, `config/rewards.ts`, `logic/rewards.ts`): like the doors in Hades, every hex with
a fight shows what clearing it brings, next to its goal (on the hexes next to you), rolled anew for every
expedition: _gold_ (more gold drops, a bonus at the end), a _treasure chest_ at the end, a _rare card_
(a choice of magic or legendary cards, from ring 2), _full health_, or a _herb harvest_ (twice the blooms,
where herbs grow). You pick your way by what you need. Later: embers, unlocks, villagers, ores, and
richer rewards further out.

**Event hexes ("?"):** some hexes show a question mark. What happens there is only revealed when you
enter, also on hexes revealed by a watchfire. Most events should be worth it, so players do not learn
to avoid them; further out they get riskier and richer. An event takes no longer than a normal fight.
Ideas, grouped by kind:

- _Luck:_ a forgotten lantern holding embers or something rare; a Star Lily that only blooms briefly.
- _Choice:_ a feather shrine (pay embers or health for a blessing that lasts the expedition); a curse
  of the dark (stronger enemies for better loot until you return); a stranger selling rare goods.
- _Challenge:_ an ambush by an elite; an ore vein to mine while waves come; a sleeping monster to
  sneak past or wake for a big find.
- _Encounter:_ an "echo", a short inscription or memory that hints at the world (the light way to tell
  the story, see lore.md), with a small reward for those who skip it.

Open: whether events are text choices (quick to build, nice on phones, like Slay the Spire), always
playable in the fight area (e.g. walking up to a shrine), or a mix.

## Expeditions

- An expedition is a chain of hex segments, from setting out until you return or die.
- **Footsteps:** the way walked on the current expedition is drawn on the map as footprints, from where
  you set out to where you stand (`Expedition.path`, `logic/footsteps.ts`, look in `config/footsteps.ts`).
  The newest steps are the strongest, a way walked again is shifted sideways, and the trail is gone once
  the expedition ends.
- **Three layers of progress:**
  - _Permanent (village):_ embers, main weapons and their upgrades, lanterns, ember upgrades, garden,
    brewed potions, rescued villagers, deeds.
  - _Per expedition:_ level, weapons and upgrades from level-ups, collected herbs, ores, seeds and
    weapon fragments.
  - _Per segment:_ enemies, timer, segment goal.
- Your in-run build keeps growing across segments, like one long Vampire Survivors run with breaks.
- **Risk vs. reward:** after every cleared hex you choose to continue or go home. From a lit watchfire
  or next to the village going home is free; from anywhere else it takes a **Phoenix Feather**
  (bought with embers), which brings you home with everything you carry. The feather only works
  between hexes, after a fight is won: once a fight has started there is no way out but winning or
  falling.
- **Finds only count once you are home:** weapon fragments and seeds are the things worth bringing
  back, so turning back in time matters.
- **Health carries over** between hexes; lit watchfires heal you fully.
- **Death or giving up:** the expedition ends and you wake up in the village (the Nest). You keep
  embers and everything permanent, and potions in the belt. You lose level-ups, ores, herbs, seeds and
  weapon fragments of this expedition. Like Vampire Survivors, death is a setback, never a loss of
  progress.

## Combat

- Automatic weapons as in Vampire Survivors, plus **a few active skills** (currently Shadow Dash
  and Frost Nova).
- Level-ups during a run offer a choice of weapons, items and skill upgrades.
- Bosses guard dungeons and important places.

## Weapons

One character for everyone; weapons are the build, in the spirit of Hades (decided, not built yet).

- **Main weapon:** chosen in the village before an expedition (e.g. sword, bow, staff). It decides
  the play style and replaces classes.
- **Special skill per weapon:** each main weapon brings its own active skill (e.g. Frost Nova on the
  staff). The dash stays universal.
- **During a run:** level-up cards still offer extra weapons and upgrades, as today.
- **Permanent:** ores upgrade your main weapons at the blacksmith.
- **New weapons:** weapon fragments dropped by elites, bosses and special places. Brought home, the
  blacksmith forges them into new weapons or variants (like weapon aspects in Hades).
- **Lanterns carry no skills.** A lantern only gives light and sight; a better lantern must always be
  the better choice.
- **Tools against a crowd that piles up** (built, `logic/hitEffects.ts`, as level steps of the weapons):
  enemies get tougher over time while the player's damage is capped, so a horde stacks up late in a
  fight. These tools help; they come as level steps of the weapons, in a random order:
  - _Knockback:_ a hit pushes the enemy away; the push slows down by itself. It spreads a blob and buys
    time. Big enemies (the colossus) and elites resist it. (aura, bolt, blades)
  - _Bursts:_ a bolt explodes on impact and hurts the enemies around it for a share of the damage. (bolt)
  - _Focus fire:_ the bolt locks on to the nearest enemy and stays on it until it dies, gets out of
    reach or another enemy comes very close (`BOLT_FOCUS.dangerRadius`); all bolts of a volley go to it until the damage on its way will kill it, then to the next one
    (`logic/focus.ts`). Enemies fall one after another instead of all of them
    taking a little. (bolt)
  - _Damage as a share of health:_ a hit also takes a few percent of the target's maximum health, so it
    keeps up with the health that grows over time. Elites take only a quarter of it. (aura, blades)
  - _Pierce:_ bolts already pierce; its steps come earlier now.

  How tough enemies are comes from the ring of the hex (`RINGS.hpPerRing`); within a fight they only get
  a little tougher (+50% over 100 s, `enemyHpMultiplier`), and pressure comes from more enemies through
  the spawn director instead. The ring's difficulty offset only decides which enemies come and how many,
  not their health. (Before, ring, time and offset all raised health, so from ring 3 on enemies were
  nearly twice as tough as intended.)

  These are the first answer to "I cannot kill them fast enough". Still open: a weapon that is built
  around them (e.g. a mortar) and scaling XP with enemy health (Wisdom helps for now).

- **Wild builds** (built as a test batch, to be tuned by playing): level-up cards are meant to let a run
  grow absurdly strong, and the game may scale a lot. There is no limit on items; they stack and combine.
  - _Items_ (`config/passives.ts`): area (Far Reach), push, damage as a share of health, XP, health per
    kill, chest luck, extra projectiles, crits and crit damage, executing weak enemies, damage against
    elites, faster skills, damage while moving or at low health, thorns, dodge, extra pierce, bursts on
    every hit, and a Blood Pact that trades tougher enemies for damage. The item bonuses are folded into the
    weapons' numbers in `logic/stats.ts`; the situational ones in `logic/hitEffects.ts`.
  - _One-time cards_ (`config/boons.ts`): act at once and are not part of the build (gold, all gems fly
    to you, full health, a shockwave, wiping the screen, a revive, a short damage surge). They are
    offered next to the other cards but never come out of chests.
  - _Chain Lightning_ is a new weapon: a strike that jumps from enemy to enemy; later levels add strikes,
    jumps and a search for the biggest crowd.
  - _Rarity:_ every card is common (grey), magic (blue) or legendary (orange); the frame and badge show
    it. Rarer cards are offered less often (`RARITIES` in `config/rarity.ts`; set a weight to 1 to
    turn that off).
  - _Random weapon steps:_ a weapon card brings one of the weapon's missing level steps at random, not the
    next one in a fixed order, so no two runs grow the same way (`weaponSteps` in the loadout). At the
    highest level a weapon has every step, whatever the order.
  - The dev panel has "level up" and "wild build" to try combinations quickly.

## Swarms, enemy behaviour and elites

Problem seen in later rings: enemies scale hard and all run straight at the player, so they pile into
one big blob that follows you. Single targets, elites included, become nearly impossible to hit.
Ideas collected so far (nothing decided beyond the "wanted" list):

**Wanted:**

- **Spread the swarm** (built, `logic/swarm.ts`, values in `SWARM`): enemies keep a little distance
  from each other, drift sideways on their own rhythm, react to the player with a delay and differ in
  speed, so they stay a loose crowd instead of stacking. Next to the player the effect fades, so a
  crowd can still close in. In a test fight in ring 6 the biggest clump of enemies (within 60 px of
  each other) was less than half of what plain chasing gives.
  **Work in progress:** a first tuning that helps clearly but still needs finetuning. In tight crowds
  enemies can look as if they shove each other (soft steering and the hard overlap push work against
  each other). Ideas: smooth the velocity, push out only part of an overlap per frame, a smaller
  personal space.
- **Different behaviours:** flankers that come in an arc or aim ahead of you, runners that pass by,
  orbiters that keep their distance, ranged enemies that stop and shoot, chargers with a warning.
  New enemy types per ring should differ in behaviour, not only in numbers.
  **Built so far** (`logic/behaviors.ts`, `logic/charge.ts`, set per type in `config/enemies.ts`): the bat
  flies nearly straight over the crowd, the ghoul is a pouncer (runs up, crouches over a landing circle
  that follows you until just before the jump, leaps in an arc and lands stunned; all ghouls share a
  cooldown, so pounces come one after another with breathers, `CHARGE_COOLDOWN_MS`),
  the zombie and the colossus still chase straight. A type can be limited to rings (`minRing`). The
  flank behaviour (arc, aiming ahead) exists in the code but no type uses it yet. Still to do: a charger
  for the colossus, ranged, orbiters, runners, bat flocks that sweep from side to side.
- **Elites need a rethink,** but not necessarily "alone": give them a mechanic to react to
  (telegraphed charge, shield to break, summoned helpers), let them move on their own instead of
  hiding in the blob, let one weapon prefer them as a target, and set their health from a target
  fight length (e.g. 10-15 seconds with a normal build) instead of from a flat multiplier.

**Still to think through:** light as a combat rule (enemies slowed or hurt inside the lantern's
light, faster in the dark; watchfires as safer zones). It would give lanterns a role against swarms
and fits the identity of the game. Not decided.

**Spawn director** (built, `logic/director.ts`, values in `config/director.ts`; separate from the swarm
steering): one place that decides when and how enemies come, instead of a constant stream. A fight runs
in cycles: a **build-up** where the stream rises, an **announced surge** (a hint in red a few seconds
before it hits) and a **breather** with almost no spawns. The first build-up is longer and gentler.
The strength of the stream is a smooth curve (`spawnRate` in `logic/spawning.ts`, values in `SPAWN`):
0.9 enemies per second, +20% per ring, growing by half again every minute of the fight, without the
jumps the first curve had. It counts only the time of this fight, so a long fight (finding the light)
does not run away, and ring 4 is no longer a wall. The director multiplies it per phase, so a cycle
brings about as many enemies as the stream, only in a shape. Surge kinds:

- _swarm:_ a wave of higher pressure that comes from one side ("from the north-east"); always the first
- _ring:_ from 1 minute on, a ring of enemies closes in from all sides at once
- _wall:_ from 1:30 on, a line of enemies crosses one side at once

The ghouls' pounces keep running through their own global cooldown (`ChargeGate`,
`CHARGE_COOLDOWN_MS`): the director does not touch it, so even a wave full of ghouls pounces one after
another with breathers. Still open for the director: bat flocks that sweep from side to side, an arrow
on the screen edge for the side a surge comes from, and a "recommended strength" per ring.

**Other ideas on the table:** obstacles (trees, ruins) that break up the crowd, tools
against blobs (first set built, see Weapons; more weapons for it later), fewer but more varied
enemies, and showing a "recommended strength" per ring on the map so hard rings are a choice.

Reference: Vampire Survivors mixes straight lines, sine-wave flyers, walls and rings; Brotato uses
waves with rests and ranged enemies.

## Varied fight goals

Not every hex fight should be "survive N minutes". Built so far (`logic/goals.ts`, `config/goals.ts`):
each hex has a goal, shown on the map before you go in and at the start of the fight; the counter at the
top of the screen follows it. Goals are rolled from the hex and the number of finished expeditions
(`WorldProgress.expeditions`), so a hex keeps its goal for one expedition and may have another on the
next; the map itself does not change.

- **Survive** a time (built).
- **Hunt:** kill a number of enemies, more further out; no time limit, the spawn director keeps the
  pressure up (built). Later also a special target, e.g. a marked elite.
- **Find the light** (built for watchfires): first you search the dark. Only while you move, the search
  time runs (25 s in ring 1, +8 s per ring, give or take 20%); then the cold watchfire shows up just
  outside the view in the direction you walk, with "A faint glow in the dark!" and an arrow at the screen
  edge. By then the horde has grown. Standing next to it lights it in 6 s; away from it, the progress drains
  (all of it in 8 s); hits do not interrupt it. Once it burns the hex is cleared, and on later expeditions
  the hex rolls an ordinary goal.
  Idea for later: while you light it, its glow keeps enemies at bay (they slow down near the fire).
  Lanterns or beacons could work the same way later.
- **Find the dungeon** entrance (or another place) in the area.
- Perhaps: protect something, gather herbs, defeat an elite or a boss.

**Points of interest get their own goals.** Watchfires have one now (find the light, above). The same
idea fits dungeon entrances, camps and merchants.

Ideas to keep in mind: goals are chosen per hex by the world generator (seeded, so the map stays
deterministic), shown on the map before you go in, and have different rewards. A goal is a small
rule set in `config/` plus its check in `logic/`; the fight only reports progress. The first quest
(light a watchfire) already points in this direction.

## Herbs

- Herbs **grow in some hexes** (about a third), the map shows which; the others are empty, so
  finding herbs stays rewarding. Monsters do not drop them. Each biome has its own herb, and a rare
  Star Lily can grow anywhere from ring 3 outwards. Further rings grow more herbs.
- Fresh herbs every time a hex is entered. They **bloom one by one at random moments** spread over
  the fight, just off screen around the player, with a short hint. Nothing grows back during a fight.
- **Gathering:** stand next to a herb for about a second. Moving away resets it, a hit halves it.
- Arrows at the screen edge point to herbs just off screen. A fresh bloom keeps its arrow for
  10 seconds wherever you are; after that only nearby herbs have one.
- Gathered herbs are expedition loot: brought home safely, or lost on death (today they are halved;
  the decided target is to lose them, to be checked in play).
- Herbs are used for **potions with buffs**. Rare **seeds** found far out bring new plants to the
  herb garden.
- Later: **professions** (e.g. herbalist) with skills such as faster or uninterruptible gathering.
  The edge arrows could become a herbalist skill too; for now they are on for everyone.

## Endgame: the old tower

- After your first return home, the village elder asks you to find an **old tower** at the edge of
  the map. Accepting reveals and marks it; a scout points out a **camp close to the village** in the
  tower's direction as a first stop. Further camps on the way you find yourself.
- The way there is the incentive to travel far. Standing next to the tower completes the quest;
  its gate is **sealed for now**.
- What happens inside is still open: for example ever harder floors as an endless endgame, with
  bosses, rare rewards, and the highest floor as a measure of progress (fits seasons later).

## Village

- **Herb garden:** plant herbs found on expeditions to grow more of them.
- **Brewing:** turn herbs into potions at the cauldron. A potion uses up a few herbs.
- **Potions are drunk with a button during a fight**, not passive buffs: healing, haste and warding
  for now. You pack them into a small belt (3 slots) in the village; what you do not drink stays in
  the belt, also when you fall. Refilling is only possible at home.
- Passive buffs for a whole expedition are left for later ideas, e.g. a cooking profession with buff
  food, or items with passive effects.
- **Herbs in the garden grow in real time**, also while the game is closed.
- **No class and no skill tree** (decided): permanent progression is weapons, lanterns and a flat list
  of ember upgrades (see Weapons and Progression).
- **The Nest:** the undying fire in the middle of the village, where you wake up after a death. The
  village is a safe place: nothing bad happens while you are away.
- **Core systems from the start** (decided): the village has everything the core loop needs from
  the first day:
  - blacksmith: weapon upgrades, new weapons from fragments, lanterns
  - herbalist (today the cauldron): potions and the herb garden
  - trader (today the merchant): Phoenix Feathers, recipes and other consumables
- **Villagers you rescue** (decided): a few people wait at fixed places on the map. Rescuing one
  brings them to the village with a **special unlock** on top of the core systems, for example:
  - a master smith in the abandoned mine: weapon variants or rare forging
  - a herb witch in the mire: rare potion recipes and seeds
  - a far trader from the trading post: rarer goods
  - maybe a cartographer: more map information, e.g. what an event hex holds
- Rescued villagers stay across seasons. New ones can come with a season.
- Farming must feel like a reward, never like a chore you have to do before playing.
- **Today** the village is a menu screen: the stash, what came home, and a button to set out.
- **Later** it becomes a place you walk around in with your character: your house (stash),
  the herb garden, the brewing cauldron, a merchant, a blacksmith and so on. Walking up to a
  building opens its panel.
- To make that switch cheap, every village feature is built as its own panel on top of pure
  logic in `logic/`. The menu opens a panel with a button; the walkable village opens the same
  panel at a door. Only the way to get there changes.
- On phones walking is slower than tapping, so the walkable village probably needs shortcuts
  (e.g. a button that takes you straight to a building).

## Progression: guiding goal and ideas

**Guiding goal:** exploring must pay off in every direction, not only on the way to the tower.
Every part of the map should hold a reason to go there.

The ideas below are **not decided**; they are collected here so nothing gets lost, and are picked
up one by one.

- **Watchfires** (prototype): old watchfires scattered over the map, one in each direction. Their
  glow shows through the fog; lighting one (clearing its hex) reveals the land around it. Decided:
  they become the waypoints (rest, healing, fast travel) and replace camps; on the larger map there
  should be more of them (see The world).
- **Places with a story in each direction**, each unlocking something in the village (the village
  grows by exploring; the villagers to rescue live here, see Village):
  - an abandoned mine in the hills: a lost master smith, ores, weapon variants
  - a herb witch's hut in the mire: rare potion recipes
  - a crypt of fallen guardians in the graveyard: a boss and the first equipment
  - a trading post or second village far out: a better merchant, selling loot, a far waypoint
- **Embers** (decided, replacing gold): the currency. Monsters release the light they ate and you
  catch it in your lantern; traders accept embers because only they keep forges, lamps and potions
  going. Kept on death. Spent on lanterns, ember upgrades, recipes and Phoenix Feathers.
- **Gold** (built, to become embers): rare and slow, the long-term currency. Dropped rarely in fights (later mostly by
  elites and chests); herbs, ores and items can be sold for it. Part of the expedition loot (lost on
  death).
- **Merchant** (built, village): four lantern tiers (light +30%, +70%, +130%, for good; the
  Sunstone Lantern lights up the whole screen and could later come from a special place instead), potion recipes
  (start with the healing potion, buy the others), buys herbs. Later maybe seeds or maps; merchant
  points of interest on the map could sell rarer goods.
- **Treasure chest** (built): any enemy may leave a chest by chance, elites far more often. Tapping
  it pops the lid, then its reels spin like a slot machine before stopping on the rewards: gold and usually one upgrade, sometimes
  three, rarely five. Later also equipment you keep (e.g. armour).
- **Lantern and light radius:** a better lantern means a bigger light radius in fights. For now
  light is only visual (see Look and feel); later it could matter for gameplay.
- **Mining and blacksmith:** ore veins in some hexes by biome, gathered like herbs. Decided: ores
  upgrade main weapons and buy the better lanterns at the blacksmith. Herbs and ores could share one
  "resource" system and fit professions later.
- **Equipment with random stats** (Diablo-like, not decided; weapons now come from fragments, see
  Weapons, so this would cover other slots such as armour, ring and amulet at most): slots such as lantern, armour, ring and amulet,
  equipped in the village, permanent. Rare drops from elites, chests and dungeons count as loot until
  you are home. An inventory shows what you found, also during a fight and on the map.
- **Deeds** (built): milestones of exploring, each earned once and giving a small bonus for good:
  reaching rings 2, 4, 6 and 8, the first camp, one, three and all watchfires, and the old tower.
  Saved the moment they are earned, so they stay when you fall, and kept when the map is reset.
  The village shows which are earned and which are still open. They give the watchfires a real
  purpose and make even a failed expedition count. Open: whether a new season lets you earn them
  again; more deeds later (e.g. first elite, a dungeon cleared), maybe a reward in gold or a recipe.
- **Ember upgrades** (decided, grew out of the trainer idea): a flat list of permanent bonuses bought
  with embers (e.g. health, speed, pickup radius, a fourth belt slot), like the permanent power-ups in
  Vampire Survivors. No tree layout needed.
- **Layers of progression:** character (deeds, ember upgrades), weapons (main weapons, upgrades,
  variants), lantern, village (rescued villagers, garden), knowledge (recipes), world (how far you get,
  up to the tower).

## Seasons

- Every season everyone plays **the same map**, generated from a shared seed.
- Goal: get as far as possible. Progress is how far your waypoint network reaches.
- **Model: Diablo or Path of Exile seasons, not Tarkov wipes.** A season should feel fresh without
  taking away what players care about; in a single-player phone game a full wipe mostly drives
  players away.
  - _New:_ a map from a new seed and new content (e.g. a biome, a weapon or a villager).
  - _Reset:_ the map and lit watchfires, maybe embers (open).
  - _Kept:_ the village, rescued villagers, weapons and their upgrades, lanterns, recipes.
  - _Season goals_ with rewards that stay (e.g. a weapon variant or a lantern look).
- In the fiction each season is a new **Long Night** (see lore.md).
- Seasons are a live-service promise (new content every few months). The game must be complete
  without them; they come as an extension.
- Leaderboards are **not planned** for now. Players are driven more by their own goals (further
  rings, new weapons). A season ranking can still be added later; it needs a server and a fair answer
  to veterans starting stronger.

## Look and feel

- **Mood:** dark fantasy in the spirit of Diablo 2. Night is the central theme.
- **Fog over the map:** slow night fog drifts over the whole world map. Explored hexes stay readable
  through it, unexplored hexes stay black, and the village and every lit watchfire add warm light
  around them without clearing the fog away (`ui/mapFog.ts`, values in `config/mapFog.ts`).
- **Light matters:** the player carries a light, torches and watchfires are islands of light in the dark.
  Light radius could become a stat (potions, lanterns, ember upgrades), and enemies could be more dangerous in darkness.
- **Story in the background:** short lines, item texts and places instead of cutscenes (see lore.md).
- **Perspective: 3/4 top-down** (decided). Readable on phones, the usual view for survivors-likes, and
  far more art is available for it than for isometric (which needs every character in 8 directions).
- **Art in steps:** free art first (LPC characters, darkened to fit the night), replaced later by
  better, possibly paid art in the Diablo 2 / Darkest Dungeon mood. Art is set up in config, so a swap
  means new sheets, not new code. Licences must allow a public repo and website (see CREDITS.md).

## Platforms

- Web first (playable via GitHub Pages), then installable PWA, then native apps
  (Capacitor for Android/iOS, Tauri for desktop).
- Mobile first: short sessions, one-thumb movement, big buttons.

## Open questions

- How long should a full expedition take?
- Final title: "Nightwatch" is a working title. The theme (night, light, the Nest, watchfires) is
  decided, see lore.md.
- Which main weapons at the start, and which special skill each one brings?
- Which herbs and ores exactly, and what they are used for in detail?
- Event hexes: text choices, playable in the fight area, or both?
- Do embers reset with a new season?
- Prices: Phoenix Feather, ember upgrades, lanterns.
- Walkable village: when to build it (ideally with real art), and how shortcuts work on phones.
- Art source: asset packs, 3D models rendered to sprites, or commissioned pixel art.
- Online features (season rankings, maybe co-op) and whether they are needed at all.

## Full game in steps

What a complete game could look like:

| Area        | Scope                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| World       | Hex map with 8–10 rings, three to four biomes (forest, mire, mountains, wasteland), the Old Tower at the edge |
| Village     | The Nest, blacksmith, herbalist and trader from the start, plus a few rescued villagers with special unlocks  |
| Weapons     | Six to eight main weapons, each with its own special skill and two to three variants                          |
| Progression | Lantern tiers, weapon upgrades, ember upgrades as a list, herb garden                                         |
| In a run    | Level-up cards, potions in the belt, elites, one boss per biome, event hexes                                  |
| Endgame     | The Old Tower with endless floors                                                                             |
| Later       | Seasons, maybe a season ranking                                                                               |

Suggested order for the new direction:

1. The loop: one main weapon, lantern, ember upgrades as a list, waking up in the Nest.
2. Ores and the blacksmith, a second main weapon.
3. Herbs, potions and the belt (mostly built).
4. Rescuing villagers as special unlocks, weapon fragments and seeds.
5. The large map with biomes, bosses, event hexes and the Old Tower.
6. Seasons last.
