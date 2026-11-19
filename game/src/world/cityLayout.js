// The map of Costa Solara as plain data, no meshes: the road grid and its graph, the districts,
// every building footprint and height, the coast, beach, channel, Marina Azul island, bridges,
// stunt ramps and named places. The renderer, the minimap, collisions and every AI read this.
import { createRng, hash2 } from '../core/rng.js';

export const BLOCK = 80, GRID = 10, ORIGIN = -400, HALF_ROAD = 7, WALK = 4;
export const COAST = 420, BEACH_END = 500;
export const ISLAND = { x0: 500, x1: 690, z0: -260, z1: 260 };
export const BRIDGES = [{ z: -160, x0: 408, x1: 512, h: 7 }, { z: 160, x0: 408, x1: 512, h: 7 }];
export const ISLAND_ROAD_X = 590;
export const roadCoord = (i) => ORIGIN + i * BLOCK;

export const DISTRICTS = {
  downtown: { name: 'Downtown Solano', color: '#7fb6e6' },
  neon: { name: 'Neon Row', color: '#ff5fd2' },
  palmera: { name: 'Palmera Beach', color: '#ffd27a' },
  heights: { name: 'Sunset Heights', color: '#f6a38f' },
  ironworks: { name: 'Ironworks Yard', color: '#b0aaa2' },
  midtown: { name: 'Midtown Vista', color: '#9fd3e8' },
  marina: { name: 'Marina Azul', color: '#5fe0e6' },
  hills: { name: 'Cerro Verde', color: '#8cc265' },
};

const PALETTES = {
  glass: ['#bfe3ff', '#d4ecff', '#a9d8f0', '#c8f0f0', '#e0d4ff', '#ffd9c2'],
  stucco: ['#f2d4b6', '#f6e7cf', '#e8c3a5', '#f1d0c8', '#ead8b1'],
  deco: ['#ffd1dc', '#b8f0e6', '#fff1b8', '#ffc9a8', '#cfe8ff', '#f8c8f0'],
  brick: ['#b9715a', '#9a5a4a', '#c98e6b', '#7f5a6e', '#a6706a'],
  house: ['#ffe0c2', '#ffd6e0', '#d7f2e3', '#fff4c9', '#e3dcff', '#ffc7a6'],
  industrial: ['#a8aaa6', '#9aa4ad', '#b4a48c', '#8f9a8c'],
};

export function districtOfBlock(bi, bj) {
  if (bj >= 8) return 'palmera';
  if (bi <= 2) return 'heights';
  if (bi >= 7 && bj >= 4) return 'neon';
  if (bi >= 6 && bj <= 3) return 'ironworks';
  if (bi >= 3 && bi <= 6 && bj >= 2 && bj <= 6) return 'downtown';
  return 'midtown';
}

export function isIsland(x, z) {
  return x >= ISLAND.x0 && x <= ISLAND.x1 && z >= ISLAND.z0 && z <= ISLAND.z1;
}
export function isLand(x, z) {
  return (x >= -700 && x <= COAST && z >= -700 && z <= BEACH_END) || isIsland(x, z);
}
export function districtAt(x, z) {
  if (isIsland(x, z) || x > COAST) return 'marina';
  if (x < ORIGIN - 10 || z < ORIGIN - 10) return 'hills';
  if (z > roadCoord(GRID) - 10) return 'palmera';
  const bi = Math.max(0, Math.min(GRID - 1, Math.floor((x - ORIGIN) / BLOCK)));
  const bj = Math.max(0, Math.min(GRID - 1, Math.floor((z - ORIGIN) / BLOCK)));
  return districtOfBlock(bi, bj);
}

// Hand-placed blocks that are not built up.
const SPECIAL = { '4,4': 'park', '1,7': 'park', '8,8': 'park', '7,1': 'lot', '2,2': 'lot', '5,7': 'lot' };

function addTower(out, rng, cx, cz, w, d, h, color) {
  out.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, h, style: 'glass', color,
    tiers: h > 60 ? [0.55, 0.8] : [0.7], roof: h > 90 ? 'heli' : 'mech', seed: rng.next() });
}

function buildBlock(block, rng) {
  const out = [];
  const { ix0, iz0, ix1, iz1, district } = block;
  const W = ix1 - ix0, D = iz1 - iz0;
  const pal = (s) => rng.pick(PALETTES[s]);
  const grid = (nx, nz, gap, fn) => {
    const cw = (W - gap * (nx - 1)) / nx, cd = (D - gap * (nz - 1)) / nz;
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      fn(ix0 + a * (cw + gap), iz0 + b * (cd + gap), cw, cd, a, b);
    }
  };
  if (district === 'downtown') {
    if (rng.chance(0.5)) addTower(out, rng, (ix0 + ix1) / 2, (iz0 + iz1) / 2, rng.range(30, 42), rng.range(30, 42), rng.range(85, 165), pal('glass'));
    else {
      addTower(out, rng, ix0 + 13, (iz0 + iz1) / 2, 24, rng.range(40, 54), rng.range(55, 120), pal('glass'));
      addTower(out, rng, ix1 - 13, (iz0 + iz1) / 2, 24, rng.range(34, 50), rng.range(45, 105), pal('glass'));
    }
  } else if (district === 'midtown') {
    grid(2, 2, 4, (x, z, w, d) => {
      if (rng.chance(0.12)) return;
      const glass = rng.chance(0.4);
      out.push({ x0: x, z0: z, x1: x + w, z1: z + d, h: rng.range(16, glass ? 60 : 40), style: glass ? 'glass' : 'stucco', color: pal(glass ? 'glass' : 'stucco'), tiers: rng.chance(0.4) ? [0.75] : null, roof: 'mech', seed: rng.next() });
    });
  } else if (district === 'neon') {
    grid(2, 3, 2, (x, z, w, d, a) => {
      out.push({ x0: x, z0: z, x1: x + w, z1: z + d, h: rng.range(10, 34), style: 'brick', color: pal('brick'), sign: a === 0 ? 'west' : 'east', roof: 'mech', seed: rng.next() });
    });
  } else if (district === 'palmera') {
    grid(2, 2, 6, (x, z, w, d) => {
      out.push({ x0: x + 1, z0: z + 1, x1: x + w - 1, z1: z + d - 1, h: rng.range(12, 32), style: 'deco', color: pal('deco'), tiers: rng.chance(0.5) ? [0.8] : null, roof: 'deco', seed: rng.next() });
    });
  } else if (district === 'heights') {
    grid(3, 3, 6, (x, z, w, d) => {
      if (rng.chance(0.18)) return;
      const shrink = rng.range(0.5, 2);
      out.push({ x0: x + shrink, z0: z + shrink, x1: x + w - shrink, z1: z + d - shrink, h: rng.range(5, 11), style: 'house', color: pal('house'), roof: 'house', seed: rng.next() });
    });
  } else if (district === 'ironworks') {
    const split = rng.chance(0.5);
    if (split) {
      out.push({ x0: ix0, z0: iz0, x1: ix1, z1: iz0 + 24, h: rng.range(9, 14), style: 'industrial', color: pal('industrial'), roof: 'shed', seed: rng.next() });
      out.push({ x0: ix0 + 6, z0: iz1 - 22, x1: ix1 - 18, z1: iz1, h: rng.range(8, 12), style: 'industrial', color: pal('industrial'), roof: 'shed', seed: rng.next() });
    } else {
      out.push({ x0: ix0 + 4, z0: iz0 + 4, x1: ix1 - 4, z1: iz1 - 20, h: rng.range(10, 15), style: 'industrial', color: pal('industrial'), roof: 'shed', seed: rng.next() });
    }
  }
  return out;
}

export function createCityLayout(seed = 1987) {
  const rng = createRng(seed);
  const blocks = [];
  const buildings = [];
  for (let bj = 0; bj < GRID; bj++) for (let bi = 0; bi < GRID; bi++) {
    const bx0 = roadCoord(bi) + HALF_ROAD, bx1 = roadCoord(bi + 1) - HALF_ROAD;
    const bz0 = roadCoord(bj) + HALF_ROAD, bz1 = roadCoord(bj + 1) - HALF_ROAD;
    const district = districtOfBlock(bi, bj);
    const kind = SPECIAL[`${bi},${bj}`] || 'built';
    const block = { bi, bj, bx0, bz0, bx1, bz1, ix0: bx0 + WALK, iz0: bz0 + WALK, ix1: bx1 - WALK, iz1: bz1 - WALK, district, kind };
    blocks.push(block);
    if (kind === 'built') buildings.push(...buildBlock(block, rng));
  }
  // Marina Azul: harbour offices, a hotel tower and boat sheds along the island road.
  const islandRng = createRng(seed + 7);
  for (const [x0, z0, x1, z1, h, style] of [
    [606, -250, 640, -200, 38, 'glass'], [606, -120, 636, -40, 14, 'deco'], [606, 40, 650, 110, 22, 'deco'],
    [540, -130, 576, -60, 10, 'industrial'], [540, 60, 576, 130, 12, 'stucco'], [606, 196, 640, 250, 64, 'glass'],
  ]) buildings.push({ x0, z0, x1, z1, h, style, color: islandRng.pick(PALETTES[style]), roof: 'mech', seed: islandRng.next(), tiers: h > 40 ? [0.7] : null });

  // Road graph: grid intersections plus the two island junctions past the bridges.
  const N = GRID + 1;
  const nodes = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) nodes.push({ id: j * N + i, x: roadCoord(i), z: roadCoord(j), links: [] });
  const isl0 = nodes.length, isl1 = isl0 + 1;
  nodes.push({ id: isl0, x: ISLAND_ROAD_X, z: -160, links: [] }, { id: isl1, x: ISLAND_ROAD_X, z: 160, links: [] });
  const link = (a, b) => { nodes[a].links.push(b); nodes[b].links.push(a); };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (i < N - 1) link(j * N + i, j * N + i + 1);
    if (j < N - 1) link(j * N + i, (j + 1) * N + i);
  }
  link(3 * N + GRID, isl0); link(7 * N + GRID, isl1); link(isl0, isl1);
  const roads = [];
  for (let k = 0; k < N; k++) {
    roads.push({ x0: roadCoord(0), z0: roadCoord(k), x1: roadCoord(GRID), z1: roadCoord(k), main: k === GRID || k === 5 });
    roads.push({ x0: roadCoord(k), z0: roadCoord(0), x1: roadCoord(k), z1: roadCoord(GRID), main: k === 5 });
  }
  roads.push({ x0: roadCoord(GRID), z0: -160, x1: ISLAND_ROAD_X, z1: -160, bridge: true });
  roads.push({ x0: roadCoord(GRID), z0: 160, x1: ISLAND_ROAD_X, z1: 160, bridge: true });
  roads.push({ x0: ISLAND_ROAD_X, z0: -160, x1: ISLAND_ROAD_X, z1: 160 });

  const ramps = [
    { x: -40, z: 446, dx: 0, dz: 1, len: 14, w: 7, h: 3.4, name: 'Boardwalk Leap' },
    { x: 180, z: -280, dx: 1, dz: 0, len: 14, w: 7, h: 3.8, name: 'Scrapyard Hop' },
    { x: -470, z: 0, dx: -1, dz: 0, len: 16, w: 7, h: 4.2, name: 'Cerro Launch' },
    { x: 650, z: -150, dx: 0, dz: -1, len: 14, w: 7, h: 3.6, name: 'Marina Flyer' },
    { x: -200, z: -225, dx: 0, dz: 1, len: 12, w: 7, h: 3.0, name: 'Lot Gap' },
  ];
  rampList = ramps;

  const pois = {
    safehouse: { x: -112, z: 391, name: 'Casa Sol Safehouse', icon: 'house', color: '#7CFC8A' },
    garage: { x: -280, z: 11, name: 'Wrench Works Garage', icon: 'wrench', color: '#4fc3f7' },
    gunshop: { x: 200, z: 91, name: 'Brass & Barrel Arms', icon: 'gun', color: '#ff7043' },
    hospital: { x: -40, z: -309, name: 'St. Maren Medical', icon: 'cross', color: '#ffffff' },
    police: { x: 120, z: -69, name: 'SCPD Precinct 3', icon: 'badge', color: '#5c8dff' },
    taxi: { x: 40, z: 251, name: 'Sunline Cab Depot', icon: 'taxi', color: '#ffd600' },
    race: { x: 330, z: 395, name: 'Ocean Mile Races', icon: 'flag', color: '#e040fb' },
  };

  // Sun tokens: hidden collectibles scattered over sidewalks, beach, hills and the island.
  const tokenRng = createRng(seed + 99);
  const tokens = [];
  for (let k = 0; k < 30; k++) {
    let x, z;
    if (k % 6 === 5) { x = tokenRng.range(-380, 400); z = tokenRng.range(430, 490); }
    else if (k % 6 === 4) { x = tokenRng.range(560, 680); z = tokenRng.range(-240, 240); }
    else { const b = tokenRng.pick(blocks); x = b.bx0 + 2; z = tokenRng.range(b.bz0 + 2, b.bz1 - 2); }
    tokens.push({ id: k, x, z });
  }
  return { seed, blocks, buildings, nodes, roads, ramps, pois, tokens, heightAt, isLand, districtAt };
}

export function rampHeight(r, x, z) {
  const ax = x - r.x, az = z - r.z;
  const along = ax * r.dx + az * r.dz, across = -ax * r.dz + az * r.dx;
  if (along < 0 || along > r.len || Math.abs(across) > r.w / 2) return -Infinity;
  return (r.h * along) / r.len;
}

let rampList = [];

/** Ground height under (x, z): bridge decks arc over the channel, ramps rise, water sits at -3. */
export function heightAt(x, z) {
  for (const b of BRIDGES) {
    if (Math.abs(z - b.z) <= 8 && x >= b.x0 && x <= b.x1) return b.h * Math.sin((Math.PI * (x - b.x0)) / (b.x1 - b.x0));
  }
  let h = -Infinity;
  for (const r of rampList) h = Math.max(h, rampHeight(r, x, z));
  if (h > -Infinity) return h;
  return isLand(x, z) ? 0 : -3;
}

/** A 0..1 hash for deterministic per-thing variation. */
export const variation = (x, z) => hash2(Math.floor(x * 10), Math.floor(z * 10));
