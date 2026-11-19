// The vehicle line-up of Costa Solara (all original makes) with their handling numbers, and the
// low-poly meshes built for each: painted body, glass cabin, bumpers, lights, wheels, the taxi
// roof sign, the police light bar and the box truck's cargo body.
import * as THREE from 'three';
import { mergeParts, makeMatrix } from '../world/meshBuilder.js';

export const VEHICLE_TYPES = {
  sports: { name: 'Vortex GT', len: 4.5, wid: 2.0, hb: 0.55, hc: 0.5, cabin: [-0.35, 0.1], maxSpeed: 64, accel: 17, grip: 8.5, steer: 2.3, mass: 1.0, price: 0, colors: ['#e63946', '#ffbe0b', '#3a86ff', '#ff006e', '#06d6a0', '#f5f5f5'] },
  muscle: { name: 'Thunderhawk', len: 4.8, wid: 2.0, hb: 0.65, hc: 0.5, cabin: [-0.3, 0.05], maxSpeed: 56, accel: 16, grip: 7, steer: 2.0, mass: 1.15, colors: ['#1d3557', '#ff7b00', '#2b2d42', '#9b2226', '#588157'] },
  sedan: { name: 'Marlin Sedan', len: 4.7, wid: 1.95, hb: 0.65, hc: 0.62, cabin: [-0.32, 0.18], maxSpeed: 46, accel: 11, grip: 7.5, steer: 2.0, mass: 1.0, colors: ['#8d99ae', '#edf2f4', '#2b2d42', '#457b9d', '#a8dadc', '#bc4749', '#6d597a'] },
  suv: { name: 'Pacer SUV', len: 4.9, wid: 2.1, hb: 0.85, hc: 0.75, cabin: [-0.42, 0.2], maxSpeed: 42, accel: 10, grip: 6.8, steer: 1.8, mass: 1.4, colors: ['#22223b', '#f2e9e4', '#4a4e69', '#283618', '#9a8c98'] },
  taxi: { name: 'Sunline Cab', len: 4.8, wid: 1.95, hb: 0.65, hc: 0.62, cabin: [-0.32, 0.18], maxSpeed: 45, accel: 11, grip: 7.5, steer: 2.0, mass: 1.0, colors: ['#ffc300'] },
  van: { name: 'Coastal Van', len: 5.2, wid: 2.1, hb: 1.6, hc: 0.0, cabin: [0, 0], maxSpeed: 36, accel: 8, grip: 6.2, steer: 1.7, mass: 1.6, colors: ['#ffffff', '#4cc9f0', '#f72585', '#e9c46a'] },
  truck: { name: 'Haulmaster Box', len: 7.6, wid: 2.5, hb: 0.9, hc: 0.0, cabin: [0, 0], maxSpeed: 31, accel: 6.5, grip: 6, steer: 1.4, mass: 3.0, colors: ['#e76f51', '#2a9d8f', '#264653', '#f4a261'] },
  police: { name: 'SCPD Interceptor', len: 4.9, wid: 2.0, hb: 0.65, hc: 0.58, cabin: [-0.32, 0.15], maxSpeed: 60, accel: 16, grip: 8.5, steer: 2.2, mass: 1.3, colors: ['#f5f5f5'] },
  armored: { name: 'Kroll Armored Hauler', len: 6.4, wid: 2.5, hb: 1.9, hc: 0, cabin: [0, 0], maxSpeed: 34, accel: 8, grip: 6, steer: 1.4, mass: 4.0, armor: 3, colors: ['#3d3d46'] },
};
export const TRAFFIC_MIX = ['sedan', 'sedan', 'sedan', 'suv', 'taxi', 'taxi', 'van', 'truck', 'sports', 'muscle', 'suv', 'sedan'];

const bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.35 });
export const burntMaterial = new THREE.MeshStandardMaterial({ color: '#1c1a19', roughness: 0.95 });
const lightMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const wheelGeometry = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12).rotateZ(Math.PI / 2);
const wheelMaterial = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 });
const hubGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.32, 8).rotateZ(Math.PI / 2);
const hubMaterial = new THREE.MeshStandardMaterial({ color: '#c9ccd1', roughness: 0.3, metalness: 0.8 });
export const sirenRed = new THREE.MeshBasicMaterial({ color: '#ff2a2a', toneMapped: false });
export const sirenBlue = new THREE.MeshBasicMaterial({ color: '#4a90ff', toneMapped: false });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

export function buildVehicleMesh(typeKey, paint) {
  const t = VEHICLE_TYPES[typeKey];
  const { len: L, wid: W, hb, hc } = t;
  const base = 0.3, top = base + hb;
  const parts = [];
  const glass = '#1d2a36', trim = '#2a2a2e';
  const isBox = typeKey === 'truck' || typeKey === 'van' || typeKey === 'armored';
  if (isBox) {
    const cabLen = typeKey === 'van' ? L : 2.2;
    const cabZ = L / 2 - cabLen / 2;
    parts.push({ geometry: box(W, typeKey === 'van' ? hb : 1.9, cabLen), color: paint, matrix: makeMatrix(0, base + (typeKey === 'van' ? hb : 1.9) / 2, cabZ) });
    parts.push({ geometry: box(W * 0.92, 0.7, 0.1), color: glass, matrix: makeMatrix(0, base + (typeKey === 'van' ? hb : 1.9) - 0.5, L / 2 + 0.01) });
    parts.push({ geometry: box(W + 0.02, 0.5, cabLen * 0.4), color: glass, matrix: makeMatrix(0, base + (typeKey === 'van' ? hb : 1.9) - 0.5, L / 2 - cabLen * 0.25) });
    if (typeKey !== 'van') {
      const cargoH = typeKey === 'armored' ? 2.0 : 2.9;
      parts.push({ geometry: box(W, cargoH, L - cabLen - 0.2), color: typeKey === 'armored' ? '#4a4a55' : '#f1f1f1', matrix: makeMatrix(0, base + cargoH / 2 + 0.1, -cabLen / 2 - 0.1) });
      parts.push({ geometry: box(W + 0.04, 0.4, L - cabLen - 0.2), color: paint, matrix: makeMatrix(0, base + cargoH * 0.55, -cabLen / 2 - 0.1) });
      if (typeKey === 'armored') parts.push({ geometry: box(W * 0.5, 0.3, 0.6), color: '#b08d57', matrix: makeMatrix(0, base + 2.25, -1) });
    } else parts.push({ geometry: box(W + 0.02, 0.25, L * 0.6), color: '#ffffff', matrix: makeMatrix(0, base + hb * 0.45, -L * 0.12) });
  } else {
    parts.push({ geometry: box(W, hb, L), color: paint, matrix: makeMatrix(0, base + hb / 2, 0) });
    // Sloped hood and boot give a car silhouette.
    parts.push({ geometry: box(W * 0.98, 0.12, L * 0.3), color: paint, matrix: makeMatrix(0, top + 0.02, L * 0.33, 0.08, 0, 0) });
    const [c0, c1] = t.cabin;
    const cl = (c1 - c0) * L, cz = ((c0 + c1) / 2) * L;
    parts.push({ geometry: box(W * 0.86, hc, cl), color: glass, matrix: makeMatrix(0, top + hc / 2, cz) });
    parts.push({ geometry: box(W * 0.8, 0.08, cl * 0.72), color: typeKey === 'police' ? '#f5f5f5' : paint, matrix: makeMatrix(0, top + hc + 0.02, cz - cl * 0.05) });
    for (const s of [-1, 1]) parts.push({ geometry: box(0.06, hc, 0.12), color: paint, matrix: makeMatrix(s * W * 0.42, top + hc / 2, cz + cl * 0.3) });
  }
  parts.push({ geometry: box(W + 0.06, 0.28, 0.25), color: trim, matrix: makeMatrix(0, base + 0.15, L / 2) });
  parts.push({ geometry: box(W + 0.06, 0.28, 0.25), color: trim, matrix: makeMatrix(0, base + 0.15, -L / 2) });
  parts.push({ geometry: box(W + 0.04, 0.16, L * 0.6), color: trim, matrix: makeMatrix(0, base + 0.1, 0) });
  if (typeKey === 'police') {
    // SCPD livery: white body, a thin navy belt line with a sky-blue pinstripe and a navy hood stripe,
    // so the cruiser reads as a bright police car even in low sunset light.
    parts.push({ geometry: box(W + 0.01, 0.13, L * 0.92), color: '#16306b', matrix: makeMatrix(0, base + hb * 0.62, 0) });
    parts.push({ geometry: box(W + 0.02, 0.05, L * 0.92), color: '#4fc3ff', matrix: makeMatrix(0, base + hb * 0.62 - 0.1, 0) });
    parts.push({ geometry: box(0.36, 0.08, L * 0.28), color: '#16306b', matrix: makeMatrix(0, top + 0.05, L * 0.33, 0.08, 0, 0) });
    parts.push({ geometry: box(W * 0.75, 0.12, 0.18), color: '#1a1a1a', matrix: makeMatrix(0, base + 0.3, L / 2 + 0.2) });
  }
  if (typeKey === 'taxi') parts.push({ geometry: box(W + 0.01, 0.12, L), color: '#111111', matrix: makeMatrix(0, base + hb * 0.55, 0) });
  if (typeKey === 'sports') parts.push({ geometry: box(W * 0.9, 0.06, 0.4), color: '#111111', matrix: makeMatrix(0, top + 0.38, -L / 2 + 0.25) }, { geometry: box(0.08, 0.36, 0.1), color: '#111111', matrix: makeMatrix(0.6, top + 0.18, -L / 2 + 0.25) }, { geometry: box(0.08, 0.36, 0.1), color: '#111111', matrix: makeMatrix(-0.6, top + 0.18, -L / 2 + 0.25) });

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const shell = new THREE.Mesh(mergeParts(parts), bodyMaterial);
  shell.castShadow = true;
  body.add(shell);
  const ly = base + Math.min(hb, 0.6) * 0.6;
  const lightParts = [];
  for (const s of [-1, 1]) {
    lightParts.push({ geometry: box(0.42, 0.16, 0.06), color: '#fffbe0', matrix: makeMatrix(s * (W / 2 - 0.3), ly, L / 2 + 0.13) });
    lightParts.push({ geometry: box(0.4, 0.14, 0.06), color: '#ff1a1a', matrix: makeMatrix(s * (W / 2 - 0.28), ly, -L / 2 - 0.13) });
  }
  if (typeKey === 'taxi') lightParts.push({ geometry: box(0.8, 0.28, 0.3), color: '#fff3a0', matrix: makeMatrix(0, top + hc + 0.2, -0.2) });
  body.add(new THREE.Mesh(mergeParts(lightParts), lightMaterial));
  const sirens = [];
  if (typeKey === 'police') {
    const red = new THREE.Mesh(box(0.72, 0.22, 0.36), sirenRed), blue = new THREE.Mesh(box(0.72, 0.22, 0.36), sirenBlue);
    red.position.set(-0.4, top + hc + 0.16, -0.1); blue.position.set(0.4, top + hc + 0.16, -0.1);
    body.add(red, blue);
    sirens.push(red, blue);
  }
  const wheels = [];
  const wx = W / 2 - 0.12, wz = L / 2 - (isBox ? 1.0 : 0.85);
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * wx, 0.38, sz * wz);
    const w = new THREE.Mesh(wheelGeometry, wheelMaterial);
    w.add(new THREE.Mesh(hubGeometry, hubMaterial));
    w.castShadow = true;
    pivot.add(w);
    root.add(pivot);
    wheels.push({ pivot, wheel: w, front: sz > 0 });
  }
  return { root, body, shell, wheels, sirens, headLocal: [new THREE.Vector3(-(W / 2 - 0.3), ly, L / 2 + 0.2), new THREE.Vector3(W / 2 - 0.3, ly, L / 2 + 0.2)], tailLocal: [new THREE.Vector3(-(W / 2 - 0.28), ly, -L / 2 - 0.2), new THREE.Vector3(W / 2 - 0.28, ly, -L / 2 - 0.2)] };
}
