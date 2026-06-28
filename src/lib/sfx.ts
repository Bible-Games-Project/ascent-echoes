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
};
