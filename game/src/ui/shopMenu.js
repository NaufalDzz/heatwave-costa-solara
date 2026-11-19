// Shops: walking into Brass & Barrel Arms or driving into Wrench Works opens a buy list (weapons,
// ammo and armour; repairs, respray, engine, armour plating and nitro). Clicking buys; ESC leaves.
import { formatMoney } from '../core/mathUtils.js';

export function createShopMenu(game) {
  const root = document.getElementById('shop-menu'), title = document.getElementById('shop-title'), list = document.getElementById('shop-list');
  let kind = null, cooldown = 0;
  const shops = { gunshop: { poi: game.layout.pois.gunshop, name: 'BRASS & BARREL ARMS', radius: 2.5 }, garage: { poi: game.layout.pois.garage, name: 'WRENCH WORKS GARAGE', radius: 6 } };

  function render() {
    const items = game.economy.shopItems(kind);
    title.textContent = `${shops[kind].name} · ${formatMoney(game.economy.money)}`;
    list.innerHTML = items.map((it, i) => `<div class="shop-item${it.owned || it.locked ? ' owned' : ''}" data-i="${i}"><span>${it.label}</span><b>${it.owned ? 'OWNED' : formatMoney(it.price)}</b></div>`).join('');
    list.querySelectorAll('.shop-item').forEach((el) => el.addEventListener('click', () => { game.economy.buy(items[Number(el.dataset.i)]); render(); }));
  }

  const shop = {
    get open() { return !!kind; },
    openShop(k) { kind = k; root.classList.remove('hidden'); game.mode = 'shop'; game.input.releaseLock(); render(); },
    close() { kind = null; root.classList.add('hidden'); game.mode = 'play'; cooldown = 3; },
    update(dt) {
      cooldown = Math.max(0, cooldown - dt);
      if (kind || cooldown > 0 || game.missions.active?.stages[game.missions.state.stage]?.type === 'deliver') return;
      const p = game.player.position;
      for (const [k, s] of Object.entries(shops)) {
        const d = Math.hypot(p.x - s.poi.x, p.z - s.poi.z);
        if (d < s.radius && game.player.speed < 4 && (k === 'garage' || !game.player.vehicle)) { shop.openShop(k); return; }
      }
    },
  };
  return shop;
}
