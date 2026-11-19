// Building collisions on a spatial hash: push circles (people, cars) out of footprints, test
// line of sight for police and gunfire, and cast rays against building boxes.
const CELL = 40;

export function createCollision(buildings) {
  const cells = new Map();
  const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;
  for (const b of buildings) {
    for (let cx = Math.floor(b.x0 / CELL); cx <= Math.floor(b.x1 / CELL); cx++)
      for (let cz = Math.floor(b.z0 / CELL); cz <= Math.floor(b.z1 / CELL); cz++) {
        const k = key(cx, cz);
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(b);
      }
  }
  const near = (x, z) => cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || [];
  const solids = [];

  function each(x, z, r, fn) {
    const seen = new Set();
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
      for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++)
        for (const b of cells.get(key(cx, cz)) || []) if (!seen.has(b)) { seen.add(b); fn(b); }
    for (const s of solids) fn(s);
  }

  return {
    /** Extra temporary boxes (roadblock barriers) that also block movement. */
    solids,
    /**
     * Push a circle at (x, z) with radius r out of every footprint lower than its height y.
     * Returns { x, z, hit, nx, nz } with the push normal of the deepest contact.
     */
    resolve(x, z, r, y = 0) {
      let hit = false, nx = 0, nz = 0;
      each(x, z, r, (b) => {
        if (y > (b.h ?? 99) + 0.5) return;
        const px = Math.max(b.x0, Math.min(x, b.x1)), pz = Math.max(b.z0, Math.min(z, b.z1));
        let dx = x - px, dz = z - pz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) return;
        hit = true;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2), push = r - d;
          dx /= d; dz /= d;
          x += dx * push; z += dz * push; nx = dx; nz = dz;
        } else {
          // Centre is inside the box: leave by the nearest side.
          const opts = [[x - b.x0, -1, 0], [b.x1 - x, 1, 0], [z - b.z0, 0, -1], [b.z1 - z, 0, 1]].sort((a, c) => a[0] - c[0]);
          const [dist, ox, oz] = opts[0];
          x += ox * (dist + r); z += oz * (dist + r); nx = ox; nz = oz;
        }
      });
      return { x, z, hit, nx, nz };
    },
    /** Distance along a ray (unit dir) to the first building, or Infinity within maxDist. */
    raycast(ox, oy, oz, dx, dy, dz, maxDist) {
      let best = Infinity;
      const ex = ox + dx * maxDist, ez = oz + dz * maxDist;
      const r = maxDist / 2;
      each((ox + ex) / 2, (oz + ez) / 2, r, (b) => {
        let t0 = 0, t1 = maxDist;
        for (const [o, d, lo, hi] of [[ox, dx, b.x0, b.x1], [oy, dy, -1, b.h ?? 99], [oz, dz, b.z0, b.z1]]) {
          if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return; continue; }
          let ta = (lo - o) / d, tb = (hi - o) / d;
          if (ta > tb) [ta, tb] = [tb, ta];
          t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
          if (t0 > t1) return;
        }
        if (t0 < best) best = t0;
      });
      return best;
    },
    /** True when nothing solid stands between two points. */
    lineOfSight(ax, ay, az, bx, by, bz) {
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const len = Math.hypot(dx, dy, dz) || 1;
      return this.raycast(ax, ay, az, dx / len, dy / len, dz / len, len) >= len;
    },
    insideBuilding(x, z) {
      return near(x, z).some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
    },
  };
}
