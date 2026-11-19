// Keyboard and mouse state: held keys, keys pressed since the last frame, mouse-look deltas
// (pointer lock when the canvas is clicked, drag-to-look as a fallback) and mouse buttons.
export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const buttons = new Set();
  const clicked = new Set();
  const state = { dx: 0, dy: 0, wheel: 0, locked: false, enabled: true };

  addEventListener('keydown', (e) => {
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  });
  addEventListener('keyup', (e) => down.delete(e.code));
  addEventListener('blur', () => { down.clear(); buttons.clear(); });
  canvas.addEventListener('mousedown', (e) => {
    buttons.add(e.button);
    clicked.add(e.button);
    if (state.enabled && !state.locked) requestLock();
  });
  addEventListener('mouseup', (e) => buttons.delete(e.button));
  addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => {
    if (state.locked || buttons.has(2)) {
      state.dx += e.movementX || 0;
      state.dy += e.movementY || 0;
    }
  });
  addEventListener('wheel', (e) => { state.wheel += Math.sign(e.deltaY); }, { passive: true });
  document.addEventListener('pointerlockchange', () => { state.locked = document.pointerLockElement === canvas; });
  document.addEventListener('pointerlockerror', () => { state.locked = false; });

  function requestLock() {
    try {
      const result = canvas.requestPointerLock && canvas.requestPointerLock();
      if (result && result.catch) result.catch(() => {});
    } catch {
      // Pointer lock is refused in some embeds; drag with the right button instead.
    }
  }

  return {
    state,
    isDown: (code) => down.has(code),
    wasPressed: (code) => pressed.has(code),
    mouseDown: (b) => buttons.has(b),
    mouseClicked: (b) => clicked.has(b),
    /** Read and clear the mouse movement gathered since the last call. */
    takeMouse() {
      const out = { dx: state.dx, dy: state.dy, wheel: state.wheel };
      state.dx = state.dy = state.wheel = 0;
      return out;
    },
    releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); },
    requestLock,
    endFrame() { pressed.clear(); clicked.clear(); },
    /** Lets test scripts and staged shots press keys through the same path as a player. */
    simulate(code, isDown) {
      if (isDown) { if (!down.has(code)) pressed.add(code); down.add(code); } else down.delete(code);
    },
  };
}
