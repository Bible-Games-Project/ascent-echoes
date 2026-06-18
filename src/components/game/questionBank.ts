import bank from "./questions.json";

export type Difficulty = "easy" | "medium" | "hard" | "expert" | "impossible";

export const LANGUAGES = [
  "en", "es", "pt", "fr", "de", "it", "pl", "ru", "tr", "ja", "ko", "ar",
] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pl: "Polski",
  ru: "Русский",
  tr: "Türkçe",
  ja: "日本語",
  ko: "한국어",
  ar: "العربية",
};

interface RawAnswer {
  id: string;
  text: Partial<Record<Language, string>>;
  correct: boolean;
}
interface RawQuestion {
  id: string;
  question: Partial<Record<Language, string>>;
  answers: RawAnswer[];
}
type RawBank = Record<Difficulty, RawQuestion[]>;

const RAW = bank as unknown as RawBank;

// Level → distribution of difficulties (must sum to 10)
const LEVEL_DIST: Record<number, Record<Difficulty, number>> = {
  1:  { easy: 7, medium: 1, hard: 1, expert: 1, impossible: 0 },
  2:  { easy: 6, medium: 2, hard: 1, expert: 1, impossible: 0 },
  3:  { easy: 5, medium: 3, hard: 1, expert: 1, impossible: 0 },
  4:  { easy: 4, medium: 3, hard: 2, expert: 1, impossible: 0 },
  5:  { easy: 3, medium: 3, hard: 2, expert: 2, impossible: 0 },
  6:  { easy: 2, medium: 3, hard: 3, expert: 2, impossible: 0 },
  7:  { easy: 1, medium: 3, hard: 3, expert: 2, impossible: 1 },
  8:  { easy: 1, medium: 2, hard: 3, expert: 3, impossible: 1 },
  9:  { easy: 0, medium: 2, hard: 3, expert: 3, impossible: 2 },
  10: { easy: 0, medium: 1, hard: 3, expert: 3, impossible: 3 },
};
const ENDLESS_DIST = { easy: 0, medium: 1, hard: 2, expert: 4, impossible: 3 };

export function distributionForLevel(level: number) {
  return LEVEL_DIST[level] ?? ENDLESS_DIST;
}

export function timePerQuestionForLevel(level: number): number {
  const table = [0, 10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5];
  if (level <= 10) return table[level];
  const t = 5.5 - (level - 10) * 0.25;
  return Math.max(1.5, t);
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface GameQuestion {
  id: string;
  difficulty: Difficulty;
  prompt: string;
  answers: [string, string, string];
  safe: 0 | 1 | 2;
}

function pickText(loc: Partial<Record<Language, string>>, lang: Language): string {
  return loc[lang] ?? loc.en ?? "";
}

function localize(q: RawQuestion, lang: Language): GameQuestion {
  // Randomize answer order; correct answer's new index is `safe`
  const shuffled = shuffle(q.answers).slice(0, 3);
  const texts = shuffled.map((a) => pickText(a.text, lang)) as string[];
  const safeIdx = shuffled.findIndex((a) => a.correct);
  const safe = (safeIdx >= 0 ? safeIdx : 0) as 0 | 1 | 2;
  return {
    id: q.id,
    difficulty: (q.id.split("_")[0] as Difficulty) ?? "easy",
    prompt: pickText(q.question, lang),
    answers: [texts[0] ?? "", texts[1] ?? "", texts[2] ?? ""] as [string, string, string],
    safe,
  };
}

// Track used IDs across a run to avoid repeats when possible
export function buildLevelQuestions(
  level: number,
  lang: Language,
  usedIds: Set<string>,
): GameQuestion[] {
  const dist = distributionForLevel(level);
  const out: GameQuestion[] = [];

  (Object.keys(dist) as Difficulty[]).forEach((diff) => {
    const count = dist[diff];
    if (!count) return;
    const pool = RAW[diff] ?? [];
    // Prefer unseen; fall back to full pool if exhausted
    let candidates = pool.filter((q) => !usedIds.has(q.id));
    if (candidates.length < count) candidates = pool.slice();
    const picked = shuffle(candidates).slice(0, count);
    picked.forEach((q) => {
      usedIds.add(q.id);
      out.push(localize(q, lang));
    });
  });

  // Shuffle the final order so difficulties are interleaved within the level
  return shuffle(out);
}