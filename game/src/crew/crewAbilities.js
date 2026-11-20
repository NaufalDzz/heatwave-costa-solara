// Crew abilities on Z / X / C: Lexi's CLEAN BREAK drops a star and sends the search elsewhere,
// Static's BLACKOUT jams junctions and blinds dispatch and Air-1, Birdie's EYES UP paints every
// gunman and cruiser nearby with a marker. Tracks unlocks from story progress and cooldowns.
import * as THREE from 'three';
import { CREW } from './crewRoster.js';
import { CAST } from '../missions/storyCast.js';

function markerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 32); g.rotate(Math.PI / 4);
  g.fillStyle = '#ff2d55'; g.strokeStyle = '#fff'; g.lineWidth = 6;
  g.fillRect(-16, -16, 32, 32); g.strokeRect(-16, -16, 32, 32);
  return new THREE.CanvasTexture(c);
}

export function createCrew(game) {
  const state = Object.fromEntries(CREW.map((m) => [m.id, { cooldown: 0, active: 0 }]));
  const mat = new THREE.SpriteMaterial({ map: markerTexture(), depthTest: false, toneMapped: false });
  const markers = Array.from({ length: 14 }, () => { const s = new THREE.Sprite(mat); s.scale.set(1.1, 1.1, 1); s.visible = false; s.renderOrder = 20; game.scene.add(s); return s; });

  const unlocked = (m) => game.missions.index >= m.unlockJob;

  const effects = {
    lexi() {
      if (!game.wanted.level) { game.hud.notify('Lexi: no heat to shake right now', '#c77dff'); return false; }
      game.wanted.dropStar();
      return true;
    },
    static() { return true; },
    birdie() { return true; },
  };

  /** Everything Birdie can paint: mission gunmen, officers on foot and cruisers. */
  function marked() {
    const p = game.player.position, out = [];
    for (const h of game.missions.enemyBlips()) out.push({ x: h.x, y: h.y + 2.5, z: h.z });
    for (const h of game.police.officers) if (h.alive) out.push({ x: h.x, y: h.y + 2.5, z: h.z });
    for (const v of game.police.units()) out.push({ x: v.x, y: v.y + 2.8, z: v.z });
    return out.filter((o) => Math.hypot(o.x - p.x, o.z - p.z) < 160);
  }

  const crew = {
    members: CREW,
    get blackout() { return state.static.active > 0; },
    get eyesUp() { return state.birdie.active > 0; },
    /** Call a crew member: false if locked, cooling down or nothing to do. */
    use(id) {
      const m = CREW.find((c) => c.id === id), s = state[id];
      if (!unlocked(m)) { game.hud.notify(`${CAST[id].name} joins after job ${m.unlockJob}`, '#888'); return false; }
      if (s.cooldown > 0) { game.hud.notify(`${m.ability} ready in ${Math.ceil(s.cooldown)}s`, '#888'); return false; }
      if (!effects[id]()) return false;
      s.cooldown = m.cooldown; s.active = m.duration;
      game.hud.notify(`${m.ability} · ${CAST[id].name}`, '#ff4fa3');
      if (!game.dialogue.active) game.dialogue.play([[id, m.line, 3.5]]);
      game.audio?.blip();
      return true;
    },
    /** Card data for the HUD. */
    cards() {
      return CREW.map((m) => {
        const s = state[m.id];
        const st = !unlocked(m) ? 'locked' : s.active > 0 ? 'active' : s.cooldown > 0 ? 'cooldown' : 'ready';
        return { ...m, name: CAST[m.id].name, state: st, active: s.active, cooldownLeft: s.cooldown, frac: st === 'active' ? s.active / m.duration : st === 'cooldown' ? 1 - s.cooldown / m.cooldown : 1 };
      });
    },
    /** Staged scenes set a cooldown directly. */
    setTimer(id, cooldown, active = 0) { state[id].cooldown = cooldown; state[id].active = active; },
    reset() { for (const s of Object.values(state)) { s.cooldown = 0; s.active = 0; } },
    update(dt) {
      if (game.mode === 'play' && !game.player.controlsLocked) for (const m of CREW) if (game.input.wasPressed(m.key)) crew.use(m.id);
      for (const s of Object.values(state)) { s.cooldown = Math.max(0, s.cooldown - dt); s.active = Math.max(0, s.active - dt); }
      const list = crew.eyesUp ? marked() : [];
      markers.forEach((s, i) => {
        const o = list[i];
        s.visible = !!o;
        if (o) s.position.set(o.x, o.y + Math.sin(game.time * 4 + i) * 0.15, o.z);
      });
    },
  };
  return crew;
}
