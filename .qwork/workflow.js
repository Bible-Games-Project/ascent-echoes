export const meta = {
  name: 'bible-questions',
  description: 'Write or review Bible trivia questions in 12 languages, then check each file independently',
  phases: [{ title: 'Write' }, { title: 'Check' }],
}

const RULES = `HOUSE RULES FOR EVERY QUESTION
- Source: the Catholic Bible (73 books). Every question must be answerable from the Bible text itself. Put a precise reference in "ref", in English, e.g. "Genesis 7:12" or "Tobit 6:2-8".
- Every question gives its context so it is clear on its own: name the person, story or moment it is about (e.g. "Before the flood, how many years did God set as man's lifespan?", not "How many years did God set as man's lifespan?"; "Whom did Abram rescue from Chedorlaomer?", not "Whom did he rescue?"). Never "he", "she" or "this" without saying who. Keep it brief and fluent.
- The question is short and clear: at most 14 words in English, readable in a few seconds (players get 3 to 10 seconds). Word it so the correct answer is exactly ONE word and exactly one of the three options is right.
- Ask about concrete facts: who, what, where, how many, which animal, object, place, name or number. Always a direct question: never fill-in-the-blank wording ("milk and what?", "The Lord is my what?"), which breaks in other languages. Vague or opinion questions are banned ("What is the central theme of...?", "What does X reveal?", "What drove Nehemiah?").
- Exactly 3 answers: the correct one first, then two wrong ones. Every answer is ONE single word in EVERY language: no spaces, no articles (the, el, le, der, il...), no explanations, no punctuation. It must be a real single word of that language: never glue two words together to pass the check (Bethlehem is two words in Arabic, "بيت لحم", so it cannot be an answer). Numbers are written as digits (40), with the same digits in every language; if the correct answer is a number, both wrong answers are numbers too.
- Wrong answers are plausible and from the same category (a person for a person, a city for a city, an animal for an animal) but clearly wrong according to the text. Never a synonym, another name for the same thing, or something partly right.
- The correct answer must not appear in the question.
- If a fact only works with a multi-word answer in some language (e.g. "John the Baptist", "Red Sea", "Holy Spirit"), rephrase the question so a one-word answer works in all 12 languages, or choose another fact.
- Translate into es, pt, fr, de, it, pl, ru, tr, ja, ko, ar: natural, grammatical, faithful to the English meaning, answers in the same order. Each language's answers are the translations of the English answers. Use the names and book titles of each language's main Catholic Bible: es Biblia de Jerusalén / CEE, pt CNBB, fr Bible de Jérusalem / AELF, de Einheitsübersetzung, it CEI, pl Biblia Tysiąclecia, ru Synodal, tr Kutsal Kitap, ja 聖書協会共同訳 / 新共同訳 (ペトロ, パウロ, モーセ), ko 가톨릭 성경 (바오로, 베드로, 마태오, 루카, 에제키엘), ar the Catholic Arabic Bible (يسوع, بطرس, بولس). Spanish questions start with ¿. Answers start with a capital letter where the script has capitals.
- Difficulty: easy = widely known (Noah's ark, Goliath, Bethlehem); medium = known to people who read the Bible now and then; hard = needs having read the book; expert = specific details (minor characters, places, numbers); impossible = obscure details only very careful readers know. Label honestly.
- No two questions may ask about the same fact. Vary the kinds of questions. The file .qwork/done-en.txt lists every question already finished in other files (English question | answer | reference): read it and never ask a fact it already covers.

FILE FORMAT (valid JSON, UTF-8):
{"questions": [
  {"id": "...", "book": "<book slug>", "difficulty": "easy", "ref": "Genesis 7:12",
   "text": {"en": ["How many days and nights did it rain in the flood?", "40", "7", "150"],
            "es": ["¿Cuántos días y noches llovió en el diluvio?", "40", "7", "150"],
            ...the same for all 12 languages: en es pt fr de it pl ru tr ja ko ar}}
]}
Each language array is [question, correct answer, wrong answer 1, wrong answer 2].

The file is large: you may build it in parts (for example two or three part files merged with a short node command), but the final file must be complete. Check it with the command given in your task, fix every problem it reports, and run it again until it prints OK. The checker only catches format problems; facts and translations are your responsibility.`

const RESULT = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    questions: { type: 'number' },
    fixed: { type: 'number' },
    summary: { type: 'string' },
  },
  required: ['ok', 'questions', 'summary'],
}

const validateCmd = (u) => `node .qwork/tools/validate.mjs ${u.file} --expect ${u.count}${u.kind === 'review' ? ' --review' : ''}`

function writePrompt(u) {
  if (u.kind === 'review') {
    return `Work in /home/user/ascent-echoes. TASK: review and fix ${u.count} EXISTING questions of the game "Bible Trivia Run". They are in ${u.src}, in the format below but without "id", "book" and "ref"; each has "orig" (its original id) and "difficulty".
Many of them have problems: vague or badly worded questions, wrong or doubtful correct answers, wrong options that are also right, translations that do not match the English (for example a German answer that means something else), repeated questions.
Step 1, English first: check every question and its answers against the Bible. Fix the wording and wrong answers; replace every vague or opinion question with a concrete factual one (keep the same story or topic when you can). Step 2, all other languages: fix or re-translate each language so it matches the corrected English exactly.
Keep every question: same count, same "orig", same "difficulty" unless it is clearly wrong. If two questions in the batch ask the same thing, rewrite one into a different question.
Write the result to ${u.file} with ids "${u.id}-01", "${u.id}-02", ... in order. Give every question "book" (the slug, from .qwork/books.json, of the book the fact comes from; "general" only if it truly belongs to no single book) and "ref".
Check command: ${validateCmd(u)}

${RULES}

Return ok=true only when the check prints OK. "fixed" = how many questions you changed; "summary" = the main kinds of problems you found, in a few sentences.`
  }
  const s = u.split
  return `Work in /home/user/ascent-echoes. TASK: write ${u.count} NEW questions for the game "Bible Trivia Run" about the book of ${u.bookName} (book slug "${u.book}"), ${u.range}. Stay inside that passage: other writers cover the rest of the Bible.
Difficulty mix to aim for: easy ${s.easy}, medium ${s.medium}, hard ${s.hard}, expert ${s.expert}, impossible ${s.impossible} (follow it as closely as the material honestly allows).
The game already has the questions listed in .qwork/existing-en.txt (English, one per line): grep it for the main names and events of your passage and do not repeat facts already asked there.
Write them to ${u.file} with ids "${u.id}-01", "${u.id}-02", ... Every question has "book": "${u.book}".
Check command: ${validateCmd(u)}

${RULES}

Return ok=true only when the check prints OK. "summary" = one or two sentences on what you covered.`
}

function checkPrompt(u) {
  const what = u.kind === 'review'
    ? 'that another writer produced by fixing old game questions'
    : `that another writer produced about ${u.bookName}, ${u.range} (questions must stay inside that passage)`
  return `Work in /home/user/ascent-echoes. You are an independent checker. The file ${u.file} has ${u.count} Bible trivia questions in 12 languages ${what}. Be strict: players will see every one of them.
Check EVERY question and fix problems directly in the file:
1. Facts: the correct answer is really right according to the cited passage of the Catholic Bible, and "ref" points to the right place. If you are not sure a fact is right, replace the question with one you are sure of.
2. Exactly one right option: neither wrong answer can also be argued to be right.
3. The question is short, clear and unambiguous, and naturally leads to a one-word answer.
4. Translations: check every language, not a sample. Each one says the same as the English, is natural and grammatical, uses the Catholic Bible name forms given in the rules, and its three answers translate the English ones in the same order.
5. Difficulty labels are reasonable, and no two questions ask about the same fact.
Edit or replace bad questions but keep the count and the ids${u.kind === 'review' ? ' and "orig"' : ''}.
Check command: ${validateCmd(u)}

${RULES}

Return ok=true only when the check prints OK. "fixed" = how many questions you changed; "summary" = the main kinds of problems you found.`
}

const units = args.units
log(`${units.length} files, ${units.reduce((n, u) => n + u.count, 0)} questions`)
const results = await pipeline(
  units,
  (_, u) => agent(writePrompt(u), { label: `write:${u.id}`, phase: 'Write', schema: RESULT }),
  (w, u) => w
    ? agent(checkPrompt(u), { label: `check:${u.id}`, phase: 'Check', schema: RESULT })
        .then((c) => ({ id: u.id, file: u.file, write: w, check: c }))
    : { id: u.id, file: u.file, write: null, check: null },
)
return results.map((r, i) => r ?? { id: units[i].id, file: units[i].file, write: null, check: null })
