// Procedural map generator.
//
// Layout follows a fixed *progression* with randomized geometry:
//
//   [START]  small locked room — everyone (imposters included) is trapped
//      │     together, so the imposters MUST help with the first tasks.
//      ▼  door A: opened by the start room's stations
//   [ HUB ]  big central area. Three locked doors lead off it:
//      ├──▶ door B → [KEY VAULT]  holds the physical key
//      ├──▶ door C → [CODE LAB]   holds the exit code
//      └──▶ door X → [EXIT]       final door, needs BOTH key and code
//                                 (plus the hub's own stations to power it)
//
// Doors B and C are unlocked by the hub's stations; the two side rooms give
// the imposters space to isolate people as the map opens up.
//
// Everything is derived from a numeric seed so the server and every client
// build byte-identical worlds from just {seed, themeId}.

const WALL_H = 3.6;
const T = 0.8; // wall thickness

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — same seed, same map, everywhere.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randRange = (rng, lo, hi) => lo + rng() * (hi - lo);
const randInt = (rng, lo, hi) => Math.floor(randRange(rng, lo, hi + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

const PUZZLE_TYPES = ['wires', 'keypad', 'simon', 'fuses', 'levers'];

const STATION_NAMES = {
  wires:  ['Connect Wires', 'Rewire Panel', 'Splice Cables', 'Patch Circuit'],
  keypad: ['Enter Access Code', 'Boot Terminal', 'Unlock Console', 'Type Passphrase'],
  simon:  ['Calibrate Sequencer', 'Sort Manifest', 'Match Pattern', 'Tune Resonator'],
  fuses:  ['Reset Fuses', 'Power Console', 'Balance Load', 'Restore Breakers'],
  levers: ['Align Levers', 'Unlock Valves', 'Set Gauges', 'Shift Rods'],
};

// Room name flavor per theme.
const ROOM_NAMES = {
  station: { start: 'Cryo Bay',    hub: 'Command Deck', key: 'Armory',    code: 'Data Core',  exit: 'Escape Airlock' },
  manor:   { start: 'Cellar',      hub: 'Grand Hall',   key: 'Study',     code: 'Library',    exit: 'Front Gate' },
  temple:  { start: 'Antechamber', hub: 'Great Court',  key: 'Idol Room', code: 'Glyph Hall', exit: 'Temple Gate' },
  arctic:  { start: 'Airlock Bay', hub: 'Main Lab',     key: 'Cold Store',code: 'Server Room',exit: 'Ice Tunnel' },
};

function wallX(x1, x2, z, h = WALL_H) { return { x: (x1 + x2) / 2, z, w: Math.abs(x2 - x1), d: T, h }; }
function wallZ(x, z1, z2, h = WALL_H) { return { x, z: (z1 + z2) / 2, w: T, d: Math.abs(z2 - z1), h }; }

// Build one wall run along an axis with a gap (doorway) centered at `gapAt`.
function wallWithGap(axis, fixed, from, to, gapAt, gapW) {
  const out = [];
  const a = Math.min(from, to), b = Math.max(from, to);
  const g0 = gapAt - gapW / 2, g1 = gapAt + gapW / 2;
  const mk = axis === 'x' ? wallX : wallZ;
  if (g0 - a > 0.1) out.push(axis === 'x' ? mk(a, g0, fixed) : mk(fixed, a, g0));
  if (b - g1 > 0.1) out.push(axis === 'x' ? mk(g1, b, fixed) : mk(fixed, g1, b));
  return out;
}

// A rectangular room: returns its walls (with doorways punched out) and bounds.
function roomWalls(room, doors) {
  const x0 = room.x - room.w / 2, x1 = room.x + room.w / 2;
  const z0 = room.z - room.d / 2, z1 = room.z + room.d / 2;
  const walls = [];
  const sideDoors = { north: null, south: null, west: null, east: null, ...doors };
  // north (z0) & south (z1) run along x; west (x0) & east (x1) run along z
  for (const [side, fixed, axis, from, to] of [
    ['north', z0, 'x', x0, x1], ['south', z1, 'x', x0, x1],
    ['west', x0, 'z', z0, z1], ['east', x1, 'z', z0, z1],
  ]) {
    const door = sideDoors[side];
    if (door) walls.push(...wallWithGap(axis, fixed, from, to, door.at, door.width));
    else walls.push(axis === 'x' ? wallX(from, to, fixed) : wallZ(fixed, from, to));
  }
  return walls;
}

/**
 * Generate a full map.
 * @param {number} seed
 * @param {string} themeId
 * @returns {object} map descriptor consumed by the server, renderer and bots
 */
export function generateMap(seed, themeId = 'station') {
  const rng = makeRng(seed);
  const names = ROOM_NAMES[themeId] || ROOM_NAMES.station;

  // ---- room geometry (randomized sizes, fixed topology) -------------------
  const startW = randRange(rng, 14, 20), startD = randRange(rng, 12, 16);
  const hubW = randRange(rng, 34, 44), hubD = randRange(rng, 26, 34);
  const sideW = randRange(rng, 16, 22), sideD = randRange(rng, 14, 20);
  const exitW = randRange(rng, 10, 14), exitD = randRange(rng, 8, 11);

  // The hub sits at the origin; start room hangs off its south side.
  const hub = { id: 'hub', kind: 'hub', name: names.hub, x: 0, z: 0, w: hubW, d: hubD };
  const start = {
    id: 'start', kind: 'start', name: names.start,
    x: randRange(rng, -hubW / 5, hubW / 5), z: hubD / 2 + startD / 2, w: startW, d: startD,
  };
  // Key & code rooms flank the hub (west/east), randomly assigned.
  const keyOnWest = rng() < 0.5;
  const keyRoom = {
    id: 'key', kind: 'key', name: names.key,
    x: (keyOnWest ? -1 : 1) * (hubW / 2 + sideW / 2), z: randRange(rng, -hubD / 6, hubD / 6),
    w: sideW, d: sideD,
  };
  const codeRoom = {
    id: 'code', kind: 'code', name: names.code,
    x: (keyOnWest ? 1 : -1) * (hubW / 2 + sideW / 2), z: randRange(rng, -hubD / 6, hubD / 6),
    w: sideW, d: sideD,
  };
  // Exit room off the hub's north side.
  const exitRoom = {
    id: 'exit', kind: 'exit', name: names.exit,
    x: randRange(rng, -hubW / 6, hubW / 6), z: -(hubD / 2 + exitD / 2), w: exitW, d: exitD,
  };
  const rooms = [start, hub, keyRoom, codeRoom, exitRoom];

  // ---- doors --------------------------------------------------------------
  // Each door is a physical slab that disappears when unlocked.
  const DOOR_W = 5;
  const doors = [
    {
      id: 'doorA', name: `${names.start} → ${names.hub}`, from: 'start', to: 'hub',
      x: start.x, z: hub.z + hubD / 2, w: DOOR_W, d: T, h: WALL_H,
      needs: { stations: 'start' },     // unlocked by all start-room stations
    },
    {
      id: 'doorB', name: `→ ${names.key}`, from: 'hub', to: 'key',
      x: keyRoom.x > 0 ? hubW / 2 : -hubW / 2, z: keyRoom.z, w: T, d: DOOR_W, h: WALL_H,
      vertical: true,
      needs: { stations: 'hub', part: 0 }, // first half of hub stations
    },
    {
      id: 'doorC', name: `→ ${names.code}`, from: 'hub', to: 'code',
      x: codeRoom.x > 0 ? hubW / 2 : -hubW / 2, z: codeRoom.z, w: T, d: DOOR_W, h: WALL_H,
      vertical: true,
      needs: { stations: 'hub', part: 1 }, // second half of hub stations
    },
    {
      id: 'doorX', name: `→ ${names.exit}`, from: 'hub', to: 'exit',
      x: exitRoom.x, z: -hubD / 2, w: DOOR_W, d: T, h: WALL_H,
      needs: { key: true, code: true },  // needs BOTH collectables
      final: true,
    },
  ];

  // ---- walls (doorways punched where doors sit) ---------------------------
  const walls = [];
  walls.push(...roomWalls(start, { north: { at: start.x, width: DOOR_W } }));
  walls.push(...roomWalls(hub, {
    south: { at: start.x, width: DOOR_W },
    north: { at: exitRoom.x, width: DOOR_W },
    west: { at: (keyRoom.x < 0 ? keyRoom.z : codeRoom.z), width: DOOR_W },
    east: { at: (keyRoom.x > 0 ? keyRoom.z : codeRoom.z), width: DOOR_W },
  }));
  walls.push(...roomWalls(keyRoom, keyRoom.x > 0
    ? { west: { at: keyRoom.z, width: DOOR_W } }
    : { east: { at: keyRoom.z, width: DOOR_W } }));
  walls.push(...roomWalls(codeRoom, codeRoom.x > 0
    ? { west: { at: codeRoom.z, width: DOOR_W } }
    : { east: { at: codeRoom.z, width: DOOR_W } }));
  walls.push(...roomWalls(exitRoom, { south: { at: exitRoom.x, width: DOOR_W } }));

  // ---- crates (cover / line-of-sight breakers) ----------------------------
  // Placed after stations/spawns are known so nothing gets walled in; see the
  // `crates` block further down.
  const crates = [];

  // ---- stations -----------------------------------------------------------
  // Placed around each room's perimeter, spread out so groups must split up.
  let stationN = 0;
  function placeStations(room, count, group, part) {
    const out = [];
    for (let i = 0; i < count; i++) {
      // Spread along a ring inside the room.
      const ang = (i / count) * Math.PI * 2 + rng() * 0.5;
      const rx = (room.w / 2 - 2.6) * Math.cos(ang);
      const rz = (room.d / 2 - 2.6) * Math.sin(ang);
      const type = pick(rng, PUZZLE_TYPES);
      out.push({
        id: `st${stationN++}`,
        type,
        name: pick(rng, STATION_NAMES[type]),
        x: room.x + rx, z: room.z + rz,
        room: room.name, roomId: room.id,
        group, part: part ?? null,
      });
    }
    return out;
  }

  const startStations = placeStations(start, randInt(rng, 3, 4), 'start');
  const hubCount = randInt(rng, 6, 8);
  const hubStations = [
    ...placeStations(hub, Math.ceil(hubCount / 2), 'hub', 0),
    ...placeStations(hub, Math.floor(hubCount / 2), 'hub', 1),
  ];
  // Side rooms hold a couple of optional stations plus their collectable.
  const keyStations = placeStations(keyRoom, randInt(rng, 1, 2), 'key');
  const codeStations = placeStations(codeRoom, randInt(rng, 1, 2), 'code');
  const stations = [...startStations, ...hubStations, ...keyStations, ...codeStations];

  // ---- collectables (the key and the code) --------------------------------
  const exitCode = String(randInt(rng, 1000, 9999));
  const collectables = [
    { id: 'key',  kind: 'key',  name: 'Exit Key',  roomId: 'key',
      x: keyRoom.x + randRange(rng, -3, 3), z: keyRoom.z + randRange(rng, -3, 3) },
    { id: 'code', kind: 'code', name: 'Exit Code', roomId: 'code', value: exitCode,
      x: codeRoom.x + randRange(rng, -3, 3), z: codeRoom.z + randRange(rng, -3, 3) },
  ];

  // The final terminal in the hub, next to the exit door: needs key + code.
  const exitTerminal = { x: exitRoom.x + randRange(rng, -4, 4), z: -hubD / 2 + 3.2 };

  // ---- bounds, spawns, meeting button, escape pad -------------------------
  const pad = 6;
  const allX = rooms.flatMap(r => [r.x - r.w / 2, r.x + r.w / 2]);
  const allZ = rooms.flatMap(r => [r.z - r.d / 2, r.z + r.d / 2]);
  const bounds = {
    minX: Math.min(...allX) - pad, maxX: Math.max(...allX) + pad,
    minZ: Math.min(...allZ) - pad, maxZ: Math.max(...allZ) + pad,
  };

  // Everyone spawns in the start room (locked in together).
  const spawnPoints = [];
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    spawnPoints.push({
      x: start.x + Math.cos(ang) * (start.w / 4),
      z: start.z + Math.sin(ang) * (start.d / 4),
    });
  }

  const meetingButton = { x: hub.x + randRange(rng, -4, 4), z: hub.z + randRange(rng, -4, 4) };
  const escapeZone = { x: exitRoom.x, z: exitRoom.z, r: 2.8 };

  // Now place crates, keeping clear of spawns, stations, doorways and the
  // interactables so nothing important is ever blocked in.
  const keepClear = [
    ...spawnPoints.map(p => ({ ...p, r: 3.0 })),
    ...stations.map(s => ({ ...s, r: 3.4 })),
    ...collectables.map(c => ({ ...c, r: 3.0 })),
    { ...exitTerminal, r: 4.0 },
    { ...meetingButton, r: 3.4 },
    { ...escapeZone, r: escapeZone.r + 2 },
    ...doors.map(d => ({ x: d.x, z: d.z, r: 5.0 })),
  ];
  for (const room of rooms) {
    // Small rooms stay uncluttered; the hub gets real cover.
    const n = room.kind === 'hub' ? randInt(rng, 4, 7) : room.kind === 'start' ? 1 : randInt(rng, 1, 2);
    for (let i = 0, tries = 0; i < n && tries < 40; tries++) {
      const s = randRange(rng, 1.4, 2.2);
      const x = room.x + randRange(rng, -room.w / 2 + 3.5, room.w / 2 - 3.5);
      const z = room.z + randRange(rng, -room.d / 2 + 3.5, room.d / 2 - 3.5);
      const blocked = keepClear.some(k => Math.hypot(k.x - x, k.z - z) < k.r + s / 2)
        || crates.some(c => Math.hypot(c.x - x, c.z - z) < (c.w + s) / 2 + 1.5);
      if (blocked) continue;
      crates.push({ x, z, w: s, d: s, h: randRange(rng, 1.2, 1.8), crate: true });
      i++;
    }
  }

  // ---- waypoint graph for bots -------------------------------------------
  const waypoints = {
    start: { x: start.x, z: start.z },
    startDoor: { x: start.x, z: hub.z + hubD / 2 - 1.5 },
    hub: { x: hub.x, z: hub.z },
    hubS: { x: start.x, z: hub.z + hubD / 2 - 4 },
    hubN: { x: exitRoom.x, z: -hubD / 2 + 4 },
    hubW: { x: -hubW / 2 + 4, z: (keyRoom.x < 0 ? keyRoom.z : codeRoom.z) },
    hubE: { x: hubW / 2 - 4, z: (keyRoom.x > 0 ? keyRoom.z : codeRoom.z) },
    key: { x: keyRoom.x, z: keyRoom.z },
    code: { x: codeRoom.x, z: codeRoom.z },
    exit: { x: exitRoom.x, z: exitRoom.z },
  };
  const waypointEdges = [
    ['start', 'startDoor'], ['startDoor', 'hubS'], ['hubS', 'hub'],
    ['hub', 'hubN'], ['hubN', 'exit'],
    ['hub', 'hubW'], ['hub', 'hubE'],
    [keyRoom.x < 0 ? 'hubW' : 'hubE', 'key'],
    [codeRoom.x < 0 ? 'hubW' : 'hubE', 'code'],
  ];
  // Each station gets a waypoint so bots can path to it.
  for (const st of stations) {
    waypoints[`st_${st.id}`] = { x: st.x, z: st.z };
    const anchor = st.roomId === 'start' ? 'start'
      : st.roomId === 'hub' ? 'hub'
      : st.roomId === 'key' ? 'key' : 'code';
    waypointEdges.push([anchor, `st_${st.id}`]);
  }

  return {
    seed, themeId,
    bounds, rooms, walls, crates, doors, stations, collectables,
    exitTerminal, exitCode, spawnPoints, meetingButton, escapeZone,
    waypoints, waypointEdges,
    wallHeight: WALL_H, thickness: T,
  };
}

// ---------------------------------------------------------------------------
// Collision: circle vs. all walls + crates + any still-locked doors.
export function collideWithWalls(map, pos, radius, openDoorIds) {
  const obstacles = [...map.walls, ...map.crates];
  for (const d of map.doors) {
    if (!openDoorIds.has(d.id)) obstacles.push(d);
  }
  for (const wall of obstacles) {
    const hw = wall.w / 2 + radius, hd = wall.d / 2 + radius;
    const dx = pos.x - wall.x, dz = pos.z - wall.z;
    if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
      const px = hw - Math.abs(dx), pz = hd - Math.abs(dz);
      if (px < pz) pos.x = wall.x + Math.sign(dx || 1) * hw;
      else pos.z = wall.z + Math.sign(dz || 1) * hd;
    }
  }
  const b = map.bounds, r = radius;
  pos.x = Math.max(b.minX + r, Math.min(b.maxX - r, pos.x));
  pos.z = Math.max(b.minZ + r, Math.min(b.maxZ - r, pos.z));
  return pos;
}

export function nearestWaypoint(map, x, z) {
  let best = null, bestD = Infinity;
  for (const [id, p] of Object.entries(map.waypoints)) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

// Which room contains a point (used for role/objective hints).
export function roomAt(map, x, z) {
  for (const r of map.rooms) {
    if (Math.abs(x - r.x) <= r.w / 2 && Math.abs(z - r.z) <= r.d / 2) return r;
  }
  return null;
}

// Can `a` see `b`? Slab-method segment test against every wall, crate and
// closed door. Used for the witness rule: you may only murder someone when
// nobody else can actually SEE you, rather than merely being nearby.
export function hasLineOfSight(map, a, b, openDoorIds = new Set()) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const obstacles = [...map.walls, ...map.crates];
  for (const d of map.doors) if (!openDoorIds.has(d.id)) obstacles.push(d);

  for (const o of obstacles) {
    const minX = o.x - o.w / 2, maxX = o.x + o.w / 2;
    const minZ = o.z - o.d / 2, maxZ = o.z + o.d / 2;
    let t0 = 0, t1 = 1, blocked = true;

    for (const [origin, delta, lo, hi] of [[a.x, dx, minX, maxX], [a.z, dz, minZ, maxZ]]) {
      if (Math.abs(delta) < 1e-9) {
        if (origin < lo || origin > hi) { blocked = false; break; } // parallel & outside
        continue;
      }
      let tA = (lo - origin) / delta;
      let tB = (hi - origin) / delta;
      if (tA > tB) { const tmp = tA; tA = tB; tB = tmp; }
      t0 = Math.max(t0, tA);
      t1 = Math.min(t1, tB);
      if (t0 > t1) { blocked = false; break; }
    }
    if (blocked) return false; // the segment crosses this obstacle
  }
  return true;
}
