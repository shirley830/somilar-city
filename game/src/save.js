// Save and load: one localStorage slot for the player's progress. One job: persistence.
import { SAVE_KEY } from './config.js';

export function saveGame(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1, savedAt: Date.now(),
      cash: data.cash, health: data.health, armor: data.armor, ammo: data.ammo,
      x: data.x, y: data.y, missionIndex: data.missionIndex,
      packagesFound: data.packagesFound, packagesTaken: data.packagesTaken,
      missionsDone: data.missionsDone, playSeconds: data.playSeconds,
    }));
    return true;
  } catch (e) { return false; }
}
export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return null;
    return d;
  } catch (e) { return null; }
}
export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* no storage */ }
}
