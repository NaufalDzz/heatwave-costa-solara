// Side activities: the Ocean Mile street race against three AI racers, Sunline taxi fares in any
// cab, thirty hidden Sun Tokens, and five unique stunt jumps off ramps around the city.
import * as THREE from 'three';
import { createMarker } from './missionMarkers.js';
import { steerToward } from '../ai/driving.js';
import { Humanoid } from '../characters/humanoid.js';
import { randomLook } from '../characters/humanoidModel.js';
import { formatMoney } from '../core/mathUtils.js';

const RACE = { name: 'Ocean Mile', points: [[200, 400], [0, 400], [-200, 400], [-320, 400], [-320, 240], [-160, 240], [0, 240], [160, 240], [320, 240], [400, 240], [400, 400], [330, 400]], prize: 3000 };

function buildRamps(scene, ramps) {
  const mat = new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.7 });
  const stripe = new THREE.MeshBasicMaterial({ color: '#ffcf4a', toneMapped: false });
  for (const r of ramps) {
    const g = new THREE.BufferGeometry();
    const L = r.len, W = r.w / 2, H = r.h;
    const v = [-W, 0, 0, W, 0, 0, W, H, L, -W, H, L, -W, 0, L, W, 0, L];
    const idx = [0, 2, 1, 0, 3, 2, 3, 5, 2, 3, 4, 5, 0, 4, 3, 1, 2, 5];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.castShadow = m.receiveShadow = true;
    m.position.set(r.x, 0, r.z);
    m.rotation.y = Math.atan2(r.dx, r.dz);
    for (let k = 1; k < 4; k++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(r.w * 0.9, 0.5), stripe);
      s.position.set(0, (H * k) / 4 + 0.03, (L * k) / 4);
      s.rotation.x = -Math.PI / 2 - Math.atan2(H, L);
      m.add(s);
    }
    scene.add(m);
  }
}

export function createActivities(game) {
  const layout = game.layout;
  buildRamps(game.scene, layout.ramps);
  const collected = new Set(), stunts = new Set();
  // Sun tokens: spinning gold discs.
  const tokenMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ffc93c', emissive: '#ff8a00', emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.25 }), layout.tokens.length);
  game.scene.add(tokenMesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);

  const raceMarker = createMarker(game.scene, layout.pois.race.x, layout.pois.race.z, '#e040fb', { radius: 3 });
  let race = null, taxi = null, lastRamp = null;

  function startRace() {
    const pv = game.player.vehicle;
    race = { t: -3, cp: 0, racers: [], markers: [], done: false };
    pv.heading = -Math.PI / 2; pv.vx = pv.vz = 0;
    const lanes = [[0, -3.5], [8, 3.5], [8, -3.5]];
    for (const [ox, oz] of lanes) {
      const v = game.vehicles.spawn(game.rng.pick(['sports', 'muscle', 'sports']), pv.x + ox, pv.z + oz, -Math.PI / 2, { persistent: true, tag: 'racer' });
      v.racer = { cp: 0, skill: 0.85 + game.rng.next() * 0.2 };
      v.controller = (veh, dt) => {
        if (race.t < 0 || veh.racer.cp >= RACE.points.length) return { throttle: 0, steer: 0, handbrake: true };
        const [x, z] = RACE.points[veh.racer.cp];
        if (Math.hypot(veh.x - x, veh.z - z) < 12) veh.racer.cp++;
        return steerToward(game, veh, x, z, 40 * veh.racer.skill, dt, { drift: true });
      };
      race.racers.push(v);
    }
    placeRaceMarker();
    game.hud.big('3', 'OCEAN MILE · Street race', 'passed', 1);
  }
  function placeRaceMarker() {
    for (const m of race.markers) m.remove();
    const pts = RACE.points;
    race.markers = [createMarker(game.scene, pts[race.cp][0], pts[race.cp][1], '#e040fb', { radius: 6, height: 28 })];
  }
  function endRace(won) {
    for (const v of race.racers) if (!v.removed) { v.controller = null; v.persistent = false; v.driver = 'npc'; game.traffic.parked.add(v); }
    for (const m of race.markers) m.remove();
    if (won) { game.economy.addMoney(RACE.prize); game.economy.addRespect(200); game.economy.stats.racesWon++; game.hud.big('RACE WON', `${formatMoney(RACE.prize)} · Ocean Mile champion`, 'passed', 4); game.audio?.jingle(true); }
    else game.hud.big('RACE LOST', race.done ? `Finished ${race.place}` : 'Race abandoned', 'failed', 3);
    race = null;
  }
  function racePosition() {
    const score = (cp, x, z) => cp * 10000 - (cp < RACE.points.length ? Math.hypot(x - RACE.points[cp][0], z - RACE.points[cp][1]) : 0);
    const p = game.player.position;
    const mine = score(race.cp, p.x, p.z);
    return 1 + race.racers.filter((v) => score(v.racer.cp, v.x, v.z) > mine).length;
  }

  function newFare() {
    const p = game.player.position;
    const b = layout.blocks.filter((bl) => { const d = Math.hypot((bl.bx0 + bl.bx1) / 2 - p.x, (bl.bz0 + bl.bz1) / 2 - p.z); return d > 90 && d < 260; });
    const blk = game.rng.pick(b.length ? b : layout.blocks);
    const x = blk.bx0 + 1.5, z = (blk.bz0 + blk.bz1) / 2;
    const ped = new Humanoid(game.scene, randomLook(game.rng), 'ped', x, z, game.rng);
    ped.y = 0.18;
    game.extraHumanoids.push(ped);
    taxi.ped = ped; taxi.stage = 'pickup';
    taxi.marker?.remove();
    taxi.marker = createMarker(game.scene, x - 3, z, '#ffd600', { radius: 2.5, height: 16 });
    taxi.target = { x: x - 3, z };
  }

  const act = {
    get active() { return race || taxi; },
    hudInfo() {
      if (race) {
        const pos = racePosition();
        return { tag: 'STREET RACE', title: RACE.name, stages: RACE.points, stage: race.cp, objective: race.t < 0 ? `Get ready… ${Math.ceil(-race.t)}` : `Position ${pos}/4 · reach checkpoint ${race.cp + 1}`, timer: race.t > 0 ? `${race.t.toFixed(1)}s` : '', extra: `Prize <b>${formatMoney(RACE.prize)}</b>` };
      }
      if (taxi) return { tag: 'SUNLINE TAXI', title: 'Taxi Fares', stages: [0, 1], stage: taxi.stage === 'pickup' ? 0 : 1, objective: taxi.stage === 'pickup' ? 'Pick up the fare (stop beside them)' : 'Drive the fare to the destination', timer: taxi.stage === 'drop' ? `${Math.max(0, taxi.clock).toFixed(0)}s` : '', extra: `Fares today: <b>${taxi.count}</b> · press T to clock off` };
      return null;
    },
    gpsTarget() { return race ? { x: RACE.points[race.cp][0], z: RACE.points[race.cp][1] } : taxi?.target || null; },
    blips() {
      const out = [{ x: layout.pois.race.x, z: layout.pois.race.z, color: '#e040fb', icon: 'flag' }];
      layout.ramps.forEach((r, i) => { if (!stunts.has(i)) out.push({ x: r.x, z: r.z, color: '#ff9f1c', icon: 'jump', size: 6 }); });
      if (taxi?.target) out.push({ x: taxi.target.x, z: taxi.target.z, color: '#ffd600', icon: 'taxi', always: true });
      return out;
    },
    update(dt) {
      const p = game.player.position, pv = game.player.vehicle;
      const t = game.time;
      // Tokens spin and get picked up.
      layout.tokens.forEach((tok, i) => {
        if (collected.has(i)) { m4.makeScale(0, 0, 0); tokenMesh.setMatrixAt(i, m4); return; }
        q.setFromAxisAngle(up, t * 2 + i);
        m4.compose(new THREE.Vector3(tok.x, 1.2 + Math.sin(t * 2 + i) * 0.2, tok.z), q, new THREE.Vector3(1, 1, 1));
        tokenMesh.setMatrixAt(i, m4);
        if (Math.hypot(p.x - tok.x, p.z - tok.z) < (pv ? 4 : 2) && p.y < 4) {
          collected.add(i);
          game.economy.stats.tokens = collected.size;
          game.economy.addMoney(250, `SUN TOKEN ${collected.size}/${layout.tokens.length}`);
          game.economy.addRespect(25);
          game.audio?.cash();
          game.particles.emit('spark', tok.x, 1.2, tok.z, 20);
        }
      });
      tokenMesh.instanceMatrix.needsUpdate = true;
      // Stunt jumps: remember the ramp we drove up, score the landing.
      if (pv) {
        layout.ramps.forEach((r, i) => { if (Math.hypot(pv.x - r.x - r.dx * r.len * 0.5, pv.z - r.z - r.dz * r.len * 0.5) < r.len * 0.7 && pv.y > 0.5) lastRamp = { i, t }; });
      }
      raceMarker.update(t);
      if (!race && !taxi && pv && !game.missions.active && Math.hypot(p.x - layout.pois.race.x, p.z - layout.pois.race.z) < 6 && Math.abs(pv.speed) < 4) startRace();
      if (race) {
        race.t += dt;
        for (const m of race.markers) m.update(t);
        if (race.t > -0.02 && race.t - dt <= 0) { game.hud.big('GO!', '', 'passed', 1); game.audio?.checkpoint(); }
        if (race.t < 0 && pv) { pv.vx *= 0.5; pv.vz *= 0.5; }
        const [x, z] = RACE.points[race.cp];
        if (Math.hypot(p.x - x, p.z - z) < 12) {
          race.cp++; game.audio?.checkpoint();
          if (race.cp >= RACE.points.length) { race.done = true; race.place = racePosition(); return endRace(race.place === 1); }
          placeRaceMarker();
        }
        if (!pv || game.respawning) endRace(false);
      }
      // Taxi fares.
      if (pv && pv.type === 'taxi' && game.input.wasPressed('KeyT') && !race && !game.missions.active) {
        if (taxi) { taxi.marker?.remove(); if (taxi.ped) { taxi.ped.remove(); game.extraHumanoids.splice(game.extraHumanoids.indexOf(taxi.ped), 1); } taxi = null; game.hud.notify('Off duty'); }
        else { taxi = { count: 0 }; newFare(); game.hud.notify('On duty: Sunline Cabs', '#ffd600'); }
      }
      if (taxi) {
        if (!pv || pv.type !== 'taxi') { taxi.marker?.remove(); taxi.ped?.remove(); taxi = null; game.hud.notify('Fare lost: you left the cab', '#ff5252'); return; }
        taxi.marker?.update(t);
        if (taxi.stage === 'pickup' && Math.hypot(p.x - taxi.target.x, p.z - taxi.target.z) < 7 && Math.abs(pv.speed) < 3) {
          taxi.ped.remove(); game.extraHumanoids.splice(game.extraHumanoids.indexOf(taxi.ped), 1); taxi.ped = null;
          const far = layout.blocks.filter((bl) => Math.hypot(bl.bx0 - p.x, bl.bz0 - p.z) > 250);
          const blk = game.rng.pick(far);
          taxi.target = { x: blk.bx0 - 3, z: (blk.bz0 + blk.bz1) / 2 };
          taxi.dist = Math.hypot(taxi.target.x - p.x, taxi.target.z - p.z);
          taxi.clock = 20 + taxi.dist / 9;
          taxi.stage = 'drop';
          taxi.marker.remove(); taxi.marker = createMarker(game.scene, taxi.target.x, taxi.target.z, '#ffd600', { radius: 3, height: 20 });
        } else if (taxi.stage === 'drop') {
          taxi.clock -= dt;
          if (Math.hypot(p.x - taxi.target.x, p.z - taxi.target.z) < 8 && Math.abs(pv.speed) < 4) {
            const fare = Math.round(40 + taxi.dist * 0.7 + Math.max(0, taxi.clock) * 4);
            game.economy.addMoney(fare, 'Taxi fare');
            game.economy.addRespect(15);
            game.economy.stats.taxiFares++;
            taxi.count++;
            game.audio?.cash();
            newFare();
          }
        }
      }
    },
  };

  game.events.on('landed', ({ airTime }) => {
    if (!lastRamp || game.time - lastRamp.t > 4 || airTime < 0.6) return;
    const r = layout.ramps[lastRamp.i];
    const first = !stunts.has(lastRamp.i);
    stunts.add(lastRamp.i);
    const bonus = Math.round(airTime * (first ? 400 : 100));
    game.economy.addMoney(bonus, first ? `UNIQUE STUNT: ${r.name}` : 'Stunt bonus');
    if (first) { game.economy.stats.stuntJumps = stunts.size; game.economy.addRespect(60); game.hud.big('UNIQUE STUNT BONUS', `${r.name} · ${airTime.toFixed(1)}s airtime`, 'passed', 2.5); }
    lastRamp = null;
  });

  act.serialize = () => ({ tokens: [...collected], stunts: [...stunts] });
  act.restore = (d) => { collected.clear(); stunts.clear(); for (const i of d.tokens || []) collected.add(i); for (const i of d.stunts || []) stunts.add(i); };
  return act;
}
