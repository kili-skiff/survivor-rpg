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
- **Fog of war:** unexplored hexes are hidden.
- **Points of interest** sit on some hexes: camps, merchants with special goods, dungeon
  entrances, and occasionally an outpost or a second village.
- **Hexes reset:** cleared hexes fill with monsters again (after a run or over time).
- **Waypoints:** camps and other points of interest you reached can be teleported to.
  Expeditions can start from there.

## Expeditions

- An expedition is a chain of hex segments, from setting out until you return or die.
- **Three layers of progress:**
  - _Permanent (village):_ class, skill tree, garden, brewed potions, unlocks.
  - _Per expedition:_ level, weapons, upgrades, collected herbs and loot.
  - _Per segment:_ enemies, timer, segment goal.
- Your in-run build keeps growing across segments, like one long Vampire Survivors run with breaks.
- **Risk vs. reward:** at every point of interest you choose to continue or go home.
- **Health carries over** between hexes; camps heal you fully.
- **Death or giving up:** the expedition ends, you wake up in the village and keep half of the loot.

## Combat

- Automatic weapons as in Vampire Survivors, plus **a few active skills** (currently Shadow Dash
  and Frost Nova).
- Level-ups during a run offer a choice of weapons, items and skill upgrades.
- Bosses guard dungeons and important places.

## Herbs

- Herbs **grow in hexes**; monsters do not drop them. Each biome has its own herb, and a rare
  Star Lily can grow anywhere from ring 3 outwards. Further rings grow more herbs.
- **Gathering:** stand next to a herb for about a second. Moving away or taking a hit resets it.
- Fresh herbs grow every time a hex is entered, at new spots. Nothing grows back during a fight.
- Arrows at the screen edge only appear for herbs just off screen; far herbs have to be found.
- Gathered herbs are expedition loot: brought home safely, or halved on death.

## Village

- **Herb garden:** plant herbs found on expeditions to grow more of them.
- **Brewing:** turn herbs into potions that make the next expedition easier
  (e.g. more health, faster cooldowns, poison resistance).
- **Class and skill tree:** permanent progression of your character.
- Farming must feel like a reward, never like a chore you have to do before playing.

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

- Do hexes reset after every run, or over time?
- How long should a full expedition take?
- What exactly survives a new season?
- Do herbs grow in real time, per expedition, or per in-game day?
- Perspective: isometric or 3/4 top-down (see Look and feel).
- Art source: asset packs, 3D models rendered to sprites, or commissioned pixel art.
- Online features (leaderboards, maybe co-op) and when they make sense.
