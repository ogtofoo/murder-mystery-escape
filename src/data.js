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
