// Small numeric helpers shared by physics, AI and the camera.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** Frame-rate independent exponential approach of a toward b. */
export const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);
/** Shortest signed difference from angle a to angle b, in -PI..PI. */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const formatMoney = (n) => '$' + Math.floor(n).toLocaleString('en-US');
export function formatClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
