# Nightwatch – Game Vision

This document describes where the game is heading. It is a living document: decisions get
moved from "Open questions" into the sections above once they are made.

## Pitch

A survivors-like with RPG depth. You leave your home village to explore a hex-based world
made of short survivor battles, find points of interest, gather herbs, and come back
stronger: with a better class build, a growing herb garden and potions for the next expedition.

## Core loop

1. **Prepare in the village:** pick your class build, plant and harvest herbs, brew potions.
2. **Set out on an expedition** across the hex map.
3. **Fight through hexes:** each hex is a short survivor segment (about 3–5 minutes).
4. **Rest at points of interest** between hexes: trade, explore a dungeon, or decide whether
   to push further or turn back.
5. **Return or die:** bring your loot home, or lose part of it and wake up at the last waypoint.
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
- **Points of interest** are rare and spread out (never next to each other) and sit on some hexes: camps, merchants with special goods, dungeon
  entrances, and occasionally an outpost or a second village.
- **Hexes reset after an expedition:** a hex cleared on an expedition is used up (greyed out on the
  map) and can be walked through without a fight; when you return home everything fills again.
- **Waypoints:** camps and other points of interest you reached can be teleported to.
  Expeditions can start from there.

## Expeditions

- An expedition is a chain of hex segments, from setting out until you return or die.
- **Three layers of progress:**
  - _Permanent (village):_ class, skill tree, garden, brewed potions, unlocks.
  - _Per expedition:_ level, weapons, upgrades, collected herbs and loot.
  - _Per segment:_ enemies, timer, segment goal.
- Your in-run build keeps growing across segments, like one long Vampire Survivors run with breaks.
- **Risk vs. reward:** after every cleared hex you choose to continue or go home with all your loot.
  Later, going home could cost something (e.g. portal scrolls), except from camps or next to the village.
- **Health carries over** between hexes; camps heal you fully.
- **Death or giving up:** the expedition ends, you wake up in the village and keep half of the loot.

## Combat

- Automatic weapons as in Vampire Survivors, plus **a few active skills** (currently Shadow Dash
  and Frost Nova).
- Level-ups during a run offer a choice of weapons, items and skill upgrades.
- Bosses guard dungeons and important places.

## Herbs

- Herbs **grow in some hexes** (about a third), the map shows which; the others are empty, so
  finding herbs stays rewarding. Monsters do not drop them. Each biome has its own herb, and a rare
  Star Lily can grow anywhere from ring 3 outwards. Further rings grow more herbs.
- Fresh herbs every time a hex is entered. They **bloom one by one at random moments** spread over
  the fight, just off screen around the player, with a short hint. Nothing grows back during a fight.
- **Gathering:** stand next to a herb for about a second. Moving away resets it, a hit halves it.
- Arrows at the screen edge point to herbs just off screen. A fresh bloom keeps its arrow for
  10 seconds wherever you are; after that only nearby herbs have one.
- Gathered herbs are expedition loot: brought home safely, or halved on death.
- Later: **professions** (e.g. herbalist) with skills such as faster or uninterruptible gathering.
  The edge arrows could become a herbalist skill too; for now they are on for everyone.

## Village

- **Herb garden:** plant herbs found on expeditions to grow more of them.
- **Brewing:** turn herbs into potions at the cauldron. A potion uses up a few herbs.
- **Potions are drunk with a button during a fight**, not passive buffs: healing, haste and warding
  for now. You pack them into a small belt (3 slots) in the village; what you do not drink stays in
  the belt, also when you fall. Refilling is only possible at home.
- Passive buffs for a whole expedition are left for later ideas, e.g. a cooking profession with buff
  food, or items with passive effects.
- **Herbs in the garden grow in real time**, also while the game is closed.
- **Class and skill tree:** permanent progression of your character.
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

## Seasons

- Every season everyone plays **the same map**, generated from a shared seed.
- Goal: get as far as possible. Progress is how far your waypoint network reaches.
- A new season reshuffles the map and can bring content updates.
- Leaderboards need a server and come later.
- Proposed: map, waypoints and collected herbs reset; class unlocks, recipes and the village stay.

## Look and feel

- **Mood:** dark fantasy in the spirit of Diablo 2. Night is the central theme.
- **Light matters:** the player carries a light, torches and camps are islands of light in the dark.
  Light radius could become a stat (potions, skill tree), and enemies could be more dangerous in darkness.
- **Perspective is not decided yet:** isometric (more atmosphere, much more art work) or 3/4 top-down
  (cheaper art, better readability on phones). Decide before the art pass, at the latest before the
  village gets its visual design. A good tie-breaker: the asset pack or artist we can actually get.
- Until then the game keeps its current placeholder view; gameplay work does not depend on this choice.

## Platforms

- Web first (playable via GitHub Pages), then installable PWA, then native apps
  (Capacitor for Android/iOS, Tauri for desktop).
- Mobile first: short sessions, one-thumb movement, big buttons.

## Open questions

- How long should a full expedition take?
- What exactly survives a new season?
- Perspective: isometric or 3/4 top-down (see Look and feel).
- Walkable village: when to build it (ideally with real art), and how shortcuts work on phones.
- Art source: asset packs, 3D models rendered to sprites, or commissioned pixel art.
- Online features (leaderboards, maybe co-op) and when they make sense.
