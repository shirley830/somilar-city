// Screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the real
// rules forward from a fresh seeded game for a fixed number of steps with scripted
// input, so the frame is what a short game really looks like and the same seed
// always gives the same frame. One job: deterministic scenes.
import { SCREEN_MENU, SCREEN_PLAY } from './render.js';

const STEP = 1 / 60;

function stepFor(G, seconds, input) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i += 1) G.step(STEP, input);
}

// Scripted input: drive straight ahead, gently correcting.
function driveInput(t) {
  return { axes: { x: Math.sin(t * 0.7) * 0.3, y: -1 }, firing: false, interact: false, punch: false };
}

export function stageShot(name, G) {
  G.reset(1);
  if (name === 'drive') {
    G.startGame();
    const car = G.debugPutPlayerInCar(1200, 1000, 0);
    car.speed = 200;
    stepFor(G, 2.5, driveInput(0));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    G.startGame();
    G.player.armor = 100;
    const car = G.debugPutPlayerInCar(1200, 1400, 0);
    car.speed = 260;
    G.police.addHeat(3, car.x, car.y);
    G.missions.startMission(0);
    stepFor(G, 3.5, driveInput(0));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    G.startGame();
    G.player.armor = 50;
    G.missions.state.index = 3;
    G.missions.startMission(3);
    G.debugTeleportPlayer(1420, 1900);
    G.player.angle = -Math.PI / 2;
    G.player.aiming = true;
    // Aim at the nearest enemy and fire in bursts.
    for (let i = 0; i < 3 * 60; i += 1) {
      const e = G.missions.state.enemies[0];
      if (e) G.player.angle = Math.atan2(e.y - G.player.y, e.x - G.player.x);
      G.step(STEP, { axes: { x: 0, y: 0 }, firing: i % 12 < 6, interact: false, punch: false });
    }
    return { screen: SCREEN_PLAY };
  }
  // Default: the title screen over a living downtown.
  G.debugAmbient(1800, 1000);
  stepFor(G, 2, { axes: { x: 0, y: 0 }, firing: false, interact: false, punch: false });
  return { screen: SCREEN_MENU };
}
