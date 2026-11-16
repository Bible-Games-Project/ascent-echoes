// Applies English corrections (Node port of apply_en.py):
// node .qwork/tools/apply_en.mjs <file> <patch.json>
// patch.json: {"<id>": {"en": [question, correct, wrong1, wrong2], "ref": "...", "difficulty": "..."}}
// ("ref" and "difficulty" optional). Changed questions get "needs_translation": true.
import fs from "node:fs";
import { pyDumps } from "./pyjson.mjs";
const [path, patchPath] = process.argv.slice(2);
const patch = JSON.parse(fs.readFileSync(patchPath, "utf8"));
const data = JSON.parse(fs.readFileSync(path, "utf8"));
const byid = Object.fromEntries(data.questions.map((q) => [q.id, q]));
for (const [qid, fix] of Object.entries(patch)) {
  const q = byid[qid];
  if (!q) throw new Error(`unknown id ${qid}`);
  if (fix.en) {
    if (fix.en.length !== 4) throw new Error(`${qid}: "en" needs 4 items`);
    if (JSON.stringify(fix.en) !== JSON.stringify(q.text.en)) { q.text.en = fix.en; q.needs_translation = true; }
  }
  for (const k of ["ref", "difficulty"]) if (k in fix) q[k] = fix[k];
}
fs.writeFileSync(path, pyDumps(data, 1));
console.log(`applied ${Object.keys(patch).length} fixes; ${data.questions.filter((q) => q.needs_translation).length} questions need new translations`);
