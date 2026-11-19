// The pause menu (ESC): MAP with legend and click-to-set waypoint, STORY progress and cast,
// STATS and rank, CONTROLS, SETTINGS (sensitivity, invert, volumes, clock speed) and SAVE with
// three slots plus the autosave.
import { MAP, toMap, drawBlip, drawPlayerArrow } from './mapRenderer.js';
import { STORY } from '../missions/storyMissions.js';
import { CAST, drawPortrait } from '../missions/storyCast.js';
import { controlsHtml } from './titleScreen.js';
import { SLOTS, summarize } from '../save/saveSystem.js';
import { formatMoney, formatClock } from '../core/mathUtils.js';
import { routeBetween } from '../ai/roadGraph.js';

const TABS = ['MAP', 'STORY', 'STATS', 'CONTROLS', 'SETTINGS', 'SAVE'];

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
    ({ MAP: mapTab, STORY: storyTab, STATS: statsTab, CONTROLS: controlsTab, SETTINGS: settingsTab, SAVE: saveTab })[TABS[i]]();
  }

  function mapTab() {
    const legend = Object.values(game.layout.pois).map((p) => `<i style="background:${p.color}"></i><span>${p.name}</span>`).join('');
    const m = game.missions.active || STORY[game.missions.index];
    body.innerHTML = `<canvas class="pm-map" width="900" height="900"></canvas><div class="pm-col"><div class="pm-card"><h3>LEGEND</h3><div class="legend">${legend}<i style="background:#ffcf4a"></i><span>Story job</span><i style="background:#ff3030"></i><span>SCPD units</span><i style="background:#ff9f1c"></i><span>Stunt jump</span><i style="background:#d36bff"></i><span>Waypoint (click map)</span></div></div>
      <div class="pm-card"><h3>CURRENT JOB</h3>${m ? `<b>${m.title}</b><br><span style="color:#ccc">${m.blurb}</span>` : 'Story complete'}</div>
      <div class="pm-card"><h3>CAREER</h3>${careerRows()}</div>${lastSave()}</div>`;
    const c = body.querySelector('canvas');
    drawMap(c);
    c.addEventListener('click', (e) => {
      const r = c.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * MAP.size + MAP.x0, z = ((e.clientY - r.top) / r.height) * MAP.size + MAP.z0;
      game.waypoint = { x, z };
      game.hud.notify('Waypoint set', '#d36bff');
      drawMap(c);
    });
    c.addEventListener('contextmenu', () => { game.waypoint = null; drawMap(c); });
  }

  function careerRows() {
    const s = game.economy.stats;
    return [['Jobs passed', `${game.missions.done.length}/${STORY.length}`], ['Sun Tokens', `${s.tokens}/30`], ['Stunt jumps', `${s.stuntJumps}/5`], ['Races won', s.racesWon], ['Cars stolen', s.carsStolen], ['Highest wanted', '★'.repeat(s.maxWanted) || '-']]
      .map(([k, v]) => `<div class="stat-row"><span>${k}</span><b>${v}</b></div>`).join('');
  }
  function lastSave() {
    const d = game.save.latest(), sm = summarize(d);
    return sm ? `<div class="pm-card"><h3>LAST SAVE · ${d.slot === 'auto' ? 'AUTOSAVE' : 'SLOT ' + d.slot}</h3>${sm.title}<br><span style="color:#aaa">${sm.money} · ${sm.time} · ${sm.pct}% complete</span></div>` : '';
  }

  function drawMap(c) {
    const g = c.getContext('2d');
    const s = c.width / MAP.px;
    g.drawImage(game.mapImage, 0, 0, c.width, c.height);
    const P = (x, z) => toMap(x, z).map((v) => v * s);
    const p = game.player.position;
    const target = game.missions.gpsTarget() || game.waypoint;
    if (target) {
      const route = routeBetween(game.layout.nodes, p.x, p.z, target.x, target.z);
      g.strokeStyle = '#ffcf4a'; g.lineWidth = 7; g.lineJoin = 'round'; g.shadowColor = '#ff9f1c'; g.shadowBlur = 10; g.beginPath();
      route.forEach(([x, z], i) => { const [a, b] = P(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); });
      g.stroke(); g.shadowBlur = 0;
    }
    const zone = game.wanted.searchZone;
    if (zone && game.wanted.level) { const [a, b] = P(zone.x, zone.z); g.beginPath(); g.arc(a, b, zone.r * s * (MAP.px / MAP.size), 0, Math.PI * 2); g.fillStyle = 'rgba(255,50,50,0.25)'; g.fill(); g.strokeStyle = '#ff4040'; g.lineWidth = 2; g.stroke(); }
    for (const b of game.mapBlips()) { const [x, y] = P(b.x, b.z); drawBlip(g, x, y, b.color, b.icon, (b.size || 8) * 1.2); }
    for (const v of game.police.units()) { const [x, y] = P(v.x, v.z); g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fillStyle = '#ff3030'; g.fill(); }
    const [px, py] = P(p.x, p.z);
    drawPlayerArrow(g, px, py, Math.PI - game.player.heading, 13);
  }

  function storyTab() {
    const done = game.missions.done, idx = game.missions.index;
    const rows = STORY.map((m, i) => `<div class="mission-row"><span class="st ${i < idx ? 'done' : i === idx ? 'active' : 'locked'}">${i < idx ? 'DONE' : i === idx ? 'NEXT' : 'LOCKED'}</span><b>${i + 1}. ${m.title}</b><span style="color:#aaa;margin-left:auto">${CAST[m.giver].name}</span></div>`).join('');
    const cast = ['nico', 'rosa', 'wrench', 'lexi', 'dante', 'hale'].map((id) => `<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px"><canvas data-who="${id}" width="64" height="64" style="border-radius:6px;border:2px solid #ffcf4a"></canvas><div><b>${CAST[id].name}</b><br><span style="color:#bbb;font-size:13px">${CAST[id].role}</span></div></div>`).join('');
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
      game.mode = 'paused';
      game.input.releaseLock();
      show(i);
    },
    close() { root.classList.add('hidden'); game.mode = 'play'; },
    nextTab(d) { show((tab + d + TABS.length) % TABS.length); },
  };
  addEventListener('keydown', (e) => {
    if (!menu.open) return;
    if (e.code === 'KeyE' || e.code === 'ArrowRight') menu.nextTab(1);
    if (e.code === 'KeyQ' || e.code === 'ArrowLeft') menu.nextTab(-1);
  });
  return menu;
}
