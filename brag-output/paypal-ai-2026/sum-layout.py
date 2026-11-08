import json, sys
raw = sys.stdin.read()
d = json.loads(raw[raw.find("{"):])
for key in ("layout", "runtime", "contrast"):
    sec = d.get(key, {})
    for f in sec.get("findings", [])[:12]:
        msg = str(f.get("message", ""))[:220].replace("\n", " ")
        print(key, "|", f.get("severity", "?"), "|", f.get("rule", "?"), "|", msg)
