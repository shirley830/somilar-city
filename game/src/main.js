// Boot and the one loop: Solmar. Input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. Screens: menu, play,
// paused, wasted, busted.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { WORLD, PLAYER, GUN, CAR, WANTED, MONEY, PLACES } from './config.js';
import { makeRng, clamp, dist, angleTo, fmtMoney } from './random.js';
import { buildCity } from './world.js';
import { ACT_INTERACT, ACT_RELOAD, ACT_PAUSE, ACT_CONFIRM, ACT_MUTE, ACT_JOB, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createRenderer, SCREEN_MENU, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_WASTED, SCREEN_BUSTED } from './render.js';
import { saveGame, loadGame } from './save.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const input = createInput(canvas);
const renderer = createRenderer(canvas);
const audio = createAudio();

function announce(message) { status.textContent = message; }

// Mutable session state (survives a city reset).
const S = {
  player: null, camera: { x: 1800, y: 1300, zoom: 0.9, w: 1400, h: 800, shake: 0 },
  screen: SCREEN_MENU, time: 0, clockMin: 600, day: 1,
  banner: null, bannerT: 0, saveData: loadGame(), menuButtons: [],
  playSeconds: 0, saveTimer: 0, missionsDone: 0, sprayCd: 0, hornCd: 0,
};
// Subsystems, rebuilt on every reset.
const sys = { city: null, traffic: null, police: null, combat: null, missions: null };

function freshPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, health: PLAYER.maxHealth, armor: 0,
    mag: GUN.magSize, ammo: 48, cash: MONEY.start,
    aiming: false, fireCd: 0, reloadT: 0, punchCd: 0,
  };
}

function clockText() {
  const mins = Math.floor(S.clockMin) % 1440;
  const h = Math.floor(mins / 60), m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return 'Day ' + S.day + '  •  ' + h12 + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}

function doSave() {
  const p = S.player;
  saveGame({
    cash: p.cash, health: p.health, armor: p.armor, ammo: p.ammo, mag: p.mag,
    x: p.x, y: p.y, missionIndex: sys.missions.state.index,
    packagesFound: sys.missions.state.packagesFound,
    packagesTaken: sys.missions.state.packages.map((pk) => pk.taken),
    missionsDone: S.missionsDone, playSeconds: S.playSeconds,
  });
}

const events = {
  onCrash(x, y, intensity) {
    audio.crash(Math.min(1, intensity / 500));
    sys.combat.spawnFx(x, y, '#ffd76a', 6, 160, 3, 0.3);
    S.camera.shake = Math.min(9, S.camera.shake + intensity / 80);
  },
  onExplode(x, y) {
    // A car was destroyed: the visual blast; damage is applied by onExplosion.
    sys.combat.explode(x, y, 120, 45);
  },
  onExplosion(x, y, radius, damage) {
    audio.explosion();
    S.camera.shake = 14;
    const p = S.player;
    const d = dist(p.x, p.y, x, y);
    if (d < radius) events.onPlayerDamage(damage * (1 - d / radius), x, y);
    for (const c of sys.traffic.cars) {
      if (c.health > 0 && dist(c.x, c.y, x, y) < radius && !(c.x === x && c.y === y)) {
        sys.traffic.damageCar(c, damage * 0.7, false);
      }
    }
    for (const ped of sys.traffic.peds) if (ped.down <= 0 && dist(ped.x, ped.y, x, y) < radius) ped.down = 3;
    for (const cop of sys.police.cops) if (cop.down <= 0 && dist(cop.x, cop.y, x, y) < radius) cop.down = 4;
    for (const e of sys.missions.state.enemies) if (e.health > 0 && dist(e.x, e.y, x, y) < radius) e.health -= damage;
  },
  onPedHit(x, y, byPlayer) {
    if (byPlayer) {
      sys.police.addHeat(WANTED.crimeHeat.hitPed, x, y);
      sys.combat.spawnFx(x, y, '#c0392b', 8, 120, 3, 0.5);
    }
  },
  onWantedChange(w) { announce(w > 0 ? 'Wanted level ' + w + '. Lose the cops.' : 'You are clean.'); },
  onBusted() {
    if (S.screen !== SCREEN_PLAY) return;
    S.screen = SCREEN_BUSTED;
    sys.missions.failMission('Busted by the Solmar PD');
    S.player.cash = Math.max(0, S.player.cash - MONEY.respawnCost);
    sys.police.clearWanted();
    audio.stopMusic();
    announce('Busted. The Solmar PD let you go — minus ' + fmtMoney(MONEY.respawnCost) + '.');
  },
  onCopShoot(x, y, angle) { sys.combat.fireBullet(x, y, angle, { from: 'cop', damage: 5, speed: 700, spread: 0.08, range: 420 }); },
  onEnemyShoot(x, y, angle) { sys.combat.fireBullet(x, y, angle, { from: 'enemy', damage: 10, speed: 750, spread: 0.09, range: 460 }); },
  onSiren(high, on) { audio.setSirenTone(high); audio.siren(on); },
  onPlayerDamage(dmg) {
    if (S.screen !== SCREEN_PLAY) return; // already wasted or busted: no double penalty
    const p = S.player;
    const absorbed = Math.min(p.armor, dmg * 0.6);
    p.armor -= absorbed;
    p.health -= (dmg - absorbed);
    sys.combat.spawnFx(p.x, p.y, '#c0392b', 6, 130, 3, 0.4);
    S.camera.shake = Math.min(8, S.camera.shake + 3);
    if (p.health <= 0) {
      p.health = 0;
      S.screen = SCREEN_WASTED;
      sys.missions.failMission('Milo got wasted');
      p.cash = Math.max(0, p.cash - MONEY.respawnCost);
      sys.police.clearWanted();
      audio.stopMusic();
      announce('Wasted. Solmar General patched you up — minus ' + fmtMoney(MONEY.respawnCost) + '.');
    }
  },
  onCarShot(car, dmg) { sys.traffic.damageCar(car, dmg, true); },
  onPedShot(ped) {
    ped.down = 3;
    sys.police.addHeat(WANTED.crimeHeat.hitPed, ped.x, ped.y);
    sys.combat.spawnFx(ped.x, ped.y, '#c0392b', 8, 120, 3, 0.5);
  },
  onCopShot(cop) {
    cop.down = 4;
    sys.police.addHeat(WANTED.crimeHeat.killCop, cop.x, cop.y);
    sys.combat.spawnPickup('health', cop.x, cop.y, 25);
    sys.combat.spawnFx(cop.x, cop.y, '#2456d6', 8, 140, 3, 0.5);
  },
  onEnemyShot(e, dmg) {
    e.health -= dmg;
    sys.combat.spawnFx(e.x, e.y, '#c0392b', 5, 120, 3, 0.4);
  },
  onPickup(p) {
    const pl = S.player;
    if (p.kind === 'health') pl.health = Math.min(PLAYER.maxHealth, pl.health + 25);
    else if (p.kind === 'ammo') pl.ammo += 24;
    else if (p.kind === 'armor') pl.armor = Math.min(PLAYER.maxArmor, pl.armor + 25);
    else if (p.kind === 'cash') pl.cash += p.amount;
    audio.pickup();
  },
  onMissionStart(m) {
    S.banner = m.title; S.bannerT = 4;
    announce(m.title + '. ' + m.briefing);
  },
  onMissionComplete(m) {
    S.banner = 'JOB DONE — ' + m.title + '  +' + fmtMoney(m.reward); S.bannerT = 4;
    S.missionsDone += 1;
    doSave();
    announce('Job done: ' + m.title + '. Earned ' + fmtMoney(m.reward) + '.');
  },
  onMissionReward(amount) { S.player.cash += amount; },
  onMissionFail(reason) { S.banner = 'JOB FAILED — ' + reason; S.bannerT = 4; },
  onBanner(text) { S.banner = text; S.bannerT = 3; },
};

function initSystems(sd) {
  const rng = makeRng(sd);
  sys.city = buildCity(sd);
  sys.traffic = createTraffic(sys.city, rng, events);
  sys.police = createPolice(sys.city, sys.traffic, rng, events);
  sys.combat = createCombat(events);
  sys.missions = createMissions({
    city: sys.city, traffic: sys.traffic, police: sys.police, combat: sys.combat,
    audio, events, rng,
    getPlayer: () => S.player,
    getPlayerCar: () => sys.traffic.state.playerCar,
  });
}

function reset(sd) {
  initSystems(sd);
  const home = PLACES.safehouse;
  S.player = freshPlayer(home.x, home.y + 40);
  S.camera.x = home.x; S.camera.y = home.y;
  S.time = 0; S.clockMin = 600; S.day = 1;
  S.banner = null; S.bannerT = 0;
  S.playSeconds = 0; S.saveTimer = 0; S.missionsDone = 0; S.sprayCd = 0;
  S.screen = SCREEN_MENU;
}

function applySave(d) {
  const p = S.player;
  p.cash = d.cash; p.health = d.health; p.armor = d.armor; p.ammo = d.ammo;
  p.mag = d.mag || GUN.magSize; p.x = d.x; p.y = d.y;
  sys.missions.state.index = d.missionIndex || 0;
  sys.missions.state.packagesFound = d.packagesFound || 0;
  if (Array.isArray(d.packagesTaken)) {
    d.packagesTaken.forEach((t, i) => { if (sys.missions.state.packages[i]) sys.missions.state.packages[i].taken = !!t; });
  }
  S.missionsDone = d.missionsDone || 0;
  S.playSeconds = d.playSeconds || 0;
}

function startGame(fromSave) {
  reset(Math.floor(Math.random() * 4294967296));
  if (fromSave && S.saveData) applySave(S.saveData);
  S.screen = SCREEN_PLAY;
  audio.unlock();
  audio.startMusic();
  announce(fromSave ? 'Welcome back to Solmar.' : 'Welcome to Solmar. Vera is waiting — press N for your first job.');
}

// One fixed step. simInput: {axes, firing, interact, punch, reload, aimAngle}
function step(dt, sim) {
  const p = S.player;
  const playerCar = sys.traffic.state.playerCar;
  S.time += dt;
  S.playSeconds += dt;
  S.clockMin += dt * 0.4; // one game hour per 150 seconds
  if (S.clockMin >= 1440) { S.clockMin -= 1440; S.day += 1; }
  if (S.bannerT > 0) S.bannerT -= dt;
  if (S.sprayCd > 0) S.sprayCd -= dt;
  if (S.hornCd > 0) S.hornCd -= dt;
  if (p.fireCd > 0) p.fireCd -= dt;
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      const need = GUN.magSize - p.mag;
      const take = Math.min(need, p.ammo);
      p.mag += take; p.ammo -= take;
    }
  }

  if (playerCar) {
    p.x = playerCar.x; p.y = playerCar.y; p.angle = playerCar.angle;
    p.aiming = false;
    if (sim.horn && S.hornCd <= 0) { audio.horn(); S.hornCd = 0.8; }
    audio.engine(Math.abs(playerCar.speed) / CAR.maxSpeed, true);
    // Spray shop: drive through to clear the heat, for a fee.
    const spray = PLACES.sprayShop;
    if (S.sprayCd <= 0 && sys.police.wanted() > 0 && p.cash >= 100 && dist(p.x, p.y, spray.x, spray.y) < 70) {
      sys.police.clearWanted();
      p.cash -= 100;
      S.sprayCd = 10;
      events.onBanner('Spray shop — wanted cleared, -$100');
      audio.pickup();
    }
    if (sim.interact) {
      // Do not exit while the steal step wants the E press to complete.
      const st = sys.missions.state;
      const stepDef = st.active ? sys.missions.MISSIONS[st.index].steps[st.step] : null;
      const nearMarker = st.marker && dist(p.x, p.y, st.marker.x, st.marker.y) < 70;
      if (!(stepDef && stepDef.type === 'steal' && nearMarker)) {
        sys.traffic.setPlayerCar(null);
        playerCar.driver = playerCar.kind === 'traffic' ? 'ai' : 'none';
        playerCar.speed = 0;
        p.x = playerCar.x + Math.cos(playerCar.angle + Math.PI / 2) * 34;
        p.y = playerCar.y + Math.sin(playerCar.angle + Math.PI / 2) * 34;
        sys.city.resolveCircle(p, 14);
      }
    }
  } else {
    audio.engine(0, false);
    if (sim.aimAngle !== undefined) { p.angle = sim.aimAngle; p.aiming = true; }
    const ax = sim.axes;
    const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const mx = ax.x, my = ax.y;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my) || 1;
      p.x += (mx / len) * speed * dt;
      p.y += (my / len) * speed * dt;
      sys.city.resolveCircle(p, PLAYER.radius);
    }
    if (sim.punch && p.punchCd <= 0) {
      p.punchCd = 0.45;
      audio.punch();
      const check = (t, r, dmg, fn) => {
        if (t && dist(p.x, p.y, t.x, t.y) < PLAYER.punchRange + r) {
          const a = angleTo(p.x, p.y, t.x, t.y);
          let d = a - p.angle;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          if (Math.abs(d) < PLAYER.punchArc) fn(t, dmg);
        }
      };
      for (const ped of sys.traffic.peds) check(ped, 10, 0, (t) => { t.down = 3; sys.police.addHeat(0.5, t.x, t.y); });
      for (const cop of sys.police.cops) check(cop, 10, 0, (t) => { t.down = 4; sys.police.addHeat(1, t.x, t.y); });
      for (const e of sys.missions.state.enemies) check(e, 10, PLAYER.punchDamage, (t, dmg) => { t.health -= dmg; });
    }
    if (sim.reload && p.mag < GUN.magSize && p.ammo > 0 && p.reloadT <= 0) p.reloadT = GUN.reloadTime;
    if (sim.firing && p.reloadT <= 0) {
      if (p.mag > 0 && p.fireCd <= 0) {
        p.mag -= 1; p.fireCd = GUN.fireRate;
        sys.combat.fireBullet(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, p.angle, { from: 'player', spread: GUN.spread });
        audio.shoot();
        sys.police.addHeat(0.05, p.x, p.y);
      } else if (p.mag === 0 && p.ammo > 0 && p.reloadT <= 0) {
        p.reloadT = GUN.reloadTime;
      }
    }
    if (sim.interact) {
      const car = sys.traffic.nearestCar(p.x, p.y, 56);
      if (car && car.kind !== 'police' && car.health > 0) {
        if (car.kind === 'traffic' || car.kind === 'parked' || car.kind === 'rival' || car.gold) {
          sys.traffic.setPlayerCar(car);
          sys.police.addHeat(WANTED.crimeHeat.stealCar, p.x, p.y);
          events.onBanner(car.gold ? 'The Comet GT is yours — go!' : 'Car stolen — the heat is on');
          audio.horn();
        }
      }
    }
  }

  const threats = [];
  if (sim.firing || sim.punch) threats.push({ x: p.x, y: p.y });
  const pc = sys.traffic.state.playerCar;
  if (pc && Math.abs(pc.speed) > 200) threats.push({ x: pc.x, y: pc.y });
  sys.traffic.update(dt, p, sim.axes, threats);
  sys.police.update(dt, p, sys.traffic.state.playerCar);
  sys.combat.update(dt, sys.city, {
    player: p, playerCar: sys.traffic.state.playerCar,
    cars: sys.traffic.cars, peds: sys.traffic.peds,
    cops: sys.police.cops, enemies: sys.missions.state.enemies,
  });
  sys.missions.update(dt, p, sys.traffic.state.playerCar, sim.interact);

  // Camera follows the player or the car.
  const tx = p.x, ty = p.y;
  S.camera.x += (tx - S.camera.x) * Math.min(1, 5 * dt);
  S.camera.y += (ty - S.camera.y) * Math.min(1, 5 * dt);
  const size = renderer.size();
  S.camera.zoom = clamp(Math.min(size.w, size.h) / 900, 0.75, 1.15);
  S.camera.w = size.w / S.camera.zoom;
  S.camera.h = size.h / S.camera.zoom;
  if (S.camera.shake > 0) {
    S.camera.shake = Math.max(0, S.camera.shake - 30 * dt);
    S.camera.x += (Math.random() - 0.5) * S.camera.shake;
    S.camera.y += (Math.random() - 0.5) * S.camera.shake;
  }

  // Autosave while playing.
  S.saveTimer += dt;
  if (S.saveTimer > 25 && S.screen === SCREEN_PLAY) { S.saveTimer = 0; doSave(); }
}

function viewState() {
  return {
    city: sys.city, traffic: sys.traffic, police: sys.police, combat: sys.combat, missions: sys.missions,
    player: S.player, playerCar: sys.traffic.state.playerCar, camera: S.camera,
    time: S.time, screen: S.screen, banner: S.banner, bannerT: S.bannerT,
    clockText: clockText(), input, saveData: S.saveData,
    get menuButtons() { return S.menuButtons; },
    set menuButtons(v) { S.menuButtons = v; },
  };
}

const G = {
  get player() { return S.player; },
  get police() { return sys.police; },
  get missions() { return sys.missions; },
  get traffic() { return sys.traffic; },
  get screen() { return S.screen; },
  reset(sd) { reset(sd); },
  startGame() { startGame(false); },
  step(dt, sim) { step(dt, sim); },
  debugPutPlayerInCar(x, y, angle) {
    const car = sys.traffic.makeCar('parked', x, y, angle || 0);
    sys.traffic.addCar(car);
    sys.traffic.setPlayerCar(car);
    S.player.x = x; S.player.y = y;
    return car;
  },
  debugTeleportPlayer(x, y) { S.player.x = x; S.player.y = y; S.camera.x = x; S.camera.y = y; },
  debugAmbient(x, y) {
    sys.traffic.ensurePopulation(x, y);
    S.camera.x = x; S.camera.y = y;
  },
};

function runShot(name) {
  const scene = stageShot(name, G);
  S.screen = scene.screen;
  let painted = 0;
  function paint() {
    renderer.draw(viewState());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  reset(seed);
  let accumulator = 0;
  let last = performance.now();

  function mouseAngle() {
    const size = renderer.size();
    const wx = S.camera.x + (input.mouse.x - size.w / 2) / S.camera.zoom;
    const wy = S.camera.y + (input.mouse.y - size.h / 2) / S.camera.zoom;
    return angleTo(S.player.x, S.player.y, wx, wy);
  }
  function menuClick() {
    const mx = input.mouse.x, my = input.mouse.y;
    for (const b of S.menuButtons || []) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return b.id;
    }
    return null;
  }
  function handleActions(actions) {
    if (actions & ACT_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (S.screen === SCREEN_MENU) {
      if (input.takeClick()) {
        const hit = menuClick();
        if (hit === 'continue') startGame(true);
        else if (hit === 'new') startGame(false);
      } else if (actions & ACT_CONFIRM) startGame(!!S.saveData);
      return;
    }
    if (S.screen === SCREEN_PAUSE) {
      if (actions & (ACT_PAUSE | ACT_CONFIRM)) { S.screen = SCREEN_PLAY; announce('Playing.'); return; }
      if (input.takeClick()) {
        const hit = menuClick();
        if (hit === 'resume') { S.screen = SCREEN_PLAY; announce('Playing.'); }
        else if (hit === 'quit') { doSave(); S.screen = SCREEN_MENU; S.saveData = loadGame(); announce('Saved.'); }
      }
      return;
    }
    if (S.screen === SCREEN_WASTED || S.screen === SCREEN_BUSTED) {
      if (actions & ACT_CONFIRM) { respawn(); return; }
      if (input.takeClick()) {
        const hit = menuClick();
        if (hit === 'respawn') respawn();
      }
      return;
    }
    if (actions & ACT_PAUSE) { S.screen = SCREEN_PAUSE; audio.engine(0, false); announce('Paused.'); }
  }
  function respawn() {
    const p = S.player;
    const spot = S.screen === SCREEN_WASTED ? PLACES.hospital : PLACES.policeHQ;
    p.x = spot.x; p.y = spot.y; p.health = PLAYER.maxHealth; p.armor = 0;
    sys.traffic.setPlayerCar(null);
    S.camera.x = p.x; S.camera.y = p.y;
    S.screen = SCREEN_PLAY;
    audio.startMusic();
    announce('Back on the streets of Solmar.');
  }
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (S.screen === SCREEN_PLAY) {
      let stepActions = actions;
      while (accumulator >= STEP) {
        const ax = input.axes();
        step(STEP, {
          axes: ax,
          firing: input.mouse.down,
          interact: !!(stepActions & ACT_INTERACT),
          punch: input.held('KeyF'),
          reload: !!(stepActions & ACT_RELOAD),
          horn: input.held('KeyH'),
          aimAngle: mouseAngle(),
        });
        stepActions &= ~ACT_INTERACT;
        accumulator -= STEP;
      }
      // N starts the next job.
      if ((actions & ACT_JOB) && !sys.missions.state.active && sys.missions.nextMissionTitle()) {
        sys.missions.startMission(sys.missions.state.index);
      }
    } else {
      accumulator = 0;
      if (S.screen === SCREEN_MENU) {
        // Ambient city life behind the menu.
        S.time += 1 / 60;
        sys.traffic.ensurePopulation(S.camera.x, S.camera.y);
        sys.traffic.update(1 / 60, S.player, { x: 0, y: 0 }, []);
        S.camera.x = 1800 + Math.sin(S.time * 0.05) * 500;
      }
    }
    renderer.draw(viewState());
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.screen === SCREEN_PLAY) {
      S.screen = SCREEN_PAUSE;
      announce('Paused.');
    }
  });
  announce('Solmar. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
