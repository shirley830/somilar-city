// Solmar — configuration: world size, palette, tuning. One job: constants.
export const WORLD = { w: 3600, h: 2600 };
export const ROAD_W = 96;            // road width (kerb to kerb)
export const BLOCK = 400;             // road centre spacing
export const AVENUES = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400];
export const STREETS = [200, 600, 1000, 1400, 1800, 2200];
export const SEA_X = 3450;            // east of this is water

// Sun-soaked Solmar palette.
export const PALETTE = {
  grass: '#7fae5a', grassDry: '#a8b96a', sand: '#e8cf9a', sea: '#2e7fa8', seaDeep: '#1f5f86',
  road: '#3a3f47', roadLine: '#e8d44d', kerb: '#c9c2b4', sidewalk: '#b7ad9c',
  downtown: ['#5d6b7d', '#6b7a8d', '#4d5a6b', '#7d8aa0'],
  glass: ['#7fb2d9', '#8fc3e8', '#6aa5cf'],
  house: ['#e8a87c', '#f2c14e', '#d97b6c', '#a8c686', '#e6d5b8', '#c98bb9'],
  warehouse: ['#8a7f70', '#9c8f7d', '#7a6f63'],
  palm: '#3f7d44', palmTrunk: '#8a6f4d', roof: '#b5533c',
  car: ['#d94f3d', '#3d7dd9', '#e8b73d', '#e8e4da', '#2b2f36', '#7fb069', '#c95d9b', '#5ec4c4'],
  taxi: '#f2c230', policeCar: '#e8e8e8', policeBlue: '#2456d6',
};

export const PLAYER = {
  walkSpeed: 165, runSpeed: 265, radius: 14, maxHealth: 100, maxArmor: 100,
  punchDamage: 12, punchRange: 34, punchArc: 1.1,
};
export const GUN = { damage: 26, range: 520, fireRate: 0.16, magSize: 12, reloadTime: 1.1, spread: 0.05 };
export const CAR = {
  accel: 420, brake: 700, reverseAccel: 260, maxSpeed: 560, maxReverse: 160,
  steer: 2.6, grip: 3.2, drag: 0.55, radius: 20, maxHealth: 100,
};
export const WANTED = {
  decayDelay: 14, decayRate: 0.35, // stars fall when unseen
  crimeHeat: { stealCar: 1, hitPed: 1, killPed: 2, shoot: 0.5, killCop: 1, crash: 0.25 },
  maxCops: [0, 2, 3, 4, 6, 8],       // foot cops by wanted level
  maxCopCars: [0, 1, 2, 3, 4, 5],   // pursuit cars by wanted level
};
export const MONEY = { start: 250, taxiFare: 45, package: 150, respawnCost: 150 };
export const SAVE_KEY = 'solmar-save-v1';

// Named places in Solmar (all original).
export const PLACES = {
  safehouse: { x: 420, y: 1520, name: 'Milo\u2019s Safehouse' },
  hospital: { x: 1620, y: 420, name: 'Solmar General Hospital' },
  policeHQ: { x: 2380, y: 820, name: 'Solmar PD HQ' },
  marina: { x: 3220, y: 2020, name: 'Solmar Marina' },
  palmsHotel: { x: 1180, y: 820, name: 'The Palms Hotel' },
  verasOffice: { x: 1980, y: 1180, name: 'Vera\u2019s Office' },
  docks: { x: 820, y: 2020, name: 'Port Solmar Docks' },
  stadium: { x: 2820, y: 420, name: 'Solmar Arena' },
  sprayShop: { x: 620, y: 1180, name: 'Sunshine Spray Shop' },
  warehouse: { x: 1420, y: 2020, name: 'Bayview Warehouse' },
  casino: { x: 2380, y: 1620, name: 'Casino del Sol' },
  airport: { x: 420, y: 420, name: 'Solmar Airfield' },
};
