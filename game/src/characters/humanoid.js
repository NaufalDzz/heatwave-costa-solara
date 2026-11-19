// One person in the world (the hero, a pedestrian, an officer or a gang member): position,
// heading, health, the walk/run/aim animation of the limbs, getting hit, dying and the hit test
// that bullets use.
import { createHumanoidModel } from './humanoidModel.js';
import { clamp, damp } from '../core/mathUtils.js';

export class Humanoid {
  constructor(scene, look, kind, x, z, rng) {
    this.model = createHumanoidModel(look, rng);
    this.scene = scene;
    scene.add(this.model.root);
    this.kind = kind;
    this.x = x; this.z = z; this.y = 0; this.vy = 0;
    this.heading = 0; this.speed = 0;
    this.health = 100; this.armor = 0; this.alive = true; this.deadTime = 0;
    this.phase = rng.next() * 6; this.aiming = false; this.punchTime = 0; this.radius = 0.4;
    this.inVehicle = null; this.hitFlash = 0;
    this.sync();
  }

  setArmed(armed) { this.model.gun.visible = armed; }
  get chestY() { return this.y + 1.3; }

  /** Advance limb animation from the current speed (m/s), aim state and death. */
  animate(dt) {
    const m = this.model;
    if (!this.alive) {
      this.deadTime += dt;
      const t = clamp(this.deadTime / 0.45, 0, 1);
      m.body.rotation.x = -Math.PI / 2 * t * t;
      m.body.position.y = 0.15 * t;
      m.legL.rotation.x = m.legR.rotation.x = 0;
      m.armL.rotation.z = -1.2 * t; m.armR.rotation.z = 1.2 * t;
      this.sync();
      return;
    }
    const s = clamp(this.speed / 3, 0, 2.2);
    this.phase += dt * (3 + this.speed * 1.9);
    const swing = Math.sin(this.phase) * 0.75 * Math.min(s, 1.2);
    m.legL.rotation.x = swing; m.legR.rotation.x = -swing;
    m.body.position.y = Math.abs(Math.cos(this.phase)) * 0.06 * Math.min(s, 1);
    m.body.rotation.x = damp(m.body.rotation.x, this.speed > 5 ? 0.18 : 0, 8, dt);
    m.armL.rotation.x = -swing * 0.9;
    m.armL.rotation.z = 0; m.armR.rotation.z = 0;
    if (this.punchTime > 0) {
      this.punchTime -= dt;
      m.armR.rotation.x = -Math.PI / 2 * Math.sin(clamp(this.punchTime / 0.3, 0, 1) * Math.PI);
    } else if (this.aiming) {
      m.armR.rotation.x = damp(m.armR.rotation.x, -Math.PI / 2 + 0.08, 18, dt);
      m.armL.rotation.x = damp(m.armL.rotation.x, -Math.PI / 2 + 0.3, 18, dt);
      m.armL.rotation.z = 0.5;
    } else m.armR.rotation.x = swing * 0.9;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    this.sync();
  }

  sync() {
    const r = this.model.root;
    r.position.set(this.x, this.y, this.z);
    r.rotation.y = this.heading;
    r.visible = !this.inVehicle;
  }

  /** Take damage; armour soaks most of it first. Returns true when this hit killed. */
  damage(amount, fromX, fromZ) {
    if (!this.alive) return false;
    if (this.armor > 0) {
      const soak = Math.min(this.armor, amount * 0.7);
      this.armor -= soak; amount -= soak;
    }
    this.health -= amount;
    this.hitFlash = 0.15;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.deadTime = 0;
      if (fromX !== undefined) this.heading = Math.atan2(fromX - this.x, fromZ - this.z);
      return true;
    }
    return false;
  }

  /** Distance along a ray to this body (three stacked spheres), or Infinity. */
  rayHit(ox, oy, oz, dx, dy, dz, maxDist) {
    if (!this.alive || this.inVehicle) return Infinity;
    let best = Infinity;
    for (const h of [0.5, 1.15, 1.75]) {
      const cx = this.x - ox, cy = this.y + h - oy, cz = this.z - oz;
      const t = cx * dx + cy * dy + cz * dz;
      if (t < 0 || t > maxDist) continue;
      const px = cx - dx * t, py = cy - dy * t, pz = cz - dz * t;
      const r = h > 1.6 ? 0.22 : 0.36;
      if (px * px + py * py + pz * pz < r * r && t < best) best = t;
    }
    return best;
  }

  remove() { this.scene.remove(this.model.root); }
}
