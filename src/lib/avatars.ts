// Avatar progression system. Pure cosmetic, device-local. No gameplay effect.

import { getIsPremium } from "@/lib/monetization";

export type AvatarId =
  | "white_dove"
  | "oil_lamp"
  | "scroll"
  | "star"
  | "olive_branch"
  | "anchor"
  | "ichthys"
  | "feather"
  | "water_drop"
  | "sun"
  | "moon"
  | "rainbow"
  | "golden_key"
  | "crystal"
  | "laurel"
  | "celestial"
  | "black_dove"
  | "crown"
  | "shield"
  | "seraph_dove";

export type UnlockKind =
  | "default"
  | "correctTotal"
  | "highestLevel"
  | "bestStreak"
  | "gamesPlayed"
  | "highestScore"
  | "bonusesCollected"
  | "daysPlayed"
  | "allDifficultiesInOneRun"
  | "bestRankTop"
  | "premium";

export interface AvatarDef {
  id: AvatarId;
  name: string;
  glyph: string; // accessibility / fallback label only
  unlock: { kind: UnlockKind; target?: number };
  premium?: boolean; // premium-exclusive
}

export const AVATARS: AvatarDef[] = [
  { id: "white_dove",   name: "White Dove",        glyph: "🕊", unlock: { kind: "default" } },
  { id: "oil_lamp",     name: "Oil Lamp",          glyph: "🕯", unlock: { kind: "correctTotal", target: 100 } },
  { id: "scroll",       name: "Scroll",            glyph: "📜", unlock: { kind: "highestLevel", target: 10 } },
  { id: "star",         name: "Star",              glyph: "⭐", unlock: { kind: "bestStreak", target: 25 } },
  { id: "olive_branch", name: "Olive Branch",      glyph: "🌿", unlock: { kind: "correctTotal", target: 500 } },
  { id: "anchor",       name: "Anchor of Hope",    glyph: "⚓", unlock: { kind: "gamesPlayed", target: 50 } },
  { id: "ichthys",      name: "Ichthys",           glyph: "🐟", unlock: { kind: "highestScore", target: 5000 } },
  { id: "feather",      name: "Feather",           glyph: "🪶", unlock: { kind: "bonusesCollected", target: 100 } },
  { id: "water_drop",   name: "Water Drop",        glyph: "💧", unlock: { kind: "bestStreak", target: 50 } },
  { id: "sun",          name: "Sun",               glyph: "☀️", unlock: { kind: "highestLevel", target: 20 } },
  { id: "moon",         name: "Moon",              glyph: "🌙", unlock: { kind: "daysPlayed", target: 7 } },
  { id: "rainbow",      name: "Rainbow",           glyph: "🌈", unlock: { kind: "allDifficultiesInOneRun" } },
  { id: "golden_key",   name: "Golden Key",        glyph: "🗝", unlock: { kind: "highestScore", target: 10000 } },
  { id: "crystal",      name: "Crystal",           glyph: "💎", unlock: { kind: "bestRankTop", target: 1000 } },
  { id: "laurel",       name: "Laurel Wreath",     glyph: "👑", unlock: { kind: "bestRankTop", target: 100 } },
  { id: "celestial",    name: "Celestial Light",   glyph: "✨", unlock: { kind: "bestRankTop", target: 10 } },
  { id: "black_dove",   name: "Black Dove",        glyph: "🕊", unlock: { kind: "correctTotal", target: 1000 } },
  { id: "crown",        name: "King's Crown",      glyph: "👑", unlock: { kind: "premium" }, premium: true },
  { id: "shield",       name: "Shield of Faith",   glyph: "🛡", unlock: { kind: "premium" }, premium: true },
  { id: "seraph_dove",  name: "Golden Seraph Dove", glyph: "🪽", unlock: { kind: "premium" }, premium: true },
];

export const DEFAULT_AVATAR: AvatarId = "white_dove";

export interface AvatarStats {
  correctTotal: number;
  bonusesCollected: number;
  gamesPlayed: number;
  bestStreak: number;
  highestLevel: number;
  highestScore: number;
  daysPlayed: string[];
  allDifficultiesEver: boolean;
  bestRank: number; // 0 = unknown, otherwise the lowest (best) rank reached
}

const STATS_KEY = "btr_avatar_stats_v1";
const EQUIP_KEY = "btr_avatar_equipped_v1";

function emptyStats(): AvatarStats {
  return {
    correctTotal: 0,
    bonusesCollected: 0,
    gamesPlayed: 0,
    bestStreak: 0,
    highestLevel: 0,
    highestScore: 0,
    daysPlayed: [],
    allDifficultiesEver: false,
    bestRank: 0,
  };
}

export function getStats(): AvatarStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw) as Partial<AvatarStats>;
    return { ...emptyStats(), ...parsed, daysPlayed: parsed.daysPlayed ?? [] };
  } catch {
    return emptyStats();
  }
}

function saveStats(s: AvatarStats) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function mutate(fn: (s: AvatarStats) => void): AvatarStats {
  const s = getStats();
  fn(s);
  saveStats(s);
  return s;
}

export const recordCorrect = () => mutate((s) => { s.correctTotal += 1; });
export const recordBonus = () => mutate((s) => { s.bonusesCollected += 1; });
export const recordGamePlayed = () => mutate((s) => { s.gamesPlayed += 1; });
export const recordStreak = (n: number) => mutate((s) => { if (n > s.bestStreak) s.bestStreak = n; });
export const recordLevel = (lvl: number) => mutate((s) => { if (lvl > s.highestLevel) s.highestLevel = lvl; });
export const recordScore = (sc: number) => mutate((s) => { if (sc > s.highestScore) s.highestScore = sc; });
export const recordAllDifficulties = () => mutate((s) => { s.allDifficultiesEver = true; });
export const recordDayPlayed = () => mutate((s) => {
  const today = new Date().toISOString().slice(0, 10);
  if (!s.daysPlayed.includes(today)) s.daysPlayed.push(today);
});
export const recordRank = (rank: number | null | undefined) => mutate((s) => {
  if (typeof rank !== "number" || rank <= 0) return;
  if (s.bestRank === 0 || rank < s.bestRank) s.bestRank = rank;
});

export function isUnlocked(def: AvatarDef, stats: AvatarStats, premium: boolean): boolean {
  if (def.premium) return premium;
  if (premium) return true; // premium unlocks ALL
  const u = def.unlock;
  switch (u.kind) {
    case "default": return true;
    case "correctTotal": return stats.correctTotal >= (u.target ?? 0);
    case "highestLevel": return stats.highestLevel >= (u.target ?? 0);
    case "bestStreak": return stats.bestStreak >= (u.target ?? 0);
    case "gamesPlayed": return stats.gamesPlayed >= (u.target ?? 0);
    case "highestScore": return stats.highestScore >= (u.target ?? 0);
    case "bonusesCollected": return stats.bonusesCollected >= (u.target ?? 0);
    case "daysPlayed": return stats.daysPlayed.length >= (u.target ?? 0);
    case "allDifficultiesInOneRun": return stats.allDifficultiesEver;
    case "bestRankTop": return stats.bestRank > 0 && stats.bestRank <= (u.target ?? 0);
    case "premium": return premium;
  }
}

export interface ProgressInfo {
  current: number;
  target: number;
  label: string; // human progress like "73 / 100"
  requirement: string; // requirement description
}

export function progressFor(def: AvatarDef, stats: AvatarStats): ProgressInfo {
  const u = def.unlock;
  const tgt = u.target ?? 0;
  const mk = (cur: number, req: string): ProgressInfo => ({
    current: cur, target: tgt, label: `${Math.min(cur, tgt)} / ${tgt}`, requirement: req,
  });
  switch (u.kind) {
    case "default": return { current: 1, target: 1, label: "—", requirement: "Default" };
    case "correctTotal": return mk(stats.correctTotal, `${tgt} correct answers`);
    case "highestLevel": return mk(stats.highestLevel, `Reach Level ${tgt}`);
    case "bestStreak": return mk(stats.bestStreak, `${tgt} answer streak`);
    case "gamesPlayed": return mk(stats.gamesPlayed, `${tgt} games played`);
    case "highestScore": return mk(stats.highestScore, `${tgt} pts in one run`);
    case "bonusesCollected": return mk(stats.bonusesCollected, `Collect ${tgt} bonuses`);
    case "daysPlayed": return mk(stats.daysPlayed.length, `Play on ${tgt} different days`);
    case "allDifficultiesInOneRun": return {
      current: stats.allDifficultiesEver ? 1 : 0, target: 1,
      label: stats.allDifficultiesEver ? "Done" : "Not yet",
      requirement: "Answer correctly across all difficulty levels in one run",
    };
    case "bestRankTop": {
      const cur = stats.bestRank;
      return {
        current: cur && cur <= tgt ? 1 : 0,
        target: 1,
        label: cur > 0 ? `#${cur}` : "—",
        requirement: `Reach Top ${tgt} global rank`,
      };
    }
    case "premium": return { current: 0, target: 1, label: "Premium", requirement: "Premium exclusive" };
  }
}

export function getEquipped(): AvatarId {
  try {
    const v = localStorage.getItem(EQUIP_KEY);
    if (v && AVATARS.some((a) => a.id === v)) return v as AvatarId;
  } catch { /* ignore */ }
  return DEFAULT_AVATAR;
}

export function setEquipped(id: AvatarId): AvatarId {
  const stats = getStats();
  const def = AVATARS.find((a) => a.id === id);
  if (!def) return getEquipped();
  if (!isUnlocked(def, stats, getIsPremium())) return getEquipped();
  try { localStorage.setItem(EQUIP_KEY, id); } catch { /* ignore */ }
  return id;
}

// Map game level to a difficulty bit so we can track "all difficulties in one run".
// Levels 1-3: easy, 4-6: medium, 7-9: hard, 10+: impossible.
export function difficultyBitForLevel(lvl: number): number {
  if (lvl <= 3) return 1;
  if (lvl <= 6) return 2;
  if (lvl <= 9) return 4;
  return 8;
}
export const ALL_DIFFICULTIES_MASK = 1 | 2 | 4 | 8;