// Song data: the single source for lyrics, structure and chords.
// compose.mjs reads this to make assets/shanty.wav and assets/timing.js.

export const BPM = 100;
export const INTRO_BARS = 4;   // 9.6 s
export const OUTRO_BARS = 2;   // 4.8 s, then a short tail to 150 s
export const DURATION = 150;

// Chords: one chord per half bar (2 beats), 4 slots per lyric line.
const MINOR = [['Dm', 'Dm', 'C', 'C'], ['Dm', 'Dm', 'Am', 'Am'], ['F', 'F', 'C', 'C'], ['Gm', 'A', 'Dm', 'Dm']];
const LAND = [['F', 'F', 'C', 'C'], ['Bb', 'Bb', 'F', 'F'], ['Dm', 'Dm', 'C', 'C'], ['Bb', 'C', 'F', 'F']];
const MAJOR = [['D', 'D', 'A', 'A'], ['D', 'D', 'G', 'G'], ['Bm', 'Bm', 'A', 'A'], ['G', 'A', 'D', 'D']];

export const INTRO = { key: 'Dm', chords: [['Dm', 'Dm', 'C', 'C'], ['Dm', 'Dm', 'A', 'A']],
  // The fiddle plays the chorus tune over the intro (no captions).
  tune: ['So heave away, Clawd, and haul away, crew', 'The scientist counts every wave as it grew'] };

export const PARTS = [
  { name: 'Signing On', key: 'Dm', style: 'verse', chords: MINOR, lines: [
    'Oh, Clawd was a block of the brightest orange hue',
    'With two dot eyes and stubby legs that barely grew',
    'He marched to the docks with a scientist small',
    'In a white lab coat, and they signed on with a scrawl',
  ] },
  { name: 'Heave Away', key: 'Dm', style: 'chorus', chords: MINOR, lines: [
    'So heave away, Clawd, and haul away, crew',
    'The scientist counts every wave as it grew',
    'With a stomp on the deck and a fiddle\'s cry',
    'We\'ll sail till the orange sun drops from the sky',
  ] },
  { name: 'Learning the Ropes', key: 'Dm', style: 'verse', chords: MINOR, lines: [
    'They taught him the knots but he tied up his feet',
    'He swabbed the whole deck till it squeaked clean and neat',
    'The scientist tested the salt of the sea',
    'And wrote in the notebook: Confirmed! Salty! Whee!',
  ] },
  { name: 'The Storm', key: 'Dm', style: 'storm', chords: MINOR, lines: [
    'Then the sky went black and the thunder rolled',
    'The waves grew tall and the wind blew cold',
    'Clawd held the wheel with his stubby legs braced',
    'While the scientist\'s hair stood straight up in place',
  ] },
  { name: 'Heave Through the Gale', key: 'Dm', style: 'stormChorus', chords: MINOR, lines: [
    'So heave away, Clawd, through the wind and the rain',
    'The scientist spins like a weather vane',
    'With a stomp on the deck and a mighty ho',
    'We\'ll ride out the storm wherever we go',
  ] },
  { name: 'Land Ho', key: 'F', style: 'land', chords: LAND, lines: [
    'Then the clouds broke up and the sun peeked through',
    'A gull flew by in a sky gone blue',
    'The scientist squinted through a telescope long',
    'And shouted: Land ho! and the crew burst into song',
  ] },
  { name: 'Homeward', key: 'D', style: 'finale', chords: MAJOR, lines: [
    'So heave away, Clawd, there\'s land on the lee',
    'A block and a scientist, bold as can be',
    'With a stomp on the dock and a fiddle\'s cheer',
    'We\'ll sing this shanty for many a year',
  ] },
];
