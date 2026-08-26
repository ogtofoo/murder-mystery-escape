// Puzzle minigames rendered into the puzzle modal (pure DOM, no 3D).
// openPuzzle(type, onSolve) builds the game; resolves via onSolve() when beaten.

const WIRE_COLORS = ['#e4405f', '#ffd166', '#2ecc71', '#3498db'];
const rand = (n) => Math.floor(Math.random() * n);
const shuffle = (a) => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function status(body, msg, cls = '') {
  let s = body.querySelector('.puzzle-status');
  if (!s) { s = el('div', 'puzzle-status'); body.appendChild(s); }
  s.textContent = msg;
  s.className = `puzzle-status ${cls}`;
}

// ---------------------------------------------------------------------------
function wires(body, onSolve) {
  const order = shuffle([0, 1, 2, 3]);
  const board = el('div', 'wires-board');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('wires-svg');
  const left = el('div', 'wires-col'), right = el('div', 'wires-col');
  board.append(svg, left, right);
  body.appendChild(board);
  status(body, 'Connect each wire to its matching color.');

  let active = null;
  const solvedSet = new Set();

  const mkNode = (color, idx, side) => {
    const n = el('button', 'wire-node');
    n.style.background = color;
    n.dataset.idx = idx;
    n.addEventListener('click', () => {
      if (solvedSet.has(idx)) return;
      if (side === 'L') {
        left.querySelectorAll('.wire-node').forEach(x => x.classList.remove('active'));
        n.classList.add('active');
        active = { idx, node: n };
      } else if (active) {
        if (active.idx === idx) {
          solvedSet.add(idx);
          n.classList.add('done');
          active.node.classList.add('done');
          active.node.classList.remove('active');
          drawLine(active.node, n, WIRE_COLORS[idx]);
          active = null;
          if (solvedSet.size === 4) { status(body, '✓ All wires connected!', 'good'); setTimeout(onSolve, 500); }
        } else {
          status(body, 'Wrong socket — colors must match.', 'bad');
          active.node.classList.remove('active');
          active = null;
        }
      }
    });
    return n;
  };

  const drawLine = (a, b, color) => {
    const br = board.getBoundingClientRect();
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', ra.left - br.left + ra.width / 2);
    line.setAttribute('y1', ra.top - br.top + ra.height / 2);
    line.setAttribute('x2', rb.left - br.left + rb.width / 2);
    line.setAttribute('y2', rb.top - br.top + rb.height / 2);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '6');
    line.setAttribute('stroke-linecap', 'round');
    svg.appendChild(line);
  };

  [0, 1, 2, 3].forEach(i => left.appendChild(mkNode(WIRE_COLORS[i], i, 'L')));
  order.forEach(i => right.appendChild(mkNode(WIRE_COLORS[i], i, 'R')));
}

// ---------------------------------------------------------------------------
function keypad(body, onSolve) {
  const code = Array.from({ length: 4 }, () => rand(10)).join('');
  const display = el('div', 'keypad-display', code);
  body.appendChild(display);
  const grid = el('div', 'keypad-grid');
  body.appendChild(grid);
  status(body, 'Memorize the code…');

  let entry = '';
  let hidden = false;
  setTimeout(() => {
    hidden = true;
    display.textContent = '····';
    status(body, 'Now enter it.');
  }, 1800);

  const press = (d) => {
    if (!hidden) return;
    if (d === 'C') { entry = ''; display.textContent = '····'; return; }
    entry += d;
    display.textContent = entry.padEnd(4, '·');
    if (entry.length === 4) {
      if (entry === code) { status(body, '✓ Access granted!', 'good'); setTimeout(onSolve, 500); }
      else {
        status(body, '✗ Wrong code. Watch again…', 'bad');
        entry = '';
        hidden = false;
        display.textContent = code;
        setTimeout(() => { hidden = true; display.textContent = '····'; status(body, 'Now enter it.'); }, 1800);
      }
    }
  };
  for (const key of ['1','2','3','4','5','6','7','8','9','C','0','⌫']) {
    const b = el('button', 'btn', key);
    b.addEventListener('click', () => {
      if (key === '⌫') { entry = entry.slice(0, -1); display.textContent = entry.padEnd(4, '·'); }
      else press(key);
    });
    grid.appendChild(b);
  }
}

// ---------------------------------------------------------------------------
function simon(body, onSolve) {
  const colors = ['#e4405f', '#2ecc71', '#3498db', '#ffd166'];
  const seq = Array.from({ length: 5 }, () => rand(4));
  const grid = el('div', 'simon-grid');
  body.appendChild(grid);
  status(body, 'Watch the sequence…');

  const pads = colors.map((c, i) => {
    const p = el('button', 'simon-pad');
    p.style.background = c;
    p.style.color = c;
    p.addEventListener('click', () => press(i));
    grid.appendChild(p);
    return p;
  });

  let accepting = false, pos = 0, shown = 1;

  const flash = (i, ms = 380) => new Promise(res => {
    pads[i].classList.add('lit');
    setTimeout(() => { pads[i].classList.remove('lit'); setTimeout(res, 120); }, ms);
  });

  async function playback() {
    accepting = false;
    status(body, `Watch the sequence… (${shown} of ${seq.length})`);
    await new Promise(r => setTimeout(r, 600));
    for (let i = 0; i < shown; i++) await flash(seq[i]);
    accepting = true;
    pos = 0;
    status(body, 'Your turn — repeat it.');
  }

  async function press(i) {
    if (!accepting) return;
    await flash(i, 150);
    if (i !== seq[pos]) { status(body, '✗ Wrong pad. Watch again…', 'bad'); return playback(); }
    pos++;
    if (pos === shown) {
      shown++;
      if (shown > seq.length) { status(body, '✓ Sequence calibrated!', 'good'); accepting = false; return setTimeout(onSolve, 500); }
      playback();
    }
  }
  playback();
}

// ---------------------------------------------------------------------------
function fuses(body, onSolve) {
  const values = Array.from({ length: 5 }, () => 2 + rand(9));
  // Choose a random non-empty subset as the solution target.
  let mask = 0;
  while (!mask) mask = rand(32);
  const target = values.reduce((sum, v, i) => sum + ((mask >> i) & 1 ? v : 0), 0);

  const head = el('div', 'puzzle-status', `Flip breakers to total exactly ${target} amps.`);
  body.appendChild(head);
  const readout = el('div', 'keypad-display', '0 A');
  body.appendChild(readout);
  const states = [false, false, false, false, false];

  values.forEach((v, i) => {
    const row = el('div', 'fuse-row');
    row.appendChild(el('span', '', `Breaker ${i + 1} — ${v} A`));
    const t = el('button', 'fuse-toggle');
    t.addEventListener('click', () => {
      states[i] = !states[i];
      t.classList.toggle('on', states[i]);
      const sum = values.reduce((s, val, j) => s + (states[j] ? val : 0), 0);
      readout.textContent = `${sum} A`;
      if (sum === target) { status(body, '✓ Power restored!', 'good'); setTimeout(onSolve, 500); }
    });
    row.appendChild(t);
    body.appendChild(row);
  });
}

// ---------------------------------------------------------------------------
function levers(body, onSolve) {
  const POSITIONS = 4;
  const targets = Array.from({ length: 4 }, () => rand(POSITIONS));
  const current = targets.map(t => (t + 1 + rand(POSITIONS - 1)) % POSITIONS);
  status(body, 'Click each lever until its handle lines up with the green mark.');
  const col = el('div', 'lever-col');
  body.appendChild(col);

  const yFor = (p) => 8 + p * 30;
  const knobs = [];

  targets.forEach((t, i) => {
    const lever = el('div', 'lever');
    const mark = el('div', 'mark');
    mark.style.top = `${yFor(t) + 12}px`;
    lever.appendChild(mark);
    const knob = el('div', 'knob');
    knob.style.top = `${yFor(current[i])}px`;
    lever.appendChild(knob);
    knobs.push(knob);
    lever.addEventListener('click', () => {
      current[i] = (current[i] + 1) % POSITIONS;
      knob.style.top = `${yFor(current[i])}px`;
      if (current.every((c, j) => c === targets[j])) {
        status(body, '✓ Valves aligned!', 'good');
        setTimeout(onSolve, 500);
      }
    });
    col.appendChild(lever);
  });
}

// ---------------------------------------------------------------------------
const BUILDERS = { wires, keypad, simon, fuses, levers };

export function openPuzzle(type, container, onSolve) {
  container.innerHTML = '';
  (BUILDERS[type] || wires)(container, onSolve);
}
