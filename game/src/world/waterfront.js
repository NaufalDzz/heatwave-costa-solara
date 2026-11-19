// The coast: an animated ocean with sun glitter, Palmera beach with boardwalk, lifeguard towers
// and umbrellas, sea walls and promenade, the two cable-stayed Solara bridges, Marina Azul's docks
// with bobbing yachts, the lighthouse with its sweeping beam, and the green hills on the horizon.
import * as THREE from 'three';
import { GeometryBuilder, mergeParts, makeMatrix } from './meshBuilder.js';
import { surfaceTexture, roadTexture } from './textures.js';
import { BRIDGES, COAST, BEACH_END, ISLAND, heightAt } from './cityLayout.js';
import { createRng } from '../core/rng.js';

const waterVertex = `
uniform float time; varying vec3 vWorld;
void main(){ vec4 w = modelMatrix * vec4(position,1.0);
  w.y += sin(w.x*0.05 + time*0.9)*0.12 + cos(w.z*0.07 + time*1.1)*0.1;
  vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const waterFragment = `
uniform float time; uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 skyColor; uniform vec3 deep; uniform vec3 fogColor;
uniform float fogNear; uniform float fogFar; uniform float night; varying vec3 vWorld;
void main(){
  vec2 p = vWorld.xz;
  vec3 n = normalize(vec3(
    sin(p.x*0.21+time*1.3)*0.06 + sin(p.x*0.63+p.y*0.4+time*2.1)*0.035 + sin(p.y*1.7+time*3.0)*0.015,
    1.0,
    cos(p.y*0.18+time*1.1)*0.06 + cos(p.x*0.5-p.y*0.7+time*1.7)*0.035 + cos(p.x*1.9-time*2.7)*0.015));
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 col = mix(deep, skyColor, 0.25 + fres * 0.6);
  vec3 r = reflect(-v, n);
  float spec = pow(max(dot(r, normalize(sunDir)), 0.0), 180.0);
  float glitter = pow(max(dot(r, normalize(sunDir)), 0.0), 24.0) * 0.35;
  col += sunColor * (spec * 3.0 + glitter) * (1.0 - night * 0.8);
  float d = length(cameraPosition - vWorld);
  col = mix(col, fogColor, smoothstep(fogNear, fogFar, d));
  gl_FragColor = vec4(col, 0.94);
#include <colorspace_fragment>
}`;

export function buildWaterfront(scene, sky) {
  const group = new THREE.Group();
  const rng = createRng(77);
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, ...o });
  const waterMat = new THREE.ShaderMaterial({
    vertexShader: waterVertex, fragmentShader: waterFragment, transparent: true,
    uniforms: { time: { value: 0 }, sunDir: { value: sky.sunDir }, sunColor: { value: sky.sun.color }, skyColor: { value: new THREE.Color() },
      deep: { value: new THREE.Color('#0f5e7a') }, fogColor: { value: scene.fog.color }, fogNear: { value: 200 }, fogFar: { value: 1500 }, night: { value: 0 } },
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000, 120, 120), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(200, -1.1, 200);
  water.renderOrder = 1;
  group.add(water);

  // Beach: flat sand that slopes under the waves, plus the seabed.
  const sand = new GeometryBuilder();
  sand.flat(-760, COAST, COAST, BEACH_END - 20, 0.0, '#ffffff', 5);
  const sc = new THREE.Color('#f1dcae');
  sand.quad([-760, -2.2, BEACH_END + 30], [COAST, -2.2, BEACH_END + 30], [COAST, 0, BEACH_END - 20], [-760, 0, BEACH_END - 20], [0, 0, 30, 0, 30, 3, 0, 3], sc);
  sand.flat(-800, -800, 1200, 1200, -6, '#6f8f8a', 20);
  // Island beach rim.
  sand.box(ISLAND.x0 - 6, -2.5, ISLAND.z0 - 6, ISLAND.x1 + 6, -0.05, ISLAND.z1 + 6, '#ead2a0', { su: 5, sv: 5 });
  group.add(mesh(sand.build(), std({ map: surfaceTexture('sand'), roughness: 1 }), false));

  // Sea walls and the promenade along the east coast of the mainland.
  const walls = new GeometryBuilder();
  walls.box(COAST - 13, -3, -760, COAST, 0.15, COAST, '#d9d2c3', { su: 4, sv: 4 });
  walls.box(COAST - 0.6, 0.15, -760, COAST, 1.1, COAST, '#f4f1ea');
  walls.box(-760, -0.1, 407, COAST - 13, 0.18, 421, '#efe6d6', { su: 4, sv: 4 });
  group.add(mesh(walls.build(), std({ map: surfaceTexture('sidewalk') })));

  // Boardwalk along the beach.
  const wood = new GeometryBuilder();
  wood.box(-700, 0, 421, COAST - 2, 0.45, 429, '#a5774c', { su: 2, sv: 2 });
  for (let x = -700; x < COAST; x += 6) wood.box(x, 0.45, 428.6, x + 0.25, 1.4, 428.9, '#7a5534');
  wood.box(-700, 1.3, 428.6, COAST - 2, 1.45, 428.9, '#7a5534');

  // Marina docks with yachts.
  const boats = [];
  for (let k = 0; k < 6; k++) {
    const z = -210 + k * 80;
    wood.box(ISLAND.x1, -0.4, z - 2, ISLAND.x1 + 70, 0.3, z + 2, '#9c7048');
    for (let s = 0; s < 3; s++) {
      for (const side of [-1, 1]) {
        if (rng.chance(0.25)) continue;
        const boat = makeBoat(rng);
        boat.position.set(ISLAND.x1 + 14 + s * 20, -1, z + side * 8);
        boat.rotation.y = Math.PI / 2 + (rng.next() - 0.5) * 0.1;
        boat.userData.phase = rng.next() * 6;
        group.add(boat); boats.push(boat);
      }
    }
  }
  group.add(mesh(wood.build(), std({ roughness: 0.9 })));

  // Bridges: arched decks, side barriers, piers and cable-stayed pylons.
  const deck = new GeometryBuilder(), concrete = new GeometryBuilder();
  const lampPoints = [];
  const white = new THREE.Color('#ffffff'), conc = new THREE.Color('#d8d4cc');
  for (const b of BRIDGES) {
    const steps = 26;
    for (let s = 0; s < steps; s++) {
      const xa = b.x0 + ((b.x1 - b.x0) * s) / steps, xb = b.x0 + ((b.x1 - b.x0) * (s + 1)) / steps;
      const ya = heightAt(xa, b.z) + 0.03, yb = heightAt(xb, b.z) + 0.03;
      deck.quad([xa, ya, b.z + 7], [xb, yb, b.z + 7], [xb, yb, b.z - 7], [xa, ya, b.z - 7], [xa / 16, 1, xb / 16, 1, xb / 16, 0, xa / 16, 0], white);
      for (const side of [-1, 1]) {
        const z0 = b.z + side * 7, z1 = b.z + side * 8.2;
        const za = Math.min(z0, z1), zb = Math.max(z0, z1);
        concrete.quad([xa, ya - 1.6, zb], [xb, yb - 1.6, zb], [xb, yb + 1.1, zb], [xa, ya + 1.1, zb], [0, 0, 1, 0, 1, 1, 0, 1], conc);
        concrete.quad([xb, yb - 1.6, za], [xa, ya - 1.6, za], [xa, ya + 1.1, za], [xb, yb + 1.1, za], [0, 0, 1, 0, 1, 1, 0, 1], conc);
        concrete.quad([xa, ya + 1.1, zb], [xb, yb + 1.1, zb], [xb, yb + 1.1, za], [xa, ya + 1.1, za], [0, 0, 1, 0, 1, 1, 0, 1], conc);
      }
      concrete.quad([xa, ya - 1.6, b.z - 8.2], [xb, yb - 1.6, b.z - 8.2], [xb, yb - 1.6, b.z + 8.2], [xa, ya - 1.6, b.z + 8.2], [0, 0, 1, 0, 1, 1, 0, 1], conc);
    }
    for (const px of [440, 480]) {
      const py = heightAt(px, b.z);
      concrete.box(px - 2, -4, b.z - 6, px + 2, py - 1.5, b.z + 6, conc);
      for (const side of [-1, 1]) {
        concrete.box(px - 1, py, b.z + side * 9.5 - 1, px + 1, py + 34, b.z + side * 9.5 + 1, '#f1eee8');
        for (let c = 1; c <= 5; c++) for (const dir of [-1, 1]) {
          const ax = px + dir * c * 5, ay = heightAt(ax, b.z) + 1;
          const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 4), new THREE.MeshBasicMaterial({ color: '#e9e4da' }));
          const top = new THREE.Vector3(px, py + 33 - c * 2, b.z + side * 9.5), bot = new THREE.Vector3(ax, ay, b.z + side * 8.2);
          cable.position.copy(top).add(bot).multiplyScalar(0.5);
          cable.scale.y = top.distanceTo(bot);
          cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bot.sub(top).normalize());
          group.add(cable);
        }
        lampPoints.push(new THREE.Vector3(px, py + 34.5, b.z + side * 9.5));
      }
    }
  }
  group.add(mesh(deck.build(), std({ map: roadTexture(), roughness: 0.9 })));
  group.add(mesh(concrete.build(), std({ roughness: 0.75 })));

  // Beach furniture: lifeguard towers, umbrellas and towels.
  const beachParts = [];
  const umbrellaColors = ['#ff595e', '#ffca3a', '#1982c4', '#6a4c93', '#ff924c', '#8ac926', '#ffffff'];
  for (let x = -680; x < COAST - 20; x += 18) {
    if (rng.chance(0.35)) continue;
    const ux = x + rng.range(-5, 5), uz = rng.range(440, 470);
    beachParts.push({ geometry: new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5), color: '#eeeeee', matrix: makeMatrix(ux, 1.3, uz) });
    beachParts.push({ geometry: new THREE.ConeGeometry(1.8, 0.7, 8), color: rng.pick(umbrellaColors), matrix: makeMatrix(ux, 2.6, uz) });
    beachParts.push({ geometry: new THREE.BoxGeometry(1, 0.05, 2), color: rng.pick(umbrellaColors), matrix: makeMatrix(ux + 1.4, 0.03, uz + 0.5, 0, rng.next(), 0) });
  }
  const towerColors = ['#ff8fab', '#7bdff2', '#ffd670', '#b2f7ef'];
  for (let k = 0; k < 6; k++) {
    const tx = -620 + k * 190, tz = 476;
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) beachParts.push({ geometry: new THREE.BoxGeometry(0.2, 2.4, 0.2), color: '#ffffff', matrix: makeMatrix(tx + lx, 1.2, tz + lz) });
    beachParts.push({ geometry: new THREE.BoxGeometry(3, 2, 3), color: towerColors[k % 4], matrix: makeMatrix(tx, 3.4, tz) });
    beachParts.push({ geometry: new THREE.ConeGeometry(2.6, 1.2, 4), color: '#ff5d5d', matrix: makeMatrix(tx, 5, tz, 0, Math.PI / 4, 0) });
    beachParts.push({ geometry: new THREE.BoxGeometry(0.8, 0.1, 4), color: '#ffffff', matrix: makeMatrix(tx, 1.2, tz - 3, -0.6, 0, 0) });
  }
  // Lighthouse at the island's north-east point.
  const lh = { x: ISLAND.x1 - 12, z: ISLAND.z0 + 12 };
  for (let s = 0; s < 6; s++) beachParts.push({ geometry: new THREE.CylinderGeometry(3.4 - s * 0.3, 3.7 - s * 0.3, 4, 12), color: s % 2 ? '#d62828' : '#ffffff', matrix: makeMatrix(lh.x, 2 + s * 4, lh.z) });
  beachParts.push({ geometry: new THREE.CylinderGeometry(2.6, 2.6, 0.6, 12), color: '#333333', matrix: makeMatrix(lh.x, 24.3, lh.z) });
  beachParts.push({ geometry: new THREE.ConeGeometry(2.6, 2.4, 12), color: '#d62828', matrix: makeMatrix(lh.x, 28.2, lh.z) });
  group.add(mesh(mergeParts(beachParts), std({ roughness: 0.6 })));
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 2.6, 10), new THREE.MeshBasicMaterial({ color: '#fff3c4', toneMapped: false }));
  lamp.position.set(lh.x, 25.9, lh.z);
  group.add(lamp);
  const beamMat = new THREE.MeshBasicMaterial({ color: '#fff2b0', transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(14, 220, 16, 1, true), beamMat);
  beam.geometry.translate(0, -110, 0);
  beam.geometry.rotateZ(Math.PI / 2);
  const beamPivot = new THREE.Group();
  beamPivot.position.copy(lamp.position);
  beamPivot.add(beam);
  group.add(beamPivot);

  // Hills ringing the north and west horizon.
  const hillParts = [];
  for (let k = 0; k < 26; k++) {
    const a = (k / 26) * Math.PI * 0.9 + Math.PI * 0.95;
    const r = rng.range(950, 1200);
    const x = Math.cos(a) * r - 150, z = Math.sin(a) * r - 150;
    const h = rng.range(90, 220);
    hillParts.push({ geometry: new THREE.ConeGeometry(rng.range(180, 300), h, 7), color: rng.pick(['#6f8f4e', '#7d9a55', '#8a9a62', '#6a7f52']), matrix: makeMatrix(x, h / 2 - 8, z, 0, rng.next() * 3, 0) });
  }
  const hills = mesh(mergeParts(hillParts), std({ flatShading: true, roughness: 1 }), false);
  hills.receiveShadow = false;
  group.add(hills);

  scene.add(group);
  return {
    lampPoints,
    update(dt) {
      waterMat.uniforms.time.value += dt;
      waterMat.uniforms.skyColor.value.copy(scene.fog.color);
      waterMat.uniforms.night.value = sky.nightFactor;
      waterMat.uniforms.deep.value.set(sky.nightFactor > 0.5 ? '#07243a' : '#0f5e7a');
      const t = waterMat.uniforms.time.value;
      for (const b of boats) {
        b.position.y = -1 + Math.sin(t * 1.2 + b.userData.phase) * 0.15;
        b.rotation.z = Math.sin(t * 0.9 + b.userData.phase) * 0.04;
      }
      beamPivot.rotation.y = t * 0.6;
      beamMat.opacity = 0.03 + sky.nightFactor * 0.16;
    },
  };
}

function mesh(geometry, material, cast = true) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast; m.receiveShadow = true;
  return m;
}

function makeBoat(rng) {
  const hull = rng.pick(['#ffffff', '#f5f0e6', '#1d3557', '#e63946']);
  const len = rng.range(9, 15);
  const parts = [
    { geometry: new THREE.BoxGeometry(len, 1.6, 3.6), color: hull, matrix: makeMatrix(0, 0.8, 0) },
    { geometry: new THREE.CylinderGeometry(1.8, 0.4, 3.6, 3, 1), color: hull, matrix: makeMatrix(len / 2 + 0.9, 0.8, 0, Math.PI / 2, 0, -Math.PI / 2) },
    { geometry: new THREE.BoxGeometry(len * 0.45, 1.3, 2.8), color: '#f8f8f8', matrix: makeMatrix(-len * 0.08, 2.2, 0) },
    { geometry: new THREE.BoxGeometry(len * 0.3, 0.6, 2.9), color: '#203040', matrix: makeMatrix(-len * 0.05, 2.5, 0) },
    { geometry: new THREE.BoxGeometry(len, 0.2, 3.7), color: '#3a7ca5', matrix: makeMatrix(0, 0.3, 0) },
  ];
  if (rng.chance(0.4)) parts.push({ geometry: new THREE.CylinderGeometry(0.1, 0.1, 12, 4), color: '#dddddd', matrix: makeMatrix(0, 7, 0) });
  const m = new THREE.Mesh(mergeParts(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
  m.castShadow = true;
  return m;
}
