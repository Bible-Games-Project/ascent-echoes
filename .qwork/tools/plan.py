import json, math
# slug, English name, chapters, verses (Catholic canon, approximate verse counts)
B = """genesis|Genesis|50|1533
exodus|Exodus|40|1213
leviticus|Leviticus|27|859
numbers|Numbers|36|1288
deuteronomy|Deuteronomy|34|959
joshua|Joshua|24|658
judges|Judges|21|618
ruth|Ruth|4|85
1-samuel|1 Samuel|31|810
2-samuel|2 Samuel|24|695
1-kings|1 Kings|22|816
2-kings|2 Kings|25|719
1-chronicles|1 Chronicles|29|942
2-chronicles|2 Chronicles|36|822
ezra|Ezra|10|280
nehemiah|Nehemiah|13|406
tobit|Tobit|14|244
judith|Judith|16|340
esther|Esther|10|270
1-maccabees|1 Maccabees|16|924
2-maccabees|2 Maccabees|15|555
job|Job|42|1070
psalms|Psalms|150|2461
proverbs|Proverbs|31|915
ecclesiastes|Ecclesiastes|12|222
song-of-songs|Song of Songs|8|117
wisdom|Wisdom|19|435
sirach|Sirach|51|1390
isaiah|Isaiah|66|1292
jeremiah|Jeremiah|52|1364
lamentations|Lamentations|5|154
baruch|Baruch|6|213
ezekiel|Ezekiel|48|1273
daniel|Daniel|14|424
hosea|Hosea|14|197
joel|Joel|4|73
amos|Amos|9|146
obadiah|Obadiah|1|21
jonah|Jonah|4|48
micah|Micah|7|105
nahum|Nahum|3|47
habakkuk|Habakkuk|3|56
zephaniah|Zephaniah|3|53
haggai|Haggai|2|38
zechariah|Zechariah|14|211
malachi|Malachi|3|55
matthew|Matthew|28|1071
mark|Mark|16|678
luke|Luke|24|1151
john|John|21|879
acts|Acts|28|1007
romans|Romans|16|433
1-corinthians|1 Corinthians|16|437
2-corinthians|2 Corinthians|13|257
galatians|Galatians|6|149
ephesians|Ephesians|6|155
philippians|Philippians|4|104
colossians|Colossians|4|95
1-thessalonians|1 Thessalonians|5|89
2-thessalonians|2 Thessalonians|3|47
1-timothy|1 Timothy|6|113
2-timothy|2 Timothy|4|83
titus|Titus|3|46
philemon|Philemon|1|25
hebrews|Hebrews|13|303
james|James|5|108
1-peter|1 Peter|5|105
2-peter|2 Peter|3|61
1-john|1 John|5|105
2-john|2 John|1|13
3-john|3 John|1|15
jude|Jude|1|25
revelation|Revelation|22|404"""
books = [dict(zip(["slug","name","chapters","verses"], l.split("|"))) for l in B.splitlines()]
for b in books: b["chapters"]=int(b["chapters"]); b["verses"]=int(b["verses"])
# Gospels and narrative books are richer in one-word facts than their length suggests.
BOOST = {"matthew":1.3,"mark":1.3,"luke":1.3,"john":1.3,"acts":1.25,"genesis":1.3,"exodus":1.25,"1-samuel":1.2,"2-samuel":1.15,"1-kings":1.2,"2-kings":1.15,"judges":1.15,"joshua":1.1,"daniel":1.2,"jonah":1.3,"ruth":1.2,"esther":1.15,"tobit":1.2,"judith":1.15,
         "psalms":0.8,"proverbs":0.8,"sirach":0.8,"1-chronicles":0.85,"leviticus":0.85,"numbers":0.9}
TOTAL = 10950
w = {b["slug"]: (b["verses"]**0.6) * BOOST.get(b["slug"],1.0) for b in books}
s = sum(w.values())
alloc = {k: max(15, round(TOTAL*v/s)) for k,v in w.items()}
diff = TOTAL - sum(alloc.values())
order = sorted(alloc, key=lambda k: -alloc[k])
i = 0
while diff:
    k = order[i % 12]; step = 1 if diff > 0 else -1
    alloc[k] += step; diff -= step; i += 1
assert len(books) == 73 and sum(alloc.values()) == TOTAL
SPLIT = [("easy",.25),("medium",.25),("hard",.20),("expert",.15),("impossible",.15)]
def split(n):
    raw = [(d, n*p) for d,p in SPLIT]; out = {d:int(x) for d,x in raw}
    rest = n - sum(out.values())
    for d,x in sorted(raw, key=lambda t: -(t[1]-int(t[1])))[:rest]: out[d]+=1
    return out
units = []
for b in books:
    n = alloc[b["slug"]]; b["alloc"] = n
    k = math.ceil(n/70); ch = b["chapters"]
    for j in range(k):
        cnt = n//k + (1 if j < n % k else 0)
        if k == 1: rng = f"the whole book ({ch} chapter{'s' if ch>1 else ''})"
        else:
            a = j*ch//k + 1; z = (j+1)*ch//k
            rng = f"chapters {a}-{z}" if z > a else f"chapter {a}"
        units.append({"kind":"gen","id":f"gen-{b['slug']}-{j+1}","book":b["slug"],"bookName":b["name"],"range":rng,"count":cnt,"split":split(cnt),"file":f".qwork/out/gen-{b['slug']}-{j+1}.json"})
json.dump(books, open(".qwork/books.json","w"), indent=1)
json.dump(units, open(".qwork/gen-units.json","w"), indent=1)
print("units", len(units), "max", max(u["count"] for u in units), "min", min(u["count"] for u in units))
for b in sorted(books, key=lambda b: -b["alloc"])[:8]: print(b["name"], b["alloc"])
for b in sorted(books, key=lambda b: b["alloc"])[:8]: print(b["name"], b["alloc"])
