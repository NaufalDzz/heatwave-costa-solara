// Crew ability cards: portrait with its key, ability name, who and what they are, and a READY /
// ACTIVE / cooldown timer with a bar, or LOCKED until the job that brings them in.
import { drawPortrait } from '../missions/storyCast.js';
import { CREW } from '../crew/crewRoster.js';

export function createCrewCards(game, root, set) {
  const cards = CREW.map((m) => {
    const d = document.createElement('div');
    d.className = 'crew-card';
    d.innerHTML = `<div class="cc-face"><canvas width="96" height="96"></canvas><kbd>${m.label}</kbd></div><div class="cc-body"><b>${m.ability}</b><span class="cc-who"></span><div class="bar"><i></i></div></div><em class="cc-state"></em>`;
    drawPortrait(d.querySelector('canvas').getContext('2d'), m.id, 96);
    root.appendChild(d);
    return { d, who: d.querySelector('.cc-who'), fill: d.querySelector('.bar i'), state: d.querySelector('.cc-state') };
  });
  return {
    update() {
      game.crew.cards().forEach((c, i) => {
        const el = cards[i];
        set('ccCls' + i, el.d, `crew-card ${c.state}`, 'className');
        set('ccWho' + i, el.who, c.state === 'locked' ? `${c.role} · joins after job ${c.unlockJob}` : `${c.name.replace(/".*" /, '')} · ${c.role}`);
        set('ccFill' + i, el.fill.style, `${Math.round(c.frac * 100)}%`, 'width');
        const label = c.state === 'locked' ? 'LOCKED' : c.state === 'ready' ? 'READY' : c.state === 'active' ? `${Math.ceil(c.active)}s ON` : `${Math.ceil(c.cooldownLeft)}s`;
        set('ccState' + i, el.state, label);
      });
    },
  };
}
