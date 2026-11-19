// Boot and main loop of HEATWAVE: Costa Solara. Builds the game, then either stages a
// screenshot scene (?shot=name), drops straight into play (?autostart=1) or shows the title
// screen over a live flyover of the city. The simulation runs in fixed 1/60 s steps.
import { createGame } from './core/game.js';

const params = new URLSearchParams(location.search);
const STEP = 1 / 60;

function boot() {
  const canvas = document.getElementById('scene');
  const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
  const game = createGame(canvas, Number.isInteger(seedParam) ? seedParam : 1);
  window.__game = game;
  document.getElementById('loading').classList.add('hidden');

  game.startPlay = () => {
    game.mode = 'play';
    game.cameraRig.override = null;
    game.cameraRig.snap();
    game.hud.show(true);
    if (!game.traffic.cars.size) { game.traffic.populate(); game.peds.populate(); }
  };
  game.startPlay();

  let last = performance.now(), acc = 0;
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (game.mode !== 'paused') {
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 4) { game.update(STEP); acc -= STEP; steps++; }
      if (steps === 4) acc = 0;
    } else game.input.endFrame();
    game.frame(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

boot();
