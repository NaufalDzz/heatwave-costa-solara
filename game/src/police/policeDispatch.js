// SCPD response to the wanted level: cruisers dispatched along the roads that chase, flank and
// ram, shoot from the window at four stars, officers (SWAT at five) who bail out and fire,
// roadblocks across the player's path from three stars, the Air-1 helicopter from four, the
// dispatch board rows with each unit's live status, line-of-sight checks and getting busted.
import { Humanoid } from '../characters/humanoid.js';
import { OUTFITS } from '../characters/humanoidModel.js';
import { steerToward, routeTarget } from '../ai/driving.js';
import { updateGunman } from '../combat/gunmanAI.js';
import { createHelicopter } from './helicopter.js';
import { nearestNode } from '../ai/roadGraph.js';

const CARS_BY_LEVEL = [0, 2, 3, 4, 5, 6];
const CALLSIGNS = ['VIPER', 'COMET', 'RAZOR', 'HALO', 'EMBER', 'BOLT', 'ONYX', 'SABLE'];

export function createPoliceDispatch(game) {
  const units = []; // { id, callsign, vehicle, officers: [], status, roadblock }
  const officers = [];
  let callsign = 11, roadblockTimer = 8, bustTimer = 0, spawnTimer = 0;
  const helicopter = createHelicopter(game);

  function spawnPoint(minD, maxD, ahead = false) {
    const p = game.player.position;
    const nodes = game.layout.nodes;
    const fx = Math.sin(game.player.heading), fz = Math.cos(game.player.heading);
    let best = null, bestScore = -Infinity;
    for (let k = 0; k < 24; k++) {
      const n = nodes[Math.floor(game.rng.next() * nodes.length)];
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < minD || d > maxD) continue;
      const dot = ((n.x - p.x) * fx + (n.z - p.z) * fz) / d;
      const score = ahead ? dot : -Math.abs(dot) + game.rng.next();
      if (score > bestScore) { bestScore = score; best = n; }
    }
    return best;
  }

  function addCar(node, opts = {}) {
    const p = game.player.position;
    const heading = Math.atan2(p.x - node.x, p.z - node.z);
    const v = game.vehicles.spawn(opts.type || 'police', node.x + (game.rng.next() - 0.5) * 4, node.z + (game.rng.next() - 0.5) * 4, heading, { driver: 'cop' });
    v.siren = true;
    v.condition = 100;
    const unit = { id: callsign, callsign: `${CALLSIGNS[callsign % CALLSIGNS.length]}-${callsign++}`, vehicle: v, officers: [], status: 'EN ROUTE', kind: v.spec.name.replace('SCPD ', ''), roadblock: !!opts.roadblock };
    v.unit = unit;
    v.controller = (veh, dt) => driveUnit(unit, veh, dt);
    units.push(unit);
    return unit;
  }

  function deployOfficers(unit, count) {
    const v = unit.vehicle;
    for (let k = 0; k < count; k++) {
      const side = k % 2 ? 1 : -1;
      const h = new Humanoid(game.scene, game.wanted.level >= 5 ? OUTFITS.swat : OUTFITS.cop, game.wanted.level >= 5 ? 'swat' : 'cop',
        v.x - Math.cos(v.heading) * side * (v.spec.wid / 2 + 0.7), v.z + Math.sin(v.heading) * side * (v.spec.wid / 2 + 0.7), game.rng);
      h.heading = v.heading;
      h.unit = unit;
      if (h.kind === 'swat') h.armor = 60;
      unit.officers.push(h);
      officers.push(h);
    }
    v.driver = null;
    unit.deployed = true;
  }

  /** At four stars the passenger leans out and fires at a car alongside or ahead. */
  function windowFire(unit, v, d, dt) {
    unit.fireTimer = (unit.fireTimer ?? 1 + game.rng.next()) - dt;
    if (game.wanted.level < 4 || d > 30 || unit.fireTimer > 0) return;
    unit.fireTimer = 0.9 + game.rng.next() * 0.8;
    const p = game.player.position;
    if (!game.collision.lineOfSight(v.x, v.y + 1.4, v.z, p.x, p.y + 1, p.z)) return;
    const ox = v.x + Math.cos(v.heading) * 1.1, oy = v.y + 1.45, oz = v.z - Math.sin(v.heading) * 1.1;
    let dx = p.x - ox, dy = p.y + 0.9 - oy, dz = p.z - oz;
    const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
    game.weapons.fire({ x: ox, y: oy, z: oz, kind: 'cop', inVehicle: v }, { x: ox + dx * 1.5, y: oy + dy * 1.5, z: oz + dz * 1.5 }, { x: dx, y: dy, z: dz }, { id: 'smg', damage: 9, range: 60, spread: 0.05 }, { muzzle: [ox, oy, oz], damageScale: 0.4, friendly: true });
    unit.firing = game.time;
  }

  function driveUnit(unit, v, dt) {
    if (v.condition <= 0) { unit.status = 'DOWN'; return null; }
    if (unit.roadblock) { unit.status = 'ROADBLOCK'; return { throttle: 0, steer: 0, handbrake: true }; }
    if (unit.deployed) {
      const p = game.player.position;
      unit.status = unit.officers.some((h) => h.alive && Math.hypot(h.x - p.x, h.z - p.z) < 24) && game.wanted.level >= 2 ? 'FIRING' : 'ON FOOT';
      return { throttle: 0, steer: 0, handbrake: true };
    }
    if (game.crew?.blackout && game.wanted.level > 0) {
      unit.status = 'SCRAMBLED';
      const t = routeTarget(game, v, v.x + Math.sin(v.heading + unit.id) * 200, v.z + Math.cos(v.heading + unit.id) * 200);
      return steerToward(game, v, t.x, t.z, 12, dt);
    }
    const p = game.player.position;
    const d = Math.hypot(p.x - v.x, p.z - v.z);
    if (game.wanted.level === 0) {
      unit.status = 'RETURNING';
      const far = routeTarget(game, v, v.x + Math.sin(v.heading) * 400, v.z + Math.cos(v.heading) * 400);
      return steerToward(game, v, far.x, far.z, 14, dt);
    }
    const pv = game.player.vehicle;
    if (!pv && d < 22 && Math.abs(v.speed) < 6) { deployOfficers(unit, game.wanted.level >= 3 ? 2 : 1 + (game.rng.next() < 0.5 ? 1 : 0)); unit.status = 'ON FOOT'; return null; }
    if (game.wanted.searching) {
      unit.status = 'SEARCHING';
      const z = game.wanted.searchZone;
      const t = routeTarget(game, v, z.x + Math.sin(unit.id) * z.r * 0.5, z.z + Math.cos(unit.id) * z.r * 0.5);
      return steerToward(game, v, t.x, t.z, 18, dt);
    }
    if (d > 70) {
      unit.status = 'EN ROUTE';
      const t = routeTarget(game, v, p.x, p.z);
      return steerToward(game, v, t.x, t.z, 34, dt, { drift: true });
    }
    // Close pursuit: aim a little ahead of a moving car to cut it off and ram.
    const lead = pv ? Math.min(d / 25, 1.2) : 0;
    const tx = p.x + (pv ? pv.vx * lead : 0), tz = p.z + (pv ? pv.vz * lead : 0);
    // Alongside the player's car (beside it rather than behind) counts as flanking.
    const along = pv ? ((v.x - pv.x) * Math.sin(pv.heading) + (v.z - pv.z) * Math.cos(pv.heading)) : 0;
    const beside = pv ? Math.abs((v.x - pv.x) * Math.cos(pv.heading) - (v.z - pv.z) * Math.sin(pv.heading)) : 0;
    windowFire(unit, v, d, dt);
    unit.status = game.time - (unit.firing ?? -9) < 0.8 ? 'FIRING' : pv && d < 14 && beside > 2.2 && along > -5 ? 'FLANKING' : pv && d < 30 && game.wanted.level >= 2 ? 'RAMMING' : 'PURSUIT';
    return steerToward(game, v, tx, tz, pv ? 40 : 12, dt, { avoidCars: false, drift: true, arrive: !pv, ignore: pv });
  }

  function placeRoadblock() {
    const p = game.player.position;
    const fx = Math.sin(game.player.heading), fz = Math.cos(game.player.heading);
    const n = nearestNode(game.layout.nodes, p.x + fx * 85, p.z + fz * 85);
    if (Math.hypot(n.x - p.x, n.z - p.z) < 45) return;
    const across = Math.abs(fx) > Math.abs(fz) ? 0 : Math.PI / 2;
    for (const off of [-3.4, 3.4]) {
      const unit = addCar({ x: n.x + (across ? off : 0), z: n.z + (across ? 0 : off) }, { roadblock: true });
      unit.vehicle.heading = across + (off > 0 ? Math.PI : 0);
      unit.vehicle.x = n.x + (across ? off : 0); unit.vehicle.z = n.z + (across ? 0 : off);
      deployOfficers(unit, 1);
      unit.status = 'ROADBLOCK';
    }
    game.hud.notify('Dispatch: roadblock ahead', '#7a4dff');
  }

  function removeUnit(unit) {
    if (unit.vehicle && !unit.vehicle.removed && game.player.vehicle !== unit.vehicle) game.vehicles.remove(unit.vehicle);
    for (const h of unit.officers) { h.remove(); officers.splice(officers.indexOf(h), 1); }
    units.splice(units.indexOf(unit), 1);
  }

  // A cruiser the player steals leaves the force.
  game.events.on('enteredVehicle', ({ vehicle }) => {
    const u = vehicle.unit;
    if (!u) return;
    vehicle.unit = null; vehicle.siren = false;
    u.vehicle = null;
    if (!u.officers.length) units.splice(units.indexOf(u), 1);
  });

  const dispatch = {
    helicopter,
    officers,
    units: () => units.filter((u) => u.vehicle && !u.vehicle.exploded && !u.vehicle.removed).map((u) => u.vehicle),
    placeRoadblock,
    spawnUnitNear(x, z, heading) { const u = addCar({ x, z }); u.vehicle.heading = heading; return u; },
    playerSeen() {
      const p = game.player.position;
      const eye = p.y + 1.2;
      for (const u of units) {
        const v = u.vehicle;
        if (v && !v.exploded && v.driver === 'cop') {
          const d = Math.hypot(v.x - p.x, v.z - p.z);
          if (d < 85 && game.collision.lineOfSight(v.x, v.y + 1.4, v.z, p.x, eye, p.z)) return true;
        }
      }
      for (const h of officers) if (h.alive && Math.hypot(h.x - p.x, h.z - p.z) < 70 && game.collision.lineOfSight(h.x, h.y + 1.6, h.z, p.x, eye, p.z)) return true;
      return helicopter.seesPlayer();
    },
    nearbyWitness(x, z, r) {
      for (const h of officers) if (h.alive && Math.hypot(h.x - x, h.z - z) < r) return true;
      for (const u of units) if (u.vehicle && Math.hypot(u.vehicle.x - x, u.vehicle.z - z) < r) return true;
      return game.peds.countNear(x, z, r) > 0;
    },
    dispatchRows() {
      const p = game.player.position;
      const rows = units.filter((u) => u.vehicle && !u.vehicle.removed).map((u) => ({ callsign: u.callsign, kind: u.officers.length && u.deployed ? 'Officers' : u.kind, icon: u.deployed ? 'foot' : 'car', dist: Math.round(Math.hypot(u.vehicle.x - p.x, u.vehicle.z - p.z)), status: u.vehicle.exploded ? 'DOWN' : u.status }));
      if (helicopter.active) rows.push({ callsign: 'AIR-1', kind: 'Sparrow Heli', icon: 'heli', dist: Math.round(Math.hypot(helicopter.x - p.x, helicopter.z - p.z)), status: game.crew?.blackout ? 'SCRAMBLED' : helicopter.spotting ? 'SPOTLIGHT' : 'SEARCHING' });
      return rows.sort((a, b) => (a.status === 'DOWN') - (b.status === 'DOWN') || a.dist - b.dist);
    },
    allHumanoids: () => officers,
    reset() { while (units.length) removeUnit(units[0]); helicopter.dismiss(true); bustTimer = 0; },
    update(dt) {
      const level = game.wanted.level;
      const p = game.player.position;
      spawnTimer -= dt;
      const active = units.filter((u) => !u.roadblock && u.vehicle && !u.vehicle.exploded);
      if (level > 0 && !game.wanted.searching && active.length < CARS_BY_LEVEL[level] && spawnTimer <= 0) {
        const n = spawnPoint(90, 200);
        if (n) addCar(n);
        spawnTimer = 2.5;
      }
      if (level >= 3) {
        roadblockTimer -= dt;
        if (roadblockTimer <= 0 && game.player.vehicle && Math.abs(game.player.vehicle.speed) > 10) { placeRoadblock(); roadblockTimer = 28; }
      }
      helicopter.update(dt, level >= 4);
      // Officers on foot.
      let arresting = false;
      for (const h of officers) {
        if (!h.alive) { h.animate(dt); continue; }
        if (level === 0) {
          // Walk back to the car and leave.
          const v = h.unit.vehicle;
          if (v && !v.exploded) {
            const d = Math.hypot(v.x - h.x, v.z - h.z);
            if (d < 3) { h.inVehicle = v; h.sync(); continue; }
            h.heading = Math.atan2(v.x - h.x, v.z - h.z); h.speed = 4;
            h.x += Math.sin(h.heading) * 4 * dt; h.z += Math.cos(h.heading) * 4 * dt;
          }
          h.animate(dt);
          continue;
        }
        const res = updateGunman(game, h, dt, { range: h.kind === 'swat' ? 22 : 15, weapon: h.kind === 'swat' ? 'rifle' : level >= 3 ? 'smg' : 'pistol', arrest: level === 1 && !game.player.vehicle, inaccuracy: h.kind === 'swat' ? 0.04 : 0.07, damageScale: 0.35 });
        if (res && res.dist < 2.2 && !game.player.vehicle && level <= 2 && game.player.speed < 3) arresting = true;
      }
      // Re-board when the player drives off.
      for (const u of units) {
        if (!u.deployed || u.roadblock || !u.vehicle || u.vehicle.exploded) continue;
        const live = u.officers.filter((h) => h.alive);
        const pv = game.player.vehicle;
        if (pv && live.length && live.every((h) => Math.hypot(h.x - u.vehicle.x, h.z - u.vehicle.z) < 4) && Math.hypot(pv.x - u.vehicle.x, pv.z - u.vehicle.z) > 30) {
          for (const h of live) { h.remove(); officers.splice(officers.indexOf(h), 1); }
          u.officers = u.officers.filter((h) => !h.alive);
          u.deployed = false; u.vehicle.driver = 'cop';
        }
        if (!live.length && !pv) { u.vehicle.driver = null; }
      }
      bustTimer = arresting ? bustTimer + dt : Math.max(0, bustTimer - dt * 2);
      if (bustTimer > 1.6) { bustTimer = 0; game.busted(); }
      // Clean up far, wrecked or no-longer-needed units.
      for (const u of [...units]) {
        const v = u.vehicle;
        const d = v ? Math.hypot(v.x - p.x, v.z - p.z) : 999;
        const done = (level === 0 && d > 110) || d > 320 || (v && v.exploded && d > 140) || (u.roadblock && d > 160);
        if (done && game.player.vehicle !== v) removeUnit(u);
      }
      for (let i = officers.length - 1; i >= 0; i--) {
        const h = officers[i];
        if ((!h.alive && h.deadTime > 25) || Math.hypot(h.x - p.x, h.z - p.z) > 300) {
          h.remove(); officers.splice(i, 1);
          if (h.unit) h.unit.officers = h.unit.officers.filter((o) => o !== h);
        }
      }
    },
  };
  return dispatch;
}
