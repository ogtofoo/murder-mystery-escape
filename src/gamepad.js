// Gamepad support (standard mapping: Xbox / PlayStation / most USB pads).

const DEADZONE = 0.2;
const LOOK_SPEED = 2.6;   // radians per second at full stick deflection

export const BTN = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  BACK: 8, START: 9, L3: 10, R3: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
};

function curve(v) {
  // Deadzone, then square the response so small nudges stay precise.
  const a = Math.abs(v);
  if (a < DEADZONE) return 0;
  const n = (a - DEADZONE) / (1 - DEADZONE);
  return Math.sign(v) * n * n;
}

/**
 * Which axes carry the right stick. Standard mapping says 2 and 3, but some
 * macOS drivers (and older Xbox pads) expose triggers as axes and push the
 * right stick out to 3 and 4.
 */
export function lookAxes(pad) {
  if (pad.mapping === 'standard' || pad.axes.length < 6) return [2, 3];
  return [3, 4];
}

export class GamepadInput {
  constructor(onConnect) {
    this.index = null;
    this.prev = [];
    this.pressed = new Set();
    this.held = new Set();
    this.onConnect = onConnect;

    window.addEventListener('gamepadconnected', e => {
      if (!e.gamepad) return;
      this.index = e.gamepad.index;
      this.onConnect?.(e.gamepad);
    });
    window.addEventListener('gamepaddisconnected', e => {
      if (e.gamepad && this.index === e.gamepad.index) this.index = null;
    });
  }

  get pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (this.index !== null && pads[this.index]) return pads[this.index];
    for (const p of pads) if (p && p.connected) { this.index = p.index; return p; }
    return null;
  }

  /** Sample the pad once per frame; returns null when nothing is plugged in. */
  poll() {
    const pad = this.pad;
    if (!pad) { this.pressed.clear(); this.held.clear(); this.prev = []; return null; }

    this.pressed.clear();
    this.held.clear();
    pad.buttons.forEach((b, i) => {
      const down = b.pressed || b.value > 0.5;
      if (down) this.held.add(i);
      if (down && !this.prev[i]) this.pressed.add(i);
      this.prev[i] = down;
    });

    const ax = pad.axes;
    const [lx, ly] = lookAxes(pad);
    return {
      id: pad.id,
      mapping: pad.mapping,
      move: { x: curve(ax[0] ?? 0), y: curve(ax[1] ?? 0) },
      look: { x: curve(ax[lx] ?? 0), y: curve(ax[ly] ?? 0) },
      lookSpeed: LOOK_SPEED,
      sprint: this.held.has(BTN.RT) || this.held.has(BTN.LT) || this.held.has(BTN.L3),
      jump: this.held.has(BTN.X),
      pressed: this.pressed,
      held: this.held,
    };
  }

  /** Every pad the browser will admit to, for the diagnostics panel. */
  listAll() {
    if (!navigator.getGamepads) return [];
    return [...navigator.getGamepads()].filter(Boolean);
  }

  /** Short rumble, where the browser and pad support it. */
  rumble(strength = 0.4, ms = 120) {
    const pad = this.pad;
    try {
      pad?.vibrationActuator?.playEffect?.('dual-rumble', {
        duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6,
      }).catch(() => {});
    } catch (err) { /* pad without haptics */ }
  }
}
