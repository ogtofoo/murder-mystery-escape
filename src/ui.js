// All DOM overlay logic: wallet, hotbar, shop, pack reveals, toasts, menu.

import { PLANTS, PLANTS_BY_ID, PACKS, TIERS, TIER_ORDER, PLOT_COUNT, fmt, refundValue, SEED_REFUND,
         CANS, SPRINKLERS, SPRINKLERS_BY_ID, sprinklerCoverage,
         WEAPONS, TURRETS, TURRETS_BY_ID, TROPHIES, GOLDEN_BONUS, GOLDEN_MIN_EARNED,
         goldenMultiplier, WEATHERS, VARIANTS, MARKS, mutationMultiplier,
         PETS, PETS_BY_ID, PET_SLOTS, PET_MAX_LEVEL, petXpFor, EGGS, ABILITY_TEXT,
         DEFENCES, DEFENCES_BY_ID, PROPS, PROPS_BY_ID, THIEVES,
         HATS, OUTFITS, QUEST_BY_ID, questReward,
         moodOf, happyBonus, TREAT_VALUE,
         UPGRADES, upgradeCost, rankFor, nextRank } from './data.js';
import { state, seedCount, stockCount, goldenPending, canGoldenHarvest, trophyProgress, cropValue,
         upgradeLevel, nextUpgradeCost, equippedPets, luckMultiplier,
         questProgress, questDone, shelfCount } from './state.js';

const $ = sel => document.querySelector(sel);

export class UI {
  constructor(hooks) {
    this.hooks = hooks;               // { buySeed, buyPack, reset, play }
    this.selected = null;
    this.shopOpen = false;
    this.tab = 'seeds';
    this.shovelOut = false;
    this.canOut = false;
    this.weaponOut = null;
    this.bugCount = 0;
    this.padActive = false;   // draws a focus ring once a controller is in use
    this.focusIndex = 0;

    this.el = {
      money: $('#money'), shopmoney: $('#shopmoney'),
      hotbar: $('#hotbar'), prompt: $('#prompt'), toasts: $('#toasts'),
      shop: $('#shop'), body: $('#shopbody'), overlay: $('#overlay'), plotline: $('#plotline'),
      packmodal: $('#packmodal'), packcards: $('#packcards'), packtitle: $('#packtitle'),
      bossbar: $('#bossbar'), goldenline: $('#goldenline'), skyline: $('#skyline'),
      rankline: $('#rankline'), eggline: $('#eggline'),
    };

    $('#playbtn').addEventListener('click', () => this.hooks.play());
    $('#resetbtn').addEventListener('click', () => {
      if (confirm('Erase your garden and start again with 1 sheckle?')) this.hooks.reset();
    });
    $('#exportbtn').addEventListener('click', () => this.hooks.exportSave());
    $('#importbtn').addEventListener('click', () => $('#importfile').click());
    $('#importfile').addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (!file) return;
      file.text().then(text => this.hooks.importSave(text)).catch(err => this.toast(err.message, 'bad'));
      e.target.value = '';
    });
    $('#packok').addEventListener('click', () => this.el.packmodal.classList.add('hidden'));
    $('[data-close-shop]').addEventListener('click', () => this.toggleShop(false));
    for (const tab of document.querySelectorAll('.tab')) {
      tab.addEventListener('click', () => {
        this.tab = tab.dataset.tab;
        for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t === tab);
        this.renderShop();
      });
    }
    this.el.hotbar.addEventListener('click', e => {
      const slot = e.target.closest('.slot');
      if (slot?.dataset.tool === 'shovel') this.hooks.toggleShovel();
      else if (slot?.dataset.tool === 'can') this.hooks.toggleCan();
      else if (slot?.dataset.tool === 'weapon') this.hooks.toggleWeapon();
      else if (slot?.dataset.plant) this.select(slot.dataset.plant);
    });
  }

  // ---------- menu ----------
  showMenu(show) { this.el.overlay.classList.toggle('hidden', !show); }
  get menuOpen() { return !this.el.overlay.classList.contains('hidden'); }
  get modalOpen() { return this.menuOpen || this.shopOpen || !this.el.packmodal.classList.contains('hidden'); }

  // ---------- hud ----------
  refresh() {
    this.el.money.textContent = fmt(state.money);
    this.el.shopmoney.textContent = fmt(state.money);
    this.el.plotline.textContent = `${state.owned} / ${PLOT_COUNT} plots tilled`;
    const mult = goldenMultiplier(state.golden);
    this.el.goldenline.classList.toggle('hidden', !state.golden);
    this.el.goldenline.textContent = `✨ ${state.golden} Golden Seeds · ${mult.toFixed(1)}× crop value`;
    const r = rankFor(state.stats.earned), nx = nextRank(state.stats.earned);
    this.el.rankline.innerHTML = `${r.icon} <span style="color:var(--gold)">${r.name}</span>` +
      (nx ? ` <span style="opacity:.55;font-weight:400">→ ${nx.name} at ₪${fmt(nx.at)}</span>` : '');
    this.renderHotbar();
    if (this.shopOpen) this.renderShop();
  }

  hotbarSeeds() {
    const seeds = Object.keys(state.seeds)
      .filter(id => PLANTS_BY_ID[id] && seedCount(id) > 0)
      .sort((a, b) => {
        const pa = PLANTS_BY_ID[a], pb = PLANTS_BY_ID[b];
        return TIERS[pa.tier].order - TIERS[pb.tier].order || pa.cost - pb.cost;
      });
    const devices = [...SPRINKLERS, ...TURRETS, ...DEFENCES, ...PROPS]
      .filter(d => stockCount(d.id) > 0).map(d => d.id);
    return [...seeds, ...devices].slice(0, 9);
  }

  /** Seeds and sprinklers both live in the hotbar. */
  itemInfo(id) {
    const p = PLANTS_BY_ID[id];
    if (p) return { name: p.name, tier: p.tier, count: seedCount(id), sprinkler: false };
    const s = SPRINKLERS_BY_ID[id];
    if (s) return { name: s.name.replace(' Sprinkler', ''), tier: s.tier, count: stockCount(id), sprinkler: true, glyph: '✳' };
    const t = TURRETS_BY_ID[id];
    if (t) return { name: t.name.replace(' Turret', ''), tier: t.tier, count: stockCount(id), sprinkler: true, glyph: '⌖' };
    const d = DEFENCES_BY_ID[id];
    if (d) return { name: d.name, tier: 'rare', count: stockCount(id), sprinkler: true, glyph: '🛡' };
    const pr = PROPS_BY_ID[id];
    if (pr) return { name: pr.name, tier: 'common', count: stockCount(id), sprinkler: true, glyph: '🏡' };
    return null;
  }

  setShovel(on) {
    this.shovelOut = on;
    this.renderHotbar();
  }

  setCan(on) {
    this.canOut = on;
    this.renderHotbar();
  }

  setWeapon(id) {
    this.weaponOut = id;
    this.renderHotbar();
  }

  /** @param boss {{name, hp, maxHp}|null} */
  setBoss(boss) {
    const on = !!boss;
    this.el.bossbar.classList.toggle('hidden', !on);
    if (!on) return;
    this.el.bossbar.querySelector('.bossname').textContent = boss.name;
    this.el.bossbar.querySelector('.bosstrack i').style.width =
      `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
  }

  /** Clock and weather in the corner. */
  setSky(phase, weather) {
    const w = WEATHERS[weather] || WEATHERS.clear;
    const label = `${this.clock ?? ''}`;
    void label;
    const mins = Math.floor(phase * 24 * 60);
    const time = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    const txt = `${time} · <span class="wx">${w.icon} ${w.name}${w.growth > 1 ? ` ${w.growth}×` : ''}</span>`;
    if (txt !== this._skyTxt) { this._skyTxt = txt; this.el.skyline.innerHTML = txt; }
  }

  /** Egg timers in the corner. */
  setEggs(now) {
    const eggs = state.eggs || [];
    this.el.eggline.classList.toggle('hidden', !eggs.length);
    const txt = eggs.map(e => {
      const left = Math.max(0, Math.ceil((e.readyAt - now) / 1000));
      const name = EGGS.find(x => x.id === e.id)?.name ?? 'Egg';
      return `<div class="egg">🥚 ${name} — <b>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</b></div>`;
    }).join('');
    if (txt !== this._eggTxt) { this._eggTxt = txt; this.el.eggline.innerHTML = txt; }
  }

  /** Celebrate a new pet, reusing the seed-pack reveal. */
  showHatch(spec) {
    const t = TIERS[spec.tier];
    this.el.packtitle.textContent = 'It hatched!';
    this.el.packcards.innerHTML = `<div class="card" style="border-color:${t.css}; box-shadow:0 0 30px ${t.css}44">
      <div class="t" style="color:${t.css}">${t.name}</div>
      <div class="n">${spec.name}</div>
      <div class="v">${ABILITY_TEXT[spec.ability](spec, 1)}</div>
    </div>`;
    this.el.packmodal.classList.remove('hidden');
  }

  /** Keep the restock countdown live while the Seeds tab is showing. */
  tickShop() {
    if (!this.shopOpen || this.tab !== 'seeds') return;
    const el = this.el.body.querySelector('#restockleft');
    if (!el) return;
    const left = Math.max(0, Math.ceil((state.shelfUntil - Date.now()) / 1000));
    const txt = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (el.textContent !== txt) el.textContent = txt;
  }

  setBugCount(n, thieves = 0) {
    const key = n + ':' + thieves;
    if (key === this.bugCount) return;
    this.bugCount = key;
    const el = document.querySelector('#bugcount');
    if (!el) return;
    el.classList.toggle('hidden', n === 0 && thieves === 0);
    const parts = [];
    if (n) parts.push(`🐛 <b>${n}</b> bug${n === 1 ? '' : 's'}`);
    if (thieves) parts.push(`🦝 <b>${thieves}</b> ${thieves === 1 ? 'thief' : 'thieves'} in your garden!`);
    el.innerHTML = parts.join(' · ');
  }

  toolSlot() {
    const can = CANS.filter(c => state.cans[c.id]).pop();
    const weapon = WEAPONS.filter(w => state.weapons[w.id]).pop();
    const slot = (active, tool, glyph, name, key) =>
      `<div class="slot tool ${active ? 'active' : ''}" data-tool="${tool}">
         <div class="glyph">${glyph}</div><div class="nm">${name}</div><div class="key">${key}</div>
       </div>`;
    return slot(this.shovelOut, 'shovel', '⛏', 'Shovel', 'G')
      + (can ? slot(this.canOut, 'can', '💧', can.id === 'can_super' ? 'SUPER Can' : 'Can', 'F') : '')
      + (weapon ? slot(!!this.weaponOut, 'weapon', '⚔', weapon.name.replace(/^(SUPER |Bug |Pest )/, ''), 'R') : '');
  }


  renderHotbar() {
    const ids = this.hotbarSeeds();
    if (!ids.includes(this.selected)) this.selected = ids[0] || null;
    if (!ids.length) {
      this.el.hotbar.innerHTML =
        `<div class="slot empty">No seeds — press <b>B</b> to buy a carrot</div>` + this.toolSlot();
      return;
    }
    this.el.hotbar.innerHTML = ids.map((id, i) => {
      const it = this.itemInfo(id);
      return `<div class="slot ${id === this.selected ? 'active' : ''} ${it.sprinkler ? 'device' : ''}" data-plant="${id}">
        <div class="dot" style="background:${TIERS[it.tier].css}">${it.sprinkler ? `<span>${it.glyph}</span>` : ''}</div>
        <div class="nm">${it.name}</div>
        <div class="ct">×${it.count}</div>
        <div class="key">${i + 1}</div>
      </div>`;
    }).join('') + this.toolSlot();
  }

  select(id) {
    if (seedCount(id) > 0 || stockCount(id) > 0) { this.selected = id; this.renderHotbar(); }
  }

  selectIndex(i) {
    const ids = this.hotbarSeeds();
    if (ids[i]) this.select(ids[i]);
  }

  cycleSelection(dir) {
    const ids = this.hotbarSeeds();
    if (!ids.length) return;
    const i = Math.max(0, ids.indexOf(this.selected));
    this.select(ids[(i + dir + ids.length) % ids.length]);
  }

  setPrompt(html) {
    this.el.prompt.innerHTML = html || '';
    this.el.prompt.classList.toggle('hidden', !html);
  }

  toast(text, kind = '') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = text;
    this.el.toasts.appendChild(el);
    setTimeout(() => el.classList.add('fade'), 2600);
    setTimeout(() => el.remove(), 3100);
    while (this.el.toasts.children.length > 6) this.el.toasts.firstChild.remove();
  }

  // ---------- shop ----------
  toggleShop(force) {
    this.shopOpen = force ?? !this.shopOpen;
    this.el.shop.classList.toggle('hidden', !this.shopOpen);
    if (this.shopOpen) this.renderShop();
    this.hooks.onShopToggle?.(this.shopOpen);
  }

  renderShop() {
    this.el.shopmoney.textContent = fmt(state.money);
    if (this.tab === 'seeds') this.renderSeeds();
    else if (this.tab === 'packs') this.renderPacks();
    else if (this.tab === 'tools') this.renderTools();
    else if (this.tab === 'quests') this.renderQuests();
    else if (this.tab === 'wardrobe') this.renderWardrobe();
    else if (this.tab === 'props') this.renderGarden();
    else if (this.tab === 'pets') this.renderPets();
    else if (this.tab === 'mastery') this.renderMastery();
    else if (this.tab === 'trophies') this.renderTrophies();
    else if (this.tab === 'golden') this.renderGolden();
    else this.renderAlmanac();
    this.applyFocus();
  }

  // ---------- controller navigation ----------
  focusList() {
    if (!this.shopOpen) return [];
    return [...this.el.body.querySelectorAll('.buy:not([disabled])')];
  }

  applyFocus(scroll = false) {
    const list = this.focusList();
    for (const el of this.el.body.querySelectorAll('.focused')) el.classList.remove('focused');
    if (!this.padActive || !list.length) return;
    this.focusIndex = Math.max(0, Math.min(list.length - 1, this.focusIndex));
    const el = list[this.focusIndex];
    el.classList.add('focused');
    if (scroll) el.scrollIntoView({ block: 'nearest' });
  }

  padFocus(delta) {
    const list = this.focusList();
    if (!list.length) return;
    this.focusIndex = (this.focusIndex + delta + list.length) % list.length;
    this.applyFocus(true);
  }

  padActivate() {
    const list = this.focusList();
    list[this.focusIndex]?.click();
  }

  padTab(dir) {
    const tabs = [...document.querySelectorAll('.tab')];
    const i = tabs.findIndex(t => t.classList.contains('active'));
    this.focusIndex = 0;
    tabs[(i + dir + tabs.length) % tabs.length].click();
  }

  get packOpen() { return !this.el.packmodal.classList.contains('hidden'); }
  closePack() { this.el.packmodal.classList.add('hidden'); }

  renderSeeds() {
    const left = Math.max(0, Math.ceil((state.shelfUntil - Date.now()) / 1000));
    const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
    let html = state.shelfNight
      ? `<div class="tierhead" style="color:#a8d8ff">🌙 Night market — SUPER and CARNIVORE seeds are always in after dark · restocks in <span id="restockleft">${mm}:${ss}</span></div>`
      : `<div class="tierhead">🛒 Restocks in <span id="restockleft">${mm}:${ss}</span> · rarer seeds sell out more often · the rarest are always in stock at night</div>`;
    for (const tier of TIER_ORDER) {
      const list = PLANTS.filter(p => p.tier === tier && state.discovered[p.id]);
      if (!list.length) continue;
      html += `<div class="tierhead" style="color:${TIERS[tier].css}">${TIERS[tier].name}</div>`;
      for (const p of list) {
        const stock = shelfCount(p.id);
        const can = state.money >= p.cost && stock > 0;
        const have = seedCount(p.id);
        html += `<div class="row ${stock ? '' : 'soldout'}">
          <div class="stripe" style="background:${TIERS[tier].css}"></div>
          <div>
            <div class="name">${p.name}</div>
            <div class="meta">${harvestLine(p)}</div>
          </div>
          <div class="own">owned<br><b>${have}</b><br><span class="${stock ? 'instock' : 'nostock'}">${stock ? `${stock} in stock` : 'sold out'}</span></div>
          <div class="sellcol">
            <button class="buy sell" data-sell="${p.id}" ${have ? '' : 'disabled'}
              title="Sell one back at ${Math.round(SEED_REFUND * 100)}%">sell ₪${fmt(refundValue(p))}</button>
            ${have > 1 ? `<button class="buy sell all" data-sell="${p.id}" data-all="1"
              title="Sell all ${have}">all ×${have}</button>` : ''}
          </div>
          <button class="buy" data-seed="${p.id}" ${can ? '' : 'disabled'}>${stock ? `₪ ${fmt(p.cost)}` : 'sold out'}</button>
        </div>`;
      }
    }
    html += `<div class="tierhead">The shop buys seeds back at ${Math.round(SEED_REFUND * 100)}% of what they cost</div>
      <div class="tierhead">Locked</div>
      <div class="row locked"><div class="stripe" style="background:#666"></div>
      <div><div class="name">Rare seeds and beyond</div>
      <div class="meta">Only seed packs carry them. Once a seed is discovered it appears here to re-buy.</div></div>
      <div class="own"></div><button class="buy" disabled>Packs →</button></div>`;
    this.el.body.innerHTML = html;
    for (const b of this.el.body.querySelectorAll('[data-seed]')) {
      b.addEventListener('click', () => this.hooks.buySeed(b.dataset.seed));
    }
    for (const b of this.el.body.querySelectorAll('[data-sell]')) {
      b.addEventListener('click', () => this.hooks.sellSeed(b.dataset.sell, !!b.dataset.all));
    }
  }

  renderPacks() {
    let html = `<div class="tierhead">Seed packs — expensive, but the only road to the higher tiers</div>`;
    for (const pack of PACKS) {
      const can = state.money >= pack.cost;
      const odds = Object.entries(pack.weights)
        .map(([t, w]) => `<span style="color:${TIERS[t].css}">${TIERS[t].name} ${Math.round(w / total(pack.weights) * 100)}%</span>`)
        .join(' · ');
      html += `<div class="row">
        <div class="stripe" style="background:linear-gradient(${Object.keys(pack.weights).map(t => TIERS[t].css).join(',')})"></div>
        <div>
          <div class="name">${pack.name}</div>
          <div class="meta">${pack.seeds} seeds — ${odds}</div>
        </div>
        <div class="own"></div>
        <button class="buy big" data-pack="${pack.id}" ${can ? '' : 'disabled'}>₪ ${fmt(pack.cost)}</button>
      </div>`;
    }
    this.el.body.innerHTML = html;
    for (const b of this.el.body.querySelectorAll('[data-pack]')) {
      b.addEventListener('click', () => this.hooks.buyPack(b.dataset.pack));
    }
  }

  renderTools() {
    let html = `<div class="tierhead">Watering cans — a shot of growth on demand, once per plant per cycle</div>`;
    for (const c of CANS) {
      const owned = !!state.cans[c.id];
      html += `<div class="row">
        <div class="stripe" style="background:${TIERS[c.tier].css}"></div>
        <div>
          <div class="name">${c.name}</div>
          <div class="meta">skips a plant <b>${Math.round(c.boost * 100)}%</b> further through its cycle ·
            ${c.radius ? `waters everything within ${c.radius}m at once` : 'one plot at a time'}</div>
        </div>
        <div class="own">${owned ? 'owned' : ''}</div>
        <button class="buy" data-can="${c.id}" ${owned || state.money < c.cost ? 'disabled' : ''}>
          ${owned ? '✓ owned' : '₪ ' + fmt(c.cost)}</button>
      </div>`;
    }
    html += `<div class="tierhead">Sprinklers — stand one on a plot and everything in range grows faster, forever</div>`;
    for (const s of SPRINKLERS) {
      const have = stockCount(s.id);
      const placed = state.sprinklers.filter(x => x === s.id).length;
      html += `<div class="row">
        <div class="stripe" style="background:${TIERS[s.tier].css}"></div>
        <div>
          <div class="name" style="color:${TIERS[s.tier].css}">${s.name}</div>
          <div class="meta"><b>${s.speed}× growth</b> ·
            ${s.radius > 100 ? 'covers the entire garden' : `reaches ${s.radius}m — up to ${sprinklerCoverage(s.radius)} plots`} ·
            takes up the plot it stands on</div>
        </div>
        <div class="own">${have ? `in shed<br><b>${have}</b>` : ''}${placed ? `<br>${placed} placed` : ''}</div>
        <div class="sellcol">${have ? `<button class="buy sell" data-selldev="${s.id}">sell ₪${fmt(Math.floor(s.cost / 2))}</button>
          ${have > 1 ? `<button class="buy sell all" data-selldev="${s.id}" data-all="1">all ×${have}</button>` : ''}` : ''}</div>
        <button class="buy" data-sprinkler="${s.id}" ${state.money < s.cost ? 'disabled' : ''}>₪ ${fmt(s.cost)}</button>
      </div>`;
    }
    html += `<div class="tierhead">Sprinklers and turrets sell back out of the shed at half price</div>
      <div class="tierhead">Weapons — bugs raid the garden and chew on your crops, slowing them down</div>`;
    for (const w of WEAPONS) {
      const owned = !!state.weapons[w.id];
      const how = { melee: 'swing at anything close', spray: `sprays a ${w.splash}m cloud`,
                    beam: 'hitscan, long range', chain: `arcs to ${w.chains} bugs at once` }[w.kind];
      html += `<div class="row">
        <div class="stripe" style="background:${TIERS[w.tier].css}"></div>
        <div>
          <div class="name">${w.name}</div>
          <div class="meta"><b>${fmt(w.damage)} damage</b> every ${w.cooldown}s · range ${w.range}m · ${how}</div>
        </div>
        <div class="own">${owned ? 'owned' : ''}</div>
        <button class="buy" data-weapon="${w.id}" ${owned || state.money < w.cost ? 'disabled' : ''}>
          ${owned ? '✓ owned' : '₪ ' + fmt(w.cost)}</button>
      </div>`;
    }
    html += `<div class="tierhead">Turrets — stand one on a plot and it shoots bugs for you, day and night</div>`;
    for (const t of TURRETS) {
      const have = stockCount(t.id);
      const placed = state.turrets.filter(x => x === t.id).length;
      html += `<div class="row">
        <div class="stripe" style="background:${TIERS[t.tier].css}"></div>
        <div>
          <div class="name" style="color:${TIERS[t.tier].css}">${t.name}</div>
          <div class="meta"><b>${fmt(t.damage)} damage</b> × ${t.rate}/s = ${fmt(t.damage * t.rate)} dps ·
            ${t.range > 100 ? 'covers the entire garden' : `range ${t.range}m`} · takes up the plot it stands on</div>
        </div>
        <div class="own">${have ? `in shed<br><b>${have}</b>` : ''}${placed ? `<br>${placed} placed` : ''}</div>
        <div class="sellcol">${have ? `<button class="buy sell" data-selldev="${t.id}">sell ₪${fmt(Math.floor(t.cost / 2))}</button>
          ${have > 1 ? `<button class="buy sell all" data-selldev="${t.id}" data-all="1">all ×${have}</button>` : ''}` : ''}</div>
        <button class="buy" data-turret="${t.id}" ${state.money < t.cost ? 'disabled' : ''}>₪ ${fmt(t.cost)}</button>
      </div>`;
    }
    this.el.body.innerHTML = html;
    for (const b of this.el.body.querySelectorAll('[data-weapon]')) {
      b.addEventListener('click', () => this.hooks.buyWeapon(b.dataset.weapon));
    }
    for (const b of this.el.body.querySelectorAll('[data-turret]')) {
      b.addEventListener('click', () => this.hooks.buyTurret(b.dataset.turret));
    }
    for (const b of this.el.body.querySelectorAll('[data-selldev]')) {
      b.addEventListener('click', () => this.hooks.sellDevice(b.dataset.selldev, !!b.dataset.all));
    }
    for (const b of this.el.body.querySelectorAll('[data-can]')) {
      b.addEventListener('click', () => this.hooks.buyCan(b.dataset.can));
    }
    for (const b of this.el.body.querySelectorAll('[data-sprinkler]')) {
      b.addEventListener('click', () => this.hooks.buySprinkler(b.dataset.sprinkler));
    }
  }

  renderQuests() {
    const streak = state.quests.streak || 0;
    let html = `<div class="tierhead">Three fresh jobs every day${streak ? ` · <b style="color:var(--gold)">${streak}-day streak, +${streak * 10}% rewards</b>` : ''} ·
      they reset at midnight</div>`;
    if (!state.quests.list.length) {
      html += `<div class="row"><div class="stripe" style="background:#666"></div>
        <div><div class="name">No quests yet</div><div class="meta">Come back in a moment.</div></div>
        <div class="own"></div><div></div></div>`;
    }
    state.quests.list.forEach((q, i) => {
      const type = QUEST_BY_ID[q.id];
      const now = Math.min(questProgress(q), q.goal);
      const done = questDone(q);
      const pay = Math.floor(questReward(state, i) * (1 + Math.min(1, streak * 0.1)));
      html += `<div class="trophy ${q.claimed ? 'done' : ''}">
        <div class="mark">${q.claimed ? '✅' : done ? '🎁' : '📋'}</div>
        <div>
          <div class="nm">${type.text(q.goal)}</div>
          <div class="hint">${fmt(now)} / ${fmt(q.goal)}</div>
          ${q.claimed ? '' : `<div class="track"><i style="width:${(now / q.goal * 100).toFixed(0)}%"></i></div>`}
        </div>
        <div class="prize">${q.claimed ? 'collected'
          : `<button class="buy" data-quest="${i}" ${done ? '' : 'disabled'}>₪ ${fmt(pay)}</button>`}</div>
      </div>`;
    });
    this.el.body.innerHTML = html;
    for (const b of this.el.body.querySelectorAll('[data-quest]')) {
      b.addEventListener('click', () => { this.hooks.claimQuest(Number(b.dataset.quest)); this.renderShop(); });
    }
  }

  renderWardrobe() {
    const row = (item, kind, owned, worn) => {
      const locked = item.needTrophy && !state.trophies[item.needTrophy];
      const label = worn ? '✓ wearing' : owned ? 'wear' : locked ? '🔒 locked' : `₪ ${fmt(item.cost)}`;
      return `<div class="row ${locked && !owned ? 'locked' : ''}">
        <div class="stripe" style="background:#${item.color.toString(16).padStart(6, '0')}"></div>
        <div>
          <div class="name">${item.name}</div>
          <div class="meta">${locked && !owned ? `unlocked by the ${TROPHIES.find(t => t.id === item.needTrophy)?.name} trophy`
            : owned ? 'in your wardrobe' : 'for sale'}</div>
        </div>
        <div class="own"></div>
        <button class="buy" data-${kind}="${item.id}" ${worn || (locked && !owned) || (!owned && state.money < item.cost) ? 'disabled' : ''}>${label}</button>
      </div>`;
    };
    let html = `<div class="tierhead">Hats</div>`;
    for (const h of HATS) html += row(h, 'hat', !!state.hats[h.id], state.hat === h.id);
    html += `<div class="tierhead">Outfits</div>`;
    for (const o of OUTFITS) html += row(o, 'outfit', !!state.outfits[o.id], state.outfit === o.id);
    this.el.body.innerHTML = html;
    for (const b of this.el.body.querySelectorAll('[data-hat]')) {
      b.addEventListener('click', () => {
        const id = b.dataset.hat;
        state.hats[id] ? this.hooks.wearHat(id) : this.hooks.buyHat(id);
        this.renderShop();
      });
    }
    for (const b of this.el.body.querySelectorAll('[data-outfit]')) {
      b.addEventListener('click', () => {
        const id = b.dataset.outfit;
        state.outfits[id] ? this.hooks.wearOutfit(id) : this.hooks.buyOutfit(id);
        this.renderShop();
      });
    }
  }

  renderGarden() {
    let html = `<div class="tierhead">Defences — thieves come after dark and take whatever is sitting ripe.
      Stand these on empty plots.</div>`;
    for (const d of DEFENCES) {
      const have = stockCount(d.id);
      const placed = state.defences.filter(x => x === d.id).length;
      html += `<div class="row">
        <div class="stripe" style="background:#7cb342"></div>
        <div>
          <div class="name">${d.name}</div>
          <div class="meta">${d.desc} · reaches ${d.radius}m${d.damage ? ` · ${fmt(d.damage)} damage a second` : ''}</div>
        </div>
        <div class="own">${have ? `in shed<br><b>${have}</b>` : ''}${placed ? `<br>${placed} out` : ''}</div>
        <button class="buy" data-defence="${d.id}" ${state.money < d.cost ? 'disabled' : ''}>₪ ${fmt(d.cost)}</button>
      </div>`;
    }
    html += `<div class="tierhead">Who comes calling</div>`;
    for (const t of THIEVES) {
      html += `<div class="row"><div class="stripe" style="background:#${t.color.toString(16).padStart(6, '0')}"></div>
        <div><div class="name">${t.name}</div>
        <div class="meta">${t.flies ? 'flies in over the fence' : t.greedy ? 'goes straight for your most valuable crop' : 'grabs whatever is closest'}
          · takes ${t.loot} crop${t.loot === 1 ? '' : 's'}${t.greedy ? ' at a time' : ''}</div></div>
        <div class="own"></div><div></div></div>`;
    }
    html += `<div class="tierhead">Decorations — pick one, aim at the grass and press <b>E</b>.
      Shovel + <b>E</b> picks one back up.</div>`;
    for (const p of PROPS) {
      const have = stockCount(p.id);
      const out = state.props.filter(x => x.id === p.id).length;
      html += `<div class="row">
        <div class="stripe" style="background:var(--gold)"></div>
        <div>
          <div class="name">${p.name}</div>
          <div class="meta">${p.light ? 'lights up after dark' : 'decoration'}</div>
        </div>
        <div class="own">${have ? `in shed<br><b>${have}</b>` : ''}${out ? `<br>${out} placed` : ''}</div>
        <button class="buy" data-prop="${p.id}" ${state.money < p.cost ? 'disabled' : ''}>₪ ${fmt(p.cost)}</button>
      </div>`;
    }
    this.el.body.innerHTML = html;
    for (const b of this.el.body.querySelectorAll('[data-defence]')) {
      b.addEventListener('click', () => this.hooks.buyDefence(b.dataset.defence));
    }
    for (const b of this.el.body.querySelectorAll('[data-prop]')) {
      b.addEventListener('click', () => this.hooks.buyProp(b.dataset.prop));
    }
  }

  renderPets() {
    const out = state.equipped;
    let html = `<div class="tierhead">Eggs — pets roam your garden and help out. ${out.length} of ${state.pets.length} out ·
      mutation luck ×${luckMultiplier().toFixed(1)} ·
      <b>C</b> calls them over, <b>T</b> feeds the nearest one the seed you're holding</div>`;
    for (const e of EGGS) {
      html += `<div class="row">
        <div class="stripe" style="background:linear-gradient(${Object.keys(e.weights).map(t => TIERS[t].css).join(',')})"></div>
        <div>
          <div class="name">${e.name}</div>
          <div class="meta">hatches in ${e.hatch}s · ${Object.entries(e.weights)
            .map(([t, w]) => `<span style="color:${TIERS[t].css}">${TIERS[t].name} ${Math.round(w / Object.values(e.weights).reduce((a, b) => a + b) * 100)}%</span>`)
            .join(' · ')}</div>
        </div>
        <div class="own"></div>
        <button class="buy big" data-egg="${e.id}" ${state.money < e.cost ? 'disabled' : ''}>₪ ${fmt(e.cost)}</button>
      </div>`;
    }

    html += `<div class="tierhead">Your pets (${state.pets.length}) —
      rarer seeds make better treats, and a happy pet works up to 60% harder
      <button class="buy sell" id="alloutbtn" style="margin-left:8px">take all out</button>
      <button class="buy sell" id="allinbtn">put all away</button></div>`;
    if (!state.pets.length) {
      html += `<div class="row"><div class="stripe" style="background:#666"></div>
        <div><div class="name">No pets yet</div>
        <div class="meta">Buy an egg above — it hatches on its own while you garden.</div></div>
        <div class="own"></div><div></div></div>`;
    } else {
      html += '<div class="petgrid">';
      for (const owned of [...state.pets].sort((a, b) =>
          TIERS[PETS_BY_ID[b.id].tier].order - TIERS[PETS_BY_ID[a.id].tier].order || b.level - a.level)) {
        const spec = PETS_BY_ID[owned.id], t = TIERS[spec.tier];
        const isOut = out.includes(owned.uid);
        const need = petXpFor(owned.level);
        const pct = owned.level >= PET_MAX_LEVEL ? 100 : Math.min(100, (owned.xp / need) * 100);
        html += `<div class="pet ${isOut ? 'out' : ''}" style="${isOut ? `border-color:${t.css}` : ''}">
          <div class="tr" style="color:${t.css}">${t.name}</div>
          <div class="nm">${spec.name} <span style="opacity:.6;font-size:12px">L${owned.level}</span></div>
          <div class="ab">${ABILITY_TEXT[spec.ability](spec, owned.level)}${
            owned.happy >= 1 ? ` <span style="color:var(--good)">×${happyBonus(owned.happy).toFixed(2)} happy</span>` : ''}</div>
          <div style="font-size:12px;opacity:.8;margin-bottom:4px">${moodOf(owned.happy).icon} ${
            moodOf(owned.happy).word} · ${Math.round(owned.happy || 0)}/100</div>
          <div class="xp"><i style="width:${Math.round(owned.happy || 0)}%;background:#ff6ea8"></i></div>
          <div class="xp"><i style="width:${pct}%"></i></div>
          <div class="btns">
            <button class="${isOut ? '' : 'go'}" data-pet="${owned.uid}">${isOut ? 'Put away' : 'Take out'}</button>
            <button class="rel" data-release="${owned.uid}" title="Release">✕</button>
          </div>
        </div>`;
      }
      html += '</div>';
    }
    this.el.body.innerHTML = html;
    this.el.body.querySelector('#alloutbtn')?.addEventListener('click', () => { this.hooks.equipAll(true); this.renderShop(); });
    this.el.body.querySelector('#allinbtn')?.addEventListener('click', () => { this.hooks.equipAll(false); this.renderShop(); });
    for (const b of this.el.body.querySelectorAll('[data-egg]')) {
      b.addEventListener('click', () => this.hooks.buyEgg(b.dataset.egg));
    }
    for (const b of this.el.body.querySelectorAll('[data-pet]')) {
      b.addEventListener('click', () => { this.hooks.equipPet(Number(b.dataset.pet)); this.renderShop(); });
    }
    for (const b of this.el.body.querySelectorAll('[data-release]')) {
      b.addEventListener('click', () => {
        const uid = Number(b.dataset.release);
        const spec = PETS_BY_ID[state.pets.find(p => p.uid === uid)?.id];
        if (spec && confirm(`Release your ${spec.name}? This cannot be undone.`)) {
          this.hooks.releasePet(uid); this.renderShop();
        }
      });
    }
  }

  renderMastery() {
    let html = `<div class="tierhead">Garden Mastery — permanent upgrades with no ceiling.
      They survive a Golden Harvest.</div>`;
    for (const u of UPGRADES) {
      const lv = upgradeLevel(u.id);
      const cost = nextUpgradeCost(u.id);
      html += `<div class="row">
        <div class="stripe" style="background:var(--gold)"></div>
        <div>
          <div class="name">${u.name} <span style="opacity:.6;font-size:13px">level ${fmt(lv)}</span></div>
          <div class="meta">${u.hint} · currently <b>${
            u.id === 'clover' ? `×${(1 + lv * u.step).toFixed(2)} luck`
            : `+${Math.round(lv * u.step * 100)}%`}</b></div>
        </div>
        <div class="own"></div>
        <button class="buy" data-upgrade="${u.id}" ${state.money < cost ? 'disabled' : ''}>₪ ${fmt(cost)}</button>
      </div>`;
    }
    this.el.body.innerHTML = html;
    for (const b of this.el.body.querySelectorAll('[data-upgrade]')) {
      b.addEventListener('click', () => { this.hooks.buyUpgrade(b.dataset.upgrade); this.renderShop(); });
    }
  }

  renderTrophies() {
    const done = TROPHIES.filter(t => state.trophies[t.id]).length;
    let html = `<div class="tierhead">${done} of ${TROPHIES.length} trophies earned — rewards are paid the moment you finish one</div>`;
    for (const t of TROPHIES) {
      const got = !!state.trophies[t.id];
      const k = trophyProgress(t);
      const now = Math.min(t.at(state), t.goal);
      html += `<div class="trophy ${got ? 'done' : ''}">
        <div class="mark">${got ? '🏆' : '◻'}</div>
        <div>
          <div class="nm">${t.name}</div>
          <div class="hint">${t.hint} — ${fmt(now)} / ${fmt(t.goal)}</div>
          ${got ? '' : `<div class="track"><i style="width:${(k * 100).toFixed(0)}%"></i></div>`}
        </div>
        <div class="prize">${t.golden ? `✨ ${t.golden}` : `₪${fmt(t.reward)}`}</div>
      </div>`;
    }
    this.el.body.innerHTML = html;
  }

  renderGolden() {
    const pending = goldenPending();
    const ready = canGoldenHarvest();
    const now = goldenMultiplier(state.golden);
    const after = goldenMultiplier(state.golden + pending);
    this.el.body.innerHTML = `
      <div class="goldbox">
        <h3>✨ Golden Harvest</h3>
        <p>Plough the whole garden back under and start again — but keep a handful of
           <b>Golden Seeds</b> from everything you grew. Every Golden Seed makes
           <b>every crop you ever sell worth ${Math.round(GOLDEN_BONUS * 100)}% more</b>, forever.</p>
        <div class="big">${pending > 0 ? '+' + fmt(pending) : '0'}</div>
        <div>Golden Seeds waiting for you</div>
        <p>You have <b>${fmt(state.golden)}</b> (${now.toFixed(1)}× crop value).
           Harvesting now takes you to <b>${fmt(state.golden + pending)}</b> —
           <b style="color:var(--gold)">${after.toFixed(1)}× on every crop</b>.</p>
        <div class="keep">
          <span>✔ keeps your almanac</span>
          <span>✔ keeps trophies</span>
          <span>✔ keeps tools &amp; weapons</span>
          <span>✔ sprinklers &amp; turrets go back to your shed</span>
          <span>✘ sheckles, seeds and land start over</span>
        </div>
        <button class="goldbtn" id="goldbtn" ${ready ? '' : 'disabled'}>
          ${ready ? `Golden Harvest — take ${fmt(pending)} seeds` : 'Not ready yet'}
        </button>
        ${ready ? '' : `<p class="dim" style="font-size:12px">Needs all ${PLOT_COUNT} plots tilled
           (you have ${state.owned}) and ₪${fmt(GOLDEN_MIN_EARNED)} earned this run
           (you have ₪${fmt(state.runEarned)}).</p>`}
        <p style="font-size:12px;opacity:.6">Golden Harvests done: ${fmt(state.prestiges)}</p>
      </div>`;
    const btn = this.el.body.querySelector('#goldbtn');
    if (btn && ready) {
      btn.addEventListener('click', () => {
        if (confirm(`Replant the whole garden for ${pending} Golden Seeds?\n\nYou keep your almanac, trophies, tools and shed.`)) {
          this.hooks.goldenHarvest();
        }
      });
    }
  }

  renderAlmanac() {
    const found = PLANTS.filter(p => state.discovered[p.id]).length;
    let html = `<div class="tierhead">Discovered ${found} / ${PLANTS.length} species ·
      harvested ${fmt(state.stats.harvested)} crops · earned ₪${fmt(state.stats.earned)}
      ${state.stats.best ? `· best find: <span style="color:${TIERS[PLANTS_BY_ID[state.stats.best].tier].css}">${PLANTS_BY_ID[state.stats.best].name}</span>` : ''}</div>`;
    for (const tier of TIER_ORDER) {
      html += `<div class="tierhead" style="color:${TIERS[tier].css}">${TIERS[tier].name}</div>`;
      for (const p of PLANTS.filter(x => x.tier === tier)) {
        const known = state.discovered[p.id];
        html += `<div class="row ${known ? '' : 'locked'}">
          <div class="stripe" style="background:${TIERS[tier].css}"></div>
          <div>
            <div class="name">${known ? p.name : '???'}</div>
            <div class="meta">${known ? `${harvestLine(p)} · seed ₪${fmt(p.cost)}${state.golden ? ` · <b style="color:var(--gold)">sells for ₪${fmt(cropValue(p))} with Golden Seeds</b>` : ''}` : 'undiscovered — try a seed pack'}</div>
          </div>
          <div class="own">${known ? `×${seedCount(p.id)}` : ''}</div><div></div>
        </div>`;
      }
    }
    this.el.body.innerHTML = html;
  }

  showPack(pack, entries) {
    const cards = entries.map(e => (typeof e === 'string' ? { id: e } : e));
    this.el.packtitle.textContent = `${pack.name} — opened!`;
    this.el.packcards.innerHTML = cards.map((c, i) => {
      const p = PLANTS_BY_ID[c.id], t = TIERS[p.tier];
      return `<div class="card" style="border-color:${t.css}; animation-delay:${i * 0.18}s; box-shadow:0 0 26px ${t.css}33">
        ${c.isNew ? `<div class="new" style="background:${t.css}">NEW</div>` : ''}
        <div class="t" style="color:${t.css}">${t.name}</div>
        <div class="n">${p.name}</div>
        <div class="v">₪${fmt(p.sell)} per pick${p.harvests > 1 ? ` · ×${p.harvests}` : ''}</div>
      </div>`;
    }).join('');
    this.el.packmodal.classList.remove('hidden');
  }

  /** Swap the corner hint over to controller glyphs. */
  showPadHints() {
    if (this.padActive) return;
    this.padActive = true;
    const hint = document.querySelector('#hint');
    if (hint) hint.textContent = 'A use · Y shop · X jump · LB/RB seed · Start menu';
    const play = document.querySelector('#playbtn');
    if (play) play.textContent = 'Press A to play';
    const foot = document.querySelector('.panel footer');
    if (foot) foot.innerHTML = foot.innerHTML.replace('press <kbd>B</kbd> or <kbd>Esc</kbd> to close',
      '<b>A</b> buy · <b>LB/RB</b> tabs · <b>B</b> close');
    this.applyFocus(true);
  }
}

/** One line describing what a seed actually gives you. */
function harvestLine(p) {
  if (p.harvests === 1) {
    return `grows in ${p.grow}s · single harvest ₪${fmt(p.sell)} · profit ₪${fmt(p.sell - p.cost)}`;
  }
  return `grows in ${p.grow}s · <b>${p.harvests} harvests</b> of ₪${fmt(p.sell)}, regrows every ${p.regrow}s
          · ₪${fmt(p.lifetime)} total · profit ₪${fmt(p.lifetime - p.cost)}`;
}

function total(weights) {
  return Object.values(weights).reduce((a, b) => a + b, 0);
}
