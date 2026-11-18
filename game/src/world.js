// Solmar city generation: roads, blocks, buildings, props, zones, road graph.
// Deterministic from a seed. One job: the static city and its collision queries.
import { WORLD, ROAD_W, AVENUES, STREETS, SEA_X, PALETTE } from './config.js';
import { makeRng, clamp } from './random.js';

const HALF_ROAD = ROAD_W / 2;

function zoneAt(x, y) {
  if (x > 3050) return 'beach';
  if (y > 1750) return 'industrial';
  if (x >= 950 && x <= 2450 && y >= 550 && y <= 1450) return 'downtown';
  if (x >= 2650 && y >= 1650) return 'marina';
  return 'residential';
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const props = [];
  const trees = [];
  const parking = [];
  const parks = [];

  // Blocks sit between avenues and streets. Each block gets buildings, a park,
  // or stays open (plaza / lot), depending on its zone.
  for (let ai = 0; ai < AVENUES.length - 1; ai += 1) {
    for (let si = 0; si < STREETS.length - 1; si += 1) {
      const x0 = AVENUES[ai] + HALF_ROAD + 14;
      const x1 = AVENUES[ai + 1] - HALF_ROAD - 14;
      const y0 = STREETS[si] + HALF_ROAD + 14;
      const y1 = STREETS[si + 1] - HALF_ROAD - 14;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const zone = zoneAt(cx, cy);
      if (zone === 'beach') continue; // sand, palms, boardwalk — no buildings
      if (rng.chance(0.14)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 8; t += 1) {
          trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(9, 15), palm: false });
        }
        continue;
      }
      if (zone === 'downtown') {
        // 2x2 towers with a plaza gap.
        const cols = 2, rows = 2;
        const bw = (x1 - x0) / cols, bh = (y1 - y0) / rows;
        for (let c = 0; c < cols; c += 1) {
          for (let r = 0; r < rows; r += 1) {
            const bx = x0 + c * bw + 14, by = y0 + r * bh + 14;
            buildings.push({
              x: bx, y: by, w: bw - 28, h: bh - 28,
              hgt: rng.range(60, 170), color: rng.pick(PALETTE.downtown),
              glass: rng.pick(PALETTE.glass), zone, roof: '#3d4450',
            });
          }
        }
      } else if (zone === 'industrial') {
        buildings.push({
          x: x0 + 10, y: y0 + 30, w: x1 - x0 - 20, h: y1 - y0 - 60,
          hgt: rng.range(22, 34), color: rng.pick(PALETTE.warehouse), zone, roof: '#5d5347',
        });
        props.push({ kind: 'crate', x: x0 + 30, y: y1 - 40 });
        props.push({ kind: 'crate', x: x1 - 60, y: y1 - 40 });
      } else {
        // Residential: 4-6 houses with yards.
        const n = rng.int(4, 6);
        for (let i = 0; i < n; i += 1) {
          const hx = rng.range(x0 + 10, x1 - 90), hy = rng.range(y0 + 10, y1 - 80);
          buildings.push({
            x: hx, y: hy, w: rng.range(56, 84), h: rng.range(48, 70),
            hgt: rng.range(16, 26), color: rng.pick(PALETTE.house), zone,
            roof: rng.pick(['#b5533c', '#7d5a3c', '#4d5a6b']), pitched: true,
          });
          if (rng.chance(0.6)) trees.push({ x: hx + rng.range(-8, 90), y: hy + rng.range(-8, 76), r: rng.range(8, 12), palm: false });
        }
      }
    }
  }

  // Palm-lined beach boardwalk and avenue palms.
  for (let y = 120; y < WORLD.h - 120; y += 130) {
    trees.push({ x: 3360 + rng.range(-14, 14), y, r: rng.range(10, 14), palm: true });
  }
  for (const ax of [600, 1400, 2200, 3000]) {
    for (let y = 300; y < WORLD.h - 200; y += 420) {
      if (rng.chance(0.7)) trees.push({ x: ax + (rng.chance(0.5) ? -62 : 62), y, r: rng.range(9, 13), palm: true });
    }
  }
  // Street lamps at intersections.
  for (const ax of AVENUES) for (const sy of STREETS) {
    props.push({ kind: 'lamp', x: ax + HALF_ROAD + 6, y: sy - HALF_ROAD - 6 });
  }
  // Parked cars along roads.
  for (let i = 0; i < 46; i += 1) {
    const vertical = rng.chance(0.5);
    if (vertical) {
      const ax = rng.pick(AVENUES);
      parking.push({ x: ax + (rng.chance(0.5) ? -HALF_ROAD + 22 : HALF_ROAD - 22), y: rng.range(140, WORLD.h - 140), angle: rng.chance(0.5) ? -Math.PI / 2 : Math.PI / 2 });
    } else {
      const sy = rng.pick(STREETS);
      parking.push({ x: rng.range(140, WORLD.w - 140), y: sy + (rng.chance(0.5) ? -HALF_ROAD + 22 : HALF_ROAD - 22), angle: rng.chance(0.5) ? 0 : Math.PI });
    }
  }

  function onRoad(x, y) {
    if (x > SEA_X) return false;
    for (const ax of AVENUES) if (Math.abs(x - ax) < HALF_ROAD) return true;
    for (const sy of STREETS) if (Math.abs(y - sy) < HALF_ROAD) return true;
    return false;
  }
  function roadAxis(x, y) {
    // Returns 'v' if on a vertical avenue, 'h' if on a horizontal street, else null.
    let v = false, h = false;
    for (const ax of AVENUES) if (Math.abs(x - ax) < HALF_ROAD) v = true;
    for (const sy of STREETS) if (Math.abs(y - sy) < HALF_ROAD) h = true;
    if (v && h) return 'x'; // intersection
    if (v) return 'v';
    if (h) return 'h';
    return null;
  }
  function nearestRoadPoint(x, y) {
    let best = null, bestD = Infinity;
    for (const ax of AVENUES) {
      const d = Math.abs(x - ax);
      if (d < bestD) { bestD = d; best = { x: ax, y: clamp(y, 120, WORLD.h - 120), axis: 'v' }; }
    }
    for (const sy of STREETS) {
      const d = Math.abs(y - sy);
      if (d < bestD) { bestD = d; best = { x: clamp(x, 120, WORLD.w - 120), y: sy, axis: 'h' }; }
    }
    return best;
  }
  function collides(x, y, r) {
    if (x < r || y < r || x > WORLD.w - r || y > WORLD.h - r) return true;
    if (x > SEA_X - r) return true; // the sea
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  }
  function resolveCircle(e, r) {
    // Push a circle out of buildings and the sea; returns true if it moved.
    let moved = false;
    e.x = clamp(e.x, r, WORLD.w - r); e.y = clamp(e.y, r, WORLD.h - r);
    if (e.x > SEA_X - r) { e.x = SEA_X - r; moved = true; }
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      const nx = clamp(e.x, b.x, b.x + b.w), ny = clamp(e.y, b.y, b.y + b.h);
      const dx = e.x - nx, dy = e.y - ny, d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 === 0) { e.y = b.y - r; moved = true; continue; }
        const d = Math.sqrt(d2);
        e.x = nx + (dx / d) * r; e.y = ny + (dy / d) * r; moved = true;
      }
    }
    return moved;
  }

  return {
    buildings, props, trees, parking, parks, seed,
    zoneAt, onRoad, roadAxis, nearestRoadPoint, collides, resolveCircle,
  };
}
