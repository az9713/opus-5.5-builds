// SPRAYWAVE RALLY — static game data: racers, classes, tracks, items.
// All character and track names are original to this game.

const CHARACTERS = [
  { id: 'pip',   name: 'Pip Tidewell',    tag: 'Tiny, twitchy, and always first off the line.',
    color: '#ffcc00', accent: '#ff7a00', skin: '#ffd9b3', hair: '#ff8c1a', style: 'spiky',
    stats: { speed: 3, accel: 5, handling: 4, weight: 1 } },
  { id: 'marina', name: 'Marina Zest',    tag: 'Carves turns like she is drawing on glass.',
    color: '#ff4fa0', accent: '#ffffff', skin: '#f2c29b', hair: '#7a2bff', style: 'ponytail',
    stats: { speed: 3, accel: 4, handling: 5, weight: 2 } },
  { id: 'kiki',  name: 'Kiki Squall',     tag: 'Rides the storm front for fun.',
    color: '#27d9ff', accent: '#0a4aa8', skin: '#c98b5e', hair: '#ffffff', style: 'bun',
    stats: { speed: 4, accel: 4, handling: 3, weight: 2 } },
  { id: 'dash',  name: 'Dash Monsoon',    tag: 'Top speed or nothing. Brakes are optional.',
    color: '#ff5a1f', accent: '#1b1b1b', skin: '#e0ac7e', hair: '#222222', style: 'mohawk',
    stats: { speed: 5, accel: 3, handling: 2, weight: 3 } },
  { id: 'luma',  name: 'Luma Reef',       tag: 'Marine biologist by day, lagoon legend by night.',
    color: '#9b6bff', accent: '#39ffb0', skin: '#8d5a3b', hair: '#39ffb0', style: 'bob',
    stats: { speed: 4, accel: 3, handling: 4, weight: 3 } },
  { id: 'rex',   name: 'Rex Undertow',     tag: 'Former lifeguard. Knows every current.',
    color: '#2ecc40', accent: '#ffe600', skin: '#f0c090', hair: '#c46a1b', style: 'flat',
    stats: { speed: 4, accel: 2, handling: 3, weight: 4 } },
  { id: 'bo',    name: 'Big Bo Barnacle', tag: 'Heavy hull, heavy heart, heavy bumps.',
    color: '#1f5cff', accent: '#ff3b3b', skin: '#b87850', hair: '#111111', style: 'bald',
    stats: { speed: 5, accel: 2, handling: 2, weight: 5 } },
  { id: 'gus',   name: 'Old Salt Gus',    tag: 'Forty years on the water. Still not tired.',
    color: '#e8e8e8', accent: '#0f6b8f', skin: '#f1c6a0', hair: '#f5f5f5', style: 'beard',
    stats: { speed: 3, accel: 3, handling: 4, weight: 4 } },
];

const CLASSES = [
  { id: 'breeze',    name: 'BREEZE',    note: 'Easy — slower boats, relaxed rivals', speedMul: 0.82, aiSkill: 0.86 },
  { id: 'gale',      name: 'GALE',      note: 'Normal — the standard circuit',       speedMul: 1.00, aiSkill: 0.95 },
  { id: 'hurricane', name: 'HURRICANE', note: 'Hard — top speed, sharp rivals',      speedMul: 1.18, aiSkill: 1.02 },
];

// Control points are [x, z]. Tracks run counter-clockwise from the first point.
const TRACKS = [
  {
    id: 'lagoon', name: 'PALM LAGOON LOOP', subtitle: 'Calm water · sunny skies · three ramps',
    waves: 'CALM', halfWidth: 19, seed: 11,
    points: [[0,-200],[150,-210],[260,-140],[285,0],[230,120],[120,170],[20,110],[-60,160],
             [-180,190],[-270,100],[-262,-60],[-160,-170]],
    ramps: [0.24, 0.52, 0.80], crates: [0.10, 0.38, 0.66, 0.90],
    wave: { amp: 0.55, speed: 1.0 },
    sky: { top: '#2e8bff', bottom: '#bfeaff', fog: '#bfeaff', sun: '#fff6c8' },
    water: { deep: '#0a78c8', crest: '#6fe3ff' }, islandCount: 16, rockiness: 0.2,
  },
  {
    id: 'coral', name: 'CORAL CANYON RUN', subtitle: 'Choppy water · rock pillars · tight esses',
    waves: 'CHOPPY', halfWidth: 18, seed: 23,
    points: [[0,-260],[180,-250],[300,-160],[262,-40],[140,-20],[120,80],[240,150],[220,270],
             [60,300],[-80,230],[-120,110],[-240,90],[-310,-40],[-260,-180],[-130,-250]],
    ramps: [0.17, 0.47, 0.74], crates: [0.07, 0.31, 0.58, 0.87],
    wave: { amp: 1.1, speed: 1.3 },
    sky: { top: '#1aa3d9', bottom: '#d8fff6', fog: '#c8f5ee', sun: '#ffffff' },
    water: { deep: '#008f9e', crest: '#7dffe0' }, islandCount: 14, rockiness: 0.8,
  },
  {
    id: 'sunset', name: 'SUNSET SURGE BAY', subtitle: 'Big swells · long straights · hairpin',
    waves: 'BIG SWELL', halfWidth: 20, seed: 37,
    points: [[-300,-120],[-100,-160],[100,-150],[300,-170],[380,-60],[330,40],[160,40],[60,90],
             [150,160],[330,190],[300,300],[80,310],[-150,280],[-330,200],[-380,40]],
    ramps: [0.12, 0.44, 0.70], crates: [0.05, 0.28, 0.56, 0.84],
    wave: { amp: 1.9, speed: 0.8 },
    sky: { top: '#3b2a7a', bottom: '#ff9a4d', fog: '#f7a36a', sun: '#ffd27a' },
    water: { deep: '#2350b8', crest: '#ffc08a' }, islandCount: 15, rockiness: 0.4,
  },
];

const ITEMS = {
  turbo:   { name: 'TURBO',        color: '#ff8a00' },
  triple:  { name: 'TRIPLE TURBO', color: '#ff3d00' },
  torpedo: { name: 'TORPEDO',      color: '#9aa7b5' },
  mine:    { name: 'SEA MINE',     color: '#333b44' },
  shield:  { name: 'BUBBLE',       color: '#4fd1ff' },
  squall:  { name: 'SQUALL',       color: '#b48cff' },
};

// Item odds by race rank. Rows: 1st .. 8th. Rear racers get stronger items.
const ITEM_ODDS = [
  { turbo: 30, mine: 40, shield: 25, torpedo: 5 },
  { turbo: 30, mine: 25, shield: 20, torpedo: 25 },
  { turbo: 30, mine: 15, shield: 15, torpedo: 30, triple: 10 },
  { turbo: 25, mine: 10, shield: 15, torpedo: 30, triple: 20 },
  { turbo: 20, mine: 5,  shield: 10, torpedo: 30, triple: 30, squall: 5 },
  { turbo: 15, shield: 10, torpedo: 25, triple: 40, squall: 10 },
  { turbo: 10, shield: 5,  torpedo: 25, triple: 45, squall: 15 },
  { turbo: 5,  torpedo: 25, triple: 45, squall: 25 },
];
