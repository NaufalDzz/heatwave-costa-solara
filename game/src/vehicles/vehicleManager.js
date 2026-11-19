// Every vehicle in the world: spawning and despawning, driving each one with its controller
// (player, traffic, police, mission AI), car-to-car crashes, running people over, damage states
// (smoke, fire, explosion, burnt wreck), wheel and siren animation, head/tail light glows, the
// player's headlight beams, and bullet hit tests against car bodies.
import * as THREE from 'three';
import { VEHICLE_TYPES, buildVehicleMesh, burntMaterial } from './vehicleModels.js';
import { stepVehicle } from './vehiclePhysics.js';
import { createGlowPoints } from '../fx/glowSprites.js';
import { heightAt } from '../world/cityLayout.js';
import { damp } from '../core/mathUtils.js';

const MAX_LIGHTS = 480;
const IDLE = { throttle: 0, steer: 0, handbrake: false };
let nextId = 1;

export function createVehicleManager(game) {
  const { scene } = game;
  const list = [];
  const zero = new THREE.Vector3();
  const glow = createGlowPoints(new Array(MAX_LIGHTS).fill(zero), new Array(MAX_LIGHTS).fill(new THREE.Color('#000')), new Array(MAX_LIGHTS).fill(0));
  glow.material.uniforms.intensity.value = 1;
  scene.add(glow);
  const gPos = glow.geometry.attributes.position, gCol = glow.geometry.attributes.color, gSize = glow.geometry.attributes.size;
  const headColor = new THREE.Color('#fff2c8'), tailColor = new THREE.Color('#ff2020'), red = new THREE.Color('#ff2020'), blue = new THREE.Color('#2a6bff');
  const tmp = new THREE.Vector3();

  // Real headlight beams for the car the player drives.
  const beams = [0, 1].map(() => {
    const s = new THREE.SpotLight('#fff1d0', 0, 60, 0.5, 0.5, 1.2);
    scene.add(s, s.target);
    return s;
  });

  const mgr = {
    list,
    spawn(type, x, z, heading = 0, opts = {}) {
      const spec = VEHICLE_TYPES[type];
      const color = opts.color || spec.colors[Math.floor(game.rng.next() * spec.colors.length)];
      const parts = buildVehicleMesh(type, color);
      scene.add(parts.root);
      const v = {
        id: nextId++, type, spec, parts, color, x, z, y: heightAt(x, z), vy: 0, heading, vx: 0, vz: 0, angVel: 0, speed: 0, slip: 0,
        pitch: 0, roll: 0, airborne: false, airTime: 0, landed: 0, condition: 100, burnTimer: 0, exploded: false, sinking: false,
        driver: opts.driver ?? (opts.parked ? null : 'npc'), controller: null, siren: false, horn: 0, wheelSpin: 0, steerVis: 0,
        input: IDLE, upgrades: opts.upgrades || null, tag: opts.tag || null, age: 0, lightsOn: false, persistent: !!opts.persistent,
      };
      v.y = Math.max(0, v.y);
      list.push(v);
      mgr.sync(v);
      return v;
    },
    remove(v) {
      const i = list.indexOf(v);
      if (i >= 0) list.splice(i, 1);
      scene.remove(v.parts.root);
      v.removed = true;
    },
    /** The nearest drivable vehicle to (x, z) within maxDist, or null. */
    nearest(x, z, maxDist, filter = () => true) {
      let best = null, bd = maxDist;
      for (const v of list) {
        if (v.exploded || !filter(v)) continue;
        const d = Math.hypot(v.x - x, v.z - z) - v.spec.len * 0.3;
        if (d < bd) { bd = d; best = v; }
      }
      return best;
    },
    /** Distance along a ray to a car body (oriented box), or Infinity. */
    rayHit(v, ox, oy, oz, dx, dy, dz, maxDist) {
      const c = Math.cos(-v.heading), s = Math.sin(-v.heading);
      const lx = ox - v.x, lz = oz - v.z;
      const o = [lx * c + lz * s, oy - v.y, -lx * s + lz * c];
      const d = [dx * c + dz * s, dy, -dx * s + dz * c];
      const lo = [-v.spec.wid / 2, 0.2, -v.spec.len / 2], hi = [v.spec.wid / 2, 1.2 + v.spec.hb + v.spec.hc, v.spec.len / 2];
      let t0 = 0, t1 = maxDist;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo[k] || o[k] > hi[k]) return Infinity; continue; }
        let a = (lo[k] - o[k]) / d[k], b = (hi[k] - o[k]) / d[k];
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) return Infinity;
      }
      return t0;
    },
    damage(v, amount, byPlayer) {
      if (v.exploded) return;
      v.condition -= amount / (v.spec.armor || 1);
      if (byPlayer) v.lastHitByPlayer = game.time;
    },
    explode(v) {
      if (v.exploded) return;
      v.exploded = true; v.condition = 0;
      v.parts.shell.material = burntMaterial;
      for (const s of v.parts.sirens) s.visible = false;
      game.fx.explosion(v.x, v.y, v.z, 1.5);
      game.audio?.explosion(v.x, v.z);
      v.vy = 6; v.airborne = true;
      for (const h of game.humanoids()) {
        const d = Math.hypot(h.x - v.x, h.z - v.z);
        if (d < 9 && h.alive) {
          const killed = h.damage(h.inVehicle === v ? 999 : (9 - d) * 22, v.x, v.z);
          if (killed && h !== game.player.hero && game.time - (v.lastHitByPlayer ?? -99) < 10) game.events.emit('kill', { victim: h, byPlayer: true, x: h.x, z: h.z });
        }
      }
      for (const o of list) {
        if (o === v || o.exploded) continue;
        const d = Math.hypot(o.x - v.x, o.z - v.z);
        if (d < 10) { o.condition -= (10 - d) * 6; o.vx += (o.x - v.x) / d * 6; o.vz += (o.z - v.z) / d * 6; o.lastHitByPlayer = v.lastHitByPlayer; }
      }
      game.events.emit('vehicleExploded', { vehicle: v, byPlayer: game.time - (v.lastHitByPlayer ?? -99) < 10 });
    },
    sync(v) {
      const r = v.parts.root;
      r.position.set(v.x, v.y, v.z);
      r.rotation.set(0, v.heading, 0);
      v.parts.body.rotation.set(v.pitch, 0, v.roll);
      for (const w of v.parts.wheels) {
        w.wheel.rotation.x = v.wheelSpin;
        if (w.front) w.pivot.rotation.y = v.steerVis;
      }
    },
    update(dt) {
      const nf = game.sky.nightFactor;
      const playerCar = game.player.vehicle;
      for (const v of list) {
        v.age += dt;
        let input = IDLE;
        if (v.exploded) input = IDLE;
        else if (v === playerCar) input = game.player.driveInput;
        else if (v.controller) input = v.controller(v, dt) || IDLE;
        v.input = input;
        const impact = stepVehicle(v, input, dt, game.collision);
        if (impact > 7) {
          game.fx.impact(v.x + Math.sin(v.heading) * v.spec.len * 0.5, v.y + 0.8, v.z + Math.cos(v.heading) * v.spec.len * 0.5, 'metal');
          if (v === playerCar) { game.fx.shake = Math.min(1, game.fx.shake + impact * 0.03); game.audio?.crash(impact); }
        }
        if (v.landed > 4) {
          game.particles.emit('dust', v.x, v.y + 0.3, v.z, 8, { jitter: 2 });
          if (v === playerCar) game.events.emit('landed', { vehicle: v, airTime: v.airTime });
        }
        v.wheelSpin += (v.speed / 0.38) * dt;
        v.steerVis = damp(v.steerVis, (input.steer || 0) * 0.45, 12, dt);
        // Tyre smoke and skid marks when sliding.
        if (!v.airborne && !v.sinking && (v.slip > 4.5 || (input.handbrake && Math.abs(v.speed) > 8))) {
          const bx = v.x - Math.sin(v.heading) * v.spec.len * 0.35, bz = v.z - Math.cos(v.heading) * v.spec.len * 0.35;
          const sx = Math.cos(v.heading) * v.spec.wid * 0.42, sz = -Math.sin(v.heading) * v.spec.wid * 0.42;
          game.fx.skid(bx + sx, bz + sz, v.heading); game.fx.skid(bx - sx, bz - sz, v.heading);
          if (game.rng.next() < 0.5) game.particles.emit('tire', bx, 0.3, bz, 1, { jitter: 1 });
        }
        // Damage states.
        if (!v.exploded) {
          const hx = v.x + Math.sin(v.heading) * v.spec.len * 0.38, hz = v.z + Math.cos(v.heading) * v.spec.len * 0.38;
          if (v.condition < 45 && game.rng.next() < dt * (v.condition < 25 ? 14 : 6)) game.particles.emit(v.condition < 25 ? 'blacksmoke' : 'smoke', hx, v.y + 1.2, hz, 1, { scale: 0.6 });
          if (v.condition <= 0) {
            v.burnTimer += dt;
            if (game.rng.next() < dt * 30) game.particles.emit('flame', hx, v.y + 1.1, hz, 1, { jitter: 0.8 });
            if (v.burnTimer > 3.5) mgr.explode(v);
          }
        } else if (game.rng.next() < dt * 10 && v.age < 9999) {
          game.particles.emit('flame', v.x, v.y + 1, v.z, 1, { jitter: 1.6 });
          if (game.rng.next() < 0.4) game.particles.emit('blacksmoke', v.x, v.y + 2, v.z, 1, { jitter: 1 });
        }
        for (const [k, s] of v.parts.sirens.entries()) s.visible = v.siren ? Math.sin(game.time * 14 + k * Math.PI) > -0.2 : true;
        mgr.sync(v);
      }
      collideVehicles();
      runOver();
      updateLights(nf, playerCar);
    },
  };

  function collideVehicles() {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      const reach = (a.spec.len + b.spec.len) * 0.5;
      if (dx * dx + dz * dz > reach * reach || Math.abs(a.y - b.y) > 2.5) continue;
      for (const oa of [-0.3, 0.3]) for (const ob of [-0.3, 0.3]) {
        const ax = a.x + Math.sin(a.heading) * a.spec.len * oa, az = a.z + Math.cos(a.heading) * a.spec.len * oa;
        const bx = b.x + Math.sin(b.heading) * b.spec.len * ob, bz = b.z + Math.cos(b.heading) * b.spec.len * ob;
        const ex = bx - ax, ez = bz - az, d = Math.hypot(ex, ez) || 0.01;
        const rad = (a.spec.wid + b.spec.wid) * 0.5;
        if (d >= rad) continue;
        const nx = ex / d, nz = ez / d, push = (rad - d) / 2;
        const ma = a.spec.mass * (a.exploded ? 3 : 1), mb = b.spec.mass * (b.exploded ? 3 : 1);
        a.x -= nx * push * (mb / (ma + mb)) * 2; a.z -= nz * push * (mb / (ma + mb)) * 2;
        b.x += nx * push * (ma / (ma + mb)) * 2; b.z += nz * push * (ma / (ma + mb)) * 2;
        const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rel < 0) {
          const j2 = (-1.3 * rel) / (1 / ma + 1 / mb);
          a.vx -= (j2 / ma) * nx; a.vz -= (j2 / ma) * nz;
          b.vx += (j2 / mb) * nx; b.vz += (j2 / mb) * nz;
          const hit = -rel;
          if (hit > 5) {
            mgr.damage(a, hit * 1.4 * (mb / ma), b === game.player.vehicle);
            mgr.damage(b, hit * 1.4 * (ma / mb), a === game.player.vehicle);
            game.fx.impact((ax + bx) / 2, Math.max(a.y, b.y) + 0.8, (az + bz) / 2, 'metal');
            game.events.emit('carCrash', { a, b, speed: hit });
            if (a === game.player.vehicle || b === game.player.vehicle) game.audio?.crash(hit);
          }
        }
      }
    }
  }

  function runOver() {
    for (const v of list) {
      const sp = Math.hypot(v.vx, v.vz);
      if (sp < 3.5 || v.exploded) continue;
      const c = Math.cos(-v.heading), s = Math.sin(-v.heading);
      for (const h of game.humanoids()) {
        if (!h.alive || h.inVehicle || Math.abs(h.y - v.y) > 2) continue;
        const lx = h.x - v.x, lz = h.z - v.z;
        const px = lx * c + lz * s, pz = -lx * s + lz * c;
        if (Math.abs(px) > v.spec.wid / 2 + 0.35 || Math.abs(pz) > v.spec.len / 2 + 0.35) continue;
        const killed = h.damage(sp * 6, v.x, v.z);
        h.x += (v.vx / sp) * 2.5; h.z += (v.vz / sp) * 2.5;
        game.particles.emit('blood', h.x, 1, h.z, 6);
        game.events.emit('hitPerson', { victim: h, vehicle: v, byPlayer: v === game.player.vehicle, killed });
        if (killed) game.events.emit('kill', { victim: h, byPlayer: v === game.player.vehicle, x: h.x, z: h.z });
      }
    }
  }

  function updateLights(nf, playerCar) {
    let n = 0;
    const cam = game.camera.position;
    const lit = nf > 0.3;
    for (const v of list) {
      if (v.exploded || v.sinking || n > MAX_LIGHTS - 6) continue;
      if (Math.abs(v.x - cam.x) > 260 || Math.abs(v.z - cam.z) > 260) continue;
      v.parts.root.updateMatrixWorld();
      const braking = v.input.throttle < 0 && v.speed > 1;
      const occupied = v.driver !== null || v === playerCar;
      for (const p of v.parts.headLocal) {
        tmp.copy(p).applyMatrix4(v.parts.root.matrixWorld);
        gPos.setXYZ(n, tmp.x, tmp.y, tmp.z); gCol.setXYZ(n, headColor.r, headColor.g, headColor.b);
        gSize.setX(n, occupied && lit ? 4.5 : 0); n++;
      }
      for (const p of v.parts.tailLocal) {
        tmp.copy(p).applyMatrix4(v.parts.root.matrixWorld);
        gPos.setXYZ(n, tmp.x, tmp.y, tmp.z); gCol.setXYZ(n, tailColor.r, tailColor.g, tailColor.b);
        gSize.setX(n, occupied ? (braking ? 3.2 : lit ? 2 : 0) : 0); n++;
      }
      if (v.siren) {
        for (const [k, s] of v.parts.sirens.entries()) {
          s.getWorldPosition(tmp);
          const c = k ? blue : red;
          gPos.setXYZ(n, tmp.x, tmp.y + 0.1, tmp.z); gCol.setXYZ(n, c.r, c.g, c.b); gSize.setX(n, s.visible ? 16 : 7); n++;
        }
      }
    }
    for (let i = n; i < MAX_LIGHTS; i++) gSize.setX(i, 0);
    gPos.needsUpdate = gCol.needsUpdate = gSize.needsUpdate = true;
    glow.geometry.setDrawRange(0, n);
    const target = playerCar && !playerCar.exploded ? playerCar : null;
    beams.forEach((b, k) => {
      b.intensity = target && lit ? 400 : 0;
      if (!target) return;
      tmp.copy(target.parts.headLocal[k]).applyMatrix4(target.parts.root.matrixWorld);
      b.position.copy(tmp);
      b.target.position.set(tmp.x + Math.sin(target.heading) * 20, 0, tmp.z + Math.cos(target.heading) * 20);
    });
  }

  return mgr;
}
