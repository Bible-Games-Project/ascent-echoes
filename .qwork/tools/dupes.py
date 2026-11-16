# Lists likely repeated facts across output files: same English question, or
# same book + same correct answer with overlapping wording.
import json, glob, re, sys, itertools
files = sys.argv[1:] or sorted(glob.glob(".qwork/out/review-*.json"))
STOP = set("a an the of in on to and or by for from with at is was were did does do who what which whom whose where when how many much why this that these those his her he she it its their they him them as be into after before about".split())
def words(s): return {w for w in re.findall(r"[a-z0-9']+", s.lower()) if w not in STOP}
qs = []
for f in files:
    for q in json.load(open(f))["questions"]:
        qs.append((q["id"], q.get("book"), q["ref"], q["text"]["en"]))
seen = {}
pairs = []
for a, b in itertools.combinations(qs, 2):
    if a[3][0].lower() == b[3][0].lower():
        pairs.append(("same-question", a, b)); continue
    if a[1] == b[1] and a[3][1].lower() == b[3][1].lower():
        wa, wb = words(a[3][0]), words(b[3][0])
        j = len(wa & wb) / max(1, len(wa | wb))
        if j >= 0.3 or a[2] == b[2]: pairs.append((f"same-answer {j:.2f}", a, b))
for kind, a, b in pairs:
    print(f"{kind}\n  {a[0]} [{a[2]}] {a[3][0]} -> {a[3][1]}\n  {b[0]} [{b[2]}] {b[3][0]} -> {b[3][1]}")
print(f"{len(pairs)} suspicious pairs in {len(qs)} questions", file=sys.stderr)
