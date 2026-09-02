// Persistent game state: money, seeds, owned plots, planted crops.

import { PLOT_COUNT, PLANTS_BY_ID, plotCost, plotLayout, LAYOUT_ID,
         CANS, CANS_BY_ID, SPRINKLERS_BY_ID, TURRETS_BY_ID, WEAPONS_BY_ID,
         BUGS_BY_ID, BUG_SLOW, TROPHIES, goldenFor, goldenMultiplier,
         GOLDEN_MIN_EARNED, WEATHERS, mutationMultiplier, VARIANTS_BY_ID, MARKS,
         PETS_BY_ID, PET_SLOTS, PET_MAX_LEVEL, petXpFor, EGGS_BY_ID,
         UPGRADES, UPGRADES_BY_ID, upgradeCost, rankFor } from './data.js';

const SAVE_KEY = 'sheckle-garden-save-v1';
export const SAVE_VERSION = 2;

function freshState() {
  return {
    version: SAVE_VERSION,
    layout: LAYOUT_ID,
    money: 1,
    seeds: { carrot: 0 },
    discovered: { carrot: true, radish: true, lettuce: true },
    owned: 1,                       // number of unlocked plots (first N of plotOrder)
    plots: new Array(PLOT_COUNT).fill(null),      // { plantId, plantedAt, taken, watered }
    sprinklers: new Array(PLOT_COUNT).fill(null), // sprinkler id sitting on each plot
    turrets: new Array(PLOT_COUNT).fill(null),    // turret id sitting on each plot
    weapons: {},                                  // weapons owned
    nextRaid: 0,                                  // when the next bug raid is due
    stock: {},                                    // sprinklers bought but not yet placed
    cans: {},                                     // watering cans owned
    stats: { harvested: 0, earned: 0, packsOpened: 0, best: null, bugsKilled: 0, bossesKilled: 0 },
    golden: 0,          // Golden Seeds kept through every Golden Harvest
    prestiges: 0,       // how many times the garden has been replanted
    runEarned: 0,       // earnings since the last Golden Harvest
    trophies: {},       // claimed trophy ids
    weather: 'clear',
    weatherUntil: 0,
    best: { mult: 1, name: '', plant: null },   // finest crop ever pulled
    pets: [],           // { uid, id, level, xp }
    equipped: [],       // pet uids currently following you
    eggs: [],           // { id, readyAt }
    nextPetUid: 1,
    upgrades: {},       // Garden Mastery levels
  };
}

export const state = load();

/**
 * Fold a save of any age into the current shape. Unknown fields are kept,
 * missing ones take their default, and anything nonsensical is dropped — so
 * old saves keep working when the game gains new features.
 */
function sanitize(raw) {
  const base = freshState();
  if (!raw || typeof raw !== 'object') return base;

  const s = { ...base, ...raw, version: SAVE_VERSION };
  s.money = Number.isFinite(raw.money) ? Math.max(0, raw.money) : base.money;
  s.owned = Number.isFinite(raw.owned) ? Math.min(PLOT_COUNT, Math.max(1, Math.floor(raw.owned))) : base.owned;
  s.stats = { ...base.stats, ...(raw.stats || {}) };

  s.seeds = {};
  for (const [id, n] of Object.entries(raw.seeds || {})) {
    if (PLANTS_BY_ID[id] && Number.isFinite(n) && n > 0) s.seeds[id] = Math.floor(n);
  }

  s.discovered = { ...base.discovered };
  for (const id of Object.keys(raw.discovered || {})) {
    if (PLANTS_BY_ID[id]) s.discovered[id] = true;
  }
  for (const id of Object.keys(s.seeds)) s.discovered[id] = true;

  s.golden = Number.isFinite(raw.golden) ? Math.max(0, Math.floor(raw.golden)) : 0;
  s.prestiges = Number.isFinite(raw.prestiges) ? Math.max(0, Math.floor(raw.prestiges)) : 0;
  // Saves from before Golden Harvest count everything earned so far as this run.
  s.runEarned = Number.isFinite(raw.runEarned) ? Math.max(0, raw.runEarned) : (s.stats.earned || 0);
  s.trophies = {};
  for (const t of TROPHIES) if (raw.trophies?.[t.id]) s.trophies[t.id] = true;
  s.pets = Array.isArray(raw.pets) ? raw.pets.filter(p => PETS_BY_ID[p?.id]).map(p => ({
    uid: p.uid, id: p.id,
    level: Math.min(PET_MAX_LEVEL, Math.max(1, Math.floor(p.level) || 1)),
    xp: Math.max(0, p.xp || 0),
  })) : [];
  s.nextPetUid = Math.max(1, Number(raw.nextPetUid) || 1, ...s.pets.map(p => (p.uid || 0) + 1));
  s.equipped = Array.isArray(raw.equipped)
    ? raw.equipped.filter(uid => s.pets.some(p => p.uid === uid)).slice(0, PET_SLOTS) : [];
  s.eggs = Array.isArray(raw.eggs)
    ? raw.eggs.filter(e => EGGS_BY_ID[e?.id] && Number.isFinite(e.readyAt)).slice(0, 12) : [];
  s.upgrades = {};
  for (const u of UPGRADES) {
    const lv = Math.floor(raw.upgrades?.[u.id] || 0);
    if (lv > 0) s.upgrades[u.id] = lv;
  }
  s.weather = WEATHERS[raw.weather] ? raw.weather : 'clear';
  s.weatherUntil = Number.isFinite(raw.weatherUntil) ? raw.weatherUntil : 0;
  s.best = raw.best && Number.isFinite(raw.best.mult) ? raw.best : { mult: 1, name: '', plant: null };

  s.cans = {};
  for (const id of Object.keys(raw.cans || {})) if (CANS_BY_ID[id]) s.cans[id] = true;

  s.stock = {};
  for (const [id, n] of Object.entries(raw.stock || {})) {
    if (SPRINKLERS_BY_ID[id] && Number.isFinite(n) && n > 0) s.stock[id] = Math.floor(n);
  }

  s.weapons = {};
  for (const id of Object.keys(raw.weapons || {})) if (WEAPONS_BY_ID[id]) s.weapons[id] = true;

  const rawTur = Array.isArray(raw.turrets) ? raw.turrets : [];
  s.turrets = new Array(PLOT_COUNT).fill(null)
    .map((_, i) => (TURRETS_BY_ID[rawTur[i]] ? rawTur[i] : null));
  s.nextRaid = Number.isFinite(raw.nextRaid) ? raw.nextRaid : 0;

  const rawSpr = Array.isArray(raw.sprinklers) ? raw.sprinklers : [];
  s.sprinklers = new Array(PLOT_COUNT).fill(null)
    .map((_, i) => (SPRINKLERS_BY_ID[rawSpr[i]] ? rawSpr[i] : null));

  const clean = p => {
    if (!p || !PLANTS_BY_ID[p.plantId] || !Number.isFinite(p.plantedAt)) return null;
    const plant = PLANTS_BY_ID[p.plantId];
    // Saves from before multi-harvest have no `taken`; they start fresh.
    const taken = Number.isFinite(p.taken) ? Math.min(Math.max(0, Math.floor(p.taken)), plant.harvests - 1) : 0;
    // A clock set backwards shouldn't leave a crop growing forever.
    const out = { plantId: p.plantId, plantedAt: Math.min(p.plantedAt, Date.now()), taken, watered: !!p.watered };
    // Bugs left chewing when you quit are still there when you come back.
    if (Array.isArray(p.bugs)) out.bugs = p.bugs.filter(id => BUGS_BY_ID[id]).slice(0, 12);
    // Whatever the crop mutated into as it ripened.
    if (p.mut && VARIANTS_BY_ID[p.mut.v]) out.mut = { v: p.mut.v, m: MARKS[p.mut.m] ? p.mut.m : null };
    if (Number.isFinite(p.x) && Number.isFinite(p.z)) { out.x = p.x; out.z = p.z; }
    return out;
  };

  const raws = Array.isArray(raw.plots) ? raw.plots : [];
  s.plots = new Array(PLOT_COUNT).fill(null);

  if (raw.layout && raw.layout !== LAYOUT_ID) {
    // The garden's shape changed between versions, so plot index no longer means
    // the same square. Put every crop back on the bed nearest where it was.
    const cells = plotLayout();
    for (const p of raws) {
      const c = clean(p);
      if (!c) continue;
      let best = -1, bestD = Infinity;
      cells.forEach((cell, i) => {
        if (s.plots[i]) return;
        const d = Number.isFinite(c.x) ? Math.hypot(cell.x - c.x, cell.z - c.z) : Infinity;
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best >= 0) s.plots[best] = c;
    }
  } else {
    for (let i = 0; i < PLOT_COUNT; i++) s.plots[i] = clean(raws[i]);
  }
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : freshState();
  } catch (err) {
    console.warn('Save could not be read, starting fresh.', err);
    return freshState();
  }
}

export function save() {
  // Stamp each crop with where it physically sits, so it can be put back on the
  // same bed even if the garden's layout changes in a later version.
  const cells = plotLayout();
  state.plots.forEach((p, i) => { if (p && cells[i]) { p.x = cells[i].x; p.z = cells[i].z; } });
  state.layout = LAYOUT_ID;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (err) { /* storage full or blocked */ }
}

export function resetSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
  Object.assign(state, freshState());
}

/** The whole save as pretty JSON, for the "back up" button. */
export function exportSave() {
  return JSON.stringify({ ...state, version: SAVE_VERSION, savedAt: new Date().toISOString() }, null, 2);
}

/** Replace the current game with a backup file. Throws if it isn't one. */
export function importSave(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !Number.isFinite(data.money) || !Array.isArray(data.plots)) {
    throw new Error('That file is not a Sheckle Garden backup.');
  }
  const clean = sanitize(data);
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, clean);
  save();
  return clean;
}

export function seedCount(id) { return state.seeds[id] || 0; }

export function addSeed(id, n = 1) {
  state.seeds[id] = seedCount(id) + n;
  state.discovered[id] = true;
}

export function takeSeed(id) {
  if (seedCount(id) <= 0) return false;
  state.seeds[id] -= 1;
  if (state.seeds[id] <= 0) delete state.seeds[id];
  return true;
}

export function spend(amount) {
  if (state.money < amount) return false;
  state.money -= amount;
  return true;
}

export function earn(amount) {
  state.money += amount;
  state.stats.earned += amount;
  state.runEarned += amount;
}

// ---- pets, upgrades and rank ------------------------------------------

export function upgradeLevel(id) { return state.upgrades[id] || 0; }
export function nextUpgradeCost(id) { return upgradeCost(UPGRADES_BY_ID[id], upgradeLevel(id)); }

export function equippedPets() {
  return state.equipped.map(uid => state.pets.find(p => p.uid === uid)).filter(Boolean);
}

/** Total of one pet ability across everything you have out. */
export function petPower(ability) {
  let sum = 0;
  for (const owned of equippedPets()) {
    const spec = PETS_BY_ID[owned.id];
    if (spec?.ability === ability) sum += spec.power * owned.level;
  }
  return sum;
}

export function petHarvestRange() {
  let best = 0;
  for (const owned of equippedPets()) {
    const spec = PETS_BY_ID[owned.id];
    if (spec?.ability === 'harvest') best = Math.max(best, spec.power + owned.level * 0.4);
  }
  return best;
}

/** Mutation luck from pets and the Four-Leaf upgrade, as a multiplier. */
export function luckMultiplier() {
  return (1 + petPower('luck')) * (1 + upgradeLevel('clover') * 0.25);
}

export function rank() { return rankFor(state.stats.earned); }

/** What a crop is worth: base × mutation × Golden Seeds × pets × upgrades. */
export function cropValue(plant, mut = null) {
  const boost = (1 + petPower('value')) * (1 + upgradeLevel('sap') * 0.06);
  return Math.floor(plant.sell * mutationMultiplier(mut) * goldenMultiplier(state.golden) * boost);
}

/** Weather, pets and upgrades all speed the whole garden up. */
export function weatherSpeed() {
  return (WEATHERS[state.weather]?.growth ?? 1)
    * (1 + petPower('growth'))
    * (1 + upgradeLevel('soil') * 0.06);
}

// ---- Golden Harvest ---------------------------------------------------

/** Golden Seeds this run would pay out. */
export function goldenPending() { return goldenFor(state.runEarned); }

export function canGoldenHarvest() {
  return state.owned >= PLOT_COUNT && state.runEarned >= GOLDEN_MIN_EARNED && goldenPending() > 0;
}

/**
 * Replant everything from scratch in exchange for Golden Seeds. Tools, the
 * almanac, trophies and anything in the shed are kept — only the garden and
 * your sheckles go back to the start.
 */
export function goldenHarvest() {
  if (!canGoldenHarvest()) return 0;
  const gained = Math.floor(goldenPending() * (1 + upgradeLevel('compost') * 0.03));
  state.golden += gained;
  state.prestiges += 1;

  // Placed devices come back to the shed rather than being lost.
  for (let i = 0; i < PLOT_COUNT; i++) {
    for (const list of [state.sprinklers, state.turrets]) {
      if (list[i]) { state.stock[list[i]] = (state.stock[list[i]] || 0) + 1; list[i] = null; }
    }
  }

  state.money = 1;
  state.seeds = {};
  state.plots = new Array(PLOT_COUNT).fill(null);
  state.owned = 1;
  state.runEarned = 0;
  state.nextRaid = 0;
  refreshSprinklers();
  return gained;
}

// ---- Trophies ---------------------------------------------------------

/** Trophies newly completed since last checked, marked as claimed. */
export function claimTrophies() {
  const won = [];
  for (const t of TROPHIES) {
    if (state.trophies[t.id]) continue;
    if (t.at(state) >= t.goal) {
      state.trophies[t.id] = true;
      if (t.reward) earn(t.reward);
      if (t.golden) state.golden += t.golden;
      won.push(t);
    }
  }
  return won;
}

export function trophyProgress(t) {
  return Math.min(1, t.at(state) / t.goal);
}

export function nextPlotCost() { return plotCost(state.owned); }

// ---- sprinklers -------------------------------------------------------

const cells = plotLayout();
let speeds = new Array(PLOT_COUNT).fill(1);

/** Recompute each plot's growth multiplier. Call whenever sprinklers change. */
export function refreshSprinklers() {
  speeds = cells.map((cell, i) => {
    let best = 1;
    for (let j = 0; j < PLOT_COUNT; j++) {
      const s = SPRINKLERS_BY_ID[state.sprinklers[j]];
      if (!s) continue;
      if (Math.hypot(cells[j].x - cell.x, cells[j].z - cell.z) <= s.radius + 1e-6) {
        best = Math.max(best, s.speed);   // overlapping sprinklers don't stack
      }
    }
    return best;
  });
  return speeds;
}

/** Bugs currently chewing on this plot. */
export function bugsOn(index) { return state.plots[index]?.bugs?.length || 0; }

/** Net growth multiplier: sprinklers and weather speed a plot up, bugs drag it down. */
export function plotSpeed(index) {
  return (speeds[index] ?? 1) * weatherSpeed() / (1 + BUG_SLOW * bugsOn(index));
}

/** Sprinkler-only multiplier, for showing the two effects separately. */
export function sprinklerSpeed(index) { return speeds[index] ?? 1; }

export function addBug(index, specId) {
  const plot = state.plots[index];
  if (!plot) return false;
  (plot.bugs ||= []).push(specId);
  return true;
}

export function removeBug(index, specId) {
  const plot = state.plots[index];
  if (!plot?.bugs?.length) return;
  const i = plot.bugs.indexOf(specId);
  plot.bugs.splice(i < 0 ? 0 : i, 1);
  if (!plot.bugs.length) delete plot.bugs;
}

export function turretAt(index) { return TURRETS_BY_ID[state.turrets[index]] || null; }

/** Any device standing on this plot blocks planting. */
export function deviceAt(index) {
  return SPRINKLERS_BY_ID[state.sprinklers[index]] || TURRETS_BY_ID[state.turrets[index]] || null;
}

/** The sprinkler standing on this plot, if any. */
export function sprinklerAt(index) { return SPRINKLERS_BY_ID[state.sprinklers[index]] || null; }

export function stockCount(id) { return state.stock[id] || 0; }

export function addSprinkler(id, n = 1) { state.stock[id] = stockCount(id) + n; }

export function takeSprinkler(id) {
  if (stockCount(id) <= 0) return false;
  state.stock[id] -= 1;
  if (state.stock[id] <= 0) delete state.stock[id];
  return true;
}

/** The best watering can owned, or null. */
export function bestCan() {
  let best = null;
  for (const can of CANS) if (state.cans[can.id]) best = !best || can.boost > best.boost ? can : best;
  return best;
}

// ---- growth -----------------------------------------------------------

/** Seconds this plot's current cycle takes — the first is the slow one. */
export function cycleSeconds(plot, index = -1) {
  const plant = PLANTS_BY_ID[plot?.plantId];
  if (!plant) return 1;
  const base = plot.taken > 0 ? plant.regrow : plant.grow;
  return index >= 0 ? base / plotSpeed(index) : base;
}

/** Growth progress of a plot's current cycle, 0..1. */
export function growth(plot, index = -1) {
  if (!plot || !PLANTS_BY_ID[plot.plantId]) return 0;
  return Math.min(1, (Date.now() - plot.plantedAt) / (cycleSeconds(plot, index) * 1000));
}

export function isRipe(plot, index = -1) { return growth(plot, index) >= 1; }

/** True once this plant has been picked at least once. */
export function isRegrowing(plot) { return !!plot && plot.taken > 0; }

/** Pickings remaining, including the one that's ready now. */
export function harvestsLeft(plot) {
  const plant = PLANTS_BY_ID[plot?.plantId];
  return plant ? plant.harvests - (plot.taken || 0) : 0;
}

// Sprinkler coverage is derived from the loaded save, once everything above exists.
refreshSprinklers();
