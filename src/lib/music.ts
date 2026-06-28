// Music system: fixed level-based tracks with seamless looping and 0.5s
// crossfade transitions. Each level maps to a specific track. Levels 10+
// always play the "Level 10 + Endless" track.
import lvl1 from "@/assets/music/Level_1.mp3.asset.json";
import lvl2 from "@/assets/music/Level_2.mp3.asset.json";
import lvl3 from "@/assets/music/Level_3.mp3.asset.json";
import lvl4 from "@/assets/music/Level_4.mp3.asset.json";
import lvl5 from "@/assets/music/Level_5.mp3.asset.json";
import lvl6 from "@/assets/music/Level_6.mp3.asset.json";
import lvl7 from "@/assets/music/Level_7.mp3.asset.json";
import lvl8 from "@/assets/music/Level_8.mp3.asset.json";
import lvl9 from "@/assets/music/Level_9.mp3.asset.json";
import lvl10 from "@/assets/music/Level_10_endless.mp3.asset.json";
import home from "@/assets/music/Home.mp3.asset.json";

const LEVEL_TRACKS: string[] = [
  lvl1.url, lvl2.url, lvl3.url, lvl4.url, lvl5.url,
  lvl6.url, lvl7.url, lvl8.url, lvl9.url, lvl10.url,
];

const HOME_TRACK: string = home.url;

const FADE_MS = 500;
const TARGET_VOLUME = 0.55;
const STORAGE_KEY = "btr_music_enabled";

function trackForLevel(level: number): string {
  const idx = Math.max(1, Math.min(10, Math.floor(level))) - 1;
  return LEVEL_TRACKS[idx];
}

class MusicEngine {
  private current: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;
  private fadeTimers: number[] = [];
  private enabled = true;
  private desiredUrl: string | null = null; // what should be playing right now

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
    } else if (this.desiredUrl) {
      this.crossfadeTo(this.desiredUrl);
    }
  }

  /** Play the home/menu track on loop. */
  playHome() {
    this.setTrack(HOME_TRACK);
  }

  /** Play the fixed track for the given level. Levels >= 10 reuse track 10. */
  playLevel(level: number) {
    this.setTrack(trackForLevel(level));
  }

  /** Stop all playback (used when the music toggle is turned off). */
  stop() {
    this.desiredUrl = null;
    this.stopImmediate();
  }

  private setTrack(url: string | null) {
    this.desiredUrl = url;
    if (!this.enabled) return;
    if (url === null) { this.stopImmediate(); return; }
    if (url === this.currentUrl && this.current && !this.current.paused) return;
    this.crossfadeTo(url);
  }

  private stopImmediate() {
    this.clearFades();
    if (this.current) {
      const a = this.current;
      try { a.pause(); } catch { /* ignore */ }
      this.current = null;
      this.currentUrl = null;
    }
  }

  private clearFades() {
    for (const id of this.fadeTimers) clearInterval(id);
    this.fadeTimers = [];
  }

  private crossfadeTo(url: string) {
    this.clearFades();
    const next = new Audio(url);
    next.loop = true; // seamless infinite loop per spec
    next.volume = 0;
    next.preload = "auto";
    const playPromise = next.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => { /* autoplay blocked; resumes on next gesture */ });
    }

    const prev = this.current;
    this.current = next;
    this.currentUrl = url;

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
