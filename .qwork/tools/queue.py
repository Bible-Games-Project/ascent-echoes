# Tiny work queue. python3 queue.py next | done <unit> <step> | fail <unit> <step> | status
import json, sys
import os
Q = os.environ.get("Q", ".qwork/queue.json")
steps = json.load(open(Q))
cmd = sys.argv[1]
if cmd == "next":
    s = next((s for s in steps if s["status"] in ("todo", "failed")), None)
    if s:
        s["status"] = "running"
        print(f'{s["unit"]} {s["step"]} {s["model"]}')
    else:
        print("EMPTY")
elif cmd in ("done", "fail"):
    for s in steps:
        if s["unit"] == sys.argv[2] and s["step"] == sys.argv[3]:
            s["status"] = "done" if cmd == "done" else "failed"
elif cmd == "status":
    from collections import Counter
    print(dict(Counter(s["status"] for s in steps)))
json.dump(steps, open(Q, "w"), indent=0)
