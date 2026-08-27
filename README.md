# 🔪 Murder Mystery Escape

A 3D multiplayer murder-mystery escape game with wobbly, colorful characters.
A team is locked in a facility and must **work together, room by room**, to
reach the exit — while hidden imposters pick them off and a Trickster tries to
get themselves lynched.

Playable on **desktop (keyboard + mouse)**, **mobile (touch)**, and **gamepad**.

## Running it

```bash
npm install
npm start
```

Then open <http://localhost:3000>. Friends on the same network can join with
your machine's IP (e.g. `http://192.168.1.20:3000`) — or deploy the server
anywhere Node.js runs and share the URL.

## The escape route

Every match is a **cooperative chain of locked rooms**. The imposters start
trapped with everyone else, so at first they *have to help*:

```
[ START ROOM ]   Everyone spawns locked in together.
      │          Repair its stations → opens the only exit.
      ▼  door A
[    HUB    ]    Big central area. Three locked doors lead off it.
      ├─▶ door B → [ KEY ROOM  ]   holds the Exit Key   🔑
      ├─▶ door C → [ CODE ROOM ]   holds the Exit Code  🔢
      └─▶ door X → [   EXIT    ]   final door — needs BOTH delivered
```

- The hub's stations are split in two halves: one half unlocks door B, the
  other unlocks door C.
- Someone must **carry** the key and the code (one item at a time!) back to
  the **exit terminal** and insert them. Drop them — or get murdered holding
  one — and it falls on the floor for anyone to grab.
- As more rooms open, the group spreads out — and the imposters finally get
  the isolation they need.

## Roles

| Role | | What they do |
| --- | --- | --- |
| **Crew** | 🛠 | Repair stations, fetch the key/code, escape. |
| **Imposter** | 🔪 | Kill the crew before they escape. Must help in the start room. Only role that can use shop abilities. |
| **Medic** | 💉 | Can **revive dead bodies** (2 charges, cooldown). Wins with the crew. |
| **Engineer** | 🔧 | Cracks locks and reads hints — see below. Wins with the crew. |
| **Trickster** | 🎭 | **Wins alone if the crew votes them out** — and then *everyone else loses*. Act suspicious. |

With 7+ players there's a chance of **two imposters**; 9+ always has two.
Medic/Engineer appear from 5 players, Trickster from 6.

Ghosts aren't useless: a murdered crewmate can still finish their stations to
help the team open doors.

### The Engineer 🔧

A crewmate who brute-forces keys and locks and figures out hints:

- **Passive — hints.** Every station minigame leaks extra information to
  them: the matching wire socket glows, keypad codes stay on screen far
  longer, memory sequences are shorter, one correct breaker is named, and
  levers start one click from alignment.
- **🔓 Hotwire** (3×, 18s cooldown) — force the station you're standing at
  straight open. No puzzle at all.
- **🔍 Scan** (2×, 30s cooldown) — reveal where the key and code are with
  beacons visible **through walls**, and read out the exit code. Shared with
  the whole crew; imposters and the Trickster get nothing.
- **🔓 Bypass** — at the exit terminal, brute-force a **missing** key or code
  directly into the lock. It costs 2 hotwire charges, takes 10 seconds of
  standing perfectly still (move and it cancels), and **alerts every player
  on the map** to your exact position. A last resort when the imposters are
  sitting on the key room.

## Map themes 🗺

Maps are **procedurally generated fresh every match** — room sizes, door
positions, station layout, crate cover, the key/code hiding spots and the
exit code all change. The host picks the theme in the lobby (or Random):

| | Theme | |
| --- | --- | --- |
| 🛰 | **Space Station** | Cryo Bay → Command Deck → Armory / Data Core → Escape Airlock |
| 🏚 | **Haunted Manor** | Cellar → Grand Hall → Study / Library → Front Gate |
| 🌿 | **Jungle Temple** | Antechamber → Great Court → Idol Room / Glyph Hall → Temple Gate |
| ❄️ | **Arctic Lab** | Airlock Bay → Main Lab → Cold Store / Server Room → Ice Tunnel |

## Dynamic music 🎵

The soundtrack is **generated live in the browser** (WebAudio — no audio
files) and reacts to the game:

- Layers fade in as tension rises: bass pulse → arpeggio → percussion →
  heartbeat.
- Intensity is driven by real events: how many doors are open, a recent
  murder, an imposter closing in on you, a blackout, carrying the key, and
  the final door opening (full chase mode).
- Each theme has its own scale, tempo and voice, so the Manor sounds nothing
  like the Arctic Lab.
- Stings for kills, unlocks, pickups, revives, meetings, and win/lose.
- Toggle with the 🎵 button in the HUD.

## Points & Shop ⭐

Every match earns points (repairs, kills, revives, escaping, winning, voting
an imposter out). Spend them in the **Shop** on:

- **Characters** — 10 colorful wobbly skins.
- **Imposter abilities** (usable *only* when you roll imposter, equip up to 2):
  ⚡ **Adrenaline** (speed burst) · 👻 **Vanish** (invisibility) ·
  🌑 **Blackout** (shrink crew vision) · 🎭 **Shapeshift** (copy a crewmate).

Points and unlocks persist in your browser.

## Controls

| Action | Keyboard/Mouse | Touch | Gamepad |
| --- | --- | --- | --- |
| Move | WASD / arrows | left joystick | left stick |
| Camera | mouse (click to lock) | drag right side | right stick |
| Use / grab / insert | E | on-screen buttons | A |
| Kill | Q | KILL button | X |
| Report / revive | R | REPORT / REVIVE | Y |
| Meeting | T | 📢 button | Start |
| Ability 1 / 2 | 1 / 2 | ability buttons | B / LB |

For the Engineer, ability 1 is Hotwire (or Bypass at the exit terminal) and
ability 2 is Scan. Shop abilities remain imposter-only.

`E` is contextual: it inserts a carried item at the terminal, grabs a nearby
key/code, or opens the station puzzle.

## Architecture

- `server/server.js` — Node.js + WebSocket authoritative server: rooms, roles,
  door/station progression, collectables, kills & revives, meetings/votes, win
  conditions, points, and AI bots that pursue the current objective.
- `shared/mapgen.js` — seeded procedural map generator (server and clients
  build identical worlds from `{seed, themeId}`) plus collision helpers.
- `shared/constants.js` — roles, themes, abilities, characters, tuning.
- `public/js/` — Three.js client: `world.js` (themed level meshes),
  `character.js` (wobbly toon characters), `puzzles.js` (station minigames),
  `music.js` (procedural dynamic score), `controls.js` (keyboard/touch/gamepad),
  `main.js` (glue, HUD, netcode).

No build step — the client uses native ES modules with a vendored Three.js.
