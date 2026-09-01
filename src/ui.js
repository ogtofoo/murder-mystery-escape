// All DOM overlay logic: wallet, hotbar, shop, pack reveals, toasts, menu.

import { PLANTS, PLANTS_BY_ID, PACKS, TIERS, TIER_ORDER, PLOT_COUNT, fmt } from './data.js';
import { state, seedCount } from './state.js';

const $ = sel => document.querySelector(sel);

export class UI {
  constructor(hooks) {
    this.hooks = hooks;               // { buySeed, buyPack, reset, play }
    this.selected = null;
    this.shopOpen = false;
    this.tab = 'seeds';
    this.padActive = false;   // draws a focus ring once a controller is in use
    this.focusIndex = 0;

    this.el = {
      money: $('#money'), shopmoney: $('#shopmoney'),
      hotbar: $('#hotbar'), prompt: $('#prompt'), toasts: $('#toasts'),
      shop: $('#shop'), body: $('#shopbody'), overlay: $('#overlay'), plotline: $('#plotline'),
      packmodal: $('#packmodal'), packcards: $('#packcards'), packtitle: $('#packtitle'),
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
      if (slot?.dataset.plant) this.select(slot.dataset.plant);
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
    this.renderHotbar();
    if (this.shopOpen) this.renderShop();
  }

  hotbarSeeds() {
    return Object.keys(state.seeds)
      .filter(id => PLANTS_BY_ID[id] && seedCount(id) > 0)
      .sort((a, b) => {
        const pa = PLANTS_BY_ID[a], pb = PLANTS_BY_ID[b];
        return TIERS[pa.tier].order - TIERS[pb.tier].order || pa.cost - pb.cost;
      })
      .slice(0, 9);
  }

  renderHotbar() {
    const ids = this.hotbarSeeds();
    if (!ids.includes(this.selected)) this.selected = ids[0] || null;
    if (!ids.length) {
      this.el.hotbar.innerHTML = `<div class="slot empty">No seeds — press <b>B</b> to buy a carrot</div>`;
      return;
    }
    this.el.hotbar.innerHTML = ids.map((id, i) => {
      const p = PLANTS_BY_ID[id];
      return `<div class="slot ${id === this.selected ? 'active' : ''}" data-plant="${id}">
        <div class="dot" style="background:${TIERS[p.tier].css}"></div>
        <div class="nm">${p.name}</div>
        <div class="ct">×${seedCount(id)}</div>
        <div class="key">${i + 1}</div>
      </div>`;
    }).join('');
  }

  select(id) {
    if (seedCount(id) > 0) { this.selected = id; this.renderHotbar(); }
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
    let html = '';
    for (const tier of TIER_ORDER) {
      const list = PLANTS.filter(p => p.tier === tier && state.discovered[p.id]);
      if (!list.length) continue;
      html += `<div class="tierhead" style="color:${TIERS[tier].css}">${TIERS[tier].name}</div>`;
      for (const p of list) {
        const can = state.money >= p.cost;
        html += `<div class="row">
          <div class="stripe" style="background:${TIERS[tier].css}"></div>
          <div>
            <div class="name">${p.name}</div>
            <div class="meta">${harvestLine(p)}</div>
          </div>
          <div class="own">owned<br><b>${seedCount(p.id)}</b></div>
          <button class="buy" data-seed="${p.id}" ${can ? '' : 'disabled'}>₪ ${fmt(p.cost)}</button>
        </div>`;
      }
    }
    html += `<div class="tierhead">Locked</div>
      <div class="row locked"><div class="stripe" style="background:#666"></div>
      <div><div class="name">Rare seeds and beyond</div>
      <div class="meta">Only seed packs carry them. Once a seed is discovered it appears here to re-buy.</div></div>
      <div class="own"></div><button class="buy" disabled>Packs →</button></div>`;
    this.el.body.innerHTML = html;
    for (const b of this.el.body.querySelectorAll('[data-seed]')) {
      b.addEventListener('click', () => this.hooks.buySeed(b.dataset.seed));
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
            <div class="meta">${known ? `${harvestLine(p)} · seed ₪${fmt(p.cost)}` : 'undiscovered — try a seed pack'}</div>
          </div>
          <div class="own">${known ? `×${seedCount(p.id)}` : ''}</div><div></div>
        </div>`;
      }
    }
    this.el.body.innerHTML = html;
  }

  showPack(pack, ids) {
    this.el.packtitle.textContent = `${pack.name} — opened!`;
    this.el.packcards.innerHTML = ids.map((id, i) => {
      const p = PLANTS_BY_ID[id], t = TIERS[p.tier];
      return `<div class="card" style="border-color:${t.css}; animation-delay:${i * 0.14}s; box-shadow:0 0 26px ${t.css}33">
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
