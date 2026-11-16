// Tiny work queue (Node port of queue.py).
// Q=.qwork/ch-queue.json node .qwork/tools/queue.mjs next | done <unit> <step> | fail <unit> <step> | status
import fs from "node:fs";
import { pyDumps } from "./pyjson.mjs";
const Q = process.env.Q || ".qwork/queue.json";
const steps = JSON.parse(fs.readFileSync(Q, "utf8"));
const [cmd, unit, step] = process.argv.slice(2);
if (cmd === "next") {
  const s = steps.find((s) => s.status === "todo" || s.status === "failed");
  if (s) { s.status = "running"; console.log(`${s.unit} ${s.step} ${s.model}`); } else console.log("EMPTY");
} else if (cmd === "done" || cmd === "fail") {
  for (const s of steps) if (s.unit === unit && s.step === step) s.status = cmd === "done" ? "done" : "failed";
} else if (cmd === "status") {
  const c = {}; for (const s of steps) c[s.status] = (c[s.status] || 0) + 1; console.log(c);
}
fs.writeFileSync(Q, pyDumps(steps, 0));
