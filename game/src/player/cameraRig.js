// The third-person camera: mouse-look orbit on foot, an over-the-shoulder zoom when aiming, a
// chase camera behind cars that swings back behind the bonnet when the mouse rests, speed-based
// field of view, building avoidance and explosion shake.
import * as THREE from 'three';
import { clamp, damp, angleDiff } from '../core/mathUtils.js';

export function createCameraRig(game, camera) {
  const rig = {
    yaw: 0, pitch: 0.28, dist: 5.5, idle: 0, sensitivity: 0.0026, override: null,
    focus: new THREE.Vector3(),
    snap() { rig.snapNext = true; },
    update(dt) {
      const p = game.player;
      const m = game.input.takeMouse();
      const s = rig.sensitivity * (game.settings?.sensitivity ?? 1);
      if (m.dx || m.dy) rig.idle = 0; else rig.idle += dt;
      rig.yaw -= m.dx * s;
      rig.pitch = clamp(rig.pitch + m.dy * s * (game.settings?.invertY ? -1 : 1), -0.5, 1.2);
      if (rig.override) return rig.override(camera, dt);
      const v = p.vehicle;
      let tx, ty, tz, dist, height, side = 0;
      if (v) {
        if (rig.idle > 1.2 || Math.abs(v.speed) > 18) rig.yaw += angleDiff(rig.yaw, v.heading + (v.speed < -2 ? Math.PI : 0)) * Math.min(1, dt * 2.2);
        rig.pitch = damp(rig.pitch, 0.2, rig.idle > 1.2 ? 2 : 0, dt);
        tx = v.x; ty = v.y + 1.4 + v.spec.hb * 0.6; tz = v.z;
        dist = v.spec.len * 1.35 + 3.2 + Math.min(Math.abs(v.speed), 50) * 0.05;
        height = 0.6;
      } else {
        const h = p.hero;
        tx = h.x; ty = h.y + 1.65; tz = h.z;
        const aiming = h.aiming;
        dist = aiming ? 2.6 : 4.6;
        side = aiming ? 0.75 : 0.25;
        height = 0.15;
      }
      rig.dist = damp(rig.dist, dist, 6, dt);
      const cosP = Math.cos(rig.pitch), sinP = Math.sin(rig.pitch);
      const bx = -Math.sin(rig.yaw) * cosP, bz = -Math.cos(rig.yaw) * cosP;
      const sx = -Math.cos(rig.yaw) * side, sz = Math.sin(rig.yaw) * side;
      rig.focus.set(tx + sx, ty, tz + sz);
      let d = rig.dist;
      const dirY = sinP;
      const hit = game.collision.raycast(rig.focus.x, rig.focus.y, rig.focus.z, bx, dirY, bz, d + 0.4);
      if (hit < d + 0.4) d = Math.max(0.8, hit - 0.4);
      const wantX = rig.focus.x + bx * d, wantY = Math.max(rig.focus.y + dirY * d + height, 0.4), wantZ = rig.focus.z + bz * d;
      if (rig.snapNext) { camera.position.set(wantX, wantY, wantZ); rig.snapNext = false; }
      const follow = v ? 14 : 18;
      camera.position.set(damp(camera.position.x, wantX, follow, dt), damp(camera.position.y, wantY, follow, dt), damp(camera.position.z, wantZ, follow, dt));
      camera.lookAt(rig.focus.x, rig.focus.y + (v ? 0.2 : 0), rig.focus.z);
      const shake = game.fx.shake;
      if (shake > 0) {
        camera.position.x += (Math.random() - 0.5) * shake * 0.5;
        camera.position.y += (Math.random() - 0.5) * shake * 0.5;
      }
      const fov = 62 + (v ? clamp(Math.abs(v.speed) - 15, 0, 40) * 0.35 : 0) - (p.hero.aiming ? 8 : 0);
      if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 4, dt); camera.updateProjectionMatrix(); }
    },
    /** World-space aim ray from the screen centre. */
    aimRay() {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      return { origin: camera.position.clone(), dir };
    },
  };
  return rig;
}
