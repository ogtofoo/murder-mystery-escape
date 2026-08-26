// Murder Mystery Escape — client entry point.
// Owns the Three.js scene, the connection, the UI state machine and the HUD.

import * as THREE from 'three';
import {
  PLAYER_SPEED, PLAYER_RADIUS, KILL_RANGE, REPORT_RANGE, INTERACT_RANGE,
  CHARACTERS, ABILITIES, KILL_COOLDOWN,
} from '/shared/constants.js';
import { MAP, collideWithWalls } from '/shared/map.js';
import { store } from './store.js';
import { Net } from './net.js';
import { buildCharacter, charDef, retint, setGhost, animateCharacter, makeBody } from './character.js';
import { buildWorld, setDoorOpen, animateWorld } from './world.js';
import { Controls } from './controls.js';
import { openPuzzle } from './puzzles.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Three.js setup

const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 250);
const world = buildWorld(scene);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const controls = new Controls(canvas);
const net = new Net();

// ---------------------------------------------------------------------------
// Client state

const state = {
  screen: 'menu',            // menu | shop | lobby | game
  phase: 'idle',             // idle | countdown | playing | meeting | over
  role: null,
  alive: true,
  escaped: false,
  myTasks: [],               // station ids
  myDone: new Set(),
  doorOpen: false,
  blackout: false,
  timeLeft: 0,
  camYaw: 0, camPitch: 0.42,
  pos: { x: 0, z: 0 }, yaw: 0, moving: false,
  players: new Map(),        // id -> remote entity
  bodies: new Map(),         // victimId -> mesh
  names: new Map(),          // id -> {name, charId}
  imposterIds: [],
  killReadyAt: 0,
  abilityUI: [],             // [{id, def, uses, readyAt}]
  puzzleOpen: false,
  meeting: null,
  lastPosSend: 0,
  nearest: { station: null, victim: null, body: null, button: false },
};

let myChar = null; // my 3D character

function resetMatchState() {
  state.phase = 'idle';
  state.role = null;
  state.alive = true;
  state.escaped = false;
  state.myDone = new Set();
  state.doorOpen = false;
  state.blackout = false;
  setDoorOpen(world, false);
  for (const p of state.players.values()) scene.remove(p.char.group);
  state.players.clear();
  for (const m of state.bodies.values()) scene.remove(m);
  state.bodies.clear();
  if (myChar) { scene.remove(myChar.group); myChar = null; }
  $('hud').classList.add('hidden');
  $('dead-banner').classList.add('hidden');
  $('blackout-overlay').classList.add('hidden');
  hideModal('meeting-modal');
  hideModal('puzzle-modal');
  hideModal('gameover-modal');
}

// ---------------------------------------------------------------------------
// UI helpers

function showScreen(name) {
  state.screen = name;
  for (const s of document.querySelectorAll('.screen')) s.classList.remove('active');
  const scr = $(`screen-${name}`);
  if (scr) scr.classList.add('active');
  if (name !== 'game') controls.releasePointer();
}

function showModal(id) { $(id).classList.remove('hidden'); }
function hideModal(id) { $(id).classList.add('hidden'); }

function toast(msg, ms = 3000) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  $('toast-area').appendChild(t);
  setTimeout(() => t.remove(), ms);
}

function refreshPoints() {
  $('menu-points').textContent = `${store.points} ⭐`;
  $('shop-points').textContent = `${store.points} ⭐`;
}

// ---------------------------------------------------------------------------
// Shop

let shopTab = 'characters';

function renderShop() {
  refreshPoints();
  const grid = $('shop-grid');
  grid.innerHTML = '';
  $('shop-note').textContent = shopTab === 'characters'
    ? 'Pick your look — everyone sees it in the lobby.'
    : `Abilities only work while you are the IMPOSTER. Equip up to 2 in the lobby.`;

  if (shopTab === 'characters') {
    for (const c of CHARACTERS) {
      const item = document.createElement('div');
      item.className = 'shop-item' + (store.profile.selectedChar === c.id ? ' selected' : '');
      const sw = document.createElement('div');
      sw.className = 'swatch';
      sw.style.background = c.body;
      item.appendChild(sw);
      const h = document.createElement('h4'); h.textContent = c.name; item.appendChild(h);
      const p = document.createElement('p');
      p.textContent = store.ownsChar(c.id) ? 'Owned' : `${c.cost} ⭐`;
      item.appendChild(p);
      const btn = document.createElement('button');
      btn.className = 'btn small';
      if (store.profile.selectedChar === c.id) { btn.textContent = 'Selected'; btn.disabled = true; }
      else if (store.ownsChar(c.id)) {
        btn.textContent = 'Select';
        btn.onclick = () => { store.selectChar(c.id); net.send({ t: 'setChar', charId: c.id }); renderShop(); };
      } else {
        btn.textContent = `Buy ${c.cost} ⭐`;
        btn.disabled = store.points < c.cost;
        btn.onclick = () => { if (store.buyChar(c.id)) { store.selectChar(c.id); net.send({ t: 'setChar', charId: c.id }); } renderShop(); };
      }
      item.appendChild(btn);
      grid.appendChild(item);
    }
  } else {
    for (const a of ABILITIES) {
      const item = document.createElement('div');
      const equipped = store.profile.equippedAbilities.includes(a.id);
      item.className = 'shop-item' + (equipped ? ' selected' : '');
      const ic = document.createElement('div'); ic.className = 'icon'; ic.textContent = a.icon; item.appendChild(ic);
      const h = document.createElement('h4'); h.textContent = a.name; item.appendChild(h);
      const p = document.createElement('p'); p.textContent = a.desc; item.appendChild(p);
      const btn = document.createElement('button');
      btn.className = 'btn small';
      if (store.ownsAbility(a.id)) {
        btn.textContent = equipped ? 'Equipped ✓' : 'Equip';
        btn.onclick = () => { store.toggleAbility(a.id); net.send({ t: 'setAbilities', abilities: store.profile.equippedAbilities }); renderShop(); };
      } else {
        btn.textContent = `Buy ${a.cost} ⭐`;
        btn.disabled = store.points < a.cost;
        btn.onclick = () => { store.buyAbility(a.id); renderShop(); };
      }
      item.appendChild(btn);
      grid.appendChild(item);
    }
  }
}

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    shopTab = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    renderShop();
  });
}

// ---------------------------------------------------------------------------
// Lobby

function renderLobby(msg) {
  $('lobby-code').textContent = msg.code;
  const wrap = $('lobby-players');
  wrap.innerHTML = '';
  for (const p of msg.players) {
    const def = charDef(p.charId);
    const row = document.createElement('div');
    row.className = 'lobby-player';
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.background = def.body;
    row.appendChild(dot);
    const nm = document.createElement('span');
    nm.textContent = p.name + (p.id === net.myId ? ' (you)' : '');
    row.appendChild(nm);
    if (p.host) { const t = document.createElement('span'); t.className = 'tag'; t.textContent = '👑'; row.appendChild(t); }
    if (p.isBot) { const t = document.createElement('span'); t.className = 'tag'; t.textContent = '🤖'; row.appendChild(t); }
    wrap.appendChild(row);
  }
  const meHost = msg.players.find(p => p.id === net.myId)?.host;
  $('btn-start').disabled = !meHost;
  $('btn-addbot').disabled = !meHost;
  $('lobby-hint').textContent = meHost
    ? 'Share the room code with friends — or add bots and go! (bots auto-fill to 4)'
    : 'Waiting for the host to start…';
  renderLobbyStrips();
}

function renderLobbyStrips() {
  const chars = $('lobby-chars');
  chars.innerHTML = '';
  for (const c of CHARACTERS) {
    const chip = document.createElement('div');
    const owned = store.ownsChar(c.id);
    chip.className = 'char-chip' + (store.profile.selectedChar === c.id ? ' selected' : '') + (owned ? '' : ' locked');
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.background = c.body;
    chip.appendChild(dot);
    chip.appendChild(document.createTextNode(owned ? c.name : '🔒'));
    chip.onclick = () => {
      if (!owned) return toast('Buy this character in the Shop!');
      store.selectChar(c.id);
      net.send({ t: 'setChar', charId: c.id });
      renderLobbyStrips();
    };
    chars.appendChild(chip);
  }
  const abs = $('lobby-abilities');
  abs.innerHTML = '';
  for (const a of ABILITIES) {
    const owned = store.ownsAbility(a.id);
    const equipped = store.profile.equippedAbilities.includes(a.id);
    const chip = document.createElement('div');
    chip.className = 'char-chip' + (equipped ? ' selected' : '') + (owned ? '' : ' locked');
    const em = document.createElement('div'); em.className = 'em'; em.textContent = owned ? a.icon : '🔒';
    chip.appendChild(em);
    chip.appendChild(document.createTextNode(a.name));
    chip.onclick = () => {
      if (!owned) return toast('Buy abilities in the Shop!');
      store.toggleAbility(a.id);
      net.send({ t: 'setAbilities', abilities: store.profile.equippedAbilities });
      renderLobbyStrips();
    };
    abs.appendChild(chip);
  }
}

// ---------------------------------------------------------------------------
// Network wiring

function ensureConnected(then) {
  if (net.connected) return then();
  net.connect({
    name: store.profile.name || 'Player',
    charId: store.profile.selectedChar,
    abilities: store.profile.equippedAbilities,
  });
  const wait = setInterval(() => {
    if (net.connected && net.myId) { clearInterval(wait); then(); }
  }, 100);
  setTimeout(() => clearInterval(wait), 6000);
}

net.onStatus = (s) => {
  $('conn-status').textContent = s === 'disconnected' ? '⚠ Disconnected from server — refresh to reconnect.' : '';
  if (s === 'disconnected' && state.screen !== 'menu') {
    resetMatchState();
    showScreen('menu');
  }
};

net.on('error', (m) => toast(m.msg));

net.on('roomState', (msg) => {
  if (state.screen === 'game') {
    // Match ended and room went back to lobby.
    resetMatchState();
  }
  showScreen('lobby');
  renderLobby(msg);
});

net.on('countdown', (msg) => {
  hideModal('gameover-modal');
  state.phase = 'countdown';
  let n = msg.seconds;
  showScreen('game');
  $('countdown-overlay').classList.remove('hidden');
  $('countdown-num').textContent = n;
  const iv = setInterval(() => {
    n--;
    if (n <= 0) { clearInterval(iv); $('countdown-overlay').classList.add('hidden'); }
    else $('countdown-num').textContent = n;
  }, 1000);
});

net.on('gameStart', (msg) => {
  resetMatchState();
  showScreen('game');
  state.phase = 'playing';
  state.role = msg.role;
  state.myTasks = msg.tasks;
  state.imposterIds = msg.imposterIds;
  state.tasksTotal = msg.tasksTotal;
  state.timeLeft = msg.timeLimit;
  state.killReadyAt = performance.now() / 1000 + KILL_COOLDOWN / 2;
  state.names = new Map(msg.players.map(p => [p.id, p]));

  // My character
  const me = state.names.get(net.myId);
  myChar = buildCharacter(charDef(me?.charId), '');
  scene.add(myChar.group);
  const spawn = MAP.spawnPoints[0];
  state.pos = { x: spawn.x, z: spawn.z };

  // Ability loadout (imposter only)
  state.abilityUI = [];
  if (msg.role === 'imposter') {
    store.profile.equippedAbilities.forEach((id, i) => {
      const def = ABILITIES.find(a => a.id === id);
      if (def && i < 2) state.abilityUI.push({ id, def, uses: def.uses, readyAt: 0 });
    });
  }

  // HUD
  $('hud').classList.remove('hidden');
  renderTaskList();
  updateProgressBar(0, msg.tasksTotal);
  const banner = $('role-banner');
  banner.classList.remove('hidden', 'crew', 'imposter');
  banner.classList.add(msg.role);
  banner.textContent = msg.role === 'imposter' ? '🔪 IMPOSTER' : '🛠 CREW';

  // Role reveal splash
  const reveal = $('role-reveal');
  const inner = reveal.querySelector('.reveal-inner');
  inner.className = `reveal-inner ${msg.role}`;
  if (msg.role === 'imposter') {
    const partners = msg.imposterIds.filter(id => id !== net.myId).map(id => state.names.get(id)?.name).filter(Boolean);
    $('reveal-title').textContent = 'IMPOSTER';
    $('reveal-sub').textContent = partners.length
      ? `Hunt the crew before they escape. Your partner: ${partners.join(', ')}.`
      : 'Hunt the crew before they escape. Kill quietly. Blend in.';
  } else {
    $('reveal-title').textContent = 'CREW';
    $('reveal-sub').textContent = 'Finish the puzzles to open the Escape Airlock — and watch your back. Someone here is a killer.';
  }
  reveal.classList.remove('hidden');
  setTimeout(() => reveal.classList.add('hidden'), 3200);
});

net.on('snap', (msg) => {
  if (state.screen !== 'game') return;
  state.doorOpen = msg.door;
  setDoorOpen(world, msg.door);
  state.blackout = msg.blackout;
  state.timeLeft = msg.left;

  const seen = new Set();
  for (const [id, x, z, yaw, anim, invis, disguise] of msg.p) {
    seen.add(id);
    if (id === net.myId) continue;
    let p = state.players.get(id);
    if (!p) {
      const info = state.names.get(id) || { name: '???', charId: 'sunny' };
      const char = buildCharacter(charDef(info.charId), info.name);
      scene.add(char.group);
      p = { char, target: { x, z }, pos: { x, z }, yaw, anim, baseChar: info.charId, curChar: info.charId };
      state.players.set(id, p);
    }
    p.target = { x, z };
    p.yaw = yaw;
    p.anim = anim;
    // Invisibility: imposters can faintly see their own kind; crew sees nothing.
    const iAmThisImposter = state.imposterIds.includes(id) && state.role === 'imposter';
    p.char.group.visible = !invis || iAmThisImposter;
    if (invis && iAmThisImposter) setGhost(p.char, true);
    else if (!state.deadSet?.has(id)) setGhost(p.char, false);
    // Disguise
    const want = disguise || p.baseChar;
    if (want !== p.curChar) { retint(p.char, charDef(want)); p.curChar = want; }
  }
  // Remove entities no longer present (dead/escaped/left)
  for (const [id, p] of state.players) {
    if (!seen.has(id)) { scene.remove(p.char.group); state.players.delete(id); }
  }

  // Bodies
  const bodyIds = new Set(msg.bodies.map(b => b.id));
  for (const b of msg.bodies) {
    if (!state.bodies.has(b.id)) {
      const mesh = makeBody(charDef(b.charId));
      mesh.position.set(b.x, 0, b.z);
      scene.add(mesh);
      state.bodies.set(b.id, mesh);
    }
  }
  for (const [id, mesh] of state.bodies) {
    if (!bodyIds.has(id)) { scene.remove(mesh); state.bodies.delete(id); }
  }
});

net.on('taskProgress', (msg) => updateProgressBar(msg.done, msg.total));

net.on('doorOpen', () => {
  state.doorOpen = true;
  setDoorOpen(world, true);
  toast('🚪 The Escape Airlock is OPEN! Run!', 5000);
});

net.on('killed', (msg) => {
  if (msg.victimId === net.myId) {
    state.alive = false;
    $('dead-banner').classList.remove('hidden');
    $('role-banner').textContent = '💀 GHOST';
    toast('You were murdered!', 4000);
  }
});

net.on('escaped', (msg) => {
  const name = state.names.get(msg.playerId)?.name || 'Someone';
  if (msg.playerId === net.myId) {
    state.escaped = true;
    $('dead-banner').textContent = '🎉 You escaped! Spectating the rest…';
    $('dead-banner').classList.remove('hidden');
    toast('You escaped the facility!', 4000);
  } else {
    toast(`${name} escaped!`);
  }
});

net.on('abilityFx', (msg) => {
  if (msg.playerId === net.myId) {
    const ab = state.abilityUI.find(a => a.id === msg.abilityId);
    if (ab) { ab.uses = msg.uses; ab.readyAt = performance.now() / 1000 + ab.def.cooldown; }
    if (msg.abilityId === 'sprint') state.sprintUntil = performance.now() / 1000 + msg.duration;
    toast(`${ABILITIES.find(a => a.id === msg.abilityId)?.icon} ${ABILITIES.find(a => a.id === msg.abilityId)?.name} activated!`);
  }
});

net.on('meeting', (msg) => {
  state.phase = 'meeting';
  hideModal('puzzle-modal');
  state.puzzleOpen = false;
  state.meeting = { endsAt: performance.now() / 1000 + msg.endsAt, alive: msg.alive, dead: msg.dead, voted: [] };
  const reporter = state.names.get(msg.reporterId)?.name || '???';
  $('meeting-title').textContent = msg.bodyId ? '🚨 Body Reported!' : '📢 Emergency Meeting';
  $('meeting-sub').textContent = msg.bodyId
    ? `${reporter} found ${state.names.get(msg.bodyId)?.name || 'someone'}'s body. Who did this?`
    : `${reporter} called a meeting. Discuss!`;
  $('chat-log').innerHTML = '';
  renderMeeting();
  showModal('meeting-modal');
  controls.releasePointer();
});

net.on('voteUpdate', (msg) => {
  if (state.meeting) { state.meeting.voted = msg.voted; renderMeeting(); }
});

net.on('chat', (msg) => {
  const line = document.createElement('div');
  line.className = 'line';
  const b = document.createElement('b');
  b.textContent = msg.name + ': ';
  line.appendChild(b);
  line.appendChild(document.createTextNode(msg.text));
  $('chat-log').appendChild(line);
  $('chat-log').scrollTop = 1e6;
});

net.on('meetingEnd', (msg) => {
  hideModal('meeting-modal');
  state.phase = 'playing';
  state.meeting = null;
  if (msg.ejectedId) {
    const name = state.names.get(msg.ejectedId)?.name || '???';
    toast(msg.wasImposter ? `${name} was ejected — they WERE the imposter! 🔪` : `${name} was ejected… they were innocent. 😢`, 5000);
    if (msg.ejectedId === net.myId) {
      state.alive = false;
      $('dead-banner').textContent = '🗳 You were voted out — spectating as a ghost…';
      $('dead-banner').classList.remove('hidden');
    }
  } else {
    toast('No one was ejected (tie or skipped).', 4000);
  }
});

net.on('gameOver', (msg) => {
  state.phase = 'over';
  hideModal('meeting-modal');
  hideModal('puzzle-modal');
  const iWon = (msg.winner === 'imposters') === (state.role === 'imposter');
  $('gameover-title').textContent = msg.winner === 'crew' ? '🛠 Crew Wins!' : '🔪 Imposters Win!';
  $('gameover-title').style.color = msg.winner === 'crew' ? '#5fd98a' : '#ff5f7a';
  $('gameover-reason').textContent = msg.reason + (iWon ? ' — Victory!' : '');
  const myPts = msg.points[net.myId] || 0;
  store.addPoints(myPts);
  refreshPoints();
  const box = $('gameover-points');
  box.innerHTML = '';
  const mkRow = (l, r, cls = '') => {
    const row = document.createElement('div');
    row.className = 'row';
    const a = document.createElement('span'); a.textContent = l; if (cls) a.className = cls;
    const b = document.createElement('span'); b.textContent = r;
    row.append(a, b);
    box.appendChild(row);
  };
  mkRow('⭐ Points earned', `+${myPts}`, 'earn');
  const s = msg.stats[net.myId];
  if (s) {
    if (s.tasks) mkRow('Puzzles solved', `${s.tasks}`);
    if (s.kills) mkRow('Eliminations', `${s.kills}`);
    if (s.escaped) mkRow('Escaped', '✓');
    if (s.correctVote) mkRow('Caught an imposter', '✓');
  }
  mkRow('Total balance', `${store.points} ⭐`);
  const imps = msg.imposterIds.map(id => state.names.get(id)?.name || '???').join(', ');
  mkRow('The imposters were', imps, 'imp');
  showModal('gameover-modal');
  controls.releasePointer();
});

// ---------------------------------------------------------------------------
// HUD

function renderTaskList() {
  const ul = $('task-list');
  ul.innerHTML = '';
  if (state.role === 'imposter') {
    const li = document.createElement('li');
    li.className = 'fake';
    li.textContent = '🔪 Eliminate the crew before they escape';
    ul.appendChild(li);
    const li2 = document.createElement('li');
    li2.className = 'fake';
    li2.textContent = '🎭 Pretend to do puzzles to blend in';
    ul.appendChild(li2);
    return;
  }
  for (const sid of state.myTasks) {
    const st = MAP.stations.find(s => s.id === sid);
    const li = document.createElement('li');
    li.textContent = `${st.room}: ${st.name}`;
    li.className = state.myDone.has(sid) ? 'done' : '';
    ul.appendChild(li);
  }
}

function updateProgressBar(done, total) {
  $('task-progress').style.width = `${total ? (done / total) * 100 : 0}%`;
}

function updateActionButtons() {
  const t = performance.now() / 1000;
  const near = state.nearest;
  const canAct = state.phase === 'playing' && state.alive && !state.escaped && !state.puzzleOpen;
  // Ghosts can still finish their own puzzles.
  const canUse = state.phase === 'playing' && !state.escaped && !state.puzzleOpen;

  const useBtn = $('btn-use');
  const showUse = canUse && near.station && !state.myDone.has(near.station.id) && state.myTasks.includes(near.station.id);
  useBtn.classList.toggle('hidden', !showUse);

  const killBtn = $('btn-kill');
  const showKill = canAct && state.role === 'imposter' && near.victim;
  killBtn.classList.toggle('hidden', !showKill);
  const killReady = t >= state.killReadyAt;
  killBtn.classList.toggle('cooldown', !killReady);
  killBtn.textContent = killReady ? 'KILL' : `${Math.ceil(state.killReadyAt - t)}s`;

  $('btn-report').classList.toggle('hidden', !(canAct && near.body));
  $('btn-meeting').classList.toggle('hidden', !(canAct && near.button));

  state.abilityUI.forEach((ab, i) => {
    const btn = $(`btn-ability-${i}`);
    if (!btn) return;
    const show = canAct && state.role === 'imposter' && ab.uses > 0;
    btn.classList.toggle('hidden', !show);
    if (show) {
      const cd = Math.ceil(ab.readyAt - t);
      btn.classList.toggle('cooldown', cd > 0);
      btn.textContent = cd > 0 ? `${ab.def.icon} ${cd}s` : `${ab.def.icon} ×${ab.uses}`;
    }
  });
  for (let i = state.abilityUI.length; i < 2; i++) $(`btn-ability-${i}`)?.classList.add('hidden');

  $('blackout-overlay').classList.toggle('hidden', !(state.blackout && state.role === 'crew' && state.alive));

  const m = Math.floor(state.timeLeft / 60), sec = state.timeLeft % 60;
  $('hud-timer').textContent = `${m}:${String(sec).padStart(2, '0')}`;
}

// Proximity checks for interactions.
function updateNearest() {
  const near = { station: null, victim: null, body: null, button: false };
  if (state.phase === 'playing' && !state.escaped) {
    let bestD = INTERACT_RANGE;
    for (const st of MAP.stations) {
      const d = Math.hypot(st.x - state.pos.x, st.z - state.pos.z);
      if (d < bestD) { bestD = d; near.station = st; }
    }
  }
  if (state.phase === 'playing' && state.alive && !state.escaped) {
    if (state.role === 'imposter') {
      let bd = KILL_RANGE;
      for (const [id, p] of state.players) {
        if (state.imposterIds.includes(id)) continue;
        if (!p.char.group.visible) continue;
        const d = Math.hypot(p.pos.x - state.pos.x, p.pos.z - state.pos.z);
        if (d < bd) { bd = d; near.victim = id; }
      }
    }
    let bbd = REPORT_RANGE;
    for (const [id, mesh] of state.bodies) {
      const d = Math.hypot(mesh.position.x - state.pos.x, mesh.position.z - state.pos.z);
      if (d < bbd) { bbd = d; near.body = id; }
    }
    const mb = MAP.meetingButton;
    near.button = Math.hypot(mb.x - state.pos.x, mb.z - state.pos.z) < INTERACT_RANGE;
  }
  state.nearest = near;
}

// ---------------------------------------------------------------------------
// Actions

function doUse() {
  const st = state.nearest.station;
  if (!st || state.puzzleOpen) return;
  state.puzzleOpen = true;
  $('puzzle-title').textContent = `${st.room} — ${st.name}`;
  showModal('puzzle-modal');
  controls.releasePointer();
  openPuzzle(st.type, $('puzzle-body'), () => {
    hideModal('puzzle-modal');
    state.puzzleOpen = false;
    state.myDone.add(st.id);
    renderTaskList();
    net.send({ t: 'taskDone', stationId: st.id });
    if (state.role === 'imposter') toast('🎭 Nice acting… (fake task)');
  });
}

function doKill() {
  if (state.nearest.victim && performance.now() / 1000 >= state.killReadyAt) {
    net.send({ t: 'kill', targetId: state.nearest.victim });
    state.killReadyAt = performance.now() / 1000 + KILL_COOLDOWN;
  }
}

function doReport() { if (state.nearest.body) net.send({ t: 'report', bodyId: state.nearest.body }); }
function doMeeting() { if (state.nearest.button) net.send({ t: 'button' }); }
function doAbility(i) {
  const ab = state.abilityUI[i];
  if (ab && ab.uses > 0 && performance.now() / 1000 >= ab.readyAt) net.send({ t: 'ability', abilityId: ab.id });
}

$('btn-use').addEventListener('click', doUse);
$('btn-kill').addEventListener('click', doKill);
$('btn-report').addEventListener('click', doReport);
$('btn-meeting').addEventListener('click', doMeeting);
$('btn-ability-0').addEventListener('click', () => doAbility(0));
$('btn-ability-1').addEventListener('click', () => doAbility(1));
$('puzzle-close').addEventListener('click', () => { hideModal('puzzle-modal'); state.puzzleOpen = false; });

// ---------------------------------------------------------------------------
// Meeting UI

function renderMeeting() {
  const m = state.meeting;
  if (!m) return;
  const wrap = $('meeting-players');
  wrap.innerHTML = '';
  const iCanVote = state.alive && !state.escaped && !m.voted.includes(net.myId);
  const mkRow = (id, label, dead) => {
    const row = document.createElement('div');
    row.className = 'vote-row' + (dead ? ' dead' : '') + (m.voted.includes(id) ? ' voted-marker' : '');
    if (id !== 'skip') {
      const info = state.names.get(id);
      const dot = document.createElement('div');
      dot.className = 'dot';
      dot.style.background = charDef(info?.charId).body;
      row.appendChild(dot);
    } else row.classList.add('skip');
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = label + (id === net.myId ? ' ' : '');
    if (id === net.myId) {
      const you = document.createElement('span'); you.className = 'you'; you.textContent = '(you)';
      nm.appendChild(you);
    }
    row.appendChild(nm);
    if (!dead && iCanVote && id !== net.myId) {
      const btn = document.createElement('button');
      btn.className = 'btn small';
      btn.textContent = 'Vote';
      btn.onclick = () => net.send({ t: 'vote', targetId: id });
      row.appendChild(btn);
    }
    return row;
  };
  for (const id of m.alive) wrap.appendChild(mkRow(id, state.names.get(id)?.name || '???', false));
  for (const id of m.dead) wrap.appendChild(mkRow(id, `💀 ${state.names.get(id)?.name || '???'}`, true));
  wrap.appendChild(mkRow('skip', 'Skip vote', false));
}

$('chat-send').addEventListener('click', sendChat);
$('chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
function sendChat() {
  const input = $('chat-input');
  if (input.value.trim() && state.alive) net.send({ t: 'chat', text: input.value });
  input.value = '';
}

// ---------------------------------------------------------------------------
// Menu buttons

$('name-input').value = store.profile.name;
$('name-input').addEventListener('change', () => store.setName($('name-input').value.trim()));

function enterLobbyFlow(sendMsg) {
  store.setName($('name-input').value.trim() || 'Player');
  ensureConnected(() => {
    net.send({ t: 'setChar', charId: store.profile.selectedChar });
    net.send({ t: 'setAbilities', abilities: store.profile.equippedAbilities });
    net.send(sendMsg);
  });
}

$('btn-quickplay').addEventListener('click', () => enterLobbyFlow({ t: 'quickplay' }));
$('btn-create').addEventListener('click', () => enterLobbyFlow({ t: 'create' }));
$('btn-join').addEventListener('click', () => {
  const code = $('join-code').value.trim().toUpperCase();
  if (code.length === 4) enterLobbyFlow({ t: 'join', code });
  else toast('Enter the 4-letter room code.');
});
$('btn-shop').addEventListener('click', () => { showScreen('shop'); renderShop(); });
$('btn-shop-back').addEventListener('click', () => showScreen('menu'));
$('btn-leave').addEventListener('click', () => { net.send({ t: 'leave' }); showScreen('menu'); refreshPoints(); });
$('btn-addbot').addEventListener('click', () => net.send({ t: 'addBot' }));
$('btn-start').addEventListener('click', () => net.send({ t: 'start' }));
$('btn-back-lobby').addEventListener('click', () => hideModal('gameover-modal'));

refreshPoints();

// ---------------------------------------------------------------------------
// Main loop

const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();

// Dev/debug hook (also handy for automated tests).
window.MME = { state, net, store };

function updateLocalPlayer(dt, t) {
  if (!myChar) return;
  const inModal = state.puzzleOpen || state.phase === 'meeting' || state.phase === 'over';
  const move = inModal ? { x: 0, z: 0 } : controls.getMove();
  const look = controls.consumeLook();
  if (!inModal) {
    state.camYaw -= look.x;
    state.camPitch = Math.max(0.15, Math.min(1.25, state.camPitch + look.y));
  }

  const spectating = !state.alive || state.escaped;
  let speed = PLAYER_SPEED * (spectating ? 1.6 : 1);
  if (state.sprintUntil && t < state.sprintUntil) speed *= 1.6;

  const moving = (move.x !== 0 || move.z !== 0);
  if (moving) {
    // Rotate input by camera yaw so "up" is always away from the camera.
    const sin = Math.sin(state.camYaw), cos = Math.cos(state.camYaw);
    const wx = move.x * cos + move.z * sin;
    const wz = -move.x * sin + move.z * cos;
    state.pos.x += wx * speed * dt;
    state.pos.z += wz * speed * dt;
    state.yaw = Math.atan2(wx, wz);
    if (!spectating) collideWithWalls(state.pos, PLAYER_RADIUS, state.doorOpen);
    else {
      const b = MAP.bounds;
      state.pos.x = Math.max(b.minX, Math.min(b.maxX, state.pos.x));
      state.pos.z = Math.max(b.minZ, Math.min(b.maxZ, state.pos.z));
    }
  }
  state.moving = moving;

  myChar.group.position.x = state.pos.x;
  myChar.group.position.z = state.pos.z;
  myChar.group.rotation.y = state.yaw;
  animateCharacter(myChar, t, moving);
  if (spectating) {
    setGhost(myChar, true);
    myChar.group.position.y += 1.2;
  }

  // Actions
  if (!inModal) {
    for (const action of controls.consumeActions()) {
      if (action === 'use') doUse();
      else if (action === 'kill') doKill();
      else if (action === 'report') doReport();
      else if (action === 'meeting') doMeeting();
      else if (action === 'ability0') doAbility(0);
      else if (action === 'ability1') doAbility(1);
    }
  } else controls.consumeActions();

  // Network position (throttled)
  if (t - state.lastPosSend > 1 / 15 && state.phase === 'playing' && !state.escaped) {
    state.lastPosSend = t;
    net.send({ t: 'pos', x: +state.pos.x.toFixed(2), z: +state.pos.z.toFixed(2), yaw: +state.yaw.toFixed(2), anim: moving ? 1 : 0 });
  }
}

function updateRemotes(dt, t) {
  for (const p of state.players.values()) {
    const lerp = Math.min(1, dt * 10);
    p.pos.x += (p.target.x - p.pos.x) * lerp;
    p.pos.z += (p.target.z - p.pos.z) * lerp;
    p.char.group.position.x = p.pos.x;
    p.char.group.position.z = p.pos.z;
    // Shortest-arc yaw interpolation
    let dy = p.yaw - p.char.group.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    p.char.group.rotation.y += dy * lerp;
    animateCharacter(p.char, t, !!p.anim);
  }
}

function updateCamera(dt) {
  if (state.screen === 'game' && myChar) {
    const dist = 8.5, height = 2 + Math.sin(state.camPitch) * 7;
    const cx = state.pos.x + Math.sin(state.camYaw) * Math.cos(state.camPitch) * dist;
    const cz = state.pos.z + Math.cos(state.camYaw) * Math.cos(state.camPitch) * dist;
    camTarget.set(cx, height, cz);
    camera.position.lerp(camTarget, Math.min(1, dt * 8));
    camera.lookAt(state.pos.x, 1.4, state.pos.z);
  } else {
    // Menu: slow cinematic orbit over the facility.
    const t = clock.elapsedTime * 0.08;
    camera.position.set(Math.sin(t) * 42, 30, Math.cos(t) * 42);
    camera.lookAt(0, 0, -4);
  }
}

function updateMeetingTimer() {
  if (state.meeting) {
    const left = Math.max(0, Math.ceil(state.meeting.endsAt - performance.now() / 1000));
    $('meeting-timer').textContent = `${left}`;
  }
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  if (state.screen === 'game') {
    updateLocalPlayer(dt, t);
    updateRemotes(dt, t);
    updateNearest();
    updateActionButtons();
    updateMeetingTimer();
  }
  animateWorld(world, t, state.doorOpen);
  updateCamera(dt);
  renderer.render(scene, camera);
}
frame();
