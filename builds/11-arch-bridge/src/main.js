import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import { SKETCH_DATA_URI } from './generated-sketch.js';
import {
  makeLayout, buildBridge, removeKeystone, maxRingDisplacement, ringThetaBounds, voussoirCornersWorld,
} from './arch.js';
import {
  SOLVER_ITERATIONS, CONTACT_STIFFNESS, CONTACT_RELAXATION, DEFAULT_FRICTION, FIXED_DT,
} from './physics-config.js';

const DBG = new URLSearchParams(location.search).get('dbg') === '1';

// ---------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd9e8);
scene.fog = new THREE.Fog(0xbfd9e8, 30, 90);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
camera.position.set(-9, 7, 13);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2.5, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3;
controls.maxDistance = 60;
controls.update();

function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------
// Lighting -- "soft sunlight"
// ---------------------------------------------------------------------
scene.add(new THREE.HemisphereLight(0xdcefff, 0x4a3a2a, 0.7));
const sun = new THREE.DirectionalLight(0xfff3d6, 2.2);
sun.position.set(-10, 16, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -18;
sun.shadow.camera.right = 18;
sun.shadow.camera.top = 18;
sun.shadow.camera.bottom = -18;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 60;
sun.shadow.radius = 6;
sun.shadow.bias = -0.0015;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xcfe3ff, 0.35);
fill.position.set(12, 8, -10);
scene.add(fill);

// ---------------------------------------------------------------------
// Desk, paper, pencil, eraser
// Scaled up to real-arch scale (span ~7m) per the physics scale -- see
// src/physics-config.js -- rather than shrinking the bridge to desk
// scale, which would put cannon-es contact tolerances in a jittery
// regime. The camera frames it the same either way.
// ---------------------------------------------------------------------
const DESK_TOP_Y = 0; // the desk surface doubles as the ground the piers stand on
const deskGeo = new THREE.BoxGeometry(16, 0.8, 11);
const deskMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.75, metalness: 0.05 });
const desk = new THREE.Mesh(deskGeo, deskMat);
desk.position.set(0, DESK_TOP_Y - 0.4, 0);
desk.receiveShadow = true;
desk.castShadow = false;
scene.add(desk);
// a couple of plank seams for visual interest
{
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x5c3d22, roughness: 0.9 });
  for (let i = -2; i <= 2; i++) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(16, 0.02, 0.03), seamMat);
    seam.position.set(0, DESK_TOP_Y + 0.001, i * 2.1);
    scene.add(seam);
  }
}

const PAPER_W = 10.2, PAPER_D = 7.6;
const PAPER_CENTER = new THREE.Vector3(-0.3, DESK_TOP_Y + 0.012, 2.3);
const paperTex = new THREE.TextureLoader().load(SKETCH_DATA_URI);
paperTex.colorSpace = THREE.SRGBColorSpace;
const paperMat = new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.95, metalness: 0 });
const paper = new THREE.Mesh(new THREE.PlaneGeometry(PAPER_W, PAPER_D), paperMat);
paper.rotation.x = -Math.PI / 2;
paper.position.copy(PAPER_CENTER);
paper.receiveShadow = true;
scene.add(paper);
// thin paper edge/shadow catcher
const paperBack = new THREE.Mesh(new THREE.BoxGeometry(PAPER_W, 0.01, PAPER_D), new THREE.MeshStandardMaterial({ color: 0xf3f0e6, roughness: 1 }));
paperBack.position.copy(PAPER_CENTER).setY(DESK_TOP_Y + 0.004);
scene.add(paperBack);

const pencilGroup = new THREE.Group();
{
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.5 });
  const tipMat = new THREE.MeshStandardMaterial({ color: 0xe8c39e, roughness: 0.6 });
  const leadMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.4 });
  const len = 3.4, rad = 0.11;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 6), bodyMat);
  shaft.rotation.z = Math.PI / 2;
  shaft.castShadow = true;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(rad, 0.005, 0.5, 6), tipMat);
  tip.rotation.z = Math.PI / 2;
  tip.position.x = len / 2 + 0.25;
  tip.castShadow = true;
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.12, 6), leadMat);
  lead.rotation.z = Math.PI / 2;
  lead.position.x = len / 2 + 0.5;
  pencilGroup.add(shaft, tip, lead);
  pencilGroup.rotation.y = -0.35;
  pencilGroup.position.set(PAPER_CENTER.x + 3.1, DESK_TOP_Y + 0.09, PAPER_CENTER.z + 2.1);
  scene.add(pencilGroup);
}
{
  const eraserMat = new THREE.MeshStandardMaterial({ color: 0xd8536a, roughness: 0.6 });
  const eraser = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.24, 0.34), eraserMat);
  eraser.position.set(PAPER_CENTER.x + 3.4, DESK_TOP_Y + 0.13, PAPER_CENTER.z + 0.7);
  eraser.rotation.y = 0.5;
  eraser.castShadow = true;
  scene.add(eraser);
}

// ---------------------------------------------------------------------
// Ground plane extension (visual only -- physics ground box is added
// with the physics world below) and a simple water/valley strip under
// the arch opening so the bridge reads as spanning something.
// ---------------------------------------------------------------------
const groundVisMat = new THREE.MeshStandardMaterial({ color: 0x6b8f5a, roughness: 1 });
const groundVis = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), groundVisMat);
groundVis.rotation.x = -Math.PI / 2;
groundVis.position.y = DESK_TOP_Y - 0.001;
groundVis.visible = false; // the desk itself is the visible ground; keep for later use
scene.add(groundVis);

// ---------------------------------------------------------------------
// Layout / stage state
// ---------------------------------------------------------------------
let layout = makeLayout(2.5);
const RING_EDGES = [[0, 2], [2, 3], [3, 1], [1, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

// Map a bridge-local (x, yHeight) point (yHeight measured from the ground,
// i.e. world y) onto the paper plane, as if it were the flat pencil
// drawing the bridge was lifted from.
const DRAW_SCALE = 0.86;
function flattenToPaper(x, yHeight) {
  return [
    PAPER_CENTER.x + x * DRAW_SCALE,
    PAPER_CENTER.y + 0.015,
    PAPER_CENTER.z + 1.9 - yHeight * DRAW_SCALE,
  ];
}

function buildLineRig() {
  const bounds = ringThetaBounds(layout);
  const flatPositions = [];
  const liftedPositions = [];
  for (let i = 0; i < layout.ringCount; i++) {
    const corners = voussoirCornersWorld(layout, bounds[i], bounds[i + 1]);
    for (const [a, b] of RING_EDGES) {
      const ca = corners[a], cb = corners[b];
      liftedPositions.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2]);
      const pa = flattenToPaper(ca[0], ca[1]);
      const pb = flattenToPaper(cb[0], cb[1]);
      flatPositions.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]);
    }
  }
  return { flatPositions: new Float32Array(flatPositions), liftedPositions: new Float32Array(liftedPositions) };
}

let lineRig = buildLineRig();
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.BufferAttribute(lineRig.flatPositions.slice(), 3));
const lineMat = new THREE.LineBasicMaterial({ color: 0x2b2b2b, transparent: true, opacity: 1 });
const bridgeLines = new THREE.LineSegments(lineGeo, lineMat);
bridgeLines.visible = false;
scene.add(bridgeLines);

function setLiftT(t) {
  const pos = lineGeo.attributes.position;
  for (let i = 0; i < pos.count * 3; i++) {
    pos.array[i] = lineRig.flatPositions[i] * (1 - t) + lineRig.liftedPositions[i] * t;
  }
  pos.needsUpdate = true;
}

// ---------------------------------------------------------------------
// Stone stage: physics world + meshes
// ---------------------------------------------------------------------
// DoubleSide: the hull triangle winding below follows cannon-es's face
// convention (see src/arch.js), not three.js's CCW-from-outside default,
// so single-sided faces could render invisible from some angles.
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9c9184, roughness: 0.85, metalness: 0.02, side: THREE.DoubleSide });
const keystoneMat = new THREE.MeshStandardMaterial({ color: 0xa88a6a, roughness: 0.8, side: THREE.DoubleSide });
const deckMat = new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.9, side: THREE.DoubleSide });
const pierMat = new THREE.MeshStandardMaterial({ color: 0x87806f, roughness: 0.9, side: THREE.DoubleSide });

function hullMeshFromCorners(corners8, material) {
  // Build a triangle mesh for the 8-corner wedge/panel hull using the same
  // face topology as the physics shapes (src/arch.js) -- not a generic
  // convex-hull computation, so the visible faces are exactly the
  // collision faces.
  const faces = [
    [0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5],
  ];
  const positions = [];
  for (const f of faces) {
    const [a, b, c, d] = f.map((i) => corners8[i]);
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

let world, bodies, archMat, wheelMat;
const stoneGroup = new THREE.Group();
stoneGroup.visible = false;
scene.add(stoneGroup);
let ringMeshes = [];
let spandrelRigs = []; // { body, container } -- container is a Group that follows the body;
                        // each shape's mesh is a child positioned at that shape's local offset
let deckMesh;
const pierMeshes = [];

function teardownStone() {
  while (stoneGroup.children.length) stoneGroup.remove(stoneGroup.children[0]);
  ringMeshes = [];
  spandrelRigs = [];
  pierMeshes.length = 0;
}

function buildStoneStage() {
  teardownStone();
  world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.solver.iterations = SOLVER_ITERATIONS;
  archMat = new CANNON.Material('arch');
  world.addContactMaterial(new CANNON.ContactMaterial(archMat, archMat, {
    friction: state.friction, restitution: 0,
    contactEquationStiffness: CONTACT_STIFFNESS, contactEquationRelaxation: CONTACT_RELAXATION,
    frictionEquationStiffness: CONTACT_STIFFNESS, frictionEquationRelaxation: CONTACT_RELAXATION,
  }));
  wheelMat = new CANNON.Material('wheel');
  world.addContactMaterial(new CANNON.ContactMaterial(wheelMat, archMat, { friction: 0.85, restitution: 0 }));

  bodies = buildBridge(world, layout, { archMat });

  const bounds = ringThetaBounds(layout);
  for (let i = 0; i < layout.ringCount; i++) {
    const corners = voussoirCornersWorld(layout, bounds[i], bounds[i + 1]).map((c) => [
      c[0] - bodies.ring[i].position.x,
      c[1] - bodies.ring[i].position.y,
      c[2] - bodies.ring[i].position.z,
    ]);
    const mat = i === layout.keystoneIndex ? keystoneMat : stoneMat;
    const mesh = hullMeshFromCorners(corners, mat);
    stoneGroup.add(mesh);
    ringMeshes.push({ mesh, body: bodies.ring[i], index: i });
  }

  for (const pierBody of bodies.piers) {
    const s = pierBody.shapes[0];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(s.halfExtents.x * 2, s.halfExtents.y * 2, s.halfExtents.z * 2), pierMat);
    mesh.position.copy(pierBody.position);
    mesh.castShadow = true; mesh.receiveShadow = true;
    stoneGroup.add(mesh);
    pierMeshes.push(mesh);
  }

  for (const spandrelBody of bodies.spandrel) {
    // Each spandrel body is compound (several wedge-panel shapes at
    // different local offsets -- see src/arch.js). A container Group
    // follows the body's position/quaternion every frame; each panel mesh
    // is a static child of that container at the shape's own local
    // offset, so it inherits the body's transform without fighting it.
    const container = new THREE.Group();
    stoneGroup.add(container);
    spandrelBody.shapes.forEach((shape, i) => {
      const offset = spandrelBody.shapeOffsets[i];
      const corners8 = shape.vertices.map((v) => [v.x, v.y, v.z]);
      const mesh = hullMeshFromCorners(corners8, stoneMat);
      mesh.position.copy(offset);
      container.add(mesh);
    });
    spandrelRigs.push({ body: spandrelBody, container });
  }

  {
    const s = bodies.deck.shapes[0];
    deckMesh = new THREE.Mesh(new THREE.BoxGeometry(s.halfExtents.x * 2, s.halfExtents.y * 2, s.halfExtents.z * 2), deckMat);
    deckMesh.castShadow = true; deckMesh.receiveShadow = true;
    stoneGroup.add(deckMesh);
  }

  // physics ground is invisible (the desk mesh is the visual ground)
  buildCart();
}

function syncStoneMeshes() {
  for (const { mesh, body } of ringMeshes) {
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
    mesh.visible = !(bodies.keystoneRemoved && body === bodies.keystone);
  }
  for (const { body, container } of spandrelRigs) {
    container.position.copy(body.position);
    container.quaternion.copy(body.quaternion);
  }
  if (deckMesh) { deckMesh.position.copy(bodies.deck.position); deckMesh.quaternion.copy(bodies.deck.quaternion); }
}

// ---------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------
let vehicle, cartMesh, wheelMeshes = [];
let pathPoints = [];
let pathLine;
let cartStarted = false;
// cannon-es 0.20's RigidVehicle.setMotorSpeed() sets a `motorTargetVelocity`
// property that the HingeConstraint's motor equation never reads (it reads
// motorEquation.targetVelocity, set by the constraint's own setMotorSpeed()
// method) -- a real bug in that version, confirmed by grepping the bundled
// cannon-es source: `motorTargetVelocity` is written exactly once and read
// nowhere. setWheelForce()/applyWheelForce() (a direct per-step torque on
// each wheel body, applied via a 'preStep' listener) is unaffected by that
// bug and is what actually drives the cart here.
const WHEEL_TORQUE = 55; // N*m per wheel

function buildCart() {
  const span = layout.innerRadius * 2 + layout.pierWidth * 2 + 0.4;
  const deckTopY = bodies.deck.position.y + layout.deckThickness / 2;
  const chassisShape = new CANNON.Box(new CANNON.Vec3(0.55, 0.28, 0.5));
  const chassisBody = new CANNON.Body({
    mass: state.cartMass, shape: chassisShape, material: archMat,
    position: new CANNON.Vec3(-span / 2 + 0.6, deckTopY + 0.5, 0),
  });
  vehicle = new CANNON.RigidVehicle({ chassisBody });
  const wheelPositions = [
    [0.38, -0.28, 0.42], [0.38, -0.28, -0.42], [-0.38, -0.28, 0.42], [-0.38, -0.28, -0.42],
  ];
  wheelMeshes = [];
  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.14, 14);
  const wheelMeshMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.7 });
  for (const [x, y, z] of wheelPositions) {
    const wheelShape = new CANNON.Sphere(0.22);
    const wheelBody = new CANNON.Body({ mass: 12, shape: wheelShape, material: wheelMat });
    vehicle.addWheel({ body: wheelBody, position: new CANNON.Vec3(x, y, z), axis: new CANNON.Vec3(0, 0, 1) });
    const wm = new THREE.Mesh(wheelGeo, wheelMeshMat);
    wm.rotation.x = Math.PI / 2;
    wm.castShadow = true;
    stoneGroup.add(wm);
    wheelMeshes.push(wm);
  }
  vehicle.addToWorld(world);

  const bodyGeo = new THREE.BoxGeometry(1.1, 0.56, 1.0);
  const bodyMeshMat = new THREE.MeshStandardMaterial({ color: 0xb5502b, roughness: 0.6 });
  cartMesh = new THREE.Mesh(bodyGeo, bodyMeshMat);
  cartMesh.castShadow = true;
  stoneGroup.add(cartMesh);

  cartStarted = false;
  pathPoints = [];
  const pathGeo = new THREE.BufferGeometry();
  pathGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6000), 3));
  pathGeo.setDrawRange(0, 0);
  const pathMat = new THREE.LineDashedMaterial({ color: 0xff5533, dashSize: 0.25, gapSize: 0.18, linewidth: 1 });
  pathLine = new THREE.Line(pathGeo, pathMat);
  stoneGroup.add(pathLine);
}

function startCart() {
  if (!vehicle) return;
  cartStarted = true;
  for (let i = 0; i < 4; i++) vehicle.setWheelForce(-WHEEL_TORQUE, i);
}

function stepCartTrail() {
  if (!cartStarted) return;
  const p = vehicle.chassisBody.position;
  pathPoints.push(p.x, p.y + 0.02, p.z);
  const geo = pathLine.geometry;
  const arr = geo.attributes.position.array;
  const n = Math.min(pathPoints.length / 3, arr.length / 3);
  arr.set(pathPoints.slice(0, n * 3));
  geo.setDrawRange(0, n);
  geo.attributes.position.needsUpdate = true;
  pathLine.computeLineDistances();
  const span = layout.innerRadius * 2 + layout.pierWidth * 2 + 0.4;
  if (p.x > span / 2 - 0.6) {
    for (let i = 0; i < 4; i++) vehicle.setWheelForce(0, i);
    cartStarted = false;
  }
}

function syncCartMesh() {
  if (!vehicle) return;
  cartMesh.position.copy(vehicle.chassisBody.position);
  cartMesh.quaternion.copy(vehicle.chassisBody.quaternion);
  vehicle.wheelBodies.forEach((wb, i) => {
    wheelMeshes[i].position.copy(wb.position);
    wheelMeshes[i].quaternion.copy(wb.quaternion);
  });
}

// ---------------------------------------------------------------------
// Application state / stage machine
// ---------------------------------------------------------------------
const state = {
  stage: 'paper', // paper | lifting | stone
  liftT: 0,
  cartMass: 350,
  friction: DEFAULT_FRICTION,
  rise: 2.5,
  autoplay: !DBG,
};

function setStage(name, t = 0) {
  state.stage = name;
  if (name === 'paper') {
    bridgeLines.visible = false;
    stoneGroup.visible = false;
  } else if (name === 'lifting') {
    bridgeLines.visible = true;
    stoneGroup.visible = false;
    state.liftT = t;
    setLiftT(t);
  } else if (name === 'stone') {
    bridgeLines.visible = false;
    stoneGroup.visible = true;
    if (!world) buildStoneStage();
  }
}

function rebuildForRise(rise) {
  const wasStone = state.stage === 'stone';
  layout = makeLayout(rise);
  lineRig = buildLineRig();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(lineRig.flatPositions.slice(), 3));
  if (wasStone) buildStoneStage();
}

// ---------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------
function $(id) { return document.getElementById(id); }
if (!DBG) {
  $('massSlider').addEventListener('input', (e) => {
    state.cartMass = Number(e.target.value);
    $('massVal').textContent = state.cartMass;
    if (vehicle) { vehicle.chassisBody.mass = state.cartMass; vehicle.chassisBody.updateMassProperties(); }
  });
  $('riseSlider').addEventListener('input', (e) => {
    state.rise = Number(e.target.value);
    $('riseVal').textContent = state.rise.toFixed(1);
    rebuildForRise(state.rise);
  });
  $('frictionSlider').addEventListener('input', (e) => {
    state.friction = Number(e.target.value);
    $('frictionVal').textContent = state.friction.toFixed(2);
    if (world) {
      for (const cm of world.contactmaterials) {
        if (cm.materials.includes(archMat)) cm.friction = state.friction;
      }
    }
  });
  $('removeKeystoneBtn').addEventListener('click', () => {
    if (world && bodies && !bodies.keystoneRemoved) removeKeystone(world, bodies);
  });
  $('startBtn').addEventListener('click', () => {
    state.autoplay = false;
    runIntro();
  });
}

// ---------------------------------------------------------------------
// Intro sequence (paper -> lift -> stone -> cart)
// ---------------------------------------------------------------------
function runIntro() {
  setStage('paper');
  const liftStart = performance.now() + 1400;
  const liftDur = 2600;
  function tick(now) {
    if (now < liftStart) { requestAnimationFrame(tick); return; }
    const t = Math.min(1, (now - liftStart) / liftDur);
    setStage('lifting', t);
    if (t < 1) { requestAnimationFrame(tick); return; }
    setTimeout(() => {
      setStage('stone');
      setTimeout(startCart, 900);
    }, 500);
  }
  requestAnimationFrame(tick);
}
if (state.autoplay) runIntro();

// ---------------------------------------------------------------------
// Fixed-step physics loop
// ---------------------------------------------------------------------
let physicsAccumulator = 0;
let lastFrameTime = null;
function stepPhysics(n = 1) {
  for (let i = 0; i < n; i++) {
    if (world) world.step(FIXED_DT);
    stepCartTrail();
  }
}

function renderFrame() {
  if (world && state.stage === 'stone') {
    syncStoneMeshes();
    syncCartMesh();
  }
  controls.update();
  renderer.render(scene, camera);
}

function animate(now) {
  if (!DBG) {
    if (lastFrameTime == null) lastFrameTime = now;
    let dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    dt = Math.min(dt, 0.05);
    physicsAccumulator += dt;
    let steps = 0;
    while (physicsAccumulator >= FIXED_DT && steps < 6) {
      stepPhysics(1);
      physicsAccumulator -= FIXED_DT;
      steps++;
    }
    renderFrame();
    requestAnimationFrame(animate);
  }
}
resize();
if (!DBG) requestAnimationFrame(animate);

// ---------------------------------------------------------------------
// Debug hook for puppeteer: deterministic, no rAF.
// ---------------------------------------------------------------------
if (DBG) {
  window.__bridge = {
    setStage,
    step: (n = 1) => stepPhysics(n),
    render: () => renderFrame(),
    startCart,
    removeKeystone: () => { if (world && bodies) removeKeystone(world, bodies); },
    setFriction: (v) => {
      state.friction = v;
      if (world) for (const cm of world.contactmaterials) if (cm.materials.includes(archMat)) cm.friction = v;
    },
    setCartMass: (v) => { state.cartMass = v; if (vehicle) { vehicle.chassisBody.mass = v; vehicle.chassisBody.updateMassProperties(); } },
    setRise: (v) => { state.rise = v; rebuildForRise(v); },
    buildStoneStage: () => buildStoneStage(),
    state: () => ({
      stage: state.stage,
      maxRingDisplacement: bodies ? maxRingDisplacement(bodies) : null,
      keystoneRemoved: bodies ? !!bodies.keystoneRemoved : false,
      cartX: vehicle ? vehicle.chassisBody.position.x : null,
      deckY: bodies ? bodies.deck.position.y : null,
    }),
  };
  renderFrame();
}
