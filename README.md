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
| `E` or left click | Plant, harvest, till a new plot, open the shop at the stall — or breathe frost while riding |
| `1`–`9` / `Q` | Pick a seed from the hotbar |
| `G` | Take out / put away the shovel |
| Hold `E` | With the shovel out: dig up the plant you're looking at |
| `C` / `T` | Whistle your pets over / feed the nearest one a seed |
| `Y` | Climb on or off your **Frost Wyrm** (once you have beaten one) |
| Jump twice | Thump the ground: your buried wyrm tunnels over and erupts beside you |
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
| `X` | Jump — **tap it twice** to call your Frost Wyrm up out of the ground |
| `Y` | Open the seed shop |
| `RT` / `LT` / `L3` | Sprint |
| `LB` / `RB` | Previous / next seed — and previous / next shop tab |
| D-pad or left stick | Move the highlight through the shop list |
| `R3` | **Ride / hop off your Frost Wyrm.** Without one it snaps the camera close / far |
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

### 🦝 Night thieves and garden defence

After dark, someone always fancies your crops. **Raccoons, Crows and Garden Gnomes** creep in
and dig up whatever is sitting **ripe** — a stolen crop pays you nothing. Gnomes go straight for
your most valuable plant, crows fly in over everything, and they all get tougher as your garden
grows. They only turn up while you're actually playing, so nothing is stolen while the game is
closed.

Catch one — with a weapon, a turret, a trap or a guard crop — and it pays a bounty.

| Defence | Cost | Does |
| --- | --- | --- |
| Scarecrow | ₪2M | Thieves won't come within 7m of it |
| Bear Trap | ₪25M | 2,500 damage a second to anything creeping past |
| Flood Lamp | ₪400M | Lights 9m of garden, halving their speed — and glows at night |

**Guard crops** defend their own patch and can never be stolen:

| Crop | Cost | Does |
| --- | --- | --- |
| Guard Cactus | ₪43K | 900 damage a second to thieves within 4m |
| Iron Bamboo | ₪1.9M | Blocks thieves within 5m outright |

The simplest defence is still to harvest promptly — a garden with nothing ripe in it has
nothing worth stealing.

### ❄️ The Gnome's Ice Lair

Don't catch the **Garden Gnome** — **follow him**. Turrets can't track a gnome (too short, too
sneaky), so he'll always make it out of a fortified garden; traps and guard cacti still hurt him,
and you can always swat him yourself if you'd rather have the bounty. When a gnome runs off with your crop (or gets
scared off), he heads for a rocky mound out by the hills instead of the fence. Stay within
about 14m of him when he gets there and the boulder rolls aside: you've found his secret lair,
and it stays found forever (the **Secret Keeper** trophy). Until you've found it, every third
thief is a gnome so you get plenty of chances.

The fastest way to meet one is the **Gnome Hound** — a legendary pet that barks a gnome out of the
hedgerow at any hour (no waiting for nightfall), then sprints after him when he runs, so you can
simply follow the dog. See the Pets section.

While a gnome is running home the top of the screen shows how far away he is. He waits at his
door for about seven seconds fumbling with the boulder, so you only need to be within 22m of him
before that runs out — and if you weren't, the game tells you how far behind you were.

Once you've found the lair, chasing a gnome all the way to his door while it is still on cooldown
makes him leave the boulder rolled aside — **the lair reopens immediately**. With a hound out, that
turns a 20 minute wait into another run.

**Testing tip:** open the game as `http://localhost:8777/?gnome` and a gnome turns up a few seconds
after you press Play and keeps coming — day or night, ripe crops or not — until you take `?gnome`
back out of the address.

Press **E** at the glowing cave mouth to go in. Inside is a huge ice cavern — crystal spires,
stalactites, drifting snow, the gnome's frozen throne and his hoard of coins — and a **twenty wave
boss rush** of every MEGA bug you know from raids, ending with one that only lives down here:

| Waves | What comes at you |
| --- | --- |
| 1–5 | Aphids, then spiders, beetles and locusts — the warm-up |
| 6–10 | Scorpions, root grubs, acid spitters and the first Void Mantis |
| 11–15 | Pairs and trios: mantises, Titan Weevils, then the first **FROST TITAN** |
| 16–19 | Two Titans at once, Frost Titans with escorts, then **two Frost Titans** |
| **20** | **THE FROST WYRM** — see below |

Down here the bosses hunt **you**, not your crops, and each species comes at you its own way — see
**Bugs that fight back** below. There's no health bar to lose. Instead each wave has a **75 second
clock**, and every hit knocks time off it: a bite costs 4 seconds, a pounce 6, a sting 9.
Kill everything before the clock runs out and the next wave comes after a short breather. Run out
of time and the lair freezes over: you keep everything you've already won and get thrown out.
You can walk out through the glowing arch at any time.

Rewards stack up fast:

- Every boss pays its usual MEGA bounty.
- Every wave cleared pays a windfall that scales with your **lifetime earnings** and climbs 15% a
  wave, so the late waves carry the run. Beating all twenty is worth roughly **three quarters of
  everything you have ever earned**.
- **Wave 5** cracks open a free seed pack, **wave 10** thaws out a free egg, **wave 15** drops
  three SUPER seeds.
- **Clearing all twenty** pays Golden Seeds (10, +5 per Level), a guaranteed **CARNIVORE seed**,
  and the **Wyrm Rider** trophy — which unlocks the **Frost Crown** in the wardrobe. Ten clears is
  the **Frost King** trophy, twenty is **Wyrm Lord**.

**The Levels never end.** Each full clear makes the lair one **Level** deeper: all twenty waves come
back with 1.3× the health and 1.45× the payout, forever. Since the rewards climb faster than the
health, a deep lair is where the real money is — as long as you keep upgrading your weapon.

**Wave 20 is the FROST WYRM** — a frost sandworm the size of a bus, with a ringed body and a round
maw full of teeth. It does not charge you across the floor. It **tunnels under the ice**, showing
only a ridge of churned ice racing toward you, and while it is under there it cannot be hit at all.
Then it **erupts** where you are standing, throwing you clear and costing 10 seconds. It stays up
for a few seconds, spitting frost shards, and that is your window to hurt it before it dives again.

Watch the ridge and keep moving. It has 1.6× a Frost Titan's health and you get a **two minute**
clock for it alone.

**You have to beat it.** Win and the worm bows to you: a mount you ride like a Fremen. It behaves
exactly like the one you fought — when you are not on it, it **burrows where you left it** and waits
underground, leaving a mound of churned earth and frost shards on the surface.

**Jump twice** to thump the ground and it tunnels over and erupts beside you. Press **Y** to climb
on (that calls it too, if it is still underground, and puts you on the moment it surfaces). You
stand on its back with its maw out in front of you. Riding is nearly twice as fast, you sit high
above the crops, and **E** breathes a 12m cone of frost instead of firing your weapon. Press **Y**
again to hop down, and it digs itself back in on the spot. Leave it up too long without riding and
it burrows again on its own.

It never hatches from an egg — reaching wave 20 and beating it is the only way to get one.

Lose to it and you get nothing: the run freezes, the Level is *not* cleared, and you start the
twenty waves again next time. Beat it on a later run and your own wyrm **gains a level** — each
one is +55% breath damage, forever. The lair closes for 20 minutes after a clear (8 minutes if you
froze out or left early), and raids, thieves and drake lures are all paused while you're
underground — your garden keeps growing, and your pets come down with you.

The deep waves need serious firepower, so Garden Mastery now has **Venom Tips**: +30% weapon and
turret damage per level, forever.

### 🏡 Decorations

A **Garden** tab of things to place wherever you like on the grass: fence panels, stone paths,
lanterns, topiary, a bird bath, a lawn gnome, a golden statue and a rose arch. Pick one, aim at
the ground and press `E`; the shovel picks them back up. **Lanterns and flood lamps light up
after dark**, so a well-decorated garden actually looks like something at night.

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
| 🌕 Harvest Moon | 1.6× | Night only — a huge orange moon and **26× variant luck** |
| 🌌 Aurora | 1.4× | Night only — shimmering curtains, Chilled and Celestial crops |
| 🌝 MEGA Moon | 1.3× | Night only — **22× the chance of a MEGA crop** |
| 🔴 Blood Moon | 1.2× | Night only — a red sky, and bug raids come twice as often |

### 🧬 Mutations — the thing worth bragging about

A crop rolls its mutation the moment it finishes ripening, so you *see* what you got before you
pick it. Gold plates the whole plant, Rainbow cycles through every colour, and the weather marks
make it glow.

**MEGA**: a rare roll that grows the crop to more than twice its size and multiplies its value
**15×**. It stacks with everything, and a MEGA Moon makes it 22× more likely.

**Variants** (one at a time): Silver **5×** · Gold **20×** · Rainbow **50×**
**Weather marks** (one at a time): Wet **2×** · Chilled **2×** · Frozen **10×** · Shocked **50×** · Celestial **120×**

They **multiply together**, and on top of your Golden Seed bonus. A Rainbow Shocked crop in a
thunderstorm is **2,500×** its normal price; a Rainbow Celestial in a meteor shower is **6,000×**.
A plain tomato sells for ₪180. A Rainbow Shocked one sells for ₪450,000.

### 🐾 Pets

Buy an egg, keep gardening, and it hatches on its own into one of eleven companions (a twelfth,
the Frost Wyrm, is won rather than hatched). **Keep as
many out as you like** — they wander your garden on their own rather than trailing behind you,
so you can actually watch them potter about. Press `C` to whistle and they all come running.

**Feed them.** Hold any seed and press `T` next to a pet to give it a treat. The rarer the seed,
the happier it gets: a carrot is +6, a SUPERFRUIT seed is +80 out of 100. A happy pet moves
faster, learns faster, and works **up to 60% harder** at its ability — and happiness ebbs away
slowly, so it's worth topping up. It's also a good use for the drawer full of common seeds.

Pets level up just by being out, and every level makes their ability stronger.

The **Gnome Hound** is the odd one out: instead of helping the garden it works against it a
little, calling a crop-stealing Garden Gnome out of the hedgerow every couple of minutes at
level 1 (faster with more hounds and higher levels, with no ceiling). That's the point — gnomes
are the only way to find the **Ice Lair**, and the only way to reopen it early. The moment a
gnome turns and runs, every hound you own drops what it's doing and tears after him, barking,
so you can find him just by watching the dog.

| Pet | Tier | Does |
| --- | --- | --- |
| Garden Snail | Common | Growth speed |
| Ladybug | Common | Chews through nearby bugs |
| Honey Bee | Uncommon | Mutation luck |
| Bunny | Rare | Auto-picks ripe crops near you |
| Barn Cat | Rare | Crop value |
| Fox | Legendary | Auto-picks, wider |
| Gnome Hound | Legendary | **Barks gnomes in** and chases them home — your ride to the Ice Lair |
| Wise Owl | Mythic | Mutation luck ++ |
| Baby Drake | Prismatic | **Roars bugs in** — feeds your carnivores |
| Phoenix Chick | Transcendent | Crop value +++ |
| Star Sprite | SUPER | Mutation luck ×5.5 per level |
| Frost Wyrm | CARNIVORE | A frost sandworm you **ride** — press Y. Not from an egg: beat wave 20 of the Ice Lair |

A level-10 Star Sprite multiplies your mutation luck by 46 — Rainbow crops stop being a
once-a-week event.

### ⬆ Garden Mastery

Six permanent upgrades with **no level cap**, so sheckles always have somewhere to go: growth
speed, crop value, mutation luck, bug bounty, Golden Seed gain and weapon damage. Costs roughly double each
level, running from millions into the sextillions. They survive a Golden Harvest.

### 📋 Daily quests

Three fresh jobs every day — harvest crops, plant seeds, squash bugs, catch thieves, feed pets,
open packs, feed carnivores, find mutations — sized to how far along your garden is and paid in
sheckles scaled to your wealth. Play on consecutive days and a **streak** adds +10% per day to
every reward. They reset at midnight.

### 🎩 Wardrobe

Eight hats and eight outfits for the gardener, from a ball cap to a wizard hat. Most are bought
with sheckles; the **Golden Crown**, **Halo** and **Solid Gold** outfit are earned by trophies
instead.

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

Thirty-two goals with rewards paid the instant you finish them — harvest counts, land, species
discovered, bugs squashed, MEGA bugs beaten, thieves caught, the Ice Lair found and cleared, and Golden
Harvests done. The **Trophies** tab shows a progress bar for every one still open.

### 💀 MEGA bugs

Every fourth raid sends a boss instead of a swarm: one enormous horned bug with 45× the health,
its own health bar across the top of the screen, and a bounty 70× the usual. Beating your first
one is a trophy; beating ten is a much bigger one.

### 🦂 Bugs that fight back

Three species don't just chew — they attack, and each one needs a different answer:

| Bug | Level | How it fights |
| --- | --- | --- |
| Jump Spider | 3 | Winds up and **pounces** on you from 11m away — costs 6 seconds in the lair |
| Sand Scorpion | 4 | Walks right up and **stings** with its tail — the biggest hit at 9 seconds |
| Acid Spitter | 5 | Hangs back at 10m and **spits acid globs** — small hits, but constant, and you have to close the distance |

They turn up in ordinary raids too, and their MEGA versions headline the Ice Lair waves.

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

### 🔧 Upgrading weapons

Every weapon you own can be upgraded in the **Tools** tab, forever. Each level is **+30% damage**
for a cost that climbs 2.35× a level, so the Bug Swatter you bought for ₪2,000 can still be doing
useful damage a thousand levels into the Ice Lair. Upgrades are per weapon and are saved.

Garden Mastery's **Venom Tips** stacks on top of that, adding +30% to weapons *and* turrets per
level.

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

### 🛒 Stock and the night market

The seed shop **restocks every five minutes**, and the rarer a seed, the less likely it is to be
on the shelf when it does: commons are always in, rares about six times in ten, legendaries four,
transcendents one in ten and SUPER or CARNIVORE seeds almost never — by day. **After dark the
night market opens**: the shelf turns over the moment night falls, SUPER and CARNIVORE seeds are
**guaranteed in stock every night**, and every other tier is far more likely to be too. The
Seeds tab shows a live restock countdown and how many of each seed are left. The carrot is never
out of stock, and a seed you've just found in a pack goes straight on the shelf.

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
