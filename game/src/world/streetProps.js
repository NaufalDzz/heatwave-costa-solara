// Street dressing drawn with instancing: palm trees on boulevards, beach and island, street
// lamps and traffic signals at every corner with night glows, benches, bins, hydrants and bus
// shelters, container stacks in the Ironworks, a fountain in Solano Park and trees in the hills.
import * as THREE from 'three';
import { mergeParts, makeMatrix } from './meshBuilder.js';
import { createGlowPoints } from '../fx/glowSprites.js';
import { GRID, roadCoord, HALF_ROAD, ISLAND, ISLAND_ROAD_X, COAST } from './cityLayout.js';
import { createRng } from '../core/rng.js';

function palmGeometry() {
  const parts = [];
  let x = 0, y = 0;
  for (let s = 0; s < 6; s++) {
    const nx = x + 0.12 * s * 0.4;
    parts.push({ geometry: new THREE.CylinderGeometry(0.2 - s * 0.012, 0.24 - s * 0.012, 1.6, 6), color: s % 2 ? '#8a6a48' : '#7a5c3e', matrix: makeMatrix((x + nx) / 2, y + 0.8, 0, 0, 0, -0.05 * s) });
    x = nx; y += 1.55;
  }
  for (let f = 0; f < 8; f++) {
    const leaf = new THREE.PlaneGeometry(0.9, 4.2, 1, 5);
    const p = leaf.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = p.getY(i) + 2.1;
      p.setXYZ(i, p.getX(i) * (1 - v / 5), v, -0.18 * v * v);
    }
    leaf.computeVertexNormals();
    parts.push({ geometry: leaf, color: f % 2 ? '#3f8a3a' : '#5aa045', matrix: makeMatrix(x, y, 0, -0.55, (f / 8) * Math.PI * 2, 0) });
  }
  parts.push({ geometry: new THREE.SphereGeometry(0.35, 6, 4), color: '#6b4a2a', matrix: makeMatrix(x, y - 0.1, 0) });
  return mergeParts(parts);
}

function lampGeometry() {
  return mergeParts([
    { geometry: new THREE.CylinderGeometry(0.09, 0.14, 7, 6), color: '#3c4148', matrix: makeMatrix(0, 3.5, 0) },
    { geometry: new THREE.BoxGeometry(0.12, 0.12, 2.2), color: '#3c4148', matrix: makeMatrix(0, 6.9, 1.0) },
    { geometry: new THREE.BoxGeometry(0.5, 0.2, 0.9), color: '#fff4d0', matrix: makeMatrix(0, 6.8, 2.0) },
  ]);
}
function signalGeometry() {
  return mergeParts([
    { geometry: new THREE.CylinderGeometry(0.1, 0.12, 5.5, 6), color: '#2d3136', matrix: makeMatrix(0, 2.75, 0) },
    { geometry: new THREE.BoxGeometry(0.15, 0.15, 4), color: '#2d3136', matrix: makeMatrix(0, 5.4, 2) },
    { geometry: new THREE.BoxGeometry(0.5, 1.4, 0.5), color: '#f2c230', matrix: makeMatrix(0, 4.8, 3.6) },
  ]);
}
function treeGeometry() {
  return mergeParts([
    { geometry: new THREE.CylinderGeometry(0.25, 0.35, 3, 6), color: '#6b4f35', matrix: makeMatrix(0, 1.5, 0) },
    { geometry: new THREE.IcosahedronGeometry(2.6, 0), color: '#4f7f3a', matrix: makeMatrix(0, 4.6, 0) },
    { geometry: new THREE.IcosahedronGeometry(1.8, 0), color: '#5f9444', matrix: makeMatrix(0.8, 5.9, 0.4) },
  ]);
}

function instanced(geometry, transforms, material) {
  const m = new THREE.InstancedMesh(geometry, material, transforms.length);
  transforms.forEach((t, i) => m.setMatrixAt(i, makeMatrix(t[0], t[1], t[2], 0, t[3] || 0, 0, t[4] || 1, t[4] || 1, t[4] || 1)));
  m.castShadow = true; m.receiveShadow = true;
  m.computeBoundingSphere();
  return m;
}

export function buildStreetProps(layout, scene) {
  const rng = createRng(layout.seed + 11);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
  const palms = [], lamps = [], signals = [], trees = [], furniture = [];
  const lampGlow = [], lampColor = [], lampSize = [];
  const sodium = new THREE.Color('#ffb562'), red = new THREE.Color('#ff3030'), green = new THREE.Color('#40ff80');

  for (const b of layout.blocks) {
    const palmy = b.district === 'palmera' || b.district === 'heights' || b.bj === 4 || b.bj === 5 || b.kind === 'park';
    // Lamps two per side, arms reaching over the road.
    for (const t of [0.25, 0.75]) {
      const x = b.bx0 + (b.bx1 - b.bx0) * t, z = b.bz0 + (b.bz1 - b.bz0) * t;
      lamps.push([x, 0.18, b.bz0 + 0.8, Math.PI], [x, 0.18, b.bz1 - 0.8, 0], [b.bx0 + 0.8, 0.18, z, -Math.PI / 2], [b.bx1 - 0.8, 0.18, z, Math.PI / 2]);
      lampGlow.push(new THREE.Vector3(x, 6.7, b.bz0 - 1.2), new THREE.Vector3(x, 6.7, b.bz1 + 1.2), new THREE.Vector3(b.bx0 - 1.2, 6.7, z), new THREE.Vector3(b.bx1 + 1.2, 6.7, z));
      for (let k = 0; k < 4; k++) { lampColor.push(sodium); lampSize.push(9); }
    }
    if (palmy) {
      for (let x = b.bx0 + 9; x < b.bx1 - 6; x += 15) {
        palms.push([x, 0.18, b.bz1 - 1.6, rng.next() * 6, rng.range(0.9, 1.25)]);
        if (b.district === 'palmera' || b.kind === 'park') palms.push([x + 4, 0.18, b.bz0 + 1.6, rng.next() * 6, rng.range(0.9, 1.2)]);
      }
    }
    if (b.kind === 'park') {
      for (let k = 0; k < 10; k++) (k % 2 ? trees : palms).push([rng.range(b.ix0 + 3, b.ix1 - 3), 0.19, rng.range(b.iz0 + 3, b.iz1 - 3), rng.next() * 6, rng.range(0.9, 1.3)]);
      const cx = (b.ix0 + b.ix1) / 2, cz = (b.iz0 + b.iz1) / 2;
      furniture.push({ geometry: new THREE.CylinderGeometry(5, 5.4, 0.8, 20), color: '#e0d6c6', matrix: makeMatrix(cx, 0.6, cz) });
      furniture.push({ geometry: new THREE.CylinderGeometry(4.4, 4.4, 0.2, 20), color: '#3fa7c9', matrix: makeMatrix(cx, 0.95, cz) });
      furniture.push({ geometry: new THREE.CylinderGeometry(0.6, 1, 2.6, 10), color: '#e8dfd0', matrix: makeMatrix(cx, 2, cz) });
    }
    if (b.district === 'heights' && b.kind === 'built') {
      for (let k = 0; k < 4; k++) palms.push([rng.range(b.ix0 + 2, b.ix1 - 2), 0.19, rng.range(b.iz0 + 2, b.iz1 - 2), rng.next() * 6, rng.range(0.7, 1)]);
    }
    if (b.district === 'ironworks' || (b.kind === 'lot' && b.bi > 5)) {
      const colors = ['#d62828', '#1d70b8', '#f77f00', '#2a9d8f', '#6c757d', '#e9c46a'];
      for (let k = 0; k < 6; k++) {
        const x = b.ix1 - 6, z = b.iz1 - 6 - k * 3.2;
        if (z < b.iz0 + 2) break;
        const stack = 1 + Math.floor(rng.next() * 3);
        for (let s = 0; s < stack; s++) furniture.push({ geometry: new THREE.BoxGeometry(6, 2.6, 2.5), color: rng.pick(colors), matrix: makeMatrix(x - (k % 2) * 6.5, 1.3 + s * 2.6, z) });
      }
    }
    // Benches, bins and a hydrant on the south sidewalk; a bus shelter on main roads.
    const sx = b.bx0 + rng.range(10, 40);
    furniture.push({ geometry: new THREE.BoxGeometry(2.2, 0.5, 0.6), color: '#8d5a3b', matrix: makeMatrix(sx, 0.6, b.bz1 - 3) });
    furniture.push({ geometry: new THREE.CylinderGeometry(0.3, 0.3, 1, 8), color: '#2e7d32', matrix: makeMatrix(sx + 3, 0.68, b.bz1 - 3.1) });
    furniture.push({ geometry: new THREE.CylinderGeometry(0.2, 0.25, 0.8, 8), color: '#e53935', matrix: makeMatrix(b.bx0 + 3, 0.58, b.bz0 + 1.2) });
    if (b.bj === 4 && b.bi % 2 === 0) {
      const bx = (b.bx0 + b.bx1) / 2;
      furniture.push({ geometry: new THREE.BoxGeometry(4, 0.15, 1.6), color: '#90a4ae', matrix: makeMatrix(bx, 2.6, b.bz1 - 2) });
      furniture.push({ geometry: new THREE.BoxGeometry(4, 2.4, 0.08), color: '#b3e5fc', matrix: makeMatrix(bx, 1.4, b.bz1 - 2.7) });
      furniture.push({ geometry: new THREE.BoxGeometry(1.2, 2.4, 0.1), color: '#ff7043', matrix: makeMatrix(bx + 2.5, 1.4, b.bz1 - 2) });
    }
  }
  // Traffic signals on two corners of every inner junction.
  for (let j = 1; j < GRID; j++) for (let i = 1; i < GRID; i++) {
    const x = roadCoord(i), z = roadCoord(j), o = HALF_ROAD + 1.2;
    signals.push([x - o, 0.18, z - o, Math.PI / 2], [x + o, 0.18, z + o, -Math.PI / 2]);
    const ns = (i + j) % 2 === 0;
    lampGlow.push(new THREE.Vector3(x - o + 3.6, 5.0, z - o), new THREE.Vector3(x + o - 3.6, 5.0, z + o));
    lampColor.push(ns ? red : green, ns ? green : red);
    lampSize.push(3.2, 3.2);
  }
  // Beach and island palms, island lamps.
  for (let x = -690; x < COAST - 5; x += 11) palms.push([x + rng.range(-2, 2), 0, rng.range(432, 442), rng.next() * 6, rng.range(0.95, 1.35)]);
  for (let x = -690; x < COAST - 5; x += 23) palms.push([x + rng.range(-4, 4), 0, rng.range(450, 470), rng.next() * 6, rng.range(1, 1.4)]);
  for (let z = -680; z < 400; z += 18) palms.push([COAST - 5, 0.15, z, rng.next() * 6, rng.range(0.9, 1.3)]);
  for (let z = ISLAND.z0 + 10; z < ISLAND.z1; z += 16) {
    palms.push([ISLAND_ROAD_X - 10, 0.12, z, rng.next() * 6, 1.1], [ISLAND_ROAD_X + 10, 0.12, z + 8, rng.next() * 6, 1.1]);
    lamps.push([ISLAND_ROAD_X + 8.5, 0.12, z, Math.PI / 2]);
    lampGlow.push(new THREE.Vector3(ISLAND_ROAD_X + 6.5, 6.7, z)); lampColor.push(sodium); lampSize.push(9);
  }
  for (let x = 520; x < ISLAND.x1; x += 22) palms.push([x, 0.12, ISLAND.z1 - 4, rng.next() * 6, 1.2], [x + 8, 0.12, ISLAND.z0 + 4, rng.next() * 6, 1.2]);
  // Trees on the hills beyond the grid.
  for (let k = 0; k < 260; k++) {
    const x = rng.range(-700, 400), z = rng.range(-700, -420);
    const x2 = rng.range(-700, -420), z2 = rng.range(-420, 400);
    const [tx, tz] = k % 2 ? [x, z] : [x2, z2];
    if (Math.abs(tz - roadCoord(2)) < 9 || Math.abs(tz - roadCoord(5)) < 9 || Math.abs(tz - roadCoord(8)) < 9 || Math.abs(tx - roadCoord(3)) < 9 || Math.abs(tx - roadCoord(7)) < 9) continue;
    if (Math.abs(tx + 470) < 30 && Math.abs(tz) < 20) continue;
    trees.push([tx, 0, tz, rng.next() * 6, rng.range(0.8, 1.5)]);
  }

  const group = new THREE.Group();
  group.add(instanced(palmGeometry(), palms, mat));
  group.add(instanced(lampGeometry(), lamps, mat));
  group.add(instanced(signalGeometry(), signals, mat));
  group.add(instanced(treeGeometry(), trees, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true })));
  const furn = new THREE.Mesh(mergeParts(furniture), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  furn.castShadow = furn.receiveShadow = true;
  group.add(furn);
  const glows = createGlowPoints(lampGlow, lampColor, lampSize);
  group.add(glows);
  scene.add(group);
  return { group, glows, palmCount: palms.length };
}
