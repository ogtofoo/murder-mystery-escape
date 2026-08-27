// Persistent player profile: points, owned characters/abilities, equipped loadout.
// Stored in localStorage (per browser).

import { CHARACTERS, ABILITIES, MAX_EQUIPPED_ABILITIES } from '/shared/constants.js';

const KEY = 'mme-profile-v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* private mode etc. */ }
  return null;
}

const defaults = () => ({
  name: '',
  points: 0,
  ownedChars: CHARACTERS.filter(c => c.cost === 0).map(c => c.id),
  ownedAbilities: [],
  selectedChar: 'sunny',
  equippedAbilities: [],
  musicOn: true,
});

let profile = { ...defaults(), ...(load() || {}) };

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* ignore */ }
}

export const store = {
  get profile() { return profile; },
  get points() { return profile.points; },

  setName(name) { profile.name = name; save(); },

  setMusic(on) { profile.musicOn = !!on; save(); },

  addPoints(n) { profile.points += n; save(); },

  ownsChar(id) { return profile.ownedChars.includes(id); },
  ownsAbility(id) { return profile.ownedAbilities.includes(id); },

  buyChar(id) {
    const def = CHARACTERS.find(c => c.id === id);
    if (!def || this.ownsChar(id) || profile.points < def.cost) return false;
    profile.points -= def.cost;
    profile.ownedChars.push(id);
    save();
    return true;
  },

  buyAbility(id) {
    const def = ABILITIES.find(a => a.id === id);
    if (!def || this.ownsAbility(id) || profile.points < def.cost) return false;
    profile.points -= def.cost;
    profile.ownedAbilities.push(id);
    save();
    return true;
  },

  selectChar(id) {
    if (this.ownsChar(id)) { profile.selectedChar = id; save(); return true; }
    return false;
  },

  toggleAbility(id) {
    if (!this.ownsAbility(id)) return false;
    const i = profile.equippedAbilities.indexOf(id);
    if (i >= 0) profile.equippedAbilities.splice(i, 1);
    else {
      if (profile.equippedAbilities.length >= MAX_EQUIPPED_ABILITIES) profile.equippedAbilities.shift();
      profile.equippedAbilities.push(id);
    }
    save();
    return true;
  },
};
