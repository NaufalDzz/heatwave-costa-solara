// Assembles Costa Solara: the renderer, scene and camera, then every system (story, crew, garage,
// police, vehicles, AI, UI, world) in the order they depend on each other,
// and runs one simulation tick (fixed 1/60 s) and one rendered frame.
import * as THREE from 'three';
import { createMissionRunner } from '../missions/missionRunner.js';
import { createActivities } from '../missions/sideActivities.js';
import { createCrew } from '../crew/crewAbilities.js';
import { createGarageShop } from '../shops/garageShop.js';
import { createWantedSystem } from '../police/wantedSystem.js';
import { createPoliceDispatch } from '../police/policeDispatch.js';
import { createEconomy } from '../progression/economy.js';
import { createVehicleManager } from '../vehicles/vehicleManager.js';
import { createWeapons } from '../combat/weapons.js';
import { createTraffic } from '../ai/traffic.js';
import { createPedestrians } from '../ai/pedestrians.js';
import { createPlayer } from '../player/playerController.js';
import { createCameraRig } from '../player/cameraRig.js';
import { createHud } from '../ui/hud.js';
import { createMinimap } from '../ui/minimap.js';
import { renderCityMap } from '../ui/mapRenderer.js';
import { createPauseMenu } from '../ui/pauseMenu.js';
import { createGarageScreen } from '../ui/garageScreen.js';
import { createDialogue } from '../ui/dialogue.js';
import { createSaveSystem } from '../save/saveSystem.js';
import { createSoundEffects } from '../audio/soundEffects.js';
import { createRadio } from '../audio/radio.js';
import { createRng } from './rng.js';
import { createEvents } from './events.js';
import { createInput } from './input.js';
import { createParticles } from '../fx/particles.js';
import { createBloomPass } from '../fx/bloomPass.js';
import { createEffects } from '../fx/effects.js';
import { createGlowPoints, glowScale } from '../fx/glowSprites.js';
import { createCityLayout } from '../world/cityLayout.js';
import { createCollision } from '../world/collision.js';
import { createSkyAndLighting } from '../world/skyAndLighting.js';
import { buildCity } from '../world/cityBuilder.js';
import { buildWaterfront } from '../world/waterfront.js';
import { buildStreetProps } from '../world/streetProps.js';

export function createGame(canvas, seed = 1) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const bloom = createBloomPass(renderer);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 2400);
  camera.position.set(0, 40, 80);

  const game = { scene, camera, renderer, bloom, time: 0, realTime: 0, day: 3, mode: 'loading', settings: { sensitivity: 1, invertY: false, volume: 0.8, music: 0.6 } };
  game.rng = createRng(seed);
  game.events = createEvents();
  game.input = createInput(canvas);
  game.layout = createCityLayout();
  game.collision = createCollision(game.layout.buildings);
  game.sky = createSkyAndLighting(renderer, scene);
  const city = buildCity(game.layout);
  scene.add(city.group);
  game.city = city;
  game.waterfront = buildWaterfront(scene, game.sky);
  game.props = buildStreetProps(game.layout, scene);
  const beacons = createGlowPoints([...city.beacons, ...game.waterfront.lampPoints], [...city.beacons, ...game.waterfront.lampPoints].map(() => new THREE.Color('#ff2a2a')), [...city.beacons, ...game.waterfront.lampPoints].map(() => 3.5));
  scene.add(beacons);
  game.particles = createParticles(scene, game.rng.fork());
  game.fx = createEffects(scene, game.particles, game.rng.fork());
  game.cameraRig = createCameraRig(game, camera);
  game.vehicles = createVehicleManager(game);
  game.economy = createEconomy(game);
  game.weapons = createWeapons(game);
  const spawn = game.layout.pois.safehouse;
  game.player = createPlayer(game, spawn.x, spawn.z);
  game.wanted = createWantedSystem(game);
  game.police = createPoliceDispatch(game);
  game.traffic = createTraffic(game);
  game.peds = createPedestrians(game);
  game.mapImage = renderCityMap(game.layout, { labels: false });
  game.hud = createHud(game);
  game.minimap = createMinimap(game, document.getElementById('minimap'), game.mapImage);
  game.waypoint = null;
  game.extraHumanoids = [];
  game.audio = createSoundEffects(game);
  game.radio = createRadio(game);
  game.dialogue = createDialogue(game);
  game.activities = createActivities(game);
  game.missions = createMissionRunner(game);
  game.crew = createCrew(game);
  game.garageShop = createGarageShop(game);
  game.save = createSaveSystem(game);
  game.pauseMenu = createPauseMenu(game);
  game.shop = createGarageScreen(game);
  game.extraBlips = () => [...game.activities.blips(), ...game.missions.blips()];

  let humanoidCache = [];
  game.humanoids = () => humanoidCache;
  game.mapBlips = () => {
    const out = [];
    for (const poi of Object.values(game.layout.pois)) out.push({ x: poi.x, z: poi.z, color: poi.color, icon: poi.icon });
    if (game.waypoint) out.push({ x: game.waypoint.x, z: game.waypoint.z, color: '#d36bff', icon: 'W', always: true });
    for (const b of game.extraBlips?.() || []) out.push(b);
    return out;
  };

  let deathTimer = 0;
  game.busted = () => {
    if (game.mode !== 'play' || game.respawning) return;
    game.respawning = 'busted';
    deathTimer = 0;
    game.economy.stats.timesBusted++;
    game.hud.big('BUSTED', 'SCPD took $500 and your guns', 'busted', 4);
    game.player.controlsLocked = true;
    game.events.emit('playerDown', { reason: 'busted' });
  };

  function respawn() {
    const busted = game.respawning === 'busted';
    const poi = busted ? game.layout.pois.police : game.layout.pois.hospital;
    if (game.player.vehicle) game.player.exitVehicle(true);
    const h = game.player.hero;
    h.alive = true; h.health = 100; h.deadTime = 0; h.model.body.rotation.set(0, 0, 0); h.model.body.position.y = 0;
    game.player.teleport(poi.x, poi.z + 4, 0);
    game.player.controlsLocked = false;
    game.wanted.clear();
    game.police.reset();
    game.crew.reset();
    if (busted) {
      game.economy.addMoney(-500);
      const inv = game.weapons.inv;
      for (const id of Object.keys(inv.ammo)) { inv.ammo[id] = Math.floor(inv.ammo[id] * 0.3); }
    } else game.economy.addMoney(-Math.min(1000, Math.floor(game.economy.money * 0.1)));
    game.respawning = null;
    game.sky.setHour(game.sky.hour + 2);
    game.hud.notify(busted ? 'Released from SCPD Precinct 3' : 'Discharged from St. Maren Medical');
  }

  game.update = (dt) => {
    game.time += dt;
    humanoidCache = [game.player.hero, ...game.peds.list, ...game.police.officers, ...game.extraHumanoids];
    if (game.mode === 'play') {
      game.player.update(dt);
      game.weapons.update(dt);
      game.traffic.update(dt);
      game.peds.update(dt);
      game.police.update(dt);
      game.missions.update(dt);
      game.activities.update(dt);
      game.shop.update(dt);
      game.crew.update(dt);
      game.radio.update(dt);
      game.wanted.update(dt);
      game.economy.stats.playSeconds += dt;
      if (game.player.vehicle) game.economy.stats.distanceKm += Math.abs(game.player.vehicle.speed) * dt / 1000;
      if (!game.player.hero.alive && !game.respawning) {
        game.respawning = 'wasted'; deathTimer = 0;
        game.economy.stats.timesWasted++;
        game.hud.big('WASTED', 'St. Maren Medical charged you for the stitches', 'wasted', 4);
        game.events.emit('playerDown', { reason: 'wasted' });
      }
      if (game.respawning) { deathTimer += dt; if (deathTimer > 4) respawn(); }
    } else {
      game.peds.update(dt);
      game.police.update(dt);
    }
    game.vehicles.update(dt);
    game.particles.update(dt);
    game.fx.update(dt);
    const focus = game.player.position;
    game.sky.update(dt, focus, camera.position);
    if (game.sky.hour < game.lastHour) game.day++;
    game.lastHour = game.sky.hour;
    game.waterfront.update(dt);
    game.input.endFrame();
  };

  game.frame = (dt) => {
    game.realTime += dt;
    game.cameraRig.update(dt);
    const nf = game.sky.nightFactor;
    for (const m of city.nightMaterials) m.emissiveIntensity = nf * 1.4 + 0.02;
    for (const m of city.signMaterials) m.color.setScalar(0.45 + nf * 0.75);
    game.props.glows.material.uniforms.intensity.value = 0.08 + nf * 1.1;
    beacons.material.uniforms.intensity.value = Math.sin(game.realTime * 3) > 0 ? 0.6 + nf : 0.1;
    if (game.mode === 'play' || game.mode === 'shot') { game.hud.update(dt); game.minimap.update(dt); contextHelp(); }
    game.audio.update();
    glowScale.value = renderer.domElement.height / 2 / Math.tan((camera.fov * Math.PI) / 360);
    if (game.shop.open) game.shop.render(dt);
    else bloom.render(scene, camera);
  };

  function contextHelp() {
    const p = game.player;
    let help = '';
    if (game.respawning || p.controlsLocked) help = game.dialogue.active ? 'Press <kbd>ENTER</kbd> to skip' : '';
    else if (!p.vehicle) {
      const v = game.vehicles.nearest(p.hero.x, p.hero.z, 3.2, (c) => !c.exploded && c.driver !== 'cop');
      if (v) help = `Press <kbd>F</kbd> to ${v.driver === 'npc' ? 'steal' : 'enter'} the ${v.spec.name}`;
    } else if (p.vehicle.type === 'taxi' && !game.activities.active && !game.missions.active) help = 'Press <kbd>T</kbd> for taxi fares · <kbd>Q</kbd> radio';
    game.hud.help(help);
  }

  game.resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    bloom.setSize(size.x, size.y);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', game.resize);
  game.resize();
  return game;
}
