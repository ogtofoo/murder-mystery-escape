// Shared game constants — imported by both the server (Node) and the client (browser).

export const TICK_RATE = 15;           // server broadcast rate (snapshots / second)
export const PLAYER_SPEED = 6.2;       // units / second
export const PLAYER_RADIUS = 0.55;
export const KILL_RANGE = 2.2;
export const KILL_COOLDOWN = 22;       // seconds between imposter kills
export const REPORT_RANGE = 3.5;
export const INTERACT_RANGE = 2.6;
export const TASKS_PER_PLAYER = 4;
export const MEETING_TIME = 35;        // seconds of discussion + voting
export const MEETING_COOLDOWN = 20;    // seconds after game start / meeting before button works
export const COUNTDOWN_TIME = 5;
export const MIN_PLAYERS = 4;          // bots fill in below this
export const MAX_PLAYERS = 10;
export const ESCAPE_HOLD = 1.5;        // seconds standing in airlock to escape

// How many imposters for a given (human + bot) player count.
// "Sometimes there's more than one imposter" — 2 imposters possible from 7 players,
// with a random chance so lobbies of 7+ are not always 2.
export function imposterCount(playerCount, rng = Math.random) {
  if (playerCount >= 9) return 2;
  if (playerCount >= 7) return rng() < 0.5 ? 2 : 1;
  return 1;
}

// ---------------------------------------------------------------------------
// Points awarded by the server at the end of a match.
export const POINTS = {
  PARTICIPATE: 15,
  TASK: 6,
  KILL: 12,
  ESCAPE: 25,
  WIN_CREW: 40,
  WIN_IMPOSTER: 55,
  EJECT_IMPOSTER_VOTE: 10, // voted correctly for an ejected imposter
};

// ---------------------------------------------------------------------------
// Playable characters (Wobbly-Life-style colorful blobs). Cost in points.
export const CHARACTERS = [
  { id: 'sunny',   name: 'Sunny',   cost: 0,    body: '#f5c518', belly: '#ffe38a', accent: '#e08700' },
  { id: 'berry',   name: 'Berry',   cost: 0,    body: '#e4405f', belly: '#ff9db0', accent: '#9c1c35' },
  { id: 'minty',   name: 'Minty',   cost: 150,  body: '#2ecc71', belly: '#a9f0c8', accent: '#14713d' },
  { id: 'ocean',   name: 'Ocean',   cost: 150,  body: '#3498db', belly: '#a8d8f5', accent: '#1b5d8c' },
  { id: 'grape',   name: 'Grape',   cost: 300,  body: '#9b59b6', belly: '#d6b3e8', accent: '#5e2f75' },
  { id: 'tango',   name: 'Tango',   cost: 300,  body: '#e67e22', belly: '#ffcf9e', accent: '#8f4a0e' },
  { id: 'shadow',  name: 'Shadow',  cost: 500,  body: '#34495e', belly: '#7f8c8d', accent: '#111a22' },
  { id: 'bubble',  name: 'Bubble',  cost: 500,  body: '#ff7ab8', belly: '#ffd1e8', accent: '#c23a80' },
  { id: 'toxic',   name: 'Toxic',   cost: 800,  body: '#a4e22e', belly: '#e2ff9e', accent: '#5a8a06' },
  { id: 'golden',  name: 'Golden',  cost: 1200, body: '#ffd700', belly: '#fff3b0', accent: '#b8860b' },
];

// ---------------------------------------------------------------------------
// Imposter-only abilities, bought in the shop and equipped (max 2) before a match.
// Each can be used a limited number of times per match, with a cooldown.
export const ABILITIES = [
  {
    id: 'sprint', name: 'Adrenaline', cost: 200, icon: '⚡',
    desc: '+60% speed for 4 seconds. Run down your prey.',
    uses: 3, cooldown: 20, duration: 4,
  },
  {
    id: 'invis', name: 'Vanish', cost: 400, icon: '👻',
    desc: 'Turn invisible to everyone for 6 seconds.',
    uses: 2, cooldown: 30, duration: 6,
  },
  {
    id: 'blackout', name: 'Blackout', cost: 500, icon: '🌑',
    desc: 'Cut the lights — crew vision shrinks for 8 seconds.',
    uses: 2, cooldown: 35, duration: 8,
  },
  {
    id: 'disguise', name: 'Shapeshift', cost: 700, icon: '🎭',
    desc: 'Copy a random crewmate’s look for 10 seconds.',
    uses: 2, cooldown: 30, duration: 10,
  },
];

export const MAX_EQUIPPED_ABILITIES = 2;

export const BOT_NAMES = ['Waldo', 'Pickle', 'Noodle', 'Biscuit', 'Gizmo', 'Taco', 'Pudding', 'Wiggles', 'Sprout'];
