// Render one ?shot= scene and report errors. Usage: node tools/shotcheck.mjs chase /tmp/out.jpg
import { chromium } from '/home/mausbot/mf-tools/node_modules/playwright/index.mjs';
import { serveGame } from './staticServer.mjs';
const { server, url } = await serveGame(new URL('../game', import.meta.url).pathname);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(url + '?shot=' + process.argv[2] + '&seed=1');
try { await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 120000 }); } catch (e) { errors.push('timeout waiting for shot'); }
await page.waitForTimeout(500);
await page.screenshot({ path: process.argv[3], type: 'jpeg', quality: 85 });
console.log(process.argv[2], errors.length ? errors.join('\n') : 'NO ERRORS');
await browser.close(); server.close();
