// Persistent game state: money, seeds, owned plots, planted crops.

import { PLOT_COUNT, PLANTS_BY_ID, plotCost } from './data.js';

const SAVE_KEY = 'sheckle-garden-save-v1';
export const SAVE_VERSION = 2;

function freshState() {
  return {
    version: SAVE_VERSION,
    money: 1,
    seeds: { carrot: 0 },
    discovered: { carrot: true, radish: true, lettuce: true },
    owned: 1,                       // number of unlocked plots (first N of plotOrder)
    plots: new Array(PLOT_COUNT).fill(null), // { plantId, plantedAt, taken }
    stats: { harvested: 0, earned: 0, packsOpened: 0, best: null },
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

  const plots = Array.isArray(raw.plots) ? raw.plots : [];
  s.plots = new Array(PLOT_COUNT).fill(null).map((_, i) => {
    const p = plots[i];
    if (!p || !PLANTS_BY_ID[p.plantId] || !Number.isFinite(p.plantedAt)) return null;
    const plant = PLANTS_BY_ID[p.plantId];
    // Saves from before multi-harvest have no `taken`; they start fresh.
    const taken = Number.isFinite(p.taken) ? Math.min(Math.max(0, Math.floor(p.taken)), plant.harvests - 1) : 0;
    // A clock set backwards shouldn't leave a crop growing forever.
    return { plantId: p.plantId, plantedAt: Math.min(p.plantedAt, Date.now()), taken };
  });
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
}

export function nextPlotCost() { return plotCost(state.owned); }

/** Seconds this plot's current cycle takes — the first is the slow one. */
export function cycleSeconds(plot) {
  const plant = PLANTS_BY_ID[plot?.plantId];
  if (!plant) return 1;
  return plot.taken > 0 ? plant.regrow : plant.grow;
}

/** Growth progress of a plot's current cycle, 0..1. */
export function growth(plot) {
  if (!plot || !PLANTS_BY_ID[plot.plantId]) return 0;
  return Math.min(1, (Date.now() - plot.plantedAt) / (cycleSeconds(plot) * 1000));
}

export function isRipe(plot) { return growth(plot) >= 1; }

/** True once this plant has been picked at least once. */
export function isRegrowing(plot) { return !!plot && plot.taken > 0; }

/** Pickings remaining, including the one that's ready now. */
export function harvestsLeft(plot) {
  const plant = PLANTS_BY_ID[plot?.plantId];
  return plant ? plant.harvests - (plot.taken || 0) : 0;
}
