// Systems test: plays through the less common paths with the game's own APIs and simulation:
// job 1 start to finish, a fight-and-escape job, the street race, taxi fares, the gun shop, the
// garage purchase flow and saving it, the three crew abilities and their cooldowns, a stunt
// jump, getting wasted and getting busted. Fails on any console error or warning.
import { chromium } from '/home/mausbot/mf-tools/node_modules/playwright/index.mjs';
import { serveGame } from './staticServer.mjs';

const { server, url } = await serveGame(new URL('../game', import.meta.url).pathname);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [], failures = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
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
check(await run(() => window.__game.shop.tab === 'weapons'), 'the gun store opens on the weapons list');
await page.click('.gs-row[data-i="6"]');
check(await run(() => window.__game.economy.money < 20000), 'buying from the shop spends money');
await page.keyboard.press('Escape');
await step(0.5);

// Garage: drive into Wrench Works, buy an engine stage and a respray that sheds the heat, save, reload.
await run(() => { const g = window.__game; g.player.teleport(-300, 11); const v = g.vehicles.spawn('muscle', -300, 11, Math.PI / 2, {}); g.player.enterVehicle(v); v.condition = 50; g.wanted.setLevel(2); g.police.reset(); g.shop.close(); });
await step(4);
await run(() => { const g = window.__game, s = g.layout.pois.garage, v = g.player.vehicle; v.x = s.x; v.z = s.z; v.vx = v.vz = 0; });
await step(0.5);
check(await run(() => window.__game.shop.open && window.__game.shop.tab === 'car'), 'driving into Wrench Works opens the garage screen');
const g0 = await run(() => ({ money: window.__game.economy.money, engine: window.__game.economy.upgrades.engine }));
await page.keyboard.press('3');
await page.click('.gs-row[data-i="0"]');
await page.click('.gs-row[data-i="1"]');
const g1 = await run(() => { const g = window.__game, v = g.player.vehicle; return { money: g.economy.money, engine: g.economy.upgrades.engine, cond: v.condition, wanted: g.wanted.level, fitted: v.upgrades === g.economy.upgrades, stats: g.garageShop.stats(v).length }; });
check(g1.engine === g0.engine + 1 && g1.money === g0.money - 1500 - 300 - 500, `engine stage, repair and respray are charged (${g0.money} -> ${g1.money})`);
check(g1.cond === 100 && g1.wanted === 0 && g1.fitted && g1.stats === 4, 'repair restores the car, respray clears the stars, upgrades are fitted');
await run(() => { window.__game.economy.money = 10; });
await page.keyboard.press('4');
check(await run(() => window.__game.economy.upgrades.armor === 0), 'cannot buy armour plating without the cash');
await page.keyboard.press('Escape');
await step(0.5);
await run(() => { window.__game.save.write('3'); window.__game.economy.upgrades.engine = 0; window.__game.save.load('3'); });
check(await run(() => window.__game.economy.upgrades.engine === 1), 'garage upgrades survive a save and load');

// Crew: locked early, then Z drops a star, X scrambles dispatch, C marks gunmen; cooldowns hold.
await run(() => { const g = window.__game; g.shop.close(); g.crew.reset(); g.missions.state.index = 1; });
await page.keyboard.press('z');
await step(0.2);
check(await run(() => window.__game.crew.cards()[0].state === 'locked'), 'crew members stay locked until their job');
await run(() => { const g = window.__game; g.missions.state.index = 7; g.player.teleport(0, 245); g.wanted.setLevel(3); });
await step(3);
await page.keyboard.press('z');
await step(0.2);
const z1 = await run(() => ({ level: window.__game.wanted.level, searching: window.__game.wanted.searching, state: window.__game.crew.cards()[0].state }));
check(z1.level === 2 && z1.searching && z1.state === 'cooldown', `Z: Clean Break drops a star (${JSON.stringify(z1)})`);
await page.keyboard.press('z');
await step(0.2);
check(await run(() => window.__game.wanted.level === 2), 'Clean Break waits for its cooldown');
await page.keyboard.press('x');
await step(1);
const x1 = await run(() => ({ blackout: window.__game.crew.blackout, rows: window.__game.police.dispatchRows().map((r) => r.status) }));
check(x1.blackout && x1.rows.some((s) => s === 'SCRAMBLED'), `X: Blackout scrambles dispatch (${x1.rows.join(',')})`);
await run(() => { const g = window.__game, p = g.player.position; g.police.spawnUnitNear(p.x + 25, p.z, 0); });
await page.keyboard.press('c');
await step(1);
check(await run(() => window.__game.crew.eyesUp && window.__game.scene.children.some((o) => o.isSprite && o.visible)), 'C: Eyes Up paints the cruisers');
await step(12);
check(await run(() => !window.__game.crew.blackout), 'Blackout wears off');
await run(() => { const g = window.__game; g.wanted.clear(); g.police.reset(); });

// Stunt jump off the boardwalk ramp.
await run(() => { const g = window.__game; g.shop.close(); g.player.teleport(-100, 455); const v = g.vehicles.spawn('sports', -100, 458, Math.PI / 2, {}); g.player.enterVehicle(v); v.vx = 34; });
await run(() => window.__game.input.simulate('KeyW', true));
await step(3);
await run(() => window.__game.input.simulate('KeyW', false));
check(await run(() => window.__game.economy.stats.stuntJumps >= 1), 'flying off a ramp scores a unique stunt');

// The rank-7 Riptide launcher: locked in the shop until the rank, then one rocket wrecks a car.
check(await run(() => window.__game.garageShop.items('weapons').find((i) => i.id === 'launcher')?.locked === true), 'the launcher is locked below rank 7');
const rocket = await run(() => {
  const g = window.__game; if (g.player.vehicle) g.player.exitVehicle(true);
  g.economy.respect = 16000; g.weapons.give('launcher', 3); g.weapons.select(5);
  const h = g.player.hero, v = g.vehicles.spawn('sedan', h.x + 14, h.z, 0, { parked: true });
  const o = { x: h.x + 1, y: h.y + 1.4, z: h.z }, d = { x: v.x - o.x, y: v.y + 0.8 - o.y, z: v.z - o.z }, l = Math.hypot(d.x, d.y, d.z);
  g.weapons.fire(h, o, { x: d.x / l, y: d.y / l, z: d.z / l }, g.weapons.current(), { byPlayer: true });
  return { id: g.weapons.current().id, exploded: v.exploded };
});
check(rocket.id === 'launcher' && rocket.exploded, `a Riptide rocket wrecks a car (${JSON.stringify(rocket)})`);
await run(() => { const g = window.__game; g.wanted.clear(); g.police.reset(); g.weapons.select(1); });

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
