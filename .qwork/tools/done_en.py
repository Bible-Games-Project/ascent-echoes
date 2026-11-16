# Writes .qwork/done-en.txt: English question | answer | ref of every finished output file
import json, glob, sys
skip = set(sys.argv[1:])
lines = []
for f in sorted(glob.glob(".qwork/out/*.json")):
    if any(s in f for s in skip): continue
    for q in json.load(open(f))["questions"]:
        e = q["text"]["en"]; lines.append(f'{e[0]} | {e[1]} | {q["ref"]}')
open(".qwork/done-en.txt", "w").write("\n".join(lines) + "\n")
print(len(lines), "finished questions listed")
