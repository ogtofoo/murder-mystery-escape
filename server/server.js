// Murder Mystery Escape — game server.
// Serves the static client and runs authoritative multiplayer game rooms:
// procedural maps, roles (crew/imposter/medic/engineer/trickster), staged
// room-by-room progression with locked doors, key/code collectables,
// meetings & votes, win conditions, points, and AI bots.

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import {
  TICK_RATE, PLAYER_SPEED, PLAYER_RADIUS, KILL_RANGE, KILL_COOLDOWN,
  REPORT_RANGE, INTERACT_RANGE, MEETING_TIME,
  MEETING_COOLDOWN, COUNTDOWN_TIME, MIN_PLAYERS, MAX_PLAYERS, ESCAPE_HOLD,
  imposterCount, POINTS, CHARACTERS, ABILITIES, MAX_EQUIPPED_ABILITIES, BOT_NAMES,
  CREW_ALIGNED, MEDIC_REVIVES, MEDIC_REVIVE_COOLDOWN, rollSpecialRoles, THEMES,
} from '../shared/constants.js';
import { generateMap, nearestWaypoint, collideWithWalls } from '../shared/mapgen.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Static file server

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

const httpServer = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const base = urlPath.startsWith('/shared/') ? ROOT : path.join(ROOT, 'public');
  const file = path.normalize(path.join(base, urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------------------------------------------------------------------------
// Helpers

const rooms = new Map(); // code -> Room
let nextId = 1;

const now = () => Date.now() / 1000;
const dist = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
const distP = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

// BFS over the map's waypoint graph.
function buildAdjacency(map) {
  const adj = {};
  for (const id of Object.keys(map.waypoints)) adj[id] = [];
  for (const [a, b] of map.waypointEdges) {
    if (adj[a] && adj[b]) { adj[a].push(b); adj[b].push(a); }
  }
  return adj;
}

function wpPath(adj, from, to) {
  if (from === to) return [to];
  const prev = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const nb of adj[cur] || []) {
      if (nb in prev) continue;
      prev[nb] = cur;
      if (nb === to) {
        const out = [nb];
        let p = cur;
        while (p) { out.unshift(p); p = prev[p]; }
        return out;
      }
      queue.push(nb);
    }
  }
  return [to];
}

// ---------------------------------------------------------------------------

class Room {
  constructor() {
    this.code = makeCode();
    this.players = new Map();
    this.state = 'lobby';     // lobby | countdown | playing | meeting | over
    this.hostId = null;
    this.themeId = 'random';
    this.map = null;
    this.adj = null;
    this.bodies = [];
    this.openDoors = new Set();
    this.doorProgress = {};   // doorId -> {done, total}
    this.carrying = {};       // collectableId -> playerId (null = on the ground)
    this.delivered = new Set(); // collectable ids handed to the exit terminal
    this.blackoutUntil = 0;
    this.meetingAvailableAt = 0;
    this.timeLimit = 720;
    this.startedAt = 0;
    this.countdownEndsAt = 0;
    this.meeting = null;
    rooms.set(this.code, this);
  }

  humans() { return [...this.players.values()].filter(p => !p.isBot); }
  alive() { return [...this.players.values()].filter(p => p.alive && !p.escaped); }
  aliveCrew() { return this.alive().filter(p => CREW_ALIGNED.includes(p.role)); }
  aliveImposters() { return this.alive().filter(p => p.role === 'imposter'); }

  broadcast(msg, filter) {
    const data = JSON.stringify(msg);
    for (const p of this.players.values()) {
      if (p.isBot || p.ws?.readyState !== 1) continue;
      if (filter && !filter(p)) continue;
      p.ws.send(data);
    }
  }

  send(p, msg) {
    if (!p.isBot && p.ws?.readyState === 1) p.ws.send(JSON.stringify(msg));
  }

  lobbyState() {
    return {
      t: 'roomState', code: this.code, state: this.state, themeId: this.themeId,
      players: [...this.players.values()].map(p => ({
        id: p.id, name: p.name, charId: p.charId, isBot: p.isBot, host: p.id === this.hostId,
      })),
    };
  }

  addPlayer(p) {
    this.players.set(p.id, p);
    if (!this.hostId || !this.players.has(this.hostId)) this.hostId = p.id;
    p.room = this;
    this.broadcast(this.lobbyState());
  }

  addBot() {
    if (this.players.size >= MAX_PLAYERS) return;
    const used = new Set([...this.players.values()].map(p => p.name));
    const name = BOT_NAMES.find(n => !used.has(n)) || `Bot${nextId}`;
    const bot = newPlayer(null, name);
    bot.isBot = true;
    bot.charId = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id;
    this.addPlayer(bot);
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    p.room = null;
    // Drop anything they were carrying where they stood.
    for (const [cid, holder] of Object.entries(this.carrying)) {
      if (holder === id) this.dropCollectable(cid, p.pos);
    }
    if (this.state === 'playing' || this.state === 'meeting') {
      if (this.meeting) this.meeting.votes.delete(id);
      this.checkWin();
      if (this.state === 'meeting') this.checkMeetingDone();
    }
    if (this.humans().length === 0) { rooms.delete(this.code); return; }
    if (id === this.hostId) this.hostId = this.humans()[0]?.id ?? null;
    this.broadcast(this.lobbyState());
  }

  // ---- match lifecycle ----

  startCountdown() {
    if (this.state !== 'lobby') return;
    while (this.players.size < MIN_PLAYERS) this.addBot();
    this.state = 'countdown';
    this.countdownEndsAt = now() + COUNTDOWN_TIME;
    this.broadcast({ t: 'countdown', seconds: COUNTDOWN_TIME });
  }

  assignRoles(all) {
    const nImp = imposterCount(all.length);
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    for (const p of shuffled) p.role = 'crew';
    let i = 0;
    for (; i < nImp; i++) shuffled[i].role = 'imposter';
    const specials = rollSpecialRoles(all.length);
    if (specials.trickster && i < shuffled.length) shuffled[i++].role = 'trickster';
    if (specials.medic && i < shuffled.length) shuffled[i++].role = 'medic';
    if (specials.engineer && i < shuffled.length) shuffled[i++].role = 'engineer';
    return shuffled.slice(0, nImp).map(p => p.id);
  }

  startGame() {
    this.state = 'playing';
    this.startedAt = now();

    // ---- procedural map ----
    const themeId = this.themeId === 'random'
      ? THEMES[Math.floor(Math.random() * THEMES.length)].id
      : this.themeId;
    const seed = Math.floor(Math.random() * 0x7fffffff);
    this.map = generateMap(seed, themeId);
    this.adj = buildAdjacency(this.map);
    this.openDoors = new Set();
    this.delivered = new Set();
    this.carrying = {};
    this.bodies = [];
    this.blackoutUntil = 0;
    this.meetingAvailableAt = now() + MEETING_COOLDOWN;
    this.meeting = null;

    // Collectables start on the ground in their rooms.
    this.collectPos = {};
    for (const c of this.map.collectables) this.collectPos[c.id] = { x: c.x, z: c.z };

    const all = [...this.players.values()];
    const imposterIds = this.assignRoles(all);

    // ---- door unlock requirements ----
    // Each door needs a set of stations completed by ANY players (co-op!).
    this.doorStations = {};
    for (const door of this.map.doors) {
      if (!door.needs.stations) continue;
      const group = door.needs.stations;
      const part = door.needs.part;
      const ids = this.map.stations
        .filter(s => s.group === group && (part === undefined || s.part === part))
        .map(s => s.id);
      this.doorStations[door.id] = new Set(ids);
    }
    this.stationDone = new Set();      // globally completed stations
    this.stationBy = {};               // stationId -> playerId (for scoring)

    const spawns = [...this.map.spawnPoints].sort(() => Math.random() - 0.5);
    all.forEach((p, i) => {
      const s = spawns[i % spawns.length];
      Object.assign(p, {
        pos: { x: s.x, z: s.z }, yaw: 0, anim: 0,
        alive: true, escaped: false,
        killReadyAt: now() + KILL_COOLDOWN / 2,
        reviveReadyAt: 0,
        revivesLeft: p.role === 'medic' ? MEDIC_REVIVES : 0,
        invisibleUntil: 0, speedUntil: 0, disguiseCharId: null, disguiseUntil: 0,
        escapeEnteredAt: 0,
        stats: { tasks: 0, kills: 0, revives: 0, escaped: false, correctVote: false },
        abilityState: {},
      });
      for (const ab of p.equippedAbilities) {
        const def = ABILITIES.find(a => a.id === ab);
        if (def) p.abilityState[ab] = { uses: def.uses, readyAt: 0 };
      }
      if (p.isBot) p.bot = { path: [], target: null, mode: 'task', workUntil: 0, fleeing: false };
    });

    for (const p of all) {
      this.send(p, {
        t: 'gameStart',
        role: p.role,
        seed, themeId,
        imposterIds: p.role === 'imposter' ? imposterIds : [],
        revives: p.revivesLeft,
        timeLimit: this.timeLimit,
        players: all.map(q => ({ id: q.id, name: q.name, charId: q.charId })),
      });
    }
    this.broadcastObjectives();
  }

  // The shared objective state everyone can see (co-op progress).
  objectiveState() {
    const doors = this.map.doors.map(d => {
      const req = this.doorStations[d.id];
      const done = req ? [...req].filter(id => this.stationDone.has(id)).length : 0;
      return {
        id: d.id, name: d.name, open: this.openDoors.has(d.id), final: !!d.final,
        done, total: req ? req.size : 0,
        needsKey: !!d.needs.key, needsCode: !!d.needs.code,
      };
    });
    return {
      t: 'objectives', doors,
      stationsDone: [...this.stationDone],
      carrying: this.carrying,
      collectPos: this.collectPos,
      delivered: [...this.delivered],
    };
  }

  broadcastObjectives() { this.broadcast(this.objectiveState()); }

  // ---- stations & doors ----

  completeStation(p, stationId) {
    if (this.state !== 'playing' || p.escaped) return;
    const st = this.map.stations.find(s => s.id === stationId);
    if (!st || this.stationDone.has(stationId)) return;
    if (distP(st, p.pos) > INTERACT_RANGE * 2.5) return;
    // The station's room must be reachable (its door open, or it's the start).
    this.stationDone.add(stationId);
    this.stationBy[stationId] = p.id;
    p.stats.tasks++;
    // Engineers are twice as effective: their completion also credits a
    // random unfinished station in the same group.
    if (p.role === 'engineer') {
      const sameGroup = this.map.stations.filter(s =>
        s.group === st.group && s.part === st.part && !this.stationDone.has(s.id));
      if (sameGroup.length) {
        const bonus = sameGroup[Math.floor(Math.random() * sameGroup.length)];
        this.stationDone.add(bonus.id);
        this.stationBy[bonus.id] = p.id;
        this.broadcast({ t: 'engineerBonus', playerId: p.id, stationId: bonus.id });
      }
    }
    this.checkDoors();
    this.broadcastObjectives();
  }

  checkDoors() {
    for (const door of this.map.doors) {
      if (this.openDoors.has(door.id)) continue;
      let ok = true;
      const req = this.doorStations[door.id];
      if (req) ok = [...req].every(id => this.stationDone.has(id));
      if (door.needs.key) ok = ok && this.delivered.has('key');
      if (door.needs.code) ok = ok && this.delivered.has('code');
      if (ok) {
        this.openDoors.add(door.id);
        this.broadcast({ t: 'doorOpen', doorId: door.id, name: door.name, final: !!door.final });
      }
    }
  }

  // ---- collectables (key & code) ----

  pickUp(p, collectableId) {
    if (this.state !== 'playing' || !p.alive || p.escaped) return;
    if (this.carrying[collectableId] || this.delivered.has(collectableId)) return;
    const pos = this.collectPos[collectableId];
    if (!pos || distP(pos, p.pos) > INTERACT_RANGE * 2) return;
    // One item at a time, so the team must split the work.
    for (const [cid, holder] of Object.entries(this.carrying)) {
      if (holder === p.id) return;
    }
    this.carrying[collectableId] = p.id;
    this.broadcast({ t: 'pickup', collectableId, playerId: p.id });
    this.broadcastObjectives();
  }

  dropCollectable(collectableId, pos) {
    if (!this.carrying[collectableId]) return;
    delete this.carrying[collectableId];
    this.collectPos[collectableId] = { x: pos.x, z: pos.z };
    this.broadcast({ t: 'drop', collectableId, x: pos.x, z: pos.z });
    this.broadcastObjectives();
  }

  deliver(p) {
    if (this.state !== 'playing' || !p.alive || p.escaped) return;
    const term = this.map.exitTerminal;
    if (distP(term, p.pos) > INTERACT_RANGE * 2) return;
    let any = false;
    for (const [cid, holder] of Object.entries(this.carrying)) {
      if (holder !== p.id) continue;
      delete this.carrying[cid];
      this.delivered.add(cid);
      delete this.collectPos[cid];
      any = true;
      this.broadcast({ t: 'delivered', collectableId: cid, playerId: p.id });
    }
    if (any) { this.checkDoors(); this.broadcastObjectives(); }
  }

  // ---- combat ----

  tryKill(killer, target) {
    if (this.state !== 'playing') return;
    if (!killer || killer.role !== 'imposter' || !killer.alive || killer.escaped) return;
    if (!target || !target.alive || target.escaped || target.role === 'imposter') return;
    if (now() < killer.killReadyAt) return;
    if (dist(killer, target) > KILL_RANGE * 1.6) return;
    killer.killReadyAt = now() + KILL_COOLDOWN;
    killer.stats.kills++;
    target.alive = false;
    this.bodies.push({ id: target.id, x: target.pos.x, z: target.pos.z, charId: target.charId });
    // Drop whatever the victim carried.
    for (const [cid, holder] of Object.entries(this.carrying)) {
      if (holder === target.id) this.dropCollectable(cid, target.pos);
    }
    killer.pos = { x: target.pos.x, z: target.pos.z };
    this.broadcast({ t: 'killed', victimId: target.id, killerId: killer.id, x: target.pos.x, z: target.pos.z });
    this.checkWin();
  }

  tryRevive(medic, bodyId) {
    if (this.state !== 'playing' || medic.role !== 'medic') return;
    if (!medic.alive || medic.escaped || medic.revivesLeft <= 0) return;
    if (now() < medic.reviveReadyAt) return;
    const body = this.bodies.find(b => b.id === bodyId);
    if (!body || distP(body, medic.pos) > REPORT_RANGE * 1.5) return;
    const victim = this.players.get(bodyId);
    if (!victim || victim.alive) return;
    medic.revivesLeft--;
    medic.reviveReadyAt = now() + MEDIC_REVIVE_COOLDOWN;
    medic.stats.revives++;
    victim.alive = true;
    victim.pos = { x: body.x, z: body.z };
    this.bodies = this.bodies.filter(b => b.id !== bodyId);
    this.broadcast({ t: 'revived', playerId: bodyId, byId: medic.id, revivesLeft: medic.revivesLeft });
    this.send(medic, { t: 'reviveCount', left: medic.revivesLeft });
  }

  // ---- meetings ----

  startMeeting(reporter, bodyId = null) {
    if (this.state !== 'playing') return;
    if (!reporter.alive || reporter.escaped) return;
    if (bodyId === null && now() < this.meetingAvailableAt) return;
    this.state = 'meeting';
    this.bodies = [];
    this.meeting = { endsAt: now() + MEETING_TIME, votes: new Map() };
    const spawns = [...this.map.spawnPoints];
    // Regroup at the hub (or start room if the first door is still shut).
    const hub = this.map.rooms.find(r => r.kind === (this.openDoors.has('doorA') ? 'hub' : 'start'));
    let i = 0;
    for (const p of this.players.values()) {
      if (p.alive && !p.escaped) {
        const ang = (i++ / Math.max(1, this.players.size)) * Math.PI * 2;
        p.pos = { x: hub.x + Math.cos(ang) * (hub.w / 5), z: hub.z + Math.sin(ang) * (hub.d / 5) };
        p.escapeEnteredAt = 0;
      }
      p.invisibleUntil = 0; p.disguiseUntil = 0; p.speedUntil = 0;
    }
    this.blackoutUntil = 0;
    this.broadcast({
      t: 'meeting', reporterId: reporter.id, bodyId, endsAt: MEETING_TIME,
      alive: this.alive().map(p => p.id),
      dead: [...this.players.values()].filter(p => !p.alive).map(p => p.id),
    });
    for (const p of this.players.values()) {
      if (p.isBot && p.alive && !p.escaped) {
        p.bot.voteAt = now() + 5 + Math.random() * (MEETING_TIME - 12);
      }
    }
  }

  castVote(voter, targetId) {
    if (this.state !== 'meeting' || !voter.alive || voter.escaped) return;
    if (this.meeting.votes.has(voter.id)) return;
    const target = this.players.get(targetId);
    const valid = targetId === 'skip' || (target?.alive && !target?.escaped);
    if (!valid) return;
    this.meeting.votes.set(voter.id, targetId);
    this.broadcast({ t: 'voteUpdate', voted: [...this.meeting.votes.keys()] });
    this.checkMeetingDone();
  }

  checkMeetingDone() {
    if (this.state !== 'meeting') return;
    if (this.meeting.votes.size >= this.alive().length) this.endMeeting();
  }

  endMeeting() {
    const counts = new Map();
    for (const t of this.meeting.votes.values()) counts.set(t, (counts.get(t) || 0) + 1);
    let ejectedId = null, best = 0, tie = false;
    for (const [t, c] of counts) {
      if (t === 'skip') continue;
      if (c > best) { best = c; ejectedId = t; tie = false; }
      else if (c === best) tie = true;
    }
    if (tie || best === 0 || (counts.get('skip') || 0) >= best) ejectedId = null;

    let ejectedRole = null;
    if (ejectedId) {
      const ejected = this.players.get(ejectedId);
      ejected.alive = false;
      ejectedRole = ejected.role;
      if (ejectedRole === 'imposter') {
        for (const [voterId, t] of this.meeting.votes) {
          if (t === ejectedId) {
            const v = this.players.get(voterId);
            if (v) v.stats.correctVote = true;
          }
        }
      }
    }
    this.broadcast({
      t: 'meetingEnd', ejectedId, ejectedRole,
      wasImposter: ejectedRole === 'imposter',
      votes: Object.fromEntries(this.meeting.votes),
    });
    this.meeting = null;
    this.state = 'playing';
    this.meetingAvailableAt = now() + MEETING_COOLDOWN;
    for (const p of this.players.values()) {
      if (p.role === 'imposter') p.killReadyAt = now() + KILL_COOLDOWN / 2;
      if (p.isBot) p.bot.path = [];
    }

    // TRICKSTER: voted out = they win, everyone else loses.
    if (ejectedRole === 'trickster') {
      const trick = this.players.get(ejectedId);
      return this.gameOver('trickster', `${trick.name} was the Trickster — they wanted to be ejected!`, ejectedId);
    }
    this.checkWin();
  }

  // ---- abilities ----

  useAbility(p, abilityId) {
    if (this.state !== 'playing' || p.role !== 'imposter' || !p.alive || p.escaped) return;
    const st = p.abilityState[abilityId];
    const def = ABILITIES.find(a => a.id === abilityId);
    if (!st || !def || st.uses <= 0 || now() < st.readyAt) return;
    st.uses--;
    st.readyAt = now() + def.cooldown;
    const t = now();
    let extra = {};
    if (abilityId === 'sprint') p.speedUntil = t + def.duration;
    else if (abilityId === 'invis') p.invisibleUntil = t + def.duration;
    else if (abilityId === 'blackout') this.blackoutUntil = t + def.duration;
    else if (abilityId === 'disguise') {
      const targets = this.alive().filter(q => q.id !== p.id && q.role !== 'imposter');
      const pk = targets[Math.floor(Math.random() * targets.length)];
      p.disguiseCharId = pk ? pk.charId : p.charId;
      p.disguiseUntil = t + def.duration;
      extra = { charId: p.disguiseCharId };
    }
    this.broadcast({ t: 'abilityFx', playerId: p.id, abilityId, duration: def.duration, uses: st.uses, ...extra });
  }

  // ---- win conditions ----

  checkWin() {
    if (this.state !== 'playing' && this.state !== 'meeting') return;
    const imps = this.aliveImposters().length;
    const crew = this.aliveCrew().length;
    const crewTotal = [...this.players.values()].filter(p => CREW_ALIGNED.includes(p.role));
    const allCrewOut = crewTotal.length > 0 && crewTotal.every(p => !p.alive || p.escaped);
    const someEscaped = crewTotal.some(p => p.escaped);
    const finalOpen = this.openDoors.has('doorX');

    if (imps === 0) return this.gameOver('crew', 'All imposters were ejected!');
    if (allCrewOut && someEscaped) return this.gameOver('crew', 'The crew escaped!');
    if (crew === 0) return this.gameOver('imposters', 'The imposters eliminated the crew…');
    // Parity only ends it while the exit is still sealed — once it's open the
    // endgame is a chase and the survivors can still make a run for it.
    if (imps >= crew && !finalOpen && this.state === 'playing') {
      return this.gameOver('imposters', 'The imposters outnumber the crew…');
    }
  }

  gameOver(winner, reason, tricksterId = null) {
    this.state = 'over';
    const pointsById = {};
    for (const p of this.players.values()) {
      let pts = POINTS.PARTICIPATE;
      pts += p.stats.tasks * POINTS.TASK;
      pts += p.stats.kills * POINTS.KILL;
      pts += p.stats.revives * POINTS.REVIVE;
      if (p.stats.escaped) pts += POINTS.ESCAPE;
      if (p.stats.correctVote) pts += POINTS.EJECT_IMPOSTER_VOTE;
      if (winner === 'crew' && CREW_ALIGNED.includes(p.role)) pts += POINTS.WIN_CREW;
      if (winner === 'imposters' && p.role === 'imposter') pts += POINTS.WIN_IMPOSTER;
      if (winner === 'trickster' && p.id === tricksterId) pts += POINTS.WIN_TRICKSTER;
      pointsById[p.id] = pts;
    }
    this.broadcast({
      t: 'gameOver', winner, reason, tricksterId,
      roles: Object.fromEntries([...this.players.values()].map(p => [p.id, p.role])),
      imposterIds: [...this.players.values()].filter(p => p.role === 'imposter').map(p => p.id),
      points: pointsById,
      stats: Object.fromEntries([...this.players.values()].map(p => [p.id, p.stats])),
    });
    setTimeout(() => {
      if (this.state !== 'over') return;
      this.state = 'lobby';
      this.broadcast(this.lobbyState());
    }, 12000);
  }

  // ---- per-tick ----

  tick(dt) {
    const t = now();
    if (this.state === 'countdown' && t >= this.countdownEndsAt) this.startGame();
    if (this.state === 'meeting' && t >= this.meeting.endsAt) this.endMeeting();

    if (this.state === 'playing') {
      if (t - this.startedAt > this.timeLimit) {
        return this.gameOver('imposters', 'Time ran out — lockdown!');
      }
      this.updateBots(dt, t);
      // Carried collectables follow their holder.
      for (const [cid, holder] of Object.entries(this.carrying)) {
        const p = this.players.get(holder);
        if (p) this.collectPos[cid] = { x: p.pos.x, z: p.pos.z };
      }
      // Escape zone (only reachable once the final door is open)
      if (this.openDoors.has('doorX')) {
        const z = this.map.escapeZone;
        for (const p of this.players.values()) {
          if (!p.alive || p.escaped || !CREW_ALIGNED.includes(p.role)) continue;
          if (distP(z, p.pos) < z.r) {
            if (!p.escapeEnteredAt) p.escapeEnteredAt = t;
            if (t - p.escapeEnteredAt >= ESCAPE_HOLD) {
              p.escaped = true;
              p.stats.escaped = true;
              this.broadcast({ t: 'escaped', playerId: p.id });
              this.checkWin();
            }
          } else p.escapeEnteredAt = 0;
        }
      }
    }

    if (this.state === 'playing' || this.state === 'meeting' || this.state === 'countdown') {
      const snap = [];
      for (const p of this.players.values()) {
        if (!p.alive || p.escaped) continue;
        const invis = t < p.invisibleUntil;
        const disguise = t < p.disguiseUntil ? p.disguiseCharId : null;
        snap.push([p.id, +p.pos.x.toFixed(2), +p.pos.z.toFixed(2), +p.yaw.toFixed(2), p.anim, invis ? 1 : 0, disguise]);
      }
      this.broadcast({
        t: 'snap', p: snap,
        blackout: t < this.blackoutUntil,
        bodies: this.bodies,
        collectPos: this.collectPos,
        left: this.startedAt ? Math.max(0, Math.round(this.timeLimit - (t - this.startedAt))) : 0,
      });
    }
  }

  // Which rooms are currently reachable (for bot targeting).
  openRoomIds() {
    const ids = new Set(['start']);
    if (this.openDoors.has('doorA')) ids.add('hub');
    if (this.openDoors.has('doorB')) ids.add('key');
    if (this.openDoors.has('doorC')) ids.add('code');
    if (this.openDoors.has('doorX')) ids.add('exit');
    return ids;
  }

  updateBots(dt, t) {
    const openRooms = this.openRoomIds();
    for (const p of this.players.values()) {
      if (!p.isBot || p.escaped) continue;
      const ghostWorker = !p.alive && CREW_ALIGNED.includes(p.role);
      if (!p.alive && !ghostWorker) continue;
      const bot = p.bot;
      p.anim = 0;
      if (bot.voteAt) bot.voteAt = 0;

      // --- imposter bots hunt nearby prey (but must help in the start room) ---
      if (p.alive && p.role === 'imposter') {
        const canHunt = this.openDoors.has('doorA'); // trapped together at first
        if (canHunt) {
          let prey = null, preyD = Infinity;
          for (const q of this.players.values()) {
            if (!CREW_ALIGNED.includes(q.role) || !q.alive || q.escaped) continue;
            const d = dist(p, q);
            if (d < preyD) { preyD = d; prey = q; }
          }
          if (prey && preyD < 9 && t >= p.killReadyAt) {
            this.moveBotToward(p, prey.pos, dt, 1.02);
            if (dist(p, prey) < KILL_RANGE * 0.9) this.tryKill(p, prey);
            continue;
          }
        }
      }

      // --- crew bots: flee to the exit once it opens ---
      if (p.alive && CREW_ALIGNED.includes(p.role) && this.openDoors.has('doorX') && !bot.fleeing) {
        bot.fleeing = true;
        bot.workUntil = 0;
        bot.path = this.pathTo(p, 'exit').concat([{ x: this.map.escapeZone.x, z: this.map.escapeZone.z }]);
      }

      if (bot.workUntil > t) continue;

      if (!bot.path?.length) {
        if (bot.fleeing) continue;
        const goal = this.pickBotGoal(p, openRooms);
        if (!goal) continue;
        bot.goal = goal;
        bot.path = this.pathTo(p, goal.wp).concat([{ x: goal.x, z: goal.z }]);
      }

      const target = bot.path[0];
      if (distP(target, p.pos) < 1.3) {
        bot.path.shift();
        if (!bot.path.length && bot.goal) {
          const goal = bot.goal;
          bot.workUntil = t + 4 + Math.random() * 5;
          if (goal.kind === 'station') {
            const sid = goal.id;
            setTimeout(() => {
              if (this.state === 'playing' && !p.escaped) this.completeStation(p, sid);
            }, 4000);
          } else if (goal.kind === 'collect' && p.alive) {
            setTimeout(() => {
              if (this.state === 'playing' && p.alive) {
                this.pickUp(p, goal.id);
                // then carry it to the terminal
                p.bot.goal = { kind: 'deliver', wp: 'hubN', ...this.map.exitTerminal };
                p.bot.path = this.pathTo(p, 'hubN').concat([{ ...this.map.exitTerminal }]);
                p.bot.workUntil = 0;
              }
            }, 2500);
          } else if (goal.kind === 'deliver' && p.alive) {
            setTimeout(() => {
              if (this.state === 'playing' && p.alive) this.deliver(p);
            }, 1500);
          }
          bot.goal = null;
        }
      } else {
        this.moveBotToward(p, target, dt, 0.82);
      }
    }
  }

  // What should this bot do next? Prioritizes the current objective.
  pickBotGoal(p, openRooms) {
    const isCrew = CREW_ALIGNED.includes(p.role) || !p.alive;
    // Carry an uncollected key/code to the terminal (crew only, alive).
    if (isCrew && p.alive && this.openDoors.has('doorA')) {
      const mine = Object.entries(this.carrying).find(([, h]) => h === p.id);
      if (mine) return { kind: 'deliver', wp: 'hubN', ...this.map.exitTerminal };
      for (const c of this.map.collectables) {
        if (this.delivered.has(c.id) || this.carrying[c.id]) continue;
        if (!openRooms.has(c.roomId)) continue;
        const pos = this.collectPos[c.id];
        return { kind: 'collect', id: c.id, wp: c.roomId, x: pos.x, z: pos.z };
      }
    }
    // Otherwise work an unfinished station in a reachable room.
    const todo = this.map.stations.filter(s =>
      !this.stationDone.has(s.id) && openRooms.has(s.roomId));
    if (todo.length) {
      // Imposters fake-work too (keeps them moving and blending in).
      const st = todo[Math.floor(Math.random() * todo.length)];
      return { kind: 'station', id: st.id, wp: `st_${st.id}`, x: st.x, z: st.z };
    }
    // Nothing to do: wander to a random open room.
    const roomIds = [...openRooms];
    const rid = roomIds[Math.floor(Math.random() * roomIds.length)];
    const room = this.map.rooms.find(r => r.id === rid);
    return room ? { kind: 'wander', wp: rid, x: room.x, z: room.z } : null;
  }

  pathTo(p, wpId) {
    const from = nearestWaypoint(this.map, p.pos.x, p.pos.z);
    const ids = wpPath(this.adj, from, wpId);
    return ids.map(id => this.map.waypoints[id]).filter(Boolean);
  }

  moveBotToward(p, target, dt, speedMul) {
    const dx = target.x - p.pos.x, dz = target.z - p.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const sp = PLAYER_SPEED * speedMul * (now() < p.speedUntil ? 1.6 : 1);
    p.pos.x += (dx / d) * sp * dt;
    p.pos.z += (dz / d) * sp * dt;
    p.yaw = Math.atan2(dx, dz);
    p.anim = 1;
    collideWithWalls(this.map, p.pos, PLAYER_RADIUS, this.openDoors);
  }
}

function newPlayer(ws, name) {
  return {
    id: `p${nextId++}`,
    ws, name,
    isBot: false,
    charId: 'sunny',
    equippedAbilities: [],
    room: null,
    pos: { x: 0, z: 0 }, yaw: 0, anim: 0,
    role: 'crew', alive: true, escaped: false,
    killReadyAt: 0, reviveReadyAt: 0, revivesLeft: 0,
    invisibleUntil: 0, speedUntil: 0,
    disguiseCharId: null, disguiseUntil: 0, escapeEnteredAt: 0,
    stats: { tasks: 0, kills: 0, revives: 0, escaped: false, correctVote: false },
    abilityState: {},
  };
}

// ---------------------------------------------------------------------------
// WebSocket handling

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  let player = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    try { handle(msg); } catch (e) { console.error('handler error', e); }
  });

  function handle(msg) {
    if (msg.t === 'hello') {
      const name = String(msg.name || 'Player').slice(0, 14).trim() || 'Player';
      player = newPlayer(ws, name);
      if (CHARACTERS.some(c => c.id === msg.charId)) player.charId = msg.charId;
      if (Array.isArray(msg.abilities)) {
        player.equippedAbilities = msg.abilities
          .filter(id => ABILITIES.some(a => a.id === id))
          .slice(0, MAX_EQUIPPED_ABILITIES);
      }
      ws.send(JSON.stringify({ t: 'welcome', id: player.id }));
      return;
    }
    if (!player) return;
    const room = player.room;

    switch (msg.t) {
      case 'create': {
        if (room) room.removePlayer(player.id);
        new Room().addPlayer(player);
        break;
      }
      case 'join': {
        const target = rooms.get(String(msg.code || '').toUpperCase());
        if (!target) return player.ws.send(JSON.stringify({ t: 'error', msg: 'Room not found.' }));
        if (target.state !== 'lobby') return player.ws.send(JSON.stringify({ t: 'error', msg: 'That game already started.' }));
        if (target.humans().length >= MAX_PLAYERS) {
          return player.ws.send(JSON.stringify({ t: 'error', msg: 'Room is full.' }));
        }
        if (room) room.removePlayer(player.id);
        if (target.players.size >= MAX_PLAYERS) {
          const bot = [...target.players.values()].find(p => p.isBot);
          if (bot) target.removePlayer(bot.id);
        }
        target.addPlayer(player);
        break;
      }
      case 'quickplay': {
        if (room) room.removePlayer(player.id);
        let target = [...rooms.values()].find(r => r.state === 'lobby' && r.players.size < MAX_PLAYERS);
        if (!target) target = new Room();
        target.addPlayer(player);
        break;
      }
      case 'leave': if (room) room.removePlayer(player.id); break;
      case 'setChar': {
        if (CHARACTERS.some(c => c.id === msg.charId)) player.charId = msg.charId;
        if (room && room.state === 'lobby') room.broadcast(room.lobbyState());
        break;
      }
      case 'setAbilities': {
        if (Array.isArray(msg.abilities)) {
          player.equippedAbilities = msg.abilities
            .filter(id => ABILITIES.some(a => a.id === id))
            .slice(0, MAX_EQUIPPED_ABILITIES);
        }
        break;
      }
      case 'setTheme': {
        if (room && player.id === room.hostId && room.state === 'lobby') {
          const id = String(msg.themeId);
          if (id === 'random' || THEMES.some(th => th.id === id)) {
            room.themeId = id;
            room.broadcast(room.lobbyState());
          }
        }
        break;
      }
      case 'addBot': if (room && player.id === room.hostId && room.state === 'lobby') room.addBot(); break;
      case 'start': if (room && player.id === room.hostId) room.startCountdown(); break;
      case 'pos': {
        if (!room || (room.state !== 'playing' && room.state !== 'countdown')) break;
        if (player.escaped) break;
        const x = Number(msg.x), z = Number(msg.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) break;
        const b = room.map?.bounds;
        player.pos.x = b ? Math.max(b.minX, Math.min(b.maxX, x)) : x;
        player.pos.z = b ? Math.max(b.minZ, Math.min(b.maxZ, z)) : z;
        player.yaw = Number(msg.yaw) || 0;
        player.anim = msg.anim ? 1 : 0;
        break;
      }
      case 'taskDone': if (room) room.completeStation(player, String(msg.stationId)); break;
      case 'pickup': if (room) room.pickUp(player, String(msg.collectableId)); break;
      case 'deliver': if (room) room.deliver(player); break;
      case 'kill': if (room) room.tryKill(player, room.players.get(msg.targetId)); break;
      case 'revive': if (room) room.tryRevive(player, String(msg.bodyId)); break;
      case 'report': {
        if (!room || room.state !== 'playing' || !player.alive || player.escaped) break;
        const body = room.bodies.find(b => b.id === msg.bodyId);
        if (body && distP(body, player.pos) < REPORT_RANGE * 1.5) room.startMeeting(player, body.id);
        break;
      }
      case 'button': {
        if (!room || room.state !== 'playing' || !room.map) break;
        const b = room.map.meetingButton;
        if (distP(b, player.pos) < INTERACT_RANGE * 1.5) room.startMeeting(player, null);
        break;
      }
      case 'vote': if (room) room.castVote(player, msg.targetId); break;
      case 'chat': {
        if (!room || room.state !== 'meeting') break;
        const text = String(msg.text || '').slice(0, 120).trim();
        if (text) room.broadcast({ t: 'chat', from: player.id, name: player.name, text });
        break;
      }
      case 'ability': if (room) room.useAbility(player, String(msg.abilityId)); break;
    }
  }

  ws.on('close', () => { if (player?.room) player.room.removePlayer(player.id); });
});

// Bots vote during meetings.
setInterval(() => {
  const t = now();
  for (const room of rooms.values()) {
    if (room.state !== 'meeting') continue;
    for (const p of room.players.values()) {
      if (!p.isBot || !p.alive || p.escaped || !p.bot?.voteAt) continue;
      if (t >= p.bot.voteAt) {
        p.bot.voteAt = 0;
        const options = room.alive().filter(q => q.id !== p.id).map(q => q.id);
        const pick = Math.random() < 0.55 || !options.length
          ? 'skip'
          : options[Math.floor(Math.random() * options.length)];
        room.castVote(p, pick);
      }
    }
  }
}, 500);

let lastTick = now();
setInterval(() => {
  const t = now();
  const dt = Math.min(0.25, t - lastTick);
  lastTick = t;
  for (const room of [...rooms.values()]) room.tick(dt);
}, 1000 / TICK_RATE);

httpServer.listen(PORT, () => {
  console.log(`Murder Mystery Escape server running on http://localhost:${PORT}`);
});
