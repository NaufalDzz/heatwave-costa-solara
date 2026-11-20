// Pedestrians: a crowd kept around the player walking the sidewalk loop of each block (and the
// boardwalk), idling and chatting; they scream and run from gunfire, explosions, crashes and
// the player's gun, get dragged out of stolen cars, and can be hurt or killed.
import { Humanoid } from '../characters/humanoid.js';
import { randomLook } from '../characters/humanoidModel.js';
import { heightAt, COAST } from '../world/cityLayout.js';
import { angleDiff } from '../core/mathUtils.js';

const TARGET = 60, SPAWN_MIN = 22, SPAWN_MAX = 120, DESPAWN = 150;

export function createPedestrians(game) {
  const list = [];

  /** A point on the walking loop of a block at perimeter parameter s (metres). */
  function loopPoint(b, s) {
    const x0 = b.bx0 + 1.8, x1 = b.bx1 - 1.8, z0 = b.bz0 + 1.8, z1 = b.bz1 - 1.8;
    const w = x1 - x0, d = z1 - z0, per = 2 * (w + d);
    s = ((s % per) + per) % per;
    if (s < w) return { x: x0 + s, z: z0, per };
    if (s < w + d) return { x: x1, z: z0 + s - w, per };
    if (s < 2 * w + d) return { x: x1 - (s - w - d), z: z1, per };
    return { x: x0, z: z1 - (s - 2 * w - d), per };
  }

  function spawn(minD, maxD) {
    const p = game.player.position;
    for (let tries = 0; tries < 8; tries++) {
      let b = null, s = 0, pt;
      if (game.rng.next() < 0.18 && p.z > 250) {
        const x = p.x + (game.rng.next() - 0.5) * 2 * maxD;
        pt = { x: Math.max(-690, Math.min(COAST - 5, x)), z: 425 + game.rng.next() * 3 };
      } else {
        b = game.layout.blocks[Math.floor(game.rng.next() * game.layout.blocks.length)];
        s = game.rng.next() * 400;
        pt = loopPoint(b, s);
      }
      const d = Math.hypot(pt.x - p.x, pt.z - p.z);
      if (d < minD || d > maxD) continue;
      return add(pt.x, pt.z, b, s);
    }
    return null;
  }

  function add(x, z, block, s, look) {
    const h = new Humanoid(game.scene, look || randomLook(game.rng), 'ped', x, z, game.rng);
    h.y = Math.max(0, heightAt(x, z)) + (block ? 0.18 : 0.45);
    h.ped = { block, s, dir: game.rng.next() < 0.5 ? 1 : -1, speed: 1.2 + game.rng.next() * 0.6, state: game.rng.next() < 0.12 ? 'idle' : 'walk', fear: 0, fromX: 0, fromZ: 0, idleT: 2 + game.rng.next() * 6 };
    list.push(h);
    return h;
  }

  function scare(x, z, radius, seconds) {
    for (const h of list) {
      if (!h.alive) continue;
      if (Math.hypot(h.x - x, h.z - z) < radius) {
        if (h.ped.state !== 'flee' && game.rng.next() < 0.3) game.audio?.scream(h.x, h.z);
        h.ped.state = 'flee'; h.ped.fear = seconds; h.ped.fromX = x; h.ped.fromZ = z;
      }
    }
  }
  game.events.on('gunfire', (e) => scare(e.x, e.z, 45, 10));
  game.events.on('vehicleExploded', (e) => scare(e.vehicle.x, e.vehicle.z, 60, 12));
  game.events.on('kill', (e) => scare(e.x, e.z, 30, 10));
  game.events.on('carCrash', (e) => { if (e.speed > 12) scare(e.a.x, e.a.z, 18, 5); });
  game.events.on('carjack', (e) => {
    const h = add(e.x, e.z, null, 0);
    h.y = heightAt(e.x, e.z);
    h.ped.state = 'flee'; h.ped.fear = 10; h.ped.fromX = e.vehicle.x; h.ped.fromZ = e.vehicle.z;
    h.heading = e.vehicle.heading + Math.PI / 2;
    game.audio?.scream(e.x, e.z);
  });

  return {
    list, add, scare,
    countNear(x, z, r) { let n = 0; for (const h of list) if (h.alive && Math.hypot(h.x - x, h.z - z) < r) n++; return n; },
    populate() { for (let k = 0; k < TARGET; k++) spawn(6, SPAWN_MAX); },
    clear() { for (const h of list) h.remove(); list.length = 0; },
    update(dt) {
      const p = game.player.position;
      // Aiming a gun at people makes them run.
      if (game.player.hero.aiming && game.rng.next() < dt * 2) scare(p.x + Math.sin(game.cameraRig.yaw) * 10, p.z + Math.cos(game.cameraRig.yaw) * 10, 10, 6);
      for (let i = list.length - 1; i >= 0; i--) {
        const h = list[i];
        const d = Math.hypot(h.x - p.x, h.z - p.z);
        if (d > DESPAWN || (!h.alive && h.deadTime > 30)) { h.remove(); list.splice(i, 1); continue; }
        if (!h.alive) { h.animate(dt); continue; }
        const st = h.ped;
        if (st.state === 'flee') {
          st.fear -= dt;
          const ax = h.x - st.fromX, az = h.z - st.fromZ, len = Math.hypot(ax, az) || 1;
          const want = Math.atan2(ax / len, az / len);
          h.heading += angleDiff(h.heading, want) * Math.min(1, dt * 6);
          h.speed = 6.2;
          h.x += Math.sin(h.heading) * h.speed * dt; h.z += Math.cos(h.heading) * h.speed * dt;
          const r = game.collision.resolve(h.x, h.z, 0.4, h.y);
          if (r.hit) h.heading += 0.9;
          h.x = r.x; h.z = r.z;
          h.y = Math.max(0, heightAt(h.x, h.z));
          if (st.fear <= 0) { st.state = 'walk'; if (st.block) { st.s = nearestS(st.block, h.x, h.z); } }
        } else if (st.state === 'idle' || !st.block) {
          h.speed = 0;
          st.idleT -= dt;
          if (st.idleT <= 0 && st.block) st.state = 'walk';
          if (!st.block) { h.x += Math.sin(h.heading) * 1.3 * dt; h.z += Math.cos(h.heading) * 1.3 * dt; h.speed = 1.3; }
        } else {
          st.s += st.dir * st.speed * dt;
          const pt = loopPoint(st.block, st.s);
          // Blend back onto the loop after fleeing.
          const nx = h.x + (pt.x - h.x) * Math.min(1, dt * 4), nz = h.z + (pt.z - h.z) * Math.min(1, dt * 4);
          const mvx = nx - h.x, mvz = nz - h.z;
          if (Math.abs(mvx) + Math.abs(mvz) > 1e-4) h.heading += angleDiff(h.heading, Math.atan2(mvx, mvz)) * Math.min(1, dt * 8);
          h.x = nx; h.z = nz; h.speed = st.speed;
          h.y = 0.18;
          if (game.rng.next() < dt * 0.02) { st.state = 'idle'; st.idleT = 2 + game.rng.next() * 5; }
        }
        h.animate(dt);
      }
      if (list.length < TARGET) spawn(SPAWN_MIN + 20, SPAWN_MAX);
    },
  };

  function nearestS(b, x, z) {
    let best = 0, bd = Infinity;
    for (let s = 0; s < 240; s += 4) { const pt = loopPoint(b, s); const d = (pt.x - x) ** 2 + (pt.z - z) ** 2; if (d < bd) { bd = d; best = s; } }
    return best;
  }
}
