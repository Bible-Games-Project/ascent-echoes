// SFX system: lightweight Web Audio API synthesised sound effects.
// Independent from the music system. All sounds are generated in-memory
// so no external assets are required.

const STORAGE_KEY = "btr_sfx_enabled";

function getCtx(): AudioContext | null {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    return new Ctx();
  } catch {
    return null;
  }
}

let _ctx: AudioContext | null = null;
let _enabled = true;

try {
  const v = localStorage.getItem(STORAGE_KEY);
  _enabled = v === null ? true : v === "1";
} catch { /* ignore */ }

function ctx(): AudioContext | null {
  if (!_ctx) _ctx = getCtx();
  return _ctx;
}

function resumeIfNeeded() {
  const c = ctx();
  if (c && c.state === "suspended") {
    c.resume().catch(() => { /* ignore */ });
  }
}

function now(): number {
  const c = ctx();
  return c ? c.currentTime : 0;
}

export const sfx = {
  isEnabled() { return _enabled; },

  setEnabled(on: boolean) {
    _enabled = on;
    try { localStorage.setItem(STORAGE_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  },

  /** Short, clean, subtle tap / pop for UI buttons. */
  playClick() {
    if (!_enabled) return;
    const c = ctx();
    if (!c) return;
    resumeIfNeeded();
    const t = now();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(440, t + 0.06);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.07);
  },

  /** Pleasant two-tone chime for correct answers. */
  playCorrect() {
    if (!_enabled) return;
    const c = ctx();
    if (!c) return;
    resumeIfNeeded();
    const t = now();

    // First note — bright ding
    const o1 = c.createOscillator();
    const g1 = c.createGain();
    o1.type = "sine";
    o1.frequency.setValueAtTime(1046.5, t); // C6
    o1.frequency.exponentialRampToValueAtTime(1568, t + 0.15); // G6 glide
    g1.gain.setValueAtTime(0, t);
    g1.gain.linearRampToValueAtTime(0.216, t + 0.02);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o1.connect(g1).connect(c.destination);
    o1.start(t);
    o1.stop(t + 0.36);

    // Second note — harmonious chime
    const o2 = c.createOscillator();
    const g2 = c.createGain();
    o2.type = "triangle";
    o2.frequency.setValueAtTime(1318.5, t + 0.08); // E6
    g2.gain.setValueAtTime(0, t + 0.08);
    g2.gain.linearRampToValueAtTime(0.144, t + 0.10);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.40);
    o2.connect(g2).connect(c.destination);
    o2.start(t + 0.08);
    o2.stop(t + 0.41);
  },

  /** Soft, non-aggressive muted tone for wrong answers. */
  playWrong() {
    if (!_enabled) return;
    const c = ctx();
    if (!c) return;
    resumeIfNeeded();
    const t = now();

    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(240, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.18);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.225, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.23);
  },

  /** Uplifting sparkle chime for positive bonuses. */
  playBonus() {
    if (!_enabled) return;
    const c = ctx();
    if (!c) return;
    resumeIfNeeded();
    const t = now();

    // Quick ascending sparkle
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(1760, t + 0.18);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.30);

    // Harmonic shimmer
    const o2 = c.createOscillator();
    const g2 = c.createGain();
    o2.type = "triangle";
    o2.frequency.setValueAtTime(1174.7, t + 0.06); // D6
    g2.gain.setValueAtTime(0, t + 0.06);
    g2.gain.linearRampToValueAtTime(0.12, t + 0.08);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
    o2.connect(g2).connect(c.destination);
    o2.start(t + 0.06);
    o2.stop(t + 0.32);
  },

  /** Soft muted drop for negative bonuses / penalties. */
  playPenalty() {
    if (!_enabled) return;
    const c = ctx();
    if (!c) return;
    resumeIfNeeded();
    const t = now();

    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.25);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.32);
  },

  /** Soft wind gust for player movement. 5 natural-wind variations. */
  _lastMoveIdx: -1 as number,
  _noiseBuffer: null as AudioBuffer | null,
  _getNoiseBuffer(c: AudioContext): AudioBuffer {
    if (this._noiseBuffer && this._noiseBuffer.sampleRate === c.sampleRate) {
      return this._noiseBuffer;
    }
    const len = Math.floor(c.sampleRate * 2); // 2s of noise, looped
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    // Pink-ish noise for warmer, more natural wind tone
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + 0.0555 * white;
      b1 = 0.96 * b1 + 0.0750 * white;
      b2 = 0.85 * b2 + 0.1538 * white;
      data[i] = (b0 + b1 + b2 + white * 0.2) * 0.25;
    }
    this._noiseBuffer = buf;
    return buf;
  },
  playMove() {
    if (!_enabled) return;
    const c = ctx();
    if (!c) return;
    resumeIfNeeded();
    const t = now();

    // 5 wind variations: [duration, peakGain, filterStart, filterPeak, filterEnd, q]
    const variants: Array<[number, number, number, number, number, number]> = [
      [0.55, 0.085, 500, 1100, 600, 1.2],   // light breeze
      [0.70, 0.095, 380, 900, 420, 1.0],    // medium wind gust
      [0.60, 0.075, 700, 1400, 800, 1.5],   // airy wind flow
      [0.85, 0.090, 260, 600, 280, 0.8],    // low atmospheric hum
      [0.45, 0.070, 600, 1300, 700, 1.3],   // light natural sweep
    ];
    let idx = Math.floor(Math.random() * variants.length);
    if (idx === (this as any)._lastMoveIdx) idx = (idx + 1) % variants.length;
    (this as any)._lastMoveIdx = idx;
    const [dur, peak, fStart, fPeak, fEnd, q] = variants[idx];

    const src = c.createBufferSource();
    src.buffer = this._getNoiseBuffer(c);
    src.loop = true;
    // Random start offset so each gust feels unique
    const offset = Math.random() * src.buffer.duration;

    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = q;
    bp.frequency.setValueAtTime(fStart, t);
    bp.frequency.linearRampToValueAtTime(fPeak, t + dur * 0.35);
    bp.frequency.exponentialRampToValueAtTime(Math.max(60, fEnd), t + dur);

    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2200;

    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + dur * 0.25);
    g.gain.linearRampToValueAtTime(peak * 0.6, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);

    src.connect(bp).connect(lp).connect(g).connect(c.destination);
    src.start(t, offset);
    src.stop(t + dur + 0.05);
  },
};
