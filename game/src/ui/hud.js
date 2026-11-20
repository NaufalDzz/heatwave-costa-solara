// The on-screen HUD: builds the panels and runs them each frame. Top left the job and the SCPD
// dispatch board, top right clock, money, stars with the IN SIGHT / SEARCHING tag and the weapon
// slots, right the crew cards, bottom left district plate, radar, health, armour and respect,
// bottom right the vehicle panel; radio toasts, dialogue, help, notifications and big cards.
import { formatMoney, formatClock, clamp } from '../core/mathUtils.js';
import { DISTRICTS, streetName } from '../world/cityLayout.js';
import { createMissionPanel } from './missionPanel.js';
import { createDispatchPanel } from './dispatchPanel.js';
import { createWeaponBar } from './weaponBar.js';
import { createVehiclePanel } from './vehiclePanel.js';
import { createCrewCards } from './crewCards.js';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const MARKUP = `
<div class="corner tl" id="left-stack"><section id="mission-panel" class="panel"></section><section id="dispatch-panel" class="panel"></section></div>
<div class="corner tr" id="status-stack"><div id="clock-row"><b id="clock"></b><span id="day"></span></div><div id="money"></div><div id="stars"></div>
 <div id="heat-row"><em id="heat-tag"></em><span id="heat-note"></span></div><div id="weapon-bar"></div><div id="ammo-line"></div></div>
<div class="corner mr" id="crew-cards"></div>
<div class="corner bl" id="radar-stack"><div id="district-plate"><b id="district"></b><span id="street"></span></div>
 <div id="minimap-ring"><canvas id="minimap" width="200" height="200"></canvas></div>
 <div id="vitals"><label>HEALTH</label><div class="bar hp"><i id="hp-fill"></i></div><b id="hp-num"></b><label>ARMOUR</label><div class="bar ar"><i id="ar-fill"></i></div><b id="ar-num"></b></div>
 <div id="rank-row"><span id="rank-badge"></span><div class="rank-mid"><b id="rank-name"></b><div class="bar"><i id="rank-fill"></i></div></div><span id="rank-xp"></span></div></div>
<section class="corner br panel" id="vehicle-panel"></section>
<section class="corner tc" id="radio-toast"><span id="radio-freq"></span><div><b id="radio-name"></b><span id="radio-song"></span></div></section>
<section class="corner bc hidden" id="dialogue"><canvas id="portrait" width="120" height="120"></canvas><div class="dlg-body"><div class="dlg-head"><b id="dlg-name"></b><span id="dlg-role"></span></div><div id="dlg-text"></div></div></section>
<div id="reticle"><i></i><i></i><i></i><i></i></div><div id="help-toast"></div><div id="notify"></div><div id="area-name"></div>`;

export function createHud(game) {
  const root = document.getElementById('hud');
  root.innerHTML = MARKUP;
  const el = {};
  for (const n of root.querySelectorAll('[id]')) el[n.id] = n;
  for (const id of ['big-message', 'big-title', 'big-sub', 'flash-overlay']) el[id] = document.getElementById(id);
  for (let i = 0; i < 5; i++) el.stars.appendChild(Object.assign(document.createElement('span'), { textContent: '★' }));
  const cache = {};
  const set = (key, node, value, prop = 'textContent') => { if (cache[key] !== value) { cache[key] = value; node[prop] = value; } };
  const panels = [
    createMissionPanel(game, el['mission-panel'], set),
    createDispatchPanel(game, el['dispatch-panel'], set),
    createWeaponBar(game, el['weapon-bar'], el['ammo-line'], set),
    createVehiclePanel(game, el['vehicle-panel'], set),
    createCrewCards(game, el['crew-cards'], set),
  ];
  let bigTimer = 0, areaTimer = 0, radioTimer = 0, lastDistrict = '';

  function resize() {
    const k = clamp(Math.min(innerWidth / 1280, innerHeight / 800), 0.6, 1.6);
    document.documentElement.style.setProperty('--k', k.toFixed(3));
  }
  addEventListener('resize', resize);
  resize();

  function updateStatus() {
    const p = game.player, eco = game.economy, w = game.wanted;
    set('clock', el.clock, formatClock(game.sky.hour));
    set('day', el.day, DAYS[game.day % 7]);
    set('money', el.money, formatMoney(eco.money));
    for (let i = 0; i < 5; i++) set('star' + i, el.stars.children[i], i < w.level ? 'on' : '', 'className');
    set('starsFlash', el.stars, w.searching ? 'flashing' : '', 'className');
    const heat = w.level === 0 ? '' : w.searching ? 'SEARCHING' : 'IN SIGHT';
    set('heatTag', el['heat-tag'], heat);
    set('heatCls', el['heat-row'], heat ? heat.replace(' ', '-').toLowerCase() : 'none', 'className');
    const heli = game.police.helicopter;
    set('heatNote', el['heat-note'], !heat ? '' : w.searching ? `search zone · ${Math.max(0, Math.ceil(4 + w.level - w.outside))}s outside to lose them` : heli.active && heli.spotting ? 'Air-1 has you in the light' : 'units have eyes on you');
    const rank = eco.rankInfo();
    set('rankBadge', el['rank-badge'], String(rank.level));
    set('rankName', el['rank-name'], `${rank.title} · RESPECT`);
    set('rankFill', el['rank-fill'].style, `${Math.round(rank.progress * 100)}%`, 'width');
    set('rankXp', el['rank-xp'], `${eco.respect.toLocaleString('en-US')} / ${rank.next.toLocaleString('en-US')}`);
    const hp = Math.max(0, Math.round(p.hero.health)), ar = Math.max(0, Math.round(p.hero.armor));
    set('hp', el['hp-fill'].style, `${hp}%`, 'width'); set('hpN', el['hp-num'], String(hp));
    set('ar', el['ar-fill'].style, `${ar}%`, 'width'); set('arN', el['ar-num'], String(ar));
    const pos = p.position;
    const dName = DISTRICTS[game.layout.districtAt(pos.x, pos.z)].name;
    set('district', el.district, dName.toUpperCase());
    set('street', el.street, streetName(pos.x, pos.z));
    if (dName !== lastDistrict) {
      if (lastDistrict) { el['area-name'].textContent = dName; el['area-name'].style.opacity = '1'; areaTimer = 3; }
      lastDistrict = dName;
    }
  }

  const hud = {
    show(on) { root.classList.toggle('hidden', !on); },
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
    /** Keep the radio toast up (staged screenshots). */
    holdRadio() { radioTimer = 1e9; },
    flash(alpha = 0.6) { el['flash-overlay'].style.transition = 'none'; el['flash-overlay'].style.opacity = String(alpha); requestAnimationFrame(() => { el['flash-overlay'].style.transition = 'opacity 0.6s'; el['flash-overlay'].style.opacity = '0'; }); },
    hitMarker() { el.reticle.classList.add('hit'); hud.hitTime = 0.15; },
    update(dt) {
      if (bigTimer > 0 && (bigTimer -= dt) <= 0) el['big-message'].style.opacity = '0';
      if (radioTimer > 0 && (radioTimer -= dt) <= 0) el['radio-toast'].style.opacity = '0';
      if (areaTimer > 0 && (areaTimer -= dt) <= 0) el['area-name'].style.opacity = '0';
      if (hud.hitTime > 0 && (hud.hitTime -= dt) <= 0) el.reticle.classList.remove('hit');
      for (const n of [...el.notify.children]) if (Number(n.dataset.t) < game.realTime) n.remove();
      updateStatus();
      for (const panel of panels) panel.update(dt);
      const p = game.player;
      set('retShow', el.reticle.style, !p.vehicle && (p.hero.aiming || game.weapons.current().id !== 'fists') ? '' : 'none', 'display');
      set('onFoot', root.dataset, p.vehicle ? 'car' : 'foot', 'mode');
    },
  };
  return hud;
}
