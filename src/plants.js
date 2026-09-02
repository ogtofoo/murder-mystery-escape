// Procedural low-poly plant models, one silhouette per `kind`.

import * as THREE from 'three';
import { TIERS, BUGS_BY_ID, dietSummary } from './data.js';

const geoCache = new Map();
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

function mat(color, tier, extra = {}) {
  const t = TIERS[tier];
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.75,
    metalness: t.shine > 0.5 ? 0.35 : 0.05,
    emissive: new THREE.Color(t.color).multiplyScalar(t.shine * 0.2),
    ...extra,
  });
}

/** Tag a mesh as the edible part, so it can regrow after a picking. */
function fruit(m) {
  m.userData.fruit = true;
  m.userData.baseScale = m.scale.clone();
  return m;
}

function mesh(g, m, pos, scale) {
  const o = new THREE.Mesh(g, m);
  if (pos) o.position.set(pos[0], pos[1], pos[2]);
  if (scale) Array.isArray(scale) ? o.scale.set(scale[0], scale[1], scale[2]) : o.scale.setScalar(scale);
  o.castShadow = true;
  return o;
}

const SPHERE = () => geo('sphere', () => new THREE.IcosahedronGeometry(0.5, 1));
const CONE = () => geo('cone', () => new THREE.ConeGeometry(0.5, 1, 7));
const CYL = () => geo('cyl', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 6));
const LEAF = () => geo('leaf', () => new THREE.ConeGeometry(0.28, 1, 4));
const RING = () => geo('ring', () => new THREE.TorusGeometry(0.5, 0.11, 5, 12));
const OCTA = () => geo('octa', () => new THREE.OctahedronGeometry(0.5, 0));
const RIB = () => geo('rib', () => new THREE.CylinderGeometry(0.42, 0.5, 1, 3));
const DISC = () => geo('disc', () => new THREE.CylinderGeometry(0.5, 0.5, 0.1, 12));
const BOX = () => geo('box', () => new THREE.BoxGeometry(1, 1, 1));
const SPIKE = () => geo('spike', () => new THREE.ConeGeometry(0.3, 1, 5));
const BALL = () => geo('ball', () => new THREE.SphereGeometry(0.5, 8, 6));


/**
 * One builder per crop shape. Each receives the group, the plant, and its two
 * tier-tinted materials, and is responsible for marking the edible parts with
 * fruit() so they regrow after a picking.
 */
const SHAPES = {
  // ---- pulled up whole -------------------------------------------------
  root(g, plant, { body, foliage }) {
    const root = mesh(CONE(), body, [0, 0.18, 0], [0.42, 0.7, 0.42]);
    root.rotation.x = Math.PI;
    g.add(root);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const l = mesh(LEAF(), foliage, [Math.cos(a) * 0.16, 0.55, Math.sin(a) * 0.16], [1, 0.85, 1]);
      l.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
      g.add(l);
    }
  },

  bulb(g, plant, { body, foliage }) {
    g.add(mesh(BALL(), body, [0, 0.3, 0], [0.62, 0.58, 0.62]));          // round red bulb
    const tip = mesh(CONE(), body, [0, 0.02, 0], [0.22, 0.34, 0.22]);
    tip.rotation.x = Math.PI;
    g.add(tip);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const l = mesh(LEAF(), foliage, [Math.cos(a) * 0.15, 0.72, Math.sin(a) * 0.15], [1.1, 0.7, 1.1]);
      l.rotation.set(Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6);
      g.add(l);
    }
  },

  head(g, plant, { body, foliage }) {
    // A lettuce: tight ball of leaves wrapped in looser outer ones.
    g.add(mesh(BALL(), body, [0, 0.44, 0], [0.78, 0.68, 0.78]));
    for (let ring = 0; ring < 2; ring++) {
      const n = 7 + ring * 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.5;
        const r = 0.28 + ring * 0.14;
        const l = mesh(LEAF(), ring ? foliage : body,
          [Math.cos(a) * r, 0.4 - ring * 0.16, Math.sin(a) * r], [1.5 + ring * 0.5, 0.42, 0.9]);
        l.rotation.set(Math.PI / 2 - 0.95 - ring * 0.5, -a, 0);
        g.add(l);
      }
    }
  },

  corn(g, plant, { body, foliage }) {
    g.add(mesh(CYL(), foliage, [0, 0.62, 0], [0.09, 1.24, 0.09]));       // stalk
    for (let i = 0; i < 5; i++) {                                        // drooping blades
      const a = (i / 5) * Math.PI * 2;
      const l = mesh(LEAF(), foliage, [Math.cos(a) * 0.26, 0.42 + (i % 3) * 0.26, Math.sin(a) * 0.26], [1.9, 1.0, 0.35]);
      l.rotation.set(Math.PI / 2 - 0.75, -a, 0);
      g.add(l);
    }
    const cob = fruit(mesh(CYL(), body, [0.17, 0.78, 0], [0.34, 0.72, 0.34]));   // fat yellow ear
    cob.rotation.z = -0.18;
    g.add(cob);
    for (let i = 0; i < 3; i++) {                                        // husk peeling back
      const a = (i / 3) * Math.PI * 2;
      const h = mesh(LEAF(), foliage, [0.17 + Math.cos(a) * 0.14, 0.72, Math.sin(a) * 0.14], [0.55, 0.8, 0.3]);
      h.rotation.set(0.2, -a, -0.18);
      g.add(h);
    }
    g.add(fruit(mesh(CONE(), mat(0xd7a86e, plant.tier), [0.17, 1.24, 0], [0.22, 0.4, 0.22])));  // silk tassel
  },

  glowroot(g, plant, { body, foliage }) {
    SHAPES.root(g, plant, { body, foliage });
    for (let i = 0; i < 3; i++) {                                        // humming rings
      const r = mesh(RING(), foliage, [0, 0.36 + i * 0.22, 0], 0.9 + i * 0.25);
      r.rotation.x = Math.PI / 2;
      r.userData.spin = 0.6 + i * 0.3;
      g.add(r);
    }
  },

  // ---- bushes and peppers ---------------------------------------------
  bush(g, plant, { body, foliage }) {
    g.add(mesh(CYL(), mat(0x6d4c41, plant.tier), [0, 0.18, 0], [0.11, 0.36, 0.11]));
    g.add(mesh(SPHERE(), foliage, [0, 0.6, 0], [1.05, 0.9, 1.05]));
    const berries = plant.id === 'blueberry' ? 9 : 4;
    for (let i = 0; i < berries; i++) {
      const a = (i / berries) * Math.PI * 2 + 0.4;
      const r = berries > 6 ? 0.42 : 0.46;
      g.add(fruit(mesh(SPHERE(), body,
        [Math.cos(a) * r, 0.52 + (i % 3) * 0.14, Math.sin(a) * r], berries > 6 ? 0.19 : 0.32)));
    }
  },

  pepper(g, plant, { body, foliage }) {
    g.add(mesh(CYL(), mat(0x5d4037, plant.tier), [0, 0.2, 0], [0.09, 0.4, 0.09]));
    g.add(mesh(SPHERE(), foliage, [0, 0.62, 0], [0.95, 0.8, 0.95]));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.5;
      // Long tapered pod hanging point-down.
      const pod = mesh(CONE(), body, [Math.cos(a) * 0.4, 0.5, Math.sin(a) * 0.4], [0.26, 0.54, 0.26]);
      pod.rotation.set(Math.cos(a) * 0.3, 0, Math.PI - Math.sin(a) * 0.3);
      g.add(fruit(pod));
    }
    if (plant.id === 'phoenix') {                                        // flickering flame
      const flame = mesh(CONE(), mat(0xffc107, plant.tier), [0, 1.15, 0], [0.3, 0.6, 0.3]);
      flame.userData.spin = 2.4;
      g.add(fruit(flame));
    }
  },

  // ---- ground fruit ----------------------------------------------------
  melon(g, plant, { body, foliage }) {
    const v = mesh(RING(), foliage, [0, 0.06, 0], [1.3, 1.3, 1.3]);
    v.rotation.x = Math.PI / 2;
    g.add(v);
    const melon = mesh(BALL(), body, [0, 0.44, 0], [1.15, 0.92, 1.15]);
    g.add(fruit(melon));
    for (let i = 0; i < 4; i++) {                                        // rind stripes
      const a = (i / 4) * Math.PI;
      const stripe = mesh(BOX(), foliage, [0, 0.44, 0], [0.05, 0.8, 0.98]);
      stripe.rotation.y = a;
      g.add(fruit(stripe));
    }
    g.add(mesh(CYL(), foliage, [0.3, 0.72, 0.2], [0.05, 0.24, 0.05]));
  },

  pumpkin(g, plant, { body, foliage }) {
    const v = mesh(RING(), foliage, [0, 0.06, 0], [1.25, 1.25, 1.25]);
    v.rotation.x = Math.PI / 2;
    g.add(v);
    for (let i = 0; i < 6; i++) {                                        // ribs
      const a = (i / 6) * Math.PI * 2;
      g.add(fruit(mesh(BALL(), body, [Math.cos(a) * 0.16, 0.42, Math.sin(a) * 0.16], [0.72, 0.6, 0.72])));
    }
    g.add(mesh(CYL(), foliage, [0, 0.74, 0], [0.09, 0.24, 0.09]));
  },

  gourd(g, plant, { body, foliage }) {
    const v = mesh(RING(), foliage, [0, 0.06, 0], [1.2, 1.2, 1.2]);
    v.rotation.x = Math.PI / 2;
    g.add(v);
    g.add(fruit(mesh(BALL(), body, [0, 0.34, 0], [0.86, 0.7, 0.86])));   // the peanut shape
    g.add(fruit(mesh(BALL(), body, [0, 0.74, 0], [0.6, 0.52, 0.6])));
    g.add(mesh(CYL(), foliage, [0, 1.0, 0], [0.06, 0.2, 0.06]));
  },

  grapes(g, plant, { body, foliage }) {
    g.add(mesh(CYL(), foliage, [0, 0.5, 0], [0.06, 1.0, 0.06]));         // vine post
    const arm = mesh(CYL(), foliage, [0.2, 0.98, 0], [0.05, 0.5, 0.05]);
    arm.rotation.z = Math.PI / 2;
    g.add(arm);
    for (let row = 0; row < 4; row++) {                                  // hanging bunch
      const n = 4 - row;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = 0.2 - row * 0.045;
        g.add(fruit(mesh(SPHERE(), body,
          [0.38 + Math.cos(a) * r, 0.82 - row * 0.16, Math.sin(a) * r], 0.2)));
      }
    }
    g.add(mesh(LEAF(), foliage, [0.1, 0.92, 0.16], [1.1, 0.4, 0.9]));
  },

  // ---- flowers ---------------------------------------------------------
  flower(g, plant, { body, foliage }) {
    g.add(mesh(CYL(), foliage, [0, 0.48, 0], [0.07, 0.96, 0.07]));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const p = mesh(SPHERE(), body, [Math.cos(a) * 0.44, 1.0, Math.sin(a) * 0.44], [0.58, 0.2, 0.34]);
      p.rotation.y = -a;
      g.add(fruit(p));
    }
    g.add(fruit(mesh(SPHERE(), mat(0xfff59d, plant.tier), [0, 1.04, 0], 0.3)));
    if (plant.id === 'moonflower') {                                     // crescent overhead
      const moon = mesh(RING(), mat(0xe3f2fd, plant.tier), [0, 1.4, 0], 0.7);
      moon.rotation.set(Math.PI / 2, 0, 0);
      moon.userData.spin = 0.5;
      g.add(moon);
    }
  },

  lotus(g, plant, { body, foliage }) {
    g.add(mesh(DISC(), foliage, [0, 0.08, 0], [2.1, 1, 2.1]));           // lily pad
    for (let ring = 0; ring < 3; ring++) {                               // stacked petals
      const n = 8 - ring;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.4;
        const r = 0.44 - ring * 0.12;
        const p = mesh(LEAF(), ring === 2 ? mat(0xfff3c4, plant.tier) : body,
          [Math.cos(a) * r, 0.22 + ring * 0.16, Math.sin(a) * r], [0.85, 0.5, 0.5]);
        p.rotation.set(Math.PI / 2 - 0.7 - ring * 0.3, -a, 0);
        g.add(fruit(p));
      }
    }
    g.add(fruit(mesh(SPHERE(), mat(0xffe082, plant.tier), [0, 0.66, 0], 0.2)));
  },

  rose(g, plant, { body, foliage }) {
    g.add(mesh(CYL(), foliage, [0, 0.42, 0], [0.06, 0.84, 0.06]));
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1;
      const l = mesh(LEAF(), foliage, [Math.cos(a) * 0.18, 0.34 + i * 0.14, Math.sin(a) * 0.18], [0.9, 0.35, 0.6]);
      l.rotation.set(Math.PI / 2 - 0.4, -a, 0);
      g.add(l);
    }
    for (let ring = 0; ring < 3; ring++) {                               // spiralled bloom
      const n = 7 - ring * 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.9;
        const r = 0.26 - ring * 0.07;
        const p = mesh(LEAF(), body, [Math.cos(a) * r, 0.86 + ring * 0.08, Math.sin(a) * r], [0.6, 0.42, 0.34]);
        p.rotation.set(Math.PI / 2 - 0.9 - ring * 0.25, -a, 0);
        g.add(fruit(p));
      }
    }
  },

  star(g, plant, { body, foliage }) {
    g.add(mesh(CYL(), foliage, [0, 0.34, 0], [0.07, 0.68, 0.07]));
    const bloom = new THREE.Group();
    bloom.position.set(0, 1.0, 0);
    for (let i = 0; i < 5; i++) {                                        // five flat points
      const a = (i / 5) * Math.PI * 2;
      const pt = mesh(CONE(), body, [Math.sin(a) * 0.36, Math.cos(a) * 0.36, 0], [0.42, 0.86, 0.16]);
      pt.rotation.z = -a;
      bloom.add(fruit(pt));
    }
    bloom.add(fruit(mesh(SPHERE(), mat(0xfff8e1, plant.tier), [0, 0, 0], [0.5, 0.5, 0.3])));
    bloom.userData.spin = 0.35;
    g.add(bloom);
    if (plant.id === 'superfruit') {                                     // a crown of sparks
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.add(mesh(OCTA(), mat(0xffffff, plant.tier), [Math.cos(a) * 0.85, 1.0 + Math.sin(a * 2) * 0.25, Math.sin(a) * 0.85], 0.14));
      }
    }
  },

  clock(g, plant, { body, foliage }) {
    g.add(mesh(CYL(), foliage, [0, 0.3, 0], [0.06, 0.6, 0.06]));
    const face = fruit(mesh(DISC(), body, [0, 0.86, 0], [1.1, 1.6, 1.1]));
    face.rotation.x = Math.PI / 2;
    g.add(face);
    const hourHand = mesh(BOX(), mat(0x263238, plant.tier), [0, 0.86, 0.03], [0.045, 0.3, 0.03]);
    hourHand.userData.spin = 0.6;
    const minHand = mesh(BOX(), mat(0x263238, plant.tier), [0, 0.86, 0.05], [0.035, 0.44, 0.03]);
    minHand.userData.spin = 2.2;
    for (const h of [hourHand, minHand]) { h.position.y = 0.86; g.add(fruit(h)); }
    const rim = mesh(RING(), foliage, [0, 0.86, 0], 1.2);
    rim.userData.spin = -0.4;
    g.add(rim);
  },

  // ---- trees -----------------------------------------------------------
  tree(g, plant, { body, foliage }) {
    g.add(mesh(CYL(), mat(0x5d4037, plant.tier), [0, 0.5, 0], [0.16, 1.0, 0.16]));
    g.add(mesh(SPHERE(), foliage, [0, 1.15, 0], [1.3, 1.1, 1.3]));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(fruit(mesh(SPHERE(), body, [Math.cos(a) * 0.62, 1.0 + (i % 2) * 0.26, Math.sin(a) * 0.62], 0.34)));
    }
  },

  cointree(g, plant, { body, foliage }) {
    g.add(mesh(CYL(), foliage, [0, 0.5, 0], [0.17, 1.0, 0.17]));
    g.add(mesh(SPHERE(), mat(0x7cb342, plant.tier), [0, 1.15, 0], [1.25, 1.05, 1.25]));
    for (let i = 0; i < 6; i++) {                                        // hanging coins
      const a = (i / 6) * Math.PI * 2;
      const coin = mesh(DISC(), body, [Math.cos(a) * 0.6, 0.95 + (i % 2) * 0.3, Math.sin(a) * 0.6], [0.5, 0.6, 0.5]);
      coin.rotation.set(Math.PI / 2, 0, a);
      coin.userData.spin = 1.5;
      g.add(fruit(coin));
    }
  },

  // ---- carnivores ------------------------------------------------------
  trap(g, plant, { body, foliage, cA }) {
    g.add(mesh(CYL(), foliage, [0, 0.3, 0], [0.1, 0.6, 0.1]));
    for (let i = 0; i < 3; i++) {                                        // ground leaves
      const a = (i / 3) * Math.PI * 2;
      const l = mesh(LEAF(), foliage, [Math.cos(a) * 0.35, 0.1, Math.sin(a) * 0.35], [1.1, 0.5, 0.6]);
      l.rotation.set(Math.PI / 2 - 0.25, -a, 0);
      g.add(l);
    }
    // Two hinged lobes that snap shut when the plant catches something.
    const jaw = new THREE.Group();
    jaw.position.set(0, 0.66, 0);
    for (const side of [-1, 1]) {
      const half = new THREE.Group();
      half.add(mesh(SPHERE(), mat(cA, plant.tier), [0, 0, 0.18], [0.62, 0.16, 0.7]));
      for (let i = 0; i < 6; i++) {                                      // teeth
        const t = mesh(CONE(), mat(0xfff3e0, plant.tier), [-0.26 + i * 0.105, 0.02, 0.42], [0.09, 0.22, 0.09]);
        t.rotation.x = -0.5;
        half.add(t);
      }
      half.rotation.z = 0;
      half.rotation.x = side * 0.55;
      half.userData.jaw = side;
      jaw.add(half);
    }
    jaw.userData.isJaw = true;
    g.add(jaw);
    g.userData.jaw = jaw;
  },

  pitcher(g, plant, { body, foliage, cA }) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const l = mesh(LEAF(), foliage, [Math.cos(a) * 0.38, 0.12, Math.sin(a) * 0.38], [1.2, 0.5, 0.7]);
      l.rotation.set(Math.PI / 2 - 0.3, -a, 0);
      g.add(l);
    }
    g.add(mesh(CYL(), foliage, [0, 0.34, 0], [0.07, 0.68, 0.07]));
    const jug = mesh(CYL(), mat(cA, plant.tier), [0.05, 0.68, 0], [0.44, 0.78, 0.44]);
    g.add(jug);
    g.add(mesh(RING(), mat(0xffe0b2, plant.tier), [0.05, 1.06, 0], 0.5));  // slippery rim
    const lid = new THREE.Group();
    lid.position.set(0.05, 1.08, 0);
    const flap = mesh(SPHERE(), foliage, [0, 0.02, -0.2], [0.5, 0.1, 0.44]);
    lid.add(flap);
    lid.rotation.x = -0.7;
    lid.userData.isJaw = true;
    g.add(lid);
    g.userData.jaw = lid;
  },

  maw(g, plant, { body, foliage, cA, cB }) {
    const stalk = mesh(CYL(), mat(cB, plant.tier), [0, 0.34, 0], [0.16, 0.68, 0.16]);
    g.add(stalk);
    for (let i = 0; i < 4; i++) {                                        // grasping vines
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const v = mesh(CYL(), mat(cB, plant.tier), [Math.cos(a) * 0.34, 0.2, Math.sin(a) * 0.34], [0.06, 0.5, 0.06]);
      v.rotation.set(Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7);
      g.add(v);
    }
    const jaw = new THREE.Group();
    jaw.position.set(0, 0.8, 0);
    for (const side of [-1, 1]) {
      const half = new THREE.Group();
      half.add(mesh(SPHERE(), mat(cA, plant.tier), [0, 0, 0], [0.9, 0.42, 0.86]));
      for (let i = 0; i < 8; i++) {                                      // a ring of fangs
        const a = (i / 8) * Math.PI * 2;
        const t = mesh(CONE(), mat(0xffffff, plant.tier), [Math.cos(a) * 0.34, side * 0.14, Math.sin(a) * 0.34], [0.1, 0.3, 0.1]);
        t.rotation.x = side > 0 ? Math.PI : 0;
        half.add(t);
      }
      half.position.y = side * 0.2;
      half.rotation.x = side * 0.35;
      half.userData.jaw = side;
      jaw.add(half);
    }
    jaw.userData.isJaw = true;
    g.add(jaw);
    g.userData.jaw = jaw;
  },

  pitaya(g, plant, { body, foliage, cA, cB }) {
    const stemMat = mat(cB, plant.tier);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const h = 0.66 + (i % 2) * 0.18;
      const stem = mesh(RIB(), stemMat, [Math.cos(a) * 0.19, h / 2, Math.sin(a) * 0.19], [0.16, h, 0.16]);
      stem.rotation.set(Math.cos(a) * 0.24, a, -Math.sin(a) * 0.24);
      g.add(stem);
    }
    const flesh = mat(cA, plant.tier);
    const tipMat = mat(0x7cb342, plant.tier);
    const berry = new THREE.Group();
    berry.position.set(0, 0.86, 0);
    const rx = 0.33, ry = 0.46;
    berry.add(mesh(SPHERE(), flesh, [0, 0, 0], [rx * 2, ry * 2, rx * 2]));
    for (let i = 0; i < 12; i++) {
      const th = 0.5 + (i % 4) * 0.52;
      const ph = i * 2.399;
      const nx = Math.sin(th) * Math.cos(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.sin(ph);
      const pivot = new THREE.Group();
      pivot.position.set(nx * rx * 0.9, ny * ry * 0.9, nz * rx * 0.9);
      pivot.lookAt(nx * 3, ny * 3 + 1.6, nz * 3);
      const scale = mesh(LEAF(), flesh, [0, 0, 0.03], [0.95, 0.16, 0.4]);
      scale.rotation.x = -Math.PI / 2;
      const tip = mesh(LEAF(), tipMat, [0, 0, 0.13], [0.5, 0.1, 0.24]);
      tip.rotation.x = -Math.PI / 2;
      pivot.add(scale, tip);
      berry.add(pivot);
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const c = mesh(LEAF(), tipMat, [Math.cos(a) * 0.08, ry + 0.06, Math.sin(a) * 0.08], [0.34, 0.26, 0.34]);
      c.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
      berry.add(c);
    }
    fruit(berry);
    g.add(berry);
  },
};

/**
 * Build the mesh for a plant. Returns a Group whose base sits at y=0,
 * with `userData.rainbowParts` listing materials that hue-cycle.
 */
export function buildPlant(plant) {
  const g = new THREE.Group();
  const [cA, cB] = plant.colors;
  const body = mat(cA, plant.tier);
  const foliage = mat(cB, plant.tier);
  const rainbow = TIERS[plant.tier].rainbow ? [body, foliage] : [];

  (SHAPES[plant.kind] || SHAPES.bush)(g, plant, { body, foliage, cA, cB });

  g.userData.rainbowParts = rainbow;
  g.userData.spinners = g.children.filter(c => c.userData.spin);
  g.userData.fruits = g.children.filter(c => c.userData.fruit);
  g.userData.allParts = [];
  g.traverse(o => { if (o.isMesh) g.userData.allParts.push(o); });
  return g;
}

const _c = new THREE.Color();

/**
 * Hang fruit on a carnivore that looks like the bugs it has been eating —
 * a little body, wings and legs in that species' colour.
 */
export function setCarnivoreFruit(group, diet) {
  const d = dietSummary(diet);
  const key = d ? d.main.id + ':' + Math.min(4, Math.round(d.total / 4)) : 'none';
  if (group.userData.dietKey === key) return;
  group.userData.dietKey = key;

  for (const old of group.userData.bugFruit || []) group.remove(old);
  group.userData.bugFruit = [];
  group.userData.fruits = group.userData.fruits.filter(f => !f.userData.bugFruit);
  if (!d) return;

  const shell = new THREE.MeshStandardMaterial({
    color: d.main.color, flatShading: true, roughness: 0.5, metalness: 0.3,
    emissive: new THREE.Color(0xff1744).multiplyScalar(0.15),
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, flatShading: true });
  const count = Math.min(4, 1 + Math.floor(d.total / 6));

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.6;
    const pod = new THREE.Group();
    pod.position.set(Math.cos(a) * 0.62, 0.55 + (i % 2) * 0.2, Math.sin(a) * 0.62);
    pod.add(mesh(SPHERE(), shell, [0, 0, 0], [0.34, 0.26, 0.46]));       // bug-shaped body
    pod.add(mesh(SPHERE(), shell, [0, 0.04, 0.24], 0.2));                // head
    for (const side of [-1, 1]) {                                        // legs and feelers
      for (let l = 0; l < 3; l++) {
        pod.add(mesh(CYL(), dark, [side * 0.16, -0.06, -0.12 + l * 0.14], [0.022, 0.16, 0.022]));
      }
      pod.add(mesh(CYL(), dark, [side * 0.06, 0.16, 0.3], [0.018, 0.16, 0.018]));
    }
    pod.userData.fruit = true;
    pod.userData.bugFruit = true;
    pod.userData.baseScale = pod.scale.clone();
    pod.rotation.y = -a;
    group.add(pod);
    group.userData.bugFruit.push(pod);
    group.userData.fruits.push(pod);
    group.userData.allParts.push(...pod.children);
  }
}

/**
 * Dress a ripe crop in whatever it mutated into: gold and silver plate the
 * fruit, rainbow makes it cycle, and the weather marks add a coloured glow.
 */
export function applyMutation(group, mut, colorOf) {
  const had = group.userData.mutation;
  if (had === (mut ? mut.v + '|' + mut.m : null)) return;
  group.userData.mutation = mut ? mut.v + '|' + mut.m : null;

  const tint = mut ? colorOf(mut) : null;
  group.userData.mutRainbow = mut?.v === 'rainbow';
  for (const part of group.userData.allParts) {
    const base = part.userData.baseColor ??= part.material.color.getHex();
    const baseEm = part.userData.baseEmissive ??= part.material.emissive?.getHex() ?? 0;
    if (!tint) {
      part.material.color.setHex(base);
      part.material.emissive?.setHex(baseEm);
      part.material.metalness = part.userData.baseMetal ?? part.material.metalness;
      continue;
    }
    part.userData.baseMetal ??= part.material.metalness;
    if (mut.v === 'gold' || mut.v === 'silver') {
      part.material.color.setHex(tint);          // plated all over
      part.material.metalness = 0.85;
      part.material.emissive?.setHex(0x000000);
    } else {
      part.material.color.setHex(base);          // keep the crop's own colour
      part.material.emissive?.setHex(tint);
    }
  }
}

/**
 * Per-frame flourish: rainbow tiers cycle hue, orbs spin, ripe crops bob, and
 * the edible parts swell as the crop ripens (`fill`, 0..1).
 */
export function animatePlant(group, t, dt, ripe, fill = 1) {
  if (group.userData.mutRainbow) {
    _c.setHSL((t * 0.4) % 1, 0.9, 0.6);
    for (const p of group.userData.allParts) p.material.emissive?.copy(_c).multiplyScalar(0.7);
  }
  for (const m of group.userData.rainbowParts) {
    _c.setHSL((t * 0.15 + (m.userData.hueOffset ?? (m.userData.hueOffset = Math.random()))) % 1, 0.75, 0.6);
    m.emissive.copy(_c).multiplyScalar(0.34);
  }
  for (const s of group.userData.spinners) s.rotation.y += s.userData.spin * dt;

  const jaw = group.userData.jaw;
  if (jaw) {
    // 1 right after a catch, easing back to a slow hungry gape.
    const snap = group.userData.snap || 0;
    const idle = 0.5 + Math.sin(t * 1.3 + group.userData.phase) * 0.12;
    for (const half of jaw.children) {
      const side = half.userData.jaw;
      if (side === undefined) { jaw.rotation.x = -0.7 * (1 - snap); continue; }
      half.rotation.x = side * (idle * (1 - snap) + 0.02 * snap);
    }
  }
  for (const f of group.userData.fruits) {
    const k = 0.1 + 0.9 * fill * fill;
    f.scale.copy(f.userData.baseScale).multiplyScalar(k);
    f.visible = fill > 0.05;
  }
  if (ripe) {
    group.position.y = Math.sin(t * 2.2 + group.userData.phase) * 0.05;
    group.rotation.y = Math.sin(t * 0.8 + group.userData.phase) * 0.08;
  } else {
    group.position.y = 0;
  }
}
