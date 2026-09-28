'use strict';

// Shared authoritative game state: the snow grid and the player registry.
// The grid is a flat Float32Array, one cell per patch of ground.
// 1.0 = full fresh snow, 0.0 = bare cleared ground.

const WORLD_SIZE = 120;       // world spans -60..60 on X and Z (meters)
const GRID_RES = 128;         // 128x128 cells across the world
const CELL_SIZE = WORLD_SIZE / GRID_RES; // ~0.9375 m per cell
const CLEAR_RADIUS_M = 1.5;   // snowblower cutting radius, in meters
const REFILL_TIME_S = 90;     // seconds for a fully cleared cell to refill
const REFILL_DELTA = 1 / (REFILL_TIME_S * (1000 / 80)); // per 80ms tick

const PLAYER_COLORS = [
  0xd94b3d, 0x3d7dd9, 0x3dd97e, 0xd9c93d,
  0xa93dd9, 0xd9863d, 0x3dcdd9, 0xe85fa0
];

function worldToCell(x, z) {
  const cx = Math.floor((x + WORLD_SIZE / 2) / CELL_SIZE);
  const cz = Math.floor((z + WORLD_SIZE / 2) / CELL_SIZE);
  return { cx, cz };
}

class GameState {
  constructor() {
    this.snow = new Float32Array(GRID_RES * GRID_RES).fill(1);
    this.activeCells = new Set(); // cell indices below full snow (need refill/tracking)
    this.dirty = new Map();       // index -> quantized value, since last broadcast
    this.players = new Map();     // id -> player record
    this.chatLog = [];
    this._colorCursor = 0;
  }

  nextColor() {
    const c = PLAYER_COLORS[this._colorCursor % PLAYER_COLORS.length];
    this._colorCursor++;
    return c;
  }

  addPlayer(id, name) {
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnR = 8 + Math.random() * 6;
    const player = {
      id,
      name: name.slice(0, 20),
      x: Math.cos(spawnAngle) * spawnR,
      z: 20 + Math.sin(spawnAngle) * spawnR,
      ry: Math.PI,
      speed: 0,
      color: this.nextColor(),
      lastSeen: Date.now()
    };
    this.players.set(id, player);
    return player;
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  updatePlayerState(id, x, z, ry, speed) {
    const p = this.players.get(id);
    if (!p) return;
    // Clamp to world bounds so nobody drives off into the void.
    const half = WORLD_SIZE / 2 - 2;
    p.x = Math.max(-half, Math.min(half, x));
    p.z = Math.max(-half, Math.min(half, z));
    p.ry = ry;
    p.speed = speed;
    p.lastSeen = Date.now();
  }

  // Clear a circle of snow centered on (x, z). Returns true if anything changed.
  clearCircle(x, z) {
    const rCells = Math.ceil(CLEAR_RADIUS_M / CELL_SIZE) + 1;
    const { cx: centerCx, cz: centerCz } = worldToCell(x, z);
    let changed = false;
    for (let dz = -rCells; dz <= rCells; dz++) {
      for (let dx = -rCells; dx <= rCells; dx++) {
        const cx = centerCx + dx;
        const cz = centerCz + dz;
        if (cx < 0 || cz < 0 || cx >= GRID_RES || cz >= GRID_RES) continue;
        const wx = (cx + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
        const wz = (cz + 0.5) * CELL_SIZE - WORLD_SIZE / 2;
        const ddx = wx - x;
        const ddz = wz - z;
        if (ddx * ddx + ddz * ddz > CLEAR_RADIUS_M * CLEAR_RADIUS_M) continue;
        const idx = cz * GRID_RES + cx;
        if (this.snow[idx] > 0.02) {
          this.snow[idx] = 0;
          this.activeCells.add(idx);
          this.dirty.set(idx, 0);
          changed = true;
        }
      }
    }
    return changed;
  }

  // Slowly refill cleared cells to simulate falling snow. Call once per tick.
  refillTick() {
    for (const idx of this.activeCells) {
      let v = this.snow[idx] + REFILL_DELTA;
      if (v >= 1) {
        v = 1;
        this.activeCells.delete(idx);
      }
      this.snow[idx] = v;
      this.dirty.set(idx, Math.round(v * 255));
    }
  }

  // Pop the accumulated dirty-cell diff as [index, quantizedByte] pairs.
  popDirtyDiff() {
    if (this.dirty.size === 0) return null;
    const diff = [];
    for (const [idx, val] of this.dirty) diff.push([idx, val]);
    this.dirty.clear();
    return diff;
  }

  // Full quantized snapshot for a newly joined client.
  snapshotBase64() {
    const bytes = Buffer.alloc(GRID_RES * GRID_RES);
    for (let i = 0; i < this.snow.length; i++) {
      bytes[i] = Math.round(this.snow[i] * 255);
    }
    return bytes.toString('base64');
  }

  playersList() {
    const list = [];
    for (const p of this.players.values()) {
      list.push({ id: p.id, name: p.name, x: p.x, z: p.z, ry: p.ry, speed: p.speed, color: p.color });
    }
    return list;
  }

  addChat(id, name, text) {
    const msg = { id, name, text: String(text).slice(0, 200), ts: Date.now() };
    this.chatLog.push(msg);
    if (this.chatLog.length > 50) this.chatLog.shift();
    return msg;
  }
}

module.exports = {
  GameState,
  WORLD_SIZE,
  GRID_RES,
  CELL_SIZE,
  CLEAR_RADIUS_M
};
