// On-foot combat AI shared by police officers, SWAT and gang members: close in to a firing
// range, keep line of sight, strafe, and shoot at the player (or a car) with limited accuracy.
import { weaponById } from './weapons.js';
import { angleDiff } from '../core/mathUtils.js';
import { heightAt } from '../world/cityLayout.js';

export function updateGunman(game, h, dt, opts) {
  if (!h.alive) { h.animate(dt); return; }
  const tgt = game.player.position;
  const dx = tgt.x - h.x, dz = tgt.z - h.z;
  const dist = Math.hypot(dx, dz) || 1;
  const ai = (h.ai ||= { cooldown: 0.5 + game.rng.next(), strafe: game.rng.next() < 0.5 ? 1 : -1, strafeT: 0 });
  const range = opts.range ?? 16;
  const sees = dist < 90 && game.collision.lineOfSight(h.x, h.y + 1.5, h.z, tgt.x, tgt.y + 1.2, tgt.z);
  let mx = 0, mz = 0, speed = 0;
  if (!sees || dist > range) { mx = dx / dist; mz = dz / dist; speed = opts.runSpeed ?? 5.5; }
  else if (dist < range * 0.4 && !opts.arrest) { mx = -dx / dist; mz = -dz / dist; speed = 2.5; }
  else {
    ai.strafeT -= dt;
    if (ai.strafeT <= 0) { ai.strafe *= -1; ai.strafeT = 1 + game.rng.next() * 2; }
    mx = (-dz / dist) * ai.strafe; mz = (dx / dist) * ai.strafe; speed = 1.6;
  }
  if (opts.arrest && dist < 12) { mx = dx / dist; mz = dz / dist; speed = dist > 1.6 ? 4.5 : 0; }
  h.x += mx * speed * dt; h.z += mz * speed * dt;
  h.speed = speed;
  const r = game.collision.resolve(h.x, h.z, 0.4, h.y);
  h.x = r.x; h.z = r.z; h.y = Math.max(0, heightAt(h.x, h.z));
  const face = Math.atan2(dx, dz);
  const moveFace = speed > 3 ? Math.atan2(mx, mz) : face;
  h.heading += angleDiff(h.heading, sees && dist < range * 1.4 ? face : moveFace) * Math.min(1, dt * 10);
  h.aiming = sees && dist < range * 1.5 && !opts.arrest;
  h.setArmed(!opts.arrest);
  ai.cooldown -= dt;
  if (h.aiming && ai.cooldown <= 0 && game.player.hero.alive && Math.abs(angleDiff(h.heading, face)) < 0.4) {
    const def = weaponById(opts.weapon || 'pistol');
    ai.cooldown = (def.rate + 0.35) * (0.8 + game.rng.next() * 0.9) * (opts.fireDelay ?? 1);
    const ox = h.x + Math.sin(h.heading) * 0.6 - Math.cos(h.heading) * 0.3, oz = h.z + Math.cos(h.heading) * 0.6 + Math.sin(h.heading) * 0.3, oy = h.y + 1.45;
    const ty = tgt.y + (game.player.vehicle ? 0.9 : 1.2);
    let ddx = tgt.x - ox, ddy = ty - oy, ddz = tgt.z - oz;
    const len = Math.hypot(ddx, ddy, ddz);
    ddx /= len; ddy /= len; ddz /= len;
    const miss = (opts.inaccuracy ?? 0.06) * (1 + dist / 40) * (game.player.speed > 6 ? 1.6 : 1);
    game.weapons.fire(h, { x: ox, y: oy, z: oz }, { x: ddx, y: ddy, z: ddz }, { ...def, spread: miss }, { muzzle: [ox, oy, oz], friendly: true, damageScale: opts.damageScale ?? 0.45 });
  }
  h.animate(dt);
  return { dist, sees };
}
