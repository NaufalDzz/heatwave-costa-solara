// Civilian traffic: keeps a ring of cars around the player, each driving the right-hand lane of
// the road graph, turning at junctions, slowing for cars and people ahead, honking, panicking
// and speeding off after gunfire, plus parked cars along the kerbs and in lots.
import { VEHICLE_TYPES, TRAFFIC_MIX } from '../vehicles/vehicleModels.js';
import { lanePoint } from './roadGraph.js';
import { steerToward } from './driving.js';
import { clamp } from '../core/mathUtils.js';

const TARGET = 26, PARKED = 22, SPAWN_MIN = 70, SPAWN_MAX = 210, DESPAWN = 260;

export function createTraffic(game) {
  const cars = new Set();
  const parked = new Set();
  const nodes = game.layout.nodes;

  function controllerFor(v) {
    return (veh, dt) => {
      const t = veh.traffic;
      if (veh.driver !== 'npc') return null;
      const a = nodes[t.from], b = nodes[t.to];
      const seg = lanePoint(a, b, t.lane, 0);
      // Progress along the edge.
      const along = ((veh.x - a.x) * seg.dirX + (veh.z - a.z) * seg.dirZ) / seg.len;
      // Static's BLACKOUT: the signals are dead, so drivers near the player stop short of junctions.
      if (game.crew?.blackout && along > 0.8 && Math.hypot(veh.x - game.player.position.x, veh.z - game.player.position.z) < 180) return { throttle: 0, steer: 0, handbrake: true };
      if (along > 1 - 9 / seg.len) {
        const options = b.links.filter((id) => id !== t.from);
        t.from = t.to;
        t.to = options.length ? options[Math.floor(game.rng.next() * options.length)] : t.from;
        return { throttle: 0.3, steer: 0, handbrake: false };
      }
      const ahead = Math.min(1, along + 12 / seg.len);
      const p = lanePoint(a, b, t.lane, ahead);
      let speed = t.panic > 0 ? 24 : t.cruise;
      t.panic = Math.max(0, t.panic - dt);
      // Stop for people standing in the lane.
      const fx = Math.sin(veh.heading), fz = Math.cos(veh.heading);
      for (const h of game.humanoids()) {
        if (!h.alive || h.inVehicle) continue;
        const dx = h.x - veh.x, dz = h.z - veh.z, f = dx * fx + dz * fz;
        if (f > 0 && f < 12 && Math.abs(dx * fz - dz * fx) < 2) { speed = Math.min(speed, (f - 4) * 0.8); if (h === game.player.hero && game.rng.next() < dt * 0.4) game.audio?.horn(veh.x, veh.z); }
      }
      return steerToward(game, veh, p.x, p.z, Math.max(0, speed), dt);
    };
  }

  function spawnMoving(minD, maxD) {
    const pos = game.player.position;
    for (let tries = 0; tries < 10; tries++) {
      const a = nodes[Math.floor(game.rng.next() * nodes.length)];
      const toId = a.links[Math.floor(game.rng.next() * a.links.length)];
      const b = nodes[toId];
      const t = 0.2 + game.rng.next() * 0.5;
      const lane = game.rng.next() < 0.5 ? 0 : 1;
      const p = lanePoint(a, b, lane, t);
      const d = Math.hypot(p.x - pos.x, p.z - pos.z);
      if (d < minD || d > maxD) continue;
      if (game.vehicles.list.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < 9)) continue;
      return spawnOnLane(a.id, toId, lane, t);
    }
    return null;
  }

  function spawnOnLane(fromId, toId, lane, t, type) {
    const a = nodes[fromId], b = nodes[toId];
    const p = lanePoint(a, b, lane, t);
    const kind = type || TRAFFIC_MIX[Math.floor(game.rng.next() * TRAFFIC_MIX.length)];
    const v = game.vehicles.spawn(kind, p.x, p.z, Math.atan2(p.dirX, p.dirZ));
    const cruise = clamp(VEHICLE_TYPES[kind].maxSpeed * 0.3, 10, 15) + game.rng.next() * 3;
    v.traffic = { from: fromId, to: toId, lane, cruise, panic: 0 };
    const sp = cruise * 0.8;
    v.vx = p.dirX * sp; v.vz = p.dirZ * sp;
    v.controller = controllerFor(v);
    cars.add(v);
    return v;
  }

  function spawnParked(minD, maxD) {
    const pos = game.player.position;
    for (let tries = 0; tries < 8; tries++) {
      const b = game.layout.blocks[Math.floor(game.rng.next() * game.layout.blocks.length)];
      const side = Math.floor(game.rng.next() * 4);
      const u = 0.15 + game.rng.next() * 0.7;
      let x, z, h;
      if (side === 0) { x = b.bx0 + (b.bx1 - b.bx0) * u; z = b.bz0 - 0.9; h = -Math.PI / 2; }
      else if (side === 1) { x = b.bx0 + (b.bx1 - b.bx0) * u; z = b.bz1 + 0.9; h = Math.PI / 2; }
      else if (side === 2) { x = b.bx0 - 0.9; z = b.bz0 + (b.bz1 - b.bz0) * u; h = Math.PI; }
      else { x = b.bx1 + 0.9; z = b.bz0 + (b.bz1 - b.bz0) * u; h = 0; }
      const d = Math.hypot(x - pos.x, z - pos.z);
      if (d < minD || d > maxD) continue;
      if (game.vehicles.list.some((o) => Math.hypot(o.x - x, o.z - z) < 7)) continue;
      const kind = game.rng.pick(['sedan', 'sedan', 'suv', 'sports', 'muscle', 'van', 'taxi']);
      const v = game.vehicles.spawn(kind, x, z, h, { parked: true });
      parked.add(v);
      return v;
    }
    return null;
  }

  // Gunfire nearby makes drivers floor it.
  game.events.on('gunfire', (e) => {
    for (const v of cars) if (Math.hypot(v.x - e.x, v.z - e.z) < 50) v.traffic.panic = 8;
  });
  game.events.on('carjack', ({ vehicle }) => { cars.delete(vehicle); vehicle.traffic = null; });

  return {
    cars, parked, spawnOnLane,
    populate() {
      for (let k = 0; k < TARGET; k++) spawnMoving(25, SPAWN_MAX);
      for (let k = 0; k < PARKED; k++) spawnParked(10, 150);
    },
    clear() {
      for (const v of [...cars, ...parked]) if (v !== game.player.vehicle) game.vehicles.remove(v);
      cars.clear(); parked.clear();
    },
    update() {
      const pos = game.player.position;
      for (const v of [...cars, ...parked]) {
        const d = Math.hypot(v.x - pos.x, v.z - pos.z);
        const gone = v.removed || v === game.player.vehicle || v.driver === 'player';
        if (gone || (d > DESPAWN && !v.persistent) || (v.exploded && d > 120)) {
          if (!gone && !v.removed) game.vehicles.remove(v);
          cars.delete(v); parked.delete(v);
        }
      }
      if (cars.size < TARGET) spawnMoving(SPAWN_MIN, SPAWN_MAX);
      if (parked.size < PARKED) spawnParked(SPAWN_MIN, 160);
    },
  };
}
