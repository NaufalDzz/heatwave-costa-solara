// Progression: money, respect and the eight street ranks, lifetime stats, vehicle upgrades from
// Wrench Works (engine, armour, nitro, repair, respray) and the stock of Brass & Barrel Arms.
import { WEAPONS } from '../combat/weapons.js';
import { formatMoney } from '../core/mathUtils.js';

export const RANKS = ['NOBODY', 'STREET RAT', 'HUSTLER', 'RUNNER', 'ENFORCER', 'LIEUTENANT', 'SHOT CALLER', 'KINGPIN'];
const RANK_XP = [0, 300, 900, 2000, 3800, 6500, 10000, 15000];

export function createEconomy(game) {
  const eco = {
    money: 2500, respect: 0,
    upgrades: { engine: 0, armor: 0, nitro: false },
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
      return { level: level + 1, title: RANKS[level], progress: level === RANK_XP.length - 1 ? 1 : (eco.respect - RANK_XP[level]) / (next - RANK_XP[level]) };
    },
    /** Items for a shop: { label, price, owned, buy() }. */
    shopItems(kind) {
      const w = game.weapons;
      if (kind === 'gunshop') {
        const rank = eco.rankInfo().level;
        const items = [];
        for (const def of WEAPONS.slice(1)) {
          const needRank = { pistol: 1, smg: 2, shotgun: 3, rifle: 4 }[def.id];
          if (!w.inv.owned[def.id]) items.push({ label: `${def.name}${rank < needRank ? ` (rank ${needRank})` : ''}`, price: def.price, locked: rank < needRank, buy: () => w.give(def.id, def.clip * 4) });
          else items.push({ label: `${def.name} ammo ×${def.clip * 3}`, price: def.ammoPrice, buy: () => w.give(def.id, def.clip * 3) });
        }
        items.push({ label: 'Body armour', price: 800, owned: game.player.hero.armor >= 100, buy: () => { game.player.hero.armor = 100; } });
        return items;
      }
      const v = game.player.vehicle;
      const u = eco.upgrades;
      return [
        { label: 'Repair vehicle', price: 300, owned: !v || v.condition >= 100, buy: () => { if (v) v.condition = 100; } },
        { label: 'Respray (lose the cops)', price: 500, owned: !v, buy: () => { if (v) { game.wanted.clear(); game.hud.notify('Fresh paint. Cops lost your trail.'); } } },
        { label: `Engine tune stage ${u.engine + 1}`, price: 1500 * (u.engine + 1), owned: u.engine >= 3, buy: () => { u.engine++; } },
        { label: `Armour plating stage ${u.armor + 1}`, price: 1200 * (u.armor + 1), owned: u.armor >= 3, buy: () => { u.armor++; } },
        { label: 'Nitro kit (hold SHIFT)', price: 4000, owned: u.nitro, buy: () => { u.nitro = true; } },
      ];
    },
    buy(item) {
      if (item.owned || item.locked) return false;
      if (eco.money < item.price) { game.hud.notify('Not enough cash', '#ff5252'); game.audio?.click(); return false; }
      eco.money -= item.price;
      item.buy();
      game.audio?.cash();
      game.hud.notify(`Bought: ${item.label}`, '#ffcf4a');
      return true;
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
