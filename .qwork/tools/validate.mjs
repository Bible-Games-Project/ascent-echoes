// Checks a question file against the house rules.
// Usage: node .qwork/tools/validate.mjs <file.json> [--expect N] [--review]
import fs from "node:fs";
import path from "node:path";

const LANGS = ["en", "es", "pt", "fr", "de", "it", "pl", "ru", "tr", "ja", "ko", "ar"];
const DIFFS = ["easy", "medium", "hard", "expert", "impossible"];
const here = path.dirname(new URL(import.meta.url).pathname);
const books = JSON.parse(fs.readFileSync(path.join(here, "..", "books.json"), "utf8"));
const SLUGS = new Set(books.map((b) => b.slug));
const CASED = new Set(["en", "es", "pt", "fr", "de", "it", "pl", "ru", "tr"]);
const MAX_Q = { en: 95, ja: 70, ko: 80, ar: 105 };
const BAD_ANSWER_CHARS = /[\s,\/()\[\];:?!¿¡"«»“”„.…،؟？！。、]/;

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const expectIdx = args.indexOf("--expect");
const expect = expectIdx >= 0 ? Number(args[expectIdx + 1]) : null;
const review = args.includes("--review");
const perChapter = args.includes("--perchapter");
const allowStale = args.includes("--allow-stale");
const chapterDiffs = new Map();

const errors = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);

let data;
try {
  data = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  console.log(`FAIL: cannot read JSON from ${file}: ${e.message}`);
  process.exit(1);
}
const qs = Array.isArray(data?.questions) ? data.questions : null;
if (!qs) {
  console.log('FAIL: file must be {"questions": [...]}');
  process.exit(1);
}

const seenIds = new Set();
const seenQ = new Map();
const counts = Object.fromEntries(DIFFS.map((d) => [d, 0]));

for (const [i, q] of qs.entries()) {
  const id = q?.id ?? `#${i}`;
  if (typeof q.id !== "string" || !q.id) err(id, "missing id");
  else if (seenIds.has(q.id)) err(id, "duplicate id");
  seenIds.add(q.id);
  if (review && typeof q.orig !== "string") err(id, "missing orig (original id)");
  if (!(SLUGS.has(q.book) || (review && q.book === "general"))) err(id, `bad book "${q.book}"`);
  if (!DIFFS.includes(q.difficulty)) err(id, `bad difficulty "${q.difficulty}"`);
  else counts[q.difficulty]++;
  if (typeof q.ref !== "string" || q.ref.trim().length < 3) err(id, "missing ref (Bible reference)");
  if (q.needs_translation && !allowStale) err(id, "English was changed: update all 11 translations, then remove needs_translation");
  if (perChapter) {
    if (!Number.isInteger(q.chapter)) err(id, "missing chapter (number)");
    else {
      const seen = chapterDiffs.get(q.chapter) ?? [];
      seen.push(q.difficulty);
      chapterDiffs.set(q.chapter, seen);
    }
  }
  const t = q.text;
  if (!t || typeof t !== "object") { err(id, "missing text"); continue; }
  const extra = Object.keys(t).filter((l) => !LANGS.includes(l));
  if (extra.length) err(id, `unknown languages: ${extra.join(",")}`);

  let digitsRef = null;
  for (const l of LANGS) {
    if (q.needs_translation && allowStale && l !== "en") continue;
    const v = t[l];
    if (!Array.isArray(v) || v.length !== 4 || v.some((s) => typeof s !== "string" || !s.trim())) {
      err(id, `${l}: must be [question, correct, wrong1, wrong2] with non-empty strings`);
      continue;
    }
    if (v.some((s) => s !== s.trim() || /\n/.test(s))) err(id, `${l}: leading/trailing spaces or newline`);
    const [question, ...answers] = v;
    const max = MAX_Q[l] ?? 125;
    if (question.length > max) err(id, `${l}: question too long (${question.length} > ${max} chars)`);
    if (l === "en" && question.split(/\s+/).length > 14) err(id, "en: question has more than 14 words");
    if (!/([?？؟]|\.\.\.|…)$/.test(question)) err(id, `${l}: question must end with ? (or ؟ / ？ / ...)`);
    if (l === "es" && question.endsWith("?") && !question.includes("¿")) err(id, "es: question needs the opening ¿");
    answers.forEach((a, k) => {
      const label = k === 0 ? "correct answer" : `wrong answer ${k}`;
      if (BAD_ANSWER_CHARS.test(a)) err(id, `${l}: ${label} "${a}" must be ONE word (no spaces or punctuation)`);
      if (/^-|-$/.test(a)) err(id, `${l}: ${label} "${a}" starts/ends with a hyphen`);
      if ([...a].length > 22) err(id, `${l}: ${label} "${a}" is too long`);
      if (CASED.has(l) && /^\p{Ll}/u.test(a)) err(id, `${l}: ${label} "${a}" must start with a capital letter`);
    });
    const norm = answers.map((a) => a.toLocaleLowerCase(l));
    if (new Set(norm).size !== 3) err(id, `${l}: the three answers must be different`);
    const isDigits = answers.map((a) => /^\d+$/.test(a));
    if (isDigits.some(Boolean) && !isDigits.every(Boolean)) err(id, `${l}: if one answer is a number, all three must be numbers (digits)`);
    if (isDigits.every(Boolean)) {
      if (digitsRef === null) digitsRef = answers.join("|");
      else if (digitsRef !== answers.join("|")) err(id, `${l}: number answers must use the same digits in every language`);
    }
  }
  const en = t.en;
  if (Array.isArray(en) && en.length === 4) {
    const qNorm = en[0].toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
    const words = new Set(qNorm.split(/\s+/));
    if (words.has(en[1].toLowerCase())) err(id, `en: the correct answer "${en[1]}" appears in the question`);
    const key = qNorm.replace(/\s+/g, " ").trim();
    if (seenQ.has(key)) err(id, `same English question as ${seenQ.get(key)}`);
    else seenQ.set(key, id);
  }
}
if (perChapter) {
  for (const [ch, ds] of chapterDiffs) {
    if (ds.length !== 5 || DIFFS.some((d) => !ds.includes(d)))
      errors.push(`chapter ${ch}: needs exactly 5 questions, one per difficulty (has: ${ds.join(", ")})`);
  }
}
if (expect !== null && qs.length !== expect) errors.push(`file: expected ${expect} questions, found ${qs.length}`);

const dist = DIFFS.map((d) => `${d} ${counts[d]}`).join(", ");
if (errors.length) {
  console.log(`FAIL: ${errors.length} problem(s) in ${qs.length} questions (${dist})`);
  for (const e of errors.slice(0, 150)) console.log("- " + e);
  if (errors.length > 150) console.log(`... and ${errors.length - 150} more`);
  process.exit(1);
}
console.log(`OK: ${qs.length} questions (${dist})`);
