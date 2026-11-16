# Puts the fully checked review files into the game's master files:
# content/questions/<book>.json for the reviewed questions, and
# content/questions/legacy.json for the original questions not reviewed yet.
# Usage: python3 .qwork/tools/merge.py   (uses every review unit whose check is done)
import json, os, collections
DIFFS = ["easy", "medium", "hard", "expert", "impossible"]
steps = json.load(open(".qwork/queue.json"))
checked = {"review-01"} | {s["unit"] for s in steps if s["step"] == "check" and s["status"] == "done"}
units = [u for u in json.load(open(".qwork/review-units.json")) if u["id"] in checked]
by_book = collections.defaultdict(list); covered = set()
for u in units:
    for q in json.load(open(u["file"]))["questions"]:
        by_book[q["book"]].append(q); covered.add(q["orig"])
import os.path
if os.path.exists(".qwork/ch-queue.json"):
    chsteps = json.load(open(".qwork/ch-queue.json"))
    done_ch = {s["unit"] for s in chsteps if s["step"] == "tr" and s["status"] == "done"}
    for u in json.load(open(".qwork/ch-units.json")):
        if u["id"] in done_ch:
            for q in json.load(open(u["file"]))["questions"]:
                by_book[q["book"]].append(q)
originals = [q for u in json.load(open(".qwork/review-units.json"))
             for q in json.load(open(u["src"]))["questions"] if q["orig"] not in covered]
for f in os.listdir("content/questions"):
    os.remove(os.path.join("content/questions", f))
def write(path, slug, qs):
    with open(path, "w") as fh:
        fh.write('{"book": "%s", "questions": [\n' % slug)
        fh.write(",\n".join(json.dumps(q, ensure_ascii=False) for q in qs))
        fh.write("\n]}\n")
total = 0
for slug, qs in by_book.items():
    qs.sort(key=lambda q: DIFFS.index(q["difficulty"]))
    write(f"content/questions/{slug}.json", slug,
          [{"id": f"{slug}-{i:03d}", "difficulty": q["difficulty"], "ref": q["ref"], "text": q["text"]} for i, q in enumerate(qs, 1)])
    total += len(qs)
if originals:
    write("content/questions/legacy.json", "legacy",
          [{"id": q["orig"], "difficulty": q["difficulty"], "ref": "", "text": q["text"]} for q in originals])
print(f"{len(units)} reviewed batches: {total} reviewed questions in {len(by_book)} books, {len(originals)} originals still unreviewed")
