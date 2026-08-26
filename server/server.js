// Murder Mystery Escape — game server.
// Serves the static client and runs authoritative multiplayer game rooms
// (roles, kills, meetings/votes, task progress, escape door, win conditions,
// points, and AI bots that fill empty lobby slots).

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import {
  TICK_RATE, PLAYER_SPEED, PLAYER_RADIUS, KILL_RANGE, KILL_COOLDOWN,
  REPORT_RANGE, INTERACT_RANGE, TASKS_PER_PLAYER, MEETING_TIME,
  MEETING_COOLDOWN, COUNTDOWN_TIME, MIN_PLAYERS, MAX_PLAYERS, ESCAPE_HOLD,
  imposterCount, POINTS, CHARACTERS, ABILITIES, MAX_EQUIPPED_ABILITIES, BOT_NAMES,
} from '../shared/constants.js';
import { MAP, nearestWaypoint, collideWithWalls } from '../shared/map.js';

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
  const file = path.normalize(path.join(base, urlPath.startsWith('/shared/') ? urlPath : urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------------------------------------------------------------------------
// Game rooms

const rooms = new Map(); // code -> Room
let nextId = 1;

const now = () => Date.now() / 1000;
const dist = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

// Precompute waypoint adjacency for bot pathfinding.
const WP_ADJ = {};
for (const id of Object.keys(MAP.waypoints)) WP_ADJ[id] = [];
for (const [a, b] of MAP.waypointEdges) { WP_ADJ[a].push(b); WP_ADJ[b].push(a); }

function wpPath(from, to) {
  if (from === to) return [to];
  const prev = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const nb of WP_ADJ[cur]) {
      if (nb in prev) continue;
      prev[nb] = cur;
      if (nb === to) {
        const path = [nb];
        let p = cur;
        while (p) { path.unshift(p); p = prev[p]; }
        return path;
      }
      queue.push(nb);
    }
  }
  return [to];
}

class Room {
  constructor() {
    this.code = makeCode();
    this.players = new Map(); // id -> player
    this.state = 'lobby';     // lobby | countdown | playing | meeting | over
    this.hostId = null;
    this.bodies = [];         // {id (victim id), x, z, charId}
    this.tasksTotal = 0;
    this.doorOpen = false;
    this.blackoutUntil = 0;
    this.meetingAvailableAt = 0;
    this.timeLimit = 600;
    this.startedAt = 0;
    this.countdownEndsAt = 0;
    this.meeting = null;      // {endsAt, votes: Map voterId->targetId|'skip'}
    rooms.set(this.code, this);
  }

  humans() { return [...this.players.values()].filter(p => !p.isBot); }
  alive() { return [...this.players.values()].filter(p => p.alive && !p.escaped); }
  aliveCrew() { return this.alive().filter(p => p.role === 'crew'); }
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
      t: 'roomState', code: this.code, state: this.state,
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
    if (this.state === 'playing' || this.state === 'meeting') {
      // A quitter counts as dead (no body) for win conditions.
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

  startGame() {
    this.state = 'playing';
    this.startedAt = now();
    this.doorOpen = false;
    this.bodies = [];
    this.blackoutUntil = 0;
    this.meetingAvailableAt = now() + MEETING_COOLDOWN;
    this.meeting = null;

    const all = [...this.players.values()];
    const nImp = imposterCount(all.length);
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    shuffled.forEach((p, i) => { p.role = i < nImp ? 'imposter' : 'crew'; });

    const spawns = [...MAP.spawnPoints].sort(() => Math.random() - 0.5);
    this.tasksTotal = 0;
    all.forEach((p, i) => {
      const s = spawns[i % spawns.length];
      Object.assign(p, {
        pos: { x: s.x, z: s.z }, yaw: 0, anim: 0,
        alive: true, escaped: false, doneTasks: new Set(),
        killReadyAt: now() + KILL_COOLDOWN / 2,
        invisibleUntil: 0, speedUntil: 0, disguiseCharId: null, disguiseUntil: 0,
        escapeEnteredAt: 0, workingUntil: 0,
        stats: { tasks: 0, kills: 0, escaped: false, correctVote: false },
        abilityState: {},
      });
      const stations = [...MAP.stations].sort(() => Math.random() - 0.5);
      p.tasks = stations.slice(0, TASKS_PER_PLAYER).map(s => s.id);
      if (p.role === 'crew') this.tasksTotal += TASKS_PER_PLAYER;
      for (const ab of p.equippedAbilities) {
        const def = ABILITIES.find(a => a.id === ab);
        if (def) p.abilityState[ab] = { uses: def.uses, readyAt: 0 };
      }
      if (p.isBot) p.bot = { path: [], targetStation: null, mode: 'roam', repathAt: 0, workUntil: 0 };
    });

    const imposterIds = shuffled.slice(0, nImp).map(p => p.id);
    for (const p of all) {
      this.send(p, {
        t: 'gameStart',
        role: p.role,
        imposterIds: p.role === 'imposter' ? imposterIds : [],
        tasks: p.tasks,
        tasksTotal: this.tasksTotal,
        timeLimit: this.timeLimit,
        players: [...this.players.values()].map(q => ({ id: q.id, name: q.name, charId: q.charId })),
      });
    }
  }

  taskProgress() {
    let done = 0;
    for (const p of this.players.values()) if (p.role === 'crew') done += p.doneTasks.size;
    return done;
  }

  // Ghosts may still finish their puzzles (otherwise a death could make the
  // door permanently unopenable).
  completeTask(p, stationId) {
    if (this.state !== 'playing' || p.escaped) return;
    if (!p.tasks.includes(stationId) || p.doneTasks.has(stationId)) return;
    const st = MAP.stations.find(s => s.id === stationId);
    if (!st || Math.hypot(st.x - p.pos.x, st.z - p.pos.z) > INTERACT_RANGE * 2.5) return;
    p.doneTasks.add(stationId);
    if (p.role === 'crew') {
      p.stats.tasks++;
      const done = this.taskProgress();
      this.broadcast({ t: 'taskProgress', done, total: this.tasksTotal });
      if (done >= this.tasksTotal && !this.doorOpen) {
        this.doorOpen = true;
        this.broadcast({ t: 'doorOpen' });
      }
    }
  }

  tryKill(killer, target) {
    if (this.state !== 'playing') return;
    if (!killer || killer.role !== 'imposter' || !killer.alive || killer.escaped) return;
    if (!target || !target.alive || target.escaped || target.role === 'imposter') return;
    if (now() < killer.killReadyAt) return;
    if (dist(killer, target) > KILL_RANGE * 1.6) return; // slack for latency
    killer.killReadyAt = now() + KILL_COOLDOWN;
    killer.stats.kills++;
    target.alive = false;
    this.bodies.push({ id: target.id, x: target.pos.x, z: target.pos.z, charId: target.charId });
    killer.pos = { x: target.pos.x, z: target.pos.z };
    this.broadcast({ t: 'killed', victimId: target.id, killerId: killer.id, x: target.pos.x, z: target.pos.z });
    this.checkWin();
  }

  startMeeting(reporter, bodyId = null) {
    if (this.state !== 'playing') return;
    if (!reporter.alive || reporter.escaped) return;
    if (bodyId === null && now() < this.meetingAvailableAt) return;
    this.state = 'meeting';
    this.bodies = [];
    this.meeting = { endsAt: now() + MEETING_TIME, votes: new Map() };
    // Everyone regroups at the hub.
    const spawns = [...MAP.spawnPoints];
    let i = 0;
    for (const p of this.players.values()) {
      if (p.alive && !p.escaped) { p.pos = { ...spawns[i++ % spawns.length] }; p.escapeEnteredAt = 0; }
      p.invisibleUntil = 0; p.disguiseUntil = 0; p.speedUntil = 0;
    }
    this.blackoutUntil = 0;
    this.broadcast({
      t: 'meeting',
      reporterId: reporter.id, bodyId,
      endsAt: MEETING_TIME,
      alive: this.alive().map(p => p.id),
      dead: [...this.players.values()].filter(p => !p.alive).map(p => p.id),
    });
    // Bots vote some seconds in.
    for (const p of this.players.values()) {
      if (p.isBot && p.alive && !p.escaped) {
        p.bot.voteAt = now() + 5 + Math.random() * (MEETING_TIME - 12);
      }
    }
  }

  castVote(voter, targetId) {
    if (this.state !== 'meeting' || !voter.alive || voter.escaped) return;
    if (this.meeting.votes.has(voter.id)) return;
    const valid = targetId === 'skip' ||
      (this.players.get(targetId)?.alive && !this.players.get(targetId)?.escaped);
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

    let wasImposter = null;
    if (ejectedId) {
      const ejected = this.players.get(ejectedId);
      ejected.alive = false;
      wasImposter = ejected.role === 'imposter';
      if (wasImposter) {
        for (const [voterId, t] of this.meeting.votes) {
          if (t === ejectedId) {
            const v = this.players.get(voterId);
            if (v) v.stats.correctVote = true;
          }
        }
      }
    }
    this.broadcast({
      t: 'meetingEnd', ejectedId, wasImposter,
      votes: Object.fromEntries([...this.meeting.votes].map(([k, v]) => [k, v])),
    });
    this.meeting = null;
    this.state = 'playing';
    this.meetingAvailableAt = now() + MEETING_COOLDOWN;
    for (const p of this.players.values()) {
      if (p.role === 'imposter') p.killReadyAt = now() + KILL_COOLDOWN / 2;
      if (p.isBot) p.bot.path = [];
    }
    this.checkWin();
  }

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
      const targets = this.aliveCrew().filter(q => q.id !== p.id);
      const pick = targets[Math.floor(Math.random() * targets.length)];
      p.disguiseCharId = pick ? pick.charId : p.charId;
      p.disguiseUntil = t + def.duration;
      extra = { charId: p.disguiseCharId };
    }
    this.broadcast({ t: 'abilityFx', playerId: p.id, abilityId, duration: def.duration, uses: st.uses, ...extra });
  }

  checkWin() {
    if (this.state !== 'playing' && this.state !== 'meeting') return;
    const imps = this.aliveImposters().length;
    const crew = this.aliveCrew().length;
    const crewTotal = [...this.players.values()].filter(p => p.role === 'crew');
    const allCrewOut = crewTotal.length > 0 && crewTotal.every(p => !p.alive || p.escaped);
    const someEscaped = crewTotal.some(p => p.escaped);

    if (imps === 0) return this.gameOver('crew', 'All imposters were ejected!');
    if (allCrewOut && someEscaped) return this.gameOver('crew', 'The crew escaped the facility!');
    if (crew === 0) return this.gameOver('imposters', 'The imposters eliminated the crew…');
    // Parity only ends the game while the door is closed; once it opens the
    // endgame is a chase — the remaining crew can still make a run for it.
    if (imps >= crew && !this.doorOpen && this.state === 'playing') {
      return this.gameOver('imposters', 'The imposters outnumber the crew…');
    }
  }

  gameOver(winner, reason) {
    this.state = 'over';
    const pointsById = {};
    for (const p of this.players.values()) {
      let pts = POINTS.PARTICIPATE;
      pts += p.stats.tasks * POINTS.TASK;
      pts += p.stats.kills * POINTS.KILL;
      if (p.stats.escaped) pts += POINTS.ESCAPE;
      if (p.stats.correctVote) pts += POINTS.EJECT_IMPOSTER_VOTE;
      if (winner === 'crew' && p.role === 'crew') pts += POINTS.WIN_CREW;
      if (winner === 'imposters' && p.role === 'imposter') pts += POINTS.WIN_IMPOSTER;
      pointsById[p.id] = pts;
    }
    this.broadcast({
      t: 'gameOver', winner, reason,
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

  // ---- per-tick update ----

  tick(dt) {
    const t = now();
    if (this.state === 'countdown' && t >= this.countdownEndsAt) this.startGame();
    if (this.state === 'meeting' && t >= this.meeting.endsAt) this.endMeeting();

    if (this.state === 'playing') {
      if (t - this.startedAt > this.timeLimit) {
        return this.gameOver('imposters', 'Time ran out — the facility went into lockdown…');
      }
      this.updateBots(dt, t);
      // Escape zone check
      const z = MAP.escapeZone;
      for (const p of this.players.values()) {
        if (!p.alive || p.escaped || p.role !== 'crew') continue;
        const inZone = this.doorOpen && Math.hypot(p.pos.x - z.x, p.pos.z - z.z) < z.r;
        if (inZone) {
          if (!p.escapeEnteredAt) p.escapeEnteredAt = t;
          if (t - p.escapeEnteredAt >= ESCAPE_HOLD) {
            p.escaped = true;
            p.stats.escaped = true;
            this.broadcast({ t: 'escaped', playerId: p.id });
            this.checkWin();
          }
        } else {
          p.escapeEnteredAt = 0;
        }
      }
    }

    // Snapshot broadcast
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
        door: this.doorOpen,
        left: this.startedAt ? Math.max(0, Math.round(this.timeLimit - (t - this.startedAt))) : 0,
      });
    }
  }

  updateBots(dt, t) {
    for (const p of this.players.values()) {
      if (!p.isBot || p.escaped) continue;
      // Dead crew bots keep "ghost-working" their puzzles so the door can
      // still open; dead imposter bots are done.
      if (!p.alive && (p.role !== 'crew' || p.doneTasks.size >= p.tasks.length)) continue;
      const bot = p.bot;
      p.anim = 0;

      if (p.isBot && bot.voteAt) bot.voteAt = 0; // clear stale meeting timers in play

      if (p.alive && p.role === 'imposter') {
        // Hunt the nearest visible crew member (bots included).
        let prey = null, preyD = Infinity;
        for (const q of this.players.values()) {
          if (q.role !== 'crew' || !q.alive || q.escaped) continue;
          const d = dist(p, q);
          if (d < preyD) { preyD = d; prey = q; }
        }
        // Opportunistic, not relentless: only chase prey it can "see" nearby.
        const canKill = t >= p.killReadyAt;
        if (prey && preyD < 9 && canKill) {
          this.moveBotToward(p, prey.pos, dt, 1.02);
          if (dist(p, prey) < KILL_RANGE * 0.9) this.tryKill(p, prey);
          continue;
        }
      }

      // Once the escape door opens, crew bots run for the airlock.
      if (this.doorOpen && p.alive && p.role === 'crew' && !bot.fleeing) {
        bot.fleeing = true;
        bot.workUntil = 0;
        const from = nearestWaypoint(p.pos.x, p.pos.z);
        bot.path = wpPath(from, 'airlock').map(id => MAP.waypoints[id]);
        bot.path.push({ x: MAP.escapeZone.x, z: MAP.escapeZone.z });
        bot.targetStation = null;
      }
      // Crew bots (and cooling-down imposters) roam between stations.
      if (bot.workUntil > t) continue; // "doing a task"
      if (!bot.path.length) {
        if (bot.fleeing) continue; // standing in the escape zone, waiting to be lifted out
        // Prefer own unfinished tasks; sometimes wander elsewhere for cover.
        const todo = p.tasks.filter(id => !p.doneTasks.has(id));
        let station;
        if (todo.length && (Math.random() < 0.7 || !p.alive)) {
          const id = todo[Math.floor(Math.random() * todo.length)];
          station = MAP.stations.find(s => s.id === id);
        } else {
          station = MAP.stations[Math.floor(Math.random() * MAP.stations.length)];
        }
        bot.targetStation = station;
        const from = nearestWaypoint(p.pos.x, p.pos.z);
        const to = nearestWaypoint(station.x, station.z);
        bot.path = wpPath(from, to).map(id => MAP.waypoints[id]);
        bot.path.push({ x: station.x, z: station.z });
      }
      const target = bot.path[0];
      if (Math.hypot(target.x - p.pos.x, target.z - p.pos.z) < 1.2) {
        bot.path.shift();
        if (!bot.path.length) {
          // Arrived at the station: crew bots contribute a task.
          bot.workUntil = t + 6 + Math.random() * 6;
          if (p.role === 'crew' && bot.targetStation && p.tasks.includes(bot.targetStation.id)) {
            const sid = bot.targetStation.id;
            setTimeout(() => {
              if (this.state === 'playing' && !p.escaped) this.completeTask(p, sid);
            }, 5000);
          }
        }
      } else {
        this.moveBotToward(p, target, dt, 0.82);
      }
    }
  }

  moveBotToward(p, target, dt, speedMul) {
    const dx = target.x - p.pos.x, dz = target.z - p.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const sp = PLAYER_SPEED * speedMul * (now() < p.speedUntil ? 1.6 : 1);
    p.pos.x += (dx / d) * sp * dt;
    p.pos.z += (dz / d) * sp * dt;
    p.yaw = Math.atan2(dx, dz);
    p.anim = 1;
    collideWithWalls(p.pos, PLAYER_RADIUS, this.doorOpen);
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
    tasks: [], doneTasks: new Set(),
    killReadyAt: 0, invisibleUntil: 0, speedUntil: 0,
    disguiseCharId: null, disguiseUntil: 0, escapeEnteredAt: 0,
    stats: { tasks: 0, kills: 0, escaped: false, correctVote: false },
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
        // A joining human replaces a bot when the room is at capacity.
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
      case 'leave': {
        if (room) room.removePlayer(player.id);
        break;
      }
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
      case 'addBot': {
        if (room && player.id === room.hostId && room.state === 'lobby') room.addBot();
        break;
      }
      case 'start': {
        if (room && player.id === room.hostId) room.startCountdown();
        break;
      }
      case 'pos': {
        if (!room || (room.state !== 'playing' && room.state !== 'countdown')) break;
        if (player.escaped) break; // ghosts still move (to finish their puzzles)
        const x = Number(msg.x), z = Number(msg.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) break;
        player.pos.x = Math.max(MAP.bounds.minX, Math.min(MAP.bounds.maxX, x));
        player.pos.z = Math.max(MAP.bounds.minZ, Math.min(MAP.bounds.maxZ, z));
        player.yaw = Number(msg.yaw) || 0;
        player.anim = msg.anim ? 1 : 0;
        break;
      }
      case 'taskDone': {
        if (room) room.completeTask(player, String(msg.stationId));
        break;
      }
      case 'kill': {
        if (room) room.tryKill(player, room.players.get(msg.targetId));
        break;
      }
      case 'report': {
        if (!room || room.state !== 'playing' || !player.alive || player.escaped) break;
        const body = room.bodies.find(b => b.id === msg.bodyId);
        if (body && Math.hypot(body.x - player.pos.x, body.z - player.pos.z) < REPORT_RANGE * 1.5) {
          room.startMeeting(player, body.id);
        }
        break;
      }
      case 'button': {
        if (!room || room.state !== 'playing') break;
        const b = MAP.meetingButton;
        if (Math.hypot(b.x - player.pos.x, b.z - player.pos.z) < INTERACT_RANGE * 1.5) {
          room.startMeeting(player, null);
        }
        break;
      }
      case 'vote': {
        if (room) room.castVote(player, msg.targetId);
        break;
      }
      case 'chat': {
        if (!room || room.state !== 'meeting') break;
        const text = String(msg.text || '').slice(0, 120).trim();
        if (text) room.broadcast({ t: 'chat', from: player.id, name: player.name, text });
        break;
      }
      case 'ability': {
        if (room) room.useAbility(player, String(msg.abilityId));
        break;
      }
    }
  }

  ws.on('close', () => {
    if (player?.room) player.room.removePlayer(player.id);
  });
});

// Meeting bots cast votes on their timers; run alongside room ticks.
setInterval(() => {
  const t = now();
  for (const room of rooms.values()) {
    if (room.state !== 'meeting') continue;
    for (const p of room.players.values()) {
      if (!p.isBot || !p.alive || p.escaped || !p.bot?.voteAt) continue;
      if (t >= p.bot.voteAt) {
        p.bot.voteAt = 0;
        const options = room.alive().filter(q => q.id !== p.id).map(q => q.id);
        // Bots mostly skip; sometimes they point a finger at random.
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
