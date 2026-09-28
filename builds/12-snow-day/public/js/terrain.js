import * as THREE from 'three';
import { makeGroundDiffuse, makeSnowNormal, makeSnowRoughness } from './textures.js';

// Builds the ground + snow field and returns an update(world) function that
// re-uploads the snow DataTexture only when new diffs have arrived.
export function buildTerrain(scene, worldMeta) {
  const size = worldMeta.size;
  const res = worldMeta.gridRes;

  // Base ground: what you see once the auger has cut down to bare earth.
  const groundGeo = new THREE.PlaneGeometry(size, size, 8, 8);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    map: makeGroundDiffuse(),
    roughness: 1,
    metalness: 0
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);

  // Snow field: a displaced, alpha-cut layer above the ground. The alpha and
  // displacement both come from the same single-source-of-truth grid the
  // server keeps, so the client never has to guess where lanes are. The
  // texture (linearly filtered) already smooths cell edges, so the visible
  // mesh can use far fewer segments than the data grid without looking
  // blocky -- this keeps 2-3 simultaneous windows light on the GPU.
  const snowSegments = Math.round(res / 2);
  const snowGeo = new THREE.PlaneGeometry(size, size, snowSegments, snowSegments);
  snowGeo.rotateX(-Math.PI / 2);

  const gridData = new Uint8Array(res * res * 4).fill(255);
  const snowDataTex = new THREE.DataTexture(gridData, res, res, THREE.RGBAFormat, THREE.UnsignedByteType);
  snowDataTex.magFilter = THREE.LinearFilter;
  snowDataTex.minFilter = THREE.LinearFilter;
  snowDataTex.wrapS = snowDataTex.wrapT = THREE.ClampToEdgeWrapping;
  snowDataTex.needsUpdate = true;

  const snowMat = new THREE.MeshPhysicalMaterial({
    color: 0xf5f8fc,
    roughness: 0.88,
    metalness: 0.0,
    sheen: 1.0,
    sheenColor: 0xdfe9f5,
    sheenRoughness: 0.7,
    clearcoat: 0.15,
    clearcoatRoughness: 0.4,
    normalMap: makeSnowNormal(),
    roughnessMap: makeSnowRoughness(),
    alphaMap: snowDataTex,
    displacementMap: snowDataTex,
    displacementScale: 0.4,
    displacementBias: -0.05,
    transparent: true,
    alphaTest: 0.02,
    depthWrite: true
  });
  const snow = new THREE.Mesh(snowGeo, snowMat);
  snow.position.y = 0.02;
  snow.receiveShadow = true;
  snow.castShadow = false;
  scene.add(snow);

  function update(world) {
    if (!world.snowBytes || !world.snowDirty) return;
    const src = world.snowBytes;
    for (let i = 0; i < src.length; i++) {
      const v = src[i];
      const o = i * 4;
      gridData[o] = v; gridData[o + 1] = v; gridData[o + 2] = v; gridData[o + 3] = v;
    }
    snowDataTex.needsUpdate = true;
    world.snowDirty = false;
  }

  return { ground, snow, snowDataTex, update };
}
