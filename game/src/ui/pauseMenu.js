// The pause menu (ESC): an OVERVIEW page with the city map (legend, click-to-set waypoint), the
// story's ten jobs, career stats and the save slots side by side; then STORY with the cast,
// STATS, CONTROLS, SETTINGS (sensitivity, invert, volumes, clock speed) and SAVE.
import { MAP, toMap, drawBlip, drawPlayerArrow, drawDistrictLabels } from './mapRenderer.js';
import { STORY } from '../missions/storyMissions.js';
import { CAST, drawPortrait } from '../missions/storyCast.js';
import { controlsHtml } from './titleScreen.js';
import { SLOTS, summarize } from '../save/saveSystem.js';
import { formatMoney, formatClock } from '../core/mathUtils.js';
import { routeBetween } from '../ai/roadGraph.js';

const TABS = ['OVERVIEW', 'STORY', 'STATS', 'CONTROLS', 'SETTINGS', 'SAVE'];
// The pause map is fitted to the city itself (mainland grid, Palmera Beach and the Marina Azul
// island) rather than the whole radar image, so the streets fill the panel. World metres.
const VIEW = { x0: -425, z0: -445, w: 1135, h: 987 };
const MAP_W = 1150, MAP_H = 1000;

export function createPauseMenu(game) {
  const root = document.getElementById('pause-menu'), tabsEl = document.getElementById('pm-tabs'), body = document.getElementById('pm-body'), line = document.getElementById('pm-stats-line');
  let tab = 0;
  tabsEl.innerHTML = TABS.map((t, i) => `<button data-i="${i}">${t}</button>`).join('');
  tabsEl.addEventListener('click', (e) => { const i = e.target.dataset?.i; if (i !== undefined) show(Number(i)); });

  function show(i) {
    tab = i;
    [...tabsEl.children].forEach((b, k) => b.classList.toggle('sel', k === i));
    const eco = game.economy, rank = eco.rankInfo();
    line.innerHTML = `${formatMoney(eco.money)}<br><small style="color:#ffd6f0">RANK ${rank.level} · ${rank.title} · DAY ${game.day} ${formatClock(game.sky.hour)}</small>`;
    ({ OVERVIEW: mapTab, STORY: storyTab, STATS: statsTab, CONTROLS: controlsTab, SETTINGS: settingsTab, SAVE: saveTab })[TABS[i]]();
  }

  function mapTab() {
    const legend = [...Object.values(game.layout.pois).map((p) => [p.color, p.name.replace(/ (Safehouse|Garage|Arms|Medical|Depot|Races)$/, '')]), ['#ffcf4a', 'Story job'], ['#ff3030', 'SCPD unit'], ['#ff9f1c', 'Stunt jump'], ['#d36bff', 'Waypoint']]
      .map(([c, n]) => `<i style="background:${c}"></i><span>${n}</span>`).join('');
    const idx = game.missions.index;
    const jobs = STORY.map((m, i) => `<div class="mission-row"><span class="st ${i < idx ? 'done' : i === idx ? 'active' : 'locked'}">${i < idx ? 'DONE' : i === idx ? 'NEXT' : 'LOCKED'}</span><b>${i + 1}. ${m.title}</b><span style="color:#aaa;margin-left:auto">${CAST[m.giver].name.replace(/".*" /, '')}</span></div>`).join('');
    const slots = ['auto', '1', '2'].map((slot) => {
      const sm = summarize(game.save.read(slot));
      return `<div class="slot"><div class="info"><b>${slot === 'auto' ? 'AUTOSAVE' : 'SLOT ' + slot}</b> ${sm ? `· ${sm.title}<br>${sm.money} · Rank ${sm.rankLevel} ${sm.rank} · ${sm.time}` : '<br><span style="color:#888">Empty slot</span>'}</div>${sm ? `<span class="pct">${sm.pct}%</span>` : ''}</div>`;
    }).join('');
    body.innerHTML = `<div class="pm-mapwrap"><canvas class="pm-map" width="${MAP_W}" height="${MAP_H}"></canvas><div class="pm-card pm-legend"><div class="legend">${legend}</div></div></div>
      <div class="pm-col"><div class="pm-card"><h3>STORY · ${game.missions.done.length}/${STORY.length} JOBS DONE</h3>${jobs}</div>
      <div class="pm-card" style="--acc:var(--teal)"><h3>CAREER</h3><div class="stat-grid">${careerRows()}</div></div>
      <div class="pm-card" style="--acc:var(--pink)"><h3>SAVE SLOTS</h3>${slots}</div></div>`;
    const c = body.querySelector('canvas');
    drawMap(c);
    c.addEventListener('click', (e) => {
      const r = c.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * VIEW.w + VIEW.x0, z = ((e.clientY - r.top) / r.height) * VIEW.h + VIEW.z0;
      game.waypoint = { x, z };
      game.hud.notify('Waypoint set', '#d36bff');
      drawMap(c);
    });
    c.addEventListener('contextmenu', () => { game.waypoint = null; drawMap(c); });
  }

  function careerRows() {
    const s = game.economy.stats;
    return [['Money earned', formatMoney(s.moneyEarned)], ['Sun Tokens', `${s.tokens}/30`], ['Stunt jumps', `${s.stuntJumps}/5`], ['Races won', s.racesWon], ['Cars stolen', s.carsStolen], ['Cops downed', s.copsKilled], ['Distance', `${s.distanceKm.toFixed(1)} km`], ['Top wanted', '★'.repeat(s.maxWanted) || '-']]
      .map(([k, v]) => `<div class="stat-row"><span>${k}</span><b>${v}</b></div>`).join('');
  }


  function drawMap(c) {
    const g = c.getContext('2d');
    const k = c.width / VIEW.w;
    const [sx, sy] = toMap(VIEW.x0, VIEW.z0), src = MAP.px / MAP.size;
    g.drawImage(game.mapImage, sx, sy, VIEW.w * src, VIEW.h * src, 0, 0, c.width, c.height);
    const P = (x, z) => [(x - VIEW.x0) * k, (z - VIEW.z0) * k];
    drawDistrictLabels(g, P, 38, ['downtown', 'neon', 'palmera', 'heights', 'ironworks', 'midtown', 'marina']);
    const p = game.player.position;
    const target = game.missions.gpsTarget() || game.waypoint;
    if (target) {
      const route = routeBetween(game.layout.nodes, p.x, p.z, target.x, target.z);
      g.strokeStyle = '#ffcf4a'; g.lineWidth = 10; g.lineJoin = 'round'; g.shadowColor = '#ff9f1c'; g.shadowBlur = 12; g.beginPath();
      route.forEach(([x, z], i) => { const [a, b] = P(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); });
      g.stroke(); g.shadowBlur = 0;
    }
    const zone = game.wanted.searchZone;
    if (zone && game.wanted.level) { const [a, b] = P(zone.x, zone.z); g.beginPath(); g.arc(a, b, zone.r * k, 0, Math.PI * 2); g.fillStyle = 'rgba(255,50,50,0.25)'; g.fill(); g.strokeStyle = '#ff4040'; g.lineWidth = 3; g.stroke(); }
    for (const b of game.mapBlips()) { const [x, y] = P(b.x, b.z); drawBlip(g, x, y, b.color, b.icon, (b.size || 8) * 2.4); }
    for (const v of game.police.units()) { const [x, y] = P(v.x, v.z); g.beginPath(); g.arc(x, y, 10, 0, Math.PI * 2); g.fillStyle = '#ff3030'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); }
    const [px, py] = P(p.x, p.z);
    g.beginPath(); g.arc(px, py, 34, 0, Math.PI * 2); g.fillStyle = 'rgba(255,79,163,0.28)'; g.fill();
    drawPlayerArrow(g, px, py, Math.PI - game.player.heading, 26);
  }

  function storyTab() {
    const done = game.missions.done, idx = game.missions.index;
    const rows = STORY.map((m, i) => `<div class="mission-row"><span class="st ${i < idx ? 'done' : i === idx ? 'active' : 'locked'}">${i < idx ? 'DONE' : i === idx ? 'NEXT' : 'LOCKED'}</span><b>${i + 1}. ${m.title}</b><span style="color:#aaa;margin-left:auto">${CAST[m.giver].name}</span></div>`).join('');
    const cast = ['santi', 'ines', 'wrench', 'lexi', 'dante', 'hale'].map((id) => `<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px"><canvas data-who="${id}" width="64" height="64" style="border-radius:6px;border:2px solid #ffcf4a"></canvas><div><b>${CAST[id].name}</b><br><span style="color:#bbb;font-size:13px">${CAST[id].role}</span></div></div>`).join('');
    body.innerHTML = `<div class="pm-col"><div class="pm-card"><h3>STORY · ${done.length}/${STORY.length} JOBS</h3>${rows}</div></div><div class="pm-col"><div class="pm-card"><h3>THE CAST</h3>${cast}</div></div>`;
    body.querySelectorAll('canvas[data-who]').forEach((c) => drawPortrait(c.getContext('2d'), c.dataset.who, 64));
  }

  function statsTab() {
    const s = game.economy.stats, r = game.economy.rankInfo();
    const rows = [['Story jobs passed', `${s.missionsPassed}/${STORY.length}`], ['Money earned', formatMoney(s.moneyEarned)], ['Respect', game.economy.respect], ['Sun Tokens', `${s.tokens}/30`], ['Unique stunt jumps', `${s.stuntJumps}/5`], ['Street races won', s.racesWon], ['Taxi fares', s.taxiFares], ['Cars stolen', s.carsStolen], ['Kills', s.kills], ['Cops taken down', s.copsKilled], ['Explosions caused', s.explosions], ['Shots fired', s.shotsFired], ['Distance driven', `${s.distanceKm.toFixed(1)} km`], ['Highest wanted level', '★'.repeat(s.maxWanted) || '-'], ['Times wasted', s.timesWasted], ['Times busted', s.timesBusted], ['Time played', `${Math.floor(s.playSeconds / 60)} min`]];
    const half = Math.ceil(rows.length / 2);
    const col = (list) => list.map(([k, v]) => `<div class="stat-row"><span>${k}</span><b>${v}</b></div>`).join('');
    body.innerHTML = `<div class="pm-col"><div class="pm-card"><h3>RANK ${r.level} · ${r.title}</h3><div class="bar" style="height:12px"><i style="width:${r.progress * 100}%;background:linear-gradient(90deg,#ff4fa3,#ffcf4a)"></i></div></div><div class="pm-card"><h3>CAREER</h3>${col(rows.slice(0, half))}</div></div><div class="pm-col"><div class="pm-card"><h3>STREETS</h3>${col(rows.slice(half))}</div><div class="pm-card"><h3>GARAGE</h3>${col([['Engine tune', `Stage ${game.economy.upgrades.engine}/3`], ['Armour plating', `Stage ${game.economy.upgrades.armor}/3`], ['Nitro kit', game.economy.upgrades.nitro ? 'Installed' : 'No']])}</div></div>`;
  }

  function controlsTab() { body.innerHTML = `<div class="pm-col"><div class="pm-card"><h3>CONTROLS</h3><div class="controls-grid">${controlsHtml()}</div></div></div>`; }

  function settingsTab() {
    const s = game.settings;
    body.innerHTML = `<div class="pm-col"><div class="pm-card"><h3>SETTINGS</h3>
      <label class="setting">Mouse sensitivity <input type="range" min="0.3" max="2.5" step="0.1" value="${s.sensitivity}" data-k="sensitivity"></label>
      <label class="setting">Invert mouse Y <input type="checkbox" ${s.invertY ? 'checked' : ''} data-k="invertY"></label>
      <label class="setting">Master volume <input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-k="volume"></label>
      <label class="setting">Radio volume <input type="range" min="0" max="1" step="0.05" value="${s.music}" data-k="music"></label>
      <label class="setting">Minutes per game hour <input type="range" min="0.5" max="4" step="0.5" value="${1 / (game.sky.timeScale * 60)}" data-k="clock"></label></div></div>`;
    body.querySelectorAll('input').forEach((el) => el.addEventListener('input', () => {
      const k = el.dataset.k;
      if (k === 'invertY') s.invertY = el.checked;
      else if (k === 'clock') game.sky.timeScale = 1 / (Number(el.value) * 60);
      else s[k] = Number(el.value);
    }));
  }

  function saveTab() {
    const slots = SLOTS.map((slot) => {
      const d = game.save.read(slot), sm = summarize(d);
      const name = slot === 'auto' ? 'AUTOSAVE' : `SLOT ${slot}`;
      return `<div class="slot"><div class="info"><b>${name}</b><br>${sm ? `${sm.title} · ${sm.money} · Rank ${sm.rankLevel} ${sm.rank}<br><span style="color:#aaa">${sm.time} · ${sm.pct}% · saved ${sm.savedAt}</span>` : '<span style="color:#888">Empty</span>'}</div>${slot !== 'auto' ? `<button data-save="${slot}">SAVE</button>` : ''}${d ? `<button class="load" data-load="${slot}">LOAD</button>` : ''}</div>`;
    }).join('');
    body.innerHTML = `<div class="pm-col"><div class="pm-card"><h3>SAVE GAME</h3>${slots}</div></div><div class="pm-col"><div class="pm-card"><h3>SAFEHOUSE</h3>Casa Sol on Palmera Beach autosaves after every job. Saving keeps your story, money, respect, weapons, upgrades, tokens and stunts.</div></div>`;
    body.querySelectorAll('button[data-save]').forEach((b) => b.addEventListener('click', () => { game.save.write(b.dataset.save); game.hud.notify(`Saved to slot ${b.dataset.save}`); saveTab(); }));
    body.querySelectorAll('button[data-load]').forEach((b) => b.addEventListener('click', () => { game.save.load(b.dataset.load); menu.close(); game.hud.notify('Game loaded'); }));
  }

  const menu = {
    get open() { return !root.classList.contains('hidden'); },
    show(i = 0) {
      root.classList.remove('hidden');
      game.hud.show(false);
      game.mode = 'paused';
      game.input.releaseLock();
      show(i);
    },
    close() { root.classList.add('hidden'); game.hud.show(true); game.mode = 'play'; },
    nextTab(d) { show((tab + d + TABS.length) % TABS.length); },
  };
  addEventListener('keydown', (e) => {
    if (!menu.open) return;
    if (e.code === 'KeyE' || e.code === 'ArrowRight') menu.nextTab(1);
    if (e.code === 'KeyQ' || e.code === 'ArrowLeft') menu.nextTab(-1);
  });
  return menu;
}
