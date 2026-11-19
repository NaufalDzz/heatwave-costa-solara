// Builds a judge-style contact sheet (cover fitted in 768x480, the rest small beneath) for review.
import { chromium } from '/home/mausbot/mf-tools/node_modules/playwright/index.mjs';
import { readdirSync, readFileSync } from 'node:fs';
const dir = new URL('../screenshots/', import.meta.url).pathname;
const files = readdirSync(dir).filter((f) => /\.(jpe?g|png)$/.test(f)).sort();
const src = (f) => `data:image/jpeg;base64,${readFileSync(dir + f).toString('base64')}`;
const html = `<body style="margin:0;background:#222;width:768px"><img src="${src(files[0])}" style="width:768px;height:480px;display:block">
<div style="display:flex">${files.slice(1).map((f) => `<img src="${src(f)}" style="width:256px;height:160px">`).join('')}</div></body>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 768, height: 640 } });
await page.setContent(html);
await page.screenshot({ path: process.argv[2] || '/tmp/sheet.jpg', type: 'jpeg', quality: 80 });
await browser.close();
