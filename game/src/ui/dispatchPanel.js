// The SCPD dispatch board: every unit after the player with its callsign, distance and what its
// AI is doing right now (RAMMING, FLANKING, FIRING, SPOTLIGHT, ROADBLOCK, PURSUIT, SEARCHING...).
const ICON = { heli: '✚', car: '▰', foot: '●' };

export function createDispatchPanel(game, root, set) {
  root.innerHTML = `<div class="dp-head"><span><i class="siren"></i>SCPD DISPATCH</span><b id="dp-level"></b></div><div id="dp-units"></div><div id="dp-foot"></div>`;
  const level = root.querySelector('#dp-level'), list = root.querySelector('#dp-units'), foot = root.querySelector('#dp-foot');
  return {
    update() {
      const lvl = game.wanted.level;
      const rows = lvl > 0 ? game.police.dispatchRows() : [];
      set('dpShow', root.style, rows.length ? '' : 'none', 'display');
      if (!rows.length) return;
      const live = rows.filter((r) => r.status !== 'DOWN').length;
      set('dpLevel', level, `${live} UNITS · ${lvl}★`);
      const shown = rows.slice(0, 5);
      set('dpUnits', list, shown.map((r) => `<div class="unit ${r.status === 'DOWN' ? 'down' : ''}"><i>${ICON[r.icon] || ICON.car}</i><b>${r.callsign}</b><span class="dist">${r.dist} m</span><em class="tag ${r.status.toLowerCase().replace(/[^a-z]/g, '')}">${r.status}</em></div>`).join(''), 'innerHTML');
      const more = rows.length - shown.length;
      const block = rows.some((r) => r.status === 'ROADBLOCK') ? 'roadblock ahead' : game.police.helicopter.active ? 'Air-1 overhead' : '';
      set('dpFoot', foot, [more > 0 ? `+${more} more unit${more > 1 ? 's' : ''}` : '', block].filter(Boolean).join(' · '));
    },
  };
}
