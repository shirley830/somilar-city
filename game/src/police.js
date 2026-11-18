// Wanted level and police response: heat from crimes, pursuit cars and foot cops,
// decay when the player stays out of sight, busted on contact. One job: the law.
import { WORLD, WANTED, PALETTE } from './config.js';
import { clamp, dist, angleTo, angleDiff } from './random.js';

export function createPolice(city, traffic, rng, events) {
  const cops = [];       // foot cops {x,y,angle,speed,shootCd,bustT}
  const copCars = [];    // pursuit cars (traffic car objects with kind 'police')
  const state = { heat: 0, unseen: 0, sirenHigh: false, sirenT: 0 };

  function wanted() { return Math.min(5, Math.floor(state.heat)); }
  function addHeat(amount, x, y) {
    state.heat = clamp(state.heat + amount, 0, 5.6);
    state.unseen = 0;
    events.onWantedChange(wanted());
  }
  function spawnCop(px, py) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(500, 700);
    cops.push({
      x: clamp(px + Math.cos(a) * d, 40, WORLD.w - 40),
      y: clamp(py + Math.sin(a) * d, 40, WORLD.h - 40),
      angle: 0, speed: 175, shootCd: rng.range(0.5, 1.5), bustT: 0, down: 0,
    });
  }
  function spawnCopCar(px, py) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(600, 850);
    const x = clamp(px + Math.cos(a) * d, 120, WORLD.w - 120);
    const y = clamp(py + Math.sin(a) * d, 120, WORLD.h - 120);
    const near = city.nearestRoadPoint(x, y);
    const car = traffic.makeCar('police', near.x, near.y, 0, PALETTE.policeCar);
    car.driver = 'police'; car.siren = true; car.speed = 0;
    traffic.addCar(car);
    copCars.push(car);
    return car;
  }
  function ensureForce(px, py) {
    const w = wanted();
    const wantCops = WANTED.maxCops[w];
    const wantCars = WANTED.maxCopCars[w];
    while (cops.length < wantCops) spawnCop(px, py);
    while (copCars.length < wantCars) spawnCopCar(px, py);
    // Trim the force when the heat falls.
    while (cops.length > wantCops) cops.pop();
    while (copCars.length > wantCars) {
      const c = copCars.pop();
      const i = traffic.cars.indexOf(c);
      if (i >= 0) traffic.cars.splice(i, 1);
    }
  }
  function updateCopCars(dt, player, playerCar) {
    const target = playerCar || player;
    for (const c of copCars) {
      if (c.health <= 0) continue;
      const a = angleTo(c.x, c.y, target.x, target.y);
      const d = dist(c.x, c.y, target.x, target.y);
      c.angle += clamp(angleDiff(c.angle, a), -2.4 * dt, 2.4 * dt);
      const wantSpeed = d > 90 ? 430 + wanted() * 22 : 180;
      c.speed += clamp(wantSpeed - c.speed, -320 * dt, 260 * dt);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      city.resolveCircle(c, 19);
      // Ram the player's car.
      if (playerCar && d < 46) {
        traffic.damageCar(playerCar, 8 * dt, false);
        events.onCrash(c.x, c.y, Math.abs(c.speed));
        c.speed *= 0.5;
      }
    }
  }
  function updateCops(dt, player, playerCar) {
    const w = wanted();
    for (let i = cops.length - 1; i >= 0; i -= 1) {
      const cop = cops[i];
      if (cop.down > 0) { cop.down -= dt; if (cop.down <= 0) cops.splice(i, 1); continue; }
      const target = playerCar || player;
      const d = dist(cop.x, cop.y, player.x, player.y);
      const a = angleTo(cop.x, cop.y, target.x, target.y);
      cop.angle = a;
      if (playerCar) {
        // Cops chase the car on foot, shooting at its tyres when close.
        if (d < 420) {
          cop.x += Math.cos(a) * cop.speed * dt;
          cop.y += Math.sin(a) * cop.speed * dt;
        }
      } else {
        cop.x += Math.cos(a) * cop.speed * dt;
        cop.y += Math.sin(a) * cop.speed * dt;
        if (d < 26) {
          cop.bustT += dt;
          if (cop.bustT > 1.1) { events.onBusted(); return; }
        } else cop.bustT = 0;
      }
      city.resolveCircle(cop, 10);
      // Shoot at the player when wanted is 2+ and in range.
      if (w >= 2 && d < 380 && d > 40) {
        cop.shootCd -= dt;
        if (cop.shootCd <= 0) {
          cop.shootCd = rng.range(0.7, 1.4);
          events.onCopShoot(cop.x, cop.y, a + rng.range(-0.12, 0.12));
        }
      }
    }
  }
  function update(dt, player, playerCar) {
    const w = wanted();
    state.sirenT += dt;
    if (state.sirenT > 0.45) { state.sirenT = 0; state.sirenHigh = !state.sirenHigh; events.onSiren(state.sirenHigh, w > 0); }
    if (w > 0) {
      // Seen if any cop or cop car is near; otherwise the heat slowly cools.
      let seen = false;
      for (const c of cops) if (dist(c.x, c.y, player.x, player.y) < 520) seen = true;
      for (const c of copCars) if (dist(c.x, c.y, player.x, player.y) < 620) seen = true;
      if (seen) state.unseen = 0;
      else {
        state.unseen += dt;
        if (state.unseen > WANTED.decayDelay) {
          state.heat = Math.max(0, state.heat - WANTED.decayRate * dt);
        }
      }
      ensureForce(player.x, player.y);
      updateCopCars(dt, player, playerCar);
      updateCops(dt, player, playerCar);
    } else {
      // No heat: clear the force.
      while (cops.length) cops.pop();
      while (copCars.length) {
        const c = copCars.pop();
        const i = traffic.cars.indexOf(c);
        if (i >= 0) traffic.cars.splice(i, 1);
      }
    }
  }
  return {
    cops, copCars, state,
    wanted, addHeat, update,
    clearWanted() { state.heat = 0; state.unseen = 0; events.onWantedChange(0); },
  };
}
