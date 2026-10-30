# Nightwatch

A survivors-like RPG prototype: travel across a hex world, survive waves of enemies in each area, collect XP, pick upgrades and use active skills.
Runs in the browser on phones, tablets and desktop.

**Play it:** https://kili-skiff.github.io/survivor-rpg/

Every pull request also gets its own playable preview, linked in a comment on the PR.

## Controls

|              | Phone                      | Desktop       |
| ------------ | -------------------------- | ------------- |
| Travel (map) | tap a glowing hex          | click, Enter  |
| Move         | drag anywhere (joystick)   | WASD / arrows |
| Dash         | button on the right        | Space or Q    |
| Frost Nova   | button on the right        | E             |
| Pick upgrade | tap a card                 | 1 / 2 / 3     |
| Pause        | II in the top right corner | P / Esc       |

## Getting started

```bash
npm install
npm run dev
```

Then open it in your browser. On a phone in the same Wi-Fi, open the "Network" address that Vite prints.

Where the game is heading: [docs/vision.md](docs/vision.md)

World and story: [docs/lore.md](docs/lore.md)

Architecture and conventions: [CLAUDE.md](CLAUDE.md)

## Credits

World map tiles: [Fantasy Hex Tiles](https://cuddlyclover.itch.io/fantasy-hex-tiles) by The Clover Patch,
licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See [CREDITS.md](CREDITS.md).
