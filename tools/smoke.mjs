// Quick smoke test: load the game, wait, print errors and save one screenshot.
import { chromium } from '/home/mausbot/mf-tools/node_modules/playwright/index.mjs';
import { serveGame } from './staticServer.mjs';
const { server, url } = await serveGame(new URL('../game', import.meta.url).pathname);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
const t0 = Date.now();
await page.goto(url + (process.argv[2] || ''));
await page.waitForTimeout(Number(process.argv[3] || 8000));
const info = await page.evaluate(() => { const g = window.__game; if (!g) return null; return { fps: 0, calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, vehicles: g.vehicles.list.length, peds: g.peds.list.length, mode: g.mode, t: g.time }; });
console.log('info', JSON.stringify(info), 'elapsed', Date.now() - t0);
await page.screenshot({ path: process.argv[4] || '/tmp/smoke.jpg', type: 'jpeg', quality: 80 });
console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
await browser.close(); server.close();
