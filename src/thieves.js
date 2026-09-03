// Night thieves: they creep in after dark, dig up whatever is ripe and run.

import * as THREE from 'three';
import { THIEVES_BY_ID, rollThief, thiefScale } from './data.js';

const ENTER_FROM = 26;      // how far out they appear
const STEAL_TIME = 3.2;     // seconds spent prising a crop loose

function bodyMat(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7 });
}

function part(geo, mat, pos, scale) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(pos[0], pos[1], pos[2]);
  if (scale) Array.isArray(scale) ? o.scale.set(...scale) : o.scale.setScalar(scale);
  o.castShadow = true;
  return o;
}

const G = {};
const g = (k, make) => (G[k] ||= make());
const ball = () => g('ball', () => new THREE.IcosahedronGeometry(0.5, 1));
const box = () => g('box', () => new THREE.BoxGeometry(1, 1, 1));
const cone = () => g('cone', () => new THREE.ConeGeometry(0.5, 1, 6));
const cyl = () => g('cyl', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 6));
const dark = () => (G.dark ||= new THREE.MeshBasicMaterial({ color: 0x15151a }));
const eyeMat = () => (G.eye ||= new THREE.MeshBasicMaterial({ color: 0xffe082 }));

function buildThief(spec) {
  const root = new THREE.Group();
  const skin = bodyMat(spec.color);
  const legs = [];

  if (spec.id === 'crow') {
    root.add(part(ball(), skin, [0, 0.5, 0], [0.5, 0.42, 0.8]));
    root.add(part(ball(), skin, [0, 0.72, 0.34], 0.3));
    root.add(part(cone(), bodyMat(0xffb300), [0, 0.7, 0.56], [0.12, 0.3, 0.12])).rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      const wing = part(ball(), skin, [side * 0.38, 0.52, -0.05], [0.5, 0.08, 0.52]);
      wing.userData.wing = side;
      root.add(wing);
      root.add(part(ball(), eyeMat(), [side * 0.11, 0.78, 0.5], 0.07));
    }
    root.add(part(cone(), skin, [0, 0.48, -0.5], [0.24, 0.44, 0.24])).rotation.x = -Math.PI / 2;
  } else if (spec.id === 'gnome') {
    root.add(part(cyl(), bodyMat(0x1e88e5), [0, 0.34, 0], [0.5, 0.68, 0.5]));   // smock
    root.add(part(ball(), bodyMat(0xf3d3b5), [0, 0.78, 0], 0.36));             // face
    root.add(part(ball(), bodyMat(0xf5f5f5), [0, 0.66, 0.2], [0.34, 0.3, 0.24])); // beard
    root.add(part(cone(), skin, [0, 1.06, 0], [0.44, 0.62, 0.44]));            // red hat
    for (const side of [-1, 1]) {
      root.add(part(ball(), eyeMat(), [side * 0.1, 0.84, 0.28], 0.06));
      const leg = part(cyl(), bodyMat(0x37474f), [side * 0.14, 0.1, 0], [0.14, 0.24, 0.14]);
      leg.userData.leg = side;
      legs.push(leg);
      root.add(leg);
    }
  } else {
    root.add(part(ball(), skin, [0, 0.38, 0], [0.62, 0.5, 0.92]));
    root.add(part(ball(), skin, [0, 0.5, 0.44], 0.34));
    root.add(part(box(), dark(), [0, 0.52, 0.6], [0.34, 0.12, 0.06]));          // bandit mask
    for (const side of [-1, 1]) {
      root.add(part(ball(), eyeMat(), [side * 0.1, 0.53, 0.62], 0.05));
      root.add(part(cone(), skin, [side * 0.16, 0.7, 0.4], [0.16, 0.18, 0.16]));
      const leg = part(cyl(), skin, [side * 0.2, 0.12, 0.12], [0.13, 0.26, 0.13]);
      leg.userData.leg = side;
      legs.push(leg);
      root.add(leg);
      const back = part(cyl(), skin, [side * 0.2, 0.12, -0.2], [0.13, 0.26, 0.13]);
      back.userData.leg = -side;
      legs.push(back);
      root.add(back);
    }
    for (let i = 0; i < 4; i++) {                                              // ringed tail
      const seg = part(ball(), i % 2 ? dark() : skin, [0, 0.42 + i * 0.09, -0.5 - i * 0.1], 0.22);
      root.add(seg);
    }
  }

  root.scale.setScalar(spec.size);
  root.userData = { legs, wings: root.children.filter(c => c.userData.wing), flies: !!spec.flies };
  return root;
}

export class ThiefPack {
  /** @param hooks { plotCells, ripePlots, valueOf, onSteal, onScared, defenceAt } */
  constructor(scene, hooks) {
    this.scene = scene;
    this.hooks = hooks;
    this.thieves = [];
  }

  get count() { return this.thieves.length; }

  /** Send one in. Returns null when there is nothing worth taking. */
  spawn(ownedPlots, prestiges) {
    const ripe = this.hooks.ripePlots();
    if (!ripe.length) return null;
    const spec = rollThief();
    // A gnome goes for the most valuable thing in the garden; the rest grab anything.
    const target = spec.greedy
      ? ripe.reduce((best, i) => (this.hooks.valueOf(i) > this.hooks.valueOf(best) ? i : best), ripe[0])
      : ripe[Math.floor(Math.random() * ripe.length)];

    const a = Math.random() * Math.PI * 2;
    const mesh = buildThief(spec);
    mesh.position.set(Math.cos(a) * ENTER_FROM, spec.flies ? 3 : 0, Math.sin(a) * ENTER_FROM);
    this.scene.add(mesh);

    const hp = Math.round(spec.hp * thiefScale(ownedPlots, prestiges));
    const thief = { spec, mesh, hp, maxHp: hp, target, mode: 'approach', timer: 0, carrying: 0, phase: Math.random() * 6 };
    this.thieves.push(thief);
    return thief;
  }

  update(dt, t) {
    const cells = this.hooks.plotCells();
    for (let i = this.thieves.length - 1; i >= 0; i--) {
      const th = this.thieves[i];
      const cell = cells[th.target];
      const u = th.mesh.userData;

      if (th.mode === 'approach') {
        // A scarecrow in the way turns them around before they ever arrive.
        const scare = this.hooks.defenceAt(th.mesh.position.x, th.mesh.position.z, 'scare');
        if (scare) { this.scare(th); continue; }

        const slow = this.hooks.defenceAt(th.mesh.position.x, th.mesh.position.z, 'slow');
        const dx = cell.x - th.mesh.position.x, dz = cell.z - th.mesh.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.0) { th.mode = 'steal'; th.timer = STEAL_TIME; }
        else {
          const v = th.spec.speed * (slow ? 1 - slow : 1) * dt;
          th.mesh.position.x += (dx / d) * v;
          th.mesh.position.z += (dz / d) * v;
          th.mesh.rotation.y = Math.atan2(dx, dz);
        }
      } else if (th.mode === 'steal') {
        th.timer -= dt;
        th.mesh.position.y = (u.flies ? 0.6 : 0) + Math.abs(Math.sin(t * 12 + th.phase)) * 0.12;
        if (th.timer <= 0) {
          const took = this.hooks.onSteal(th.target, th.spec.loot);
          th.carrying = took;
          th.mode = 'flee';
          if (!took) this.scare(th, true);
        }
      } else {
        // Running for the fence with the goods.
        const away = Math.atan2(th.mesh.position.x, th.mesh.position.z);
        th.mesh.position.x += Math.sin(away) * th.spec.speed * 1.4 * dt;
        th.mesh.position.z += Math.cos(away) * th.spec.speed * 1.4 * dt;
        th.mesh.rotation.y = away;
        if (Math.hypot(th.mesh.position.x, th.mesh.position.z) > ENTER_FROM) { this.remove(th); continue; }
      }

      // Traps bite whatever wanders over them.
      const trap = this.hooks.defenceAt(th.mesh.position.x, th.mesh.position.z, 'damage');
      if (trap) this.damage(th, trap * dt);

      if (u.flies) th.mesh.position.y = 1.6 + Math.sin(t * 3 + th.phase) * 0.2;
      for (const l of u.legs) l.rotation.x = Math.sin(t * 11 + th.phase) * 0.6 * (l.userData.leg || 1);
      for (const w of u.wings) w.rotation.z = Math.sin(t * 20 + th.phase) * 0.6 * w.userData.wing;
    }
  }

  /** Frighten one off empty-handed. */
  scare(th, atPlot = false) {
    th.mode = 'flee';
    th.carrying = 0;
    this.hooks.onScared?.(th, atPlot);
  }

  damage(th, amount) {
    th.hp -= amount;
    if (th.hp <= 0) { this.remove(th, true); return true; }
    return false;
  }

  remove(th, killed = false) {
    const i = this.thieves.indexOf(th);
    if (i < 0) return;
    this.thieves.splice(i, 1);
    this.scene.remove(th.mesh);
    if (killed) this.hooks.onCaught?.(th);
  }

  nearest(x, z, radius) {
    let best = null, bestD = radius;
    for (const th of this.thieves) {
      const d = Math.hypot(th.mesh.position.x - x, th.mesh.position.z - z);
      if (d < bestD) { best = th; bestD = d; }
    }
    return best;
  }

  near(x, z, radius) {
    return this.thieves.filter(th => Math.hypot(th.mesh.position.x - x, th.mesh.position.z - z) <= radius);
  }

  clear() {
    for (const th of [...this.thieves]) this.remove(th);
  }
}
