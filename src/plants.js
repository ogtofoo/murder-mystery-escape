// Procedural low-poly plant models, one silhouette per `kind`.

import * as THREE from 'three';
import { TIERS } from './data.js';

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
    emissive: new THREE.Color(t.color).multiplyScalar(t.shine * 0.35),
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

  switch (plant.kind) {
    case 'root': {
      const root = mesh(CONE(), body, [0, 0.18, 0], [0.42, 0.7, 0.42]);
      root.rotation.x = Math.PI; // taper points down into the soil
      g.add(root);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const l = mesh(LEAF(), foliage, [Math.cos(a) * 0.16, 0.55, Math.sin(a) * 0.16], [1, 0.85, 1]);
        l.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
        g.add(l);
      }
      break;
    }
    case 'leaf': {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const h = 0.8 + (i % 3) * 0.18;
        const l = mesh(LEAF(), i % 2 ? foliage : body, [Math.cos(a) * 0.18, h * 0.5, Math.sin(a) * 0.18], [1.1, h, 1.1]);
        l.rotation.set(Math.cos(a) * 0.35, a, -Math.sin(a) * 0.35);
        g.add(l);
      }
      break;
    }
    case 'bush': {
      g.add(mesh(CYL(), mat(0x6d4c41, plant.tier), [0, 0.18, 0], [0.11, 0.36, 0.11]));
      g.add(mesh(SPHERE(), foliage, [0, 0.6, 0], [1.05, 0.9, 1.05]));
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        g.add(fruit(mesh(SPHERE(), body, [Math.cos(a) * 0.46, 0.58 + (i % 2) * 0.16, Math.sin(a) * 0.46], 0.32)));
      }
      break;
    }
    case 'vine': {
      const v = mesh(RING(), foliage, [0, 0.06, 0], [1.3, 1.3, 1.3]);
      v.rotation.x = Math.PI / 2;
      g.add(v);
      g.add(fruit(mesh(SPHERE(), body, [0, 0.42, 0], [1.15, 0.9, 1.15])));
      g.add(fruit(mesh(SPHERE(), foliage, [0.5, 0.2, -0.35], 0.34)));
      break;
    }
    case 'flower': {
      g.add(mesh(CYL(), foliage, [0, 0.4, 0], [0.07, 0.8, 0.07]));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const p = mesh(SPHERE(), body, [Math.cos(a) * 0.34, 0.86, Math.sin(a) * 0.34], [0.42, 0.16, 0.24]);
        p.rotation.y = -a;
        g.add(fruit(p));
      }
      g.add(fruit(mesh(SPHERE(), mat(0xfff59d, plant.tier), [0, 0.9, 0], 0.26)));
      break;
    }
    case 'pitaya': {
      // A climbing cactus: three ribbed stems, with a scaly ovoid fruit on top.
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

      // Bracts: broad flat scales lying back along the fruit, green at the tips.
      for (let i = 0; i < 12; i++) {
        const th = 0.5 + (i % 4) * 0.52;             // pole to pole down the fruit
        const ph = i * 2.399;                        // golden angle, so they don't line up
        const nx = Math.sin(th) * Math.cos(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.sin(ph);
        const pivot = new THREE.Group();
        pivot.position.set(nx * rx * 0.9, ny * ry * 0.9, nz * rx * 0.9);
        // Aim mostly outward but swept upward, so the scale hugs the fruit.
        pivot.lookAt(nx * 3, ny * 3 + 1.6, nz * 3);
        const scale = mesh(LEAF(), flesh, [0, 0, 0.03], [0.95, 0.16, 0.4]);
        scale.rotation.x = -Math.PI / 2;             // cone points along the pivot's +Z
        const tip = mesh(LEAF(), tipMat, [0, 0, 0.13], [0.5, 0.1, 0.24]);
        tip.rotation.x = -Math.PI / 2;
        pivot.add(scale, tip);
        berry.add(pivot);
      }
      // Green crown where the flower was.
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const c = mesh(LEAF(), tipMat, [Math.cos(a) * 0.08, ry + 0.06, Math.sin(a) * 0.08], [0.34, 0.26, 0.34]);
        c.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
        berry.add(c);
      }
      fruit(berry);
      g.add(berry);
      break;
    }
    case 'tree': {
      g.add(mesh(CYL(), mat(0x5d4037, plant.tier), [0, 0.5, 0], [0.16, 1.0, 0.16]));
      g.add(mesh(SPHERE(), foliage, [0, 1.15, 0], [1.3, 1.1, 1.3]));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.add(fruit(mesh(SPHERE(), body, [Math.cos(a) * 0.62, 1.0 + (i % 2) * 0.26, Math.sin(a) * 0.62], 0.34)));
      }
      break;
    }
    case 'orb':
    default: {
      const core = fruit(mesh(OCTA(), body, [0, 0.72, 0], 0.85));
      core.userData.spin = 1;
      g.add(core);
      const r1 = mesh(RING(), foliage, [0, 0.72, 0], 1.5);
      r1.rotation.x = Math.PI / 2.4;
      r1.userData.spin = -0.6;
      g.add(r1);
      const r2 = mesh(RING(), foliage, [0, 0.72, 0], 1.2);
      r2.rotation.z = Math.PI / 3;
      r2.userData.spin = 0.9;
      g.add(r2);
      break;
    }
  }

  g.userData.rainbowParts = rainbow;
  g.userData.spinners = g.children.filter(c => c.userData.spin);
  g.userData.fruits = g.children.filter(c => c.userData.fruit);
  return g;
}

const _c = new THREE.Color();

/**
 * Per-frame flourish: rainbow tiers cycle hue, orbs spin, ripe crops bob, and
 * the edible parts swell as the crop ripens (`fill`, 0..1).
 */
export function animatePlant(group, t, dt, ripe, fill = 1) {
  for (const m of group.userData.rainbowParts) {
    _c.setHSL((t * 0.15 + (m.userData.hueOffset ?? (m.userData.hueOffset = Math.random()))) % 1, 0.75, 0.6);
    m.emissive.copy(_c).multiplyScalar(0.5);
  }
  for (const s of group.userData.spinners) s.rotation.y += s.userData.spin * dt;
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
