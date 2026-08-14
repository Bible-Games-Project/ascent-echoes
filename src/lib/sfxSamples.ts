// Sample-based sound layer.
//
// Every real (recorded) sound effect lives here. Adding a new sound means
// adding one entry to SOUND_URLS (single file) or SOUND_GROUPS (random pool
// with no immediate repeats) — nothing else in the game has to change.

import { assetUrl } from "@/lib/assetUrl";
import { getAudioContext } from "@/lib/sfx";

import move1 from "@/assets/sfx/Move_1.mp3.asset.json";
import move2 from "@/assets/sfx/Move_2.mp3.asset.json";
import move3 from "@/assets/sfx/Move_3.mp3.asset.json";
import move4 from "@/assets/sfx/Move_4.mp3.asset.json";
import buttonSnd from "@/assets/sfx/Button.mp3.asset.json";
import bonusBadSnd from "@/assets/sfx/Bonus_Bad.mp3.asset.json";
import levelChangeSnd from "@/assets/sfx/Level_Change.mp3.asset.json";
import streakStartSnd from "@/assets/sfx/Streak_Start.mp3.asset.json";
import questionGoodSnd from "@/assets/sfx/Question_Good.mp3.asset.json";
import questionGoodStreakSnd from "@/assets/sfx/Question_Good_Streak.mp3.asset.json";

/** Single-file sounds. */
const SOUND_URLS: Record<string, string> = {
  button: buttonSnd.url,
  bonusBad: bonusBadSnd.url,
  levelChange: levelChangeSnd.url,
  streakStart: streakStartSnd.url,
  questionGood: questionGoodSnd.url,
  questionGoodStreak: questionGoodStreakSnd.url,
};

/**
 * Random pools. A pool never plays the same clip twice in a row.
 * `wood` (wrong answer / ark collision) is intentionally empty until the 5
 * wood clips are supplied — callers fall back to the synth sound meanwhile.
 */
const SOUND_GROUPS: Record<string, string[]> = {
  move: [move1.url, move2.url, move3.url, move4.url],
  wood: [],
};

const buffers = new Map<string, AudioBuffer>();
const pending = new Map<string, Promise<AudioBuffer | null>>();
const lastIndex = new Map<string, number>();

function load(url: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(url);
  if (cached) return Promise.resolve(cached);
  const inFlight = pending.get(url);
  if (inFlight) return inFlight;
  const c = getAudioContext();
  if (!c) return Promise.resolve(null);
  const p = fetch(assetUrl(url))
    .then((r) => r.arrayBuffer())
    .then((b) => c.decodeAudioData(b))
    .then((buf) => { buffers.set(url, buf); return buf; })
    .catch(() => null)
    .finally(() => { pending.delete(url); });
  pending.set(url, p);
  return p;
}

function playUrl(url: string, gain: number): boolean {
  const c = getAudioContext();
  if (!c) return false;
  const buf = buffers.get(url);
  if (!buf) { void load(url); return false; }
  if (c.state === "suspended") c.resume().catch(() => { /* ignore */ });
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(c.destination);
  src.start();
  return true;
}

/** Play a single sound. Returns false when the sample is not ready. */
export function playSample(name: keyof typeof SOUND_URLS | string, gain = 1): boolean {
  const url = SOUND_URLS[name];
  if (!url) return false;
  return playUrl(url, gain);
}

/** Play a random clip from a pool, never repeating the previous one. */
export function playSampleGroup(name: string, gain = 1): boolean {
  const pool = SOUND_GROUPS[name];
  if (!pool || pool.length === 0) return false;
  let i = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && i === lastIndex.get(name)) i = (i + 1) % pool.length;
  lastIndex.set(name, i);
  return playUrl(pool[i], gain);
}

/** Warm the decode cache so the first trigger is instant. */
export function preloadSamples(): void {
  if (typeof window === "undefined") return;
  for (const url of Object.values(SOUND_URLS)) void load(url);
  for (const pool of Object.values(SOUND_GROUPS)) for (const url of pool) void load(url);
}
