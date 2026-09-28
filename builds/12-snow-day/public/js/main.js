import * as THREE from 'three';
import { World } from './world.js';
import { createNetwork } from './network.js';
import { buildTerrain } from './terrain.js';
import { buildSnowblower, buildDriverFigure } from './snowblower.js';
import { buildHotel } from './hotel.js';
import { createSnowfall, createPlumeSystem } from './snowfx.js';
import { createMinimap } from './minimap.js';
import { createChat } from './chat.js';

const world = new World();

// ---------- join screen ----------
const joinScreen = document.getElementById('join-screen');
const nameInput = document.getElementById('name-input');
const joinBtn = document.getElementById('join-btn');
const hud = document.getElementById('hud');
const loadingEl = document.getElementById('loading');
loadingEl.classList.add('hidden');

const params = new URLSearchParams(location.search);
const nameFromLink = params.get('name');
nameInput.value = nameFromLink || `Plower${Math.floor(Math.random() * 1000)}`;

let started = false;
function beginGame(name) {
  if (started) return;
  started = true;
  world.pendingName = name;
  joinScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  init();
}

joinBtn.addEventListener('click', () => beginGame(nameInput.value.trim() || nameInput.placeholder));
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinBtn.click(); });

// ---------- three.js scaffolding (built once, before network state exists) ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.domElement.id = 'scene';
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const skyColor = 0xcfe0ee;
scene.background = new THREE.Color(skyColor);
scene.fog = new THREE.Fog(skyColor, 30, 130);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 400);

// low winter sun
const sun = new THREE.DirectionalLight(0xfff3df, 2.6);
sun.position.set(-40, 18, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(1536, 1536);
sun.shadow.camera.left = -55;
sun.shadow.camera.right = 55;
sun.shadow.camera.top = 55;
sun.shadow.camera.bottom = -55;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
sun.shadow.bias = -0.0015;
sun.shadow.normalBias = 0.02;
scene.add(sun);
scene.add(sun.target);

const hemi = new THREE.HemisphereLight(0xcfe3f7, 0xdfe6ea, 0.65);
scene.add(hemi);
const fill = new THREE.AmbientLight(0xffffff, 0.12);
scene.add(fill);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- game-specific state, created once we know world metadata ----------
let terrain, snowfall, plume, minimapUI, network, chatUI;
let localVehicle, wheelGroup;
const remoteVehicles = new Map(); // id -> { group, wheelGroup, driver }

const speedReadout = document.getElementById('speed-readout');
const playerListEl = document.getElementById('player-list');
const minimapCanvas = document.getElementById('minimap');
const chatLogEl = document.getElementById('chat-log');
const chatInputEl = document.getElementById('chat-input');

const input = { fwd: 0, steer: 0 };
const keyState = new Set();

function isTypingChat() {
  return document.activeElement === chatInputEl;
}

window.addEventListener('keydown', (e) => {
  if (isTypingChat()) return;
  keyState.add(e.key.toLowerCase());
});
window.addEventListener('keyup', (e) => {
  keyState.delete(e.key.toLowerCase());
});

function readInput() {
  if (isTypingChat()) { input.fwd = 0; input.steer = 0; return; }
  let fwd = 0, steer = 0;
  if (keyState.has('w') || keyState.has('arrowup')) fwd += 1;
  if (keyState.has('s') || keyState.has('arrowdown')) fwd -= 1;
  if (keyState.has('a') || keyState.has('arrowleft')) steer -= 1;
  if (keyState.has('d') || keyState.has('arrowright')) steer += 1;
  input.fwd = fwd; input.steer = steer;
}

const VEHICLE = { maxFwd: 7.2, maxRev: 3.2, accel: 7, friction: 5, turnRate: 1.7 };

function init() {
  network = createNetwork({
    world,
    onWelcome: (msg) => onWelcome(msg),
    onChat: (m) => { if (chatUI) chatUI.push(m); },
  });

  chatUI = createChat({
    logEl: chatLogEl,
    inputEl: chatInputEl,
    onSend: (text) => network.sendChat(text)
  });
}

let sceneBuilt = false;

function onWelcome(msg) {
  // A dropped/reconnected socket sends a fresh 'welcome'. Re-sync the local
  // vehicle and remotes but never rebuild the world (that would duplicate
  // the terrain, hotel, and local vehicle, and start a second render loop).
  chatUI.reset();
  for (const c of world.chat) chatUI.push(c);

  if (sceneBuilt) {
    localVehicle.position.set(world.me.x, 0, world.me.z);
    localVehicle.rotation.y = world.me.ry;
    for (const [, rv] of remoteVehicles) scene.remove(rv.group);
    remoteVehicles.clear();
    for (const p of world.remotes.values()) spawnRemote(p);
    return;
  }
  sceneBuilt = true;

  terrain = buildTerrain(scene, world.worldMeta);
  scene.add(buildHotel());
  snowfall = createSnowfall(scene);
  plume = createPlumeSystem(scene);
  minimapUI = createMinimap(minimapCanvas, world.worldMeta);

  localVehicle = buildSnowblower(world.me.color);
  localVehicle.position.set(world.me.x, 0, world.me.z);
  localVehicle.rotation.y = world.me.ry;
  scene.add(localVehicle);
  wheelGroup = localVehicle.userData.wheelGroup;

  camera.position.set(0, 1.68, -0.55);
  camera.rotation.set(0, Math.PI, 0);
  localVehicle.add(camera);

  for (const p of world.remotes.values()) spawnRemote(p);

  lastFrame = performance.now();
  requestAnimationFrame(frame);
}

function spawnRemote(p) {
  const group = buildSnowblower(p.color);
  const driver = buildDriverFigure(0x2c3b4d);
  group.add(driver);
  group.position.set(p.x, 0, p.z);
  group.rotation.y = p.ry;
  scene.add(group);
  remoteVehicles.set(p.id, { group, wheelGroup: group.userData.wheelGroup, driver });
}

function reconcileRemotes() {
  for (const id of world.remotes.keys()) {
    if (!remoteVehicles.has(id)) spawnRemote(world.remotes.get(id));
  }
  for (const id of [...remoteVehicles.keys()]) {
    if (!world.remotes.has(id)) {
      const rv = remoteVehicles.get(id);
      scene.remove(rv.group);
      remoteVehicles.delete(id);
    }
  }
}

function updatePlayerListHUD() {
  const rows = [];
  if (world.me) rows.push({ name: world.me.name + ' (you)', color: world.me.color });
  for (const p of world.remotes.values()) rows.push({ name: p.name, color: p.color });
  playerListEl.textContent = '';
  for (const r of rows) {
    const row = document.createElement('div');
    row.className = 'row';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = '#' + r.color.toString(16).padStart(6, '0');
    row.appendChild(dot);
    row.appendChild(document.createTextNode(r.name));
    playerListEl.appendChild(row);
  }
}

let lastFrame = 0;
let hudTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;

  readInput();

  // local vehicle arcade physics
  const me = world.me;
  const targetSpeed = input.fwd > 0 ? VEHICLE.maxFwd : (input.fwd < 0 ? -VEHICLE.maxRev : 0);
  if (input.fwd !== 0) {
    me.speed += Math.sign(targetSpeed - me.speed) * VEHICLE.accel * dt;
    if (Math.abs(me.speed - targetSpeed) < VEHICLE.accel * dt) me.speed = targetSpeed;
  } else {
    const decel = VEHICLE.friction * dt;
    if (Math.abs(me.speed) <= decel) me.speed = 0;
    else me.speed -= Math.sign(me.speed) * decel;
  }
  const speedFactor = Math.min(Math.abs(me.speed) / 2.5, 1);
  if (input.steer !== 0 && speedFactor > 0.02) {
    const dir = me.speed >= 0 ? 1 : -1;
    me.ry += input.steer * VEHICLE.turnRate * speedFactor * dir * dt;
  }
  me.x += Math.sin(me.ry) * me.speed * dt;
  me.z += Math.cos(me.ry) * me.speed * dt;
  const half = world.worldMeta.size / 2 - 2;
  me.x = Math.max(-half, Math.min(half, me.x));
  me.z = Math.max(-half, Math.min(half, me.z));

  localVehicle.position.set(me.x, 0, me.z);
  localVehicle.rotation.y = me.ry;
  if (wheelGroup) wheelGroup.rotation.z = -input.steer * 0.5;

  if (Math.abs(me.speed) > 0.3) {
    const fx = Math.sin(me.ry), fz = Math.cos(me.ry);
    const chuteWorld = new THREE.Vector3(0.42, 1.1, 1.85).applyMatrix4(localVehicle.matrixWorld);
    plume.emit(chuteWorld.x, chuteWorld.y, chuteWorld.z, fx, fz, 2);
  }

  // remote vehicles: interpolate toward last known networked state
  reconcileRemotes();
  for (const [id, rv] of remoteVehicles) {
    const p = world.remotes.get(id);
    if (!p) continue;
    rv.group.position.x += (p.x - rv.group.position.x) * Math.min(dt * 10, 1);
    rv.group.position.z += (p.z - rv.group.position.z) * Math.min(dt * 10, 1);
    let dRy = p.ry - rv.group.rotation.y;
    dRy = Math.atan2(Math.sin(dRy), Math.cos(dRy));
    rv.group.rotation.y += dRy * Math.min(dt * 10, 1);
    if (Math.abs(p.speed) > 0.3) {
      const fx = Math.sin(rv.group.rotation.y), fz = Math.cos(rv.group.rotation.y);
      const chuteWorld = new THREE.Vector3(0.42, 1.1, 1.85).applyMatrix4(rv.group.matrixWorld);
      plume.emit(chuteWorld.x, chuteWorld.y, chuteWorld.z, fx, fz, 2);
    }
  }

  terrain.update(world);
  snowfall.update(dt, me.x, me.z);
  plume.update(dt);
  sun.target.position.set(me.x, 0, me.z);
  sun.position.set(me.x - 40, 18, me.z + 25);

  minimapUI.draw(world);

  hudTimer += dt;
  if (hudTimer > 0.15) {
    hudTimer = 0;
    speedReadout.textContent = `${Math.round(Math.abs(me.speed) * 3.6)} km/h`;
    updatePlayerListHUD();
  }

  renderer.render(scene, camera);
}

// All top-level declarations above are initialized by this point, so it is
// now safe to auto-join when the link carried a ?name= (one-link join).
if (nameFromLink) beginGame(nameFromLink);
