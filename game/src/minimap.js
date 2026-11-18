// Minimap: the whole city shrunk into a corner panel, with player, marker, cops
// and taxi fares plotted. One job: the small map.
import { WORLD, SEA_X } from './config.js';

export function drawMinimap(ctx, city, view, player, marker, cops, copCars, taxi, x, y, size) {
  const s = size / WORLD.w;
  ctx.save();
  ctx.translate(x, y);
  // Panel.
  ctx.fillStyle = 'rgba(10, 16, 26, 0.82)';
  ctx.fillRect(-6, -6, size + 12, size + 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-6, -6, size + 12, size + 12);
  ctx.beginPath();
  ctx.rect(0, 0, size, size * (WORLD.h / WORLD.w));
  ctx.clip();
  // Land, sea, parks.
  ctx.fillStyle = '#5d7d43';
  ctx.fillRect(0, 0, size, size * (WORLD.h / WORLD.w));
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(SEA_X * s, 0, size, size * (WORLD.h / WORLD.w));
  ctx.fillStyle = '#6fae5a';
  for (const p of city.parks) ctx.fillRect(p.x * s, p.y * s, p.w * s, p.h * s);
  // Roads.
  ctx.fillStyle = '#c9c2b4';
  const roadW = 96 * s;
  for (const ax of [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400]) {
    ctx.fillRect(ax * s - roadW / 2, 0, roadW, size * (WORLD.h / WORLD.w));
  }
  for (const sy of [200, 600, 1000, 1400, 1800, 2200]) {
    ctx.fillRect(0, sy * s - roadW / 2, size, roadW);
  }
  // Buildings.
  ctx.fillStyle = 'rgba(40, 48, 60, 0.85)';
  for (const b of city.buildings) ctx.fillRect(b.x * s, b.y * s, Math.max(1.5, b.w * s), Math.max(1.5, b.h * s));
  // Viewport rectangle.
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.strokeRect(view.x * s, view.y * s, view.w * s, view.h * s);
  // Taxi fare.
  if (taxi) {
    ctx.fillStyle = '#f2c230';
    ctx.beginPath(); ctx.arc(taxi.x * s, taxi.y * s, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Cops.
  ctx.fillStyle = '#4d8dff';
  for (const c of cops) { ctx.beginPath(); ctx.arc(c.x * s, c.y * s, 3, 0, Math.PI * 2); ctx.fill(); }
  for (const c of copCars) { ctx.beginPath(); ctx.arc(c.x * s, c.y * s, 3.5, 0, Math.PI * 2); ctx.fill(); }
  // Mission marker (pulsing diamond).
  if (marker) {
    const p = 3 + Math.sin(Date.now() / 200) * 1.2;
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.moveTo(marker.x * s, marker.y * s - p - 3);
    ctx.lineTo(marker.x * s + p, marker.y * s);
    ctx.lineTo(marker.x * s, marker.y * s + p + 3);
    ctx.lineTo(marker.x * s - p, marker.y * s);
    ctx.closePath(); ctx.fill();
  }
  // Player arrow.
  ctx.save();
  ctx.translate(player.x * s, player.y * s);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -4.5); ctx.lineTo(-5, 4.5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
}
