// Shared map layout — the "Facility". Used by the client to build the 3D world
// and by the server for bot navigation, spawns and collision.
//
// Coordinates are top-down: x → east, z → south. Walls are AABBs given by
// center (x, z), size (w along x, d along z) and height h.

const WALL_H = 3.6;
const T = 0.8; // wall thickness

// Helper: wall segment from (x1,z1) to (x2,z2) along an axis.
function wallX(x1, x2, z, h = WALL_H) { // runs along x
  return { x: (x1 + x2) / 2, z, w: Math.abs(x2 - x1), d: T, h };
}
function wallZ(x, z1, z2, h = WALL_H) { // runs along z
  return { x, z: (z1 + z2) / 2, w: T, d: Math.abs(z2 - z1), h };
}
function crate(x, z, s = 1.6, h = 1.3) {
  return { x, z, w: s, d: s, h, crate: true };
}

export const MAP = {
  bounds: { minX: -38, maxX: 38, minZ: -34, maxZ: 28 },
  floorColor: '#8a9bb0',

  rooms: [
    { id: 'hub',      name: 'Central Hub', x: 0,   z: 0,   w: 24, d: 20, color: '#b8c4d4' },
    { id: 'lab',      name: 'Laboratory',  x: 0,   z: -22, w: 28, d: 12, color: '#a8d8c8' },
    { id: 'generator',name: 'Generator',   x: -29, z: 0,   w: 18, d: 24, color: '#e8c9a0' },
    { id: 'security', name: 'Security',    x: 29,  z: 0,   w: 18, d: 24, color: '#d4a8a8' },
    { id: 'storage',  name: 'Storage',     x: 0,   z: 22,  w: 28, d: 12, color: '#c8b8e0' },
    { id: 'airlock',  name: 'Escape Airlock', x: 0, z: -31, w: 8, d: 6, color: '#9adba8' },
  ],

  walls: [
    // Outer perimeter
    wallX(-38, 38, -34), wallX(-38, 38, 28), wallZ(-38, -34, 28), wallZ(38, -34, 28),

    // Central Hub — doors (4 wide) on all four sides
    wallX(-12, -2, -10), wallX(2, 12, -10),
    wallX(-12, -2, 10),  wallX(2, 12, 10),
    wallZ(-12, -10, -2), wallZ(-12, 2, 10),
    wallZ(12, -10, -2),  wallZ(12, 2, 10),

    // Laboratory (north) — south door to hub corridor, north gate to airlock
    wallX(-14, -2, -16), wallX(2, 14, -16),
    wallZ(-14, -28, -16), wallZ(14, -28, -16),
    wallX(-14, -3, -28), wallX(3, 14, -28),

    // Escape Airlock walls
    wallZ(-4, -34, -28), wallZ(4, -34, -28),

    // Generator (west) — east door
    wallZ(-20, -12, -2), wallZ(-20, 2, 12),
    wallX(-38, -20, -12), wallX(-38, -20, 12),

    // Security (east) — west door
    wallZ(20, -12, -2), wallZ(20, 2, 12),
    wallX(20, 38, -12), wallX(20, 38, 12),

    // Storage (south) — north door
    wallX(-14, -2, 16), wallX(2, 14, 16),
    wallZ(-14, 16, 28), wallZ(14, 16, 28),

    // Crates & props for cover
    crate(-8, -6), crate(8, 6), crate(-26, -9, 2.0), crate(-33, 8, 2.0),
    crate(26, 9, 2.0), crate(33, -8, 2.0), crate(-10, -25, 1.8), crate(11, -19, 1.8),
    crate(-11, 25, 1.8), crate(10, 19, 1.8), crate(-16, -14, 1.8), crate(17, 13, 1.8),
  ],

  // The escape gate: blocks the airlock until tasks hit 100%.
  escapeDoor: { x: 0, z: -28, w: 6, d: T, h: WALL_H },
  escapeZone: { x: 0, z: -31.5, r: 2.6 },

  meetingButton: { x: 0, z: 0 },

  // Puzzle stations. type ∈ wires | keypad | simon | fuses | levers
  stations: [
    { id: 'gen_fuses',  type: 'fuses',  name: 'Reset Fuses',       x: -33, z: -6,  room: 'Generator' },
    { id: 'gen_levers', type: 'levers', name: 'Align Levers',      x: -33, z: 6,   room: 'Generator' },
    { id: 'lab_wires',  type: 'wires',  name: 'Connect Wires',     x: -9,  z: -27, room: 'Laboratory' },
    { id: 'lab_simon',  type: 'simon',  name: 'Calibrate Sequencer', x: 9, z: -27, room: 'Laboratory' },
    { id: 'sec_keypad', type: 'keypad', name: 'Enter Access Code', x: 33,  z: -6,  room: 'Security' },
    { id: 'sec_wires',  type: 'wires',  name: 'Rewire Cameras',    x: 33,  z: 6,   room: 'Security' },
    { id: 'sto_levers', type: 'levers', name: 'Unlock Valves',     x: -9,  z: 27,  room: 'Storage' },
    { id: 'sto_simon',  type: 'simon',  name: 'Sort Manifest',     x: 9,   z: 27,  room: 'Storage' },
    { id: 'hub_keypad', type: 'keypad', name: 'Boot Terminal',     x: -11, z: 8,   room: 'Central Hub' },
    { id: 'hub_fuses',  type: 'fuses',  name: 'Power Console',     x: 11,  z: -8,  room: 'Central Hub' },
  ],

  spawnPoints: [
    { x: -3, z: -3 }, { x: 3, z: -3 }, { x: -3, z: 3 }, { x: 3, z: 3 },
    { x: 0, z: -5 }, { x: 0, z: 5 }, { x: -5, z: 0 }, { x: 5, z: 0 },
    { x: -5, z: -5 }, { x: 5, z: 5 },
  ],

  // Waypoint graph for bot navigation.
  waypoints: {
    hub:     { x: 0, z: 0 },
    hubNW:   { x: -11, z: 8 },
    hubSE:   { x: 11, z: -8 },
    hubN:    { x: 0, z: -13 },
    hubS:    { x: 0, z: 13 },
    hubW:    { x: -16, z: 0 },
    hubE:    { x: 16, z: 0 },
    lab:     { x: 0, z: -22 },
    labW:    { x: -9, z: -25 },
    labE:    { x: 9, z: -25 },
    airlock: { x: 0, z: -31 },
    gen:     { x: -29, z: 0 },
    genN:    { x: -32, z: -6 },
    genS:    { x: -32, z: 6 },
    sec:     { x: 29, z: 0 },
    secN:    { x: 32, z: -6 },
    secS:    { x: 32, z: 6 },
    sto:     { x: 0, z: 22 },
    stoW:    { x: -9, z: 25 },
    stoE:    { x: 9, z: 25 },
  },
  waypointEdges: [
    ['hub', 'hubN'], ['hub', 'hubS'], ['hub', 'hubW'], ['hub', 'hubE'],
    ['hub', 'hubNW'], ['hub', 'hubSE'],
    ['hubN', 'lab'], ['lab', 'labW'], ['lab', 'labE'], ['lab', 'airlock'],
    ['hubW', 'gen'], ['gen', 'genN'], ['gen', 'genS'],
    ['hubE', 'sec'], ['sec', 'secN'], ['sec', 'secS'],
    ['hubS', 'sto'], ['sto', 'stoW'], ['sto', 'stoE'],
  ],
};

// Closest waypoint id to a position (used by bots to re-enter the graph).
export function nearestWaypoint(x, z) {
  let best = null, bestD = Infinity;
  for (const [id, p] of Object.entries(MAP.waypoints)) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

// Circle-vs-wall collision resolution shared by client (players) and server (bots).
export function collideWithWalls(pos, radius, doorOpen) {
  const obstacles = doorOpen ? MAP.walls : MAP.walls.concat([MAP.escapeDoor]);
  for (const wall of obstacles) {
    const hw = wall.w / 2 + radius, hd = wall.d / 2 + radius;
    const dx = pos.x - wall.x, dz = pos.z - wall.z;
    if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
      const px = hw - Math.abs(dx), pz = hd - Math.abs(dz);
      if (px < pz) pos.x = wall.x + Math.sign(dx || 1) * hw;
      else pos.z = wall.z + Math.sign(dz || 1) * hd;
    }
  }
  const b = MAP.bounds, r = radius + T / 2;
  pos.x = Math.max(b.minX + r, Math.min(b.maxX - r, pos.x));
  pos.z = Math.max(b.minZ + r, Math.min(b.maxZ - r, pos.z));
  return pos;
}
