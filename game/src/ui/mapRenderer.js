// Paints the city once into an offscreen map image (sea, beach, districts, parks, buildings,
// roads, bridges, district labels) shared by the radar and the pause-menu map, and draws the
// common blip icons onto either.
import { DISTRICTS, ISLAND, COAST, BEACH_END, BRIDGES } from '../world/cityLayout.js';

export const MAP = { x0: -620, z0: -560, size: 1340, px: 1340 };
export const toMap = (x, z) => [((x - MAP.x0) / MAP.size) * MAP.px, ((z - MAP.z0) / MAP.size) * MAP.px];

export function renderCityMap(layout, { labels = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = MAP.px;
  const g = c.getContext('2d');
  const k = MAP.px / MAP.size;
  const rect = (x0, z0, x1, z1) => { const [a, b] = toMap(x0, z0); g.fillRect(a, b, (x1 - x0) * k, (z1 - z0) * k); };
  const sea = g.createLinearGradient(0, 0, MAP.px, MAP.px);
  sea.addColorStop(0, '#1a5f86'); sea.addColorStop(1, '#0f3f63');
  g.fillStyle = sea; g.fillRect(0, 0, MAP.px, MAP.px);
  g.fillStyle = '#3b4a38'; rect(-760, -760, COAST, COAST);
  g.fillStyle = '#e7cf95'; rect(-760, COAST, COAST, BEACH_END);
  g.fillStyle = '#d9c38a'; rect(ISLAND.x0 - 6, ISLAND.z0 - 6, ISLAND.x1 + 6, ISLAND.z1 + 6);
  g.fillStyle = '#3c4656'; rect(ISLAND.x0, ISLAND.z0, ISLAND.x1, ISLAND.z1);
  for (const b of layout.blocks) {
    g.fillStyle = b.kind === 'park' ? '#3f7d3a' : '#3c4352';
    rect(b.bx0, b.bz0, b.bx1, b.bz1);
    g.fillStyle = DISTRICTS[b.district].color;
    g.globalAlpha = 0.42; rect(b.bx0, b.bz0, b.bx1, b.bz1); g.globalAlpha = 1;
  }
  for (const b of layout.buildings) {
    g.fillStyle = 'rgba(10,14,28,0.45)'; rect(b.x0 + 1.5, b.z0 + 1.5, b.x1 + 1.5, b.z1 + 1.5);
    g.fillStyle = b.h > 60 ? 'rgba(225,235,255,0.75)' : 'rgba(205,215,235,0.5)'; rect(b.x0, b.z0, b.x1, b.z1);
  }
  g.lineCap = 'square';
  for (const r of layout.roads) {
    const [a, b] = toMap(r.x0, r.z0), [c2, d] = toMap(r.x1, r.z1);
    g.strokeStyle = r.bridge ? '#f4efe2' : r.main ? '#dfe5ee' : '#a3acbd';
    g.lineWidth = (r.main ? 18 : 14) * k;
    g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke();
  }
  for (const r of [[-700, -240, -407, -240], [-700, 0, -407, 0], [-700, 240, -407, 240], [-160, -700, -160, -407], [160, -700, 160, -407]]) {
    const [a, b] = toMap(r[0], r[1]), [c2, d] = toMap(r[2], r[3]);
    g.strokeStyle = '#8f9580'; g.lineWidth = 10 * k;
    g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke();
  }
  for (const br of BRIDGES) { g.fillStyle = '#f5efe0'; rect(br.x0, br.z - 8, br.x1, br.z + 8); }
  if (labels) drawDistrictLabels(g, toMap, 30);
  return c;
}

/** District names in their colours, placed through project(x, z) -> [px, py] at the given size. */
export function drawDistrictLabels(g, project, fontPx, ids = null) {
  g.font = `italic 900 ${fontPx}px Arial Black, Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  const spots = [['downtown', 0, -125], ['neon', 240, 80], ['palmera', -120, 465], ['heights', -280, 100], ['ironworks', 220, -300], ['midtown', -120, -330], ['marina', 596, -40], ['hills', -560, -560]];
  for (const [id, x, z] of spots) {
    if (ids && !ids.includes(id)) continue;
    const [a, b] = project(x, z), name = DISTRICTS[id].name.toUpperCase();
    g.lineWidth = Math.max(3, fontPx * 0.22); g.strokeStyle = 'rgba(8,10,22,0.9)'; g.strokeText(name, a, b, fontPx * 7);
    g.fillStyle = DISTRICTS[id].color; g.fillText(name, a, b, fontPx * 7);
  }
}

const ICONS = { house: 'H', wrench: 'W', gun: 'G', cross: '+', badge: 'P', taxi: 'T', flag: 'R', mission: '!', token: '☀', jump: 'J' };

/** A round map blip with a letter glyph. */
export function drawBlip(g, x, y, color, icon, r = 9) {
  g.beginPath(); g.arc(x, y, r + 2, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,0.75)'; g.fill();
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = color; g.fill();
  if (icon) {
    g.fillStyle = '#111'; g.font = `900 ${Math.round(r * 1.25)}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ICONS[icon] || icon, x, y + 1);
  }
}

/** The player's arrow, pointing along heading in screen space. */
export function drawPlayerArrow(g, x, y, angle, size = 11) {
  g.save(); g.translate(x, y); g.rotate(angle);
  g.beginPath(); g.moveTo(0, -size); g.lineTo(size * 0.75, size * 0.8); g.lineTo(0, size * 0.35); g.lineTo(-size * 0.75, size * 0.8); g.closePath();
  g.fillStyle = '#ffffff'; g.strokeStyle = '#ff4fa3'; g.lineWidth = 3; g.stroke(); g.fill();
  g.restore();
}
