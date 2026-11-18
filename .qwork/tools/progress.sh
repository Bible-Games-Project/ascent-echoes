#!/bin/bash
# Print chapter-level progress of the chapter queue.
cd "$(dirname "$0")/../.."
node -e '
const fs=require("fs");const u=JSON.parse(fs.readFileSync(".qwork/ch-units.json"));const units=Array.isArray(u)?u:u.units;
const q=JSON.parse(fs.readFileSync(".qwork/ch-queue.json"));
const done=new Set(q.filter(s=>s.step==="tr"&&s.status==="done").map(s=>s.unit));
let tot=0,d=0,n=0;for(const x of units){const c=x.to-x.from+1;tot+=c;if(done.has(x.id)){d+=c;n++;}}
console.log(`PROGRESS: ${d}/${tot} chapters (${(100*d/tot).toFixed(1)}% done, ${(100-100*d/tot).toFixed(1)}% left), units ${n}/${units.length}`);'
