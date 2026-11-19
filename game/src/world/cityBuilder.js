// Turns the city layout into batched meshes: ground, roads with markings, junctions, raised
// sidewalks, parks and lots, every building (stepped glass towers, art-deco hotels, brick
// nightlife blocks, pastel houses with tiled roofs, sheds), shopfronts, rooftop clutter, neon
// signs and billboards. Returns the group plus the materials whose windows light up at night.
import * as THREE from 'three';
import { GeometryBuilder } from './meshBuilder.js';
import { facadeTexture, storefrontTexture, roadTexture, junctionTexture, surfaceTexture, signTexture, billboardTexture } from './textures.js';
import { GRID, HALF_ROAD, roadCoord, ISLAND, ISLAND_ROAD_X, COAST } from './cityLayout.js';
import { createRng } from '../core/rng.js';

const SIGNS = [['CLUB AZURE', '#3cf0ff'], ['MOTEL FLAMINGO', '#ff4fb0'], ['BAR 77', '#ffd23c'], ['TACO LUNA', '#7dff6a'],
  ['ARCADE', '#c77dff'], ['VOLT LOUNGE', '#40a8ff'], ['PINK PALMS', '#ff6fd8'], ['KARAOKE', '#ff8c3c']];

function mesh(geometry, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast; m.receiveShadow = receive;
  m.matrixAutoUpdate = false; m.updateMatrix();
  return m;
}

export function buildCity(layout) {
  const group = new THREE.Group();
  const rng = createRng(layout.seed + 3);
  const night = [];
  const std = (opts) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, ...opts });

  // --- Ground, roads and sidewalks ---------------------------------------------------------
  const ground = new GeometryBuilder();
  ground.flat(-760, -760, COAST, COAST, -0.02, '#9fae6c', 6);
  ground.flat(ISLAND.x0, ISLAND.z0, ISLAND.x1, ISLAND.z1, -0.02, '#b8b48a', 6);
  const grass = surfaceTexture('grass');
  group.add(mesh(ground.build(), std({ map: grass }), { cast: false }));

  const roads = new GeometryBuilder(), junctions = new GeometryBuilder();
  const white = new THREE.Color('#ffffff');
  const hRoad = (x0, x1, z) => roads.quad([x0, 0.02, z + HALF_ROAD], [x1, 0.02, z + HALF_ROAD], [x1, 0.02, z - HALF_ROAD], [x0, 0.02, z - HALF_ROAD], [x0 / 16, 1, x1 / 16, 1, x1 / 16, 0, x0 / 16, 0], white);
  const vRoad = (z0, z1, x) => roads.quad([x - HALF_ROAD, 0.02, z1], [x + HALF_ROAD, 0.02, z1], [x + HALF_ROAD, 0.02, z0], [x - HALF_ROAD, 0.02, z0], [z1 / 16, 0, z1 / 16, 1, z0 / 16, 1, z0 / 16, 0], white);
  const junction = (x, z) => junctions.quad([x - HALF_ROAD, 0.025, z + HALF_ROAD], [x + HALF_ROAD, 0.025, z + HALF_ROAD], [x + HALF_ROAD, 0.025, z - HALF_ROAD], [x - HALF_ROAD, 0.025, z - HALF_ROAD], [0, 1, 1, 1, 1, 0, 0, 0], white);
  for (let k = 0; k <= GRID; k++) for (let i = 0; i < GRID; i++) {
    hRoad(roadCoord(i) + HALF_ROAD, roadCoord(i + 1) - HALF_ROAD, roadCoord(k));
    vRoad(roadCoord(i) + HALF_ROAD, roadCoord(i + 1) - HALF_ROAD, roadCoord(k));
  }
  for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) junction(roadCoord(i), roadCoord(j));
  for (const z of [-160, 160]) { hRoad(512, ISLAND_ROAD_X - HALF_ROAD, z); junction(ISLAND_ROAD_X, z); }
  vRoad(-160 + HALF_ROAD, 160 - HALF_ROAD, ISLAND_ROAD_X);
  // Stub roads that lead out of the grid into the hills, so the edges do not end in grass.
  for (const z of [roadCoord(2), roadCoord(5), roadCoord(8)]) hRoad(-700, roadCoord(0) - HALF_ROAD, z);
  for (const x of [roadCoord(3), roadCoord(7)]) vRoad(-700, roadCoord(0) - HALF_ROAD, x);
  group.add(mesh(roads.build(), std({ map: roadTexture(), roughness: 0.92 }), { cast: false }));
  group.add(mesh(junctions.build(), std({ map: junctionTexture(), roughness: 0.92 }), { cast: false }));

  const walks = new GeometryBuilder(), parks = new GeometryBuilder(), plazas = new GeometryBuilder(), lots = new GeometryBuilder();
  for (const b of layout.blocks) {
    walks.box(b.bx0, -0.1, b.bz0, b.bx1, 0.18, b.bz1, '#ffffff', { su: 4, sv: 4 });
    if (b.kind === 'park' || b.district === 'heights') parks.flat(b.ix0, b.iz0, b.ix1, b.iz1, 0.19, b.kind === 'park' ? '#ffffff' : '#e8f0d0', 5);
    else if (b.kind === 'lot' || b.district === 'ironworks') lots.flat(b.ix0, b.iz0, b.ix1, b.iz1, 0.19, '#ffffff', 5);
    else plazas.flat(b.ix0, b.iz0, b.ix1, b.iz1, 0.19, b.district === 'palmera' ? '#fff0e0' : '#ffffff', 4);
  }
  // Island promenade and sidewalks beside the island roads.
  walks.box(ISLAND.x0 + 2, -0.1, ISLAND.z0 + 2, ISLAND.x1 - 2, 0.12, ISLAND.z1 - 2, '#f3e6d0', { su: 4, sv: 4, sides: true });
  group.add(mesh(walks.build(), std({ map: surfaceTexture('sidewalk') }), { cast: false }));
  group.add(mesh(parks.build(), std({ map: grass }), { cast: false }));
  group.add(mesh(plazas.build(), std({ map: surfaceTexture('plaza') }), { cast: false }));
  group.add(mesh(lots.build(), std({ map: surfaceTexture('lot') }), { cast: false }));

  // --- Buildings ---------------------------------------------------------------------------
  const facades = {}, roofs = new GeometryBuilder(), shops = new GeometryBuilder(), detail = new GeometryBuilder(), tiles = new GeometryBuilder();
  const facadeOf = (style) => (facades[style] ||= new GeometryBuilder());
  const beacons = [];
  const signBuilders = new Map();
  const billboards = [];
  for (const b of layout.buildings) {
    const tex = facadeTexture(b.style === 'house' || b.style === 'deco' ? (b.style === 'deco' ? 'deco' : 'stucco') : b.style);
    const fb = facadeOf(b.style);
    const opts = { su: tex.su, sv: tex.sv, uo: Math.floor(b.seed * 8) / 4, top: false };
    const color = new THREE.Color(b.color);
    const cuts = [0, ...(b.tiers || []), 1];
    let inset = 0;
    for (let t = 0; t < cuts.length - 1; t++) {
      const y0 = b.h * cuts[t], y1 = b.h * cuts[t + 1];
      const x0 = b.x0 + inset, z0 = b.z0 + inset, x1 = b.x1 - inset, z1 = b.z1 - inset;
      fb.box(x0, y0, z0, x1, y1, z1, color, opts);
      roofs.flat(x0, z0, x1, z1, y1, '#ffffff', 6);
      // Parapet lip around each roof.
      detail.box(x0 - 0.2, y1, z0 - 0.2, x1 + 0.2, y1 + 0.8, z0 + 0.3, b.style === 'deco' ? '#ffffff' : '#cfcac2');
      detail.box(x0 - 0.2, y1, z1 - 0.3, x1 + 0.2, y1 + 0.8, z1 + 0.2, b.style === 'deco' ? '#ffffff' : '#cfcac2');
      inset += Math.min(x1 - x0, z1 - z0) * 0.14;
    }
    const top = b.h, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const w = b.x1 - b.x0, d = b.z1 - b.z0;
    if (b.style !== 'house' && b.style !== 'industrial') {
      const shopTex = storefrontTexture();
      shops.box(b.x0 - 0.15, 0, b.z0 - 0.15, b.x1 + 0.15, 4.5, b.z1 + 0.15, '#ffffff', { su: shopTex.su, sv: shopTex.sv, uo: b.seed, top: false });
      detail.box(b.x0 - 0.6, 4.5, b.z0 - 0.6, b.x1 + 0.6, 5.0, b.z1 + 0.6, b.style === 'glass' ? '#d8dde2' : '#f7f3ea');
    }
    if (b.roof === 'house') {
      // Terracotta hip roof.
      const e = 0.6, y = top, ry = top + Math.min(w, d) * 0.35;
      const x0 = b.x0 - e, x1 = b.x1 + e, z0 = b.z0 - e, z1 = b.z1 + e;
      const rx0 = cx - Math.max(0, (w - d) / 2), rx1 = cx + Math.max(0, (w - d) / 2);
      const rz0 = cz - Math.max(0, (d - w) / 2), rz1 = cz + Math.max(0, (d - w) / 2);
      const tc = new THREE.Color(rng.pick(['#c8553d', '#d36b46', '#b9483a', '#8d6e63']));
      const uv = [0, 0, 1, 0, 1, 1, 0, 1];
      tiles.quad([x0, y, z1], [x1, y, z1], [rx1, ry, rz1], [rx0, ry, rz1], uv, tc);
      tiles.quad([x1, y, z0], [x0, y, z0], [rx0, ry, rz0], [rx1, ry, rz0], uv, tc);
      tiles.quad([x1, y, z1], [x1, y, z0], [rx1, ry, rz0], [rx1, ry, rz1], uv, tc);
      tiles.quad([x0, y, z0], [x0, y, z1], [rx0, ry, rz1], [rx0, ry, rz0], uv, tc);
    } else if (b.roof === 'heli') {
      const r = Math.min(w, d) * 0.3;
      detail.box(cx - r, top, cz - r, cx + r, top + 1.2, cz + r, '#4a4f55');
      detail.box(cx - r * 0.5, top + 1.2, cz - 0.6, cx + r * 0.5, top + 1.25, cz + 0.6, '#f5f5f5');
      detail.box(cx - r * 0.5, top + 1.2, cz - r * 0.6, cx - r * 0.35, top + 1.25, cz + r * 0.6, '#f5f5f5');
      detail.box(cx + r * 0.35, top + 1.2, cz - r * 0.6, cx + r * 0.5, top + 1.25, cz + r * 0.6, '#f5f5f5');
      detail.box(b.x0 + 1, top, b.z0 + 1, b.x0 + 1.4, top + 14, b.z0 + 1.4, '#c0c0c0');
      beacons.push(new THREE.Vector3(b.x0 + 1.2, top + 14.3, b.z0 + 1.2));
    } else if (b.roof === 'deco') {
      const accent = rng.pick(['#00a6a6', '#ff6f91', '#ffb703', '#5390d9']);
      detail.box(cx - 0.8, top - b.h * 0.35, b.z1, cx + 0.8, top + 4, b.z1 + 0.8, accent);
      detail.box(b.x0 - 0.3, top - 1.6, b.z0 - 0.3, b.x1 + 0.3, top - 0.9, b.z1 + 0.3, accent);
    } else {
      // Mechanical clutter: air-con boxes and a water tank.
      const n = b.style === 'industrial' ? 3 : 2 + Math.floor(b.seed * 3);
      const inner = (b.tiers ? Math.min(w, d) * 0.28 : 0) + 2;
      for (let k = 0; k < n; k++) {
        const ax = b.x0 + inner + ((b.seed * 7.3 + k * 0.37) % 1) * Math.max(1, w - inner * 2 - 3);
        const az = b.z0 + inner + ((b.seed * 3.1 + k * 0.61) % 1) * Math.max(1, d - inner * 2 - 3);
        detail.box(ax, top, az, ax + 2.6, top + 1.6, az + 2, '#b9bcbf');
      }
      if (b.h > 25 && b.seed > 0.5) {
        const tx = b.x1 - inner - 3, tz = b.z1 - inner - 3;
        detail.box(tx, top, tz, tx + 3, top + 4.5, tz + 3, '#8d6e63');
        beacons.push(new THREE.Vector3(tx + 1.5, top + 5, tz + 1.5));
      }
    }
    if (b.sign) {
      const [text, colorHex] = SIGNS[Math.floor(b.seed * SIGNS.length)];
      const sb = signBuilders.get(text) || signBuilders.set(text, { b: new GeometryBuilder(), color: colorHex }).get(text);
      const y = Math.min(b.h - 2, 7 + b.seed * 6), x = b.sign === 'west' ? b.x0 - 0.4 : b.x1 + 0.4;
      const sw = Math.min(14, d - 2) / 2, sh = sw / 4 * 1.0;
      const uv = [0, 0, 1, 0, 1, 1, 0, 1];
      if (b.sign === 'east') sb.b.quad([x, y - sh, cz + sw], [x, y - sh, cz - sw], [x, y + sh, cz - sw], [x, y + sh, cz + sw], uv, white);
      else sb.b.quad([x, y - sh, cz - sw], [x, y - sh, cz + sw], [x, y + sh, cz + sw], [x, y + sh, cz - sw], uv, white);
    }
    if ((b.style === 'glass' || b.style === 'stucco') && b.h > 20 && b.h < 70 && b.seed < 0.22) billboards.push(b);
  }
  for (const [style, fb] of Object.entries(facades)) {
    const tex = facadeTexture(style === 'house' ? 'stucco' : style);
    const mat = std({ map: tex.map, emissiveMap: tex.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0,
      roughness: style === 'glass' ? 0.3 : 0.85, metalness: style === 'glass' ? 0.25 : 0 });
    night.push(mat);
    group.add(mesh(fb.build(), mat));
  }
  const shopTex = storefrontTexture();
  const shopMat = std({ map: shopTex.map, emissiveMap: shopTex.emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.15 });
  night.push(shopMat);
  group.add(mesh(shops.build(), shopMat));
  group.add(mesh(roofs.build(), std({ map: surfaceTexture('roof') }), { cast: false }));
  group.add(mesh(detail.build(), std({ roughness: 0.7 })));
  group.add(mesh(tiles.build(), std({ roughness: 0.8, flatShading: true })));
  const signMats = [];
  for (const [text, { b, color }] of signBuilders) {
    const mat = new THREE.MeshBasicMaterial({ map: signTexture(text, color), toneMapped: false, side: THREE.DoubleSide });
    signMats.push(mat);
    group.add(mesh(b.build(), mat, { cast: false, receive: false }));
  }
  const posters = [['SOLARA COLA', 'Taste the sunset', 12], ['KROLL HOLDINGS', 'Building tomorrow. Owning today.', 210], ['WAVE 101.7', 'Synth from the coast', 290], ['SUNLINE CABS', 'Call 555-0199', 45]];
  billboards.forEach((b, k) => {
    const [title, sub, hue] = posters[k % posters.length];
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: billboardTexture(title, sub, hue), side: THREE.DoubleSide }));
    bm.position.set((b.x0 + b.x1) / 2, b.h + 6, b.z1 - 1);
    group.add(bm);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(14, 2, 0.4), new THREE.MeshStandardMaterial({ color: '#444' }));
    legs.position.set(bm.position.x, b.h + 1, b.z1 - 1.3);
    group.add(legs);
  });
  return { group, nightMaterials: night, signMaterials: signMats, beacons };
}
