// Lists which source files make it into the dossier text (cap 160 KiB) in load order.
import { buildDossier } from '../vendor/makefun-game.ts';
import { mkdtempSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), 'dossier-'));
cpSync(root + 'game', join(out, 'game'), { recursive: true });
cpSync(root + 'screenshots', join(out, 'screenshots'), { recursive: true });
const d = JSON.parse(Buffer.from(buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, game_max_files: 993, game_max_bytes: 50331648, game_path_max_bytes: 1000 })).toString());
const files = [...d.text.matchAll(/^### (\S+) \(\d+ lines, (\d+) bytes\)/gm)].map((m) => `${m[1].replace('game/src/', '')} ${m[2]}`);
console.log(files.join('\n'));
console.log(d.text.split('\n').slice(-1)[0]);
