// Game data: tiers, plants, seed packs, land pricing.

export const TIERS = {
  common:       { id:'common',       name:'Common',       color:0x9ccc65, css:'#9ccc65', order:0, shine:0 },
  uncommon:     { id:'uncommon',     name:'Uncommon',     color:0x4dd0e1, css:'#4dd0e1', order:1, shine:0 },
  rare:         { id:'rare',         name:'Rare',         color:0x5c8bff, css:'#5c8bff', order:2, shine:0.15 },
  legendary:    { id:'legendary',    name:'Legendary',    color:0xffb300, css:'#ffb300', order:3, shine:0.35 },
  mythic:       { id:'mythic',       name:'Mythic',       color:0xb455f6, css:'#b455f6', order:4, shine:0.55 },
  prismatic:    { id:'prismatic',    name:'Prismatic',    color:0xff4fd8, css:'#ff4fd8', order:5, shine:0.8, rainbow:true },
  transcendent: { id:'transcendent', name:'Transcendent', color:0x00e5ff, css:'#00e5ff', order:6, shine:1.0, rainbow:true },
  super:        { id:'super',        name:'SUPER',        color:0xffd54f, css:'#fff1a8', order:7, shine:1.0, rainbow:true },
  carnivore:    { id:'carnivore',    name:'CARNIVORE',    color:0xff1744, css:'#ff4d6d', order:8, shine:1.2, rainbow:true },
};

export const TIER_ORDER = Object.values(TIERS).sort((a,b)=>a.order-b.order).map(t=>t.id);

// kind drives the 3D model — each crop gets a silhouette that matches its name
export const PLANTS = [
  // ---- Common ----
  { id:'carrot',   name:'Carrot',        tier:'common', kind:'root',  cost:1,     grow:8,   sell:4,     colors:[0xff8f3f,0x66bb6a] },
  { id:'radish',   name:'Radish',        tier:'common', kind:'bulb',  cost:4,     grow:12,  sell:12,    colors:[0xe8517a,0x7cb342] },
  { id:'lettuce',  name:'Lettuce',       tier:'common', kind:'head',  cost:12,    grow:16,  sell:34,    colors:[0x8bc34a,0xaed581] },
  // ---- Uncommon ----
  { id:'tomato',   name:'Tomato',        tier:'uncommon', kind:'bush', cost:60,   grow:22,  sell:180,   colors:[0xe53935,0x4caf50] },
  { id:'blueberry',name:'Blueberry',     tier:'uncommon', kind:'bush', cost:220,  grow:28,  sell:680,   colors:[0x3f51b5,0x43a047] },
  { id:'pepper',   name:'Fire Pepper',   tier:'uncommon', kind:'pepper', cost:800,  grow:34,  sell:2500,  colors:[0xff5722,0x2e7d32] },
  // ---- Rare ----
  { id:'melon',    name:'Watermelon',    tier:'rare', kind:'melon',  cost:3200,   grow:45,  sell:11000,  colors:[0x2e7d32,0x66bb6a] },
  { id:'pumpkin',  name:'Pumpkin',       tier:'rare', kind:'pumpkin',  cost:12000,  grow:55,  sell:44000,  colors:[0xef6c00,0x558b2f] },
  { id:'dragon',   name:'Dragonfruit',   tier:'rare', kind:'pitaya',cost:45000,  grow:70,  sell:175000, colors:[0xff2d78,0x4caf50] },
  // ---- Legendary ----
  { id:'goldapple',name:'Golden Apple',  tier:'legendary', kind:'tree', cost:180000,   grow:90,  sell:760000,   colors:[0xffd54f,0x4caf50] },
  { id:'starcorn', name:'Star Corn',     tier:'legendary', kind:'corn', cost:700000,   grow:110, sell:4600000,  colors:[0xfff176,0x9ccc65] },
  { id:'moonflower',name:'Moonflower',   tier:'legendary', kind:'flower',cost:2600000, grow:130, sell:12000000, colors:[0xe1f5fe,0x80cbc4] },
  // ---- Mythic ----
  { id:'voidmelon',name:'Void Melon',    tier:'mythic', kind:'melon', cost:11000000,  grow:150, sell:52000000,  colors:[0x311b92,0x7c4dff] },
  { id:'phoenix',  name:'Phoenix Pepper',tier:'mythic', kind:'pepper', cost:45000000,  grow:175, sell:220000000, colors:[0xff6d00,0xffd600] },
  { id:'lotus',    name:'Celestial Lotus',tier:'mythic',kind:'lotus',cost:190000000, grow:200, sell:950000000, colors:[0xf8bbd0,0xb39ddb] },
  // ---- Prismatic ----
  { id:'prismrose',name:'Prism Rose',    tier:'prismatic', kind:'rose', cost:8e8,  grow:220, sell:4.2e9,  colors:[0xff4fd8,0x69f0ae] },
  { id:'auroravine',name:'Aurora Vine',  tier:'prismatic', kind:'grapes',   cost:3.4e9,grow:240, sell:1.8e10, colors:[0x00e676,0x18ffff] },
  { id:'spectralfig',name:'Spectral Fig',tier:'prismatic', kind:'tree',   cost:1.4e10,grow:260,sell:7.6e10, colors:[0xba68c8,0x4dd0e1] },
  // ---- Transcendent ----
  { id:'eternityroot',name:'Eternity Root', tier:'transcendent', kind:'glowroot', cost:6e10, grow:280, sell:4.8e11, colors:[0x00e5ff,0x1de9b6] },
  { id:'novabloom', name:'Nova Bloom',   tier:'transcendent', kind:'star', cost:2.6e11,grow:300, sell:1.4e12, colors:[0xffffff,0x40c4ff] },
  { id:'chronofruit',name:'Chrono Fruit',tier:'transcendent', kind:'clock',    cost:1.1e12,grow:320, sell:6e12,   colors:[0x64ffda,0x536dfe] },
  // ---- Super ----
  { id:'sheckletree',name:'Sheckle Tree',tier:'super', kind:'cointree', cost:5e12, grow:340, sell:2.8e13, colors:[0xffe082,0x8d6e63] },
  { id:'infinitygourd',name:'Infinity Gourd',tier:'super', kind:'gourd', cost:2.2e13,grow:380, sell:1.3e14, colors:[0xfff59d,0xff8a80] },
  { id:'superfruit', name:'SUPERFRUIT',  tier:'super', kind:'star',  cost:1e14, grow:420, sell:6.5e14, harvests:8, colors:[0xffffff,0xffd54f] },
  // ---- Guard crops: grown for protection, not for profit ----
  { id:'cactus', name:'Guard Cactus', tier:'rare',      kind:'cactus', cost:9000,   grow:60, sell:2500,  harvests:8, guard:{ damage:900, radius:4 },  colors:[0x66bb6a,0xd7ccc8] },
  { id:'bamboo', name:'Iron Bamboo',  tier:'legendary', kind:'bamboo', cost:400000, grow:80, sell:90000, harvests:8, guard:{ block:true, radius:5 }, colors:[0x9ccc65,0x827717] },
  // ---- Carnivore: these do not ripen on time alone. They have to eat. ----
  { id:'snaptrap',  name:'Venus Snaptrap', tier:'carnivore', kind:'trap',    cost:8e14, grow:520, sell:9e15,  harvests:5, eats:10, reach:3.2, hp:6e3,  bite:500,    colors:[0xff1744,0x2e7d32] },
  { id:'pitcher',   name:'Pitcher Beast',  tier:'carnivore', kind:'pitcher', cost:6e15, grow:640, sell:7e16,  harvests:5, eats:18, reach:3.8, hp:6e4,  bite:4000,   colors:[0xab47bc,0x4caf50] },
  { id:'gulper',    name:'Bog Gulper',     tier:'carnivore', kind:'maw',     cost:5e16, grow:780, sell:6e17,  harvests:4, eats:30, reach:4.5, hp:6e5,  bite:40000,  colors:[0xd50000,0x1b5e20] },
  { id:'devourer',  name:'World Devourer', tier:'carnivore', kind:'maw',     cost:4e17, grow:900, sell:5e18,  harvests:4, eats:50, reach:6.0, hp:2e7,  bite:900000, colors:[0x212121,0xff1744] },
];

/**
 * How many times a crop can be picked before it's spent, by shape. Crops you
 * pull out of the ground whole (roots, leafy greens, corn) are one-and-done;
 * anything that fruits from a standing plant keeps producing.
 */
const CARNIVORE_KINDS = new Set(['trap', 'pitcher', 'maw']);

const HARVESTS_BY_KIND = {
  root: 1, glowroot: 1, leaf: 1, head: 1, corn: 1,        // pulled up whole
  bush: 4, pepper: 4, melon: 3, pumpkin: 3, gourd: 3, grapes: 3,
  flower: 5, lotus: 5, rose: 5, pitaya: 5, star: 5,
  tree: 6, cointree: 6, clock: 8,
  trap: 5, pitcher: 5, maw: 4,
  cactus: 8, bamboo: 8,
};

// Regrowth is faster than the first grow — established plants pay off quicker.
const REGROW_RATIO = { tree: 0.5, cointree: 0.5, clock: 0.5, star: 0.5,
                       flower: 0.55, lotus: 0.55, rose: 0.55, pitaya: 0.55,
                       bush: 0.55, pepper: 0.55, grapes: 0.6, melon: 0.6, pumpkin: 0.6, gourd: 0.6,
                       trap: 0.6, pitcher: 0.6, maw: 0.6, cactus: 0.5, bamboo: 0.5 };

for (const p of PLANTS) {
  p.carnivore = CARNIVORE_KINDS.has(p.kind);
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

/**
 * Bugs bite back. A bug in a carnivore's jaws deals this fraction of its own
 * health per second to the plant, so the big ones are genuinely dangerous:
 * a Venus Snaptrap loses to a Titan Weevil, and only a World Devourer can
 * chew through a MEGA bug.
 */
export const BUG_BITE = 0.012;
export function bugBite(spec) { return spec.hp * BUG_BITE; }

/** Carnivores knit themselves back together between fights. */
export const PLANT_REGEN_PER_SEC = 0.03;

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

// ---- Night thieves -----------------------------------------------------

/**
 * After dark, thieves creep in and try to make off with whatever is sitting
 * ripe. They only turn up while you are actually playing — nobody robs your
 * garden while the game is closed.
 */
export const THIEVES = [
  { id:'raccoon', name:'Raccoon',      hp:420,  speed:2.3, size:0.85, color:0x8d9499, loot:1, weight:60 },
  { id:'crow',    name:'Crow',         hp:260,  speed:3.6, size:0.7,  color:0x2b2b33, loot:1, weight:28, flies:true },
  { id:'gnome',   name:'Garden Gnome', hp:2200, speed:1.5, size:1.0,  color:0xd84315, loot:2, weight:12, greedy:true },
];
export const THIEVES_BY_ID = Object.fromEntries(THIEVES.map(t => [t.id, t]));

/** Thieves toughen up as the garden grows, so they stay a threat. */
export function thiefScale(ownedPlots, prestiges) {
  return 1 + ownedPlots * 0.25 + (prestiges || 0) * 2;
}

export function rollThief() {
  const total = THIEVES.reduce((a, t) => a + t.weight, 0);
  let r = Math.random() * total;
  for (const t of THIEVES) { r -= t.weight; if (r <= 0) return t; }
  return THIEVES[0];
}

/** Things you can stand in the garden to keep thieves out. */
export const DEFENCES = [
  { id:'def_scarecrow', name:'Scarecrow',  cost:2e6,  radius:7,  scare:true,  desc:'thieves will not come within its shadow' },
  { id:'def_trap',      name:'Bear Trap',  cost:2.5e7, radius:3.5, damage:2500, desc:'snaps shut on anything that creeps past' },
  { id:'def_lamp',      name:'Flood Lamp', cost:4e8,  radius:9,  slow:0.45,   desc:'lights the garden so thieves crawl' },
];
export const DEFENCES_BY_ID = Object.fromEntries(DEFENCES.map(d => [d.id, d]));

/** Decorations. Purely for show, except the lantern, which lights up at night. */
export const PROPS = [
  { id:'prop_fence',   name:'Fence Panel',   cost:5000,   shape:'fence' },
  { id:'prop_path',    name:'Stone Path',    cost:12000,  shape:'path' },
  { id:'prop_lantern', name:'Garden Lantern',cost:250000, shape:'lantern', light:true },
  { id:'prop_bush',    name:'Topiary Bush',  cost:900000, shape:'topiary' },
  { id:'prop_bird',    name:'Bird Bath',     cost:6e6,    shape:'birdbath' },
  { id:'prop_gnome',   name:'Lawn Gnome',    cost:4e7,    shape:'gnome' },
  { id:'prop_statue',  name:'Golden Statue', cost:8e9,    shape:'statue' },
  { id:'prop_arch',    name:'Rose Arch',     cost:2e11,   shape:'arch' },
];
export const PROPS_BY_ID = Object.fromEntries(PROPS.map(p => [p.id, p]));

// ---- Carnivore feeding -------------------------------------------------

/**
 * A carnivore plant's fruit takes after whatever it has been eating, and the
 * nastier its diet, the more the fruit is worth.
 */
export function dietSummary(diet) {
  const entries = Object.entries(diet || {}).filter(([id]) => BUGS_BY_ID[id]);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((a, [, n]) => a + n, 0);
  const level = entries.reduce((a, [id, n]) => a + BUGS_BY_ID[id].level * n, 0) / total;
  return { main: BUGS_BY_ID[entries[0][0]], total, level, kinds: entries.length };
}

/** Value multiplier a carnivore earns from its diet: 1.3x on aphids, 3x on titans. */
export function dietBonus(diet) {
  const d = dietSummary(diet);
  return d ? 1 + 0.35 * d.level : 1;
}

// ---- Pets --------------------------------------------------------------

/**
 * Pets hatch from eggs, roam the garden and help out. Each has one ability
 * whose strength scales with its level and how happy it is. Keep as many out
 * as you like.
 */
export const PET_SLOTS = Infinity;

/** Happiness a seed of each tier gives when you feed it to a pet. */
export const TREAT_VALUE = {
  common: 6, uncommon: 11, rare: 18, legendary: 26,
  mythic: 36, prismatic: 48, transcendent: 62, super: 80,
};

/** Happiness ebbs away slowly, so pets like being fed now and then. */
export const HAPPY_DECAY_PER_MIN = 0.7;
export const HAPPY_MAX = 100;

/** A happy pet works harder: up to +60% on its ability at full happiness. */
export function happyBonus(happy) { return 1 + 0.6 * (Math.min(HAPPY_MAX, happy || 0) / HAPPY_MAX); }

export function moodOf(happy) {
  const h = happy || 0;
  if (h >= 85) return { icon: '😍', word: 'overjoyed' };
  if (h >= 60) return { icon: '😄', word: 'happy' };
  if (h >= 35) return { icon: '🙂', word: 'content' };
  if (h >= 12) return { icon: '😐', word: 'peckish' };
  return { icon: '🥺', word: 'hungry' };
}

export const PETS = [
  { id:'snail',   name:'Garden Snail', tier:'common',       ability:'growth',  power:0.05, shape:'snail',  colors:[0xa1887f, 0xc5e1a5] },
  { id:'ladybug', name:'Ladybug',      tier:'common',       ability:'pest',    power:6,    shape:'beetle', colors:[0xe53935, 0x212121] },
  { id:'bee',     name:'Honey Bee',    tier:'uncommon',     ability:'luck',    power:0.6,  shape:'bee',    colors:[0xffc107, 0x212121] },
  { id:'bunny',   name:'Bunny',        tier:'rare',         ability:'harvest', power:4.5,  shape:'bunny',  colors:[0xf5f5f5, 0xffcdd2] },
  { id:'cat',     name:'Barn Cat',     tier:'rare',         ability:'value',   power:0.06, shape:'cat',    colors:[0xff9800, 0xfff3e0] },
  { id:'fox',     name:'Fox',          tier:'legendary',    ability:'harvest', power:8,    shape:'cat',    colors:[0xf4511e, 0xffffff] },
  { id:'owl',     name:'Wise Owl',     tier:'mythic',       ability:'luck',    power:1.8,  shape:'owl',    colors:[0x8d6e63, 0xffe082] },
  { id:'drake',   name:'Baby Drake',   tier:'prismatic',    ability:'lure',    power:1,    shape:'drake',  colors:[0x7c4dff, 0x69f0ae] },
  { id:'phoenix', name:'Phoenix Chick',tier:'transcendent', ability:'value',   power:0.3,  shape:'drake',  colors:[0xff6d00, 0xffd54f] },
  { id:'sprite',  name:'Star Sprite',  tier:'super',        ability:'luck',    power:4.5,  shape:'sprite', colors:[0xffffff, 0xffe082] },
];
export const PETS_BY_ID = Object.fromEntries(PETS.map(p => [p.id, p]));

export const ABILITY_TEXT = {
  growth: (p, lv) => `+${Math.round(p.power * lv * 100)}% growth speed`,
  value:  (p, lv) => `+${Math.round(p.power * lv * 100)}% crop value`,
  luck:   (p, lv) => `×${(1 + p.power * lv).toFixed(1)} mutation luck`,
  harvest:(p, lv) => `auto-picks ripe crops within ${(p.power + lv * 0.4).toFixed(1)}m`,
  pest:   (p, lv) => `${Math.round(p.power * lv * 12)} damage/s to nearby bugs`,
  lure:   (p, lv) => `${lureText(p.power * lv)} — feeds carnivores`,
};

/**
 * Bugs per second a lure calls in. Every drake and every level adds to it with
 * no ceiling, so a pack of grown drakes brings a swarm.
 */
export function lureRate(power) { return Math.max(0, power) / 40; }

export function lureText(power) {
  const rate = lureRate(power);
  if (rate <= 0) return 'calls no bugs';
  return rate >= 1 ? `roars up ${rate.toFixed(1)} bugs a second`
                   : `roars up a bug every ${(1 / rate).toFixed(1)}s`;
}

/** Eggs: pricier eggs hold better odds. */
export const EGGS = [
  { id:'egg_common', name:'Garden Egg',    cost:250000, hatch:60,  weights:{ common:62, uncommon:28, rare:9, legendary:1 } },
  { id:'egg_rare',   name:'Exotic Egg',    cost:8e8,    hatch:120, weights:{ rare:44, legendary:38, mythic:16, prismatic:2 } },
  { id:'egg_myth',   name:'Celestial Egg', cost:5e11,   hatch:180, weights:{ legendary:26, mythic:40, prismatic:26, transcendent:8 } },
  { id:'egg_super',  name:'SUPER Egg',     cost:2e14,   hatch:240, weights:{ prismatic:30, transcendent:45, super:25 } },
];
export const EGGS_BY_ID = Object.fromEntries(EGGS.map(e => [e.id, e]));

/** XP needed to reach the next level; pets gain XP just by being out. */
export function petXpFor(level) { return Math.floor(60 * Math.pow(1.45, level - 1)); }
export const PET_MAX_LEVEL = 25;

export function rollPet(weights) {
  const pool = PETS.filter(p => weights[p.tier]);
  const total = pool.reduce((a, p) => a + weights[p.tier], 0);
  let r = Math.random() * total;
  for (const p of pool) { r -= weights[p.tier]; if (r <= 0) return p; }
  return pool[pool.length - 1];
}

// ---- Garden Mastery: upgrades that never run out ------------------------

export const UPGRADES = [
  { id:'soil',    name:'Fertile Soil',   hint:'+6% growth speed per level',   base:2e6,  scale:2.15, step:0.06 },
  { id:'sap',     name:'Rich Sap',       hint:'+6% crop value per level',     base:5e6,  scale:2.25, step:0.06 },
  { id:'clover',  name:'Four-Leaf Field',hint:'+25% mutation luck per level', base:2e7,  scale:2.45, step:0.25 },
  { id:'traps',   name:'Steel Traps',    hint:'+20% bug bounty per level',    base:1e7,  scale:2.2,  step:0.20 },
  { id:'compost', name:'Golden Compost', hint:'+3% Golden Seeds per level',   base:1e9,  scale:2.6,  step:0.03 },
];
export const UPGRADES_BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

export function upgradeCost(u, level) {
  return Math.floor(u.base * Math.pow(u.scale, level));
}

// ---- Wardrobe ----------------------------------------------------------

/** Hats for the gardener. A couple are earned rather than bought. */
export const HATS = [
  { id:'straw',  name:'Straw Hat',    cost:0,     color:0xe8c377 },
  { id:'cap',    name:'Ball Cap',     cost:60000, color:0x2196f3 },
  { id:'bucket', name:'Bucket Hat',   cost:4e6,   color:0x8bc34a },
  { id:'cowboy', name:'Cowboy Hat',   cost:2e8,   color:0x795548 },
  { id:'top',    name:'Top Hat',      cost:9e10,  color:0x263238 },
  { id:'wizard', name:'Wizard Hat',   cost:5e12,  color:0x5e35b1 },
  { id:'crown',  name:'Golden Crown', cost:0,     color:0xffd54f, needTrophy:'land36' },
  { id:'halo',   name:'Halo',         cost:0,     color:0xfff59d, needTrophy:'rankgod' },
];
export const HATS_BY_ID = Object.fromEntries(HATS.map(h => [h.id, h]));

/** Outfit colours. */
export const OUTFITS = [
  { id:'green',  name:'Gardener Green', cost:0,     color:0x3f7d4e },
  { id:'blue',   name:'Denim',          cost:20000, color:0x3f51b5 },
  { id:'red',    name:'Barn Red',       cost:1e6,   color:0xc62828 },
  { id:'purple', name:'Royal Purple',   cost:6e8,   color:0x7b1fa2 },
  { id:'orange', name:'Pumpkin',        cost:3e10,  color:0xef6c00 },
  { id:'black',  name:'Midnight',       cost:2e12,  color:0x212121 },
  { id:'pink',   name:'Blossom',        cost:8e13,  color:0xec407a },
  { id:'gold',   name:'Solid Gold',     cost:0,     color:0xffc107, needTrophy:'golden1' },
];
export const OUTFITS_BY_ID = Object.fromEntries(OUTFITS.map(o => [o.id, o]));

// ---- Daily quests ------------------------------------------------------

/**
 * Three fresh goals a day, each measured against a snapshot of your stats
 * taken when the quest was handed out.
 */
export const QUEST_TYPES = [
  { id:'harvest',  text:n => `Harvest ${n} crops`,            picks:[15, 30, 60],       at:s => s.stats.harvested },
  { id:'plant',    text:n => `Plant ${n} seeds`,              picks:[10, 20, 40],       at:s => s.stats.planted || 0 },
  { id:'bugs',     text:n => `Squash ${n} bugs`,              picks:[10, 25, 50],       at:s => s.stats.bugsKilled },
  { id:'thieves',  text:n => `Catch ${n} thieves`,            picks:[2, 5, 10],         at:s => s.stats.thievesCaught || 0 },
  { id:'treats',   text:n => `Feed your pets ${n} treats`,    picks:[3, 8, 15],         at:s => s.stats.treats || 0 },
  { id:'packs',    text:n => `Open ${n} seed packs`,          picks:[1, 3, 6],          at:s => s.stats.packsOpened },
  { id:'eaten',    text:n => `Feed carnivores ${n} bugs`,     picks:[5, 15, 30],        at:s => s.stats.eaten || 0 },
  { id:'mutations',text:n => `Harvest ${n} mutated crops`,    picks:[3, 8, 20],         at:s => s.stats.mutated || 0 },
];
export const QUEST_BY_ID = Object.fromEntries(QUEST_TYPES.map(q => [q.id, q]));

/** Today's date as a plain string, so a new day means new quests. */
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Roll three different quests, sized to how far along the garden is. */
export function rollQuests(state) {
  const pool = [...QUEST_TYPES];
  const size = state.owned >= 24 ? 2 : state.owned >= 10 ? 1 : 0;
  const out = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const q = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    out.push({ id: q.id, goal: q.picks[size], base: q.at(state), claimed: false });
  }
  return out;
}

/** Quest payout scales with what a crop is worth to you now. */
export function questReward(state, index) {
  const base = Math.max(5000, state.stats.earned / 900);
  return Math.floor(base * (index + 1) * 1.5);
}

// ---- Ranks -------------------------------------------------------------

export const RANKS = [
  { at: 0,     name:'Seedling',        icon:'🌱' },
  { at: 1e3,   name:'Sprout',          icon:'🌿' },
  { at: 1e5,   name:'Gardener',        icon:'🧑‍🌾' },
  { at: 1e7,   name:'Farmer',          icon:'🚜' },
  { at: 1e9,   name:'Grower',          icon:'🌻' },
  { at: 1e11,  name:'Cultivator',      icon:'🌳' },
  { at: 1e13,  name:'Botanist',        icon:'🔬' },
  { at: 1e15,  name:'Sheckle Baron',   icon:'💰' },
  { at: 1e17,  name:'Garden Tycoon',   icon:'🏆' },
  { at: 1e19,  name:'Living Legend',   icon:'⭐' },
  { at: 1e21,  name:'Garden God',      icon:'👑' },
  { at: 1e24,  name:'MYTHWEAVER',      icon:'🌌' },
  { at: 1e27,  name:'SHECKLE OVERLORD',icon:'🔥' },
];

export function rankFor(earned) {
  let r = RANKS[0];
  for (const x of RANKS) if (earned >= x.at) r = x;
  return r;
}

export function nextRank(earned) {
  return RANKS.find(x => earned < x.at) || null;
}

// ---- Weather -----------------------------------------------------------

/**
 * Weather rolls every few minutes. It changes how fast crops grow and which
 * mutations they can pick up when they ripen.
 */
export const WEATHERS = {
  clear:   { id:'clear',   name:'Clear',         icon:'☀️', growth:1.0,  weight:100, mins:[3, 7], mutations:[] },
  rain:    { id:'rain',    name:'Rain',          icon:'🌧️', growth:1.5,  weight:38,  mins:[2, 4], mutations:[['wet', 0.55]] },
  storm:   { id:'storm',   name:'Thunderstorm',  icon:'⛈️', growth:1.5,  weight:9,   mins:[2, 3], mutations:[['wet', 0.5], ['shocked', 0.07]] },
  frost:   { id:'frost',   name:'Frost',         icon:'❄️', growth:1.5,  weight:12,  mins:[2, 4], mutations:[['chilled', 0.5], ['frozen', 0.09]] },
  rainbow: { id:'rainbow', name:'Rainbow Sky',   icon:'🌈', growth:1.35, weight:4,   mins:[1, 2], mutations:[['wet', 0.3]], variantLuck: 14 },
  meteor:  { id:'meteor',  name:'Meteor Shower', icon:'☄️', growth:1.25, weight:3,   mins:[1, 2], mutations:[['celestial', 0.14]], nightOnly: true },
  harvest: { id:'harvest', name:'Harvest Moon',  icon:'🌕', growth:1.6,  weight:4,   mins:[2, 3], mutations:[], variantLuck: 26, nightOnly: true, moon: 0xffb74d },
  aurora:  { id:'aurora',  name:'Aurora',        icon:'🌌', growth:1.4,  weight:4,   mins:[2, 3], mutations:[['celestial', 0.09], ['chilled', 0.4]], nightOnly: true, sky: 0x1b3a4b },
  megamoon:{ id:'megamoon',name:'MEGA Moon',     icon:'🌝', growth:1.3,  weight:2,   mins:[1, 2], mutations:[], megaLuck: 22, nightOnly: true, moon: 0xe1f5fe },
  blood:   { id:'blood',   name:'Blood Moon',    icon:'🔴', growth:1.2,  weight:3,   mins:[2, 3], mutations:[['shocked', 0.04]], nightOnly: true, moon: 0xff5252, sky: 0x3b1220, fierce: true },
};

/** Pick the next weather, given whether it is currently night. */
export function rollWeather(night) {
  const pool = Object.values(WEATHERS).filter(w => !w.nightOnly || night);
  const total = pool.reduce((a, w) => a + w.weight, 0);
  let r = Math.random() * total;
  for (const w of pool) { r -= w.weight; if (r <= 0) return w; }
  return WEATHERS.clear;
}

// ---- Mutations ---------------------------------------------------------

/** Colour variants. A crop can only carry one, and rarer means richer. */
export const VARIANTS = [
  { id:'normal',  name:'',        mult:1,  weight:1000, color:0xffffff },
  { id:'silver',  name:'Silver',  mult:5,  weight:52,   color:0xdfe7ee },
  { id:'gold',    name:'Gold',    mult:20, weight:11,   color:0xffd54f },
  { id:'rainbow', name:'Rainbow', mult:50, weight:2,    color:0xff4fd8 },
];
export const VARIANTS_BY_ID = Object.fromEntries(VARIANTS.map(v => [v.id, v]));

/** A MEGA crop is enormous and worth a fortune. Rare, and stacks with everything. */
export const MEGA_MULT = 15;
export const MEGA_CHANCE = 0.012;

/** Weather marks. Also one at a time, and they multiply on top of the variant. */
export const MARKS = {
  wet:       { id:'wet',       name:'Wet',       mult:2,   color:0x4fc3f7 },
  chilled:   { id:'chilled',   name:'Chilled',   mult:2,   color:0x81d4fa },
  frozen:    { id:'frozen',    name:'Frozen',    mult:10,  color:0xb3e5fc },
  shocked:   { id:'shocked',   name:'Shocked',   mult:50,  color:0xffee58 },
  celestial: { id:'celestial', name:'Celestial', mult:120, color:0xb388ff },
};

/** Roll what a crop becomes as it ripens under this weather. */
export function rollMutation(weather, extraLuck = 1) {
  const w = WEATHERS[weather] || WEATHERS.clear;
  const luck = (w.variantLuck || 1) * Math.max(1, extraLuck);

  const pool = VARIANTS.map(v => ({ v, weight: v.id === 'normal' ? v.weight : v.weight * luck }));
  const total = pool.reduce((a, x) => a + x.weight, 0);
  let r = Math.random() * total;
  let variant = 'normal';
  for (const x of pool) { r -= x.weight; if (r <= 0) { variant = x.v.id; break; } }

  let mark = null;
  for (const [id, chance] of w.mutations) {
    if (Math.random() < chance) { mark = id; break; }   // best listed mark wins
  }

  const mega = Math.random() < MEGA_CHANCE * (w.megaLuck || 1) * Math.max(1, extraLuck) ** 0.5;

  return (variant === 'normal' && !mark && !mega) ? null : { v: variant, m: mark, mega };
}

/** How much a mutation multiplies a crop's value. */
export function mutationMultiplier(mut) {
  if (!mut) return 1;
  return (VARIANTS_BY_ID[mut.v]?.mult || 1) * (MARKS[mut.m]?.mult || 1) * (mut.mega ? MEGA_MULT : 1);
}

/** "Rainbow Shocked" — for toasts and prompts. */
export function mutationName(mut) {
  if (!mut) return '';
  return [mut.mega ? 'MEGA' : '', VARIANTS_BY_ID[mut.v]?.name, MARKS[mut.m]?.name].filter(Boolean).join(' ');
}

/** The colour a mutated crop should glow. */
export function mutationColor(mut) {
  if (!mut) return null;
  if (mut.v !== 'normal') return VARIANTS_BY_ID[mut.v].color;
  if (MARKS[mut.m]) return MARKS[mut.m].color;
  return mut.mega ? 0xffab40 : null;
}

/** How much bigger a MEGA crop grows. */
export function mutationScale(mut) { return mut?.mega ? 2.3 : 1; }

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
  { id:'shiny',     name:'Ooh, Shiny',       hint:'Harvest a crop worth 5× or more', goal:5,     at:s => s.best?.mult || 1, reward:20000 },
  { id:'goldcrop',  name:'Midas Crop',       hint:'Harvest a Gold crop (20×)',       goal:20,    at:s => s.best?.mult || 1, reward:3e6 },
  { id:'rainbowcrop',name:'Over the Rainbow',hint:'Harvest a Rainbow crop (50×)',    goal:50,    at:s => s.best?.mult || 1, reward:5e8 },
  { id:'legendcrop',name:'One in a Million',  hint:'Harvest a crop worth 1,000×',    goal:1000,  at:s => s.best?.mult || 1, reward:0, golden:25 },
  { id:'watch',     name:'Neighbourhood Watch', hint:'Catch 10 thieves',            goal:10,    at:s => s.stats.thievesCaught || 0, reward:2e7 },
  { id:'fortress',  name:'Fort Knox',        hint:'Catch 100 thieves',               goal:100,   at:s => s.stats.thievesCaught || 0, reward:0, golden:20 },
  { id:'decorator', name:'Interior Designer',hint:'Place 10 decorations',            goal:10,    at:s => s.props?.length || 0, reward:5e6 },
  { id:'firstbite', name:'First Bite',       hint:'Let a carnivore eat 1 bug',        goal:1,     at:s => s.stats.eaten || 0, reward:5e6 },
  { id:'buffet',    name:'Bug Buffet',       hint:'Feed carnivores 100 bugs',        goal:100,   at:s => s.stats.eaten || 0, reward:0, golden:15 },
  { id:'pets3',     name:'Best Friends',     hint:'Hatch 3 pets',                    goal:3,     at:s => s.pets?.length || 0, reward:1e6 },
  { id:'pets10',    name:'Full Menagerie',   hint:'Hatch 10 pets',                   goal:10,    at:s => s.pets?.length || 0, reward:2e9 },
  { id:'mastery20', name:'Garden Mastery',   hint:'Buy 20 Mastery upgrade levels',   goal:20,    at:s => Object.values(s.upgrades || {}).reduce((a, b) => a + b, 0), reward:5e10 },
  { id:'rankgod',   name:'Garden God',       hint:'Earn ₪1 sextillion all-time',     goal:1e21,  at:s => s.stats.earned, reward:0, golden:250 },
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
  { id:'apex',     name:'CARNIVORE Pack', cost:2e15,  seeds:3, weights:{ transcendent:20, super:46, carnivore:34 } },
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
