// Bug raids: spawning, crawling, chewing on crops, and dying.

import * as THREE from 'three';
import { BUGS_BY_ID, rollBug, bossOf } from './data.js';

const SPAWN_RING = 16;   // far enough to see them coming, close enough to matter
const ATTACH_DIST = 1.0;

function buildBug(spec) {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: spec.color, flatShading: true, roughness: 0.55, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, flatShading: true, roughness: 0.8 });

  if (spec.boss) {
    shell.emissive = new THREE.Color(spec.color).multiplyScalar(0.45);
    shell.metalness = 0.7;
  }
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), shell);
  body.scale.set(1, 0.72, 1.35);
  body.position.y = 0.26;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 0), shell);
  head.position.set(0, 0.28, 0.42);
  head.castShadow = true;
  g.add(head);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 5, 4), dark);
    eye.position.set(side * 0.1, 0.33, 0.55);
    g.add(eye);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 4), dark);
    ant.position.set(side * 0.09, 0.46, 0.5);
    ant.rotation.set(-0.5, 0, side * 0.4);
    g.add(ant);
  }

  const legs = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.02, 0.34, 4), dark);
      leg.position.set(side * 0.26, 0.14, -0.22 + i * 0.26);
      leg.rotation.z = side * 0.75;
      leg.userData.phase = i * 1.1 + (side > 0 ? 1.6 : 0);
      legs.push(leg);
      g.add(leg);
    }
  }

  if (spec.boss) {
    // Spiky crown so a MEGA bug reads as a boss at a glance.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 4), shell);
      horn.position.set(Math.cos(a) * 0.2, 0.52, Math.sin(a) * 0.2 - 0.05);
      horn.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      g.add(horn);
    }
  }
  g.scale.setScalar(spec.size);
  g.userData = { legs, body };
  return g;
}

/** A small floating health bar, so you can tell how close a bug is to dying. */
function buildHealthBar() {
  const g = new THREE.Group();
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.11),
    new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.7, depthTest: false }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xff5544, depthTest: false }));
  fill.position.z = 0.001;
  g.add(back, fill);
  g.userData.fill = fill;
  g.visible = false;
  g.renderOrder = 999;
  return g;
}

export class BugSystem {
  /** @param hooks { plotCells, plantedPlots, onAttach, onDetach, onKill } */
  constructor(scene, hooks) {
    this.scene = scene;
    this.hooks = hooks;
    this.bugs = [];
    this.effects = [];
  }

  get count() { return this.bugs.length; }

  bugsOnPlot(index) { return this.bugs.filter(b => b.attached && b.target === index).length; }

  /** Send `n` bugs at the garden from a random direction. */
  spawnWave(n, level) {
    const targets = this.hooks.plantedPlots();
    if (!targets.length) return 0;
    const from = Math.random() * Math.PI * 2;
    let spawned = 0;
    for (let i = 0; i < n; i++) {
      const spec = rollBug(level);
      const a = from + (Math.random() - 0.5) * 1.2;
      const r = SPAWN_RING + Math.random() * 4;
      const target = targets[Math.floor(Math.random() * targets.length)];
      this.spawn(spec, Math.cos(a) * r, Math.sin(a) * r, target);
      spawned++;
    }
    return spawned;
  }

  /** One huge bug, worth a fortune, with a name the HUD can show. */
  spawnBoss(level) {
    const targets = this.hooks.plantedPlots();
    if (!targets.length) return null;
    const spec = bossOf(rollBug(level));
    const a = Math.random() * Math.PI * 2;
    const r = SPAWN_RING + 3;
    const bug = this.spawn(spec, Math.cos(a) * r, Math.sin(a) * r,
                           targets[Math.floor(Math.random() * targets.length)]);
    bug.bar.visible = false;
    this.boss = bug;
    return bug;
  }

  /** The living boss, if there is one. */
  get activeBoss() {
    return this.boss && this.bugs.includes(this.boss) ? this.boss : null;
  }

  /** Put a bug straight onto a plot — used to restore a saved infestation. */
  spawnAttached(specId, plotIndex) {
    const spec = BUGS_BY_ID[specId] || (specId?.startsWith('boss_')
      ? bossOf(BUGS_BY_ID[specId.slice(5)] || BUGS_BY_ID.aphid) : BUGS_BY_ID.aphid);
    const cell = this.hooks.plotCells()[plotIndex];
    const a = Math.random() * Math.PI * 2;
    const bug = this.spawn(spec, cell.x + Math.cos(a) * 0.8, cell.z + Math.sin(a) * 0.8, plotIndex);
    bug.attached = true;
    return bug;
  }

  spawn(spec, x, z, target) {
    const mesh = buildBug(spec);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const bar = buildHealthBar();
    this.scene.add(bar);
    const bug = { spec, mesh, bar, hp: spec.hp, maxHp: spec.hp, target, attached: false, phase: Math.random() * 6 };
    this.bugs.push(bug);
    return bug;
  }

  update(dt, t, camera) {
    const cells = this.hooks.plotCells();
    for (let i = this.bugs.length - 1; i >= 0; i--) {
      const bug = this.bugs[i];
      const cell = cells[bug.target];

      if (!bug.attached) {
        const dx = cell.x - bug.mesh.position.x;
        const dz = cell.z - bug.mesh.position.z;
        const d = Math.hypot(dx, dz);
        if (d < ATTACH_DIST) {
          bug.attached = true;
          this.hooks.onAttach(bug.target, bug.spec.id);
        } else {
          const v = bug.spec.speed * dt;
          bug.mesh.position.x += (dx / d) * v;
          bug.mesh.position.z += (dz / d) * v;
          bug.mesh.rotation.y = Math.atan2(dx, dz);
        }
      }

      // Scuttle: legs paddle, body bobs; attached bugs chew in place.
      const rate = bug.attached ? 9 : 13;
      for (const leg of bug.mesh.userData.legs) {
        leg.rotation.x = Math.sin(t * rate + leg.userData.phase) * 0.5;
      }
      bug.mesh.userData.body.position.y = 0.26 + Math.abs(Math.sin(t * rate * 0.5 + bug.phase)) * 0.04;
      if (bug.attached) bug.mesh.position.y = Math.sin(t * 6 + bug.phase) * 0.03;

      // Health bar faces the camera, and only shows once a bug is hurt.
      bug.bar.position.set(bug.mesh.position.x, bug.mesh.position.y + 0.95 * bug.spec.size, bug.mesh.position.z);
      bug.bar.visible = bug.hp < bug.maxHp;
      if (bug.bar.visible) {
        const k = Math.max(0, bug.hp / bug.maxHp);
        bug.bar.userData.fill.scale.x = k;
        bug.bar.userData.fill.position.x = -0.39 * (1 - k);
        if (camera) bug.bar.quaternion.copy(camera.quaternion);
      }
    }
  }

  /** Nearest bug along a ray, within `range`. */
  pick(origin, dir, range) {
    let best = null, bestT = range;
    for (const bug of this.bugs) {
      const px = bug.mesh.position.x - origin.x;
      const py = bug.mesh.position.y + 0.3 * bug.spec.size - origin.y;
      const pz = bug.mesh.position.z - origin.z;
      const along = px * dir.x + py * dir.y + pz * dir.z;
      if (along < 0 || along > bestT) continue;
      const perp = Math.hypot(px - dir.x * along, py - dir.y * along, pz - dir.z * along);
      if (perp > 0.55 + bug.spec.size * 0.5) continue;   // forgiving aim
      best = bug; bestT = along;
    }
    return best;
  }

  /** Every bug within `radius` of a point. */
  near(x, z, radius) {
    return this.bugs.filter(b => Math.hypot(b.mesh.position.x - x, b.mesh.position.z - z) <= radius);
  }

  /** Nearest bug to a point, for turret targeting. */
  nearest(x, z, radius) {
    let best = null, bestD = radius;
    for (const bug of this.bugs) {
      const d = Math.hypot(bug.mesh.position.x - x, bug.mesh.position.z - z);
      if (d < bestD) { best = bug; bestD = d; }
    }
    return best;
  }

  damage(bug, amount) {
    bug.hp -= amount;
    bug.mesh.userData.body.material.emissive?.setHex(0x882222);
    setTimeout(() => bug.mesh.userData.body.material.emissive?.setHex(0x000000), 70);
    if (bug.hp <= 0) { this.kill(bug); return true; }
    return false;
  }

  kill(bug, opts = {}) {
    const i = this.bugs.indexOf(bug);
    if (i < 0) return;
    this.bugs.splice(i, 1);
    this.scene.remove(bug.mesh, bug.bar);
    if (bug.attached) this.hooks.onDetach(bug.target, bug.spec.id);
    // A bug swallowed by a plant pays no bounty — the plant got the meal.
    if (!opts.silent) this.hooks.onKill(bug);
  }

  /** Wipe every bug (used when a save is replaced). */
  clear() {
    for (const bug of [...this.bugs]) {
      this.bugs.splice(this.bugs.indexOf(bug), 1);
      this.scene.remove(bug.mesh, bug.bar);
    }
  }
}
