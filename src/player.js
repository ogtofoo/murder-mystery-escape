// Player controller: WASD + mouse look, jumping, and a first/third person camera.

import * as THREE from 'three';
import { buildGardener, buildShovel, animateGardener, setShovel } from './gardener.js';

const WALK = 5.2;
const SPRINT = 9.0;
const GRAVITY = 22;
const JUMP = 8.0;
const EYE = 1.62;
const FOV_FIRST = 90;    // roomier when you're inside the gardener's head
const FOV_THIRD = 72;
const WORLD_RADIUS = 72;

export class Player {
  constructor(scene, camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.model = buildGardener();
    scene.add(this.model);

    // A shovel held in view for first person. Parented to the camera, which is
    // added to the scene so its children are rendered.
    this.fpShovel = buildShovel();
    this.fpShovel.position.set(0.34, -0.30, -0.62);
    this.fpShovel.rotation.set(0.15, -0.4, 0.5);
    this.fpShovel.scale.setScalar(0.8);
    this.fpShovel.visible = false;
    camera.add(this.fpShovel);
    scene.add(camera);

    this.shovel = false;
    this.digging = 0;

    this.pos = new THREE.Vector3(0, 0, 9);
    this.vy = 0;
    this.grounded = true;
    this.yaw = Math.PI;      // facing the garden
    this.pitch = -0.12;
    this.view = 'third';     // 'third' | 'first'
    this.camDistance = 6.0;
    this.speed01 = 0;
    this.keys = new Set();
    this.locked = false;
    this.pad = null;         // per-frame gamepad sample, set by main
    this.dragging = false;   // click-drag look, for when pointer lock is unavailable
    this._smoothCam = new THREE.Vector3();
    this._first = true;

    this._onKeyDown = e => {
      if (e.code === 'Tab') e.preventDefault();
      this.keys.add(e.code);
    };
    this._onKeyUp = e => this.keys.delete(e.code);
    this._onMouseMove = e => {
      if (!this.locked && !this.dragging) return;
      const s = 0.0022;
      this.yaw -= e.movementX * s;
      this.pitch -= e.movementY * s;
      this.pitch = Math.max(-1.35, Math.min(1.2, this.pitch));
    };
    this._onWheel = e => {
      if (this.view !== 'third') return;
      this.camDistance = Math.max(2.6, Math.min(11, this.camDistance + Math.sign(e.deltaY) * 0.6));
    };

    domElement.addEventListener('mousedown', e => { if (e.button === 0 && !this.locked) this.dragging = true; });
    window.addEventListener('mouseup', () => { this.dragging = false; });
    window.addEventListener('blur', () => { this.keys.clear(); this.dragging = false; });
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('wheel', this._onWheel, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (!this.locked) this.keys.clear();
    });
  }

  requestLock() {
    if (document.pointerLockElement === this.dom) return;
    try {
      const r = this.dom.requestPointerLock?.();
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch (err) { /* not allowed right now; click the page to capture the mouse */ }
  }

  /** Equip or stow the shovel. */
  setShovel(on) {
    this.shovel = on;
    setShovel(this.model, on);
    return on;
  }

  toggleView() {
    this.view = this.view === 'third' ? 'first' : 'third';
    this._first = true;
    return this.view;
  }

  /** World-space point the player's eyes sit at. */
  headPosition(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + EYE, this.pos.z);
  }

  /** Unit vector the player is looking along. */
  lookDirection(out = new THREE.Vector3()) {
    return out.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();
  }

  update(dt, t, inputEnabled) {
    const k = inputEnabled ? this.keys : new Set();
    let fx = 0, fz = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) fz += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) fz -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) fx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) fx += 1;

    // Analog stick adds to the keyboard; stick up (-y) is forward.
    const pad = inputEnabled ? this.pad : null;
    if (pad) {
      fx += pad.move.x;
      fz -= pad.move.y;
      this.yaw -= pad.look.x * pad.lookSpeed * dt;
      this.pitch -= pad.look.y * pad.lookSpeed * dt;
      this.pitch = Math.max(-1.35, Math.min(1.2, this.pitch));
    }

    let len = Math.hypot(fx, fz);
    if (len > 1) { fx /= len; fz /= len; len = 1; }
    const sprinting = k.has('ShiftLeft') || k.has('ShiftRight') || !!pad?.sprint;
    const speed = sprinting ? SPRINT : WALK;

    if (len > 0.01) {
      // Forward is (sin yaw, cos yaw); right is forward x up = (-cos yaw, sin yaw).
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const dx = fz * sin - fx * cos;
      const dz = fz * cos + fx * sin;
      this.pos.x += dx * speed * dt;
      this.pos.z += dz * speed * dt;
      this.speed01 = (sprinting ? 1 : 0.6) * Math.min(1, len);
      // Face the direction of travel (third person only; first person always faces the camera).
      const target = Math.atan2(dx, dz);
      this.model.rotation.y = dampAngle(this.model.rotation.y, target, 14, dt);
    } else {
      this.speed01 = 0;
      if (this.view === 'first') this.model.rotation.y = this.yaw;
    }

    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > WORLD_RADIUS) {
      this.pos.x *= WORLD_RADIUS / r;
      this.pos.z *= WORLD_RADIUS / r;
    }

    if (this.grounded && (k.has('Space') || pad?.jump)) { this.vy = JUMP; this.grounded = false; }
    this.vy -= GRAVITY * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; this.grounded = true; }

    this.model.position.copy(this.pos);
    this.model.visible = this.view === 'third';
    this.fpShovel.visible = this.shovel && this.view === 'first';
    if (this.fpShovel.visible) {
      // Little heft as you walk, and a chop while digging.
      const bob = Math.sin(t * 8) * 0.02 * this.speed01;
      this.fpShovel.position.set(0.34, -0.30 + bob - this.digging * 0.12, -0.62);
      this.fpShovel.rotation.x = 0.15 + Math.sin(t * 9) * 0.35 * this.digging;
    }
    animateGardener(this.model, dt, this.speed01, this.grounded, t, this.digging);

    this.updateCamera(dt);
  }

  updateCamera(dt) {
    // Ease between the two field-of-view settings so switching isn't a jolt.
    const wantFov = this.view === 'first' ? FOV_FIRST : FOV_THIRD;
    if (Math.abs(this.camera.fov - wantFov) > 0.05) {
      this.camera.fov += (wantFov - this.camera.fov) * (1 - Math.exp(-12 * dt));
      this.camera.updateProjectionMatrix();
    }

    const head = this.headPosition();
    const dir = this.lookDirection();

    if (this.view === 'first') {
      this.camera.position.copy(head).addScaledVector(dir, 0.18);
    } else {
      const target = head.clone().addScaledVector(dir, 0.5);
      target.y += 0.45;
      const want = target.clone().addScaledVector(dir, -this.camDistance);
      want.y = Math.max(0.6, want.y);
      if (this._first) this._smoothCam.copy(want);
      else this._smoothCam.lerp(want, 1 - Math.pow(0.0015, dt));
      this.camera.position.copy(this._smoothCam);
    }
    this._first = false;
    this.camera.lookAt(
      this.camera.position.x + dir.x,
      this.camera.position.y + dir.y,
      this.camera.position.z + dir.z
    );
  }
}

function dampAngle(current, target, lambda, dt) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return current + diff * (1 - Math.exp(-lambda * dt));
}
