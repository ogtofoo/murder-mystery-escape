// The gardener: a low-poly character with a straw hat, animated limbs.

import * as THREE from 'three';
import { HATS_BY_ID, OUTFITS_BY_ID } from './data.js';

const SKIN = 0xe8b48c;
const SHIRT = 0x3f7d4e;
const PANTS = 0x3c4a63;
const HAT = 0xe8c377;
const BOOT = 0x5d4037;

function box(w, h, d, color, pos) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 })
  );
  m.position.set(pos[0], pos[1], pos[2]);
  m.castShadow = true;
  return m;
}

/** A spade: wooden handle, steel blade. Used both in-hand and in first person. */
export function buildShovel() {
  const g = new THREE.Group();
  const handle = box(0.05, 0.86, 0.05, 0x9c6b3f, [0, 0, 0]);
  const grip = box(0.14, 0.06, 0.05, 0x7a4f2b, [0, 0.44, 0]);
  const neck = box(0.07, 0.12, 0.06, 0x9e9e9e, [0, -0.46, 0]);
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.26, 0.035),
    new THREE.MeshStandardMaterial({ color: 0xb8bcc0, flatShading: true, roughness: 0.45, metalness: 0.55 })
  );
  blade.position.set(0, -0.63, 0);
  blade.castShadow = true;
  g.add(handle, grip, neck, blade);
  return g;
}

export function buildGardener() {
  const root = new THREE.Group();

  const body = new THREE.Group();
  root.add(body);

  body.add(box(0.52, 0.62, 0.32, SHIRT, [0, 1.12, 0]));       // torso
  body.add(box(0.5, 0.12, 0.34, 0x2f5d3a, [0, 0.84, 0]));      // belt

  const head = new THREE.Group();
  head.position.set(0, 1.6, 0);
  head.add(box(0.34, 0.34, 0.32, SKIN, [0, 0, 0]));
  head.add(box(0.06, 0.06, 0.02, 0x2b2b2b, [-0.09, 0.03, 0.165]));
  head.add(box(0.06, 0.06, 0.02, 0x2b2b2b, [0.09, 0.03, 0.165]));
  const hat = new THREE.Group();
  hat.position.y = 0.2;
  head.add(hat);
  body.add(head);

  const armL = new THREE.Group(); armL.position.set(-0.34, 1.36, 0);
  armL.add(box(0.16, 0.46, 0.16, SHIRT, [0, -0.23, 0]));
  armL.add(box(0.15, 0.14, 0.15, SKIN, [0, -0.52, 0]));
  const armR = armL.clone(); armR.position.x = 0.34;
  body.add(armL, armR);

  const legL = new THREE.Group(); legL.position.set(-0.14, 0.8, 0);
  legL.add(box(0.19, 0.5, 0.19, PANTS, [0, -0.25, 0]));
  legL.add(box(0.21, 0.12, 0.28, BOOT, [0, -0.55, 0.03]));
  const legR = legL.clone(); legR.position.x = 0.14;
  body.add(legL, legR);

  const shovel = buildShovel();
  shovel.position.set(0.02, -0.46, 0.12);
  shovel.rotation.set(-0.25, 0, -0.32);
  shovel.visible = false;
  armR.add(shovel);

  const torso = body.children[0];
  root.userData = { body, head, hat, armL, armR, legL, legR, shovel, torso, arms: [armL, armR], phase: 0 };
  setHat(root, 'straw');
  return root;
}

/**
 * @param {number} speed01 planar movement speed normalised to 0..1
 * @param {boolean} grounded
 */
export function setShovel(g, on) { g.userData.shovel.visible = on; }

/** Swap the gardener's hat for another. */
export function setHat(g, id) {
  const spec = HATS_BY_ID[id] || HATS_BY_ID.straw;
  const hat = g.userData.hat;
  if (hat.userData.id === spec.id) return;
  hat.userData.id = spec.id;
  hat.clear();
  const c = spec.color;
  switch (spec.id) {
    case 'cap':
      hat.add(box(0.36, 0.14, 0.34, c, [0, 0.05, 0]));
      hat.add(box(0.34, 0.04, 0.26, c, [0, 0, 0.28]));                       // peak
      break;
    case 'bucket':
      hat.add(box(0.38, 0.18, 0.36, c, [0, 0.07, 0]));
      hat.add(box(0.56, 0.05, 0.54, c, [0, 0, 0]));
      break;
    case 'cowboy':
      hat.add(box(0.72, 0.05, 0.6, c, [0, 0, 0]));
      hat.add(box(0.34, 0.2, 0.32, c, [0, 0.11, 0]));
      hat.add(box(0.36, 0.05, 0.34, 0x3e2723, [0, 0.03, 0]));
      break;
    case 'top':
      hat.add(box(0.56, 0.05, 0.54, c, [0, 0, 0]));
      hat.add(box(0.32, 0.42, 0.3, c, [0, 0.22, 0]));
      hat.add(box(0.34, 0.06, 0.32, 0xd32f2f, [0, 0.06, 0]));
      break;
    case 'wizard': {
      hat.add(box(0.62, 0.05, 0.6, c, [0, 0, 0]));
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.7, 7),
        new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8 }));
      cone.position.y = 0.36;
      cone.castShadow = true;
      hat.add(cone);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        hat.add(box(0.06, 0.06, 0.06, 0xffe082, [Math.cos(a) * 0.14, 0.25 + (i % 2) * 0.2, Math.sin(a) * 0.14]));
      }
      break;
    }
    case 'crown': {
      hat.add(box(0.4, 0.1, 0.38, c, [0, 0.04, 0]));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4),
          new THREE.MeshStandardMaterial({ color: c, flatShading: true, metalness: 0.7, roughness: 0.3 }));
        spike.position.set(Math.cos(a) * 0.17, 0.16, Math.sin(a) * 0.17);
        hat.add(spike);
      }
      break;
    }
    case 'halo': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 14),
        new THREE.MeshBasicMaterial({ color: c }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.24;
      hat.add(ring);
      break;
    }
    default:
      hat.add(box(0.62, 0.05, 0.62, c, [0, 0, 0]));                          // straw brim
      hat.add(box(0.34, 0.16, 0.32, c, [0, 0.09, 0]));
  }
}

/** Recolour the gardener's clothes. */
export function setOutfit(g, id) {
  const spec = OUTFITS_BY_ID[id] || OUTFITS_BY_ID.green;
  g.userData.torso.material.color.setHex(spec.color);
  for (const arm of g.userData.arms) {
    const sleeve = arm.children[0];
    if (sleeve) sleeve.material.color.setHex(spec.color);
  }
}

export function animateGardener(g, dt, speed01, grounded, t, digging = 0, attack = 0) {
  const u = g.userData;
  if (attack > 0) {
    u.armR.rotation.x = -1.5 - attack * 0.9;
    u.armL.rotation.x = -0.5;
    u.body.rotation.x = 0;
    return;
  }
  if (digging > 0) {
    // Both arms forward, a rhythmic dig; overrides the walk pose below.
    const swing = Math.sin(t * 9) * 0.45;
    u.armL.rotation.x = -1.15 + swing;
    u.armR.rotation.x = -1.15 + swing;
    u.legL.rotation.x = 0.1; u.legR.rotation.x = -0.1;
    u.body.rotation.x = 0.18 + swing * 0.12;
    return;
  }
  u.body.rotation.x = 0;
  u.phase += dt * (4 + speed01 * 9) * (speed01 > 0.02 ? 1 : 0);
  const swing = Math.sin(u.phase) * 0.75 * speed01;
  const idle = Math.sin(t * 1.6) * 0.04;

  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8 + idle;
  u.armR.rotation.x = swing * 0.8 + idle;
  u.body.position.y = Math.abs(Math.sin(u.phase)) * 0.05 * speed01;

  if (!grounded) {
    u.legL.rotation.x = 0.4; u.legR.rotation.x = -0.25;
    u.armL.rotation.x = -1.2; u.armR.rotation.x = -1.2;
  }
}
