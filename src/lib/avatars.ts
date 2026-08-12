// Avatar progression system. Pure cosmetic, device-local. No gameplay effect.

import { DEV_MODE_AVAILABLE } from "@/lib/devMode";
import type { Language } from "@/components/game/questionBank";

function isDevModeUnlock(): boolean {
  if (!DEV_MODE_AVAILABLE) return false;
  try { return typeof localStorage !== "undefined" && localStorage.getItem("btr_dev_mode") === "1"; }
  catch { return false; }
}

export type AvatarId =
  | "pigeon"
  | "sheep"
  | "fish"
  | "ant"
  | "hyrax"
  | "goat"
  | "camel"
  | "rooster"
  | "fly"
  | "locust"
  | "mosquito"
  | "spider"
  | "raven"
  | "ox"
  | "snake"
  | "falcon"
  | "wolf"
  | "leopard"
  | "bear"
  | "lion";

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
  | "bestRankTop";

export interface AvatarDef {
  id: AvatarId;
  name: string;
  glyph: string; // accessibility / fallback label only
  unlock: { kind: UnlockKind; target?: number };
}

export const AVATARS: AvatarDef[] = [
  // Ordered as one collection: gentle -> moderate -> dangerous -> powerful.
  { id: "pigeon",   name: "Dove",     glyph: "🕊", unlock: { kind: "default" } },
  { id: "sheep",    name: "Sheep",    glyph: "🐑", unlock: { kind: "correctTotal", target: 50 } },
  { id: "fish",     name: "Fish",     glyph: "🐟", unlock: { kind: "gamesPlayed", target: 10 } },
  { id: "ant",      name: "Ant",      glyph: "🐜", unlock: { kind: "correctTotal", target: 100 } },
  { id: "hyrax",    name: "Hyrax",    glyph: "🦫", unlock: { kind: "bonusesCollected", target: 25 } },
  { id: "goat",     name: "Goat",     glyph: "🐐", unlock: { kind: "highestLevel", target: 5 } },
  { id: "camel",    name: "Camel",    glyph: "🐫", unlock: { kind: "daysPlayed", target: 5 } },
  { id: "rooster",  name: "Rooster",  glyph: "🐓", unlock: { kind: "bestStreak", target: 15 } },
  { id: "fly",      name: "Fly",      glyph: "🪰", unlock: { kind: "highestLevel", target: 10 } },
  { id: "locust",   name: "Locust",   glyph: "🦗", unlock: { kind: "bestStreak", target: 25 } },
  { id: "mosquito", name: "Mosquito", glyph: "🦟", unlock: { kind: "correctTotal", target: 500 } },
  { id: "spider",   name: "Spider",   glyph: "🕷", unlock: { kind: "bonusesCollected", target: 75 } },
  { id: "raven",    name: "Raven",    glyph: "🐦‍⬛", unlock: { kind: "gamesPlayed", target: 30 } },
  { id: "ox",       name: "Ox",       glyph: "🐂", unlock: { kind: "highestScore", target: 2500 } },
  { id: "snake",    name: "Serpent",  glyph: "🐍", unlock: { kind: "gamesPlayed", target: 50 } },
  { id: "falcon",   name: "Falcon",   glyph: "🦅", unlock: { kind: "highestLevel", target: 15 } },
  { id: "wolf",     name: "Wolf",     glyph: "🐺", unlock: { kind: "highestScore", target: 5000 } },
  { id: "leopard",  name: "Leopard",  glyph: "🐆", unlock: { kind: "bonusesCollected", target: 100 } },
  { id: "bear",     name: "Bear",     glyph: "🐻", unlock: { kind: "bestStreak", target: 50 } },
  { id: "lion",     name: "Lion",     glyph: "🦁", unlock: { kind: "highestLevel", target: 20 } },
];

// Avatar names in every supported language. Only the avatar name is localized
// here — no other game text is affected.
export const AVATAR_NAMES: Record<AvatarId, Record<Language, string>> = {
  pigeon:   { en: "Dove", es: "Paloma", pt: "Pomba", fr: "Colombe", de: "Taube", it: "Colomba", pl: "Gołębica", ru: "Голубь", tr: "Güvercin", ja: "ハト", ko: "비둘기", ar: "حمامة" },
  sheep:    { en: "Sheep", es: "Oveja", pt: "Ovelha", fr: "Brebis", de: "Schaf", it: "Pecora", pl: "Owca", ru: "Овца", tr: "Koyun", ja: "ヒツジ", ko: "양", ar: "خروف" },
  fish:     { en: "Fish", es: "Pez", pt: "Peixe", fr: "Poisson", de: "Fisch", it: "Pesce", pl: "Ryba", ru: "Рыба", tr: "Balık", ja: "魚", ko: "물고기", ar: "سمكة" },
  ant:      { en: "Ant", es: "Hormiga", pt: "Formiga", fr: "Fourmi", de: "Ameise", it: "Formica", pl: "Mrówka", ru: "Муравей", tr: "Karınca", ja: "アリ", ko: "개미", ar: "نملة" },
  hyrax:    { en: "Hyrax", es: "Damán", pt: "Hirax", fr: "Daman", de: "Klippschliefer", it: "Irace", pl: "Góralek", ru: "Даман", tr: "Kaya tavşanı", ja: "イワダヌキ", ko: "바위너구리", ar: "وبر" },
  goat:     { en: "Goat", es: "Cabra", pt: "Cabra", fr: "Chèvre", de: "Ziege", it: "Capra", pl: "Koza", ru: "Козёл", tr: "Keçi", ja: "ヤギ", ko: "염소", ar: "ماعز" },
  camel:    { en: "Camel", es: "Camello", pt: "Camelo", fr: "Chameau", de: "Kamel", it: "Cammello", pl: "Wielbłąd", ru: "Верблюд", tr: "Deve", ja: "ラクダ", ko: "낙타", ar: "جمل" },
  rooster:  { en: "Rooster", es: "Gallo", pt: "Galo", fr: "Coq", de: "Hahn", it: "Gallo", pl: "Kogut", ru: "Петух", tr: "Horoz", ja: "オンドリ", ko: "수탉", ar: "ديك" },
  fly:      { en: "Fly", es: "Mosca", pt: "Mosca", fr: "Mouche", de: "Fliege", it: "Mosca", pl: "Mucha", ru: "Муха", tr: "Sinek", ja: "ハエ", ko: "파리", ar: "ذبابة" },
  locust:   { en: "Locust", es: "Langosta", pt: "Gafanhoto", fr: "Sauterelle", de: "Heuschrecke", it: "Cavalletta", pl: "Szarańcza", ru: "Саранча", tr: "Çekirge", ja: "イナゴ", ko: "메뚜기", ar: "جراد" },
  mosquito: { en: "Mosquito", es: "Mosquito", pt: "Mosquito", fr: "Moustique", de: "Mücke", it: "Zanzara", pl: "Komar", ru: "Комар", tr: "Sivrisinek", ja: "蚊", ko: "모기", ar: "بعوضة" },
  spider:   { en: "Spider", es: "Araña", pt: "Aranha", fr: "Araignée", de: "Spinne", it: "Ragno", pl: "Pająk", ru: "Паук", tr: "Örümcek", ja: "クモ", ko: "거미", ar: "عنكبوت" },
  raven:    { en: "Raven", es: "Cuervo", pt: "Corvo", fr: "Corbeau", de: "Rabe", it: "Corvo", pl: "Kruk", ru: "Ворон", tr: "Kuzgun", ja: "カラス", ko: "까마귀", ar: "غراب" },
  ox:       { en: "Ox", es: "Buey", pt: "Boi", fr: "Bœuf", de: "Ochse", it: "Bue", pl: "Wół", ru: "Вол", tr: "Öküz", ja: "雄牛", ko: "황소", ar: "ثور" },
  snake:    { en: "Serpent", es: "Serpiente", pt: "Serpente", fr: "Serpent", de: "Schlange", it: "Serpente", pl: "Wąż", ru: "Змей", tr: "Yılan", ja: "ヘビ", ko: "뱀", ar: "أفعى" },
  falcon:   { en: "Falcon", es: "Halcón", pt: "Falcão", fr: "Faucon", de: "Falke", it: "Falco", pl: "Sokół", ru: "Сокол", tr: "Şahin", ja: "ハヤブサ", ko: "매", ar: "صقر" },
  wolf:     { en: "Wolf", es: "Lobo", pt: "Lobo", fr: "Loup", de: "Wolf", it: "Lupo", pl: "Wilk", ru: "Волк", tr: "Kurt", ja: "オオカミ", ko: "늑대", ar: "ذئب" },
  leopard:  { en: "Leopard", es: "Leopardo", pt: "Leopardo", fr: "Léopard", de: "Leopard", it: "Leopardo", pl: "Lampart", ru: "Леопард", tr: "Leopar", ja: "ヒョウ", ko: "표범", ar: "فهد" },
  bear:     { en: "Bear", es: "Oso", pt: "Urso", fr: "Ours", de: "Bär", it: "Orso", pl: "Niedźwiedź", ru: "Медведь", tr: "Ayı", ja: "クマ", ko: "곰", ar: "دب" },
  lion:     { en: "Lion", es: "León", pt: "Leão", fr: "Lion", de: "Löwe", it: "Leone", pl: "Lew", ru: "Лев", tr: "Aslan", ja: "ライオン", ko: "사자", ar: "أسد" },
};

export function avatarName(id: AvatarId, lang: Language): string {
  const row = AVATAR_NAMES[id];
  return row?.[lang] ?? row?.en ?? id;
}

export const DEFAULT_AVATAR: AvatarId = "pigeon";

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

export function isUnlocked(def: AvatarDef, stats: AvatarStats): boolean {
  if (isDevModeUnlock()) return true;
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
  if (!isUnlocked(def, stats)) return getEquipped();
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