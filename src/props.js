// Decorations and garden defences: models plus a light for the lantern.

import * as THREE from 'three';
import { PROPS_BY_ID, DEFENCES_BY_ID } from './data.js';

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...opts });
}

function part(geo, m, pos, scale, rot) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(pos[0], pos[1], pos[2]);
  if (scale) Array.isArray(scale) ? o.scale.set(...scale) : o.scale.setScalar(scale);
  if (rot) o.rotation.set(rot[0], rot[1], rot[2]);
  o.castShadow = true;
  return o;
}

const G = {};
const g = (k, make) => (G[k] ||= make());
const box = () => g('box', () => new THREE.BoxGeometry(1, 1, 1));
const ball = () => g('ball', () => new THREE.IcosahedronGeometry(0.5, 1));
const cyl = () => g('cyl', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8));
const cone = () => g('cone', () => new THREE.ConeGeometry(0.5, 1, 7));
const torus = () => g('torus', () => new THREE.TorusGeometry(0.5, 0.09, 6, 14));

const WOOD = 0x9c7b52, DARKWOOD = 0x6d4c41, STONE = 0x9e9e93, GOLD = 0xffd54f;

const SHAPES = {
  fence(root) {
    for (const x of [-0.55, 0.55]) root.add(part(box(), mat(WOOD), [x, 0.45, 0], [0.12, 0.9, 0.12]));
    for (const y of [0.34, 0.66]) root.add(part(box(), mat(WOOD), [0, y, 0], [1.3, 0.1, 0.08]));
  },
  path(root) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      root.add(part(cyl(), mat(STONE), [Math.cos(a) * 0.4, 0.04, Math.sin(a) * 0.4], [0.42, 0.08, 0.42]));
    }
    root.add(part(cyl(), mat(STONE), [0, 0.04, 0], [0.5, 0.08, 0.5]));
  },
  lantern(root) {
    root.add(part(cyl(), mat(DARKWOOD), [0, 0.5, 0], [0.1, 1.0, 0.1]));
    root.add(part(cyl(), mat(STONE), [0, 0.05, 0], [0.44, 0.1, 0.44]));
    const glass = part(box(), new THREE.MeshBasicMaterial({ color: 0xfff3c4 }), [0, 1.12, 0], [0.28, 0.32, 0.28]);
    glass.userData.glow = true;
    root.add(glass);
    root.add(part(cone(), mat(DARKWOOD), [0, 1.38, 0], [0.4, 0.22, 0.4]));
  },
  topiary(root) {
    root.add(part(cyl(), mat(DARKWOOD), [0, 0.16, 0], [0.22, 0.32, 0.22]));
    root.add(part(ball(), mat(0x4caf50), [0, 0.6, 0], 0.78));
    root.add(part(ball(), mat(0x66bb6a), [0, 1.06, 0], 0.5));
  },
  birdbath(root) {
    root.add(part(cyl(), mat(STONE), [0, 0.3, 0], [0.24, 0.6, 0.24]));
    root.add(part(cyl(), mat(STONE), [0, 0.64, 0], [0.86, 0.14, 0.86]));
    root.add(part(cyl(), new THREE.MeshStandardMaterial({ color: 0x64b5f6, roughness: 0.2, metalness: 0.3 }),
      [0, 0.7, 0], [0.7, 0.06, 0.7]));
  },
  gnome(root) {
    root.add(part(cyl(), mat(0x1e88e5), [0, 0.22, 0], [0.34, 0.44, 0.34]));
    root.add(part(ball(), mat(0xf3d3b5), [0, 0.5, 0], 0.26));
    root.add(part(ball(), mat(0xfafafa), [0, 0.42, 0.13], [0.24, 0.22, 0.18]));
    root.add(part(cone(), mat(0xd84315), [0, 0.72, 0], [0.32, 0.46, 0.32]));
  },
  statue(root) {
    root.add(part(box(), mat(STONE), [0, 0.12, 0], [0.9, 0.24, 0.9]));
    root.add(part(cyl(), mat(GOLD, { metalness: 0.8, roughness: 0.25 }), [0, 0.6, 0], [0.3, 0.7, 0.3]));
    root.add(part(ball(), mat(GOLD, { metalness: 0.8, roughness: 0.25 }), [0, 1.06, 0], 0.42));
    for (const side of [-1, 1]) {
      root.add(part(cyl(), mat(GOLD, { metalness: 0.8, roughness: 0.25 }),
        [side * 0.26, 0.74, 0], [0.12, 0.5, 0.12], [0, 0, side * 0.6]));
    }
  },
  arch(root) {
    for (const x of [-0.7, 0.7]) root.add(part(cyl(), mat(DARKWOOD), [x, 0.9, 0], [0.12, 1.8, 0.12]));
    const top = part(torus(), mat(DARKWOOD), [0, 1.8, 0], [1.45, 1.45, 1.45]);
    top.rotation.x = 0;
    root.add(top);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (i / 8);
      root.add(part(ball(), mat(i % 2 ? 0xff4081 : 0xf06292),
        [Math.cos(a) * 0.72, 1.8 + Math.sin(a) * 0.72, 0], 0.2));
    }
  },
  // ---- defences ----
  scarecrow(root) {
    root.add(part(cyl(), mat(DARKWOOD), [0, 0.7, 0], [0.12, 1.4, 0.12]));
    root.add(part(box(), mat(DARKWOOD), [0, 1.05, 0], [1.2, 0.1, 0.1]));
    root.add(part(ball(), mat(0xd7ccc8), [0, 1.5, 0], 0.44));            // sackcloth head
    root.add(part(cone(), mat(0x8d6e63), [0, 1.78, 0], [0.62, 0.3, 0.62]));
    for (const side of [-1, 1]) root.add(part(ball(), new THREE.MeshBasicMaterial({ color: 0x212121 }),
      [side * 0.13, 1.55, 0.3], 0.07));
    root.add(part(box(), mat(0x8bc34a), [0, 1.0, 0], [0.7, 0.7, 0.2]));  // shirt
  },
  trap(root) {
    root.add(part(cyl(), mat(0x546e7a, { metalness: 0.7, roughness: 0.3 }), [0, 0.05, 0], [0.7, 0.1, 0.7]));
    for (const side of [-1, 1]) {
      const jaw = part(cyl(), mat(0x78909c, { metalness: 0.8, roughness: 0.25 }),
        [0, 0.16, side * 0.22], [0.66, 0.06, 0.12], [side * 0.5, 0, 0]);
      root.add(jaw);
      for (let i = 0; i < 5; i++) {
        root.add(part(cone(), mat(0xcfd8dc, { metalness: 0.8 }),
          [-0.24 + i * 0.12, 0.28, side * 0.24], [0.07, 0.2, 0.07], [side * 0.5, 0, 0]));
      }
    }
  },
  lamp(root) {
    root.add(part(cyl(), mat(0x455a64), [0, 0.06, 0], [0.6, 0.12, 0.6]));
    root.add(part(cyl(), mat(0x607d8b), [0, 0.8, 0], [0.14, 1.6, 0.14]));
    const head = part(box(), mat(0x37474f), [0, 1.65, 0], [0.7, 0.24, 0.5]);
    root.add(head);
    const glass = part(box(), new THREE.MeshBasicMaterial({ color: 0xfff8e1 }), [0, 1.52, 0], [0.6, 0.06, 0.42]);
    glass.userData.glow = true;
    root.add(glass);
  },
};

const DEFENCE_SHAPE = { def_scarecrow: 'scarecrow', def_trap: 'trap', def_lamp: 'lamp' };

/** Build a decoration or a defence by its id. */
export function buildProp(id) {
  const spec = PROPS_BY_ID[id] || DEFENCES_BY_ID[id];
  if (!spec) return null;
  const shape = SHAPES[spec.shape || DEFENCE_SHAPE[id]];
  if (!shape) return null;
  const root = new THREE.Group();
  shape(root);
  root.userData.spec = spec;
  root.userData.glows = [];
  root.traverse(o => { if (o.userData.glow) root.userData.glows.push(o); });
  if (root.userData.glows.length) {
    const light = new THREE.PointLight(0xffe082, 0, 12);
    light.position.set(0, 1.3, 0);
    root.add(light);
    root.userData.light = light;
  }
  return root;
}

/** Lanterns and flood lamps come on after dark. */
export function litProp(prop, night) {
  if (!prop.userData.light) return;
  const want = night ? (prop.userData.spec.id === 'def_lamp' ? 90 : 26) : 0;
  prop.userData.light.intensity += (want - prop.userData.light.intensity) * 0.06;
  for (const g of prop.userData.glows) {
    g.material.color.setHex(night ? 0xfff3c4 : 0xbdb9a6);
  }
}
