// Progression: money, respect and the eight street ranks with the respect each needs, lifetime
// stats, the garage upgrades owned, and loot and ammo from beaten enemies.
import { formatMoney } from '../core/mathUtils.js';

export const RANKS = ['NOBODY', 'STREET RAT', 'HUSTLER', 'RUNNER', 'ENFORCER', 'LIEUTENANT', 'SHOT CALLER', 'KINGPIN'];
const RANK_XP = [0, 300, 900, 2000, 3800, 6500, 10000, 15000];

export function createEconomy(game) {
  const eco = {
    money: 2500, respect: 0,
    upgrades: { engine: 0, armor: 0, tyres: 0, nitro: false },
    stats: { missionsPassed: 0, kills: 0, copsKilled: 0, carsStolen: 0, distanceKm: 0, stuntJumps: 0, tokens: 0, racesWon: 0, taxiFares: 0, deliveries: 0, timesWasted: 0, timesBusted: 0, maxWanted: 0, shotsFired: 0, explosions: 0, playSeconds: 0, moneyEarned: 0 },
    addMoney(amount, reason) {
      eco.money = Math.max(0, eco.money + amount);
      if (amount > 0) eco.stats.moneyEarned += amount;
      if (reason) game.hud.notify(`${amount >= 0 ? '+' : '-'}${formatMoney(Math.abs(amount))}  ${reason}`, amount >= 0 ? '#7dff8a' : '#ff5252');
    },
    addRespect(n, reason) {
      const before = eco.rankInfo().level;
      eco.respect += n;
      if (reason) game.hud.notify(`+${n} RESPECT  ${reason}`, '#ff4fa3');
      const after = eco.rankInfo();
      if (after.level > before) { game.hud.big('RANK UP', `${after.title} · new gear unlocked at Brass & Barrel`, 'passed', 4); game.audio?.jingle(true); }
    },
    rankInfo() {
      let level = 0;
      while (level < RANK_XP.length - 1 && eco.respect >= RANK_XP[level + 1]) level++;
      const next = RANK_XP[level + 1] ?? RANK_XP[level] + 1;
      return { level: level + 1, title: RANKS[level], next, progress: level === RANK_XP.length - 1 ? 1 : (eco.respect - RANK_XP[level]) / (next - RANK_XP[level]) };
    },
    serialize() { return { money: eco.money, respect: eco.respect, upgrades: { ...eco.upgrades }, stats: { ...eco.stats } }; },
    restore(d) { eco.money = d.money; eco.respect = d.respect; Object.assign(eco.upgrades, d.upgrades); Object.assign(eco.stats, d.stats); },
  };
  game.events.on('kill', (e) => {
    if (!e.byPlayer || e.victim.kind === 'player') return;
    const w = game.weapons, cur = w.current();
    if (e.victim.kind === 'goon') { eco.addMoney(60 + Math.floor(game.rng.next() * 140), 'Loot'); eco.addRespect(12); }
    if ((e.victim.kind === 'goon' || e.victim.kind === 'cop' || e.victim.kind === 'swat') && cur.clip) w.inv.ammo[cur.id] += Math.ceil(cur.clip / 2);
  });
  return eco;
}
