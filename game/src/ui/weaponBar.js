// The weapon slot bar: one card per weapon with its key, painted silhouette, short name and
// ammo; the selected one glows gold, weapons not yet bought show LOCKED and the rank they need.
import { WEAPONS } from '../combat/weapons.js';

/** Paint a weapon silhouette (white on transparent) into a canvas. */
export function drawWeaponIcon(id, color = '#f4f4f4') {
  const c = document.createElement('canvas');
  c.width = 116; c.height = 70;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.translate(58, 34);
  if (id === 'fists') {
    g.beginPath(); g.roundRect(-20, -15, 40, 30, 10); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.55)'; for (let k = 0; k < 3; k++) g.fillRect(-10 + k * 9, -15, 3, 13);
    return c;
  }
  const L = { pistol: 46, smg: 66, shotgun: 96, rifle: 100, launcher: 104 }[id];
  if (id === 'launcher') {
    g.fillRect(-L / 2, -9, L, 16); g.fillRect(L / 2 - 6, -12, 10, 22); g.fillRect(-L / 2 - 6, -11, 12, 20);
    g.fillRect(-8, 6, 9, 18); g.fillRect(12, 6, 8, 14); g.fillRect(-2, -18, 18, 8);
    return c;
  }
  g.fillRect(-L / 2, -10, L, 12);
  g.fillRect(-L / 2 + (id === 'pistol' ? 2 : L * 0.25), 0, 11, 22);
  if (id === 'smg') { g.fillRect(4, 0, 8, 20); g.fillRect(-L / 2 - 10, -8, 12, 6); }
  if (id === 'rifle') { g.fillRect(-4, 0, 9, 20); g.fillRect(-L / 2 - 4, -12, 20, 20); g.fillRect(8, -17, 20, 7); }
  if (id === 'shotgun') { g.fillRect(-L / 2 - 4, -12, 28, 20); g.fillRect(6, 4, 32, 7); }
  return c;
}

export function createWeaponBar(game, root, ammoLine, set) {
  const slots = WEAPONS.map((w, i) => {
    const d = document.createElement('div');
    d.className = 'wslot';
    d.innerHTML = `<b>${i + 1}</b><span class="wname">${w.short || w.name.toUpperCase()}</span><span class="wammo"></span>`;
    d.insertBefore(drawWeaponIcon(w.id), d.children[1]);
    root.appendChild(d);
    return { d, ammo: d.querySelector('.wammo'), name: d.querySelector('.wname') };
  });
  return {
    update() {
      const ws = game.weapons, inv = ws.inv, cur = ws.current(), rank = game.economy.rankInfo().level;
      WEAPONS.forEach((w, i) => {
        const owned = inv.owned[w.id];
        set('slot' + i, slots[i].d, `wslot${w === cur ? ' sel' : ''}${owned ? '' : ' locked'}`, 'className');
        const label = !owned ? (rank < (w.rank || 0) ? `RANK ${w.rank}` : 'LOCKED') : w.clip ? String(inv.clip[w.id] + inv.ammo[w.id]) : '∞';
        set('slotA' + i, slots[i].ammo, label);
        set('slotN' + i, slots[i].name, owned ? (w.short || w.name.toUpperCase()) : 'LOCKED');
      });
      const ammo = cur.clip ? `${inv.reload > 0 ? 'RELOADING' : inv.clip[cur.id]} <small>/ ${inv.ammo[cur.id]}</small>` : '<small>MELEE</small>';
      set('ammo', ammoLine, `${cur.name.toUpperCase()} · ${ammo}`, 'innerHTML');
    },
  };
}
