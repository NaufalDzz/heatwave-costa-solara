// The wanted level: crimes (assault, murder, carjacking, gunfire, hitting or killing police,
// wrecking cruisers) raise heat and stars; while police can see the player the search zone sits on
// them, out of sight the stars flash and the zone stays where they were last seen; leave the zone
// and stay hidden to lose the cops.
import { clamp } from '../core/mathUtils.js';

const THRESHOLDS = [0, 1, 260, 700, 1400, 2600];

export function createWantedSystem(game) {
  const w = {
    level: 0, heat: 0, searching: false, unseen: 0, outside: 0, searchZone: null, locked: false, lastCrime: -99,
    clear() { w.level = 0; w.heat = 0; w.searching = false; w.searchZone = null; game.events.emit('wantedCleared'); },
    setLevel(n) {
      const before = w.level;
      w.level = clamp(n, 0, 5);
      w.heat = Math.max(w.heat, THRESHOLDS[w.level]);
      if (w.level > before) game.events.emit('wantedRaised', { level: w.level });
      if (w.level > game.economy.stats.maxWanted) game.economy.stats.maxWanted = w.level;
      const p = game.player.position;
      w.searchZone = { x: p.x, z: p.z, r: 80 + w.level * 40 };
      w.unseen = 0; w.searching = false;
    },
    /** Report a crime: min is the least level it brings, heat adds escalation. */
    crime(min, heat) {
      if (game.cheats?.noPolice) return;
      w.lastCrime = game.time;
      w.heat += heat;
      let lvl = Math.max(w.level, min);
      while (lvl < 5 && w.heat >= THRESHOLDS[lvl + 1]) lvl++;
      if (lvl !== w.level) w.setLevel(lvl);
      else if (w.searching) { const p = game.player.position; w.searchZone = { x: p.x, z: p.z, r: w.searchZone.r }; w.unseen = 0; w.searching = false; }
    },
    update(dt) {
      if (w.level === 0) return;
      const p = game.player.position;
      const seen = game.police.playerSeen();
      if (seen) {
        w.unseen = 0; w.searching = false; w.outside = 0;
        w.searchZone = { x: p.x, z: p.z, r: 80 + w.level * 40 };
      } else {
        w.unseen += dt;
        if (w.unseen > 3.5) w.searching = true;
      }
      if (w.searching && !w.locked) {
        const d = Math.hypot(p.x - w.searchZone.x, p.z - w.searchZone.z);
        w.outside = d > w.searchZone.r ? w.outside + dt : Math.max(0, w.outside - dt);
        if (w.outside > 4 + w.level || w.unseen > 40 + w.level * 12) {
          w.clear();
          game.hud.notify('You lost the cops', '#2fe6d8');
          game.economy.addRespect(20 * Math.max(1, w.level));
        }
      }
    },
  };

  const civilian = (h) => h && h.kind !== 'cop' && h.kind !== 'swat';
  game.events.on('kill', (e) => {
    if (!e.byPlayer) return;
    if (!civilian(e.victim)) { game.economy.stats.copsKilled++; w.crime(3, 420); }
    else w.crime(e.victim.kind === 'goon' ? 0 : 1, e.victim.kind === 'goon' ? 0 : 160);
    game.economy.stats.kills++;
  });
  game.events.on('shot', (e) => { if (e.byPlayer && !civilian(e.victim)) w.crime(2, 120); });
  game.events.on('assault', (e) => { if (!civilian(e.victim)) w.crime(2, 100); else w.crime(1, 30); });
  game.events.on('hitPerson', (e) => { if (e.byPlayer && !e.killed) w.crime(1, 40); });
  game.events.on('gunfire', (e) => { if (e.byPlayer) { game.economy.stats.shotsFired++; if (game.police.nearbyWitness(e.x, e.z, 45)) w.crime(1, 6); } });
  game.events.on('carjack', () => { game.economy.stats.carsStolen++; w.crime(game.police.nearbyWitness(game.player.x, game.player.z, 35) ? 1 : 0, 40); });
  game.events.on('vehicleExploded', (e) => {
    if (!e.byPlayer) return;
    game.economy.stats.explosions++;
    w.crime(e.vehicle.type === 'police' ? 3 : 1, e.vehicle.type === 'police' ? 500 : 120);
  });
  game.events.on('vehicleShot', (e) => { if (e.byPlayer && e.vehicle.type === 'police') w.crime(2, 40); });
  game.events.on('carCrash', (e) => {
    const pv = game.player.vehicle;
    if (!pv || e.speed < 8) return;
    const other = e.a === pv ? e.b : e.b === pv ? e.a : null;
    if (other && other.type === 'police') w.crime(1, 60);
  });
  return w;
}
