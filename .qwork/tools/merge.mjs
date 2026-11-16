// Node port of merge.py: rebuilds every content/questions/<book>.json from the
// finished review units (.qwork/queue.json) and chapter units (.qwork/ch-queue.json),
// plus content/questions/legacy.json for original questions not reviewed yet.
// Usage: node .qwork/tools/merge.mjs
import fs from "node:fs";
import path from "node:path";
import { pyDumps } from "./pyjson.mjs";
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const DIFFS = ["easy", "medium", "hard", "expert", "impossible"];
const steps = read(".qwork/queue.json");
const checked = new Set(["review-01", ...steps.filter((s) => s.step === "check" && s.status === "done").map((s) => s.unit)]);
const reviewUnits = read(".qwork/review-units.json");
const units = reviewUnits.filter((u) => checked.has(u.id));
const byBook = new Map(); const covered = new Set();
const add = (q) => { if (!byBook.has(q.book)) byBook.set(q.book, []); byBook.get(q.book).push(q); };
for (const u of units) for (const q of read(u.file).questions) { add(q); covered.add(q.orig); }
if (fs.existsSync(".qwork/ch-queue.json")) {
  const doneCh = new Set(read(".qwork/ch-queue.json").filter((s) => s.step === "tr" && s.status === "done").map((s) => s.unit));
  for (const u of read(".qwork/ch-units.json")) if (doneCh.has(u.id)) for (const q of read(u.file).questions) add(q);
}
const originals = reviewUnits.flatMap((u) => read(u.src).questions).filter((q) => !covered.has(q.orig));
for (const f of fs.readdirSync("content/questions")) fs.rmSync(path.join("content/questions", f));
const write = (p, slug, qs) => fs.writeFileSync(p,
  `{"book": "${slug}", "questions": [\n` + qs.map((q) => pyDumps(q)).join(",\n") + "\n]}\n");
let total = 0;
for (const [slug, qs] of byBook) {
  qs.sort((a, b) => DIFFS.indexOf(a.difficulty) - DIFFS.indexOf(b.difficulty)); // stable, like Python
  write(`content/questions/${slug}.json`, slug, qs.map((q, i) => ({
    id: `${slug}-${String(i + 1).padStart(3, "0")}`, difficulty: q.difficulty, ref: q.ref, text: q.text })));
  total += qs.length;
}
if (originals.length)
  write("content/questions/legacy.json", "legacy", originals.map((q) => ({ id: q.orig, difficulty: q.difficulty, ref: "", text: q.text })));
console.log(`${units.length} reviewed batches: ${total} reviewed questions in ${byBook.size} books, ${originals.length} originals still unreviewed`);
