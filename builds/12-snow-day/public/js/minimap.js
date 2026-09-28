// 2D canvas minimap, bottom-right. Shows the hotel, every known player
// (self highlighted), and a coarse tint of cleared lanes sampled straight
// from the snow byte grid the network layer already keeps in memory.
export function createMinimap(canvasEl, worldMeta) {
  const ctx = canvasEl.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssSize = 180;
  canvasEl.width = cssSize * dpr;
  canvasEl.height = cssSize * dpr;
  ctx.scale(dpr, dpr);

  const half = worldMeta.size / 2;
  function toMap(x, z) {
    return {
      mx: ((x + half) / worldMeta.size) * cssSize,
      my: ((z + half) / worldMeta.size) * cssSize
    };
  }

  let lastTintAt = 0;
  const tintCanvas = document.createElement('canvas');
  tintCanvas.width = tintCanvas.height = 64;
  const tintCtx = tintCanvas.getContext('2d');
  const tintImg = tintCtx.createImageData(64, 64);

  function refreshTint(world) {
    if (!world.snowBytes) return;
    const res = worldMeta.gridRes;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const gx = Math.floor((x / 64) * res);
        const gy = Math.floor((y / 64) * res);
        const v = world.snowBytes[gy * res + gx]; // 255 = full snow, 0 = cleared
        const o = (y * 64 + x) * 4;
        // snow -> pale blue-white, cleared -> dark packed earth
        const t = v / 255;
        tintImg.data[o] = 30 + t * 200;
        tintImg.data[o + 1] = 38 + t * 205;
        tintImg.data[o + 2] = 46 + t * 220;
        tintImg.data[o + 3] = 255;
      }
    }
    tintCtx.putImageData(tintImg, 0, 0);
    lastTintAt = performance.now();
  }

  function draw(world) {
    if (performance.now() - lastTintAt > 500) refreshTint(world);

    ctx.clearRect(0, 0, cssSize, cssSize);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tintCanvas, 0, 0, cssSize, cssSize);

    // hotel marker (fixed, matches hotel.js placement at z = -34)
    const hotelPos = toMap(0, -34);
    ctx.fillStyle = 'rgba(255, 220, 150, 0.85)';
    ctx.fillRect(hotelPos.mx - 22, hotelPos.my - 6, 44, 12);

    // remote players
    for (const p of world.remotes.values()) {
      const { mx, my } = toMap(p.x, p.z);
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.fillStyle = `#${p.color.toString(16).padStart(6, '0')}`;
      ctx.fill();
    }

    // self, on top, with a white ring
    if (world.me) {
      const { mx, my } = toMap(world.me.x, world.me.z);
      ctx.beginPath();
      ctx.arc(mx, my, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ff8a3d';
      ctx.fill();
    }
  }

  return { draw };
}
