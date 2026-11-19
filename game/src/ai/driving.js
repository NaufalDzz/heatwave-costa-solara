// Steering for AI drivers: head for a point at a target speed, feel ahead for walls and swerve,
// brake for cars in front, back out when stuck, and follow road-graph routes for long trips.
import { angleDiff, clamp } from '../core/mathUtils.js';
import { nearestNode, findPath } from './roadGraph.js';

/** Input that drives vehicle v toward (tx, tz) at up to `speed` m/s. */
export function steerToward(game, v, tx, tz, speed, dt, opts = {}) {
  const st = (v.drive ||= { stuck: 0, reverse: 0 });
  const want = Math.atan2(tx - v.x, tz - v.z);
  let diff = angleDiff(v.heading, want);
  // Feel ahead for buildings and steer toward the clearer side.
  const look = clamp(Math.abs(v.speed) * 0.9, 8, 26);
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  if (game.collision.raycast(v.x, v.y + 0.8, v.z, fx, 0, fz, look) < look) {
    const l = game.collision.raycast(v.x, v.y + 0.8, v.z, Math.sin(v.heading + 0.6), 0, Math.cos(v.heading + 0.6), look);
    const r = game.collision.raycast(v.x, v.y + 0.8, v.z, Math.sin(v.heading - 0.6), 0, Math.cos(v.heading - 0.6), look);
    diff += l > r ? 0.9 : -0.9;
  }
  let throttle = 1;
  const dist = Math.hypot(tx - v.x, tz - v.z);
  let target = speed;
  if (opts.arrive) target = Math.min(target, dist * 0.6);
  if (Math.abs(diff) > 0.9) target = Math.min(target, 9);
  if (opts.avoidCars !== false) {
    for (const o of game.vehicles.list) {
      if (o === v || o === opts.ignore) continue;
      const dx = o.x - v.x, dz = o.z - v.z;
      const ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 9 + Math.abs(v.speed) * 0.6 && side < 2.6) target = Math.min(target, Math.max(0, (ahead - 6) * 0.8));
    }
  }
  if (v.speed > target + 1) throttle = target < 1 ? -1 : -0.5;
  else if (v.speed > target - 1) throttle = 0.2;
  // Stuck against something: reverse with opposite lock for a moment.
  if (st.reverse > 0) {
    st.reverse -= dt;
    return { throttle: -1, steer: -Math.sign(diff || 1), handbrake: false };
  }
  if (throttle > 0.5 && Math.abs(v.speed) < 1 && target > 3) { st.stuck += dt; if (st.stuck > 1.4) { st.reverse = 1.3; st.stuck = 0; } }
  else st.stuck = Math.max(0, st.stuck - dt);
  const handbrake = !!opts.drift && Math.abs(diff) > 1.1 && v.speed > 16;
  return { throttle, steer: clamp(diff * 2.2, -1, 1), handbrake };
}

/** Follow the road graph toward a far goal; returns the next point to steer at. */
export function routeTarget(game, v, gx, gz) {
  const r = (v.route ||= { path: [], age: 99, goal: null });
  r.age += 1 / 60;
  const nodes = game.layout.nodes;
  if (r.age > 2 || !r.path.length) {
    r.age = 0;
    const a = nearestNode(nodes, v.x, v.z), b = nearestNode(nodes, gx, gz);
    r.path = findPath(nodes, a.id, b.id);
  }
  while (r.path.length > 1) {
    const n = nodes[r.path[0]];
    if (Math.hypot(n.x - v.x, n.z - v.z) < 14) r.path.shift(); else break;
  }
  const n = nodes[r.path[0]];
  if (r.path.length <= 1 && Math.hypot(n.x - v.x, n.z - v.z) < 20) return { x: gx, z: gz };
  return { x: n.x, z: n.z };
}
