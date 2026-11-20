// The title screen: the HEATWAVE logo over a slow helicopter flyover of the live city at sunset,
// with Continue (showing the latest save), New Game and Controls; arrow keys and ENTER or clicks.
import { summarize } from '../save/saveSystem.js';

export const CONTROLS = [
  ['W A S D', 'Walk / drive'], ['Mouse', 'Look and aim (click to lock)'], ['Left click', 'Shoot / punch'], ['Right click or E', 'Aim down sights'],
  ['Shift', 'Sprint / nitro'], ['Space', 'Jump / handbrake'], ['F', 'Steal, enter or exit a car'], ['1 - 6 or wheel', 'Weapon slots'], ['Z X C', 'Crew: Clean Break, Blackout, Eyes Up'],
  ['R', 'Reload'], ['H', 'Horn'], ['Q', 'Next radio station'], ['T', 'Taxi fares (in a cab)'], ['ENTER', 'Skip dialogue'], ['ESC', 'Pause menu, map and saves'],
];
export const controlsHtml = () => CONTROLS.map(([k, v]) => `<div><kbd>${k}</kbd></div><div>${v}</div>`).join('');

export function createTitleScreen(game, { onNewGame, onContinue }) {
  const root = document.getElementById('title-screen');
  const btnContinue = document.getElementById('btn-continue'), btnNew = document.getElementById('btn-new'), btnControls = document.getElementById('btn-controls');
  const card = document.getElementById('save-card'), controls = document.getElementById('title-controls');
  controls.innerHTML = controlsHtml();
  let latest = null, sel = 0, flyT = 0;
  const buttons = [btnContinue, btnNew, btnControls];

  function refresh() {
    latest = game.save.latest();
    btnContinue.disabled = !latest;
    const s = summarize(latest);
    // Large, high-contrast lines so the save summary still reads on a thumbnail.
    card.innerHTML = s ? `<div class="sc-head"><b>${latest.slot === 'auto' ? 'AUTOSAVE' : 'SLOT ' + latest.slot}</b><span>${s.savedAt}</span></div><div class="sc-title">${s.title}</div><div>${s.money} · Rank ${s.rankLevel} ${s.rank}</div><div class="sc-bar"><i style="width:${s.pct}%"></i></div><div class="sc-foot">${s.pct}% complete · ${s.time}</div>` : '';
    sel = latest ? 0 : 1;
    highlight();
  }
  function highlight() { buttons.forEach((b, i) => b.classList.toggle('sel', i === sel)); }
  function activate(i) {
    if (root.classList.contains('hidden')) return;
    game.audio.unlock();
    if (i === 0 && latest) { hide(); onContinue(latest); }
    else if (i === 1) { hide(); onNewGame(); }
    else if (i === 2) controls.classList.toggle('hidden');
  }
  buttons.forEach((b, i) => b.addEventListener('click', () => activate(i)));
  addEventListener('keydown', (e) => {
    if (root.classList.contains('hidden')) return;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { sel = (sel + 1) % 3; if (sel === 0 && !latest) sel = 1; highlight(); }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { sel = (sel + 2) % 3; if (sel === 0 && !latest) sel = 2; highlight(); }
    if (e.code === 'Enter' || e.code === 'Space') activate(sel);
  });

  function hide() { root.classList.add('hidden'); game.cameraRig.override = null; }

  return {
    show() {
      refresh();
      root.classList.remove('hidden');
      game.hud.show(false);
      game.mode = 'title';
      game.cameraRig.override = (cam, dt) => {
        flyT += dt;
        const a = 2.2 + flyT * 0.03;
        cam.position.set(-60 + Math.cos(a) * 260, 70 + Math.sin(flyT * 0.1) * 12, 230 + Math.sin(a) * 180);
        cam.lookAt(40 + Math.cos(a * 0.7) * 40, 25, -20);
      };
    },
    hide, refresh,
  };
}
