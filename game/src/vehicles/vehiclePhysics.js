// Arcade car handling shared by the player, traffic and police: engine and brakes, lateral grip
// that lets go under the handbrake for drifts, speed-sensitive steering, ramps and jumps with
// gravity, landing, sinking in water, and bouncing off buildings with damage.
import { clamp, damp } from '../core/mathUtils.js';
import { heightAt } from '../world/cityLayout.js';

const GRAVITY = 22;

/**
 * Advance one vehicle by dt. input: { throttle -1..1, steer -1..1, handbrake bool, nitro bool }.
 * Returns the impact speed of any wall hit this step (0 when none).
 */
export function stepVehicle(v, input, dt, collision) {
  const s = v.spec;
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  const rx = -fz, rz = fx;
  let vF = v.vx * fx + v.vz * fz;
  let vR = v.vx * rx + v.vz * rz;
  const wrecked = v.condition <= 0 || v.sinking;
  const throttle = wrecked ? 0 : input.throttle;
  const top = s.maxSpeed * (v.upgrades?.engine ? 1 + v.upgrades.engine * 0.08 : 1) * (input.nitro ? 1.25 : 1);
  if (!v.airborne) {
    if (throttle > 0) {
      if (vF < -0.5) vF += s.accel * 2.2 * throttle * dt;
      else vF += s.accel * (input.nitro ? 1.7 : 1) * throttle * dt * clamp(1 - vF / top, 0, 1);
    } else if (throttle < 0) {
      if (vF > 0.5) vF -= 30 * -throttle * dt;
      else vF = Math.max(-top * 0.3, vF + s.accel * 0.7 * throttle * dt);
    } else vF = damp(vF, 0, 0.35, dt);
    vF -= vF * Math.abs(vF) * 0.0006 * dt;
    const grip = s.grip * (input.handbrake ? 0.16 : 1) * (Math.abs(vR) > 6 ? 0.7 : 1);
    vR = damp(vR, 0, grip, dt);
    if (input.handbrake) vF = damp(vF, 0, 0.9, dt);
    const speedFactor = clamp(Math.abs(vF) / 5, 0, 1) / (1 + Math.abs(vF) / 40);
    const yawTarget = input.steer * s.steer * speedFactor * Math.sign(vF || 1) * (input.handbrake ? 1.45 : 1);
    v.angVel = damp(v.angVel, yawTarget, 9, dt);
  } else {
    v.angVel *= 1 - dt * 0.3;
  }
  v.heading += v.angVel * dt;
  const nfx = Math.sin(v.heading), nfz = Math.cos(v.heading);
  v.vx = nfx * vF + -nfz * vR;
  v.vz = nfz * vF + nfx * vR;
  v.x += v.vx * dt;
  v.z += v.vz * dt;
  v.speed = vF;
  v.slip = Math.abs(vR);

  // Vertical: follow the ground, leave it off ramp lips, land with a thump.
  const g = heightAt(v.x, v.z);
  v.landed = 0;
  if (v.airborne) {
    v.vy -= GRAVITY * dt;
    v.y += v.vy * dt;
    v.airTime += dt;
    v.pitch = damp(v.pitch, -0.25, 1.2, dt);
    if (v.y <= g) {
      v.landed = -v.vy;
      v.y = g; v.vy = 0; v.airborne = false;
      if (v.landed > 9) v.condition -= (v.landed - 9) * 2;
    }
  } else {
    const vyNew = (g - v.y) / dt;
    if (g < v.y - 0.25 && vyNew < v.vy - GRAVITY * dt) {
      v.airborne = true; v.airTime = 0;
      v.vy = Math.max(v.vy, 0);
    } else {
      v.vy = clamp(vyNew, -30, 30);
      v.y = g;
      v.pitch = damp(v.pitch, -Math.atan2(v.vy, Math.max(Math.abs(vF), 1)) * Math.sign(vF || 1) * 0.8, 10, dt);
    }
  }
  if (g <= -3 && v.y <= -0.5) {
    v.sinking = true;
    v.y = Math.max(v.y - dt * 0.6, -2.4);
    v.vx *= 1 - dt * 2; v.vz *= 1 - dt * 2;
  }
  v.roll = damp(v.roll, clamp(-v.angVel * vF * 0.012, -0.12, 0.12), 6, dt);

  // Buildings: two circles along the body, bounce and take damage.
  let impact = 0;
  if (v.y < 30) {
    const half = s.len * 0.3, rad = s.wid * 0.55;
    for (const off of [half, -half]) {
      const cx = v.x + nfx * off, cz = v.z + nfz * off;
      const r = collision.resolve(cx, cz, rad, v.y);
      if (!r.hit) continue;
      v.x += r.x - cx; v.z += r.z - cz;
      const vn = v.vx * r.nx + v.vz * r.nz;
      if (vn < 0) {
        v.vx -= r.nx * vn * 1.35; v.vz -= r.nz * vn * 1.35;
        v.angVel += (off > 0 ? 1 : -1) * (r.nx * nfz - r.nz * nfx) * vn * 0.04;
        impact = Math.max(impact, -vn);
      }
    }
  }
  if (impact > 7) v.condition -= (impact - 6) * 1.6 / (s.armor || 1);
  return impact;
}
