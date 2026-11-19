// Path finding on the road graph (A* over junctions), used for the GPS route on the maps and by
// police units navigating toward the player; plus lane geometry helpers for drivers.
export function nearestNode(nodes, x, z) {
  let best = nodes[0], bd = Infinity;
  for (const n of nodes) {
    const d = (n.x - x) ** 2 + (n.z - z) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

/** Shortest path of node ids from a to b (A* with straight-line heuristic). */
export function findPath(nodes, a, b) {
  const open = new Set([a]);
  const g = new Map([[a, 0]]);
  const from = new Map();
  const h = (id) => Math.hypot(nodes[id].x - nodes[b].x, nodes[id].z - nodes[b].z);
  const f = new Map([[a, h(a)]]);
  while (open.size) {
    let cur = null, cf = Infinity;
    for (const id of open) if (f.get(id) < cf) { cf = f.get(id); cur = id; }
    if (cur === b) {
      const path = [cur];
      while (from.has(cur)) { cur = from.get(cur); path.unshift(cur); }
      return path;
    }
    open.delete(cur);
    for (const nb of nodes[cur].links) {
      const cost = g.get(cur) + Math.hypot(nodes[nb].x - nodes[cur].x, nodes[nb].z - nodes[cur].z);
      if (cost < (g.get(nb) ?? Infinity)) {
        from.set(nb, cur); g.set(nb, cost); f.set(nb, cost + h(nb)); open.add(nb);
      }
    }
  }
  return [a];
}

/** GPS polyline from (x0, z0) to (x1, z1) along the roads, as [[x, z], ...]. */
export function routeBetween(nodes, x0, z0, x1, z1) {
  const a = nearestNode(nodes, x0, z0), b = nearestNode(nodes, x1, z1);
  const ids = findPath(nodes, a.id, b.id);
  return [[x0, z0], ...ids.map((id) => [nodes[id].x, nodes[id].z]), [x1, z1]];
}

/** The point on the right-hand lane of edge a->b, lane 0 (inner) or 1 (outer), at parameter t. */
export function lanePoint(a, b, lane, t) {
  const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
  const off = lane ? 4.5 : 1.9;
  const rx = -dz / len, rz = dx / len;
  return { x: a.x + dx * t + rx * off, z: a.z + dz * t + rz * off, dirX: dx / len, dirZ: dz / len, len };
}
