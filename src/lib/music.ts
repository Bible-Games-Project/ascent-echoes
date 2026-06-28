// Music system: session-shuffled playlist with 0.5s crossfade transitions.
// All available tracks (uploaded). The system reshuffles when reaching the end.
import t01 from "@/assets/music/Manna_Grove.mp3.asset.json";
import t02 from "@/assets/music/Manna_Grove_2.mp3.asset.json";
import t03 from "@/assets/music/Pixel_Pulse.mp3.asset.json";
import t04 from "@/assets/music/Pixel_Pulse_2.mp3.asset.json";
import t05 from "@/assets/music/Pixel_Puzzle_Parade.mp3.asset.json";
import t06 from "@/assets/music/Pixel_Puzzle_Parade_2.mp3.asset.json";
import t07 from "@/assets/music/Puzzle_Quest.mp3.asset.json";
import t08 from "@/assets/music/Puzzle_Tile_Parade.mp3.asset.json";
import t09 from "@/assets/music/Temple_Tokens.mp3.asset.json";
import t10 from "@/assets/music/Temple_Tokens_2.mp3.asset.json";

const TRACK_URLS: string[] = [
  t01.url, t02.url, t03.url, t04.url, t05.url,
  t06.url, t07.url, t08.url, t09.url, t10.url,
];

const FADE_MS = 500;
const TARGET_VOLUME = 0.55;
const STORAGE_KEY = "btr_music_enabled";

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class MusicEngine {
  private playlist: string[] = [];
  private idx = -1;
  private current: HTMLAudioElement | null = null;
  private fadeTimers: number[] = [];
  private enabled = true;
  private active = false; // is the music supposed to be playing right now

  constructor() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      this.enabled = v === null ? true : v === "1";
    } catch { /* ignore */ }
  }

  isEnabled() { return this.enabled; }

  setEnabled(on: boolean) {
    this.enabled = on;
    try { localStorage.setItem(STORAGE_KEY, on ? "1" : "0"); } catch { /* ignore */ }
    if (!on) {
      this.stopImmediate();
    } else if (this.active) {
      this.startSessionAndPlay();
    }
  }

  /** Start a fresh shuffled session and begin playback at track 0. */
  startSessionAndPlay() {
    this.active = true;
    this.playlist = shuffle(TRACK_URLS);
    this.idx = -1;
    if (!this.enabled) return;
    this.advance();
  }

  /** Move to the next track in the shuffled playlist with a crossfade. */
  advance() {
    if (!this.active || !this.enabled) return;
    if (this.playlist.length === 0) this.playlist = shuffle(TRACK_URLS);
    this.idx += 1;
    if (this.idx >= this.playlist.length) {
      this.playlist = shuffle(TRACK_URLS);
      this.idx = 0;
    }
    this.crossfadeTo(this.playlist[this.idx]);
  }

  /** Stop all playback (used when leaving gameplay / disabling). */
  stop() { this.active = false; this.stopImmediate(); }

  private stopImmediate() {
    this.clearFades();
    if (this.current) {
      const a = this.current;
      try { a.pause(); } catch { /* ignore */ }
      this.current = null;
    }
  }

  private clearFades() {
    for (const id of this.fadeTimers) clearInterval(id);
    this.fadeTimers = [];
  }

  private crossfadeTo(url: string) {
    const next = new Audio(url);
    next.loop = false;
    next.volume = 0;
    next.preload = "auto";
    // Auto-advance when track ends naturally.
    next.addEventListener("ended", () => {
      if (this.current === next) this.advance();
    });
    const playPromise = next.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => { /* autoplay blocked; will resume on next user gesture */ });
    }

    const prev = this.current;
    this.current = next;

    const steps = 20;
    const tick = FADE_MS / steps;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      const k = Math.min(1, n / steps);
      next.volume = TARGET_VOLUME * k;
      if (prev) prev.volume = Math.max(0, TARGET_VOLUME * (1 - k));
      if (n >= steps) {
        window.clearInterval(id);
        this.fadeTimers = this.fadeTimers.filter((x) => x !== id);
        if (prev) { try { prev.pause(); } catch { /* ignore */ } }
      }
    }, tick);
    this.fadeTimers.push(id);
  }
}

export const music = new MusicEngine();