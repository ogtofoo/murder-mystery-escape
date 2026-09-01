# Sheckle Garden 🥕

A 3D gardening game. You start with **one sheckle**, buy **one carrot seed**, and grow that
into a farm of prismatic, transcendent and SUPER crops. Runs in the browser — no build step,
no dependencies to install (three.js is vendored in `vendor/`).

## Play

Any static web server works, because ES modules can't be loaded from `file://`:

```bash
python3 -m http.server 8777
# then open http://localhost:8777
```

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| Mouse | Look (click the page to capture the pointer; click-drag also works) |
| Wheel | Zoom the third-person camera |
| `Shift` / `Space` | Sprint / jump |
| `E` or left click | Plant, harvest, till a new plot, open the shop at the stall |
| `1`–`9` / `Q` | Pick a seed from the hotbar |
| `B` | Seed shop (seeds, packs, almanac) |
| `V` | Toggle **first person ↔ third person** |
| `Esc` | Close the shop / back to the menu |

### Controller

Plug in any standard-mapping gamepad (Xbox, PlayStation, most USB pads) and it just works —
the game switches its on-screen hints over as soon as it sees one.

| Button | Action |
| --- | --- |
| Left stick | Move |
| Right stick | Look |
| `A` | Plant / harvest / buy plot / confirm |
| `B` | Toggle first ↔ third person (closes the shop when it's open) |
| `X` | Jump |
| `Y` | Open the seed shop |
| `RT` / `LT` / `L3` | Sprint |
| `LB` / `RB` | Previous / next seed — and previous / next shop tab |
| D-pad or left stick | Move the highlight through the shop list |
| `R3` | Snap the third-person camera close / far |
| `Start` | Menu |

The shop, the pack reveal and the title screen are all fully navigable with the pad, and it
rumbles on a harvest (harder for higher tiers) and when a seed pack opens.

**Controller not responding?** Press `P` in game (or "🎮 Controller test" on the title screen)
for a live readout of every pad the browser can see, its mapping, its sticks and which button
numbers you're pressing. The usual causes, in order:

1. **Press a button on the pad with the game window in front.** Browsers hide gamepads from a
   page until a button is pressed on them — nothing at all is reported before that.
2. **Check the pad is actually paired to the Mac**, not just powered on: System Settings →
   Bluetooth should show *Xbox Wireless Controller — Connected*. To pair, hold the Xbox button
   until it flashes fast, then hold the small button on the back. A USB-C cable also works and
   skips pairing entirely. (Only Bluetooth-capable Xbox pads — Series X|S and later Xbox One
   models — pair with macOS; the old Xbox 360 pad needs a third-party driver.)
3. **Use Chrome.** Safari's Gamepad API support is inconsistent.
4. If **hardwaretester.com/gamepad** doesn't see it either, the problem is the Mac or the
   pairing rather than the game.

The title screen shows a build stamp (e.g. `build 4 · 2026-09-01`) so you can confirm which
version you're actually running after a `git pull`.

## How it plays

1. You spawn with **₪1**. Press `B` and buy the carrot seed — it costs exactly one sheckle.
2. Walk onto your single tilled plot, look down at it and press `E` to plant.
3. Wait for it to grow (crops scale up as they ripen and bob once they're ready), then `E` to
   harvest. The crop is sold on the spot.
4. Look at the fenced-off ground next to your garden: the price tag floating over it is the
   cost of the next plot. Press `E` to buy the land. Every plot costs ~2.45× the last, up to
   36 plots.
5. Reinvest in better seeds — or gamble on **seed packs**, which are deliberately brutal in
   price and are the only way to discover rare seeds and above.

### Tiers

Common → Uncommon → Rare → Legendary → Mythic → Prismatic → Transcendent → **SUPER**

Common seeds are always on the shelf. Everything from Rare up has to be pulled out of a seed
pack first; once a species is discovered it stays in the shop (and the almanac) so you can buy
it directly. Prismatic and above hue-cycle and glow in the world.

## Saves

Progress (money, seeds, plots, growing crops and the almanac) saves automatically to the
browser's `localStorage`, and crops keep growing while the tab is closed.

**Updating the game does not erase your garden.** The save belongs to the URL you play on, not
to the files, so `git pull`-ing a new version — or deleting and re-cloning the folder — leaves
it untouched, as long as you keep serving on the same address (`http://localhost:8777`).
Saves are also version-tolerant: a save from an older build loads into a newer one, filling in
whatever is new and quietly dropping anything that no longer exists.

You *would* lose it by switching port or hostname (`localhost:8000`, or `127.0.0.1` instead of
`localhost` — different origin, different save), clearing browser data, playing in a private
window, or using a different browser or computer.

So the title menu has **⬇ Back up save**, which downloads a `sheckle-garden-YYYY-MM-DD.json`
file, and **⬆ Restore backup**, which loads one back in — that file moves your farm between
ports, browsers and machines. "Erase save & start over" is there too.

## Layout

```
index.html        markup, HUD, shop and menu overlays
styles.css        UI styling
vendor/           three.js r169 (MIT), vendored so the game runs offline
src/
  main.js         loop, targeting, interaction, economy glue
  data.js         tiers, the 24 plants, seed packs, land pricing, number formatting
  state.js        save file, money, inventory, growth timers
  world.js        sky, lights, ground, plot grid, shop stall, scenery
  plants.js       procedural low-poly crop models (root/leaf/bush/vine/flower/tree/orb)
  gardener.js     the 3D gardener and their walk cycle
  player.js       movement, mouse look, first/third person camera
  ui.js           HUD, hotbar, shop tabs, pack reveals, toasts
  gamepad.js      controller input: sticks, edge-triggered buttons, rumble
  sfx.js          small WebAudio blips
```

Balance lives entirely in `src/data.js` — seed costs, grow times, sell prices, pack odds and
the `plotCost()` curve. `window.game` is exposed in the console for poking at things.
