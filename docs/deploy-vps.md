# Deploying to a cloud VPS

## Picking a host

Bedrock Dedicated Server is an **x86-64 Linux binary**. Mojang does not ship an
ARM build. On ARM hosts the container emulates x86 (see the ARM note at the
bottom), so prefer an **x86-64 / amd64** VPS.

| Host | Plan | Approx. cost | Notes |
|---|---|---|---|
| Hetzner | CX22 (2 vCPU, 4 GB) | ~€4/mo | Cheapest solid option; EU + US regions |
| DigitalOcean | Basic (1 vCPU, 2 GB) | ~$12/mo | Simplest UI |
| Vultr / Linode | 1 vCPU, 2 GB | ~$10–12/mo | Wide region choice |
| Oracle Cloud | Always Free | $0 | Free tier is **Ampere ARM** — emulation applies |

2 GB RAM is enough for a handful of players on a hand-built map. Pick the region
closest to your players; Bedrock is UDP and latency-sensitive.

## Setup

```bash
# 1. On the VPS (Ubuntu 22.04/24.04), install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER" && newgrp docker

# 2. Clone this repo
git clone https://github.com/ogtofoo/murder-mystery-escape.git
cd murder-mystery-escape

# 3. Configure
cp .env.example .env
$EDITOR .env

# 4. Start
docker compose up -d
docker compose logs -f
```

Wait for `Server started.` in the logs — first boot downloads ~100 MB of server
binary from Mojang.

## Open the firewall

Bedrock is **UDP**, not TCP. This is the single most common reason a server
"starts fine but nobody can join".

```bash
sudo ufw allow 19132/udp
sudo ufw allow 19133/udp
```

Also open UDP 19132 in your provider's own firewall / security group — Hetzner,
DigitalOcean, Oracle and AWS all have a separate network-level firewall that
`ufw` does not touch.

Verify from another machine:

```bash
nc -vzu YOUR_SERVER_IP 19132
```

## Connecting

In Minecraft Bedrock: **Play → Servers → Add Server**, name it anything, address
= your VPS IP, port = 19132.

Consoles (Switch/PS/Xbox) cannot enter a custom server address without a DNS
workaround. Windows, iOS, Android and Fire devices can do it natively.

## Lock it down

An open Bedrock server on a public IP will find griefers. Once your group has
connected once, pull their XUIDs out of the logs:

```bash
docker compose logs | grep -i "player connected"
```

Then set `ALLOW_LIST_USERS="Gamertag:XUID,..."` and `ALLOW_LIST=true` in `.env`
and run `docker compose up -d`.

## Backups

```bash
./scripts/backup.sh                       # snapshot to ./backups/
crontab -e                                # then add:
0 4 * * * cd /home/YOU/murder-mystery-escape && ./scripts/backup.sh
```

Copy `backups/` off the VPS periodically — a snapshot on the same disk is not a
backup. `rclone`, `scp`, or committing a milestone `.mcworld` to git all work.

## The ARM note

On ARM64 hosts (Oracle Ampere, Raspberry Pi, Apple Silicon) the image runs the
x86-64 BDS binary under **box64** emulation. It works and people run it daily,
but expect higher CPU use and occasional instability versus native x86. If you
have the choice, use an amd64 host.
