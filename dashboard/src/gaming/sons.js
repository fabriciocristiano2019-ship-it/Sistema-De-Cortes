// Sounds of the agents at work, synthesised with the Web Audio API: no audio
// files, no typing sounds, nothing licensed from anyone. A soft low hum while
// any agent works, a short sci-fi blip when one starts, a two-note chime when
// one finishes, a rising chord when the whole job is done, a falling buzz when
// an agent fails, a bright "achievement" when a clip is approved, and an
// optional ambient "control room" background track.
//
// Browsers only allow audio after the person interacts with the page, so the
// context is created on the first click/keypress; until then nothing plays.
//
// Loudness: everything goes through master -> compressor -> makeup gain, so
// the effects can be much louder (they were too quiet) without clipping when
// several play at once over the music.

const KEY = 'os_sede_som';
const VOL_KEY = 'os_sede_volume';
const MUS_KEY = 'os_sede_musica';
const MUS_VOL_KEY = 'os_sede_musica_vol';
const GANHO = 2.4;          // volume 100% = 2.4x the old level; the compressor keeps it clean
const MAKEUP = 1.6;
let ctx = null;
let master = null;          // effects
let musGain = null;         // music
let hum = null;

const ler = (k, padrao) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? padrao : v;
  } catch (_) { return padrao; }
};
const gravar = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* private mode */ } };
const pct = (v, padrao) => { const n = Number(v); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : padrao; };

export function somLigado() { return ler(KEY, '1') !== '0'; }
export function volume() { return pct(ler(VOL_KEY, '80'), 80); }
export function musicaLigada() { return ler(MUS_KEY, '1') !== '0'; }
export function volumeMusica() { return pct(ler(MUS_VOL_KEY, '35'), 35); }

export function setVolume(v) {
  const n = Math.round(pct(v, 80));
  gravar(VOL_KEY, String(n));
  if (master && ctx) master.gain.setTargetAtTime((n / 100) * GANHO, ctx.currentTime, 0.02);
  return n;
}

export function setVolumeMusica(v) {
  const n = Math.round(pct(v, 35));
  gravar(MUS_VOL_KEY, String(n));
  if (musGain && ctx) musGain.gain.setTargetAtTime(n / 100 * 0.5, ctx.currentTime, 0.1);
  return n;
}

export function setSom(on) {
  gravar(KEY, on ? '1' : '0');
  if (!on) { pararZumbido(); pararMusica(); } else if (musicaLigada()) tocarMusica();
}

export function setMusica(on) {
  gravar(MUS_KEY, on ? '1' : '0');
  if (on) tocarMusica(); else pararMusica();
}

function audio() {
  if (!somLigado()) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 5;
      comp.attack.value = 0.004; comp.release.value = 0.2;
      const makeup = ctx.createGain(); makeup.gain.value = MAKEUP;
      comp.connect(makeup).connect(ctx.destination);
      master = ctx.createGain();
      master.gain.value = (volume() / 100) * GANHO;
      master.connect(comp);
      musGain = ctx.createGain();
      musGain.gain.value = volumeMusica() / 100 * 0.5;
      musGain.connect(comp);
    } catch (_) { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Unlock on the first interaction (autoplay policy), then start the music.
if (typeof window !== 'undefined') {
  const unlock = () => {
    const a = audio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    if (a && musicaLigada()) tocarMusica();
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  // Leaving the app (another tab, phone screen off): pause the music, save battery.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pararMusica();
    else if (ctx && somLigado() && musicaLigada()) tocarMusica();
  });
}

function tone(freq, { at = 0, dur = 0.18, type = 'sine', vol = 0.12, glide = null, dest = null } = {}) {
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
  o.connect(g).connect(dest || master);
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

// An agent failed: its own pitch, falling, with a short double buzz.
export function somErroAgente(agentId) {
  const f = PITCH[agentId] || 440;
  tone(f, { dur: 0.22, type: 'square', vol: 0.05, glide: f * 0.5 });
  tone(f * 0.5, { at: 0.24, dur: 0.16, type: 'sawtooth', vol: 0.06 });
  tone(f * 0.5, { at: 0.44, dur: 0.24, type: 'sawtooth', vol: 0.06, glide: f * 0.35 });
}

export function somFinal() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.5, type: 'sine', vol: 0.08 }));
}

export function somFalha() {
  tone(220, { dur: 0.35, type: 'sawtooth', vol: 0.07, glide: 150 });
  tone(165, { at: 0.38, dur: 0.5, type: 'sawtooth', vol: 0.06, glide: 98 });
}

// A clip approved: bright rising "achievement" with a sparkle on top.
export function somAprovado() {
  [784, 988, 1175, 1568].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.32, type: 'triangle', vol: 0.08 }));
  [2093, 2637, 3136].forEach((f, i) => tone(f, { at: 0.3 + i * 0.05, dur: 0.25, type: 'sine', vol: 0.035 }));
  tone(392, { at: 0, dur: 0.6, type: 'sine', vol: 0.06 });
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

// --------------------------------------------------------------------------- //
// Background music: an ambient "control room" loop, generated live
// (Am - F - C - G, 84 bpm): soft pad, sub bass and a quiet echoing arpeggio.
// --------------------------------------------------------------------------- //
const BPM = 84;
const BEAT = 60 / BPM;
const N = (m) => 440 * 2 ** ((m - 69) / 12);          // MIDI note -> Hz
const ACORDES = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];   // Am F C G
let musica = null;

function pad(a, freqs, t, dur, dest) {
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.05, t + 1.2);
  g.gain.setValueAtTime(0.05, t + dur - 1.0);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.5;
  f.connect(g).connect(dest);
  freqs.forEach((hz) => [-6, 6].forEach((cents) => {
    const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz; o.detune.value = cents;
    o.connect(f); o.start(t); o.stop(t + dur + 0.7);
  }));
}

function agendarCompasso(a, i, t) {
  const acorde = ACORDES[i % ACORDES.length];
  const dur = 8 * BEAT;                                // each chord: 2 bars
  pad(a, acorde.map(N), t, dur, musica.bus);
  const baixo = N(acorde[0] - 12);
  [0, 4].forEach((b) => tone(baixo, { at: t - a.currentTime + b * BEAT, dur: 3.6 * BEAT, type: 'sine', vol: 0.09, dest: musica.bus }));
  const notas = [...acorde, acorde[0] + 12].map((m) => N(m + 12));
  for (let k = 0; k < 16; k += 1) {                    // eighth notes, gentle
    if (k % 2 === 1 && k % 4 !== 3) continue;
    tone(notas[k % notas.length], { at: t - a.currentTime + k * BEAT / 2, dur: 0.35, type: 'triangle', vol: 0.025, dest: musica.eco });
  }
  return t + dur;
}

export function tocarMusica() {
  const a = audio();
  if (!a || musica || !musicaLigada() || (typeof document !== 'undefined' && document.hidden)) return;
  const bus = a.createGain();
  bus.gain.setValueAtTime(0.0001, a.currentTime);
  bus.gain.linearRampToValueAtTime(1, a.currentTime + 3);
  bus.connect(musGain);
  // Echo for the arpeggio.
  const eco = a.createGain(); eco.connect(bus);
  const delay = a.createDelay(1.5); delay.delayTime.value = BEAT * 0.75;
  const fb = a.createGain(); fb.gain.value = 0.35;
  eco.connect(delay).connect(fb).connect(delay); delay.connect(bus);
  musica = { bus, eco, i: 0, prox: a.currentTime + 0.1, timer: null };
  const agendar = () => {
    if (!musica || !ctx) return;
    while (musica.prox < ctx.currentTime + 2 * 8 * BEAT) {
      musica.prox = agendarCompasso(ctx, musica.i, musica.prox);
      musica.i += 1;
    }
  };
  agendar();
  musica.timer = setInterval(agendar, 1000);
}

export function pararMusica() {
  if (!musica) return;
  const m = musica;
  musica = null;
  clearInterval(m.timer);
  if (!ctx) return;
  try {
    m.bus.gain.cancelScheduledValues(ctx.currentTime);
    m.bus.gain.setValueAtTime(Math.max(0.0001, m.bus.gain.value), ctx.currentTime);
    m.bus.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    setTimeout(() => { try { m.bus.disconnect(); } catch (_) { /* gone */ } }, 1500);
  } catch (_) { /* already stopped */ }
}

export const musicaTocando = () => !!musica;
