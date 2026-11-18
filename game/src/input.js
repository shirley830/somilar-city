// Keyboard and pointer input for Solmar. Held keys steer and drive; one-shot
// presses (interact, reload, pause, confirm) are queued as flags and taken once.
export const ACT_INTERACT = 1;
export const ACT_RELOAD = 2;
export const ACT_PAUSE = 4;
export const ACT_CONFIRM = 8;
export const ACT_MUTE = 16;
export const ACT_JOB = 32;

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'KeyE') actions |= ACT_INTERACT;
    else if (event.code === 'KeyR') actions |= ACT_RELOAD;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACT_PAUSE;
    else if (event.code === 'Enter' || event.code === 'Space') actions |= ACT_CONFIRM;
    else if (event.code === 'KeyM') actions |= ACT_MUTE;
    else if (event.code === 'KeyN') actions |= ACT_JOB;
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

  function updateMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  canvas.addEventListener('pointermove', updateMouse);
  canvas.addEventListener('pointerdown', (event) => {
    updateMouse(event);
    mouse.down = true; mouse.clicked = true;
    actions |= ACT_CONFIRM;
  });
  canvas.addEventListener('pointerup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    keys, mouse,
    held: (code) => keys.has(code),
    /** Driving / walking axes: -1..1 for x (left/right) and y (up/down). */
    axes() {
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    running: () => keys.has('ShiftLeft') || keys.has('ShiftRight'),
    takeActions() { const a = actions; actions = 0; return a; },
    takeClick() { const c = mouse.clicked; mouse.clicked = false; return c; },
  };
}
