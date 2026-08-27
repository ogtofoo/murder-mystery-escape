// Builds the themed 3D world from a procedurally generated map descriptor.

import * as THREE from 'three';
import { THEMES } from '/shared/constants.js';

export function themeById(id) {
  return THEMES.find(t => t.id === id) || THEMES[0];
}

function labelPlane(text, w, h, color = 'rgba(20,26,40,0.55)', fontSize = 56) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  );
}

// Removes every mesh added by a previous buildWorld call.
export function clearWorld(scene, world) {
  if (!world) return;
  for (const obj of world.objects) {
    scene.remove(obj);
    obj.traverse?.((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        for (const m of mats) { m.map?.dispose?.(); m.dispose(); }
      }
    });
  }
}

export function buildWorld(scene, map, themeId) {
  const th = themeById(themeId);
  const world = {
    theme: th, map,
    objects: [],
    stationMeshes: new Map(),
    doorMeshes: new Map(),
    collectMeshes: new Map(),
    buttonMesh: null, terminalMesh: null, escapePad: null,
  };
  const add = (obj) => { scene.add(obj); world.objects.push(obj); return obj; };

  // Floor
  const b = map.bounds;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(b.maxX - b.minX + 4, b.maxZ - b.minZ + 4),
    new THREE.MeshToonMaterial({ color: th.floor })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  floor.receiveShadow = true;
  add(floor);

  // Room tints + name labels on the floor
  map.rooms.forEach((room, i) => {
    const tint = new THREE.Mesh(
      new THREE.PlaneGeometry(room.w, room.d),
      new THREE.MeshToonMaterial({ color: th.tints[i % th.tints.length], transparent: true, opacity: 0.4 })
    );
    tint.rotation.x = -Math.PI / 2;
    tint.position.set(room.x, 0.02, room.z);
    add(tint);

    const label = labelPlane(room.name.toUpperCase(), Math.min(room.w * 0.8, 14), 3);
    label.rotation.x = -Math.PI / 2;
    label.position.set(room.x, 0.03, room.z - room.d / 2 + 2.6);
    add(label);
  });

  // Walls & crates
  const wallMat = new THREE.MeshToonMaterial({ color: th.wall });
  const wallTopMat = new THREE.MeshToonMaterial({ color: th.wallTop });
  const crateMat = new THREE.MeshToonMaterial({ color: th.crate });
  for (const wall of map.walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.w, wall.h, wall.d), wallMat);
    mesh.position.set(wall.x, wall.h / 2, wall.z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    add(mesh);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(wall.w + 0.12, 0.14, wall.d + 0.12), wallTopMat);
    cap.position.set(wall.x, wall.h + 0.07, wall.z);
    add(cap);
  }
  for (const c of map.crates) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), crateMat);
    mesh.position.set(c.x, c.h / 2, c.z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    add(mesh);
  }

  // Doors — colored slabs with a status stripe; hidden when unlocked
  for (const door of map.doors) {
    const group = new THREE.Group();
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(door.w, door.h, door.d),
      new THREE.MeshToonMaterial({
        color: door.final ? '#8a2be2' : th.door,
        emissive: door.final ? '#2a0845' : '#2a0808',
      })
    );
    slab.position.y = door.h / 2;
    slab.castShadow = true;
    group.add(slab);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(door.w + 0.06, 0.45, door.d + 0.06),
      new THREE.MeshBasicMaterial({ color: th.stripe })
    );
    stripe.position.y = door.h * 0.62;
    group.add(stripe);
    group.position.set(door.x, 0, door.z);
    add(group);
    world.doorMeshes.set(door.id, { group, slab, stripe, def: door });
  }

  // Task stations
  for (const st of map.stations) {
    const g = new THREE.Group();
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.7), new THREE.MeshToonMaterial({ color: th.wallTop }));
    desk.position.y = 0.5; desk.castShadow = true;
    g.add(desk);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.6, 0.08), new THREE.MeshBasicMaterial({ color: th.accent }));
    screen.position.set(0, 1.25, 0);
    screen.rotation.x = -0.25;
    g.add(screen);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: th.stripe }));
    lamp.position.set(0.45, 1.1, 0.2);
    g.add(lamp);
    g.position.set(st.x, 0, st.z);
    const room = map.rooms.find(r => r.id === st.roomId);
    if (room) g.lookAt(new THREE.Vector3(room.x, 0, room.z));
    add(g);
    world.stationMeshes.set(st.id, { group: g, screen, lamp, def: st });
  }

  // Collectables: key (golden) & code (glowing tablet)
  for (const c of map.collectables) {
    const g = new THREE.Group();
    if (c.kind === 'key') {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 8), new THREE.MeshToonMaterial({ color: '#ffd700', emissive: '#5a4a00' }));
      shaft.rotation.z = Math.PI / 2;
      g.add(shaft);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 16), new THREE.MeshToonMaterial({ color: '#ffd700', emissive: '#5a4a00' }));
      ring.position.x = -0.45;
      g.add(ring);
      for (const dx of [0.2, 0.34]) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.07), new THREE.MeshToonMaterial({ color: '#ffd700' }));
        tooth.position.set(dx, -0.14, 0);
        g.add(tooth);
      }
    } else {
      const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.08), new THREE.MeshToonMaterial({ color: '#1c2740' }));
      g.add(tablet);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.68), new THREE.MeshBasicMaterial({ color: th.accent }));
      glow.position.z = 0.05;
      g.add(glow);
    }
    g.position.set(c.x, 1.1, c.z);
    add(g);
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 6, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: c.kind === 'key' ? '#ffd700' : th.accent, transparent: true, opacity: 0.14, side: THREE.DoubleSide })
    );
    beacon.position.set(c.x, 3, c.z);
    add(beacon);
    world.collectMeshes.set(c.id, { group: g, beacon, def: c });
  }

  // Exit terminal (where key + code get delivered)
  {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.9), new THREE.MeshToonMaterial({ color: th.wallTop }));
    base.position.y = 0.8; base.castShadow = true;
    g.add(base);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshBasicMaterial({ color: '#8a2be2' }));
    panel.position.set(0, 1.1, 0.46);
    g.add(panel);
    for (const [i, dx] of [[0, -0.35], [1, 0.35]]) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.1), new THREE.MeshBasicMaterial({ color: '#332' }));
      slot.position.set(dx, 1.55, 0.4);
      g.add(slot);
      g.userData[`slot${i}`] = slot;
    }
    g.position.set(map.exitTerminal.x, 0, map.exitTerminal.z);
    add(g);
    world.terminalMesh = g;
    const lbl = labelPlane('EXIT TERMINAL', 6, 1.6, 'rgba(200,160,255,0.75)', 44);
    lbl.rotation.x = -Math.PI / 2;
    lbl.position.set(map.exitTerminal.x, 0.04, map.exitTerminal.z + 2.4);
    add(lbl);
  }

  // Meeting button
  {
    const mb = map.meetingButton;
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 0.9, 16), new THREE.MeshToonMaterial({ color: th.wallTop }));
    pedestal.position.set(mb.x, 0.45, mb.z);
    pedestal.castShadow = true;
    add(pedestal);
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.18, 16), new THREE.MeshToonMaterial({ color: '#e4405f', emissive: '#5c0a1a' }));
    button.position.set(mb.x, 0.98, mb.z);
    add(button);
    world.buttonMesh = button;
  }

  // Escape pad in the exit room
  {
    const z = map.escapeZone;
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(z.r, 32),
      new THREE.MeshBasicMaterial({ color: '#2ecc71', transparent: true, opacity: 0.4 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(z.x, 0.04, z.z);
    add(pad);
    world.escapePad = pad;
  }

  // Lighting & atmosphere
  scene.background = new THREE.Color(th.bg);
  scene.fog = new THREE.Fog(th.bg, 55, 115);
  const ambient = new THREE.AmbientLight('#c8d4ec', 1.4);
  add(ambient);
  const hemi = new THREE.HemisphereLight('#dce8ff', th.ground, 0.9);
  add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e0', 2.1);
  sun.position.set(30, 55, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.7;
  sun.shadow.camera.left = -span; sun.shadow.camera.right = span;
  sun.shadow.camera.top = span; sun.shadow.camera.bottom = -span;
  sun.shadow.camera.far = 180;
  add(sun);
  world.ambient = ambient;
  world.sun = sun;

  return world;
}

export function setDoorOpen(world, doorId, open) {
  const d = world.doorMeshes.get(doorId);
  if (d) d.group.visible = !open;
}

export function setStationDone(world, stationId, done) {
  const s = world.stationMeshes.get(stationId);
  if (!s) return;
  s.screen.material.color.set(done ? '#5fd98a' : world.theme.accent);
  s.done = done;
}

export function setCollectableVisible(world, id, visible, pos) {
  const c = world.collectMeshes.get(id);
  if (!c) return;
  c.group.visible = visible;
  c.beacon.visible = visible;
  if (pos) {
    c.group.position.x = pos.x; c.group.position.z = pos.z;
    c.beacon.position.x = pos.x; c.beacon.position.z = pos.z;
  }
}

// Engineer SCAN: make an item's beacon tall, bright and visible through walls.
export function setScanMark(world, id, on, pos) {
  const c = world.collectMeshes.get(id);
  if (!c) return;
  c.scanned = on;
  c.beacon.material.depthTest = !on;
  c.beacon.material.opacity = on ? 0.4 : 0.14;
  c.beacon.scale.y = on ? 4 : 1;
  c.beacon.renderOrder = on ? 999 : 0;
  c.beacon.visible = true;
  if (pos) {
    c.beacon.position.x = pos.x;
    c.beacon.position.z = pos.z;
  }
  c.beacon.position.y = on ? 11 : 3;
}

export function animateWorld(world, time, finalOpen) {
  const blink = (Math.sin(time * 4) + 1) / 2;
  for (const s of world.stationMeshes.values()) {
    if (s.done) continue;
    s.lamp.material.color.setHSL(0.12, 0.9, 0.3 + blink * 0.4);
  }
  for (const c of world.collectMeshes.values()) {
    if (c.scanned) c.beacon.material.opacity = 0.25 + blink * 0.35;
    if (!c.group.visible) continue;
    c.group.rotation.y = time * 1.4;
    c.group.position.y = 1.1 + Math.sin(time * 2) * 0.18;
    if (!c.scanned) c.beacon.material.opacity = 0.08 + blink * 0.12;
  }
  world.escapePad.material.opacity = finalOpen ? 0.35 + blink * 0.4 : 0.12;
  // Locked doors pulse their stripe
  for (const d of world.doorMeshes.values()) {
    if (!d.group.visible) continue;
    d.stripe.material.color.setHSL(d.def.final ? 0.78 : 0.12, 0.9, 0.35 + blink * 0.3);
  }
}
