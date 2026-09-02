// Game data: tiers, plants, seed packs, land pricing.

export const TIERS = {
  common:       { id:'common',       name:'Common',       color:0x9ccc65, css:'#9ccc65', order:0, shine:0 },
  uncommon:     { id:'uncommon',     name:'Uncommon',     color:0x4dd0e1, css:'#4dd0e1', order:1, shine:0 },
  rare:         { id:'rare',         name:'Rare',         color:0x5c8bff, css:'#5c8bff', order:2, shine:0.15 },
  legendary:    { id:'legendary',    name:'Legendary',    color:0xffb300, css:'#ffb300', order:3, shine:0.35 },
  mythic:       { id:'mythic',       name:'Mythic',       color:0xb455f6, css:'#b455f6', order:4, shine:0.55 },
  prismatic:    { id:'prismatic',    name:'Prismatic',    color:0xff4fd8, css:'#ff4fd8', order:5, shine:0.8, rainbow:true },
  transcendent: { id:'transcendent', name:'Transcendent', color:0x00e5ff, css:'#00e5ff', order:6, shine:1.0, rainbow:true },
  super:        { id:'super',        name:'SUPER',        color:0xffffff, css:'#fff1a8', order:7, shine:1.4, rainbow:true },
};

export const TIER_ORDER = Object.values(TIERS).sort((a,b)=>a.order-b.order).map(t=>t.id);

// kind drives the 3D model: root | leaf | bush | vine | flower | pitaya | tree | orb
export const PLANTS = [
  // ---- Common ----
  { id:'carrot',   name:'Carrot',        tier:'common', kind:'root',  cost:1,     grow:8,   sell:4,     colors:[0xff8f3f,0x66bb6a] },
  { id:'radish',   name:'Radish',        tier:'common', kind:'root',  cost:4,     grow:12,  sell:12,    colors:[0xe8517a,0x7cb342] },
  { id:'lettuce',  name:'Lettuce',       tier:'common', kind:'leaf',  cost:12,    grow:16,  sell:34,    colors:[0x8bc34a,0xaed581] },
  // ---- Uncommon ----
  { id:'tomato',   name:'Tomato',        tier:'uncommon', kind:'bush', cost:60,   grow:22,  sell:180,   colors:[0xe53935,0x4caf50] },
  { id:'blueberry',name:'Blueberry',     tier:'uncommon', kind:'bush', cost:220,  grow:28,  sell:680,   colors:[0x3f51b5,0x43a047] },
  { id:'pepper',   name:'Fire Pepper',   tier:'uncommon', kind:'bush', cost:800,  grow:34,  sell:2500,  colors:[0xff5722,0x2e7d32] },
  // ---- Rare ----
  { id:'melon',    name:'Watermelon',    tier:'rare', kind:'vine',  cost:3200,   grow:45,  sell:11000,  colors:[0x2e7d32,0x66bb6a] },
  { id:'pumpkin',  name:'Pumpkin',       tier:'rare', kind:'vine',  cost:12000,  grow:55,  sell:44000,  colors:[0xef6c00,0x558b2f] },
  { id:'dragon',   name:'Dragonfruit',   tier:'rare', kind:'pitaya',cost:45000,  grow:70,  sell:175000, colors:[0xff2d78,0x4caf50] },
  // ---- Legendary ----
  { id:'goldapple',name:'Golden Apple',  tier:'legendary', kind:'tree', cost:180000,   grow:90,  sell:760000,   colors:[0xffd54f,0x4e342e] },
  { id:'starcorn', name:'Star Corn',     tier:'legendary', kind:'leaf', cost:700000,   grow:110, sell:4600000,  colors:[0xfff176,0x9ccc65] },
  { id:'moonflower',name:'Moonflower',   tier:'legendary', kind:'flower',cost:2600000, grow:130, sell:12000000, colors:[0xe1f5fe,0x80cbc4] },
  // ---- Mythic ----
  { id:'voidmelon',name:'Void Melon',    tier:'mythic', kind:'vine', cost:11000000,  grow:150, sell:52000000,  colors:[0x311b92,0x7c4dff] },
  { id:'phoenix',  name:'Phoenix Pepper',tier:'mythic', kind:'bush', cost:45000000,  grow:175, sell:220000000, colors:[0xff6d00,0xffd600] },
  { id:'lotus',    name:'Celestial Lotus',tier:'mythic',kind:'flower',cost:190000000, grow:200, sell:950000000, colors:[0xf8bbd0,0xb39ddb] },
  // ---- Prismatic ----
  { id:'prismrose',name:'Prism Rose',    tier:'prismatic', kind:'flower', cost:8e8,  grow:220, sell:4.2e9,  colors:[0xff4fd8,0x69f0ae] },
  { id:'auroravine',name:'Aurora Vine',  tier:'prismatic', kind:'vine',   cost:3.4e9,grow:240, sell:1.8e10, colors:[0x00e676,0x18ffff] },
  { id:'spectralfig',name:'Spectral Fig',tier:'prismatic', kind:'tree',   cost:1.4e10,grow:260,sell:7.6e10, colors:[0xba68c8,0x4dd0e1] },
  // ---- Transcendent ----
  { id:'eternityroot',name:'Eternity Root', tier:'transcendent', kind:'root', cost:6e10, grow:280, sell:4.8e11, colors:[0x00e5ff,0x1de9b6] },
  { id:'novabloom', name:'Nova Bloom',   tier:'transcendent', kind:'flower', cost:2.6e11,grow:300, sell:1.4e12, colors:[0xffffff,0x40c4ff] },
  { id:'chronofruit',name:'Chrono Fruit',tier:'transcendent', kind:'orb',    cost:1.1e12,grow:320, sell:6e12,   colors:[0x64ffda,0x536dfe] },
  // ---- Super ----
  { id:'sheckletree',name:'Sheckle Tree',tier:'super', kind:'tree', cost:5e12, grow:340, sell:2.8e13, colors:[0xffe082,0x8d6e63] },
  { id:'infinitygourd',name:'Infinity Gourd',tier:'super', kind:'vine', cost:2.2e13,grow:380, sell:1.3e14, colors:[0xfff59d,0xff8a80] },
  { id:'superfruit', name:'SUPERFRUIT',  tier:'super', kind:'orb',  cost:1e14, grow:420, sell:6.5e14, colors:[0xffffff,0xffd54f] },
];

/**
 * How many times a crop can be picked before it's spent, by shape. Crops you
 * pull out of the ground whole (roots, leafy greens, corn) are one-and-done;
 * anything that fruits from a standing plant keeps producing.
 */
const HARVESTS_BY_KIND = { root: 1, leaf: 1, bush: 4, vine: 3, flower: 5, pitaya: 5, tree: 6, orb: 8 };

// Regrowth is faster than the first grow — established plants pay off quicker.
const REGROW_RATIO = { tree: 0.5, orb: 0.5, flower: 0.55, pitaya: 0.55, bush: 0.55, vine: 0.6 };

for (const p of PLANTS) {
  p.harvests = p.harvests ?? HARVESTS_BY_KIND[p.kind] ?? 1;
  p.regrow = p.harvests > 1 ? Math.max(3, Math.round(p.grow * (REGROW_RATIO[p.kind] ?? 0.55))) : 0;
  // A seed that pays out many times is worth more up front; the table's `cost`
  // is the price of a single-harvest seed of that value.
  p.seedBase = p.cost;
  p.cost = Math.round(p.cost * (1 + 0.55 * (p.harvests - 1)));
  p.lifetime = p.sell * p.harvests;                 // total sheckles from one seed
  p.cycleTime = p.grow + p.regrow * (p.harvests - 1);
}

export const PLANTS_BY_ID = Object.fromEntries(PLANTS.map(p => [p.id, p]));

/**
 * Watering cans: a manual shot of growth. Using one skips the plot ahead by
 * `boost` of its current cycle, once per cycle. The super can does a whole
 * area at once.
 */
export const CANS = [
  { id:'can_common', name:'Watering Can',       tier:'common', cost:300,  boost:0.25, radius:0 },
  { id:'can_super',  name:'SUPER Watering Can', tier:'super',  cost:5e10, boost:0.60, radius:6.5 },
];
export const CANS_BY_ID = Object.fromEntries(CANS.map(c => [c.id, c]));

/**
 * Sprinklers sit on a tilled plot (costing you that square) and permanently
 * speed up every crop within `radius` world units by `speed`x. Overlapping
 * sprinklers don't stack — the best one covering a plot wins.
 */
export const SPRINKLERS = [
  { id:'spr_common',       name:'Common Sprinkler',       tier:'common',       cost:12000, radius:2.7,  speed:1.35 },
  { id:'spr_rare',         name:'Rare Sprinkler',         tier:'rare',         cost:1.5e6, radius:3.9,  speed:1.70 },
  { id:'spr_legendary',    name:'Legendary Sprinkler',    tier:'legendary',    cost:2.5e8, radius:5.5,  speed:2.20 },
  { id:'spr_prismatic',    name:'Prismatic Sprinkler',    tier:'prismatic',    cost:1.2e11,radius:7.5,  speed:2.90 },
  { id:'spr_transcendent', name:'Transcendent Sprinkler', tier:'transcendent', cost:9e12,  radius:10.5, speed:3.80 },
  { id:'spr_super',        name:'SUPER Sprinkler',        tier:'super',        cost:4e14,  radius:999,  speed:5.00 },
];
export const SPRINKLERS_BY_ID = Object.fromEntries(SPRINKLERS.map(s => [s.id, s]));

/** How many plots a sprinkler of this reach actually covers, for the shop copy. */
export function sprinklerCoverage(radius) {
  const cells = plotLayout();
  let most = 0;
  for (const from of cells) {
    let n = 0;
    for (const to of cells) if (Math.hypot(from.x - to.x, from.z - to.z) <= radius + 1e-6) n++;
    most = Math.max(most, n);
  }
  return most;
}

/**
 * Bugs raid the garden and latch onto planted plots, where they chew and slow
 * growth. Tougher species only show up as the garden gets bigger.
 */
export const BUGS = [
  { id:'aphid',  name:'Aphid',        level:1, hp:30,     speed:1.6, size:0.45, color:0x8bc34a, bounty:25 },
  { id:'beetle', name:'Leaf Beetle',  level:2, hp:130,    speed:1.3, size:0.62, color:0x6d4c41, bounty:500 },
  { id:'locust', name:'Locust',       level:3, hp:700,    speed:2.1, size:0.72, color:0xc9a227, bounty:15000 },
  { id:'grub',   name:'Root Grub',    level:4, hp:3600,   speed:0.9, size:0.95, color:0xe8c9a0, bounty:800000 },
  { id:'mantis', name:'Void Mantis',  level:5, hp:26000,  speed:1.8, size:1.15, color:0x7c4dff, bounty:1.2e8 },
  { id:'titan',  name:'Titan Weevil', level:6, hp:180000, speed:1.0, size:1.5,  color:0xff4081, bounty:1.4e10 },
];
export const BUGS_BY_ID = Object.fromEntries(BUGS.map(b => [b.id, b]));

/** Each bug on a plot drags its growth down by this much. */
export const BUG_SLOW = 0.75;

/** Weapons: swung or fired at bugs by hand. */
export const WEAPONS = [
  { id:'swatter', name:'Bug Swatter',  tier:'common',    cost:2000,  damage:40,    range:3.6, cooldown:0.42, kind:'melee' },
  { id:'sprayer', name:'Pest Sprayer', tier:'rare',      cost:9e5,   damage:110,   range:7,   cooldown:0.30, kind:'spray', splash:2.4 },
  { id:'blaster', name:'Bug Blaster',  tier:'legendary', cost:4e8,   damage:1100,  range:22,  cooldown:0.24, kind:'beam' },
  { id:'zapper',  name:'SUPER Zapper', tier:'super',     cost:2e11,  damage:11000, range:32,  cooldown:0.18, kind:'chain', chains:5 },
];
export const WEAPONS_BY_ID = Object.fromEntries(WEAPONS.map(w => [w.id, w]));

/** Turrets stand on a plot like sprinklers and shoot bugs on their own. */
export const TURRETS = [
  { id:'tur_common',       name:'Common Turret',       tier:'common',       cost:5e6,  damage:35,     rate:1.2, range:6 },
  { id:'tur_rare',         name:'Rare Turret',         tier:'rare',         cost:8e8,  damage:180,    rate:1.5, range:8 },
  { id:'tur_legendary',    name:'Legendary Turret',    tier:'legendary',    cost:1.5e11,damage:1400,  rate:2.0, range:11 },
  { id:'tur_prismatic',    name:'Prismatic Turret',    tier:'prismatic',    cost:2e13, damage:11000,  rate:2.5, range:15 },
  { id:'tur_transcendent', name:'Transcendent Turret', tier:'transcendent', cost:9e14, damage:90000,  rate:3.0, range:22 },
  { id:'tur_super',        name:'SUPER Turret',        tier:'super',        cost:5e16, damage:650000, rate:4.0, range:999 },
];
export const TURRETS_BY_ID = Object.fromEntries(TURRETS.map(t => [t.id, t]));

/** How nasty raids get, from how far along the garden is. */
export function raidLevel(ownedPlots, discovered) {
  const best = PLANTS.filter(p => discovered?.[p.id]).reduce((m, p) => Math.max(m, TIERS[p.tier].order), 0);
  return Math.max(1, Math.min(BUGS.length, Math.round(1 + best * 0.7 + ownedPlots / 12)));
}

/** Pick a bug species for a raid at this level — mostly the toughest available. */
export function rollBug(level) {
  const pool = BUGS.filter(b => b.level <= level);
  const weights = pool.map(b => (b.level === level ? 6 : b.level === level - 1 ? 3 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

// ---- Golden Harvest (prestige) ----------------------------------------

/** Each Golden Seed adds this much to every crop's sale value, forever. */
export const GOLDEN_BONUS = 0.05;

/** You can replant the garden once you own every plot and have earned this. */
export const GOLDEN_MIN_EARNED = 1e14;

/** Golden Seeds a run is worth. */
export function goldenFor(earned) {
  return Math.max(0, Math.floor(Math.sqrt(Math.max(0, earned) / 1e12)));
}

/** Multiplier on every harvest from the Golden Seeds you hold. */
export function goldenMultiplier(golden) {
  return 1 + GOLDEN_BONUS * (golden || 0);
}

// ---- Boss bugs ---------------------------------------------------------

/** Turn an ordinary species into the monster version of itself. */
export function bossOf(spec) {
  return {
    ...spec,
    id: 'boss_' + spec.id,
    name: 'MEGA ' + spec.name.toUpperCase(),
    hp: spec.hp * 45,
    speed: spec.speed * 0.55,
    size: spec.size * 2.8,
    bounty: spec.bounty * 70,
    boss: true,
  };
}

// ---- Trophies ----------------------------------------------------------

/** Goals with a one-off reward. `at` reads the save; `goal` is the target. */
export const TROPHIES = [
  { id:'sprout',    name:'First Sprout',     hint:'Harvest your first crop',        goal:1,     at:s => s.stats.harvested,  reward:50 },
  { id:'green',     name:'Green Thumb',      hint:'Harvest 100 crops',              goal:100,   at:s => s.stats.harvested,  reward:5000 },
  { id:'farmhand',  name:'Farm Hand',        hint:'Harvest 1,000 crops',            goal:1000,  at:s => s.stats.harvested,  reward:2e6 },
  { id:'tycoon',    name:'Crop Tycoon',      hint:'Harvest 10,000 crops',           goal:10000, at:s => s.stats.harvested,  reward:5e9 },
  { id:'land10',    name:'Landowner',        hint:'Till 10 plots',                  goal:10,    at:s => s.owned,            reward:12000 },
  { id:'land36',    name:'Whole Field',      hint:'Till every plot',                goal:36,    at:s => s.owned,            reward:2e7 },
  { id:'collect12', name:'Collector',        hint:'Discover 12 species',            goal:12,    at:s => Object.keys(s.discovered).length, reward:150000 },
  { id:'collect24', name:'Master Gardener',  hint:'Discover every species',         goal:24,    at:s => Object.keys(s.discovered).length, reward:2e8 },
  { id:'squash10',  name:'Pest Control',     hint:'Squash 10 bugs',                 goal:10,    at:s => s.stats.bugsKilled, reward:8000 },
  { id:'squash250', name:'Exterminator',     hint:'Squash 250 bugs',                goal:250,   at:s => s.stats.bugsKilled, reward:8e6 },
  { id:'boss1',     name:'Boss Slayer',      hint:'Beat a MEGA bug',                goal:1,     at:s => s.stats.bossesKilled, reward:1e8 },
  { id:'boss10',    name:'Monster Hunter',   hint:'Beat 10 MEGA bugs',              goal:10,    at:s => s.stats.bossesKilled, reward:5e11 },
  { id:'spr5',      name:'Sprinkler City',   hint:'Have 5 sprinklers running',      goal:5,     at:s => s.sprinklers.filter(Boolean).length, reward:3e6 },
  { id:'tur3',      name:'Fort Garden',      hint:'Have 3 turrets running',         goal:3,     at:s => s.turrets.filter(Boolean).length, reward:5e9 },
  { id:'golden1',   name:'Golden Touch',     hint:'Do one Golden Harvest',          goal:1,     at:s => s.prestiges, reward:0, golden:5 },
  { id:'golden10',  name:'Living Legend',    hint:'Do 10 Golden Harvests',          goal:10,    at:s => s.prestiges, reward:0, golden:100 },
];

export const PACKS = [
  { id:'sprout',   name:'Sprout Pack',    cost:900,   seeds:3, weights:{ common:55, uncommon:33, rare:11, legendary:1 } },
  { id:'garden',   name:'Garden Pack',    cost:90000, seeds:3, weights:{ uncommon:44, rare:40, legendary:14, mythic:2 } },
  { id:'exotic',   name:'Exotic Pack',    cost:9e6,   seeds:3, weights:{ rare:38, legendary:41, mythic:18, prismatic:3 } },
  { id:'celestial',name:'Celestial Pack', cost:9e8,   seeds:3, weights:{ legendary:32, mythic:42, prismatic:21, transcendent:5 } },
  { id:'prism',    name:'Prismatic Pack', cost:9e10,  seeds:4, weights:{ mythic:28, prismatic:46, transcendent:22, super:4 } },
  { id:'super',    name:'SUPER Pack',     cost:9e12,  seeds:4, weights:{ prismatic:22, transcendent:46, super:32 } },
];

// Garden is a GRID_SIZE x GRID_SIZE field of plots; you start owning one.
export const GRID_SIZE = 6;
export const PLOT_COUNT = GRID_SIZE * GRID_SIZE;
export const PLOT_SPACING = 2.6;

/** Plot slots ordered so the ones you unlock first sit next to each other. */
export function plotLayout() {
  const cells = [];
  const half = (GRID_SIZE - 1) / 2;
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const px = (x - half) * PLOT_SPACING;
      const pz = (z - half) * PLOT_SPACING;
      cells.push({ x: px, z: pz, d: Math.hypot(px, pz), a: Math.atan2(pz, px) });
    }
  }
  cells.sort((p, q) => (p.d - q.d) || (p.a - q.a));
  return cells.slice(0, PLOT_COUNT);
}

/** Identifies the garden's shape, so a save made under a different one can be remapped. */
export const LAYOUT_ID = `${GRID_SIZE}x${GRID_SIZE}@${PLOT_SPACING}`;

/** Cost of the next plot when you already own `owned` of them. */
export function plotCost(owned) {
  return Math.floor(8 * Math.pow(2.45, owned - 1));
}

/** The shop buys seeds back at this fraction of their price. */
export const SEED_REFUND = 0.5;

/** What one seed of this plant sells back for (never less than 1 sheckle). */
export function refundValue(plant) {
  return Math.max(1, Math.floor(plant.cost * SEED_REFUND));
}

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/** 1234567 -> "1.23M" */
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return (Math.round(n * 100) / 100).toLocaleString('en-US');
  let u = 0;
  while (n >= 1000 && u < UNITS.length - 1) { n /= 1000; u++; }
  const s = n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : n.toFixed(0);
  return s.replace(/\.0+$/, '') + UNITS[u];
}

/**
 * Roll a pack's contents: seeds are drawn without replacement, so one pack
 * never hands you the same species twice. A tier drops out of the draw once
 * all of its plants are taken, and its weight goes to the tiers still in play.
 */
export function rollPack(pack) {
  const chosen = [];
  const used = new Set();

  for (let n = 0; n < pack.seeds; n++) {
    const open = Object.entries(pack.weights)
      .filter(([tier]) => PLANTS.some(p => p.tier === tier && !used.has(p.id)));
    // Only if the pack asks for more seeds than exist can it repeat itself.
    const pool = open.length ? open : Object.entries(pack.weights);

    const total = pool.reduce((sum, [, w]) => sum + w, 0);
    let r = Math.random() * total;
    let tier = pool[pool.length - 1][0];
    for (const [t, w] of pool) { r -= w; if (r <= 0) { tier = t; break; } }

    let candidates = PLANTS.filter(p => p.tier === tier && !used.has(p.id));
    if (!candidates.length) candidates = PLANTS.filter(p => p.tier === tier);
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    chosen.push(pick.id);
    used.add(pick.id);
  }
  return chosen;
}
