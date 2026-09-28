// Networking layer. Owns the WebSocket and the shared world-state object.
// Every incoming message mutates `world` immediately in the message handler
// (not inside the render loop), so the render loop always draws whatever is
// freshest even if requestAnimationFrame was throttled while this window was
// hidden/unfocused.

export function createNetwork({ world, onWelcome, onChat, onDbg }) {
  const params = new URLSearchParams(location.search);
  const dbg = params.get('dbg') === '1';
  const wsUrl = `ws://${location.host}/ws`;

  let ws = null;
  let connected = false;
  let closedByUs = false;
  let backoffMs = 400;

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }

  function connect() {
    ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.addEventListener('open', () => {
      connected = true;
      backoffMs = 400;
      const name = params.get('name') || world.pendingName || world.me?.name || `Plower${Math.floor(Math.random() * 1000)}`;
      send({ t: 'join', name });
    });

    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }

      switch (msg.t) {
        case 'welcome': {
          world.selfId = msg.id;
          world.me = msg.me;
          world.worldMeta = msg.world;
          world.applySnapshot(msg.snowSnapshot);
          world.remotes.clear();
          for (const p of msg.players) {
            if (p.id !== world.selfId) world.upsertRemote(p);
          }
          world.chat.length = 0; // avoid duplicate replay on reconnect
          for (const c of msg.chat) world.pushChat(c);
          if (onWelcome) onWelcome(msg);
          break;
        }
        case 'join': {
          if (msg.player.id !== world.selfId) world.upsertRemote(msg.player);
          break;
        }
        case 'leave': {
          world.removeRemote(msg.id);
          break;
        }
        case 'players': {
          for (const p of msg.list) {
            if (p.id !== world.selfId) world.upsertRemote(p, msg.ts);
          }
          world.lastPlayersTs = msg.ts;
          break;
        }
        case 'snow': {
          world.applyDiff(msg.d);
          world.snowVersion = (world.snowVersion || 0) + 1;
          world.lastSnowServerTs = msg.ts;
          world.lastSnowClientTs = performance.timeOrigin + performance.now();
          break;
        }
        case 'chat': {
          world.pushChat(msg.msg);
          if (onChat) onChat(msg.msg);
          break;
        }
        case 'pong': {
          if (onDbg) onDbg({ rtt: Date.now() - msg.ts });
          break;
        }
        default: break;
      }
    });

    ws.addEventListener('close', () => {
      connected = false;
      if (closedByUs) return;
      // Reconnect with backoff so a dropped socket (page hitch, server
      // restart) doesn't permanently strand a window out of sync.
      setTimeout(connect, backoffMs);
      backoffMs = Math.min(backoffMs * 1.6, 5000);
    });

    ws.addEventListener('error', () => { /* close handler will follow */ });
  }
  connect();

  // Position (and implicit lane-clearing) sync on a fixed timer, independent
  // of requestAnimationFrame, per the "keep sync on a timer, not rAF" rule.
  const sendTimer = setInterval(() => {
    if (!connected || !world.me) return;
    send({
      t: 'state',
      x: world.me.x,
      z: world.me.z,
      ry: world.me.ry,
      speed: world.me.speed
    });
  }, 66); // ~15 Hz

  function sendChat(text) {
    send({ t: 'chat', text });
  }

  function debugPing() {
    send({ t: 'ping', ts: Date.now() });
  }

  function stop() {
    closedByUs = true;
    clearInterval(sendTimer);
    if (ws) ws.close();
  }

  if (dbg) {
    window.__DBG = window.__DBG || {};
    window.__DBG.world = world;
    window.__DBG.ping = debugPing;
    window.__DBG.isConnected = () => connected;
  }

  return { send, sendChat, stop, dbg };
}
