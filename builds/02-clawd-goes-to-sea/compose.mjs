// Composes the shanty in code and renders it.
// Output: assets/shanty.wav (44.1 kHz, 16-bit stereo) and assets/timing.js (window.TIMING).
// Instruments: fiddle (melody + harmony), concertina (oom-pah chords), bass drum, foot stomps.
// Extras under the music: sea swell, storm wind, thunder, one gull.
import fs from 'fs';
import { BPM, INTRO_BARS, OUTRO_BARS, DURATION, INTRO, PARTS } from './song.mjs';

const SR = 44100;
const BEAT = 60 / BPM, BAR = 4 * BEAT, EIGHTH = BEAT / 2;
const N = Math.ceil(DURATION * SR);
const L = new Float32Array(N), R = new Float32Array(N);
const RL = new Float32Array(N), RR = new Float32Array(N); // reverb send

// ---------- deterministic random ----------
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// ---------- helpers ----------
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
function chordInfo(name) {
  const m = name.match(/^([A-G][b#]?)(m?)$/);
  const root = PC[m[1]], minor = m[2] === 'm';
  return { root, pcs: [root, (root + (minor ? 3 : 4)) % 12, (root + 7) % 12] };
}
const SCALES = { Dm: [2, 4, 5, 7, 9, 10, 0], F: [5, 7, 9, 10, 0, 2, 4], D: [2, 4, 6, 7, 9, 11, 1] };

function add(i, l, r, send) {
  if (i < 0 || i >= N) return;
  L[i] += l; R[i] += r;
  if (send) { RL[i] += l * send; RR[i] += r * send; }
}
const panLR = p => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];

class Biquad { // RBJ cookbook
  constructor(type, f, q, gainDb = 0) {
    const w = 2 * Math.PI * f / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q), A = Math.pow(10, gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
    else if (type === 'bp') { b0 = a; b1 = 0; b2 = -a; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
    else { b0 = 1 + a * A; b1 = -2 * c; b2 = 1 - a * A; a0 = 1 + a / A; a1 = -2 * c; a2 = 1 - a / A; } // peak
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y;
  }
}

// ---------- instruments ----------
function fiddle(t0, dur, midi, vel, pan, { grace = null, vib = 1 } = {}) {
  if (grace !== null) { fiddle(t0 - 0.05, 0.06, grace, vel * 0.7, pan, { vib: 0 }); }
  const f0 = mtof(midi), [gl, gr] = panLR(pan);
  const rel = 0.09, len = Math.floor((dur + rel) * SR), i0 = Math.floor(t0 * SR);
  const K = Math.min(24, Math.floor(7000 / f0));
  const body = [new Biquad('peak', 290, 1.2, 6), new Biquad('peak', 720, 1.5, 4), new Biquad('peak', 2600, 1.2, 5), new Biquad('lp', 6500, 0.7)];
  const bowHp = new Biquad('bp', 3000, 0.8);
  let ph = 0;
  for (let n = 0; n < len; n++) {
    const t = n / SR;
    const vd = vib * Math.min(1, Math.max(0, (t - 0.12) / 0.25)) * 0.22;
    const f = f0 * Math.pow(2, vd * Math.sin(2 * Math.PI * 5.6 * t) / 12);
    ph += 2 * Math.PI * f / SR;
    let s = 0;
    for (let k = 1; k <= K; k++) s += Math.sin(k * ph) / k;
    s *= 0.55;
    const att = Math.min(1, t / 0.035);
    const swell = 0.85 + 0.15 * Math.min(1, t / Math.max(0.1, dur * 0.6));
    const env = t < dur ? att * swell : swell * Math.max(0, 1 - (t - dur) / rel);
    const bow = bowHp.run(rnd() * 2 - 1) * (0.18 + 0.5 * Math.max(0, 1 - t / 0.05));
    let y = (s + bow) * env * vel;
    for (const b of body) y = b.run(y);
    add(i0 + n, y * gl, y * gr, 0.28);
  }
}

function concertinaNote(t0, dur, midi, vel, pan) {
  const [gl, gr] = panLR(pan), i0 = Math.floor(t0 * SR);
  const rel = 0.05, len = Math.floor((dur + rel) * SR);
  const f0 = mtof(midi), K = Math.min(30, Math.floor(5000 / f0)), duty = 0.32;
  const amps = []; for (let k = 1; k <= K; k++) amps.push(Math.sin(Math.PI * k * duty) / k);
  const lp = new Biquad('lp', 3200, 0.7);
  let p1 = rnd() * 6, p2 = rnd() * 6;
  const d1 = f0 * Math.pow(2, 4 / 1200), d2 = f0 * Math.pow(2, -4 / 1200); // musette detune
  for (let n = 0; n < len; n++) {
    const t = n / SR;
    p1 += 2 * Math.PI * d1 / SR; p2 += 2 * Math.PI * d2 / SR;
    let s = 0;
    for (let k = 0; k < K; k++) s += amps[k] * (Math.cos((k + 1) * p1) + Math.cos((k + 1) * p2));
    const env = (t < dur ? Math.min(1, t / 0.018) : Math.max(0, 1 - (t - dur) / rel)) * (1 + 0.04 * Math.sin(2 * Math.PI * 4 * t));
    const y = lp.run(s * 0.25) * env * vel;
    add(i0 + n, y * gl, y * gr, 0.18);
  }
}
function concertinaChord(t0, dur, midis, vel, pan) { for (const m of midis) concertinaNote(t0, dur, m, vel, pan); }

function kick(t0, vel) {
  const i0 = Math.floor(t0 * SR), len = Math.floor(0.45 * SR);
  let ph = 0;
  for (let n = 0; n < len; n++) {
    const t = n / SR, f = 46 + 90 * Math.exp(-t / 0.035);
    ph += 2 * Math.PI * f / SR;
    const y = (Math.sin(ph) * Math.exp(-t / 0.26) + (t < 0.004 ? (rnd() * 2 - 1) * 0.3 : 0)) * vel;
    add(i0 + n, y, y, 0.05);
  }
}

function stomp(t0, vel, feet = 3) {
  for (let fIdx = 0; fIdx < feet; fIdx++) {
    const off = fIdx === 0 ? 0 : (rnd() * 0.022), v = vel * (fIdx === 0 ? 1 : 0.55 + rnd() * 0.25);
    const i0 = Math.floor((t0 + off) * SR), len = Math.floor(0.3 * SR);
    const bp = new Biquad('bp', 240 + rnd() * 80, 1.4), knock = new Biquad('bp', 1100 + rnd() * 400, 3);
    let ph = 0; const fb = 80 + rnd() * 20;
    for (let n = 0; n < len; n++) {
      const t = n / SR;
      ph += 2 * Math.PI * (fb * (1 + 0.6 * Math.exp(-t / 0.02))) / SR;
      const nz = rnd() * 2 - 1;
      const y = (Math.sin(ph) * Math.exp(-t / 0.07) * 0.9 + bp.run(nz) * Math.exp(-t / 0.05) * 2.2 + knock.run(nz) * Math.exp(-t / 0.018) * 1.4) * v;
      add(i0 + n, y * 0.95, y * 1.05, 0.35);
    }
  }
}

function noiseBed(t0, t1, vel, fLo, fHi, lfoHz, send = 0.2) {
  const i0 = Math.floor(t0 * SR), len = Math.floor((t1 - t0) * SR);
  let bp = new Biquad('bp', fLo, 0.9); let lastF = fLo;
  for (let n = 0; n < len; n++) {
    const t = n / SR;
    const m = 0.5 - 0.5 * Math.cos(2 * Math.PI * lfoHz * t);
    if (n % 256 === 0) { const f = fLo + (fHi - fLo) * m; if (Math.abs(f - lastF) > 2) { const s = bp; bp = new Biquad('bp', f, 0.9); bp.x1 = s.x1; bp.x2 = s.x2; bp.y1 = s.y1; bp.y2 = s.y2; lastF = f; } }
    const edge = Math.min(1, t / 1.5, (t1 - t0 - t) / 1.5);
    const y = bp.run(rnd() * 2 - 1) * vel * (0.35 + 0.65 * m) * edge;
    add(i0 + n, y * (0.8 + 0.2 * Math.sin(t)), y * (0.8 - 0.2 * Math.sin(t)), send);
  }
}

function thunder(t0, vel) {
  const i0 = Math.floor(t0 * SR), len = Math.floor(3.2 * SR);
  const lp = new Biquad('lp', 160, 0.8), hp = new Biquad('hp', 1800, 0.7);
  let brown = 0;
  for (let n = 0; n < len; n++) {
    const t = n / SR, w = rnd() * 2 - 1;
    brown = brown * 0.985 + w * 0.15;
    const rumble = lp.run(brown) * 3.2 * Math.min(1, t / 0.08) * Math.exp(-t / 1.1) * (1 + 0.5 * Math.sin(2 * Math.PI * 1.7 * t));
    const crack = hp.run(w) * Math.exp(-t / 0.05) * 0.9;
    const y = (rumble + crack) * vel;
    add(i0 + n, y, y * 0.92, 0.4);
  }
}

function gull(t0, vel) {
  for (const [dt, d] of [[0, 0.32], [0.42, 0.22], [0.7, 0.2]]) {
    const i0 = Math.floor((t0 + dt) * SR), len = Math.floor(d * SR);
    let ph = 0;
    for (let n = 0; n < len; n++) {
      const t = n / SR, u = t / d;
      const f = 1500 + 700 * Math.sin(Math.PI * u) - 400 * u;
      ph += 2 * Math.PI * f / SR;
      const y = (Math.sin(ph) + 0.4 * Math.sin(2 * ph) + 0.2 * Math.sin(3 * ph)) * Math.sin(Math.PI * u) * vel;
      add(i0 + n, y * 0.6, y * 0.9, 0.3);
    }
  }
}

// ---------- melody from lyrics ----------
const STOP = new Set(['with', 'that', 'they', 'then', 'from', 'into', 'have', 'this', 'there', 'where', 'what', 'were', 'will', 'your', 'till', 'the', 'and', 'a', 'of', 'in', 'on', 'as', 'to', 'his', 'up', 'by', 'but', 'so', 'we\'ll', 'it', 'oh']);
const bare = w => w.toLowerCase().replace(/[^a-z']/g, '');
function tokenize(line) { return line.split(/\s+/).filter(w => /[A-Za-z]/.test(w)); }

// Durations in eighth notes. A line is 2 bars = 16 eighths; the last word holds 4.
function rhythm(words) {
  const n = words.length, budget = 12;
  const w = words.slice(0, -1).map(x => (bare(x).length >= 4 && !STOP.has(bare(x))) || /^Clawd/.test(x) ? 2 : 1);
  let sum = w.reduce((a, b) => a + b, 0);
  for (let i = w.length - 1; sum > budget && i >= 0; i--) if (w[i] === 2) { w[i] = 1; sum--; }
  if (sum > budget) throw new Error('Line too long: ' + words.join(' '));
  let guard = 0;
  while (sum < budget && guard++ < 100) {
    for (let i = 0; i < w.length && sum < budget; i++) if (w[i] >= 2 && w[i] < 3) { w[i]++; sum++; }
    if (sum < budget) for (let i = w.length - 1; i >= 0 && sum < budget; i--) if (w[i] === 1) { w[i] = 2; sum++; break; }
  }
  return [...w, 16 - sum];
}

const CONTOURS = [[-5, 0, 3, 5, 7], [7, 5, 3, 0, -3], [0, 3, 7, 10, 12], [12, 7, 5, 2, 0]];
const BASE = 74; // D5
function contourAt(c, p) { const x = p * 4, i = Math.min(3, Math.floor(x)); return c[i] + (c[i + 1] - c[i]) * (x - i); }
function snap(target, pcs) {
  let best = null, bd = 1e9;
  for (let m = Math.floor(target) - 7; m <= Math.ceil(target) + 7; m++) {
    if (!pcs.includes(((m % 12) + 12) % 12)) continue;
    const d = Math.abs(m - target) - (m > target ? 0.01 : 0);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}
function allowedPcs(key, chord) {
  const ch = chordInfo(chord).pcs;
  const sc = SCALES[key].filter(pc => !ch.some(c => (pc - c + 12) % 12 === 1 || (c - pc + 12) % 12 === 1) || ch.includes(pc));
  return [...new Set([...ch, ...sc])];
}

function lineMelody(text, lineStart, lineIdx, key, chords) {
  const words = tokenize(text), durs = rhythm(words);
  const out = []; let e = 0, prev = null;
  words.forEach((w, i) => {
    const t0 = lineStart + e * EIGHTH, t1 = t0 + durs[i] * EIGHTH;
    const slot = Math.min(3, Math.floor(e / 4)), chord = chords[slot];
    const p = e / 12, strong = e % 4 === 0 || i === words.length - 1;
    let target = BASE + contourAt(CONTOURS[lineIdx % 4], Math.min(1, p)) + (i % 2 && !strong ? 1.2 : 0);
    const pcs = strong ? chordInfo(chord).pcs : allowedPcs(key, chord);
    let m = snap(target, pcs);
    if (prev !== null && Math.abs(m - prev) > 7) m = snap(prev + Math.sign(m - prev) * 4, pcs);
    out.push({ w, t0, t1, midi: m, chord, e, dur: durs[i] });
    prev = m; e += durs[i];
  });
  return out;
}

// ---------- arrangement ----------
const timing = { bpm: BPM, beat: BEAT, bar: BAR, duration: DURATION, introEnd: INTRO_BARS * BAR, parts: [], events: [] };
const VOICE = { Dm: 50, C: 48, Am: 45, F: 53, Gm: 55, A: 45, Bb: 46, D: 50, G: 55, Bm: 47 };

function chordVoicing(name) { // close voicing around D4-A4
  const { pcs } = chordInfo(name);
  return pcs.map(pc => { let m = 60 + pc; if (m < 60) m += 12; if (m > 69) m -= 12; return m; }).sort((a, b) => a - b);
}

function accompany(t0, chordsPerSlot, style, bars) {
  // chordsPerSlot: flat list of half-bar chords covering `bars` bars
  for (let b = 0; b < bars; b++) {
    const tb = t0 + b * BAR;
    for (let beat = 0; beat < 4; beat++) {
      const t = tb + beat * BEAT, chord = chordsPerSlot[b * 2 + (beat >> 1)];
      const root = VOICE[chord], voic = chordVoicing(chord);
      const soft = style === 'land' || style === 'intro';
      // concertina oom-pah
      if (beat % 2 === 0) concertinaNote(t, BEAT * 0.55, beat === 0 ? root : root + 7, soft ? 0.16 : 0.2, -0.35);
      else concertinaChord(t, BEAT * (soft ? 0.8 : 0.45), voic, soft ? 0.09 : 0.11, -0.35);
      if (style === 'storm' || style === 'stormChorus') concertinaChord(t + EIGHTH, EIGHTH * 0.6, voic, 0.07, -0.25);
      if (style === 'finale' && beat % 2 === 1) concertinaChord(t + EIGHTH, EIGHTH * 0.6, voic.map(m => m + 12), 0.05, -0.2);
      // drums
      const introQuiet = style === 'intro' && b < 2;
      if (beat % 2 === 0 && !introQuiet) kick(t, style === 'finale' ? 0.62 : 0.55);
      if ((style === 'storm' || style === 'stormChorus') && beat === 1) kick(t + EIGHTH, 0.42);
      if (beat % 2 === 1) stomp(t, style === 'intro' ? 0.28 : 0.36, style === 'finale' || style === 'stormChorus' ? 4 : 3);
    }
  }
}

// Intro
{
  const flat = INTRO.chords.flat();
  accompany(0, flat, 'intro', INTRO_BARS);
  INTRO.tune.forEach((line, li) => {
    const mel = lineMelody(line, li * 2 * BAR, li, INTRO.key, INTRO.chords[li]);
    for (const n of mel) fiddle(n.t0, (n.t1 - n.t0) * 0.92, n.midi, 0.26, 0.3, { grace: n.dur >= 3 ? n.midi + 2 : null });
  });
}

// Parts
let t = INTRO_BARS * BAR;
PARTS.forEach((part, pi) => {
  const pt0 = t, P = { index: pi, name: part.name, style: part.style, t0: pt0, t1: pt0 + 8 * BAR, lines: [] };
  accompany(pt0, part.chords.flat(), part.style, 8);
  part.lines.forEach((text, li) => {
    const ls = pt0 + li * 2 * BAR;
    const mel = lineMelody(text, ls, li, part.key, part.chords[li]);
    const chorus = /chorus|finale/i.test(part.style);
    for (const n of mel) {
      fiddle(n.t0, (n.t1 - n.t0) * 0.9, n.midi, 0.27, 0.3, { grace: n.dur >= 3 ? n.midi + 2 : null });
      if (chorus) { // harmony fiddle a third-ish below on chord tones
        const h = snap(n.midi - 3.5, chordInfo(n.chord).pcs);
        fiddle(n.t0 + 0.012, (n.t1 - n.t0) * 0.88, h, 0.13, 0.55, { vib: 0.7 });
      }
    }
    P.lines.push({ index: pi * 4 + li, text, t0: ls, t1: ls + 2 * BAR, words: mel.map(n => ({ w: n.w, t0: +n.t0.toFixed(3), t1: +n.t1.toFixed(3) })) });
  });
  // stomp fill into the next part: beat 4 and its "and" of the last bar
  const fillT = pt0 + 8 * BAR - BEAT;
  stomp(fillT + EIGHTH, 0.3, 3);
  timing.events.push({ type: 'stompFill', t: +fillT.toFixed(3) });
  timing.parts.push(P);
  t += 8 * BAR;
});
const partT = i => timing.parts[i].t0;

// Outro: stomp stomp HEY + long D chord
{
  const t0 = t;
  kick(t0, 0.7); stomp(t0, 0.45, 5); stomp(t0 + BEAT, 0.45, 5); kick(t0 + 2 * BEAT, 0.8); stomp(t0 + 2 * BEAT, 0.55, 6);
  concertinaChord(t0 + 2 * BEAT, 2.6, [62, 66, 69, 74], 0.1, -0.35); concertinaNote(t0 + 2 * BEAT, 2.6, 38, 0.2, -0.3);
  fiddle(t0 + 2 * BEAT, 2.8, 86, 0.26, 0.3, { grace: 88 }); fiddle(t0 + 2 * BEAT, 2.8, 81, 0.14, 0.55);
  timing.events.push({ type: 'hey', t: +(t0 + 2 * BEAT).toFixed(3) });
  timing.outro = { t0, t1: DURATION };
}

// Sea, storm and gull
noiseBed(0, partT(3), 0.035, 250, 700, 1 / 6.4, 0.1);
noiseBed(partT(3) - 1, partT(5) + 1.5, 0.09, 350, 1400, 1 / 3.1, 0.25);
noiseBed(partT(5), DURATION, 0.03, 250, 700, 1 / 6.4, 0.1);
for (const [pi, li, dt, v] of [[3, 0, 0.5, 0.55], [3, 2, 1.2, 0.4], [4, 0, 0.2, 0.5], [4, 3, 0.4, 0.45]]) {
  const tt = timing.parts[pi].lines[li].t0 + dt; thunder(tt, v); timing.events.push({ type: 'thunder', t: +tt.toFixed(3) });
}
{ const tt = timing.parts[5].lines[1].t0 + 0.4; gull(tt, 0.08); timing.events.push({ type: 'gull', t: +tt.toFixed(3) }); }
timing.events.sort((a, b) => a.t - b.t);

// ---------- reverb (Schroeder) ----------
function reverb(inp, out, spread) {
  const combs = [1557, 1617, 1491, 1422].map(d => ({ b: new Float32Array(d + spread), i: 0, lp: 0 }));
  const aps = [225, 556].map(d => ({ b: new Float32Array(d + spread), i: 0 }));
  for (let n = 0; n < N; n++) {
    let s = 0; const x = inp[n] * 0.2;
    for (const c of combs) { const y = c.b[c.i]; c.lp = y * 0.7 + c.lp * 0.3; c.b[c.i] = x + c.lp * 0.8; c.i = (c.i + 1) % c.b.length; s += y; }
    for (const a of aps) { const y = a.b[a.i]; const v = s + y * 0.5; a.b[a.i] = v; s = y - v * 0.5; a.i = (a.i + 1) % a.b.length; }
    out[n] += s;
  }
}
reverb(RL, L, 0); reverb(RR, R, 23);

// ---------- master: fades, soft clip, normalize, write ----------
let raw = 0;
for (let n = 0; n < N; n++) raw = Math.max(raw, Math.abs(L[n]), Math.abs(R[n]));
// Scale so the 99.95th percentile sample lands at 1.0; tanh rounds off the few louder hits.
const sample = []; for (let n = 0; n < N; n += 7) sample.push(Math.max(Math.abs(L[n]), Math.abs(R[n])));
sample.sort((a, b) => a - b);
const pre = 1.0 / sample[Math.floor(sample.length * 0.9995)];
let peak = 0;
for (let n = 0; n < N; n++) {
  const tt = n / SR, fade = Math.min(1, tt / 0.05, (DURATION - tt) / 1.2);
  L[n] = Math.tanh(L[n] * pre) * fade; R[n] = Math.tanh(R[n] * pre) * fade;
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
const gain = 0.891 / peak; // -1 dBFS
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let n = 0; n < N; n++) {
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[n] * gain * 32767))), 44 + n * 4);
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[n] * gain * 32767))), 46 + n * 4);
}
fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync('assets/shanty.wav', buf);
fs.writeFileSync('assets/timing.js', '// Generated by compose.mjs. Do not edit.\nwindow.TIMING = ' + JSON.stringify(timing, null, 1) + ';\n');
console.log(`wrote assets/shanty.wav (${DURATION}s, raw mix peak ${raw.toFixed(2)}) and assets/timing.js`);
console.log(`parts: ${timing.parts.map(p => p.t0.toFixed(1)).join(', ')} | outro ${timing.outro.t0.toFixed(1)}`);
