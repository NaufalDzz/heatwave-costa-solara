// Every texture in the game is painted here on canvases at start-up: building facades and their
// night-window maps, storefronts, asphalt with lane markings, sidewalks, sand, grass, roofs,
// neon signs and the soft glow sprite. No image files.
import * as THREE from 'three';
import { createRng } from '../core/rng.js';

const rng = createRng(4242);
const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTexture(c, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function noise(ctx, w, h, amount, alpha = 0.08) {
  for (let i = 0; i < amount; i++) {
    const v = rng.next() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${rng.range(0.02, alpha)})`;
    ctx.fillRect(rng.next() * w, rng.next() * h, rng.range(1, 3), rng.range(1, 3));
  }
}
function memo(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

/**
 * A facade style: { map, emissive, su, sv } where su, sv are metres per texture repeat.
 * Bays are 4 m wide; floors 3.5 m (glass, stucco, brick) or a tall shed (industrial).
 */
export function facadeTexture(style) {
  return memo('facade-' + style, () => {
    const S = 256;
    const [c, g] = canvas(S, S);
    const [e, ge] = canvas(S, S);
    ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
    let bays = 4, floors = 4, su = 16, sv = 14;
    if (style === 'glass') {
      floors = 8; sv = 28;
      const grad = g.createLinearGradient(0, 0, S, S);
      grad.addColorStop(0, '#5d7f99'); grad.addColorStop(0.5, '#a9c4d6'); grad.addColorStop(1, '#4e6d86');
      g.fillStyle = grad; g.fillRect(0, 0, S, S);
      const bw = S / bays, fh = S / floors;
      for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) {
        const x = b * bw, y = f * fh;
        g.fillStyle = `rgba(20,40,60,${rng.range(0.15, 0.45)})`;
        g.fillRect(x + 3, y + 3, bw - 6, fh - 7);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(x + 3, y + 3, (bw - 6) * 0.35, fh - 7);
        if (rng.chance(0.42)) {
          ge.fillStyle = rng.chance(0.75) ? `hsl(${rng.range(30, 48)},90%,${rng.range(55, 75)}%)` : `hsl(${rng.range(180, 210)},60%,75%)`;
          ge.fillRect(x + 4, y + 4, bw - 8, fh - 9);
        }
      }
      g.fillStyle = '#dfe8ee';
      for (let f = 0; f <= floors; f++) g.fillRect(0, f * fh - 2, S, 4);
      for (let b = 0; b <= bays; b++) g.fillRect(b * bw - 1.5, 0, 3, S);
    } else if (style === 'industrial') {
      sv = 12; floors = 1;
      g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, S, S);
      for (let x = 0; x < S; x += 8) { g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(x, 0, 3, S); }
      g.fillStyle = 'rgba(40,50,60,0.85)';
      for (let b = 0; b < bays; b++) {
        g.fillRect(b * 64 + 8, 30, 48, 22);
        if (rng.chance(0.6)) { ge.fillStyle = '#ffcf80'; ge.fillRect(b * 64 + 10, 32, 44, 18); }
      }
      g.fillStyle = 'rgba(60,60,60,0.55)'; g.fillRect(70, 150, 116, 106);
      for (let y = 150; y < S; y += 9) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(70, y, 116, 2); }
      g.fillStyle = 'rgba(255,200,0,0.9)'; g.fillRect(0, 236, S, 6);
      noise(g, S, S, 1200, 0.1);
    } else {
      g.fillStyle = '#f4f1ec'; g.fillRect(0, 0, S, S);
      noise(g, S, S, 1500, 0.06);
      const bw = S / bays, fh = S / floors;
      const brick = style === 'brick';
      if (brick) {
        g.fillStyle = '#d9cfc8'; g.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 6) for (let x = (y / 6) % 2 ? 0 : 6; x < S; x += 12) {
          g.fillStyle = `rgba(0,0,0,${rng.range(0.04, 0.14)})`; g.fillRect(x, y, 11, 5);
        }
      }
      for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) {
        const x = b * bw, y = f * fh;
        const ww = style === 'deco' ? bw * 0.7 : bw * 0.5, wh = fh * 0.55;
        const wx = x + (bw - ww) / 2, wy = y + fh * 0.18;
        g.fillStyle = '#ffffff'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
        const wg = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
        wg.addColorStop(0, '#2b4d6b'); wg.addColorStop(0.6, '#6f9bbf'); wg.addColorStop(1, '#203a52');
        g.fillStyle = wg; g.fillRect(wx, wy, ww, wh);
        g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh);
        if (style !== 'house' && f % 2 === 0) { g.fillStyle = 'rgba(70,70,70,0.55)'; g.fillRect(wx - 6, wy + wh + 3, ww + 12, 4); }
        if (rng.chance(0.38)) {
          ge.fillStyle = `hsl(${rng.range(28, 45)},95%,${rng.range(55, 72)}%)`;
          ge.fillRect(wx, wy, ww, wh);
        }
      }
      if (style === 'deco') {
        g.fillStyle = 'rgba(255,255,255,0.95)';
        for (let f = 0; f < floors; f++) g.fillRect(0, f * fh + fh - 8, S, 5);
        g.fillStyle = 'rgba(0,150,160,0.35)';
        g.fillRect(0, fh * 2 - 3, S, 3);
      }
    }
    return { map: toTexture(c), emissive: toTexture(e), su, sv };
  });
}

/** Street-level shopfronts with awnings, 32 m x 4.5 m per repeat. */
export function storefrontTexture() {
  return memo('storefront', () => {
    const [c, g] = canvas(512, 72);
    const [e, ge] = canvas(512, 72);
    ge.fillStyle = '#000'; ge.fillRect(0, 0, 512, 72);
    g.fillStyle = '#efe9e0'; g.fillRect(0, 0, 512, 72);
    const awnings = ['#e63946', '#2a9d8f', '#f4a261', '#457b9d', '#e76f51', '#8338ec', '#06d6a0'];
    for (let s = 0; s < 8; s++) {
      const x = s * 64;
      g.fillStyle = '#1d2d3a'; g.fillRect(x + 5, 22, 54, 46);
      g.fillStyle = 'rgba(160,200,230,0.45)'; g.fillRect(x + 7, 24, 50, 30);
      ge.fillStyle = `hsl(${rng.range(30, 55)},90%,${rng.range(50, 70)}%)`; ge.fillRect(x + 7, 24, 50, 42);
      const aw = rng.pick(awnings);
      for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#ffffff' : aw; g.fillRect(x + 4 + k * 9.3, 8, 9.3, 12); }
      g.fillStyle = '#2b2b2b'; g.fillRect(x + 26, 40, 12, 28);
    }
    return { map: toTexture(c), emissive: toTexture(e), su: 32, sv: 4.5 };
  });
}

/** Asphalt for a 14 m road: canvas x runs along the road (16 m), y across it. */
export function roadTexture() {
  return memo('road', () => {
    const [c, g] = canvas(128, 256);
    g.fillStyle = '#3b3e44'; g.fillRect(0, 0, 128, 256);
    noise(g, 128, 256, 2500, 0.12);
    g.fillStyle = '#f2c230'; g.fillRect(0, 124, 128, 3); g.fillRect(0, 130, 128, 3);
    g.fillStyle = '#e8e8e8';
    g.fillRect(0, 62, 60, 3); g.fillRect(0, 191, 60, 3);
    g.fillRect(0, 10, 128, 3); g.fillRect(0, 243, 128, 3);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 85, 128, 14); g.fillRect(0, 157, 128, 14);
    return toTexture(c);
  });
}
/** A 14 m intersection square with zebra crossings along each edge. */
export function junctionTexture() {
  return memo('junction', () => {
    const [c, g] = canvas(256, 256);
    g.fillStyle = '#3b3e44'; g.fillRect(0, 0, 256, 256);
    noise(g, 256, 256, 3500, 0.12);
    g.fillStyle = '#e8e8e8';
    for (let k = 16; k < 240; k += 22) {
      g.fillRect(k, 0, 11, 34); g.fillRect(k, 222, 11, 34);
      g.fillRect(0, k, 34, 11); g.fillRect(222, k, 34, 11);
    }
    return toTexture(c, true, false);
  });
}
export function surfaceTexture(kind) {
  return memo('surface-' + kind, () => {
    const [c, g] = canvas(128, 128);
    const base = { sidewalk: '#c9c2b6', sand: '#ecd3a0', grass: '#6f9a45', roof: '#77736d', plaza: '#d8c9b0', lot: '#4a4c50', dirt: '#9c8a68' }[kind];
    g.fillStyle = base; g.fillRect(0, 0, 128, 128);
    noise(g, 128, 128, kind === 'sand' ? 2500 : 1400, kind === 'grass' ? 0.2 : 0.1);
    if (kind === 'sidewalk' || kind === 'plaza') {
      g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 2;
      const step = kind === 'plaza' ? 32 : 64;
      for (let k = 0; k <= 128; k += step) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 128); g.moveTo(0, k); g.lineTo(128, k); g.stroke(); }
    }
    if (kind === 'grass') for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${rng.int(60, 140)},${rng.int(130, 190)},${rng.int(40, 80)},0.5)`; g.fillRect(rng.next() * 128, rng.next() * 128, 1, 4); }
    if (kind === 'lot') { g.fillStyle = '#ddd'; g.fillRect(0, 0, 3, 64); g.fillRect(0, 64, 3, 64); }
    return toTexture(c);
  });
}

/** Soft round glow for light sprites, flares and particles. */
export function glowTexture() {
  return memo('glow', () => {
    const [c, g] = canvas(64, 64);
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.65)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return toTexture(c, false, false);
  });
}

/** A neon sign: glowing text on a dark plate, used as an emissive plane. */
export function signTexture(text, color, plate = 'rgba(15,10,25,0.92)') {
  return memo('sign-' + text + color, () => {
    const [c, g] = canvas(512, 128);
    g.fillStyle = plate; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112);
    g.font = 'bold italic 64px Arial Black, Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 24;
    g.fillStyle = color; g.fillText(text, 256, 68);
    g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.globalAlpha = 0.6; g.fillText(text, 256, 68);
    return toTexture(c, true, false);
  });
}

/** Billboard art: a sunset poster with a brand line. */
export function billboardTexture(title, sub, hue) {
  return memo('bb-' + title, () => {
    const [c, g] = canvas(512, 256);
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, `hsl(${hue},80%,45%)`); grad.addColorStop(1, `hsl(${hue + 40},90%,60%)`);
    g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
    g.fillStyle = 'rgba(255,230,150,0.9)'; g.beginPath(); g.arc(400, 170, 70, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 190, 512, 66);
    g.font = 'bold italic 62px Arial Black, Arial, sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'left';
    g.fillText(title, 24, 90);
    g.font = 'bold 28px Arial, sans-serif'; g.fillText(sub, 26, 235);
    return toTexture(c, true, false);
  });
}
