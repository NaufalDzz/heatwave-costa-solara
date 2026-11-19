// Low-poly people built from boxes: a torso-and-head mesh plus two arms and two legs on pivots
// so they can walk, run, aim and fall. Looks (skin, clothes, hair, hats) come from palettes or
// fixed outfits for the hero, police and the two gangs.
import * as THREE from 'three';
import { mergeParts, makeMatrix } from '../world/meshBuilder.js';

const SKIN = ['#f1c7a5', '#d9a07a', '#a86b4a', '#7a4a32', '#e8b48f', '#c68863'];
const SHIRTS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#f7fff7', '#1a535c', '#ff9f1c', '#c77dff', '#80ed99', '#ffafcc', '#3a86ff', '#ffffff'];
const PANTS = ['#2b2d42', '#8d99ae', '#d6ccc2', '#3d405b', '#6b705c', '#264653', '#f4f1de'];
const HAIR = ['#1b1b1b', '#3b2416', '#6f4e37', '#d4a373', '#2f2f2f', '#8b5a2b'];

export const OUTFITS = {
  hero: { skin: '#d9a07a', shirt: '#17b3a8', pants: '#d8c7a3', hair: '#1b1b1b', shoes: '#f5f5f5', accent: '#ffd166' },
  cop: { skin: null, shirt: '#22325a', pants: '#1a2440', hair: null, hat: '#141c33', shoes: '#111111', accent: '#e0c050' },
  swat: { skin: null, shirt: '#2a2f36', pants: '#2a2f36', hair: null, hat: '#1c1f24', shoes: '#111111', accent: '#3d444d' },
  kroll: { skin: null, shirt: '#1d1d24', pants: '#141418', hair: null, shoes: '#0a0a0a', accent: '#9b5de5' },
  coyote: { skin: null, shirt: '#f77f00', pants: '#3d3d3d', hair: null, hat: '#222222', shoes: '#111111', accent: '#fcbf49' },
};

export function randomLook(rng) {
  return { skin: rng.pick(SKIN), shirt: rng.pick(SHIRTS), pants: rng.pick(PANTS), hair: rng.pick(HAIR), shoes: rng.pick(['#222', '#eee', '#7a5230']), hat: rng.chance(0.15) ? rng.pick(['#f5deb3', '#222', '#ff6b6b']) : null, accent: rng.pick(SHIRTS) };
}

const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

export function createHumanoidModel(look, rng) {
  const l = { ...look };
  if (!l.skin) l.skin = rng.pick(SKIN);
  if (!l.hair) l.hair = rng.pick(HAIR);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torsoParts = [
    { geometry: box(0.52, 0.62, 0.28), color: l.shirt, matrix: makeMatrix(0, 1.27, 0) },
    { geometry: box(0.5, 0.14, 0.27), color: l.pants, matrix: makeMatrix(0, 0.93, 0) },
    { geometry: box(0.14, 0.1, 0.14), color: l.skin, matrix: makeMatrix(0, 1.62, 0) },
    { geometry: box(0.28, 0.3, 0.28), color: l.skin, matrix: makeMatrix(0, 1.8, 0) },
    { geometry: box(0.3, 0.1, 0.3), color: l.hair, matrix: makeMatrix(0, 1.97, -0.01) },
    { geometry: box(0.3, 0.18, 0.08), color: l.hair, matrix: makeMatrix(0, 1.86, -0.13) },
    { geometry: box(0.2, 0.05, 0.02), color: '#1a1a1a', matrix: makeMatrix(0, 1.83, 0.145) },
    { geometry: box(0.53, 0.06, 0.29), color: l.accent, matrix: makeMatrix(0, 1.0, 0) },
  ];
  if (l.hat) torsoParts.push({ geometry: box(0.33, 0.1, 0.34), color: l.hat, matrix: makeMatrix(0, 2.0, 0) }, { geometry: box(0.3, 0.03, 0.16), color: l.hat, matrix: makeMatrix(0, 1.96, 0.22) });
  const torso = new THREE.Mesh(mergeParts(torsoParts), material);
  torso.castShadow = true;
  body.add(torso);
  const limb = (parts, px, py) => {
    const pivot = new THREE.Group();
    pivot.position.set(px, py, 0);
    const m = new THREE.Mesh(mergeParts(parts), material);
    m.castShadow = true;
    pivot.add(m);
    body.add(pivot);
    return pivot;
  };
  const legParts = [
    { geometry: box(0.21, 0.82, 0.24), color: l.pants, matrix: makeMatrix(0, -0.41, 0) },
    { geometry: box(0.22, 0.1, 0.32), color: l.shoes, matrix: makeMatrix(0, -0.86, 0.04) },
  ];
  const armParts = (withSkin) => [
    { geometry: box(0.15, 0.34, 0.16), color: l.shirt, matrix: makeMatrix(0, -0.17, 0) },
    { geometry: box(0.13, 0.36, 0.14), color: withSkin, matrix: makeMatrix(0, -0.52, 0) },
  ];
  const legL = limb(legParts, -0.13, 0.92), legR = limb(legParts, 0.13, 0.92);
  const armL = limb(armParts(l.skin), -0.34, 1.53), armR = limb(armParts(l.skin), 0.34, 1.53);
  const gun = new THREE.Mesh(box(0.08, 0.14, 0.42), new THREE.MeshStandardMaterial({ color: '#1c1c1c', roughness: 0.4, metalness: 0.6 }));
  gun.position.set(0, -0.68, 0.16);
  gun.visible = false;
  armR.add(gun);
  return { root, body, legL, legR, armL, armR, gun, look: l };
}
