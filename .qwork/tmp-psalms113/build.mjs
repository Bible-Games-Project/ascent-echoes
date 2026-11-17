import fs from "node:fs";
import { ans } from "./gloss.mjs";
const LANGS = ["en","es","pt","fr","de","it","pl","ru","tr","ja","ko","ar"];
const parts = process.argv.slice(2);
let all = [];
for (const p of parts) all = all.concat((await import("./" + p)).default);
const questions = all.map((q, i) => {
  const [chapter, difficulty, ref, keys, texts] = q;
  if (texts.length !== 12) throw new Error("bad texts " + i + " " + chapter);
  const text = {};
  LANGS.forEach((l, li) => { text[l] = [l === "ja" ? texts[li].replace(/。$/, "？") : texts[li], ...keys.map((k) => ans(k, li))]; });
  return { id: "ch-psalms-113-" + String(i + 1).padStart(2, "0"), book: "psalms", chapter, difficulty, ref, text };
});
fs.writeFileSync("/work/.qwork/out/ch-psalms-113.json", JSON.stringify({ questions }, null, 1));
console.log(questions.length);
