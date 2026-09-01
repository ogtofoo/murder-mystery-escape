// Persistent game state: money, seeds, owned plots, planted crops.

import { PLOT_COUNT, PLANTS_BY_ID, plotCost } from './data.js';

const SAVE_KEY = 'sheckle-garden-save-v1';

function freshState() {
  return {
    money: 1,
    seeds: { carrot: 0 },
    discovered: { carrot: true, radish: true, lettuce: true },
    owned: 1,                       // number of unlocked plots (first N of plotOrder)
    plots: new Array(PLOT_COUNT).fill(null), // { plantId, plantedAt }
    stats: { harvested: 0, earned: 0, packsOpened: 0, best: null },
  };
}

export const state = load();

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshState();
    const s = JSON.parse(raw);
    const base = freshState();
    const merged = { ...base, ...s, stats: { ...base.stats, ...(s.stats || {}) } };
    merged.seeds = { ...(s.seeds || {}) };
    merged.discovered = { ...base.discovered, ...(s.discovered || {}) };
    if (!Array.isArray(merged.plots) || merged.plots.length !== PLOT_COUNT) {
      merged.plots = new Array(PLOT_COUNT).fill(null);
    }
    // Drop crops referencing plants that no longer exist.
    merged.plots = merged.plots.map(p => (p && PLANTS_BY_ID[p.plantId] ? p : null));
    return merged;
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

/** Growth progress of a plot, 0..1. */
export function growth(plot) {
  if (!plot) return 0;
  const plant = PLANTS_BY_ID[plot.plantId];
  if (!plant) return 0;
  return Math.min(1, (Date.now() - plot.plantedAt) / (plant.grow * 1000));
}

export function isRipe(plot) { return growth(plot) >= 1; }
