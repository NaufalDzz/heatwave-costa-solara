// The circular radar: the city map turned with the camera, the GPS route to the waypoint or
// mission target, police units flashing red and blue, the police search zone, mission and
// activity markers, shops, collectibles, the compass and the player's arrow.
import { MAP, toMap, drawBlip, drawPlayerArrow } from './mapRenderer.js';
import { routeBetween } from '../ai/roadGraph.js';

export function createMinimap(game, canvas, mapImage) {
  const g = canvas.getContext('2d');
  const S = canvas.width, R = S / 2;
  const scale = 0.5; // radar pixels per map pixel
  let route = null, routeKey = '', routeAge = 0;

  return {
    route: () => route,
    update(dt) {
      const p = game.player.position;
      const yaw = game.cameraRig.yaw;
      const target = game.missions?.gpsTarget() || game.waypoint;
      routeAge += dt;
      const key = target ? `${Math.round(target.x)},${Math.round(target.z)}` : '';
      if (target && (key !== routeKey || routeAge > 1.5)) { route = routeBetween(game.layout.nodes, p.x, p.z, target.x, target.z); routeKey = key; routeAge = 0; }
      if (!target) route = null;
      const [mx, my] = toMap(p.x, p.z);
      const rot = yaw - Math.PI;
      g.clearRect(0, 0, S, S);
      g.save();
      g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.clip();
      g.fillStyle = '#123a55'; g.fillRect(0, 0, S, S);
      g.translate(R, R);
      g.rotate(rot);
      g.scale(scale, scale);
      g.translate(-mx, -my);
      g.drawImage(mapImage, 0, 0);
      const k = MAP.px / MAP.size;
      if (route) {
        g.strokeStyle = game.missions?.gpsTarget() ? '#ffcf4a' : '#d36bff'; g.lineWidth = 7 * k / scale * 0.9; g.lineJoin = 'round';
        g.beginPath();
        route.forEach(([x, z], i) => { const [a, b] = toMap(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); });
        g.stroke();
      }
      const zone = game.wanted?.searchZone;
      if (zone && game.wanted.level > 0) {
        const [a, b] = toMap(zone.x, zone.z);
        g.beginPath(); g.arc(a, b, zone.r * k, 0, Math.PI * 2);
        const blink = Math.sin(game.time * 6) > 0;
        g.fillStyle = blink ? 'rgba(255,40,40,0.25)' : 'rgba(40,90,255,0.25)'; g.fill();
        g.strokeStyle = blink ? '#ff4040' : '#4070ff'; g.lineWidth = 3 / scale; g.stroke();
      }
      g.restore();
      // Blips are drawn upright in screen space.
      const toRadar = (x, z) => {
        const [a, b] = toMap(x, z);
        const dx = (a - mx) * scale, dy = (b - my) * scale;
        const c = Math.cos(rot), s = Math.sin(rot);
        return [R + dx * c - dy * s, R + dx * s + dy * c];
      };
      const clampEdge = ([x, y], pad = 12) => {
        const dx = x - R, dy = y - R, d = Math.hypot(dx, dy), lim = R - pad;
        return d > lim ? [R + (dx / d) * lim, R + (dy / d) * lim, true] : [x, y, false];
      };
      for (const blip of game.mapBlips?.() || []) {
        const pt = toRadar(blip.x, blip.z);
        const [x, y, edge] = clampEdge(pt);
        if (edge && !blip.always) continue;
        drawBlip(g, x, y, blip.color, blip.icon, blip.size || 8);
      }
      for (const v of game.police?.units() || []) {
        const [x, y, edge] = clampEdge(toRadar(v.x, v.z), 8);
        g.beginPath(); g.arc(x, y, edge ? 4 : 6, 0, Math.PI * 2);
        g.fillStyle = Math.sin(game.time * 12 + v.id) > 0 ? '#ff3030' : '#3060ff'; g.fill();
        g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke();
      }
      for (const e of game.missions?.enemyBlips() || []) {
        const [x, y] = clampEdge(toRadar(e.x, e.z), 8);
        g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fillStyle = '#ff2d55'; g.fill(); g.strokeStyle = '#000'; g.stroke();
      }
      const heli = game.police?.helicopter;
      if (heli && heli.active) {
        const [x, y] = clampEdge(toRadar(heli.x, heli.z), 10);
        g.fillStyle = '#fff'; g.font = '900 16px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✈', x, y);
      }
      drawPlayerArrow(g, R, R, -(game.player.heading - yaw));
      // Compass letter N on the rim.
      const nAng = rot - Math.PI / 2;
      const nx = R + Math.cos(nAng) * (R - 13), ny = R + Math.sin(nAng) * (R - 13);
      g.beginPath(); g.arc(nx, ny, 10, 0, Math.PI * 2); g.fillStyle = '#111'; g.fill();
      g.fillStyle = '#fff'; g.font = '900 13px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', nx, ny + 1);
      const grad = g.createRadialGradient(R, R, R * 0.75, R, R, R);
      grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.35)');
      g.fillStyle = grad; g.beginPath(); g.arc(R, R, R, 0, Math.PI * 2); g.fill();
    },
  };
}
