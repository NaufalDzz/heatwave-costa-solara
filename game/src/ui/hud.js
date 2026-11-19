// The on-screen HUD: mission panel with stage bar, SCPD dispatch list, clock, money, five wanted
// stars, respect rank, weapon slots and ammo, health and armour, district name, the speedometer
// with vehicle condition and nitro, radio toasts, help prompts, notifications, the reticle and the
// big MISSION PASSED / WASTED / BUSTED cards. Scales with the viewport.
import { WEAPONS } from '../combat/weapons.js';
import { formatMoney, formatClock, clamp } from '../core/mathUtils.js';
import { DISTRICTS } from '../world/cityLayout.js';

const $ = (id) => document.getElementById(id);
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function drawWeaponIcon(id) {
  const c = document.createElement('canvas');
  c.width = 116; c.height = 88;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f2f2'; g.strokeStyle = '#f2f2f2'; g.lineWidth = 6; g.lineCap = 'round';
  g.translate(58, 48);
  if (id === 'fists') { g.beginPath(); g.roundRect(-22, -16, 40, 30, 9); g.fill(); g.fillStyle = '#333'; for (let k = 0; k < 3; k++) g.fillRect(-14 + k * 10, -16, 2, 14); }
  else {
    const L = { pistol: 46, smg: 66, shotgun: 92, rifle: 96 }[id];
    g.fillRect(-L / 2, -10, L, 12);
    g.fillRect(-L / 2 + (id === 'pistol' ? 2 : L * 0.25), 0, 11, 24);
    if (id === 'smg') g.fillRect(4, 0, 8, 20);
    if (id === 'rifle') { g.fillRect(-6, 0, 9, 22); g.fillRect(-L / 2 - 2, -12, 18, 22); g.fillRect(10, -18, 18, 7); }
    if (id === 'shotgun') { g.fillRect(-L / 2 - 2, -12, 26, 20); g.fillRect(4, 4, 30, 7); }
  }
  return c;
}

/** Simple analogue speedometer drawn into a canvas. */
function drawSpeedo(g, speedKmh, maxKmh, nitro) {
  const S = 220, R = 96;
  g.clearRect(0, 0, S, S);
  g.save(); g.translate(S / 2, S / 2);
  g.beginPath(); g.arc(0, 0, R + 8, 0, Math.PI * 2); g.fillStyle = 'rgba(8,10,22,0.72)'; g.fill();
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.18)'; g.stroke();
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  const frac = clamp(speedKmh / maxKmh, 0, 1);
  g.lineWidth = 10; g.lineCap = 'round';
  g.beginPath(); g.arc(0, 0, R - 8, a0, a1); g.strokeStyle = 'rgba(255,255,255,0.1)'; g.stroke();
  const grad = g.createLinearGradient(-R, 0, R, 0);
  grad.addColorStop(0, '#2fe6d8'); grad.addColorStop(0.6, '#ffcf4a'); grad.addColorStop(1, '#ff4fa3');
  g.beginPath(); g.arc(0, 0, R - 8, a0, a0 + (a1 - a0) * frac); g.strokeStyle = grad; g.stroke();
  g.lineWidth = 2; g.strokeStyle = '#ddd'; g.fillStyle = '#ccc'; g.font = '700 12px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let k = 0; k <= 10; k++) {
    const a = a0 + ((a1 - a0) * k) / 10;
    g.beginPath(); g.moveTo(Math.cos(a) * (R - 20), Math.sin(a) * (R - 20)); g.lineTo(Math.cos(a) * (R - 28), Math.sin(a) * (R - 28)); g.stroke();
    if (k % 2 === 0) g.fillText(String(Math.round((maxKmh * k) / 10)), Math.cos(a) * (R - 42), Math.sin(a) * (R - 42));
  }
  const na = a0 + (a1 - a0) * frac;
  g.strokeStyle = '#ff3b6b'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(na) * (R - 16), Math.sin(na) * (R - 16)); g.stroke();
  g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fillStyle = '#ff3b6b'; g.fill();
  g.fillStyle = '#fff'; g.font = 'italic 900 40px Arial Black, Arial'; g.fillText(String(Math.round(speedKmh)), 0, 40);
  g.font = '800 12px Arial'; g.fillStyle = nitro ? '#2fe6d8' : '#aaa'; g.fillText(nitro ? 'NITRO' : 'KM/H', 0, 64);
  g.restore();
}

export function createHud(game) {
  const el = {};
  for (const id of ['hud', 'mission-panel', 'mp-tag', 'mp-timer', 'mp-title', 'mp-stages', 'mp-objective', 'mp-extra', 'dispatch-panel', 'dp-level', 'dp-units', 'clock', 'day', 'money', 'stars', 'rank-name', 'rank-fill', 'weapon-bar', 'ammo', 'hp-fill', 'ar-fill', 'district', 'vehicle-panel', 'veh-name', 'veh-cond', 'veh-nos', 'radio-toast', 'radio-freq', 'radio-name', 'radio-song', 'reticle', 'help-toast', 'notify', 'area-name', 'big-message', 'big-title', 'big-sub', 'flash-overlay']) el[id] = $(id);
  const speedo = $('speedo').getContext('2d');
  const slots = WEAPONS.map((w, i) => {
    const d = document.createElement('div');
    d.className = 'wslot';
    d.innerHTML = `<b>${i + 1}</b>`;
    d.appendChild(drawWeaponIcon(w.id));
    el['weapon-bar'].appendChild(d);
    return d;
  });
  for (let i = 0; i < 5; i++) el.stars.appendChild(Object.assign(document.createElement('span'), { textContent: '★' }));
  const cache = {};
  const set = (key, node, value, prop = 'textContent') => { if (cache[key] !== value) { cache[key] = value; node[prop] = value; } };
  let bigTimer = 0, areaTimer = 0, radioTimer = 0, lastDistrict = '';

  function resize() {
    const k = clamp(Math.min(innerWidth / 1280, innerHeight / 800), 0.55, 1.6);
    document.documentElement.style.setProperty('--k', k.toFixed(3));
  }
  addEventListener('resize', resize);
  resize();

  const hud = {
    show(on) { el.hud.classList.toggle('hidden', !on); },
    notify(text, color = '#2fe6d8') {
      const d = document.createElement('div');
      d.textContent = text; d.style.borderRightColor = color;
      el.notify.appendChild(d);
      while (el.notify.children.length > 4) el.notify.firstChild.remove();
      d.dataset.t = String(game.realTime + 4);
    },
    help(html) { set('help', el['help-toast'], html || '', 'innerHTML'); },
    big(title, sub = '', cls = 'passed', seconds = 4) {
      el['big-title'].textContent = title; el['big-sub'].textContent = sub;
      el['big-message'].className = cls; el['big-message'].style.opacity = '1';
      bigTimer = seconds;
    },
    radio(name, freq, song) {
      el['radio-name'].textContent = name; el['radio-freq'].textContent = freq; el['radio-song'].textContent = song;
      el['radio-toast'].style.opacity = '1'; radioTimer = 5;
    },
    flash(alpha = 0.6) { el['flash-overlay'].style.transition = 'none'; el['flash-overlay'].style.opacity = String(alpha); requestAnimationFrame(() => { el['flash-overlay'].style.transition = 'opacity 0.6s'; el['flash-overlay'].style.opacity = '0'; }); },
    hitMarker() { el.reticle.classList.add('hit'); hud.hitTime = 0.15; },
    update(dt) {
      const p = game.player, eco = game.economy;
      if (bigTimer > 0 && (bigTimer -= dt) <= 0) el['big-message'].style.opacity = '0';
      if (radioTimer > 0 && (radioTimer -= dt) <= 0) el['radio-toast'].style.opacity = '0';
      if (hud.hitTime > 0 && (hud.hitTime -= dt) <= 0) el.reticle.classList.remove('hit');
      for (const n of [...el.notify.children]) if (Number(n.dataset.t) < game.realTime) n.remove();
      set('clock', el.clock, formatClock(game.sky.hour));
      set('day', el.day, DAYS[game.day % 7]);
      set('money', el.money, formatMoney(eco.money));
      const lvl = game.wanted.level;
      for (let i = 0; i < 5; i++) set('star' + i, el.stars.children[i], i < lvl ? 'on' : '', 'className');
      set('starsFlash', el.stars, game.wanted.searching ? 'flashing' : '', 'className');
      const rank = eco.rankInfo();
      set('rank', el['rank-name'], `RANK ${rank.level} · ${rank.title}`);
      set('rankFill', el['rank-fill'].style, `${Math.round(rank.progress * 100)}%`, 'width');
      const cur = game.weapons.current();
      slots.forEach((s, i) => set('slot' + i, s, `wslot${WEAPONS[i] === cur ? ' sel' : ''}${game.weapons.inv.owned[WEAPONS[i].id] ? '' : ' locked'}`, 'className'));
      const inv = game.weapons.inv;
      set('ammo', el.ammo, cur.clip ? `${inv.reload > 0 ? 'RELOADING' : inv.clip[cur.id]} <small>/ ${inv.ammo[cur.id]}</small>` : `<small>${cur.name.toUpperCase()}</small>`, 'innerHTML');
      set('hp', el['hp-fill'].style, `${Math.max(0, p.hero.health)}%`, 'width');
      set('ar', el['ar-fill'].style, `${Math.max(0, p.hero.armor)}%`, 'width');
      const dName = DISTRICTS[game.layout.districtAt(p.position.x, p.position.z)].name;
      set('district', el.district, dName.toUpperCase());
      if (dName !== lastDistrict) {
        if (lastDistrict) { el['area-name'].textContent = dName; el['area-name'].style.opacity = '1'; areaTimer = 3; }
        lastDistrict = dName;
      }
      if (areaTimer > 0 && (areaTimer -= dt) <= 0) el['area-name'].style.opacity = '0';
      // Mission panel.
      const m = game.missions?.hudInfo();
      set('mpShow', el['mission-panel'].style, m ? '' : 'none', 'display');
      if (m) {
        set('mpTag', el['mp-tag'], m.tag);
        set('mpTimer', el['mp-timer'], m.timer || '');
        set('mpTitle', el['mp-title'], m.title);
        set('mpObj', el['mp-objective'], m.objective);
        set('mpExtra', el['mp-extra'], m.extra || '', 'innerHTML');
        set('mpStages', el['mp-stages'], m.stages.map((_, i) => `<i class="${i < m.stage ? 'done' : i === m.stage ? 'now' : ''}"></i>`).join(''), 'innerHTML');
      }
      // Dispatch panel.
      const rows = game.police?.dispatchRows() || [];
      set('dpShow', el['dispatch-panel'].style, rows.length && lvl > 0 ? '' : 'none', 'display');
      if (rows.length) {
        set('dpLevel', el['dp-level'], game.wanted.searching ? 'SEARCHING' : ['', 'CODE 1', 'CODE 2', 'CODE 3', 'AIR SUPPORT', 'ALL UNITS'][lvl]);
        set('dpUnits', el['dp-units'], rows.slice(0, 6).map((r) => `<div class="unit"><b>${r.callsign}</b><span>${r.kind}</span><span class="dist">${r.dist}m</span><em class="tag ${r.status.toLowerCase().replace(/[^a-z]/g, '')}">${r.status}</em></div>`).join(''), 'innerHTML');
      }
      // Vehicle panel.
      const v = p.vehicle;
      set('vehShow', el['vehicle-panel'].style, v ? '' : 'none', 'display');
      set('retShow', el.reticle.style, !v && (p.hero.aiming || cur.id !== 'fists') ? '' : 'none', 'display');
      if (v) {
        set('vehName', el['veh-name'], v.spec.name.toUpperCase());
        set('vehCond', el['veh-cond'].style, `${Math.max(0, v.condition)}%`, 'width');
        set('vehNos', el['veh-nos'].style, `${Math.round(p.nitro * 100)}%`, 'width');
        const kmh = Math.abs(v.speed) * 3.6;
        if (Math.abs((cache.kmh ?? -1) - kmh) > 0.5 || cache.nos !== p.driveInput.nitro) {
          cache.kmh = kmh; cache.nos = p.driveInput.nitro;
          drawSpeedo(speedo, kmh, Math.ceil((v.spec.maxSpeed * 3.6 * 1.15) / 20) * 20, p.driveInput.nitro);
        }
      }
    },
  };
  return hud;
}
