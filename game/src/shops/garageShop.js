// What Wrench Works and Brass & Barrel sell and what buying does: repairs, a respray that sheds
// the heat, engine, armour and tyre stages, the nitro kit, guns, ammo and body armour, with rank
// locks, prices, owned states, the car's stat bars, and the upgrades fitted to every car you take.
import { WEAPONS } from '../combat/weapons.js';
import { formatMoney } from '../core/mathUtils.js';

const PAINTS = ['#ff2d55', '#ffbe0b', '#3a86ff', '#06d6a0', '#f5f5f5', '#ff7b00', '#8338ec'];
const STAGES = { engine: [1500, 3000, 4500], armor: [1200, 2400, 3600], tyres: [1800, 3600] };

export function createGarageShop(game) {
  const eco = game.economy;
  const car = () => game.player.vehicle || game.player.lastVehicle || null;

  // Every car the player drives runs on the upgrades bought here.
  game.events.on('enteredVehicle', ({ vehicle }) => { vehicle.upgrades = eco.upgrades; });

  const staged = (id, name, desc, code) => {
    const lvl = eco.upgrades[id], prices = STAGES[id];
    return { id, tab: 'car', code, name: `${name}${lvl < prices.length ? ` · stage ${lvl + 1}` : ''}`, desc, level: lvl, max: prices.length, price: prices[Math.min(lvl, prices.length - 1)], owned: lvl >= prices.length,
      buy: () => { eco.upgrades[id]++; } };
  };

  const shop = {
    /** The rows of one tab: { id, name, desc, price, owned, locked, lockReason, level, max, buy }. */
    items(tab) {
      const v = car(), rank = eco.rankInfo().level;
      if (tab === 'weapons') {
        const rows = WEAPONS.filter((w) => w.price).map((w) => {
          const owned = game.weapons.inv.owned[w.id], locked = !owned && rank < w.rank;
          return owned
            ? { id: w.id + '-ammo', tab, code: 'AMM', name: `${w.name} ammo ×${w.clip * 3}`, desc: `${game.weapons.inv.ammo[w.id]} rounds in reserve`, price: w.ammoPrice, buy: () => game.weapons.give(w.id, w.clip * 3), weapon: w.id }
            : { id: w.id, tab, code: 'GUN', name: w.name, desc: locked ? `Unlocks at respect rank ${w.rank}` : 'Comes with four clips', price: w.price, locked, lockReason: `RANK ${w.rank}`, buy: () => game.weapons.give(w.id, w.clip * 4), weapon: w.id };
        });
        rows.push({ id: 'vest', tab, code: 'VST', name: 'Body armour', desc: 'Kevlar vest, stops a full magazine', price: 800, owned: game.player.hero.armor >= 100, buy: () => { game.player.hero.armor = 100; } });
        return rows;
      }
      return [
        { id: 'repair', tab, code: 'FIX', name: 'Full repair', desc: 'Panels, glass and engine back to 100%', price: 300, owned: !v || v.condition >= 100, buy: () => { v.condition = 100; v.burnTimer = 0; } },
        { id: 'respray', tab, code: 'PNT', name: 'Respray', desc: 'New colour, new plates: loses the heat', price: 500, owned: !v, buy: () => {
          const next = PAINTS[(PAINTS.indexOf(v.color) + 1) % PAINTS.length];
          game.vehicles.repaint(v, next);
          if (game.wanted.level) { game.wanted.clear(); game.hud.notify('Fresh paint. SCPD lost your trail.', '#2fe6d8'); }
        } },
        staged('engine', 'Engine tune', 'Top speed +8% and launch +10% a stage', 'ENG'),
        staged('armor', 'Armour plating', 'Takes 35% less damage a stage', 'ARM'),
        staged('tyres', 'Grip tyres', 'Corners 12% harder a stage', 'TYR'),
        { id: 'nitro', tab, code: 'NOS', name: 'Nitro kit', desc: 'Hold SHIFT for a 25% burst, refills itself', price: 4000, owned: eco.upgrades.nitro, buy: () => { eco.upgrades.nitro = true; } },
      ];
    },
    /** Buy a row by id; returns true when the money changed hands. */
    purchase(tab, id) {
      const item = shop.items(tab).find((i) => i.id === id);
      if (!item || item.owned || item.locked) { game.audio?.click(); return false; }
      if (eco.money < item.price) { game.hud.notify('Not enough cash', '#ff5252'); game.audio?.click(); return false; }
      eco.money -= item.price;
      item.buy();
      const v = car();
      if (v) v.upgrades = eco.upgrades;
      game.audio?.cash();
      game.hud.notify(`Bought: ${item.name}  -${formatMoney(item.price)}`, '#ffcf4a');
      return true;
    },
    /** 0..1 bars for the car on the turntable, base and with upgrades. */
    stats(v = car()) {
      if (!v) return [];
      const s = v.spec, u = eco.upgrades, c = (x) => Math.max(0.05, Math.min(1, x));
      return [
        ['TOP SPEED', c(s.maxSpeed / 80), c((s.maxSpeed * (1 + u.engine * 0.08)) / 80)],
        ['ACCELERATION', c(s.accel / 24), c((s.accel * (1 + u.engine * 0.1)) / 24)],
        ['ARMOUR', c((s.armor || 1) / 3.2), c(((s.armor || 1) * (1 + u.armor * 0.35)) / 3.2)],
        ['HANDLING', c(s.grip / 11.5), c((s.grip * (1 + u.tyres * 0.12)) / 11.5)],
      ];
    },
  };
  return shop;
}
