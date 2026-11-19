// The hero, Nico Reyes: walking, sprinting with stamina, jumping, swimming, punching and
// shooting on foot; stealing a car (the driver is dragged out and runs) and driving it with
// throttle, steering, handbrake drifts, nitro and horn; getting out; health and armour.
import { Humanoid } from '../characters/humanoid.js';
import { OUTFITS } from '../characters/humanoidModel.js';
import { heightAt, ISLAND } from '../world/cityLayout.js';
import { clamp, damp, angleDiff } from '../core/mathUtils.js';

export function createPlayer(game, x, z) {
  const hero = new Humanoid(game.scene, OUTFITS.hero, 'player', x, z, game.rng);
  hero.radius = 0.38;
  const p = {
    hero, vehicle: null, driveInput: { throttle: 0, steer: 0, handbrake: false, nitro: false },
    stamina: 1, nitro: 1, onGround: true, swimming: false, entering: null, enterTime: 0, controlsLocked: false,
    get x() { return hero.x; }, get z() { return hero.z; },
    get position() { return p.vehicle ? { x: p.vehicle.x, y: p.vehicle.y, z: p.vehicle.z } : { x: hero.x, y: hero.y, z: hero.z }; },
    get heading() { return p.vehicle ? p.vehicle.heading : hero.heading; },
    get speed() { return p.vehicle ? Math.abs(p.vehicle.speed) : hero.speed; },

    teleport(nx, nz, heading = 0) {
      if (p.vehicle) p.exitVehicle(true);
      hero.x = nx; hero.z = nz; hero.y = heightAt(nx, nz); hero.heading = heading; hero.speed = 0;
      game.cameraRig.snap();
    },
    enterVehicle(v) {
      p.vehicle = v;
      hero.inVehicle = v;
      v.driver = 'player';
      v.controller = null;
      hero.aiming = false;
      game.events.emit('enteredVehicle', { vehicle: v });
      game.audio?.startEngine();
    },
    exitVehicle(instant = false) {
      const v = p.vehicle;
      if (!v) return;
      const side = { x: -Math.cos(v.heading) * (v.spec.wid / 2 + 0.8), z: Math.sin(v.heading) * (v.spec.wid / 2 + 0.8) };
      hero.x = v.x + side.x; hero.z = v.z + side.z; hero.y = Math.max(heightAt(hero.x, hero.z), v.y);
      hero.heading = v.heading;
      hero.inVehicle = null;
      v.driver = null;
      p.vehicle = null;
      p.driveInput = { throttle: 0, steer: 0, handbrake: true, nitro: false };
      if (!instant) game.events.emit('exitedVehicle', { vehicle: v });
      game.audio?.stopEngine();
    },
    update(dt) {
      const input = game.input;
      if (!hero.alive) { hero.animate(dt); return; }
      if (p.vehicle) return driving(dt, input);
      onFoot(dt, input);
    },
  };

  function onFoot(dt, input) {
    const locked = p.controlsLocked;
    // Walking to a car door before getting in.
    if (p.entering) {
      const v = p.entering;
      p.enterTime += dt;
      const doorX = v.x - Math.cos(v.heading) * (v.spec.wid / 2 + 0.6), doorZ = v.z + Math.sin(v.heading) * (v.spec.wid / 2 + 0.6);
      hero.x = damp(hero.x, doorX, 10, dt); hero.z = damp(hero.z, doorZ, 10, dt);
      hero.heading = v.heading; hero.speed = 2;
      hero.animate(dt);
      if (p.enterTime > 0.55 || v.exploded) {
        p.entering = null;
        if (!v.exploded) {
          if (v.driver === 'npc') game.events.emit('carjack', { vehicle: v, x: doorX, z: doorZ });
          p.enterVehicle(v);
        }
      }
      return;
    }
    const yaw = game.cameraRig.yaw;
    let mx = 0, mz = 0;
    if (!locked) {
      if (input.isDown('KeyW')) mz += 1;
      if (input.isDown('KeyS')) mz -= 1;
      if (input.isDown('KeyA')) mx += 1;
      if (input.isDown('KeyD')) mx -= 1;
    }
    const aiming = !locked && (input.mouseDown(2) || input.isDown('KeyE')) && game.weapons.current(p).id !== 'fists';
    hero.aiming = aiming;
    const sprint = input.isDown('ShiftLeft') && p.stamina > 0.05 && !aiming;
    const len = Math.hypot(mx, mz);
    let targetSpeed = 0;
    if (len > 0) {
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const dirX = (fx * mz + fz * mx) / len, dirZ = (fz * mz - fx * mx) / len;
      targetSpeed = p.swimming ? 2.4 : aiming ? 2.6 : sprint ? 7.8 : 4.2;
      if (!aiming) hero.heading += angleDiff(hero.heading, Math.atan2(dirX, dirZ)) * Math.min(1, dt * 12);
      hero.vx = damp(hero.vx || 0, dirX * targetSpeed, 10, dt);
      hero.vz = damp(hero.vz || 0, dirZ * targetSpeed, 10, dt);
    } else {
      hero.vx = damp(hero.vx || 0, 0, 12, dt); hero.vz = damp(hero.vz || 0, 0, 12, dt);
    }
    if (aiming) hero.heading += angleDiff(hero.heading, yaw) * Math.min(1, dt * 20);
    p.stamina = clamp(p.stamina + (sprint && len > 0 ? -0.18 : 0.12) * dt, 0, 1);
    hero.x += hero.vx * dt; hero.z += hero.vz * dt;
    hero.speed = Math.hypot(hero.vx, hero.vz);
    // Ground, jumping, water.
    const g = heightAt(hero.x, hero.z);
    p.swimming = g <= -3;
    const floor = p.swimming ? -1.4 : g;
    if (p.onGround && !locked && input.wasPressed('Space') && !p.swimming) { hero.vy = 6.5; p.onGround = false; }
    hero.vy = (hero.vy || 0) - 20 * dt;
    hero.y += hero.vy * dt;
    if (hero.y <= floor) { hero.y = floor; hero.vy = 0; p.onGround = true; }
    else if (hero.y > floor + 0.3) p.onGround = false;
    if (p.onGround && hero.y - floor < 0.3) hero.y = damp(hero.y, floor, 20, dt);
    // Buildings and cars push the hero out.
    const r = game.collision.resolve(hero.x, hero.z, hero.radius, hero.y);
    hero.x = r.x; hero.z = r.z;
    for (const v of game.vehicles.list) {
      const c = Math.cos(-v.heading), s = Math.sin(-v.heading);
      const lx = hero.x - v.x, lz = hero.z - v.z;
      let px = lx * c + lz * s, pz = -lx * s + lz * c;
      const hw = v.spec.wid / 2 + 0.35, hl = v.spec.len / 2 + 0.35;
      if (Math.abs(px) >= hw || Math.abs(pz) >= hl || hero.y > v.y + 1.8) continue;
      if (hw - Math.abs(px) < hl - Math.abs(pz)) px = Math.sign(px || 1) * hw; else pz = Math.sign(pz || 1) * hl;
      hero.x = v.x + px * c - pz * s; hero.z = v.z + px * s + pz * c;
    }
    hero.x = clamp(hero.x, -760, ISLAND.x1 + 120); hero.z = clamp(hero.z, -760, 640);
    // Get into the nearest car.
    if (!locked && input.wasPressed('KeyF')) {
      const v = game.vehicles.nearest(hero.x, hero.z, 3.2, (c) => !c.exploded && c.driver !== 'cop');
      if (v) { p.entering = v; p.enterTime = 0; }
    }
    if (!locked) game.weapons.handlePlayerInput(p, dt);
    hero.animate(dt);
  }

  function driving(dt, input) {
    const v = p.vehicle;
    const locked = p.controlsLocked;
    const di = p.driveInput;
    di.throttle = locked ? 0 : (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0) - (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0);
    di.steer = locked ? 0 : (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0) - (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0);
    di.handbrake = !locked && input.isDown('Space');
    const hasNitro = (v.upgrades?.nitro || game.economy?.upgrades.nitro) && p.nitro > 0.02;
    di.nitro = !locked && input.isDown('ShiftLeft') && hasNitro && di.throttle > 0;
    if (di.nitro) {
      p.nitro = Math.max(0, p.nitro - dt * 0.25);
      // Twin blue exhaust jets blown backwards from both tail pipes.
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading), back = v.spec.len * 0.55;
      for (const side of [-0.45, 0.45]) {
        const ex = v.x - fx * back + fz * side, ez = v.z - fz * back - fx * side;
        game.particles.emit('nitro', ex, v.y + 0.42, ez, 3, { jitter: 0.08, vx: v.vx - fx * 26, vz: v.vz - fz * 22 });
      }
    } else p.nitro = Math.min(1, p.nitro + dt * 0.05);
    if (!locked && input.wasPressed('KeyH')) { v.horn = 0.5; game.audio?.horn(); game.events.emit('horn', { x: v.x, z: v.z }); }
    if (v.sinking && v.y < -1.5) { p.exitVehicle(); return; }
    if (!locked && input.wasPressed('KeyF') && Math.abs(v.speed) < 12) { p.exitVehicle(); return; }
    if (!locked && (input.mouseDown(0)) && game.weapons.driveBy) game.weapons.driveBy(p, dt);
    hero.x = v.x; hero.z = v.z; hero.y = v.y; hero.heading = v.heading;
    hero.sync();
  }

  return p;
}
