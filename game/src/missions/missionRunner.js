// Runs the story: the start marker of the next job, the intro dialogue, each stage in turn
// (enter, deliver, goto, talk, kill, chase, pickup, escape, timed checkpoints), the mission's
// enemies and vehicles, failing on death, arrest, wrecks, escapes or time-outs, and the
// MISSION PASSED reward. Also feeds the mission panel, the GPS and the radar's enemy blips.
import { STORY } from './storyMissions.js';
import { CAST } from './storyCast.js';
import { createMarker, createTargetArrow } from './missionMarkers.js';
import { Humanoid } from '../characters/humanoid.js';
import { OUTFITS } from '../characters/humanoidModel.js';
import { updateGunman } from '../combat/gunmanAI.js';
import { steerToward, routeTarget } from '../ai/driving.js';
import { formatMoney } from '../core/mathUtils.js';
import * as THREE from 'three';

const DANTE = { skin: '#e8b48f', shirt: '#4b1d6e', pants: '#1d1d24', hair: '#3b2416', shoes: '#111', accent: '#d4af37' };

export function createMissionRunner(game) {
  const st = { index: 0, done: [], active: null, stage: -1, startMarker: null };
  const tagged = {};
  let ctx = null;
  const arrow = createTargetArrow(game.scene);
  arrow.hide();

  function refreshStartMarker() {
    st.startMarker?.remove();
    st.startMarker = null;
    const m = STORY[st.index];
    if (m && !st.active) st.startMarker = createMarker(game.scene, m.start.x, m.start.z, '#ffcf4a', { radius: 1.8, arrow: true });
  }

  function begin(mission, skipIntro = false) {
    st.active = mission; st.stage = -1;
    st.startMarker?.remove(); st.startMarker = null;
    if (skipIntro) return nextStage();
    game.hud.big(mission.title.toUpperCase(), `${CAST[mission.giver].name} · Job ${st.index + 1} of ${STORY.length}`, 'passed', 3);
    game.player.controlsLocked = true;
    game.dialogue.play(mission.intro).then(() => { if (st.active === mission) { game.player.controlsLocked = false; nextStage(); } });
  }

  function cleanupStage() {
    if (!ctx) return;
    for (const m of ctx.markers) m.remove();
    for (const h of ctx.enemies) { h.remove(); game.extraHumanoids.splice(game.extraHumanoids.indexOf(h), 1); }
    if (ctx.pickup) game.scene.remove(ctx.pickup);
    arrow.hide();
    ctx = null;
  }

  function nextStage() {
    cleanupStage();
    st.stage++;
    const m = st.active;
    if (st.stage >= m.stages.length) return pass();
    setupStage(m.stages[st.stage]);
  }

  function spawnTagged(s) {
    let v = tagged[s.tag];
    if (!v || v.exploded || v.removed) {
      v = game.vehicles.spawn(s.spawn.type, s.spawn.x, s.spawn.z, s.spawn.heading, { parked: true, color: s.spawn.color, persistent: true, tag: s.tag });
      tagged[s.tag] = v;
    }
    return v;
  }

  function spawnEnemy(x, z, gang, weapon, boss) {
    const h = new Humanoid(game.scene, boss ? DANTE : OUTFITS[gang], 'goon', x, z, game.rng);
    h.heading = game.rng.next() * 6;
    h.setArmed(true);
    h.weapon = weapon;
    if (boss) { h.health = 260; h.armor = 100; h.boss = boss; }
    game.extraHumanoids.push(h);
    return h;
  }

  function setupStage(s) {
    ctx = { s, markers: [], enemies: [], t: 0, objective: s.text, target: null };
    if (s.type === 'enter') {
      ctx.vehicle = spawnTagged(s);
    } else if (s.type === 'deliver' || s.type === 'goto') {
      ctx.markers.push(createMarker(game.scene, s.x, s.z, '#ffcf4a', { radius: Math.min(s.radius ?? 5, 6) }));
      ctx.target = { x: s.x, z: s.z };
      if (s.tag) ctx.vehicle = tagged[s.tag];
    } else if (s.type === 'talk') {
      game.dialogue.play(s.lines).then(() => { if (ctx && ctx.s === s) ctx.finished = true; });
    } else if (s.type === 'kill') {
      for (const [x, z] of s.enemies) ctx.enemies.push(spawnEnemy(x, z, s.gang, s.weapon));
      if (s.boss) ctx.enemies.push(spawnEnemy(s.enemies[0][0] + 6, s.enemies[0][1] - 2, s.gang, 'rifle', s.boss));
      ctx.target = { x: s.enemies[0][0], z: s.enemies[0][1] };
    } else if (s.type === 'chase') {
      const v = game.vehicles.spawn(s.spawn.type, s.spawn.x, s.spawn.z, s.spawn.heading, { color: s.spawn.color, persistent: true, tag: 'chase' });
      v.driver = 'npc';
      ctx.vehicle = v; ctx.flee = null;
      v.controller = (veh, dt) => {
        const p = game.player.position;
        if (!ctx || ctx.vehicle !== veh || veh.driver !== 'npc') return null;
        if (!ctx.flee || Math.hypot(ctx.flee.x - veh.x, ctx.flee.z - veh.z) < 25) {
          const far = game.layout.nodes.filter((n) => Math.hypot(n.x - p.x, n.z - p.z) > 220 && Math.hypot(n.x - veh.x, n.z - veh.z) < 400);
          ctx.flee = far[Math.floor(game.rng.next() * far.length)] || game.layout.nodes[0];
        }
        const t = routeTarget(game, veh, ctx.flee.x, ctx.flee.z);
        return steerToward(game, veh, t.x, t.z, s.speed, dt);
      };
    } else if (s.type === 'pickup') {
      const d = st.lastDrop || game.player.position;
      ctx.pickup = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.4), new THREE.MeshStandardMaterial({ color: '#c9a227', emissive: '#6a4a00', metalness: 0.6, roughness: 0.3 }));
      ctx.pickup.position.set(d.x + 2.5, 0.5, d.z + 2.5);
      game.scene.add(ctx.pickup);
      ctx.markers.push(createMarker(game.scene, d.x + 2.5, d.z + 2.5, '#2fe6d8', { radius: 1.2, height: 12 }));
      ctx.target = { x: d.x + 2.5, z: d.z + 2.5 };
    } else if (s.type === 'escape') {
      game.wanted.setLevel(Math.max(game.wanted.level, s.level));
    } else if (s.type === 'timed') {
      ctx.point = 0; ctx.timeLeft = s.seconds; ctx.vehicle = tagged[s.tag];
      placeCheckpoint();
    }
  }

  function placeCheckpoint() {
    for (const m of ctx.markers) m.remove();
    ctx.markers = [];
    const [x, z] = ctx.s.points[ctx.point];
    ctx.markers.push(createMarker(game.scene, x, z, '#ff4fa3', { radius: 5, height: 30 }));
    ctx.target = { x, z };
  }

  function checkStage(dt) {
    const s = ctx.s, p = game.player.position, pv = game.player.vehicle;
    ctx.t += dt;
    for (const m of ctx.markers) m.update(game.time);
    const near = (x, z, r) => Math.hypot(p.x - x, p.z - z) < r;
    if (ctx.vehicle && ctx.vehicle.exploded && s.type !== 'chase') return fail(`The ${ctx.vehicle.spec.name} was destroyed`);
    switch (s.type) {
      case 'enter':
        arrow.follow(ctx.vehicle.x, ctx.vehicle.y + 3.4, ctx.vehicle.z, game.time);
        ctx.target = { x: ctx.vehicle.x, z: ctx.vehicle.z };
        if (pv === ctx.vehicle) { if (s.wanted) game.wanted.setLevel(Math.max(game.wanted.level, s.wanted)); return true; }
        return false;
      case 'deliver': {
        const v = ctx.vehicle;
        if (pv !== v) { ctx.objective = `Get back in the ${v.spec.name}`; ctx.target = { x: v.x, z: v.z }; arrow.follow(v.x, v.y + 3.4, v.z, game.time); return false; }
        arrow.hide();
        ctx.objective = s.text; ctx.target = { x: s.x, z: s.z };
        if (s.minCondition && v.condition < s.minCondition) return fail('The client wanted it clean');
        if (near(s.x, s.z, s.radius)) { if (game.wanted.level > 0) { ctx.objective = 'Lose the cops before dropping it off'; return false; } return true; }
        return false;
      }
      case 'goto': return near(s.x, s.z, s.radius);
      case 'talk': return !!ctx.finished;
      case 'kill': {
        let alive = 0, boss = null;
        for (const h of ctx.enemies) {
          if (h.alive) alive++;
          if (h.boss) boss = h;
          const d = Math.hypot(h.x - p.x, h.z - p.z);
          if (!h.alerted && (d < 42 || h.health < 100)) h.alerted = true;
          if (h.alerted) updateGunman(game, h, dt, { range: h.weapon === 'rifle' ? 20 : 13, weapon: h.weapon, inaccuracy: 0.1, damageScale: 0.32, runSpeed: 4.6, fireDelay: 1.4 });
          else { h.aiming = false; h.speed = 0; h.animate(dt); }
        }
        const live = ctx.enemies.find((h) => h.alive);
        if (live) { ctx.target = { x: live.x, z: live.z }; }
        ctx.extra = `Targets left: <b>${alive}</b>` + (boss ? `<div class="bar"><i style="width:${Math.max(0, (boss.health / 260) * 100)}%"></i></div>Dante Kroll` : '');
        return alive === 0;
      }
      case 'chase': {
        const v = ctx.vehicle;
        arrow.follow(v.x, v.y + 4, v.z, game.time);
        ctx.target = { x: v.x, z: v.z };
        const d = Math.hypot(v.x - p.x, v.z - p.z);
        ctx.extra = `Target ${Math.round(d)} m · damage <div class="bar"><i style="width:${Math.max(0, v.condition)}%"></i></div>`;
        if (v.condition <= 0) { st.lastDrop = { x: v.x, z: v.z }; v.driver = null; return true; }
        if (d > 360) return fail('The target got away');
        return false;
      }
      case 'pickup':
        ctx.pickup.rotation.y += dt * 2;
        ctx.pickup.position.y = 0.6 + Math.sin(game.time * 3) * 0.15;
        if (near(ctx.target.x, ctx.target.z, pv ? 4 : 2.2)) { game.audio?.cash(); return true; }
        return false;
      case 'escape':
        ctx.objective = game.wanted.level > 0 ? s.text : 'Clear';
        ctx.target = null;
        return ctx.t > 1 && game.wanted.level === 0;
      case 'timed': {
        ctx.timeLeft -= dt;
        if (ctx.timeLeft <= 0) return fail('Out of time');
        const [x, z] = s.points[ctx.point];
        ctx.extra = `Checkpoint <b>${ctx.point + 1}/${s.points.length}</b>`;
        if (near(x, z, 8)) {
          game.audio?.checkpoint();
          ctx.point++;
          if (ctx.point >= s.points.length) return true;
          ctx.timeLeft += 4;
          placeCheckpoint();
        }
        return false;
      }
    }
    return false;
  }

  function pass() {
    const m = st.active;
    cleanupStage();
    st.active = null;
    st.done.push(m.id);
    st.index++;
    const eco = game.economy;
    eco.addMoney(m.reward.money);
    eco.addRespect(m.reward.respect);
    eco.stats.missionsPassed++;
    if (m.reward.weapon) { game.weapons.give(...m.reward.weapon); game.hud.notify(`Unlocked: ${m.reward.weapon[0].toUpperCase()}`, '#ffcf4a'); }
    game.hud.big('MISSION PASSED', `${formatMoney(m.reward.money)}  ·  RESPECT +${m.reward.respect}`, 'passed', 5);
    game.audio?.jingle(true);
    if (m.outro) game.dialogue.play(m.outro);
    if (st.index >= STORY.length) setTimeout(() => game.hud.big('COSTA SOLARA IS YOURS', 'Story complete. The city is still yours to roam.', 'passed', 8), 5500);
    refreshStartMarker();
    game.save?.autosave();
  }

  function fail(reason) {
    const m = st.active;
    if (!m) return false;
    cleanupStage();
    game.dialogue.clear();
    game.player.controlsLocked = false;
    for (const [tag, v] of Object.entries(tagged)) if (v !== game.player.vehicle && !v.removed) { game.vehicles.remove(v); delete tagged[tag]; }
    for (const v of game.vehicles.list.filter((v) => v.tag === 'chase' && v !== game.player.vehicle)) game.vehicles.remove(v);
    st.active = null;
    game.hud.big('MISSION FAILED', reason, 'failed', 4);
    game.audio?.jingle(false);
    setTimeout(refreshStartMarker, 3000);
    return false;
  }

  game.events.on('playerDown', (e) => { if (st.active) fail(e.reason === 'busted' ? 'You were busted' : 'You were wasted'); });

  const runner = {
    STORY,
    get active() { return st.active; },
    get index() { return st.index; },
    get done() { return st.done; },
    state: st,
    /** Start job i at a given stage immediately (staged screenshots and testing). */
    jumpTo(i, stage = 0) {
      if (st.active) fail('');
      st.index = i;
      begin(STORY[i], true);
      while (st.stage < stage) nextStage();
    },
    context: () => ctx,
    update(dt) {
      game.dialogue.update(dt);
      if (st.startMarker) {
        st.startMarker.update(game.time);
        const m = STORY[st.index], p = game.player.position;
        if (!game.activities?.active && !game.respawning && Math.hypot(p.x - m.start.x, p.z - m.start.z) < (game.player.vehicle ? 6 : 3) && game.player.speed < 8) begin(m);
      }
      if (st.active && ctx && checkStage(dt) === true && st.active) nextStage();
    },
    hudInfo() {
      if (st.active) {
        const s = ctx?.s;
        const t = ctx?.timeLeft;
        return { tag: `STORY · JOB ${st.index + 1}/${STORY.length}`, title: st.active.title, stages: st.active.stages, stage: Math.max(0, st.stage), objective: ctx ? ctx.objective : `Talk to ${CAST[st.active.giver].name}`, timer: s?.type === 'timed' ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '', extra: ctx?.extra || '' };
      }
      const act = game.activities?.hudInfo();
      if (act) return act;
      const m = STORY[st.index];
      if (!m) return { tag: 'FREE ROAM', title: 'Costa Solara', stages: [], stage: 0, objective: 'Races, taxi fares, stunt jumps and Sun Tokens await', extra: '' };
      return { tag: `STORY · NEXT JOB ${st.index + 1}/${STORY.length}`, title: m.title, stages: m.stages, stage: -1, objective: `Meet ${CAST[m.giver].name} (yellow marker)`, extra: m.blurb };
    },
    gpsTarget() {
      if (st.active) return ctx?.target || null;
      if (game.activities?.active) return game.activities.gpsTarget();
      const m = STORY[st.index];
      return m ? m.start : null;
    },
    enemyBlips() { return ctx ? ctx.enemies.filter((h) => h.alive) : []; },
    blips() {
      const out = [];
      if (st.startMarker) out.push({ x: STORY[st.index].start.x, z: STORY[st.index].start.z, color: '#ffcf4a', icon: '★', size: 10, always: true });
      if (ctx?.target) out.push({ x: ctx.target.x, z: ctx.target.z, color: '#ffcf4a', icon: '!', size: 9, always: true });
      return out;
    },
    serialize() { return { index: st.index, done: [...st.done] }; },
    restore(d) {
      if (st.active) fail('');
      st.index = d.index; st.done = [...d.done];
      refreshStartMarker();
    },
  };
  refreshStartMarker();
  return runner;
}
