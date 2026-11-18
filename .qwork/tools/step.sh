#!/bin/bash
# Finish one queue step: validate the unit file, mark the step done and,
# after a tr step, merge + build questions + commit. Prints the next step.
# Usage: .qwork/tools/step.sh <unit> <write|en|tr>
set -e
cd "$(dirname "$0")/../.."
unit=$1; step=$2
read count book from to < <(node -e 'const u=JSON.parse(require("fs").readFileSync(".qwork/ch-units.json"));const a=Array.isArray(u)?u:u.units;const x=a.find(x=>x.id===process.argv[1]);console.log(x.count,x.bookName,x.from,x.to)' "$unit")
f=.qwork/out/$unit.json
extra=""; [ "$step" = en ] && extra="--allow-stale"
node .qwork/tools/validate.mjs $f --expect $count --perchapter $extra
if [ "$step" = tr ] && grep -q needs_translation $f; then echo "needs_translation remains"; exit 1; fi
Q=.qwork/ch-queue.json node .qwork/tools/queue.mjs done $unit $step
if [ "$step" = tr ]; then
  node .qwork/tools/merge.mjs && node scripts/build-questions.mjs | tail -1
  git add content/questions src/components/game/questions .qwork
  git commit -qm "Add $count new trivia questions for $book $from-$to"
  echo "COMMIT: Add $count new trivia questions for $book $from-$to"
  .qwork/tools/progress.sh
fi
Q=.qwork/ch-queue.json node .qwork/tools/queue.mjs next
