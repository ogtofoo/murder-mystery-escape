// Live controller diagnostics — what the browser actually sees, if anything.

import { lookAxes } from './gamepad.js';

const BUTTON_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start',
                      'L3', 'R3', 'D-Up', 'D-Down', 'D-Left', 'D-Right', 'Home'];

function bar(v) {
  const pct = Math.round((v + 1) / 2 * 100);
  const cls = Math.abs(v) > 0.2 ? 'live' : '';
  return `<div class="axis"><i class="${cls}" style="left:${pct}%"></i></div>`;
}

function browserName() {
  const ua = navigator.userAgent;
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'this browser';
}

export function renderPadTest(el, gamepad) {
  const pads = gamepad.listAll();

  if (!pads.length) {
    el.innerHTML = `
      <h4>🎮 Controller test</h4>
      <p class="warn">No controller visible to ${browserName()} yet.</p>
      <ol>
        <li><b>Press a button on the controller now</b>, with this window in front —
            browsers hide gamepads until you do.</li>
        <li>Check it's paired to the Mac: System Settings → Bluetooth should list
            <i>Xbox Wireless Controller</i> as <i>Connected</i> (hold the Xbox button
            until it flashes, then the small pair button on the back). A USB-C cable
            works too and skips pairing entirely.</li>
        <li>Safari's gamepad support is patchy — try <b>Chrome</b>.</li>
        <li>Still nothing? Open <b>hardwaretester.com/gamepad</b>. If it's dead there
            too, it's the Mac/pairing, not the game.</li>
      </ol>
      <p class="dim">Press <b>P</b> to close. This panel updates live.</p>`;
    return;
  }

  el.innerHTML = `<h4>🎮 Controller test — ${pads.length} connected</h4>` + pads.map(pad => {
    const [lx, ly] = lookAxes(pad);
    const pressed = pad.buttons
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.pressed || b.value > 0.5)
      .map(({ i }) => `<b>${i}</b> ${BUTTON_NAMES[i] || '?'}`);
    return `
      <div class="pad">
        <div class="padid">#${pad.index} ${pad.id}</div>
        <div class="dim">mapping: <b class="${pad.mapping === 'standard' ? 'ok' : 'warn'}">${pad.mapping || '(none)'}</b>
          · ${pad.axes.length} axes · ${pad.buttons.length} buttons
          · rumble: ${pad.vibrationActuator ? 'yes' : 'no'}</div>
        ${pad.mapping === 'standard' ? '' :
          '<p class="warn">Non-standard mapping — buttons may be in unusual places. Tell me the numbers you see below for each button and I can map it.</p>'}
        <div class="axes">
          <label>Left stick X ${pad.axes[0]?.toFixed(2) ?? '—'}</label>${bar(pad.axes[0] ?? 0)}
          <label>Left stick Y ${pad.axes[1]?.toFixed(2) ?? '—'}</label>${bar(pad.axes[1] ?? 0)}
          <label>Look X (axis ${lx}) ${pad.axes[lx]?.toFixed(2) ?? '—'}</label>${bar(pad.axes[lx] ?? 0)}
          <label>Look Y (axis ${ly}) ${pad.axes[ly]?.toFixed(2) ?? '—'}</label>${bar(pad.axes[ly] ?? 0)}
        </div>
        <div class="pressed">Pressed: ${pressed.length ? pressed.join(' · ') : '<span class="dim">nothing — hold a button</span>'}</div>
      </div>`;
  }).join('') + `<p class="dim">Press <b>P</b> to close.</p>`;
}
