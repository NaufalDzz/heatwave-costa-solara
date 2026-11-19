// Air-1, the SCPD Sparrow helicopter: flies in at four stars, circles the player with spinning
// rotors, sweeps a searchlight (a real spotlight plus a visible beam and ground pool), takes
// sniper shots at five stars, and can be shot down in flames.
import * as THREE from 'three';
import { mergeParts, makeMatrix } from '../world/meshBuilder.js';
import { damp, angleDiff } from '../core/mathUtils.js';

function buildHeli() {
  const root = new THREE.Group();
  const body = new THREE.Mesh(mergeParts([
    { geometry: new THREE.SphereGeometry(1.6, 12, 8).scale(1, 0.85, 1.5), color: '#1b2a4a', matrix: makeMatrix(0, 0, 0) },
    { geometry: new THREE.SphereGeometry(1.25, 12, 8).scale(1, 0.8, 1.1), color: '#9fd3ff', matrix: makeMatrix(0, 0.25, 1.15) },
    { geometry: new THREE.BoxGeometry(3.25, 0.5, 2.2), color: '#f2f2f2', matrix: makeMatrix(0, -0.35, -0.2) },
    { geometry: new THREE.CylinderGeometry(0.35, 0.18, 5.5, 8).rotateX(Math.PI / 2), color: '#1b2a4a', matrix: makeMatrix(0, 0.3, -4.2) },
    { geometry: new THREE.BoxGeometry(0.15, 1.4, 0.9), color: '#f2f2f2', matrix: makeMatrix(0, 0.9, -6.7) },
    { geometry: new THREE.BoxGeometry(0.1, 0.1, 3.4), color: '#333', matrix: makeMatrix(-1.1, -1.55, 0) },
    { geometry: new THREE.BoxGeometry(0.1, 0.1, 3.4), color: '#333', matrix: makeMatrix(1.1, -1.55, 0) },
    { geometry: new THREE.BoxGeometry(0.1, 0.5, 0.1), color: '#333', matrix: makeMatrix(-1.1, -1.3, 0.8) },
    { geometry: new THREE.BoxGeometry(0.1, 0.5, 0.1), color: '#333', matrix: makeMatrix(1.1, -1.3, 0.8) },
    { geometry: new THREE.CylinderGeometry(0.2, 0.2, 0.7, 8), color: '#444', matrix: makeMatrix(0, 1.5, 0) },
  ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3 }));
  body.castShadow = true;
  root.add(body);
  const bladeMat = new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.6 });
  const rotor = new THREE.Group();
  rotor.position.y = 1.85;
  for (const a of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(11, 0.06, 0.35), bladeMat); b.rotation.y = a; rotor.add(b); }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#888', transparent: true, opacity: 0.12, depthWrite: false }));
  rotor.add(disc);
  root.add(rotor);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2, 0.2), bladeMat);
  tail.position.set(0.2, 0.9, -6.7);
  root.add(tail);
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.16), new THREE.MeshBasicMaterial({ color: '#ff2020', toneMapped: false }));
  red.position.set(0, -0.7, -0.5);
  root.add(red);
  return { root, rotor, tail, red };
}

export function createHelicopter(game) {
  const { scene } = game;
  const parts = buildHeli();
  parts.root.visible = false;
  scene.add(parts.root);
  const spot = new THREE.SpotLight('#f4f8ff', 0, 160, 0.2, 0.45, 1);
  spot.castShadow = false;
  scene.add(spot, spot.target);
  const beamMat = new THREE.MeshBasicMaterial({ color: '#dff0ff', transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 7, 1, 20, 1, true), beamMat);
  beam.geometry.translate(0, -0.5, 0);
  beam.visible = false;
  scene.add(beam);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(7.5, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  pool.visible = false;
  scene.add(pool);
  const look = new THREE.Vector3();

  const heli = {
    active: false, x: 0, y: 60, z: 0, heading: 0, health: 600, angle: 0, spotting: false, falling: false, aimX: 0, aimZ: 0, shootTimer: 3,
    hitBox: { r: 3.2 },
    seesPlayer() {
      if (!heli.active || heli.falling) return false;
      const p = game.player.position;
      return Math.hypot(heli.aimX - p.x, heli.aimZ - p.z) < 14 && game.collision.lineOfSight(heli.x, heli.y - 2, heli.z, p.x, p.y + 1, p.z);
    },
    /** Bullet test against the fuselage sphere. */
    rayHit(ox, oy, oz, dx, dy, dz, maxDist) {
      if (!heli.active || heli.falling) return Infinity;
      const cx = heli.x - ox, cy = heli.y - oy, cz = heli.z - oz;
      const t = cx * dx + cy * dy + cz * dz;
      if (t < 0 || t > maxDist) return Infinity;
      const d2 = cx * cx + cy * cy + cz * cz - t * t;
      return d2 < heli.hitBox.r ** 2 ? t : Infinity;
    },
    damage(amount) {
      heli.health -= amount;
      if (heli.health <= 0 && !heli.falling) { heli.falling = true; heli.vy = 0; game.events.emit('heliDown', {}); game.wanted.crime(5, 600); }
    },
    spawn(nearPlayer = true) {
      const p = game.player.position;
      heli.active = true; heli.falling = false; heli.health = 600;
      heli.angle = game.rng.next() * Math.PI * 2;
      heli.x = p.x + (nearPlayer ? 40 : 220) * Math.cos(heli.angle); heli.z = p.z + (nearPlayer ? 40 : 220) * Math.sin(heli.angle); heli.y = 45;
      heli.aimX = p.x; heli.aimZ = p.z;
      parts.root.visible = true;
    },
    dismiss(instant) {
      if (instant) { heli.active = false; parts.root.visible = false; beam.visible = pool.visible = false; spot.intensity = 0; }
      else heli.leaving = true;
    },
    update(dt, wanted) {
      if (!heli.active) {
        if (wanted) heli.spawn(false);
        return;
      }
      parts.rotor.rotation.y += dt * 28;
      parts.tail.rotation.x += dt * 40;
      parts.red.visible = Math.sin(game.time * 6) > 0;
      const p = game.player.position;
      if (heli.falling) {
        heli.vy = (heli.vy || 0) - 14 * dt;
        heli.y += heli.vy * dt; heli.heading += dt * 5;
        if (game.rng.next() < 0.6) game.particles.emit('blacksmoke', heli.x, heli.y, heli.z, 1);
        game.particles.emit('flame', heli.x, heli.y, heli.z, 1, { jitter: 1 });
        if (heli.y < 1) { game.fx.explosion(heli.x, 0, heli.z, 1.6); game.audio?.explosion(heli.x, heli.z); heli.dismiss(true); }
      } else {
        if (!wanted && !heli.leaving) heli.leaving = true;
        if (wanted) heli.leaving = false;
        heli.angle += dt * 0.25;
        const searching = game.wanted.searching && game.wanted.searchZone;
        const cx = searching ? game.wanted.searchZone.x : p.x, cz = searching ? game.wanted.searchZone.z : p.z;
        let tx = cx + Math.cos(heli.angle) * 34, tz = cz + Math.sin(heli.angle) * 34, ty = 40;
        if (heli.leaving) { tx = heli.x + Math.sin(heli.heading) * 100; tz = heli.z + Math.cos(heli.heading) * 100; ty = 80; }
        const k = heli.leaving ? 0.6 : 1.2;
        heli.x = damp(heli.x, tx, k, dt); heli.z = damp(heli.z, tz, k, dt); heli.y = damp(heli.y, ty, 1, dt);
        heli.heading += angleDiff(heli.heading, Math.atan2(cx - heli.x, cz - heli.z)) * Math.min(1, dt * 1.5);
        // The searchlight drifts toward the player (or sweeps the search zone).
        const sweep = searching ? 18 : 0;
        heli.aimX = damp(heli.aimX, p.x + Math.sin(game.time * 0.9) * sweep, searching ? 0.8 : 3, dt);
        heli.aimZ = damp(heli.aimZ, p.z + Math.cos(game.time * 0.7) * sweep, searching ? 0.8 : 3, dt);
        if (heli.leaving && Math.hypot(heli.x - p.x, heli.z - p.z) > 260) heli.dismiss(true);
        heli.spotting = heli.seesPlayer();
        heli.shootTimer -= dt;
        if (game.wanted.level >= 5 && heli.shootTimer <= 0 && heli.spotting && game.player.hero.alive) {
          heli.shootTimer = 1.6 + game.rng.next();
          const ox = heli.x, oy = heli.y - 1.6, oz = heli.z;
          let dx = p.x - ox, dy = p.y + 1 - oy, dz = p.z - oz;
          const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
          game.weapons.fire({ x: ox, y: oy, z: oz, kind: 'cop', inVehicle: null }, { x: ox, y: oy, z: oz }, { x: dx, y: dy, z: dz }, { id: 'rifle', damage: 30, range: 200, spread: 0.03 }, { muzzle: [ox, oy, oz], damageScale: 0.5 });
        }
      }
      if (!heli.active) return;
      parts.root.position.set(heli.x, heli.y, heli.z);
      parts.root.rotation.set(heli.falling ? 0.3 : 0.12, heli.heading, heli.falling ? 0.4 : Math.sin(game.time * 0.8) * 0.05);
      const lit = !heli.falling;
      const night = Math.max(0.35, game.sky.nightFactor);
      spot.intensity = lit ? 2500 * night : 0;
      spot.position.set(heli.x, heli.y - 1.6, heli.z);
      spot.target.position.set(heli.aimX, 0, heli.aimZ);
      beam.visible = pool.visible = lit;
      if (lit) {
        look.set(heli.aimX - heli.x, -(heli.y - 1.6), heli.aimZ - heli.z);
        const len = look.length();
        beam.position.set(heli.x, heli.y - 1.6, heli.z);
        beam.scale.set(1, len, 1);
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), look.normalize());
        beamMat.opacity = 0.06 + night * 0.12;
        pool.position.set(heli.aimX, 0.12, heli.aimZ);
        pool.material.opacity = 0.1 + night * 0.3;
      }
    },
  };
  return heli;
}
