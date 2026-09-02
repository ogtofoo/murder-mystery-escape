// The gardener: a low-poly character with a straw hat, animated limbs.

import * as THREE from 'three';

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
  head.add(box(0.62, 0.05, 0.62, HAT, [0, 0.2, 0]));           // hat brim
  head.add(box(0.34, 0.16, 0.32, HAT, [0, 0.29, 0]));          // hat crown
  head.add(box(0.06, 0.06, 0.02, 0x2b2b2b, [-0.09, 0.03, 0.165]));
  head.add(box(0.06, 0.06, 0.02, 0x2b2b2b, [0.09, 0.03, 0.165]));
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

  root.userData = { body, head, armL, armR, legL, legR, shovel, phase: 0 };
  return root;
}

/**
 * @param {number} speed01 planar movement speed normalised to 0..1
 * @param {boolean} grounded
 */
export function setShovel(g, on) { g.userData.shovel.visible = on; }

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
