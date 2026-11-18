// Combat: bullets, explosions, pickups and particles. One job: things that go bang.
import { GUN } from './config.js';
import { dist } from './random.js';

export function createCombat(events) {
  const bullets = [];
  const explosions = [];
  const pickups = [];
  const fx = []; // particles {x,y,vx,vy,life,maxLife,color,size,grav}

  function spawnFx(x, y, color, n, speed, size, life) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.5), maxLife: life, color, size: size * (0.6 + Math.random() * 0.8), grav: 0 });
    }
  }
  function fireBullet(x, y, angle, opts) {
    const o = opts || {};
    bullets.push({
      x, y, angle: angle + (o.spread ? (Math.random() - 0.5) * o.spread * 2 : 0),
      speed: o.speed || 900, damage: o.damage || GUN.damage,
      from: o.from || 'player', life: (o.range || GUN.range) / (o.speed || 900),
    });
    spawnFx(x + Math.cos(angle) * 22, y + Math.sin(angle) * 22, '#ffd76a', 3, 120, 3, 0.12);
  }
  function explode(x, y, radius, damage) {
    explosions.push({ x, y, r: 12, maxR: radius, life: 0.5, maxLife: 0.5, damage });
    spawnFx(x, y, '#ff9a3d', 26, 320, 5, 0.6);
    spawnFx(x, y, '#3a3f47', 16, 120, 7, 1.1);
    spawnFx(x, y, '#ffd76a', 12, 480, 4, 0.3);
    events.onExplosion(x, y, radius, damage);
  }
  function spawnPickup(kind, x, y, amount) {
    pickups.push({ kind, x, y, amount: amount || 0, t: 0 });
  }
  function updateBullets(dt, city, targets) {
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      if (!dead && city.collides(b.x, b.y, 2)) {
        spawnFx(b.x, b.y, '#e8d44d', 4, 140, 2, 0.2);
        dead = true;
      }
      if (!dead) {
        // Hit tests, in order: player, cars, peds, cops, enemies.
        const t = targets;
        if (b.from !== 'player' && t.player && dist(b.x, b.y, t.player.x, t.player.y) < 15) {
          events.onPlayerDamage(b.damage, b.x, b.y);
          dead = true;
        } else if (b.from === 'player') {
          for (const c of t.cars) {
            if (c.health > 0 && dist(b.x, b.y, c.x, c.y) < 24) {
              events.onCarShot(c, b.damage);
              spawnFx(b.x, b.y, '#e8e4da', 4, 140, 2, 0.2);
              dead = true; break;
            }
          }
          if (!dead) for (const p of t.peds) {
            if (p.down <= 0 && dist(b.x, b.y, p.x, p.y) < 13) {
              events.onPedShot(p, b.damage);
              dead = true; break;
            }
          }
          if (!dead) for (const cop of t.cops) {
            if (cop.down <= 0 && dist(b.x, b.y, cop.x, cop.y) < 14) {
              events.onCopShot(cop, b.damage);
              dead = true; break;
            }
          }
          if (!dead) for (const e of t.enemies) {
            if (e.health > 0 && dist(b.x, b.y, e.x, e.y) < 15) {
              events.onEnemyShot(e, b.damage);
              dead = true; break;
            }
          }
        } else if (b.from === 'cop') {
          // Cop bullets can also hit the player's car.
          if (t.playerCar && t.playerCar.health > 0 && dist(b.x, b.y, t.playerCar.x, t.playerCar.y) < 24) {
            events.onCarShot(t.playerCar, b.damage);
            dead = true;
          }
        }
      }
      if (dead) bullets.splice(i, 1);
    }
  }
  function update(dt, city, targets) {
    updateBullets(dt, city, targets);
    for (let i = explosions.length - 1; i >= 0; i -= 1) {
      const e = explosions[i];
      e.life -= dt;
      e.r = e.maxR * (1 - e.life / e.maxLife);
      if (e.life <= 0) explosions.splice(i, 1);
    }
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      const p = pickups[i];
      p.t += dt;
      if (targets.player && dist(p.x, p.y, targets.player.x, targets.player.y) < 26) {
        events.onPickup(p);
        pickups.splice(i, 1);
      } else if (p.t > 60) pickups.splice(i, 1);
    }
    for (let i = fx.length - 1; i >= 0; i -= 1) {
      const f = fx[i];
      f.life -= dt;
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.vx *= 0.96; f.vy *= 0.96;
      if (f.life <= 0) fx.splice(i, 1);
    }
  }
  return { bullets, explosions, pickups, fx, fireBullet, explode, spawnPickup, spawnFx, update };
}
