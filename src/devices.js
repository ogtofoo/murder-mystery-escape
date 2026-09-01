// Sprinklers and watering cans: models plus their water effects.

import * as THREE from 'three';
import { TIERS } from './data.js';

function metal(color, tier, shine = 0) {
  return new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: 0.4, metalness: 0.6,
    emissive: new THREE.Color(TIERS[tier].color).multiplyScalar(shine),
  });
}

/**
 * A sprinkler on a post. `head` spins and `spray` is a ring of droplets that
 * pulses outward; both are animated by animateSprinkler().
 */
export function buildSprinkler(spec) {
  const g = new THREE.Group();
  const t = TIERS[spec.tier];
  const body = metal(t.color, spec.tier, t.shine * 0.5);
  const dark = metal(0x54606b, spec.tier);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.14, 8), dark);
  base.position.y = 0.07; base.castShadow = true;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.72, 6), dark);
  post.position.y = 0.46; post.castShadow = true;
  g.add(base, post);

  const head = new THREE.Group();
  head.position.y = 0.86;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), body);
  cap.castShadow = true;
  head.add(cap);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.07), body);
    arm.position.set(Math.cos(a) * 0.2, 0.02, Math.sin(a) * 0.2);
    arm.rotation.y = -a;
    arm.castShadow = true;
    head.add(arm);
  }
  g.add(head);

  // Droplets that fly outward from the head, scaled to the sprinkler's reach.
  const spray = new THREE.Group();
  spray.position.y = 0.86;
  const dropGeo = new THREE.SphereGeometry(0.05, 5, 4);
  const dropMat = new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.75 });
  const reach = Math.min(spec.radius, 4.2);
  for (let i = 0; i < 16; i++) {
    const d = new THREE.Mesh(dropGeo, dropMat);
    d.userData = { angle: (i / 16) * Math.PI * 2, phase: (i % 4) / 4, reach };
    spray.add(d);
  }
  g.add(spray);

  g.userData = { head, spray, spec };
  return g;
}

export function animateSprinkler(g, t, dt) {
  const { head, spray } = g.userData;
  head.rotation.y += dt * 2.4;
  for (const d of spray.children) {
    const k = ((t * 0.55 + d.userData.phase) % 1);
    const r = 0.2 + k * d.userData.reach;
    d.position.set(Math.cos(d.userData.angle + t * 0.6) * r, 0.1 - k * k * 0.85, Math.sin(d.userData.angle + t * 0.6) * r);
    d.material.opacity = 0.75 * (1 - k);
    d.scale.setScalar(1 - k * 0.4);
  }
}

/** A watering can, held in hand or in first-person view. */
export function buildCan(spec) {
  const g = new THREE.Group();
  const t = TIERS[spec.tier];
  const shell = metal(spec.id === 'can_super' ? 0xffe9a3 : 0x7fb3c8, spec.tier, t.shine * 0.6);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.3, 8), shell);
  body.castShadow = true;
  g.add(body);

  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.42, 6), shell);
  spout.position.set(0.22, 0.05, 0);
  spout.rotation.z = -1.0;
  g.add(spout);

  const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.06, 0.06, 8), shell);
  rose.position.set(0.4, 0.19, 0);
  rose.rotation.z = -1.0;
  g.add(rose);

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 5, 10), shell);
  handle.position.set(-0.09, 0.19, 0);
  handle.rotation.set(Math.PI / 2, 0, 0.5);
  g.add(handle);

  return g;
}

/** A short burst of water from a point, for when a can is used. */
export function waterBurst(scene, x, z, spread, effects) {
  const geo = new THREE.SphereGeometry(0.07, 5, 4);
  const mat = new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true });
  const n = Math.min(60, 16 + Math.round(spread * 5));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * Math.max(0.6, spread);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x + Math.cos(a) * r * 0.2, 1.5 + Math.random() * 0.5, z + Math.sin(a) * r * 0.2);
    scene.add(m);
    effects.push({
      mesh: m, life: 0,
      vel: new THREE.Vector3(Math.cos(a) * r * 0.55, 0.4 + Math.random(), Math.sin(a) * r * 0.55),
    });
  }
}
