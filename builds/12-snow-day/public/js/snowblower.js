import * as THREE from 'three';
import { makeWoodDiffuse } from './textures.js';

// Builds a stylised vintage ride-on snowblower: big skid-steer tires, a wide
// front auger drum, a raised discharge chute, a bench seat, a steering
// column, and a pair of gloved hands gripping the wheel with a thermos.
// Returns named parts so the caller can drive the wheel / attach a camera.
export function buildSnowblower(bodyColorHex = 0xd94b3d) {
  const group = new THREE.Group();

  const paint = new THREE.MeshPhysicalMaterial({
    color: bodyColorHex, metalness: 0.55, roughness: 0.35,
    clearcoat: 0.6, clearcoatRoughness: 0.18
  });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe4e8, metalness: 1, roughness: 0.18 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2b2f33, metalness: 0.7, roughness: 0.45 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.95 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x7a1f1f, roughness: 0.7 });
  const woodMat = new THREE.MeshStandardMaterial({ map: makeWoodDiffuse(), roughness: 0.8 });
  const steelThermos = new THREE.MeshPhysicalMaterial({ color: 0xb7c2cc, metalness: 0.9, roughness: 0.25, clearcoat: 0.3 });
  const glassLight = new THREE.MeshPhysicalMaterial({ color: 0xfff4d6, emissive: 0xffdd88, emissiveIntensity: 1.2, roughness: 0.3, transparent: true, opacity: 0.95 });

  // --- chassis ---
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 2.6), paint);
  chassis.position.y = 0.75;
  chassis.castShadow = true;
  group.add(chassis);

  // running boards / skirt
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.15, 2.2), darkMetal);
  skirt.position.y = 0.5;
  skirt.castShadow = true;
  group.add(skirt);

  // --- big rear tires (skid steer style) ---
  function makeWheel(x, z) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.38, 20), rubber);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheel.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 12), chrome);
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    wheel.position.set(x, 0.5, z);
    return wheel;
  }
  group.add(makeWheel(-0.85, 0.75));
  group.add(makeWheel(0.85, 0.75));
  group.add(makeWheel(-0.85, -0.8));
  group.add(makeWheel(0.85, -0.8));

  // --- front auger housing ---
  const augerHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.5, 16, 1, false, -Math.PI * 0.55, Math.PI * 1.1), paint);
  augerHousing.rotation.z = Math.PI / 2;
  augerHousing.position.set(0, 0.62, 1.55);
  augerHousing.castShadow = true;
  group.add(augerHousing);

  const augerDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.42, 14), darkMetal);
  augerDrum.rotation.z = Math.PI / 2;
  augerDrum.position.set(0, 0.62, 1.55);
  group.add(augerDrum);
  // auger flighting (helical fins, approximated with rings)
  for (let i = 0; i < 10; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.035, 6, 16), chrome);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(-0.63 + i * 0.14, 0.62, 1.55);
    group.add(ring);
  }

  // discharge chute
  // Offset to the right side (as on a real side-discharge blower) so the
  // pipe doesn't stand dead-center in the driver's forward sightline.
  const chute = new THREE.Group();
  const chuteLower = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.6, 10), darkMetal);
  chuteLower.position.set(0, 0.3, 0);
  chute.add(chuteLower);
  const chuteUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.45, 10), darkMetal);
  chuteUpper.position.set(0, 0.72, -0.04);
  chuteUpper.rotation.x = -0.5;
  chute.add(chuteUpper);
  chute.position.set(0.42, 0.8, 1.45);
  group.add(chute);
  group.userData.chute = chute;

  // headlight
  const headlight = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12), glassLight);
  headlight.rotation.z = Math.PI / 2;
  headlight.position.set(0.35, 0.95, 2.05);
  group.add(headlight);
  const headlight2 = headlight.clone();
  headlight2.position.x = -0.35;
  group.add(headlight2);

  // --- seat ---
  const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.6), woodMat);
  seatBase.position.set(0, 1.05, -0.35);
  group.add(seatBase);
  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.12), woodMat);
  seatBack.position.set(0, 1.35, -0.62);
  group.add(seatBack);

  // --- steering column + wheel ---
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.75, 10), darkMetal);
  column.position.set(0, 1.15, 0.55);
  column.rotation.x = 0.55;
  group.add(column);

  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(0, 1.42, 0.78);
  wheelGroup.rotation.x = -1.0;
  const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 10, 24), darkMetal);
  wheelGroup.add(wheelRing);
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.025), chrome);
    spoke.rotation.z = (i / 3) * Math.PI * 2;
    wheelGroup.add(spoke);
  }
  group.add(wheelGroup);
  group.userData.wheelGroup = wheelGroup;

  // gloved hands on the wheel
  function makeHand(angle) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), glove);
    hand.scale.set(1, 0.85, 1.3);
    hand.position.set(Math.cos(angle) * 0.24, Math.sin(angle) * 0.24, 0.05);
    return hand;
  }
  const leftHand = makeHand(Math.PI * 0.78);
  const rightHand = makeHand(Math.PI * 0.22);
  wheelGroup.add(leftHand, rightHand);

  // thermos held near the right hand, resting in a cup mount on the dash
  const thermosGroup = new THREE.Group();
  const thermosBody = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.22, 12), steelThermos);
  thermosGroup.add(thermosBody);
  const thermosCap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.05, 12), darkMetal);
  thermosCap.position.y = 0.135;
  thermosGroup.add(thermosCap);
  const thermosHandle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 6, 12, Math.PI), darkMetal);
  thermosHandle.rotation.z = Math.PI / 2;
  thermosHandle.position.set(0.055, 0.02, 0);
  thermosGroup.add(thermosHandle);
  thermosGroup.position.set(0.32, 1.18, 0.42);
  thermosGroup.rotation.z = 0.15;
  group.add(thermosGroup);
  group.userData.thermos = thermosGroup;

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });

  return group;
}

// Simple seated driver silhouette for remote (third-person) players, so
// other machines don't look like they're driving themselves.
export function buildDriverFigure(color = 0x334455) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
  const skinTone = new THREE.MeshStandardMaterial({ color: 0xd8a273, roughness: 0.6 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 4, 8), jacket);
  torso.position.set(0, 1.45, -0.3);
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), skinTone);
  head.position.set(0, 1.86, -0.32);
  head.castShadow = true;
  g.add(head);
  const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), jacket);
  beanie.position.set(0, 1.9, -0.32);
  g.add(beanie);
  return g;
}
