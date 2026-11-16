// Writes the write/check prompt of every unit to .qwork/prompts/<id>-{write,check}.txt
import fs from "node:fs";
let src = fs.readFileSync(".qwork/workflow.js", "utf8");
src = src.replace(/^export const meta[\s\S]*?\n}\n/, "").split("const units = args.units")[0];
const { writePrompt, checkPrompt } = new Function(src + "\nreturn { writePrompt, checkPrompt };")();
const units = [...JSON.parse(fs.readFileSync(".qwork/review-units.json", "utf8")), ...JSON.parse(fs.readFileSync(".qwork/gen-units.json", "utf8"))];
for (const u of units) {
  fs.writeFileSync(`.qwork/prompts/${u.id}-write.txt`, writePrompt(u));
  fs.writeFileSync(`.qwork/prompts/${u.id}-check.txt`, checkPrompt(u));
}
console.log(units.length, "units");
