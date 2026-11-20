// End-to-end play test in headless Chromium: title screen, new game, walking, mouse look,
// shooting, stealing and driving a car, committing crimes until the police and helicopter come,
// starting a story job, the pause menu with every tab, saving and loading, a random-input soak,
// plus the ?autostart=1 and ?shot= pages. Fails on any console error or uncaught exception.
import { chromium } from '/home/mausbot/mf-tools/node_modules/playwright/index.mjs';
import { serveGame } from './staticServer.mjs';

const { server, url } = await serveGame(new URL('../game', import.meta.url).pathname);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const failures = [];
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures.push(what); };

async function open(query, size = { width: 1280, height: 800 }) {
  const page = await browser.newPage({ viewport: size });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${query}] console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${query}] pageerror: ${e.message}\n${e.stack}`));
  await page.goto(url + query);
  await page.waitForFunction(() => window.__game && window.__game.mode !== 'loading', null, { timeout: 90000 });
  return page;
}
const G = (page, fn, arg) => page.evaluate(fn, arg);
// SwiftShader renders slowly, so waits are measured in game seconds, not wall-clock time.
// The test advances the real simulation itself (input, AI, physics) between rendered frames.
const waitGame = async (page, seconds) => {
  let steps = Math.round(seconds * 60);
  while (steps > 0) {
    const n = Math.min(30, steps);
    await page.evaluate((k) => { const g = window.__game; if (g.mode === 'paused' || g.mode === 'shop') return; for (let i = 0; i < k; i++) g.update(1 / 60); g.frame(1 / 60); }, n);
    steps -= n;
  }
};
const hold = async (page, key, ms) => { await page.keyboard.down(key); await waitGame(page, ms / 1000); await page.keyboard.up(key); };

// 1. Title screen to play.
const page = await open('');
check(await G(page, () => !document.getElementById('title-screen').classList.contains('hidden')), 'title screen is shown');
await page.keyboard.press('Enter');
await waitGame(page, 0.5);
check(await G(page, () => window.__game.mode === 'play'), 'ENTER starts a new game');
await page.mouse.click(640, 400);
await waitGame(page, 0.3);
// Skip the phone call.
for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await waitGame(page, 0.15); }

// 2. Walk, sprint, jump, look around.
const p0 = await G(page, () => ({ x: __game.player.hero.x, z: __game.player.hero.z }));
await hold(page, 'w', 1200);
await page.keyboard.down('Shift'); await hold(page, 'a', 700); await page.keyboard.up('Shift');
await page.keyboard.press('Space');
await page.mouse.move(700, 420, { steps: 5 });
const p1 = await G(page, () => ({ x: __game.player.hero.x, z: __game.player.hero.z }));
check(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 2, 'WASD moves the hero');

// 3. Weapons: switch, shoot, reload.
await page.keyboard.press('2');
const ammo0 = await G(page, () => __game.weapons.inv.clip.pistol);
await page.mouse.down({ button: 'right' });
for (let i = 0; i < 4; i++) { await page.mouse.click(640, 400); await waitGame(page, 0.32); }
await page.mouse.up({ button: 'right' });
const ammo1 = await G(page, () => __game.weapons.inv.clip.pistol);
check(ammo1 < ammo0, `shooting uses ammo (${ammo0} -> ${ammo1})`);
await page.keyboard.press('r');
await waitGame(page, 1.3);
check(await G(page, () => __game.weapons.inv.clip.pistol === 15), 'R reloads the pistol');

// 4. Steal a car and drive it.
await G(page, () => {
  const g = __game, h = g.player.hero;
  const v = g.vehicles.spawn('sedan', h.x + 4, h.z, 0, {});
  v.driver = 'npc';
  window.__testCar = v;
  h.heading = 0;
});
await waitGame(page, 0.2);
await G(page, () => { const g = __game, v = window.__testCar; g.player.hero.x = v.x - 2.2; g.player.hero.z = v.z; });
await page.keyboard.press('f');
await waitGame(page, 1.2);
check(await G(page, () => !!__game.player.vehicle), 'F steals the car (driver dragged out)');
await hold(page, 'w', 2500);
const speed = await G(page, () => Math.abs(__game.player.vehicle?.speed || 0));
check(speed > 4, `W drives the car (speed ${speed.toFixed(1)} m/s)`);
await page.keyboard.down('w'); await page.keyboard.down('Space'); await hold(page, 'a', 900); await page.keyboard.up('Space'); await page.keyboard.up('w');
await page.keyboard.press('h');
await page.keyboard.press('q');
await waitGame(page, 0.4);
await page.keyboard.press('f');
await waitGame(page, 2.5);
await page.keyboard.press('f');
await waitGame(page, 0.8);
check(await G(page, () => !__game.player.vehicle), 'F gets out of the car');

// 5. Crime: shoot near people, then escalate to see the full police response.
await G(page, () => { const g = __game; const ped = g.peds.list.find((h) => h.alive) ; if (ped) { g.player.hero.x = ped.x - 1; g.player.hero.z = ped.z; } });
await page.keyboard.press('2');
for (let i = 0; i < 3; i++) { await page.mouse.click(640, 400); await waitGame(page, 0.3); }
await waitGame(page, 0.3);
check(await G(page, () => __game.wanted.level >= 1), 'gunfire near witnesses raises the wanted level');
await G(page, () => __game.wanted.setLevel(4));
await waitGame(page, 9.0);
const police = await G(page, () => ({ units: __game.police.units().length, heli: __game.police.helicopter.active, rows: __game.police.dispatchRows().length }));
check(police.units > 0, `police units respond (${police.units})`);
check(police.heli, 'helicopter joins at 4 stars');
check(police.rows > 0, 'dispatch board lists units');

// 6. Story job: go to the first marker.
await G(page, () => { const g = __game; g.wanted.clear(); g.police.reset(); g.player.teleport(-360, 173); });
await waitGame(page, 1.5);
const jobState = await G(page, () => ({ active: !!__game.missions.active, resp: __game.respawning, hp: __game.player.hero.health, veh: !!__game.player.vehicle, mode: __game.mode, act: !!__game.activities.active, idx: __game.missions.index, locked: __game.player.controlsLocked }));
check(jobState.active, `walking into the yellow marker starts job 1 ${JSON.stringify(jobState)}`);
for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await waitGame(page, 0.25); }
await waitGame(page, 0.5);
check(await G(page, () => __game.missions.hudInfo().objective.length > 3), 'mission panel shows an objective');

// 7. Pause menu: every tab, save, load.
await page.keyboard.press('p');
await page.waitForTimeout(300);
check(await G(page, () => __game.pauseMenu.open && __game.mode === 'paused'), 'P/ESC opens the pause menu');
for (let i = 0; i < 6; i++) { await page.click(`#pm-tabs button[data-i="${i}"]`); await page.waitForTimeout(250); }
await page.click('#pm-tabs button[data-i="0"]');
await page.mouse.click(300, 400);
check(await G(page, () => !!__game.waypoint), 'clicking the map sets a waypoint');
await page.click('#pm-tabs button[data-i="5"]');
await page.click('button[data-save="2"]');
await page.waitForTimeout(200);
check(await G(page, () => !!localStorage.getItem('heatwave.costa-solara.2')), 'saving to slot 2 writes localStorage');
await page.click('button[data-load="2"]');
await waitGame(page, 0.8);
check(await G(page, () => __game.mode === 'play'), 'loading slot 2 resumes play');

// 8. Random-input soak.
const keys = ['w', 'a', 's', 'd', 'Shift', 'Space', 'f', '1', '2', '3', 'r', 'h', 'q', 'e'];
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
await G(page, () => { __game.weapons.give('smg', 200); __game.weapons.give('shotgun', 50); __game.wanted.setLevel(3); });
for (let i = 0; i < 60; i++) {
  const k = keys[Math.floor(rnd() * keys.length)];
  await page.keyboard.down(k);
  if (rnd() < 0.3) await page.mouse.click(400 + rnd() * 400, 300 + rnd() * 200);
  await page.mouse.move(300 + rnd() * 600, 200 + rnd() * 400);
  await page.waitForTimeout(120 + rnd() * 200);
  await page.keyboard.up(k);
}
check(true, 'random-input soak finished');
const stats = await G(page, () => ({ calls: __game.renderer.info.render.calls, vehicles: __game.vehicles.list.length, peds: __game.peds.list.length, particles: __game.particles.count() }));
console.log('scene', JSON.stringify(stats));
await page.close();

// 9. Autostart, other viewport sizes and every staged shot.
const auto = await open('?autostart=1', { width: 900, height: 700 });
await auto.waitForTimeout(1500);
check(await G(auto, () => __game.mode === 'play'), '?autostart=1 skips straight into play');
// The HUD scales with the viewport: every panel stays on screen and no two panels overlap.
const hudLayout = () => {
  const ids = ['left-stack', 'status-stack', 'crew-cards', 'radar-stack', 'vehicle-panel', 'dialogue'];
  const rects = ids.map((id) => [id, document.getElementById(id)]).filter(([, el]) => el && el.offsetParent !== null && getComputedStyle(el).display !== 'none').map(([id, el]) => [id, el.getBoundingClientRect()]);
  const problems = [];
  for (const [id, r] of rects) if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) problems.push(`${id} off screen`);
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const [a, ra] = rects[i], [b, rb] = rects[j];
    if (ra.left < rb.right - 1 && rb.left < ra.right - 1 && ra.top < rb.bottom - 1 && rb.top < ra.bottom - 1) problems.push(`${a} overlaps ${b}`);
  }
  return problems;
};
for (const [w, h] of [[1920, 1080], [1024, 640], [1280, 800]]) {
  await auto.setViewportSize({ width: w, height: h });
  await G(auto, () => { const g = __game; g.wanted.setLevel(3); const v = g.vehicles.spawn('sports', g.player.hero.x + 3, g.player.hero.z, 0, {}); g.player.enterVehicle(v); g.dialogue.hold('lexi', 'Layout check.'); });
  await waitGame(auto, 1);
  const problems = await G(auto, hudLayout);
  check(problems.length === 0, `HUD fits ${w}x${h} without overlaps ${problems.join(', ')}`);
}
await auto.close();
for (const shot of ['chase', 'shootout', 'garage', 'pause', 'title']) {
  const sp = await open(`?shot=${shot}&seed=1`);
  await sp.waitForFunction(() => window.__shotReady === true, null, { timeout: 120000 });
  check(true, `?shot=${shot} renders`);
  await sp.close();
}

await browser.close();
server.close();
console.log(errors.length ? `\n${errors.length} ERRORS:\n${errors.join('\n')}` : '\nZERO console errors / page errors');
if (errors.length || failures.length) { console.log(`FAILED: ${failures.length} checks, ${errors.length} errors`); process.exit(1); }
console.log('ALL CHECKS PASSED');
