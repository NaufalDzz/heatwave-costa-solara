// Systems test: plays through the less common paths with the game's own APIs and simulation:
// job 1 start to finish, a fight-and-escape job, the street race, taxi fares, the gun shop,
// a stunt jump, getting wasted and getting busted. Fails on any console error.
import { chromium } from '/home/mausbot/mf-tools/node_modules/playwright/index.mjs';
import { serveGame } from './staticServer.mjs';

const { server, url } = await serveGame(new URL('../game', import.meta.url).pathname);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [], failures = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack}`));
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures.push(what); };
await page.goto(url + '?autostart=1');
await page.waitForFunction(() => window.__game && window.__game.mode === 'play', null, { timeout: 90000 });
const run = (fn, arg) => page.evaluate(fn, arg);
const step = (seconds) => run((s) => { const g = window.__game; for (let i = 0; i < s * 60; i++) { if (g.dialogue.active) g.input.simulate('Enter', true); g.update(1 / 60); g.input.simulate('Enter', false); } g.frame(1 / 60); }, seconds);

// Job 1: start, get in Rosa's car, deliver it, hear Wrench, pass.
await run(() => { const g = window.__game; g.dialogue.clear(); g.player.teleport(-360, 173); });
await step(1);
check(await run(() => window.__game.missions.active?.id === 'arrival'), 'job 1 starts at its marker');
await step(14);
await run(() => { const g = window.__game, v = g.missions.context().vehicle; g.player.hero.x = v.x - 2.2; g.player.hero.z = v.z; g.player.enterVehicle(v); });
await step(1);
check(await run(() => window.__game.missions.context()?.s.type === 'deliver'), 'getting in the car advances to the delivery stage');
await run(() => { const v = window.__game.player.vehicle; v.x = -280; v.z = 8; v.vx = v.vz = 0; });
await step(1);
await step(12);
const after = await run(() => ({ index: window.__game.missions.index, money: window.__game.economy.money, saved: !!localStorage.getItem('heatwave.costa-solara.auto') }));
check(after.index === 1, `job 1 passes (next index ${after.index})`);
check(after.saved, 'passing a job autosaves');

// Job 3: kill the collectors, then lose two stars.
await run(() => { const g = window.__game; if (g.player.vehicle) g.player.exitVehicle(true); g.shop.close(); g.missions.jumpTo(2, 0); for (const h of g.missions.context().enemies) h.damage(500, 0, 0); });
await step(1);
check(await run(() => window.__game.missions.context()?.s.type === 'escape' && window.__game.wanted.level >= 2), 'killing the collectors moves to the escape stage with two stars');
await step(3);
check(await run(() => window.__game.police.units().length > 0), 'police respond during the escape');
await run(() => window.__game.wanted.clear());
await step(2);
check(await run(() => window.__game.missions.index === 3), 'losing the cops passes job 3');

// Street race.
await run(() => { const g = window.__game; g.police.reset(); g.player.teleport(330, 395); g.shop.close(); const v = g.vehicles.spawn('sports', 330, 398, -Math.PI / 2, {}); g.player.enterVehicle(v); v.x = 330; v.z = 395; });
await step(1);
check(await run(() => !!window.__game.activities.active), 'driving into the race marker starts the Ocean Mile race');
await run(() => window.__game.input.simulate('KeyW', true));
await step(6);
await run(() => window.__game.input.simulate('KeyW', false));
const racers = await run(() => window.__game.vehicles.list.filter((v) => v.racer).map((v) => Math.round(v.x)));
check(racers.some((x) => x < 300), `AI racers drive the course (${racers.join(', ')})`);
await run(() => { const g = window.__game; g.player.exitVehicle(true); });
await step(1);
check(await run(() => !window.__game.activities.active), 'leaving the car abandons the race');

// Taxi fares.
await run(() => { const g = window.__game; const v = g.vehicles.spawn('taxi', 0, 238.1, Math.PI / 2, {}); g.player.teleport(0, 233); g.player.enterVehicle(v); });
await page.keyboard.press('t');
await step(0.5);
check(await run(() => !!window.__game.activities.hudInfo()?.title.includes('Taxi')), 'T starts taxi fares in a cab');
await run(() => { const g = window.__game, t = g.activities.gpsTarget(), v = g.player.vehicle; v.x = t.x; v.z = t.z; v.vx = v.vz = 0; });
await step(1);
check(await run(() => window.__game.activities.hudInfo()?.objective.includes('destination')), 'stopping by the fare picks them up');
await page.keyboard.press('t');
await step(0.5);

// Gun shop.
await run(() => { const g = window.__game; g.player.exitVehicle(true); g.economy.money = 20000; const s = g.layout.pois.gunshop; g.player.teleport(s.x, s.z); });
await step(0.5);
check(await run(() => window.__game.shop.open), 'walking into Brass & Barrel opens the shop');
await page.click('.shop-item');
check(await run(() => window.__game.economy.money < 20000), 'buying from the shop spends money');
await page.keyboard.press('Escape');
await step(0.5);

// Stunt jump off the boardwalk ramp.
await run(() => { const g = window.__game; g.shop.close(); g.player.teleport(-100, 455); const v = g.vehicles.spawn('sports', -100, 458, Math.PI / 2, {}); g.player.enterVehicle(v); v.vx = 34; });
await run(() => window.__game.input.simulate('KeyW', true));
await step(3);
await run(() => window.__game.input.simulate('KeyW', false));
check(await run(() => window.__game.economy.stats.stuntJumps >= 1), 'flying off a ramp scores a unique stunt');

// Wasted and busted.
await run(() => { const g = window.__game; g.player.exitVehicle(true); g.player.hero.damage(500, 0, 0); });
await step(6);
const w = await run(() => ({ alive: window.__game.player.hero.alive, wasted: window.__game.economy.stats.timesWasted, x: window.__game.player.hero.x }));
check(w.alive && w.wasted === 1, 'getting wasted respawns at St. Maren Medical');
await run(() => window.__game.busted());
await step(6);
check(await run(() => window.__game.economy.stats.timesBusted === 1 && window.__game.player.hero.alive), 'getting busted respawns at the precinct');

await browser.close();
server.close();
console.log(errors.length ? `\n${errors.length} ERRORS:\n${errors.join('\n')}` : '\nZERO console errors / page errors');
if (errors.length || failures.length) { console.log(`FAILED: ${failures.length} checks`); process.exit(1); }
console.log('ALL SYSTEMS CHECKS PASSED');
