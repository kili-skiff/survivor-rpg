// What a villager says when the watchman wakes up in the Nest after a fall (docs/lore.md, "Sample lines").

export interface Greeting {
  who: string;
  line: string;
}

export const GREETINGS: readonly Greeting[] = [
  { who: 'Elder Maren', line: 'The Nest leaves no one in the dark. Rest now.' },
  { who: 'Elder Maren', line: 'Some say it only sleeps. I say the fire burns. That is enough.' },
  { who: 'The blacksmith', line: "You're alive. That's half the victory." },
  { who: 'The blacksmith', line: 'Your lantern has a few more scratches. It still burns, so that is fine.' },
  { who: 'The trader', line: 'Back so soon? The Nest keeps its customers.' },
  { who: 'The trader', line: "You're still glowing a little. Sit by the fire before you spend anything." },
];
