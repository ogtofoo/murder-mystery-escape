// Unified input: keyboard + mouse, touch (virtual joystick + look area), gamepad.
// Produces a movement vector, camera-look deltas, and edge-triggered actions.

export class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.move = { x: 0, z: 0 };        // -1..1 in screen space (x right, z forward)
    this.lookDX = 0; this.lookDY = 0;  // accumulated, consumed each frame
    this.actions = new Set();          // edge-triggered action names
    this.pointerLocked = false;
    this.isTouch = false;
    this.gamepadIndex = null;
    this.prevPadButtons = [];
    // Which device the player last actually used, so the HUD can label
    // buttons with the right prompt (keyboard key vs. controller face button).
    this.lastDevice = 'kbd';   // 'kbd' | 'pad' | 'touch'

    this.initKeyboard();
    this.initMouse();
    this.initTouch();
    this.initGamepad();
  }

  fire(action) { this.actions.add(action); }

  consumeActions() {
    const a = [...this.actions];
    this.actions.clear();
    return a;
  }

  consumeLook() {
    const d = { x: this.lookDX, y: this.lookDY };
    this.lookDX = 0; this.lookDY = 0;
    return d;
  }

  // ---------- keyboard ----------
  initKeyboard() {
    // 'use' is the contextual primary action (repair / grab / insert).
    // Space and E both fire it; F and Q both kill.
    const actionKeys = {
      KeyE: 'use', Space: 'use',
      KeyF: 'kill', KeyQ: 'kill',
      KeyR: 'report', KeyT: 'meeting',
      Digit1: 'ability0', Digit2: 'ability1',
    };
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      this.keys.add(e.code);
      this.lastDevice = 'kbd';
      if (actionKeys[e.code]) { e.preventDefault(); this.fire(actionKeys[e.code]); }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  keyboardMove() {
    let x = 0, z = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    return { x, z };
  }

  // ---------- mouse ----------
  initMouse() {
    this.canvas.addEventListener('click', () => {
      if (!this.isTouch && !this.pointerLocked && document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock?.();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
    window.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        if (e.movementX || e.movementY) this.lastDevice = 'kbd';
        this.lookDX += e.movementX * 0.0026;
        this.lookDY += e.movementY * 0.0022;
      }
    });
  }

  releasePointer() {
    if (this.pointerLocked) document.exitPointerLock?.();
  }

  // ---------- touch ----------
  initTouch() {
    const joyZone = document.getElementById('joystick-zone');
    const joyBase = document.getElementById('joystick-base');
    const joyKnob = document.getElementById('joystick-knob');
    const lookZone = document.getElementById('look-zone');
    let joyId = null, joyOrigin = null;
    let lookId = null, lookPrev = null;

    const markTouch = () => {
      if (!this.isTouch) { this.isTouch = true; document.body.classList.add('touch'); }
      this.lastDevice = 'touch';
    };
    window.addEventListener('touchstart', markTouch, { once: true, passive: true });

    joyZone.addEventListener('touchstart', (e) => {
      markTouch();
      const t = e.changedTouches[0];
      joyId = t.identifier;
      joyOrigin = { x: t.clientX, y: t.clientY };
      joyBase.style.display = 'block';
      joyBase.style.left = `${t.clientX - 60}px`;
      joyBase.style.top = `${t.clientY - 60}px`;
      joyKnob.style.transform = 'translate(0px, 0px)';
      e.preventDefault();
    }, { passive: false });

    const joyEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          joyId = null;
          this.touchMove = null;
          joyBase.style.display = 'none';
        }
      }
    };
    joyZone.addEventListener('touchend', joyEnd);
    joyZone.addEventListener('touchcancel', joyEnd);
    joyZone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        const dx = t.clientX - joyOrigin.x, dy = t.clientY - joyOrigin.y;
        const len = Math.hypot(dx, dy);
        const max = 52;
        const cl = Math.min(len, max);
        const nx = len ? dx / len : 0, ny = len ? dy / len : 0;
        joyKnob.style.transform = `translate(${nx * cl}px, ${ny * cl}px)`;
        this.touchMove = { x: (nx * cl) / max, z: (ny * cl) / max };
      }
      e.preventDefault();
    }, { passive: false });

    lookZone.addEventListener('touchstart', (e) => {
      markTouch();
      const t = e.changedTouches[0];
      lookId = t.identifier;
      lookPrev = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    const lookEnd = (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
    };
    lookZone.addEventListener('touchend', lookEnd);
    lookZone.addEventListener('touchcancel', lookEnd);
    lookZone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lookId) continue;
        this.lookDX += (t.clientX - lookPrev.x) * 0.006;
        this.lookDY += (t.clientY - lookPrev.y) * 0.005;
        lookPrev = { x: t.clientX, y: t.clientY };
      }
      e.preventDefault();
    }, { passive: false });
  }

  // ---------- gamepad ----------
  initGamepad() {
    window.addEventListener('gamepadconnected', (e) => {
      if (e?.gamepad) this.gamepadIndex = e.gamepad.index;
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (e?.gamepad && this.gamepadIndex === e.gamepad.index) {
        this.gamepadIndex = null;
        this.lastDevice = 'kbd';
      }
    });
  }

  pollGamepad() {
    if (this.gamepadIndex === null) return null;
    const pad = navigator.getGamepads?.()[this.gamepadIndex];
    if (!pad) return null;
    const dead = (v) => (Math.abs(v) < 0.15 ? 0 : v);
    const move = { x: dead(pad.axes[0]), z: dead(pad.axes[1]) };
    // Any real stick or button activity hands the prompts over to the pad.
    if (move.x || move.z || pad.buttons.some(b => b.pressed)) this.lastDevice = 'pad';
    this.lookDX += dead(pad.axes[2] ?? 0) * 0.045;
    this.lookDY += dead(pad.axes[3] ?? 0) * 0.035;
    // Edge-detect buttons: A=use, X=kill, Y=report, B=ability0, LB=ability1, Start=meeting
    const mapping = { 0: 'use', 2: 'kill', 3: 'report', 1: 'ability0', 4: 'ability1', 9: 'meeting' };
    for (const [idx, action] of Object.entries(mapping)) {
      const pressed = pad.buttons[idx]?.pressed;
      if (pressed && !this.prevPadButtons[idx]) this.fire(action);
      this.prevPadButtons[idx] = pressed;
    }
    return move;
  }

  // Prompt label for an action on whichever device is currently in use.
  // Xbox face buttons: A=use, X=kill, Y=report, B=ability1, LB=ability2.
  promptFor(action) {
    if (this.lastDevice === 'touch') return '';
    const pad = { use: 'A', kill: 'X', report: 'Y', meeting: '☰', ability0: 'B', ability1: 'LB' };
    const kbd = { use: 'E', kill: 'Q', report: 'R', meeting: 'T', ability0: '1', ability1: '2' };
    return (this.lastDevice === 'pad' ? pad : kbd)[action] || '';
  }

  // Combined movement vector (screen space; caller rotates by camera yaw).
  getMove() {
    const pad = this.pollGamepad();
    let { x, z } = this.keyboardMove();
    if (this.touchMove) { x = this.touchMove.x; z = this.touchMove.z; }
    if (pad && (pad.x || pad.z)) { x = pad.x; z = pad.z; }
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    return { x, z };
  }
}
