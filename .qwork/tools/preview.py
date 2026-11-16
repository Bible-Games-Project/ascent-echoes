# Copies the static build into the Artifact preview folder, adapting it to
# run inside the Artifact frame. Prints the published-file map (JSON).
import json, os, re, shutil, sys
PREV = sys.argv[1]
SRC = ".output/public/assets"
entry = re.search(r'src="/\./assets/([^"]+)"', open(".output/public/index.html").read()).group(1)
old = [f for f in os.listdir(f"{PREV}/assets") if f.endswith(".js")]
for f in old: os.remove(f"{PREV}/assets/{f}")
files = {}
for f in os.listdir(SRC):
    s = open(f"{SRC}/{f}", encoding="utf-8").read()
    if f.endswith(".js"):
        s = s.replace("\ufffd", "\\uFFFD").replace('="/__l5e/', '=window.__ASSET_BASE__+"l5e/')
    open(f"{PREV}/assets/{f}", "w", encoding="utf-8").write(s)
    files[f"assets/{f}"] = f"{PREV}/assets/{f}"
g = open(f"{PREV}/game.html").read()
g = re.sub(r'js\.src = base \+ "[^"]+";', f'js.src = base + "{entry}";', g)
open(f"{PREV}/game.html", "w").write(g)
files["game.html"] = f"{PREV}/game.html"
for f in old:
    if f"assets/{f}" not in files: files[f"assets/{f}"] = None
print(json.dumps(files))
