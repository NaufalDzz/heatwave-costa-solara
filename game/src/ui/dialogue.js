// The dialogue box: queued lines from the cast, each with its painted portrait and name, shown
// for a time that fits its length; ENTER skips ahead. Resolves a promise when the queue empties.
import { CAST, drawPortrait } from '../missions/storyCast.js';

export function createDialogue(game) {
  const box = document.getElementById('dialogue');
  const portrait = document.getElementById('portrait').getContext('2d');
  const nameEl = document.getElementById('dlg-name'), textEl = document.getElementById('dlg-text');
  let queue = [], current = null, timer = 0, done = null;

  function next() {
    current = queue.shift() || null;
    if (!current) {
      box.classList.add('hidden');
      const d = done; done = null;
      if (d) d();
      return;
    }
    box.classList.remove('hidden');
    drawPortrait(portrait, current.who, 120);
    nameEl.textContent = (CAST[current.who]?.name || current.who).toUpperCase();
    textEl.textContent = current.text;
    timer = current.time ?? Math.min(7, 2.2 + current.text.length * 0.045);
    game.audio?.blip();
  }

  return {
    get active() { return !!current; },
    /** Play lines [[who, text], ...]; returns a promise resolved after the last line. */
    play(lines) {
      queue.push(...lines.map(([who, text, time]) => ({ who, text, time })));
      const p = new Promise((resolve) => { const prev = done; done = () => { prev?.(); resolve(); }; });
      if (!current) next();
      return p;
    },
    /** Show one line and hold it (used by staged screenshots). */
    hold(who, text) { queue = []; current = null; this.play([[who, text, 1e9]]); },
    clear() { queue = []; current = null; box.classList.add('hidden'); done = null; },
    update(dt) {
      if (!current) return;
      timer -= dt;
      if (timer <= 0 || game.input.wasPressed('Enter')) next();
    },
  };
}
