// Traffic and pedestrians: road-following cars, parked cars, player driving physics,
// and sidewalk pedestrians who flee danger. One job: everything that moves on the street.
import { WORLD, ROAD_W, AVENUES, STREETS, CAR, PALETTE } from './config.js';
import { clamp, dist, angleDiff, angleTo } from './random.js';

const HALF_ROAD = ROAD_W / 2;
let nextId = 1;

function laneOffset(axis, dir) {
  // Right-hand traffic: offset 20 to the right of the travel direction.
  if (axis === 'v') return dir > 0 ? 20 : -20;
  return dir > 0 ? 20 : -20;
}

export function createTraffic(city, rng, events) {
  const cars = [];
  const peds = [];
  const state = { playerCar: null };

  function makeCar(kind, x, y, angle, color) {
    return {
      id: nextId++, kind, x, y, angle, speed: 0, health: CAR.maxHealth,
      color: color || rng.pick(PALETTE.car), w: 46, h: 22,
      driver: kind === 'parked' ? 'none' : 'ai', taxi: false, siren: false,
      axis: 'v', dir: 1, target: null, stuck: 0, smoke: 0,
    };
  }
  function randomRoadPoint() {
    const p = city.nearestRoadPoint(rng.range(150, WORLD.w - 150), rng.range(150, WORLD.h - 150));
    return p;
  }
  function spawnTrafficCar(nearX, nearY) {
    const p = randomRoadPoint();
    // Keep spawns near the player but not on top of them.
    if (nearX !== undefined && dist(p.x, p.y, nearX, nearY) > 900) return null;
    const axis = p.axis;
    const dir = rng.chance(0.5) ? 1 : -1;
    const off = laneOffset(axis, dir);
    const x = axis === 'v' ? p.x + off : p.x;
    const y = axis === 'v' ? p.y : p.y + off;
    const angle = axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = makeCar('traffic', x, y, angle);
    car.axis = axis; car.dir = dir; car.speed = rng.range(90, 150);
    cars.push(car);
    return car;
  }
  function spawnParkedCar() {
    const spot = rng.pick(city.parking);
    if (!spot) return null;
    const car = makeCar('parked', spot.x, spot.y, spot.angle);
    cars.push(car);
    return car;
  }
  function spawnPed(nearX, nearY) {
    const p = randomRoadPoint();
    const off = (rng.chance(0.5) ? 1 : -1) * (HALF_ROAD + 14);
    const x = p.axis === 'v' ? p.x + off : p.x + rng.range(-120, 120);
    const y = p.axis === 'v' ? p.y + rng.range(-120, 120) : p.y + off;
    if (nearX !== undefined && dist(x, y, nearX, nearY) > 800) return null;
    peds.push({
      x, y, angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 52),
      state: 'walk', tx: x, ty: y, panic: 0, down: 0, wait: 0,
      shirt: rng.pick(['#e8e4da', '#d94f3d', '#3d7dd9', '#e8b73d', '#7fb069', '#c95d9b', '#5ec4c4', '#8a6f4d']),
      skin: rng.pick(['#f2c9a0', '#d9a06c', '#8a5a3b', '#e8b88a']),
    });
  }
  function ensurePopulation(px, py) {
    let n = 0;
    for (const c of cars) if (c.kind === 'traffic') n += 1;
    for (let i = n; i < 16; i += 1) spawnTrafficCar(px, py);
    for (let i = cars.filter((c) => c.kind === 'parked').length; i < 12; i += 1) spawnParkedCar();
    for (let i = peds.length; i < 22; i += 1) spawnPed(px, py);
  }
  function nearestCar(x, y, maxD) {
    let best = null, bestD = maxD;
    for (const c of cars) {
      if (c.kind === 'police') continue;
      const d = dist(x, y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }
  function damageCar(car, amount, byPlayer) {
    if (car.health <= 0) return;
    car.health -= amount;
    car.smoke = Math.max(car.smoke, amount > 20 ? 1 : 0.4);
    if (car.health <= 0) {
      car.health = 0;
      events.onExplode(car.x, car.y, byPlayer);
    }
  }
  function carAhead(car, look) {
    const fx = car.x + Math.cos(car.angle) * look, fy = car.y + Math.sin(car.angle) * look;
    for (const o of cars) {
      if (o === car || o.health <= 0) continue;
      if (dist(fx, fy, o.x, o.y) < 46) return o;
    }
    return null;
  }
  function updateTrafficCar(c, dt) {
    if (c.health <= 0) { c.speed = Math.max(0, c.speed - 200 * dt); return; }
    const axis = city.roadAxis(c.x, c.y);
    const atX = axis === 'x';
    if (atX && !c.turned) {
      // At an intersection: mostly straight, sometimes turn.
      c.turned = true;
      const roll = rng.next();
      if (roll < 0.3) {
        // Turn: switch axis, keep right-hand side.
        if (c.axis === 'v') {
          c.axis = 'h'; c.dir = c.angle > 0 ? 1 : -1; // heading east/west by sign of angle
          // Recompute from current heading: turning left/right from vertical.
          c.dir = rng.chance(0.5) ? 1 : -1;
        } else {
          c.axis = 'v'; c.dir = rng.chance(0.5) ? 1 : -1;
        }
        const off = laneOffset(c.axis, c.dir);
        if (c.axis === 'v') c.x = nearestAvenue(c.x) + off;
        else c.y = nearestStreet(c.y) + off;
      }
      // else straight on
    } else if (!atX) {
      c.turned = false;
    }
    const targetAngle = c.axis === 'v' ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
    c.angle += angleDiff(c.angle, targetAngle) * Math.min(1, 6 * dt);
    // Lane keeping: drift back toward the lane centre line.
    const lane = c.axis === 'v' ? nearestAvenue(c.x) + laneOffset('v', c.dir) : nearestStreet(c.y) + laneOffset('h', c.dir);
    if (c.axis === 'v') c.x += (lane - c.x) * Math.min(1, 2 * dt);
    else c.y += (lane - c.y) * Math.min(1, 2 * dt);
    const ahead = carAhead(c, 60);
    const want = ahead ? Math.max(0, ahead.speed - 20) : rng.range(95, 145);
    c.speed += clamp(want - c.speed, -260 * dt, 130 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    // World edge: turn around at the last road.
    if (c.x < 120 || c.x > WORLD.w - 120 || c.y < 120 || c.y > WORLD.h - 120) {
      c.dir *= -1;
      c.angle += Math.PI;
    }
    city.resolveCircle(c, 18);
  }
  function nearestAvenue(x) {
    let best = AVENUES[0], bd = Infinity;
    for (const a of AVENUES) { const d = Math.abs(a - x); if (d < bd) { bd = d; best = a; } }
    return best;
  }
  function nearestStreet(y) {
    let best = STREETS[0], bd = Infinity;
    for (const s of STREETS) { const d = Math.abs(s - y); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  function drivePlayerCar(car, ax, dt) {
    const throttle = -ax.y; // W/Up = forward
    const steer = ax.x;
    if (throttle > 0) car.speed += CAR.accel * dt;
    else if (throttle < 0) {
      if (car.speed > 10) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    } else {
      car.speed -= Math.sign(car.speed) * CAR.drag * 120 * dt;
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
    const steerAmount = steer * CAR.steer * clamp(Math.abs(car.speed) / 120, 0, 1) * (car.speed >= 0 ? 1 : -1);
    car.angle += steerAmount * dt * (car.speed >= 0 ? 1 : -1) * 0.9;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const before = { x: car.x, y: car.y };
    car.x = nx; car.y = ny;
    if (city.resolveCircle(car, 19)) {
      const hit = Math.abs(car.speed);
      if (hit > 120) {
        damageCar(car, hit * 0.04, false);
        events.onCrash(car.x, car.y, hit);
        car.speed *= -0.25;
      } else {
        car.speed *= 0.4;
      }
      car.x = before.x; car.y = before.y;
      city.resolveCircle(car, 19);
    }
  }
  function updatePeds(dt, threats) {
    for (const p of peds) {
      if (p.down > 0) { p.down -= dt; continue; }
      let threat = null, threatD = 130;
      for (const t of threats) {
        const d = dist(p.x, p.y, t.x, t.y);
        if (d < threatD) { threatD = d; threat = t; }
      }
      if (threat) {
        p.state = 'flee';
        p.panic = 1.5;
        const a = angleTo(threat.x, threat.y, p.x, p.y);
        p.x += Math.cos(a) * 150 * dt;
        p.y += Math.sin(a) * 150 * dt;
        p.angle = a;
      } else if (p.panic > 0) {
        p.panic -= dt;
        p.x += Math.cos(p.angle) * 90 * dt;
        p.y += Math.sin(p.angle) * 90 * dt;
      } else {
        if (dist(p.x, p.y, p.tx, p.ty) < 12 || p.wait > 0) {
          p.wait -= dt;
          if (p.wait <= 0) {
            const np = randomRoadPoint();
            p.tx = np.x; p.ty = np.y; p.wait = rng.range(0, 4);
          }
        } else {
          const a = angleTo(p.x, p.y, p.tx, p.ty);
          p.angle = a;
          p.x += Math.cos(a) * p.speed * dt;
          p.y += Math.sin(a) * p.speed * dt;
        }
      }
      city.resolveCircle(p, 8);
      p.x = clamp(p.x, 10, WORLD.w - 10);
      p.y = clamp(p.y, 10, WORLD.h - 10);
    }
  }
  function update(dt, player, ax, threats) {
    ensurePopulation(player.x, player.y);
    for (const c of cars) {
      if (c === state.playerCar) {
        drivePlayerCar(c, ax, dt);
      } else if (c.kind === 'traffic' && c.driver === 'ai') {
        updateTrafficCar(c, dt);
      }
      // Car-car collisions: push apart, damage on hard hits.
      for (const o of cars) {
        if (o === c || o.health <= 0 || c.health <= 0) continue;
        const d = dist(c.x, c.y, o.x, o.y);
        if (d < 40 && d > 0.01) {
          const push = (40 - d) / 2;
          const ux = (c.x - o.x) / d, uy = (c.y - o.y) / d;
          c.x += ux * push; c.y += uy * push;
          o.x -= ux * push; o.y -= uy * push;
          const rel = Math.abs(c.speed - o.speed);
          if (rel > 140) {
            damageCar(c, rel * 0.035, c === state.playerCar);
            damageCar(o, rel * 0.035, o === state.playerCar);
            events.onCrash((c.x + o.x) / 2, (c.y + o.y) / 2, rel);
          }
        }
      }
    }
    // Player car vs pedestrians.
    if (state.playerCar) {
      for (const p of peds) {
        if (p.down > 0) continue;
        if (dist(state.playerCar.x, state.playerCar.y, p.x, p.y) < 30 && Math.abs(state.playerCar.speed) > 60) {
          p.down = 3; p.state = 'down';
          events.onPedHit(p.x, p.y, true);
        }
      }
    }
    updatePeds(dt, threats);
    // Cull far-away traffic and peds so the streets stay alive near the player.
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      const c = cars[i];
      if (c === state.playerCar || c.kind === 'parked' || c.kind === 'police') continue;
      if (dist(c.x, c.y, player.x, player.y) > 1400) cars.splice(i, 1);
    }
    for (let i = peds.length - 1; i >= 0; i -= 1) {
      if (dist(peds[i].x, peds[i].y, player.x, player.y) > 1200) peds.splice(i, 1);
    }
  }
  return {
    cars, peds, state,
    ensurePopulation, nearestCar, damageCar, update,
    setPlayerCar(car) { state.playerCar = car; if (car) car.driver = 'player'; },
    addCar(car) { cars.push(car); return car; },
    makeCar,
    spawnParkedCar,
  };
}
