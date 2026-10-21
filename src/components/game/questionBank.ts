import enBank from "./questions/en.json";

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

// One entry per question: [id, question, correct answer, wrong answer, wrong answer].
// The files are generated from content/questions by scripts/build-questions.mjs.
type RawQuestion = [string, string, string, string, string];
type RawBank = Record<Difficulty, RawQuestion[]>;

// English ships with the app; every other language is its own chunk, loaded
// when the player picks it, so the app does not carry all 12 at start-up.
const LOADERS: Record<Exclude<Language, "en">, () => Promise<{ default: unknown }>> = {
  es: () => import("./questions/es.json"),
  pt: () => import("./questions/pt.json"),
  fr: () => import("./questions/fr.json"),
  de: () => import("./questions/de.json"),
  it: () => import("./questions/it.json"),
  pl: () => import("./questions/pl.json"),
  ru: () => import("./questions/ru.json"),
  tr: () => import("./questions/tr.json"),
  ja: () => import("./questions/ja.json"),
  ko: () => import("./questions/ko.json"),
  ar: () => import("./questions/ar.json"),
};

const banks: Partial<Record<Language, RawBank>> = { en: enBank as unknown as RawBank };

/** Loads a language's questions; until it arrives the game falls back to English. */
export function loadQuestionBank(lang: Language): Promise<void> {
  if (lang === "en" || banks[lang]) return Promise.resolve();
  return LOADERS[lang]()
    .then((m) => {
      banks[lang] = m.default as RawBank;
    })
    .catch(() => {
      /* keep using English */
    });
}

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
  const table = [0, 10.0, 9.2, 8.4, 7.6, 6.8, 6.0, 5.2, 4.4, 3.7, 3.0];
  if (level <= 10) return table[level];
  return 3.0;
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

function localize(q: RawQuestion, difficulty: Difficulty): GameQuestion {
  // Randomize answer order; correct answer's new index is `safe`
  const [id, prompt, ...options] = q;
  const order = shuffle([0, 1, 2]);
  return {
    id,
    difficulty,
    prompt,
    answers: order.map((i) => options[i]) as [string, string, string],
    safe: order.indexOf(0) as 0 | 1 | 2,
  };
}

// Track used IDs across a run so a question never repeats within one game.
// The whole level sequence is generated up-front: the existing difficulty
// distribution is honoured first, then the resulting set is shuffled.
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
    const pool = (banks[lang] ?? banks.en!)[diff] ?? [];
    let candidates = pool.filter((q) => !usedIds.has(q[0]));
    if (candidates.length < count) {
      // This difficulty's pool is exhausted for the run: start a fresh cycle
      // for it, but keep everything already queued in THIS level excluded so
      // no duplicate can appear back-to-back within the same sequence.
      const thisLevelIds = new Set(out.map((q) => q.id));
      pool.forEach((q) => usedIds.delete(q[0]));
      candidates = pool.filter((q) => !thisLevelIds.has(q[0]));
    }
    const picked = shuffle(candidates).slice(0, count);
    picked.forEach((q) => {
      usedIds.add(q[0]);
      out.push(localize(q, diff));
    });
  });

  // Shuffle the final order so difficulties are interleaved within the level
  return shuffle(out);
}