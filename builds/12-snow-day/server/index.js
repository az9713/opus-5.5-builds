'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer } = require('ws');
const { GameState, WORLD_SIZE, GRID_RES, CELL_SIZE } = require('./gameState');

const PORT = process.env.PORT || 3512;
const TICK_MS = 80; // ~12.5 Hz authoritative broadcast tick, independent of any client's rAF

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
// Serve the three.js ES module build straight from node_modules so the client
// can `import` it with no bundler and no CDN (fully offline).
app.use('/vendor/three/build', express.static(path.join(__dirname, '..', 'node_modules', 'three', 'build')));
app.use('/vendor/three/examples/jsm', express.static(path.join(__dirname, '..', 'node_modules', 'three', 'examples', 'jsm')));

const server = app.listen(PORT, () => {
  console.log(`[snow-day] listening on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server, path: '/ws' });
const game = new GameState();

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function broadcast(obj, exceptWs) {
  const payload = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN && client !== exceptWs) {
      client.send(payload);
    }
  }
}

function broadcastAll(obj) {
  const payload = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}

wss.on('connection', (ws, req) => {
  const id = crypto.randomUUID();
  ws.playerId = id;
  ws.isAlive = true;

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.t) {
      case 'join': {
        const name = (typeof msg.name === 'string' && msg.name.trim()) ? msg.name.trim() : `Plower${Math.floor(Math.random() * 1000)}`;
        const player = game.addPlayer(id, name);
        send(ws, {
          t: 'welcome',
          id,
          me: player,
          world: { size: WORLD_SIZE, gridRes: GRID_RES, cellSize: CELL_SIZE },
          snowSnapshot: game.snapshotBase64(),
          players: game.playersList(),
          chat: game.chatLog
        });
        broadcast({ t: 'join', player }, ws);
        break;
      }
      case 'state': {
        if (!game.players.has(id)) return;
        const x = Number(msg.x) || 0;
        const z = Number(msg.z) || 0;
        const speed = Number(msg.speed) || 0;
        game.updatePlayerState(id, x, z, Number(msg.ry) || 0, speed);
        // Driving over snow clears it. Clearing is derived from the position
        // stream itself so one timer covers both movement sync and lane-cutting.
        if (Math.abs(speed) > 0.15) game.clearCircle(x, z);
        break;
      }
      case 'clear': {
        if (!game.players.has(id)) return;
        game.clearCircle(Number(msg.x) || 0, Number(msg.z) || 0);
        break;
      }
      case 'chat': {
        const p = game.players.get(id);
        if (!p || typeof msg.text !== 'string' || !msg.text.trim()) return;
        const chatMsg = game.addChat(id, p.name, msg.text.trim());
        broadcastAll({ t: 'chat', msg: chatMsg });
        break;
      }
      case 'ping': {
        send(ws, { t: 'pong', ts: msg.ts, serverTs: Date.now() });
        break;
      }
      default:
        break;
    }
  });

  ws.on('close', () => {
    game.removePlayer(id);
    broadcastAll({ t: 'leave', id });
  });
});

// Drop dead sockets (closed tabs, killed processes) so the player list stays accurate.
const heartbeat = setInterval(() => {
  for (const client of wss.clients) {
    if (client.isAlive === false) {
      client.terminate();
      continue;
    }
    client.isAlive = false;
    client.ping();
  }
}, 15000);

// Authoritative tick: runs on a plain server-side timer, decoupled from any
// browser's requestAnimationFrame so background/unfocused windows still get
// fresh state (rAF throttles in hidden tabs; this does not).
setInterval(() => {
  game.refillTick();
  const diff = game.popDirtyDiff();
  const now = Date.now();
  if (diff) {
    broadcastAll({ t: 'snow', d: diff, ts: now });
  }
  if (game.players.size > 0) {
    broadcastAll({ t: 'players', list: game.playersList(), ts: now });
  }
}, TICK_MS);

process.on('SIGTERM', () => { clearInterval(heartbeat); server.close(); process.exit(0); });
