// Debug: render one staged page to a JPEG and print console problems.
// Usage: node tools/renderShot.mjs "?shot=chase&seed=1" /tmp/out.jpg [width height]
import { chromium } from '/home/mausbot/mf-tools/node_modules/playwright/index.mjs';
import { serveGame } from './staticServer.mjs';
const [query = '?shot=chase&seed=1', out = '/tmp/shot.jpg', w = '1280', h = '800'] = process.argv.slice(2);
const { server, url } = await serveGame(new URL('../game', import.meta.url).pathname);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack}`));
const t0 = Date.now();
await page.goto(url + query);
try { await page.waitForFunction(() => window.__shotReady === true || (!/shot=/.test(location.search) && window.__game?.mode === 'play'), null, { timeout: 60000 }); } catch (e) { console.log('TIMEOUT', errors.join('\n')); process.exit(1); }
await page.waitForTimeout(300);
await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
console.log(`${out} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
await browser.close(); server.close();
