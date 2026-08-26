// Wobbly low-poly character built from primitives, plus its wobble animation.

import * as THREE from 'three';
import { CHARACTERS } from '/shared/constants.js';

export function charDef(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}

function makeNameSprite(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  const w = Math.min(240, ctx.measureText(name).width + 28);
  ctx.beginPath();
  ctx.roundRect(128 - w / 2, 8, w, 48, 24);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(2.4, 0.6, 1);
  sprite.position.y = 2.35;
  return sprite;
}

export function buildCharacter(def, name = '') {
  const group = new THREE.Group();
  const mats = {
    body: new THREE.MeshToonMaterial({ color: def.body }),
    belly: new THREE.MeshToonMaterial({ color: def.belly }),
    accent: new THREE.MeshToonMaterial({ color: def.accent }),
    white: new THREE.MeshToonMaterial({ color: '#ffffff' }),
    dark: new THREE.MeshToonMaterial({ color: '#1c2026' }),
  };

  // Squishy egg body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 16), mats.body);
  body.scale.set(1, 1.25, 0.9);
  body.position.y = 0.85;
  body.castShadow = true;
  group.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), mats.belly);
  belly.scale.set(1, 1.15, 0.62);
  belly.position.set(0, 0.78, 0.28);
  group.add(belly);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), mats.body);
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);

  // Eyes
  for (const s of [-1, 1]) {
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mats.white);
    eyeWhite.position.set(0.16 * s, 1.92, 0.34);
    head.attach ? group.add(eyeWhite) : group.add(eyeWhite);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), mats.dark);
    pupil.position.set(0.16 * s, 1.92, 0.44);
    group.add(pupil);
  }

  // Arms — pivoted at the shoulder so they can swing
  const armGeo = new THREE.CapsuleGeometry(0.11, 0.42, 4, 8);
  const armL = new THREE.Group(); armL.position.set(-0.62, 1.28, 0);
  const armR = new THREE.Group(); armR.position.set(0.62, 1.28, 0);
  for (const [pivot, s] of [[armL, -1], [armR, 1]]) {
    const arm = new THREE.Mesh(armGeo, mats.accent);
    arm.position.set(0.04 * s, -0.28, 0);
    arm.rotation.z = 0.28 * s;
    pivot.add(arm);
    group.add(pivot);
  }

  // Stubby legs
  const legGeo = new THREE.CapsuleGeometry(0.14, 0.22, 4, 8);
  const legL = new THREE.Group(); legL.position.set(-0.24, 0.34, 0);
  const legR = new THREE.Group(); legR.position.set(0.24, 0.34, 0);
  for (const pivot of [legL, legR]) {
    const leg = new THREE.Mesh(legGeo, mats.accent);
    leg.position.y = -0.16;
    pivot.add(leg);
    group.add(pivot);
  }

  let nameSprite = null;
  if (name) { nameSprite = makeNameSprite(name); group.add(nameSprite); }

  return {
    group, mats,
    parts: { body, belly, head, armL, armR, legL, legR },
    nameSprite,
    def,
    phase: Math.random() * 10,
  };
}

// Re-tint an existing character (used by the Shapeshift ability).
export function retint(char, def) {
  char.mats.body.color.set(def.body);
  char.mats.belly.color.set(def.belly);
  char.mats.accent.color.set(def.accent);
}

export function setGhost(char, ghost) {
  for (const m of Object.values(char.mats)) {
    m.transparent = ghost;
    m.opacity = ghost ? 0.35 : 1;
    m.depthWrite = !ghost;
  }
  if (char.nameSprite) char.nameSprite.material.opacity = ghost ? 0.35 : 1;
}

// Wobble: bounce + waddle while moving, gentle breathing while idle.
export function animateCharacter(char, time, moving) {
  const t = time * (moving ? 11 : 2.2) + char.phase;
  const { body, head, armL, armR, legL, legR } = char.parts;
  if (moving) {
    const s = Math.sin(t);
    char.group.position.y = Math.abs(Math.sin(t)) * 0.12;
    char.group.rotation.z = Math.sin(t) * 0.07;
    body.rotation.x = 0.09;
    head.position.y = 1.85 + Math.abs(Math.sin(t + 0.5)) * 0.05;
    armL.rotation.x = s * 0.9;
    armR.rotation.x = -s * 0.9;
    legL.rotation.x = -s * 1.1;
    legR.rotation.x = s * 1.1;
  } else {
    const s = Math.sin(t);
    char.group.position.y = 0;
    char.group.rotation.z = 0;
    body.rotation.x = 0;
    body.scale.y = 1.25 + s * 0.02;
    head.position.y = 1.85 + s * 0.02;
    armL.rotation.x = s * 0.06;
    armR.rotation.x = s * 0.06;
    legL.rotation.x = 0;
    legR.rotation.x = 0;
  }
}

// A dead body: the character lying on its back with X eyes.
export function makeBody(def) {
  const char = buildCharacter(def, '');
  char.group.rotation.x = -Math.PI / 2;
  char.group.position.y = 0.35;
  const holder = new THREE.Group();
  holder.add(char.group);
  // X eyes
  const mat = new THREE.MeshBasicMaterial({ color: '#1c2026' });
  for (const s of [-1, 1]) {
    for (const r of [0.6, -0.6]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), mat);
      bar.position.set(0.16 * s, 0.5, 1.92);
      bar.rotation.z = r;
      holder.add(bar);
    }
  }
  return holder;
}
