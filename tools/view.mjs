// Debug: render the city from given camera positions. Usage: node tools/view.mjs hour "x,y,z,lx,ly,lz" out.jpg ...
import { chromium } from '/home/mausbot/mf-tools/node_modules/playwright/index.mjs';
import { serveGame } from './staticServer.mjs';
const { server, url } = await serveGame(new URL('../game', import.meta.url).pathname);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(url + (process.env.Q || ''));
await page.waitForFunction(() => window.__game && window.__game.mode !== 'loading', null, { timeout: 60000 });
const [hour, ...rest] = process.argv.slice(2);
for (let i = 0; i < rest.length; i += 2) {
  const c = rest[i].split(',').map(Number);
  await page.evaluate(([h, c]) => { const g = window.__game; g.sky.setHour(h); g.sky.frozen = true; g.cameraRig.override = (cam) => { cam.position.set(c[0], c[1], c[2]); cam.lookAt(c[3], c[4], c[5]); }; }, [Number(hour), c]);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: rest[i + 1], type: 'jpeg', quality: 80 });
}
console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
await browser.close(); server.close();
