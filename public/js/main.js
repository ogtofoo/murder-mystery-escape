// Murder Mystery Escape — client entry point.
// Owns the Three.js scene, the connection, the UI state machine, the HUD and
// the dynamic-music intensity driver.

import * as THREE from 'three';
import {
  PLAYER_SPEED, PLAYER_RADIUS, KILL_RANGE, REPORT_RANGE, INTERACT_RANGE,
  CHARACTERS, ABILITIES, KILL_COOLDOWN, THEMES, ROLES, CREW_ALIGNED,
  MEDIC_REVIVE_COOLDOWN, ENGINEER,
} from '/shared/constants.js';
import { generateMap, collideWithWalls } from '/shared/mapgen.js';
import { store } from './store.js';
import { Net } from './net.js';
import { buildCharacter, charDef, retint, setGhost, animateCharacter, makeBody } from './character.js';
import {
  buildWorld, clearWorld, setDoorOpen, setStationDone, setCollectableVisible,
  setScanMark, animateWorld, themeById,
} from './world.js';
import { Controls } from './controls.js';
import { openPuzzle } from './puzzles.js';
import { music } from './music.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Three.js setup

const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a2233');
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 250);
let world = null;

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
  screen: 'menu',
  phase: 'idle',
  role: null,
  map: null,
  themeId: 'station',
  alive: true,
  escaped: false,
  revivesLeft: 0,
  reviveReadyAt: 0,
  hotwire: 0, hotwireReadyAt: 0,
  scans: 0, scanReadyAt: 0,
  scanUntil: 0, scanMarks: [], knownExitCode: null,
  bypass: null,             // {endsAt, collectableId} while brute-forcing
  doors: [],                 // objective descriptors from the server
  openDoors: new Set(),
  stationsDone: new Set(),
  carrying: {},              // collectableId -> playerId
  collectPos: {},
  delivered: new Set(),
  blackout: false,
  timeLeft: 0,
  camYaw: 0, camPitch: 0.42,
  pos: { x: 0, z: 0 }, yaw: 0, moving: false,
  players: new Map(),
  bodies: new Map(),
  names: new Map(),
  imposterIds: [],
  killReadyAt: 0,
  abilityUI: [],
  puzzleOpen: false,
  meeting: null,
  lastPosSend: 0,
  lastKillSeen: 0,
  nearest: {},
};

let myChar = null;

function resetMatchState() {
  state.phase = 'idle';
  state.role = null;
  state.alive = true;
  state.escaped = false;
  state.openDoors = new Set();
  state.stationsDone = new Set();
  state.delivered = new Set();
  state.carrying = {};
  state.doors = [];
  state.blackout = false;
  for (const p of state.players.values()) scene.remove(p.char.group);
  state.players.clear();
  for (const m of state.bodies.values()) scene.remove(m);
  state.bodies.clear();
  if (myChar) { scene.remove(myChar.group); myChar = null; }
  $('hud').classList.add('hidden');
  $('dead-banner').classList.add('hidden');
  $('carry-banner').classList.add('hidden');
  $('blackout-overlay').classList.add('hidden');
  hideModal('meeting-modal');
  hideModal('puzzle-modal');
  hideModal('gameover-modal');
  music.setIntensity(0);
}

// ---------------------------------------------------------------------------
// UI helpers

function showScreen(name) {
  state.screen = name;
  for (const s of document.querySelectorAll('.screen')) s.classList.remove('active');
  $(`screen-${name}`)?.classList.add('active');
  if (name !== 'game') controls.releasePointer();
}
const showModal = (id) => $(id).classList.remove('hidden');
const hideModal = (id) => $(id).classList.add('hidden');

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
// Shop (unchanged behavior)

let shopTab = 'characters';

function renderShop() {
  refreshPoints();
  const grid = $('shop-grid');
  grid.innerHTML = '';
  $('shop-note').textContent = shopTab === 'characters'
    ? 'Pick your look — everyone sees it in the lobby.'
    : 'Abilities only work while you are the IMPOSTER. Equip up to 2 in the lobby.';

  const items = shopTab === 'characters' ? CHARACTERS : ABILITIES;
  for (const it of items) {
    const item = document.createElement('div');
    const isChar = shopTab === 'characters';
    const owned = isChar ? store.ownsChar(it.id) : store.ownsAbility(it.id);
    const active = isChar ? store.profile.selectedChar === it.id : store.profile.equippedAbilities.includes(it.id);
    item.className = 'shop-item' + (active ? ' selected' : '');
    if (isChar) {
      const sw = document.createElement('div');
      sw.className = 'swatch';
      sw.style.background = it.body;
      item.appendChild(sw);
    } else {
      const ic = document.createElement('div');
      ic.className = 'icon';
      ic.textContent = it.icon;
      item.appendChild(ic);
    }
    const h = document.createElement('h4'); h.textContent = it.name; item.appendChild(h);
    const p = document.createElement('p');
    p.textContent = isChar ? (owned ? 'Owned' : `${it.cost} ⭐`) : it.desc;
    item.appendChild(p);
    const btn = document.createElement('button');
    btn.className = 'btn small';
    if (!owned) {
      btn.textContent = `Buy ${it.cost} ⭐`;
      btn.disabled = store.points < it.cost;
      btn.onclick = () => {
        if (isChar) { if (store.buyChar(it.id)) { store.selectChar(it.id); net.send({ t: 'setChar', charId: it.id }); } }
        else store.buyAbility(it.id);
        renderShop();
      };
    } else if (isChar) {
      btn.textContent = active ? 'Selected' : 'Select';
      btn.disabled = active;
      btn.onclick = () => { store.selectChar(it.id); net.send({ t: 'setChar', charId: it.id }); renderShop(); };
    } else {
      btn.textContent = active ? 'Equipped ✓' : 'Equip';
      btn.onclick = () => {
        store.toggleAbility(it.id);
        net.send({ t: 'setAbilities', abilities: store.profile.equippedAbilities });
        renderShop();
      };
    }
    item.appendChild(btn);
    grid.appendChild(item);
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

let lobbyTheme = 'random';

function renderLobby(msg) {
  $('lobby-code').textContent = msg.code;
  lobbyTheme = msg.themeId || 'random';
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
  $('theme-host-note').textContent = meHost
    ? '(you pick — maps are generated fresh each match)'
    : '(host picks — maps are generated fresh each match)';
  $('lobby-hint').textContent = meHost
    ? 'Share the room code with friends — or add bots and go! (bots auto-fill to 4)'
    : 'Waiting for the host to start…';
  renderLobbyStrips(meHost);
}

function renderLobbyStrips(isHost) {
  const chars = $('lobby-chars');
  chars.innerHTML = '';
  for (const c of CHARACTERS) {
    const owned = store.ownsChar(c.id);
    const chip = document.createElement('div');
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
      renderLobbyStrips(isHost);
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
      renderLobbyStrips(isHost);
    };
    abs.appendChild(chip);
  }

  const themes = $('lobby-themes');
  themes.innerHTML = '';
  for (const th of [{ id: 'random', name: 'Random', icon: '🎲' }, ...THEMES]) {
    const chip = document.createElement('div');
    chip.className = 'char-chip' + (lobbyTheme === th.id ? ' selected' : '') + (isHost ? '' : ' locked');
    const em = document.createElement('div'); em.className = 'em'; em.textContent = th.icon;
    chip.appendChild(em);
    chip.appendChild(document.createTextNode(th.name));
    chip.onclick = () => {
      if (!isHost) return toast('Only the host can change the map theme.');
      lobbyTheme = th.id;
      net.send({ t: 'setTheme', themeId: th.id });
      renderLobbyStrips(isHost);
    };
    themes.appendChild(chip);
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
  if (state.screen === 'game') resetMatchState();
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
  state.themeId = msg.themeId;
  state.imposterIds = msg.imposterIds;
  state.timeLeft = msg.timeLimit;
  state.revivesLeft = msg.revives || 0;
  state.hotwire = msg.hotwire || 0;
  state.scans = msg.scans || 0;
  state.hotwireReadyAt = 0;
  state.scanReadyAt = 0;
  state.scanUntil = 0;
  state.scanMarks = [];
  state.knownExitCode = null;
  state.bypass = null;
  state.killReadyAt = performance.now() / 1000 + KILL_COOLDOWN / 2;
  state.names = new Map(msg.players.map(p => [p.id, p]));

  // Rebuild the procedural world from the seed the server chose.
  clearWorld(scene, world);
  state.map = generateMap(msg.seed, msg.themeId);
  world = buildWorld(scene, state.map, msg.themeId);

  // Music: theme-flavored score starts calm.
  music.setTheme(themeById(msg.themeId).music);
  music.start();
  music.setIntensity(0.08);

  const me = state.names.get(net.myId);
  myChar = buildCharacter(charDef(me?.charId), '');
  scene.add(myChar.group);
  const spawn = state.map.spawnPoints[0];
  state.pos = { x: spawn.x, z: spawn.z };

  state.abilityUI = [];
  if (msg.role === 'imposter') {
    store.profile.equippedAbilities.forEach((id, i) => {
      const def = ABILITIES.find(a => a.id === id);
      if (def && i < 2) state.abilityUI.push({ id, def, uses: def.uses, readyAt: 0 });
    });
  }

  $('hud').classList.remove('hidden');
  renderTaskList();
  const roleDef = ROLES[msg.role];
  const banner = $('role-banner');
  banner.className = '';
  banner.classList.add(msg.role);
  banner.textContent = `${roleDef.icon} ${roleDef.name.toUpperCase()}`;

  const reveal = $('role-reveal');
  const inner = reveal.querySelector('.reveal-inner');
  inner.className = `reveal-inner ${msg.role}`;
  $('reveal-title').textContent = roleDef.name.toUpperCase();
  $('reveal-sub').textContent = roleBriefing(msg);
  reveal.classList.remove('hidden');
  setTimeout(() => reveal.classList.add('hidden'), 3800);
});

function roleBriefing(msg) {
  switch (msg.role) {
    case 'imposter': {
      const partners = msg.imposterIds.filter(id => id !== net.myId)
        .map(id => state.names.get(id)?.name).filter(Boolean);
      return (partners.length ? `Your partner: ${partners.join(', ')}. ` : '')
        + 'You are locked in with everyone — help open the first door, then hunt as the map opens up.';
    }
    case 'medic':
      return `You can REVIVE dead bodies (${msg.revives} charges). Stay close to the crew and undo the imposter's work.`;
    case 'engineer':
      return `You crack locks. HOTWIRE forces a station open with no puzzle (${msg.hotwire}×), SCAN reveals the key and code (${msg.scans}×), and at the exit terminal you can brute-force a missing item — slowly, and loudly.`;
    case 'trickster':
      return 'You win ALONE — and only if the crew votes YOU out. Act suspicious. Get ejected. Everyone else loses.';
    default:
      return 'Work together: finish stations to open doors, fetch the key and code, then escape. One of you is a killer.';
  }
}

net.on('objectives', (msg) => {
  state.doors = msg.doors;
  state.stationsDone = new Set(msg.stationsDone);
  state.carrying = msg.carrying;
  state.collectPos = msg.collectPos;
  state.delivered = new Set(msg.delivered);
  for (const d of msg.doors) {
    if (d.open && !state.openDoors.has(d.id)) state.openDoors.add(d.id);
    if (world) setDoorOpen(world, d.id, d.open);
  }
  if (world) {
    for (const sid of state.stationsDone) setStationDone(world, sid, true);
    for (const c of state.map.collectables) {
      const carried = !!state.carrying[c.id];
      const done = state.delivered.has(c.id);
      setCollectableVisible(world, c.id, !done && !carried, state.collectPos[c.id]);
    }
  }
  renderTaskList();
});

net.on('doorOpen', (msg) => {
  state.openDoors.add(msg.doorId);
  if (world) setDoorOpen(world, msg.doorId, true);
  music.sting('door');
  toast(msg.final ? '🚪 THE FINAL EXIT IS OPEN — RUN!' : `🔓 Unlocked: ${msg.name}`, 5000);
  if (msg.final) music.setIntensity(1);
});

net.on('engCharges', (msg) => {
  state.hotwire = msg.hotwire;
  state.scans = msg.scans;
  renderTaskList();
});

net.on('hotwired', (msg) => {
  music.sting('task');
  if (msg.playerId === net.myId) {
    state.hotwireReadyAt = performance.now() / 1000 + ENGINEER.HOTWIRE_COOLDOWN;
    toast('🔓 Hotwired — lock forced open!');
  } else {
    const who = state.names.get(msg.playerId)?.name || 'The Engineer';
    toast(`🔓 ${who} hotwired a station.`);
  }
});

net.on('scanReveal', (msg) => {
  const t = performance.now() / 1000;
  state.scanUntil = t + msg.duration;
  state.scanMarks = msg.marks;
  state.knownExitCode = msg.exitCode;
  if (msg.byId === net.myId) state.scanReadyAt = t + ENGINEER.SCAN_COOLDOWN;
  music.sting('pickup');
  const who = msg.byId === net.myId ? 'You' : (state.names.get(msg.byId)?.name || 'The Engineer');
  toast(`🔍 ${who} scanned the facility — key/code marked, exit code ${msg.exitCode}.`, 6000);
  renderTaskList();
});

net.on('bypassStart', (msg) => {
  const t = performance.now() / 1000;
  const who = state.names.get(msg.playerId)?.name || 'The Engineer';
  if (msg.playerId === net.myId) {
    state.bypass = { endsAt: t + msg.duration, collectableId: msg.collectableId };
    toast('🔓 Brute-forcing the terminal — HOLD STILL. Everyone can hear you!', 5000);
  } else {
    toast(`⚠ ${who} is brute-forcing the exit terminal!`, 5000);
  }
  // Everyone's music spikes — this is a loud, dangerous moment.
  music.setIntensity(0.8);
});

net.on('bypassEnd', (msg) => {
  if (msg.playerId === net.myId) {
    state.bypass = null;
    if (msg.ok) toast('🔓 Brute force succeeded!', 4000);
    else toast(msg.reason === 'moved' ? '✗ Brute force cancelled — you moved.' : '✗ Brute force interrupted.', 4000);
  }
  if (msg.ok) music.sting('door');
});

net.on('pickup', (msg) => {
  music.sting('pickup');
  const who = state.names.get(msg.playerId)?.name || 'Someone';
  const item = msg.collectableId === 'key' ? 'the Exit Key' : 'the Exit Code';
  toast(msg.playerId === net.myId ? `You picked up ${item}!` : `${who} picked up ${item}.`);
});

net.on('drop', () => toast('An item was dropped!'));

net.on('delivered', (msg) => {
  music.sting('pickup');
  const item = msg.collectableId === 'key' ? 'Key' : 'Code';
  toast(`✅ ${item} inserted into the exit terminal!`, 4000);
});

net.on('snap', (msg) => {
  if (state.screen !== 'game' || !world) return;
  state.blackout = msg.blackout;
  state.timeLeft = msg.left;
  state.collectPos = msg.collectPos || state.collectPos;

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
    const iAmThisImposter = state.imposterIds.includes(id) && state.role === 'imposter';
    p.char.group.visible = !invis || iAmThisImposter;
    setGhost(p.char, !!(invis && iAmThisImposter));
    const want = disguise || p.baseChar;
    if (want !== p.curChar) { retint(p.char, charDef(want)); p.curChar = want; }
  }
  for (const [id, p] of state.players) {
    if (!seen.has(id)) { scene.remove(p.char.group); state.players.delete(id); }
  }

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

  // Carried/loose collectables track their live positions.
  const scanning = performance.now() / 1000 < state.scanUntil;
  for (const c of state.map.collectables) {
    const carried = !!state.carrying[c.id];
    const done = state.delivered.has(c.id);
    setCollectableVisible(world, c.id, !done && !carried, state.collectPos[c.id]);
    // A live scan keeps the marker pinned to the item even while carried.
    setScanMark(world, c.id, scanning && !done, state.collectPos[c.id]);
  }
});

net.on('killed', (msg) => {
  state.lastKillSeen = performance.now() / 1000;
  if (msg.victimId === net.myId) {
    state.alive = false;
    $('dead-banner').textContent = '💀 You were murdered — finish your stations as a ghost to help the crew!';
    $('dead-banner').classList.remove('hidden');
    $('role-banner').textContent = '💀 GHOST';
    music.sting('death');
    toast('You were murdered!', 4000);
  } else {
    music.sting('kill');
  }
});

net.on('revived', (msg) => {
  music.sting('revive');
  const who = state.names.get(msg.playerId)?.name || 'Someone';
  const medic = state.names.get(msg.byId)?.name || 'The Medic';
  if (msg.playerId === net.myId) {
    state.alive = true;
    $('dead-banner').classList.add('hidden');
    const roleDef = ROLES[state.role];
    $('role-banner').textContent = `${roleDef.icon} ${roleDef.name.toUpperCase()}`;
    toast('💉 You were revived!', 4000);
  } else {
    toast(`💉 ${medic} revived ${who}!`, 4000);
  }
  if (msg.byId === net.myId) {
    state.revivesLeft = msg.revivesLeft;
    state.reviveReadyAt = performance.now() / 1000 + MEDIC_REVIVE_COOLDOWN;
  }
});

net.on('escaped', (msg) => {
  const name = state.names.get(msg.playerId)?.name || 'Someone';
  if (msg.playerId === net.myId) {
    state.escaped = true;
    $('dead-banner').textContent = '🎉 You escaped! Spectating the rest…';
    $('dead-banner').classList.remove('hidden');
    toast('You escaped!', 4000);
  } else toast(`${name} escaped!`);
});

net.on('abilityFx', (msg) => {
  if (msg.playerId === net.myId) {
    const ab = state.abilityUI.find(a => a.id === msg.abilityId);
    if (ab) { ab.uses = msg.uses; ab.readyAt = performance.now() / 1000 + ab.def.cooldown; }
    if (msg.abilityId === 'sprint') state.sprintUntil = performance.now() / 1000 + msg.duration;
    const def = ABILITIES.find(a => a.id === msg.abilityId);
    music.sting('ability');
    toast(`${def?.icon} ${def?.name} activated!`);
  }
  if (msg.abilityId === 'blackout') music.setIntensity(0.85);
});

net.on('meeting', (msg) => {
  state.phase = 'meeting';
  hideModal('puzzle-modal');
  state.puzzleOpen = false;
  music.sting('meeting');
  music.setIntensity(0.5);
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
    const roleName = ROLES[msg.ejectedRole]?.name || 'Crew';
    toast(msg.wasImposter
      ? `${name} was ejected — they WERE the imposter! 🔪`
      : `${name} was ejected… they were the ${roleName}. 😢`, 5000);
    if (msg.ejectedId === net.myId && msg.ejectedRole !== 'trickster') {
      state.alive = false;
      $('dead-banner').textContent = '🗳 You were voted out — spectating as a ghost…';
      $('dead-banner').classList.remove('hidden');
    }
  } else toast('No one was ejected (tie or skipped).', 4000);
});

net.on('gameOver', (msg) => {
  state.phase = 'over';
  hideModal('meeting-modal');
  hideModal('puzzle-modal');
  const iAmTrickster = msg.tricksterId === net.myId;
  const iWon = msg.winner === 'trickster'
    ? iAmTrickster
    : (msg.winner === 'imposters') === (state.role === 'imposter');
  const titles = {
    crew: '🛠 Crew Wins!', imposters: '🔪 Imposters Win!', trickster: '🎭 Trickster Wins — Alone!',
  };
  const colors = { crew: '#5fd98a', imposters: '#ff5f7a', trickster: '#c792ea' };
  $('gameover-title').textContent = titles[msg.winner];
  $('gameover-title').style.color = colors[msg.winner];
  $('gameover-reason').textContent = msg.reason + (iWon ? ' — Victory!' : '');
  music.setIntensity(0.1);
  music.sting(iWon ? 'win' : 'lose');

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
    if (s.tasks) mkRow('Stations repaired', `${s.tasks}`);
    if (s.kills) mkRow('Eliminations', `${s.kills}`);
    if (s.revives) mkRow('Revives', `${s.revives}`);
    if (s.escaped) mkRow('Escaped', '✓');
    if (s.correctVote) mkRow('Caught an imposter', '✓');
  }
  mkRow('Total balance', `${store.points} ⭐`);
  const imps = msg.imposterIds.map(id => state.names.get(id)?.name || '???').join(', ');
  mkRow('The imposters were', imps, 'imp');
  // Reveal any special roles
  for (const [pid, role] of Object.entries(msg.roles || {})) {
    if (['medic', 'engineer', 'trickster'].includes(role)) {
      mkRow(`${ROLES[role].icon} ${ROLES[role].name}`, state.names.get(pid)?.name || '???');
    }
  }
  showModal('gameover-modal');
  controls.releasePointer();
});

// ---------------------------------------------------------------------------
// HUD

function renderTaskList() {
  const dl = $('door-list');
  dl.innerHTML = '';
  for (const d of state.doors) {
    const li = document.createElement('li');
    if (d.open) {
      li.className = d.final ? 'final' : 'open';
      li.textContent = `✅ ${d.name}`;
    } else if (d.final) {
      li.className = 'locked-final';
      const bits = [];
      if (d.needsKey) bits.push(state.delivered.has('key') ? '🔑✓' : '🔑');
      if (d.needsCode) bits.push(state.delivered.has('code') ? '🔢✓' : '🔢');
      li.textContent = `🔒 ${d.name} ${bits.join(' ')}`;
    } else {
      const label = document.createElement('span');
      label.textContent = `🔒 ${d.name}`;
      li.appendChild(label);
      const bar = document.createElement('span');
      bar.className = 'bar';
      const fill = document.createElement('span');
      fill.style.width = d.total ? `${(d.done / d.total) * 100}%` : '0%';
      bar.appendChild(fill);
      li.appendChild(bar);
      const num = document.createElement('span');
      num.textContent = `${d.done}/${d.total}`;
      li.appendChild(num);
    }
    dl.appendChild(li);
  }

  const ul = $('task-list');
  ul.innerHTML = '';
  const mk = (text, cls = '') => {
    const li = document.createElement('li');
    li.textContent = text;
    if (cls) li.className = cls;
    ul.appendChild(li);
  };
  if (state.role === 'imposter') {
    mk('🔪 Eliminate the crew — but help open the first door', 'fake');
    mk('🎭 Fake stations to blend in', 'fake');
  } else if (state.role === 'trickster') {
    mk('🎭 Get VOTED OUT to win alone', 'fake');
    mk('🎭 Act suspicious — but stay alive', 'fake');
  } else if (state.role === 'medic') {
    mk(`💉 Revive bodies (${state.revivesLeft} left)`);
    mk('🛠 Repair stations to open doors');
  } else if (state.role === 'engineer') {
    mk(`🔓 Hotwire a lock (${state.hotwire} left)`);
    mk(`🔍 Scan for key/code (${state.scans} left)`);
    if (state.knownExitCode) mk(`🔢 Exit code: ${state.knownExitCode}`);
  } else {
    mk('🛠 Repair stations to open doors');
    mk('🔑 Fetch the key + code, insert at the terminal');
  }
}

function updateActionButtons() {
  const t = performance.now() / 1000;
  const near = state.nearest;
  const canAct = state.phase === 'playing' && state.alive && !state.escaped && !state.puzzleOpen;
  const canUse = state.phase === 'playing' && !state.escaped && !state.puzzleOpen;

  $('btn-use').classList.toggle('hidden', !(canUse && near.station));
  $('btn-grab').classList.toggle('hidden', !(canAct && near.collectable));
  $('btn-deliver').classList.toggle('hidden', !(canAct && near.terminal && myCarried()));
  $('btn-report').classList.toggle('hidden', !(canAct && near.body));
  $('btn-meeting').classList.toggle('hidden', !(canAct && near.button));

  const reviveBtn = $('btn-revive');
  const canRevive = canAct && state.role === 'medic' && near.body && state.revivesLeft > 0;
  reviveBtn.classList.toggle('hidden', !canRevive);
  if (canRevive) {
    const cd = Math.ceil(state.reviveReadyAt - t);
    reviveBtn.classList.toggle('cooldown', cd > 0);
    reviveBtn.textContent = cd > 0 ? `${cd}s` : `REVIVE ×${state.revivesLeft}`;
  }

  const killBtn = $('btn-kill');
  const showKill = canAct && state.role === 'imposter' && near.victim;
  killBtn.classList.toggle('hidden', !showKill);
  const killReady = t >= state.killReadyAt;
  killBtn.classList.toggle('cooldown', !killReady);
  killBtn.textContent = killReady ? 'KILL' : `${Math.ceil(state.killReadyAt - t)}s`;

  if (state.role === 'engineer') {
    // Slot 0 — Hotwire (contextual: station → force it; terminal → bypass)
    const b0 = $('btn-ability-0');
    const atTerminal = near.terminal && !state.delivered.has('key') || near.terminal && !state.delivered.has('code');
    const canHotwire = canAct && state.hotwire > 0 && near.station;
    const canBypass = canAct && near.terminal && atTerminal && state.hotwire >= ENGINEER.BYPASS_COST;
    const showB0 = (canHotwire || canBypass || state.bypass) && canAct;
    b0.classList.toggle('hidden', !showB0);
    if (showB0) {
      if (state.bypass) {
        const left = Math.max(0, Math.ceil(state.bypass.endsAt - t));
        b0.classList.add('cooldown');
        b0.textContent = `🔓 ${left}s — HOLD`;
      } else if (canBypass && !near.station) {
        b0.classList.remove('cooldown');
        b0.textContent = `🔓 BYPASS (${ENGINEER.BYPASS_COST})`;
      } else {
        const cd = Math.ceil(state.hotwireReadyAt - t);
        b0.classList.toggle('cooldown', cd > 0);
        b0.textContent = cd > 0 ? `🔓 ${cd}s` : `🔓 HOTWIRE ×${state.hotwire}`;
      }
    }
    // Slot 1 — Scan
    const b1 = $('btn-ability-1');
    const showB1 = canAct && state.scans > 0;
    b1.classList.toggle('hidden', !showB1);
    if (showB1) {
      const cd = Math.ceil(state.scanReadyAt - t);
      b1.classList.toggle('cooldown', cd > 0);
      b1.textContent = cd > 0 ? `🔍 ${cd}s` : `🔍 SCAN ×${state.scans}`;
    }
  } else {
    state.abilityUI.forEach((ab, i) => {
      const btn = $(`btn-ability-${i}`);
      const show = canAct && state.role === 'imposter' && ab.uses > 0;
      btn.classList.toggle('hidden', !show);
      if (show) {
        const cd = Math.ceil(ab.readyAt - t);
        btn.classList.toggle('cooldown', cd > 0);
        btn.textContent = cd > 0 ? `${ab.def.icon} ${cd}s` : `${ab.def.icon} ×${ab.uses}`;
      }
    });
    for (let i = state.abilityUI.length; i < 2; i++) $(`btn-ability-${i}`)?.classList.add('hidden');
  }

  $('blackout-overlay').classList.toggle('hidden',
    !(state.blackout && state.role !== 'imposter' && state.alive));

  const carried = myCarried();
  $('carry-banner').classList.toggle('hidden', !carried);
  if (carried) {
    $('carry-banner').textContent = carried === 'key'
      ? '🔑 Carrying the Exit Key — take it to the exit terminal'
      : '🔢 Carrying the Exit Code — take it to the exit terminal';
  }

  const m = Math.floor(state.timeLeft / 60), sec = state.timeLeft % 60;
  $('hud-timer').textContent = `${m}:${String(sec).padStart(2, '0')}`;
}

function myCarried() {
  for (const [cid, holder] of Object.entries(state.carrying)) {
    if (holder === net.myId) return cid;
  }
  return null;
}

function updateNearest() {
  const near = { station: null, victim: null, body: null, button: false, collectable: null, terminal: false };
  if (state.phase === 'playing' && !state.escaped && state.map) {
    let bestD = INTERACT_RANGE;
    for (const st of state.map.stations) {
      if (state.stationsDone.has(st.id)) continue;
      const d = Math.hypot(st.x - state.pos.x, st.z - state.pos.z);
      if (d < bestD) { bestD = d; near.station = st; }
    }
    let bbd = REPORT_RANGE;
    for (const [id, mesh] of state.bodies) {
      const d = Math.hypot(mesh.position.x - state.pos.x, mesh.position.z - state.pos.z);
      if (d < bbd) { bbd = d; near.body = id; }
    }
    if (state.alive) {
      if (state.role === 'imposter') {
        let bd = KILL_RANGE;
        for (const [id, p] of state.players) {
          if (state.imposterIds.includes(id) || !p.char.group.visible) continue;
          const d = Math.hypot(p.pos.x - state.pos.x, p.pos.z - state.pos.z);
          if (d < bd) { bd = d; near.victim = id; }
        }
      }
      if (!myCarried()) {
        for (const c of state.map.collectables) {
          if (state.delivered.has(c.id) || state.carrying[c.id]) continue;
          const pos = state.collectPos[c.id];
          if (!pos) continue;
          if (Math.hypot(pos.x - state.pos.x, pos.z - state.pos.z) < INTERACT_RANGE * 1.6) near.collectable = c.id;
        }
      }
      const term = state.map.exitTerminal;
      near.terminal = Math.hypot(term.x - state.pos.x, term.z - state.pos.z) < INTERACT_RANGE * 1.6;
      const mb = state.map.meetingButton;
      near.button = Math.hypot(mb.x - state.pos.x, mb.z - state.pos.z) < INTERACT_RANGE;
    }
  }
  state.nearest = near;
}

// ---------------------------------------------------------------------------
// Dynamic music intensity — driven by how dangerous things feel right now.

function updateMusicIntensity(t) {
  if (state.phase !== 'playing' || !state.map) return;
  let target = 0.1;

  // Base ramps with map progress: more open doors = more danger.
  const openCount = state.openDoors.size;
  target += Math.min(0.3, openCount * 0.09);

  // Recent kill spikes tension for ~20s.
  const sinceKill = t - state.lastKillSeen;
  if (state.lastKillSeen && sinceKill < 20) target += 0.35 * (1 - sinceKill / 20);

  // Nearest non-imposter proximity: crew feel hunted, imposters feel the hunt.
  let nearestD = Infinity;
  for (const [id, p] of state.players) {
    if (!p.char.group.visible) continue;
    const d = Math.hypot(p.pos.x - state.pos.x, p.pos.z - state.pos.z);
    if (d < nearestD) nearestD = d;
  }
  if (state.role === 'imposter' && state.nearest.victim) target += 0.3;
  else if (nearestD < 6 && state.alive) target += 0.12;

  // Brute-forcing the terminal is the loudest thing in the game.
  if (state.bypass) target = Math.max(target, 0.85);
  // Blackout & final door are max-tension moments.
  if (state.blackout) target += 0.3;
  if (state.openDoors.has('doorX')) target = Math.max(target, 0.9);

  // Carrying an objective item is nerve-wracking.
  if (myCarried()) target += 0.2;

  // Ghosts hear a calmer, distant mix.
  if (!state.alive || state.escaped) target *= 0.4;

  music.setIntensity(Math.min(1, target));
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
    music.sting('task');
    net.send({ t: 'taskDone', stationId: st.id });
    if (state.role === 'imposter') toast('🎭 Nice acting… (and it did help the crew)');
  }, state.role === 'engineer'); // engineer passive: minigames leak hints
}

function doGrab() {
  if (state.nearest.collectable) net.send({ t: 'pickup', collectableId: state.nearest.collectable });
}
function doDeliver() {
  if (state.nearest.terminal && myCarried()) net.send({ t: 'deliver' });
}
function doKill() {
  if (state.nearest.victim && performance.now() / 1000 >= state.killReadyAt) {
    net.send({ t: 'kill', targetId: state.nearest.victim });
    state.killReadyAt = performance.now() / 1000 + KILL_COOLDOWN;
  }
}
function doRevive() {
  if (state.role === 'medic' && state.nearest.body && state.revivesLeft > 0
      && performance.now() / 1000 >= state.reviveReadyAt) {
    net.send({ t: 'revive', bodyId: state.nearest.body });
  }
}
function doReport() { if (state.nearest.body) net.send({ t: 'report', bodyId: state.nearest.body }); }
function doMeeting() { if (state.nearest.button) net.send({ t: 'button' }); }
function doAbility(i) {
  const t = performance.now() / 1000;
  // Engineer's two slots are role-innate, not shop abilities.
  if (state.role === 'engineer') {
    if (i === 0) {
      if (state.bypass) return net.send({ t: 'engBypassCancel' });
      if (state.nearest.station && state.hotwire > 0 && t >= state.hotwireReadyAt) return net.send({ t: 'engHotwire' });
      if (state.nearest.terminal && state.hotwire >= ENGINEER.BYPASS_COST) return net.send({ t: 'engBypass' });
    } else if (i === 1 && state.scans > 0 && t >= state.scanReadyAt) {
      net.send({ t: 'engScan' });
    }
    return;
  }
  const ab = state.abilityUI[i];
  if (ab && ab.uses > 0 && t >= ab.readyAt) net.send({ t: 'ability', abilityId: ab.id });
}

$('btn-use').addEventListener('click', doUse);
$('btn-grab').addEventListener('click', doGrab);
$('btn-deliver').addEventListener('click', doDeliver);
$('btn-revive').addEventListener('click', doRevive);
$('btn-kill').addEventListener('click', doKill);
$('btn-report').addEventListener('click', doReport);
$('btn-meeting').addEventListener('click', doMeeting);
$('btn-ability-0').addEventListener('click', () => doAbility(0));
$('btn-ability-1').addEventListener('click', () => doAbility(1));
$('puzzle-close').addEventListener('click', () => { hideModal('puzzle-modal'); state.puzzleOpen = false; });

$('btn-music').addEventListener('click', () => {
  const on = !store.profile.musicOn;
  store.setMusic(on);
  music.setEnabled(on);
  $('btn-music').classList.toggle('off', !on);
});

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
    nm.textContent = label + ' ';
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
// Menu

$('name-input').value = store.profile.name;
$('name-input').addEventListener('change', () => store.setName($('name-input').value.trim()));

function enterLobbyFlow(sendMsg) {
  store.setName($('name-input').value.trim() || 'Player');
  music.init(); // unlock audio on this user gesture
  music.setEnabled(store.profile.musicOn);
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
$('btn-music').classList.toggle('off', !store.profile.musicOn);

// ---------------------------------------------------------------------------
// Main loop

const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();

window.MME = { state, net, store, music };
Object.defineProperty(window, 'MME_world', { get: () => world });

function updateLocalPlayer(dt, t) {
  if (!myChar || !state.map) return;
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
    const sin = Math.sin(state.camYaw), cos = Math.cos(state.camYaw);
    const wx = move.x * cos + move.z * sin;
    const wz = -move.x * sin + move.z * cos;
    state.pos.x += wx * speed * dt;
    state.pos.z += wz * speed * dt;
    state.yaw = Math.atan2(wx, wz);
    // Ghosts pass through doors, the living do not.
    if (!spectating) collideWithWalls(state.map, state.pos, PLAYER_RADIUS, state.openDoors);
    else {
      const b = state.map.bounds;
      state.pos.x = Math.max(b.minX, Math.min(b.maxX, state.pos.x));
      state.pos.z = Math.max(b.minZ, Math.min(b.maxZ, state.pos.z));
    }
  }
  state.moving = moving;

  myChar.group.position.x = state.pos.x;
  myChar.group.position.z = state.pos.z;
  myChar.group.rotation.y = state.yaw;
  animateCharacter(myChar, t, moving);
  setGhost(myChar, spectating);
  if (spectating) myChar.group.position.y += 1.2;

  if (!inModal) {
    for (const action of controls.consumeActions()) {
      if (action === 'use') {
        // One key does the contextual thing: insert > grab > repair.
        if (state.nearest.terminal && myCarried()) doDeliver();
        else if (state.nearest.collectable) doGrab();
        else doUse();
      }
      else if (action === 'kill') doKill();
      else if (action === 'report') {
        if (state.role === 'medic' && state.revivesLeft > 0 && state.nearest.body) doRevive();
        else doReport();
      }
      else if (action === 'meeting') doMeeting();
      else if (action === 'ability0') doAbility(0);
      else if (action === 'ability1') doAbility(1);
    }
  } else controls.consumeActions();

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
    let dy = p.yaw - p.char.group.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    p.char.group.rotation.y += dy * lerp;
    animateCharacter(p.char, t, !!p.anim);
  }
}

// Pull the camera in until it stops passing through a wall. Walks the
// player→camera ray in 2D against the map's wall/crate AABBs.
function cameraDistanceLimit(dirX, dirZ, wanted) {
  if (!state.map) return wanted;
  const pad = 0.7;
  const boxes = state.map.walls;
  let limit = wanted;
  for (const w of boxes) {
    if (w.h < 1.6) continue; // low crates don't need to push the camera
    const hw = w.w / 2 + pad, hd = w.d / 2 + pad;
    // Slab test: ray from the player toward the camera vs this AABB.
    const rx = state.pos.x - w.x, rz = state.pos.z - w.z;
    let t0 = 0, t1 = limit;
    for (const [r, d, h] of [[rx, dirX, hw], [rz, dirZ, hd]]) {
      if (Math.abs(d) < 1e-6) {
        if (Math.abs(r) > h) { t0 = Infinity; break; }
      } else {
        let ta = (-h - r) / d, tb = (h - r) / d;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
      }
    }
    if (t0 <= t1 && t0 > 0.2 && t0 < limit) limit = t0;
  }
  return Math.max(2.6, limit);
}

function updateCamera(dt) {
  if (state.screen === 'game' && myChar) {
    const wanted = 8.5;
    const dirX = Math.sin(state.camYaw) * Math.cos(state.camPitch);
    const dirZ = Math.cos(state.camYaw) * Math.cos(state.camPitch);
    const dist = cameraDistanceLimit(dirX, dirZ, wanted);
    // Shorter boom = look down more steeply so the player stays framed.
    const shrink = dist / wanted;
    const height = 1.6 + Math.sin(state.camPitch) * 7 * (0.55 + 0.45 * shrink);
    camTarget.set(state.pos.x + dirX * dist, height, state.pos.z + dirZ * dist);
    camera.position.lerp(camTarget, Math.min(1, dt * 8));
    camera.lookAt(state.pos.x, 1.4, state.pos.z);
  } else {
    const t = clock.elapsedTime * 0.08;
    camera.position.set(Math.sin(t) * 46, 34, Math.cos(t) * 46);
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
    updateMusicIntensity(performance.now() / 1000);
  }
  if (world) animateWorld(world, t, state.openDoors.has('doorX'));
  updateCamera(dt);
  renderer.render(scene, camera);
}
frame();
