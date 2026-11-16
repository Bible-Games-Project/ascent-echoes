// Writes the three prompts of every chapter unit to .qwork/prompts/<id>-{write,en,tr}.txt
import fs from "node:fs";
let src = fs.readFileSync(".qwork/workflow.js", "utf8");
let RULES = new Function(src.replace(/^export const meta[\s\S]*?\n}\n/, "").split("const RESULT")[0] + "\nreturn RULES;")();
RULES = RULES.replace(/ The file \.qwork\/done-en\.txt[^\n]*/, "");
RULES = RULES.replace('{"id": "...", "book": "<book slug>", "difficulty": "easy",', '{"id": "...", "book": "<book slug>", "chapter": 7, "difficulty": "easy",');
const units = JSON.parse(fs.readFileSync(".qwork/ch-units.json", "utf8"));
const range = (u) => (u.from === u.to ? `chapter ${u.from}` : `chapters ${u.from} to ${u.to}`);
const check = (u, extra = "") => `node .qwork/tools/validate.mjs ${u.file} --expect ${u.count} --perchapter${extra}`;
for (const u of units) {
  const w = `Work in /home/user/ascent-echoes. TASK: write NEW questions for the game "Bible Trivia Run" about the book of ${u.bookName} (book slug "${u.book}"), ${range(u)}: exactly 5 questions for EACH chapter, ${u.count} in total.
For every chapter write one question of each difficulty, in this order: easy, medium, hard, expert, impossible. "Easy" means easy for that chapter (the best-known fact in it), "impossible" the most obscure detail. Every question must come from its own chapter; put the chapter number in "chapter" and a precise verse reference in "ref".
If a chapter is very short or is only a list (a genealogy, a census), still write 5, using its names, numbers and places.
Do not read any other question files: write from the Bible itself.
Write them to ${u.file} with ids "${u.id}-01", "${u.id}-02", ... Every question has "book": "${u.book}".
Check command: ${check(u)}

${RULES}

Return ok=true only when the check prints OK. "summary" = one or two sentences.`;
  const e = `Work in /home/user/ascent-echoes. You are an independent fact checker for a Bible trivia game. The file ${u.file} has ${u.count} questions about ${u.bookName}, ${range(u)} (5 per chapter, one per difficulty). Check ONLY the English; do not read or edit other languages.
See the English with: node .qwork/tools/en.mjs ${u.file}
For EVERY question check:
1. The fact is right according to that chapter of the Catholic Bible, and "ref" points to the right verse in that chapter.
2. Exactly one option is right: neither wrong answer can be argued to be right (watch for other people, numbers or places in the same story that would also fit).
3. The question gives its context so it makes sense on its own (it names the person, story or moment: "Before the flood, how many years did God set as man's lifespan?"; never a bare "he" or "this"), stays short (14 words at most) and fluent, is clear and unambiguous, and naturally leads to a ONE-word answer; each of the 3 options is one word; the correct answer is not in the question.
4. The difficulty fits its slot: easy is the best-known fact of the chapter, impossible the most obscure.
Write your fixes to .qwork/patches/${u.id}-en.json as {"<id>": {"en": [question, correct, wrong1, wrong2], "ref": "...", "difficulty": "..."}} (only the questions you change; "ref" and "difficulty" only when they change; keep one question per difficulty per chapter), then apply them with:
python3 .qwork/tools/apply_en.py ${u.file} .qwork/patches/${u.id}-en.json
Then run: ${check(u, " --allow-stale")}
Return ok=true when that prints OK. "fixed" = how many questions you changed; "summary" = the main kinds of problems you found.`;
  const t = `Work in /home/user/ascent-echoes. You are an independent translation checker for a Bible trivia game. The file ${u.file} has ${u.count} questions about ${u.bookName}, ${range(u)}, in 12 languages. The English is final and correct: do not change it.
1. Questions marked "needs_translation": true had their English changed: re-translate all 11 other languages from the English, then delete the "needs_translation" key.
2. Check EVERY other question in every language (es, pt, fr, de, it, pl, ru, tr, ja, ko, ar): it says the same as the English, is natural and grammatical, and its three answers translate the English ones in the same order. In inflected languages (pl, ru, de, tr...) the question must fit all three options equally, and no article, pronoun or ending may give away the right one. Each answer must be one real word (never two words glued together); if a language needs two words, reword the question in that language so a one-word answer works.
3. Names and book titles follow each language's main Catholic Bible: es Biblia de Jerusalén / CEE, pt CNBB, fr Bible de Jérusalem / AELF, de Einheitsübersetzung, it CEI, pl Biblia Tysiąclecia, ru Synodal (with its own Psalm numbering), tr Kutsal Kitap, ja 聖書協会共同訳 / 新共同訳, ko 가톨릭 성경, ar the Catholic Arabic Bible. Spanish questions start with ¿; Korean ones end with a plain "?"; no "al-" on ordinary Arabic nouns used as answers.
Edit the file directly. Check command: ${check(u)}
Return ok=true only when it prints OK. "fixed" = how many questions you changed; "summary" = the main kinds of problems you found.`;
  for (const [k, v] of [["write", w], ["en", e], ["tr", t]]) fs.writeFileSync(`.qwork/prompts/${u.id}-${k}.txt`, v);
}
console.log(units.length, "units");
