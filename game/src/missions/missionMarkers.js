// World markers: tall glowing light columns with a pulsing ground ring for mission starts,
// destinations, race and timed checkpoints, shops, plus the floating arrow over targets.
import * as THREE from 'three';
import { heightAt } from '../world/cityLayout.js';

const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0);
const ringGeo = new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2);
const arrowGeo = new THREE.ConeGeometry(0.6, 1.2, 4).rotateX(Math.PI);

export function createMarker(scene, x, z, color = '#ffcf4a', { radius = 2.2, height = 40, arrow = false } = {}) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const beam = new THREE.Mesh(beamGeo, mat);
  beam.scale.set(radius, height, radius);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
  ring.scale.setScalar(radius * 1.5);
  ring.position.y = 0.25;
  group.add(beam, ring);
  let tip = null;
  if (arrow) {
    tip = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    tip.position.y = 4;
    group.add(tip);
  }
  group.position.set(x, Math.max(0, heightAt(x, z)), z);
  scene.add(group);
  return {
    group, x, z,
    move(nx, nz, y) { this.x = nx; this.z = nz; group.position.set(nx, y ?? Math.max(0, heightAt(nx, nz)), nz); },
    update(t) {
      const s = 1 + Math.sin(t * 4) * 0.08;
      ring.scale.setScalar(radius * 1.5 * s);
      mat.opacity = 0.22 + Math.sin(t * 2.5) * 0.08;
      if (tip) { tip.position.y = 4 + Math.sin(t * 3) * 0.4; tip.rotation.y = t * 2; }
    },
    remove() { scene.remove(group); mat.dispose(); },
  };
}

/** A floating arrow above a moving target (a car or a person). */
export function createTargetArrow(scene, color = '#ff2d55') {
  const m = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  m.scale.setScalar(1.3);
  scene.add(m);
  return {
    follow(x, y, z, t) { m.position.set(x, y + Math.sin(t * 3) * 0.3, z); m.rotation.y = t * 2; m.visible = true; },
    hide() { m.visible = false; },
    remove() { scene.remove(m); },
  };
}
