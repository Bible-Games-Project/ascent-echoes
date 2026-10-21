import fs from "node:fs";
import path from "node:path";

// Builds the per-language question files the game loads
// (src/components/game/questions/<lang>.json) from the master files in
// content/questions/<book>.json, which hold every language, the difficulty
// and the Bible reference of each question.
//
// Run after editing any master file:  node scripts/build-questions.mjs
//
// Master question shape:
//   { "id": "genesis-001", "difficulty": "easy", "ref": "Genesis 7:12",
//     "text": { "en": [question, correct, wrong1, wrong2], "es": [...], ... } }
// Output shape (per language):
//   { "easy": [[id, question, correct, wrong1, wrong2], ...], "medium": [...], ... }

const LANGS = ["en", "es", "pt", "fr", "de", "it", "pl", "ru", "tr", "ja", "ko", "ar"];
const DIFFS = ["easy", "medium", "hard", "expert", "impossible"];
const SRC = path.join("content", "questions");
const OUT = path.join("src", "components", "game", "questions");

const banks = Object.fromEntries(
  LANGS.map((l) => [l, Object.fromEntries(DIFFS.map((d) => [d, []]))]),
);
const ids = new Set();
let total = 0;

for (const name of fs
  .readdirSync(SRC)
  .filter((f) => f.endsWith(".json"))
  .sort()) {
  const { questions } = JSON.parse(fs.readFileSync(path.join(SRC, name), "utf8"));
  for (const q of questions) {
    if (ids.has(q.id)) throw new Error(`${name}: duplicate id ${q.id}`);
    if (!DIFFS.includes(q.difficulty))
      throw new Error(`${name}: ${q.id} has bad difficulty ${q.difficulty}`);
    ids.add(q.id);
    for (const l of LANGS) {
      const t = q.text[l];
      if (!Array.isArray(t) || t.length !== 4) throw new Error(`${name}: ${q.id} is missing ${l}`);
      banks[l][q.difficulty].push([q.id, ...t]);
    }
    total++;
  }
}

fs.mkdirSync(OUT, { recursive: true });
for (const l of LANGS) fs.writeFileSync(path.join(OUT, `${l}.json`), JSON.stringify(banks[l]));
const dist = DIFFS.map((d) => `${d} ${banks.en[d].length}`).join(", ");
console.log(`Wrote ${LANGS.length} languages, ${total} questions (${dist})`);
