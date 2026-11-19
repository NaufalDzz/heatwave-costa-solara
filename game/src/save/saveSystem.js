// Saving and loading: three manual slots plus an autosave in localStorage, each holding story
// progress, money, respect, stats, upgrades, weapons, collectibles, position and time of day,
// with a one-line summary for the title screen and the pause menu.
import { STORY } from '../missions/storyMissions.js';
import { formatMoney, formatClock } from '../core/mathUtils.js';
import { RANKS } from '../progression/economy.js';

const KEY = 'heatwave.costa-solara.';
export const SLOTS = ['auto', '1', '2', '3'];

function read(slot) {
  try { const raw = localStorage.getItem(KEY + slot); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function summarize(data) {
  if (!data) return null;
  const next = STORY[data.missions.index];
  const pct = Math.round(((data.missions.index / STORY.length) * 0.7 + ((data.activities?.tokens?.length || 0) / 30) * 0.15 + ((data.activities?.stunts?.length || 0) / 5) * 0.15) * 100);
  return {
    title: next ? `Job ${data.missions.index + 1}/${STORY.length}: ${next.title}` : 'Story complete',
    money: formatMoney(data.economy.money), rank: RANKS[Math.min(RANKS.length - 1, data.rankLevel - 1)] || RANKS[0], rankLevel: data.rankLevel,
    time: `Day ${data.day} · ${formatClock(data.hour)}`, pct, savedAt: data.savedAt,
  };
}

export function createSaveSystem(game) {
  const save = {
    read,
    /** The most recent save across all slots, or null. */
    latest() {
      let best = null;
      for (const s of SLOTS) { const d = read(s); if (d && (!best || d.stamp > best.stamp)) best = { ...d, slot: s }; }
      return best;
    },
    collect() {
      const p = game.player.position;
      return {
        version: 1, stamp: game.saveStamp?.() ?? Date.now(), savedAt: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        missions: game.missions.serialize(), economy: game.economy.serialize(), rankLevel: game.economy.rankInfo().level,
        weapons: { owned: { ...game.weapons.inv.owned }, ammo: { ...game.weapons.inv.ammo }, clip: { ...game.weapons.inv.clip } },
        activities: game.activities.serialize(), player: { x: p.x, z: p.z, health: game.player.hero.health, armor: game.player.hero.armor },
        hour: game.sky.hour, day: game.day,
      };
    },
    write(slot) {
      try { localStorage.setItem(KEY + slot, JSON.stringify(save.collect())); return true; } catch { return false; }
    },
    autosave() { if (save.write('auto')) game.hud.notify('Autosaved', '#2fe6d8'); },
    load(slot) {
      const d = typeof slot === 'object' ? slot : read(slot);
      if (!d) return false;
      game.economy.restore(d.economy);
      Object.assign(game.weapons.inv.owned, d.weapons.owned);
      Object.assign(game.weapons.inv.ammo, d.weapons.ammo);
      Object.assign(game.weapons.inv.clip, d.weapons.clip);
      game.activities.restore(d.activities);
      game.missions.restore(d.missions);
      game.wanted.clear();
      game.police.reset();
      game.sky.setHour(d.hour);
      game.day = d.day;
      game.player.teleport(d.player.x, d.player.z);
      game.player.hero.health = d.player.health || 100;
      game.player.hero.armor = d.player.armor || 0;
      game.traffic.clear(); game.peds.clear();
      game.traffic.populate(); game.peds.populate();
      return true;
    },
  };
  return save;
}
