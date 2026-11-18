import fs from "node:fs";
const L=["en","es","pt","fr","de","it","pl","ru","tr","ja","ko","ar"];
const files=fs.readdirSync(".").filter(f=>/^part\d+\.txt$/.test(f)).sort();
const out=[];let n=0;
for(const f of files){
  for(const block of fs.readFileSync(f,"utf8").split(/\n\s*\n/)){
    const lines=block.trim().split("\n").filter(Boolean); if(!lines.length)continue;
    const [ch,diff,...ref]=lines[0].slice(1).split(" ");
    const text={};
    for(const l of lines.slice(1)){const i=l.indexOf(": ");text[l.slice(0,i)]=l.slice(i+2).split("|").map(s=>s.trim());}
    for(const k of L) if(!text[k]) throw new Error("missing "+k+" in "+lines[0]);
    n++;
    out.push({id:"ch-sirach-035-"+String(n).padStart(2,"0"),book:"sirach",chapter:+ch,difficulty:diff,ref:ref.join(" "),text});
  }
}
fs.writeFileSync("../out/ch-sirach-035.json",JSON.stringify({questions:out},null,1));
console.log(n);
