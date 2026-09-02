// Pets: little companions that follow the gardener around and help out.

import * as THREE from 'three';
import { PETS_BY_ID, TIERS } from './data.js';

function m(color, tier, emissive = 0.18) {
  return new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: 0.6,
    emissive: new THREE.Color(TIERS[tier].color).multiplyScalar(TIERS[tier].shine * emissive),
  });
}

function part(geo, mat, pos, scale) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(pos[0], pos[1], pos[2]);
  if (scale) Array.isArray(scale) ? o.scale.set(...scale) : o.scale.setScalar(scale);
  o.castShadow = true;
  return o;
}

const G = {};
const geo = (k, make) => (G[k] ||= make());
const ball = () => geo('ball', () => new THREE.IcosahedronGeometry(0.5, 1));
const box = () => geo('box', () => new THREE.BoxGeometry(1, 1, 1));
const cone = () => geo('cone', () => new THREE.ConeGeometry(0.5, 1, 6));
const cyl = () => geo('cyl', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 6));
const torus = () => geo('torus', () => new THREE.TorusGeometry(0.5, 0.14, 6, 12));
const eyeMat = () => (G.eye ||= new THREE.MeshBasicMaterial({ color: 0x1b1b1b }));

function eyes(g, y, z, sep = 0.16, r = 0.06) {
  for (const side of [-1, 1]) g.add(part(ball(), eyeMat(), [side * sep, y, z], r * 2));
}

/** Each pet's silhouette. `flyer` bobs in the air instead of hopping. */
const SHAPES = {
  snail(g, p, a, b) {
    g.add(part(ball(), b, [0, 0.16, -0.05], [0.7, 0.4, 1.0]));            // foot
    const shell = part(torus(), a, [0, 0.32, -0.12], 0.85);
    shell.rotation.y = Math.PI / 2;
    g.add(shell);
    g.add(part(ball(), a, [0, 0.32, -0.12], 0.4));
    g.add(part(ball(), b, [0, 0.3, 0.28], [0.42, 0.38, 0.5]));           // head
    for (const side of [-1, 1]) {
      g.add(part(cyl(), b, [side * 0.1, 0.5, 0.3], [0.035, 0.28, 0.035]));
      g.add(part(ball(), b, [side * 0.1, 0.64, 0.3], 0.09));
    }
    eyes(g, 0.34, 0.46, 0.1, 0.05);
  },
  beetle(g, p, a, b) {
    g.add(part(ball(), a, [0, 0.26, 0], [0.66, 0.5, 0.82]));
    g.add(part(box(), b, [0, 0.42, 0], [0.05, 0.2, 0.75]));              // wing split
    for (let i = 0; i < 4; i++) {
      const s = i % 2 ? 1 : -1;
      g.add(part(ball(), b, [s * 0.2, 0.38, -0.15 + Math.floor(i / 2) * 0.28], 0.12));
    }
    g.add(part(ball(), b, [0, 0.28, 0.36], [0.4, 0.36, 0.3]));
    eyes(g, 0.32, 0.48, 0.1, 0.05);
  },
  bee(g, p, a, b) {
    g.add(part(ball(), a, [0, 0, 0], [0.6, 0.5, 0.75]));
    for (let i = -1; i <= 1; i++) g.add(part(box(), b, [0, 0, i * 0.16], [0.62, 0.5, 0.09]));
    const wingMat = new THREE.MeshBasicMaterial({ color: 0xe3f2fd, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      const w = part(ball(), wingMat, [side * 0.3, 0.22, -0.05], [0.5, 0.06, 0.32]);
      w.userData.wing = side;
      g.add(w);
    }
    g.add(part(cone(), b, [0, 0, -0.42], [0.2, 0.24, 0.2])).rotation.x = -Math.PI / 2;
    eyes(g, 0.06, 0.34, 0.11, 0.06);
  },
  bunny(g, p, a, b) {
    g.add(part(ball(), a, [0, 0.28, -0.05], [0.62, 0.56, 0.75]));
    g.add(part(ball(), a, [0, 0.5, 0.26], 0.42));
    for (const side of [-1, 1]) g.add(part(box(), b, [side * 0.11, 0.78, 0.24], [0.11, 0.36, 0.07]));
    g.add(part(ball(), b, [0, 0.26, -0.42], 0.22));                      // tail
    eyes(g, 0.54, 0.44, 0.12, 0.055);
  },
  cat(g, p, a, b) {
    g.add(part(ball(), a, [0, 0.3, -0.05], [0.56, 0.5, 0.9]));
    g.add(part(ball(), a, [0, 0.48, 0.34], 0.42));
    for (const side of [-1, 1]) {
      const ear = part(cone(), a, [side * 0.14, 0.7, 0.34], [0.16, 0.2, 0.16]);
      g.add(ear);
      g.add(part(cyl(), b, [side * 0.16, 0.1, 0.2], [0.07, 0.2, 0.07]));
    }
    const tail = part(cyl(), a, [0, 0.44, -0.44], [0.07, 0.5, 0.07]);
    tail.rotation.x = 0.6;
    g.add(tail);
    g.add(part(ball(), b, [0, 0.42, 0.56], [0.22, 0.16, 0.14]));         // muzzle
    eyes(g, 0.52, 0.5, 0.13, 0.055);
  },
  owl(g, p, a, b) {
    g.add(part(ball(), a, [0, 0.1, 0], [0.68, 0.8, 0.6]));
    g.add(part(ball(), b, [0, 0.16, 0.24], [0.5, 0.42, 0.2]));           // face disc
    for (const side of [-1, 1]) {
      g.add(part(cone(), a, [side * 0.2, 0.44, 0], [0.14, 0.2, 0.14]));  // tufts
      const w = part(ball(), a, [side * 0.34, 0.06, 0], [0.16, 0.5, 0.36]);
      w.userData.wing = side;
      g.add(w);
    }
    g.add(part(cone(), b, [0, 0.12, 0.34], [0.1, 0.16, 0.1])).rotation.x = Math.PI / 2;
    eyes(g, 0.2, 0.34, 0.15, 0.09);
  },
  drake(g, p, a, b) {
    g.add(part(ball(), a, [0, 0.24, -0.05], [0.66, 0.58, 0.9]));
    g.add(part(ball(), a, [0, 0.46, 0.38], [0.44, 0.4, 0.46]));
    g.add(part(cone(), b, [0, 0.44, 0.62], [0.2, 0.26, 0.2])).rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      const w = part(ball(), b, [side * 0.42, 0.42, -0.1], [0.5, 0.08, 0.44]);
      w.userData.wing = side;
      g.add(w);
      g.add(part(cone(), b, [side * 0.12, 0.72, 0.34], [0.1, 0.22, 0.1]));
    }
    for (let i = 0; i < 3; i++) g.add(part(cone(), b, [0, 0.5 + i * 0.02, -0.1 - i * 0.2], [0.1, 0.2, 0.1]));
    const tail = part(cone(), a, [0, 0.24, -0.62], [0.2, 0.5, 0.2]);
    tail.rotation.x = Math.PI / 2;
    g.add(tail);
    eyes(g, 0.52, 0.56, 0.14, 0.055);
  },
  sprite(g, p, a, b) {
    const core = part(ball(), a, [0, 0.2, 0], 0.5);
    core.userData.spin = 1.4;
    g.add(core);
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const spike = part(cone(), b, [Math.sin(ang) * 0.3, 0.2 + Math.cos(ang) * 0.3, 0], [0.24, 0.5, 0.12]);
      spike.rotation.z = -ang;
      g.add(spike);
    }
    const ring = part(torus(), b, [0, 0.2, 0], 1.2);
    ring.rotation.x = Math.PI / 2.3;
    ring.userData.spin = -1;
    g.add(ring);
    eyes(g, 0.24, 0.3, 0.1, 0.05);
  },
};

const FLYERS = new Set(['bee', 'owl', 'drake', 'sprite']);

export function buildPet(spec) {
  const g = new THREE.Group();
  const [cA, cB] = spec.colors;
  SHAPES[spec.shape](g, spec, m(cA, spec.tier), m(cB, spec.tier));
  g.userData = {
    spec,
    flyer: FLYERS.has(spec.shape),
    wings: g.children.filter(c => c.userData.wing),
    spinners: g.children.filter(c => c.userData.spin),
    phase: Math.random() * 6,
  };
  g.scale.setScalar(0.62);
  return g;
}

/** Keeps the equipped pets trailing the player in a loose formation. */
export class PetPack {
  constructor(scene) {
    this.scene = scene;
    this.pets = [];          // { uid, mesh, spec }
  }

  /** Rebuild the models to match the equipped list. */
  sync(equipped) {
    const want = equipped.map(p => p.uid);
    for (const p of [...this.pets]) {
      if (!want.includes(p.uid)) { this.scene.remove(p.mesh); this.pets.splice(this.pets.indexOf(p), 1); }
    }
    equipped.forEach((entry, i) => {
      if (this.pets.some(p => p.uid === entry.uid)) return;
      const spec = PETS_BY_ID[entry.id];
      if (!spec) return;
      const mesh = buildPet(spec);
      mesh.position.set(0, 0, 0);
      this.scene.add(mesh);
      this.pets.push({ uid: entry.uid, mesh, spec, slot: i });
    });
    this.pets.forEach((p, i) => { p.slot = i; });
  }

  update(dt, t, playerPos, playerYaw) {
    this.pets.forEach((p, i) => {
      const u = p.mesh.userData;
      // Fan out behind and beside the gardener.
      const side = (i - (this.pets.length - 1) / 2) * 1.1;
      const back = 1.5 + Math.abs(side) * 0.25;
      const sin = Math.sin(playerYaw), cos = Math.cos(playerYaw);
      const tx = playerPos.x - sin * back - cos * side;
      const tz = playerPos.z - cos * back + sin * side;
      const ty = u.flyer ? 1.25 + Math.sin(t * 2.2 + u.phase) * 0.16 : 0;

      const k = 1 - Math.exp(-4.5 * dt);
      p.mesh.position.x += (tx - p.mesh.position.x) * k;
      p.mesh.position.z += (tz - p.mesh.position.z) * k;
      p.mesh.position.y += (ty - p.mesh.position.y) * k;

      const dx = tx - p.mesh.position.x, dz = tz - p.mesh.position.z;
      const moving = Math.hypot(dx, dz) > 0.05;
      if (moving) p.mesh.rotation.y = Math.atan2(dx, dz);
      if (!u.flyer && moving) p.mesh.position.y = Math.abs(Math.sin(t * 9 + u.phase)) * 0.14;

      for (const w of u.wings) w.rotation.z = Math.sin(t * (u.flyer ? 22 : 8) + u.phase) * 0.5 * w.userData.wing;
      for (const sp of u.spinners) sp.rotation.y += sp.userData.spin * dt;
    });
  }

  clear() {
    for (const p of this.pets) this.scene.remove(p.mesh);
    this.pets = [];
  }
}
