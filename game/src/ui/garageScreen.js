// The Wrench Works / Brass & Barrel shop screen: the player's car turning on a lit turntable in
// the workshop, its stat bars, cash, and the CAR UPGRADES and WEAPONS lists with prices, stages,
// OWNED and LOCKED rows. Opens when you drive into the garage or walk into the gun store.
import * as THREE from 'three';
import { buildVehicleMesh } from '../vehicles/vehicleModels.js';
import { drawPortrait } from '../missions/storyCast.js';
import { formatMoney } from '../core/mathUtils.js';

const LINES = { car: '"You break it, I bolt it back on. Faster."', weapons: '"Brass & Barrel stock, my cousin\'s counter. Cash only."' };

function neonSign(text) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 192;
  const g = c.getContext('2d');
  g.font = 'italic 900 120px "Arial Black", "Noto Sans", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#ff4fa3'; g.shadowBlur = 30; g.fillStyle = '#ffd6f0';
  g.fillText(text, 512, 100); g.fillText(text, 512, 100);
  return new THREE.CanvasTexture(c);
}

/** The workshop set: floor, turntable, walls with neon strips and sign, tyre stacks and lights. */
function buildWorkshop() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#120d1c');
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });
  const glow = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), std('#2b2733', { roughness: 0.35, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  const table = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.6, 0.22, 48), std('#3d3a48', { metalness: 0.6, roughness: 0.3 }));
  table.position.y = 0.11; table.receiveShadow = true;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.07, 8, 64), glow('#ff4fa3'));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.23;
  const back = new THREE.Mesh(new THREE.BoxGeometry(40, 12, 0.5), std('#231d30'));
  back.position.set(0, 6, -9);
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.5, 12, 30), std('#1d1828'));
  side.position.set(-11, 6, 0);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.25), new THREE.MeshBasicMaterial({ map: neonSign('WRENCH WORKS'), transparent: true, toneMapped: false }));
  sign.position.set(0, 7.4, -8.7);
  scene.add(floor, table, ring, back, side, sign);
  for (const [y, c] of [[3.2, '#2fe6d8'], [9.6, '#ff4fa3']]) { const s = new THREE.Mesh(new THREE.BoxGeometry(40, 0.12, 0.1), glow(c)); s.position.set(0, y, -8.7); scene.add(s); }
  for (const z of [-6, 0, 6]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 4), glow('#ffcf4a')); s.position.set(-10.7, 4, z); scene.add(s); }
  const tyre = new THREE.CylinderGeometry(0.62, 0.62, 0.42, 18), rubber = std('#141414', { roughness: 0.9 });
  for (const [x, z, n] of [[-8.5, -6.5, 4], [-7.2, -7.4, 3], [7.5, -7.2, 5]]) for (let k = 0; k < n; k++) { const t = new THREE.Mesh(tyre, rubber); t.position.set(x, 0.21 + k * 0.43, z); t.castShadow = true; scene.add(t); }
  const bench = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 1.2), std('#c0392b', { metalness: 0.4, roughness: 0.4 }));
  bench.position.set(-6.5, 0.55, -7.8); scene.add(bench);
  scene.add(new THREE.HemisphereLight('#b9a7ff', '#2a1a20', 1.1));
  const key = new THREE.SpotLight('#fff3e0', 260, 40, 0.6, 0.5, 1.2);
  key.position.set(3, 11, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  scene.add(key, key.target);
  for (const [c, x, z] of [['#ff4fa3', -6, 3], ['#2fe6d8', 6, -3]]) { const l = new THREE.PointLight(c, 60, 18, 1.5); l.position.set(x, 2.5, z); scene.add(l); }
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 200);
  return { scene, camera, table };
}

export function createGarageScreen(game) {
  const root = document.createElement('div');
  root.id = 'garage'; root.className = 'hidden';
  root.innerHTML = `<div class="gs-brand"><b id="gs-name">WRENCH WORKS</b><span id="gs-sub">CUSTOMS · REPAIRS · ARMS</span><div class="gs-quote"><canvas width="96" height="96"></canvas><div><b id="gs-who"></b><span id="gs-line"></span></div></div></div>
<div class="gs-car"><div class="gs-car-name"></div><div class="gs-car-sub"></div><div class="gs-stats"></div></div>
<div class="gs-panel"><div class="gs-top"><span>CASH</span><b class="gs-money"></b></div><div class="gs-tabs"><button data-tab="car">CAR UPGRADES</button><button data-tab="weapons">WEAPONS</button></div><div class="gs-list"></div>
<div class="gs-foot"><kbd>CLICK</kbd> or <kbd>1</kbd>-<kbd>7</kbd> buy · <kbd>TAB</kbd> switch · <kbd>ESC</kbd> back to the street</div></div>`;
  document.body.appendChild(root);
  const q = (s) => root.querySelector(s);
  const face = q('.gs-quote canvas').getContext('2d');
  let tab = null, cooldown = 0, carMesh = null, carKey = '';
  drawPortrait(face, 'wrench', 96);
  const shops = { car: { poi: game.layout.pois.garage, radius: 6 }, weapons: { poi: game.layout.pois.gunshop, radius: 2.5 } };

  function render() {
    const shop = game.garageShop, v = game.player.vehicle || game.player.lastVehicle;
    root.querySelectorAll('.gs-tabs button').forEach((b) => b.classList.toggle('sel', b.dataset.tab === tab));
    q('.gs-money').textContent = formatMoney(game.economy.money);
    const items = shop.items(tab);
    q('.gs-list').innerHTML = items.map((it, i) => {
      const cls = it.owned ? 'owned' : it.locked ? 'locked' : game.economy.money < it.price ? 'poor' : '';
      const pips = it.max ? `<span class="pips">${Array.from({ length: it.max }, (_, k) => `<i class="${k < it.level ? 'on' : ''}"></i>`).join('')}</span>` : '';
      return `<div class="gs-row ${cls}" data-id="${it.id}"><kbd>${i + 1}</kbd><i class="code">${it.code}</i><div class="gs-txt"><b>${it.name}</b><span>${it.desc}</span></div>${pips}<em>${it.owned ? 'OWNED' : it.locked ? it.lockReason : formatMoney(it.price)}</em></div>`;
    }).join('');
    q('.gs-car-name').textContent = v ? v.spec.name.toUpperCase() : 'NO CAR';
    q('.gs-car-sub').textContent = v ? `CONDITION ${Math.max(0, Math.round(v.condition))}% · ${['STOCK', 'STAGE 1', 'STAGE 2', 'STAGE 3'][game.economy.upgrades.engine]} ENGINE${game.economy.upgrades.nitro ? ' · NITRO' : ''}` : 'Drive one in to tune it';
    q('.gs-stats').innerHTML = shop.stats(v).map(([n, base, now]) => `<div class="gs-stat"><label>${n}</label><div class="bar"><i class="now" style="width:${now * 100}%"></i><i class="base" style="width:${base * 100}%"></i></div></div>`).join('');
    q('#gs-name').textContent = tab === 'car' ? 'WRENCH WORKS' : 'BRASS & BARREL';
    q('#gs-sub').textContent = tab === 'car' ? 'CUSTOMS · REPAIRS · ARMS COUNTER' : 'ARMS · AMMO · ARMOUR';
    q('#gs-who').textContent = 'Jojo "Wrench" Okafor · mechanic';
    q('#gs-line').textContent = LINES[tab];
  }

  function buy(id) { if (game.garageShop.purchase(tab, id)) render(); }
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; render(); return; }
    const row = e.target.closest('.gs-row'); if (row) buy(row.dataset.id);
  });
  addEventListener('keydown', (e) => {
    if (!tab) return;
    if (e.code === 'Tab') { tab = tab === 'car' ? 'weapons' : 'car'; render(); }
    const n = /^Digit(\d)$/.exec(e.code);
    if (n) { const it = game.garageShop.items(tab)[Number(n[1]) - 1]; if (it) buy(it.id); }
  });

  function syncCar(stage) {
    const v = game.player.vehicle || game.player.lastVehicle;
    const key = v ? `${v.type}:${v.color}` : '';
    if (key === carKey) return;
    if (carMesh) stage.table.remove(carMesh.root);
    carMesh = v ? buildVehicleMesh(v.type, v.color) : null;
    if (carMesh) { carMesh.root.position.y = 0.22; carMesh.root.traverse((o) => { o.castShadow = true; }); stage.table.add(carMesh.root); }
    carKey = key;
  }

  let stage = null;
  const screen = {
    get open() { return !!tab; },
    get tab() { return tab; },
    openShop(kind) {
      tab = kind; root.classList.remove('hidden'); game.hud.show(false);
      game.mode = 'shop'; game.input.releaseLock(); render();
    },
    close() { tab = null; root.classList.add('hidden'); game.hud.show(true); game.mode = 'play'; cooldown = 3; },
    /** Draw the turntable instead of the street while the screen is up. */
    render(dt) {
      stage ||= buildWorkshop();
      syncCar(stage);
      stage.table.rotation.y += dt * 0.35;
      const w = innerWidth, h = innerHeight, cam = stage.camera;
      cam.aspect = w / h; cam.updateProjectionMatrix();
      cam.position.set(9.5, 4.2, 9.2);
      cam.lookAt(4.2, 0.4, -1.2);
      if (stage.scene.environment !== game.scene.environment) stage.scene.environment = game.scene.environment;
      game.bloom.render(stage.scene, cam);
    },
    update(dt) {
      cooldown = Math.max(0, cooldown - dt);
      if (tab || cooldown > 0 || game.missions.active || game.activities.active || game.dialogue.active) return;
      const p = game.player.position;
      for (const [k, s] of Object.entries(shops)) {
        const d = Math.hypot(p.x - s.poi.x, p.z - s.poi.z);
        if (d < s.radius && game.player.speed < 4 && (k === 'car' || !game.player.vehicle)) { screen.openShop(k); return; }
      }
    },
  };
  return screen;
}
