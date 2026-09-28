// Plain-data shared world state. No three.js here on purpose: the network
// layer and the render layer both touch this object, and keeping it free of
// GPU handles keeps the "state update" and "draw" concerns separated.

export class World {
  constructor() {
    this.selfId = null;
    this.me = null;            // { x, z, ry, speed, name, color }
    this.worldMeta = null;     // { size, gridRes, cellSize }
    this.remotes = new Map();  // id -> { x, z, ry, speed, name, color, lastTs, prev:{x,z,ry,ts} }
    this.snowBytes = null;     // Uint8Array, gridRes*gridRes, 0..255 (255 = full snow)
    this.snowDirty = true;     // set true whenever bytes change; renderer clears it after upload
    this.chat = [];
    this.snowVersion = 0;
    this.lastSnowServerTs = 0;
    this.lastSnowClientTs = 0;
    this.lastPlayersTs = 0;
    this.pendingName = null;
  }

  applySnapshot(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    this.snowBytes = bytes;
    this.snowDirty = true;
  }

  applyDiff(pairs) {
    if (!this.snowBytes || !pairs) return;
    for (const [idx, val] of pairs) this.snowBytes[idx] = val;
    this.snowDirty = true;
  }

  upsertRemote(p, ts) {
    const existing = this.remotes.get(p.id);
    const now = ts || Date.now();
    if (existing) {
      existing.prev = { x: existing.x, z: existing.z, ry: existing.ry, ts: existing.lastTs };
      existing.x = p.x; existing.z = p.z; existing.ry = p.ry; existing.speed = p.speed;
      existing.name = p.name; existing.color = p.color;
      existing.lastTs = now;
    } else {
      this.remotes.set(p.id, {
        id: p.id, name: p.name, color: p.color,
        x: p.x, z: p.z, ry: p.ry, speed: p.speed || 0,
        lastTs: now, prev: { x: p.x, z: p.z, ry: p.ry, ts: now }
      });
    }
  }

  removeRemote(id) {
    this.remotes.delete(id);
  }

  pushChat(msg) {
    this.chat.push(msg);
    if (this.chat.length > 30) this.chat.shift();
  }
}
