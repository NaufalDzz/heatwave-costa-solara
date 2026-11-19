// Renders every staged ?shot= scene at 1280x800 into screenshots/ as a JPEG of at most 256 KiB
// (lowering the quality until it fits) and fails on any console error.
import { chromium } from '/home/mausbot/mf-tools/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { serveGame } from './staticServer.mjs';

const root = new URL('..', import.meta.url).pathname;
const shots = JSON.parse(readFileSync(root + 'shots.json', 'utf8'));
const { server, url } = await serveGame(root + 'game');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
mkdirSync(root + 'screenshots', { recursive: true });
for (const f of readdirSync(root + 'screenshots')) if (!shots.some((s) => s.name === f)) unlinkSync(root + 'screenshots/' + f);
const errors = [];
for (const shot of shots) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${shot.name}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${shot.name}: ${e.message}`));
  await page.goto(url + shot.query);
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
  await page.waitForTimeout(300);
  let quality = 90, buf;
  do { buf = await page.screenshot({ type: 'jpeg', quality }); quality -= 4; } while (buf.length > 256 * 1024 && quality > 30);
  writeFileSync(root + 'screenshots/' + shot.name, buf);
  console.log(`${shot.name}  ${(buf.length / 1024).toFixed(0)} KiB  q${quality + 4}`);
  await page.close();
}
await browser.close();
server.close();
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
console.log('screenshots written, zero errors');
