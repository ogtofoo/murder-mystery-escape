// Sheckle Garden — entry point: loop, interaction, economy glue.

import * as THREE from 'three';
import { PLANTS_BY_ID, PACKS, TIERS, fmt, rollPack, plotCost, PLOT_COUNT, refundValue, SEED_REFUND } from './data.js';
import { state, save, resetSave, exportSave, importSave, addSeed, takeSeed, spend, earn, seedCount,
         growth, isRipe, isRegrowing, harvestsLeft, cycleSeconds } from './state.js';
import { buildWorld } from './world.js';
import { buildPlant, animatePlant } from './plants.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { sfx } from './sfx.js';
import { GamepadInput, BTN } from './gamepad.js';
import { renderPadTest } from './padtest.js';
import { BUILD_LABEL } from './build.js';

const REACH = 6.5;
const NAV_FIRST = 0.36;   // hold-to-repeat timings for stick/d-pad menu navigation
const NAV_REPEAT = 0.14;
const DIG_TIME = 0.75;    // seconds of holding before a plant comes out
const STALL_RANGE = 5.5;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 400);

const world = buildWorld(scene);
const player = new Player(scene, camera, canvas);

const ui = new UI({
  play: () => startPlaying(),
  reset: () => { resetSave(); syncAllPlots(true); ui.refresh(); ui.toast('Fresh soil. Good luck!', 'gold'); save(); },
  exportSave: () => downloadSave(),
  importSave: text => {
    importSave(text);
    syncAllPlots(true);
    ui.refresh();
    ui.toast('Backup restored — welcome back.', 'gold');
  },
  toggleShovel: () => toggleShovel(),
  buySeed: id => buySeed(id),
  sellSeed: (id, all) => sellSeed(id, all),
  buyPack: id => buyPack(id),
  onShopToggle: open => {
    if (open) document.exitPointerLock?.();
    else player.requestLock();
  },
});

/** Hand the player a .json copy of their save. */
function downloadSave() {
  const blob = new Blob([exportSave()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sheckle-garden-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  ui.toast('Backup saved to your downloads.', 'gold');
}

// ---------------------------------------------------------------- economy

function buySeed(id) {
  const p = PLANTS_BY_ID[id];
  if (!p) return;
  if (!spend(p.cost)) { ui.toast('Not enough sheckles.', 'bad'); sfx.deny(); return; }
  addSeed(id, 1);
  ui.select(id);
  ui.toast(`Bought a ${p.name} seed for ₪${fmt(p.cost)}`);
  sfx.buy();
  ui.refresh();
  save();
}

/** Sell seeds back to the shop at SEED_REFUND of what they cost. */
function sellSeed(id, all = false) {
  const p = PLANTS_BY_ID[id];
  if (!p) return;
  const have = seedCount(id);
  if (have <= 0) { ui.toast('You have none of those.', 'bad'); sfx.deny(); return; }
  const qty = all ? have : 1;
  for (let i = 0; i < qty; i++) takeSeed(id);
  const paid = refundValue(p) * qty;
  earn(paid);
  ui.toast(`Sold ${qty} ${p.name} seed${qty === 1 ? '' : 's'} back for <b class="coin">₪${fmt(paid)}</b>`);
  sfx.buy();
  ui.refresh();
  save();
}

function buyPack(packId) {
  const pack = PACKS.find(p => p.id === packId);
  if (!pack) return;
  if (!spend(pack.cost)) { ui.toast('That pack is out of your league — for now.', 'bad'); sfx.deny(); return; }
  const rolled = rollPack(pack);
  const firstTime = new Set(rolled.filter(id => !state.discovered[id]));
  for (const id of rolled) addSeed(id, 1);

  const rank = id => TIERS[PLANTS_BY_ID[id].tier].order;
  const best = rolled.reduce((a, b) => (rank(b) > rank(a) ? b : a));
  // Reveal worst to best, so the card everyone is waiting for lands last.
  const reveal = [...rolled].sort((a, b) => rank(a) - rank(b))
    .map(id => ({ id, isNew: firstTime.has(id) }));
  state.stats.packsOpened++;
  if (!state.stats.best || TIERS[PLANTS_BY_ID[best].tier].order > TIERS[PLANTS_BY_ID[state.stats.best].tier].order) {
    state.stats.best = best;
  }
  sfx.pack(TIERS[PLANTS_BY_ID[best].tier].order);
  gamepad.rumble(0.6, 260);
  ui.showPack(pack, reveal);
  ui.refresh();
  save();
}

function buyPlot(index) {
  if (index !== state.owned) return;
  const cost = plotCost(state.owned);
  if (!spend(cost)) { ui.toast(`This plot costs ₪${fmt(cost)}.`, 'bad'); sfx.deny(); return; }
  state.owned++;
  ui.toast(`Tilled a new plot for ₪${fmt(cost)} — ${state.owned}/${PLOT_COUNT}`, 'gold');
  sfx.buy();
  syncAllPlots();
  ui.refresh();
  save();
}

function plant(index) {
  const id = ui.selected;
  if (!id || seedCount(id) <= 0) { ui.toast('No seed selected. Buy one in the shop (B).', 'bad'); sfx.deny(); return; }
  if (state.plots[index]) return;
  takeSeed(id);
  state.plots[index] = { plantId: id, plantedAt: Date.now(), taken: 0 };
  syncPlot(index);
  const planted = PLANTS_BY_ID[id];
  ui.toast(`Planted ${planted.name}${planted.harvests > 1 ? ` — good for ${planted.harvests} harvests` : ''}`);
  sfx.plant();
  ui.refresh();
  save();
}

function harvest(index) {
  const plot = state.plots[index];
  if (!plot || !isRipe(plot)) return;
  const p = PLANTS_BY_ID[plot.plantId];
  earn(p.sell);
  state.stats.harvested++;

  // Multi-harvest crops stay in the ground and start a (faster) regrow cycle.
  plot.taken = (plot.taken || 0) + 1;
  const left = p.harvests - plot.taken;
  if (left <= 0) state.plots[index] = null;
  else plot.plantedAt = Date.now();

  burst(world.plots[index], TIERS[p.tier].color);
  syncPlot(index);
  const note = p.harvests === 1 ? ''
    : left > 0 ? ` <span style="opacity:.7">· regrows, ${left} left</span>`
    : ` <span style="opacity:.7">· plant is spent</span>`;
  ui.toast(`Harvested ${p.name} &nbsp;<b class="coin">+₪${fmt(p.sell)}</b>${note}`, 'gold');
  sfx.harvest(TIERS[p.tier].order);
  gamepad.rumble(0.25 + TIERS[p.tier].order * 0.08, 90 + TIERS[p.tier].order * 20);
  ui.refresh();
  save();
}

function digUp(index) {
  const plot = state.plots[index];
  if (!plot) return;
  const p = PLANTS_BY_ID[plot.plantId];
  state.plots[index] = null;
  syncPlot(index);
  burst(world.plots[index], 0x8a6242);
  const lost = harvestsLeft(plot);
  ui.toast(`Dug up ${p.name}${lost > 1 ? ` <span style="opacity:.7">· ${lost} harvests lost</span>` : ''}`);
  sfx.dig();
  gamepad.rumble(0.35, 140);
  ui.refresh();
  save();
}

/**
 * Hold-to-dig, so a stray press can't wipe out a mature crop. Timed off the
 * wall clock rather than the loop's clamped dt, so a slow frame rate doesn't
 * make digging drag.
 */
let digIndex = -1;
let digStart = 0;
let digProgress = 0;

function updateDigging(holding) {
  const valid = player.shovel && target >= 0 && target < state.owned && state.plots[target];
  if (!valid || !holding || ui.modalOpen) {
    if (digProgress > 0.15 && valid && !holding) sfx.deny();   // let go too early
    digIndex = -1;
    digProgress = 0;
    player.digging = 0;
    return;
  }
  if (target !== digIndex) { digIndex = target; digStart = performance.now(); }
  digProgress = Math.min(1, (performance.now() - digStart) / (DIG_TIME * 1000));
  player.digging = digProgress;
  if (digProgress >= 1) {
    digUp(digIndex);
    digIndex = -1;
    digProgress = 0;
    player.digging = 0;
  }
}

// ---------------------------------------------------------------- plot visuals

function syncPlot(i) {
  const view = world.plots[i];
  const owned = i < state.owned;
  view.locked.visible = !owned;
  view.label.visible = i === state.owned;
  view.soil.visible = owned;
  view.rim.visible = owned;

  const data = state.plots[i];
  const wantId = owned && data ? data.plantId : null;
  if (view.crop && view.crop.userData.plantId !== wantId) {
    view.cropAnchor.remove(view.crop);
    disposeTree(view.crop);
    view.crop = null;
  }
  if (wantId && !view.crop) {
    const mesh = buildPlant(PLANTS_BY_ID[wantId]);
    mesh.userData.plantId = wantId;
    mesh.userData.phase = i * 1.7;
    view.cropAnchor.add(mesh);
    view.crop = mesh;
  }
}

function syncAllPlots(force = false) {
  for (let i = 0; i < PLOT_COUNT; i++) {
    if (force && world.plots[i].crop) {
      world.plots[i].cropAnchor.remove(world.plots[i].crop);
      disposeTree(world.plots[i].crop);
      world.plots[i].crop = null;
    }
    syncPlot(i);
  }
}

function disposeTree(obj) {
  obj.traverse(o => { if (o.isMesh) o.material?.dispose?.(); });
}

// Harvest confetti.
const effects = [];
const burstGeo = new THREE.OctahedronGeometry(0.12, 0);
function burst(view, color) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(burstGeo, mat);
    m.position.set(view.x + (Math.random() - 0.5) * 0.7, 0.6, view.z + (Math.random() - 0.5) * 0.7);
    scene.add(m);
    effects.push({
      mesh: m, life: 0,
      vel: new THREE.Vector3((Math.random() - 0.5) * 2.4, 2.6 + Math.random() * 2.4, (Math.random() - 0.5) * 2.4),
    });
  }
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life += dt;
    e.vel.y -= 9 * dt;
    e.mesh.position.addScaledVector(e.vel, dt);
    e.mesh.rotation.x += dt * 6; e.mesh.rotation.y += dt * 4;
    e.mesh.material.opacity = Math.max(0, 1 - e.life / 0.9);
    if (e.life > 0.9) {
      scene.remove(e.mesh);
      e.mesh.material.dispose();
      effects.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------- targeting

const raycaster = new THREE.Raycaster();
raycaster.far = REACH;
const hitTargets = world.plots.map(p => p.hit);
let target = -1;

function updateTarget() {
  const origin = player.headPosition();
  const dir = player.lookDirection();
  raycaster.set(origin, dir);
  const hits = raycaster.intersectObjects(hitTargets, false);
  const next = hits.length ? hits[0].object.userData.plotIndex : -1;
  if (next !== target) {
    if (target >= 0) world.plots[target].highlight.visible = false;
    target = next;
    if (target >= 0) world.plots[target].highlight.visible = true;
  }
}

function nearStall() {
  const dx = player.pos.x - world.stall.position.x;
  const dz = player.pos.z - world.stall.position.z;
  return Math.hypot(dx, dz) < STALL_RANGE;
}

function updatePrompt() {
  if (ui.modalOpen) { ui.setPrompt(''); return; }
  if (target >= 0) {
    const i = target;
    if (i >= state.owned) {
      if (i === state.owned) {
        const c = plotCost(state.owned);
        const can = state.money >= c;
        ui.setPrompt(`<b>[E]</b> Till this plot — <span class="coin">₪${fmt(c)}</span>
          <span class="sub">${can ? 'You can afford it' : `You have ₪${fmt(state.money)}`}</span>`);
      } else {
        ui.setPrompt(`Overgrown ground<span class="sub">Expand outward from the edge of your garden first</span>`);
      }
      return;
    }
    const plot = state.plots[i];
    if (player.shovel && plot) {
      const p = PLANTS_BY_ID[plot.plantId];
      const left = harvestsLeft(plot);
      const pct = Math.round(digProgress * 100);
      ui.setPrompt(`<b>[Hold E]</b> Dig up ${p.name}
        <span class="sub">${left > 1 ? `throws away ${left} remaining harvests` : 'clears the plot'}</span>
        <span class="digbar"><i style="width:${pct}%"></i></span>`);
      return;
    }
    if (!plot) {
      const sel = ui.selected ? PLANTS_BY_ID[ui.selected] : null;
      ui.setPrompt(sel
        ? `<b>[E]</b> Plant ${sel.name} <span class="sub">${seedCount(sel.id)} seed${seedCount(sel.id) === 1 ? '' : 's'} left · 1–9 to switch</span>`
        : `Empty plot <span class="sub">No seeds — press B to visit the shop</span>`);
      return;
    }
    const p = PLANTS_BY_ID[plot.plantId];
    const picks = harvestsLeft(plot);
    if (isRipe(plot)) {
      const after = picks - 1;
      const more = p.harvests === 1 ? '' :
        after > 0 ? ` · regrows ${after} more time${after === 1 ? '' : 's'}` : ' · last picking';
      ui.setPrompt(`<b>[E]</b> Harvest ${p.name} — <span class="coin">₪${fmt(p.sell)}</span>
        <span class="sub" style="color:${TIERS[p.tier].css}">${TIERS[p.tier].name}${more}</span>`);
    } else {
      const wait = Math.ceil(cycleSeconds(plot) * (1 - growth(plot)));
      const verb = isRegrowing(plot) ? 'regrowing' : 'grown';
      const tail = p.harvests === 1 ? '' : ` · ${picks} harvest${picks === 1 ? '' : 's'} left`;
      ui.setPrompt(`${p.name} — ${Math.floor(growth(plot) * 100)}% ${verb}
        <span class="sub">ready in ${wait}s${tail}</span>`);
    }
    return;
  }
  if (nearStall()) {
    ui.setPrompt(`<b>[E]</b> Browse the seed shop <span class="sub">seeds, packs and the almanac</span>`);
    return;
  }
  ui.setPrompt('');
}

function interact() {
  if (ui.modalOpen) return;
  if (target >= 0) {
    const i = target;
    if (i >= state.owned) { buyPlot(i); return; }
    const plot = state.plots[i];
    if (player.shovel && plot) return;   // handled by hold-to-dig
    if (!plot) plant(i);
    else if (isRipe(plot)) harvest(i);
    else ui.toast(`${PLANTS_BY_ID[plot.plantId].name} is still growing.`);
    return;
  }
  if (nearStall()) ui.toggleShop(true);
}

// ---------------------------------------------------------------- input

window.addEventListener('keydown', e => {
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyE': interact(); break;
    case 'KeyB':
      if (!ui.menuOpen) ui.toggleShop();
      break;
    case 'KeyV': {
      const v = player.toggleView();
      ui.toast(v === 'first' ? 'First person' : 'Third person');
      break;
    }
    case 'Escape':
      if (ui.shopOpen) { ui.toggleShop(false); e.preventDefault(); }
      break;
    case 'KeyQ': ui.cycleSelection(-1); break;
    case 'KeyP': togglePadTest(); break;
    case 'KeyG': toggleShovel(); break;
    default:
      if (/^Digit[1-9]$/.test(e.code)) ui.selectIndex(Number(e.code.slice(5)) - 1);
  }
});

document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && !ui.shopOpen && document.getElementById('packmodal').classList.contains('hidden')) {
    ui.showMenu(true);
  }
});

canvas.addEventListener('click', () => {
  if (!ui.modalOpen) player.requestLock();
});

let mouseHeld = false;
canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  mouseHeld = true;
  if (player.locked) interact();
});
window.addEventListener('mouseup', e => { if (e.button === 0) mouseHeld = false; });

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

addEventListener('beforeunload', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
setInterval(save, 5000);

function startPlaying(fromPad = false) {
  ui.showMenu(false);
  sfx.enable();
  // Pointer lock needs a mouse/keyboard gesture; a controller start skips it.
  if (!fromPad) player.requestLock();
}

// ---------------------------------------------------------------- gamepad

const gamepad = new GamepadInput(pad => {
  ui.showPadHints();
  ui.toast(`Controller connected — ${pad.id.replace(/\s*\(.*\)\s*/, '') || 'gamepad'}`, 'gold');
  document.querySelector('.padhelp')?.classList.remove('hidden');
});

let navHold = 0;
let navDir = 0;

/** Route one frame of controller input, either to the menus or to the world. */
function updateGamepad(dt) {
  const pad = gamepad.poll();
  if (!pad) { player.pad = null; navDir = 0; return; }
  if (!ui.padActive) ui.showPadHints();

  const { pressed } = pad;

  if (ui.menuOpen) {
    player.pad = null;
    if (pressed.has(BTN.A) || pressed.has(BTN.START)) startPlaying(true);
    return;
  }

  if (ui.packOpen) {
    player.pad = null;
    if (pressed.has(BTN.A) || pressed.has(BTN.B) || pressed.has(BTN.START)) ui.closePack();
    return;
  }

  if (ui.shopOpen) {
    player.pad = null;
    if (pressed.has(BTN.A)) ui.padActivate();
    if (pressed.has(BTN.B) || pressed.has(BTN.Y) || pressed.has(BTN.START)) ui.toggleShop(false);
    if (pressed.has(BTN.LB) || pressed.has(BTN.LEFT)) ui.padTab(-1);
    if (pressed.has(BTN.RB) || pressed.has(BTN.RIGHT)) ui.padTab(1);

    // Stick or d-pad scrolls the list, with hold-to-repeat.
    let dir = 0;
    if (pad.held.has(BTN.DOWN) || pad.move.y > 0.5) dir = 1;
    else if (pad.held.has(BTN.UP) || pad.move.y < -0.5) dir = -1;
    if (dir !== navDir) { navDir = dir; navHold = 0; if (dir) ui.padFocus(dir); }
    else if (dir) {
      navHold += dt;
      if (navHold > NAV_FIRST) { navHold = NAV_FIRST - NAV_REPEAT; ui.padFocus(dir); }
    }
    return;
  }

  // In the world.
  player.pad = pad;
  if (pressed.has(BTN.A)) interact();
  if (pressed.has(BTN.Y)) ui.toggleShop(true);
  if (pressed.has(BTN.B)) { const v = player.toggleView(); ui.toast(v === 'first' ? 'First person' : 'Third person'); }
  if (pressed.has(BTN.LB)) ui.cycleSelection(-1);
  if (pressed.has(BTN.RB)) ui.cycleSelection(1);
  if (pressed.has(BTN.DOWN)) toggleShovel();
  if (pressed.has(BTN.R3)) { player.camDistance = player.camDistance > 4 ? 3.2 : 6.0; }
  if (pressed.has(BTN.START) || pressed.has(BTN.BACK)) { document.exitPointerLock?.(); ui.showMenu(true); }
}

function toggleShovel(force) {
  const on = player.setShovel(force ?? !player.shovel);
  ui.setShovel(on);
  ui.toast(on ? 'Shovel out — hold E on a plant to dig it up' : 'Shovel away');
  return on;
}

const padTestEl = document.getElementById('padtest');
let padTestClock = 0;

function togglePadTest(force) {
  const show = force ?? padTestEl.classList.contains('hidden');
  padTestEl.classList.toggle('hidden', !show);
  if (show) renderPadTest(padTestEl, gamepad);
}
document.getElementById('padtestbtn').addEventListener('click', () => togglePadTest());
document.getElementById('buildstamp').textContent = BUILD_LABEL;
console.log(`%cSheckle Garden — ${BUILD_LABEL}`, 'color:#f0c14b;font-weight:bold');

// ---------------------------------------------------------------- loop

const clock = new THREE.Clock();
let ripeCount = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const active = !ui.modalOpen;

  updateGamepad(dt);
  updateDigging(active && (player.keys.has('KeyE') || mouseHeld || gamepad.held.has(BTN.A)));
  if (!padTestEl.classList.contains('hidden')) {
    padTestClock += dt;
    if (padTestClock > 0.08) { padTestClock = 0; renderPadTest(padTestEl, gamepad); }
  }
  player.update(dt, t, active);
  updateTarget();
  updatePrompt();
  updateEffects(dt);

  // Fade the "next plot" price tag out when you walk into it.
  const nextView = world.plots[state.owned];
  if (nextView && nextView.label.visible) {
    const d = Math.hypot(player.pos.x - nextView.x, player.pos.z - nextView.z);
    nextView.label.material.opacity = Math.max(0, Math.min(1, (d - 1.6) / 1.4));
  }

  let ripe = 0;
  for (let i = 0; i < PLOT_COUNT; i++) {
    const view = world.plots[i];
    if (!view.crop) continue;
    const data = state.plots[i];
    const g = growth(data);
    const done = g >= 1;
    if (done) ripe++;
    // First cycle grows from a sprout; regrowth keeps the established plant and
    // just fills the fruit back in.
    const floor = data.taken > 0 ? 0.82 : 0.28;
    view.crop.scale.setScalar(floor + (1 - floor) * easeOut(g));
    animatePlant(view.crop, t, dt, done, g);
  }
  if (ripe !== ripeCount) { ripeCount = ripe; }

  renderer.render(scene, camera);
}

function easeOut(x) { return 1 - Math.pow(1 - x, 2); }

// Handy for tinkering from the devtools console.
window.game = { build: BUILD_LABEL, toggleShovel, digUp, sellSeed, state, world, player, ui, gamepad, camera, scene, save, syncAllPlots, buySeed, buyPack, buyPlot, plant, harvest, interact };

syncAllPlots();
ui.refresh();
document.getElementById('loading').remove();
tick();

// Gentle nudge for a brand-new gardener.
if (state.money <= 1 && Object.keys(state.seeds).length === 0 && state.stats.harvested === 0) {
  ui.toast('You have exactly one sheckle. Press <b>B</b> and buy a carrot seed.', 'gold');
}
