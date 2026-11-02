import type * as Phaser from 'phaser';
import { HERBS } from '../config/herbs';
import { EMBER_KEY } from '../config/merchant';
import { FIRE_QUEST, TOWER_QUEST, VILLAGERS, type VillagerId } from '../config/quests';
import type { PotionId } from '../config/types';
import { toggleAllDeeds } from '../dev/devLogic'; // DEV:
import { isDevMode } from '../dev/devMode'; // DEV:
import { lootCount, type Loot } from '../logic/expedition';
import { buyRank } from '../logic/hearth';
import { buyFeather, buyLantern, buyRecipe, embersText, sellHerb } from '../logic/merchant';
import { brew } from '../logic/potions';
import { acceptTowerQuest } from '../logic/quests';
import type { SaveData } from '../logic/save';
import { ArmoryPanel } from './ArmoryPanel';
import { CauldronPanel, type PanelFrame } from './CauldronPanel';
import { DeedsPanel } from './DeedsPanel';
import { DialoguePanel, type DialoguePanelOptions } from './DialoguePanel';
import { HearthPanel } from './HearthPanel';
import { MerchantPanel } from './MerchantPanel';

// The village panels, opened the same way from the menu village and the walkable one.

export type VillagePanelId = 'cauldron' | 'merchant' | 'deeds' | 'armory' | 'hearth' | VillagerId;

export interface VillagePanel {
  destroy(): void;
}

/** What a panel needs from the scene that shows it */
export interface VillagePanelHost {
  readonly save: SaveData;
  /** Saves a changed save and redraws */
  commit(save: SaveData): void;
  close(): void;
}

/** Why the player just arrived in the village, to show what came home with them. */
export interface Arrival {
  reason: 'returned' | 'fallen';
  /** Loot added to the stash */
  kept: Loot;
  /** Loot lost on the way (only when fallen) */
  lost: Loot;
}

export function describeArrival(a: Arrival): string {
  const list = (loot: Loot) =>
    Object.entries(loot)
      .map(([id, n]) =>
        id === EMBER_KEY ? embersText(n) : `${n} ${HERBS[id as keyof typeof HERBS]?.name ?? id}`,
      )
      .join(', ');
  if (a.reason === 'fallen') {
    const kept = lootCount(a.kept) > 0 ? ` You saved ${list(a.kept)}.` : '';
    const lost = lootCount(a.lost) > 0 ? ` Lost: ${list(a.lost)}.` : '';
    return `You wake up in the village.${kept}${lost}`;
  }
  return lootCount(a.kept) > 0 ? `Home safe. You brought back ${list(a.kept)}.` : 'Home safe.';
}

/** A villager has something new to say. */
export function hasNews(save: SaveData, id: VillagerId): boolean {
  return id === 'elder' && save.quests.tower === 'offered';
}

/** What a villager says right now, and the buttons below it. */
function dialogue(host: VillagePanelHost, id: VillagerId): DialoguePanelOptions {
  const v = VILLAGERS[id];
  const q = host.save.quests;
  const close = { label: 'Close', onClick: () => host.close() };
  const base = { name: v.name, role: v.role, color: v.color };
  if (q.tower === 'offered') {
    return {
      ...base,
      text: TOWER_QUEST.elder.offered,
      buttons: [
        { label: 'Not now', onClick: () => host.close() },
        {
          label: 'I will find it',
          primary: true,
          onClick: () => host.commit({ ...host.save, quests: acceptTowerQuest(host.save.quests) }),
        },
      ],
    };
  }
  // Before the tower quest comes up, the elder talks about the watchfires.
  if (q.tower === 'none' && q.fire !== 'offered') {
    return { ...base, text: FIRE_QUEST.elder[q.fire === 'done' ? 'done' : 'active'], buttons: [close] };
  }
  return { ...base, text: TOWER_QUEST.elder[q.tower], buttons: [close] };
}

/** Opens a village panel on top of the scene. Rebuild it whenever the save or the screen changes. */
export function openVillagePanel(
  scene: Phaser.Scene,
  frame: PanelFrame,
  id: VillagePanelId,
  host: VillagePanelHost,
): VillagePanel {
  const save = host.save;
  const onClose = () => host.close();
  switch (id) {
    case 'cauldron':
      return new CauldronPanel(scene, frame, {
        stash: save.stash,
        known: save.recipes,
        onBrew: (potion: PotionId) => {
          if (!host.save.recipes.includes(potion)) return;
          const stash = brew(host.save.stash, potion);
          if (stash) host.commit({ ...host.save, stash });
        },
        onClose,
      });
    case 'merchant':
      return new MerchantPanel(scene, frame, {
        stash: save.stash,
        lanternLevel: save.lanternLevel,
        recipes: save.recipes,
        feathers: save.feathers,
        onBuyFeather: () => {
          const r = buyFeather(host.save.stash, host.save.feathers);
          if (r) host.commit({ ...host.save, stash: r.stash, feathers: r.feathers });
        },
        onBuyLantern: () => {
          const r = buyLantern(host.save.stash, host.save.lanternLevel);
          if (r) host.commit({ ...host.save, stash: r.stash, lanternLevel: r.level });
        },
        onBuyRecipe: (recipe) => {
          const r = buyRecipe(host.save.stash, host.save.recipes, recipe);
          if (r) host.commit({ ...host.save, stash: r.stash, recipes: r.recipes });
        },
        onSellHerb: (herb) => {
          const stash = sellHerb(host.save.stash, herb);
          if (stash) host.commit({ ...host.save, stash });
        },
        onClose,
      });
    case 'deeds':
      return new DeedsPanel(scene, frame, {
        earned: save.deeds,
        onClose,
        // DEV: all deeds on or off.
        onDevToggle: isDevMode()
          ? () => host.commit({ ...host.save, deeds: toggleAllDeeds(host.save.deeds) })
          : undefined,
      });
    case 'hearth':
      return new HearthPanel(scene, frame, {
        stash: save.stash,
        ranks: save.hearth,
        deeds: save.deeds,
        onBuy: (upgrade) => {
          const r = buyRank(host.save.stash, host.save.hearth, host.save.deeds, upgrade);
          if (r) host.commit({ ...host.save, stash: r.stash, hearth: r.ranks });
        },
        onClose,
      });
    case 'armory':
      return new ArmoryPanel(scene, frame, {
        chosen: save.mainWeapon,
        onChoose: (weapon) => host.commit({ ...host.save, mainWeapon: weapon }),
        onClose,
      });
    default:
      return new DialoguePanel(scene, frame, dialogue(host, id));
  }
}
