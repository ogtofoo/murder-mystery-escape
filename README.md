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
| `G` | Take out / put away the shovel |
| Hold `E` | With the shovel out: dig up the plant you're looking at |
| `C` / `T` | Whistle your pets over / feed the nearest one a seed |
| `B` | Seed shop (seeds, packs, almanac) |
| `V` | Toggle **first person ↔ third person** (first person uses a wider 90° field of view) |
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
| D-pad ↓ | Take out / put away the shovel (hold `A` to dig) |
| D-pad → / `L3` | Feed the nearest pet / whistle them over |
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

### Single vs multi harvest

Crops you pull out of the ground whole — carrots, radishes, lettuce, star corn, eternity root —
are one and done. Everything that fruits from a standing plant (bushes, vines, flowers, trees
and the floating orbs) **keeps producing**: harvest it and the plant stays put, its fruit
regrows on a shorter timer, and you pick it again. Bushes give 4 harvests, vines 3, flowers 5,
trees 6, orbs 8 — then the plant is spent and the plot frees up.

A regrowing seed costs more up front (the price scales with how many pickings it gives) but
earns far more per plot, and much more per second once established. The two single-harvest
crops in the upper tiers are priced as the fast-payback alternative: a cheaper seed that pays
out sooner, if you don't mind replanting. Every seed's line in the shop spells out the
harvests, the regrow time and the lifetime total.

### Selling seeds back

Every seed row in the shop has a **sell** button: the shop buys seeds back at 50% of what they
cost, one at a time or the whole stack at once. Handy for dumping a stack of commons after a
seed pack upgrades you, or clawing back half of a seed you bought by mistake. Digging a crop
up with the shovel refunds nothing — the seed is already in the ground.

### Watering cans and sprinklers

Two ways to make things grow faster, sold in the shop's **Tools** tab.

**Watering cans** are manual. Press `F` to take one out, then `E` on a plant to skip it further
through its current cycle — once per plant per cycle, so you can't spam it.

| Can | Cost | Effect |
| --- | --- | --- |
| Watering Can | ₪300 | +25% growth, one plot at a time |
| SUPER Watering Can | ₪50B | +60% growth, to every plant within 6.5m at once |

**Sprinklers** are automatic and permanent. Buy one, select it in the hotbar and press `E` on an
empty plot to stand it there — it costs you that square, and in exchange every crop in range
grows faster forever. Overlapping sprinklers don't stack; the best one covering a plot wins.
Soil under a sprinkler reads darker, and the growth prompt shows the multiplier.

| Sprinkler | Cost | Growth | Reach |
| --- | --- | --- | --- |
| Common | ₪12K | 1.35× | 2.7m — up to 5 plots |
| Rare | ₪1.5M | 1.7× | 3.9m — up to 9 plots |
| Legendary | ₪250M | 2.2× | 5.5m — up to 13 plots |
| Prismatic | ₪120B | 2.9× | 7.5m — up to 25 plots |
| Transcendent | ₪9T | 3.8× | 10.5m — up to 35 plots |
| SUPER | ₪400T | 5× | the entire garden |

The shovel picks a sprinkler back up and returns it to your shed, so moving one costs nothing.

### 🪤 CARNIVORE — the class above SUPER

Four meat-eating plants, sold only in the **CARNIVORE Pack**. They are the most valuable crops
in the game and the only ones that will not ripen on a timer.

| Plant | Seed | Must eat | Reach | Sells for |
| --- | --- | --- | --- | --- |
| Venus Snaptrap | ₪2.5Qa | 10 bugs | 3.2m | ₪9Qa × diet |
| Pitcher Beast | ₪19Qa | 18 bugs | 3.8m | ₪70Qa × diet |
| Bog Gulper | ₪133Qa | 30 bugs | 4.5m | ₪600Qa × diet |
| World Devourer | ₪1.06Qi | 50 bugs | 6.0m | ₪5Qi × diet |

**They have to fight for it.** A bug in reach gets chewed on — and bites back. Small prey goes
down in a moment, but big bugs are genuinely dangerous, and a plant that runs out of health is
torn apart and lost. Between fights a carnivore knits itself back together at 3% a second.

| | Locust | Titan Weevil | MEGA Locust | MEGA Titan Weevil |
| --- | --- | --- | --- | --- |
| Venus Snaptrap | wins | **loses** | **loses** | **loses** |
| Pitcher Beast | wins | **loses** | wins | **loses** |
| Bog Gulper | wins | wins | wins | **loses** |
| World Devourer | wins | wins | wins | **wins** |

Only a **World Devourer** can chew through a MEGA bug — everything below it gets eaten trying.
A carnivore ripens only when *both* its timer has run out **and** it has eaten its fill. Eaten
bugs pay no bounty; the plant gets the meal instead.

**Their fruit looks like what they ate.** Little bug-shaped pods grow on the plant in the
colour of its main prey — green aphid pods, gold locust pods, pink Titan Weevil pods — and the
nastier the diet, the more the fruit is worth: **×1.35 on aphids up to ×3.1 on Titan Weevils**.
Each picking empties its stomach, so it has to hunt again for the next one.

This turns bug raids from a nuisance into a harvest. Plant a Devourer, stop shooting, and let
them come.

**Don't wait for a raid — get a Baby Drake.** A drake roars bugs in constantly, and sends them
straight at whichever carnivore is still hungry. One level-1 drake calls a bug every 40 seconds;
a level-25 drake calls one every 1.6 seconds. **There is no cap** — every extra drake and every
level adds to the rate, so five grown drakes bring over three bugs a second and a pack of twelve
brings seven. Without a carnivore planted they just eat your crops, so pair them up.

### 🌦️ Day, night and weather

The sky runs a full day every 8 minutes: sunrise, noon, a long golden dusk, then night with
stars and a moon that actually lights the garden. Bugs raid more often after dark.

Weather rolls every few minutes and changes how the garden behaves:

| Weather | Growth | What it brings |
| --- | --- | --- |
| ☀️ Clear | 1× | — |
| 🌧️ Rain | 1.5× | Wet crops (2×) |
| ⛈️ Thunderstorm | 1.5× | Wet, and rare **Shocked** crops (50×) — with lightning |
| ❄️ Frost | 1.5× | Chilled (2×) and rare **Frozen** crops (10×) |
| 🌈 Rainbow Sky | 1.35× | 14× the chance of a Silver, Gold or Rainbow crop |
| ☄️ Meteor Shower | 1.25× | Night only — rare **Celestial** crops (120×) |

### 🧬 Mutations — the thing worth bragging about

A crop rolls its mutation the moment it finishes ripening, so you *see* what you got before you
pick it. Gold plates the whole plant, Rainbow cycles through every colour, and the weather marks
make it glow.

**Variants** (one at a time): Silver **5×** · Gold **20×** · Rainbow **50×**
**Weather marks** (one at a time): Wet **2×** · Chilled **2×** · Frozen **10×** · Shocked **50×** · Celestial **120×**

They **multiply together**, and on top of your Golden Seed bonus. A Rainbow Shocked crop in a
thunderstorm is **2,500×** its normal price; a Rainbow Celestial in a meteor shower is **6,000×**.
A plain tomato sells for ₪180. A Rainbow Shocked one sells for ₪450,000.

### 🐾 Pets

Buy an egg, keep gardening, and it hatches on its own into one of ten companions. **Keep as
many out as you like** — they wander your garden on their own rather than trailing behind you,
so you can actually watch them potter about. Press `C` to whistle and they all come running.

**Feed them.** Hold any seed and press `T` next to a pet to give it a treat. The rarer the seed,
the happier it gets: a carrot is +6, a SUPERFRUIT seed is +80 out of 100. A happy pet moves
faster, learns faster, and works **up to 60% harder** at its ability — and happiness ebbs away
slowly, so it's worth topping up. It's also a good use for the drawer full of common seeds.

Pets level up just by being out, and every level makes their ability stronger.

| Pet | Tier | Does |
| --- | --- | --- |
| Garden Snail | Common | Growth speed |
| Ladybug | Common | Chews through nearby bugs |
| Honey Bee | Uncommon | Mutation luck |
| Bunny | Rare | Auto-picks ripe crops near you |
| Barn Cat | Rare | Crop value |
| Fox | Legendary | Auto-picks, wider |
| Wise Owl | Mythic | Mutation luck ++ |
| Baby Drake | Prismatic | **Roars bugs in** — feeds your carnivores |
| Phoenix Chick | Transcendent | Crop value +++ |
| Star Sprite | SUPER | Mutation luck ×5.5 per level |

A level-10 Star Sprite multiplies your mutation luck by 46 — Rainbow crops stop being a
once-a-week event.

### ⬆ Garden Mastery

Five permanent upgrades with **no level cap**, so sheckles always have somewhere to go: growth
speed, crop value, mutation luck, bug bounty and Golden Seed gain. Costs roughly double each
level, running from millions into the sextillions. They survive a Golden Harvest.

### 🏅 Ranks

Your all-time earnings carry a title, shown under the wallet:
Seedling → Sprout → Gardener → Farmer → Grower → Cultivator → Botanist → Sheckle Baron →
Garden Tycoon → Living Legend → Garden God → MYTHWEAVER → **SHECKLE OVERLORD**.

### ✨ Golden Harvest — the endgame

Once every plot is tilled and you've earned ₪100T in a run, the shop's **Golden** tab offers a
Golden Harvest: plough the whole garden under and start over, keeping **Golden Seeds** worth
√(earnings ÷ ₪1T). Every Golden Seed makes **every crop you ever sell 5% more valuable,
forever** — a run worth ₪200Qa pays 447 seeds, which is 23× on every harvest after it.

You keep your almanac, your trophies, your tools and weapons, and every sprinkler and turret
goes back to your shed. Only sheckles, seeds and land start over — so the second run flies by,
and the third flies by faster still.

### 🏆 Trophies

Sixteen goals with rewards paid the instant you finish them — harvest counts, land, species
discovered, bugs squashed, MEGA bugs beaten, sprinklers and turrets running, and Golden
Harvests done. The **Trophies** tab shows a progress bar for every one still open.

### 💀 MEGA bugs

Every fourth raid sends a boss instead of a swarm: one enormous horned bug with 45× the health,
its own health bar across the top of the screen, and a bounty 70× the usual. Beating your first
one is a trophy; beating ten is a much bigger one.

### Bugs, weapons and turrets

Every few minutes a **bug raid** crosses the field toward your crops. A bug that reaches a plot
latches on and chews: each one drags that plot's growth down (one bug ≈ 0.57×, two ≈ 0.4×), and
they stay until something kills them — including while the game is closed. The HUD shows how
many are in the garden, and an infested plot says so in its prompt.

Raids get nastier as you progress, from Aphids up through Leaf Beetles, Locusts, Root Grubs,
Void Mantises and Titan Weevils. Killing one pays a bounty scaled to its species.

**Weapons** — press `R` to arm the best one you own, then `E` or click (hold to keep firing).

| Weapon | Cost | Damage | How it fights |
| --- | --- | --- | --- |
| Bug Swatter | ₪2K | 40 / 0.42s | Swing at anything close |
| Pest Sprayer | ₪900K | 110 / 0.3s | Sprays a 2.4m cloud |
| Bug Blaster | ₪400M | 1.1K / 0.24s | Hitscan out to 22m |
| SUPER Zapper | ₪200B | 11K / 0.18s | Arcs to 5 bugs at once |

**Turrets** stand on a plot like a sprinkler and shoot on their own, whether you're watching or
not. They are deliberately expensive.

| Turret | Cost | Damage | Rate | Range |
| --- | --- | --- | --- | --- |
| Common | ₪5M | 35 | 1.2/s | 6m |
| Rare | ₪800M | 180 | 1.5/s | 8m |
| Legendary | ₪150B | 1.4K | 2/s | 11m |
| Prismatic | ₪20T | 11K | 2.5/s | 15m |
| Transcendent | ₪900T | 90K | 3/s | 22m |
| SUPER | ₪50Qa | 650K | 4/s | the whole garden |

The shovel lifts a turret back into your shed, same as a sprinkler.

### The shovel

Press `G` to take out the shovel, then **hold** `E` on any planted plot to dig the crop up and
free the plot — useful for clearing a low-tier crop you've outgrown, or a multi-harvest plant
squatting on a plot you want back. It's a hold rather than a tap so a stray press can't
destroy a plant with harvests left, and the prompt tells you how many you're throwing away.
Nothing is refunded, and while the shovel is out `E` won't harvest — press `G` again to stow it.

### Tiers

Common → Uncommon → Rare → Legendary → Mythic → Prismatic → Transcendent → **SUPER** → **CARNIVORE**

A pack never gives you the same species twice — seeds are drawn without replacement, and a
tier drops out of the draw once all its plants are taken, so its weight passes to the tiers
still in play and the advertised odds hold. Cards are revealed lowest tier first, and anything
new to your almanac gets a NEW badge.

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
whatever is new and quietly dropping anything that no longer exists. Every crop is stored with
the bed it's planted in *and* that bed's world coordinates, along with how far through its
current cycle it is and how many pickings it has left — so plants come back exactly where you
put them, mid-growth. If the garden's shape ever changes between versions, each crop is
replanted on the bed nearest to where it physically stood rather than by slot number.

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
  plants.js       procedural low-poly crop models (root/leaf/bush/vine/flower/pitaya/tree/orb)
  bugs.js         bug raids: spawning, crawling, chewing, health bars, dying
  devices.js      sprinkler, can, turret and weapon models, sprays and tracers
  gardener.js     the 3D gardener and their walk cycle
  player.js       movement, mouse look, first/third person camera
  ui.js           HUD, hotbar, shop tabs, pack reveals, toasts
  gamepad.js      controller input: sticks, edge-triggered buttons, rumble
  sfx.js          small WebAudio blips
```

Balance lives entirely in `src/data.js` — seed costs, grow times, sell prices, pack odds and
the `plotCost()` curve. `window.game` is exposed in the console for poking at things.
