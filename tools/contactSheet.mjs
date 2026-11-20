// Builds a judge-style contact sheet from screenshots/ (or the files given): the cover fitted
// inside 768x480 on top, the others in a row of small cells beneath. Usage: node tools/contactSheet.mjs out.jpg [files...]
import { chromium } from '/home/mausbot/mf-tools/node_modules/playwright/index.mjs';
import { readdirSync, readFileSync } from 'node:fs';
const dir = new URL('../screenshots/', import.meta.url).pathname;
const [out = '/tmp/sheet.jpg', ...given] = process.argv.slice(2);
const files = given.length ? given : readdirSync(dir).filter((f) => /\.(jpe?g|png)$/.test(f)).sort().map((f) => dir + f);
const src = (f) => `data:image/jpeg;base64,${readFileSync(f).toString('base64')}`;
const cell = Math.floor(768 / Math.max(1, files.length - 1));
const html = `<body style="margin:0;background:#fff;width:768px"><img src="${src(files[0])}" style="width:768px;height:480px;display:block">
<div style="display:flex">${files.slice(1).map((f) => `<img src="${src(f)}" style="width:${cell}px;height:${Math.round(cell / 1.6)}px">`).join('')}</div></body>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 768, height: 480 + Math.round(cell / 1.6) } });
await page.setContent(html);
await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
await browser.close();
console.log(out);
