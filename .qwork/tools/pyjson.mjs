// JSON output that matches Python's json.dump(..., ensure_ascii=False) byte for byte,
// so the Node ports of the .py tools produce the same files (no python3 on some hosts).
// indent: undefined -> one line with ", " and ": "; a number -> Python's indent=N layout.
export function pyDumps(v, indent, level = 0) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  const isArr = Array.isArray(v);
  const items = isArr ? v.map((x) => pyDumps(x, indent, level + 1))
    : Object.entries(v).map(([k, x]) => JSON.stringify(k) + ": " + pyDumps(x, indent, level + 1));
  const [o, c] = isArr ? ["[", "]"] : ["{", "}"];
  if (!items.length) return o + c;
  if (indent === undefined) return o + items.join(", ") + c;
  const pad = (n) => "\n" + " ".repeat(indent * n);
  return o + pad(level + 1) + items.join("," + pad(level + 1)) + pad(level) + c;
}
