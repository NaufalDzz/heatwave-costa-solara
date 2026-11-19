// Staged screenshot scenes behind ?shot=chase|shootout|pause|title. Each one sets real game
// state through the game's own systems (missions, wanted level, police units, helicopter,
// pedestrians, weapons, saves), runs the simulation forward a fixed number of steps with the
// same seed, then frames the camera and renders.
const STEP = 1 / 60;

function simulate(game, seconds, each) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) { each?.(i * STEP); game.update(STEP); }
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
    player.teleport(250, 75, 0);
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
    // Neon Row's north-south strip, where the club signs face the street.
    progress(game, 2);
    game.sky.setHour(19.55);
    player.teleport(319, 40, 0);
    game.startPlay();
    game.missions.jumpTo(2, 0);
    game.weapons.select(2);
    clearAround(game, 320, 50, 45);
    const goons = game.missions.context().enemies;
    [[315, 57], [324.5, 59.5], [319.5, 66]].forEach(([x, z], i) => { goons[i].x = x; goons[i].z = z; goons[i].heading = Math.PI; });
    const wreck = vehicles.spawn('sedan', 326, 67, 0.4, { parked: true, color: '#457b9d' });
    wreck.condition = 0; wreck.burnTimer = -100;
    game.traffic.spawnOnLane(64, 75, 1, 0.55, 'taxi');
    game.traffic.spawnOnLane(75, 64, 1, 0.75, 'suv');
    for (let k = 0; k < 12; k++) {
      const side = k % 2 ? 311 : 329;
      const h = game.peds.add(side + (k % 3) * 0.7, 30 + k * 3.4, null, 0);
      h.y = 0.18;
    }
    game.wanted.setLevel(2);
    const unit = police.spawnUnitNear(321.9, 6, 0);
    unit.vehicle.vz = 13;
    game.input.simulate('KeyE', true);
    simulate(game, 2.0, (t) => {
      game.cameraRig.yaw = 0.02; game.cameraRig.pitch = 0.1;
      for (const g of goons) g.alerted = true;
      if (Math.round(t * 60) % 8 === 0 && t > 0.5) {
        const tgt = goons[Math.floor(t * 3) % goons.length];
        const o = { x: player.hero.x + 0.4, y: player.hero.y + 1.45, z: player.hero.z + 0.6 };
        const d = { x: tgt.x - o.x, y: tgt.y + 1.3 - o.y, z: tgt.z - o.z };
        const l = Math.hypot(d.x, d.y, d.z);
        game.weapons.fire(player.hero, o, { x: d.x / l, y: d.y / l, z: d.z / l }, { id: 'smg', damage: 12, range: 110, spread: 0.02 }, { byPlayer: true, muzzle: [o.x, o.y, o.z] });
      }
      for (const h of game.peds.list) if (Math.hypot(h.x - 320, h.z - 55) < 40) { h.ped.state = 'flee'; h.ped.fear = 8; h.ped.fromX = 320; h.ped.fromZ = 70; }
      player.hero.x = 319; player.hero.z = 40; player.hero.health = 100;
    });
    game.dialogue.hold('lexi', 'Coyotes, three of them outside Club Azure. Light them up, Nico. I have your back.');
    game.cameraRig.override = (cam) => {
      const h = player.hero;
      cam.position.set(h.x - 2.8, h.y + 3.9, h.z - 7.2);
      cam.lookAt(h.x + 1.4, h.y + 1.7, h.z + 20);
    };
    for (let i = 0; i < 3; i++) { game.frame(STEP); await frames(); }
    return;
  }
  // Cover: the finale's five-star escape along the beach at sunset.
  progress(game, 9);
  game.sky.setHour(19.6);
  player.teleport(40, 380);
  game.startPlay();
  clearAround(game, 40, 398, 90);
  const car = vehicles.spawn('sports', 40, 398, -Math.PI / 2, { color: '#ff2d55', persistent: true });
  player.enterVehicle(car);
  car.vx = -30;
  game.missions.jumpTo(9, 2);
  game.radio.set(0);
  const units = [[52, 394.6, -29.5], [58, 401.6, -29.5], [-14, 393.6, 0], [64, 398, -29]].map(([x, z, vx]) => {
    const u = police.spawnUnitNear(x, z, -Math.PI / 2);
    u.vehicle.vx = vx;
    return u;
  });
  police.helicopter.spawn(true);
  Object.assign(police.helicopter, { x: 8, z: 388, y: 34, aimX: 30, aimZ: 398 });
  game.input.simulate('KeyW', true);
  let exploded = false;
  simulate(game, 1.35, (t) => {
    if (!exploded && t > 1.05) {
      exploded = true;
      const v = units[2].vehicle;
      v.lastHitByPlayer = game.time;
      vehicles.explode(v);
    }
    car.vz = 0; car.z = 398; car.heading = -Math.PI / 2; car.vx = -30;
  });
  car.condition = Math.max(car.condition, 74);
  game.dialogue.hold('lexi', 'Air-1 is right on top of you! Stay on the beach road and burn that nitro!');
  const heli = police.helicopter;
  Object.assign(heli, { x: car.x - 4, z: car.z + 5, y: 13, aimX: car.x + 1, aimZ: car.z, heading: Math.PI / 2 + 0.5 });
  heli.update(0, true);
  game.cameraRig.override = (cam) => {
    cam.position.set(car.x + 30, car.y + 8, car.z + 11);
    cam.lookAt(car.x - 8, car.y + 4.2, car.z - 1.5);
  };
  for (let i = 0; i < 3; i++) { game.frame(STEP); await frames(); }
}
