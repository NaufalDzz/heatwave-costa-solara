// Boot and main loop of HEATWAVE: Costa Solara. Builds the game, then either stages a
// screenshot scene (?shot=name), drops straight into play (?autostart=1) or shows the title
// screen over a live flyover of the city. The simulation runs in fixed 1/60 s steps.
import { createGame } from './core/game.js';
import { createTitleScreen } from './ui/titleScreen.js';
import { stageShot } from './debug/shotDirector.js';

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
  const newGame = () => {
    game.sky.setHour(17.4);
    game.startPlay();
    game.hud.big('COSTA SOLARA', 'Five years gone. The city kept the lights on.', 'passed', 4);
    game.dialogue.play([['ines', 'Santi? It is Inés. Welcome home, cariño. Come see me at Café Inés in Sunset Heights.'], ['ines', 'Follow the yellow route on your radar. And try not to steal anything on the way.']]);
  };
  const title = createTitleScreen(game, {
    onNewGame: newGame,
    onContinue: (save) => { game.save.load(save); game.startPlay(); game.hud.notify('Welcome back to Costa Solara'); },
  });

  const shot = params.get('shot');
  if (shot) {
    stageShot(game, shot, title).then(() => { window.__shotReady = true; });
    return;
  }

  addEventListener('keydown', (e) => {
    game.audio.unlock();
    if (e.code !== 'Escape' && e.code !== 'KeyP') return;
    if (game.shop.open) game.shop.close();
    else if (game.pauseMenu.open) game.pauseMenu.close();
    else if (game.mode === 'play') game.pauseMenu.show(0);
  });
  addEventListener('mousedown', () => game.audio.unlock());

  if (params.get('autostart') === '1') newGame();
  else {
    game.traffic.populate(); game.peds.populate();
    game.sky.setHour(18.6);
    title.show();
  }

  let last = performance.now(), acc = 0;
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (game.mode !== 'paused' && game.mode !== 'shop') {
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
