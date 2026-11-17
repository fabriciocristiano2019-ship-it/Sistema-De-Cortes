// Sounds of the agents at work, synthesised with the Web Audio API: no audio
// files, no typing sounds. A soft low hum while any agent works, a short sci-fi
// blip when one starts, a two-note chime when one finishes, a rising chord when
// the whole job is done, and a low tone on failure.
//
// Browsers only allow audio after the person interacts with the page, so the
// context is created on the first click/keypress; until then nothing plays.

const KEY = 'os_sede_som';
const VOL_KEY = 'os_sede_volume';
let ctx = null;
let master = null;
let hum = null;

export function somLigado() {
  try { return localStorage.getItem(KEY) !== '0'; } catch (_) { return true; }
}

// Volume of the agents' sounds, 0-100 (Settings panel). 50 = the original level.
export function volume() {
  try {
    const v = Number(localStorage.getItem(VOL_KEY));
    return localStorage.getItem(VOL_KEY) !== null && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 50;
  } catch (_) { return 50; }
}

export function setVolume(v) {
  const n = Math.min(100, Math.max(0, Math.round(Number(v) || 0)));
  try { localStorage.setItem(VOL_KEY, String(n)); } catch (_) { /* private mode */ }
  if (master && ctx) master.gain.setTargetAtTime(n / 100, ctx.currentTime, 0.02);
  return n;
}

export function setSom(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) { /* private mode */ }
  if (!on) pararZumbido();
}

function audio() {
  if (!somLigado()) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume() / 100;
      master.connect(ctx.destination);
    } catch (_) { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Unlock on the first interaction (autoplay policy).
if (typeof window !== 'undefined') {
  const unlock = () => { audio(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function tone(freq, { at = 0, dur = 0.18, type = 'sine', vol = 0.12, glide = null } = {}) {
  const a = audio();
  if (!a || a.state !== 'running') return;
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// One timbre per agent, so the room "sounds" like who is working.
const PITCH = { ingest: 660, library: 587, whisper: 784, vision: 880, slicer: 698, editor916: 523, captions: 988, social: 740 };

export function somInicio(agentId) {
  const f = PITCH[agentId] || 700;
  tone(f, { dur: 0.12, type: 'triangle', vol: 0.09, glide: f * 1.5 });
  tone(f * 2, { at: 0.07, dur: 0.1, type: 'sine', vol: 0.05 });
}

export function somConcluido(agentId) {
  const f = PITCH[agentId] || 700;
  tone(f, { dur: 0.16, type: 'sine', vol: 0.08 });
  tone(f * 1.25, { at: 0.09, dur: 0.22, type: 'sine', vol: 0.07 });
}

export function somFinal() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.5, type: 'sine', vol: 0.08 }));
}

export function somFalha() {
  tone(220, { dur: 0.35, type: 'sawtooth', vol: 0.05, glide: 150 });
}

export function iniciarZumbido() {
  const a = audio();
  if (!a || a.state !== 'running' || hum) return;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.035, a.currentTime + 1.2);
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 420;
  const o1 = a.createOscillator(); o1.type = 'sine'; o1.frequency.value = 82;
  const o2 = a.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 123.5;
  // Slow "breathing" of the hum.
  const lfo = a.createOscillator(); lfo.frequency.value = 0.35;
  const lfoGain = a.createGain(); lfoGain.gain.value = 0.012;
  lfo.connect(lfoGain).connect(g.gain);
  o1.connect(f); o2.connect(f); f.connect(g).connect(master);
  [o1, o2, lfo].forEach((o) => o.start());
  hum = { g, nodes: [o1, o2, lfo] };
}

export function pararZumbido() {
  if (!hum || !ctx) { hum = null; return; }
  const { g, nodes } = hum;
  hum = null;
  try {
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    nodes.forEach((o) => o.stop(ctx.currentTime + 0.9));
  } catch (_) { /* already stopped */ }
}
