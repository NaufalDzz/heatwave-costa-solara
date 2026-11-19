// In-car radio: three generative stations played by a look-ahead step sequencer (synthwave on
// WAVE 101.7, dembow on Costa Caliente 94.3, lo-fi on Lowtide FM 88.1) with drum, bass, chord and
// lead voices. Q changes station; the HUD shows a toast with the station and track name.
export const STATIONS = [
  { name: 'WAVE 101.7', freq: '101.7', bpm: 104, style: 'synth', songs: ['Neon Tides - Coral Static', 'Palm Shadows - Velvet Lanterns', 'Midnight Causeway - Sunreel', 'Pink Freeway - Lumen Bay'] },
  { name: 'COSTA CALIENTE 94.3', freq: '94.3', bpm: 96, style: 'dembow', songs: ['Fuego en la Bahía - La Marea', 'Calle Solara - DJ Coquí', 'Noche de Neón - Brisa Real', 'Malecón - Los Tiburones'] },
  { name: 'LOWTIDE FM 88.1', freq: '88.1', bpm: 78, style: 'lofi', songs: ['Salt on the Window - Tidepool', 'Rooftop Rain - Marlin Haze', 'Late Ferry - Quiet Harbor', 'Sunburnt Tapes - Driftwood'] },
  { name: 'RADIO OFF', freq: '--', style: 'off', songs: [''] },
];
const CHORDS = { synth: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], dembow: [[57, 60, 64], [55, 59, 62], [53, 57, 60], [52, 56, 59]], lofi: [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [45, 48, 52, 55]] };
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

export function createRadio(game) {
  let station = 0, step = 0, nextTime = 0, timer = null, out = null, songIndex = 0, songClock = 0;
  const audio = game.audio;

  function voice(t, freq, dur, type, vol, cutoff = 4000) {
    const ctx = audio.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  function drum(t, kind, vol = 1) {
    const ctx = audio.ctx;
    if (kind === 'kick') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.6 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.32);
      return;
    }
    const len = kind === 'hat' ? 0.04 : 0.16;
    const src = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.sin(i * 12.9898 + step) * 43758.5453 % 1) * (1 - i / d.length);
    src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
    const g = ctx.createGain(); g.gain.value = (kind === 'hat' ? 0.12 : 0.35) * vol;
    src.connect(f).connect(g).connect(out); src.start(t);
  }

  function schedule(t, s) {
    const st = STATIONS[station];
    const bar = Math.floor(s / 16), pos = s % 16;
    const chord = CHORDS[st.style][bar % 4];
    const sixteenth = 60 / st.bpm / 4;
    if (st.style === 'synth') {
      if (pos % 4 === 0) drum(t, 'kick');
      if (pos === 4 || pos === 12) drum(t, 'snare');
      if (pos % 2 === 1) drum(t, 'hat');
      if (pos % 2 === 0) voice(t, mtof(chord[0] - 24), sixteenth * 1.8, 'sawtooth', 0.12, 700);
      voice(t, mtof(chord[pos % 3] + 12), sixteenth * 0.9, 'square', 0.035, 2400);
      if (pos === 0) for (const n of chord) voice(t, mtof(n), sixteenth * 15, 'sawtooth', 0.025, 1500);
    } else if (st.style === 'dembow') {
      if (pos % 4 === 0) drum(t, 'kick');
      if (pos === 3 || pos === 6 || pos === 11 || pos === 14) drum(t, 'snare', 0.8);
      if (pos % 2 === 0) drum(t, 'hat', 0.7);
      if (pos === 0 || pos === 6 || pos === 8) voice(t, mtof(chord[0] - 24), sixteenth * 2.5, 'triangle', 0.25, 500);
      const mel = [0, 2, 1, 2, 0, 1, 2, 1];
      if (pos % 2 === 0 && (bar + pos) % 3 !== 2) voice(t, mtof(chord[mel[(pos / 2 + bar) % 8] % chord.length] + 12), sixteenth * 1.5, 'triangle', 0.09, 3000);
    } else if (st.style === 'lofi') {
      if (pos === 0 || pos === 10) drum(t, 'kick', 0.7);
      if (pos === 4 || pos === 12) drum(t, 'snare', 0.5);
      if (pos % 4 === 2) drum(t, 'hat', 0.6);
      if (pos === 0) for (const n of chord) voice(t + Math.random() * 0.02, mtof(n), sixteenth * 14, 'triangle', 0.05, 1200);
      if (pos === 0 || pos === 8) voice(t, mtof(chord[0] - 24), sixteenth * 6, 'sine', 0.2, 400);
      if (pos % 4 === 3 && bar % 2) voice(t, mtof(chord[(pos + bar) % chord.length] + 12), sixteenth * 3, 'sine', 0.05, 2000);
    }
  }

  function tick() {
    const ctx = audio.ctx;
    if (!ctx || !out) return;
    const playing = game.player.vehicle && STATIONS[station].style !== 'off' && game.mode === 'play';
    out.gain.setTargetAtTime(playing ? game.settings.music * 0.55 : 0, ctx.currentTime, 0.3);
    if (!playing) { nextTime = ctx.currentTime + 0.05; return; }
    const sixteenth = 60 / STATIONS[station].bpm / 4;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.25) { schedule(nextTime, step); step++; nextTime += sixteenth; }
  }

  game.events.on('audioReady', (ctx) => {
    out = ctx.createGain(); out.gain.value = 0; out.connect(audio.master);
    timer = setInterval(tick, 60);
  });
  const announce = () => {
    const st = STATIONS[station];
    game.hud.radio(st.name, st.freq, st.style === 'off' ? 'Silence. Just the engine.' : `♪ ${st.songs[songIndex % st.songs.length]}`);
  };
  game.events.on('enteredVehicle', () => announce());

  return {
    get station() { return STATIONS[station]; },
    get song() { return STATIONS[station].songs[songIndex % STATIONS[station].songs.length]; },
    set(i) { station = i; step = 0; announce(); },
    next() { station = (station + 1) % STATIONS.length; songIndex = Math.floor(game.rng.next() * 4); step = 0; announce(); },
    update(dt) {
      if (game.player.vehicle && game.input.wasPressed('KeyQ')) this.next();
      songClock += dt;
      if (songClock > 150) { songClock = 0; songIndex++; if (game.player.vehicle) announce(); }
    },
    stop() { if (timer) clearInterval(timer); },
  };
}
