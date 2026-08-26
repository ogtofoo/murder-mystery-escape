# 🔪 Murder Mystery Escape

A 3D multiplayer murder-mystery escape game with wobbly, colorful characters.
The crew solves puzzles to open the Escape Airlock and get out alive — but one
(or sometimes two!) of the players is an **imposter** hunting them down.

Playable on **desktop (keyboard + mouse)**, **mobile (touch)**, and **gamepad**.

## Running it

```bash
npm install
npm start
```

Then open <http://localhost:3000>. Friends on the same network can join with
your machine's IP (e.g. `http://192.168.1.20:3000`) — or deploy the server
anywhere Node.js runs and share the URL.

## How to play

- **Quick Play** joins any open lobby; **Create Room** gives you a 4-letter
  code to share. Lobbies auto-fill with AI bots up to 4 players, and the host
  can add more (max 10).
- At match start, roles are secret: with 7+ players there's a chance of
  **two imposters**.
- **Crew** 🛠 — complete your puzzle stations (wires, keypads, memory
  sequences, fuses, levers). When *all* crew tasks hit 100%, the Escape
  Airlock opens: stand on the green pad to escape. Escape with the crew, or
  eject every imposter, to win.
- **Imposter** 🔪 — kill the crew before they escape. Fake puzzles to blend
  in. Kills have a cooldown; bodies can be reported.
- Anyone can **report a body** or press the hub's **emergency button** to
  call a meeting: chat, then vote to eject a suspect (majority; ties/skips
  eject no one).
- Ghosts can still finish their own puzzles, so a murder never makes the
  door unopenable.
- Time limit 10 minutes — if nobody escapes, the imposters win the lockdown.

## Points & Shop ⭐

Every match earns points (puzzles, kills, escaping, winning, voting an
imposter out). Spend them in the **Shop** on:

- **Characters** — 10 colorful wobbly skins.
- **Imposter abilities** (usable *only* when you roll imposter, equip up to 2):
  - ⚡ **Adrenaline** — speed burst
  - 👻 **Vanish** — short invisibility
  - 🌑 **Blackout** — shrink the crew's vision
  - 🎭 **Shapeshift** — copy a random crewmate's look

Points and unlocks persist in your browser.

## Controls

| Action  | Keyboard/Mouse | Touch | Gamepad |
| ------- | -------------- | ----- | ------- |
| Move    | WASD / arrows  | left joystick | left stick |
| Camera  | mouse (click to lock) | drag right side | right stick |
| Use / puzzle | E | USE button | A |
| Kill    | Q | KILL button | X |
| Report  | R | REPORT button | Y |
| Meeting | T | 📢 button | Start |
| Ability 1 / 2 | 1 / 2 | ability buttons | B / LB |

## Architecture

- `server/server.js` — Node.js + WebSocket authoritative server: rooms,
  roles, kills, meetings/votes, task progress, escape logic, win conditions,
  points, and AI bots (waypoint pathfinding; imposter bots hunt
  opportunistically, crew bots do tasks and flee to the airlock).
- `shared/` — map layout & game constants shared by server and client.
- `public/` — Three.js client: wobbly toon characters, the facility map,
  puzzle minigames (DOM), HUD, shop, and unified keyboard/touch/gamepad input.

No build step — the client uses native ES modules with a vendored Three.js.
