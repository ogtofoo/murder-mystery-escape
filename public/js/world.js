// Builds the 3D facility from the shared map: floor, walls, crates, task
// stations, escape door, meeting button, lights.

import * as THREE from 'three';
import { MAP } from '/shared/map.js';

export function buildWorld(scene) {
  const world = { stationMeshes: new Map(), doorMesh: null, buttonMesh: null };

  // Floor
  const b = MAP.bounds;
  const floorGeo = new THREE.PlaneGeometry(b.maxX - b.minX + 4, b.maxZ - b.minZ + 4);
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshToonMaterial({ color: MAP.floorColor }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  // Room floor tints + glowing labels on the floor
  for (const room of MAP.rooms) {
    const tint = new THREE.Mesh(
      new THREE.PlaneGeometry(room.w, room.d),
      new THREE.MeshToonMaterial({ color: room.color, transparent: true, opacity: 0.35 })
    );
    tint.rotation.x = -Math.PI / 2;
    tint.position.set(room.x, 0.02, room.z);
    scene.add(tint);

    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(20,26,40,0.55)';
    ctx.fillText(room.name.toUpperCase(), 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 2.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(room.x, 0.03, room.z - room.d / 2 + 2.2);
    scene.add(label);
  }

  // Walls & crates
  const wallMat = new THREE.MeshToonMaterial({ color: '#5c6b85' });
  const wallTopMat = new THREE.MeshToonMaterial({ color: '#48546b' });
  const crateMat = new THREE.MeshToonMaterial({ color: '#b08850' });
  for (const wall of MAP.walls) {
    const mat = wall.crate ? crateMat : wallMat;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.w, wall.h, wall.d), mat);
    mesh.position.set(wall.x, wall.h / 2, wall.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (!wall.crate) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(wall.w + 0.12, 0.14, wall.d + 0.12), wallTopMat);
      cap.position.set(wall.x, wall.h + 0.07, wall.z);
      scene.add(cap);
    }
  }

  // Escape door (removed when tasks complete)
  const d = MAP.escapeDoor;
  const doorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(d.w, d.h, d.d),
    new THREE.MeshToonMaterial({ color: '#c23a3a', emissive: '#3a0808' })
  );
  doorMesh.position.set(d.x, d.h / 2, d.z);
  scene.add(doorMesh);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(d.w + 0.05, 0.5, d.d + 0.05),
    new THREE.MeshBasicMaterial({ color: '#ffd166' })
  );
  stripe.position.set(d.x, d.h / 2, d.z);
  doorMesh.add(new THREE.Group());
  scene.add(stripe);
  world.doorMesh = doorMesh;
  world.doorStripe = stripe;

  // Escape zone marker (glowing pad)
  const z = MAP.escapeZone;
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(z.r, 32),
    new THREE.MeshBasicMaterial({ color: '#2ecc71', transparent: true, opacity: 0.4 })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(z.x, 0.04, z.z);
  scene.add(pad);
  world.escapePad = pad;

  // Task stations: little consoles with a blinking light
  for (const st of MAP.stations) {
    const g = new THREE.Group();
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.7), new THREE.MeshToonMaterial({ color: '#3d4a63' }));
    desk.position.y = 0.5;
    desk.castShadow = true;
    g.add(desk);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.6, 0.08), new THREE.MeshBasicMaterial({ color: '#39d2c0' }));
    screen.position.set(0, 1.25, 0);
    screen.rotation.x = -0.25;
    g.add(screen);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd166' }));
    lamp.position.set(0.45, 1.1, 0.2);
    g.add(lamp);
    g.position.set(st.x, 0, st.z);
    // Face toward the map center so screens are visible
    g.lookAt(new THREE.Vector3(st.x * 0.2, 0, st.z * 0.2));
    scene.add(g);
    world.stationMeshes.set(st.id, { group: g, screen, lamp, def: st });
  }

  // Meeting button: red button on a pedestal at the hub
  const mb = MAP.meetingButton;
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 0.9, 16), new THREE.MeshToonMaterial({ color: '#4a5670' }));
  pedestal.position.set(mb.x, 0.45, mb.z);
  pedestal.castShadow = true;
  scene.add(pedestal);
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.18, 16), new THREE.MeshToonMaterial({ color: '#e4405f', emissive: '#5c0a1a' }));
  button.position.set(mb.x, 0.98, mb.z);
  scene.add(button);
  world.buttonMesh = button;

  // Lighting
  scene.background = new THREE.Color('#2a3852');
  scene.fog = new THREE.Fog('#2a3852', 55, 110);
  const ambient = new THREE.AmbientLight('#c8d4ec', 1.5);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight('#dce8ff', '#5a6a52', 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
  sun.shadow.camera.far = 140;
  scene.add(sun);
  world.ambient = ambient;
  world.sun = sun;

  return world;
}

export function setDoorOpen(world, open) {
  world.doorMesh.visible = !open;
  world.doorStripe.visible = !open;
}

// Blinking station lamps + escape pad pulse.
export function animateWorld(world, time, doorOpen) {
  const blink = (Math.sin(time * 4) + 1) / 2;
  for (const { lamp } of world.stationMeshes.values()) {
    lamp.material.color.setHSL(0.12, 0.9, 0.3 + blink * 0.4);
  }
  world.escapePad.material.opacity = doorOpen ? 0.35 + blink * 0.4 : 0.12;
}
