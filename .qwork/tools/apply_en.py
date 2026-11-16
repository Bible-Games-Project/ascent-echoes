# Applies English corrections: python3 .qwork/tools/apply_en.py <file> <patch.json>
# patch.json: {"<id>": {"en": [question, correct, wrong1, wrong2], "ref": "...", "difficulty": "..."}}
# ("ref" and "difficulty" optional). Changed questions get "needs_translation": true.
import json, sys
path, patch = sys.argv[1], json.load(open(sys.argv[2]))
data = json.load(open(path))
byid = {q["id"]: q for q in data["questions"]}
for qid, fix in patch.items():
    q = byid[qid]
    if "en" in fix:
        assert len(fix["en"]) == 4, qid
        if fix["en"] != q["text"]["en"]:
            q["text"]["en"] = fix["en"]; q["needs_translation"] = True
    for k in ("ref", "difficulty"):
        if k in fix: q[k] = fix[k]
json.dump(data, open(path, "w"), ensure_ascii=False, indent=1)
print(f"applied {len(patch)} fixes; {sum(1 for q in data['questions'] if q.get('needs_translation'))} questions need new translations")
