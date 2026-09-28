import * as THREE from 'three';

// Ambient falling snow around the camera (purely cosmetic, client-local).
export function createSnowfall(scene, count = 1000, spread = 60) {
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = Math.random() * 26;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
    speeds[i] = 1.2 + Math.random() * 1.6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff, size: 0.09, transparent: true, opacity: 0.85,
    depthWrite: false
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  function update(dt, centerX, centerZ) {
    const pos = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] -= speeds[i] * dt;
      pos[i * 3] += Math.sin(performance.now() * 0.0005 + i) * 0.01;
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3] = centerX + (Math.random() - 0.5) * spread;
        pos[i * 3 + 1] = 22 + Math.random() * 4;
        pos[i * 3 + 2] = centerZ + (Math.random() - 0.5) * spread;
      }
    }
    geo.attributes.position.needsUpdate = true;
    points.position.set(0, 0, 0);
  }

  return { points, update };
}

// Snow plume kicked up by an active auger. One shared particle pool, points
// spawned near a moving vehicle's chute and thrown forward/up before falling.
export function createPlumeSystem(scene, poolSize = 180) {
  const positions = new Float32Array(poolSize * 3);
  const velocities = new Float32Array(poolSize * 3);
  const life = new Float32Array(poolSize).fill(0);
  let cursor = 0;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xfbfdff, size: 0.16, transparent: true, opacity: 0.9, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  function emit(originX, originY, originZ, dirX, dirZ, n = 3) {
    for (let k = 0; k < n; k++) {
      const i = cursor;
      cursor = (cursor + 1) % poolSize;
      positions[i * 3] = originX + (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 1] = originY + Math.random() * 0.2;
      positions[i * 3 + 2] = originZ + (Math.random() - 0.5) * 0.3;
      const spread = 0.6;
      velocities[i * 3] = dirX * (2 + Math.random() * 1.5) + (Math.random() - 0.5) * spread;
      velocities[i * 3 + 1] = 2.2 + Math.random() * 1.8;
      velocities[i * 3 + 2] = dirZ * (2 + Math.random() * 1.5) + (Math.random() - 0.5) * spread;
      life[i] = 0.7 + Math.random() * 0.5;
    }
  }

  function update(dt) {
    for (let i = 0; i < poolSize; i++) {
      if (life[i] <= 0) { positions[i * 3 + 1] = -1000; continue; }
      life[i] -= dt;
      velocities[i * 3 + 1] -= 5.0 * dt; // gravity
      positions[i * 3] += velocities[i * 3] * dt;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
    }
    geo.attributes.position.needsUpdate = true;
  }

  return { emit, update };
}
