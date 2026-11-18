// Story missions, taxi side jobs and hidden packages. One job: objectives and rewards.
// Story: Milo Kade, new in Solmar, runs jobs for Vera Solano, a fixer with a long memory.
import { PLACES, MONEY } from './config.js';
import { dist, angleTo } from './random.js';

const MISSIONS = [
  {
    id: 'm1', title: 'Welcome to Solmar', reward: 200,
    briefing: 'Vera wants to meet you. Drive to her office in the city centre.',
    steps: [{ type: 'goto', place: 'verasOffice', text: 'Drive to Vera\u2019s Office' }],
  },
  {
    id: 'm2', title: 'The Package', reward: 350,
    briefing: 'Pick up a package at Port Solmar Docks and deliver it to The Palms Hotel. The cops are sniffing around — expect a tail.',
    steps: [
      { type: 'goto', place: 'docks', text: 'Go to Port Solmar Docks' },
      { type: 'pickup', place: 'docks', text: 'Pick up the package (E)' },
      { type: 'goto', place: 'palmsHotel', text: 'Deliver to The Palms Hotel', heatOnStart: 1 },
    ],
  },
  {
    id: 'm3', title: 'Hot Pursuit', reward: 450,
    briefing: 'Rico\u2019s crew skimmed Vera\u2019s cut. Run down his getaway car and disable it.',
    steps: [{ type: 'chase', text: 'Chase down Rico\u2019s car and disable it' }],
  },
  {
    id: 'm4', title: 'Warehouse War', reward: 600,
    briefing: 'Rico\u2019s crew is holed up in the Bayview Warehouse. Clear them out and take the cash.',
    steps: [
      { type: 'goto', place: 'warehouse', text: 'Go to Bayview Warehouse' },
      { type: 'kill', text: 'Clear out Rico\u2019s crew', spawnEnemies: 5 },
      { type: 'pickup', place: 'warehouse', text: 'Grab the cash (E)' },
    ],
  },
  {
    id: 'm5', title: 'Grand Theft Solmar', reward: 750,
    briefing: 'A gold Comet GT is parked outside Casino del Sol. Steal it and bring it to the Marina. The owner will notice.',
    steps: [
      { type: 'goto', place: 'casino', text: 'Go to Casino del Sol' },
      { type: 'steal', place: 'casino', text: 'Steal the gold Comet GT' },
      { type: 'deliver', place: 'marina', text: 'Deliver the Comet to the Marina', heatOnStart: 2 },
    ],
  },
  {
    id: 'm6', title: 'The Last Job', reward: 1500,
    briefing: 'The vault at Casino del Sol. Grab the cash, lose the cops, and get to the airfield. After this, Solmar is yours.',
    steps: [
      { type: 'goto', place: 'casino', text: 'Go to Casino del Sol' },
      { type: 'pickup', place: 'casino', text: 'Grab the vault cash (E)', heatOnStart: 4 },
      { type: 'escape', place: 'airport', text: 'Escape to Solmar Airfield' },
    ],
  },
];

const PACKAGE_SPOTS = [
  { x: 3400, y: 300 }, { x: 260, y: 2080 }, { x: 1620, y: 2080 }, { x: 2820, y: 1180 },
  { x: 420, y: 820 }, { x: 2380, y: 420 }, { x: 1180, y: 2020 }, { x: 3220, y: 820 },
  { x: 820, y: 420 }, { x: 1980, y: 2080 },
];

export function createMissions(deps) {
  const { city, traffic, police, combat, audio, events, rng } = deps;
  const state = {
    index: 0, step: 0, active: false, done: false,
    objective: 'Find work — press N for missions', marker: null,
    enemies: [], rival: null, stealCar: null, taxi: null, taxiTimer: 8,
    packages: PACKAGE_SPOTS.map((p) => ({ ...p, taken: false })),
    packagesFound: 0, banner: null, bannerT: 0,
  };

  function placePos(name) { return PLACES[name]; }
  function stepDef() {
    const m = MISSIONS[state.index];
    return m ? m.steps[state.step] : null;
  }
  function setObjective(text, marker) {
    state.objective = text;
    state.marker = marker || null;
  }
  function startMission(i) {
    state.index = i; state.step = 0; state.active = true;
    const m = MISSIONS[i];
    events.onMissionStart(m);
    audio.missionDone();
    beginStep();
  }
  function beginStep() {
    const s = stepDef();
    if (!s) { completeMission(); return; }
    if (s.heatOnStart) police.addHeat(s.heatOnStart, 0, 0);
    if (s.type === 'kill') {
      const wp = placePos('warehouse');
      state.enemies = [];
      for (let i = 0; i < (s.spawnEnemies || 4); i += 1) {
        state.enemies.push({
          x: wp.x + rng.range(-120, 120), y: wp.y + rng.range(-120, 120),
          angle: 0, health: 60, shootCd: rng.range(0.5, 1.5), strafe: rng.range(0, Math.PI * 2),
        });
      }
    }
    if (s.type === 'chase') {
      const p = deps.getPlayer();
      const car = traffic.makeCar('rival', p.x + 500, p.y - 200, 0, '#7a1f2b');
      car.driver = 'ai'; car.speed = 300;
      car.waypoints = [
        { x: 600, y: 200 }, { x: 3000, y: 200 }, { x: 3000, y: 1800 },
        { x: 600, y: 1800 }, { x: 600, y: 1000 }, { x: 2600, y: 1000 },
      ];
      car.wp = 0;
      traffic.addCar(car);
      state.rival = car;
    }
    if (s.type === 'steal') {
      const cp = placePos('casino');
      const car = traffic.makeCar('parked', cp.x + 120, cp.y + 60, Math.PI / 2, '#f2c230');
      car.gold = true;
      traffic.addCar(car);
      state.stealCar = car;
    }
    const marker = s.place ? { ...placePos(s.place) } : null;
    setObjective(s.text, marker);
  }
  function completeStep() {
    state.step += 1;
    beginStep();
  }
  function completeMission() {
    const m = MISSIONS[state.index];
    state.active = false;
    events.onMissionReward(m.reward);
    events.onMissionComplete(m);
    audio.missionDone();
    state.index += 1;
    if (state.index >= MISSIONS.length) {
      state.done = true;
      setObjective('Story complete — Solmar is yours. Free roam!', null);
    } else {
      setObjective('Job done. Next job: ' + MISSIONS[state.index].title + ' — go to a phone icon, or press N to start it', null);
    }
  }
  function failMission(reason) {
    if (!state.active) return;
    state.active = false;
    state.enemies = [];
    if (state.rival) { const i = traffic.cars.indexOf(state.rival); if (i >= 0) traffic.cars.splice(i, 1); state.rival = null; }
    events.onMissionFail(reason);
    audio.missionFail();
    setObjective('Job failed: ' + reason + '. Press N to retry ' + MISSIONS[state.index].title, null);
  }
  function updateRival(dt) {
    const r = state.rival;
    if (!r || r.health <= 0) return;
    const wp = r.waypoints[r.wp];
    const a = angleTo(r.x, r.y, wp.x, wp.y);
    let d = a - r.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    r.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, d));
    r.speed = 340;
    r.x += Math.cos(r.angle) * r.speed * dt;
    r.y += Math.sin(r.angle) * r.speed * dt;
    city.resolveCircle(r, 19);
    if (dist(r.x, r.y, wp.x, wp.y) < 90) r.wp = (r.wp + 1) % r.waypoints.length;
    if (r.health <= 25) {
      r.speed = 0;
      state.rival = null;
      events.onBanner('Rico\u2019s car disabled!');
      completeStep();
    }
  }
  function updateEnemies(dt, player) {
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      if (e.health <= 0) {
        combat.spawnPickup('ammo', e.x, e.y, 24);
        if (rng.chance(0.4)) combat.spawnPickup('health', e.x, e.y, 25);
        state.enemies.splice(i, 1);
        continue;
      }
      const d = dist(e.x, e.y, player.x, player.y);
      e.angle = angleTo(e.x, e.y, player.x, player.y);
      if (d < 420) {
        e.shootCd -= dt;
        if (e.shootCd <= 0) {
          e.shootCd = rng.range(0.9, 1.6);
          events.onEnemyShoot(e.x, e.y, e.angle + rng.range(-0.1, 0.1));
        }
        // Strafe sideways so they are not sitting ducks.
        e.strafe += dt;
        e.x += Math.cos(e.angle + Math.PI / 2) * Math.sin(e.strafe * 1.4) * 40 * dt;
        e.y += Math.sin(e.angle + Math.PI / 2) * Math.sin(e.strafe * 1.4) * 40 * dt;
      } else if (d > 520) {
        e.x += Math.cos(e.angle) * 90 * dt;
        e.y += Math.sin(e.angle) * 90 * dt;
      }
      city.resolveCircle(e, 12);
    }
    if (state.enemies.length === 0 && stepDef() && stepDef().type === 'kill') completeStep();
  }
  function updateTaxi(dt, player, playerCar) {
    // Taxi fares: while driving, a fare offers itself; drop the passenger off for cash.
    if (!state.taxi) {
      state.taxiTimer -= dt;
      if (playerCar && state.taxiTimer <= 0 && !state.active) {
        const p = city.nearestRoadPoint(player.x + rng.range(-500, 500), player.y + rng.range(-500, 500));
        state.taxi = { phase: 'offer', x: p.x, y: p.y, dest: null, fare: MONEY.taxiFare };
        events.onBanner('Taxi fare nearby — drive to the passenger');
      }
      return;
    }
    const t = state.taxi;
    if (t.phase === 'offer') {
      if (playerCar && dist(player.x, player.y, t.x, t.y) < 70) {
        const d = city.nearestRoadPoint(player.x + rng.range(-900, 900), player.y + rng.range(-900, 900));
        t.phase = 'ride'; t.dest = d;
        events.onBanner('Passenger aboard — take them to the marker');
      }
    } else if (t.phase === 'ride') {
      if (playerCar && dist(player.x, player.y, t.dest.x, t.dest.y) < 70) {
        events.onMissionReward(t.fare);
        events.onBanner('Fare paid +' + MONEY.taxiFare);
        state.taxi = null; state.taxiTimer = 14;
      }
    }
    if (!playerCar && t.phase === 'ride') { state.taxi = null; state.taxiTimer = 10; }
  }
  function update(dt, player, playerCar, interact) {
    if (state.bannerT > 0) state.bannerT -= dt;
    // Hidden packages.
    for (const p of state.packages) {
      if (!p.taken && dist(player.x, player.y, p.x, p.y) < 26) {
        p.taken = true;
        state.packagesFound += 1;
        events.onMissionReward(MONEY.package);
        events.onBanner('Hidden package found! +' + MONEY.package + ' (' + state.packagesFound + '/10)');
      }
    }
    updateTaxi(dt, player, playerCar);
    if (!state.active) return;
    const s = stepDef();
    if (!s) return;
    if (s.type === 'chase') updateRival(dt);
    if (s.type === 'kill') updateEnemies(dt, player);
    const marker = state.marker;
    if (!marker) return;
    const d = dist(player.x, player.y, marker.x, marker.y);
    if (s.type === 'goto' || s.type === 'deliver' || s.type === 'escape') {
      if (d < 70) {
        if (s.type === 'deliver' && playerCar !== state.stealCar) {
          setObjective('You need the gold Comet GT for this delivery!', marker);
          return;
        }
        completeStep();
      }
    } else if ((s.type === 'pickup' || s.type === 'steal') && d < 70 && interact) {
      if (s.type === 'steal') {
        if (playerCar === state.stealCar) completeStep();
        else setObjective('Get in the gold Comet GT (E) to steal it', marker);
      } else {
        combat.spawnFx(marker.x, marker.y, '#ffd76a', 12, 160, 4, 0.5);
        completeStep();
      }
    }
  }
  return {
    state, MISSIONS,
    startMission, failMission, update,
    marker() {
      if (state.active && state.marker) return state.marker;
      if (state.taxi) return state.taxi.phase === 'ride' ? state.taxi.dest : { x: state.taxi.x, y: state.taxi.y };
      return null;
    },
    objective() { return state.objective; },
    nextMissionTitle() {
      return state.index < MISSIONS.length ? MISSIONS[state.index].title : null;
    },
  };
}
