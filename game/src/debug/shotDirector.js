// Staged screenshot scenes behind ?shot=chase|shootout|pause|title. Each one sets real game
// state through the game's own systems (missions, wanted level, police units, helicopter,
// pedestrians, weapons, saves), runs the simulation forward a fixed number of steps with the
// same seed, then frames the camera and renders.
const STEP = 1 / 60;

function simulate(game, seconds, each) {
  const n = Math.round(seconds / STEP);
  // The camera moves every step too, so systems that cull by camera distance (car lights) see the shot.
  for (let i = 0; i < n; i++) { each?.(i * STEP); game.cameraRig.update(STEP); game.update(STEP); }
}

function progress(game, jobIndex) {
  const eco = game.economy;
  game.missions.restore({ index: jobIndex, done: game.missions.STORY.slice(0, jobIndex).map((m) => m.id) });
  eco.money = 48250; eco.respect = 4200;
  Object.assign(eco.stats, { missionsPassed: jobIndex, kills: 87, copsKilled: 12, carsStolen: 41, distanceKm: 63.4, stuntJumps: 3, tokens: 14, racesWon: 2, taxiFares: 9, timesWasted: 3, timesBusted: 1, maxWanted: 5, shotsFired: 1934, explosions: 17, playSeconds: 3 * 3600 + 1260, moneyEarned: 96400 });
  eco.upgrades.engine = 2; eco.upgrades.nitro = true;
  for (const id of ['pistol', 'smg', 'shotgun', 'rifle']) game.weapons.give(id, 120);
  game.player.hero.armor = 65;
  game.activities.restore({ tokens: [0, 1, 2, 3, 5, 6, 8, 9, 11, 13, 17, 20, 22, 25], stunts: [0, 1, 3] });
  game.day = 6;
}

function clearAround(game, x, z, r) {
  for (const v of [...game.vehicles.list]) if (Math.hypot(v.x - x, v.z - z) < r && v !== game.player.vehicle) { game.vehicles.remove(v); game.traffic.cars.delete(v); game.traffic.parked.delete(v); }
}

const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

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
    for (let i = 0; i < 3; i++) { game.frame(STEP); await frames(); }
    return;
  }
  if (name === 'pause') {
    progress(game, 4);
    game.sky.setHour(20.4);
    player.teleport(160, 205, Math.PI);
    game.startPlay();
    game.waypoint = { x: 600, z: 140 };
    game.save.write('1');
    game.save.write('auto');
    simulate(game, 0.5);
    game.frame(STEP);
    game.pauseMenu.show(0);
    for (let i = 0; i < 3; i++) { game.frame(STEP); await frames(); }
    return;
  }
  if (name === 'shootout') {
    // Neon Row's north-south strip, where the club signs face the street: an over-the-shoulder
    // view of Nico trading SMG fire with three Coyote collectors, traffic and a fleeing crowd.
    progress(game, 2);
    game.sky.setHour(19.55);
    player.teleport(319, 40, 0);
    game.startPlay();
    game.missions.jumpTo(2, 0);
    game.weapons.select(2);
    clearAround(game, 320, 50, 45);
    const goons = game.missions.context().enemies;
    const spots = [[315.2, 47], [325.2, 48.5], [320.6, 53]];
    const pin = () => goons.forEach((g, i) => { g.x = spots[i][0]; g.z = spots[i][1]; g.alerted = true; });
    pin();
    const wreck = vehicles.spawn('sedan', 326.2, 60, 0.4, { parked: true, color: '#457b9d' });
    wreck.condition = 0; wreck.burnTimer = -100;
    for (let k = 0; k < 14; k++) {
      const side = k % 2 ? 311.2 : 328.8;
      const h = game.peds.add(side + (k % 3) * 0.6, 36 + k * 2.4, null, 0);
      h.y = 0.18;
    }
    game.wanted.setLevel(2);
    const unit = police.spawnUnitNear(321.9, 6, 0);
    unit.vehicle.vz = 13;
    const shoulder = (cam) => {
      const h = player.hero;
      cam.position.set(h.x - 1.9, h.y + 2.9, h.z - 5.2);
      cam.lookAt(h.x + 0.9, h.y + 1.2, h.z + 12);
    };
    game.cameraRig.override = shoulder;
    game.input.simulate('KeyE', true);
    const shoot = (from, to, opts) => {
      const o = { x: from.x + 0.4, y: from.y + 1.45, z: from.z + 0.6 };
      const d = { x: to.x - o.x, y: to.y + 1.2 - o.y, z: to.z - o.z }, l = Math.hypot(d.x, d.y, d.z);
      game.weapons.fire(from, o, { x: d.x / l, y: d.y / l, z: d.z / l }, { id: 'smg', damage: 1, range: 110, spread: 0.02 }, { muzzle: [o.x, o.y, o.z], ...opts });
    };
    simulate(game, 2.0, (t) => {
      game.cameraRig.yaw = 0.02; game.cameraRig.pitch = 0.1;
      pin();
      if (Math.round(t * 60) % 8 === 0 && t > 0.5) shoot(player.hero, goons[Math.floor(t * 3) % goons.length], { byPlayer: true });
      for (const h of game.peds.list) if (Math.hypot(h.x - 320, h.z - 50) < 40) { h.ped.state = 'flee'; h.ped.fear = 8; h.ped.fromX = 320; h.ped.fromZ = 52; }
      player.hero.x = 319; player.hero.z = 40; player.hero.health = 100;
    });
    // Traffic rolls in on both lanes once the street is set (spawned late so it is still in view).
    const taxi = game.traffic.spawnOnLane(64, 75, 1, 0.62, 'taxi');
    game.traffic.spawnOnLane(75, 64, 1, 0.55, 'suv');
    game.traffic.spawnOnLane(64, 75, 0, 0.8, 'sports');
    simulate(game, 0.25, () => { pin(); player.hero.x = 319; player.hero.z = 40; });
    // Their rounds kick up the asphalt beside him (aimed at the road so no tracer runs past the camera).
    const nearMiss = { x: player.hero.x + 1.8, y: -1.1, z: player.hero.z + 2.2 };
    // A last exchange so muzzle flashes and tracers from both sides are in the frame.
    shoot(player.hero, goons[1], { byPlayer: true });
    shoot(goons[0], nearMiss, { friendly: true, damageScale: 0 });
    game.update(STEP);
    shoot(goons[2], nearMiss, { friendly: true, damageScale: 0 });
    shoot(player.hero, goons[0], { byPlayer: true });
    shoot(goons[1], nearMiss, { friendly: true, damageScale: 0 });
    game.update(STEP);
    player.hero.health = 100;
    game.dialogue.clear();
    for (let i = 0; i < 3; i++) { game.frame(STEP); await frames(); }
    return;
  }
  // Cover: the finale's five-star escape along the beach at sunset. The Vortex GT burns nitro
  // towards the camera with four SCPD cruisers in a wedge behind it, Air-1 overhead and a
  // rammed cruiser exploding at the back of the pack.
  progress(game, 9);
  game.sky.setHour(19.45);
  player.teleport(40, 380);
  game.startPlay();
  clearAround(game, 40, 398, 120);
  const car = vehicles.spawn('sports', 40, 398, -Math.PI / 2, { color: '#ff2d55', persistent: true });
  player.enterVehicle(car);
  game.missions.jumpTo(9, 2);
  game.radio.set(0);
  // Wedge formation, offsets in metres behind (+x) and beside (z) the player's car.
  const wedge = [[8, -2.8], [9, 2.8], [17, 0.2], [25, -3], [28, 3]];
  const units = wedge.map(([dx, dz]) => police.spawnUnitNear(40 + dx, 398 + dz, -Math.PI / 2));
  police.helicopter.spawn(true);
  game.traffic.spawnOnLane(114, 115, 0, 0.35, 'sedan');
  game.traffic.spawnOnLane(113, 114, 1, 0.7, 'van');
  for (let k = 0; k < 12; k++) {
    const h = game.peds.add(-14 + k * 2.6, 409.5 + (k % 3) * 1.6, null, 0);
    h.y = 0.18; h.ped.state = 'flee'; h.ped.fear = 9; h.ped.fromX = 30; h.ped.fromZ = 398;
  }
  game.cameraRig.override = (cam) => {
    cam.position.set(car.x - 9.5, car.y + 4.6, car.z + 6.5);
    cam.lookAt(car.x + 6, car.y + 2.0, car.z - 3.2);
  };
  game.input.simulate('KeyW', true);
  game.input.simulate('ShiftLeft', true);
  let exploded = false;
  const SPEED = 31;
  simulate(game, 1.4, (t) => {
    car.vz = 0; car.z = 398; car.heading = -Math.PI / 2; car.vx = -SPEED;
    // Keep the pack in its wedge while their own AI drives (sirens, ramming, lights).
    units.forEach((u, k) => {
      const v = u.vehicle;
      if (v.exploded) return;
      v.x = car.x + wedge[k][0]; v.z = 398 + wedge[k][1]; v.vx = -SPEED; v.vz = 0; v.heading = -Math.PI / 2;
    });
    if (!exploded && t > 1.1) {
      exploded = true;
      const v = units[4].vehicle;
      v.lastHitByPlayer = game.time;
      vehicles.explode(v);
    }
  });
  car.condition = Math.max(car.condition, 82);
  game.dialogue.clear();
  const heli = police.helicopter;
  Object.assign(heli, { x: car.x + 19, z: car.z - 8, y: 10.5, aimX: car.x + 14, aimZ: car.z - 1, heading: -Math.PI / 2 + 0.7 });
  heli.update(0, true);
  for (let i = 0; i < 3; i++) { game.frame(STEP); await frames(); }
}
