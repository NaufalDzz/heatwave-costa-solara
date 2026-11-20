// Staged screenshot scenes behind ?shot=chase|shootout|garage|pause|title. Each one sets real game
// state through the game's own systems (story jobs, wanted level, police units and their AI,
// Air-1, crew cooldowns, garage upgrades, pedestrians, weapons, saves), runs the simulation
// forward a fixed number of steps with the same seed, then frames the camera and renders.
const STEP = 1 / 60;

function simulate(game, seconds, each) {
  const n = Math.round(seconds / STEP);
  // The camera moves every step too, so systems that cull by camera distance (car lights) see the shot.
  for (let i = 0; i < n; i++) { each?.(i * STEP); game.cameraRig.update(STEP); game.update(STEP); }
}

function progress(game, jobIndex) {
  const eco = game.economy;
  game.missions.restore({ index: jobIndex, done: game.missions.STORY.slice(0, jobIndex).map((m) => m.id) });
  eco.money = 48250; eco.respect = 4200 + jobIndex * 120;
  Object.assign(eco.stats, { missionsPassed: jobIndex, kills: 87, copsKilled: 12, carsStolen: 41, distanceKm: 63.4, stuntJumps: 3, tokens: 14, racesWon: 2, taxiFares: 9, timesWasted: 3, timesBusted: 1, maxWanted: 5, shotsFired: 1934, explosions: 17, playSeconds: 3 * 3600 + 1260, moneyEarned: 96400 });
  Object.assign(eco.upgrades, { engine: 2, armor: 1, tyres: 1, nitro: true });
  for (const id of ['pistol', 'smg', 'shotgun', 'rifle']) game.weapons.give(id, 120);
  game.player.hero.armor = 65;
  game.activities.restore({ tokens: [0, 1, 2, 3, 5, 6, 8, 9, 11, 13, 17, 20, 22, 25], stunts: [0, 1, 3] });
  game.day = 6;
}

function clearAround(game, x, z, r) {
  for (const v of [...game.vehicles.list]) if (Math.hypot(v.x - x, v.z - z) < r && v !== game.player.vehicle) { game.vehicles.remove(v); game.traffic.cars.delete(v); game.traffic.parked.delete(v); }
}

function crowd(game, n, x0, dx, zs, fromX, fromZ) {
  for (let k = 0; k < n; k++) {
    const h = game.peds.add(x0 + k * dx, zs[k % zs.length] + (k % 3) * 0.5, null, 0);
    h.y = 0.18; h.ped.state = 'flee'; h.ped.fear = 9; h.ped.fromX = fromX; h.ped.fromZ = fromZ;
  }
}

const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
async function present(game) { for (let i = 0; i < 3; i++) { game.frame(STEP); await frames(); } }

export async function stageShot(game, name, title) {
  const { player, police, vehicles } = game;
  game.sky.frozen = true;
  if (name === 'title') {
    progress(game, 4);
    game.sky.setHour(18.9);
    game.save.write('auto');
    game.traffic.populate(); game.peds.populate();
    title.show();
    simulate(game, 1.2);
    return present(game);
  }
  if (name === 'pause') {
    // Three save slots at different points of the story, then the overview page.
    progress(game, 3); game.sky.setHour(13.2); game.save.write('2');
    progress(game, 6);
    game.sky.setHour(18.4);
    player.teleport(-150, 395, Math.PI);
    game.startPlay();
    game.waypoint = { x: 600, z: 140 };
    game.save.write('1');
    game.save.write('auto');
    simulate(game, 0.5);
    game.frame(STEP);
    game.pauseMenu.show(0);
    return present(game);
  }
  if (name === 'garage') {
    progress(game, 8);
    game.sky.setHour(18.2);
    const g = game.layout.pois.garage;
    player.teleport(g.x + 12, g.z);
    game.startPlay();
    const car = vehicles.spawn('sports', g.x + 10, g.z, -Math.PI / 2, { color: '#ff2d55', persistent: true });
    player.enterVehicle(car);
    car.condition = 64;
    simulate(game, 0.3);
    game.shop.openShop('car');
    game.shop.render(4.6);
    return present(game);
  }
  if (name === 'shootout') {
    // Job 7: Hale's envelope run turns into an ambush on the Palmera boardwalk at golden hour.
    // Over Santi's shoulder, looking east along Ocean Mile Blvd with the low sun behind him.
    progress(game, 6);
    game.sky.setHour(18.1);
    const P = { x: -94, z: 399 };
    player.teleport(P.x, P.z, Math.PI / 2);
    game.startPlay();
    game.missions.jumpTo(6, 2);
    game.weapons.select(2);
    clearAround(game, -70, 400, 60);
    const goons = game.missions.context().enemies;
    const spots = [[-83, 396.5], [-80, 403.8], [-76, 399.5], [-73.5, 409], [-70, 394], [-86, 391.5]];
    goons[4].damage(999, P.x, P.z); goons[5].damage(999, P.x, P.z);
    const pin = () => goons.forEach((g, i) => { g.x = spots[i][0]; g.z = spots[i][1]; g.alerted = true; g.heading = -Math.PI / 2; });
    pin();
    const wreck = vehicles.spawn('muscle', -70, 402.6, 0.9, { parked: true, color: '#1d3557' });
    wreck.condition = 0; wreck.burnTimer = -100;
    vehicles.spawn('van', -62, 392.8, Math.PI / 2, { parked: true, color: '#4cc9f0' });
    game.wanted.setLevel(2);
    const unit = police.spawnUnitNear(-30, 398, -Math.PI / 2);
    unit.vehicle.vx = -12;
    game.crew.setTimer('birdie', 45, 14);
    game.crew.setTimer('lexi', 31);
    game.cameraRig.override = (cam) => {
      const h = player.hero;
      cam.position.set(h.x - 3.4, h.y + 2.35, h.z + 1.55);
      cam.lookAt(h.x + 14, h.y + 1.0, h.z - 1.6);
    };
    game.input.simulate('KeyE', true);
    const shoot = (from, to, opts) => {
      const o = { x: from.x + 0.7, y: from.y + 1.45, z: from.z + 0.25 };
      const d = { x: to.x - o.x, y: to.y + 1.2 - o.y, z: to.z - o.z }, l = Math.hypot(d.x, d.y, d.z);
      game.weapons.fire(from, o, { x: d.x / l, y: d.y / l, z: d.z / l }, { id: 'smg', damage: 1, range: 110, spread: 0.02 }, { muzzle: [o.x, o.y, o.z], ...opts });
    };
    simulate(game, 1.6, () => {
      pin();
      player.hero.x = P.x; player.hero.z = P.z; player.hero.heading = Math.PI / 2; player.hero.health = 100;
    });
    game.traffic.spawnOnLane(114, 115, 0, 0.55, 'taxi');
    game.traffic.spawnOnLane(115, 114, 1, 0.62, 'suv');
    game.traffic.spawnOnLane(114, 115, 1, 0.8, 'sedan');
    crowd(game, 12, -91, 2.6, [410.8, 412.3, 389.6], -78, 400);
    simulate(game, 0.35, () => { pin(); player.hero.x = P.x; player.hero.z = P.z; });
    // A last exchange so muzzle flashes and tracers from both sides are in the frame.
    const nearMiss = { x: P.x + 4, y: -1.1, z: P.z + 3 };
    shoot(player.hero, goons[0], { byPlayer: true });
    for (let i = 0; i < 4; i++) game.update(STEP);
    shoot(goons[1], nearMiss, { friendly: true, damageScale: 0 });
    shoot(goons[2], nearMiss, { friendly: true, damageScale: 0 });
    game.update(STEP);
    shoot(goons[3], nearMiss, { friendly: true, damageScale: 0 });
    game.update(STEP);
    player.hero.health = 88;
    game.dialogue.hold('lexi', 'Hale sold you out, Santi! Six Kroll guards on the boardwalk and Birdie has them painted.');
    return present(game);
  }
  // Cover: the finale's five-star escape down Ocean Mile Blvd at sunset. The Vortex GT burns
  // nitro away from the camera with two SCPD cruisers on its doors and more behind, Air-1's
  // searchlight on the roof, a rammed cruiser burning up the road and a roadblock beyond.
  progress(game, 9);
  game.sky.setHour(18.55);
  const Z = 398.1, X0 = 150;
  player.teleport(X0, Z + 8);
  game.startPlay();
  clearAround(game, X0 - 60, Z, 200);
  const car = vehicles.spawn('sports', X0, Z, -Math.PI / 2, { color: '#e8112d', persistent: true });
  player.enterVehicle(car);
  game.missions.jumpTo(9, 2);
  game.radio.set(0);
  game.hud.holdRadio();
  // Formation, offsets in metres behind (+x) and beside (z) the player's car.
  const pack = [[0.2, 3.4], [-1.4, -3.2], [7.5, 6.2], [8.5, -4.8], [16, 1.5], [-36, 6.8]];
  const units = pack.map(([dx, dz]) => police.spawnUnitNear(X0 + dx, Z + dz, -Math.PI / 2));
  police.helicopter.spawn(true);
  game.traffic.spawnOnLane(114, 115, 0, 0.55, 'sedan');
  game.traffic.spawnOnLane(113, 114, 1, 0.6, 'van');
  crowd(game, 12, X0 - 70, 4.5, [410.2, 411.8], X0 - 48, Z + 4);
  crowd(game, 7, X0 - 64, 6, [389.4, 390.6], X0 - 48, Z + 4);
  game.crew.setTimer('static', 38);
  game.crew.setTimer('birdie', 22);
  game.weapons.select(2);
  game.input.simulate('KeyW', true);
  game.input.simulate('ShiftLeft', true);
  const SPEED = 31;
  let exploded = false;
  simulate(game, 1.5, (t) => {
    car.vz = 0; car.z = Z; car.heading = -Math.PI / 2; car.vx = -SPEED;
    units.forEach((u, k) => {
      const v = u.vehicle;
      if (v.exploded) return;
      v.x = car.x + pack[k][0]; v.z = Z + pack[k][1]; v.vx = -SPEED; v.vz = 0; v.heading = -Math.PI / 2 + (k === 5 ? 0.5 : 0);
    });
    if (!exploded && t > 1.2) {
      exploded = true;
      const v = units[5].vehicle;
      v.lastHitByPlayer = game.time;
      vehicles.explode(v);
      police.placeRoadblock();
    }
  });
  // Civilian traffic: two cars coming the other way and a slow one in the right lane ahead.
  game.traffic.spawnOnLane(115, 116, 0, 0.72, 'taxi');
  game.traffic.spawnOnLane(115, 116, 1, 0.5, 'van');
  game.traffic.spawnOnLane(116, 115, 1, 0.55, 'suv');
  for (const u of units) if (u.id % 2 === 0) u.fireTimer = 0.06;
  simulate(game, 0.12, () => {
    car.vz = 0; car.z = Z; car.heading = -Math.PI / 2; car.vx = -SPEED;
    units.slice(0, 5).forEach((u, k) => { const v = u.vehicle; v.x = car.x + pack[k][0]; v.z = Z + pack[k][1]; v.vx = -SPEED; v.vz = 0; v.heading = -Math.PI / 2; });
  });
  car.condition = Math.max(car.condition, 82);
  game.dialogue.hold('lexi', 'Two cruisers on your doors and Air-1 overhead! Say the word and I pull them off you.');
  const heli = police.helicopter;
  Object.assign(heli, { x: car.x - 24, z: car.z + 3, y: 15, aimX: car.x - 0.5, aimZ: car.z, heading: Math.PI / 2 - 0.6 });
  heli.update(0, true);
  game.cameraRig.override = (cam) => {
    cam.position.set(car.x + 11, car.y + 5.6, car.z - 1.4);
    cam.lookAt(car.x - 24, car.y - 1.4, car.z + 7.5);
  };
  return present(game);
}
