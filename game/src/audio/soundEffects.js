// Procedural WebAudio sound: engine drone that follows speed and throttle, police sirens that
// wail louder as units close in, gunshots per weapon, explosions, crashes, horn, punches, screams,
// cash and checkpoint chimes, mission jingles and UI blips. Starts on the first key or click.
import { clamp } from '../core/mathUtils.js';

export function createSoundEffects(game) {
  let ctx = null, master = null, sfx = null, noise = null;
  let engine = null, siren = null;
  const a = {
    get ctx() { return ctx; }, get master() { return master; },
    unlock() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = game.settings.volume; master.connect(ctx.destination);
      sfx = ctx.createGain(); sfx.connect(master);
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noise.getChannelData(0);
      let s = 12345;
      for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x7fffffff) * 2 - 1; }
      game.events.emit('audioReady', ctx);
    },
  };
  const near = (x, z) => {
    if (x === undefined) return 1;
    const c = game.camera.position;
    return clamp(1 - Math.hypot(x - c.x, z - c.z) / 140, 0, 1);
  };
  function env(node, t, peak, attack, decay) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function burst({ dur = 0.2, freq = 1000, q = 1, type = 'bandpass', vol = 0.5, x, z, sweep }) {
    if (!ctx) return;
    const v = vol * near(x, z);
    if (v < 0.01) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = ctx.createGain(); env(g, t, v, 0.004, dur);
    src.connect(f).connect(g).connect(sfx);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  function tone({ freq = 440, to, dur = 0.2, type = 'sine', vol = 0.3, at = 0, x, z, attack = 0.005 }) {
    if (!ctx) return;
    const v = vol * near(x, z);
    if (v < 0.01) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain(); env(g, t, v, attack, dur);
    o.connect(g).connect(sfx);
    o.start(t); o.stop(t + dur + attack + 0.05);
  }

  Object.assign(a, {
    gunshot(id, x, z) {
      const big = id === 'shotgun' || id === 'rifle';
      burst({ dur: big ? 0.28 : 0.14, freq: big ? 1400 : 2200, q: 0.7, vol: big ? 0.9 : 0.6, x, z, sweep: 300 });
      tone({ freq: big ? 120 : 160, to: 40, dur: 0.18, type: 'triangle', vol: big ? 0.7 : 0.45, x, z });
    },
    explosion(x, z) {
      burst({ dur: 1.6, freq: 900, type: 'lowpass', q: 0.5, vol: 1.2, x, z, sweep: 80 });
      tone({ freq: 70, to: 25, dur: 1.2, type: 'sine', vol: 1, x, z });
    },
    crash(speed) { burst({ dur: 0.35, freq: 700, q: 0.8, vol: clamp(speed / 20, 0.2, 0.9), sweep: 200 }); tone({ freq: 90, to: 50, dur: 0.2, type: 'square', vol: 0.15 }); },
    horn(x, z) { tone({ freq: 392, dur: 0.38, type: 'square', vol: 0.12, x, z, attack: 0.01 }); tone({ freq: 494, dur: 0.38, type: 'square', vol: 0.1, x, z, attack: 0.01 }); },
    punch() { burst({ dur: 0.08, freq: 400, q: 1, vol: 0.6 }); tone({ freq: 110, to: 60, dur: 0.1, type: 'sine', vol: 0.5 }); },
    whoosh() { burst({ dur: 0.15, freq: 1800, q: 2, vol: 0.15, sweep: 600 }); },
    click() { tone({ freq: 1800, dur: 0.03, type: 'square', vol: 0.08 }); },
    reload() { tone({ freq: 900, dur: 0.04, type: 'square', vol: 0.08 }); tone({ freq: 600, dur: 0.05, type: 'square', vol: 0.08, at: 0.5 }); },
    blip() { tone({ freq: 1200, dur: 0.05, type: 'triangle', vol: 0.06 }); },
    scream(x, z) { tone({ freq: 700 + Math.random() * 300, to: 420, dur: 0.7, type: 'sawtooth', vol: 0.05, x, z, attack: 0.05 }); },
    cash() { [1046, 1318, 1568, 2093].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.18, at: i * 0.06 })); },
    checkpoint() { tone({ freq: 880, dur: 0.12, type: 'square', vol: 0.1 }); tone({ freq: 1320, dur: 0.2, type: 'square', vol: 0.1, at: 0.1 }); },
    jingle(win) {
      const notes = win ? [523, 659, 784, 1046, 784, 1046, 1318] : [440, 415, 392, 349, 262];
      notes.forEach((f, i) => { tone({ freq: f, dur: 0.22, type: 'sawtooth', vol: 0.12, at: i * 0.13 }); tone({ freq: f / 2, dur: 0.22, type: 'triangle', vol: 0.15, at: i * 0.13 }); });
    },
    startEngine() {
      if (!ctx || engine) return;
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = 0;
      o1.connect(f); o2.connect(f); f.connect(g).connect(sfx);
      o1.start(); o2.start();
      engine = { o1, o2, f, g };
    },
    stopEngine() { if (!engine) return; const e = engine; engine = null; e.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); e.o1.stop(ctx.currentTime + 0.5); e.o2.stop(ctx.currentTime + 0.5); },
    update() {
      if (!ctx) return;
      master.gain.value = game.settings.volume;
      const v = game.player.vehicle;
      if (engine && v) {
        const sp = Math.abs(v.speed), gear = sp / (v.spec.maxSpeed / 5);
        const rpm = 0.25 + (gear % 1) * 0.75 + Math.floor(gear) * 0.05;
        const f = 38 + rpm * 70 * (v.type === 'truck' ? 0.6 : v.type === 'sports' ? 1.3 : 1);
        engine.o1.frequency.setTargetAtTime(f, ctx.currentTime, 0.05);
        engine.o2.frequency.setTargetAtTime(f * 0.5, ctx.currentTime, 0.05);
        engine.f.frequency.setTargetAtTime(400 + Math.abs(v.input.throttle) * 900 + sp * 10, ctx.currentTime, 0.05);
        engine.g.gain.setTargetAtTime(v.exploded ? 0 : 0.05 + Math.abs(v.input.throttle) * 0.06, ctx.currentTime, 0.08);
      }
      // Sirens: loudness follows the nearest unit.
      const units = game.police.units().filter((u) => u.siren);
      let d = Infinity;
      for (const u of units) d = Math.min(d, Math.hypot(u.x - game.camera.position.x, u.z - game.camera.position.z));
      const vol = units.length ? clamp(1 - d / 220, 0, 1) * 0.07 : 0;
      if (vol > 0 && !siren) {
        const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = 900; lfo.frequency.value = 0.55; lg.gain.value = 320; g.gain.value = 0;
        lfo.connect(lg).connect(o.frequency); o.connect(g).connect(sfx);
        o.start(); lfo.start();
        siren = { o, lfo, g };
      }
      if (siren) {
        siren.g.gain.setTargetAtTime(vol, ctx.currentTime, 0.2);
        if (vol === 0 && !units.length) { const s = siren; siren = null; s.o.stop(ctx.currentTime + 0.6); s.lfo.stop(ctx.currentTime + 0.6); }
      }
    },
  });
  return a;
}
