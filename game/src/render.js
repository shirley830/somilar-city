// Rendering: the city, the streets, the HUD and the screens. One job: drawing.
import { WORLD, PALETTE, SEA_X } from './config.js';
import { clamp, fmtMoney } from './random.js';
import { drawMinimap } from './minimap.js';

export const SCREEN_MENU = 'menu';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_BUSTED = 'busted';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const AVENUES = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400];
const STREETS = [200, 600, 1000, 1400, 1800, 2200];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let vw = 1280, vh = 720, dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = canvas.clientWidth || window.innerWidth;
    vh = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(vw * dpr);
    canvas.height = Math.floor(vh * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function ground(g, city) {
    g.fillStyle = PALETTE.grass;
    g.fillRect(0, 0, WORLD.w, WORLD.h);
    g.fillStyle = PALETTE.grassDry;
    g.globalAlpha = 0.25;
    for (let i = 0; i < 40; i += 1) {
      const px = (i * 977) % WORLD.w, py = (i * 571) % WORLD.h;
      g.fillRect(px, py, 180, 120);
    }
    g.globalAlpha = 1;
    g.fillStyle = PALETTE.sand;
    g.fillRect(3300, 0, SEA_X - 3300, WORLD.h);
    g.fillStyle = PALETTE.sea;
    g.fillRect(SEA_X, 0, 4000, WORLD.h); // run past the world edge: no grass past the sea
    g.fillStyle = PALETTE.seaDeep;
    for (let y = 60; y < WORLD.h; y += 180) g.fillRect(SEA_X + 40, y, WORLD.w - SEA_X - 40, 26);
    g.fillStyle = '#c9a06a';
    g.fillRect(3280, 0, 24, WORLD.h);
    for (const p of city.parks) {
      g.fillStyle = '#6fae5a';
      g.fillRect(p.x, p.y, p.w, p.h);
      g.strokeStyle = '#557f43'; g.lineWidth = 4;
      g.strokeRect(p.x, p.y, p.w, p.h);
    }
  }
  function roads(g) {
    g.fillStyle = PALETTE.kerb;
    for (const ax of AVENUES) g.fillRect(ax - 52, 0, 104, WORLD.h);
    for (const sy of STREETS) g.fillRect(0, sy - 52, WORLD.w, 104);
    g.fillStyle = PALETTE.road;
    for (const ax of AVENUES) g.fillRect(ax - 48, 0, 96, WORLD.h);
    for (const sy of STREETS) g.fillRect(0, sy - 48, WORLD.w, 96);
    g.fillStyle = PALETTE.roadLine;
    for (const ax of AVENUES) for (let y = 40; y < WORLD.h; y += 90) g.fillRect(ax - 2, y, 4, 44);
    for (const sy of STREETS) for (let x = 40; x < WORLD.w; x += 90) g.fillRect(x, sy - 2, 44, 4);
    g.fillStyle = 'rgba(232,228,218,0.85)';
    for (const ax of AVENUES.slice(0, -1)) {
      for (const sy of STREETS) {
        for (let i = -3; i <= 3; i += 1) g.fillRect(ax + i * 13 - 4, sy - 46, 8, 18);
      }
    }
  }
  function buildings(g, city) {
    for (const b of city.buildings) {
      g.fillStyle = 'rgba(20, 26, 38, 0.28)';
      g.fillRect(b.x + b.hgt * 0.25, b.y + b.hgt * 0.16, b.w, b.h);
      g.fillStyle = b.color;
      g.fillRect(b.x, b.y, b.w, b.h);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
      g.strokeRect(b.x, b.y, b.w, b.h);
      if (b.zone === 'downtown') {
        g.fillStyle = b.glass;
        const cols = Math.max(2, Math.floor(b.w / 22)), rows = Math.max(2, Math.floor(b.h / 22));
        for (let c = 0; c < cols; c += 1) for (let r = 0; r < rows; r += 1) {
          if ((c * 7 + r * 3) % 5 === 0) continue;
          g.fillRect(b.x + 6 + c * ((b.w - 12) / cols), b.y + 6 + r * ((b.h - 12) / rows), (b.w - 12) / cols - 5, (b.h - 12) / rows - 5);
        }
        g.fillStyle = b.roof;
        g.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.3, b.w * 0.16, b.h * 0.16);
      } else if (b.pitched) {
        g.fillStyle = b.roof;
        g.beginPath();
        g.moveTo(b.x, b.y); g.lineTo(b.x + b.w / 2, b.y - 10); g.lineTo(b.x + b.w, b.y);
        g.closePath(); g.fill();
        g.fillStyle = '#f2e6c9';
        g.fillRect(b.x + b.w / 2 - 6, b.y + b.h - 14, 12, 14);
      } else {
        g.fillStyle = 'rgba(255,255,255,0.16)';
        g.fillRect(b.x + 6, b.y + 6, b.w - 12, 8);
        g.fillStyle = '#e8d44d';
        for (let i = 0; i < 3; i += 1) g.fillRect(b.x + 10 + i * ((b.w - 20) / 3), b.y + b.h / 2 - 4, 10, 8);
      }
    }
  }
  function props(g, city) {
    for (const t of city.trees) {
      g.fillStyle = 'rgba(20,26,38,0.22)';
      g.beginPath(); g.ellipse(t.x + 8, t.y + 8, t.r + 4, (t.r + 4) * 0.5, 0, 0, Math.PI * 2); g.fill();
      if (t.palm) {
        g.strokeStyle = PALETTE.palmTrunk; g.lineWidth = 4;
        g.beginPath(); g.moveTo(t.x, t.y + 8); g.lineTo(t.x + 3, t.y - 6); g.stroke();
        g.fillStyle = PALETTE.palm;
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * Math.PI * 2 + 0.4;
          g.beginPath(); g.ellipse(t.x + 3 + Math.cos(a) * t.r, t.y - 6 + Math.sin(a) * t.r * 0.6, t.r, t.r * 0.42, a, 0, Math.PI * 2); g.fill();
        }
      } else {
        g.fillStyle = '#4d8a4f';
        g.beginPath(); g.arc(t.x, t.y, t.r, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#5da85f';
        g.beginPath(); g.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); g.fill();
      }
    }
    for (const p of city.props) {
      if (p.kind === 'lamp') {
        g.strokeStyle = '#2b2f36'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x, p.y - 16); g.stroke();
        g.fillStyle = '#ffd76a';
        g.beginPath(); g.arc(p.x, p.y - 18, 4, 0, Math.PI * 2); g.fill();
      } else if (p.kind === 'crate') {
        g.fillStyle = '#a8845c';
        g.fillRect(p.x, p.y, 26, 26);
        g.strokeStyle = '#7d5a3c'; g.lineWidth = 2;
        g.strokeRect(p.x, p.y, 26, 26);
      }
    }
  }
  function drawCar(g, c, isPlayer, time) {
    g.save();
    g.translate(c.x, c.y);
    g.rotate(c.angle);
    g.fillStyle = 'rgba(20,26,38,0.3)';
    g.fillRect(-c.w / 2 + 4, -c.h / 2 + 4, c.w, c.h);
    g.fillStyle = c.color;
    roundRect(g, -c.w / 2, -c.h / 2, c.w, c.h, 7);
    g.fill();
    if (c.kind === 'police') {
      g.fillStyle = PALETTE.policeBlue;
      g.fillRect(-c.w / 2 + 4, -c.h / 2, c.w - 8, 7);
      g.fillRect(-c.w / 2 + 4, c.h / 2 - 7, c.w - 8, 7);
      const on = Math.floor(time * 4) % 2 === 0;
      g.fillStyle = on ? '#ff3b30' : '#2f6bff';
      g.fillRect(-6, -c.h / 2 - 2, 12, 6);
      g.fillStyle = on ? '#2f6bff' : '#ff3b30';
      g.fillRect(-6, c.h / 2 - 4, 12, 6);
    }
    if (c.taxi) {
      g.fillStyle = '#111';
      g.fillRect(-8, -c.h / 2 - 4, 16, 6);
      g.fillStyle = '#f2c230';
      g.font = 'bold 5px ' + FONT;
      g.fillText('TAXI', -7, -c.h / 2 + 1);
    }
    if (c.gold) {
      g.strokeStyle = '#fff3b0'; g.lineWidth = 2;
      roundRect(g, -c.w / 2 + 2, -c.h / 2 + 2, c.w - 4, c.h - 4, 6); g.stroke();
    }
    g.fillStyle = '#1d2733';
    g.fillRect(-6, -c.h / 2 + 3, 14, c.h - 6);
    g.fillRect(c.w / 2 - 14, -c.h / 2 + 3, 8, c.h - 6);
    g.fillStyle = '#ffd76a';
    g.fillRect(c.w / 2 - 2, -c.h / 2 + 3, 3, 4);
    g.fillRect(c.w / 2 - 2, c.h / 2 - 7, 3, 4);
    g.fillStyle = '#ff3b30';
    g.fillRect(-c.w / 2, -c.h / 2 + 3, 3, 4);
    g.fillRect(-c.w / 2, c.h / 2 - 7, 3, 4);
    if (c.health < 55) {
      g.fillStyle = 'rgba(60,60,60,0.5)';
      g.beginPath(); g.arc(-c.w / 4, 0, 6 + Math.sin(time * 9) * 2, 0, Math.PI * 2); g.fill();
    }
    if (isPlayer) {
      g.strokeStyle = '#ffffff'; g.lineWidth = 2;
      roundRect(g, -c.w / 2 - 3, -c.h / 2 - 3, c.w + 6, c.h + 6, 9); g.stroke();
    }
    g.restore();
  }
  function drawPerson(g, x, y, angle, shirt, skin, down, isCop, isEnemy) {
    g.save();
    g.translate(x, y);
    if (down > 0) {
      g.rotate(angle + Math.PI / 2);
      g.fillStyle = shirt;
      g.beginPath(); g.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = skin;
      g.beginPath(); g.arc(12, 0, 5, 0, Math.PI * 2); g.fill();
      g.restore();
      return;
    }
    g.rotate(angle);
    g.fillStyle = 'rgba(20,26,38,0.25)';
    g.beginPath(); g.ellipse(2, 3, 11, 8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = isCop ? '#2456d6' : shirt;
    g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = skin;
    g.beginPath(); g.arc(4, 0, 6, 0, Math.PI * 2); g.fill();
    if (isEnemy) {
      g.strokeStyle = '#1d2733'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(8, 0); g.lineTo(20, 0); g.stroke();
    }
    if (isCop) {
      g.fillStyle = '#ffd76a';
      g.fillRect(-3, -12, 6, 3);
    }
    g.restore();
  }
  function drawWorld(g, s) {
    const cam = s.camera;
    g.save();
    g.scale(dpr, dpr);
    g.fillStyle = '#79a854';
    g.fillRect(0, 0, vw, vh);
    g.translate(vw / 2, vh / 2);
    g.scale(cam.zoom, cam.zoom);
    g.translate(-cam.x, -cam.y);
    ground(g, s.city);
    roads(g);
    buildings(g, s.city);
    props(g, s.city);
    const marker = s.missions.marker();
    if (marker) {
      const bob = Math.sin(s.time * 3) * 6;
      g.fillStyle = 'rgba(255,210,61,0.16)';
      g.fillRect(marker.x - 26, marker.y - 220, 52, 220);
      g.fillStyle = '#ffd23d';
      g.beginPath();
      g.moveTo(marker.x, marker.y - 52 + bob);
      g.lineTo(marker.x + 16, marker.y - 30 + bob);
      g.lineTo(marker.x, marker.y - 8 + bob);
      g.lineTo(marker.x - 16, marker.y - 30 + bob);
      g.closePath(); g.fill();
      g.strokeStyle = '#7a5b00'; g.lineWidth = 2; g.stroke();
    }
    for (const p of s.combat.pickups) {
      const bob = Math.sin(s.time * 4 + p.x) * 3;
      g.save(); g.translate(p.x, p.y + bob);
      if (p.kind === 'health') {
        g.fillStyle = '#fff'; g.fillRect(-9, -9, 18, 18);
        g.fillStyle = '#e5484d'; g.fillRect(-3, -7, 6, 14); g.fillRect(-7, -3, 14, 6);
      } else if (p.kind === 'ammo') {
        g.fillStyle = '#f2c230'; g.fillRect(-9, -7, 18, 14);
        g.fillStyle = '#111'; g.font = 'bold 9px ' + FONT; g.fillText('AMMO', -8, 3);
      } else if (p.kind === 'armor') {
        g.fillStyle = '#4d8dff';
        g.beginPath(); g.moveTo(0, -10); g.lineTo(9, -6); g.lineTo(9, 2); g.lineTo(0, 10); g.lineTo(-9, 2); g.lineTo(-9, -6); g.closePath(); g.fill();
      } else {
        g.fillStyle = '#7fb069';
        g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.font = 'bold 10px ' + FONT; g.fillText('$', -3, 4);
      }
      g.restore();
    }
    for (const p of s.missions.state.packages) {
      if (p.taken) continue;
      g.fillStyle = '#8a6f4d';
      g.fillRect(p.x - 8, p.y - 6, 16, 12);
      g.fillStyle = '#f2c230';
      g.fillRect(p.x - 8, p.y - 2, 16, 4);
    }
    for (const c of s.traffic.cars) drawCar(g, c, c === s.playerCar, s.time);
    for (const p of s.traffic.peds) drawPerson(g, p.x, p.y, p.angle, p.shirt, p.skin, p.down, false, false);
    for (const cop of s.police.cops) drawPerson(g, cop.x, cop.y, cop.angle, '', '#d9a06c', cop.down, true, false);
    for (const e of s.missions.state.enemies) drawPerson(g, e.x, e.y, e.angle, '#a33327', '#e8b88a', 0, false, true);
    if (!s.playerCar) {
      const p = s.player;
      drawPerson(g, p.x, p.y, p.angle, '#2f6bff', '#f2c9a0', 0, false, false);
      if (p.aiming) {
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(p.x, p.y);
        g.lineTo(p.x + Math.cos(p.angle) * 46, p.y + Math.sin(p.angle) * 46); g.stroke();
      }
    }
    g.strokeStyle = '#ffe9a3'; g.lineWidth = 3;
    for (const b of s.combat.bullets) {
      g.beginPath();
      g.moveTo(b.x - Math.cos(b.angle) * 10, b.y - Math.sin(b.angle) * 10);
      g.lineTo(b.x, b.y);
      g.stroke();
    }
    for (const e of s.combat.explosions) {
      const a = e.life / e.maxLife;
      const grad = g.createRadialGradient(e.x, e.y, 4, e.x, e.y, e.r);
      grad.addColorStop(0, 'rgba(255,240,170,' + a + ')');
      grad.addColorStop(0.5, 'rgba(255,140,50,' + (a * 0.85) + ')');
      grad.addColorStop(1, 'rgba(120,40,10,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(e.x, e.y, e.r, 0, Math.PI * 2); g.fill();
    }
    for (const f of s.combat.fx) {
      g.globalAlpha = Math.max(0, f.life / f.maxLife);
      g.fillStyle = f.color;
      g.fillRect(f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
    }
    g.globalAlpha = 1;
    g.restore();
    const wash = g.createLinearGradient(0, 0, vw, vh);
    wash.addColorStop(0, 'rgba(255,170,80,0.10)');
    wash.addColorStop(1, 'rgba(255,120,40,0.16)');
    g.fillStyle = wash;
    g.fillRect(0, 0, vw, vh);
    const vig = g.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.42, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.28)');
    g.fillStyle = vig;
    g.fillRect(0, 0, vw, vh);
  }
  function bar(g, x, y, w, h, frac, color) {
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(x, y, w, h);
    g.fillStyle = color;
    g.fillRect(x, y, w * clamp(frac, 0, 1), h);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1;
    g.strokeRect(x, y, w, h);
  }
  function drawHud(g, s) {
    g.save();
    g.scale(dpr, dpr);
    const p = s.player;
    const mmSize = 190;
    const taxi = s.missions.state.taxi;
    drawMinimap(g, s.city, { x: s.camera.x - s.camera.w / 2, y: s.camera.y - s.camera.h / 2, w: s.camera.w, h: s.camera.h },
      p, s.missions.marker(), s.police.cops, s.police.copCars,
      taxi ? (taxi.phase === 'ride' ? taxi.dest : taxi) : null,
      16, 16, mmSize);
    g.fillStyle = '#fff';
    g.font = 'bold 13px ' + FONT;
    g.fillText('SOLMAR', 16, 16 + mmSize * (WORLD.h / WORLD.w) + 26);
    const w = s.police.wanted();
    for (let i = 0; i < 5; i += 1) {
      g.fillStyle = i < w ? '#ffd23d' : 'rgba(255,255,255,0.25)';
      g.font = '26px ' + FONT;
      g.fillText('\u2605', vw - 40 - i * 30, 36);
    }
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(vw - 210, 48, 194, 20);
    g.fillStyle = '#fff'; g.font = '12px ' + FONT;
    g.fillText(w > 0 ? 'WANTED — lose the cops' : 'Clean — stay out of trouble', vw - 204, 62);
    const bx = vw - 230, by = vh - 96;
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(bx - 8, by - 8, 222, 88);
    g.fillStyle = '#fff'; g.font = 'bold 15px ' + FONT;
    g.fillText('HEALTH', bx, by + 12);
    bar(g, bx + 70, by + 2, 130, 12, p.health / 100, p.health > 30 ? '#7fb069' : '#e5484d');
    g.fillText('ARMOUR', bx, by + 32);
    bar(g, bx + 70, by + 22, 130, 12, p.armor / 100, '#4d8dff');
    g.font = 'bold 20px ' + FONT;
    g.fillStyle = '#7fb069';
    g.fillText(fmtMoney(p.cash), bx, by + 62);
    g.fillStyle = '#fff'; g.font = '13px ' + FONT;
    g.fillText('Ammo ' + p.ammo, bx + 100, by + 62);
    if (s.playerCar) {
      g.fillStyle = '#fff'; g.font = 'bold 26px ' + FONT;
      g.fillText(Math.round(Math.abs(s.playerCar.speed) * 0.22) + ' km/h', 16, vh - 40);
      g.font = '12px ' + FONT;
      g.fillText('E — exit car    H — horn', 16, vh - 16);
    }
    g.font = 'bold 15px ' + FONT;
    const obj = s.missions.objective();
    const ow = g.measureText(obj).width + 28;
    g.fillStyle = 'rgba(10,16,26,0.8)';
    g.fillRect((vw - ow) / 2, 12, ow, 30);
    g.fillStyle = '#ffd23d';
    g.fillText(obj, (vw - ow) / 2 + 14, 32);
    g.fillStyle = '#fff'; g.font = '13px ' + FONT;
    g.fillText(s.clockText, vw - 120, vh - 116);
    if (s.bannerT > 0 && s.banner) {
      g.globalAlpha = Math.min(1, s.bannerT);
      g.font = 'bold 22px ' + FONT;
      const bw = g.measureText(s.banner).width + 40;
      g.fillStyle = 'rgba(10,16,26,0.85)';
      g.fillRect((vw - bw) / 2, vh * 0.3, bw, 44);
      g.fillStyle = '#ffd23d';
      g.fillText(s.banner, (vw - bw) / 2 + 20, vh * 0.3 + 30);
      g.globalAlpha = 1;
    }
    if (!s.playerCar) {
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5;
      const mx = s.input.mouse.x, my = s.input.mouse.y;
      g.beginPath(); g.arc(mx, my, 9, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(mx - 13, my); g.lineTo(mx - 5, my); g.moveTo(mx + 5, my); g.lineTo(mx + 13, my);
      g.moveTo(mx, my - 13); g.lineTo(mx, my - 5); g.moveTo(mx, my + 5); g.lineTo(mx, my + 13); g.stroke();
    }
    g.restore();
  }
  function panel(g, title, lines, buttons) {
    g.save();
    g.scale(dpr, dpr);
    g.fillStyle = 'rgba(8,12,20,0.72)';
    g.fillRect(0, 0, vw, vh);
    const pw = Math.min(640, vw - 60);
    const ph = 150 + lines.length * 26 + buttons.length * 56;
    const px = (vw - pw) / 2, py = (vh - ph) / 2;
    g.fillStyle = 'rgba(14,20,32,0.95)';
    g.fillRect(px, py, pw, ph);
    g.strokeStyle = '#ffd23d'; g.lineWidth = 2;
    g.strokeRect(px, py, pw, ph);
    g.fillStyle = '#ffd23d';
    g.font = 'bold 34px ' + FONT;
    g.fillText(title, px + 28, py + 52);
    g.fillStyle = '#eef1f5';
    g.font = '15px ' + FONT;
    lines.forEach((ln, i) => g.fillText(ln, px + 28, py + 88 + i * 26));
    const rects = [];
    buttons.forEach((b, i) => {
      const by = py + 96 + lines.length * 26 + i * 56;
      const bw = pw - 56;
      g.fillStyle = i === 0 ? '#ffd23d' : 'rgba(255,255,255,0.14)';
      g.fillRect(px + 28, by, bw, 42);
      g.fillStyle = i === 0 ? '#111' : '#fff';
      g.font = 'bold 17px ' + FONT;
      g.fillText(b.label, px + 44, by + 27);
      rects.push({ x: px + 28, y: by, w: bw, h: 42, id: b.id });
    });
    g.restore();
    return rects;
  }
  function draw(s) {
    ctx.save();
    if (s.screen === SCREEN_PLAY || s.screen === SCREEN_PAUSE || s.screen === SCREEN_WASTED || s.screen === SCREEN_BUSTED) {
      drawWorld(ctx, s);
      if (s.screen === SCREEN_PLAY) drawHud(ctx, s);
    } else {
      const menuState = { ...s, camera: { x: 1800 + Math.sin(s.time * 0.05) * 500, y: 1300, w: 1400, h: 800, zoom: 0.75 } };
      drawWorld(ctx, menuState);
    }
    if (s.screen === SCREEN_MENU) {
      const hasSave = !!s.saveData;
      s.menuButtons = panel(ctx, 'SOLMAR', [
        'Sun, Sand & Sirens — an open-world crime story.',
        'Milo Kade is new in town. Vera Solano has work for him.',
        'WASD move / drive  •  Mouse aim, Click shoot  •  E enter car / interact',
        'F punch  •  R reload  •  Shift run  •  N next job  •  P pause  •  M mute',
        'Steal cars, take jobs, dodge the Solmar PD — and find all 10 hidden packages.',
      ], hasSave ? [
        { label: 'Continue — ' + fmtMoney(s.saveData.cash) + '  •  ' + s.saveData.missionsDone + ' jobs done', id: 'continue' },
        { label: 'New Game', id: 'new' },
      ] : [{ label: 'Start — New Game', id: 'new' }]);
    } else if (s.screen === SCREEN_PAUSE) {
      s.menuButtons = panel(ctx, 'PAUSED', [
        'Take a breath. Solmar waits.',
        'Progress saves when you finish a job.',
      ], [
        { label: 'Resume', id: 'resume' },
        { label: 'Save & Quit to Menu', id: 'quit' },
      ]);
    } else if (s.screen === SCREEN_WASTED) {
      s.menuButtons = panel(ctx, 'WASTED', [
        'Solmar General patched you up. That cost ' + fmtMoney(150) + '.',
        'Your current job failed — press N to retry it.',
      ], [{ label: 'Get back out there', id: 'respawn' }]);
    } else if (s.screen === SCREEN_BUSTED) {
      s.menuButtons = panel(ctx, 'BUSTED', [
        'The Solmar PD booked you, then let you go. That cost ' + fmtMoney(150) + '.',
        'Your current job failed — press N to retry it.',
      ], [{ label: 'Get back out there', id: 'respawn' }]);
    }
    ctx.restore();
  }
  return { draw, resize, size() { return { w: vw, h: vh, dpr }; } };
}
