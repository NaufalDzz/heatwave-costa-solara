// Combat and driving effects built on the particle pools: explosions with a light flash,
// shockwave ring and flying debris, bullet tracers, muzzle flashes, impacts, blood, tyre smoke,
// skid marks on the asphalt and camera shake.
import * as THREE from 'three';

export function createEffects(scene, particles, rng) {
  // Tracers: a pool of fading additive line segments.
  const MAX_TRACERS = 64;
  const tracerPos = new Float32Array(MAX_TRACERS * 6), tracerCol = new Float32Array(MAX_TRACERS * 6);
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerPos, 3).setUsage(THREE.DynamicDrawUsage));
  tracerGeo.setAttribute('color', new THREE.BufferAttribute(tracerCol, 3).setUsage(THREE.DynamicDrawUsage));
  const tracerLines = new THREE.LineSegments(tracerGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  tracerLines.frustumCulled = false;
  scene.add(tracerLines);
  const tracers = [];

  // Skid marks: a ring buffer of dark quads lying on the road.
  const MAX_SKIDS = 600;
  const skidMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.32, 0.9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#141414', transparent: true, opacity: 0.55, depthWrite: false }), MAX_SKIDS);
  skidMesh.count = 0;
  skidMesh.frustumCulled = false;
  scene.add(skidMesh);
  let skidIndex = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);

  // Light flashes for explosions and gunfire (a small pool of point lights).
  const flashes = [];
  for (let i = 0; i < 3; i++) {
    const l = new THREE.PointLight('#ffa040', 0, 40, 1.6);
    scene.add(l);
    flashes.push({ light: l, t: 0, peak: 0 });
  }
  let flashIndex = 0;

  // Shockwave rings.
  const rings = [];
  const ringGeo = new THREE.RingGeometry(0.8, 1.2, 32).rotateX(-Math.PI / 2);

  // Debris chunks.
  const debris = [];
  const debrisGeo = new THREE.BoxGeometry(0.5, 0.3, 0.6);
  const debrisMat = new THREE.MeshStandardMaterial({ color: '#2a2725', roughness: 0.9 });

  const fx = {
    shake: 0,
    flash(x, y, z, intensity, color = '#ffa040') {
      const f = flashes[flashIndex++ % flashes.length];
      f.light.position.set(x, y, z);
      f.light.color.set(color);
      f.t = 0; f.peak = intensity;
    },
    explosion(x, y, z, power = 1) {
      particles.emit('blast', x, y + 1, z, Math.round(14 * power), { jitter: 2, scale: power });
      particles.emit('fire', x, y + 1, z, Math.round(30 * power), { jitter: 2.5, spread: 1.6 });
      particles.emit('spark', x, y + 1, z, Math.round(40 * power), { spread: 2 });
      particles.emit('blacksmoke', x, y + 2, z, Math.round(30 * power), { jitter: 3, spread: 1.4 });
      fx.flash(x, y + 3, z, 260 * power);
      fx.shake = Math.min(1.5, fx.shake + power);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd59a', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      ring.position.set(x, y + 0.3, z);
      scene.add(ring);
      rings.push({ mesh: ring, t: 0 });
      for (let i = 0; i < 8 * power; i++) {
        const d = new THREE.Mesh(debrisGeo, debrisMat);
        d.position.set(x, y + 1, z);
        d.castShadow = true;
        scene.add(d);
        debris.push({ mesh: d, vx: (rng.next() - 0.5) * 18, vy: 6 + rng.next() * 12, vz: (rng.next() - 0.5) * 18, t: 0 });
      }
    },
    tracer(ax, ay, az, bx, by, bz, color = '#ffe9a8') {
      if (tracers.length >= MAX_TRACERS) tracers.shift();
      tracers.push({ a: [ax, ay, az], b: [bx, by, bz], t: 0, c: new THREE.Color(color) });
    },
    muzzle(x, y, z) {
      particles.emit('flash', x, y, z, 2, { jitter: 0.1 });
      fx.flash(x, y, z, 14, '#ffcf70');
    },
    impact(x, y, z, kind) {
      if (kind === 'flesh') particles.emit('blood', x, y, z, 8, { jitter: 0.2 });
      else if (kind === 'metal') particles.emit('spark', x, y, z, 6, { spread: 0.5 });
      else particles.emit('impact', x, y, z, 5, { jitter: 0.2 });
    },
    skid(x, z, heading) {
      q.setFromAxisAngle(up, heading);
      m4.compose(new THREE.Vector3(x, 0.05, z), q, one);
      skidMesh.setMatrixAt(skidIndex, m4);
      skidIndex = (skidIndex + 1) % MAX_SKIDS;
      skidMesh.count = Math.max(skidMesh.count, skidIndex === 0 ? MAX_SKIDS : skidIndex);
      skidMesh.instanceMatrix.needsUpdate = true;
    },
    update(dt) {
      fx.shake = Math.max(0, fx.shake - dt * 1.8);
      for (const f of flashes) {
        f.t += dt;
        f.light.intensity = f.peak * Math.max(0, 1 - f.t / 0.35);
      }
      let n = 0;
      for (let i = tracers.length - 1; i >= 0; i--) {
        const tr = tracers[i];
        tr.t += dt;
        if (tr.t > 0.09) { tracers.splice(i, 1); continue; }
      }
      for (const tr of tracers) {
        const k = 1 - tr.t / 0.09;
        tracerPos.set(tr.a, n * 6); tracerPos.set(tr.b, n * 6 + 3);
        tracerCol.set([tr.c.r * k, tr.c.g * k, tr.c.b * k, tr.c.r * k * 0.4, tr.c.g * k * 0.4, tr.c.b * k * 0.4], n * 6);
        n++;
      }
      tracerGeo.setDrawRange(0, n * 2);
      tracerGeo.attributes.position.needsUpdate = tracerGeo.attributes.color.needsUpdate = true;
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.t += dt;
        r.mesh.scale.setScalar(1 + r.t * 40);
        r.mesh.material.opacity = Math.max(0, 0.8 - r.t * 1.6);
        if (r.t > 0.5) { scene.remove(r.mesh); r.mesh.material.dispose(); rings.splice(i, 1); }
      }
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.t += dt;
        d.vy -= 22 * dt;
        d.mesh.position.x += d.vx * dt; d.mesh.position.y += d.vy * dt; d.mesh.position.z += d.vz * dt;
        d.mesh.rotation.x += dt * 7; d.mesh.rotation.z += dt * 5;
        if (d.mesh.position.y < 0.15) { d.mesh.position.y = 0.15; d.vy *= -0.3; d.vx *= 0.6; d.vz *= 0.6; }
        if (d.t > 6) { scene.remove(d.mesh); debris.splice(i, 1); }
      }
    },
  };
  return fx;
}
