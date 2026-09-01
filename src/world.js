// Scene construction: sky, lights, ground, garden plots, shop stall, scenery.

import * as THREE from 'three';
import { GRID_SIZE, PLOT_SPACING, PLOT_COUNT, fmt, plotCost } from './data.js';

/** Plot slots ordered so the ones you unlock first sit next to each other. */
export function plotLayout() {
  const cells = [];
  const half = (GRID_SIZE - 1) / 2;
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const px = (x - half) * PLOT_SPACING;
      const pz = (z - half) * PLOT_SPACING;
      cells.push({ x: px, z: pz, d: Math.hypot(px, pz), a: Math.atan2(pz, px) });
    }
  }
  cells.sort((p, q) => (p.d - q.d) || (p.a - q.a));
  return cells.slice(0, PLOT_COUNT);
}

function noiseTexture(base, speck, size = 128, density = 0.5) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = speck;
  const n = Math.floor(size * size * density * 0.06);
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.15 + Math.random() * 0.5;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function priceSprite(text) {
  const c = document.createElement('canvas');
  c.width = 384; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(18,26,20,0.82)';
  ctx.roundRect(6, 6, c.width - 12, c.height - 12, 22); ctx.fill();
  ctx.strokeStyle = '#f0c14b'; ctx.lineWidth = 5;
  ctx.roundRect(6, 6, c.width - 12, c.height - 12, 22); ctx.stroke();
  ctx.fillStyle = '#f7e7a8';
  ctx.font = 'bold 54px "Trebuchet MS", system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  spr.scale.set(1.55, 0.52, 1);
  return spr;
}

function fencePost(x, z) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x9c7b52, flatShading: true, roughness: 0.9 });
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), m);
  post.position.y = 0.55; post.castShadow = true;
  g.add(post);
  g.position.set(x, 0, z);
  return g;
}

export function buildWorld(scene) {
  scene.background = new THREE.Color(0x8fd0f2);
  scene.fog = new THREE.Fog(0x8fd0f2, 40, 130);

  const hemi = new THREE.HemisphereLight(0xcfe9ff, 0x4b7a3a, 1.0);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff3d6, 2.1);
  sun.position.set(18, 26, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 26;
  sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
  sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  const grass = noiseTexture('#5da34a', '#87c766', 128, 1);
  grass.repeat.set(60, 60);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ map: grass, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Rolling hills on the horizon so the world doesn't feel like a table top.
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x4e8f42, flatShading: true, roughness: 1 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.2;
    const r = 78 + Math.random() * 26;
    const h = new THREE.Mesh(new THREE.SphereGeometry(10 + Math.random() * 12, 7, 5), hillMat);
    h.position.set(Math.cos(a) * r, -3 - Math.random() * 3, Math.sin(a) * r);
    h.scale.y = 0.55;
    scene.add(h);
  }

  const soilTex = noiseTexture('#6b4a30', '#8a6242', 128, 1.4);
  soilTex.repeat.set(2, 2);
  const soilMat = new THREE.MeshStandardMaterial({ map: soilTex, roughness: 1 });
  const lockedMat = new THREE.MeshStandardMaterial({ color: 0x6f8f5c, roughness: 1, transparent: true, opacity: 0.75 });

  const layout = plotLayout();
  const plots = layout.map((cell, i) => {
    const group = new THREE.Group();
    group.position.set(cell.x, 0, cell.z);

    const soil = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.28, 2.2), soilMat);
    soil.position.y = 0.14;
    soil.receiveShadow = true;
    soil.castShadow = true;
    group.add(soil);

    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(2.36, 0.16, 2.36),
      new THREE.MeshStandardMaterial({ color: 0x8a6a45, flatShading: true, roughness: 0.9 })
    );
    rim.position.y = 0.08;
    rim.receiveShadow = true;
    group.add(rim);

    const locked = new THREE.Group();
    const patch = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 2.3), lockedMat);
    patch.position.y = 0.05;
    locked.add(patch);
    for (const [px, pz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
      const p = fencePost(px, pz); p.scale.setScalar(0.55); locked.add(p);
    }
    const label = priceSprite('₪ ' + fmt(plotCost(i)));
    label.position.set(0, 1.5, 0);
    locked.add(label);
    group.add(locked);

    // Invisible, generously sized target so aiming at a plot is forgiving.
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.4), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.0;
    hit.userData.plotIndex = i;
    group.add(hit);

    const highlight = new THREE.Mesh(
      new THREE.RingGeometry(1.16, 1.34, 4, 1),
      new THREE.MeshBasicMaterial({ color: 0xffe98a, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    highlight.rotation.x = -Math.PI / 2;
    highlight.rotation.z = Math.PI / 4;
    highlight.position.y = 0.3;
    highlight.visible = false;
    group.add(highlight);

    const cropAnchor = new THREE.Group();
    cropAnchor.position.y = 0.28;
    group.add(cropAnchor);

    scene.add(group);
    return { index: i, group, soil, rim, locked, label, hit, highlight, cropAnchor, crop: null, x: cell.x, z: cell.z };
  });

  const stall = buildStall();
  const edge = (GRID_SIZE / 2) * PLOT_SPACING + 4.2;
  stall.position.set(0, 0, edge);
  stall.rotation.y = Math.PI;
  scene.add(stall);

  scatterScenery(scene, edge);

  return { plots, stall, sun, ground };
}

function buildStall() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xa9713f, flatShading: true, roughness: 0.9 });
  const wood2 = new THREE.MeshStandardMaterial({ color: 0x7a4f2b, flatShading: true, roughness: 0.9 });

  const counter = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.0, 1.1), wood);
  counter.position.y = 0.5; counter.castShadow = true; counter.receiveShadow = true;
  g.add(counter);

  for (const x of [-2.0, 2.0]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.18), wood2);
    post.position.set(x, 1.3, -0.4); post.castShadow = true;
    g.add(post);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.22, 1.9), wood2);
  roof.position.set(0, 2.7, -0.2); roof.rotation.x = -0.14; roof.castShadow = true;
  g.add(roof);

  const stripes = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.1, 1.9),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0xf5f0e2 : 0xd8443c, flatShading: true, roughness: 0.9 })
    );
    m.position.set(-2.1 + i * 0.6, 2.86, -0.2);
    stripes.add(m);
  }
  stripes.rotation.x = -0.14;
  g.add(stripes);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 0.9),
    new THREE.MeshBasicMaterial({ map: signTexture(), transparent: true, side: THREE.DoubleSide })
  );
  sign.position.set(0, 1.95, 0.62);
  sign.rotation.y = Math.PI;
  g.add(sign);

  // Crates of seed packs on the counter.
  for (let i = 0; i < 3; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), wood2);
    crate.position.set(-1.2 + i * 1.2, 1.2, 0.05);
    crate.rotation.y = Math.random() * 0.6;
    crate.castShadow = true;
    g.add(crate);
  }
  return g;
}

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 680; c.height = 180;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4e3bb';
  ctx.roundRect(4, 4, c.width - 8, c.height - 8, 18); ctx.fill();
  ctx.strokeStyle = '#7a4f2b'; ctx.lineWidth = 8;
  ctx.roundRect(4, 4, c.width - 8, c.height - 8, 18); ctx.stroke();
  ctx.fillStyle = '#3d2b16';
  ctx.font = 'bold 62px "Trebuchet MS", system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('SEED SHOP', c.width / 2, 66);
  ctx.font = '34px "Trebuchet MS", system-ui, sans-serif';
  ctx.fillText('press  B  to browse', c.width / 2, 130);
  return new THREE.CanvasTexture(c);
}

function scatterScenery(scene, edge) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, flatShading: true, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7a35, flatShading: true, roughness: 1 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x9e9e93, flatShading: true, roughness: 1 });

  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = edge + 5 + Math.random() * 45;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.random() < 0.72) {
      const t = new THREE.Group();
      const h = 2 + Math.random() * 2;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, h, 6), trunkMat);
      trunk.position.y = h / 2; trunk.castShadow = true;
      const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 + Math.random(), 0), leafMat);
      top.position.y = h + 0.7; top.castShadow = true;
      t.add(trunk, top);
      t.position.set(x, 0, z);
      scene.add(t);
    } else {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.7, 0), rockMat);
      rock.position.set(x, 0.2, z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true; rock.receiveShadow = true;
      scene.add(rock);
    }
  }
}
