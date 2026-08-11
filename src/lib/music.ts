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
import { ASSET_ORIGINS, assetUrl, isNativeShell } from "@/lib/assetUrl";
import { getAudioContext, resumeAudioContext } from "@/lib/sfx";

const LEVEL_TRACKS: string[] = [
  lvl1.url, lvl2.url, lvl3.url, lvl4.url, lvl5.url,
  lvl6.url, lvl7.url, lvl8.url, lvl9.url, lvl10.url,
];

const HOME_TRACK: string = home.url;

const FADE_MS = 500;
const TARGET_VOLUME = 0.55;
const HOME_VOLUME = TARGET_VOLUME * 0.5;
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
  private targetVol = TARGET_VOLUME;
  private gains = new WeakMap<HTMLAudioElement, GainNode>();
  private sources = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();
  private originIndex = 0;      // which hosted origin we resolve assets against
  private gestureHooked = false;

  constructor() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      this.enabled = v === null ? true : v === "1";
    } catch { /* ignore */ }
    if (typeof window !== "undefined") this.installLifecycleHooks();
  }

  /**
   * Mobile webviews block playback until a user gesture and suspend audio when
   * the app goes to the background. Retry whatever should be playing on the
   * next gesture and whenever the app becomes visible/resumed again.
   */
  private installLifecycleHooks() {
    const retry = () => {
      resumeAudioContext();
      const g = this.current ? this.gains.get(this.current) : undefined;
      if (g) g.context.state === "suspended" && (g.context as AudioContext).resume().catch(() => {});
      if (!this.enabled || !this.desiredUrl) return;
      if (this.current && !this.current.paused) return;
      const url = this.desiredUrl;
      this.currentUrl = null;
      this.crossfadeTo(url);
    };
    for (const ev of ["pointerdown", "touchend", "keydown"]) {
      window.addEventListener(ev, retry, { passive: true });
    }
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") retry();
    });
    window.addEventListener("pageshow", retry);
    document.addEventListener("resume", retry);       // Cordova/Capacitor app resume
    window.addEventListener("focus", retry);
    this.gestureHooked = true;
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
    this.targetVol = HOME_VOLUME;
    this.setTrack(HOME_TRACK);
  }

  /** Play the fixed track for the given level. Levels >= 10 reuse track 10. */
  playLevel(level: number) {
    this.targetVol = TARGET_VOLUME;
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
    const next = new Audio();
    // Cross-origin is required in native shells (assets live on the hosted
    // origin); "anonymous" also keeps the stream Web Audio-routable.
    next.crossOrigin = "anonymous";
    (next as any).playsInline = true;
    next.src = assetUrl(url, this.originIndex);
    next.loop = true; // seamless infinite loop per spec
    next.preload = "auto";

    // iOS/WKWebView ignores HTMLAudioElement.volume, so fades and the volume
    // setting silently do nothing there. Route through the shared AudioContext
    // gain node when possible and only fall back to element volume.
    const gain = this.attachGain(next);
    if (gain) {
      gain.gain.value = 0;
      next.volume = 1;
    } else {
      next.volume = 0;
    }

    // If the current origin cannot serve the file (unpublished / offline),
    // retry the next known hosted origin once.
    next.addEventListener("error", () => {
      if (this.current !== next) return;
      if (!isNativeShell()) return;
      if (this.originIndex >= ASSET_ORIGINS.length - 1) return;
      this.originIndex += 1;
      this.currentUrl = null;
      this.crossfadeTo(url);
    });

    resumeAudioContext();
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
      this.applyVolume(next, this.targetVol * k);
      if (prev) this.applyVolume(prev, Math.max(0, this.targetVol * (1 - k)));
      if (n >= steps) {
        window.clearInterval(id);
        this.fadeTimers = this.fadeTimers.filter((x) => x !== id);
        if (prev) { try { prev.pause(); } catch { /* ignore */ } }
      }
    }, tick);
    this.fadeTimers.push(id);
  }

  /** Connect an element to the shared audio graph; null when unavailable. */
  private attachGain(el: HTMLAudioElement): GainNode | null {
    const c = getAudioContext();
    if (!c) return null;
    try {
      const src = c.createMediaElementSource(el);
      const g = c.createGain();
      src.connect(g).connect(c.destination);
      this.sources.set(el, src);
      this.gains.set(el, g);
      return g;
    } catch {
      return null;
    }
  }

  private applyVolume(el: HTMLAudioElement, vol: number) {
    const g = this.gains.get(el);
    if (g) {
      try { g.gain.value = vol; return; } catch { /* fall through */ }
    }
    try { el.volume = vol; } catch { /* ignore */ }
  }
}

export const music = new MusicEngine();
