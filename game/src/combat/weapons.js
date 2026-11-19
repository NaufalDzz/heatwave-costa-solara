// Weapons and gunfire: the five weapon slots (fists, pistol, SMG, shotgun, carbine) with clip,
// reserve ammo, fire rate, spread and reload; hitscan shots against people, cars and buildings
// with tracers, muzzle flash and impacts; punches; drive-by shooting from a car; and the same
// fire() used by police and gang AI.
import { clamp } from '../core/mathUtils.js';

export const WEAPONS = [
  { id: 'fists', name: 'Fists', slot: 1, melee: true, damage: 18, rate: 0.42, range: 1.7 },
  { id: 'pistol', name: 'P9 Compact', slot: 2, damage: 30, rate: 0.26, clip: 15, spread: 0.012, range: 140, price: 600, ammoPrice: 80 },
  { id: 'smg', name: 'Hornet SMG', slot: 3, damage: 19, rate: 0.085, clip: 30, spread: 0.035, range: 110, auto: true, price: 2500, ammoPrice: 150 },
  { id: 'shotgun', name: 'Breaker 12', slot: 4, damage: 14, pellets: 8, rate: 0.85, clip: 6, spread: 0.075, range: 45, price: 3500, ammoPrice: 120 },
  { id: 'rifle', name: 'Coastline Carbine', slot: 5, damage: 36, rate: 0.12, clip: 30, spread: 0.014, range: 220, auto: true, price: 6000, ammoPrice: 200 },
];
export const weaponById = (id) => WEAPONS.find((w) => w.id === id);

export function createWeapons(game) {
  const inv = {
    owned: { fists: true, pistol: true }, ammo: { pistol: 90, smg: 0, shotgun: 0, rifle: 0 }, clip: { pistol: 15, smg: 0, shotgun: 0, rifle: 0 },
    slot: 1, cooldown: 0, reload: 0,
  };
  const w = {
    inv,
    current() { return WEAPONS[inv.slot] && inv.owned[WEAPONS[inv.slot].id] ? WEAPONS[inv.slot] : WEAPONS[0]; },
    give(id, ammo) {
      inv.owned[id] = true;
      const def = weaponById(id);
      if (def.clip) { inv.ammo[id] = (inv.ammo[id] || 0) + ammo; if (!inv.clip[id]) w.reload(def, true); }
    },
    select(index) { if (WEAPONS[index] && inv.owned[WEAPONS[index].id]) { inv.slot = index; inv.reload = 0; game.events.emit('weaponChanged', WEAPONS[index]); } },
    reload(def, instant = false) {
      if (!def.clip) return;
      const need = def.clip - inv.clip[def.id];
      const take = Math.min(need, inv.ammo[def.id]);
      if (take <= 0) return;
      if (instant) { inv.clip[def.id] += take; inv.ammo[def.id] -= take; return; }
      inv.reload = 1.1; inv.reloading = def.id;
      game.audio?.reload();
    },
    update(dt) {
      inv.cooldown = Math.max(0, inv.cooldown - dt);
      if (inv.reload > 0) {
        inv.reload -= dt;
        if (inv.reload <= 0) { w.reload(weaponById(inv.reloading), true); inv.reload = 0; }
      }
    },
    handlePlayerInput(p) {
      const input = game.input;
      for (let k = 0; k < 5; k++) if (input.wasPressed('Digit' + (k + 1))) w.select(k);
      const wheel = game.input.state.wheel;
      if (wheel && !p.hero.aiming) {
        let s = inv.slot;
        for (let n = 0; n < 5; n++) { s = (s + Math.sign(wheel) + 5) % 5; if (inv.owned[WEAPONS[s].id]) break; }
        w.select(s);
        game.input.state.wheel = 0;
      }
      const def = w.current();
      if (input.wasPressed('KeyR')) w.reload(def);
      const trigger = def.auto ? input.mouseDown(0) : input.mouseClicked(0);
      if (trigger && inv.cooldown <= 0 && inv.reload <= 0) {
        if (def.melee) return punch(p.hero);
        if (inv.clip[def.id] <= 0) { w.reload(def); game.audio?.click(); return; }
        const ray = game.cameraRig.aimRay();
        const h = p.hero;
        const mx = h.x - Math.cos(h.heading) * 0.34 + Math.sin(h.heading) * 0.6, mz = h.z + Math.sin(h.heading) * 0.34 + Math.cos(h.heading) * 0.6;
        // Start the ray past the hero so it never hits him.
        const skip = Math.max(0, (h.x - ray.origin.x) * ray.dir.x + (h.y + 1.4 - ray.origin.y) * ray.dir.y + (h.z - ray.origin.z) * ray.dir.z) + 0.6;
        const origin = ray.origin.clone().addScaledVector(ray.dir, skip);
        w.fire(h, origin, ray.dir, def, { byPlayer: true, muzzle: [mx, h.y + 1.45, mz], spreadScale: h.aiming ? 0.6 : 1.4 });
        inv.clip[def.id]--;
        inv.cooldown = def.rate;
        if (inv.clip[def.id] <= 0) w.reload(def);
      }
    },
    /** Shoot from a car at whatever the camera faces (pistol or SMG). */
    driveBy(p) {
      const def = w.current();
      if (def.melee || def.id === 'rifle' || def.id === 'shotgun' || inv.cooldown > 0 || inv.reload > 0) return;
      if (inv.clip[def.id] <= 0) return w.reload(def);
      const ray = game.cameraRig.aimRay();
      const v = p.vehicle;
      const origin = ray.origin.clone().addScaledVector(ray.dir, game.cameraRig.dist + v.spec.len * 0.6);
      w.fire(p.hero, origin, ray.dir, def, { byPlayer: true, muzzle: [v.x, v.y + 1.4, v.z], spreadScale: 1.6, ignoreVehicle: v });
      inv.clip[def.id]--;
      inv.cooldown = def.rate * 1.3;
    },
    /** Hitscan shot. shooter: Humanoid; origin, dir: THREE.Vector3-likes. */
    fire(shooter, origin, dir, def, opts = {}) {
      const pellets = def.pellets || 1;
      const muzzle = opts.muzzle || [origin.x, origin.y, origin.z];
      game.fx.muzzle(muzzle[0], muzzle[1], muzzle[2]);
      game.audio?.gunshot(def.id, shooter.x, shooter.z);
      game.events.emit('gunfire', { x: shooter.x, z: shooter.z, byPlayer: !!opts.byPlayer, shooter });
      for (let k = 0; k < pellets; k++) {
        const sp = (def.spread || 0.01) * (opts.spreadScale ?? 1);
        let dx = dir.x + (game.rng.next() - 0.5) * 2 * sp, dy = dir.y + (game.rng.next() - 0.5) * 2 * sp, dz = dir.z + (game.rng.next() - 0.5) * 2 * sp;
        const len = Math.hypot(dx, dy, dz); dx /= len; dy /= len; dz /= len;
        const range = def.range;
        let best = game.collision.raycast(origin.x, origin.y, origin.z, dx, dy, dz, range), target = null, kind = 'wall';
        if (dy < -0.001) { const tg = (origin.y - 0.02) / -dy; if (tg < best) { best = tg; kind = 'ground'; } }
        for (const h of game.humanoids()) {
          if (h === shooter || (opts.friendly && h.kind === shooter.kind)) continue;
          const t = h.rayHit(origin.x, origin.y, origin.z, dx, dy, dz, best);
          if (t < best) { best = t; target = h; kind = 'flesh'; }
        }
        for (const v of game.vehicles.list) {
          if (v === opts.ignoreVehicle || v === shooter.inVehicle) continue;
          if (Math.abs(v.x - origin.x) > range || Math.abs(v.z - origin.z) > range) continue;
          const t = game.vehicles.rayHit(v, origin.x, origin.y, origin.z, dx, dy, dz, best);
          if (t < best) { best = t; target = v; kind = 'metal'; }
        }
        const heli = game.police?.helicopter;
        if (heli && opts.byPlayer) {
          const t = heli.rayHit(origin.x, origin.y, origin.z, dx, dy, dz, best);
          if (t < best) { best = t; target = heli; kind = 'heli'; }
        }
        const end = Math.min(best, range);
        const hx = origin.x + dx * end, hy = origin.y + dy * end, hz = origin.z + dz * end;
        game.fx.tracer(muzzle[0], muzzle[1], muzzle[2], hx, hy, hz, opts.byPlayer ? '#fff0b0' : '#ffb080');
        if (best > range) continue;
        game.fx.impact(hx, hy, hz, kind);
        if (kind === 'flesh') {
          const falloff = clamp(1.2 - end / range, 0.4, 1);
          const killed = target.damage(def.damage * falloff * (hy - target.y > 1.6 ? 2 : 1) * (opts.damageScale ?? 1), shooter.x, shooter.z);
          game.events.emit('shot', { victim: target, byPlayer: !!opts.byPlayer, shooter });
          if (killed) game.events.emit('kill', { victim: target, byPlayer: !!opts.byPlayer, x: target.x, z: target.z, shooter });
        } else if (kind === 'heli') {
          target.damage(def.damage);
          game.fx.impact(hx, hy, hz, 'metal');
        } else if (kind === 'metal') {
          game.vehicles.damage(target, def.damage * 0.45, !!opts.byPlayer);
          game.events.emit('vehicleShot', { vehicle: target, byPlayer: !!opts.byPlayer });
        }
      }
    },
  };

  function punch(hero) {
    hero.punchTime = 0.3;
    inv.cooldown = WEAPONS[0].rate;
    game.audio?.whoosh();
    const fx = Math.sin(hero.heading), fz = Math.cos(hero.heading);
    for (const h of game.humanoids()) {
      if (h === hero || !h.alive || h.inVehicle) continue;
      const dx = h.x - hero.x, dz = h.z - hero.z, d = Math.hypot(dx, dz);
      if (d > 1.8 || (dx * fx + dz * fz) / (d || 1) < 0.4) continue;
      const killed = h.damage(WEAPONS[0].damage, hero.x, hero.z);
      h.x += fx * 0.6; h.z += fz * 0.6;
      game.audio?.punch();
      game.particles.emit('blood', h.x, h.y + 1.6, h.z, 3);
      game.events.emit('assault', { victim: h, byPlayer: true });
      if (killed) game.events.emit('kill', { victim: h, byPlayer: true, x: h.x, z: h.z });
      break;
    }
  }
  return w;
}
