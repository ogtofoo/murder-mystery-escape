// Sheckle Garden — entry point: loop, interaction, economy glue.

import * as THREE from 'three';
import { PLANTS_BY_ID, PACKS, TIERS, fmt, rollPack, plotCost, PLOT_COUNT, refundValue, SEED_REFUND,
         CANS_BY_ID, SPRINKLERS_BY_ID, TURRETS_BY_ID, WEAPONS_BY_ID, plotLayout,
         raidLevel, BUG_SLOW, TROPHIES, goldenMultiplier, WEATHERS, rollWeather, rollMutation,
         mutationMultiplier, mutationName, mutationColor } from './data.js';
import { state, save, resetSave, exportSave, importSave, addSeed, takeSeed, spend, earn, seedCount,
         growth, isRipe, isRegrowing, harvestsLeft, cycleSeconds,
         refreshSprinklers, plotSpeed, sprinklerSpeed, sprinklerAt, stockCount, addSprinkler, takeSprinkler,
         bestCan, bugsOn, addBug, removeBug, turretAt, deviceAt,
         cropValue, goldenPending, canGoldenHarvest, goldenHarvest, claimTrophies, weatherSpeed } from './state.js';
import { buildWorld } from './world.js';
import { buildPlant, animatePlant, applyMutation } from './plants.js';
import { buildSprinkler, animateSprinkler, buildCan, waterBurst,
         buildTurret, animateTurret, buildWeapon, tracer } from './devices.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { sfx } from './sfx.js';
import { GamepadInput, BTN } from './gamepad.js';
import { BugSystem } from './bugs.js';
import { Sky, dayPhase, isNight, clockLabel } from './sky.js';
import { renderPadTest } from './padtest.js';
import { BUILD_LABEL } from './build.js';

let menuSuppressUntil = 0;
let escClosedShop = false;

const REACH = 6.5;
const NAV_FIRST = 0.36;   // hold-to-repeat timings for stick/d-pad menu navigation
const NAV_REPEAT = 0.14;
const DIG_TIME = 0.75;    // seconds of holding before a plant comes out
const RAID_MIN = 150;     // seconds between bug raids
const RAID_MAX = 300;
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
const player = new Player(scene, camera, canvas, [world.stall]);

const ui = new UI({
  play: () => startPlaying(),
  reset: () => { resetSave(); refreshSprinklers(); restoreBugs(); syncAllPlots(true); ui.refresh(); ui.toast('Fresh soil. Good luck!', 'gold'); save(); },
  exportSave: () => downloadSave(),
  importSave: text => {
    importSave(text);
    refreshSprinklers();
    restoreBugs();
    syncAllPlots(true);
    ui.refresh();
    ui.toast('Backup restored — welcome back.', 'gold');
  },
  goldenHarvest: () => doGoldenHarvest(),
  toggleShovel: () => toggleShovel(),
  toggleWeapon: () => toggleWeapon(),
  buyWeapon: id => buyWeapon(id),
  buyTurret: id => buyTurret(id),
  sellDevice: (id, all) => sellDevice(id, all),
  toggleCan: () => toggleCan(),
  buyCan: id => buyCan(id),
  buySprinkler: id => buySprinkler(id),
  buySeed: id => buySeed(id),
  sellSeed: (id, all) => sellSeed(id, all),
  buyPack: id => buyPack(id),
  onShopToggle: open => {
    if (open) { document.exitPointerLock?.(); return; }
    // Closing: never bounce straight to the pause menu, and don't grab the
    // pointer back when Escape did the closing — browsers throttle that, and
    // a second Escape would then land in the menu.
    menuSuppressUntil = performance.now() + 700;
    if (!escClosedShop) player.requestLock();
    escClosedShop = false;
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

function buyCan(id) {
  const can = CANS_BY_ID[id];
  if (!can || state.cans[id]) return;
  if (!spend(can.cost)) { ui.toast('Not enough sheckles.', 'bad'); sfx.deny(); return; }
  state.cans[id] = true;
  ui.toast(`Bought the ${can.name} — press <b>F</b> to use it`, 'gold');
  sfx.buy();
  ui.refresh();
  save();
}

function buySprinkler(id) {
  const spr = SPRINKLERS_BY_ID[id];
  if (!spr) return;
  if (!spend(spr.cost)) { ui.toast('Not enough sheckles.', 'bad'); sfx.deny(); return; }
  addSprinkler(id, 1);
  ui.select(id);
  ui.toast(`Bought a ${spr.name} — place it on an empty plot`, 'gold');
  sfx.buy();
  ui.refresh();
  save();
}

function buyWeapon(id) {
  const w = WEAPONS_BY_ID[id];
  if (!w || state.weapons[id]) return;
  if (!spend(w.cost)) { ui.toast('Not enough sheckles.', 'bad'); sfx.deny(); return; }
  state.weapons[id] = true;
  ui.toast(`Bought the ${w.name} — press <b>R</b> to arm it`, 'gold');
  sfx.buy(); ui.refresh(); save();
}

function buyTurret(id) {
  const t = TURRETS_BY_ID[id];
  if (!t) return;
  if (!spend(t.cost)) { ui.toast('Not enough sheckles.', 'bad'); sfx.deny(); return; }
  addSprinkler(id, 1);            // shares the shed with sprinklers
  ui.select(id);
  ui.toast(`Bought a ${t.name} — place it on an empty plot`, 'gold');
  sfx.buy(); ui.refresh(); save();
}

function placeTurret(index) {
  const id = ui.selected;
  const spec = TURRETS_BY_ID[id];
  if (!spec || stockCount(id) <= 0) return;
  if (state.plots[index] || deviceAt(index)) return;
  takeSprinkler(id);
  state.turrets[index] = id;
  syncAllPlots();
  ui.toast(`Placed a ${spec.name} — ${fmt(spec.damage)} damage, ${spec.rate}/s`, 'gold');
  sfx.buy(); ui.refresh(); save();
}

function removeTurret(index) {
  const id = state.turrets[index];
  const spec = TURRETS_BY_ID[id];
  if (!spec) return;
  state.turrets[index] = null;
  addSprinkler(id, 1);
  syncAllPlots();
  burst(world.plots[index], TIERS[spec.tier].color);
  ui.toast(`Picked up the ${spec.name}`);
  sfx.dig(); ui.refresh(); save();
}

/** Sell a sprinkler or turret out of the shed, at half what it cost. */
function sellDevice(id, all = false) {
  const spec = SPRINKLERS_BY_ID[id] || TURRETS_BY_ID[id];
  if (!spec) return;
  const have = stockCount(id);
  if (have <= 0) { ui.toast('None of those in the shed.', 'bad'); sfx.deny(); return; }
  const qty = all ? have : 1;
  for (let i = 0; i < qty; i++) takeSprinkler(id);
  const paid = Math.max(1, Math.floor(spec.cost * SEED_REFUND)) * qty;
  earn(paid);
  ui.toast(`Sold ${qty} ${spec.name}${qty === 1 ? '' : 's'} back for <b class="coin">₪${fmt(paid)}</b>`);
  sfx.buy(); ui.refresh(); save();
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
  state.plots[index] = { plantId: id, plantedAt: Date.now(), taken: 0, watered: false, mut: undefined };
  syncPlot(index);
  const planted = PLANTS_BY_ID[id];
  ui.toast(`Planted ${planted.name}${planted.harvests > 1 ? ` — good for ${planted.harvests} harvests` : ''}`);
  sfx.plant();
  ui.refresh();
  save();
}

function placeSprinkler(index) {
  const id = ui.selected;
  const spr = SPRINKLERS_BY_ID[id];
  if (!spr || stockCount(id) <= 0) return;
  if (state.plots[index] || state.sprinklers[index]) return;
  takeSprinkler(id);
  state.sprinklers[index] = id;
  refreshSprinklers();
  syncAllPlots();
  ui.toast(`Placed a ${spr.name} — ${spr.speed}× growth in range`, 'gold');
  sfx.buy();
  ui.refresh();
  save();
}

function removeSprinkler(index) {
  const id = state.sprinklers[index];
  const spr = SPRINKLERS_BY_ID[id];
  if (!spr) return;
  state.sprinklers[index] = null;
  addSprinkler(id, 1);          // it goes back in the shed, not the bin
  refreshSprinklers();
  syncAllPlots();
  burst(world.plots[index], 0x8fd8ff);
  ui.toast(`Picked up the ${spr.name}`);
  sfx.dig();
  ui.refresh();
  save();
}

/** Water a plot (and its neighbours, with the super can): skip growth ahead. */
function waterPlot(index) {
  const can = bestCan();
  if (!can) return;
  const cells = plotLayout();
  const targets = can.radius > 0
    ? cells.map((c, i) => i).filter(i => Math.hypot(cells[i].x - cells[index].x, cells[i].z - cells[index].z) <= can.radius)
    : [index];

  let done = 0;
  for (const i of targets) {
    const plot = state.plots[i];
    if (!plot || plot.watered || isRipe(plot, i)) continue;
    plot.plantedAt -= can.boost * cycleSeconds(plot, i) * 1000;
    plot.watered = true;        // one watering per growth cycle
    done++;
  }

  waterBurst(scene, world.plots[index].x, world.plots[index].z, can.radius || 1, effects);
  sfx.water();
  gamepad.rumble(0.2, 90);
  if (done) {
    ui.toast(`Watered ${done} plant${done === 1 ? '' : 's'} <span style="opacity:.7">· +${Math.round(can.boost * 100)}% growth</span>`);
  } else {
    ui.toast('Nothing here needs water right now.');
  }
  save();
}

function harvest(index) {
  const plot = state.plots[index];
  if (!plot || !isRipe(plot, index)) return;
  const p = PLANTS_BY_ID[plot.plantId];
  const mut = plot.mut;
  const paid = cropValue(p, mut);
  earn(paid);
  state.stats.harvested++;
  const mult = mutationMultiplier(mut);
  if (mult > (state.best?.mult || 1)) state.best = { mult, name: mutationName(mut), plant: p.id };

  // Multi-harvest crops stay in the ground and start a (faster) regrow cycle.
  plot.taken = (plot.taken || 0) + 1;
  const left = p.harvests - plot.taken;
  if (left <= 0) state.plots[index] = null;
  else { plot.plantedAt = Date.now(); plot.watered = false; plot.mut = undefined; }

  burst(world.plots[index], TIERS[p.tier].color);
  syncPlot(index);
  const note = p.harvests === 1 ? ''
    : left > 0 ? ` <span style="opacity:.7">· regrows, ${left} left</span>`
    : ` <span style="opacity:.7">· plant is spent</span>`;
  const label = mut ? `<b style="color:${'#' + mutationColor(mut).toString(16).padStart(6, '0')}">${mutationName(mut)}</b> ` : '';
  const x = mult > 1 ? ` <b>×${fmt(mult)}</b>` : '';
  ui.toast(`Harvested ${label}${p.name}${x} &nbsp;<b class="coin">+₪${fmt(paid)}</b>${note}`, 'gold');
  sfx.harvest(TIERS[p.tier].order);
  gamepad.rumble(0.25 + TIERS[p.tier].order * 0.08, 90 + TIERS[p.tier].order * 20);
  ui.refresh();
  save();
}

function digUp(index) {
  if (state.sprinklers[index]) { removeSprinkler(index); return; }
  if (state.turrets[index]) { removeTurret(index); return; }
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
  const valid = player.shovel && target >= 0 && target < state.owned
    && (state.plots[target] || deviceAt(target));
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

  // Sprinkler standing on this plot.
  const sprId = owned ? state.sprinklers[i] : null;
  if (view.sprinkler && view.sprinkler.userData.spec.id !== sprId) {
    view.cropAnchor.remove(view.sprinkler);
    view.sprinkler = null;
  }
  if (sprId && !view.sprinkler) {
    const m = buildSprinkler(SPRINKLERS_BY_ID[sprId]);
    view.cropAnchor.add(m);
    view.sprinkler = m;
  }
  // Turret standing on this plot.
  const turId = owned ? state.turrets[i] : null;
  if (view.turret && view.turret.userData.spec.id !== turId) {
    view.cropAnchor.remove(view.turret);
    view.turret = null;
  }
  if (turId && !view.turret) {
    const m = buildTurret(TURRETS_BY_ID[turId]);
    view.cropAnchor.add(m);
    view.turret = m;
  }

  // Watered ground reads darker.
  view.soil.material = owned && sprinklerSpeed(i) > 1 ? wetSoilMat : world.soilMat;

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

const wetSoilMat = world.soilMat.clone();
wetSoilMat.color.setHex(0x7a5a3f);
wetSoilMat.roughness = 0.6;

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
    const ttl = e.ttl ?? 0.9;
    e.life += dt;
    if (!e.fade) {
      e.vel.y -= 9 * dt;
      e.mesh.position.addScaledVector(e.vel, dt);
      e.mesh.rotation.x += dt * 6; e.mesh.rotation.y += dt * 4;
    }
    e.mesh.material.opacity = Math.max(0, 1 - e.life / ttl);
    if (e.life > ttl) {
      scene.remove(e.mesh);
      e.mesh.material.dispose();
      e.mesh.geometry.dispose();
      effects.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------- sky & weather

const sky = new Sky(scene, world.sun, world.hemi);

function updateWeather() {
  const now = Date.now();
  if (now < state.weatherUntil) return;
  const first = !state.weatherUntil;
  const w = rollWeather(isNight());
  state.weather = w.id;
  const mins = w.mins[0] + Math.random() * (w.mins[1] - w.mins[0]);
  state.weatherUntil = now + mins * 60000;
  sky.setWeather(w.id);
  if (!first && w.id !== 'clear') {
    ui.toast(`${w.icon} <b>${w.name}</b> — ${w.growth > 1 ? `crops grow ${w.growth}× faster` : 'the sky turns'}`, 'gold');
    sfx.weather();
  }
  save();
}

// ---------------------------------------------------------------- bugs

const cellList = plotLayout();

const bugs = new BugSystem(scene, {
  plotCells: () => cellList,
  plantedPlots: () => state.plots.map((p, i) => (p ? i : -1)).filter(i => i >= 0),
  onAttach: (index, specId) => { addBug(index, specId); },
  onDetach: (index, specId) => { removeBug(index, specId); },
  onKill: bug => {
    earn(bug.spec.bounty);
    state.stats.bugsKilled++;
    burst({ x: bug.mesh.position.x, z: bug.mesh.position.z }, bug.spec.color);
    if (bug.spec.boss) {
      state.stats.bossesKilled++;
      for (let i = 0; i < 5; i++) burst({ x: bug.mesh.position.x, z: bug.mesh.position.z }, 0xffd54f);
      ui.toast(`💥 <b>${bug.spec.name} defeated!</b> +₪${fmt(bug.spec.bounty)}`, 'gold');
      sfx.pack(6);
      gamepad.rumble(0.8, 500);
      ui.setBoss(null);
    } else {
      sfx.squish();
    }
    ui.refresh();
    save();
  },
});

/** Put saved infestations back in the world when the game starts. */
function restoreBugs() {
  bugs.clear();
  state.plots.forEach((plot, i) => {
    for (const specId of plot?.bugs || []) bugs.spawnAttached(specId, i);
  });
}

function scheduleRaid(first = false) {
  let wait = first ? 90 + Math.random() * 60 : RAID_MIN + Math.random() * (RAID_MAX - RAID_MIN);
  if (isNight()) wait *= 0.6;                     // bugs are bolder after dark
  state.nextRaid = Date.now() + wait * 1000;
}

function startRaid() {
  const planted = state.plots.filter(Boolean).length;
  if (!planted) { scheduleRaid(); return; }
  const level = raidLevel(state.owned, state.discovered);

  // Every fourth raid, once the garden is worth raiding, sends a monster.
  state.raidCount = (state.raidCount || 0) + 1;
  if (level >= 2 && state.raidCount % 4 === 0 && !bugs.activeBoss) {
    const boss = bugs.spawnBoss(level);
    if (boss) {
      ui.toast(`💀 <b>${boss.spec.name} is coming!</b>`, 'bad');
      sfx.raid();
      gamepad.rumble(0.9, 600);
      scheduleRaid();
      save();
      return;
    }
  }

  const n = Math.min(12, 2 + Math.floor(level * 1.4) + Math.floor(Math.random() * 3));
  const sent = bugs.spawnWave(n, level);
  if (sent) {
    ui.toast(`🐛 <b>Bug raid!</b> ${sent} bugs heading for your crops`, 'bad');
    sfx.raid();
    gamepad.rumble(0.5, 320);
  }
  scheduleRaid();
  save();
}

function updateRaids() {
  if (!state.nextRaid) { scheduleRaid(true); return; }
  if (Date.now() >= state.nextRaid) startRaid();
}

// ---------------------------------------------------------------- combat

let fireCooldown = 0;

function fireWeapon() {
  const w = WEAPONS_BY_ID[player.weapon];
  if (!w || fireCooldown > 0) return;
  fireCooldown = w.cooldown;
  player.swing = 1;

  const origin = player.headPosition();
  const dir = player.lookDirection();
  const muzzle = origin.clone().addScaledVector(dir, 0.6);
  const tint = TIERS[w.tier].color;
  let hits = 0;

  if (w.kind === 'melee' || w.kind === 'spray') {
    // Everything in a short arc ahead of you.
    const reach = origin.clone().addScaledVector(dir, w.range * 0.6);
    for (const bug of bugs.near(reach.x, reach.z, w.kind === 'spray' ? w.splash : 1.6)) {
      bugs.damage(bug, w.damage); hits++;
    }
    if (w.kind === 'spray') waterBurst(scene, reach.x, reach.z, 1.4, effects);
  } else {
    const bug = bugs.pick(origin, dir, w.range);
    const end = bug ? bug.mesh.position.clone().setY(bug.mesh.position.y + 0.3) : origin.clone().addScaledVector(dir, w.range);
    tracer(scene, muzzle, end, tint, effects, w.kind === 'chain' ? 0.07 : 0.04);
    if (bug) {
      bugs.damage(bug, w.damage); hits++;
      if (w.kind === 'chain') {
        // Arc onward to nearby bugs.
        let from = bug;
        const zapped = new Set([bug]);
        for (let i = 1; i < w.chains; i++) {
          const next = bugs.near(from.mesh.position.x, from.mesh.position.z, 6).find(b => !zapped.has(b));
          if (!next) break;
          tracer(scene, from.mesh.position, next.mesh.position, 0x9fe8ff, effects, 0.05);
          zapped.add(next);
          const pos = from.mesh.position.clone();
          bugs.damage(next, w.damage * 0.7); hits++;
          from = next;
          void pos;
        }
      }
    }
  }

  sfx.shoot(w.kind);
  if (hits) gamepad.rumble(0.25, 70);
}

/** Turrets pick their own targets and fire on their own clock. */
function updateTurrets(dt) {
  for (let i = 0; i < PLOT_COUNT; i++) {
    const view = world.plots[i];
    if (!view.turret) continue;
    const spec = view.turret.userData.spec;
    const target = bugs.nearest(view.x, view.z, spec.range);
    animateTurret(view.turret, dt, target?.mesh.position);
    view.turret.userData.cooldown -= dt;
    if (target && view.turret.userData.cooldown <= 0) {
      view.turret.userData.cooldown = 1 / spec.rate;
      const from = new THREE.Vector3(view.x, 1.0, view.z);
      tracer(scene, from, target.mesh.position.clone().setY(0.3), TIERS[spec.tier].color, effects, 0.045);
      bugs.damage(target, spec.damage);
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
    if (!plot && deviceAt(i)) {
      const dev = deviceAt(i);
      const detail = dev.speed
        ? `${dev.speed}× growth in range`
        : `${fmt(dev.damage)} damage · ${dev.rate}/s · ${dev.range > 100 ? 'whole garden' : dev.range + 'm'}`;
      ui.setPrompt(`${dev.name} <span class="sub" style="color:${TIERS[dev.tier].css}">${detail} · G + hold E to pick up</span>`);
      return;
    }
    if (!plot) {
      const tur = TURRETS_BY_ID[ui.selected];
      if (tur) {
        ui.setPrompt(`<b>[E]</b> Place ${tur.name}
          <span class="sub">${fmt(tur.damage)} damage at ${tur.rate}/s · ${tur.range > 100 ? 'covers the whole garden' : 'range ' + tur.range + 'm'} · uses up this plot</span>`);
        return;
      }
      const spr = SPRINKLERS_BY_ID[ui.selected];
      if (spr) {
        ui.setPrompt(`<b>[E]</b> Place ${spr.name}
          <span class="sub">${spr.speed}× growth within ${spr.radius > 100 ? 'the whole garden' : spr.radius.toFixed(1) + 'm'} · uses up this plot</span>`);
        return;
      }
      const sel = ui.selected ? PLANTS_BY_ID[ui.selected] : null;
      ui.setPrompt(sel
        ? `<b>[E]</b> Plant ${sel.name} <span class="sub">${seedCount(sel.id)} seed${seedCount(sel.id) === 1 ? '' : 's'} left · 1–9 to switch</span>`
        : `Empty plot <span class="sub">No seeds — press B to visit the shop</span>`);
      return;
    }
    if (player.can) {
      const can = bestCan();
      const p = PLANTS_BY_ID[plot.plantId];
      const already = plot.watered || isRipe(plot, i);
      ui.setPrompt(already
        ? `${p.name} <span class="sub">${isRipe(plot, i) ? 'ready to harvest — put the can away (F)' : 'already watered this cycle'}</span>`
        : `<b>[E]</b> Water ${p.name} <span class="sub">+${Math.round(can.boost * 100)}% growth${can.radius ? ' to everything nearby' : ''}</span>`);
      return;
    }
    const p = PLANTS_BY_ID[plot.plantId];
    const picks = harvestsLeft(plot);
    if (isRipe(plot, i)) {
      const mut = plot.mut;
      const after = picks - 1;
      const more = p.harvests === 1 ? '' :
        after > 0 ? ` · regrows ${after} more time${after === 1 ? '' : 's'}` : ' · last picking';
      const tag = mut ? `<b style="color:${'#' + mutationColor(mut).toString(16).padStart(6, '0')}">${mutationName(mut)}</b> ` : '';
      const x = mut ? ` <b>×${fmt(mutationMultiplier(mut))}</b>` : '';
      ui.setPrompt(`<b>[E]</b> Harvest ${tag}${p.name}${x} — <span class="coin">₪${fmt(cropValue(p, mut))}</span>
        <span class="sub" style="color:${TIERS[p.tier].css}">${TIERS[p.tier].name}${more}</span>`);
    } else {
      const wait = Math.ceil(cycleSeconds(plot, i) * (1 - growth(plot, i)));
      const verb = isRegrowing(plot) ? 'regrowing' : 'grown';
      const tail = p.harvests === 1 ? '' : ` · ${picks} harvest${picks === 1 ? '' : 's'} left`;
      const spr = sprinklerSpeed(i);
      const infest = bugsOn(i);
      const ws = weatherSpeed();
      const wet = spr > 1 ? ` · <span style="color:#8fd8ff">${spr}× sprinkler</span>` : '';
      const sky = ws > 1 ? ` · <span style="color:#a8d8ff">${WEATHERS[state.weather].icon} ${ws}× weather</span>` : '';
      const chewed = infest ? ` · <span style="color:#ff7b6b">🐛 ${infest} bug${infest === 1 ? '' : 's'} slowing it</span>` : '';
      ui.setPrompt(`${p.name} — ${Math.floor(growth(plot, i) * 100)}% ${verb}
        <span class="sub">ready in ${wait}s${tail}${wet}${sky}${chewed}</span>`);
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
    if (player.weapon) return;                                    // armed: E fires instead
    if (player.shovel && (plot || deviceAt(i))) return;            // handled by hold-to-dig
    if (player.can && plot) { waterPlot(i); return; }
    if (!plot && deviceAt(i)) return;
    if (!plot && SPRINKLERS_BY_ID[ui.selected]) { placeSprinkler(i); return; }
    if (!plot && TURRETS_BY_ID[ui.selected]) { placeTurret(i); return; }
    if (!plot) plant(i);
    else if (isRipe(plot, i)) harvest(i);
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
      if (ui.packOpen) { ui.closePack(); menuSuppressUntil = performance.now() + 700; e.preventDefault(); }
      else if (ui.shopOpen) { escClosedShop = true; ui.toggleShop(false); e.preventDefault(); }
      else if (!ui.menuOpen) { document.exitPointerLock?.(); ui.showMenu(true); }
      break;
    case 'KeyQ': ui.cycleSelection(-1); break;
    case 'KeyP': togglePadTest(); break;
    case 'KeyG': toggleShovel(); break;
    case 'KeyF': toggleCan(); break;
    case 'KeyR': toggleWeapon(); break;
    default:
      if (/^Digit[1-9]$/.test(e.code)) ui.selectIndex(Number(e.code.slice(5)) - 1);
  }
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) return;
  if (ui.shopOpen || ui.packOpen) return;
  if (performance.now() < menuSuppressUntil) return;   // just closed a panel
  ui.showMenu(true);
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
  if (pressed.has(BTN.UP)) toggleCan();
  if (pressed.has(BTN.LEFT)) toggleWeapon();
  if (pressed.has(BTN.R3)) { player.camDistance = player.camDistance > 4 ? 3.2 : 6.0; }
  if (pressed.has(BTN.START) || pressed.has(BTN.BACK)) { document.exitPointerLock?.(); ui.showMenu(true); }
}

function toggleShovel(force) {
  const on = player.setShovel(force ?? !player.shovel);
  ui.setShovel(on);
  if (on) { if (player.can) { player.setCan(false); ui.setCan(false); }
            if (player.weapon) { player.setWeapon(false); ui.setWeapon(null); } }
  ui.toast(on ? 'Shovel out — hold E on a plant to dig it up' : 'Shovel away');
  return on;
}

function toggleCan(force) {
  const can = bestCan();
  if (!can) { ui.toast('You do not own a watering can yet — check the shop (B).', 'bad'); sfx.deny(); return false; }
  const on = player.setCan(force ?? !player.can, can);
  ui.setCan(on);
  if (on) { if (player.shovel) toggleShovel(false);
            if (player.weapon) { player.setWeapon(false); ui.setWeapon(null); } }
  ui.toast(on ? `${can.name} out — press E on a plant to water it` : 'Watering can away');
  return on;
}

function doGoldenHarvest() {
  if (!canGoldenHarvest()) return;
  const gained = goldenHarvest();
  bugs.clear();
  syncAllPlots(true);
  ui.toggleShop(false);
  ui.refresh();
  ui.toast(`🌟 <b>Golden Harvest!</b> +${gained} Golden Seeds — every crop is now worth ${goldenMultiplier(state.golden).toFixed(1)}× more`, 'gold');
  sfx.pack(7);
  gamepad.rumble(0.9, 700);
  save();
}

let trophyClock = 0;
function checkTrophies(dt) {
  trophyClock += dt;
  if (trophyClock < 1) return;
  trophyClock = 0;
  for (const t of claimTrophies()) {
    ui.toast(`🏆 <b>${t.name}</b> — ${t.hint}${t.golden ? ` · +${t.golden} Golden Seeds` : ` · +₪${fmt(t.reward)}`}`, 'gold');
    sfx.pack(3);
  }
}

function bestWeapon() {
  return WEAPONS_BY_ID[[...Object.keys(state.weapons)]
    .sort((a, b) => WEAPONS_BY_ID[b].damage - WEAPONS_BY_ID[a].damage)[0]] || null;
}

function toggleWeapon(force) {
  const w = bestWeapon();
  if (!w) { ui.toast('You have no weapons — check the shop (B).', 'bad'); sfx.deny(); return false; }
  const on = player.setWeapon(force ?? !player.weapon, w);
  ui.setWeapon(on ? w.id : null);
  if (on) { toggleShovelOff(); player.setCan(false); ui.setCan(false); }
  ui.toast(on ? `${w.name} ready — E or click to swing` : 'Weapon away');
  return on;
}

function toggleShovelOff() {
  if (player.shovel) { player.setShovel(false); ui.setShovel(false); }
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
  const using = active && (player.keys.has('KeyE') || mouseHeld || gamepad.held.has(BTN.A));
  updateDigging(using && !player.weapon);
  updateWeather();
  const phase = dayPhase();
  sky.update(dt, phase, player.pos);
  if (sky.takeStrike()) sfx.thunder();
  ui.setSky(phase, state.weather);
  updateRaids();
  bugs.update(dt, t, camera);
  updateTurrets(dt);
  fireCooldown = Math.max(0, fireCooldown - dt);
  if (player.weapon && using) fireWeapon();
  player.swing = Math.max(0, player.swing - dt * 4);
  ui.setBugCount(bugs.count);
  const boss = bugs.activeBoss;
  ui.setBoss(boss ? { name: boss.spec.name, hp: boss.hp, maxHp: boss.maxHp } : null);
  checkTrophies(dt);
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
    if (view.sprinkler) animateSprinkler(view.sprinkler, t, dt);
    if (!view.crop) continue;
    const data = state.plots[i];
    const g = growth(data, i);
    const done = g >= 1;
    if (done) {
      ripe++;
      // A crop takes on its mutation the moment it finishes ripening.
      if (data.mut === undefined) {
        data.mut = rollMutation(state.weather);
        if (data.mut) {
          const name = mutationName(data.mut);
          const mult = mutationMultiplier(data.mut);
          if (mult >= 20) {
            ui.toast(`✨ A <b>${name}</b> ${PLANTS_BY_ID[data.plantId].name} appeared! <b>×${fmt(mult)}</b>`, 'gold');
            sfx.pack(6);
            gamepad.rumble(0.5, 220);
          }
          save();
        }
      }
    }
    applyMutation(view.crop, done ? data.mut : null, mutationColor);
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
window.game = { build: BUILD_LABEL, sky, doGoldenHarvest, updateWeather, sellDevice, toggleShovel, toggleCan, toggleWeapon, digUp, sellSeed, buyCan, buySprinkler,
                placeSprinkler, buyWeapon, buyTurret, placeTurret, bugs, startRaid, fireWeapon,
                waterPlot, refreshSprinklers, plotSpeed, state, world, player, ui, gamepad, camera, scene, save, syncAllPlots, buySeed, buyPack, buyPlot, plant, harvest, interact };

restoreBugs();
syncAllPlots();
ui.refresh();
document.getElementById('loading').remove();
tick();

// Gentle nudge for a brand-new gardener.
if (state.money <= 1 && Object.keys(state.seeds).length === 0 && state.stats.harvested === 0) {
  ui.toast('You have exactly one sheckle. Press <b>B</b> and buy a carrot seed.', 'gold');
}
