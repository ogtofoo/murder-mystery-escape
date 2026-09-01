# murder-mystery-escape

A Dockerised **Minecraft Bedrock Edition** server for building and playtesting a
murder-mystery escape-room map.

Built on [`itzg/minecraft-bedrock-server`](https://github.com/itzg/docker-minecraft-bedrock-server),
which downloads Mojang's Bedrock Dedicated Server on first boot and keeps it
updated on restart.

## Quick start

```bash
cp .env.example .env     # optional — defaults work as-is
docker compose up -d
docker compose logs -f   # wait for "Server started."
```

Then in Minecraft Bedrock: **Play → Servers → Add Server**

| Field | Value |
|---|---|
| Address | `127.0.0.1` (same machine) or the host's LAN/public IP |
| Port | `19132` |

First boot takes a minute or two while the server binary downloads.

## Where to run it

| | Mac mini M4 (local) | Cloud VPS |
|---|---|---|
| Cost | free | ~$5–12/mo |
| Always on | only while the Mac is awake | yes |
| Reachable by friends | needs router port-forward + dynamic DNS | works out of the box |
| CPU | x86 emulation (see below) | native on an amd64 host |
| Exposes your home IP | yes | no |

**Recommendation:** build the map locally on the Mac mini, and put it on a small
amd64 VPS when you want friends playing without your Mac staying awake. The
compose file is identical either way — only `.env` and the firewall differ.

See [`docs/deploy-vps.md`](docs/deploy-vps.md) for the cloud walkthrough.

### Apple Silicon note

Mojang ships Bedrock Dedicated Server as an **x86-64 Linux binary only**. On an
M4 the image runs it under `box64` emulation inside Docker Desktop's Linux VM.
It works — plenty of people run it on Apple Silicon — but it's emulation on top
of a VM, so expect more CPU churn than a native amd64 host. Fine for building
and small playtests; a $5 amd64 VPS is steadier for a real session.

## Common tasks

A `Makefile` wraps the usual commands:

```bash
make up                                  # start
make logs                                # follow logs
make console                             # interactive BDS console
make cmd C='gamerule showcoordinates true'   # one-off command
make backup                              # snapshot the world
make down                                # stop
```

`make console` attaches to the live server. **Detach with `Ctrl-P` then `Ctrl-Q`** —
`Ctrl-C` would stop the server.

## Build mode vs play mode

`.env.example` ships two profiles. The default is the **building** profile —
creative, peaceful, everyone an operator, flat world, so you can fly around and
lay out rooms.

When you're ready to playtest, switch to the **play** profile (adventure,
normal, players demoted to `member`) and `docker compose up -d`. Adventure mode
is what stops testers from mining straight through a puzzle wall.

Keep `ALLOW_CHEATS=true` in both — command blocks and your own op commands
depend on it.

## Importing an existing map

Drop a `.mcworld`, `.mcaddon`, `.mcpack` or `.zip` into `packs/`, then set in `.env`:

```bash
MC_PACK=/packs/your-map.mcworld
```

and restart. The archive is unpacked into the live world on startup.

Leave `FORCE_WORLD_COPY=false` once you start building — `true` re-copies the
archive over the live world on *every* restart, which silently discards
in-game progress.

## Layout

```
docker-compose.yml    the server
.env.example          every tunable, documented
packs/                drop .mcworld / .mcaddon files here (git-ignored)
data/                 server binary, server.properties, live worlds (git-ignored)
backups/              world snapshots from scripts/backup.sh (git-ignored)
scripts/backup.sh     flush-and-snapshot the world
scripts/restore.sh    restore a snapshot
docs/deploy-vps.md    cloud deployment
```

`data/` is deliberately git-ignored — it's large, machine-specific, and churns
every tick. Use `scripts/backup.sh` for world history, and commit a milestone
`.mcworld` with `git add -f` if you want a version pinned in the repo.

## Backups

```bash
./scripts/backup.sh                          # -> backups/mystery-YYYYmmdd-HHMMSS.tar.gz
./scripts/restore.sh backups/mystery-....tar.gz
```

`backup.sh` issues `save hold` / `save query` / `save resume` to the running
server first, so it captures a consistent world rather than a half-written one.

## Ports

Bedrock uses **UDP**, not TCP — the usual cause of "server starts, nobody can
join". Open `19132/udp` (and `19133/udp` for IPv6) on both the host firewall and
your cloud provider's security group.
