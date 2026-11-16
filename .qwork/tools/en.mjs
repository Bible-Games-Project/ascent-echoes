// Prints the English side of a question file, one question per line.
// Usage: node .qwork/tools/en.mjs <file>
import fs from "node:fs";
const { questions } = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
for (const q of questions) {
  const [question, ok, w1, w2] = q.text.en;
  console.log(`${q.id} | ch ${q.chapter} | ${q.difficulty} | ${q.ref} | ${question} | RIGHT: ${ok} | wrong: ${w1}, ${w2}`);
}
