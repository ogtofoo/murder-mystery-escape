// The Gnome's Ice Lair: a secret cave the Garden Gnome runs home to. Follow
// him and you find the way in. Inside, the garden's MEGA bosses charge you in
// waves against the clock, and every wave you clear pays out big.

import * as THREE from 'three';
import { BUGS_BY_ID, bossOf } from './data.js';

export const CAVE_ORIGIN = { x: 0, z: -460 };   // far enough out that fog hides it from the garden
export const CAVE_RADIUS = 30;                  // how far you can walk from the middle of the arena
export const MOUTH = { x: -41, z: -41 };        // the rocky mound in the garden the gnome runs to
export const MOUTH_RANGE = 4.5;                 // stand this close to go in
export const FOLLOW_RANGE = 22;                 // how close you must be while the gnome is at his door
export const WAVE_SECONDS = 75;                 // clock per wave
export const BITE_PENALTY = 4;                  // seconds a boss bite knocks off the clock
export const BREAK_SECONDS = 4;                 // breather between waves
export const CAVE_COOLDOWN = 20 * 60 * 1000;    // ms before the lair opens again after a full clear
export const CAVE_RETRY = 8 * 60 * 1000;        // ms after leaving early or freezing out

/** A boss that only lives down here: a Titan Weevil gone blue with cold. */
export const FROST_TITAN = (() => {
  const t = bossOf(BUGS_BY_ID.titan);
  return { ...t, id: 'boss_frost', name: 'FROST TITAN', hp: t.hp * 3, size: t.size * 1.25,
           speed: t.speed * 1.15, color: 0x9fe8ff, bounty: t.bounty * 3, frost: true };
})();

/** Each wave: which bosses come out. Every one but the last is a MEGA bug you know from raids. */
export const WAVES = [
  ['aphid'],
  ['spider', 'aphid'],
  ['locust', 'spider'],
  ['scorp', 'beetle'],
  ['mantis', 'spitter'],
  ['titan', 'scorp'],
  ['frost', 'spitter', 'spider'],
];

/** Levels never stop: health and bounty both climb forever, level by level. */
export const HP_PER_LEVEL = 1.3;
export const PAY_PER_LEVEL = 1.45;

export function waveSpec(id, depth) {
  const base = id === 'frost' ? FROST_TITAN : bossOf(BUGS_BY_ID[id]);
  const scale = Math.pow(HP_PER_LEVEL, depth);
  return { ...base, hp: Math.round(base.hp * scale),
           bounty: Math.round(base.bounty * Math.pow(PAY_PER_LEVEL, depth)) };
}

/**
 * Sheckles for clearing a wave. Scales with what you've earned so it is always
 * a windfall, and doubles every wave so the deep waves are the prize.
 */
export function waveReward(wave, earned, depth) {
  const base = Math.max(20000, earned / 2000);
  return Math.floor(base * wave * Math.pow(2, wave - 1) * Math.pow(PAY_PER_LEVEL, depth));
}

export function goldenReward(depth) { return 10 + 5 * depth; }

/** Clear this level and the lair hands over a rideable Frost Wyrm. */
export const MOUNT_LEVEL = 20;

/** Direction from the cave mouth toward the middle of the garden. */
const FACING = Math.atan2(-MOUTH.x, -MOUTH.z);

function flat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, ...extra });
}

/** Jitter a geometry's vertices so smooth shapes look hewn from rock. */
function roughen(geo, amount) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i,
      pos.getX(i) + (Math.random() - 0.5) * amount,
      pos.getY(i) + (Math.random() - 0.5) * amount,
      pos.getZ(i) + (Math.random() - 0.5) * amount);
  }
  geo.computeVertexNormals();
  return geo;
}

function crystal(mat, h, r = h * 0.28) {
  const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), mat);
  c.position.y = h / 2;
  c.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
  return c;
}

// ---------------------------------------------------------------- the mouth in the garden

/**
 * A rocky mound out by the hills. Until the gnome shows you the way it is
 * just a boulder; afterwards the boulder is rolled aside and the hole glows.
 */
export function buildMouth(scene, found) {
  const g = new THREE.Group();
  g.position.set(MOUTH.x, 0, MOUTH.z);
  scene.add(g);

  const rockMat = flat(0x6d7f8c);
  const mound = new THREE.Mesh(roughen(new THREE.SphereGeometry(9, 10, 7), 0.9), rockMat);
  mound.position.y = -2.5;
  mound.scale.set(1, 0.7, 1);
  mound.castShadow = true;
  mound.receiveShadow = true;
  g.add(mound);

  // The opening faces the garden.
  const sin = Math.sin(FACING), cos = Math.cos(FACING);
  const holeLocal = new THREE.Vector3(sin * 7.6, 1.5, cos * 7.6);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(2.4, 18),
    new THREE.MeshBasicMaterial({ color: 0x06121f }));
  hole.position.copy(holeLocal);
  hole.rotation.y = FACING;
  g.add(hole);

  const boulder = new THREE.Mesh(roughen(new THREE.IcosahedronGeometry(2.8, 1), 0.5), rockMat);
  boulder.position.set(sin * 8.4, 1.6, cos * 8.4);
  boulder.castShadow = true;
  g.add(boulder);

  // Frost creeps out of the hole once it is open.
  const iceMat = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x2fb8ff, emissiveIntensity: 0.6,
    transparent: true, opacity: 0.88, roughness: 0.2, flatShading: true });
  const frost = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = FACING + (i - 3.5) * 0.28;
    const c = crystal(iceMat, 1.2 + Math.random() * 1.6);
    c.position.set(Math.sin(a) * 8.6, 0, Math.cos(a) * 8.6);
    frost.add(c);
  }
  const glow = new THREE.Mesh(new THREE.CircleGeometry(2.2, 18),
    new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.35, depthWrite: false }));
  glow.position.copy(holeLocal).addScaledVector(new THREE.Vector3(sin, 0, cos), 0.05);
  glow.rotation.y = FACING;
  frost.add(glow);
  const lamp = new THREE.PointLight(0x5fd0ff, 260, 20, 1.6);
  lamp.position.set(sin * 9, 2.2, cos * 9);
  frost.add(lamp);
  g.add(frost);

  const mouth = {
    group: g,
    /** World position of the opening, and the spot in front of it. */
    hole: new THREE.Vector3(MOUTH.x + sin * 7.6, 0, MOUTH.z + cos * 7.6),
    front: { x: MOUTH.x + sin * 10.5, z: MOUTH.z + cos * 10.5 },
    facing: FACING,
    found: false,
    setFound(on) {
      this.found = on;
      boulder.visible = !on;
      frost.visible = on;
    },
    update(t) {
      if (!this.found) return;
      iceMat.emissiveIntensity = 0.5 + Math.sin(t * 2.2) * 0.25;
      glow.material.opacity = 0.3 + Math.sin(t * 3) * 0.1;
      lamp.intensity = 240 + Math.sin(t * 2.2) * 60;
    },
    near(pos) { return Math.hypot(pos.x - this.hole.x, pos.z - this.hole.z) <= MOUTH_RANGE; },
  };
  mouth.setFound(found);
  return mouth;
}

// ---------------------------------------------------------------- the cave itself

/** Build the arena, far away in the same scene. */
export function buildCave(scene) {
  const g = new THREE.Group();
  g.position.set(CAVE_ORIGIN.x, 0, CAVE_ORIGIN.z);
  scene.add(g);

  const iceFloor = new THREE.MeshStandardMaterial({ color: 0x8ec2e6, roughness: 0.35, metalness: 0.1, flatShading: true });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3d7fb5, roughness: 0.6, flatShading: true, side: THREE.BackSide });
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x7fe4ff, emissive: 0x2fb8ff, emissiveIntensity: 0.9,
    transparent: true, opacity: 0.85, roughness: 0.2, flatShading: true });
  const iceMat = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.25, transparent: true, opacity: 0.9, flatShading: true });

  const floor = new THREE.Mesh(roughen(new THREE.CircleGeometry(40, 56), 0.15), iceFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  // A craggy dome for the walls and ceiling.
  const dome = new THREE.Mesh(roughen(new THREE.SphereGeometry(38, 30, 16, 0, Math.PI * 2, 0, Math.PI / 2), 2.2), wallMat);
  dome.scale.y = 0.62;
  g.add(dome);
  const ceilingAt = r => Math.sqrt(Math.max(0, 38 * 38 - r * r)) * 0.62;

  // Stalactites hang from the roof, stalagmites and crystal spires rise near the walls.
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.random() * 30;
    const h = 2.5 + Math.random() * 6;
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.35 + Math.random() * 0.6, h, 5), iceMat);
    s.rotation.x = Math.PI;
    s.position.set(Math.cos(a) * r, ceilingAt(r) - h / 2 + 0.6, Math.sin(a) * r);
    g.add(s);
  }
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 25 + Math.random() * 9;
    const h = 2 + Math.random() * 6;
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.5 + Math.random() * 0.8, h, 5), iceMat);
    s.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    s.castShadow = true;
    g.add(s);
  }

  const lights = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    const cluster = new THREE.Group();
    cluster.position.set(Math.cos(a) * 27, 0, Math.sin(a) * 27);
    for (let k = 0; k < 4; k++) {
      const c = crystal(crystalMat, 2 + Math.random() * 4);
      c.position.x += (Math.random() - 0.5) * 3;
      c.position.z += (Math.random() - 0.5) * 3;
      cluster.add(c);
    }
    const light = new THREE.PointLight(0x5fd0ff, 230, 46, 1.5);
    light.position.y = 3.5;
    cluster.add(light);
    lights.push(light);
    g.add(cluster);
  }

  // The way out: an arch with a warm light, so you can always find it.
  const arch = new THREE.Group();
  arch.position.z = 30;
  const stone = flat(0x2f5f86);
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 6.5, 1.3), stone);
    pillar.position.set(side * 2.8, 3.25, 0);
    arch.add(pillar);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.2, 1.6), stone);
  lintel.position.y = 6.8;
  arch.add(lintel);
  const doorway = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 6.2),
    new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  doorway.position.set(0, 3.1, 0.2);
  arch.add(doorway);
  const warm = new THREE.PointLight(0xffb060, 300, 26, 1.6);
  warm.position.set(0, 3.5, -1.5);
  arch.add(warm);
  g.add(arch);

  // The gnome's throne and his hoard at the far end.
  const throne = new THREE.Group();
  throne.position.z = -29;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2, 3), iceMat);
  seat.position.y = 1;
  const back = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.5, 0.8), iceMat);
  back.position.set(0, 4.2, -1.2);
  throne.add(seat, back);
  for (const side of [-1, 1]) {
    const spire = crystal(crystalMat, 7, 1.4);
    spire.position.set(side * 3.6, 0, -0.5);
    throne.add(spire);
  }
  const coin = new THREE.MeshStandardMaterial({ color: 0xffd54f, metalness: 0.8, roughness: 0.3 });
  for (let i = 0; i < 36; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 10), coin);
    const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 3.5;
    c.position.set(Math.cos(a) * r, 0.04 + Math.random() * 0.4, 1.5 + Math.sin(a) * r * 0.6);
    c.rotation.set((Math.random() - 0.5) * 0.6, Math.random() * 3, (Math.random() - 0.5) * 0.6);
    throne.add(c);
  }
  g.add(throne);

  // A slow drift of ice motes so the air looks cold.
  const N = 500;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 32;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.random() * 18; pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const motes = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
    new THREE.PointsMaterial({ color: 0xdff6ff, size: 0.18, transparent: true, opacity: 0.8, depthWrite: false }));
  g.add(motes);

  // Hidden until you go in: its lights would otherwise cost every material in the garden.
  g.visible = false;

  return {
    group: g, dome, lights, crystalMat, motes,
    exit: { x: CAVE_ORIGIN.x, z: CAVE_ORIGIN.z + 30 },
    spawn: { x: CAVE_ORIGIN.x, z: CAVE_ORIGIN.z + 24, yaw: Math.PI },
    nearExit(p) { return Math.hypot(p.x - this.exit.x, p.z - this.exit.z) <= 4.2; },
    update(dt, t) {
      crystalMat.emissiveIntensity = 0.75 + Math.sin(t * 1.7) * 0.25;
      lights.forEach((l, i) => { l.intensity = 220 + Math.sin(t * 1.3 + i) * 50; });
      const p = motes.geometry.attributes.position;
      for (let i = 0; i < N; i++) {
        let y = p.getY(i) - dt * 0.7;
        if (y < 0) y = 18;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t * 0.5 + i) * dt * 0.3);
      }
      p.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- the boss rush

/**
 * Runs one visit: sends the waves, keeps the clock, and reports back through
 * hooks. Bugs themselves live in the shared BugSystem, flagged `arena`.
 */
export class Lair {
  /** @param hooks { earned, onWave, onWaveClear, onClear, onFreeze } */
  constructor(bugs, hooks) {
    this.bugs = bugs;
    this.hooks = hooks;
    this.inside = false;
    this.phase = 'idle';       // idle | fight | break | won | frozen
    this.wave = 0;
    this.depth = 0;
    this.timeLeft = 0;
    this.breakLeft = 0;
    this.cleared = 0;
  }

  get arenaBugs() { return this.bugs.bugs.filter(b => b.arena); }

  /** The biggest boss still standing, for the HUD bar. */
  strongest() {
    let best = null;
    for (const b of this.arenaBugs) if (!best || b.maxHp > best.maxHp) best = b;
    return best;
  }

  enter(depth) {
    this.inside = true;
    this.depth = depth;
    this.wave = 0;
    this.cleared = 0;
    this.phase = 'break';
    this.breakLeft = BREAK_SECONDS;
  }

  startWave(n) {
    this.wave = n;
    this.phase = 'fight';
    this.timeLeft = WAVE_SECONDS;
    const ids = WAVES[n - 1];
    ids.forEach((id, i) => {
      const a = Math.PI + (i - (ids.length - 1) / 2) * 0.55;     // fan out across the far end
      const r = 22;
      const bug = this.bugs.spawnHunter(waveSpec(id, this.depth),
        CAVE_ORIGIN.x + Math.sin(a) * r, CAVE_ORIGIN.z + Math.cos(a) * r);
      bug.arena = true;
    });
    this.hooks.onWave?.(n, ids);
  }

  /** Getting hit costs time, not blood — each species stings for its own amount. */
  hurt(seconds = BITE_PENALTY) {
    if (this.phase !== 'fight') return;
    this.timeLeft = Math.max(0, this.timeLeft - seconds);
  }

  update(dt) {
    if (!this.inside) return;
    if (this.phase === 'break') {
      this.breakLeft -= dt;
      if (this.breakLeft <= 0) this.startWave(this.wave + 1);
    } else if (this.phase === 'fight') {
      this.timeLeft -= dt;
      if (this.arenaBugs.length === 0) {
        this.cleared = this.wave;
        this.hooks.onWaveClear?.(this.wave, waveReward(this.wave, this.hooks.earned(), this.depth));
        if (this.wave >= WAVES.length) {
          this.phase = 'won';
          this.hooks.onClear?.(this.depth);
        } else {
          this.phase = 'break';
          this.breakLeft = BREAK_SECONDS;
        }
      } else if (this.timeLeft <= 0) {
        this.phase = 'frozen';
        this.bugs.clearArena();
        this.hooks.onFreeze?.(this.cleared);
      }
    }
  }

  /** Wipe the fight and reset; the caller moves the player. */
  leave() {
    this.bugs.clearArena();
    this.inside = false;
    this.phase = 'idle';
  }

  /** HUD text. */
  label() {
    if (this.phase === 'break') {
      return this.wave === 0
        ? `❄️ GNOME'S ICE LAIR · Level ${this.depth + 1} · get ready…`
        : `❄️ Wave ${this.wave} cleared! · next in ${Math.ceil(this.breakLeft)}`;
    }
    if (this.phase === 'fight') {
      const s = Math.max(0, Math.ceil(this.timeLeft));
      return `❄️ ICE LAIR · Wave ${this.wave}/${WAVES.length} · ⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
    if (this.phase === 'won') return `🏆 LAIR CLEARED · Level ${this.depth + 1} · walk out through the arch`;
    if (this.phase === 'frozen') return `🧊 The lair froze over · ${this.cleared} wave${this.cleared === 1 ? '' : 's'} cleared`;
    return '';
  }
}
