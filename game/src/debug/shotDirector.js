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
    progress(game, 2);
    game.sky.setHour(18.35);
    player.teleport(281, 71, 0);
    game.startPlay();
    game.missions.jumpTo(2, 0);
    game.weapons.select(2);
    clearAround(game, 281, 80, 25);
    // A getaway car already burning across the street, traffic passing, a crowd nearby.
    const wreck = vehicles.spawn('sedan', 300, 84.5, Math.PI / 2, { parked: true, color: '#457b9d' });
    wreck.condition = 0; wreck.burnTimer = -100;
    game.traffic.spawnOnLane(74, 75, 0, 0.3, 'taxi');
    game.traffic.spawnOnLane(75, 74, 1, 0.45, 'suv');
    for (let k = 0; k < 9; k++) {
      const h = game.peds.add(266 + k * 3.2, 72 + (k % 3), null, 0);
      h.ped.state = 'walk';
    }
    game.wanted.setLevel(2);
    const unit = police.spawnUnitNear(225, 78.1, Math.PI / 2);
    unit.vehicle.vx = 14;
    game.input.simulate('KeyE', true);
    const goons = game.missions.context().enemies;
    simulate(game, 2.0, (t) => {
      game.cameraRig.yaw = 0.18; game.cameraRig.pitch = 0.12;
      for (const g of goons) g.alerted = true;
      if (Math.round(t * 60) % 9 === 0 && t > 0.6) {
        const tgt = goons[Math.floor(t * 3) % goons.length];
        const o = { x: player.hero.x + 0.4, y: player.hero.y + 1.45, z: player.hero.z + 0.6 };
        const d = { x: tgt.x - o.x, y: tgt.y + 1.3 - o.y, z: tgt.z - o.z };
        const l = Math.hypot(d.x, d.y, d.z);
        game.weapons.fire(player.hero, o, { x: d.x / l, y: d.y / l, z: d.z / l }, { id: 'smg', damage: 9, range: 110, spread: 0.02 }, { byPlayer: true, muzzle: [o.x, o.y, o.z] });
      }
      for (const h of game.peds.list) if (Math.hypot(h.x - 281, h.z - 80) < 30) { h.ped.state = 'flee'; h.ped.fear = 8; h.ped.fromX = 285; h.ped.fromZ = 92; }
    });
    game.dialogue.hold('lexi', 'Coyotes, three of them by Club Azure. Light them up, Nico. I will watch your back.');
    game.cameraRig.override = (cam) => {
      const h = player.hero;
      cam.position.set(h.x - 2.4, h.y + 2.35, h.z - 3.4);
      cam.lookAt(h.x + 3.5, h.y + 1.2, h.z + 14);
    };
    for (let i = 0; i < 3; i++) { game.frame(STEP); await frames(); }
    return;
  }
  // Cover: the finale's five-star escape along the beach at sunset.
  progress(game, 9);
  game.sky.setHour(19.25);
  player.teleport(40, 380);
  game.startPlay();
  clearAround(game, 40, 398, 90);
  const car = vehicles.spawn('sports', 40, 398, -Math.PI / 2, { color: '#ff2d55', persistent: true });
  player.enterVehicle(car);
  car.vx = -30;
  game.missions.jumpTo(9, 2);
  game.radio.set(0);
  const units = [[64, 394.5, -27], [76, 401.5, -26], [96, 397, -25], [118, 394, -24]].map(([x, z, vx]) => {
    const u = police.spawnUnitNear(x, z, -Math.PI / 2);
    u.vehicle.vx = vx;
    return u;
  });
  police.helicopter.spawn(true);
  Object.assign(police.helicopter, { x: 8, z: 388, y: 34, aimX: 30, aimZ: 398 });
  game.input.simulate('KeyW', true);
  let exploded = false;
  simulate(game, 1.35, (t) => {
    if (!exploded && t > 0.55) {
      exploded = true;
      const v = units[2].vehicle;
      v.lastHitByPlayer = game.time;
      vehicles.explode(v);
    }
    car.vz = 0; car.z = 398; car.heading = -Math.PI / 2;
  });
  game.dialogue.hold('lexi', 'Air-1 is right on top of you! Stay on the beach road and burn that nitro!');
  game.cameraRig.override = (cam) => {
    cam.position.set(car.x + 15, car.y + 6.2, car.z - 4.5);
    cam.lookAt(car.x - 9, car.y + 2.6, car.z + 1.5);
  };
  for (let i = 0; i < 3; i++) { game.frame(STEP); await frames(); }
}
