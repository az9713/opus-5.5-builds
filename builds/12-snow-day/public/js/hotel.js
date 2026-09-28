import * as THREE from 'three';
import { makeWoodDiffuse } from './textures.js';

// A grand alpine hotel facade: stone base, half-timbered upper floors,
// a steep snow-capped gable roof, balconies and a lit entrance. Built from
// primitives only (no external assets), positioned as a backdrop the
// players clear snow in front of.
export function buildHotel() {
  const group = new THREE.Group();

  const stone = new THREE.MeshStandardMaterial({ color: 0xcfc3ad, roughness: 0.95 });
  const plaster = new THREE.MeshStandardMaterial({ color: 0xe8dfc8, roughness: 0.85 });
  const timber = new THREE.MeshStandardMaterial({ map: makeWoodDiffuse(256, '#4a2f1c', '#2a1810'), roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x5b2b2b, roughness: 0.7 });
  const snowCap = new THREE.MeshStandardMaterial({ color: 0xf6f9fd, roughness: 0.7 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xfff0c8, emissive: 0xffcf80, emissiveIntensity: 0.7,
    roughness: 0.2, transmission: 0.3, thickness: 0.1
  });
  const doorMat = new THREE.MeshStandardMaterial({ map: makeWoodDiffuse(256, '#3b2412', '#20130a'), roughness: 0.7 });

  const WIDTH = 26, DEPTH = 12, BASE_H = 5, UPPER_H = 5.5;

  // stone base floor
  const base = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, BASE_H, DEPTH), stone);
  base.position.y = BASE_H / 2;
  base.castShadow = base.receiveShadow = true;
  group.add(base);

  // plaster upper floor with timber cross-bracing
  const upper = new THREE.Mesh(new THREE.BoxGeometry(WIDTH - 1, UPPER_H, DEPTH - 0.8), plaster);
  upper.position.y = BASE_H + UPPER_H / 2;
  upper.castShadow = upper.receiveShadow = true;
  group.add(upper);

  function addBeam(x, y, z, w, h, d, rotY = 0) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), timber);
    beam.position.set(x, y, z);
    beam.rotation.y = rotY;
    beam.castShadow = true;
    group.add(beam);
  }
  const faceZ = DEPTH / 2 - 0.35;
  for (let x = -11; x <= 11; x += 2.2) addBeam(x, BASE_H + UPPER_H / 2, faceZ, 0.18, UPPER_H, 0.15);
  addBeam(0, BASE_H + 1.2, faceZ, WIDTH - 1.2, 0.18, 0.15);
  addBeam(0, BASE_H + UPPER_H - 0.8, faceZ, WIDTH - 1.2, 0.18, 0.15);

  // windows (upper floor row + base floor row), simple emissive glass panes
  function addWindow(x, y, z, w = 1.1, h = 1.5) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), glass);
    win.position.set(x, y, z);
    group.add(win);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, h + 0.18, 0.14), timber);
    frame.position.set(x, y, z - 0.02);
    group.add(frame);
  }
  for (let x = -10; x <= 10; x += 2.5) {
    addWindow(x, BASE_H + 3.4, faceZ + 0.05);
    if (Math.abs(x) > 1.5) addWindow(x, 2.6, DEPTH / 2 + 0.05, 1.3, 2.0);
  }

  // balcony on the upper floor, centered
  const balconyFloor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 1.2), timber);
  balconyFloor.position.set(0, BASE_H + 2.0, DEPTH / 2 + 0.6);
  balconyFloor.castShadow = true;
  group.add(balconyFloor);
  for (let x = -2.9; x <= 2.9; x += 0.5) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6), timber);
    rail.position.set(x, BASE_H + 2.45, DEPTH / 2 + 1.15);
    group.add(rail);
  }
  const railTop = new THREE.Mesh(new THREE.BoxGeometry(6, 0.08, 0.08), timber);
  railTop.position.set(0, BASE_H + 2.9, DEPTH / 2 + 1.15);
  group.add(railTop);

  // grand entrance
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.4, 0.3), stone);
  doorFrame.position.set(0, 1.7, DEPTH / 2 + 0.1);
  group.add(doorFrame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.0, 0.15), doorMat);
  door.position.set(0, 1.5, DEPTH / 2 + 0.28);
  group.add(door);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 1.8), timber);
  canopy.position.set(0, 3.4, DEPTH / 2 + 1.0);
  canopy.castShadow = true;
  group.add(canopy);

  // Steep gable roof: two panels meeting at a ridge line, each panel's
  // length matched exactly to the ridge-to-eave distance so they meet
  // cleanly at the top instead of crossing through each other.
  const roofH = BASE_H + UPPER_H;
  const halfSpan = WIDTH / 2 + 0.7;
  const ridgeRise = 9;
  const slopeAngle = Math.atan2(ridgeRise, halfSpan);
  const slopeLen = Math.hypot(halfSpan, ridgeRise);

  const slope = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.3, DEPTH * 0.9), roofMat);
  slope.position.set(halfSpan / 2, roofH + ridgeRise / 2, 0);
  slope.rotation.z = -slopeAngle;
  slope.castShadow = true;
  group.add(slope);

  const slope2 = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.3, DEPTH * 0.9), roofMat);
  slope2.position.set(-halfSpan / 2, roofH + ridgeRise / 2, 0);
  slope2.rotation.z = Math.PI + slopeAngle;
  slope2.castShadow = true;
  group.add(slope2);

  // Ridge and eave snow caps run along Z (the ridge line), matching the
  // slopes above which fall away to the left/right (X) eaves.
  const ridgeSnow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, DEPTH * 0.9 + 0.4), snowCap);
  ridgeSnow.position.set(0, roofH + ridgeRise + 0.05, 0);
  ridgeSnow.castShadow = true;
  group.add(ridgeSnow);
  const eave1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, DEPTH * 0.9 + 1.2), snowCap);
  eave1.position.set(halfSpan, roofH + 0.15, 0);
  eave1.castShadow = true;
  group.add(eave1);
  const eave2 = eave1.clone();
  eave2.position.x = -halfSpan;
  group.add(eave2);

  // chimney (base sits on the roof slope surface at x=6, rises above the ridge line)
  const chimneyX = 6;
  const roofSurfaceY = roofH + ridgeRise * (1 - Math.abs(chimneyX) / halfSpan);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.6, 1.1), stone);
  chimney.position.set(chimneyX, roofSurfaceY + 1.1, -1);
  chimney.castShadow = true;
  group.add(chimney);

  group.position.set(0, 0, -34);
  group.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return group;
}
